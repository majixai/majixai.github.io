"""
conics/integrations/tensor_bridge.py
======================================
Bridge between conics/ and tensor/financial/.

Provides:
    fit_from_feature_matrix(symbol, lookback)
        — fetches OHLCV data via the repo's yfinance wrappers, passes it
          through tensor/financial/features.py::build_feature_matrix() to
          produce a rich feature matrix, then fits a conic to three selected
          feature columns (normalised bar index, log-volume, close price).

    conic_kalman_smooth(fit_result, ys)
        — runs the fitted conic surface predictions through
          tensor/financial/kalman.py::kalman_filter() to produce a Kalman-
          smoothed price path.

Usage:
    from conics.integrations.tensor_bridge import fit_from_feature_matrix
    result = fit_from_feature_matrix("AAPL", lookback=60)
"""

from __future__ import annotations

import math
import os
import sys
from typing import List, Optional

# --- inject tensor/ and yfinance/ ----------------------------------------
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
for _rel in ("tensor", "yfinance"):
    _p = os.path.join(_REPO_ROOT, _rel)
    if os.path.isdir(_p) and _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from financial.features import build_feature_matrix  # type: ignore[import]
    _FEAT_AVAILABLE = True
except ImportError:
    _FEAT_AVAILABLE = False

try:
    from financial.kalman import kalman_filter  # type: ignore[import]
    _KALMAN_AVAILABLE = True
except ImportError:
    _KALMAN_AVAILABLE = False

# --- conics core ---------------------------------------------------------
sys.path.insert(0, os.path.join(_REPO_ROOT, "conics", "python"))
from conics import ConicDecomposition, FitResult, fit_ols  # type: ignore[import]


def fit_from_feature_matrix(
    symbol: str,
    lookback: int = 60,
    x_col: int = 0,   # feature column for x axis
    y_col: int = 1,   # feature column for y axis
    z_col: int = 2,   # feature column for z (surface height)
) -> Optional[FitResult]:
    """
    Build a tensor/financial feature matrix for *symbol* and fit a conic
    to three of its columns.

    When tensor/financial is not available, falls back to a minimal
    feature matrix built from (bar_index, log_volume, close).

    Parameters
    ----------
    symbol   : ticker symbol
    lookback : number of recent bars to use
    x_col, y_col, z_col : which feature columns to use as x/y/z

    Returns
    -------
    FitResult or None if data cannot be fetched.
    """
    if _FEAT_AVAILABLE:
        try:
            feat_mat = build_feature_matrix(symbol, lookback=lookback)
            if feat_mat is None or len(feat_mat) < 6:
                return None
            xs = [row[x_col] for row in feat_mat]
            ys = [row[y_col] for row in feat_mat]
            zs = [row[z_col] for row in feat_mat]
            return fit_ols(xs, ys, zs)
        except Exception:
            pass

    # Minimal fallback via yfinance
    try:
        sys.path.insert(0, os.path.join(_REPO_ROOT, "yfinance"))
        from ops import download  # type: ignore[import]
    except ImportError:
        try:
            import yfinance as _yf
            download = _yf.download
        except ImportError:
            return None

    df = download(symbol, period="6mo", interval="1d")
    if df is None or len(df) < 6:
        return None
    df = df.tail(lookback).reset_index(drop=True)

    bar_idx = list(range(len(df)))
    close   = list(df["Close"].astype(float))
    vol     = [math.log(float(v)) if float(v) > 0 else 0.0
               for v in df["Volume"]]
    return fit_ols(bar_idx, vol, close)


def conic_kalman_smooth(
    fit_result: FitResult,
    ys: List[float],
    dt: float = 1.0,
) -> Optional[List[float]]:
    """
    Run the conic surface predictions through a Kalman filter from
    tensor/financial/kalman.py::kalman_filter().

    Parameters
    ----------
    fit_result : FitResult from any conic fit
    ys         : the y-axis values used to build the predictions
                 (length = number of time steps to smooth)
    dt         : time step (default 1 bar)

    Returns
    -------
    Smoothed price path (list[float]) or the raw predictions if Kalman
    is not available.
    """
    cc = fit_result.coeffs
    n  = len(ys)
    xs_norm = [(i / max(n - 1, 1) - 0.5) * 2 for i in range(n)]  # −1 … +1
    preds   = [cc.eval(xs_norm[i], ys[i]) for i in range(n)]

    if not _KALMAN_AVAILABLE:
        return preds

    try:
        smoothed = kalman_filter(preds, dt=dt)
        return smoothed
    except Exception:
        return preds


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("tensor_bridge: testing Kalman smoothing on unit-circle predictions …")
    import math as _math
    from conics import ConicCoeffs, decompose
    cc   = ConicCoeffs(A=1, B=0, C=1, D=0, E=0, F=-1)
    d    = decompose(cc)
    fr   = FitResult(coeffs=cc, decomp=d)
    ys   = [0.5 * _math.sin(2 * _math.pi * i / 20) for i in range(20)]
    path = conic_kalman_smooth(fr, ys)
    print(f"  smoothed path length: {len(path)}, first value: {path[0]:.4f}")
