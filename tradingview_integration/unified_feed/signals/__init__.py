"""
signals sub-package: signal processing for the unified feed.
"""

from .anomaly import detect_anomalies
from .correlation import build_corr_matrix, update_corr_cache
from .fusion import fuse_signals
from .quality import compute_seed_quality

__all__ = [
    "detect_anomalies",
    "build_corr_matrix",
    "update_corr_cache",
    "fuse_signals",
    "compute_seed_quality",
]
