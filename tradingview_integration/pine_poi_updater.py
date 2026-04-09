"""
pine_poi_updater.py  (Refactored Edition)
─────────────────────────────────────────
Multi-source market data aggregator that:
  1. Uses yfinance (structured API) as primary live data provider.
  2. Falls back to Yahoo Finance v8 chart JSON endpoint (no extra deps).
  3. Maintains a normalized quotes_db.json cache; stale/failed refreshes fall
     back to last-known-good cached values (labeled source="cache").
  4. Computes change/change_pct from price - previous_close when not supplied.
  5. NEVER outputs numbers from HTML regex scraping of Google Finance.
  6. Writes a Markdown table into the README between AUTO-UPDATE markers.
  7. Saves raw JSON results to tradingview_integration/data/google_finance_quotes.json.
  8. Exports a CSV snapshot to tradingview_integration/data/quotes_snapshot.csv.
  9. Computes a composite market-breadth score across all tickers.

Usage (called by the GitHub Actions workflow):
    python tradingview_integration/pine_poi_updater.py
"""

from __future__ import annotations

import csv
import json
import sys
import time
from datetime import datetime, timedelta, timezone
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
            "Accept": "application/json,*/*;q=0.8",
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


# ── Optional dependency: yfinance ─────────────────────────────────────────────
try:
    import yfinance as _yf_mod
    _YFINANCE_AVAILABLE = True
except ImportError:
    _yf_mod = None  # type: ignore[assignment]
    _YFINANCE_AVAILABLE = False


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

# Cache TTL: refresh live data if cached entry is older than this many minutes
CACHE_TTL_MINUTES = 60

REPO_ROOT   = Path(__file__).resolve().parent.parent
README_PATH = REPO_ROOT / "tradingview_integration" / "pine_script" / "README.md"
DATA_DIR    = REPO_ROOT / "tradingview_integration" / "data"
JSON_PATH   = DATA_DIR / "google_finance_quotes.json"
CSV_PATH    = DATA_DIR / "quotes_snapshot.csv"

# Persistent price-history cache for momentum computation
PRICE_CACHE_PATH = DATA_DIR / "price_cache.json"
PRICE_CACHE_BARS = 10       # number of previous closes to retain per ticker

# Normalized quotes database — last-known-good values per ticker
QUOTES_DB_PATH = DATA_DIR / "quotes_db.json"

# Yahoo Finance chart endpoint (structured JSON, no extra deps)
YF_BASE_URL = (
    "https://query1.finance.yahoo.com/v8/finance/chart/"
    "{symbol}?interval=1d&range=5d"
)


# ── Symbol helpers ────────────────────────────────────────────────────────────

def _yf_symbol(ticker: str, exchange: str) -> str:
    """Map internal ticker/exchange to a Yahoo Finance / yfinance symbol."""
    if exchange == "INDEXCBOE":
        return f"^{ticker}"
    return ticker


# ── Quotes DB (cache) ─────────────────────────────────────────────────────────

def _load_quotes_db() -> dict:
    """Load the normalized quotes database from disk."""
    if QUOTES_DB_PATH.exists():
        try:
            with open(QUOTES_DB_PATH, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_quotes_db(db: dict) -> None:
    """Persist the quotes database to disk."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(QUOTES_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)


def _is_stale(entry: dict, ttl_minutes: int = CACHE_TTL_MINUTES) -> bool:
    """Return True if the cache entry is missing or older than ttl_minutes."""
    asof = entry.get("asof")
    if not asof:
        return True
    try:
        ts = datetime.fromisoformat(asof)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - ts
        return age > timedelta(minutes=ttl_minutes)
    except (ValueError, TypeError):
        return True


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


def _update_price_cache(cache: dict, ticker: str, price: Optional[str]) -> None:
    """Append new price to the rolling cache list, trimming to max length."""
    if price is None:
        return
    try:
        p = float(price)
    except (ValueError, TypeError):
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
    Always returns all keys so callers can rely on them unconditionally.
    """
    result: dict = {
        "momentum_5b":   None,
        "rsi_proxy":     None,
        "trend_arrow":   "─",
        "avg_gain_bars": 0,
        "avg_loss_bars": 0,
    }
    if len(prices) < 2:
        return result

    n = len(prices)
    if n >= 5:
        try:
            result["momentum_5b"] = round((prices[-1] / prices[-5] - 1.0) * 100, 2)
        except ZeroDivisionError:
            pass

    gains  = [prices[i] - prices[i - 1] for i in range(1, n) if prices[i] > prices[i - 1]]
    losses = [prices[i - 1] - prices[i] for i in range(1, n) if prices[i] < prices[i - 1]]
    avg_g  = sum(gains)  / len(gains)  if gains  else 0.0
    avg_l  = sum(losses) / len(losses) if losses else 1e-9
    rs     = avg_g / (avg_l + 1e-9)
    result["rsi_proxy"]     = round(100.0 - 100.0 / (1.0 + rs), 1)
    result["avg_gain_bars"] = len(gains)
    result["avg_loss_bars"] = len(losses)

    delta = prices[-1] - prices[-2]
    result["trend_arrow"] = "▲" if delta > 0 else ("▼" if delta < 0 else "─")

    return result


# ── yfinance provider ─────────────────────────────────────────────────────────

def _fetch_yfinance(ticker: str, exchange: str) -> dict:
    """
    Fetch a quote using the yfinance library (structured data, no HTML parsing).
    Returns a dict with keys: price, change, change_pct, previous_close,
    source, error.  All numeric values are strings or None.
    """
    result: dict = {
        "price":          None,
        "change":         None,
        "change_pct":     None,
        "previous_close": None,
        "source":         None,
        "error":          None,
    }
    if not _YFINANCE_AVAILABLE:
        result["error"] = "yfinance not installed"
        return result

    symbol = _yf_symbol(ticker, exchange)
    try:
        t  = _yf_mod.Ticker(symbol)
        fi = t.fast_info

        price      = getattr(fi, "last_price",      None)
        prev_close = getattr(fi, "previous_close",  None)

        # Some yfinance versions expose regularMarketPrice via .info (slower)
        if price is None:
            info  = t.info or {}
            price = info.get("regularMarketPrice") or info.get("currentPrice")
            if prev_close is None:
                prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")

        if price is not None:
            result["price"]  = str(round(float(price), 4))
            result["source"] = "yfinance"

        if prev_close is not None:
            result["previous_close"] = str(round(float(prev_close), 4))

        # Compute change / change_pct from structured values
        if price is not None and prev_close is not None and float(prev_close) != 0:
            chg     = float(price) - float(prev_close)
            chg_pct = (chg / float(prev_close)) * 100.0
            result["change"]     = str(round(chg, 4))
            result["change_pct"] = str(round(chg_pct, 4))

    except Exception as exc:
        result["error"] = f"yfinance error: {exc}"
        print(f"  [yfinance] {ticker}: {exc}", file=sys.stderr)

    return result


# ── Yahoo Finance chart JSON provider ─────────────────────────────────────────

def _fetch_yahoo_chart(ticker: str, exchange: str) -> dict:
    """
    Query Yahoo Finance v8 chart API (structured JSON, no HTML parsing).
    Extracts regularMarketPrice and previousClose from the meta block.
    Returns a dict with the same keys as _fetch_yfinance.
    """
    result: dict = {
        "price":          None,
        "change":         None,
        "change_pct":     None,
        "previous_close": None,
        "source":         None,
        "error":          None,
    }
    symbol = _yf_symbol(ticker, exchange)
    url    = YF_BASE_URL.format(symbol=symbol)
    try:
        raw  = _get(url, timeout=12)
        data = json.loads(raw)

        chart_error = data.get("chart", {}).get("error")
        if chart_error:
            result["error"] = f"Yahoo chart error: {chart_error}"
            return result

        results = data.get("chart", {}).get("result")
        if not results:
            result["error"] = "Yahoo chart: empty result"
            return result

        meta       = results[0].get("meta", {})
        price      = meta.get("regularMarketPrice")
        prev_close = meta.get("previousClose") or meta.get("chartPreviousClose")

        if price is not None:
            result["price"]  = str(round(float(price), 4))
            result["source"] = "yahoo_chart"

        if prev_close is not None:
            result["previous_close"] = str(round(float(prev_close), 4))

        if price is not None and prev_close is not None and float(prev_close) != 0:
            chg     = float(price) - float(prev_close)
            chg_pct = (chg / float(prev_close)) * 100.0
            result["change"]     = str(round(chg, 4))
            result["change_pct"] = str(round(chg_pct, 4))

    except Exception as exc:
        result["error"] = f"yahoo_chart error: {exc}"
        print(f"  [yahoo_chart] {ticker}: {exc}", file=sys.stderr)

    return result


# ── Quote fetch ───────────────────────────────────────────────────────────────

def fetch_quote(
    ticker: str,
    exchange: str,
    price_cache: dict[str, list[float]],
    quotes_db: dict,
) -> dict:
    """
    Fetch a single quote using the following priority:
      1. Return cached value if it is still fresh (within CACHE_TTL_MINUTES).
      2. Try yfinance (primary live provider).
      3. Try Yahoo Finance chart JSON (no-dep fallback).
      4. If both live providers fail but a cached value exists, use it and
         set source="cache" + error describing the failure.
      5. If no data at all, leave numeric fields None.
    change/change_pct are computed from price − previous_close when the
    provider does not supply them directly.
    """
    symbol = _yf_symbol(ticker, exchange)
    cached = quotes_db.get(ticker, {})
    now_ts = datetime.now(timezone.utc).isoformat()

    result: dict = {
        "ticker":          ticker,
        "exchange":        exchange,
        "url":             f"https://finance.yahoo.com/quote/{symbol}",
        "price":           None,
        "change":          None,
        "change_pct":      None,
        "previous_close":  None,
        "momentum_5b":     None,
        "rsi_proxy":       None,
        "trend_arrow":     "─",
        "source":          None,
        "error":           None,
        "fetched_at":      now_ts,
    }

    if not _is_stale(cached):
        # Cache is fresh — use stored values as-is
        for key in ("price", "change", "change_pct", "previous_close"):
            result[key] = cached.get(key)
        result["source"]     = "cache"
        result["fetched_at"] = cached.get("asof", now_ts)
    else:
        # Attempt live refresh: yfinance first, then Yahoo chart JSON
        live = _fetch_yfinance(ticker, exchange)
        if live["price"] is None:
            live = _fetch_yahoo_chart(ticker, exchange)

        if live["price"] is not None:
            for key in ("price", "change", "change_pct", "previous_close", "source", "error"):
                result[key] = live.get(key)
            # Persist to quotes_db
            quotes_db[ticker] = {
                "price":          live["price"],
                "change":         live["change"],
                "change_pct":     live["change_pct"],
                "previous_close": live["previous_close"],
                "asof":           now_ts,
                "source":         live["source"],
            }
        elif cached:
            # Live providers failed — fall back to last-known-good cached value
            for key in ("price", "change", "change_pct", "previous_close"):
                result[key] = cached.get(key)
            result["source"] = "cache"
            result["error"]  = live.get("error") or "all providers failed"
        else:
            result["error"] = live.get("error") or "all providers failed"

    # Derive change/change_pct from price and previous_close if not already set
    if (result["price"] is not None
            and result["change"] is None
            and result["previous_close"] is not None):
        try:
            price = float(result["price"])
            prev  = float(result["previous_close"])
            if prev != 0:
                result["change"]     = str(round(price - prev, 4))
                result["change_pct"] = str(round((price / prev - 1.0) * 100.0, 4))
        except (ValueError, TypeError):
            pass

    # Momentum metrics from rolling price history
    _update_price_cache(price_cache, ticker, result["price"])
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
        "### Live Market Snapshot  (yfinance · Yahoo Finance chart fallback)",
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
        src        = q.get("source") or "—"
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
        "previous_close", "momentum_5b", "rsi_proxy", "trend_arrow", "source",
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
    quotes_db    = _load_quotes_db()
    quotes: list[dict] = []

    yf_status = "available" if _YFINANCE_AVAILABLE else "NOT INSTALLED (using yahoo_chart fallback)"
    print(f"[pine_poi_updater] yfinance: {yf_status}")
    print(f"[pine_poi_updater] Fetching {len(TICKERS)} tickers …")
    for idx, (ticker, exchange) in enumerate(TICKERS):
        print(f"  [{idx + 1:2d}/{len(TICKERS)}] {ticker}:{exchange} … ", end="", flush=True)
        q = fetch_quote(ticker, exchange, price_cache, quotes_db)
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
    _save_quotes_db(quotes_db)

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
