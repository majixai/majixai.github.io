"""
tensor.financial.forecast
=========================
Monte Carlo price forecast and historical rolling tensor signal.

- ``monte_carlo_forecast`` — N_MC drift-diffusion paths → mean + percentile bands
- ``rolling_tensor_signal`` — per-bar tensor score / regime / Kalman overlay
"""
from __future__ import annotations

import math

import numpy as np

from .config import (
    N_MC, MC_SEED, HORIZON, LOOKBACK, REGIME_LABELS,
)
from .features import build_feature_matrix
from .decompose import tensor_decompose
from .kalman import kalman_filter
from .contract import tensor_contract


def monte_carlo_forecast(
    prices: np.ndarray,
    tensor_score: float,
    sigma_hist: float,
    drift: float,
    haar_slope: float,
) -> dict:
    """
    Generate *N_MC* price paths using a drift-diffusion model with tensor
    adjustment and Haar trend bias.

    Model::

        μ_adj   = drift × (1 + ½·tanh(score)) + haar_slope × 0.1
        σ_step  = sigma_hist / √252
        p_{t+k} = p_{t+k−1} + μ_adj·δt + σ·√δt·ε,   ε ~ N(0,1)

    Parameters
    ----------
    prices:
        Full price series (last element is the anchor price).
    tensor_score:
        Scalar tensor signal from ``tensor_contract``.
    sigma_hist:
        Historical volatility (annualised, in price units).
    drift:
        Smoothed drift from ``smooth_drift``.
    haar_slope:
        Trend slope from ``haar_decompose``.

    Returns
    -------
    dict with keys:
        ``last_price``, ``drift``, ``adj_factor``, ``sigma_step``,
        ``sigma_hist``, ``haar_slope``, ``n_paths``, ``horizon``,
        ``forecast``, ``p10_band``, ``p25_band``, ``p75_band``, ``p90_band``,
        ``upper_band`` (= p90), ``lower_band`` (= p10)  [legacy compat].
    """
    rng     = np.random.default_rng(MC_SEED)
    last    = float(prices[-1])
    adj_f   = 1.0 + 0.5 * math.tanh(tensor_score)
    mu_adj  = drift * adj_f + haar_slope * 0.1
    sigma_s = sigma_hist / math.sqrt(252.0) + 1e-9

    dt  = 1.0
    eps = rng.standard_normal((N_MC, HORIZON))        # [paths × steps]

    paths = np.zeros((N_MC, HORIZON))
    paths[:, 0] = last + mu_adj * dt + sigma_s * math.sqrt(dt) * eps[:, 0]
    for k in range(1, HORIZON):
        paths[:, k] = (
            paths[:, k - 1]
            + mu_adj * dt
            + sigma_s * math.sqrt(dt) * eps[:, k]
        )

    mean_fc = np.mean(paths, axis=0)
    p10_fc  = np.percentile(paths, 10, axis=0)
    p25_fc  = np.percentile(paths, 25, axis=0)
    p75_fc  = np.percentile(paths, 75, axis=0)
    p90_fc  = np.percentile(paths, 90, axis=0)

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


def rolling_tensor_signal(prices: np.ndarray) -> list[dict]:
    """
    Compute per-bar tensor_score, dominant regime, and Kalman drift for every
    available bar in *prices*.  Used for the historical overlay on the chart.

    Parameters
    ----------
    prices:
        Full price series, length ≥ LOOKBACK + 1.

    Returns
    -------
    List of dicts (one per bar from index LOOKBACK onward), each containing:
        ``tensor_score``, ``p_strong_bull``, ``p_bull``, ``p_neut``,
        ``p_bear``, ``p_strong_bear``, ``regime``, ``signal``,
        ``kalman_price``, ``kalman_drift``, ``hosvd_k``.
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
