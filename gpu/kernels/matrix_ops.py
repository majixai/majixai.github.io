"""
gpu/kernels/matrix_ops.py — GPU-Accelerated Matrix / Linear-Algebra Kernels
=============================================================================
Common matrix operations used across multiple directories:
  - matmul        : batched matrix multiplication
  - svd_truncated : truncated SVD (low-rank approximation)
  - pca           : principal component analysis
  - covariance    : sample covariance matrix
  - normalize     : row/column-wise normalisation
  - softmax       : 2-D softmax (row-wise)

All functions take a :class:`~gpu.manager.GPUManager` as their first
argument so the correct array module (cupy or numpy) and device context
are used automatically.

Usage
-----
    from gpu.manager import GPUManager
    from gpu.kernels.matrix_ops import matmul, svd_truncated, pca

    mgr = GPUManager()
    C = matmul(mgr, A, B)
    U, s, Vt = svd_truncated(mgr, M, rank=5)
    pcs, explained = pca(mgr, data_matrix, n_components=3)
"""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

import numpy as np


# ── Matrix multiply ───────────────────────────────────────────────────────────
def matmul(manager: Any, a: Any, b: Any) -> Any:
    """
    GPU-accelerated matrix multiplication  C = A @ B.

    Works for 2-D and batched (3-D) tensors.
    """
    xp = manager.xp
    A = xp.asarray(a, dtype=xp.float32)
    B = xp.asarray(b, dtype=xp.float32)
    return A @ B


# ── Truncated SVD ─────────────────────────────────────────────────────────────
def svd_truncated(
    manager: Any,
    matrix: Any,
    rank: int,
) -> Tuple[Any, Any, Any]:
    """
    Rank-k truncated SVD of ``matrix`` ∈ ℝ^(m × n).

    Returns
    -------
    U  : (m × rank)
    s  : (rank,)
    Vt : (rank × n)
    """
    xp = manager.xp
    M = xp.asarray(matrix, dtype=xp.float32)
    U, s, Vt = xp.linalg.svd(M, full_matrices=False)
    k = min(rank, s.shape[0])
    return U[:, :k], s[:k], Vt[:k, :]


# ── PCA ───────────────────────────────────────────────────────────────────────
def pca(
    manager: Any,
    data: Any,
    n_components: int,
    centre: bool = True,
) -> Tuple[Any, Any]:
    """
    Principal Component Analysis via SVD.

    Parameters
    ----------
    data         : (n_samples × n_features)
    n_components : number of principal components to retain
    centre       : subtract column means before decomposition

    Returns
    -------
    projections  : (n_samples × n_components)  — data in PC space
    explained    : (n_components,)             — explained variance ratio
    """
    xp = manager.xp
    X = xp.asarray(data, dtype=xp.float32)
    if centre:
        X = X - X.mean(axis=0)
    U, s, Vt = xp.linalg.svd(X, full_matrices=False)
    k = min(n_components, s.shape[0])
    projections = X @ Vt[:k].T               # (n × k)
    variance = s ** 2 / (X.shape[0] - 1)
    explained = variance[:k] / variance.sum()
    return manager.to_host(projections), manager.to_host(explained)


# ── Covariance matrix ─────────────────────────────────────────────────────────
def covariance(
    manager: Any,
    matrix: Any,
    ddof: int = 1,
) -> Any:
    """
    Compute sample covariance  C ∈ ℝ^(m × m)  from  F ∈ ℝ^(n × m).

    Parameters
    ----------
    ddof : degrees-of-freedom correction (1 = unbiased, 0 = biased)
    """
    xp = manager.xp
    F = xp.asarray(matrix, dtype=xp.float64)
    F_c = F - F.mean(axis=0)
    n = F.shape[0] - ddof
    return (F_c.T @ F_c) / n


# ── Normalize ────────────────────────────────────────────────────────────────
def normalize(
    manager: Any,
    matrix: Any,
    axis: int = 0,
    eps: float = 1e-8,
) -> Any:
    """
    Z-score normalise along the given axis.

    Parameters
    ----------
    axis : 0 = normalise each column (feature), 1 = each row (sample)
    eps  : small constant to prevent divide-by-zero
    """
    xp = manager.xp
    M = xp.asarray(matrix, dtype=xp.float32)
    mu = M.mean(axis=axis, keepdims=True)
    std = M.std(axis=axis, keepdims=True) + eps
    return (M - mu) / std


# ── Softmax (row-wise) ─────────────────────────────────────────────────────────
def softmax(manager: Any, logits: Any) -> Any:
    """
    Numerically stable row-wise softmax.

    Parameters
    ----------
    logits : (n × k) raw scores

    Returns
    -------
    probs : (n × k) row-wise probabilities
    """
    xp = manager.xp
    L = xp.asarray(logits, dtype=xp.float32)
    L -= L.max(axis=1, keepdims=True)
    exp_L = xp.exp(L)
    return exp_L / exp_L.sum(axis=1, keepdims=True)


# ── Dispatcher registration ───────────────────────────────────────────────────
def _register_all() -> None:
    try:
        from gpu.dispatcher import GPUDispatcher

        @GPUDispatcher.register("matrix_ops.matmul")
        def _matmul(mgr, **kw):
            return matmul(mgr, **kw)

        @GPUDispatcher.register("matrix_ops.svd_truncated")
        def _svd(mgr, **kw):
            return svd_truncated(mgr, **kw)

        @GPUDispatcher.register("matrix_ops.pca")
        def _pca(mgr, **kw):
            return pca(mgr, **kw)

        @GPUDispatcher.register("matrix_ops.covariance")
        def _cov(mgr, **kw):
            return covariance(mgr, **kw)

        @GPUDispatcher.register("matrix_ops.normalize")
        def _norm(mgr, **kw):
            return normalize(mgr, **kw)

        @GPUDispatcher.register("matrix_ops.softmax")
        def _sm(mgr, **kw):
            return softmax(mgr, **kw)

    except ImportError:
        pass


_register_all()
