"""
tensor.financial.kalman
=======================
1-D Kalman filter smoother for price and drift estimation.

State vector : [price, drift]
Transition   : price_{t+1} = price_t + drift_t
               drift_{t+1} = drift_t          (random walk)
Observation  : z_t = price_t + noise
"""
from __future__ import annotations

import numpy as np

from .config import KALMAN_Q, KALMAN_R


def kalman_filter(prices: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Apply a 1-D Kalman filter to *prices* to estimate smoothed prices and
    per-bar drift.

    Parameters
    ----------
    prices:
        1-D array of observed prices, length n.

    Returns
    -------
    smoothed_prices : np.ndarray, shape (n,)
    smoothed_drifts : np.ndarray, shape (n,)
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
