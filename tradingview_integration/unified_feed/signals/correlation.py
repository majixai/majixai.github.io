"""
Cross-asset correlation matrix using rolling Pearson correlations.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..config import TA_CORR_WINDOW

# Module-level cache: ticker → last CORR_WINDOW log-returns
_CORR_CACHE: dict[str, np.ndarray] = {}


def update_corr_cache(ticker: str, ohlcv_df: pd.DataFrame) -> None:
    """Store the last CORR_WINDOW log-returns for *ticker*."""
    if ohlcv_df.empty or "close" not in ohlcv_df.columns:
        return
    closes = ohlcv_df["close"].values.astype(float)
    rets   = np.diff(np.log(np.clip(closes, 1e-9, None)))
    _CORR_CACHE[ticker.lower()] = rets[-TA_CORR_WINDOW:]


def build_corr_matrix() -> dict:
    """
    Build a pairwise Pearson correlation matrix from the cached return series.

    Only pairs with at least 3 overlapping observations are computed;
    others default to 0.0.

    Returns
    -------
    dict with ``tickers`` (sorted list) and ``matrix`` (list-of-lists).
    """
    tickers = sorted(_CORR_CACHE.keys())
    n       = len(tickers)
    if n < 2:
        return {"tickers": tickers, "matrix": []}

    mat = []
    for i in range(n):
        row = []
        for j in range(n):
            a  = _CORR_CACHE[tickers[i]]
            b  = _CORR_CACHE[tickers[j]]
            mn = min(len(a), len(b))
            if mn < 3:
                row.append(0.0)
                continue
            a_w  = a[-mn:]
            b_w  = b[-mn:]
            sg_a = a_w.std() + 1e-9
            sg_b = b_w.std() + 1e-9
            c    = float(np.cov(a_w, b_w)[0, 1] / (sg_a * sg_b))
            row.append(round(c, 3))
        mat.append(row)

    return {"tickers": tickers, "matrix": mat}


def clear_corr_cache() -> None:
    """Reset the in-memory correlation cache (useful in tests)."""
    _CORR_CACHE.clear()
