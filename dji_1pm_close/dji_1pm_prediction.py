#!/usr/bin/env python3
"""
DJI 1 PM Close Prediction Engine
=================================
A comprehensive multi-method prediction system for the Dow Jones Industrial Average
1 PM close price using advanced calculus, stochastic processes, and numerical methods.

This module implements:
- Geometric Brownian Motion (GBM) with Ito's Lemma
- Ornstein-Uhlenbeck Mean-Reversion Process
- Fourier Analysis for cyclical patterns
- Taylor Series expansion for price approximations
- Numerical integration (Simpson's, Gaussian Quadrature)
- Partial Differential Equations (Black-Scholes PDE)
- Stochastic Differential Equations (SDE)
- Monte Carlo with variance reduction techniques

Author: MajixAI
License: MIT
"""

# ============================================================================
# EXTENSIVE IMPORTS - Scientific Computing Stack
# ============================================================================

# Core Scientific Computing
import numpy as np
from numpy import (
    exp, log, sqrt, sin, cos, pi, linspace, zeros, ones,
    cumsum, diff, random, meshgrid, gradient
)
from numpy import trapezoid as trapz  # trapz was renamed to trapezoid in NumPy 2.0
from numpy.linalg import norm, solve, inv, det, eig, cholesky
from numpy.fft import fft, ifft, fftfreq, fftshift
from numpy.polynomial import polynomial, chebyshev, legendre, hermite

# SciPy - Advanced Scientific Computing
import scipy
from scipy import stats, signal, integrate, interpolate, optimize, special
from scipy.stats import (
    norm as normal_dist, lognorm, t as t_dist, chi2, gamma, expon,
    kstest, jarque_bera, skew, kurtosis
)
from scipy.integrate import (
    quad, dblquad, tplquad, fixed_quad,
    romb, simpson, odeint, solve_ivp
)
from scipy.optimize import (
    minimize, minimize_scalar, brentq, newton, fsolve,
    curve_fit, least_squares, differential_evolution
)
from scipy.interpolate import (
    interp1d, UnivariateSpline, CubicSpline, BSpline,
    RectBivariateSpline, RegularGridInterpolator
)
from scipy.signal import (
    butter, filtfilt, welch, spectrogram, find_peaks,
    savgol_filter, detrend, hilbert
)
from scipy.special import (
    erf, erfc, gamma as gamma_func, factorial, comb,
    legendre as legendre_poly, hermite as hermite_poly,
    jv, yv, iv, kv  # Bessel functions
)
from scipy.linalg import (
    lu, qr, svd, schur, hessenberg, expm, logm, sqrtm
)

# SymPy - Symbolic Mathematics & Calculus
import sympy
from sympy import (
    Symbol, symbols, Function, Derivative, Integral,
    diff as sym_diff, integrate as sym_integrate,
    exp as sym_exp, log as sym_log, sqrt as sym_sqrt,
    sin as sym_sin, cos as sym_cos, tan as sym_tan,
    limit, series, summation, product, factorial as sym_factorial,
    oo, pi as sym_pi, E, I, Rational, simplify, expand, factor,
    solve as sym_solve, dsolve, solveset, linsolve, nonlinsolve,
    Matrix as SymMatrix, eye as sym_eye, zeros as sym_zeros,
    Eq, Ne, Lt, Le, Gt, Ge, And, Or, Not,
    lambdify, pprint, init_printing
)
from sympy.calculus.util import continuous_domain, minimum, maximum
from sympy.vector import CoordSys3D, divergence, curl, gradient as sym_gradient

# Statistics and Time Series
from statistics import (
    mean, median, mode, stdev, variance,
    pstdev, pvariance, harmonic_mean, geometric_mean
)

# Data Handling
import pandas as pd
from pandas import DataFrame, Series, Timestamp, DatetimeIndex

# Visualization
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
from matplotlib import cm, colors
from matplotlib.gridspec import GridSpec
from mpl_toolkits.mplot3d import Axes3D

# System and Utilities
import os
import sys
import json
import time
import math
import cmath
import functools
import itertools
import collections
import dataclasses
from typing import Tuple, List, Dict, Optional, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field

# Random and Reproducibility
from numpy.random import (
    seed, rand, randn, randint, choice, shuffle,
    normal, uniform, exponential, poisson, binomial
)


# ============================================================================
# CONFIGURATION AND CONSTANTS
# ============================================================================

@dataclass
class MarketConfig:
    """Configuration parameters for DJI prediction model"""
    current_price: float = 44000.00  # Current DJI price
    target_time: str = "13:00"       # 1 PM target time
    volatility: float = 0.15         # Annualized volatility (15%)
    drift: float = 0.05              # Expected annual return (5%)
    risk_free_rate: float = 0.045    # Risk-free rate (4.5%)
    trading_days: int = 252          # Trading days per year
    minutes_per_day: int = 390       # Trading minutes per day
    simulations: int = 10000         # Monte Carlo simulations
    random_seed: Optional[int] = 42  # Reproducibility seed


# ============================================================================
# ADVANCED CALCULUS IMPLEMENTATIONS
# ============================================================================

class CalculusEngine:
    """
    Advanced calculus operations for financial modeling.
    Implements symbolic differentiation, integration, and series expansions.
    """
    
    def __init__(self):
        """Initialize symbolic variables for calculus operations"""
        self.t, self.S, self.sigma, self.mu, self.r = symbols(
            't S sigma mu r', positive=True, real=True
        )
        self.W = Symbol('W')  # Wiener process
        
    def taylor_expansion_price(self, S0: float, dS: float, order: int = 4) -> float:
        """
        Taylor series expansion for price approximation around S0.
        
        P(S0 + dS) ≈ P(S0) + P'(S0)·dS + P''(S0)·dS²/2! + ...
        
        Uses logarithmic return transformation for better accuracy.
        """
        S = self.S
        # Define price function as log-normal process
        f = sym_log(S)
        
        # Compute Taylor coefficients
        coefficients = []
        for n in range(order + 1):
            deriv_n = sym_diff(f, S, n)
            coeff = deriv_n.subs(S, S0) / sym_factorial(n)
            coefficients.append(float(coeff) * (dS ** n))
        
        # Return the log-price approximation, exponentiated
        log_price_approx = sum(coefficients)
        return float(sym_exp(log_price_approx))
    
    def ito_lemma_application(self, S0: float, dt: float, dW: float, 
                               mu_val: float, sigma_val: float) -> Dict:
        """
        Apply Itô's Lemma for stochastic calculus.
        
        For f(S, t) where dS = μS·dt + σS·dW:
        df = (∂f/∂t + μS·∂f/∂S + ½σ²S²·∂²f/∂S²)dt + σS·∂f/∂S·dW
        
        Returns price evolution and derivatives.
        """
        S, t, sigma, mu = self.S, self.t, self.sigma, self.mu
        
        # Define log-price function f(S) = ln(S)
        f = sym_log(S)
        
        # Compute partial derivatives
        df_dS = sym_diff(f, S)           # ∂f/∂S = 1/S
        d2f_dS2 = sym_diff(f, S, 2)      # ∂²f/∂S² = -1/S²
        df_dt = 0                         # ∂f/∂t = 0 (no explicit time dependence)
        
        # Itô's Lemma drift term: (μ - ½σ²)dt
        drift_coeff = mu_val - 0.5 * sigma_val**2
        
        # Itô's Lemma diffusion term: σ·dW
        diffusion_coeff = sigma_val
        
        # New log-price
        d_log_S = drift_coeff * dt + diffusion_coeff * dW
        new_log_S = np.log(S0) + d_log_S
        new_S = np.exp(new_log_S)
        
        return {
            'df_dS': str(df_dS),
            'd2f_dS2': str(d2f_dS2),
            'drift_term': drift_coeff * dt,
            'diffusion_term': diffusion_coeff * dW,
            'd_log_S': d_log_S,
            'new_price': new_S,
            'price_change': new_S - S0
        }
    
    def black_scholes_pde(self, S0: float, K: float, T: float,
                           r: float, sigma: float) -> Dict:
        """
        Solve the Black-Scholes PDE for option pricing.
        
        ∂V/∂t + ½σ²S²·∂²V/∂S² + rS·∂V/∂S - rV = 0
        
        This is the fundamental PDE of quantitative finance.
        """
        # d1 and d2 parameters
        d1 = (np.log(S0 / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        
        # Call price using Black-Scholes formula
        N = normal_dist.cdf
        call_price = S0 * N(d1) - K * np.exp(-r * T) * N(d2)
        
        # Greeks (partial derivatives)
        delta = N(d1)  # ∂V/∂S
        gamma = normal_dist.pdf(d1) / (S0 * sigma * np.sqrt(T))  # ∂²V/∂S²
        theta = (-S0 * normal_dist.pdf(d1) * sigma / (2 * np.sqrt(T)) 
                 - r * K * np.exp(-r * T) * N(d2))  # ∂V/∂t
        vega = S0 * np.sqrt(T) * normal_dist.pdf(d1)  # ∂V/∂σ
        
        return {
            'd1': d1,
            'd2': d2,
            'call_price': call_price,
            'delta': delta,
            'gamma': gamma,
            'theta': theta,
            'vega': vega
        }


# ============================================================================
# STOCHASTIC PROCESSES
# ============================================================================

class StochasticProcesses:
    """
    Implementation of various stochastic processes for price modeling.
    """
    
    def __init__(self, config: MarketConfig):
        self.config = config
        if config.random_seed is not None:
            np.random.seed(config.random_seed)
    
    def geometric_brownian_motion(self, S0: float, T: float, 
                                    steps: int) -> np.ndarray:
        """
        Simulate Geometric Brownian Motion (GBM).
        
        dS = μS·dt + σS·dW
        
        Solution: S(t) = S(0)·exp((μ - σ²/2)t + σW(t))
        """
        dt = T / steps
        mu, sigma = self.config.drift, self.config.volatility
        
        # Generate Brownian increments
        dW = np.random.normal(0, np.sqrt(dt), steps)
        
        # Calculate cumulative Brownian motion
        W = np.cumsum(dW)
        W = np.insert(W, 0, 0)  # Start at W(0) = 0
        
        # Time vector
        t = np.linspace(0, T, steps + 1)
        
        # GBM solution
        S = S0 * np.exp((mu - 0.5 * sigma**2) * t + sigma * W)
        
        return S
    
    def ornstein_uhlenbeck_process(self, S0: float, theta: float, 
                                     mu_eq: float, sigma: float,
                                     T: float, steps: int) -> np.ndarray:
        """
        Ornstein-Uhlenbeck mean-reverting process.
        
        dS = θ(μ - S)dt + σdW
        
        Useful for modeling mean-reverting behavior in markets.
        """
        dt = T / steps
        
        # Initialize paths
        S = np.zeros(steps + 1)
        S[0] = S0
        
        # Euler-Maruyama discretization
        for i in range(steps):
            dW = np.random.normal(0, np.sqrt(dt))
            S[i+1] = S[i] + theta * (mu_eq - S[i]) * dt + sigma * dW
        
        return S
    
    def jump_diffusion_merton(self, S0: float, T: float, steps: int,
                                lambda_j: float = 0.1, 
                                mu_j: float = 0.0,
                                sigma_j: float = 0.1) -> np.ndarray:
        """
        Merton Jump-Diffusion Model.
        
        dS/S = (μ - λκ)dt + σdW + dJ
        
        Where J is a compound Poisson process.
        """
        dt = T / steps
        mu, sigma = self.config.drift, self.config.volatility
        
        # Expected jump size
        kappa = np.exp(mu_j + 0.5 * sigma_j**2) - 1
        
        S = np.zeros(steps + 1)
        S[0] = S0
        
        for i in range(steps):
            # Brownian component
            dW = np.random.normal(0, np.sqrt(dt))
            
            # Jump component (Poisson)
            n_jumps = np.random.poisson(lambda_j * dt)
            if n_jumps > 0:
                jump_sizes = np.random.normal(mu_j, sigma_j, n_jumps)
                J = np.sum(np.exp(jump_sizes) - 1)
            else:
                J = 0
            
            # Price evolution
            dS = S[i] * ((mu - lambda_j * kappa) * dt + sigma * dW + J)
            S[i+1] = S[i] + dS
        
        return S


# ============================================================================
# NUMERICAL INTEGRATION METHODS
# ============================================================================

class NumericalIntegration:
    """
    Advanced numerical integration methods for financial computations.
    """
    
    @staticmethod
    def simpsons_rule(f: Callable, a: float, b: float, n: int) -> float:
        """
        Simpson's Rule for numerical integration.
        
        ∫[a,b] f(x)dx ≈ (h/3)[f(a) + 4·Σf(odd) + 2·Σf(even) + f(b)]
        """
        if n % 2 == 1:
            n += 1
        h = (b - a) / n
        x = np.linspace(a, b, n + 1)
        y = np.array([f(xi) for xi in x])
        
        # Simpson's weights: 1, 4, 2, 4, 2, ..., 4, 1
        weights = np.ones(n + 1)
        weights[1:-1:2] = 4  # Odd indices
        weights[2:-1:2] = 2  # Even indices
        
        return h / 3 * np.sum(weights * y)
    
    @staticmethod
    def gaussian_quadrature(f: Callable, a: float, b: float, 
                             n: int = 5) -> float:
        """
        Gauss-Legendre quadrature for high-accuracy integration.
        
        Uses Legendre polynomial roots as nodes and corresponding weights.
        """
        # Get Gauss-Legendre nodes and weights for [-1, 1]
        nodes, weights = np.polynomial.legendre.leggauss(n)
        
        # Transform to [a, b]
        x = 0.5 * (b - a) * nodes + 0.5 * (a + b)
        w = 0.5 * (b - a) * weights
        
        return np.sum(w * np.array([f(xi) for xi in x]))
    
    @staticmethod
    def romberg_integration(f: Callable, a: float, b: float,
                             tol: float = 1e-10) -> float:
        """
        High-accuracy integration using scipy.quad.
        
        Uses adaptive quadrature for higher accuracy.
        """
        result, _ = quad(f, a, b, epsabs=tol, epsrel=tol)
        return result


# ============================================================================
# FOURIER ANALYSIS FOR MARKET CYCLES
# ============================================================================

class FourierAnalysis:
    """
    Fourier analysis for detecting market cycles and patterns.
    """
    
    @staticmethod
    def compute_spectrum(prices: np.ndarray, 
                          sample_rate: float = 1.0) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute the power spectrum of price series.
        
        Uses FFT to decompose price movements into frequency components.
        """
        n = len(prices)
        
        # Detrend the data
        detrended = prices - np.linspace(prices[0], prices[-1], n)
        
        # Apply Hann window
        window = np.hanning(n)
        windowed = detrended * window
        
        # Compute FFT
        spectrum = np.fft.fft(windowed)
        frequencies = np.fft.fftfreq(n, 1/sample_rate)
        
        # Power spectral density (positive frequencies only)
        power = np.abs(spectrum[:n//2])**2
        freqs = frequencies[:n//2]
        
        return freqs, power
    
    @staticmethod
    def extract_dominant_cycles(prices: np.ndarray, 
                                  n_cycles: int = 3) -> List[Dict]:
        """
        Extract dominant cyclical patterns from price series.
        """
        freqs, power = FourierAnalysis.compute_spectrum(prices)
        
        # Find peaks in power spectrum
        peaks, properties = find_peaks(power, height=np.max(power) * 0.1)
        
        # Sort by power and take top n
        sorted_indices = np.argsort(power[peaks])[::-1][:n_cycles]
        dominant_peaks = peaks[sorted_indices]
        
        cycles = []
        for idx in dominant_peaks:
            if freqs[idx] > 0:
                period = 1 / freqs[idx]
                cycles.append({
                    'frequency': freqs[idx],
                    'period_minutes': period,
                    'power': power[idx]
                })
        
        return cycles


# ============================================================================
# MONTE CARLO VARIANCE REDUCTION
# ============================================================================

class MonteCarloEngine:
    """
    Monte Carlo simulation with variance reduction techniques.
    """
    
    def __init__(self, config: MarketConfig):
        self.config = config
        if config.random_seed is not None:
            np.random.seed(config.random_seed)
    
    def antithetic_variates(self, S0: float, T: float, 
                             n_sims: int) -> np.ndarray:
        """
        Antithetic variates for variance reduction.
        
        For each random path Z, also use -Z to reduce variance.
        """
        mu, sigma = self.config.drift, self.config.volatility
        
        # Generate normal variates
        Z = np.random.normal(0, 1, n_sims // 2)
        
        # Antithetic pairs
        S_pos = S0 * np.exp((mu - 0.5 * sigma**2) * T + sigma * np.sqrt(T) * Z)
        S_neg = S0 * np.exp((mu - 0.5 * sigma**2) * T + sigma * np.sqrt(T) * (-Z))
        
        return np.concatenate([S_pos, S_neg])
    
    def control_variates(self, S0: float, T: float,
                          n_sims: int) -> Tuple[float, float]:
        """
        Control variates using the underlying as control.
        
        Uses E[S(T)] = S(0)·e^(μT) as the known expected value.
        """
        mu, sigma = self.config.drift, self.config.volatility
        
        Z = np.random.normal(0, 1, n_sims)
        S_T = S0 * np.exp((mu - 0.5 * sigma**2) * T + sigma * np.sqrt(T) * Z)
        
        # Expected value of control (the underlying at time T)
        E_control = S0 * np.exp(mu * T)
        
        # The control variable is the difference from expected value
        control = S_T - E_control
        
        # Compute optimal coefficient: c* = Cov(Y, C) / Var(C)
        # Here Y = S_T (estimator) and C = control (S_T - E_control)
        cov_matrix = np.cov(S_T, control)
        cov_YC = cov_matrix[0, 1]  # Covariance between estimator and control
        var_C = cov_matrix[1, 1]   # Variance of control
        c_star = cov_YC / var_C if var_C > 0 else 0
        
        # Adjusted estimator: Y_adj = Y - c*(C - E[C]), where E[C] = 0
        adjusted = S_T - c_star * control
        
        return np.mean(adjusted), np.std(adjusted) / np.sqrt(n_sims)
    
    def stratified_sampling(self, S0: float, T: float,
                             n_sims: int, n_strata: int = 10) -> np.ndarray:
        """
        Stratified sampling for more uniform coverage.
        
        Divides the probability space into strata and samples from each.
        """
        mu, sigma = self.config.drift, self.config.volatility
        
        samples_per_stratum = n_sims // n_strata
        S_T = np.zeros(n_sims)
        
        for i in range(n_strata):
            # Uniform samples within stratum
            u_low = i / n_strata
            u_high = (i + 1) / n_strata
            u = np.random.uniform(u_low, u_high, samples_per_stratum)
            
            # Transform to normal via inverse CDF
            Z = normal_dist.ppf(u)
            
            # Compute prices
            start_idx = i * samples_per_stratum
            end_idx = start_idx + samples_per_stratum
            S_T[start_idx:end_idx] = S0 * np.exp(
                (mu - 0.5 * sigma**2) * T + sigma * np.sqrt(T) * Z
            )
        
        return S_T


# ============================================================================
# MAIN PREDICTION ENGINE
# ============================================================================

class DJI1PMPredictor:
    """
    Main prediction engine for DJI 1 PM close price.
    Combines multiple methods with advanced calculus.
    """
    
    def __init__(self, config: MarketConfig):
        self.config = config
        self.calculus = CalculusEngine()
        self.stochastic = StochasticProcesses(config)
        self.integration = NumericalIntegration()
        self.fourier = FourierAnalysis()
        self.monte_carlo = MonteCarloEngine(config)
        
    def compute_time_to_target(self) -> float:
        """
        Calculate time remaining to 1 PM in trading hours.
        Returns fraction of trading day.
        """
        now = datetime.now()
        market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
        target_time = now.replace(hour=13, minute=0, second=0, microsecond=0)
        
        # Calculate minutes from market open
        if now < market_open:
            minutes_from_open = 0
        else:
            minutes_from_open = (now - market_open).total_seconds() / 60
        
        # Minutes to 1 PM
        minutes_to_1pm = max(0, (target_time - now).total_seconds() / 60)
        
        # Time as fraction of year
        T = minutes_to_1pm / (self.config.trading_days * self.config.minutes_per_day)
        
        return T
    
    def run_comprehensive_simulation(self) -> Dict:
        """
        Run comprehensive simulation using all methods.
        """
        S0 = self.config.current_price
        T = self.compute_time_to_target()
        n_sims = self.config.simulations
        
        # If T is zero or negative, return current price
        if T <= 0:
            T = 207 / (self.config.trading_days * self.config.minutes_per_day)  # Default 207 minutes
        
        results = {}
        
        # 1. Geometric Brownian Motion (Monte Carlo)
        gbm_paths = np.array([
            self.stochastic.geometric_brownian_motion(S0, T, 100)[-1]
            for _ in range(n_sims)
        ])
        results['gbm'] = {
            'mean': np.mean(gbm_paths),
            'std': np.std(gbm_paths),
            'p5': np.percentile(gbm_paths, 5),
            'p95': np.percentile(gbm_paths, 95)
        }
        
        # 2. Antithetic Variates Monte Carlo
        av_prices = self.monte_carlo.antithetic_variates(S0, T, n_sims)
        results['antithetic'] = {
            'mean': np.mean(av_prices),
            'std': np.std(av_prices),
            'variance_reduction': np.var(gbm_paths) / np.var(av_prices)
        }
        
        # 3. Stratified Sampling
        strat_prices = self.monte_carlo.stratified_sampling(S0, T, n_sims)
        results['stratified'] = {
            'mean': np.mean(strat_prices),
            'std': np.std(strat_prices)
        }
        
        # 4. Black-Scholes Greeks (theoretical pricing)
        K = S0  # ATM
        r = self.config.risk_free_rate
        sigma = self.config.volatility
        bs_result = self.calculus.black_scholes_pde(S0, K, T, r, sigma)
        results['black_scholes'] = bs_result
        
        # 5. Itô's Lemma calculation for expected price change
        dt = T
        dW = 0.0  # Expected value of Brownian increment is zero
        ito_result = self.calculus.ito_lemma_application(
            S0, dt, dW, self.config.drift, self.config.volatility
        )
        results['ito_lemma'] = ito_result
        
        # 6. Taylor expansion approximation
        expected_dS = S0 * self.config.drift * T
        taylor_price = self.calculus.taylor_expansion_price(S0, expected_dS, order=4)
        results['taylor_expansion'] = {
            'price': taylor_price,
            'expected_drift': expected_dS
        }
        
        # 7. Numerical Integration - expected value
        # Expected price via analytical formula for log-normal distribution
        mu, sigma = self.config.drift, self.config.volatility
        m = np.log(S0) + (mu - 0.5 * sigma**2) * T
        s = sigma * np.sqrt(T)
        
        # Analytical expected value
        E_S = S0 * np.exp(mu * T)
        results['integration'] = {
            'analytical_expected': E_S,
            'log_mean': m,
            'log_std': s
        }
        
        # 8. Compute confidence intervals
        z_95 = normal_dist.ppf(0.975)
        ci_std = np.std(av_prices) / np.sqrt(n_sims)
        ci_lower = np.mean(av_prices) - z_95 * ci_std
        ci_upper = np.mean(av_prices) + z_95 * ci_std
        
        results['confidence_interval'] = {
            'mean': np.mean(av_prices),
            'ci_95_lower': ci_lower,
            'ci_95_upper': ci_upper
        }
        
        # Combine predictions (weighted average)
        predictions = [
            results['gbm']['mean'],
            results['antithetic']['mean'],
            results['stratified']['mean'],
            results['integration']['analytical_expected']
        ]
        
        results['combined_prediction'] = {
            'mean': np.mean(predictions),
            'std': np.std(predictions),
            'methods_used': 4
        }
        
        return results
    
    def generate_report(self, results: Dict) -> str:
        """Generate formatted prediction report."""
        report = []
        report.append("=" * 70)
        report.append("      DJI 1 PM CLOSE PREDICTION REPORT")
        report.append("      Advanced Calculus & Stochastic Methods")
        report.append("=" * 70)
        report.append(f"\nCurrent Price:    ${self.config.current_price:,.2f}")
        report.append(f"Volatility (σ):   {self.config.volatility * 100:.1f}%")
        report.append(f"Drift (μ):        {self.config.drift * 100:.1f}%")
        report.append(f"Simulations:      {self.config.simulations:,}")
        
        report.append("\n" + "-" * 70)
        report.append("PREDICTION RESULTS")
        report.append("-" * 70)
        
        # GBM
        report.append(f"\n1. Geometric Brownian Motion:")
        report.append(f"   Mean:           ${results['gbm']['mean']:,.2f}")
        report.append(f"   Std Dev:        ${results['gbm']['std']:,.2f}")
        report.append(f"   90% Range:      ${results['gbm']['p5']:,.2f} - ${results['gbm']['p95']:,.2f}")
        
        # Antithetic
        report.append(f"\n2. Antithetic Variates:")
        report.append(f"   Mean:           ${results['antithetic']['mean']:,.2f}")
        report.append(f"   Var Reduction:  {results['antithetic']['variance_reduction']:.2f}x")
        
        # Stratified
        report.append(f"\n3. Stratified Sampling:")
        report.append(f"   Mean:           ${results['stratified']['mean']:,.2f}")
        
        # Integration
        report.append(f"\n4. Analytical (Integration):")
        report.append(f"   Expected:       ${results['integration']['analytical_expected']:,.2f}")
        
        # Combined
        report.append("\n" + "=" * 70)
        report.append("COMBINED PREDICTION")
        report.append("=" * 70)
        report.append(f"\n   1 PM Close:     ${results['combined_prediction']['mean']:,.2f}")
        report.append(f"   95% CI:         ${results['confidence_interval']['ci_95_lower']:,.2f} - ${results['confidence_interval']['ci_95_upper']:,.2f}")
        
        # Greeks
        report.append("\n" + "-" * 70)
        report.append("BLACK-SCHOLES GREEKS (ATM)")
        report.append("-" * 70)
        report.append(f"   Delta:          {results['black_scholes']['delta']:.4f}")
        report.append(f"   Gamma:          {results['black_scholes']['gamma']:.6f}")
        report.append(f"   Theta:          {results['black_scholes']['theta']:.4f}")
        report.append(f"   Vega:           {results['black_scholes']['vega']:.4f}")
        
        report.append("\n" + "=" * 70)
        
        return "\n".join(report)


# ============================================================================
# VISUALIZATION
# ============================================================================

def create_visualization(results: Dict, config: MarketConfig, output_path: str):
    """Create comprehensive visualization dashboard."""
    fig = plt.figure(figsize=(16, 10))
    fig.patch.set_facecolor('#1A1A2E')
    gs = GridSpec(2, 3, figure=fig, hspace=0.3, wspace=0.3)
    
    # Color scheme
    bg_color = '#1A1A2E'
    text_color = '#E0E0E0'
    accent_green = '#00E676'
    accent_purple = '#7B1FA2'
    accent_blue = '#2979FF'
    accent_red = '#FF1744'
    
    # Chart 1: Price Distribution (Top Left, spans 2 columns)
    ax1 = fig.add_subplot(gs[0, :2])
    ax1.set_facecolor(bg_color)
    
    # Generate sample distribution
    np.random.seed(config.random_seed if config.random_seed else None)
    sample_prices = np.random.normal(
        results['combined_prediction']['mean'],
        results['gbm']['std'],
        10000
    )
    
    ax1.hist(sample_prices, bins=80, color=accent_purple, alpha=0.7, edgecolor='black')
    ax1.axvline(results['combined_prediction']['mean'], color=accent_green, 
                linewidth=2, linestyle='--', label=f"Mean: ${results['combined_prediction']['mean']:,.0f}")
    ax1.axvline(results['confidence_interval']['ci_95_lower'], color=accent_blue,
                linewidth=1.5, linestyle=':', label=f"95% CI Lower: ${results['confidence_interval']['ci_95_lower']:,.0f}")
    ax1.axvline(results['confidence_interval']['ci_95_upper'], color=accent_red,
                linewidth=1.5, linestyle=':', label=f"95% CI Upper: ${results['confidence_interval']['ci_95_upper']:,.0f}")
    
    ax1.set_title("DJI 1 PM Close - Price Distribution", color=text_color, fontsize=14, fontweight='bold')
    ax1.set_xlabel("Price ($)", color=text_color)
    ax1.set_ylabel("Frequency", color=text_color)
    ax1.legend(facecolor=bg_color, labelcolor=text_color, loc='upper right')
    ax1.tick_params(colors=text_color)
    ax1.grid(color='#333333', alpha=0.5)
    
    # Chart 2: Greeks Radar (Top Right)
    ax2 = fig.add_subplot(gs[0, 2], projection='polar')
    ax2.set_facecolor(bg_color)
    
    greeks = ['Delta', 'Gamma×1000', 'Theta', 'Vega']
    values = [
        results['black_scholes']['delta'],
        results['black_scholes']['gamma'] * 1000,
        abs(results['black_scholes']['theta']),
        results['black_scholes']['vega']
    ]
    # Normalize values for radar
    max_val = max(max(values), 1)
    values_norm = [v / max_val for v in values]
    values_norm.append(values_norm[0])  # Close the polygon
    
    angles = np.linspace(0, 2 * np.pi, len(greeks), endpoint=False).tolist()
    angles.append(angles[0])
    
    ax2.fill(angles, values_norm, color=accent_purple, alpha=0.3)
    ax2.plot(angles, values_norm, color=accent_green, linewidth=2)
    ax2.set_xticks(angles[:-1])
    ax2.set_xticklabels(greeks, color=text_color, fontsize=10)
    ax2.set_title("Black-Scholes Greeks", color=text_color, fontsize=12, pad=20)
    ax2.tick_params(colors=text_color)
    
    # Chart 3: Method Comparison (Bottom Left)
    ax3 = fig.add_subplot(gs[1, 0])
    ax3.set_facecolor(bg_color)
    
    methods = ['GBM', 'Antithetic', 'Stratified', 'Analytical']
    means = [
        results['gbm']['mean'],
        results['antithetic']['mean'],
        results['stratified']['mean'],
        results['integration']['analytical_expected']
    ]
    
    bars = ax3.bar(methods, means, color=[accent_green, accent_blue, accent_purple, accent_red], alpha=0.8)
    ax3.axhline(results['combined_prediction']['mean'], color=text_color, 
                linestyle='--', linewidth=1.5, label='Combined Mean')
    
    ax3.set_title("Method Comparison", color=text_color, fontsize=12, fontweight='bold')
    ax3.set_ylabel("Predicted Price ($)", color=text_color)
    ax3.tick_params(colors=text_color)
    ax3.grid(color='#333333', alpha=0.5, axis='y')
    
    # Add value labels on bars
    for bar, val in zip(bars, means):
        ax3.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 10,
                f'${val:,.0f}', ha='center', va='bottom', color=text_color, fontsize=9)
    
    # Chart 4: Statistics Panel (Bottom Center)
    ax4 = fig.add_subplot(gs[1, 1])
    ax4.set_facecolor(bg_color)
    ax4.axis('off')
    
    stats_text = f"""
╔══════════════════════════════════════╗
║     SIMULATION STATISTICS            ║
╠══════════════════════════════════════╣
║ Current Price:      ${config.current_price:>12,.2f} ║
║ Predicted 1PM:      ${results['combined_prediction']['mean']:>12,.2f} ║
║ Expected Change:    ${results['combined_prediction']['mean'] - config.current_price:>+12,.2f} ║
╠══════════════════════════════════════╣
║ 95% CI Lower:       ${results['confidence_interval']['ci_95_lower']:>12,.2f} ║
║ 95% CI Upper:       ${results['confidence_interval']['ci_95_upper']:>12,.2f} ║
╠══════════════════════════════════════╣
║ Volatility (σ):            {config.volatility*100:>8.1f}% ║
║ Drift (μ):                 {config.drift*100:>8.1f}% ║
║ Simulations:            {config.simulations:>10,} ║
╚══════════════════════════════════════╝
"""
    ax4.text(0.5, 0.5, stats_text, transform=ax4.transAxes, fontsize=10,
             verticalalignment='center', horizontalalignment='center',
             color=accent_green, fontfamily='monospace')
    
    # Chart 5: Confidence Gauge (Bottom Right)
    ax5 = fig.add_subplot(gs[1, 2])
    ax5.set_facecolor(bg_color)
    
    # Create a simple gauge-like visualization
    variance_reduction = results['antithetic']['variance_reduction']
    confidence_score = min(variance_reduction / 2, 1.0)  # Normalize to 0-1
    
    theta = np.linspace(0, np.pi, 100)
    r = np.ones_like(theta)
    
    ax5.fill_between(theta, 0, r * 0.8, alpha=0.2, color=accent_purple)
    ax5.fill_between(theta[:int(confidence_score*100)], 0, r[:int(confidence_score*100)] * 0.8,
                     alpha=0.8, color=accent_green)
    
    ax5.set_xlim(0, np.pi)
    ax5.set_ylim(0, 1)
    ax5.set_aspect('equal')
    ax5.axis('off')
    ax5.set_title(f"Model Confidence\n{confidence_score*100:.0f}%", color=text_color, fontsize=12)
    
    # Main title
    fig.suptitle("DJI 1 PM Close Prediction Dashboard", color=text_color, 
                 fontsize=16, fontweight='bold', y=0.98)
    
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.savefig(output_path, dpi=150, facecolor=bg_color, edgecolor='none')
    plt.close(fig)
    
    print(f"Visualization saved to: {output_path}")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main execution function."""
    # Parse and validate configuration from environment
    def get_validated_float(name: str, default: float, min_val: float = None, max_val: float = None) -> float:
        try:
            value = float(os.environ.get(name, default))
            if min_val is not None and value < min_val:
                print(f"Warning: {name}={value} is below minimum {min_val}, using {min_val}")
                value = min_val
            if max_val is not None and value > max_val:
                print(f"Warning: {name}={value} exceeds maximum {max_val}, using {max_val}")
                value = max_val
            return value
        except (ValueError, TypeError):
            print(f"Warning: Invalid {name}, using default {default}")
            return default
    
    def get_validated_int(name: str, default: int, min_val: int = 1, max_val: int = None) -> int:
        try:
            value = int(os.environ.get(name, default))
            if value < min_val:
                print(f"Warning: {name}={value} is below minimum {min_val}, using {min_val}")
                value = min_val
            if max_val is not None and value > max_val:
                print(f"Warning: {name}={value} exceeds maximum {max_val}, using {max_val}")
                value = max_val
            return value
        except (ValueError, TypeError):
            print(f"Warning: Invalid {name}, using default {default}")
            return default
    
    config = MarketConfig(
        current_price=get_validated_float('DJI_PRICE', 44000.00, min_val=0.01),
        volatility=get_validated_float('VOLATILITY', 0.15, min_val=0.001, max_val=5.0),
        drift=get_validated_float('DRIFT', 0.05, min_val=-1.0, max_val=1.0),
        simulations=get_validated_int('SIMULATIONS', 10000, min_val=100, max_val=1000000),
        random_seed=get_validated_int('RANDOM_SEED', 42, min_val=0) if os.environ.get('RANDOM_SEED') else 42
    )
    
    # Create predictor
    predictor = DJI1PMPredictor(config)
    
    # Run simulation
    print("Running comprehensive DJI 1 PM prediction simulation...")
    results = predictor.run_comprehensive_simulation()
    
    # Generate report
    report = predictor.generate_report(results)
    print(report)
    
    # Create visualization
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(output_dir, 'dji_1pm_prediction.png')
    create_visualization(results, config, output_file)
    
    # Save results to JSON
    json_output = os.path.join(output_dir, 'prediction_results.json')
    
    # Convert numpy types for JSON serialization
    def convert_numpy(obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (np.integer, np.floating)):
            return float(obj)
        elif isinstance(obj, dict):
            return {k: convert_numpy(v) for k, v in obj.items()}
        return obj
    
    with open(json_output, 'w') as f:
        json.dump(convert_numpy(results), f, indent=2)
    print(f"Results saved to: {json_output}")
    
    return results


if __name__ == "__main__":
    results = main()
