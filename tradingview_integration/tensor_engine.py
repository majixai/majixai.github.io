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
import sys
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=RuntimeWarning)

# ── Ensure repo root is on sys.path so `tensor.financial` is importable ───────
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# ── Central tensor computation library ────────────────────────────────────────
from tensor.financial import (          # noqa: E402
    build_feature_matrix,
    tensor_decompose,
    kalman_filter,
    haar_decompose,
    tensor_contract,
    feature_importance,
    smooth_drift,
    monte_carlo_forecast,
    rolling_tensor_signal,
    cross_asset_summary,
    compute_var,
)
from tensor.financial.config import (   # noqa: E402
    LOOKBACK,
    FEATURES,
    REGIMES,
    HORIZON,
    HOSVD_K,
    N_MC,
    MC_SEED,
    W_FEAT,
    KALMAN_Q,
    KALMAN_R,
    HAAR_LEVELS,
    REGIME_LABELS,
)

ROOT = Path(__file__).resolve().parent
CSV  = ROOT / "data" / "sample_data.csv"
OUT  = ROOT / "data" / "tensor_forecast.json"


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
