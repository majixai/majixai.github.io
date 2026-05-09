"""
unified_feed — Modern modular feed package for TradingView Pine Script seeds.

Public API
----------
run_all()        : run the full pipeline (async coroutine)
FeedEngine       : configurable async engine class
RootDirectives   : root-directory scanner
DatabaseManager  : atomic dbs/files.json registry

Sub-packages
------------
config           : shared configuration constants
adapters         : data-source adapters (RootDirectives, …)
db               : database management (DatabaseManager)
indicators       : technical analysis (compute_ta, ema, rsi, …)
signals          : signal processing (fuse_signals, detect_anomalies, …)
engine           : async engine (FeedEngine, run_all)
"""

from .adapters import RootDirectives
from .db import DatabaseManager
from .engine import FeedEngine, run_all
from .indicators import compute_ta
from .signals import (
    build_corr_matrix,
    compute_seed_quality,
    detect_anomalies,
    fuse_signals,
    update_corr_cache,
)

__all__ = [
    "run_all",
    "FeedEngine",
    "RootDirectives",
    "DatabaseManager",
    "compute_ta",
    "detect_anomalies",
    "fuse_signals",
    "compute_seed_quality",
    "update_corr_cache",
    "build_corr_matrix",
]
