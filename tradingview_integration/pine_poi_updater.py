"""
pine_poi_updater.py
───────────────────
Fetches quote data from google.com/finance/quote/ for a configurable list of
tickers, then injects the results into the README auto-update block.

Usage (called by the GitHub Actions workflow):
    python tradingview_integration/pine_poi_updater.py

The script:
  1. Iterates over TICKERS, sending an HTTP GET to each Google Finance quote URL.
  2. Parses the current price, change, and change-% from the response HTML.
  3. Writes a Markdown table into the README between the AUTO-UPDATE markers.
  4. Saves raw JSON results to tradingview_integration/data/google_finance_quotes.json.

Note: Google Finance does not provide a formal public API.  This script uses
      a best-effort HTML scrape with multiple fallback patterns.  If Google
      changes their page structure the regex patterns may need updating.
"""

from __future__ import annotations

import json
import os
import re
import sys
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

# List of (ticker, exchange) pairs to fetch from Google Finance.
# URL pattern: https://www.google.com/finance/quote/{TICKER}:{EXCHANGE}
TICKERS: list[tuple[str, str]] = [
    ("SPY",   "NYSEARCA"),
    ("QQQ",   "NASDAQ"),
    ("DIA",   "NYSEARCA"),
    ("AAPL",  "NASDAQ"),
    ("MSFT",  "NASDAQ"),
    ("GOOGL", "NASDAQ"),
    ("TSLA",  "NASDAQ"),
    ("NVDA",  "NASDAQ"),
    ("BTC-USD", "CRYPTO"),
]

REPO_ROOT = Path(__file__).resolve().parent.parent
README_PATH = REPO_ROOT / "tradingview_integration" / "pine_script" / "README.md"
DATA_DIR    = REPO_ROOT / "tradingview_integration" / "data"
JSON_PATH   = DATA_DIR / "google_finance_quotes.json"

BASE_URL = "https://www.google.com/finance/quote/{ticker}:{exchange}"

# Regex patterns tried in order; first match wins.
_PRICE_PATTERNS = [
    # JSON-like value in page source (common in recent Google Finance HTML)
    re.compile(r'"price":\s*"?([\d,]+\.?\d*)"?'),
    # Large price display element
    re.compile(r'class="[^"]*YMlKec[^"]*"[^>]*>([\d,]+\.?\d*)'),
    # Fallback: any numeric value near the word "price"
    re.compile(r'price["\s:]+\$([\d,]+\.?\d*)'),
]

_CHANGE_PATTERNS = [
    re.compile(r'"priceChange":\s*"?([-+]?[\d,]+\.?\d*)"?'),
    re.compile(r'class="[^"]*P2Luy[^"]*"[^>]*>([-+]?[\d,.]+)'),
]

_CHANGE_PCT_PATTERNS = [
    re.compile(r'"priceChangePercentage":\s*"?([-+]?[\d.]+)"?'),
    re.compile(r'class="[^"]*P2Luy[^"]*"[^>]*>.*?\(([-+]?[\d.]+)%\)'),
    re.compile(r'\(([-+]?[\d.]+)%\)'),
]


_NUMERIC_RE = re.compile(r"^[-+]?[\d,]*\.?\d+$")


def _first_match(html: str, patterns: list[re.Pattern]) -> Optional[str]:
    """Return the first capturing group from the first pattern that matches,
    validated as a numeric string.  Returns None if no match or match is
    non-numeric (guards against accidentally capturing JS / HTML fragments)."""
    for pat in patterns:
        m = pat.search(html)
        if m:
            raw = m.group(1).replace(",", "")
            if _NUMERIC_RE.match(raw):
                return raw
    return None


def fetch_quote(ticker: str, exchange: str) -> dict:
    """Fetch a single Google Finance quote page and parse key fields."""
    url = BASE_URL.format(ticker=ticker, exchange=exchange)
    result: dict = {
        "ticker":     ticker,
        "exchange":   exchange,
        "url":        url,
        "price":      None,
        "change":     None,
        "change_pct": None,
        "error":      None,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        html = _get(url)
    except (OSError, ValueError) as exc:
        # Catches urllib errors, requests.RequestException (subclass of OSError
        # in requests 2.x), and URL/encoding issues.  Unexpected exceptions
        # (e.g. MemoryError) are not caught here and will propagate normally.
        import traceback
        result["error"] = str(exc)
        print(f"  fetch error detail:\n{traceback.format_exc()}", file=sys.stderr)
        return result

    result["price"]      = _first_match(html, _PRICE_PATTERNS)
    result["change"]     = _first_match(html, _CHANGE_PATTERNS)
    result["change_pct"] = _first_match(html, _CHANGE_PCT_PATTERNS)
    return result


def _fmt(value: Optional[str], prefix: str = "") -> str:
    """Format a parsed value for Markdown; return '—' if None."""
    if value is None:
        return "—"
    return f"{prefix}{value}"


def build_markdown_table(quotes: list[dict], now: datetime) -> str:
    """Render the quote list as a GitHub-flavoured Markdown table."""
    ts = now.strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"_Last updated: {ts}_",
        "",
        "### Live Google Finance Snapshot",
        "",
        "| Ticker | Exchange | Price | Change | Change % | Updated |",
        "|--------|----------|-------|--------|----------|---------|",
    ]
    for q in quotes:
        price      = _fmt(q["price"], "$")
        change     = _fmt(q["change"])
        change_pct = _fmt(q["change_pct"], "") + ("%" if q["change_pct"] else "")
        updated    = q["fetched_at"][:16].replace("T", " ") + " UTC" if q.get("fetched_at") else "—"
        err        = f" ⚠ {q['error']}" if q.get("error") else ""
        lines.append(
            f"| [{q['ticker']}]({q['url']}) | {q['exchange']} "
            f"| {price} | {change} | {change_pct} | {updated}{err} |"
        )
    return "\n".join(lines)


def update_readme(table_md: str) -> None:
    """Replace the AUTO-UPDATE block in the README with new content."""
    start_marker = "<!-- AUTO-UPDATE-START -->"
    end_marker   = "<!-- AUTO-UPDATE-END -->"

    text = README_PATH.read_text(encoding="utf-8")
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
    updated = text[: start_idx] + new_block + text[end_idx + len(end_marker) :]
    README_PATH.write_text(updated, encoding="utf-8")
    print(f"README updated: {README_PATH}")


def save_json(quotes: list[dict]) -> None:
    """Persist raw quote data as JSON for downstream consumers."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "quotes": quotes,
    }
    JSON_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"JSON saved: {JSON_PATH}")


def main() -> None:
    now    = datetime.now(timezone.utc)
    quotes: list[dict] = []

    for ticker, exchange in TICKERS:
        print(f"Fetching {ticker}:{exchange} …", end=" ", flush=True)
        q = fetch_quote(ticker, exchange)
        quotes.append(q)
        if q["error"]:
            print(f"ERROR — {q['error']}")
        else:
            print(f"price={q['price']}  chg={q['change']}  chg%={q['change_pct']}")

    table_md = build_markdown_table(quotes, now)
    update_readme(table_md)
    save_json(quotes)

    errors = [q for q in quotes if q["error"]]
    if errors:
        print(f"\n{len(errors)} ticker(s) failed to fetch (see table for details).")
        # Exit 0 so the workflow still commits partial results.
    sys.exit(0)


if __name__ == "__main__":
    main()
