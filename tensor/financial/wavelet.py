"""
tensor.financial.wavelet
========================
Haar discrete wavelet transform for multi-scale trend decomposition.

Supports up to HAAR_LEVELS levels of approximation / detail decomposition,
returning the low-frequency trend component and per-level detail coefficients.
"""
from __future__ import annotations

import math

import numpy as np

from .config import HAAR_LEVELS


def _haar_level(signal: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Perform one level of the Haar discrete wavelet transform.

    Parameters
    ----------
    signal:
        Input signal array.

    Returns
    -------
    lo : np.ndarray
        Approximation (low-frequency) coefficients.
    hi : np.ndarray
        Detail (high-frequency) coefficients.
    """
    n  = len(signal) // 2 * 2          # round down to even
    s  = signal[:n]
    lo = (s[0::2] + s[1::2]) / math.sqrt(2)   # approximation
    hi = (s[0::2] - s[1::2]) / math.sqrt(2)   # detail
    return lo, hi


def haar_decompose(prices: np.ndarray, levels: int = HAAR_LEVELS) -> dict:
    """
    Multi-scale Haar decomposition of the price series.

    Parameters
    ----------
    prices:
        1-D price array.
    levels:
        Number of decomposition levels (default: HAAR_LEVELS = 3).

    Returns
    -------
    dict with keys:
        ``approx``      — lowest-frequency approximation (trend component)
        ``details``     — list of detail coefficient arrays per level
        ``trend_slope`` — linear slope of the approximation component
        ``energy_lo``   — energy of the approximation component
        ``energy_hi``   — total energy of all detail components
    """
    sig     = prices.copy().astype(float)
    details: list[np.ndarray] = []
    approx  = sig

    for _lvl in range(levels):
        if len(approx) < 2:
            break
        approx, det = _haar_level(approx)
        details.append(det)

    # Trend slope from the approximation component
    xs = np.arange(len(approx), dtype=float)
    if len(xs) >= 2:
        slope = float(np.polyfit(xs, approx, 1)[0])
    else:
        slope = 0.0

    return {
        "approx":      approx,
        "details":     details,
        "trend_slope": slope,
        "energy_lo":   float(np.sum(approx ** 2)),
        "energy_hi":   float(sum(np.sum(d ** 2) for d in details)),
    }
