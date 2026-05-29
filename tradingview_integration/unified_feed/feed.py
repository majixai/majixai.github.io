"""
feed.py — backward-compatible entry point for the unified feed.

All implementation has been moved into the modular sub-packages:

from yfinance_data.tickers import get_unique_tickers

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

This file re-exports the original public symbols so that any existing
``from feed import ...`` usage continues to work unchanged.
"""

DIRS = {
    "sp":  ROOT / "sp_closing_projection" / "latest_projection.json",
    "mp":  ROOT / "market_prediction" / "latest_prediction.json",
    "yf":  ROOT / "yfinance_data" / "yfinance.dat",
    "gf":  ROOT / "tradingview_integration" / "data" / "google_finance_quotes.json",
    "gh":  ROOT / "github_data" / "level1_csv",
    "idx": ROOT / "index" / "csv",
}

_TICKER_EXTRAS = ["BTC-USD", "ETH-USD", "SOL-USD"]

TICKERS = []
_seen_tickers = set()
for _ticker in [*get_unique_tickers(), *_TICKER_EXTRAS]:
    _normalized = _ticker.strip().lower()
    if _normalized and _normalized not in _seen_tickers:
        _seen_tickers.add(_normalized)
        TICKERS.append(_normalized)

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

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Ensure seeds directory exists (previously done at module level)
SEEDS_DIR.mkdir(parents=True, exist_ok=True)


async def process_ticker(ticker: str):
    """
    Backward-compatible coroutine alias for ``FeedEngine().process_ticker``.

    Creates a new ``FeedEngine`` instance on each call to avoid module-level
    side-effects.  Use ``FeedEngine`` directly for production code.
    """
    return await FeedEngine().process_ticker(ticker)

if __name__ == "__main__":
    asyncio.run(run_all())
