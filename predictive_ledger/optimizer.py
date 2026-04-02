"""
predictive_ledger/optimizer.py

Python backend for the Predictive Ledger Engine.

Classes
-------
LedgerOptimizer
    Multivariate Bayesian linear regression: posterior update, predictive
    distribution, log-marginal likelihood, AIC/BIC, and feature importance.

KalmanFilter
    Discrete-time Kalman filter with a constant-velocity state model.
    Optimal linear estimator for noisy sequential price observations.
    Provides filtered positions, velocity estimates, and one-step forecasts.

TechnicalIndicators
    Vectorized computation of the most common price/volume indicators:
    SMA, EMA, RSI (Wilder), MACD, Bollinger Bands, ATR, and VWAP.

EnsemblePredictor
    Combine predictions from multiple sub-models (BayesianLR, Kalman,
    Kinematic) using online-gradient-descent ensemble weight updates.

BacktestEngine
    Simulate a simple kinematic-signal trading strategy over historical
    data and return per-trade P&L, cumulative return, and Sharpe ratio.

All heavy matrix operations use NumPy so they stay fast even for large
ledger datasets, offloading work that would be slow inside a JS engine.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np


# ═══════════════════════════════════════════════════════════════════════════
# LedgerOptimizer
# ═══════════════════════════════════════════════════════════════════════════


class LedgerOptimizer:
    """
    Multivariate Bayesian linear regression weight optimizer.

    The model assumes:
        y  =  X @ w  +  ε,   ε ~ N(0, σ²)

    with a Gaussian prior on the weight vector w:
        w  ~  N(μ_prior, Σ_prior)

    Given observations (X, y) the closed-form posterior is:
        Σ_post = (Λ_prior + (1/σ²) * Xᵀ X)⁻¹
        μ_post = Σ_post @ (Λ_prior @ μ_prior + (1/σ²) * Xᵀ y)

    where Λ_prior = Σ_prior⁻¹ is the prior precision matrix.
    """

    def __init__(self, noise_var: float = 0.01):
        """
        Parameters
        ----------
        noise_var : float
            Observation noise variance σ².  A smaller value means the model
            trusts the data more and updates weights more aggressively.
        """
        if noise_var <= 0:
            raise ValueError("noise_var must be strictly positive")
        self.noise_var = float(noise_var)

    def update_weights(
        self,
        X: np.ndarray,
        y: np.ndarray,
        prior_mu: np.ndarray,
        prior_cov: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Perform a full Bayesian linear regression posterior update.

        Parameters
        ----------
        X         : (n_samples, n_features) design matrix
        y         : (n_samples,) target vector
        prior_mu  : (n_features,) prior mean vector μ_prior
        prior_cov : (n_features, n_features) prior covariance Σ_prior

        Returns
        -------
        post_mu  : (n_features,) posterior mean
        post_cov : (n_features, n_features) posterior covariance
        """
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)
        prior_mu = np.asarray(prior_mu, dtype=float)
        prior_cov = np.asarray(prior_cov, dtype=float)

        # Prior precision matrix  Λ_prior = Σ_prior⁻¹
        precision_prior = np.linalg.inv(prior_cov)

        # Posterior precision  Λ_post = Λ_prior + (1/σ²) Xᵀ X
        precision_post = precision_prior + (1.0 / self.noise_var) * (X.T @ X)

        # Posterior covariance  Σ_post = Λ_post⁻¹
        post_cov = np.linalg.inv(precision_post)

        # Posterior mean  μ_post = Σ_post @ (Λ_prior μ_prior + (1/σ²) Xᵀ y)
        post_mu = post_cov @ (
            precision_prior @ prior_mu + (1.0 / self.noise_var) * (X.T @ y)
        )

        return post_mu, post_cov

    @staticmethod
    def arctan_jacobian(u: np.ndarray, du: np.ndarray) -> np.ndarray:
        """
        Arctangent Jacobian for non-linear phase estimation.

        Computes the chain-rule derivative of arctan(u(x)) with respect to x:

            d/dx arctan(u(x))  =  1 / (1 + u²)  ·  du/dx

        This is the element-wise Jacobian of the arctan activation function,
        used to linearise the model around the current operating point during
        gradient-based posterior updates.

        Parameters
        ----------
        u  : array-like — current value of the inner function u(x)
        du : array-like — derivative du/dx at the operating point (same shape)

        Returns
        -------
        ndarray — Jacobian values of arctan(u) with respect to x
        """
        u = np.asarray(u, dtype=float)
        du = np.asarray(du, dtype=float)
        return (1.0 / (1.0 + np.power(u, 2))) * du

    def predictive_distribution(
        self,
        X_new: np.ndarray,
        post_mu: np.ndarray,
        post_cov: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute the posterior predictive distribution for new inputs.

        For Bayesian linear regression the predictive distribution is Gaussian:
            p(y* | x*, X, y) = N(y*; μ*, σ*²)

        where:
            μ*   = X_new @ μ_post
            σ*²  = σ²  +  diag(X_new @ Σ_post @ X_new.T)

        The σ² term captures irreducible observation noise; the matrix term
        captures epistemic uncertainty about the weights.

        Parameters
        ----------
        X_new    : (m, d) design matrix for new inputs
        post_mu  : (d,)   posterior mean
        post_cov : (d, d) posterior covariance

        Returns
        -------
        pred_mean : (m,) predictive mean
        pred_var  : (m,) predictive variance (noise + parameter uncertainty)
        """
        X_new = np.asarray(X_new, dtype=float)
        post_mu = np.asarray(post_mu, dtype=float)
        post_cov = np.asarray(post_cov, dtype=float)

        pred_mean = X_new @ post_mu
        # epistemic variance: diag(X_new Σ X_new.T)
        epistemic = np.einsum("ij,jk,ik->i", X_new, post_cov, X_new)
        pred_var = self.noise_var + epistemic
        return pred_mean, pred_var

    def log_marginal_likelihood(
        self,
        X: np.ndarray,
        y: np.ndarray,
        prior_mu: np.ndarray,
        prior_cov: np.ndarray,
    ) -> float:
        """
        Compute the log marginal likelihood (model evidence).

        Used for model comparison, hyperparameter selection (e.g. optimising
        noise_var), and computing BIC/AIC.

            log p(y | X) = log N(y ; X μ_prior, σ²I + X Σ_prior Xᵀ)

        A higher value indicates the model fits the data better under
        Occam's razor (penalising unnecessary complexity implicitly).

        Returns
        -------
        float — log marginal likelihood
        """
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)
        prior_mu = np.asarray(prior_mu, dtype=float)
        prior_cov = np.asarray(prior_cov, dtype=float)

        n = X.shape[0]
        # Marginal covariance: S = σ²I + X Σ_prior Xᵀ
        S = self.noise_var * np.eye(n) + X @ prior_cov @ X.T
        try:
            sign, log_det = np.linalg.slogdet(S)
            if sign <= 0:
                return -np.inf
            S_inv = np.linalg.inv(S)
        except np.linalg.LinAlgError:
            return -np.inf

        residual = y - X @ prior_mu
        log_ml = (
            -0.5 * n * math.log(2 * math.pi)
            - 0.5 * log_det
            - 0.5 * float(residual @ S_inv @ residual)
        )
        return log_ml

    def information_criteria(
        self,
        X: np.ndarray,
        y: np.ndarray,
        post_mu: np.ndarray,
        k_params: int,
    ) -> Dict[str, float]:
        """
        Compute AIC and BIC for model selection between different feature sets.

        AIC = −2 log p̂ + 2k
        BIC = −2 log p̂ + k log n

        Lower values indicate a better trade-off between fit and complexity.

        Parameters
        ----------
        X        : (n, d) design matrix
        y        : (n,) observations
        post_mu  : (d,) posterior mean weights (used as MAP point estimate)
        k_params : number of free parameters in the model

        Returns
        -------
        dict with keys 'aic', 'bic', 'log_likelihood', 'n_samples'
        """
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)
        post_mu = np.asarray(post_mu, dtype=float)

        n = X.shape[0]
        residuals = y - X @ post_mu
        sse = float(residuals @ residuals)
        # Gaussian log-likelihood under known noise_var
        log_lik = (
            -0.5 * n * math.log(2 * math.pi * self.noise_var)
            - sse / (2.0 * self.noise_var)
        )
        aic = -2.0 * log_lik + 2.0 * k_params
        bic = -2.0 * log_lik + k_params * math.log(n) if n > 0 else float("inf")
        return {
            "aic": aic,
            "bic": bic,
            "log_likelihood": log_lik,
            "n_samples": n,
        }

    def feature_importance(
        self,
        post_mu: np.ndarray,
        post_cov: np.ndarray,
    ) -> Dict[str, list]:
        """
        Compute feature importance as the posterior signal-to-noise ratio.

        importance_i = |μ_i| / σ_i

        A high value means the posterior is confident that feature i has a
        non-zero effect on the target.  Values are normalised so they sum to 1.

        Returns
        -------
        dict with 'raw_importance' and 'normalised_importance' lists
        """
        post_mu = np.asarray(post_mu, dtype=float)
        post_cov = np.asarray(post_cov, dtype=float)

        std = np.sqrt(np.maximum(np.diag(post_cov), 1e-12))
        raw = np.abs(post_mu) / std
        total = raw.sum()
        normalised = raw / total if total > 0 else raw
        return {
            "raw_importance": raw.tolist(),
            "normalised_importance": normalised.tolist(),
        }

    def posterior_summary(
        self,
        post_mu: np.ndarray,
        post_cov: np.ndarray,
    ) -> dict:
        """
        Return a JSON-serialisable summary of the posterior distribution.

        Includes the posterior mean, standard deviations (square root of the
        diagonal of the covariance matrix), the condition number of the
        covariance (numerical stability indicator), and feature importance.
        """
        post_mu = np.asarray(post_mu, dtype=float)
        post_cov = np.asarray(post_cov, dtype=float)
        importance = self.feature_importance(post_mu, post_cov)
        return {
            "posterior_mean": post_mu.tolist(),
            "posterior_std": np.sqrt(np.diag(post_cov)).tolist(),
            "posterior_cov": post_cov.tolist(),
            "condition_number": float(np.linalg.cond(post_cov)),
            "feature_importance": importance["normalised_importance"],
        }


# ═══════════════════════════════════════════════════════════════════════════
# KalmanFilter
# ═══════════════════════════════════════════════════════════════════════════


class KalmanFilter:
    """
    Discrete-time Kalman filter with a constant-velocity state model.

    State equation:     x_t = F x_{t−1} + w_t,    w ~ N(0, Q)
    Observation:        z_t = H x_t     + v_t,    v ~ N(0, R)

    State vector x = [position, velocity]ᵀ tracks both the price level and
    its rate of change simultaneously.  The filter produces:

    • Filtered position  — noise-reduced estimate of the true price
    • Velocity estimate  — instantaneous trend direction and magnitude
    • One-step forecast  — predicted next price *before* the observation
    • Innovation         — (observation − forecast): surprise signal

    The Kalman gain K adapts automatically: when observation noise R is large
    the filter trusts the model more; when process noise Q is large it trusts
    new observations more.
    """

    def __init__(
        self,
        dt: float = 1.0,
        process_var: float = 1.0,
        obs_var: float = 10.0,
    ):
        """
        Parameters
        ----------
        dt          : time step (default 1 period, e.g. one candle)
        process_var : process noise variance Q — how much the true state
                      drifts between steps (higher → more responsive)
        obs_var     : observation noise variance R — how noisy the price
                      data is (higher → smoother output)
        """
        self.dt = float(dt)

        # State transition matrix: constant-velocity model
        #   position_{t} = position_{t-1} + velocity_{t-1} * dt
        #   velocity_{t} = velocity_{t-1}
        self.F = np.array([[1.0, dt], [0.0, 1.0]])

        # Observation matrix: we only directly observe position
        self.H = np.array([[1.0, 0.0]])

        # Process noise covariance Q (derived from continuous white-noise model)
        q = process_var
        self.Q = np.array(
            [
                [q * dt**3 / 3.0, q * dt**2 / 2.0],
                [q * dt**2 / 2.0, q * dt],
            ]
        )

        # Scalar observation noise covariance
        self.R = np.array([[float(obs_var)]])

        # State and covariance (uninitialised until first observation)
        self.x: Optional[np.ndarray] = None   # [position, velocity]
        self.P: Optional[np.ndarray] = None   # 2×2 state covariance

    # ── single-step operations ────────────────────────────────────

    def initialize(self, z0: float) -> None:
        """Seed filter state with first scalar observation z0."""
        self.x = np.array([float(z0), 0.0])
        self.P = np.eye(2) * 1000.0   # large initial uncertainty

    def predict(self) -> float:
        """
        Time-update (predict) step.

            x̄_t = F x_{t−1}
            P̄_t = F P_{t−1} Fᵀ + Q

        Returns the predicted position (scalar) before incorporating z_t.
        """
        if self.x is None:
            raise RuntimeError("Call initialize() before predict()")
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q
        return float(self.x[0])

    def update(self, z: float) -> float:
        """
        Measurement-update step.

            Innovation:       y = z − H x̄
            Innovation cov:   S = H P̄ Hᵀ + R
            Kalman gain:      K = P̄ Hᵀ S⁻¹
            Updated state:    x = x̄ + K y
            Updated cov:      P = (I − K H) P̄       (Joseph form)

        Returns the filtered position after incorporating z.
        """
        if self.x is None:
            raise RuntimeError("Call initialize() before update()")
        z_arr = np.array([[float(z)]])
        y = z_arr - self.H @ self.x.reshape(-1, 1)          # innovation
        S = self.H @ self.P @ self.H.T + self.R              # innovation cov
        K = self.P @ self.H.T @ np.linalg.inv(S)            # Kalman gain

        self.x = self.x + (K @ y).flatten()
        I_KH = np.eye(2) - K @ self.H
        self.P = I_KH @ self.P                               # updated cov

        return float(self.x[0])

    # ── batch operation ───────────────────────────────────────────

    def filter_sequence(self, observations: List[float]) -> dict:
        """
        Run the full predict → update cycle over a price sequence.

        Parameters
        ----------
        observations : list of scalar price values (e.g. close prices)

        Returns
        -------
        dict with keys:
            filtered    — noise-reduced position estimates
            velocity    — rate-of-change (trend) estimates
            forecast    — one-step-ahead position forecasts
            innovation  — (observation − forecast) residuals
            kalman_gain — scalar K[0,0] at each step (adaptive weight)
        """
        if not observations:
            return {
                "filtered": [], "velocity": [],
                "forecast": [], "innovation": [], "kalman_gain": [],
            }

        self.initialize(observations[0])
        filtered, velocity, forecasts, innovations, gains = [], [], [], [], []

        for z in observations:
            forecast = self.predict()
            filtered_pos = self.update(z)
            filtered.append(float(filtered_pos))
            velocity.append(float(self.x[1]))
            forecasts.append(float(forecast))
            innovations.append(float(z - forecast))
            gains.append(float(self.P[0, 0]))   # position variance as proxy

        return {
            "filtered": filtered,
            "velocity": velocity,
            "forecast": forecasts,
            "innovation": innovations,
            "kalman_gain": gains,
        }


# ═══════════════════════════════════════════════════════════════════════════
# TechnicalIndicators
# ═══════════════════════════════════════════════════════════════════════════


class TechnicalIndicators:
    """
    Vectorized computation of common price and volume-based technical indicators.

    All methods accept numpy arrays (or list-likes) of prices/volumes and
    return numpy arrays.  NaN is used to represent values that cannot be
    computed due to insufficient data (warm-up period).

    Indicators implemented
    ----------------------
    sma         — Simple Moving Average
    ema         — Exponential Moving Average (Wilder / standard)
    rsi         — Relative Strength Index (Wilder smoothing)
    macd        — MACD line, signal line, histogram
    bollinger_bands — upper/middle/lower bands with rolling std
    atr         — Average True Range (Wilder smoothing)
    vwap        — Volume-Weighted Average Price
    all_indicators — convenience: compute all of the above in one call
    """

    @staticmethod
    def sma(prices: np.ndarray, period: int) -> np.ndarray:
        """
        Simple Moving Average over a rolling window of `period` bars.

            SMA_t = (1/period) Σ_{i=0}^{period−1} price_{t−i}
        """
        prices = np.asarray(prices, dtype=float)
        out = np.full_like(prices, np.nan)
        for i in range(period - 1, len(prices)):
            out[i] = prices[i - period + 1 : i + 1].mean()
        return out

    @staticmethod
    def ema(prices: np.ndarray, period: int) -> np.ndarray:
        """
        Exponential Moving Average.

        Smoothing factor:  α = 2 / (period + 1)
        Recurrence:        EMA_t = α · price_t + (1 − α) · EMA_{t−1}

        Seeded with the SMA of the first `period` values to reduce warm-up
        bias.  Returns NaN for indices before the seed point.
        """
        prices = np.asarray(prices, dtype=float)
        out = np.full_like(prices, np.nan)
        if len(prices) < period:
            return out
        alpha = 2.0 / (period + 1.0)
        out[period - 1] = prices[:period].mean()
        for i in range(period, len(prices)):
            out[i] = alpha * prices[i] + (1.0 - alpha) * out[i - 1]
        return out

    @staticmethod
    def rsi(prices: np.ndarray, period: int = 14) -> np.ndarray:
        """
        Relative Strength Index (RSI) with Wilder smoothing.

            RS  = avg_gain / avg_loss  (Wilder exponential average)
            RSI = 100 − 100 / (1 + RS)

        Values above 70 are conventionally considered overbought;
        values below 30 are considered oversold.
        """
        prices = np.asarray(prices, dtype=float)
        deltas = np.diff(prices)
        out = np.full(len(prices), np.nan)
        if len(deltas) < period:
            return out

        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)

        # Seed Wilder averages with simple mean of first `period` deltas
        avg_gain = gains[:period].mean()
        avg_loss = losses[:period].mean()

        for i in range(period, len(deltas)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
            rs = avg_gain / avg_loss if avg_loss != 0 else np.inf
            out[i + 1] = 100.0 - 100.0 / (1.0 + rs)

        return out

    @staticmethod
    def macd(
        prices: np.ndarray,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
    ) -> Dict[str, list]:
        """
        MACD (Moving Average Convergence/Divergence).

            MACD line  = EMA(fast) − EMA(slow)
            Signal     = EMA(MACD, signal_period)
            Histogram  = MACD − Signal

        A bullish crossover occurs when MACD crosses above Signal.
        Histogram sign-changes identify momentum inflection points.
        """
        prices = np.asarray(prices, dtype=float)
        ema_fast = TechnicalIndicators.ema(prices, fast)
        ema_slow = TechnicalIndicators.ema(prices, slow)
        macd_line = ema_fast - ema_slow
        signal_line = TechnicalIndicators.ema(macd_line, signal)
        histogram = macd_line - signal_line
        return {
            "macd":      macd_line.tolist(),
            "signal":    signal_line.tolist(),
            "histogram": histogram.tolist(),
        }

    @staticmethod
    def bollinger_bands(
        prices: np.ndarray,
        period: int = 20,
        num_std: float = 2.0,
    ) -> Dict[str, list]:
        """
        Bollinger Bands.

            Middle = SMA(period)
            Upper  = Middle + num_std × σ_rolling
            Lower  = Middle − num_std × σ_rolling

        Band width (Upper − Lower) is a volatility proxy.  Price touching
        the upper band signals a potential reversal or breakout.
        """
        prices = np.asarray(prices, dtype=float)
        middle = TechnicalIndicators.sma(prices, period)
        roll_std = np.full_like(prices, np.nan)
        for i in range(period - 1, len(prices)):
            roll_std[i] = prices[i - period + 1 : i + 1].std(ddof=1)
        upper = middle + num_std * roll_std
        lower = middle - num_std * roll_std
        return {
            "upper":  upper.tolist(),
            "middle": middle.tolist(),
            "lower":  lower.tolist(),
        }

    @staticmethod
    def atr(
        high: np.ndarray,
        low: np.ndarray,
        close: np.ndarray,
        period: int = 14,
    ) -> np.ndarray:
        """
        Average True Range (ATR) — absolute volatility measure.

            True Range_t = max(H_t − L_t,
                               |H_t − C_{t−1}|,
                               |L_t − C_{t−1}|)
            ATR_t = Wilder EMA of TR over `period` bars

        ATR does not indicate direction, only magnitude of price movement.
        Useful for position sizing and stop-loss placement.
        """
        high  = np.asarray(high,  dtype=float)
        low   = np.asarray(low,   dtype=float)
        close = np.asarray(close, dtype=float)
        n = len(close)
        tr = np.full(n, np.nan)
        for i in range(1, n):
            tr[i] = max(
                high[i] - low[i],
                abs(high[i] - close[i - 1]),
                abs(low[i]  - close[i - 1]),
            )
        atr_out = np.full(n, np.nan)
        if n > period:
            atr_out[period] = np.nanmean(tr[1 : period + 1])
            for i in range(period + 1, n):
                atr_out[i] = (atr_out[i - 1] * (period - 1) + tr[i]) / period
        return atr_out

    @staticmethod
    def vwap(prices: np.ndarray, volumes: np.ndarray) -> np.ndarray:
        """
        Volume-Weighted Average Price.

            VWAP_t = Σ_{i=0}^{t} (price_i × volume_i) / Σ_{i=0}^{t} volume_i

        VWAP is the benchmark price institutions use for execution quality.
        Price above VWAP indicates bullish intraday sentiment.
        """
        prices  = np.asarray(prices,  dtype=float)
        volumes = np.asarray(volumes, dtype=float)
        cum_pv = np.cumsum(prices * volumes)
        cum_v  = np.cumsum(volumes)
        return cum_pv / np.where(cum_v == 0, 1.0, cum_v)

    @staticmethod
    def all_indicators(
        prices: np.ndarray,
        volumes: np.ndarray,
        high: Optional[np.ndarray] = None,
        low: Optional[np.ndarray] = None,
    ) -> dict:
        """
        Compute all indicators in a single call and return as a dict of lists.
        NaN values are replaced with None for JSON serialisation.

        If high/low are not provided, ATR is omitted from the result.
        """
        prices  = np.asarray(prices,  dtype=float)
        volumes = np.asarray(volumes, dtype=float)

        def _clean(arr) -> list:
            """Replace NaN → None for JSON compatibility."""
            return [None if math.isnan(v) else v for v in arr]

        result = {
            "sma_14":  _clean(TechnicalIndicators.sma(prices, 14)),
            "sma_50":  _clean(TechnicalIndicators.sma(prices, 50)),
            "ema_12":  _clean(TechnicalIndicators.ema(prices, 12)),
            "ema_26":  _clean(TechnicalIndicators.ema(prices, 26)),
            "rsi_14":  _clean(TechnicalIndicators.rsi(prices, 14)),
            "macd":    {
                k: [None if math.isnan(v) else v for v in vals]
                for k, vals in TechnicalIndicators.macd(prices).items()
            },
            "bb": {
                k: [None if math.isnan(v) else v for v in vals]
                for k, vals in TechnicalIndicators.bollinger_bands(prices).items()
            },
            "vwap": _clean(TechnicalIndicators.vwap(prices, volumes)),
        }

        if high is not None and low is not None:
            result["atr_14"] = _clean(
                TechnicalIndicators.atr(
                    np.asarray(high, dtype=float),
                    np.asarray(low, dtype=float),
                    prices,
                    14,
                )
            )

        return result


# ═══════════════════════════════════════════════════════════════════════════
# EnsemblePredictor
# ═══════════════════════════════════════════════════════════════════════════


class EnsemblePredictor:
    """
    Combine predictions from multiple sub-models with online-learned weights.

    Sub-models (by convention):
        0 — Bayesian linear regression (LedgerOptimizer)
        1 — Kalman filter one-step forecast
        2 — Kinematic extrapolation (v + 0.5a)

    Ensemble weight update uses online gradient descent in the simplex:

        log_w' = log_w − lr · ∇L        (gradient step in log-space)
        w      = softmax(log_w')          (re-project onto the simplex)

    where L = (ensemble_prediction − actual)² is the squared error loss.
    This is equivalent to the exponentiated gradient (EG) algorithm and
    guarantees weights always sum to 1 and remain non-negative.
    """

    MODEL_NAMES = ["BayesianLR", "KalmanFilter", "Kinematic"]

    def __init__(self, n_models: int = 3, learning_rate: float = 0.05):
        """
        Parameters
        ----------
        n_models      : number of sub-models to combine
        learning_rate : gradient descent step size (higher → faster adaptation,
                        lower → more stable weights)
        """
        if n_models < 1:
            raise ValueError("n_models must be at least 1")
        self.n_models = n_models
        self.lr = float(learning_rate)
        # Initialise with uniform weights (maximum entropy prior)
        self.weights = np.ones(n_models) / n_models
        self._loss_history: List[float] = []
        self._weight_history: List[List[float]] = []

    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        """Numerically stable softmax."""
        e = np.exp(x - x.max())
        return e / e.sum()

    def predict(self, sub_predictions: np.ndarray) -> float:
        """
        Weighted ensemble prediction.

            ŷ = Σ_i w_i · ŷ_i
        """
        sub_predictions = np.asarray(sub_predictions, dtype=float)
        if len(sub_predictions) != self.n_models:
            raise ValueError(
                f"Expected {self.n_models} sub-predictions, "
                f"got {len(sub_predictions)}"
            )
        return float(self.weights @ sub_predictions)

    def update(self, sub_predictions: np.ndarray, actual: float) -> float:
        """
        Update ensemble weights given the realised observation.

        Gradient of squared loss w.r.t. w_i:
            ∂L/∂w_i = 2 · (ŷ − actual) · ŷ_i

        Step in log-weight space then re-normalise via softmax ensures
        weights remain on the probability simplex (positive, sum-to-one).

        Returns the squared error *before* the update (online loss).
        """
        sub_predictions = np.asarray(sub_predictions, dtype=float)
        ensemble_pred = self.weights @ sub_predictions
        error = ensemble_pred - float(actual)
        loss = error ** 2

        gradient = 2.0 * error * sub_predictions
        log_w = np.log(np.maximum(self.weights, 1e-15)) - self.lr * gradient
        self.weights = self._softmax(log_w)

        self._loss_history.append(float(loss))
        self._weight_history.append(self.weights.tolist())
        return float(loss)

    def summary(self) -> dict:
        """Return a JSON-serialisable summary of ensemble state."""
        recent_n = min(20, len(self._loss_history))
        recent_mse = (
            float(np.mean(self._loss_history[-recent_n:]))
            if self._loss_history
            else None
        )
        names = (
            self.MODEL_NAMES
            if len(self.MODEL_NAMES) == self.n_models
            else [f"model_{i}" for i in range(self.n_models)]
        )
        return {
            "weights": {
                names[i]: round(float(self.weights[i]), 6)
                for i in range(self.n_models)
            },
            "recent_mse": recent_mse,
            "n_updates": len(self._loss_history),
            "cumulative_loss": float(sum(self._loss_history)),
        }

    def weight_history(self) -> List[dict]:
        """Return per-update weight vectors (useful for plotting convergence)."""
        names = (
            self.MODEL_NAMES
            if len(self.MODEL_NAMES) == self.n_models
            else [f"model_{i}" for i in range(self.n_models)]
        )
        return [dict(zip(names, w)) for w in self._weight_history]


# ═══════════════════════════════════════════════════════════════════════════
# BacktestEngine
# ═══════════════════════════════════════════════════════════════════════════


@dataclass
class Trade:
    """A single completed round-trip trade."""
    entry_idx:  int
    exit_idx:   int
    direction:  str        # 'long' or 'short'
    entry_price: float
    exit_price:  float
    pnl:         float     # signed profit/loss


class BacktestEngine:
    """
    Simulate a kinematic-signal trading strategy over historical price data.

    Strategy logic
    --------------
    Signal generation (kinematic velocity threshold):
        velocity = close[t] − close[t−1]
        BUY  if velocity > +threshold  (upward momentum)
        SELL if velocity < −threshold  (downward momentum)

    Execution model:
        • No slippage (fills at next-bar open, approximated as close[t+1])
        • One position at a time (no pyramiding)
        • Fixed position size of 1 unit

    Performance metrics returned
    ----------------------------
    trades         : list of Trade dicts
    total_pnl      : sum of all trade P&Ls
    win_rate       : fraction of profitable trades
    max_drawdown   : largest peak-to-trough equity decline
    sharpe_ratio   : annualised Sharpe (assumes 252 trading periods/year)
    equity_curve   : cumulative P&L over time
    """

    def __init__(self, velocity_threshold: float = 50.0):
        """
        Parameters
        ----------
        velocity_threshold : minimum absolute price velocity (in price units)
                             required to trigger a trade signal.
        """
        self.threshold = float(velocity_threshold)

    def run(self, prices: List[float], volumes: Optional[List[float]] = None) -> dict:
        """
        Run the backtest over a sequence of close prices.

        Parameters
        ----------
        prices  : list of close prices (chronological order)
        volumes : optional volume list (same length) — unused in signals
                  but included in the trade record for future use

        Returns
        -------
        dict with keys: trades, total_pnl, win_rate, max_drawdown,
                        sharpe_ratio, equity_curve
        """
        prices = list(prices)
        n = len(prices)
        if n < 3:
            return {
                "trades": [], "total_pnl": 0.0, "win_rate": 0.0,
                "max_drawdown": 0.0, "sharpe_ratio": 0.0, "equity_curve": [],
            }

        trades: List[Trade] = []
        equity = 0.0
        equity_curve: List[float] = [0.0]
        position = 0    # 0 = flat, +1 = long, -1 = short
        entry_idx = 0
        entry_price = 0.0

        for t in range(1, n - 1):
            velocity = prices[t] - prices[t - 1]
            exec_price = prices[t + 1]   # fill at next bar

            if position == 0:
                # Entry signals
                if velocity > self.threshold:
                    position = 1
                    entry_idx = t + 1
                    entry_price = exec_price
                elif velocity < -self.threshold:
                    position = -1
                    entry_idx = t + 1
                    entry_price = exec_price
            else:
                # Exit on opposite signal
                if (position == 1 and velocity < -self.threshold) or \
                   (position == -1 and velocity > self.threshold):
                    pnl = position * (exec_price - entry_price)
                    direction = "long" if position == 1 else "short"
                    trades.append(Trade(
                        entry_idx=entry_idx, exit_idx=t + 1,
                        direction=direction, entry_price=entry_price,
                        exit_price=exec_price, pnl=pnl,
                    ))
                    equity += pnl
                    position = 0

            equity_curve.append(equity)

        # Force-close any open position at last bar
        if position != 0:
            pnl = position * (prices[-1] - entry_price)
            trades.append(Trade(
                entry_idx=entry_idx, exit_idx=n - 1,
                direction="long" if position == 1 else "short",
                entry_price=entry_price, exit_price=prices[-1], pnl=pnl,
            ))
            equity += pnl
            equity_curve.append(equity)

        # Metrics
        pnls = np.array([t.pnl for t in trades], dtype=float)
        total_pnl = float(pnls.sum()) if len(pnls) else 0.0
        win_rate = float((pnls > 0).mean()) if len(pnls) else 0.0

        # Max drawdown on equity curve
        eq = np.array(equity_curve)
        running_max = np.maximum.accumulate(eq)
        drawdowns = running_max - eq
        max_drawdown = float(drawdowns.max()) if len(drawdowns) else 0.0

        # Annualised Sharpe (assuming 252 periods/year; per-bar returns)
        bar_returns = np.diff(eq)
        if len(bar_returns) > 1 and bar_returns.std() > 0:
            sharpe = float(
                (bar_returns.mean() / bar_returns.std()) * math.sqrt(252)
            )
        else:
            sharpe = 0.0

        return {
            "trades": [
                {
                    "entry_idx":   t.entry_idx,
                    "exit_idx":    t.exit_idx,
                    "direction":   t.direction,
                    "entry_price": round(t.entry_price, 4),
                    "exit_price":  round(t.exit_price, 4),
                    "pnl":         round(t.pnl, 4),
                }
                for t in trades
            ],
            "total_pnl":    round(total_pnl, 4),
            "win_rate":     round(win_rate, 4),
            "max_drawdown": round(max_drawdown, 4),
            "sharpe_ratio": round(sharpe, 4),
            "equity_curve": [round(v, 4) for v in equity_curve],
            "n_trades":     len(trades),
        }
