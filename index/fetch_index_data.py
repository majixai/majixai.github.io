#!/usr/bin/env python3
"""
Fetch 1-minute data for major market indices from yfinance.
Store data in compressed SQLite databases and CSV files.
Supports incremental updates (appends only new data).
Uses concurrent/parallel processing for faster data fetching.

Advanced Analytics Features:
- Multivariate matrix operations and covariance analysis
- Differential calculus for rate of change analysis
- Complex analysis (arctan, exponential, imaginary components)
- Damping functions for oscillation analysis
- Lagrange optimization
- Green's/Stokes' theorem for path integrals
- Ito stochastic calculus for option pricing
- Beta estimation (CAPM)
- Hamiltonian mechanics for market energy analysis
- Vector field analysis
"""

import yfinance as yf
import pandas as pd
import sqlite3
import gzip
import os
import argparse
import json
import asyncio
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod
import threading
import numpy as np
import cmath

# Optional imports for advanced analytics
try:
    from scipy import stats, integrate, optimize, linalg
    from scipy.signal import find_peaks, savgol_filter
    from scipy.interpolate import interp1d, CubicSpline
    from scipy.fft import fft, ifft, fftfreq
    from scipy.special import erf, erfc
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    # Fallback erf approximation using Abramowitz and Stegun formula 7.1.26
    # Reference: Handbook of Mathematical Functions, 1964
    # Coefficients provide accuracy to within 1.5×10^-7
    def erf(x):
        """
        Approximation of error function using Abramowitz and Stegun formula 7.1.26.
        Reference: Handbook of Mathematical Functions (1964), formula 7.1.26
        Maximum error: 1.5×10^-7
        """
        # Abramowitz and Stegun coefficients
        a1 = 0.254829592
        a2 = -0.284496736
        a3 = 1.421413741
        a4 = -1.453152027
        a5 = 1.061405429
        p = 0.3275911  # Scaling parameter
        
        sign = np.sign(x)
        x = np.abs(x)
        t = 1.0 / (1.0 + p * x)
        y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * np.exp(-x * x)
        return sign * y
    print("Warning: scipy not available, advanced analytics disabled")

try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("Warning: tensorflow not available, ML features disabled")


# =============================================================================
# CONSTANTS
# =============================================================================

# Trading calendar constants
TRADING_DAYS_PER_YEAR = 252  # Standard US market trading days
TRADING_MINUTES_PER_DAY = 390  # 6.5 hours * 60 minutes (9:30 AM - 4:00 PM ET)
MINUTES_PER_YEAR = TRADING_DAYS_PER_YEAR * TRADING_MINUTES_PER_DAY

# Mathematical constants for normal distribution approximation
# Used in fast tanh-based CDF approximation: 0.5 * (1 + tanh(x * TANH_CDF_SCALE))
# This constant ≈ sqrt(2/π) provides a good approximation to the normal CDF
TANH_CDF_SCALE = 0.7978845608  # ≈ sqrt(2/π)



# =============================================================================
# INTERFACES AND ABSTRACT BASE CLASSES
# =============================================================================

class IAnalytics(ABC):
    """Interface for analytics computations."""
    
    @abstractmethod
    def compute(self, data: np.ndarray) -> Dict[str, Any]:
        """Compute analytics on the given data."""
        pass


class IStochasticProcess(ABC):
    """Interface for stochastic process implementations."""
    
    @abstractmethod
    def simulate(self, S0: float, T: float, steps: int) -> np.ndarray:
        """Simulate the stochastic process."""
        pass
    
    @abstractmethod
    def expected_value(self, S0: float, T: float) -> float:
        """Calculate expected value at time T."""
        pass


class IVectorField(ABC):
    """Interface for vector field operations."""
    
    @abstractmethod
    def evaluate(self, x: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Evaluate the vector field at given points."""
        pass


# =============================================================================
# DATA CLASSES FOR STRUCTURED OUTPUT
# =============================================================================

@dataclass
class MatrixAnalytics:
    """Multivariate matrix analytics results."""
    covariance_matrix: List[List[float]]
    correlation_matrix: List[List[float]]
    eigenvalues: List[float]
    eigenvectors: List[List[float]]
    condition_number: float
    determinant: float
    trace: float
    rank: int
    frobenius_norm: float


@dataclass
class DifferentialAnalytics:
    """Differential calculus analytics results."""
    first_derivative: List[float]
    second_derivative: List[float]
    gradient_magnitude: float
    laplacian: float
    divergence: float
    curl_magnitude: float


@dataclass
class StochasticAnalytics:
    """Ito stochastic calculus analytics results."""
    drift: float
    volatility: float
    ito_integral: float
    quadratic_variation: float
    expected_value: float
    variance: float


@dataclass
class HamiltonianState:
    """Hamiltonian system state."""
    position: float
    momentum: float
    energy: float
    kinetic_energy: float
    potential_energy: float


@dataclass
class BetaEstimate:
    """CAPM Beta estimation results."""
    beta: float
    alpha: float
    r_squared: float
    std_error: float
    t_statistic: float
    p_value: float


# =============================================================================
# ADVANCED MATHEMATICAL OBJECTS
# =============================================================================

class ComplexAnalytics:
    """Complex analysis utilities including arctan, exponential, and imaginary components."""
    
    @staticmethod
    def complex_return(prices: np.ndarray) -> np.ndarray:
        """
        Calculate complex returns using Euler's formula.
        z = r * e^(i*theta) where theta is the log return.
        """
        log_returns = np.diff(np.log(prices))
        # Map returns to complex plane
        return np.array([cmath.exp(1j * r) for r in log_returns])
    
    @staticmethod
    def arctan_transform(x: np.ndarray) -> np.ndarray:
        """Apply arctan transformation for bounded output."""
        return np.arctan(x)
    
    @staticmethod
    def complex_momentum(prices: np.ndarray, window: int = 20) -> np.ndarray:
        """
        Calculate momentum using complex exponential.
        Uses e^(i*2*pi*k/N) for frequency analysis.
        """
        n = len(prices)
        k = np.arange(n)
        phase = np.exp(2j * np.pi * k / window)
        return np.abs(np.convolve(prices, phase, mode='same'))
    
    @staticmethod
    def damped_oscillation(t: np.ndarray, amplitude: float, 
                           frequency: float, damping: float, 
                           phase: float = 0) -> np.ndarray:
        """
        Model damped oscillation: A * e^(-γt) * cos(ωt + φ)
        """
        return amplitude * np.exp(-damping * t) * np.cos(2 * np.pi * frequency * t + phase)
    
    @staticmethod
    def fit_damped_oscillation(data: np.ndarray) -> Dict[str, float]:
        """Fit damped oscillation parameters to data."""
        if not SCIPY_AVAILABLE:
            return {}
        
        t = np.arange(len(data))
        
        def damped_model(t, A, gamma, omega, phi, offset):
            return A * np.exp(-gamma * t) * np.cos(omega * t + phi) + offset
        
        try:
            # Initial guesses
            p0 = [np.std(data), 0.01, 0.1, 0, np.mean(data)]
            bounds = ([0, 0, 0, -np.pi, -np.inf], [np.inf, 1, 10, np.pi, np.inf])
            
            popt, pcov = optimize.curve_fit(damped_model, t, data, p0=p0, bounds=bounds, maxfev=5000)
            
            return {
                "amplitude": float(popt[0]),
                "damping_coefficient": float(popt[1]),
                "angular_frequency": float(popt[2]),
                "phase": float(popt[3]),
                "offset": float(popt[4])
            }
        except:
            return {}


class MultivariateMatrix:
    """Multivariate matrix operations and analysis."""
    
    def __init__(self, data: np.ndarray):
        """Initialize with data matrix (rows: observations, cols: variables)."""
        self.data = data
        self.n_obs, self.n_vars = data.shape
    
    def covariance_matrix(self) -> np.ndarray:
        """Calculate sample covariance matrix."""
        return np.cov(self.data, rowvar=False)
    
    def correlation_matrix(self) -> np.ndarray:
        """Calculate correlation matrix."""
        return np.corrcoef(self.data, rowvar=False)
    
    def eigendecomposition(self) -> Tuple[np.ndarray, np.ndarray]:
        """Perform eigendecomposition of covariance matrix."""
        cov = self.covariance_matrix()
        eigenvalues, eigenvectors = np.linalg.eig(cov)
        # Sort by eigenvalue magnitude
        idx = np.argsort(eigenvalues)[::-1]
        return eigenvalues[idx].real, eigenvectors[:, idx].real
    
    def principal_components(self, n_components: int = None) -> np.ndarray:
        """Calculate principal components."""
        eigenvalues, eigenvectors = self.eigendecomposition()
        if n_components is None:
            n_components = self.n_vars
        
        # Center data
        centered = self.data - np.mean(self.data, axis=0)
        # Project onto principal components
        return centered @ eigenvectors[:, :n_components]
    
    def condition_number(self) -> float:
        """Calculate condition number of the data matrix."""
        return float(np.linalg.cond(self.data))
    
    def matrix_analytics(self) -> MatrixAnalytics:
        """Compute comprehensive matrix analytics."""
        cov = self.covariance_matrix()
        corr = self.correlation_matrix()
        eigenvalues, eigenvectors = self.eigendecomposition()
        
        return MatrixAnalytics(
            covariance_matrix=cov.tolist(),
            correlation_matrix=corr.tolist(),
            eigenvalues=eigenvalues.tolist(),
            eigenvectors=eigenvectors.tolist(),
            condition_number=self.condition_number(),
            determinant=float(np.linalg.det(cov)),
            trace=float(np.trace(cov)),
            rank=int(np.linalg.matrix_rank(self.data)),
            frobenius_norm=float(np.linalg.norm(cov, 'fro'))
        )


class DifferentialCalculus:
    """Differential calculus operations on time series data."""
    
    def __init__(self, data: np.ndarray, dt: float = 1.0):
        self.data = data
        self.dt = dt
    
    def first_derivative(self) -> np.ndarray:
        """Calculate first derivative using central differences."""
        return np.gradient(self.data, self.dt)
    
    def second_derivative(self) -> np.ndarray:
        """Calculate second derivative."""
        first = self.first_derivative()
        return np.gradient(first, self.dt)
    
    def nth_derivative(self, n: int) -> np.ndarray:
        """Calculate nth derivative."""
        result = self.data.copy()
        for _ in range(n):
            result = np.gradient(result, self.dt)
        return result
    
    def laplacian(self) -> float:
        """Calculate discrete Laplacian (sum of second partial derivatives)."""
        return float(np.mean(self.second_derivative()))
    
    def gradient_magnitude(self) -> float:
        """Calculate average gradient magnitude."""
        grad = self.first_derivative()
        return float(np.mean(np.abs(grad)))
    
    def compute_analytics(self) -> DifferentialAnalytics:
        """Compute comprehensive differential analytics."""
        first_deriv = self.first_derivative()
        second_deriv = self.second_derivative()
        
        return DifferentialAnalytics(
            first_derivative=first_deriv.tolist(),
            second_derivative=second_deriv.tolist(),
            gradient_magnitude=self.gradient_magnitude(),
            laplacian=self.laplacian(),
            divergence=float(np.sum(first_deriv)),
            curl_magnitude=0.0  # 1D data has no curl
        )


class LagrangeOptimizer:
    """Lagrange multiplier optimization for portfolio constraints."""
    
    @staticmethod
    def optimize_portfolio(returns: np.ndarray, 
                          target_return: float = None,
                          risk_free_rate: float = 0.02) -> Dict[str, Any]:
        """
        Optimize portfolio weights using Lagrange multipliers.
        Minimize variance subject to target return constraint.
        """
        if not SCIPY_AVAILABLE:
            return {}
        
        n_assets = returns.shape[1]
        mean_returns = np.mean(returns, axis=0)
        cov_matrix = np.cov(returns, rowvar=False)
        
        if target_return is None:
            target_return = np.mean(mean_returns)
        
        # Lagrangian: L = w'Σw - λ₁(w'μ - r) - λ₂(w'1 - 1)
        # Using scipy optimize
        def objective(w):
            return w @ cov_matrix @ w
        
        def constraint_return(w):
            return w @ mean_returns - target_return
        
        def constraint_weights(w):
            return np.sum(w) - 1
        
        constraints = [
            {'type': 'eq', 'fun': constraint_return},
            {'type': 'eq', 'fun': constraint_weights}
        ]
        
        bounds = [(0, 1) for _ in range(n_assets)]
        x0 = np.ones(n_assets) / n_assets
        
        result = optimize.minimize(objective, x0, method='SLSQP',
                                  bounds=bounds, constraints=constraints)
        
        if result.success:
            weights = result.x
            portfolio_return = weights @ mean_returns
            portfolio_std = np.sqrt(weights @ cov_matrix @ weights)
            sharpe_ratio = (portfolio_return - risk_free_rate) / portfolio_std
            
            return {
                "weights": weights.tolist(),
                "expected_return": float(portfolio_return),
                "volatility": float(portfolio_std),
                "sharpe_ratio": float(sharpe_ratio),
                "lagrange_multiplier": float(result.get('lambda', [0])[0] if 'lambda' in dir(result) else 0)
            }
        
        return {"error": "Optimization failed"}


class GreensStokesTheorem:
    """
    Green's and Stokes' theorem applications for financial path integrals.
    Used to calculate work done along trading paths and circulation.
    """
    
    @staticmethod
    def line_integral(price_path: np.ndarray, 
                     volume_path: np.ndarray) -> float:
        """
        Calculate line integral along price-volume path.
        ∮ F · dr where F = (price, volume) and path is time evolution.
        """
        # Calculate work done: ∫ P dV (price-volume work)
        dp = np.diff(price_path)
        dv = np.diff(volume_path)
        
        # Average price and volume at each step
        avg_p = (price_path[:-1] + price_path[1:]) / 2
        avg_v = (volume_path[:-1] + volume_path[1:]) / 2
        
        # Line integral: ∫ P dV + V dP
        work = np.sum(avg_p * dv + avg_v * dp)
        return float(work)
    
    @staticmethod
    def circulation(returns: np.ndarray, window: int = 20) -> np.ndarray:
        """
        Calculate circulation (curl integral) over rolling windows.
        Measures rotational tendency in return space.
        """
        n = len(returns)
        circulation = np.zeros(n - window)
        
        for i in range(n - window):
            subset = returns[i:i + window]
            # Create closed path
            x = np.arange(window)
            y = subset
            
            # Calculate circulation using Green's theorem
            # ∮ F · dr = ∬ (∂Q/∂x - ∂P/∂y) dA
            dx = np.diff(x)
            dy = np.diff(y)
            
            # Approximate curl
            circulation[i] = np.sum(x[:-1] * dy - y[:-1] * dx)
        
        return circulation
    
    @staticmethod
    def flux_integral(price: np.ndarray, 
                     volume: np.ndarray) -> float:
        """
        Calculate flux through price-volume surface.
        """
        if not SCIPY_AVAILABLE:
            return 0.0
        
        # Create vector field F = (P, V)
        # Flux = ∬ F · n dS
        dp = np.gradient(price)
        dv = np.gradient(volume)
        
        # Normal vector approximation
        magnitude = np.sqrt(dp**2 + dv**2)
        magnitude[magnitude == 0] = 1
        
        n_x = -dv / magnitude
        n_y = dp / magnitude
        
        # Flux = P * n_x + V * n_y
        flux = np.sum(price * n_x + volume * n_y)
        return float(flux)


class ItoStochasticCalculus(IStochasticProcess):
    """
    Ito stochastic calculus for financial modeling.
    Implements Geometric Brownian Motion and related processes.
    """
    
    def __init__(self, mu: float, sigma: float):
        """
        Initialize with drift (mu) and volatility (sigma).
        dS = μS dt + σS dW (GBM)
        """
        self.mu = mu  # Drift
        self.sigma = sigma  # Volatility
    
    def simulate(self, S0: float, T: float, steps: int) -> np.ndarray:
        """
        Simulate Geometric Brownian Motion using Euler-Maruyama.
        """
        dt = T / steps
        sqrt_dt = np.sqrt(dt)
        
        # Generate Wiener process increments
        dW = np.random.normal(0, sqrt_dt, steps)
        
        # Initialize price path
        S = np.zeros(steps + 1)
        S[0] = S0
        
        # Euler-Maruyama discretization
        for i in range(steps):
            S[i + 1] = S[i] * (1 + self.mu * dt + self.sigma * dW[i])
        
        return S
    
    def expected_value(self, S0: float, T: float) -> float:
        """Calculate expected value E[S_T] = S_0 * exp(μT)."""
        return S0 * np.exp(self.mu * T)
    
    def variance(self, S0: float, T: float) -> float:
        """Calculate Var[S_T]."""
        return S0**2 * np.exp(2 * self.mu * T) * (np.exp(self.sigma**2 * T) - 1)
    
    def ito_integral(self, S: np.ndarray, dt: float) -> float:
        """
        Approximate Ito integral ∫ S dW using Ito's lemma.
        """
        n = len(S) - 1
        dW = np.diff(S) / S[:-1] - self.mu * dt
        
        # Ito integral approximation
        integral = np.sum(S[:-1] * dW)
        return float(integral)
    
    def quadratic_variation(self, S: np.ndarray) -> float:
        """
        Calculate quadratic variation [S, S]_T.
        For continuous semimartingale, this approximates ∫σ²S² dt.
        """
        log_returns = np.diff(np.log(S))
        return float(np.sum(log_returns**2))
    
    @staticmethod
    def estimate_from_data(prices: np.ndarray, 
                          dt: float = 1/252) -> 'ItoStochasticCalculus':
        """Estimate GBM parameters from price data."""
        log_returns = np.diff(np.log(prices))
        
        # Annualized parameters
        mu = np.mean(log_returns) / dt
        sigma = np.std(log_returns) / np.sqrt(dt)
        
        return ItoStochasticCalculus(mu, sigma)
    
    def compute_analytics(self, prices: np.ndarray, 
                         dt: float = 1.0) -> StochasticAnalytics:
        """Compute comprehensive stochastic analytics."""
        S0 = prices[0]
        T = len(prices) * dt
        
        return StochasticAnalytics(
            drift=self.mu,
            volatility=self.sigma,
            ito_integral=self.ito_integral(prices, dt),
            quadratic_variation=self.quadratic_variation(prices),
            expected_value=self.expected_value(S0, T),
            variance=self.variance(S0, T)
        )


class BetaHatEstimator:
    """
    Beta estimation using various methods including OLS, 
    Dimson beta, and Scholes-Williams beta.
    """
    
    @staticmethod
    def ols_beta(asset_returns: np.ndarray, 
                 market_returns: np.ndarray) -> BetaEstimate:
        """
        Estimate beta using Ordinary Least Squares.
        R_i = α + β R_m + ε
        """
        if not SCIPY_AVAILABLE:
            # Fallback calculation
            cov = np.cov(asset_returns, market_returns)[0, 1]
            var = np.var(market_returns)
            beta = cov / var if var > 0 else 0
            return BetaEstimate(beta=beta, alpha=0, r_squared=0, 
                               std_error=0, t_statistic=0, p_value=1)
        
        # Add constant for intercept
        X = np.column_stack([np.ones(len(market_returns)), market_returns])
        
        # OLS estimation
        result = stats.linregress(market_returns, asset_returns)
        
        return BetaEstimate(
            beta=float(result.slope),
            alpha=float(result.intercept),
            r_squared=float(result.rvalue**2),
            std_error=float(result.stderr),
            t_statistic=float(result.slope / result.stderr if result.stderr > 0 else 0),
            p_value=float(result.pvalue)
        )
    
    @staticmethod
    def dimson_beta(asset_returns: np.ndarray, 
                    market_returns: np.ndarray, 
                    lags: int = 1) -> float:
        """
        Dimson beta for thinly traded stocks.
        Includes lagged market returns to capture delayed price adjustment.
        """
        if len(asset_returns) <= lags + 1:
            return BetaHatEstimator.ols_beta(asset_returns, market_returns).beta
        
        # Build lagged market returns matrix
        n = len(market_returns)
        X_list = [market_returns[lags:]]
        
        for lag in range(1, lags + 1):
            X_list.append(market_returns[lags - lag:n - lag])
        
        X = np.column_stack(X_list)
        y = asset_returns[lags:]
        
        # OLS with lagged terms
        if SCIPY_AVAILABLE:
            betas, residuals, rank, s = np.linalg.lstsq(X, y, rcond=None)
            return float(np.sum(betas))  # Sum of all betas
        
        return BetaHatEstimator.ols_beta(asset_returns, market_returns).beta
    
    @staticmethod
    def rolling_beta(asset_returns: np.ndarray, 
                     market_returns: np.ndarray, 
                     window: int = 60) -> np.ndarray:
        """Calculate rolling beta over specified window."""
        n = len(asset_returns)
        betas = np.full(n, np.nan)
        
        for i in range(window, n):
            asset_window = asset_returns[i - window:i]
            market_window = market_returns[i - window:i]
            
            cov = np.cov(asset_window, market_window)[0, 1]
            var = np.var(market_window)
            betas[i] = cov / var if var > 0 else 0
        
        return betas


# =============================================================================
# BLACK-SCHOLES-MERTON MODEL WITH GREEKS
# =============================================================================

@dataclass
class OptionGreeks:
    """Complete set of option Greeks."""
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float
    vanna: float
    volga: float
    charm: float
    veta: float
    speed: float
    zomma: float
    color: float
    ultima: float


@dataclass
class BSMResult:
    """Black-Scholes-Merton pricing result."""
    call_price: float
    put_price: float
    call_greeks: OptionGreeks
    put_greeks: OptionGreeks
    implied_volatility: float
    d1: float
    d2: float


@dataclass
class RiskMetrics:
    """Comprehensive risk metrics."""
    var_95: float
    var_99: float
    cvar_95: float
    cvar_99: float
    max_drawdown: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    omega_ratio: float
    tail_ratio: float
    downside_deviation: float
    upside_deviation: float


@dataclass
class VolatilitySurface:
    """Volatility surface data."""
    strikes: List[float]
    maturities: List[float]
    implied_vols: List[List[float]]
    skew: List[float]
    term_structure: List[float]
    smile_curvature: List[float]


@dataclass
class EfficientFrontierPoint:
    """Point on efficient frontier."""
    expected_return: float
    volatility: float
    sharpe_ratio: float
    weights: List[float]


class BlackScholesMerton:
    """
    Complete Black-Scholes-Merton implementation with all Greeks.
    Includes time decay, risk analysis, and volatility modeling.
    """
    
    def __init__(self, S: float, K: float, T: float, r: float, sigma: float, q: float = 0):
        """
        Initialize BSM model.
        
        Args:
            S: Current stock price
            K: Strike price
            T: Time to maturity (in years)
            r: Risk-free interest rate
            sigma: Volatility
            q: Dividend yield (default 0)
        """
        self.S = S
        self.K = K
        self.T = max(T, 1e-10)  # Avoid division by zero
        self.r = r
        self.sigma = sigma
        self.q = q
        
        # Pre-calculate d1 and d2
        self._calculate_d1_d2()
    
    def _calculate_d1_d2(self):
        """Calculate d1 and d2 parameters."""
        sqrt_T = np.sqrt(self.T)
        self.d1 = (np.log(self.S / self.K) + (self.r - self.q + 0.5 * self.sigma**2) * self.T) / (self.sigma * sqrt_T)
        self.d2 = self.d1 - self.sigma * sqrt_T
    
    @staticmethod
    def _norm_cdf(x: float) -> float:
        """Standard normal cumulative distribution function."""
        return 0.5 * (1 + erf(x / np.sqrt(2))) if SCIPY_AVAILABLE else 0.5 * (1 + np.tanh(x * TANH_CDF_SCALE))
    
    @staticmethod
    def _norm_pdf(x: float) -> float:
        """Standard normal probability density function."""
        return np.exp(-0.5 * x**2) / np.sqrt(2 * np.pi)
    
    def call_price(self) -> float:
        """Calculate call option price."""
        return (self.S * np.exp(-self.q * self.T) * self._norm_cdf(self.d1) - 
                self.K * np.exp(-self.r * self.T) * self._norm_cdf(self.d2))
    
    def put_price(self) -> float:
        """Calculate put option price."""
        return (self.K * np.exp(-self.r * self.T) * self._norm_cdf(-self.d2) - 
                self.S * np.exp(-self.q * self.T) * self._norm_cdf(-self.d1))
    
    # =========================================================================
    # FIRST ORDER GREEKS
    # =========================================================================
    
    def delta_call(self) -> float:
        """Delta for call option: ∂C/∂S."""
        return np.exp(-self.q * self.T) * self._norm_cdf(self.d1)
    
    def delta_put(self) -> float:
        """Delta for put option: ∂P/∂S."""
        return np.exp(-self.q * self.T) * (self._norm_cdf(self.d1) - 1)
    
    def theta_call(self) -> float:
        """
        Theta for call option: -∂C/∂T (time decay per day).
        Negative value indicates option loses value over time.
        """
        term1 = -(self.S * self.sigma * np.exp(-self.q * self.T) * self._norm_pdf(self.d1)) / (2 * np.sqrt(self.T))
        term2 = self.q * self.S * np.exp(-self.q * self.T) * self._norm_cdf(self.d1)
        term3 = -self.r * self.K * np.exp(-self.r * self.T) * self._norm_cdf(self.d2)
        return (term1 + term2 + term3) / 365  # Per day
    
    def theta_put(self) -> float:
        """Theta for put option: -∂P/∂T."""
        term1 = -(self.S * self.sigma * np.exp(-self.q * self.T) * self._norm_pdf(self.d1)) / (2 * np.sqrt(self.T))
        term2 = -self.q * self.S * np.exp(-self.q * self.T) * self._norm_cdf(-self.d1)
        term3 = self.r * self.K * np.exp(-self.r * self.T) * self._norm_cdf(-self.d2)
        return (term1 + term2 + term3) / 365  # Per day
    
    def vega(self) -> float:
        """Vega: ∂V/∂σ (same for call and put)."""
        return self.S * np.exp(-self.q * self.T) * self._norm_pdf(self.d1) * np.sqrt(self.T) / 100
    
    def rho_call(self) -> float:
        """Rho for call option: ∂C/∂r."""
        return self.K * self.T * np.exp(-self.r * self.T) * self._norm_cdf(self.d2) / 100
    
    def rho_put(self) -> float:
        """Rho for put option: ∂P/∂r."""
        return -self.K * self.T * np.exp(-self.r * self.T) * self._norm_cdf(-self.d2) / 100
    
    # =========================================================================
    # SECOND ORDER GREEKS
    # =========================================================================
    
    def gamma(self) -> float:
        """Gamma: ∂²V/∂S² (same for call and put)."""
        return (np.exp(-self.q * self.T) * self._norm_pdf(self.d1)) / (self.S * self.sigma * np.sqrt(self.T))
    
    def vanna(self) -> float:
        """Vanna: ∂²V/∂S∂σ = ∂Δ/∂σ."""
        return -np.exp(-self.q * self.T) * self._norm_pdf(self.d1) * self.d2 / self.sigma
    
    def volga(self) -> float:
        """Volga (Vomma): ∂²V/∂σ²."""
        return self.vega() * self.d1 * self.d2 / self.sigma
    
    def charm_call(self) -> float:
        """Charm (Delta decay): ∂Δ/∂T for call."""
        term1 = self.q * np.exp(-self.q * self.T) * self._norm_cdf(self.d1)
        term2 = np.exp(-self.q * self.T) * self._norm_pdf(self.d1)
        term2 *= (2 * (self.r - self.q) * self.T - self.d2 * self.sigma * np.sqrt(self.T)) / (2 * self.T * self.sigma * np.sqrt(self.T))
        return -(term1 - term2) / 365
    
    def charm_put(self) -> float:
        """Charm for put option."""
        term1 = -self.q * np.exp(-self.q * self.T) * self._norm_cdf(-self.d1)
        term2 = np.exp(-self.q * self.T) * self._norm_pdf(self.d1)
        term2 *= (2 * (self.r - self.q) * self.T - self.d2 * self.sigma * np.sqrt(self.T)) / (2 * self.T * self.sigma * np.sqrt(self.T))
        return -(term1 - term2) / 365
    
    def veta(self) -> float:
        """Veta: ∂Vega/∂T."""
        sqrt_T = np.sqrt(self.T)
        term1 = self.q
        term2 = (self.r - self.q) * self.d1 / (self.sigma * sqrt_T)
        term3 = (1 + self.d1 * self.d2) / (2 * self.T)
        return -self.S * np.exp(-self.q * self.T) * self._norm_pdf(self.d1) * sqrt_T * (term1 + term2 - term3) / 100
    
    # =========================================================================
    # THIRD ORDER GREEKS
    # =========================================================================
    
    def speed(self) -> float:
        """Speed: ∂Γ/∂S = ∂³V/∂S³."""
        return -self.gamma() * (1 + self.d1 / (self.sigma * np.sqrt(self.T))) / self.S
    
    def zomma(self) -> float:
        """Zomma: ∂Γ/∂σ."""
        return self.gamma() * (self.d1 * self.d2 - 1) / self.sigma
    
    def color(self) -> float:
        """Color: ∂Γ/∂T."""
        sqrt_T = np.sqrt(self.T)
        term1 = 2 * (self.r - self.q) * self.T - self.d2 * self.sigma * sqrt_T
        term2 = self.d1 / (self.sigma * sqrt_T)
        return -self.gamma() * (self.q + term1 * term2 / (2 * self.T * self.sigma * sqrt_T)) / 365
    
    def ultima(self) -> float:
        """Ultima: ∂Volga/∂σ."""
        d1d2 = self.d1 * self.d2
        return -self.vega() * (d1d2 * (1 - d1d2) + self.d1**2 + self.d2**2) / self.sigma**2
    
    def get_call_greeks(self) -> OptionGreeks:
        """Get all Greeks for call option."""
        return OptionGreeks(
            delta=self.delta_call(),
            gamma=self.gamma(),
            theta=self.theta_call(),
            vega=self.vega(),
            rho=self.rho_call(),
            vanna=self.vanna(),
            volga=self.volga(),
            charm=self.charm_call(),
            veta=self.veta(),
            speed=self.speed(),
            zomma=self.zomma(),
            color=self.color(),
            ultima=self.ultima()
        )
    
    def get_put_greeks(self) -> OptionGreeks:
        """Get all Greeks for put option."""
        return OptionGreeks(
            delta=self.delta_put(),
            gamma=self.gamma(),
            theta=self.theta_put(),
            vega=self.vega(),
            rho=self.rho_put(),
            vanna=self.vanna(),
            volga=self.volga(),
            charm=self.charm_put(),
            veta=self.veta(),
            speed=self.speed(),
            zomma=self.zomma(),
            color=self.color(),
            ultima=self.ultima()
        )
    
    def get_full_result(self) -> BSMResult:
        """Get complete BSM pricing result."""
        return BSMResult(
            call_price=self.call_price(),
            put_price=self.put_price(),
            call_greeks=self.get_call_greeks(),
            put_greeks=self.get_put_greeks(),
            implied_volatility=self.sigma,
            d1=self.d1,
            d2=self.d2
        )
    
    @staticmethod
    def implied_volatility(market_price: float, S: float, K: float, T: float, 
                          r: float, is_call: bool = True, q: float = 0,
                          max_iterations: int = 100, tolerance: float = 1e-6) -> float:
        """
        Calculate implied volatility using Newton-Raphson method.
        """
        sigma = 0.2  # Initial guess
        
        for _ in range(max_iterations):
            bsm = BlackScholesMerton(S, K, T, r, sigma, q)
            price = bsm.call_price() if is_call else bsm.put_price()
            vega = bsm.vega() * 100  # Undo the /100 scaling
            
            if abs(vega) < 1e-10:
                break
            
            diff = market_price - price
            if abs(diff) < tolerance:
                return sigma
            
            sigma += diff / vega
            sigma = max(0.001, min(sigma, 5.0))  # Bound sigma
        
        return sigma


class VolatilityAnalytics:
    """
    Volatility surface, skew, and term structure analysis.
    """
    
    def __init__(self, prices: np.ndarray, returns: np.ndarray = None):
        self.prices = prices
        self.returns = returns if returns is not None else np.diff(np.log(prices))
    
    def realized_volatility(self, window: int = 20, annualize: bool = True) -> np.ndarray:
        """Calculate rolling realized volatility."""
        n = len(self.returns)
        vol = np.full(n, np.nan)
        
        for i in range(window, n):
            vol[i] = np.std(self.returns[i-window:i])
        
        if annualize:
            vol *= np.sqrt(252)  # Annualize
        
        return vol
    
    def parkinson_volatility(self, high: np.ndarray, low: np.ndarray, 
                            window: int = 20) -> np.ndarray:
        """
        Parkinson volatility estimator using high-low range.
        More efficient than close-to-close.
        """
        log_hl = np.log(high / low)**2
        factor = 1 / (4 * np.log(2))
        
        n = len(log_hl)
        vol = np.full(n, np.nan)
        
        for i in range(window, n):
            vol[i] = np.sqrt(factor * np.mean(log_hl[i-window:i]) * 252)
        
        return vol
    
    def garman_klass_volatility(self, open_: np.ndarray, high: np.ndarray, 
                                low: np.ndarray, close: np.ndarray,
                                window: int = 20) -> np.ndarray:
        """
        Garman-Klass volatility estimator.
        Uses OHLC data for improved efficiency.
        """
        log_hl = np.log(high / low)**2
        log_co = np.log(close / open_)**2
        
        factor1 = 0.5
        factor2 = (2 * np.log(2) - 1)
        
        gk = factor1 * log_hl - factor2 * log_co
        
        n = len(gk)
        vol = np.full(n, np.nan)
        
        for i in range(window, n):
            vol[i] = np.sqrt(np.mean(gk[i-window:i]) * 252)
        
        return vol
    
    def volatility_skew(self, strikes: np.ndarray, ivs: np.ndarray) -> Dict[str, float]:
        """
        Analyze volatility skew from strike-IV pairs.
        """
        atm_idx = len(strikes) // 2
        atm_iv = ivs[atm_idx]
        
        # 25-delta skew (approximation)
        otm_put_iv = ivs[0] if len(ivs) > 0 else atm_iv
        otm_call_iv = ivs[-1] if len(ivs) > 0 else atm_iv
        
        skew_25d = otm_put_iv - otm_call_iv
        
        # Butterfly (smile curvature)
        butterfly = (otm_put_iv + otm_call_iv) / 2 - atm_iv
        
        # Risk reversal
        risk_reversal = otm_call_iv - otm_put_iv
        
        return {
            "atm_iv": float(atm_iv),
            "skew_25d": float(skew_25d),
            "butterfly": float(butterfly),
            "risk_reversal": float(risk_reversal),
            "put_skew": float(otm_put_iv - atm_iv),
            "call_skew": float(otm_call_iv - atm_iv)
        }
    
    def term_structure(self, spot_vol: float, maturities: np.ndarray,
                      mean_reversion: float = 0.5, 
                      long_term_vol: float = None) -> np.ndarray:
        """
        Generate volatility term structure using mean-reverting model.
        σ(T) = σ_∞ + (σ_0 - σ_∞) * exp(-κT)
        """
        if long_term_vol is None:
            long_term_vol = spot_vol * 0.9  # Assume slight mean reversion down
        
        return long_term_vol + (spot_vol - long_term_vol) * np.exp(-mean_reversion * maturities)


class RiskAnalytics:
    """
    Comprehensive risk metrics and analysis.
    """
    
    def __init__(self, returns: np.ndarray, risk_free_rate: float = 0.02):
        self.returns = returns
        self.rf = risk_free_rate / 252  # Daily risk-free rate
    
    def value_at_risk(self, confidence: float = 0.95, 
                     method: str = 'historical') -> float:
        """
        Calculate Value at Risk.
        
        Args:
            confidence: Confidence level (e.g., 0.95 for 95% VaR)
            method: 'historical', 'parametric', or 'cornish_fisher'
        """
        if method == 'historical':
            return float(-np.percentile(self.returns, (1 - confidence) * 100))
        
        elif method == 'parametric':
            mu = np.mean(self.returns)
            sigma = np.std(self.returns)
            if SCIPY_AVAILABLE:
                z = stats.norm.ppf(1 - confidence)
            else:
                z = -1.645 if confidence == 0.95 else -2.326
            return float(-(mu + z * sigma))
        
        elif method == 'cornish_fisher':
            # Cornish-Fisher expansion for non-normal distributions
            mu = np.mean(self.returns)
            sigma = np.std(self.returns)
            if SCIPY_AVAILABLE:
                s = stats.skew(self.returns)
                k = stats.kurtosis(self.returns)
                z = stats.norm.ppf(1 - confidence)
            else:
                s, k = 0, 0
                z = -1.645 if confidence == 0.95 else -2.326
            
            # Cornish-Fisher adjustment
            z_cf = z + (z**2 - 1) * s / 6 + (z**3 - 3*z) * (k - 3) / 24 - (2*z**3 - 5*z) * s**2 / 36
            return float(-(mu + z_cf * sigma))
        
        return self.value_at_risk(confidence, 'historical')
    
    def conditional_var(self, confidence: float = 0.95) -> float:
        """
        Calculate Conditional VaR (Expected Shortfall).
        Average of losses beyond VaR.
        """
        var = self.value_at_risk(confidence)
        tail_losses = self.returns[self.returns < -var]
        
        if len(tail_losses) == 0:
            return var
        
        return float(-np.mean(tail_losses))
    
    def max_drawdown(self, prices: np.ndarray = None) -> float:
        """Calculate maximum drawdown."""
        if prices is None:
            # Reconstruct prices from returns
            prices = np.cumprod(1 + self.returns)
        
        peak = np.maximum.accumulate(prices)
        drawdown = (prices - peak) / peak
        return float(np.min(drawdown))
    
    def sharpe_ratio(self, annualize: bool = True) -> float:
        """Calculate Sharpe ratio."""
        excess_returns = self.returns - self.rf
        if np.std(excess_returns) == 0:
            return 0.0
        
        sharpe = np.mean(excess_returns) / np.std(excess_returns)
        
        if annualize:
            sharpe *= np.sqrt(252)
        
        return float(sharpe)
    
    def sortino_ratio(self, annualize: bool = True) -> float:
        """
        Calculate Sortino ratio using downside deviation.
        """
        excess_returns = self.returns - self.rf
        downside = excess_returns[excess_returns < 0]
        
        if len(downside) == 0 or np.std(downside) == 0:
            return float('inf') if np.mean(excess_returns) > 0 else 0.0
        
        downside_std = np.std(downside)
        sortino = np.mean(excess_returns) / downside_std
        
        if annualize:
            sortino *= np.sqrt(252)
        
        return float(sortino)
    
    def calmar_ratio(self, prices: np.ndarray = None) -> float:
        """Calculate Calmar ratio (return / max drawdown)."""
        annual_return = np.mean(self.returns) * 252
        mdd = abs(self.max_drawdown(prices))
        
        if mdd == 0:
            return 0.0
        
        return float(annual_return / mdd)
    
    def omega_ratio(self, threshold: float = 0) -> float:
        """
        Calculate Omega ratio.
        Ratio of gains to losses relative to threshold.
        """
        excess = self.returns - threshold
        gains = np.sum(excess[excess > 0])
        losses = abs(np.sum(excess[excess < 0]))
        
        if losses == 0:
            return float('inf') if gains > 0 else 1.0
        
        return float(gains / losses)
    
    def tail_ratio(self) -> float:
        """
        Calculate tail ratio (95th percentile / 5th percentile).
        Measures asymmetry in tails.
        """
        p95 = np.percentile(self.returns, 95)
        p5 = abs(np.percentile(self.returns, 5))
        
        if p5 == 0:
            return 0.0
        
        return float(p95 / p5)
    
    def downside_deviation(self, threshold: float = 0) -> float:
        """Calculate downside deviation."""
        below_threshold = self.returns[self.returns < threshold]
        
        if len(below_threshold) == 0:
            return 0.0
        
        return float(np.std(below_threshold) * np.sqrt(252))
    
    def upside_deviation(self, threshold: float = 0) -> float:
        """Calculate upside deviation."""
        above_threshold = self.returns[self.returns > threshold]
        
        if len(above_threshold) == 0:
            return 0.0
        
        return float(np.std(above_threshold) * np.sqrt(252))
    
    def compute_all_metrics(self, prices: np.ndarray = None) -> RiskMetrics:
        """Compute all risk metrics."""
        return RiskMetrics(
            var_95=self.value_at_risk(0.95),
            var_99=self.value_at_risk(0.99),
            cvar_95=self.conditional_var(0.95),
            cvar_99=self.conditional_var(0.99),
            max_drawdown=self.max_drawdown(prices),
            sharpe_ratio=self.sharpe_ratio(),
            sortino_ratio=self.sortino_ratio(),
            calmar_ratio=self.calmar_ratio(prices),
            omega_ratio=self.omega_ratio(),
            tail_ratio=self.tail_ratio(),
            downside_deviation=self.downside_deviation(),
            upside_deviation=self.upside_deviation()
        )


class EfficientFrontier:
    """
    Markowitz Efficient Frontier calculation.
    """
    
    def __init__(self, returns: np.ndarray, asset_names: List[str] = None):
        """
        Initialize with returns matrix (rows: time, cols: assets).
        """
        self.returns = returns
        self.n_assets = returns.shape[1]
        self.asset_names = asset_names or [f"Asset_{i}" for i in range(self.n_assets)]
        
        self.mean_returns = np.mean(returns, axis=0)
        self.cov_matrix = np.cov(returns, rowvar=False)
    
    def portfolio_performance(self, weights: np.ndarray) -> Tuple[float, float]:
        """Calculate portfolio return and volatility."""
        port_return = np.dot(weights, self.mean_returns) * 252
        port_vol = np.sqrt(np.dot(weights.T, np.dot(self.cov_matrix * 252, weights)))
        return port_return, port_vol
    
    def minimum_variance_portfolio(self) -> EfficientFrontierPoint:
        """Find the minimum variance portfolio."""
        if not SCIPY_AVAILABLE:
            # Equal weight fallback
            weights = np.ones(self.n_assets) / self.n_assets
            ret, vol = self.portfolio_performance(weights)
            return EfficientFrontierPoint(ret, vol, ret / vol if vol > 0 else 0, weights.tolist())
        
        def objective(w):
            return np.sqrt(np.dot(w.T, np.dot(self.cov_matrix * 252, w)))
        
        constraints = {'type': 'eq', 'fun': lambda w: np.sum(w) - 1}
        bounds = [(0, 1) for _ in range(self.n_assets)]
        x0 = np.ones(self.n_assets) / self.n_assets
        
        result = optimize.minimize(objective, x0, method='SLSQP',
                                  bounds=bounds, constraints=constraints)
        
        weights = result.x
        ret, vol = self.portfolio_performance(weights)
        sharpe = ret / vol if vol > 0 else 0
        
        return EfficientFrontierPoint(ret, vol, sharpe, weights.tolist())
    
    def maximum_sharpe_portfolio(self, risk_free_rate: float = 0.02) -> EfficientFrontierPoint:
        """Find the maximum Sharpe ratio portfolio."""
        if not SCIPY_AVAILABLE:
            return self.minimum_variance_portfolio()
        
        def neg_sharpe(w):
            ret, vol = self.portfolio_performance(w)
            return -(ret - risk_free_rate) / vol if vol > 0 else 0
        
        constraints = {'type': 'eq', 'fun': lambda w: np.sum(w) - 1}
        bounds = [(0, 1) for _ in range(self.n_assets)]
        x0 = np.ones(self.n_assets) / self.n_assets
        
        result = optimize.minimize(neg_sharpe, x0, method='SLSQP',
                                  bounds=bounds, constraints=constraints)
        
        weights = result.x
        ret, vol = self.portfolio_performance(weights)
        sharpe = (ret - risk_free_rate) / vol if vol > 0 else 0
        
        return EfficientFrontierPoint(ret, vol, sharpe, weights.tolist())
    
    def efficient_frontier_points(self, n_points: int = 50) -> List[EfficientFrontierPoint]:
        """Generate points along the efficient frontier."""
        if not SCIPY_AVAILABLE:
            return [self.minimum_variance_portfolio()]
        
        # Find return range
        min_ret = np.min(self.mean_returns) * 252
        max_ret = np.max(self.mean_returns) * 252
        target_returns = np.linspace(min_ret, max_ret, n_points)
        
        frontier_points = []
        
        for target in target_returns:
            def objective(w):
                return np.sqrt(np.dot(w.T, np.dot(self.cov_matrix * 252, w)))
            
            constraints = [
                {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},
                {'type': 'eq', 'fun': lambda w, t=target: np.dot(w, self.mean_returns) * 252 - t}
            ]
            bounds = [(0, 1) for _ in range(self.n_assets)]
            x0 = np.ones(self.n_assets) / self.n_assets
            
            try:
                result = optimize.minimize(objective, x0, method='SLSQP',
                                          bounds=bounds, constraints=constraints)
                if result.success:
                    weights = result.x
                    ret, vol = self.portfolio_performance(weights)
                    sharpe = ret / vol if vol > 0 else 0
                    frontier_points.append(EfficientFrontierPoint(ret, vol, sharpe, weights.tolist()))
            except:
                continue
        
        return frontier_points


class DiracTransformations:
    """
    Dirac delta function and related transformations for financial signals.
    Used for impulse response analysis and event detection.
    """
    
    @staticmethod
    def approximate_dirac(x: np.ndarray, epsilon: float = 0.01) -> np.ndarray:
        """
        Approximate Dirac delta using Gaussian:
        δ_ε(x) = (1/√(2πε²)) * exp(-x²/(2ε²))
        """
        return np.exp(-x**2 / (2 * epsilon**2)) / (epsilon * np.sqrt(2 * np.pi))
    
    @staticmethod
    def heaviside_step(x: np.ndarray) -> np.ndarray:
        """
        Heaviside step function (integral of Dirac delta).
        H(x) = 0 for x < 0, 0.5 for x = 0, 1 for x > 0
        """
        return np.heaviside(x, 0.5)
    
    @staticmethod
    def impulse_response(signal: np.ndarray, 
                        impulse_times: List[int]) -> np.ndarray:
        """
        Calculate impulse response at specified times.
        Measures signal change following impulse events.
        """
        n = len(signal)
        response = np.zeros(n)
        
        for t in impulse_times:
            if 0 <= t < n - 1:
                # Response is change from impulse point
                response[t] = signal[t + 1] - signal[t] if t + 1 < n else 0
        
        return response
    
    @staticmethod
    def detect_impulses(signal: np.ndarray, 
                       threshold: float = 3.0) -> np.ndarray:
        """
        Detect impulse events using z-score threshold.
        Returns indices of detected impulses.
        """
        changes = np.diff(signal)
        z_scores = (changes - np.mean(changes)) / np.std(changes)
        
        impulse_indices = np.where(np.abs(z_scores) > threshold)[0]
        return impulse_indices
    
    @staticmethod
    def symmetric_difference(x: np.ndarray) -> np.ndarray:
        """
        Symmetric finite difference approximation of derivative.
        f'(x) ≈ (f(x+h) - f(x-h)) / (2h)
        """
        result = np.zeros_like(x)
        result[1:-1] = (x[2:] - x[:-2]) / 2
        result[0] = x[1] - x[0]
        result[-1] = x[-1] - x[-2]
        return result
    
    @staticmethod
    def standard_score_transform(x: np.ndarray) -> np.ndarray:
        """
        Standard score (z-score) transformation.
        z = (x - μ) / σ
        """
        return (x - np.mean(x)) / np.std(x)
    
    @staticmethod
    def box_cox_transform(x: np.ndarray, lambda_: float = 0) -> np.ndarray:
        """
        Box-Cox transformation for normalizing data.
        y = (x^λ - 1) / λ  for λ ≠ 0
        y = ln(x)          for λ = 0
        """
        x_positive = np.maximum(x, 1e-10)  # Ensure positive
        
        if abs(lambda_) < 1e-10:
            return np.log(x_positive)
        else:
            return (x_positive**lambda_ - 1) / lambda_
    
    @staticmethod
    def yeo_johnson_transform(x: np.ndarray, lambda_: float = 0) -> np.ndarray:
        """
        Yeo-Johnson transformation (handles negative values).
        """
        result = np.zeros_like(x, dtype=float)
        
        pos_mask = x >= 0
        neg_mask = ~pos_mask
        
        if abs(lambda_) < 1e-10:
            result[pos_mask] = np.log1p(x[pos_mask])
        else:
            result[pos_mask] = ((x[pos_mask] + 1)**lambda_ - 1) / lambda_
        
        if abs(lambda_ - 2) < 1e-10:
            result[neg_mask] = -np.log1p(-x[neg_mask])
        else:
            result[neg_mask] = -((-x[neg_mask] + 1)**(2 - lambda_) - 1) / (2 - lambda_)
        
        return result
    
    @staticmethod
    def fourier_transform(signal: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute Fourier transform of signal.
        Returns frequencies and amplitudes.
        """
        if SCIPY_AVAILABLE:
            n = len(signal)
            fft_result = fft(signal)
            frequencies = fftfreq(n)
            amplitudes = np.abs(fft_result)
            return frequencies[:n//2], amplitudes[:n//2]
        else:
            return np.array([]), np.array([])
    
    @staticmethod
    def wavelet_transform(signal: np.ndarray, 
                         scales: np.ndarray = None) -> np.ndarray:
        """
        Simple continuous wavelet transform using Morlet wavelet.
        """
        if scales is None:
            scales = np.arange(1, min(len(signal) // 2, 128))
        
        n = len(signal)
        coefficients = np.zeros((len(scales), n))
        
        for i, scale in enumerate(scales):
            # Morlet wavelet
            t = np.arange(-4 * scale, 4 * scale + 1)
            wavelet = np.exp(-t**2 / (2 * scale**2)) * np.cos(5 * t / scale)
            wavelet = wavelet / np.sum(np.abs(wavelet))
            
            # Convolve
            padded = np.pad(signal, len(wavelet) // 2, mode='reflect')
            conv = np.convolve(padded, wavelet, mode='same')
            coefficients[i] = conv[len(wavelet) // 2:len(wavelet) // 2 + n]
        
        return coefficients


class InterestRateModels:
    """
    Interest rate modeling for fixed income analysis.
    """
    
    @staticmethod
    def vasicek(r0: float, kappa: float, theta: float, 
               sigma: float, T: float, dt: float = 1/252) -> np.ndarray:
        """
        Vasicek interest rate model.
        dr = κ(θ - r)dt + σdW
        
        Args:
            r0: Initial interest rate
            kappa: Speed of mean reversion
            theta: Long-term mean rate
            sigma: Volatility
            T: Time horizon
            dt: Time step
        """
        n_steps = int(T / dt)
        rates = np.zeros(n_steps + 1)
        rates[0] = r0
        
        sqrt_dt = np.sqrt(dt)
        
        for i in range(n_steps):
            dW = np.random.normal(0, sqrt_dt)
            rates[i + 1] = rates[i] + kappa * (theta - rates[i]) * dt + sigma * dW
        
        return rates
    
    @staticmethod
    def cir(r0: float, kappa: float, theta: float,
           sigma: float, T: float, dt: float = 1/252) -> np.ndarray:
        """
        Cox-Ingersoll-Ross interest rate model.
        dr = κ(θ - r)dt + σ√r dW
        """
        n_steps = int(T / dt)
        rates = np.zeros(n_steps + 1)
        rates[0] = r0
        
        sqrt_dt = np.sqrt(dt)
        
        for i in range(n_steps):
            dW = np.random.normal(0, sqrt_dt)
            rates[i + 1] = rates[i] + kappa * (theta - rates[i]) * dt + sigma * np.sqrt(max(rates[i], 0)) * dW
            rates[i + 1] = max(rates[i + 1], 0)  # Ensure non-negative
        
        return rates
    
    @staticmethod
    def hull_white_1f(r0: float, theta_func, sigma: float,
                     a: float, T: float, dt: float = 1/252) -> np.ndarray:
        """
        Hull-White one-factor model.
        dr = (θ(t) - ar)dt + σdW
        """
        n_steps = int(T / dt)
        rates = np.zeros(n_steps + 1)
        rates[0] = r0
        
        sqrt_dt = np.sqrt(dt)
        times = np.arange(n_steps + 1) * dt
        
        for i in range(n_steps):
            dW = np.random.normal(0, sqrt_dt)
            theta_t = theta_func(times[i]) if callable(theta_func) else theta_func
            rates[i + 1] = rates[i] + (theta_t - a * rates[i]) * dt + sigma * dW
        
        return rates
    
    @staticmethod
    def zero_coupon_bond_price(r: float, T: float, kappa: float,
                               theta: float, sigma: float) -> float:
        """
        Calculate zero-coupon bond price under Vasicek model.
        """
        B = (1 - np.exp(-kappa * T)) / kappa
        A = np.exp((theta - sigma**2 / (2 * kappa**2)) * (B - T) - sigma**2 * B**2 / (4 * kappa))
        return A * np.exp(-B * r)
    
    @staticmethod
    def forward_rate(r: float, T1: float, T2: float, kappa: float,
                    theta: float, sigma: float) -> float:
        """
        Calculate forward rate from T1 to T2.
        """
        P1 = InterestRateModels.zero_coupon_bond_price(r, T1, kappa, theta, sigma)
        P2 = InterestRateModels.zero_coupon_bond_price(r, T2, kappa, theta, sigma)
        
        return (np.log(P1) - np.log(P2)) / (T2 - T1)


class HamiltonianMechanics:
    """
    Hamiltonian mechanics applied to market dynamics.
    Position = Price, Momentum = Price velocity (returns)
    Energy = Market energy state
    """
    
    def __init__(self, prices: np.ndarray, mass: float = 1.0):
        self.prices = prices
        self.log_prices = np.log(prices)
        self.mass = mass
        
        # Calculate momentum (velocity)
        self.momentum = np.gradient(self.log_prices)
    
    def kinetic_energy(self) -> np.ndarray:
        """
        Calculate kinetic energy: T = p²/(2m)
        """
        return self.momentum**2 / (2 * self.mass)
    
    def potential_energy(self, equilibrium: float = None) -> np.ndarray:
        """
        Calculate potential energy using harmonic oscillator model.
        V = k(q - q_0)² / 2
        """
        if equilibrium is None:
            equilibrium = np.mean(self.log_prices)
        
        # Spring constant estimated from volatility
        k = 1 / np.var(self.log_prices) if np.var(self.log_prices) > 0 else 1
        
        return k * (self.log_prices - equilibrium)**2 / 2
    
    def total_energy(self, equilibrium: float = None) -> np.ndarray:
        """
        Calculate total Hamiltonian: H = T + V
        """
        return self.kinetic_energy() + self.potential_energy(equilibrium)
    
    def hamilton_equations(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Calculate Hamilton's equations of motion:
        dq/dt = ∂H/∂p = p/m
        dp/dt = -∂H/∂q = -k(q - q_0)
        """
        dq_dt = self.momentum / self.mass
        
        # Calculate dp/dt from potential gradient
        equilibrium = np.mean(self.log_prices)
        k = 1 / np.var(self.log_prices) if np.var(self.log_prices) > 0 else 1
        dp_dt = -k * (self.log_prices - equilibrium)
        
        return dq_dt, dp_dt
    
    def phase_space_trajectory(self) -> Tuple[np.ndarray, np.ndarray]:
        """Return phase space (q, p) trajectory."""
        return self.log_prices, self.momentum
    
    def compute_state(self, index: int = -1) -> HamiltonianState:
        """Compute Hamiltonian state at given index."""
        return HamiltonianState(
            position=float(self.log_prices[index]),
            momentum=float(self.momentum[index]),
            energy=float(self.total_energy()[index]),
            kinetic_energy=float(self.kinetic_energy()[index]),
            potential_energy=float(self.potential_energy()[index])
        )


class MarketVectorField(IVectorField):
    """
    Vector field representation of market dynamics.
    Maps price-volume space to return-volatility vectors.
    """
    
    def __init__(self, prices: np.ndarray, volumes: np.ndarray):
        self.prices = prices
        self.volumes = volumes
        self.returns = np.diff(np.log(prices))
        self.vol_changes = np.diff(np.log(volumes + 1))
    
    def evaluate(self, x: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Evaluate vector field at price-volume points.
        Returns (return_component, volatility_component).
        """
        # Interpolate returns based on price level
        if SCIPY_AVAILABLE and len(self.prices) > 3:
            try:
                return_interp = interp1d(self.prices[1:], self.returns, 
                                        kind='linear', fill_value='extrapolate')
                vol_interp = interp1d(self.volumes[1:], self.vol_changes,
                                     kind='linear', fill_value='extrapolate')
                return return_interp(x), vol_interp(y)
            except:
                pass
        
        return np.zeros_like(x), np.zeros_like(y)
    
    def divergence(self) -> float:
        """
        Calculate divergence of the vector field.
        div F = ∂Fx/∂x + ∂Fy/∂y
        """
        dx_returns = np.gradient(self.returns)
        dy_vol = np.gradient(self.vol_changes)
        return float(np.mean(dx_returns) + np.mean(dy_vol))
    
    def curl(self) -> float:
        """
        Calculate curl magnitude (2D).
        curl F = ∂Fy/∂x - ∂Fx/∂y
        """
        # Approximate cross-derivatives
        if len(self.returns) != len(self.vol_changes):
            return 0.0
        
        dFy_dx = np.gradient(self.vol_changes)
        dFx_dy = np.gradient(self.returns)
        
        return float(np.mean(dFy_dx - dFx_dy))


# =============================================================================
# COMPREHENSIVE ANALYTICS ENGINE
# =============================================================================

class AdvancedAnalyticsEngine:
    """
    Comprehensive analytics engine combining all mathematical frameworks.
    Includes BSM Greeks, risk metrics, volatility analysis, efficient frontier,
    Dirac transformations, and interest rate models.
    """
    
    def __init__(self, prices: np.ndarray, volumes: np.ndarray = None,
                 market_prices: np.ndarray = None, 
                 high: np.ndarray = None, low: np.ndarray = None,
                 open_: np.ndarray = None):
        self.prices = prices
        self.volumes = volumes if volumes is not None else np.ones_like(prices)
        self.market_prices = market_prices
        self.high = high if high is not None else prices
        self.low = low if low is not None else prices
        self.open = open_ if open_ is not None else prices
        self.returns = np.diff(np.log(prices))
    
    def compute_all_analytics(self) -> Dict[str, Any]:
        """Compute comprehensive analytics using all mathematical frameworks."""
        results = {
            "timestamp": datetime.now().isoformat(),
            "data_points": len(self.prices)
        }
        
        # Basic statistics
        results["basic_stats"] = {
            "mean_price": float(np.mean(self.prices)),
            "std_price": float(np.std(self.prices)),
            "mean_return": float(np.mean(self.returns)),
            "std_return": float(np.std(self.returns)),
            "min_price": float(np.min(self.prices)),
            "max_price": float(np.max(self.prices)),
            "current_price": float(self.prices[-1])
        }
        
        # Complex analytics
        complex_analytics = ComplexAnalytics()
        results["complex_analysis"] = {
            "arctan_mean": float(np.mean(complex_analytics.arctan_transform(self.returns))),
            "damping_params": complex_analytics.fit_damped_oscillation(self.prices)
        }
        
        # Differential calculus
        diff_calc = DifferentialCalculus(self.prices)
        diff_results = diff_calc.compute_analytics()
        results["differential"] = {
            "gradient_magnitude": diff_results.gradient_magnitude,
            "laplacian": diff_results.laplacian,
            "divergence": diff_results.divergence
        }
        
        # Ito stochastic calculus
        ito = ItoStochasticCalculus.estimate_from_data(self.prices)
        stoch_results = ito.compute_analytics(self.prices)
        results["stochastic"] = asdict(stoch_results)
        
        # Hamiltonian mechanics
        hamiltonian = HamiltonianMechanics(self.prices)
        ham_state = hamiltonian.compute_state()
        results["hamiltonian"] = asdict(ham_state)
        
        # Vector field analysis
        if self.volumes is not None:
            vf = MarketVectorField(self.prices, self.volumes)
            results["vector_field"] = {
                "divergence": vf.divergence(),
                "curl": vf.curl()
            }
        
        # Green's/Stokes' theorem
        if self.volumes is not None:
            gs = GreensStokesTheorem()
            results["path_integrals"] = {
                "line_integral": gs.line_integral(self.prices, self.volumes),
                "flux": gs.flux_integral(self.prices, self.volumes)
            }
        
        # Beta estimation (if market data available)
        if self.market_prices is not None and len(self.market_prices) == len(self.prices):
            market_returns = np.diff(np.log(self.market_prices))
            beta_est = BetaHatEstimator.ols_beta(self.returns, market_returns)
            results["beta"] = asdict(beta_est)
        
        # Risk Analytics
        risk = RiskAnalytics(self.returns)
        results["risk_metrics"] = asdict(risk.compute_all_metrics(self.prices))
        
        # Volatility Analytics
        vol_analytics = VolatilityAnalytics(self.prices, self.returns)
        realized_vol = vol_analytics.realized_volatility()
        results["volatility"] = {
            "current_realized_vol": float(realized_vol[-1]) if not np.isnan(realized_vol[-1]) else None,
            "mean_realized_vol": float(np.nanmean(realized_vol)),
            "vol_of_vol": float(np.nanstd(realized_vol))
        }
        
        # Parkinson volatility (if high/low available)
        if self.high is not None and self.low is not None:
            parkinson = vol_analytics.parkinson_volatility(self.high, self.low)
            results["volatility"]["parkinson_vol"] = float(parkinson[-1]) if not np.isnan(parkinson[-1]) else None
        
        # BSM Greeks (at-the-money options)
        current_price = self.prices[-1]
        # Annualize 1-minute volatility: sqrt(trading_days * minutes_per_day)
        annualized_vol = np.std(self.returns) * np.sqrt(MINUTES_PER_YEAR)
        if annualized_vol > 0:
            bsm = BlackScholesMerton(
                S=current_price,
                K=current_price,  # ATM
                T=30/365,  # 30 days to expiry
                r=0.05,  # Assumed risk-free rate
                sigma=annualized_vol
            )
            bsm_result = bsm.get_full_result()
            results["bsm_greeks"] = {
                "call_price": bsm_result.call_price,
                "put_price": bsm_result.put_price,
                "d1": bsm_result.d1,
                "d2": bsm_result.d2,
                "call_delta": bsm_result.call_greeks.delta,
                "call_gamma": bsm_result.call_greeks.gamma,
                "call_theta": bsm_result.call_greeks.theta,
                "call_vega": bsm_result.call_greeks.vega,
                "call_rho": bsm_result.call_greeks.rho,
                "put_delta": bsm_result.put_greeks.delta,
                "put_theta": bsm_result.put_greeks.theta,
                "second_order": {
                    "vanna": bsm_result.call_greeks.vanna,
                    "volga": bsm_result.call_greeks.volga,
                    "charm": bsm_result.call_greeks.charm
                },
                "third_order": {
                    "speed": bsm_result.call_greeks.speed,
                    "zomma": bsm_result.call_greeks.zomma,
                    "color": bsm_result.call_greeks.color,
                    "ultima": bsm_result.call_greeks.ultima
                }
            }
        
        # Dirac transformations
        dirac = DiracTransformations()
        impulses = dirac.detect_impulses(self.prices)
        results["transformations"] = {
            "num_impulses": len(impulses),
            "z_score_current": float(dirac.standard_score_transform(self.prices)[-1]),
            "symmetric_diff_mean": float(np.mean(np.abs(dirac.symmetric_difference(self.prices))))
        }
        
        # Fourier analysis
        if SCIPY_AVAILABLE:
            freqs, amps = dirac.fourier_transform(self.returns)
            if len(amps) > 0:
                dominant_freq_idx = np.argmax(amps[1:]) + 1  # Skip DC component
                results["transformations"]["dominant_frequency"] = float(freqs[dominant_freq_idx])
                results["transformations"]["dominant_amplitude"] = float(amps[dominant_freq_idx])
        
        # Scipy-specific analytics
        if SCIPY_AVAILABLE:
            results["scipy_stats"] = {
                "skewness": float(stats.skew(self.returns)),
                "kurtosis": float(stats.kurtosis(self.returns)),
                "jarque_bera": list(stats.jarque_bera(self.returns)),
                "shapiro_wilk": list(stats.shapiro(self.returns[:min(5000, len(self.returns))]))
            }
        
        return results
    
    def compute_bsm_surface(self, strikes: np.ndarray = None, 
                           maturities: np.ndarray = None) -> Dict[str, Any]:
        """
        Compute BSM prices and Greeks across strike/maturity surface.
        """
        current_price = self.prices[-1]
        annualized_vol = np.std(self.returns) * np.sqrt(MINUTES_PER_YEAR)
        
        if strikes is None:
            strikes = current_price * np.array([0.8, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2])
        
        if maturities is None:
            maturities = np.array([7, 14, 30, 60, 90, 180, 365]) / 365
        
        surface = {
            "strikes": strikes.tolist(),
            "maturities": (maturities * 365).tolist(),
            "call_prices": [],
            "put_prices": [],
            "deltas": [],
            "gammas": [],
            "vegas": [],
            "thetas": []
        }
        
        for T in maturities:
            call_row, put_row, delta_row, gamma_row, vega_row, theta_row = [], [], [], [], [], []
            for K in strikes:
                bsm = BlackScholesMerton(current_price, K, T, 0.05, annualized_vol)
                call_row.append(bsm.call_price())
                put_row.append(bsm.put_price())
                delta_row.append(bsm.delta_call())
                gamma_row.append(bsm.gamma())
                vega_row.append(bsm.vega())
                theta_row.append(bsm.theta_call())
            
            surface["call_prices"].append(call_row)
            surface["put_prices"].append(put_row)
            surface["deltas"].append(delta_row)
            surface["gammas"].append(gamma_row)
            surface["vegas"].append(vega_row)
            surface["thetas"].append(theta_row)
        
        return surface



# Major market indices - comprehensive global coverage
INDICES = {
    # US Major Indices
    "^GSPC": "S&P 500",
    "^DJI": "Dow Jones Industrial Average",
    "^IXIC": "NASDAQ Composite",
    "^NDX": "NASDAQ 100",
    "^RUT": "Russell 2000",
    "^RUA": "Russell 3000",
    "^VIX": "CBOE Volatility Index",
    "^OEX": "S&P 100",
    "^MID": "S&P MidCap 400",
    "^SML": "S&P SmallCap 600",
    "^W5000": "Wilshire 5000",
    "^NYA": "NYSE Composite",
    "^XAX": "NYSE AMEX Composite",
    
    # US Sector Indices
    "^SP500-45": "S&P 500 IT",
    "^SP500-40": "S&P 500 Financials",
    "^SP500-35": "S&P 500 Health Care",
    "^SP500-30": "S&P 500 Consumer Staples",
    "^SP500-25": "S&P 500 Consumer Discretionary",
    "^SP500-20": "S&P 500 Industrials",
    "^SP500-15": "S&P 500 Materials",
    "^SP500-10": "S&P 500 Energy",
    "^SP500-55": "S&P 500 Utilities",
    "^SP500-60": "S&P 500 Real Estate",
    "^SP500-50": "S&P 500 Communication Services",
    
    # European Indices
    "^FTSE": "FTSE 100 (UK)",
    "^GDAXI": "DAX (Germany)",
    "^FCHI": "CAC 40 (France)",
    "^STOXX50E": "Euro Stoxx 50",
    "^STOXX": "Stoxx Europe 600",
    "^AEX": "AEX (Netherlands)",
    "^IBEX": "IBEX 35 (Spain)",
    "^FTSEMIB.MI": "FTSE MIB (Italy)",
    "^SSMI": "SMI (Switzerland)",
    "^BFX": "BEL 20 (Belgium)",
    "^ATX": "ATX (Austria)",
    "^OMXS30": "OMX Stockholm 30",
    "^OMXC25": "OMX Copenhagen 25",
    "^OMXH25": "OMX Helsinki 25",
    "^OSEAX": "Oslo All Share",
    "^PSI20": "PSI 20 (Portugal)",
    
    # Asian Indices
    "^N225": "Nikkei 225 (Japan)",
    "^TOPX": "TOPIX (Japan)",
    "^HSI": "Hang Seng (Hong Kong)",
    "^HSCE": "Hang Seng China Enterprises",
    "000001.SS": "Shanghai Composite (China)",
    "399001.SZ": "Shenzhen Component (China)",
    "^TWII": "Taiwan Weighted",
    "^KS11": "KOSPI (South Korea)",
    "^KQ11": "KOSDAQ (South Korea)",
    "^STI": "Straits Times (Singapore)",
    "^AXJO": "S&P/ASX 200 (Australia)",
    "^AORD": "All Ordinaries (Australia)",
    "^NZ50": "S&P/NZX 50 (New Zealand)",
    "^BSESN": "BSE Sensex (India)",
    "^NSEI": "Nifty 50 (India)",
    "^JKSE": "Jakarta Composite (Indonesia)",
    "^KLSE": "FTSE Bursa Malaysia KLCI",
    "^SET.BK": "SET Index (Thailand)",
    "^PSEI": "PSEi (Philippines)",
    
    # Americas (ex-US) Indices
    "^GSPTSE": "S&P/TSX Composite (Canada)",
    "^BVSP": "Bovespa (Brazil)",
    "^MXX": "IPC (Mexico)",
    "^MERV": "MERVAL (Argentina)",
    "^IPSA": "IPSA (Chile)",
    
    # Middle East & Africa
    "^TA125.TA": "TA-125 (Israel)",
    "^CASE30": "EGX 30 (Egypt)",
    "^JN0U.JO": "JSE All Share (South Africa)",
    
    # Major ETFs (highly liquid, trade like indices)
    "SPY": "SPDR S&P 500 ETF",
    "QQQ": "Invesco QQQ (NASDAQ 100)",
    "DIA": "SPDR Dow Jones ETF",
    "IWM": "iShares Russell 2000 ETF",
    "IWB": "iShares Russell 1000 ETF",
    "IWV": "iShares Russell 3000 ETF",
    "VTI": "Vanguard Total Stock Market ETF",
    "VOO": "Vanguard S&P 500 ETF",
    "VEA": "Vanguard FTSE Developed Markets ETF",
    "VWO": "Vanguard FTSE Emerging Markets ETF",
    "EFA": "iShares MSCI EAFE ETF",
    "EEM": "iShares MSCI Emerging Markets ETF",
    "IEMG": "iShares Core MSCI Emerging Markets ETF",
    
    # Sector ETFs
    "XLK": "Technology Select Sector SPDR",
    "XLF": "Financial Select Sector SPDR",
    "XLV": "Health Care Select Sector SPDR",
    "XLE": "Energy Select Sector SPDR",
    "XLI": "Industrial Select Sector SPDR",
    "XLP": "Consumer Staples Select Sector SPDR",
    "XLY": "Consumer Discretionary Select Sector SPDR",
    "XLB": "Materials Select Sector SPDR",
    "XLU": "Utilities Select Sector SPDR",
    "XLRE": "Real Estate Select Sector SPDR",
    "XLC": "Communication Services Select Sector SPDR",
    
    # Bond & Treasury ETFs
    "TLT": "iShares 20+ Year Treasury Bond ETF",
    "IEF": "iShares 7-10 Year Treasury Bond ETF",
    "SHY": "iShares 1-3 Year Treasury Bond ETF",
    "LQD": "iShares iBoxx Investment Grade Corporate Bond ETF",
    "HYG": "iShares iBoxx High Yield Corporate Bond ETF",
    "AGG": "iShares Core US Aggregate Bond ETF",
    "BND": "Vanguard Total Bond Market ETF",
    
    # Commodity ETFs
    "GLD": "SPDR Gold Shares",
    "SLV": "iShares Silver Trust",
    "USO": "United States Oil Fund",
    "UNG": "United States Natural Gas Fund",
    "DBA": "Invesco DB Agriculture Fund",
    "DBC": "Invesco DB Commodity Index Fund",
    
    # Volatility & Leveraged ETFs
    "UVXY": "ProShares Ultra VIX Short-Term Futures ETF",
    "SVXY": "ProShares Short VIX Short-Term Futures ETF",
    "TQQQ": "ProShares UltraPro QQQ",
    "SQQQ": "ProShares UltraPro Short QQQ",
    "SPXU": "ProShares UltraPro Short S&P 500",
    "UPRO": "ProShares UltraPro S&P 500",
    
    # Thematic ETFs
    "ARKK": "ARK Innovation ETF",
    "ARKG": "ARK Genomic Revolution ETF",
    "ARKW": "ARK Next Generation Internet ETF",
    "ARKF": "ARK Fintech Innovation ETF",
    "ARKQ": "ARK Autonomous Technology & Robotics ETF",
    "SOXX": "iShares Semiconductor ETF",
    "SMH": "VanEck Semiconductor ETF",
    "HACK": "ETFMG Prime Cyber Security ETF",
    "BOTZ": "Global X Robotics & AI ETF",
    "ICLN": "iShares Global Clean Energy ETF",
    "TAN": "Invesco Solar ETF",
    "LIT": "Global X Lithium & Battery Tech ETF",
    
    # International ETFs
    "FXI": "iShares China Large-Cap ETF",
    "MCHI": "iShares MSCI China ETF",
    "EWJ": "iShares MSCI Japan ETF",
    "EWZ": "iShares MSCI Brazil ETF",
    "EWG": "iShares MSCI Germany ETF",
    "EWU": "iShares MSCI United Kingdom ETF",
    "EWY": "iShares MSCI South Korea ETF",
    "EWT": "iShares MSCI Taiwan ETF",
    "EWH": "iShares MSCI Hong Kong ETF",
    "EWA": "iShares MSCI Australia ETF",
    "EWC": "iShares MSCI Canada ETF",
    "INDA": "iShares MSCI India ETF",
    "EWW": "iShares MSCI Mexico ETF",
    "EZA": "iShares MSCI South Africa ETF",
    
    # Cryptocurrency ETFs
    "BITO": "ProShares Bitcoin Strategy ETF",
    "GBTC": "Grayscale Bitcoin Trust",
    "ETHE": "Grayscale Ethereum Trust",
    
    # Real Estate ETFs
    "VNQ": "Vanguard Real Estate ETF",
    "IYR": "iShares US Real Estate ETF",
    "SCHH": "Schwab US REIT ETF",
    
    # Currency ETFs
    "UUP": "Invesco DB US Dollar Index Bullish Fund",
    "FXE": "Invesco CurrencyShares Euro Trust",
    "FXY": "Invesco CurrencyShares Japanese Yen Trust",
    "FXB": "Invesco CurrencyShares British Pound Trust",
}

# Directory for data storage
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(DATA_DIR, "dbs")
CSV_DIR = os.path.join(DATA_DIR, "csv")


def ensure_directories():
    """Ensure the data directories exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    os.makedirs(CSV_DIR, exist_ok=True)


def get_db_path(ticker):
    """Get the path to the SQLite database for a ticker."""
    safe_ticker = ticker.replace("^", "").replace("/", "_").replace(".", "_")
    return os.path.join(DB_DIR, f"{safe_ticker}.db")


def get_compressed_db_path(ticker):
    """Get the path to the compressed database for a ticker."""
    safe_ticker = ticker.replace("^", "").replace("/", "_").replace(".", "_")
    return os.path.join(DB_DIR, f"{safe_ticker}.db.gz")


def get_csv_path(ticker):
    """Get the path to the CSV file for a ticker."""
    safe_ticker = ticker.replace("^", "").replace("/", "_").replace(".", "_")
    return os.path.join(CSV_DIR, f"{safe_ticker}_1m.csv")


def decompress_database(compressed_path, db_path):
    """Decompress a gzipped database file."""
    if os.path.exists(compressed_path):
        print(f"  Decompressing {compressed_path}...")
        with gzip.open(compressed_path, 'rb') as f_in:
            with open(db_path, 'wb') as f_out:
                f_out.write(f_in.read())
        return True
    return False


def compress_database(db_path, compressed_path):
    """Compress a database file using gzip."""
    print(f"  Compressing to {compressed_path}...")
    with open(db_path, 'rb') as f_in:
        with gzip.open(compressed_path, 'wb') as f_out:
            f_out.write(f_in.read())
    # Remove uncompressed database after compression
    os.remove(db_path)


def get_last_timestamp(conn):
    """Get the last timestamp in the database."""
    cursor = conn.cursor()
    cursor.execute("SELECT MAX(Datetime) FROM prices")
    result = cursor.fetchone()[0]
    return result


def create_table_if_not_exists(conn):
    """Create the prices table if it doesn't exist."""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prices (
            Datetime TEXT PRIMARY KEY,
            Open REAL,
            High REAL,
            Low REAL,
            Close REAL,
            Volume INTEGER,
            Ticker TEXT
        )
    """)
    conn.commit()


def fetch_index_data(ticker, name):
    """
    Fetch 1-minute data for an index and update the database.
    Only appends new data that doesn't already exist.
    """
    print(f"\nProcessing {name} ({ticker})...")
    
    db_path = get_db_path(ticker)
    compressed_path = get_compressed_db_path(ticker)
    csv_path = get_csv_path(ticker)
    
    # Decompress existing database if it exists
    had_existing_db = decompress_database(compressed_path, db_path)
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    create_table_if_not_exists(conn)
    
    # Get last timestamp to determine what data we need
    last_timestamp = get_last_timestamp(conn)
    
    if last_timestamp:
        print(f"  Last data point: {last_timestamp}")
    else:
        print("  No existing data, fetching fresh...")
    
    try:
        # Fetch 1-minute data (max 7 days for 1m interval in yfinance)
        # For 1-minute data, yfinance only allows up to 7 days of history
        print(f"  Fetching 1-minute data...")
        data = yf.download(
            ticker,
            period="7d",
            interval="1m",
            progress=False
        )
        
        if data.empty:
            print(f"  WARNING: No data returned for {ticker}")
            conn.close()
            if had_existing_db:
                compress_database(db_path, compressed_path)
            return False
        
        # Reset index to get Datetime as a column
        data = data.reset_index()
        
        # Handle multi-level columns from yfinance
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = [col[0] if col[1] == '' or col[1] == ticker else col[0] for col in data.columns]
        
        # Rename 'Datetime' column if it's named differently
        if 'Datetime' not in data.columns and 'index' in data.columns:
            data = data.rename(columns={'index': 'Datetime'})
        elif 'Date' in data.columns:
            data = data.rename(columns={'Date': 'Datetime'})
        
        # Convert datetime to string for storage
        data['Datetime'] = data['Datetime'].astype(str)
        data['Ticker'] = ticker
        
        # Filter out data we already have
        if last_timestamp:
            original_count = len(data)
            data = data[data['Datetime'] > last_timestamp]
            print(f"  Filtered to {len(data)} new records (from {original_count} total)")
        else:
            print(f"  Retrieved {len(data)} records")
        
        if len(data) == 0:
            print(f"  No new data to add for {ticker}")
            conn.close()
            if had_existing_db:
                compress_database(db_path, compressed_path)
            return True
        
        # Prepare data for storage
        data_to_store = pd.DataFrame({
            'Datetime': data['Datetime'],
            'Open': data['Open'],
            'High': data['High'],
            'Low': data['Low'],
            'Close': data['Close'],
            'Volume': data['Volume'],
            'Ticker': data['Ticker']
        })
        
        # Insert new data (using INSERT OR IGNORE to avoid duplicates)
        cursor = conn.cursor()
        for _, row in data_to_store.iterrows():
            cursor.execute("""
                INSERT OR IGNORE INTO prices (Datetime, Open, High, Low, Close, Volume, Ticker)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (row['Datetime'], row['Open'], row['High'], row['Low'], 
                  row['Close'], row['Volume'], row['Ticker']))
        
        conn.commit()
        print(f"  Inserted {cursor.rowcount} new records")
        
        # Export all data to CSV
        all_data = pd.read_sql_query(
            "SELECT * FROM prices ORDER BY Datetime", 
            conn
        )
        all_data.to_csv(csv_path, index=False)
        print(f"  Exported {len(all_data)} total records to CSV")
        
        conn.close()
        
        # Compress the database
        compress_database(db_path, compressed_path)
        
        return True
        
    except Exception as e:
        print(f"  ERROR fetching {ticker}: {e}")
        conn.close()
        if had_existing_db:
            compress_database(db_path, compressed_path)
        elif os.path.exists(db_path):
            os.remove(db_path)
        return False


def generate_files_json():
    """Generate a JSON file listing all available data files."""
    files_info = {
        "last_updated": datetime.now().isoformat(),
        "indices": []
    }
    
    for ticker, name in INDICES.items():
        safe_ticker = ticker.replace("^", "").replace("/", "_").replace(".", "_")
        csv_path = get_csv_path(ticker)
        compressed_db_path = get_compressed_db_path(ticker)
        
        index_info = {
            "ticker": ticker,
            "name": name,
            "safe_ticker": safe_ticker,
            "csv_file": f"csv/{safe_ticker}_1m.csv" if os.path.exists(csv_path) else None,
            "db_file": f"dbs/{safe_ticker}.db.gz" if os.path.exists(compressed_db_path) else None
        }
        files_info["indices"].append(index_info)
    
    files_json_path = os.path.join(DATA_DIR, "files.json")
    with open(files_json_path, 'w') as f:
        json.dump(files_info, f, indent=2)
    print(f"\nGenerated files.json")


def calculate_analytics(ticker):
    """
    Calculate advanced analytics for a ticker using scipy.
    Returns statistics dictionary.
    """
    if not SCIPY_AVAILABLE:
        return None
    
    csv_path = get_csv_path(ticker)
    if not os.path.exists(csv_path):
        return None
    
    try:
        df = pd.read_csv(csv_path)
        if df.empty or 'Close' not in df.columns:
            return None
        
        closes = df['Close'].dropna().values
        if len(closes) < 10:
            return None
        
        # Calculate returns
        returns = np.diff(closes) / closes[:-1]
        
        analytics = {
            "ticker": ticker,
            "mean_return": float(np.mean(returns)),
            "std_return": float(np.std(returns)),
            "skewness": float(stats.skew(returns)),
            "kurtosis": float(stats.kurtosis(returns)),
            "min_price": float(np.min(closes)),
            "max_price": float(np.max(closes)),
            "current_price": float(closes[-1]),
            "data_points": len(closes)
        }
        
        # Find peaks and troughs
        if len(closes) > 20:
            peaks, _ = find_peaks(closes, distance=10)
            troughs, _ = find_peaks(-closes, distance=10)
            analytics["num_peaks"] = len(peaks)
            analytics["num_troughs"] = len(troughs)
        
        return analytics
    except Exception as e:
        print(f"  Error calculating analytics for {ticker}: {e}")
        return None


def generate_analytics_json():
    """Generate analytics for all indices."""
    if not SCIPY_AVAILABLE:
        print("Scipy not available, skipping analytics generation")
        return
    
    print("\nGenerating analytics...")
    analytics_data = {
        "generated_at": datetime.now().isoformat(),
        "indices": []
    }
    
    for ticker, name in INDICES.items():
        analytics = calculate_analytics(ticker)
        if analytics:
            analytics["name"] = name
            analytics_data["indices"].append(analytics)
    
    analytics_path = os.path.join(DATA_DIR, "analytics.json")
    with open(analytics_path, 'w') as f:
        json.dump(analytics_data, f, indent=2)
    print(f"Generated analytics.json with {len(analytics_data['indices'])} indices")


def fetch_wrapper(args):
    """Wrapper function for parallel execution."""
    ticker, name = args
    try:
        return (ticker, fetch_index_data(ticker, name))
    except Exception as e:
        print(f"Error processing {ticker}: {e}")
        return (ticker, False)


def fetch_all_parallel(max_workers=10):
    """
    Fetch data for all indices using parallel processing.
    Uses ThreadPoolExecutor for concurrent API calls.
    """
    print(f"\n{'='*50}")
    print(f"Starting parallel fetch with {max_workers} workers")
    print(f"Total indices to process: {len(INDICES)}")
    print(f"{'='*50}")
    
    results = {}
    items = list(INDICES.items())
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_ticker = {
            executor.submit(fetch_wrapper, item): item[0] 
            for item in items
        }
        
        # Process completed tasks
        completed = 0
        for future in as_completed(future_to_ticker):
            ticker = future_to_ticker[future]
            try:
                result_ticker, success = future.result()
                results[result_ticker] = success
                completed += 1
                status = "✓" if success else "✗"
                print(f"[{completed}/{len(items)}] {status} {ticker}")
            except Exception as e:
                results[ticker] = False
                completed += 1
                print(f"[{completed}/{len(items)}] ✗ {ticker}: {e}")
    
    success_count = sum(1 for v in results.values() if v)
    print(f"\n{'='*50}")
    print(f"Completed: {success_count}/{len(INDICES)} indices updated successfully")
    print(f"{'='*50}")
    
    return results


async def fetch_single_async(ticker, name, semaphore):
    """Async wrapper for fetching a single index."""
    async with semaphore:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            fetch_index_data, 
            ticker, 
            name
        )


async def fetch_all_async(max_concurrent=10):
    """
    Fetch data for all indices using asyncio.
    Uses semaphore to limit concurrent requests.
    """
    print(f"\n{'='*50}")
    print(f"Starting async fetch with {max_concurrent} concurrent tasks")
    print(f"Total indices to process: {len(INDICES)}")
    print(f"{'='*50}")
    
    semaphore = asyncio.Semaphore(max_concurrent)
    
    tasks = [
        fetch_single_async(ticker, name, semaphore)
        for ticker, name in INDICES.items()
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    success_count = sum(1 for r in results if r is True)
    print(f"\n{'='*50}")
    print(f"Completed: {success_count}/{len(INDICES)} indices updated successfully")
    print(f"{'='*50}")
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Fetch 1-minute index data from yfinance"
    )
    parser.add_argument(
        "--ticker",
        help="Fetch data for a specific ticker only",
        default=None
    )
    parser.add_argument(
        "--parallel",
        action="store_true",
        help="Use parallel processing (ThreadPoolExecutor)"
    )
    parser.add_argument(
        "--async-mode",
        action="store_true",
        dest="async_mode",
        help="Use async processing (asyncio)"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=10,
        help="Number of parallel workers (default: 10)"
    )
    parser.add_argument(
        "--analytics",
        action="store_true",
        help="Generate analytics after fetching data"
    )
    args = parser.parse_args()
    
    ensure_directories()
    
    if args.ticker:
        if args.ticker in INDICES:
            fetch_index_data(args.ticker, INDICES[args.ticker])
        else:
            print(f"Unknown ticker: {args.ticker}")
            print(f"Available tickers: {list(INDICES.keys())}")
            return 1
    elif args.async_mode:
        asyncio.run(fetch_all_async(max_concurrent=args.workers))
    elif args.parallel:
        fetch_all_parallel(max_workers=args.workers)
    else:
        # Sequential processing (default)
        success_count = 0
        total = len(INDICES)
        for i, (ticker, name) in enumerate(INDICES.items(), 1):
            print(f"\n[{i}/{total}] Processing {name} ({ticker})...")
            if fetch_index_data(ticker, name):
                success_count += 1
        
        print(f"\n{'='*50}")
        print(f"Completed: {success_count}/{len(INDICES)} indices updated successfully")
    
    generate_files_json()
    
    if args.analytics:
        generate_analytics_json()
    
    return 0


if __name__ == "__main__":
    exit(main())
