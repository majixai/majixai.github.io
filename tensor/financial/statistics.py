"""
tensor.financial.statistics
===========================
Statistical analysis of price/return series.

- ``cross_asset_summary`` — autocorrelation lags, Hurst exponent, moments
- ``compute_var``         — historical-simulation Value-at-Risk + CVaR
- Helper: ``_hurst_exponent``, ``_skew``, ``_kurtosis``, ``_compute_rolling_corr``
"""
from __future__ import annotations

import math

import numpy as np

from .config import LOOKBACK


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _compute_rolling_corr(
    a: np.ndarray, b: np.ndarray, window: int = 20
) -> np.ndarray:
    """Rolling Pearson correlation between two return series."""
    n    = min(len(a), len(b))
    a    = a[-n:]
    b    = b[-n:]
    corr = np.full(n, np.nan)
    for i in range(window - 1, n):
        sa = a[i - window + 1: i + 1]
        sb = b[i - window + 1: i + 1]
        denom = (sa.std() * sb.std() + 1e-9)
        corr[i] = float(np.cov(sa, sb)[0, 1] / denom)
    return corr


def _hurst_exponent(series: np.ndarray) -> float:
    """
    Simplified Hurst exponent via R/S analysis.

    Interpretation::

        H < 0.5  → mean-reverting
        H ≈ 0.5  → random walk
        H > 0.5  → trending
    """
    n = len(series)
    if n < 20:
        return 0.5
    lags    = [4, 8, 16, 32]
    rs_vals = []
    lag_v   = []
    for lag in lags:
        if lag >= n:
            continue
        chunks = [series[i: i + lag] for i in range(0, n - lag, lag)]
        if not chunks:
            continue
        rs_arr = []
        for chunk in chunks:
            if len(chunk) < 2:
                continue
            mean_c = chunk.mean()
            deviations = np.cumsum(chunk - mean_c)
            r  = deviations.max() - deviations.min()
            s  = chunk.std() + 1e-9
            rs_arr.append(r / s)
        if rs_arr:
            rs_vals.append(math.log(np.mean(rs_arr) + 1e-9))
            lag_v.append(math.log(lag))
    if len(lag_v) < 2:
        return 0.5
    slope, _ = np.polyfit(lag_v, rs_vals, 1)
    return float(np.clip(slope, 0.0, 1.0))


def _skew(series: np.ndarray) -> float:
    mu = series.mean()
    sg = series.std() + 1e-9
    return float(np.mean(((series - mu) / sg) ** 3))


def _kurtosis(series: np.ndarray) -> float:
    mu = series.mean()
    sg = series.std() + 1e-9
    return float(np.mean(((series - mu) / sg) ** 4) - 3.0)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def cross_asset_summary(prices: np.ndarray) -> dict:
    """
    Compute self-autocorrelation (lags 1–5), Hurst exponent, and distribution
    moments for the log-return series of *prices*.

    In a multi-asset deployment the caller would pass additional series;
    here we expose the interface with single-asset lag structure.

    Parameters
    ----------
    prices:
        1-D price array.

    Returns
    -------
    dict with keys:
        ``autocorrelation_lags``, ``hurst_exponent``, ``mean_return``,
        ``annualised_vol``, ``skewness``, ``excess_kurtosis``.
    """
    log_rets = np.diff(np.log(np.clip(prices, 1e-9, None)))
    n        = len(log_rets)
    lags     = {}
    for lag in range(1, 6):
        if n > lag:
            a = log_rets[:-lag]
            b = log_rets[lag:]
            cov = np.cov(a, b)
            denom = (a.std() * b.std() + 1e-9)
            lags[f"lag_{lag}"] = round(float(cov[0, 1] / denom), 4)
        else:
            lags[f"lag_{lag}"] = 0.0

    hurst_exp = _hurst_exponent(log_rets)
    return {
        "autocorrelation_lags": lags,
        "hurst_exponent":       round(hurst_exp, 4),
        "mean_return":          round(float(log_rets.mean()), 6),
        "annualised_vol":       round(float(log_rets.std() * math.sqrt(252)), 4),
        "skewness":             round(float(_skew(log_rets)), 4),
        "excess_kurtosis":      round(float(_kurtosis(log_rets)), 4),
    }


def compute_var(prices: np.ndarray, confidence: float = 0.95) -> dict:
    """
    Historical-simulation Value-at-Risk (VaR) and Expected Shortfall (CVaR)
    for the last *LOOKBACK* log-returns.

    Parameters
    ----------
    prices:
        Full price series, length ≥ LOOKBACK + 1.
    confidence:
        Confidence level (default 0.95 → 95% VaR).

    Returns
    -------
    dict with keys:
        ``confidence_level``, ``var_1d_pct``, ``var_1d_price``,
        ``cvar_1d_pct``, ``cvar_1d_price``, ``var_5d_pct``, ``var_10d_pct``.
    """
    log_rets = np.diff(np.log(np.clip(prices[-LOOKBACK:], 1e-9, None)))
    sorted_r = np.sort(log_rets)
    n        = len(sorted_r)
    idx      = int(n * (1.0 - confidence))
    var_1d   = float(-sorted_r[max(0, idx)])
    es_slice = sorted_r[:max(1, idx)]
    es_1d    = float(-es_slice.mean()) if len(es_slice) else var_1d

    last = float(prices[-1])
    return {
        "confidence_level":  confidence,
        "var_1d_pct":        round(var_1d * 100, 4),
        "var_1d_price":      round(last * var_1d, 4),
        "cvar_1d_pct":       round(es_1d * 100, 4),
        "cvar_1d_price":     round(last * es_1d, 4),
        "var_5d_pct":        round(var_1d * math.sqrt(5) * 100, 4),
        "var_10d_pct":       round(var_1d * math.sqrt(10) * 100, 4),
    }
