"""
tensor.financial.features
=========================
Feature-matrix construction: F ∈ R^(n × m).

Each column encodes a different market characteristic derived from the raw
close-price series over a rolling LOOKBACK window.
"""
from __future__ import annotations

import numpy as np

from .config import LOOKBACK, FEATURES


def build_feature_matrix(prices: np.ndarray) -> np.ndarray:
    """
    Build extended 8-feature matrix from the last LOOKBACK bars of *prices*.

    Column layout  (m = FEATURES = 8)::

        0  Price z-score          (close − μ) / σ
        1  Log returns            Δlog(close)
        2  Rolling 5-bar realised vol  normalised [0,1]
        3  Momentum               (close − rolling_mean) / |max_momentum|
        4  Rate of change %       (close[i] − close[i-5]) / close[i-5]
        5  Upper shadow ratio     (high − max(open,close)) / ATR  (proxied)
        6  Lower shadow ratio     (min(open,close) − low) / ATR   (proxied)
        7  Mean-reversion score   -(z-score) normalised to [-1, 1]

    Parameters
    ----------
    prices:
        1-D price array with at least *LOOKBACK* elements.

    Returns
    -------
    F : np.ndarray, shape (LOOKBACK, FEATURES)
    """
    n      = LOOKBACK
    window = prices[-n:].copy()
    F      = np.zeros((n, FEATURES))

    # col 0 — z-score
    mu  = window.mean()
    sig = window.std() + 1e-9
    z   = (window - mu) / sig
    F[:, 0] = z

    # col 1 — log returns  (prepend 0 for bar-0 boundary)
    rets = np.diff(np.log(np.clip(window, 1e-9, None)), prepend=0.0)
    F[:, 1] = rets

    # col 2 — rolling 5-bar realised volatility, normalised
    vol = np.array([rets[max(0, i - 4): i + 1].std() for i in range(n)])
    vmax = vol.max() + 1e-9
    F[:, 2] = vol / vmax

    # col 3 — momentum
    roll_mean = np.array([window[:i + 1].mean() for i in range(n)])
    mom  = window - roll_mean
    mmax = np.abs(mom).max() + 1e-9
    F[:, 3] = mom / mmax

    # col 4 — 5-bar rate of change
    roc = np.array([
        (window[i] - window[max(0, i - 5)]) / (window[max(0, i - 5)] + 1e-9)
        for i in range(n)
    ])
    rmax = np.abs(roc).max() + 1e-9
    F[:, 4] = roc / rmax

    # col 5 — upper shadow proxy  (high − close) / ATR estimate
    atr_est = np.array([
        rets[max(0, i - 13): i + 1].std() * window[i] for i in range(n)
    ]) + 1e-9
    upper_sh = np.abs(np.diff(window, prepend=window[0])) * 0.5
    F[:, 5] = upper_sh / atr_est

    # col 6 — lower shadow proxy  (close − low) / ATR estimate
    lower_sh = np.abs(window - roll_mean) * 0.5
    F[:, 6] = lower_sh / atr_est

    # col 7 — mean-reversion score  −z / max|z|
    zmax = np.abs(z).max() + 1e-9
    F[:, 7] = -z / zmax

    return F
