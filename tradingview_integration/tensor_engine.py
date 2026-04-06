#!/usr/bin/env python3
"""
JINXAI Tensor Forecast Engine — Server-Side  (Extended Edition)
T ∈ R^(n × m × p):  Time (lookback) × Features × Regime States

Pipeline:
  1.  Build Feature Matrix      F ∈ R^(n × m)           8 features
  2.  Tensor Core via Covariance C = FᵀF / n ∈ R^(m × m)
  3.  Adaptive HOSVD             rank-k SVD truncation (auto-selected)
  4.  Kalman Filter Smoother     state-space price/drift estimation
  5.  Five-Regime Classification P ∈ R^(n × 5)  via softmax
  6.  Tensor Contraction         scalar score + per-bar regime signal
  7.  Monte Carlo Forecast       N_MC paths → mean + percentile bands
  8.  Cross-Feature Importance   Shapley-style weight attribution
  9.  Wavelet-Inspired Trend     Haar multi-scale decomposition (3-level)
  10. Rolling Tensor Signal      historical overlay per bar

Output:
  tradingview_integration/data/tensor_forecast.json
  Consumed by tradingview_integration/index.html Lightweight Charts overlay.
"""
from __future__ import annotations

import json
import math
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=RuntimeWarning)

# ── Hyperparameters ────────────────────────────────────────────────────────────
LOOKBACK   = 30     # n — time axis (bars in feature matrix)
FEATURES   = 8      # m — extended feature set
REGIMES    = 5      # p — [strong_bull, bull, neutral, bear, strong_bear]
HORIZON    = 20     # k — forecast bars ahead
HOSVD_K    = 3      # base singular-value retention (adaptive override below)
N_MC       = 400    # Monte Carlo path count
MC_SEED    = 42     # reproducible RNG seed for MC

# Feature weights w ∈ R^m  (must sum to 1 for interpretable score)
W_FEAT = np.array([0.22, 0.18, 0.14, 0.12, 0.10, 0.10, 0.08, 0.06])

# Kalman process / observation noise
KALMAN_Q = 1e-4     # process noise covariance
KALMAN_R = 1e-2     # observation noise covariance

# Haar wavelet levels
HAAR_LEVELS = 3

ROOT = Path(__file__).resolve().parent
CSV  = ROOT / "data" / "sample_data.csv"
OUT  = ROOT / "data" / "tensor_forecast.json"

# Regime labels (5-class)
REGIME_LABELS = ["STRONG_BULL", "BULL", "NEUT", "BEAR", "STRONG_BEAR"]


# ─────────────────────────────────────────────────────────────────────────────
# 1. FEATURE MATRIX  F ∈ R^(n × 8)
# ─────────────────────────────────────────────────────────────────────────────

def build_feature_matrix(prices: np.ndarray) -> np.ndarray:
    """
    Build extended 8-feature matrix from the last LOOKBACK bars of `prices`.

    Column layout  (m = FEATURES = 8):
      0  Price z-score          (close − μ) / σ
      1  Log returns            Δlog(close)
      2  Rolling 5-bar realised vol  normalised [0,1]
      3  Momentum               (close − rolling_mean) / |max_momentum|
      4  Rate of change %       (close[i] − close[i-5]) / close[i-5]
      5  Upper shadow ratio     (high − max(open,close)) / ATR  (proxied)
      6  Lower shadow ratio     (min(open,close) − low) / ATR   (proxied)
      7  Mean-reversion score   -(z-score) normalised to [-1, 1]
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


# ─────────────────────────────────────────────────────────────────────────────
# 2. TENSOR CORE + ADAPTIVE HOSVD
# ─────────────────────────────────────────────────────────────────────────────

def _adaptive_hosvd_rank(S: np.ndarray, energy_threshold: float = 0.90) -> int:
    """
    Select the minimum rank k that retains ≥ energy_threshold of total
    singular-value energy.  Clamps to [1, len(S)].
    """
    total = S.sum()
    if total <= 0:
        return max(1, HOSVD_K)
    cumulative = np.cumsum(S) / total
    candidates = np.where(cumulative >= energy_threshold)[0]
    return int(candidates[0]) + 1 if len(candidates) else len(S)


def tensor_decompose(
    F: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, int]:
    """
    Tensor Core:  C = FᵀF / n, then adaptive HOSVD denoising.

    Steps:
      C      = FᵀF / n                (covariance [m × m])
      U,S,Vt = SVD(C)                 (eigendecomposition)
      k_opt  = adaptive rank           (90% energy threshold)
      S_den  = truncate S to top-k_opt
      C_den  = U diag(S_den) Vt       (denoised covariance)
      F_den  = F · C_den              (denoised feature matrix)

    Returns: (U, S_full, F_denoised, k_used)
    """
    n = F.shape[0]
    C = F.T @ F / n                                    # [m × m]
    U, S, Vt = np.linalg.svd(C, full_matrices=False)

    k_opt = _adaptive_hosvd_rank(S)
    S_den = S.copy()
    S_den[k_opt:] = 0.0
    C_den = U @ np.diag(S_den) @ Vt

    F_den = F @ C_den
    return U, S, F_den, k_opt


# ─────────────────────────────────────────────────────────────────────────────
# 3. KALMAN FILTER SMOOTHER  →  kalman_price, kalman_drift
# ─────────────────────────────────────────────────────────────────────────────

def kalman_filter(prices: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    1-D Kalman filter for price and drift estimation.

    State vector: [price, drift]
    Transition:   price_{t+1} = price_t + drift_t
                  drift_{t+1} = drift_t          (random walk)
    Observation:  z_t = price_t + noise

    Returns:
      smoothed_prices  shape [n]
      smoothed_drifts  shape [n]
    """
    n  = len(prices)
    x  = np.array([prices[0], 0.0])          # initial state
    P  = np.eye(2) * 1.0                      # initial covariance

    A  = np.array([[1.0, 1.0], [0.0, 1.0]])  # transition
    H  = np.array([[1.0, 0.0]])               # observation
    Q  = np.eye(2) * KALMAN_Q                 # process noise
    R  = np.array([[KALMAN_R]])               # observation noise

    smoothed_prices = np.zeros(n)
    smoothed_drifts = np.zeros(n)

    for t in range(n):
        # Predict
        x_pred = A @ x
        P_pred = A @ P @ A.T + Q

        # Update
        S_k = H @ P_pred @ H.T + R
        K   = P_pred @ H.T @ np.linalg.inv(S_k)
        y   = prices[t] - H @ x_pred          # innovation
        x   = x_pred + K.flatten() * y.item()
        P   = (np.eye(2) - K @ H) @ P_pred

        smoothed_prices[t] = x[0]
        smoothed_drifts[t] = x[1]

    return smoothed_prices, smoothed_drifts


# ─────────────────────────────────────────────────────────────────────────────
# 4. HAAR WAVELET MULTI-SCALE DECOMPOSITION  (3-level)
# ─────────────────────────────────────────────────────────────────────────────

def _haar_level(signal: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """One level of the Haar discrete wavelet transform."""
    n  = len(signal) // 2 * 2          # round down to even
    s  = signal[:n]
    lo = (s[0::2] + s[1::2]) / math.sqrt(2)   # approximation
    hi = (s[0::2] - s[1::2]) / math.sqrt(2)   # detail
    return lo, hi


def haar_decompose(prices: np.ndarray, levels: int = HAAR_LEVELS) -> dict:
    """
    Multi-scale Haar decomposition of the price series.

    Returns a dict with:
      'approx'   — lowest-frequency approximation (trend)
      'details'  — list of detail coefficient arrays per level
      'trend_slope' — linear slope of the approximation component
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


# ─────────────────────────────────────────────────────────────────────────────
# 5. FIVE-REGIME CLASSIFICATION  P ∈ R^(n × 5)  via softmax
# ─────────────────────────────────────────────────────────────────────────────

def classify_regimes_5(F_den: np.ndarray) -> np.ndarray:
    """
    Five-class softmax regime classifier.

    Logit construction:
      strong_bull  = return_score * 100
      bull         = return_score *  40
      neutral      = 0
      bear         = return_score * -40
      strong_bear  = return_score * -100

    Returns P  shape [n, 5]  columns: [p_sbull, p_bull, p_neut, p_bear, p_sbear]
    """
    rets   = F_den[:, 1]
    scales = np.array([100.0, 40.0, 0.0, -40.0, -100.0])
    logits = np.outer(rets, scales)                          # [n × 5]
    logits -= logits.max(axis=1, keepdims=True)
    e  = np.exp(logits)
    P  = e / e.sum(axis=1, keepdims=True)
    return P


# ─────────────────────────────────────────────────────────────────────────────
# 6. TENSOR CONTRACTION  →  scalar score + per-bar regime signal
# ─────────────────────────────────────────────────────────────────────────────

def tensor_contract(
    F: np.ndarray, F_den: np.ndarray
) -> tuple[float, np.ndarray, np.ndarray]:
    """
    Scalar tensor score = w · C[0, :]  (feature weights dotted with price row).
    Returns: (tensor_score, regime_signal [n], P [n × 5])
    """
    n = F.shape[0]
    m = min(F.shape[1], len(W_FEAT))
    C = F.T @ F / n                                       # [m × m]
    score_vec = C[0, :m]
    tensor_score = float(W_FEAT[:m] @ score_vec)

    P = classify_regimes_5(F_den)
    regime_wts  = np.array([2.0, 1.0, 0.0, -1.0, -2.0])  # 5-class signal
    signal_bars = P @ regime_wts                           # [n]

    return tensor_score, signal_bars, P


# ─────────────────────────────────────────────────────────────────────────────
# 7. CROSS-FEATURE IMPORTANCE (Shapley-style leave-one-out)
# ─────────────────────────────────────────────────────────────────────────────

def feature_importance(F: np.ndarray) -> list[dict]:
    """
    Estimate feature importance via leave-one-out covariance score delta.

    For each feature j:
      score_full  = w · C[0, :]
      score_loo   = score with column j of F zeroed out
      importance  = |score_full − score_loo|  / (Σ|deltas| + ε)
    """
    n = F.shape[0]
    m = F.shape[1]

    C_full = F.T @ F / n
    score_full = float(W_FEAT[:m] @ C_full[0, :m])

    deltas = []
    for j in range(m):
        F_loo = F.copy()
        F_loo[:, j] = 0.0
        C_loo = F_loo.T @ F_loo / n
        s_loo = float(W_FEAT[:m] @ C_loo[0, :m])
        deltas.append(abs(score_full - s_loo))

    total = sum(deltas) + 1e-9
    feature_names = [
        "price_zscore", "log_return", "realised_vol", "momentum",
        "rate_of_change", "upper_shadow", "lower_shadow", "mean_reversion",
    ]
    return [
        {
            "feature":    feature_names[j] if j < len(feature_names) else f"f{j}",
            "weight":     round(W_FEAT[j] if j < len(W_FEAT) else 0.0, 4),
            "importance": round(float(deltas[j] / total), 4),
            "delta":      round(float(deltas[j]), 6),
        }
        for j in range(m)
    ]


# ─────────────────────────────────────────────────────────────────────────────
# 8. HOSVD-SMOOTHED DRIFT  →  scalar
# ─────────────────────────────────────────────────────────────────────────────

def smooth_drift(
    prices: np.ndarray, F: np.ndarray, kalman_drifts: np.ndarray
) -> tuple[float, float]:
    """
    Blend HOSVD-denoised drift with Kalman drift estimate.

    noise_floor  = mean absolute off-diagonal covariance
    alpha        = soft-shrinkage ∈ [0, 1]
    smooth       = α · raw_drift + (1 − α) · kalman_drift
    """
    C           = F.T @ F / LOOKBACK
    off_diag    = np.abs(C[0, 1:]).mean()
    diag_trace  = np.diag(C).sum() + 1e-9
    alpha       = max(0.0, 1.0 - off_diag / diag_trace)

    raw_drift    = float((prices[-1] - prices[-LOOKBACK]) / LOOKBACK)
    kalman_drift = float(kalman_drifts[-1])
    smooth       = alpha * raw_drift + (1.0 - alpha) * kalman_drift

    return smooth, alpha


# ─────────────────────────────────────────────────────────────────────────────
# 9. MONTE CARLO FORECAST  →  mean path + percentile bands
# ─────────────────────────────────────────────────────────────────────────────

def monte_carlo_forecast(
    prices: np.ndarray,
    tensor_score: float,
    sigma_hist: float,
    drift: float,
    haar_slope: float,
) -> dict:
    """
    Generate N_MC price paths using a drift-diffusion model with tensor
    adjustment and Haar trend bias.

      μ_adj   = drift × (1 + ½·tanh(score)) + haar_slope × 0.1
      σ_step  = sigma_hist / √252
      p_{t+k} = p_t × exp((μ_adj − ½σ²)·δt + σ·√δt·ε)   ε ~ N(0,1)

    Returns:
      mean, p10, p25, p75, p90 forecast vectors of length HORIZON
    """
    rng     = np.random.default_rng(MC_SEED)
    last    = float(prices[-1])
    adj_f   = 1.0 + 0.5 * math.tanh(tensor_score)
    mu_adj  = drift * adj_f + haar_slope * 0.1
    sigma_s = sigma_hist / math.sqrt(252.0) + 1e-9

    dt  = 1.0
    eps = rng.standard_normal((N_MC, HORIZON))        # [paths × steps]

    paths = np.zeros((N_MC, HORIZON))
    for k in range(HORIZON):
        if k == 0:
            prev = last
        else:
            prev = paths[:, k - 1]
        step_eps = eps[:, k]
        paths[:, k] = (
            (prev if k == 0 else prev)
            + mu_adj * dt
            + sigma_s * math.sqrt(dt) * step_eps
        )

    # Re-compute properly using previous column
    paths2 = np.zeros((N_MC, HORIZON))
    paths2[:, 0] = last + mu_adj * dt + sigma_s * math.sqrt(dt) * eps[:, 0]
    for k in range(1, HORIZON):
        paths2[:, k] = (
            paths2[:, k - 1]
            + mu_adj * dt
            + sigma_s * math.sqrt(dt) * eps[:, k]
        )

    mean_fc = np.mean(paths2, axis=0)
    p10_fc  = np.percentile(paths2, 10, axis=0)
    p25_fc  = np.percentile(paths2, 25, axis=0)
    p75_fc  = np.percentile(paths2, 75, axis=0)
    p90_fc  = np.percentile(paths2, 90, axis=0)

    _r = lambda a: [round(float(v), 4) for v in a]
    return {
        "last_price":   round(last, 4),
        "drift":        round(mu_adj, 6),
        "adj_factor":   round(adj_f, 6),
        "sigma_step":   round(sigma_s, 6),
        "sigma_hist":   round(sigma_hist, 6),
        "haar_slope":   round(haar_slope, 6),
        "n_paths":      N_MC,
        "horizon":      HORIZON,
        "forecast":     _r(mean_fc),
        "p10_band":     _r(p10_fc),
        "p25_band":     _r(p25_fc),
        "p75_band":     _r(p75_fc),
        "p90_band":     _r(p90_fc),
        # Legacy keys kept for backwards-compat with index.html
        "upper_band":   _r(p90_fc),
        "lower_band":   _r(p10_fc),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 10. HISTORICAL ROLLING TENSOR SIGNAL
# ─────────────────────────────────────────────────────────────────────────────

def rolling_tensor_signal(prices: np.ndarray) -> list[dict]:
    """
    Compute per-bar tensor_score, dominant regime, and Kalman drift for every
    available bar.  Used for the historical overlay on the chart.
    """
    results = []
    kp, kd  = kalman_filter(prices)    # smooth full series once

    for end in range(LOOKBACK, len(prices)):
        w          = prices[end - LOOKBACK: end]
        F          = build_feature_matrix(w)
        _, _, Fd, k_used = tensor_decompose(F)
        score, _, P = tensor_contract(F, Fd)
        last_p     = P[-1]
        dom        = int(np.argmax(last_p))
        results.append({
            "tensor_score":   round(score, 6),
            "p_strong_bull":  round(float(last_p[0]), 4),
            "p_bull":         round(float(last_p[1]), 4),
            "p_neut":         round(float(last_p[2]), 4),
            "p_bear":         round(float(last_p[3]), 4),
            "p_strong_bear":  round(float(last_p[4]), 4),
            "regime":         REGIME_LABELS[dom],
            "signal":         round(float(last_p[0] + last_p[1] * 0.5
                                         - last_p[3] * 0.5 - last_p[4]), 4),
            "kalman_price":   round(float(kp[end - 1]), 4),
            "kalman_drift":   round(float(kd[end - 1]), 6),
            "hosvd_k":        k_used,
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 11. CROSS-ASSET CORRELATION SKELETON
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


def cross_asset_summary(prices: np.ndarray) -> dict[str, Any]:
    """
    Compute self-autocorrelation and partial-autocorrelation at lags 1-5.
    In a multi-asset deployment the caller would pass additional series;
    here we expose the interface with single-asset lag structure.
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


def _hurst_exponent(series: np.ndarray) -> float:
    """
    Simplified Hurst exponent via R/S analysis.
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
# 12. VALUE-AT-RISK  (Historical simulation)
# ─────────────────────────────────────────────────────────────────────────────

def compute_var(prices: np.ndarray, confidence: float = 0.95) -> dict:
    """
    Historical-simulation Value-at-Risk for the last LOOKBACK returns.
    Also computes Expected Shortfall (CVaR).
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


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def run(csv_path: Path = CSV, out_path: Path = OUT) -> None:
    print("[JINXAI Tensor Extended] Starting pipeline …")

    # ── Load prices ──────────────────────────────────────────────────────────
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        df.columns = [c.lower().strip() for c in df.columns]
        price_col = next(
            (c for c in ("close", "price", "adj close") if c in df.columns),
            df.columns[0],
        )
        date_col = next(
            (c for c in ("date", "time", "datetime") if c in df.columns),
            None,
        )
        prices_raw = df[price_col].dropna().values.astype(float)
        dates_raw  = df[date_col].values if date_col else None
        print(f"  Loaded {len(prices_raw)} bars from {csv_path.name}")
    else:
        rng = np.random.default_rng(42)
        prices_raw = 100.0 + np.cumsum(rng.normal(0, 0.8, 252))
        dates_raw  = None
        print("  Using synthetic price series (252 bars)")

    if len(prices_raw) < LOOKBACK + 2:
        raise ValueError(
            f"Need at least {LOOKBACK + 2} price bars, got {len(prices_raw)}"
        )

    # ── Step 1: Feature matrix ───────────────────────────────────────────────
    F = build_feature_matrix(prices_raw)
    print(f"  Feature matrix: {F.shape}  (n={LOOKBACK}, m={FEATURES})")

    # ── Step 2: Adaptive HOSVD ───────────────────────────────────────────────
    U, S, F_den, k_opt = tensor_decompose(F)
    print(f"  HOSVD adaptive rank k={k_opt}  |  singular values: {S.round(4)}")

    # ── Step 3: Kalman smoother ──────────────────────────────────────────────
    kp, kd = kalman_filter(prices_raw)
    print(f"  Kalman drift (last bar): {kd[-1]:.6f}")

    # ── Step 4: Tensor contraction ───────────────────────────────────────────
    ts, sig_bars, P = tensor_contract(F, F_den)
    last_p = P[-1]
    dom_idx = int(np.argmax(last_p))
    regime  = REGIME_LABELS[dom_idx]
    print(
        f"  Tensor score={ts:.4f}  Regime={regime}  "
        f"p={[round(float(v),2) for v in last_p]}"
    )

    # ── Step 5: Haar wavelet ─────────────────────────────────────────────────
    haar  = haar_decompose(prices_raw)
    print(
        f"  Haar trend slope={haar['trend_slope']:.4f}  "
        f"energy_lo={haar['energy_lo']:.2f}  energy_hi={haar['energy_hi']:.2f}"
    )

    # ── Step 6: Smoothed drift ───────────────────────────────────────────────
    d_smooth, alpha = smooth_drift(prices_raw, F, kd)
    print(f"  Smoothed drift={d_smooth:.6f}  HOSVD-α={alpha:.4f}")

    # ── Step 7: Historical σ ─────────────────────────────────────────────────
    log_rets   = np.diff(np.log(np.clip(prices_raw[-LOOKBACK:], 1e-9, None)))
    sigma_hist = float(log_rets.std() * prices_raw[-1])

    # ── Step 8: Monte Carlo forecast ─────────────────────────────────────────
    fc = monte_carlo_forecast(
        prices_raw, ts, sigma_hist, d_smooth, haar["trend_slope"]
    )
    print(
        f"  MC forecast (μ, +H={HORIZON}): {fc['forecast'][-1]:.4f}  "
        f"p10={fc['p10_band'][-1]:.4f}  p90={fc['p90_band'][-1]:.4f}"
    )

    # ── Step 9: Feature importance ───────────────────────────────────────────
    feat_imp = feature_importance(F)
    print(
        "  Top-3 features: "
        + ", ".join(
            f"{x['feature']}({x['importance']:.2%})"
            for x in sorted(feat_imp, key=lambda r: r["importance"], reverse=True)[:3]
        )
    )

    # ── Step 10: Cross-asset stats ───────────────────────────────────────────
    cross = cross_asset_summary(prices_raw)
    print(
        f"  Hurst={cross['hurst_exponent']:.3f}  "
        f"Skew={cross['skewness']:.3f}  Kurt={cross['excess_kurtosis']:.3f}"
    )

    # ── Step 11: VaR ─────────────────────────────────────────────────────────
    var_stats = compute_var(prices_raw)
    print(
        f"  VaR(95%,1d)={var_stats['var_1d_pct']:.3f}%  "
        f"CVaR={var_stats['cvar_1d_pct']:.3f}%"
    )

    # ── Step 12: Base timestamp ──────────────────────────────────────────────
    base_dt = datetime.now(timezone.utc)
    if dates_raw is not None:
        try:
            dt = pd.to_datetime(str(dates_raw[-1]))
            base_dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except Exception:
            pass

    # ── Step 13: Forecast bars (future timestamps) ────────────────────────────
    forecast_bars = [
        {
            "time":     int((base_dt + timedelta(days=k)).timestamp()),
            "forecast": f,
            "upper":    u,
            "lower":    l,
            "p25":      p25,
            "p75":      p75,
        }
        for k, (f, u, l, p25, p75) in enumerate(
            zip(
                fc["forecast"],
                fc["upper_band"],
                fc["lower_band"],
                fc["p25_band"],
                fc["p75_band"],
            ),
            1,
        )
    ]

    # ── Step 14: Historical bars ─────────────────────────────────────────────
    hist_signal = rolling_tensor_signal(prices_raw)
    n_hist      = len(hist_signal)
    start_idx   = len(prices_raw) - n_hist
    hist_bars   = []
    for i, sig in enumerate(hist_signal):
        idx = start_idx + i
        if dates_raw is not None:
            try:
                dt = pd.to_datetime(str(dates_raw[idx]))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                ts_bar = int(dt.timestamp())
            except Exception:
                ts_bar = int((base_dt - timedelta(days=n_hist - i)).timestamp())
        else:
            ts_bar = int((base_dt - timedelta(days=n_hist - i)).timestamp())

        hist_bars.append({
            "time":  ts_bar,
            "price": round(float(prices_raw[idx]), 4),
            **sig,
        })

    # ── Step 15: Assemble full output ─────────────────────────────────────────
    singular_values    = [round(float(v), 6) for v in S]
    explained_variance = (
        [round(float(v / S.sum() * 100), 2) for v in S]
        if S.sum() > 0 else []
    )

    output: dict[str, Any] = {
        "generated_at":           datetime.now(timezone.utc).isoformat(),
        "engine_version":         "extended-v2",
        "tensor_dims":            {"n": LOOKBACK, "m": FEATURES, "p": REGIMES},
        "hosvd_k_adaptive":       k_opt,
        "hosvd_k_config":         HOSVD_K,
        "feature_weights":        W_FEAT.tolist(),
        "singular_values":        singular_values,
        "explained_variance_pct": explained_variance,
        "tensor_score":           round(ts, 6),
        "hosvd_alpha":            round(alpha, 6),
        "regime":                 regime,
        "regime_probabilities": {
            "p_strong_bull": round(float(last_p[0]), 4),
            "p_bull":        round(float(last_p[1]), 4),
            "p_neut":        round(float(last_p[2]), 4),
            "p_bear":        round(float(last_p[3]), 4),
            "p_strong_bear": round(float(last_p[4]), 4),
        },
        # Legacy keys for index.html backwards compat
        "p_bull":                 round(float(last_p[1]), 4),
        "p_neut":                 round(float(last_p[2]), 4),
        "p_bear":                 round(float(last_p[3]), 4),
        "drift":                  fc["drift"],
        "adj_factor":             fc["adj_factor"],
        "sigma_hist":             fc["sigma_hist"],
        "last_price":             fc["last_price"],
        "kalman": {
            "last_price": round(float(kp[-1]), 4),
            "last_drift": round(float(kd[-1]), 6),
            "process_noise_q": KALMAN_Q,
            "observation_noise_r": KALMAN_R,
        },
        "haar_wavelet": {
            "levels":      HAAR_LEVELS,
            "trend_slope": haar["trend_slope"],
            "energy_lo":   round(haar["energy_lo"], 4),
            "energy_hi":   round(haar["energy_hi"], 4),
            "lo_hi_ratio": round(
                haar["energy_lo"] / (haar["energy_hi"] + 1e-9), 4
            ),
        },
        "monte_carlo": {
            "n_paths": N_MC,
            "seed":    MC_SEED,
            "p10_final": fc["p10_band"][-1],
            "p25_final": fc["p25_band"][-1],
            "mean_final": fc["forecast"][-1],
            "p75_final": fc["p75_band"][-1],
            "p90_final": fc["p90_band"][-1],
        },
        "feature_importance":     feat_imp,
        "cross_asset_stats":      cross,
        "risk_metrics":           var_stats,
        "forecast_bars":          forecast_bars,
        "hist_bars":              hist_bars,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as fh:
        json.dump(output, fh, indent=2)

    print(
        f"\n[JINXAI Tensor Extended] ✓  Written {out_path}  "
        f"({len(forecast_bars)} forecast + {len(hist_bars)} hist bars)"
    )
    print(
        f"  Score={ts:.4f}  Regime={regime}  "
        f"HOSVD-k={k_opt}  HOSVD-α={alpha:.4f}  σ={sigma_hist:.4f}"
    )
    print(f"  Singular values:    {singular_values[:FEATURES]}")
    print(f"  Explained variance: {explained_variance[:FEATURES]}")
    print(
        f"  VaR(95%,1d)={var_stats['var_1d_pct']:.3f}%  "
        f"CVaR={var_stats['cvar_1d_pct']:.3f}%  "
        f"Hurst={cross['hurst_exponent']:.3f}"
    )


if __name__ == "__main__":
    run()
