"""
tensor.financial.contract
=========================
Tensor contraction, cross-feature importance (Shapley-style), and
HOSVD-smoothed drift estimation.

- ``tensor_contract``  — scalar tensor score + per-bar regime signal
- ``feature_importance`` — leave-one-out covariance score delta
- ``smooth_drift``      — blend HOSVD-denoised drift with Kalman estimate
"""
from __future__ import annotations

import numpy as np

from .config import LOOKBACK, W_FEAT, FEATURE_NAMES
from .regimes import classify_regimes_5


def tensor_contract(
    F: np.ndarray, F_den: np.ndarray
) -> tuple[float, np.ndarray, np.ndarray]:
    """
    Compute scalar tensor score and per-bar regime signal via tensor
    contraction.

    Scalar tensor score = w · C[0, :]  (feature weights dotted with price
    row of the covariance matrix).

    Parameters
    ----------
    F:
        Raw feature matrix, shape (n, m).
    F_den:
        Denoised feature matrix, shape (n, m).

    Returns
    -------
    tensor_score : float
    regime_signal : np.ndarray, shape (n,)
        Weighted regime signal per bar in [-2, 2].
    P : np.ndarray, shape (n, 5)
        Per-bar regime probability distribution.
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


def feature_importance(F: np.ndarray) -> list[dict]:
    """
    Estimate feature importance via leave-one-out covariance score delta
    (Shapley-style approximation).

    For each feature *j*::

        score_full  = w · C[0, :]
        score_loo   = score with column j of F zeroed out
        importance  = |score_full − score_loo|  / (Σ|deltas| + ε)

    Parameters
    ----------
    F:
        Raw feature matrix, shape (n, m).

    Returns
    -------
    List of dicts with keys: ``feature``, ``weight``, ``importance``, ``delta``.
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
    return [
        {
            "feature":    FEATURE_NAMES[j] if j < len(FEATURE_NAMES) else f"f{j}",
            "weight":     round(W_FEAT[j] if j < len(W_FEAT) else 0.0, 4),
            "importance": round(float(deltas[j] / total), 4),
            "delta":      round(float(deltas[j]), 6),
        }
        for j in range(m)
    ]


def smooth_drift(
    prices: np.ndarray, F: np.ndarray, kalman_drifts: np.ndarray
) -> tuple[float, float]:
    """
    Blend HOSVD-denoised drift with Kalman drift estimate.

    Noise floor is the mean absolute off-diagonal covariance.  Alpha is a
    soft-shrinkage weight that blends the raw drift toward the Kalman
    estimate when off-diagonal noise is high relative to the diagonal trace.

    Parameters
    ----------
    prices:
        Full price series, length ≥ LOOKBACK.
    F:
        Raw feature matrix, shape (n, m).
    kalman_drifts:
        Kalman-smoothed drift estimates, shape (n,).

    Returns
    -------
    smooth : float
        Blended drift estimate.
    alpha : float
        Soft-shrinkage weight ∈ [0, 1].
    """
    C           = F.T @ F / LOOKBACK
    off_diag    = np.abs(C[0, 1:]).mean()
    diag_trace  = np.diag(C).sum() + 1e-9
    alpha       = max(0.0, 1.0 - off_diag / diag_trace)

    raw_drift    = float((prices[-1] - prices[-LOOKBACK]) / LOOKBACK)
    kalman_drift = float(kalman_drifts[-1])
    smooth       = alpha * raw_drift + (1.0 - alpha) * kalman_drift

    return smooth, alpha
