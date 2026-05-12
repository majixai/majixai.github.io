"""
conics/integrations/yfinance_bridge.py
========================================
Bridge between conics/ and yfinance/ops.py.

Provides:
    fit_ohlcv(symbol, lookback, second_axis)
        — download OHLCV data for *symbol*, build the three arrays
          (normalised bar index, second axis, close price), and return a
          FitResult from the standard conic OLS fit.

    fit_multi(symbols, lookback)
        — batch version that returns a dict[symbol -> FitResult | None].

    scan_conic_type(symbols, lookback)
        — returns a dict[symbol -> ConicKind str] for a universe of tickers.

Usage:
    from conics.integrations.yfinance_bridge import fit_ohlcv, scan_conic_type
    result = fit_ohlcv("AAPL", lookback=60)
    universe = scan_conic_type(["AAPL", "MSFT", "TSLA"])
"""

from __future__ import annotations

import math
import os
import sys
from typing import Dict, List, Optional

# --- inject yfinance/ ----------------------------------------------------
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_YF_DIR = os.path.join(_REPO_ROOT, "yfinance")
if _YF_DIR not in sys.path:
    sys.path.insert(0, _YF_DIR)

try:
    from ops import download  # type: ignore[import]
    _YF_OPS = True
except ImportError:
    try:
        import yfinance as _yf_raw
        download = _yf_raw.download
        _YF_OPS = True
    except ImportError:
        _YF_OPS = False

# --- conics core ---------------------------------------------------------
sys.path.insert(0, os.path.join(_REPO_ROOT, "conics", "python"))
from conics import FitResult, fit_ols  # type: ignore[import]


def _normalise(vals: List[float]) -> List[float]:
    mu  = sum(vals) / len(vals)
    var = sum((v - mu)**2 for v in vals) / max(len(vals) - 1, 1)
    sig = math.sqrt(var) if var > 0 else 1.0
    return [(v - mu) / sig for v in vals]


def fit_ohlcv(
    symbol: str,
    lookback: int = 60,
    second_axis: str = "log_volume",   # "log_volume" | "rsi14" | "high_low_range"
) -> Optional[FitResult]:
    """
    Fit a quadratic surface to (bar_index, second_axis, close).

    Parameters
    ----------
    symbol      : ticker symbol, e.g. "AAPL"
    lookback    : number of recent bars
    second_axis : one of "log_volume", "rsi14", "high_low_range"

    Returns
    -------
    FitResult or None if data cannot be fetched / fit fails.
    """
    if not _YF_OPS:
        return None

    try:
        df = download(symbol, period="6mo", interval="1d")
        if df is None or len(df) < max(lookback, 6):
            return None
        df = df.tail(lookback).reset_index(drop=True)
    except Exception:
        return None

    close   = [float(v) for v in df["Close"]]

    if second_axis == "log_volume":
        try:
            y_raw = [math.log(float(v)) if float(v) > 0 else 0.0
                     for v in df["Volume"]]
        except KeyError:
            y_raw = [0.0] * len(close)
    elif second_axis == "rsi14":
        # Simple RSI-14 (Wilder smoothing)
        y_raw = _simple_rsi(close, period=14)
    elif second_axis == "high_low_range":
        try:
            y_raw = [float(h) - float(l)
                     for h, l in zip(df["High"], df["Low"])]
        except KeyError:
            y_raw = [0.0] * len(close)
    else:
        y_raw = [0.0] * len(close)

    bar_idx = list(range(len(close)))
    xs  = _normalise(bar_idx)
    ys  = _normalise(y_raw)
    zs  = _normalise(close)
    return fit_ols(xs, ys, zs)


def _simple_rsi(close: List[float], period: int = 14) -> List[float]:
    """Wilder-smoothed RSI."""
    n = len(close)
    rsi = [50.0] * n
    if n <= period:
        return rsi
    gains = [max(close[i] - close[i-1], 0.0) for i in range(1, n)]
    losses = [max(close[i-1] - close[i], 0.0) for i in range(1, n)]
    avg_g = sum(gains[:period]) / period
    avg_l = sum(losses[:period]) / period
    for i in range(period, n):
        rsi[i] = 100.0 - 100.0 / (1 + avg_g / max(avg_l, 1e-10))
        avg_g = (avg_g * (period - 1) + gains[i-1]) / period
        avg_l = (avg_l * (period - 1) + losses[i-1]) / period
    return rsi


def fit_multi(
    symbols: List[str],
    lookback: int = 60,
    second_axis: str = "log_volume",
) -> Dict[str, Optional[FitResult]]:
    """Batch conic fit for a list of symbols."""
    return {sym: fit_ohlcv(sym, lookback, second_axis) for sym in symbols}


def scan_conic_type(
    symbols: List[str],
    lookback: int = 60,
) -> Dict[str, str]:
    """
    Return a dict mapping each symbol to its detected conic type
    ('ELLIPSE', 'PARABOLA', 'HYPERBOLA', or 'FAILED').
    """
    results = fit_multi(symbols, lookback)
    return {
        sym: (res.decomp.kind if res else "FAILED")
        for sym, res in results.items()
    }


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if _YF_OPS:
        res = fit_ohlcv("SPY", lookback=60)
        if res:
            print(f"yfinance_bridge SPY: {res.decomp.kind}, R²={res.r2:.4f}")
        else:
            print("yfinance_bridge: could not fetch SPY data")
    else:
        print("yfinance_bridge: yfinance/ops.py not available")
