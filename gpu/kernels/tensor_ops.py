"""
gpu/kernels/tensor_ops.py — GPU-Accelerated Tensor Kernels
============================================================
Provides tensor-processing kernels used by the JINXAI pipelines:
  - HOSVD (Higher-Order SVD / Tucker decomposition)
  - Kalman filter smoother
  - Monte Carlo forecast paths
  - Regime softmax classification
  - Haar wavelet multi-scale decomposition

All functions accept a :class:`~gpu.manager.GPUManager` as their first
argument so they can use the correct array module (cupy or numpy) and run
inside the active device context.

Usage
-----
    from gpu.manager import GPUManager
    from gpu.kernels.tensor_ops import hosvd, kalman_smooth, monte_carlo

    mgr = GPUManager()
    core, sv = hosvd(mgr, feature_matrix=F, rank=3)
    smoothed = kalman_smooth(mgr, observations=prices)
    paths    = monte_carlo(mgr, mu=0.001, sigma=0.02, steps=20, n_paths=400)
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Tuple

import numpy as np


# ── HOSVD ─────────────────────────────────────────────────────────────────────
def hosvd(
    manager: Any,
    feature_matrix: Any,
    rank: int = 3,
) -> Tuple[Any, Any]:
    """
    Rank-k truncated HOSVD on a 2-D feature matrix F ∈ ℝ^(n × m).

    Steps
    -----
    1. Compute covariance  C = FᵀF / n  ∈ ℝ^(m × m)
    2. SVD of C → U, Σ, Vᵀ
    3. Retain top-k singular vectors
    4. Project F onto the reduced basis  →  core ∈ ℝ^(n × k)

    Returns
    -------
    core : array (n × rank)   — projected feature matrix
    sv   : array (rank,)      — retained singular values
    """
    xp = manager.xp
    F = xp.asarray(feature_matrix, dtype=xp.float32)
    n = F.shape[0]
    C = (F.T @ F) / n                            # (m × m) covariance

    # SVD — cupy and numpy share the same linalg.svd signature
    U, s, _ = xp.linalg.svd(C, full_matrices=False)
    k = min(rank, s.shape[0])
    U_k = U[:, :k]                               # (m × k)
    sv = s[:k]                                   # (k,)
    core = F @ U_k                               # (n × k)
    return core, sv


# ── Kalman smoother ───────────────────────────────────────────────────────────
def kalman_smooth(
    manager: Any,
    observations: Any,
    process_noise: float = 1e-4,
    obs_noise: float = 1e-2,
) -> Any:
    """
    1-D Kalman filter + RTS smoother over a price/signal series.

    Parameters
    ----------
    observations : 1-D array-like of floats
    process_noise : Q — process noise covariance
    obs_noise     : R — observation noise covariance

    Returns
    -------
    smoothed : 1-D array of filtered+smoothed values (same length)
    """
    xp = manager.xp
    z = xp.asarray(observations, dtype=xp.float64).ravel()
    n = z.shape[0]

    # Forward pass
    x_filt = xp.zeros(n)
    p_filt = xp.zeros(n)
    x_pred = xp.zeros(n)
    p_pred = xp.zeros(n)

    x_filt[0] = z[0]
    p_filt[0] = 1.0

    for t in range(1, n):
        # Predict
        x_pred[t] = x_filt[t - 1]
        p_pred[t] = p_filt[t - 1] + process_noise
        # Update
        K = p_pred[t] / (p_pred[t] + obs_noise)
        x_filt[t] = x_pred[t] + K * (z[t] - x_pred[t])
        p_filt[t] = (1 - K) * p_pred[t]

    # RTS backward smoothing pass
    smoothed = x_filt.copy()
    for t in range(n - 2, -1, -1):
        if p_pred[t + 1] > 0:
            gain = p_filt[t] / p_pred[t + 1]
            smoothed[t] = smoothed[t] + gain * (smoothed[t + 1] - x_pred[t + 1])

    return smoothed


# ── Monte Carlo forecast ───────────────────────────────────────────────────────
def monte_carlo(
    manager: Any,
    mu: float,
    sigma: float,
    steps: int = 20,
    n_paths: int = 400,
    seed: int = 42,
    s0: float = 1.0,
) -> Dict[str, Any]:
    """
    Geometric Brownian Motion Monte Carlo forecast.

    Parameters
    ----------
    mu      : drift per step
    sigma   : volatility per step
    steps   : forecast horizon (bars)
    n_paths : number of simulation paths
    seed    : RNG seed for reproducibility
    s0      : initial price (normalised to 1.0 by default)

    Returns
    -------
    dict with keys: paths (n_paths × steps+1), mean, p5, p25, p75, p95
    """
    xp = manager.xp
    rng = xp.random.default_rng(seed) if hasattr(xp.random, "default_rng") else None

    if rng is not None:
        shocks = rng.standard_normal((n_paths, steps))
    else:
        xp.random.seed(seed)
        shocks = xp.random.randn(n_paths, steps)

    dt = 1.0
    drift = (mu - 0.5 * sigma ** 2) * dt
    diffusion = sigma * math.sqrt(dt)

    log_returns = drift + diffusion * shocks         # (n_paths × steps)
    log_price = xp.cumsum(log_returns, axis=1)       # (n_paths × steps)
    init_col = xp.zeros((n_paths, 1))
    log_paths = xp.concatenate([init_col, log_price], axis=1)
    paths = s0 * xp.exp(log_paths)                  # (n_paths × steps+1)

    final_prices = paths[:, -1]
    return {
        "paths": manager.to_host(paths),
        "mean": float(manager.to_host(xp.mean(final_prices))),
        "p5":   float(manager.to_host(xp.percentile(final_prices, 5))),
        "p25":  float(manager.to_host(xp.percentile(final_prices, 25))),
        "p75":  float(manager.to_host(xp.percentile(final_prices, 75))),
        "p95":  float(manager.to_host(xp.percentile(final_prices, 95))),
    }


# ── Regime softmax ─────────────────────────────────────────────────────────────
def regime_softmax(
    manager: Any,
    scores: Any,
    temperature: float = 1.0,
) -> Any:
    """
    Stable softmax over regime logits.

    Parameters
    ----------
    scores      : array-like (n × p) — raw regime scores per bar
    temperature : controls sharpness (< 1 = sharper, > 1 = smoother)

    Returns
    -------
    probs : array (n × p) — regime probabilities
    """
    xp = manager.xp
    s = xp.asarray(scores, dtype=xp.float32) / temperature
    s -= s.max(axis=1, keepdims=True)          # numerical stability
    exp_s = xp.exp(s)
    probs = exp_s / exp_s.sum(axis=1, keepdims=True)
    return probs


# ── Haar wavelet decomposition ────────────────────────────────────────────────
def haar_wavelet(
    manager: Any,
    signal: Any,
    levels: int = 3,
) -> List[Any]:
    """
    Haar multi-scale decomposition (Mallat algorithm, in-place lifting).

    Parameters
    ----------
    signal : 1-D array-like
    levels : number of decomposition levels

    Returns
    -------
    components : list of (detail, approx) tuples per level;
                 last entry is the final approximation.
    """
    xp = manager.xp
    x = xp.asarray(signal, dtype=xp.float64).ravel()
    components: List[Any] = []
    current = x.copy()

    for _ in range(levels):
        n = len(current)
        half = n // 2
        if half < 1:
            break
        even = current[:2 * half:2]
        odd  = current[1:2 * half:2]
        approx = (even + odd) / math.sqrt(2)
        detail = (even - odd) / math.sqrt(2)
        components.append((manager.to_host(detail), manager.to_host(approx)))
        current = approx

    return components


# ── Dispatcher registration ───────────────────────────────────────────────────
def _register_all() -> None:
    """Auto-register kernels with the dispatcher (called at import time)."""
    try:
        from gpu.dispatcher import GPUDispatcher

        @GPUDispatcher.register("tensor_ops.hosvd")
        def _hosvd(mgr, **kw):
            return hosvd(mgr, **kw)

        @GPUDispatcher.register("tensor_ops.kalman_smooth")
        def _kalman(mgr, **kw):
            return kalman_smooth(mgr, **kw)

        @GPUDispatcher.register("tensor_ops.monte_carlo")
        def _mc(mgr, **kw):
            return monte_carlo(mgr, **kw)

        @GPUDispatcher.register("tensor_ops.regime_softmax")
        def _rsm(mgr, **kw):
            return regime_softmax(mgr, **kw)

        @GPUDispatcher.register("tensor_ops.haar_wavelet")
        def _haar(mgr, **kw):
            return haar_wavelet(mgr, **kw)

    except ImportError:
        pass  # dispatcher not yet available; registration deferred


_register_all()
