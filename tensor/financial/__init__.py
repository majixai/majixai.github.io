"""
tensor.financial
================
Central Python package for all financial/market tensor calculations.

Sub-modules by processing type
-------------------------------
- :mod:`config`     — shared hyperparameters and constants
- :mod:`features`   — feature-matrix construction  F ∈ R^(n × m)
- :mod:`decompose`  — tensor core via covariance + adaptive HOSVD denoising
- :mod:`kalman`     — 1-D Kalman filter smoother (price + drift)
- :mod:`wavelet`    — Haar multi-scale decomposition (trend / detail)
- :mod:`regimes`    — five-class softmax regime classifier
- :mod:`contract`   — tensor contraction, feature importance, smoothed drift
- :mod:`forecast`   — Monte Carlo forecast + historical rolling signal
- :mod:`statistics` — cross-asset stats, Hurst exponent, VaR / CVaR

Public API (importable directly from ``tensor.financial``)
-----------------------------------------------------------
All key computation functions are re-exported here so callers can write::

    from tensor.financial import build_feature_matrix, tensor_decompose, ...
"""
from .features   import build_feature_matrix
from .decompose  import tensor_decompose, _adaptive_hosvd_rank
from .kalman     import kalman_filter
from .wavelet    import haar_decompose
from .regimes    import classify_regimes_5
from .contract   import tensor_contract, feature_importance, smooth_drift
from .forecast   import monte_carlo_forecast, rolling_tensor_signal
from .statistics import cross_asset_summary, compute_var

__all__ = [
    "build_feature_matrix",
    "tensor_decompose",
    "_adaptive_hosvd_rank",
    "kalman_filter",
    "haar_decompose",
    "classify_regimes_5",
    "tensor_contract",
    "feature_importance",
    "smooth_drift",
    "monte_carlo_forecast",
    "rolling_tensor_signal",
    "cross_asset_summary",
    "compute_var",
]
