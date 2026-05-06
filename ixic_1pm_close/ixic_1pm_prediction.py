#!/usr/bin/env python3
"""
IXIC 1 PM Close Prediction Engine
===================================
A comprehensive multi-method prediction system for the NASDAQ Composite Index
(^IXIC) 1 PM close price.  Extends the DJI 1 PM engine with full integration
of the repository-level shared infrastructure:

  yfinance/ops.py     – Router, ActionRegistry, DataStore (SQLite KV)
  yfinance/zones.py   – S/R zone classification (expansion, consolidation,
                         stochastic drift, vector curl, Frenet curvature,
                         Higuchi FD, differential-form zones)
  yfinance_chart/     – Active pattern overlays (OU reversion, GBM vol cluster,
                         Frenet inflection, geodesic SR, Higuchi regime,
                         exterior-derivative spike, harmonic XABCD, Elliott wave,
                         advanced candles, etc.)
  dbs/                – Persistent result cache (files.json + SQLite via DataStore)

Core mathematics (mirrored from dji_1pm_close):
  – Geometric Brownian Motion (GBM) with Itô's Lemma
  – Ornstein-Uhlenbeck mean-reversion
  – Fourier / spectral cycle analysis
  – Taylor-series price approximation
  – Numerical integration (Simpson, Gaussian quadrature, Romberg)
  – Black-Scholes PDE + Greeks
  – Monte Carlo (antithetic variates, control variates, stratified sampling)

Output:
  – Human-readable console report
  – ixic_1pm_prediction.png  (matplotlib dashboard)
  – prediction_results.json  (full integrated result)

Author: MajixAI
License: MIT
"""

# ============================================================================
# STDLIB / SCIENTIFIC STACK IMPORTS
# ============================================================================

import os
import sys
import json
import math
import cmath
import time
import functools
import itertools
import collections
import dataclasses
from typing import Dict, List, Optional, Tuple, Union, Callable, Any
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from numpy import (
    exp, log, sqrt, sin, cos, pi, linspace, zeros, ones,
    cumsum, diff, random, meshgrid, gradient
)
from numpy import trapezoid as trapz
from numpy.linalg import norm, solve, inv, det, eig, cholesky
from numpy.fft import fft, ifft, fftfreq, fftshift
from numpy.polynomial import polynomial, chebyshev, legendre, hermite

import scipy
from scipy import stats, signal, integrate, interpolate, optimize, special
from scipy.stats import (
    norm as normal_dist, lognorm, t as t_dist, chi2, gamma, expon,
    kstest, jarque_bera, skew, kurtosis
)
from scipy.integrate import (
    quad, dblquad, tplquad, fixed_quad,
    romb, simpson, odeint, solve_ivp
)
from scipy.optimize import (
    minimize, minimize_scalar, brentq, newton, fsolve,
    curve_fit, least_squares, differential_evolution
)
from scipy.interpolate import (
    interp1d, UnivariateSpline, CubicSpline, BSpline,
    RectBivariateSpline, RegularGridInterpolator
)
from scipy.signal import (
    butter, filtfilt, welch, spectrogram, find_peaks,
    savgol_filter, detrend, hilbert
)
from scipy.special import (
    erf, erfc, gamma as gamma_func, factorial, comb,
    legendre as legendre_poly, hermite as hermite_poly,
    jv, yv, iv, kv
)
from scipy.linalg import (
    lu, qr, svd, schur, hessenberg, expm, logm, sqrtm
)

import sympy
from sympy import (
    Symbol, symbols, Function, Derivative, Integral,
    diff as sym_diff, integrate as sym_integrate,
    exp as sym_exp, log as sym_log, sqrt as sym_sqrt,
    sin as sym_sin, cos as sym_cos, tan as sym_tan,
    limit, series, summation, product, factorial as sym_factorial,
    oo, pi as sym_pi, E, I, Rational, simplify, expand, factor,
    solve as sym_solve, dsolve, solveset, linsolve, nonlinsolve,
    Matrix as SymMatrix, eye as sym_eye, zeros as sym_zeros,
    Eq, Ne, Lt, Le, Gt, Ge, And, Or, Not,
    lambdify, pprint, init_printing
)
from sympy.calculus.util import continuous_domain, minimum, maximum
from sympy.vector import CoordSys3D, divergence, curl, gradient as sym_gradient

from statistics import (
    mean, median, mode, stdev, variance,
    pstdev, pvariance, harmonic_mean, geometric_mean
)

import pandas as pd
from pandas import DataFrame, Series, Timestamp, DatetimeIndex

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import cm, colors
from matplotlib.gridspec import GridSpec
from mpl_toolkits.mplot3d import Axes3D

from numpy.random import (
    seed, rand, randn, randint, choice, shuffle,
    normal, uniform, exponential, poisson, binomial
)


# ============================================================================
# REPO-ROOT INTEGRATION LAYER
# ============================================================================
# Locate the repository root so that sibling packages (yfinance/, dbs/, etc.)
# are importable regardless of how this script is invoked.

_HERE = Path(__file__).resolve().parent          # ixic_1pm_close/
_REPO_ROOT = _HERE.parent                         # repo root
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# ── yfinance/ops – Router, ActionRegistry, DataStore ────────────────────────
try:
    from yfinance.ops import (
        Router as YFRouter,
        ActionRegistry as YFActionRegistry,
        DataStore as YFDataStore,
        NeuralBridge,
        download as yf_download,
        ticker as yf_ticker,
        ticker_history as yf_ticker_history,
    )
    _YF_OPS_AVAILABLE = True
except Exception:
    _YF_OPS_AVAILABLE = False

# ── yfinance/zones – S/R zone detection ─────────────────────────────────────
try:
    from yfinance.zones import (
        classify as zones_classify,
        classify_many as zones_classify_many,
        ZoneResult,
    )
    _ZONES_AVAILABLE = True
except Exception:
    _ZONES_AVAILABLE = False

# ── yfinance_chart – pattern detectors ──────────────────────────────────────
try:
    from yfinance_chart.lightweight_pattern_chart import (
        PatternOverlay,
        detect_ornstein_uhlenbeck_reversion,
        detect_brownian_volatility_cluster,
        detect_geodesic_sr,
        detect_higuchi_regime,
        detect_exterior_derivative_spike,
        detect_harmonic_patterns,
        detect_elliott_waves,
        build_extended_calculus_features,
    )
    _PATTERNS_AVAILABLE = True
except Exception:
    _PATTERNS_AVAILABLE = False

# ── tensor.financial – HOSVD, Kalman, Haar, regimes, MC, VaR ────────────────
try:
    from tensor.financial import (
        build_feature_matrix,
        tensor_decompose,
        kalman_filter as tensor_kalman_filter,
        haar_decompose,
        classify_regimes_5,
        tensor_contract,
        feature_importance,
        smooth_drift as tensor_smooth_drift,
        monte_carlo_forecast as tensor_mc_forecast,
        rolling_tensor_signal,
        cross_asset_summary,
        compute_var,
    )
    _TENSOR_AVAILABLE = True
except Exception:
    _TENSOR_AVAILABLE = False

# ── gpu/ – GPUManager, GPUDispatcher, kernels ────────────────────────────────
try:
    from gpu import GPUManager, GPUDispatcher
    import gpu.kernels  # triggers kernel auto-registration
    _GPU_AVAILABLE = True
except Exception:
    _GPU_AVAILABLE = False

# ── dbs DataStore path ───────────────────────────────────────────────────────
_DBS_DIR = _REPO_ROOT / "dbs"
_DBS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass
class MarketConfig:
    """Configuration parameters for the IXIC 1 PM prediction model."""
    ticker: str = "^IXIC"
    current_price: float = 19000.00   # NASDAQ Composite baseline
    target_time: str = "13:00"
    volatility: float = 0.18          # Slightly higher vol than DJIA
    drift: float = 0.06
    risk_free_rate: float = 0.045
    trading_days: int = 252
    minutes_per_day: int = 390
    simulations: int = 10000
    random_seed: Optional[int] = 42
    history_period: str = "60d"       # yfinance history for parameter estimation
    history_interval: str = "1d"


# ============================================================================
# OHLCV CALCULATOR
# ============================================================================

@dataclass
class OHLCVSnapshot:
    """Intraday OHLCV statistics derived from the history window."""
    open: float = float("nan")
    high: float = float("nan")
    low: float = float("nan")
    close: float = float("nan")
    volume: float = float("nan")
    vwap: float = float("nan")
    atr_14: float = float("nan")
    daily_range_pct: float = float("nan")
    prev_close: float = float("nan")
    gap_pct: float = float("nan")
    realized_vol_20d: float = float("nan")
    hist_drift_20d: float = float("nan")

    def to_dict(self) -> Dict:
        return dataclasses.asdict(self)


def _compute_ohlcv(df: pd.DataFrame) -> OHLCVSnapshot:
    """
    Derive OHLCV statistics from a yfinance-style history DataFrame.

    Expects columns: Open, High, Low, Close, Volume (title-case).
    """
    if df is None or df.empty or len(df) < 2:
        return OHLCVSnapshot()

    # Normalise column names
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]

    closes = df["close"].dropna().to_numpy(dtype=float)
    if len(closes) < 2:
        return OHLCVSnapshot()

    last = df.iloc[-1]
    prev = df.iloc[-2]

    # ATR-14
    highs = df["high"].to_numpy(dtype=float)
    lows = df["low"].to_numpy(dtype=float)
    prev_closes = np.roll(closes, 1)
    prev_closes[0] = closes[0]
    tr = np.maximum(
        highs - lows,
        np.maximum(np.abs(highs - prev_closes), np.abs(lows - prev_closes))
    )
    atr_14 = float(np.mean(tr[-14:])) if len(tr) >= 14 else float(np.mean(tr))

    # VWAP (volume-weighted average close over window)
    volumes = df["volume"].to_numpy(dtype=float)
    vwap = float(np.average(closes, weights=np.maximum(volumes, 1e-9)))

    # Realized volatility (annualised) over last 20 days
    log_rets = np.diff(np.log(np.maximum(closes, 1e-10)))
    rv_window = min(20, len(log_rets))
    realized_vol = float(np.std(log_rets[-rv_window:], ddof=1)) * np.sqrt(252)

    # Drift (annualised) over last 20 days
    hist_drift = float(np.mean(log_rets[-rv_window:])) * 252

    return OHLCVSnapshot(
        open=float(last.get("open", float("nan"))),
        high=float(last.get("high", float("nan"))),
        low=float(last.get("low", float("nan"))),
        close=float(last.get("close", float("nan"))),
        volume=float(last.get("volume", float("nan"))),
        vwap=vwap,
        atr_14=atr_14,
        daily_range_pct=float((last["high"] - last["low"]) / max(last["close"], 1e-9)),
        prev_close=float(prev["close"]),
        gap_pct=float((last["open"] - prev["close"]) / max(prev["close"], 1e-9)),
        realized_vol_20d=realized_vol,
        hist_drift_20d=hist_drift,
    )


# ============================================================================
# TECHNICAL INDICATORS
# ============================================================================

@dataclass
class IndicatorSet:
    """Standard technical indicators computed from price history."""
    rsi_14: float = float("nan")
    macd_line: float = float("nan")
    macd_signal: float = float("nan")
    macd_histogram: float = float("nan")
    bb_upper: float = float("nan")
    bb_middle: float = float("nan")
    bb_lower: float = float("nan")
    bb_width: float = float("nan")
    bb_pct_b: float = float("nan")
    ema_9: float = float("nan")
    ema_21: float = float("nan")
    ema_50: float = float("nan")
    sma_200: float = float("nan")
    stoch_k: float = float("nan")
    stoch_d: float = float("nan")
    williams_r: float = float("nan")
    adx: float = float("nan")
    cci_20: float = float("nan")
    momentum_10: float = float("nan")
    rate_of_change_14: float = float("nan")

    def to_dict(self) -> Dict:
        return dataclasses.asdict(self)


def _ema(arr: np.ndarray, period: int) -> np.ndarray:
    """Exponential moving average."""
    alpha = 2.0 / (period + 1)
    out = np.empty_like(arr, dtype=float)
    out[0] = arr[0]
    for i in range(1, len(arr)):
        out[i] = alpha * arr[i] + (1 - alpha) * out[i - 1]
    return out


def _compute_indicators(df: pd.DataFrame) -> IndicatorSet:
    """
    Compute RSI, MACD, Bollinger Bands, EMA, Stochastic, Williams %R,
    ADX, CCI, Momentum, and Rate-of-Change from a history DataFrame.
    """
    if df is None or df.empty or len(df) < 30:
        return IndicatorSet()

    df = df.copy()
    df.columns = [c.lower() for c in df.columns]
    closes = df["close"].dropna().to_numpy(dtype=float)
    highs = df["high"].dropna().to_numpy(dtype=float)
    lows = df["low"].dropna().to_numpy(dtype=float)
    n = len(closes)

    # ── RSI-14 ──────────────────────────────────────────────────────────────
    rsi_14 = float("nan")
    if n >= 15:
        deltas = np.diff(closes)
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_gain = float(np.mean(gains[:14]))
        avg_loss = float(np.mean(losses[:14]))
        for g, loss in zip(gains[14:], losses[14:]):
            avg_gain = (avg_gain * 13 + g) / 14
            avg_loss = (avg_loss * 13 + loss) / 14
        rs = avg_gain / max(avg_loss, 1e-12)
        rsi_14 = 100.0 - 100.0 / (1.0 + rs)

    # ── MACD (12, 26, 9) ─────────────────────────────────────────────────────
    macd_line = macd_signal = macd_hist = float("nan")
    if n >= 35:
        ema12 = _ema(closes, 12)
        ema26 = _ema(closes, 26)
        macd_arr = ema12 - ema26
        signal_arr = _ema(macd_arr, 9)
        macd_line = float(macd_arr[-1])
        macd_signal = float(signal_arr[-1])
        macd_hist = macd_line - macd_signal

    # ── Bollinger Bands (20, 2) ───────────────────────────────────────────────
    bb_upper = bb_middle = bb_lower = bb_width = bb_pct_b = float("nan")
    if n >= 20:
        sma20 = float(np.mean(closes[-20:]))
        std20 = float(np.std(closes[-20:], ddof=1))
        bb_middle = sma20
        bb_upper = sma20 + 2 * std20
        bb_lower = sma20 - 2 * std20
        bb_width = (bb_upper - bb_lower) / max(sma20, 1e-9)
        bb_pct_b = (closes[-1] - bb_lower) / max(bb_upper - bb_lower, 1e-9)

    # ── EMAs ─────────────────────────────────────────────────────────────────
    ema_9 = float(_ema(closes, 9)[-1]) if n >= 9 else float("nan")
    ema_21 = float(_ema(closes, 21)[-1]) if n >= 21 else float("nan")
    ema_50 = float(_ema(closes, 50)[-1]) if n >= 50 else float("nan")
    sma_200 = float(np.mean(closes[-200:])) if n >= 200 else float("nan")

    # ── Stochastic (14, 3) ───────────────────────────────────────────────────
    stoch_k = stoch_d = float("nan")
    if n >= 14:
        period_highs = np.array([np.max(highs[max(0, i - 14):i + 1]) for i in range(n)])
        period_lows = np.array([np.min(lows[max(0, i - 14):i + 1]) for i in range(n)])
        k_raw = 100 * (closes - period_lows) / np.maximum(period_highs - period_lows, 1e-9)
        k_smooth = np.array([float(np.mean(k_raw[max(0, i - 3):i + 1])) for i in range(n)])
        d_smooth = np.array([float(np.mean(k_smooth[max(0, i - 3):i + 1])) for i in range(n)])
        stoch_k = float(k_smooth[-1])
        stoch_d = float(d_smooth[-1])

    # ── Williams %R (14) ─────────────────────────────────────────────────────
    williams_r = float("nan")
    if n >= 14:
        h14 = float(np.max(highs[-14:]))
        l14 = float(np.min(lows[-14:]))
        williams_r = -100 * (h14 - closes[-1]) / max(h14 - l14, 1e-9)

    # ── ADX (14) ─────────────────────────────────────────────────────────────
    adx = float("nan")
    if n >= 28:
        prev_closes = np.roll(closes, 1)
        prev_closes[0] = closes[0]
        prev_highs = np.roll(highs, 1)
        prev_highs[0] = highs[0]
        prev_lows = np.roll(lows, 1)
        prev_lows[0] = lows[0]
        tr = np.maximum(
            highs - lows,
            np.maximum(np.abs(highs - prev_closes), np.abs(lows - prev_closes))
        )
        plus_dm = np.where(
            (highs - prev_highs) > (prev_lows - lows),
            np.maximum(highs - prev_highs, 0), 0
        )
        minus_dm = np.where(
            (prev_lows - lows) > (highs - prev_highs),
            np.maximum(prev_lows - lows, 0), 0
        )
        atr14 = np.array([float(np.mean(tr[max(0, i - 14):i + 1])) for i in range(n)])
        plus_di = 100 * np.array([
            float(np.mean(plus_dm[max(0, i - 14):i + 1])) for i in range(n)
        ]) / np.maximum(atr14, 1e-9)
        minus_di = 100 * np.array([
            float(np.mean(minus_dm[max(0, i - 14):i + 1])) for i in range(n)
        ]) / np.maximum(atr14, 1e-9)
        dx = 100 * np.abs(plus_di - minus_di) / np.maximum(plus_di + minus_di, 1e-9)
        adx = float(np.mean(dx[-14:]))

    # ── CCI-20 ───────────────────────────────────────────────────────────────
    cci_20 = float("nan")
    if n >= 20:
        typical = (highs + lows + closes) / 3.0
        sma_tp = float(np.mean(typical[-20:]))
        mean_dev = float(np.mean(np.abs(typical[-20:] - sma_tp)))
        cci_20 = (typical[-1] - sma_tp) / max(0.015 * mean_dev, 1e-9)

    # ── Momentum-10 & ROC-14 ─────────────────────────────────────────────────
    momentum_10 = float(closes[-1] - closes[-11]) if n >= 11 else float("nan")
    roc_14 = float(100 * (closes[-1] - closes[-15]) / max(closes[-15], 1e-9)) if n >= 15 else float("nan")

    return IndicatorSet(
        rsi_14=rsi_14,
        macd_line=macd_line,
        macd_signal=macd_signal,
        macd_histogram=macd_hist,
        bb_upper=bb_upper,
        bb_middle=bb_middle,
        bb_lower=bb_lower,
        bb_width=bb_width,
        bb_pct_b=bb_pct_b,
        ema_9=ema_9,
        ema_21=ema_21,
        ema_50=ema_50,
        sma_200=sma_200,
        stoch_k=stoch_k,
        stoch_d=stoch_d,
        williams_r=williams_r,
        adx=adx,
        cci_20=cci_20,
        momentum_10=momentum_10,
        rate_of_change_14=roc_14,
    )


# ============================================================================
# S/R PROJECTIONS (from zones + price levels)
# ============================================================================

@dataclass
class SRLevel:
    label: str
    price: float
    source: str        # "pivot", "bb", "atr_band", "zone", "fib"
    strength: float    # 0-1 normalised

    def to_dict(self) -> Dict:
        return dataclasses.asdict(self)


def _compute_sr_levels(
    ohlcv: OHLCVSnapshot,
    indicators: IndicatorSet,
    zone_result: Optional[Any] = None,
) -> List[SRLevel]:
    """
    Produce support / resistance level projections from multiple sources:
      1. Classic floor-trader pivot points (PP, R1-R3, S1-S3)
      2. Bollinger Band rails
      3. ATR-based volatility bands
      4. Zone classification flags (expansion / consolidation boundaries)
      5. Fibonacci retracement levels (38.2%, 50%, 61.8%) from recent range
    """
    levels: List[SRLevel] = []

    H = ohlcv.high
    L = ohlcv.low
    C = ohlcv.prev_close
    if any(math.isnan(x) for x in [H, L, C]):
        return levels

    # ── 1. Pivot Points ──────────────────────────────────────────────────────
    PP = (H + L + C) / 3.0
    R1 = 2 * PP - L
    R2 = PP + (H - L)
    R3 = H + 2 * (PP - L)
    S1 = 2 * PP - H
    S2 = PP - (H - L)
    S3 = L - 2 * (H - PP)
    for lbl, price in [
        ("PP", PP), ("R1", R1), ("R2", R2), ("R3", R3),
        ("S1", S1), ("S2", S2), ("S3", S3)
    ]:
        strength = 0.9
        if lbl in ("R1", "S1"):
            strength = 0.7
        elif lbl != "PP":
            strength = 0.5
        levels.append(SRLevel(lbl, round(price, 2), "pivot", strength))

    # ── 2. Bollinger Bands ────────────────────────────────────────────────────
    if not math.isnan(indicators.bb_upper):
        levels.append(SRLevel("BB_upper", round(indicators.bb_upper, 2), "bb", 0.65))
        levels.append(SRLevel("BB_mid",   round(indicators.bb_middle, 2), "bb", 0.55))
        levels.append(SRLevel("BB_lower", round(indicators.bb_lower, 2), "bb", 0.65))

    # ── 3. ATR Bands ─────────────────────────────────────────────────────────
    if not math.isnan(ohlcv.atr_14) and not math.isnan(ohlcv.close):
        atr = ohlcv.atr_14
        for mult, lbl in [(1.0, "ATR+1"), (2.0, "ATR+2"),
                          (-1.0, "ATR-1"), (-2.0, "ATR-2")]:
            levels.append(SRLevel(lbl, round(ohlcv.close + mult * atr, 2), "atr_band", 0.60))

    # ── 4. Fibonacci retracement from last-session range ─────────────────────
    rng = H - L
    for ratio, lbl in [(0.236, "Fib23.6"), (0.382, "Fib38.2"),
                       (0.500, "Fib50.0"), (0.618, "Fib61.8"), (0.786, "Fib78.6")]:
        fib_price = L + ratio * rng
        strength = 0.75 if ratio in (0.382, 0.618) else 0.60
        levels.append(SRLevel(lbl, round(fib_price, 2), "fib", strength))

    # ── 5. Zone-derived S/R (expansion boundary) ──────────────────────────────
    if zone_result is not None and not math.isnan(ohlcv.atr_14):
        if getattr(zone_result, "expansion", False):
            atr = ohlcv.atr_14
            levels.append(SRLevel("ZoneExpR", round(ohlcv.close + 1.5 * atr, 2), "zone", 0.70))
            levels.append(SRLevel("ZoneExpS", round(ohlcv.close - 1.5 * atr, 2), "zone", 0.70))
        if getattr(zone_result, "consolidation", False):
            levels.append(SRLevel("ZoneConsoR", round(ohlcv.close + 0.5 * ohlcv.atr_14, 2), "zone", 0.55))
            levels.append(SRLevel("ZoneConsoS", round(ohlcv.close - 0.5 * ohlcv.atr_14, 2), "zone", 0.55))

    return sorted(levels, key=lambda s: s.price)


# ============================================================================
# CALCULUS ENGINE (identical to DJI; parametrised for any index)
# ============================================================================

class CalculusEngine:
    """Advanced calculus operations for financial modelling via SymPy."""

    def __init__(self):
        self.t, self.S, self.sigma, self.mu, self.r = symbols(
            't S sigma mu r', positive=True, real=True
        )
        self.W = Symbol('W')

    def taylor_expansion_price(self, S0: float, dS: float, order: int = 4) -> float:
        S = self.S
        f = sym_log(S)
        coefficients = []
        for n in range(order + 1):
            deriv_n = sym_diff(f, S, n)
            coeff = deriv_n.subs(S, S0) / sym_factorial(n)
            coefficients.append(float(coeff) * (dS ** n))
        log_price_approx = sum(coefficients)
        return float(sym_exp(log_price_approx))

    def ito_lemma_application(self, S0: float, dt: float, dW: float,
                               mu_val: float, sigma_val: float) -> Dict:
        S = self.S
        f = sym_log(S)
        df_dS = sym_diff(f, S)
        d2f_dS2 = sym_diff(f, S, 2)
        drift_coeff = mu_val - 0.5 * sigma_val ** 2
        diffusion_coeff = sigma_val
        d_log_S = drift_coeff * dt + diffusion_coeff * dW
        new_log_S = np.log(S0) + d_log_S
        new_S = np.exp(new_log_S)
        return {
            'df_dS': str(df_dS),
            'd2f_dS2': str(d2f_dS2),
            'drift_term': drift_coeff * dt,
            'diffusion_term': diffusion_coeff * dW,
            'd_log_S': d_log_S,
            'new_price': new_S,
            'price_change': new_S - S0
        }

    def black_scholes_pde(self, S0: float, K: float, T: float,
                           r: float, sigma: float) -> Dict:
        d1 = (np.log(S0 / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        N = normal_dist.cdf
        call_price = S0 * N(d1) - K * np.exp(-r * T) * N(d2)
        delta = N(d1)
        gamma = normal_dist.pdf(d1) / (S0 * sigma * np.sqrt(T))
        theta = (-S0 * normal_dist.pdf(d1) * sigma / (2 * np.sqrt(T))
                 - r * K * np.exp(-r * T) * N(d2))
        vega = S0 * np.sqrt(T) * normal_dist.pdf(d1)
        return {
            'd1': d1, 'd2': d2,
            'call_price': call_price,
            'delta': delta, 'gamma': gamma, 'theta': theta, 'vega': vega
        }


# ============================================================================
# STOCHASTIC PROCESSES
# ============================================================================

class StochasticProcesses:
    def __init__(self, config: MarketConfig):
        self.config = config
        if config.random_seed is not None:
            np.random.seed(config.random_seed)

    def geometric_brownian_motion(self, S0: float, T: float, steps: int) -> np.ndarray:
        dt = T / steps
        mu, sigma = self.config.drift, self.config.volatility
        dW = np.random.normal(0, np.sqrt(dt), steps)
        W = np.cumsum(dW)
        W = np.insert(W, 0, 0)
        t = np.linspace(0, T, steps + 1)
        S = S0 * np.exp((mu - 0.5 * sigma ** 2) * t + sigma * W)
        return S

    def ornstein_uhlenbeck_process(self, S0: float, theta: float,
                                    mu_eq: float, sigma: float,
                                    T: float, steps: int) -> np.ndarray:
        dt = T / steps
        S = np.zeros(steps + 1)
        S[0] = S0
        for i in range(steps):
            dW = np.random.normal(0, np.sqrt(dt))
            S[i + 1] = S[i] + theta * (mu_eq - S[i]) * dt + sigma * dW
        return S

    def jump_diffusion_merton(self, S0: float, T: float, steps: int,
                               lambda_j: float = 0.1,
                               mu_j: float = 0.0,
                               sigma_j: float = 0.1) -> np.ndarray:
        dt = T / steps
        mu, sigma = self.config.drift, self.config.volatility
        kappa = np.exp(mu_j + 0.5 * sigma_j ** 2) - 1
        S = np.zeros(steps + 1)
        S[0] = S0
        for i in range(steps):
            dW = np.random.normal(0, np.sqrt(dt))
            n_jumps = np.random.poisson(lambda_j * dt)
            J = float(np.sum(np.exp(np.random.normal(mu_j, sigma_j, n_jumps)) - 1)) if n_jumps > 0 else 0.0
            dS = S[i] * ((mu - lambda_j * kappa) * dt + sigma * dW + J)
            S[i + 1] = S[i] + dS
        return S


# ============================================================================
# NUMERICAL INTEGRATION
# ============================================================================

class NumericalIntegration:
    @staticmethod
    def simpsons_rule(f: Callable, a: float, b: float, n: int) -> float:
        if n % 2 == 1:
            n += 1
        h = (b - a) / n
        x = np.linspace(a, b, n + 1)
        y = np.array([f(xi) for xi in x])
        weights = np.ones(n + 1)
        weights[1:-1:2] = 4
        weights[2:-1:2] = 2
        return h / 3 * np.sum(weights * y)

    @staticmethod
    def gaussian_quadrature(f: Callable, a: float, b: float, n: int = 5) -> float:
        nodes, weights = np.polynomial.legendre.leggauss(n)
        x = 0.5 * (b - a) * nodes + 0.5 * (a + b)
        w = 0.5 * (b - a) * weights
        return float(np.sum(w * np.array([f(xi) for xi in x])))

    @staticmethod
    def romberg_integration(f: Callable, a: float, b: float, tol: float = 1e-10) -> float:
        result, _ = quad(f, a, b, epsabs=tol, epsrel=tol)
        return result


# ============================================================================
# FOURIER ANALYSIS
# ============================================================================

class FourierAnalysis:
    @staticmethod
    def compute_spectrum(prices: np.ndarray, sample_rate: float = 1.0) -> Tuple[np.ndarray, np.ndarray]:
        n = len(prices)
        detrended = prices - np.linspace(prices[0], prices[-1], n)
        window = np.hanning(n)
        windowed = detrended * window
        spectrum = np.fft.fft(windowed)
        frequencies = np.fft.fftfreq(n, 1 / sample_rate)
        power = np.abs(spectrum[:n // 2]) ** 2
        freqs = frequencies[:n // 2]
        return freqs, power

    @staticmethod
    def extract_dominant_cycles(prices: np.ndarray, n_cycles: int = 3) -> List[Dict]:
        freqs, power = FourierAnalysis.compute_spectrum(prices)
        peaks, _ = find_peaks(power, height=np.max(power) * 0.1)
        sorted_indices = np.argsort(power[peaks])[::-1][:n_cycles]
        dominant_peaks = peaks[sorted_indices]
        cycles = []
        for idx in dominant_peaks:
            if freqs[idx] > 0:
                period = 1 / freqs[idx]
                cycles.append({'frequency': freqs[idx], 'period_minutes': period, 'power': power[idx]})
        return cycles


# ============================================================================
# MONTE CARLO ENGINE
# ============================================================================

class MonteCarloEngine:
    def __init__(self, config: MarketConfig):
        self.config = config
        if config.random_seed is not None:
            np.random.seed(config.random_seed)

    def antithetic_variates(self, S0: float, T: float, n_sims: int) -> np.ndarray:
        mu, sigma = self.config.drift, self.config.volatility
        Z = np.random.normal(0, 1, n_sims // 2)
        S_pos = S0 * np.exp((mu - 0.5 * sigma ** 2) * T + sigma * np.sqrt(T) * Z)
        S_neg = S0 * np.exp((mu - 0.5 * sigma ** 2) * T + sigma * np.sqrt(T) * (-Z))
        return np.concatenate([S_pos, S_neg])

    def control_variates(self, S0: float, T: float, n_sims: int) -> Tuple[float, float]:
        mu, sigma = self.config.drift, self.config.volatility
        Z = np.random.normal(0, 1, n_sims)
        S_T = S0 * np.exp((mu - 0.5 * sigma ** 2) * T + sigma * np.sqrt(T) * Z)
        E_control = S0 * np.exp(mu * T)
        control = S_T - E_control
        cov_matrix = np.cov(S_T, control)
        cov_YC = cov_matrix[0, 1]
        var_C = cov_matrix[1, 1]
        c_star = cov_YC / var_C if var_C > 0 else 0
        adjusted = S_T - c_star * control
        return float(np.mean(adjusted)), float(np.std(adjusted) / np.sqrt(n_sims))

    def stratified_sampling(self, S0: float, T: float, n_sims: int, n_strata: int = 10) -> np.ndarray:
        mu, sigma = self.config.drift, self.config.volatility
        samples_per_stratum = n_sims // n_strata
        S_T = np.zeros(n_sims)
        for i in range(n_strata):
            u = np.random.uniform(i / n_strata, (i + 1) / n_strata, samples_per_stratum)
            Z = normal_dist.ppf(u)
            start_idx = i * samples_per_stratum
            S_T[start_idx:start_idx + samples_per_stratum] = S0 * np.exp(
                (mu - 0.5 * sigma ** 2) * T + sigma * np.sqrt(T) * Z
            )
        return S_T


# ============================================================================
# ACTIVE PATTERNS (via yfinance_chart integration)
# ============================================================================

def _collect_active_patterns(df_lower: pd.DataFrame) -> List[Dict]:
    """
    Run all available pattern detectors from yfinance_chart and return
    the most recent active overlay for each family as a plain dict list.

    *df_lower* must have lowercase columns: open, high, low, close, volume.
    """
    if not _PATTERNS_AVAILABLE or df_lower is None or df_lower.empty:
        return []

    active: List[Dict] = []

    detectors = [
        ("ou_reversion",       detect_ornstein_uhlenbeck_reversion),
        ("brownian_vol",       detect_brownian_volatility_cluster),
        ("geodesic_sr",        detect_geodesic_sr),
        ("higuchi_regime",     detect_higuchi_regime),
        ("exterior_deriv",     detect_exterior_derivative_spike),
        ("harmonic",           detect_harmonic_patterns),
        ("elliott_wave",       detect_elliott_waves),
    ]

    for family, fn in detectors:
        try:
            overlays = fn(df_lower)
            if overlays:
                # Take the most recently ending overlay
                latest = max(overlays, key=lambda o: o.end_idx)
                active.append({
                    "family": family,
                    "name": latest.name,
                    "start_idx": latest.start_idx,
                    "end_idx": latest.end_idx,
                    "upper": round(latest.upper_end, 4),
                    "lower": round(latest.lower_end, 4),
                    "score": round(latest.score, 4),
                    "color": latest.color,
                })
        except Exception:
            pass

    # Extended calculus features if available
    try:
        ext = build_extended_calculus_features(df_lower)
        if ext:
            active.append({"family": "extended_calculus", "features": ext})
    except Exception:
        pass

    return active


# ============================================================================
# INTEGRATED RESULT CONTAINER
# ============================================================================

@dataclass
class IXICPredictionResult:
    """
    Unified prediction result combining all subsystems into a single object.

    Fields
    ------
    timestamp           ISO-8601 generation time
    ticker              Always "^IXIC"
    ohlcv               OHLCV snapshot from live data (or defaults)
    indicators          Technical indicator set
    sr_levels           Support / resistance level projections
    zone                Zone classification result dict (from yfinance/zones)
    active_patterns     List of active pattern overlays
    gbm                 GBM Monte Carlo statistics
    antithetic          Antithetic-variates MC statistics
    stratified          Stratified-sampling MC statistics
    integration         Analytical / numerical integration expected value
    black_scholes       Black-Scholes PDE + Greeks
    ito_lemma           Itô's Lemma price-change decomposition
    taylor_expansion    Taylor-series price approximation
    confidence_interval 95 % CI around antithetic-variates mean
    combined_prediction Weighted ensemble prediction
    dominant_cycles     Top Fourier cycles (period in bars)
    data_source         "live" | "default"
    tensor_signal       Latest tensor score + dominant regime + Kalman drift
    tensor_forecast     20-bar tensor-adjusted Monte Carlo forecast (mean + bands)
    tensor_regime       Per-bar regime probabilities (last bar)
    tensor_statistics   Hurst, autocorrelation, skewness, excess kurtosis, annualised vol
    tensor_var          Historical-simulation VaR (1-day, 5-day, 10-day) + CVaR
    tensor_feature_importance  Leave-one-out Shapley-style feature deltas
    haar_wavelet        Haar multi-scale decomposition summary
    complex_analysis    Characteristic function, Gil-Pelaez FFT, contour integral
    gpu_backend         Active GPU backend ('cuda' | 'mps' | 'tensorflow' | 'cpu')
    gpu_mc_forecast     GPU-accelerated GBM MC (mean + percentiles)
    """
    timestamp: str = ""
    ticker: str = "^IXIC"
    ohlcv: Dict = field(default_factory=dict)
    indicators: Dict = field(default_factory=dict)
    sr_levels: List[Dict] = field(default_factory=list)
    zone: Dict = field(default_factory=dict)
    active_patterns: List[Dict] = field(default_factory=list)
    gbm: Dict = field(default_factory=dict)
    antithetic: Dict = field(default_factory=dict)
    stratified: Dict = field(default_factory=dict)
    integration: Dict = field(default_factory=dict)
    black_scholes: Dict = field(default_factory=dict)
    ito_lemma: Dict = field(default_factory=dict)
    taylor_expansion: Dict = field(default_factory=dict)
    confidence_interval: Dict = field(default_factory=dict)
    combined_prediction: Dict = field(default_factory=dict)
    dominant_cycles: List[Dict] = field(default_factory=list)
    data_source: str = "default"
    # ── Tensor / Neural / GPU ─────────────────────────────────────────────────
    tensor_signal: Dict = field(default_factory=dict)
    tensor_forecast: Dict = field(default_factory=dict)
    tensor_regime: Dict = field(default_factory=dict)
    tensor_statistics: Dict = field(default_factory=dict)
    tensor_var: Dict = field(default_factory=dict)
    tensor_feature_importance: List[Dict] = field(default_factory=list)
    haar_wavelet: Dict = field(default_factory=dict)
    complex_analysis: Dict = field(default_factory=dict)
    gpu_backend: str = "cpu"
    gpu_mc_forecast: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return dataclasses.asdict(self)


# ============================================================================
# MAIN PREDICTION ENGINE
# ============================================================================

class IXIC1PMPredictor:
    """
    Orchestrator for the IXIC 1 PM close prediction.

    Workflow
    --------
    1.  Fetch real IXIC history via yfinance/ops (fallback to config defaults).
    2.  Compute OHLCV snapshot and update model parameters.
    3.  Run zone classification (S/R zones).
    4.  Collect active pattern overlays.
    5.  Run stochastic / calculus simulations.
    6.  Compute technical indicators.
    7.  Assemble unified IXICPredictionResult.
    8.  Persist to dbs/ via DataStore.
    """

    def __init__(self, config: MarketConfig):
        self.config = config
        self.calculus = CalculusEngine()
        self.integration = NumericalIntegration()
        self.fourier = FourierAnalysis()

    # ── Data acquisition ────────────────────────────────────────────────────

    def _fetch_history(self) -> Optional[pd.DataFrame]:
        """Attempt to download IXIC history; return None on any failure."""
        if not _YF_OPS_AVAILABLE:
            return None
        try:
            df = yf_ticker_history(
                self.config.ticker,
                period=self.config.history_period,
                interval=self.config.history_interval,
            )
            if df is None or df.empty:
                return None
            return df
        except Exception:
            return None

    def _seed_config_from_history(self, df: pd.DataFrame) -> None:
        """Update drift & volatility from realised history."""
        if df is None or df.empty:
            return
        df_c = df.copy()
        df_c.columns = [c.lower() for c in df_c.columns]
        closes = df_c["close"].dropna().to_numpy(dtype=float)
        if len(closes) < 10:
            return
        log_rets = np.diff(np.log(np.maximum(closes, 1e-10)))
        window = min(20, len(log_rets))
        self.config.volatility = max(
            float(np.std(log_rets[-window:], ddof=1)) * np.sqrt(252),
            0.001
        )
        self.config.drift = float(np.mean(log_rets[-window:])) * 252
        self.config.current_price = float(closes[-1])

    # ── Time helpers ─────────────────────────────────────────────────────────

    def _compute_time_to_target(self) -> float:
        now = datetime.now()
        market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
        target_time = now.replace(hour=13, minute=0, second=0, microsecond=0)
        if now < market_open:
            minutes_from_open = 0.0
        else:
            minutes_from_open = (now - market_open).total_seconds() / 60.0
        minutes_to_1pm = max(0.0, (target_time - now).total_seconds() / 60.0)
        T = minutes_to_1pm / (self.config.trading_days * self.config.minutes_per_day)
        return T

    # ── Tensor / Neural pipeline ───────────────────────────────────────────────

    def _run_tensor_pipeline(self, closes: np.ndarray) -> Dict:
        """
        Run the full tensor.financial pipeline on the closing-price series.

        Returns a dict with keys:
          tensor_signal, tensor_forecast, tensor_regime, tensor_statistics,
          tensor_var, tensor_feature_importance, haar_wavelet
        All subsystems are driven by shared mathematics:
          – HOSVD covariance denoising (Linear Algebra / Spectral Theory)
          – Kalman filter (Bayesian state-space, stochastic calculus)
          – Haar wavelet (multi-scale harmonic analysis)
          – 5-class softmax regime classifier (probabilistic / tensor algebra)
          – Monte Carlo with tensor-score adjustment (stochastic calculus)
          – Hurst exponent, VaR/CVaR (fractal analysis, extreme value theory)
        """
        out: Dict[str, Any] = {}
        if not _TENSOR_AVAILABLE or len(closes) < 32:
            return out

        try:
            # ── Kalman smoother ─────────────────────────────────────────────
            kp, kd = tensor_kalman_filter(closes)

            # ── Haar wavelet decomposition ─────────────────────────────────
            haar = haar_decompose(closes)
            haar_slope = haar["trend_slope"]
            out["haar_wavelet"] = {
                "trend_slope": round(float(haar_slope), 6),
                "energy_low_freq": round(float(haar["energy_lo"]), 4),
                "energy_high_freq": round(float(haar["energy_hi"]), 4),
            }

            # ── Feature matrix + HOSVD ──────────────────────────────────────
            F = build_feature_matrix(closes)
            _, S_sv, F_den, k_used = tensor_decompose(F)

            # ── Tensor contraction → score + regime probabilities ───────────
            score, regime_signal, P = tensor_contract(F, F_den)
            last_p = P[-1]
            dom = int(np.argmax(last_p))
            regime_labels = ["STRONG_BULL", "BULL", "NEUT", "BEAR", "STRONG_BEAR"]
            out["tensor_signal"] = {
                "tensor_score": round(float(score), 6),
                "hosvd_k": k_used,
                "hosvd_singular_values": [round(float(sv), 6) for sv in S_sv[:k_used]],
                "kalman_price": round(float(kp[-1]), 4),
                "kalman_drift": round(float(kd[-1]), 6),
                "regime": regime_labels[dom],
                "p_strong_bull": round(float(last_p[0]), 4),
                "p_bull": round(float(last_p[1]), 4),
                "p_neut": round(float(last_p[2]), 4),
                "p_bear": round(float(last_p[3]), 4),
                "p_strong_bear": round(float(last_p[4]), 4),
                "bull_signal": round(float(last_p[0] + last_p[1] * 0.5
                                           - last_p[3] * 0.5 - last_p[4]), 4),
            }
            out["tensor_regime"] = {lbl: round(float(p), 4)
                                    for lbl, p in zip(regime_labels, last_p)}

            # ── Smooth drift (blended HOSVD + Kalman) ──────────────────────
            drift_smooth, alpha = tensor_smooth_drift(closes, F, kd)
            sigma_hist = float(np.std(np.diff(np.log(np.maximum(closes, 1e-10))), ddof=1))

            # ── Tensor-adjusted Monte Carlo forecast (20-bar horizon) ───────
            fc = tensor_mc_forecast(closes, float(score), sigma_hist, float(drift_smooth), haar_slope)
            out["tensor_forecast"] = {
                "last_price": fc["last_price"],
                "drift_adjusted": fc["drift"],
                "adj_factor": fc["adj_factor"],
                "sigma_step": fc["sigma_step"],
                "n_paths": fc["n_paths"],
                "horizon_bars": fc["horizon"],
                "mean_target": round(float(fc["forecast"][-1]), 4) if fc["forecast"] else None,
                "p10_target": round(float(fc["p10_band"][-1]), 4) if fc["p10_band"] else None,
                "p90_target": round(float(fc["p90_band"][-1]), 4) if fc["p90_band"] else None,
                "forecast_series": [round(v, 4) for v in fc["forecast"]],
                "p10_band": [round(v, 4) for v in fc["p10_band"]],
                "p90_band": [round(v, 4) for v in fc["p90_band"]],
            }

            # ── Feature importance (Shapley-style) ─────────────────────────
            out["tensor_feature_importance"] = feature_importance(F)

            # ── Cross-asset statistics (Hurst, autocorrelation, moments) ───
            stats = cross_asset_summary(closes)
            out["tensor_statistics"] = stats

            # ── VaR / CVaR ──────────────────────────────────────────────────
            var = compute_var(closes)
            out["tensor_var"] = var

        except Exception:
            pass

        return out

    # ── GPU-accelerated computation ──────────────────────────────────────────

    def _run_gpu_dispatch(self, closes: np.ndarray, mu_step: float, sigma_step: float) -> Dict:
        """
        Dispatch tensor + MC workloads to the GPU layer (falls back to CPU).

        Uses gpu/kernels:
          – tensor_ops.hosvd          (HOSVD covariance projection)
          – tensor_ops.kalman_smooth  (RTS smoother)
          – tensor_ops.monte_carlo    (GBM paths)
          – tensor_ops.haar_wavelet   (multi-scale decomposition)
        """
        out: Dict[str, Any] = {}
        if not _GPU_AVAILABLE:
            out["gpu_backend"] = "cpu"
            return out

        try:
            mgr = GPUManager.get_instance()
            out["gpu_backend"] = mgr.backend

            dispatcher = GPUDispatcher(manager=mgr)
            try:
                # GPU HOSVD
                F_gpu = build_feature_matrix(closes) if _TENSOR_AVAILABLE else np.eye(8)
                f_hosvd = dispatcher.submit("tensor_ops.hosvd", feature_matrix=F_gpu, rank=3)

                # GPU Kalman
                f_kalman = dispatcher.submit("tensor_ops.kalman_smooth", observations=closes)

                # GPU Monte Carlo (GBM)
                f_mc = dispatcher.submit(
                    "tensor_ops.monte_carlo",
                    mu=mu_step,
                    sigma=sigma_step,
                    steps=20,
                    n_paths=800,
                    seed=self.config.random_seed or 42,
                    s0=float(closes[-1]),
                )

                # GPU Haar wavelet
                f_haar = dispatcher.submit("tensor_ops.haar_wavelet", signal=closes, levels=3)

                # Collect results
                core, sv = f_hosvd.result(timeout=60)
                smoothed = f_kalman.result(timeout=60)
                mc_result = f_mc.result(timeout=60)
                haar_comp = f_haar.result(timeout=60)

                out["gpu_hosvd"] = {
                    "core_shape": list(core.shape),
                    "singular_values": [round(float(v), 6) for v in sv],
                }
                out["gpu_kalman_last"] = round(float(smoothed[-1]), 4)
                out["gpu_mc_forecast"] = {
                    "mean": round(float(mc_result["mean"]), 4),
                    "p5": round(float(mc_result["p5"]), 4),
                    "p25": round(float(mc_result["p25"]), 4),
                    "p75": round(float(mc_result["p75"]), 4),
                    "p95": round(float(mc_result["p95"]), 4),
                    "n_paths": 800,
                }
                out["gpu_haar_levels"] = len(haar_comp)
            finally:
                dispatcher.shutdown(wait=False)

        except Exception:
            out.setdefault("gpu_backend", "cpu")

        return out

    # ── Complex analysis ──────────────────────────────────────────────────────

    def _run_complex_analysis(self, S0: float, T: float) -> Dict:
        """
        Apply complex analysis techniques to derive option-pricing quantities
        and spectral decomposition of the GBM price distribution.

        Mathematics used
        ----------------
        Characteristic function (Fourier / Complex Analysis)
            φ(u) = E[exp(i·u·log S_T)]
                 = exp(i·u·m − u²·s²/2)
            where m = log(S0) + (μ − σ²/2)·T,  s = σ√T

        Gil-Pelaez FFT inversion  (Residue theorem / Fourier inversion)
            The CDF and density are recovered from φ(u) via Fourier inversion.
            Numerical Gil-Pelaez: P(S_T > K) = ½ + (1/π) ∫₀^∞ Re[e^{−iuK}φ(u)] du/u

        Contour integral expected value  (Cauchy integral theorem)
            E[S_T] = (1/2πi) ∮ S·f(S)/z dz  approximated numerically
            over a semicircular contour in the log-price complex plane.

        Moment generating function  (Complex exponential, Taylor expansion)
            M(t) = exp(m·t + s²·t²/2)  gives moments directly.
        """
        out: Dict[str, Any] = {}
        mu, sigma = self.config.drift, self.config.volatility
        if T <= 0:
            # 207 minutes = time from 9:30 AM open to 1 PM target
            T = 207.0 / (self.config.trading_days * self.config.minutes_per_day)

        m = math.log(S0) + (mu - 0.5 * sigma ** 2) * T
        s = sigma * math.sqrt(T)

        # ── Characteristic function at selected u values ─────────────────
        u_vals = [0.5, 1.0, 2.0, 5.0, 10.0]
        char_fn = {}
        for u in u_vals:
            phi = cmath.exp(1j * u * m - u ** 2 * s ** 2 / 2)
            char_fn[f"u={u}"] = {"real": round(phi.real, 8), "imag": round(phi.imag, 8),
                                  "abs": round(abs(phi), 8)}
        out["characteristic_function"] = char_fn

        # ── Gil-Pelaez: P(S_T > S0) via Fourier inversion ────────────────
        K_log = math.log(S0)
        def _integrand_gp(u: float) -> float:
            if u < 1e-10:
                return 0.0
            phi_u = cmath.exp(1j * u * m - u ** 2 * s ** 2 / 2)
            num = cmath.exp(-1j * u * K_log) * phi_u
            return float(num.real) / u

        try:
            integral_val, _ = quad(_integrand_gp, 1e-6, 200.0, limit=200)
            prob_above_S0 = 0.5 + integral_val / math.pi
            out["gil_pelaez"] = {
                "P(S_T > S0)": round(float(np.clip(prob_above_S0, 0.0, 1.0)), 6),
                "P(S_T < S0)": round(float(np.clip(1.0 - prob_above_S0, 0.0, 1.0)), 6),
            }
        except Exception:
            out["gil_pelaez"] = {}

        # ── Moment generating function moments ────────────────────────────
        # MGF: M(t) = exp(m·t + s²·t²/2) → E[S_T^n] at t=1,2,...
        out["moment_generating"] = {}
        for n_mom in [1, 2, 3]:
            m_val = math.exp(n_mom * m + n_mom ** 2 * s ** 2 / 2)
            out["moment_generating"][f"E[S_T^{n_mom}]"] = round(m_val, 4)

        # ── Analytical E[S_T] and variance via complex exponential ────────
        E_S = math.exp(m + s ** 2 / 2)
        Var_S = math.exp(2 * m + s ** 2) * (math.exp(s ** 2) - 1)
        out["distribution"] = {
            "E[S_T]": round(E_S, 4),
            "Var[S_T]": round(Var_S, 4),
            "StdDev[S_T]": round(math.sqrt(max(Var_S, 0)), 4),
            "log_mean_m": round(m, 8),
            "log_std_s": round(s, 8),
        }

        # ── Contour integral (residue-based) price approximation ─────────
        # Numerical estimate: (1/2π) ∫ e^{-iuK} φ(u) du integrated over ℝ
        # approximated via dense Fourier grid (discrete Gil-Pelaez)
        try:
            N_fft = 256
            eta = 0.25          # frequency step
            u_grid = eta * np.arange(N_fft)
            lambda_grid = 2 * math.pi / (N_fft * eta)   # log-price step
            b = N_fft * lambda_grid / 2.0                # lower bound of log-price grid

            # Characteristic function over grid (damped with α=1.5 for stability)
            alpha = 1.5
            k_vals = b + lambda_grid * np.arange(N_fft)   # log-price grid
            phi_u = np.exp(1j * (u_grid - (alpha + 1) * 1j) * m
                           - ((u_grid - (alpha + 1) * 1j) ** 2) * s ** 2 / 2)
            mod_phi = phi_u / ((alpha + 1j * u_grid) * (alpha + 1 + 1j * u_grid))
            fft_input = np.exp(1j * u_grid * b) * mod_phi
            # Simpson weights for FFT
            weights_s = np.ones(N_fft) * (eta / 3.0)
            weights_s[0] = eta / 6.0
            weights_s[-1] = eta / 6.0
            weights_s[1:-1:2] *= 2
            weights_s[2:-1:2] *= 2
            fft_vals = np.fft.fft(weights_s * fft_input)
            call_prices_fft = (np.exp(-alpha * k_vals) / math.pi) * np.real(fft_vals)
            # ATM call price (closest log-strike to log(S0))
            atm_idx = int(np.argmin(np.abs(k_vals - math.log(S0))))
            atm_call_fft = float(call_prices_fft[atm_idx])
            out["carr_madan_fft"] = {
                "atm_call_price": round(atm_call_fft, 4),
                "alpha_damping": alpha,
                "grid_points": N_fft,
            }
        except Exception:
            out["carr_madan_fft"] = {}

        return out

    # ── Stochastic + calculus core ─────────────────────────────────────────

    def _run_simulations(self, S0: float, T: float) -> Dict:
        if T <= 0:
            # Default: 207 minutes = time from 9:30 AM open to 1 PM target
            T = 207.0 / (self.config.trading_days * self.config.minutes_per_day)

        n_sims = self.config.simulations

        # Re-seed for reproducibility
        if self.config.random_seed is not None:
            np.random.seed(self.config.random_seed)

        stochastic = StochasticProcesses(self.config)
        mc = MonteCarloEngine(self.config)

        # GBM
        gbm_paths = np.array([
            stochastic.geometric_brownian_motion(S0, T, 100)[-1]
            for _ in range(n_sims)
        ])
        gbm = {'mean': float(np.mean(gbm_paths)),
               'std': float(np.std(gbm_paths)),
               'p5': float(np.percentile(gbm_paths, 5)),
               'p95': float(np.percentile(gbm_paths, 95))}

        # Antithetic variates
        av_prices = mc.antithetic_variates(S0, T, n_sims)
        antithetic = {
            'mean': float(np.mean(av_prices)),
            'std': float(np.std(av_prices)),
            'variance_reduction': float(np.var(gbm_paths) / max(np.var(av_prices), 1e-12))
        }

        # Stratified sampling
        strat_prices = mc.stratified_sampling(S0, T, n_sims)
        stratified = {'mean': float(np.mean(strat_prices)), 'std': float(np.std(strat_prices))}

        # Black-Scholes Greeks
        K = S0
        bs_result = self.calculus.black_scholes_pde(
            S0, K, T, self.config.risk_free_rate, self.config.volatility
        )

        # Itô's Lemma
        ito_result = self.calculus.ito_lemma_application(
            S0, T, 0.0, self.config.drift, self.config.volatility
        )

        # Taylor expansion
        expected_dS = S0 * self.config.drift * T
        taylor_price = self.calculus.taylor_expansion_price(S0, expected_dS, order=4)
        taylor = {'price': taylor_price, 'expected_drift': expected_dS}

        # Analytical expected value
        mu, sigma = self.config.drift, self.config.volatility
        E_S = S0 * np.exp(mu * T)
        m = np.log(S0) + (mu - 0.5 * sigma ** 2) * T
        s = sigma * np.sqrt(T)
        integration = {'analytical_expected': float(E_S), 'log_mean': float(m), 'log_std': float(s)}

        # 95 % CI
        z_95 = normal_dist.ppf(0.975)
        ci_std = float(np.std(av_prices) / np.sqrt(n_sims))
        ci = {
            'mean': float(np.mean(av_prices)),
            'ci_95_lower': float(np.mean(av_prices) - z_95 * ci_std),
            'ci_95_upper': float(np.mean(av_prices) + z_95 * ci_std),
        }

        # Combined (weighted ensemble)
        predictions = [gbm['mean'], antithetic['mean'], stratified['mean'], integration['analytical_expected']]
        combined = {
            'mean': float(np.mean(predictions)),
            'std': float(np.std(predictions)),
            'methods_used': 4
        }

        return {
            'gbm': gbm,
            'antithetic': antithetic,
            'stratified': stratified,
            'black_scholes': bs_result,
            'ito_lemma': ito_result,
            'taylor_expansion': taylor,
            'integration': integration,
            'confidence_interval': ci,
            'combined_prediction': combined,
        }

    # ── Main orchestration ────────────────────────────────────────────────

    def predict(self) -> IXICPredictionResult:
        result = IXICPredictionResult(
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            ticker=self.config.ticker,
        )

        # 1. Fetch live data
        df = self._fetch_history()
        if df is not None and not df.empty:
            self._seed_config_from_history(df)
            result.data_source = "live"
        else:
            result.data_source = "default"

        # Normalise DataFrame for downstream use
        df_lower: Optional[pd.DataFrame] = None
        if df is not None and not df.empty:
            df_lower = df.copy()
            df_lower.columns = [c.lower() for c in df_lower.columns]

        S0 = self.config.current_price
        T = self._compute_time_to_target()

        # 2. OHLCV snapshot
        ohlcv = _compute_ohlcv(df) if df is not None else OHLCVSnapshot()
        result.ohlcv = ohlcv.to_dict()

        # 3. Technical indicators
        indicators = _compute_indicators(df) if df is not None else IndicatorSet()
        result.indicators = indicators.to_dict()

        # 4. Zone classification (S/R)
        zone_result = None
        if _ZONES_AVAILABLE and df is not None:
            try:
                zone_result = zones_classify(self.config.ticker, df)
                result.zone = zone_result.to_dict()
            except Exception:
                result.zone = {}
        else:
            result.zone = {}

        # 5. S/R level projections
        sr_levels = _compute_sr_levels(ohlcv, indicators, zone_result)
        result.sr_levels = [lvl.to_dict() for lvl in sr_levels]

        # 6. Active pattern overlays
        result.active_patterns = _collect_active_patterns(df_lower)

        # 7. Dominant cycles (Fourier)
        if df_lower is not None and len(df_lower) >= 20:
            closes = df_lower["close"].dropna().to_numpy(dtype=float)
            try:
                result.dominant_cycles = self.fourier.extract_dominant_cycles(closes, n_cycles=3)
                # Convert numpy floats for JSON serialisation
                for cyc in result.dominant_cycles:
                    for k in cyc:
                        cyc[k] = float(cyc[k])
            except Exception:
                result.dominant_cycles = []

        # 8. Stochastic / calculus simulations
        sim = self._run_simulations(S0, T)
        result.gbm = sim['gbm']
        result.antithetic = sim['antithetic']
        result.stratified = sim['stratified']
        result.black_scholes = sim['black_scholes']
        result.ito_lemma = sim['ito_lemma']
        result.taylor_expansion = sim['taylor_expansion']
        result.integration = sim['integration']
        result.confidence_interval = sim['confidence_interval']

        # 9. Tensor / Neural pipeline (HOSVD, Kalman, Haar, regimes, VaR, stats)
        closes_arr: Optional[np.ndarray] = None
        if df_lower is not None and len(df_lower) >= 32:
            closes_arr = df_lower["close"].dropna().to_numpy(dtype=float)
        else:
            # Synthetic fallback: seed a plausible price series around S0
            rng = np.random.default_rng(self.config.random_seed or 42)
            closes_arr = S0 * np.exp(
                np.cumsum(rng.normal(0, self.config.volatility / np.sqrt(252), 60))
            )
            closes_arr = np.concatenate([[S0], closes_arr])

        tensor_out = self._run_tensor_pipeline(closes_arr)
        result.tensor_signal = tensor_out.get("tensor_signal", {})
        result.tensor_forecast = tensor_out.get("tensor_forecast", {})
        result.tensor_regime = tensor_out.get("tensor_regime", {})
        result.tensor_statistics = tensor_out.get("tensor_statistics", {})
        result.tensor_var = tensor_out.get("tensor_var", {})
        result.tensor_feature_importance = tensor_out.get("tensor_feature_importance", [])
        result.haar_wavelet = tensor_out.get("haar_wavelet", {})

        # 10. GPU-accelerated dispatch
        mu_step = self.config.drift / (self.config.trading_days * self.config.minutes_per_day)
        sigma_step = self.config.volatility / np.sqrt(self.config.trading_days * self.config.minutes_per_day)
        gpu_out = self._run_gpu_dispatch(closes_arr, mu_step, sigma_step)
        result.gpu_backend = gpu_out.get("gpu_backend", "cpu")
        result.gpu_mc_forecast = gpu_out.get("gpu_mc_forecast", {})

        # 11. Complex analysis (characteristic function, Gil-Pelaez, FFT)
        result.complex_analysis = self._run_complex_analysis(S0, T)

        # 12. Combined (weighted ensemble) – now includes tensor + GPU MC
        prediction_sources = [
            sim['gbm']['mean'],
            sim['antithetic']['mean'],
            sim['stratified']['mean'],
            sim['integration']['analytical_expected'],
        ]
        methods_used = 4
        if result.tensor_forecast.get("mean_target"):
            prediction_sources.append(result.tensor_forecast["mean_target"])
            methods_used += 1
        if result.gpu_mc_forecast.get("mean"):
            prediction_sources.append(result.gpu_mc_forecast["mean"])
            methods_used += 1
        result.combined_prediction = {
            'mean': float(np.mean(prediction_sources)),
            'std': float(np.std(prediction_sources)),
            'methods_used': methods_used,
        }

        # 13. Persist to dbs/ via DataStore
        self._persist(result)

        return result

    def _persist(self, result: IXICPredictionResult) -> None:
        """Write result to dbs/ DataStore and update dbs/files.json manifest."""
        if not _YF_OPS_AVAILABLE:
            return
        try:
            store = YFDataStore(db_path=str(_DBS_DIR / "ixic_1pm.db"))
            key = f"ixic_1pm_{result.timestamp}"
            store.set(key, json.dumps(result.to_dict(), default=str))
        except Exception:
            pass

        # Update dbs/files.json manifest
        manifest_path = _DBS_DIR / "files.json"
        try:
            manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"files": []}
            fname = "ixic_1pm.db"
            if fname not in manifest.get("files", []):
                manifest.setdefault("files", []).append(fname)
            manifest_path.write_text(json.dumps(manifest, indent=2))
        except Exception:
            pass

    # ── Report generation ─────────────────────────────────────────────────

    def generate_report(self, result: IXICPredictionResult) -> str:
        lines = []
        sep = "=" * 72
        lines += [sep, "      IXIC (^IXIC) 1 PM CLOSE PREDICTION REPORT",
                  "      Advanced Calculus, Stochastic & Integrated Systems",
                  sep]
        lines.append(f"\nData Source  : {result.data_source.upper()}")
        lines.append(f"Generated    : {result.timestamp}")
        lines.append(f"Current Price: ${self.config.current_price:>14,.2f}")
        lines.append(f"Volatility σ : {self.config.volatility * 100:>12.2f}%")
        lines.append(f"Drift μ      : {self.config.drift * 100:>12.2f}%")
        lines.append(f"Simulations  : {self.config.simulations:>13,}")

        # ── OHLCV ──────────────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "OHLCV SNAPSHOT", "-" * 72]
        o = result.ohlcv
        for lbl, key in [("Open", "open"), ("High", "high"), ("Low", "low"),
                          ("Close", "close"), ("VWAP", "vwap"),
                          ("ATR-14", "atr_14"), ("RVol-20d", "realized_vol_20d")]:
            val = o.get(key)
            if val is not None and not (isinstance(val, float) and math.isnan(val)):
                lines.append(f"  {lbl:<12}: {val:>14,.4f}")

        # ── Indicators ─────────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "TECHNICAL INDICATORS", "-" * 72]
        ind = result.indicators
        for lbl, key in [
            ("RSI-14", "rsi_14"), ("MACD", "macd_line"), ("MACD Sig", "macd_signal"),
            ("BB %B", "bb_pct_b"), ("BB Width", "bb_width"),
            ("EMA-9", "ema_9"), ("EMA-21", "ema_21"), ("EMA-50", "ema_50"),
            ("SMA-200", "sma_200"), ("Stoch %K", "stoch_k"), ("Stoch %D", "stoch_d"),
            ("Williams %R", "williams_r"), ("ADX", "adx"), ("CCI-20", "cci_20"),
            ("ROC-14", "rate_of_change_14"),
        ]:
            val = ind.get(key)
            if val is not None and not (isinstance(val, float) and math.isnan(val)):
                lines.append(f"  {lbl:<14}: {val:>14.4f}")

        # ── S/R Levels ─────────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "S/R PROJECTIONS", "-" * 72]
        for lvl in result.sr_levels:
            lines.append(
                f"  {lvl['label']:<12} ${lvl['price']:>12,.2f}  "
                f"src={lvl['source']:<10} strength={lvl['strength']:.2f}"
            )

        # ── Active Patterns ────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "ACTIVE PATTERNS", "-" * 72]
        if result.active_patterns:
            for pat in result.active_patterns:
                if "features" in pat:
                    lines.append(f"  extended_calculus: {list(pat['features'].keys())}")
                else:
                    lines.append(
                        f"  {pat['family']:<18} {pat['name']:<28}"
                        f" upper={pat['upper']:,.2f}  lower={pat['lower']:,.2f}"
                    )
        else:
            lines.append("  (none detected — insufficient data)")

        # ── Zone ──────────────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "ZONE CLASSIFICATION", "-" * 72]
        if result.zone:
            for k, v in result.zone.items():
                if v not in (None, False, float("nan")):
                    lines.append(f"  {k:<28}: {v}")
        else:
            lines.append("  (zone data unavailable)")

        # ── Stochastic Simulations ─────────────────────────────────────────
        lines += ["\n" + "-" * 72, "STOCHASTIC SIMULATION RESULTS", "-" * 72]
        lines.append(f"\n  GBM Monte Carlo:")
        lines.append(f"    Mean         : ${result.gbm['mean']:>12,.2f}")
        lines.append(f"    Std Dev      : ${result.gbm['std']:>12,.2f}")
        lines.append(f"    90% Range    : ${result.gbm['p5']:,.2f} – ${result.gbm['p95']:,.2f}")

        lines.append(f"\n  Antithetic Variates:")
        lines.append(f"    Mean         : ${result.antithetic['mean']:>12,.2f}")
        lines.append(f"    Var Reduction: {result.antithetic['variance_reduction']:>12.4f}×")

        lines.append(f"\n  Stratified Sampling:")
        lines.append(f"    Mean         : ${result.stratified['mean']:>12,.2f}")

        lines.append(f"\n  Analytical (Integration):")
        lines.append(f"    Expected     : ${result.integration['analytical_expected']:>12,.2f}")

        lines += ["\n" + sep, "COMBINED PREDICTION (Ensemble)", sep]
        lines.append(f"\n  1 PM Close   : ${result.combined_prediction['mean']:>12,.2f}")
        lines.append(f"  Methods Used : {result.combined_prediction.get('methods_used', 4):>13}")
        lines.append(f"  95% CI       : ${result.confidence_interval['ci_95_lower']:,.2f}"
                     f" – ${result.confidence_interval['ci_95_upper']:,.2f}")

        # ── Greeks ────────────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "BLACK-SCHOLES GREEKS (ATM)", "-" * 72]
        bs = result.black_scholes
        lines.append(f"  Delta        : {bs['delta']:>14.6f}")
        lines.append(f"  Gamma        : {bs['gamma']:>14.8f}")
        lines.append(f"  Theta        : {bs['theta']:>14.4f}")
        lines.append(f"  Vega         : {bs['vega']:>14.4f}")

        # ── Tensor / Neural signal ─────────────────────────────────────────
        lines += ["\n" + "-" * 72, "TENSOR / NEURAL SIGNAL  (tensor.financial + HOSVD)", "-" * 72]
        ts = result.tensor_signal
        if ts:
            lines.append(f"  Tensor Score   : {ts.get('tensor_score', 'n/a'):>12}")
            lines.append(f"  HOSVD Rank k   : {ts.get('hosvd_k', 'n/a'):>12}")
            lines.append(f"  Dominant Regime: {ts.get('regime', 'n/a'):>12}")
            lines.append(f"  Bull Signal    : {ts.get('bull_signal', 'n/a'):>12}")
            lines.append(f"  Kalman Price   : ${ts.get('kalman_price', 0):>11,.4f}")
            lines.append(f"  Kalman Drift   : {ts.get('kalman_drift', 'n/a'):>12}")
        else:
            lines.append("  (tensor.financial unavailable)")

        # ── Tensor Forecast ───────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "TENSOR-ADJUSTED MC FORECAST (20-bar horizon)", "-" * 72]
        tf = result.tensor_forecast
        if tf:
            lines.append(f"  Drift Adjusted : {tf.get('drift_adjusted', 'n/a'):>12}")
            lines.append(f"  Adj Factor     : {tf.get('adj_factor', 'n/a'):>12}")
            lines.append(f"  Target (mean)  : ${tf.get('mean_target', 0) or 0:>11,.4f}")
            lines.append(f"  Target P10     : ${tf.get('p10_target', 0) or 0:>11,.4f}")
            lines.append(f"  Target P90     : ${tf.get('p90_target', 0) or 0:>11,.4f}")
        else:
            lines.append("  (insufficient history for tensor forecast)")

        # ── VaR / CVaR ────────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "VaR / CVaR (historical simulation)", "-" * 72]
        var = result.tensor_var
        if var:
            lines.append(f"  1-Day VaR 95%  : {var.get('var_1d_pct', 'n/a'):>12}%")
            lines.append(f"  1-Day CVaR 95% : {var.get('cvar_1d_pct', 'n/a'):>12}%")
            lines.append(f"  5-Day VaR      : {var.get('var_5d_pct', 'n/a'):>12}%")
            lines.append(f"  10-Day VaR     : {var.get('var_10d_pct', 'n/a'):>12}%")
        else:
            lines.append("  (tensor.financial unavailable)")

        # ── Statistical / Hurst ───────────────────────────────────────────
        lines += ["\n" + "-" * 72, "STATISTICAL ANALYSIS (Hurst, Autocorrelation, Moments)", "-" * 72]
        sts = result.tensor_statistics
        if sts:
            lines.append(f"  Hurst Exponent : {sts.get('hurst_exponent', 'n/a'):>12}")
            lines.append(f"  Annualised Vol : {sts.get('annualised_vol', 'n/a'):>12}")
            lines.append(f"  Skewness       : {sts.get('skewness', 'n/a'):>12}")
            lines.append(f"  Excess Kurtosis: {sts.get('excess_kurtosis', 'n/a'):>12}")
            lags = sts.get("autocorrelation_lags", {})
            for lag_k, lag_v in list(lags.items())[:3]:
                lines.append(f"  Autocorr {lag_k}  : {lag_v:>12.4f}")
        else:
            lines.append("  (tensor.financial unavailable)")

        # ── Haar Wavelet ──────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "HAAR WAVELET (multi-scale trend decomposition)", "-" * 72]
        hw = result.haar_wavelet
        if hw:
            lines.append(f"  Trend Slope    : {hw.get('trend_slope', 'n/a'):>12}")
            lines.append(f"  Energy LF      : {hw.get('energy_low_freq', 'n/a'):>12}")
            lines.append(f"  Energy HF      : {hw.get('energy_high_freq', 'n/a'):>12}")
        else:
            lines.append("  (tensor.financial unavailable)")

        # ── GPU ───────────────────────────────────────────────────────────
        lines += ["\n" + "-" * 72, f"GPU BACKEND: {result.gpu_backend.upper()}", "-" * 72]
        gmc = result.gpu_mc_forecast
        if gmc:
            lines.append(f"  GPU MC Mean    : ${gmc.get('mean', 0):>11,.4f}")
            lines.append(f"  GPU MC P5      : ${gmc.get('p5', 0):>11,.4f}")
            lines.append(f"  GPU MC P95     : ${gmc.get('p95', 0):>11,.4f}")
            lines.append(f"  GPU MC Paths   : {gmc.get('n_paths', 0):>12,}")
        else:
            lines.append("  (GPU MC forecast fell back to CPU or not run)")

        # ── Complex Analysis ─────────────────────────────────────────────
        lines += ["\n" + "-" * 72, "COMPLEX ANALYSIS (Characteristic Function + FFT)", "-" * 72]
        ca = result.complex_analysis
        if ca:
            gp = ca.get("gil_pelaez", {})
            if gp:
                lines.append(f"  P(S_T > S0)    : {gp.get('P(S_T > S0)', 'n/a'):>12}")
            dist = ca.get("distribution", {})
            if dist:
                lines.append(f"  E[S_T]         : ${dist.get('E[S_T]', 0):>11,.4f}")
                lines.append(f"  StdDev[S_T]    : ${dist.get('StdDev[S_T]', 0):>11,.4f}")
            cf_fft = ca.get("carr_madan_fft", {})
            if cf_fft.get("atm_call_price") is not None:
                lines.append(f"  ATM Call (FFT) : ${cf_fft['atm_call_price']:>11,.4f}")
        else:
            lines.append("  (complex analysis unavailable)")

        lines.append("\n" + sep)
        return "\n".join(lines)


# ============================================================================
# VISUALIZATION
# ============================================================================

def create_visualization(result: IXICPredictionResult, config: MarketConfig, output_path: str) -> None:
    """Multi-panel prediction dashboard for the IXIC 1 PM engine."""
    fig = plt.figure(figsize=(18, 11))
    fig.patch.set_facecolor('#0D1117')
    gs = GridSpec(3, 3, figure=fig, hspace=0.40, wspace=0.35)

    bg = '#0D1117'
    txt = '#C9D1D9'
    green = '#3FB950'
    blue = '#58A6FF'
    purple = '#BC8CFF'
    red = '#F85149'
    orange = '#E3B341'

    # ── Panel 1: Price Distribution (row 0, col 0-1) ─────────────────────
    ax1 = fig.add_subplot(gs[0, :2])
    ax1.set_facecolor(bg)
    np.random.seed(config.random_seed)
    sample_prices = np.random.normal(
        result.combined_prediction['mean'],
        result.gbm['std'],
        10000
    )
    ax1.hist(sample_prices, bins=80, color=purple, alpha=0.75, edgecolor='black')
    ax1.axvline(result.combined_prediction['mean'], color=green, lw=2, ls='--',
                label=f"Mean ${result.combined_prediction['mean']:,.0f}")
    ax1.axvline(result.confidence_interval['ci_95_lower'], color=blue, lw=1.5, ls=':',
                label=f"CI Lower ${result.confidence_interval['ci_95_lower']:,.0f}")
    ax1.axvline(result.confidence_interval['ci_95_upper'], color=red, lw=1.5, ls=':',
                label=f"CI Upper ${result.confidence_interval['ci_95_upper']:,.0f}")
    ax1.set_title("IXIC 1 PM – Price Distribution", color=txt, fontsize=13, fontweight='bold')
    ax1.set_xlabel("Price ($)", color=txt)
    ax1.set_ylabel("Frequency", color=txt)
    ax1.legend(facecolor=bg, labelcolor=txt)
    ax1.tick_params(colors=txt)
    ax1.grid(color='#21262D', alpha=0.6)

    # ── Panel 2: Greeks Radar (row 0, col 2) ─────────────────────────────
    ax2 = fig.add_subplot(gs[0, 2], projection='polar')
    ax2.set_facecolor(bg)
    greeks_lbl = ['Δ Delta', 'Γ×1k', '|Θ|', 'ν Vega']
    bs = result.black_scholes
    values = [bs['delta'], bs['gamma'] * 1000, abs(bs['theta']), bs['vega']]
    max_val = max(max(v for v in values if not math.isnan(v)), 1.0)
    values_norm = [v / max_val for v in values] + [values[0] / max_val]
    angles = np.linspace(0, 2 * np.pi, len(greeks_lbl), endpoint=False).tolist()
    angles.append(angles[0])
    ax2.fill(angles, values_norm, color=purple, alpha=0.25)
    ax2.plot(angles, values_norm, color=green, lw=2)
    ax2.set_xticks(angles[:-1])
    ax2.set_xticklabels(greeks_lbl, color=txt, fontsize=9)
    ax2.set_title("Black-Scholes Greeks", color=txt, fontsize=11, pad=18)

    # ── Panel 3: Method Comparison (row 1, col 0) ────────────────────────
    ax3 = fig.add_subplot(gs[1, 0])
    ax3.set_facecolor(bg)
    methods = ['GBM', 'Antithetic', 'Stratified', 'Analytical', 'Taylor']
    means = [
        result.gbm['mean'],
        result.antithetic['mean'],
        result.stratified['mean'],
        result.integration['analytical_expected'],
        result.taylor_expansion['price'],
    ]
    bar_colors = [green, blue, purple, red, orange]
    bars = ax3.bar(methods, means, color=bar_colors, alpha=0.85)
    ax3.axhline(result.combined_prediction['mean'], color=txt, ls='--', lw=1.5, label='Ensemble')
    ax3.set_title("Method Comparison", color=txt, fontsize=11, fontweight='bold')
    ax3.set_ylabel("Price ($)", color=txt)
    ax3.tick_params(colors=txt, labelrotation=30)
    ax3.grid(color='#21262D', alpha=0.5, axis='y')
    for bar, val in zip(bars, means):
        ax3.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + config.current_price * 0.0002,
                 f'${val:,.0f}', ha='center', va='bottom', color=txt, fontsize=8)

    # ── Panel 4: S/R Levels bar (row 1, col 1) ───────────────────────────
    ax4 = fig.add_subplot(gs[1, 1])
    ax4.set_facecolor(bg)
    sr = result.sr_levels
    if sr:
        sr_prices = [s['price'] for s in sr]
        sr_labels = [s['label'] for s in sr]
        sr_strengths = [s['strength'] for s in sr]
        # Only show 12 levels for clarity
        mid = len(sr_prices) // 2
        idx_range = list(range(max(0, mid - 6), min(len(sr_prices), mid + 6)))
        sr_prices_ = [sr_prices[i] for i in idx_range]
        sr_labels_ = [sr_labels[i] for i in idx_range]
        sr_strengths_ = [sr_strengths[i] for i in idx_range]
        ax4.barh(sr_labels_, sr_prices_, color=[green if p >= config.current_price else red
                                                  for p in sr_prices_], alpha=0.75)
        ax4.axvline(config.current_price, color=orange, lw=1.5, ls='--', label='Current')
    ax4.set_title("S/R Projections", color=txt, fontsize=11, fontweight='bold')
    ax4.set_xlabel("Price ($)", color=txt)
    ax4.tick_params(colors=txt)
    ax4.grid(color='#21262D', alpha=0.4, axis='x')

    # ── Panel 5: Indicators heatmap (row 1, col 2) ───────────────────────
    ax5 = fig.add_subplot(gs[1, 2])
    ax5.set_facecolor(bg)
    ax5.axis('off')
    ind = result.indicators
    ind_lines = [
        f"RSI-14    : {ind.get('rsi_14', float('nan')):.1f}" if not math.isnan(ind.get('rsi_14', float('nan'))) else "RSI-14    : n/a",
        f"MACD      : {ind.get('macd_line', float('nan')):.2f}" if not math.isnan(ind.get('macd_line', float('nan'))) else "MACD      : n/a",
        f"BB %B     : {ind.get('bb_pct_b', float('nan')):.2f}" if not math.isnan(ind.get('bb_pct_b', float('nan'))) else "BB %B     : n/a",
        f"Stoch %K  : {ind.get('stoch_k', float('nan')):.1f}" if not math.isnan(ind.get('stoch_k', float('nan'))) else "Stoch %K  : n/a",
        f"ADX       : {ind.get('adx', float('nan')):.1f}" if not math.isnan(ind.get('adx', float('nan'))) else "ADX       : n/a",
        f"CCI-20    : {ind.get('cci_20', float('nan')):.1f}" if not math.isnan(ind.get('cci_20', float('nan'))) else "CCI-20    : n/a",
        f"ROC-14    : {ind.get('rate_of_change_14', float('nan')):.2f}%" if not math.isnan(ind.get('rate_of_change_14', float('nan'))) else "ROC-14    : n/a",
    ]
    ax5.text(0.05, 0.95, "\n".join(ind_lines), transform=ax5.transAxes, fontsize=10,
             verticalalignment='top', color=green, fontfamily='monospace')
    ax5.set_title("Indicators", color=txt, fontsize=11, fontweight='bold')

    # ── Panel 6: Active Patterns (row 2, col 0) ──────────────────────────
    ax6 = fig.add_subplot(gs[2, 0])
    ax6.set_facecolor(bg)
    ax6.axis('off')
    pat_lines = []
    for pat in result.active_patterns[:5]:
        if "features" in pat:
            pat_lines.append(f"  ext_calc  {list(pat['features'].keys())[:3]}")
        else:
            pat_lines.append(
                f"  {pat['family']:<16}  {pat['name']:<22}"
            )
    if not pat_lines:
        pat_lines = ["  (no active patterns)"]
    ax6.text(0.02, 0.95, "ACTIVE PATTERNS\n" + "\n".join(pat_lines),
             transform=ax6.transAxes, fontsize=9, va='top', color=orange, fontfamily='monospace')

    # ── Panel 7: Tensor Regime radar (row 2, col 1) ──────────────────────
    ax7 = fig.add_subplot(gs[2, 1])
    ax7.set_facecolor(bg)
    ax7.axis('off')
    ts = result.tensor_signal
    tf = result.tensor_forecast
    hw = result.haar_wavelet
    sts = result.tensor_statistics
    tensor_lines = ["TENSOR / NEURAL SIGNAL"]
    if ts:
        tensor_lines += [
            f"  Score  : {ts.get('tensor_score', 'n/a')}",
            f"  Regime : {ts.get('regime', 'n/a')}",
            f"  HOSVD k: {ts.get('hosvd_k', 'n/a')}",
            f"  Kalman : ${ts.get('kalman_price', 0):>10,.2f}",
            f"  Signal : {ts.get('bull_signal', 'n/a')}",
        ]
    else:
        tensor_lines.append("  (unavailable)")
    tensor_lines.append("HAAR WAVELET")
    if hw:
        tensor_lines += [
            f"  Slope  : {hw.get('trend_slope', 'n/a')}",
            f"  LF Nrg : {hw.get('energy_low_freq', 'n/a')}",
        ]
    if sts:
        tensor_lines += [
            "STATISTICS",
            f"  Hurst  : {sts.get('hurst_exponent', 'n/a')}",
            f"  Ann.Vol: {sts.get('annualised_vol', 'n/a')}",
        ]
    ax7.text(0.02, 0.97, "\n".join(tensor_lines), transform=ax7.transAxes, fontsize=8,
             va='top', color=blue, fontfamily='monospace')

    # ── Panel 8: Statistics / GPU summary (row 2, col 2) ─────────────────
    ax8 = fig.add_subplot(gs[2, 2])
    ax8.set_facecolor(bg)
    ax8.axis('off')
    gmc = result.gpu_mc_forecast
    ca = result.complex_analysis
    stats_txt = (
        f"IXIC 1PM ENSEMBLE\n"
        f"{'─'*28}\n"
        f"Current : ${config.current_price:>10,.2f}\n"
        f"Predict : ${result.combined_prediction['mean']:>10,.2f}\n"
        f"Change  : ${result.combined_prediction['mean'] - config.current_price:>+10,.2f}\n"
        f"Methods : {result.combined_prediction.get('methods_used', 4):>10}\n"
        f"{'─'*28}\n"
        f"95% Low : ${result.confidence_interval['ci_95_lower']:>10,.2f}\n"
        f"95% Hi  : ${result.confidence_interval['ci_95_upper']:>10,.2f}\n"
        f"{'─'*28}\n"
        f"GPU     : {result.gpu_backend.upper():>10}\n"
    )
    if gmc:
        stats_txt += f"GPU MC  : ${gmc.get('mean', 0):>10,.2f}\n"
    if ca and ca.get("distribution"):
        dist = ca["distribution"]
        stats_txt += f"E[S_T]  : ${dist.get('E[S_T]', 0):>10,.2f}\n"
    stats_txt += (
        f"{'─'*28}\n"
        f"σ       : {config.volatility * 100:>9.2f}%\n"
        f"μ       : {config.drift * 100:>9.2f}%\n"
        f"N sims  : {config.simulations:>10,}\n"
        f"Source  : {result.data_source.upper():>10}\n"
    )
    ax8.text(0.05, 0.97, stats_txt, transform=ax8.transAxes, fontsize=8,
             va='top', color=green, fontfamily='monospace')

    fig.suptitle("IXIC 1 PM Close Prediction Dashboard", color=txt, fontsize=15,
                 fontweight='bold', y=0.99)
    plt.savefig(output_path, dpi=150, facecolor=bg, edgecolor='none', bbox_inches='tight')
    plt.close(fig)
    print(f"Visualization saved to: {output_path}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Entry point – reads environment variables, runs prediction, saves output."""

    def _float(name: str, default: float, lo: float = None, hi: float = None) -> float:
        try:
            v = float(os.environ.get(name, default))
            if lo is not None and v < lo:
                v = lo
            if hi is not None and v > hi:
                v = hi
            return v
        except (ValueError, TypeError):
            return default

    def _int(name: str, default: int, lo: int = 1, hi: int = None) -> int:
        try:
            v = int(os.environ.get(name, default))
            if v < lo:
                v = lo
            if hi is not None and v > hi:
                v = hi
            return v
        except (ValueError, TypeError):
            return default

    config = MarketConfig(
        current_price=_float('IXIC_PRICE', 19000.00, lo=0.01),
        volatility=_float('VOLATILITY', 0.18, lo=0.001, hi=5.0),
        drift=_float('DRIFT', 0.06, lo=-1.0, hi=1.0),
        simulations=_int('SIMULATIONS', 10000, lo=100, hi=1_000_000),
        random_seed=_int('RANDOM_SEED', 42, lo=0),
        history_period=os.environ.get('HISTORY_PERIOD', '60d'),
    )

    predictor = IXIC1PMPredictor(config)

    print("Running IXIC 1 PM prediction (integrated: yfinance, zones, patterns, indicators)…")
    result = predictor.predict()

    # Console report
    report = predictor.generate_report(result)
    print(report)

    # Visualization
    out_dir = Path(__file__).resolve().parent
    png_path = str(out_dir / 'ixic_1pm_prediction.png')
    create_visualization(result, config, png_path)

    # JSON output
    json_path = str(out_dir / 'prediction_results.json')

    def _clean(obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.integer, np.floating)):
            return float(obj)
        if isinstance(obj, float) and math.isnan(obj):
            return None
        if isinstance(obj, dict):
            return {k: _clean(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_clean(v) for v in obj]
        return obj

    with open(json_path, 'w') as fh:
        json.dump(_clean(result.to_dict()), fh, indent=2, default=str)
    print(f"Results saved to: {json_path}")

    return result


if __name__ == "__main__":
    main()
