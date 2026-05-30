"""
Technical analysis indicator library.

All functions operate on NumPy arrays and are intentionally free of any
I/O or pandas dependencies so they can be unit-tested in isolation.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from ..config import (
    TA_ATR_PERIOD,
    TA_BB_PERIOD,
    TA_BB_STD,
    TA_EMA_FAST,
    TA_EMA_SLOW,
    TA_MACD_FAST,
    TA_MACD_SIGNAL,
    TA_MACD_SLOW,
    TA_RSI_PERIOD,
)


# ── Low-level indicator primitives ────────────────────────────────────────────

def ema(series: np.ndarray, period: int) -> np.ndarray:
    """Exponential moving average."""
    alpha  = 2.0 / (period + 1)
    result = np.full_like(series, np.nan, dtype=float)
    if len(series) == 0:
        return result
    result[0] = series[0]
    for i in range(1, len(series)):
        result[i] = alpha * series[i] + (1.0 - alpha) * result[i - 1]
    return result


def rsi(closes: np.ndarray, period: int = TA_RSI_PERIOD) -> np.ndarray:
    """Wilder RSI."""
    n      = len(closes)
    result = np.full(n, np.nan)
    if n < period + 1:
        return result
    deltas = np.diff(closes)
    gains  = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_g  = gains[:period].mean()
    avg_l  = losses[:period].mean()
    for i in range(period, n):
        avg_g = (avg_g * (period - 1) + gains[i - 1]) / period
        avg_l = (avg_l * (period - 1) + losses[i - 1]) / period
        rs    = avg_g / (avg_l + 1e-9)
        result[i] = 100.0 - 100.0 / (1.0 + rs)
    return result


def macd(
    closes: np.ndarray,
    fast: int   = TA_MACD_FAST,
    slow: int   = TA_MACD_SLOW,
    signal: int = TA_MACD_SIGNAL,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """MACD line, signal line, histogram."""
    ema_f  = ema(closes, fast)
    ema_s  = ema(closes, slow)
    macd_l = ema_f - ema_s
    sig_l  = ema(macd_l, signal)
    hist   = macd_l - sig_l
    return macd_l, sig_l, hist


def bollinger(
    closes: np.ndarray,
    period: int     = TA_BB_PERIOD,
    std_mult: float = TA_BB_STD,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Bollinger Bands: upper, mid, lower."""
    n     = len(closes)
    upper = np.full(n, np.nan)
    mid   = np.full(n, np.nan)
    lower = np.full(n, np.nan)
    for i in range(period - 1, n):
        w        = closes[i - period + 1: i + 1]
        m        = w.mean()
        s        = w.std() + 1e-9
        mid[i]   = m
        upper[i] = m + std_mult * s
        lower[i] = m - std_mult * s
    return upper, mid, lower


def atr(
    highs:  np.ndarray,
    lows:   np.ndarray,
    closes: np.ndarray,
    period: int = TA_ATR_PERIOD,
) -> np.ndarray:
    """Average True Range."""
    n      = len(closes)
    tr_arr = np.full(n, np.nan)
    atr_arr = np.full(n, np.nan)
    for i in range(1, n):
        tr_arr[i] = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i]  - closes[i - 1]),
        )
    if n > period:
        atr_arr[period] = float(np.nanmean(tr_arr[1: period + 1]))
        for i in range(period + 1, n):
            atr_arr[i] = (atr_arr[i - 1] * (period - 1) + tr_arr[i]) / period
    return atr_arr


def vwap(
    highs:   np.ndarray,
    lows:    np.ndarray,
    closes:  np.ndarray,
    volumes: np.ndarray,
) -> np.ndarray:
    """Cumulative VWAP from first bar."""
    typical = (highs + lows + closes) / 3.0
    cum_tpv = np.cumsum(typical * volumes)
    cum_vol = np.cumsum(volumes) + 1e-9
    return cum_tpv / cum_vol


# ── High-level compute_ta ─────────────────────────────────────────────────────

def _last(arr: np.ndarray) -> float | None:
    valid = arr[~np.isnan(arr)]
    return round(float(valid[-1]), 4) if len(valid) else None


def compute_ta(ohlcv_df: pd.DataFrame) -> dict[str, Any]:
    """
    Compute a full technical analysis suite on an OHLCV DataFrame.

    Returns a dict of last-value scalars plus derived labels.
    """
    if ohlcv_df.empty:
        return {}

    closes  = ohlcv_df["close"].values.astype(float)
    highs   = ohlcv_df["high"].values.astype(float)   if "high"   in ohlcv_df.columns else closes
    lows    = ohlcv_df["low"].values.astype(float)    if "low"    in ohlcv_df.columns else closes
    volumes = ohlcv_df["volume"].values.astype(float) if "volume" in ohlcv_df.columns else np.ones_like(closes)

    rsi_arr               = rsi(closes)
    macd_l, sig_l, hist_l = macd(closes)
    bb_u, bb_m, bb_l      = bollinger(closes)
    atr_arr               = atr(highs, lows, closes)
    ema_fast              = ema(closes, TA_EMA_FAST)
    ema_slow              = ema(closes, TA_EMA_SLOW)
    vwap_arr              = vwap(highs, lows, closes, volumes)

    last_close = float(closes[-1]) if len(closes) else 0.0
    bb_mid     = _last(bb_m) or last_close
    bb_std     = float(np.nanstd(closes[-TA_BB_PERIOD:])) + 1e-9
    bb_zscore  = round((last_close - bb_mid) / bb_std, 3)

    ef = _last(ema_fast)
    es = _last(ema_slow)
    ema_trend = (
        "BULL" if (ef and es and ef > es) else
        "BEAR" if (ef and es and ef < es) else
        "FLAT"
    )

    last_macd = _last(macd_l) or 0.0
    last_sig  = _last(sig_l)  or 0.0
    last_hist = _last(hist_l) or 0.0
    macd_cross = (
        "BULLISH" if last_macd > last_sig else
        "BEARISH" if last_macd < last_sig else
        "FLAT"
    )

    return {
        "rsi":        _last(rsi_arr),
        "macd":       round(last_macd, 4),
        "macd_sig":   round(last_sig, 4),
        "macd_hist":  round(last_hist, 4),
        "macd_cross": macd_cross,
        "bb_upper":   _last(bb_u),
        "bb_mid":     round(bb_mid, 4),
        "bb_lower":   _last(bb_l),
        "bb_zscore":  bb_zscore,
        "atr":        _last(atr_arr),
        "ema_fast":   ef,
        "ema_slow":   es,
        "ema_trend":  ema_trend,
        "vwap":       _last(vwap_arr),
    }
