#!/usr/bin/env python3
"""
Financial Data Generator
Fetches real OHLCV data from Yahoo Finance for indices, Fortune 500 companies,
and top cryptocurrencies, then writes JSON-formatted .dat files.

Usage:
    python scripts/generate_financial_data.py [--period 2y] [--categories all]

Output directories:
    data/indices/     - major stock indices
    data/fortune500/  - Fortune 500 companies
    data/crypto/      - top cryptocurrencies
"""
import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install yfinance pandas")
    sys.exit(1)

# ── asset definitions ────────────────────────────────────────────────────────

INDICES = {
    "SPY":   "SPDR S&P 500 ETF Trust",
    "QQQ":   "Invesco QQQ Trust (NASDAQ-100)",
    "DIA":   "SPDR Dow Jones Industrial Average ETF",
    "IWM":   "iShares Russell 2000 ETF",
    "^GSPC": "S&P 500 Index",
    "^DJI":  "Dow Jones Industrial Average",
    "^IXIC": "NASDAQ Composite",
    "^RUT":  "Russell 2000 Index",
    "^VIX":  "CBOE Volatility Index",
    "^FTSE": "FTSE 100 (UK)",
    "^N225": "Nikkei 225 (Japan)",
    "^HSI":  "Hang Seng Index (Hong Kong)",
    "^GDAXI":"DAX (Germany)",
    "^FCHI": "CAC 40 (France)",
    "^STOXX50E": "Euro Stoxx 50",
    "^BVSP": "Bovespa (Brazil)",
    "^NSEI": "NIFTY 50 (India)",
    "^GSPTSE": "S&P/TSX Composite (Canada)",
    "^AXJO": "ASX 200 (Australia)",
    "^KS11": "KOSPI (South Korea)",
    "GLD":   "SPDR Gold Shares",
    "SLV":   "iShares Silver Trust",
    "TLT":   "iShares 20+ Year Treasury Bond ETF",
    "AGG":   "iShares Core U.S. Aggregate Bond ETF",
    "VNQ":   "Vanguard Real Estate ETF",
    "XLE":   "Energy Select Sector SPDR",
    "XLF":   "Financial Select Sector SPDR",
    "XLK":   "Technology Select Sector SPDR",
    "XLV":   "Health Care Select Sector SPDR",
    "SMH":   "VanEck Semiconductor ETF",
    "ARKK":  "ARK Innovation ETF",
    "EEM":   "iShares MSCI Emerging Markets ETF",
    "EFA":   "iShares MSCI EAFE ETF",
}

FORTUNE500 = {
    # Technology
    "AAPL":  "Apple Inc",
    "MSFT":  "Microsoft Corporation",
    "NVDA":  "NVIDIA Corporation",
    "AMZN":  "Amazon.com Inc",
    "GOOGL": "Alphabet Inc (Class A)",
    "META":  "Meta Platforms Inc",
    "TSLA":  "Tesla Inc",
    "AVGO":  "Broadcom Inc",
    "ORCL":  "Oracle Corporation",
    "CRM":   "Salesforce Inc",
    "AMD":   "Advanced Micro Devices",
    "INTC":  "Intel Corporation",
    "CSCO":  "Cisco Systems",
    "QCOM":  "Qualcomm",
    "TXN":   "Texas Instruments",
    "IBM":   "International Business Machines",
    "ADBE":  "Adobe Inc",
    "NOW":   "ServiceNow Inc",
    "INTU":  "Intuit Inc",
    "PLTR":  "Palantir Technologies",
    "SNOW":  "Snowflake Inc",
    "CRWD":  "CrowdStrike Holdings",
    "NET":   "Cloudflare Inc",
    "PANW":  "Palo Alto Networks",
    # Financials
    "JPM":   "JPMorgan Chase & Co",
    "BAC":   "Bank of America",
    "WFC":   "Wells Fargo & Company",
    "GS":    "Goldman Sachs Group",
    "MS":    "Morgan Stanley",
    "BLK":   "BlackRock Inc",
    "V":     "Visa Inc",
    "MA":    "Mastercard Inc",
    "AXP":   "American Express",
    "SCHW":  "Charles Schwab Corp",
    "C":     "Citigroup Inc",
    "SPGI":  "S&P Global Inc",
    "CME":   "CME Group Inc",
    "ICE":   "Intercontinental Exchange",
    # Healthcare
    "JNJ":   "Johnson & Johnson",
    "LLY":   "Eli Lilly and Company",
    "UNH":   "UnitedHealth Group",
    "ABBV":  "AbbVie Inc",
    "MRK":   "Merck & Co",
    "PFE":   "Pfizer Inc",
    "TMO":   "Thermo Fisher Scientific",
    "ABT":   "Abbott Laboratories",
    "AMGN":  "Amgen Inc",
    "GILD":  "Gilead Sciences",
    "VRTX":  "Vertex Pharmaceuticals",
    "REGN":  "Regeneron Pharmaceuticals",
    "ISRG":  "Intuitive Surgical",
    "BSX":   "Boston Scientific",
    "SYK":   "Stryker Corporation",
    "MDT":   "Medtronic",
    # Consumer
    "WMT":   "Walmart Inc",
    "PG":    "Procter & Gamble",
    "KO":    "Coca-Cola Company",
    "PEP":   "PepsiCo Inc",
    "MCD":   "McDonald's Corporation",
    "SBUX":  "Starbucks Corporation",
    "NKE":   "Nike Inc",
    "HD":    "Home Depot",
    "LOW":   "Lowe's Companies",
    "COST":  "Costco Wholesale",
    "TGT":   "Target Corporation",
    "AMZN":  "Amazon.com Inc",
    "DIS":   "Walt Disney Company",
    "NFLX":  "Netflix Inc",
    "CMCSA": "Comcast Corporation",
    # Energy
    "XOM":   "Exxon Mobil Corporation",
    "CVX":   "Chevron Corporation",
    "COP":   "ConocoPhillips",
    "SLB":   "SLB (Schlumberger)",
    "EOG":   "EOG Resources",
    "PXD":   "Pioneer Natural Resources",
    "PSX":   "Phillips 66",
    "VLO":   "Valero Energy",
    "MPC":   "Marathon Petroleum",
    "OXY":   "Occidental Petroleum",
    # Industrials
    "BA":    "Boeing Company",
    "CAT":   "Caterpillar Inc",
    "GE":    "GE Aerospace",
    "HON":   "Honeywell International",
    "UPS":   "United Parcel Service",
    "FDX":   "FedEx Corporation",
    "RTX":   "RTX Corporation (Raytheon)",
    "LMT":   "Lockheed Martin",
    "NOC":   "Northrop Grumman",
    "DE":    "Deere & Company",
    "MMM":   "3M Company",
    "EMR":   "Emerson Electric",
    # Telecom & Media
    "T":     "AT&T Inc",
    "VZ":    "Verizon Communications",
    "TMUS":  "T-Mobile US",
    "CHTR":  "Charter Communications",
    # Real Estate & Utilities
    "AMT":   "American Tower Corp",
    "PLD":   "Prologis Inc",
    "NEE":   "NextEra Energy",
    "DUK":   "Duke Energy",
    "SO":    "Southern Company",
    # Materials
    "LIN":   "Linde plc",
    "APD":   "Air Products & Chemicals",
    "SHW":   "Sherwin-Williams",
    "NEM":   "Newmont Corporation",
    "FCX":   "Freeport-McMoRan",
}

CRYPTO = {
    "BTC-USD":  "Bitcoin",
    "ETH-USD":  "Ethereum",
    "BNB-USD":  "BNB (Binance Coin)",
    "SOL-USD":  "Solana",
    "XRP-USD":  "XRP (Ripple)",
    "DOGE-USD": "Dogecoin",
    "ADA-USD":  "Cardano",
    "AVAX-USD": "Avalanche",
    "SHIB-USD": "Shiba Inu",
    "DOT-USD":  "Polkadot",
    "LINK-USD": "Chainlink",
    "MATIC-USD":"Polygon (MATIC)",
    "LTC-USD":  "Litecoin",
    "UNI-USD":  "Uniswap",
    "ATOM-USD": "Cosmos",
    "XLM-USD":  "Stellar",
    "BCH-USD":  "Bitcoin Cash",
    "NEAR-USD": "NEAR Protocol",
    "APT-USD":  "Aptos",
    "ARB-USD":  "Arbitrum",
    "OP-USD":   "Optimism",
    "INJ-USD":  "Injective",
    "SUI-USD":  "Sui",
    "TIA-USD":  "Celestia",
    "FIL-USD":  "Filecoin",
    "ALGO-USD": "Algorand",
    "VET-USD":  "VeChain",
    "ICP-USD":  "Internet Computer",
    "HBAR-USD": "Hedera",
    "TON-USD":  "Toncoin",
    "GBTC":     "Grayscale Bitcoin Trust",
    "ETHE":     "Grayscale Ethereum Trust",
    "BITO":     "ProShares Bitcoin Strategy ETF",
    "IBIT":     "iShares Bitcoin Trust ETF",
    "FBTC":     "Fidelity Wise Origin Bitcoin Fund",
}

# ── fetch helpers ─────────────────────────────────────────────────────────────

RETRY_DELAY = 5
MAX_RETRIES = 3


def safe_float(val):
    """Convert pandas scalar to Python float, return None if NaN."""
    try:
        f = float(val)
        return None if (f != f) else round(f, 6)  # nan check
    except (TypeError, ValueError):
        return None


def fetch_ticker_ohlcv(symbol: str, period: str = "2y", interval: str = "1d") -> list:
    """Download OHLCV rows for a symbol; returns list of dicts."""
    for attempt in range(MAX_RETRIES):
        try:
            df = yf.download(symbol, period=period, interval=interval,
                             auto_adjust=True, progress=False, threads=False)
            if df.empty:
                return []
            rows = []
            for ts, row in df.iterrows():
                # yfinance may return MultiIndex columns when downloading one ticker
                def _get(col):
                    if isinstance(df.columns, pd.MultiIndex):
                        return safe_float(row.get((col, symbol), row.get(col)))
                    return safe_float(row.get(col))

                date_str = ts.strftime("%Y-%m-%d") if interval == "1d" else ts.isoformat()
                rows.append({
                    "date":   date_str,
                    "open":   _get("Open"),
                    "high":   _get("High"),
                    "low":    _get("Low"),
                    "close":  _get("Close"),
                    "volume": safe_float(_get("Volume")),
                })
            return rows
        except Exception as exc:
            print(f"  Attempt {attempt + 1}/{MAX_RETRIES} failed for {symbol}: {exc}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
    return []


def fetch_ticker_info(symbol: str) -> dict:
    """Fetch key metadata for a ticker."""
    try:
        t = yf.Ticker(symbol)
        info = t.info or {}
        return {
            "market_cap":       info.get("marketCap"),
            "sector":           info.get("sector"),
            "industry":         info.get("industry"),
            "pe_ratio":         info.get("trailingPE"),
            "eps":              info.get("trailingEps"),
            "dividend_yield":   info.get("dividendYield"),
            "52w_high":         info.get("fiftyTwoWeekHigh"),
            "52w_low":          info.get("fiftyTwoWeekLow"),
            "avg_volume":       info.get("averageVolume"),
            "beta":             info.get("beta"),
            "currency":         info.get("currency", "USD"),
            "exchange":         info.get("exchange"),
        }
    except Exception:
        return {}


# ── writer ────────────────────────────────────────────────────────────────────

def write_dat(out_path: Path, ticker: str, name: str, category: str,
              ohlcv: list, meta: dict):
    """Write a JSON-formatted .dat file."""
    payload = {
        "ticker":        ticker,
        "name":          name,
        "category":      category,
        "currency":      meta.get("currency", "USD"),
        "last_updated":  datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "record_count":  len(ohlcv),
        "meta":          meta,
        "ohlcv":         ohlcv,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    return len(ohlcv)


# ── main ──────────────────────────────────────────────────────────────────────

def process_group(assets: dict, out_dir: Path, category: str,
                  period: str, fetch_meta: bool) -> dict:
    results = {"ok": 0, "empty": 0, "error": 0}

    def _process_one(symbol_name):
        symbol, name = symbol_name
        safe_name = symbol.replace("^", "").replace("-", "_").lower()
        out_path = out_dir / f"{safe_name}.dat"
        print(f"  [{category}] {symbol} → {out_path.name} ...", end=" ", flush=True)
        try:
            ohlcv = fetch_ticker_ohlcv(symbol, period=period)
            meta = fetch_ticker_info(symbol) if fetch_meta else {}
            if not ohlcv:
                print("EMPTY – skipped")
                return "empty"
            n = write_dat(out_path, symbol, name, category, ohlcv, meta)
            print(f"OK ({n} rows)")
            return "ok"
        except Exception as exc:
            print(f"ERROR: {exc}")
            return "error"

    max_workers = min(8, len(assets)) or 1
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_process_one, item): item for item in assets.items()}
        for future in as_completed(futures):
            outcome = future.result()
            results[outcome] += 1

    return results


def main():
    parser = argparse.ArgumentParser(description="Generate financial .dat files")
    parser.add_argument("--period", default="2y",
                        help="yfinance period string (default: 2y)")
    parser.add_argument("--categories", default="all",
                        help="Comma-separated: indices,fortune500,crypto  (default: all)")
    parser.add_argument("--no-meta", action="store_true",
                        help="Skip fetching ticker metadata (faster)")
    parser.add_argument("--out-dir", default="data",
                        help="Root output directory (default: data)")
    args = parser.parse_args()

    cats = {c.strip() for c in args.categories.split(",")} if args.categories != "all" \
        else {"indices", "fortune500", "crypto"}
    root = Path(args.out_dir)
    fetch_meta = not args.no_meta

    totals = {"ok": 0, "empty": 0, "error": 0}

    if "indices" in cats:
        print("\n=== Indices ===")
        r = process_group(INDICES, root / "indices", "index", args.period, fetch_meta)
        for k in totals:
            totals[k] += r[k]

    if "fortune500" in cats:
        print("\n=== Fortune 500 ===")
        r = process_group(FORTUNE500, root / "fortune500", "equity", args.period, fetch_meta)
        for k in totals:
            totals[k] += r[k]

    if "crypto" in cats:
        print("\n=== Crypto ===")
        r = process_group(CRYPTO, root / "crypto", "crypto", args.period, fetch_meta)
        for k in totals:
            totals[k] += r[k]

    print(f"\nDone. OK={totals['ok']}  Empty={totals['empty']}  Error={totals['error']}")


if __name__ == "__main__":
    main()
