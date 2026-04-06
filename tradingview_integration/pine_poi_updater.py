"""
pine_poi_updater.py  (Extended Edition)
────────────────────────────────────────
Multi-source market data aggregator that:
  1. Fetches live quotes from Google Finance for 20+ tickers.
  2. Falls back to Yahoo Finance JSON API when Google data is unavailable.
  3. Computes momentum, 5-bar ROC, and simple RSI-proxy from cached prices.
  4. Writes a Markdown table into the README between the AUTO-UPDATE markers.
  5. Saves raw JSON results to tradingview_integration/data/google_finance_quotes.json.
  6. Exports a CSV snapshot to tradingview_integration/data/quotes_snapshot.csv.
  7. Computes a composite market-breadth score across all tickers.

Usage (called by the GitHub Actions workflow):
    python tradingview_integration/pine_poi_updater.py

Note: Google Finance does not provide a formal public API.  This script uses
      a best-effort HTML scrape with multiple fallback patterns.  If Google
      changes their page structure the regex patterns may need updating.
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Optional dependency: requests (with urllib fallback) ──────────────────────
try:
    import requests as _requests_mod

    def _get(url: str, timeout: int = 15) -> str:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (compatible; pine-poi-updater/1.0; "
                "+https://github.com/majixai/majixai.github.io)"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        resp = _requests_mod.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp.text

except ImportError:
    import urllib.request

    def _get(url: str, timeout: int = 15) -> str:  # type: ignore[misc]
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; pine-poi-updater/1.0; "
                    "+https://github.com/majixai/majixai.github.io)"
                )
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")


# ── Configuration ─────────────────────────────────────────────────────────────

# Extended ticker list — 20 instruments across equities, ETFs, and crypto
TICKERS: list[tuple[str, str]] = [
    ("SPY",    "NYSEARCA"),
    ("QQQ",    "NASDAQ"),
    ("DIA",    "NYSEARCA"),
    ("IWM",    "NYSEARCA"),
    ("AAPL",   "NASDAQ"),
    ("MSFT",   "NASDAQ"),
    ("GOOGL",  "NASDAQ"),
    ("AMZN",   "NASDAQ"),
    ("TSLA",   "NASDAQ"),
    ("NVDA",   "NASDAQ"),
    ("META",   "NASDAQ"),
    ("JPM",    "NYSE"),
    ("BAC",    "NYSE"),
    ("GS",     "NYSE"),
    ("XOM",    "NYSE"),
    ("GLD",    "NYSEARCA"),
    ("SLV",    "NYSEARCA"),
    ("TLT",    "NASDAQ"),
    ("VIX",    "INDEXCBOE"),
    ("BTC-USD","CRYPTO"),
]

# Rate limiting — pause between requests (seconds)
REQUEST_DELAY_S = 0.8

REPO_ROOT   = Path(__file__).resolve().parent.parent
README_PATH = REPO_ROOT / "tradingview_integration" / "pine_script" / "README.md"
DATA_DIR    = REPO_ROOT / "tradingview_integration" / "data"
JSON_PATH   = DATA_DIR / "google_finance_quotes.json"
CSV_PATH    = DATA_DIR / "quotes_snapshot.csv"

# Persistent price-history cache for momentum computation
PRICE_CACHE_PATH = DATA_DIR / "price_cache.json"
PRICE_CACHE_BARS = 10       # number of previous closes to retain per ticker

BASE_URL = "https://www.google.com/finance/quote/{ticker}:{exchange}"

# Yahoo Finance fallback endpoint
YF_BASE_URL = (
    "https://query1.finance.yahoo.com/v8/finance/chart/"
    "{symbol}?interval=1d&range=1mo"
)

# ── Regex patterns ─────────────────────────────────────────────────────────────
_PRICE_PATTERNS = [
    re.compile(r'"price":\s*"?([\d,]+\.?\d*)"?'),
    re.compile(r'class="[^"]*YMlKec[^"]*"[^>]*>([\d,]+\.?\d*)'),
    re.compile(r'price["\s:]+\$([\d,]+\.?\d*)'),
    re.compile(r'"regularMarketPrice"[^}]*"raw":\s*([\d.]+)'),
    re.compile(r'data-last-price="([\d.]+)"'),
]

_CHANGE_PATTERNS = [
    re.compile(r'"priceChange":\s*"?([-+]?[\d,]+\.?\d*)"?'),
    re.compile(r'class="[^"]*P2Luy[^"]*"[^>]*>([-+]?[\d,.]+)'),
    re.compile(r'"regularMarketChange"[^}]*"raw":\s*([-+]?[\d.]+)'),
]

_CHANGE_PCT_PATTERNS = [
    re.compile(r'"priceChangePercentage":\s*"?([-+]?[\d.]+)"?'),
    re.compile(r'class="[^"]*P2Luy[^"]*"[^>]*>.*?\(([-+]?[\d.]+)%\)'),
    re.compile(r'\(([-+]?[\d.]+)%\)'),
    re.compile(r'"regularMarketChangePercent"[^}]*"raw":\s*([-+]?[\d.]+)'),
]

_NUMERIC_RE = re.compile(r"^[-+]?[\d,]*\.?\d+$")


def _first_match(html: str, patterns: list[re.Pattern]) -> Optional[str]:
    """Return the first valid numeric match across all patterns."""
    for pat in patterns:
        m = pat.search(html)
        if m:
            raw = m.group(1).replace(",", "")
            if _NUMERIC_RE.match(raw):
                return raw
    return None


# ── Price cache (for momentum / RSI proxy) ────────────────────────────────────

def _load_price_cache() -> dict[str, list[float]]:
    if PRICE_CACHE_PATH.exists():
        try:
            with open(PRICE_CACHE_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_price_cache(cache: dict[str, list[float]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(PRICE_CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _update_cache(cache: dict, ticker: str, price: Optional[str]) -> None:
    """Append new price to the rolling cache list, trimming to max length."""
    if price is None:
        return
    try:
        p = float(price)
    except ValueError:
        return
    hist = cache.get(ticker, [])
    hist.append(p)
    cache[ticker] = hist[-PRICE_CACHE_BARS:]


# ── Momentum / technical metrics from price history ──────────────────────────

def _compute_momentum(prices: list[float]) -> dict:
    """
    Compute simple technical metrics from the cached price history:
      - momentum_5b  : (price[-1] / price[-5] − 1) × 100
      - rsi_proxy    : Wilder RSI approximation over available bars
      - avg_gain_bars: bars with positive daily return in window
      - trend_arrow  : ▲ / ▼ / ─ emoji
    """
    if len(prices) < 2:
        return {"momentum_5b": None, "rsi_proxy": None, "trend_arrow": "─"}

    n    = len(prices)
    mom5 = None
    if n >= 5:
        try:
            mom5 = round((prices[-1] / prices[-5] - 1.0) * 100, 2)
        except ZeroDivisionError:
            pass

    gains  = [prices[i] - prices[i - 1] for i in range(1, n) if prices[i] > prices[i - 1]]
    losses = [prices[i - 1] - prices[i] for i in range(1, n) if prices[i] < prices[i - 1]]
    avg_g  = sum(gains)  / len(gains)  if gains  else 0.0
    avg_l  = sum(losses) / len(losses) if losses else 1e-9
    rs     = avg_g / (avg_l + 1e-9)
    rsi    = round(100.0 - 100.0 / (1.0 + rs), 1)

    if len(prices) >= 2:
        delta = prices[-1] - prices[-2]
        arrow = "▲" if delta > 0 else ("▼" if delta < 0 else "─")
    else:
        arrow = "─"

    return {
        "momentum_5b":  mom5,
        "rsi_proxy":    rsi,
        "trend_arrow":  arrow,
        "avg_gain_bars": len(gains),
        "avg_loss_bars": len(losses),
    }


# ── Yahoo Finance fallback ─────────────────────────────────────────────────────

def _fetch_yahoo_fallback(ticker: str, exchange: str) -> Optional[str]:
    """
    Query Yahoo Finance v8 chart API as a price fallback.
    Returns the latest close price as a string, or None.
    """
    symbol = ticker if exchange != "CRYPTO" else ticker
    url    = YF_BASE_URL.format(symbol=symbol)
    try:
        html   = _get(url, timeout=10)
        data   = json.loads(html)
        closes = (
            data.get("chart", {})
                .get("result", [{}])[0]
                .get("indicators", {})
                .get("quote", [{}])[0]
                .get("close", [])
        )
        closes = [c for c in closes if c is not None]
        if closes:
            return str(round(closes[-1], 4))
    except Exception:
        pass
    return None


# ── Quote fetch ───────────────────────────────────────────────────────────────

def fetch_quote(
    ticker: str,
    exchange: str,
    price_cache: dict[str, list[float]],
) -> dict:
    """Fetch a single quote; falls back to Yahoo Finance if Google parse fails."""
    url = BASE_URL.format(ticker=ticker, exchange=exchange)
    result: dict = {
        "ticker":        ticker,
        "exchange":      exchange,
        "url":           url,
        "price":         None,
        "change":        None,
        "change_pct":    None,
        "momentum_5b":   None,
        "rsi_proxy":     None,
        "trend_arrow":   "─",
        "source":        "google",
        "error":         None,
        "fetched_at":    datetime.now(timezone.utc).isoformat(),
    }

    html: Optional[str] = None
    try:
        html = _get(url)
    except (OSError, ValueError) as exc:
        import traceback
        result["error"] = str(exc)
        print(
            f"  fetch error detail:\n{traceback.format_exc()}",
            file=sys.stderr,
        )

    if html:
        result["price"]      = _first_match(html, _PRICE_PATTERNS)
        result["change"]     = _first_match(html, _CHANGE_PATTERNS)
        result["change_pct"] = _first_match(html, _CHANGE_PCT_PATTERNS)

    # Yahoo Finance fallback when Google parse yields nothing
    if result["price"] is None:
        yf_price = _fetch_yahoo_fallback(ticker, exchange)
        if yf_price is not None:
            result["price"]  = yf_price
            result["source"] = "yahoo"
            result["error"]  = None

    # Momentum metrics from price cache
    _update_cache(price_cache, ticker, result["price"])
    metrics = _compute_momentum(price_cache.get(ticker, []))
    result["momentum_5b"]   = metrics["momentum_5b"]
    result["rsi_proxy"]     = metrics["rsi_proxy"]
    result["trend_arrow"]   = metrics["trend_arrow"]
    result["avg_gain_bars"] = metrics["avg_gain_bars"]
    result["avg_loss_bars"] = metrics["avg_loss_bars"]

    return result


# ── Markdown table ─────────────────────────────────────────────────────────────

def _fmt(value: Optional[str], prefix: str = "") -> str:
    if value is None:
        return "—"
    return f"{prefix}{value}"


def _trend_cell(q: dict) -> str:
    arrow = q.get("trend_arrow", "─")
    mom   = q.get("momentum_5b")
    if mom is None:
        return arrow
    return f"{arrow} {mom:+.2f}%"


def build_markdown_table(quotes: list[dict], now: datetime) -> str:
    """Render the extended quote list as a GitHub-flavoured Markdown table."""
    ts = now.strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"_Last updated: {ts}_",
        "",
        "### Live Market Snapshot  (Google Finance · Yahoo Finance fallback)",
        "",
        "| Ticker | Exch | Price | Chg | Chg% | Mom-5b | RSI~ | Src | Updated |",
        "|--------|------|-------|-----|------|--------|------|-----|---------|",
    ]
    for q in quotes:
        price      = _fmt(q["price"], "$")
        change     = _fmt(q["change"])
        change_pct = _fmt(q["change_pct"], "") + ("%" if q["change_pct"] else "")
        mom_cell   = _trend_cell(q)
        rsi_raw    = q.get("rsi_proxy")
        rsi_cell   = f"{rsi_raw:.0f}" if rsi_raw is not None else "—"
        src        = q.get("source", "—")
        updated    = q["fetched_at"][:16].replace("T", " ") + " UTC" if q.get("fetched_at") else "—"
        err        = f" ⚠ {q['error']}" if q.get("error") else ""
        lines.append(
            f"| [{q['ticker']}]({q['url']}) | {q['exchange']} "
            f"| {price} | {change} | {change_pct} | {mom_cell} | {rsi_cell} "
            f"| {src} | {updated}{err} |"
        )

    # Breadth summary
    breadth = _compute_breadth(quotes)
    lines += [
        "",
        "#### Market Breadth",
        f"- Advancing: **{breadth['advancing']}** / {breadth['total']}  "
        f"| Declining: **{breadth['declining']}**  "
        f"| Unchanged: {breadth['unchanged']}",
        f"- Composite score: **{breadth['composite_score']:+.2f}**  "
        f"| Avg RSI proxy: {breadth['avg_rsi']:.1f}",
        f"- Positive momentum (5b): {breadth['positive_momentum']}  "
        f"| Negative: {breadth['negative_momentum']}",
    ]
    return "\n".join(lines)


# ── Market breadth ─────────────────────────────────────────────────────────────

def _compute_breadth(quotes: list[dict]) -> dict:
    """Aggregate breadth metrics across all fetched quotes."""
    advancing = 0
    declining = 0
    unchanged = 0
    score_sum = 0.0
    rsi_vals  = []
    pos_mom   = 0
    neg_mom   = 0

    for q in quotes:
        chg = q.get("change")
        try:
            v = float(chg) if chg else 0.0
        except (ValueError, TypeError):
            v = 0.0

        if v > 0:
            advancing += 1
        elif v < 0:
            declining += 1
        else:
            unchanged += 1
        score_sum += v

        rsi = q.get("rsi_proxy")
        if rsi is not None:
            rsi_vals.append(rsi)

        mom = q.get("momentum_5b")
        if mom is not None:
            if mom > 0:
                pos_mom += 1
            elif mom < 0:
                neg_mom += 1

    total = len(quotes)
    return {
        "advancing":          advancing,
        "declining":          declining,
        "unchanged":          unchanged,
        "total":              total,
        "composite_score":    round(score_sum, 4),
        "avg_rsi":            round(sum(rsi_vals) / len(rsi_vals), 1) if rsi_vals else 0.0,
        "positive_momentum":  pos_mom,
        "negative_momentum":  neg_mom,
    }


# ── README update ─────────────────────────────────────────────────────────────

def update_readme(table_md: str) -> None:
    start_marker = "<!-- AUTO-UPDATE-START -->"
    end_marker   = "<!-- AUTO-UPDATE-END -->"

    text      = README_PATH.read_text(encoding="utf-8")
    start_idx = text.find(start_marker)
    end_idx   = text.find(end_marker)

    if start_idx == -1 or end_idx == -1:
        print("WARNING: AUTO-UPDATE markers not found in README; skipping update.")
        return

    new_block = (
        f"{start_marker}\n"
        f"{table_md}\n\n"
        f"{end_marker}"
    )
    updated = text[:start_idx] + new_block + text[end_idx + len(end_marker):]
    README_PATH.write_text(updated, encoding="utf-8")
    print(f"README updated: {README_PATH}")


# ── JSON persist ──────────────────────────────────────────────────────────────

def save_json(quotes: list[dict], breadth: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "quotes":       quotes,
        "breadth":      breadth,
    }
    JSON_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"JSON saved: {JSON_PATH}")


# ── CSV snapshot ──────────────────────────────────────────────────────────────

def save_csv(quotes: list[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "ticker", "exchange", "price", "change", "change_pct",
        "momentum_5b", "rsi_proxy", "trend_arrow", "source",
        "avg_gain_bars", "avg_loss_bars", "error", "fetched_at",
    ]
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(quotes)
    print(f"CSV saved: {CSV_PATH}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    now          = datetime.now(timezone.utc)
    price_cache  = _load_price_cache()
    quotes: list[dict] = []

    print(f"[pine_poi_updater] Fetching {len(TICKERS)} tickers …")
    for idx, (ticker, exchange) in enumerate(TICKERS):
        print(f"  [{idx + 1:2d}/{len(TICKERS)}] {ticker}:{exchange} … ", end="", flush=True)
        q = fetch_quote(ticker, exchange, price_cache)
        quotes.append(q)
        if q["error"] and q["price"] is None:
            print(f"ERROR — {q['error']}")
        else:
            rsi_s = f"  rsi~={q['rsi_proxy']}" if q["rsi_proxy"] is not None else ""
            mom_s = f"  mom5={q['momentum_5b']:+.2f}%" if q["momentum_5b"] is not None else ""
            print(
                f"price={q['price']}  chg={q['change']}  "
                f"chg%={q['change_pct']}  src={q['source']}{rsi_s}{mom_s}"
            )
        # Rate limiting
        if idx < len(TICKERS) - 1:
            time.sleep(REQUEST_DELAY_S)

    _save_price_cache(price_cache)

    breadth  = _compute_breadth(quotes)
    table_md = build_markdown_table(quotes, now)
    update_readme(table_md)
    save_json(quotes, breadth)
    save_csv(quotes)

    print(
        f"\n[pine_poi_updater] Breadth — "
        f"↑{breadth['advancing']} / ↓{breadth['declining']} / ─{breadth['unchanged']}  "
        f"score={breadth['composite_score']:+.2f}  avgRSI={breadth['avg_rsi']:.1f}"
    )

    errors = [q for q in quotes if q["error"] and q["price"] is None]
    if errors:
        print(f"\n  {len(errors)} ticker(s) failed entirely: "
              f"{', '.join(q['ticker'] for q in errors)}")
    sys.exit(0)


if __name__ == "__main__":
    main()
