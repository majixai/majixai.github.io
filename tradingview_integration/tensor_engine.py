#!/usr/bin/env python3
"""
JINXAI Tensor Forecast Engine — Server-Side
T ∈ R^(n × m × p):  Time (lookback) × Features × Regime States

Pipeline:
  1. Build Feature Matrix  F ∈ R^(n × m)
  2. Tensor Core via Covariance  C = FᵀF / n  ∈ R^(m × m)
  3. HOSVD Smoothing — truncated SVD keeps top-k singular values
  4. Regime Classification  P ∈ R^(n × p)  via softmax
  5. Tensor Contraction  → scalar score + per-bar regime signal
  6. Forecast Path with σ-bands  (Gaussian Probability Field)

Output:
  tradingview_integration/data/tensor_forecast.json
  Consumed by tradingview_integration/index.html Lightweight Charts overlay.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# ── Hyperparameters ────────────────────────────────────────────────────────────
LOOKBACK = 20     # n — time axis (bars in feature matrix)
FEATURES = 4      # m — [price_z, returns, vol_rank, momentum]
REGIMES  = 3      # p — [bull, neutral, bear]
HORIZON  = 15     # k — forecast bars ahead
HOSVD_K  = 2      # number of singular values to retain (noise truncation)
W_FEAT   = np.array([0.40, 0.25, 0.20, 0.15])   # feature weights w ∈ R^m

ROOT = Path(__file__).resolve().parent
CSV  = ROOT / "data" / "sample_data.csv"
OUT  = ROOT / "data" / "tensor_forecast.json"


# ─────────────────────────────────────────────────────────────────────────────
# 1. FEATURE MATRIX  F ∈ R^(n × m)
# ─────────────────────────────────────────────────────────────────────────────

def build_feature_matrix(prices: np.ndarray) -> np.ndarray:
    """
    Build the feature matrix from the last LOOKBACK bars of `prices`.

    Column layout (m = FEATURES = 4):
      0  Price z-score          (close − μ) / σ
      1  Log returns            Δlog(close)
      2  Rolling 5-bar vol      normalised to [0, 1]
      3  Momentum               (close − rolling_mean) / |max_momentum|
    """
    n = LOOKBACK
    window = prices[-n:].copy()
    F = np.zeros((n, FEATURES))

    # col 0 — z-score
    mu  = window.mean()
    sig = window.std() + 1e-9
    F[:, 0] = (window - mu) / sig

    # col 1 — log returns  (prepend 0 for bar-0 boundary)
    rets = np.diff(np.log(np.clip(window, 1e-9, None)), prepend=0.0)
    F[:, 1] = rets

    # col 2 — rolling 5-bar realised volatility, normalised
    vol = np.array(
        [rets[max(0, i - 4): i + 1].std() for i in range(n)]
    )
    vmax = vol.max() + 1e-9
    F[:, 2] = vol / vmax

    # col 3 — momentum (price vs. running mean), sign-preserved & normalised
    roll_mean = np.array([window[:i + 1].mean() for i in range(n)])
    mom  = window - roll_mean
    mmax = np.abs(mom).max() + 1e-9
    F[:, 3] = mom / mmax

    return F


# ─────────────────────────────────────────────────────────────────────────────
# 2. TENSOR CORE + HOSVD  →  C_den, F_den, singular values
# ─────────────────────────────────────────────────────────────────────────────

def tensor_decompose(F: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Tensor Core computation via FᵀF / n, then HOSVD denoising.

    Steps:
      C     = FᵀF / n               (covariance, [m × m])
      U, S  = eigendecomposition(C)  (via SVD since C is symmetric PSD)
      S_den = truncate S to top-k    (discard noise singular values)
      C_den = U diag(S_den) Uᵀ      (denoised covariance)
      F_den = F · C_den              (denoised feature matrix)

    Returns: (U, S_full, F_denoised)
    """
    n = F.shape[0]
    C = F.T @ F / n                                   # [m × m]
    U, S, Vt = np.linalg.svd(C, full_matrices=False)  # eigendecomposition

    # HOSVD truncation
    S_den = S.copy()
    S_den[HOSVD_K:] = 0.0                             # zero noise components
    C_den = U @ np.diag(S_den) @ Vt                   # denoised covariance

    F_den = F @ C_den                                  # denoised feature matrix
    return U, S, F_den


# ─────────────────────────────────────────────────────────────────────────────
# 3. REGIME CLASSIFICATION  P ∈ R^(n × 3)  via softmax
# ─────────────────────────────────────────────────────────────────────────────

def classify_regimes(F_den: np.ndarray) -> np.ndarray:
    """
    Three-class (bull / neutral / bear) softmax over the denoised return dim.

    Returns P  shape [n, 3]  where columns are [p_bull, p_neut, p_bear].
    """
    rets   = F_den[:, 1]
    logits = np.stack(
        [rets * 50, np.zeros_like(rets), -rets * 50], axis=1
    )                                    # [n × 3]
    logits -= logits.max(axis=1, keepdims=True)   # numerical stability
    e = np.exp(logits)
    P = e / e.sum(axis=1, keepdims=True)
    return P                             # [n × 3]


# ─────────────────────────────────────────────────────────────────────────────
# 4. TENSOR CONTRACTION  →  scalar score  +  per-bar regime signal
# ─────────────────────────────────────────────────────────────────────────────

def tensor_contract(
    F: np.ndarray, F_den: np.ndarray
) -> tuple[float, np.ndarray, np.ndarray]:
    """
    Scalar tensor score = w · C[0, :]  (feature weights dotted with price row).
    Also returns P [n × 3] and the regime-weighted signal vector [n].
    """
    n = F.shape[0]
    C = F.T @ F / n                          # [m × m]
    tensor_score = float(W_FEAT @ C[0, :])   # projection onto price cov-row

    P = classify_regimes(F_den)
    regime_wts   = np.array([1.0, 0.0, -1.0])   # bull=+1, neut=0, bear=−1
    signal_bars  = P @ regime_wts                # [n]

    return tensor_score, signal_bars, P


# ─────────────────────────────────────────────────────────────────────────────
# 5. HOSVD-SMOOTHED DRIFT  →  scalar
# ─────────────────────────────────────────────────────────────────────────────

def smooth_drift(prices: np.ndarray, F: np.ndarray) -> tuple[float, float]:
    """
    Compute the HOSVD-denoised drift.

    noise_floor = mean absolute off-diagonal covariance (approximation of
                  discarded singular value magnitude)
    alpha       = soft-shrinkage coefficient ∈ [0, 1]
    smooth      = alpha · raw_drift  +  (1 − alpha) · mean_drift
    """
    C = F.T @ F / LOOKBACK
    c00 = C[0, 0]
    off_diag = np.abs(C[0, 1:]).mean()
    noise_floor = off_diag
    diag_trace  = np.diag(C).sum() + 1e-9
    alpha = max(0.0, 1.0 - noise_floor / diag_trace)

    raw_drift  = float((prices[-1] - prices[-LOOKBACK]) / LOOKBACK)
    sma_drift  = float(np.diff(prices[-LOOKBACK:]).mean())
    smooth = alpha * raw_drift + (1.0 - alpha) * sma_drift

    return smooth, alpha


# ─────────────────────────────────────────────────────────────────────────────
# 6. FORECAST PATH  E[p_{t+k}] + σ-bands
# ─────────────────────────────────────────────────────────────────────────────

def forecast_path(
    prices: np.ndarray,
    tensor_score: float,
    sigma_hist: float,
    drift: float,
) -> dict:
    """
    Tensor-adjusted drift projection.
      adj_factor    = 1 + ½·tanh(score)
      E[p_{t+k}]   = last + drift_adj · k
      σ_k           = sigma_hist · √k
    """
    last      = float(prices[-1])
    adj_f     = 1.0 + 0.5 * math.tanh(tensor_score)
    d_adj     = drift * adj_f

    fc, upper, lower = [], [], []
    for k in range(1, HORIZON + 1):
        f      = last + d_adj * k
        sigma_k = sigma_hist * math.sqrt(k)
        fc.append(round(f, 4))
        upper.append(round(f + sigma_k, 4))
        lower.append(round(f - sigma_k, 4))

    return {
        "last_price":  round(last, 4),
        "drift":       round(d_adj, 6),
        "adj_factor":  round(adj_f, 6),
        "sigma_hist":  round(sigma_hist, 6),
        "horizon":     HORIZON,
        "forecast":    fc,
        "upper_band":  upper,
        "lower_band":  lower,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 7. HISTORICAL ROLLING TENSOR SIGNAL
# ─────────────────────────────────────────────────────────────────────────────

def rolling_tensor_signal(prices: np.ndarray) -> list[dict]:
    """
    Compute per-bar tensor_score and dominant regime for every available bar.
    Used for the historical overlay on the chart.
    """
    results = []
    for end in range(LOOKBACK, len(prices)):
        w        = prices[end - LOOKBACK: end]
        F        = build_feature_matrix(w)
        _, _, Fd = tensor_decompose(F)
        score, _, P = tensor_contract(F, Fd)
        last_p   = P[-1]
        dom      = int(np.argmax(last_p))
        results.append({
            "tensor_score": round(score, 6),
            "p_bull":       round(float(last_p[0]), 4),
            "p_neut":       round(float(last_p[1]), 4),
            "p_bear":       round(float(last_p[2]), 4),
            "regime":       ["BULL", "NEUT", "BEAR"][dom],
            "signal":       round(float(last_p[0] - last_p[2]), 4),
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def run(csv_path: Path = CSV, out_path: Path = OUT) -> None:
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
    else:
        # Fallback: reproducible synthetic series
        rng = np.random.default_rng(42)
        prices_raw = 100.0 + np.cumsum(rng.normal(0, 0.8, 180))
        dates_raw  = None

    if len(prices_raw) < LOOKBACK + 2:
        raise ValueError(
            f"Need at least {LOOKBACK + 2} price bars, got {len(prices_raw)}"
        )

    # ── Build tensor ─────────────────────────────────────────────────────────
    F               = build_feature_matrix(prices_raw)
    U, S, F_den     = tensor_decompose(F)
    ts, sig_bars, P = tensor_contract(F, F_den)
    d_smooth, alpha = smooth_drift(prices_raw, F)

    # Historical σ (annualised log-return std → price units)
    log_rets   = np.diff(np.log(np.clip(prices_raw[-LOOKBACK:], 1e-9, None)))
    sigma_hist = float(log_rets.std() * prices_raw[-1])

    # ── Forecast ─────────────────────────────────────────────────────────────
    fc = forecast_path(prices_raw, ts, sigma_hist, d_smooth)

    # ── Dominant regime ──────────────────────────────────────────────────────
    last_p    = P[-1]
    dom_idx   = int(np.argmax(last_p))
    regime    = ("BULL", "NEUT", "BEAR")[dom_idx]

    # ── Base timestamp ───────────────────────────────────────────────────────
    base_dt = datetime.now(timezone.utc)
    if dates_raw is not None:
        try:
            dt = pd.to_datetime(str(dates_raw[-1]))
            base_dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except Exception:
            pass

    # ── Forecast bars (future timestamps) ────────────────────────────────────
    forecast_bars = [
        {
            "time":     int((base_dt + timedelta(days=k)).timestamp()),
            "forecast": f,
            "upper":    u,
            "lower":    l,
        }
        for k, (f, u, l) in enumerate(
            zip(fc["forecast"], fc["upper_band"], fc["lower_band"]), 1
        )
    ]

    # ── Historical bars (with tensor signal) ─────────────────────────────────
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

    # ── Tensor metadata ───────────────────────────────────────────────────────
    singular_values    = [round(float(v), 6) for v in S]
    explained_variance = (
        [round(float(v / S.sum() * 100), 2) for v in S]
        if S.sum() > 0 else []
    )

    output = {
        "generated_at":           datetime.now(timezone.utc).isoformat(),
        "tensor_dims":            {"n": LOOKBACK, "m": FEATURES, "p": REGIMES},
        "hosvd_k":                HOSVD_K,
        "feature_weights":        W_FEAT.tolist(),
        "singular_values":        singular_values,
        "explained_variance_pct": explained_variance,
        "tensor_score":           round(ts, 6),
        "hosvd_alpha":            round(alpha, 6),
        "regime":                 regime,
        "p_bull":                 round(float(last_p[0]), 4),
        "p_neut":                 round(float(last_p[1]), 4),
        "p_bear":                 round(float(last_p[2]), 4),
        "drift":                  fc["drift"],
        "adj_factor":             fc["adj_factor"],
        "sigma_hist":             fc["sigma_hist"],
        "last_price":             fc["last_price"],
        "forecast_bars":          forecast_bars,
        "hist_bars":              hist_bars,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as fh:
        json.dump(output, fh, indent=2)

    print(
        f"[JINXAI Tensor] Written {out_path}  "
        f"({len(forecast_bars)} forecast + {len(hist_bars)} historical bars)"
    )
    print(
        f"  Score={ts:.4f}  Regime={regime}  "
        f"p(bull)={last_p[0]:.2%}  HOSVD-α={alpha:.4f}  σ={sigma_hist:.4f}"
    )
    print(f"  Singular values: {singular_values[:4]}")
    print(f"  Explained variance: {explained_variance[:4]}")


if __name__ == "__main__":
    run()
