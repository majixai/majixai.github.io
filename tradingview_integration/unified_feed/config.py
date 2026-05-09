"""
Configuration constants for the unified feed package.
"""

from __future__ import annotations

from pathlib import Path

# Repository root (3 levels up: unified_feed → tradingview_integration → repo root)
ROOT = Path(__file__).resolve().parents[3]

# Seed output directory
SEEDS_DIR = ROOT / "tradingview_integration" / "pine_seeds"

# Data source paths
DATA_DIRS = {
    "sp":  ROOT / "sp_closing_projection" / "latest_projection.json",
    "mp":  ROOT / "market_prediction" / "latest_prediction.json",
    "yf":  ROOT / "yfinance_data" / "yfinance.dat",
    "gf":  ROOT / "tradingview_integration" / "data" / "google_finance_quotes.json",
    "gh":  ROOT / "github_data" / "level1_csv",
    "idx": ROOT / "index" / "csv",
}

# Default ticker universe
TICKERS = [
    "spy", "qqq", "dia", "iwm", "aapl", "msft", "nvda", "tsla", "btc-usd",
    "meta", "amzn", "gld", "slv", "tlt", "xom",
]

# Pine Script seed file header
SEED_HEADER = (
    "#syminfo.type=index\n"
    "#syminfo.currency=usd\n"
    "#period=D\n"
    "time,open,high,low,close,volume\n"
)

# ── Technical indicator window lengths ────────────────────────────────────────
TA_RSI_PERIOD   = 14
TA_MACD_FAST    = 12
TA_MACD_SLOW    = 26
TA_MACD_SIGNAL  = 9
TA_BB_PERIOD    = 20
TA_BB_STD       = 2.0
TA_ATR_PERIOD   = 14
TA_EMA_FAST     = 8
TA_EMA_SLOW     = 21
TA_CORR_WINDOW  = 20    # rolling correlation window across assets
ANOMALY_ZSCORE  = 2.5   # Z-score threshold for anomaly flagging

# Thread pool size for async I/O executors
THREAD_POOL_WORKERS = 8

# Root directories scanned by root_directives
ROOT_SCAN_DIRS = ["dbs", "actions", "finance", "mathematics"]

# Root Python files that are treated as directives whitelist
ROOT_PYTHON_WHITELIST = [
    "config.py", "app.py", "engine.py", "run.py", "fetch_data.py",
    "database.py", "data_to_db.py",
]
