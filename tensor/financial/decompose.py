"""
tensor.financial.decompose
==========================
Tensor core via covariance and adaptive Higher-Order SVD (HOSVD) denoising.

Steps:
  C      = FᵀF / n                (covariance [m × m])
  U,S,Vt = SVD(C)                 (eigendecomposition)
  k_opt  = adaptive rank           (90% energy threshold)
  S_den  = truncate S to top-k_opt
  C_den  = U diag(S_den) Vt       (denoised covariance)
  F_den  = F · C_den              (denoised feature matrix)
"""
from __future__ import annotations

import numpy as np

from .config import HOSVD_K


def _adaptive_hosvd_rank(S: np.ndarray, energy_threshold: float = 0.90) -> int:
    """
    Select the minimum rank *k* that retains ≥ *energy_threshold* of total
    singular-value energy.  Clamps to [1, len(S)].

    Parameters
    ----------
    S:
        1-D array of singular values (non-negative, typically descending).
    energy_threshold:
        Fraction of total energy to retain (default 0.90 → 90%).

    Returns
    -------
    int: optimal rank k
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
    Tensor Core: C = FᵀF / n, then adaptive HOSVD denoising.

    Parameters
    ----------
    F:
        Feature matrix, shape (n, m).

    Returns
    -------
    U : np.ndarray, shape (m, m)
        Left singular vectors of the covariance matrix.
    S : np.ndarray, shape (m,)
        Full singular values of the covariance matrix.
    F_denoised : np.ndarray, shape (n, m)
        Feature matrix projected through the denoised covariance.
    k_used : int
        Adaptive rank selected by the 90%-energy threshold.
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
