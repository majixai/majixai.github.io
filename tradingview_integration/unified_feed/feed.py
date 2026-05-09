"""
feed.py — backward-compatible entry point for the unified feed.

All implementation has been moved into the modular sub-packages:

  config       → configuration constants
  adapters     → data-source adapters (RootDirectives)
  db           → database management (DatabaseManager)
  indicators   → technical analysis
  signals      → anomaly detection, correlation, fusion, quality
  engine       → async FeedEngine / run_all

This file re-exports the original public symbols so that any existing
``from feed import ...`` usage continues to work unchanged.
"""

import asyncio
import logging

# ── Re-export configuration ───────────────────────────────────────────────────
from .config import (
    ANOMALY_ZSCORE,
    DATA_DIRS as DIRS,
    ROOT,
    SEED_HEADER,
    SEEDS_DIR,
    TA_ATR_PERIOD,
    TA_BB_PERIOD,
    TA_BB_STD,
    TA_EMA_FAST,
    TA_EMA_SLOW,
    TA_MACD_FAST,
    TA_MACD_SIGNAL,
    TA_MACD_SLOW,
    TA_RSI_PERIOD,
    TICKERS,
)

# ── Re-export technical indicators ────────────────────────────────────────────
from .indicators.ta import (
    atr as _atr,
    bollinger as _bollinger,
    compute_ta,
    ema as _ema,
    macd as _macd,
    rsi as _rsi,
    vwap as _vwap,
)

# ── Re-export signals ─────────────────────────────────────────────────────────
from .signals.anomaly import detect_anomalies
from .signals.correlation import build_corr_matrix, update_corr_cache
from .signals.fusion import fuse_signals
from .signals.quality import compute_seed_quality

# ── Re-export engine ──────────────────────────────────────────────────────────
from .engine.runner import (
    FeedEngine,
    _tensor_agg,
    _write_seed,
    run_all,
)

# Backward-compat alias
process_ticker = FeedEngine().process_ticker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Ensure seeds directory exists (previously done at module level)
SEEDS_DIR.mkdir(parents=True, exist_ok=True)

if __name__ == "__main__":
    asyncio.run(run_all())
