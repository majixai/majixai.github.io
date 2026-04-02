"""
Bayesian Extended Kalman Filter for hidden state estimation in financial markets.

State vector:  x = [P_t, V_t, Θ_t]
  - P_t : Log-price  (true underlying log price)
  - V_t : Stochastic volatility  (variance, must stay > 0)
  - Θ_t : Momentum angle, continuously bounded by arctan

Process model — discretised Heston-like SDE (deterministic drift only; noise
enters through the process-noise covariance matrix Q):
  P_{t+dt} = P_t + μ·dt
  V_{t+dt} = V_t + κ(θ_v - V_t)·dt          (Ornstein-Uhlenbeck mean reversion)
  Θ_{t+dt} = Θ_t + arctan(P_t - P_ref)·dt   (arctan-bounded momentum accumulation)

Measurement model:
  z_t = P_t + ε_t,   ε_t ~ N(0, R)           (observe noisy log-price)

EKF equations:
  Predict:
    x⁻  = f(x⁺)
    P⁻  = F · P⁺ · Fᵀ + Q,   where F = ∂f/∂x evaluated at x⁺

  Update (Kalman gain + Joseph-form covariance for numerical stability):
    S   = H · P⁻ · Hᵀ + R
    K   = P⁻ · Hᵀ · S⁻¹
    x⁺  = x⁻ + K · (z - H · x⁻)
    P⁺  = (I - KH) · P⁻ · (I - KH)ᵀ + K · R · Kᵀ   (Joseph form)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class ExtendedKalmanFilter:
    """
    Extended Kalman Filter for the three-state financial model.

    Parameters
    ----------
    mu : float
        Log-price drift per time-step (already scaled, not annualised).
    kappa : float
        Volatility mean-reversion speed (OU process).
    theta_v : float
        Long-run variance (not standard deviation).
    sigma_v : float
        Volatility-of-volatility (used to size Q).
    dt : float
        Time step (1.0 = one trading day by default).
    P_ref : float
        Reference log-price around which momentum angle is measured.
        Typically set to the median log-price of the calibration window.
    x0 : array-like, optional
        Initial state [P_0, V_0, Θ_0].  Defaults to [P_ref, theta_v, 0].
    P0 : ndarray shape (3,3), optional
        Initial state covariance.  Defaults to a sensible diagonal.
    Q : ndarray shape (3,3), optional
        Process-noise covariance.  Defaults to values derived from parameters.
    R : float
        Measurement-noise variance (scalar).
    """

    H: np.ndarray  # Observation matrix — fixed 1×3

    def __init__(
        self,
        mu: float = 1e-4,
        kappa: float = 2.0,
        theta_v: float = 4e-4,
        sigma_v: float = 0.3,
        dt: float = 1.0,
        P_ref: float = 0.0,
        x0: Optional[np.ndarray] = None,
        P0: Optional[np.ndarray] = None,
        Q: Optional[np.ndarray] = None,
        R: float = 1e-4,
    ) -> None:
        self.mu = float(mu)
        self.kappa = float(kappa)
        self.theta_v = float(theta_v)
        self.sigma_v = float(sigma_v)
        self.dt = float(dt)
        self.P_ref = float(P_ref)
        self.R = float(R)

        # Observation matrix: we observe only P_t
        self.H = np.array([[1.0, 0.0, 0.0]])  # shape (1, 3)

        # ---- State vector ------------------------------------------------
        if x0 is not None:
            self.x = np.asarray(x0, dtype=float).reshape(3).copy()
        else:
            self.x = np.array([P_ref, theta_v, 0.0])

        # ---- State covariance -------------------------------------------
        if P0 is not None:
            self.P_cov = np.asarray(P0, dtype=float).reshape(3, 3).copy()
        else:
            self.P_cov = np.diag([
                max(theta_v, 1e-6),       # P uncertainty ≈ one-period variance
                theta_v ** 2,             # V uncertainty
                0.1,                      # Θ uncertainty (radians²)
            ])

        # ---- Process noise ----------------------------------------------
        if Q is not None:
            self.Q = np.asarray(Q, dtype=float).reshape(3, 3).copy()
        else:
            q_p = theta_v * dt + (self.mu * dt) ** 2
            q_v = (sigma_v ** 2) * theta_v * dt
            q_theta = 1e-6
            self.Q = np.diag([max(q_p, 1e-10), max(q_v, 1e-12), max(q_theta, 1e-10)])

    # ------------------------------------------------------------------
    # Core EKF equations
    # ------------------------------------------------------------------

    def process_model(self, x: np.ndarray, dt: Optional[float] = None) -> np.ndarray:
        """
        Deterministic part of f(x): advance state by one time step.

        dP  = μ · dt
        dV  = κ(θ_v - V) · dt                     (clamped to V_min > 0)
        dΘ  = arctan(P - P_ref) · dt

        Parameters
        ----------
        x : ndarray shape (3,)
        dt : float, optional

        Returns
        -------
        ndarray shape (3,)  — predicted state
        """
        if dt is None:
            dt = self.dt
        P, V, theta = float(x[0]), float(x[1]), float(x[2])
        V = max(V, 1e-10)

        P_new = P + self.mu * dt
        V_new = max(V + self.kappa * (self.theta_v - V) * dt, 1e-10)
        theta_new = theta + np.arctan(P - self.P_ref) * dt
        return np.array([P_new, V_new, theta_new])

    def jacobian_F(self, x: np.ndarray, dt: Optional[float] = None) -> np.ndarray:
        """
        Jacobian  F = ∂f/∂x  evaluated at x.

        ∂P_new/∂P  = 1,   ∂P_new/∂V  = 0,   ∂P_new/∂Θ  = 0
        ∂V_new/∂P  = 0,   ∂V_new/∂V  = 1 - κ·dt,   ∂V_new/∂Θ = 0
        ∂Θ_new/∂P  = dt / (1 + (P-P_ref)²)
        ∂Θ_new/∂V  = 0,   ∂Θ_new/∂Θ  = 1

        Returns
        -------
        ndarray shape (3, 3)
        """
        if dt is None:
            dt = self.dt
        P = float(x[0])
        deviation = P - self.P_ref
        d_theta_d_P = dt / (1.0 + deviation ** 2)

        return np.array([
            [1.0, 0.0, 0.0],
            [0.0, 1.0 - self.kappa * dt, 0.0],
            [d_theta_d_P, 0.0, 1.0],
        ])

    def predict(
        self, dt: Optional[float] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        EKF *predict* step: propagate mean and covariance.

        Returns
        -------
        x_prior : ndarray (3,)
        P_prior : ndarray (3, 3)
        """
        if dt is None:
            dt = self.dt
        F = self.jacobian_F(self.x, dt)
        self.x = self.process_model(self.x, dt)
        self.P_cov = F @ self.P_cov @ F.T + self.Q
        self.P_cov = _symmetrise(self.P_cov)
        return self.x.copy(), self.P_cov.copy()

    def update(
        self, z_observed: float
    ) -> Tuple[np.ndarray, np.ndarray, float]:
        """
        EKF *update* step: incorporate one scalar observation.

        Uses the Joseph-form covariance update for numerical stability.

        Parameters
        ----------
        z_observed : float
            Observed log-price at this time step.

        Returns
        -------
        x_posterior : ndarray (3,)
        P_posterior : ndarray (3, 3)
        innovation  : float   (z_observed − ẑ)
        """
        H = self.H  # (1, 3)

        # Innovation
        z_hat = float(self.x[0])
        innovation = float(z_observed) - z_hat

        # Innovation covariance  S = H P H' + R  (scalar)
        S = float(H @ self.P_cov @ H.T) + self.R
        S = max(S, 1e-14)

        # Kalman gain  K = P H' / S  —  shape (3, 1)
        K = (self.P_cov @ H.T) / S  # (3, 1)

        # State update
        self.x = self.x + K.flatten() * innovation
        self.x[1] = max(float(self.x[1]), 1e-10)  # keep V_t positive

        # Joseph-form covariance update: (I-KH) P (I-KH)' + K R K'
        I_KH = np.eye(3) - K @ H  # (3, 3)
        self.P_cov = I_KH @ self.P_cov @ I_KH.T + (self.R * K @ K.T)
        self.P_cov = _symmetrise(self.P_cov)

        return self.x.copy(), self.P_cov.copy(), innovation

    # ------------------------------------------------------------------
    # High-level helpers
    # ------------------------------------------------------------------

    def step(
        self,
        z_observed: float,
        dt: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Full EKF cycle: predict then update on a single observation.

        Returns
        -------
        dict with keys:
          log_price, volatility, momentum_angle,
          innovation, P_trace, x_posterior (list)
        """
        self.predict(dt)
        x_post, P_post, innovation = self.update(z_observed)

        return {
            "log_price": float(x_post[0]),
            "volatility": float(x_post[1]),
            "momentum_angle": float(x_post[2]),
            "innovation": float(innovation),
            "P_trace": float(np.trace(P_post)),
            "x_posterior": x_post.tolist(),
        }

    def batch_filter(
        self,
        observations: np.ndarray,
        dt: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Run the EKF over an entire sequence of log-price observations.

        Parameters
        ----------
        observations : array-like of float  (log-prices, length N)
        dt : float, optional

        Returns
        -------
        list of N step-result dicts
        """
        return [self.step(float(z), dt) for z in observations]

    def predict_next(
        self,
        n_steps: int = 1,
        dt: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Forecast future states from the current posterior without observations.

        The filter state is restored after forecasting so that subsequent
        calls to :py:meth:`step` are unaffected.

        Parameters
        ----------
        n_steps : int
            Number of steps to forecast ahead.
        dt : float, optional

        Returns
        -------
        list of n_steps forecast dicts with keys:
          log_price, volatility, momentum_angle, P_trace
        """
        if dt is None:
            dt = self.dt

        # Snapshot current state
        x_snap = self.x.copy()
        P_snap = self.P_cov.copy()

        forecasts: List[Dict[str, Any]] = []
        for _ in range(n_steps):
            x_pred, P_pred = self.predict(dt)
            forecasts.append({
                "log_price": float(x_pred[0]),
                "volatility": float(x_pred[1]),
                "momentum_angle": float(x_pred[2]),
                "P_trace": float(np.trace(P_pred)),
            })

        # Restore state
        self.x = x_snap
        self.P_cov = P_snap
        return forecasts


# ------------------------------------------------------------------
# Private helpers
# ------------------------------------------------------------------

def _symmetrise(M: np.ndarray) -> np.ndarray:
    """Return (M + Mᵀ) / 2 to correct floating-point asymmetry."""
    return (M + M.T) * 0.5
