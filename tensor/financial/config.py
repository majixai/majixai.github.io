"""
tensor.financial.config
=======================
Shared hyperparameters for the financial tensor pipeline.
All sub-modules import constants from here; callers may also override them
by importing and reassigning before calling the computation functions.
"""
from __future__ import annotations

import numpy as np

# ── Time / Feature / Regime dimensions ────────────────────────────────────────
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

# Regime labels (5-class)
REGIME_LABELS = ["STRONG_BULL", "BULL", "NEUT", "BEAR", "STRONG_BEAR"]

# Human-readable feature names (index matches F column layout)
FEATURE_NAMES = [
    "price_zscore",
    "log_return",
    "realised_vol",
    "momentum",
    "rate_of_change",
    "upper_shadow",
    "lower_shadow",
    "mean_reversion",
]
