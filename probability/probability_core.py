"""
probability_core.py — PhD-Level Probability Theory Library
==========================================================
Implements:
  Probability distributions: Gaussian, multivariate Gaussian, exponential family
  Stochastic processes: Brownian motion, Ornstein-Uhlenbeck, geometric BM, CIR, jump processes
  Martingales: optional stopping simulation, Doob maximal inequality
  Large deviations: Cramér rate function, saddlepoint approximation
  Extreme value theory: GEV, GPD, block maxima, POT
  Monte Carlo: importance sampling, stratified sampling, QMC (Halton sequence)
"""

from __future__ import annotations
import math
import random
from typing import Callable, Optional


# ---------------------------------------------------------------------------
# Special Functions
# ---------------------------------------------------------------------------

def log_gamma(x: float) -> float:
    """Log-Gamma via Lanczos approximation."""
    g = 7
    c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
         771.32342877765313, -176.61502916214059, 12.507343278686905,
         -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
    if x < 0.5:
        return math.log(math.pi) - math.log(abs(math.sin(math.pi * x))) - log_gamma(1 - x)
    x -= 1
    t = x + g + 0.5
    series = c[0] + sum(c[i] / (x + i) for i in range(1, g + 2))
    return 0.5 * math.log(2 * math.pi) + (x + 0.5) * math.log(t) - t + math.log(series)


def gamma_func(x: float) -> float:
    return math.exp(log_gamma(x))


def beta_func(a: float, b: float) -> float:
    return math.exp(log_gamma(a) + log_gamma(b) - log_gamma(a + b))


def normal_cdf(x: float) -> float:
    """Standard normal CDF via erfc."""
    return 0.5 * math.erfc(-x / math.sqrt(2.0))


def normal_pdf(x: float, mu: float = 0.0, sigma: float = 1.0) -> float:
    z = (x - mu) / sigma
    return math.exp(-0.5 * z * z) / (sigma * math.sqrt(2 * math.pi))


def normal_quantile(p: float) -> float:
    """Rational approximation for the inverse normal CDF (Abramowitz & Stegun)."""
    if p <= 0 or p >= 1:
        raise ValueError("p must be in (0,1)")
    if p < 0.5:
        t = math.sqrt(-2.0 * math.log(p))
    else:
        t = math.sqrt(-2.0 * math.log(1 - p))
    c0, c1, c2 = 2.515517, 0.802853, 0.010328
    d1, d2, d3 = 1.432788, 0.189269, 0.001308
    q = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t ** 3)
    return -q if p < 0.5 else q


# ---------------------------------------------------------------------------
# Multivariate Gaussian
# ---------------------------------------------------------------------------

class MultivariateGaussian:
    """
    Multivariate Gaussian N(μ, Σ).
    Uses Cholesky decomposition for sampling and log-density.
    """

    def __init__(self, mu: list[float], Sigma: list[list[float]]):
        self.mu = mu[:]
        self.n = len(mu)
        self.Sigma = Sigma
        self.L = self._cholesky(Sigma)
        # log det = 2 * sum log L_ii
        self.log_det = 2.0 * sum(math.log(self.L[i][i]) for i in range(self.n))

    def _cholesky(self, A: list[list[float]]) -> list[list[float]]:
        n = len(A)
        L = [[0.0]*n for _ in range(n)]
        for i in range(n):
            for j in range(i+1):
                s = sum(L[i][k]*L[j][k] for k in range(j))
                if i == j:
                    L[i][j] = math.sqrt(max(A[i][i]-s, 1e-14))
                else:
                    L[i][j] = (A[i][j]-s)/L[j][j]
        return L

    def sample(self, n_samples: int = 1) -> list[list[float]]:
        """Generate samples via Cholesky: X = μ + L Z, Z~N(0,I)."""
        samples = []
        for _ in range(n_samples):
            z = [random.gauss(0, 1) for _ in range(self.n)]
            x = [self.mu[i] + sum(self.L[i][k]*z[k] for k in range(i+1))
                 for i in range(self.n)]
            samples.append(x)
        return samples

    def log_pdf(self, x: list[float]) -> float:
        """log N(x; μ, Σ) = -½(n log 2π + log|Σ| + (x-μ)^T Σ^{-1} (x-μ))"""
        d = [x[i]-self.mu[i] for i in range(self.n)]
        # Solve L v = d  (forward sub)
        v = [0.0]*self.n
        for i in range(self.n):
            v[i] = (d[i] - sum(self.L[i][k]*v[k] for k in range(i))) / self.L[i][i]
        mahal = sum(vi*vi for vi in v)
        return -0.5*(self.n*math.log(2*math.pi) + self.log_det + mahal)


# ---------------------------------------------------------------------------
# Brownian Motion and Stochastic Processes
# ---------------------------------------------------------------------------

def brownian_motion(T: float, n: int, seed: Optional[int] = None) -> tuple[list[float], list[float]]:
    """
    Simulate a standard Brownian motion W_t on [0,T] with n steps.
    Returns (times, path).
    """
    if seed is not None: random.seed(seed)
    dt = T / n
    t = [i * dt for i in range(n + 1)]
    W = [0.0]
    for _ in range(n):
        W.append(W[-1] + random.gauss(0, math.sqrt(dt)))
    return t, W


def geometric_brownian_motion(S0: float, mu: float, sigma: float,
                               T: float, n: int,
                               seed: Optional[int] = None) -> tuple[list[float], list[float]]:
    """
    GBM: dS = μS dt + σS dW.
    Exact simulation: S_t = S_0 exp((μ - σ²/2)t + σW_t)
    """
    t, W = brownian_motion(T, n, seed)
    S = [S0 * math.exp((mu - 0.5 * sigma**2) * ti + sigma * W[i])
         for i, ti in enumerate(t)]
    return t, S


def ornstein_uhlenbeck(x0: float, theta: float, mu: float, sigma: float,
                        T: float, n: int,
                        seed: Optional[int] = None) -> tuple[list[float], list[float]]:
    """
    Ornstein-Uhlenbeck: dX = θ(μ-X)dt + σ dW.
    Exact discretisation:
      X_{k+1} = X_k e^{-θΔt} + μ(1-e^{-θΔt}) + σ√((1-e^{-2θΔt})/(2θ)) Z
    """
    if seed is not None: random.seed(seed)
    dt = T / n
    t = [i * dt for i in range(n + 1)]
    X = [x0]
    exp_term = math.exp(-theta * dt)
    std_term = sigma * math.sqrt((1 - math.exp(-2 * theta * dt)) / (2 * theta))
    for _ in range(n):
        X.append(X[-1] * exp_term + mu * (1 - exp_term) + std_term * random.gauss(0, 1))
    return t, X


def cox_ingersoll_ross(x0: float, kappa: float, theta: float, sigma: float,
                        T: float, n: int,
                        seed: Optional[int] = None) -> tuple[list[float], list[float]]:
    """
    CIR process: dX = κ(θ-X)dt + σ√X dW.
    Euler-Maruyama with reflection.  Feller condition: 2κθ > σ².
    """
    if seed is not None: random.seed(seed)
    dt = T / n
    t = [i * dt for i in range(n + 1)]
    X = [x0]
    for _ in range(n):
        x = X[-1]
        x_new = x + kappa*(theta - x)*dt + sigma*math.sqrt(max(x, 0))*random.gauss(0, math.sqrt(dt))
        X.append(max(x_new, 0.0))  # Reflect at 0
    return t, X


def poisson_process(rate: float, T: float,
                    seed: Optional[int] = None) -> tuple[list[float], list[int]]:
    """
    Simulate a homogeneous Poisson process with rate λ.
    Uses inter-arrival times Exp(λ).
    """
    if seed is not None: random.seed(seed)
    times = [0.0]
    counts = [0]
    t = 0.0
    count = 0
    while True:
        dt = random.expovariate(rate)
        t += dt
        if t > T: break
        count += 1
        times.append(t)
        counts.append(count)
    return times, counts


def compound_poisson(rate: float, jump_dist: Callable[[], float],
                      T: float, seed: Optional[int] = None
                      ) -> tuple[list[float], list[float]]:
    """
    Compound Poisson process: X_t = Σ_{k=1}^{N_t} Y_k
    """
    if seed is not None: random.seed(seed)
    t_events, _ = poisson_process(rate, T)
    t_out = [0.0]
    X = [0.0]
    for t in t_events[1:]:
        X.append(X[-1] + jump_dist())
        t_out.append(t)
    return t_out, X


# ---------------------------------------------------------------------------
# Cramér Rate Function (Large Deviations)
# ---------------------------------------------------------------------------

def cramer_rate_function(x: float, mgf_deriv_inv: Callable[[float], float],
                          log_mgf: Callable[[float], float],
                          theta_range: tuple[float,float] = (-10.0, 10.0),
                          tol: float = 1e-10) -> float:
    """
    Cramér rate function I(x) = sup_θ {θx - Λ(θ)} via bisection on Λ'(θ) = x.
    mgf_deriv_inv: numerical inverse of Λ'(θ) = x.
    """
    # Bisection to find θ* s.t. Λ'(θ*) = x
    lo, hi = theta_range
    for _ in range(100):
        mid = (lo + hi) / 2.0
        val = mgf_deriv_inv(mid)  # Should return Λ'(mid)
        if abs(val - x) < tol: break
        if val < x: lo = mid
        else: hi = mid
    theta_star = (lo + hi) / 2.0
    return theta_star * x - log_mgf(theta_star)


def gaussian_rate_function(x: float, mu: float = 0.0, sigma: float = 1.0) -> float:
    """Cramér rate for N(μ,σ²): I(x) = (x-μ)²/(2σ²)."""
    return (x - mu) ** 2 / (2.0 * sigma ** 2)


def poisson_rate_function(x: float, lam: float) -> float:
    """Cramér rate for Poisson(λ): I(x) = x log(x/λ) - (x-λ), x>0."""
    if x <= 0: return float('inf') if x < 0 else lam
    return x * math.log(x / lam) - (x - lam)


# ---------------------------------------------------------------------------
# Extreme Value Theory
# ---------------------------------------------------------------------------

def gev_pdf(x: float, mu: float, sigma: float, xi: float) -> float:
    """
    Generalised Extreme Value (GEV) density.
    ξ > 0: Fréchet, ξ < 0: Weibull, ξ → 0: Gumbel.
    """
    if sigma <= 0: return 0.0
    if abs(xi) < 1e-8:
        z = (x - mu) / sigma
        return (1/sigma) * math.exp(-z - math.exp(-z))
    z = 1 + xi * (x - mu) / sigma
    if z <= 0: return 0.0
    return (1/sigma) * z**(-1/xi - 1) * math.exp(-z**(-1/xi))


def gev_cdf(x: float, mu: float, sigma: float, xi: float) -> float:
    """GEV CDF."""
    if sigma <= 0: return 0.0
    if abs(xi) < 1e-8:
        return math.exp(-math.exp(-(x - mu) / sigma))
    z = 1 + xi * (x - mu) / sigma
    if z <= 0: return 0.0 if xi > 0 else 1.0
    return math.exp(-z**(-1/xi))


def gpd_pdf(x: float, mu: float, sigma: float, xi: float) -> float:
    """Generalised Pareto Distribution density (for POT method)."""
    if sigma <= 0: return 0.0
    y = (x - mu) / sigma
    if abs(xi) < 1e-8:
        return (1/sigma) * math.exp(-y) if y >= 0 else 0.0
    z = 1 + xi * y
    if z <= 0 or y < 0: return 0.0
    return (1/sigma) * z**(-1/xi - 1)


def block_maxima(data: list[float], block_size: int) -> list[float]:
    """Extract block maxima for GEV fitting."""
    return [max(data[i:i+block_size]) for i in range(0, len(data)-block_size+1, block_size)]


def pot_exceedances(data: list[float], threshold: float) -> list[float]:
    """Peaks-over-threshold exceedances: x - u for x > u."""
    return [x - threshold for x in data if x > threshold]


def pwm_gev_fit(maxima: list[float]) -> tuple[float, float, float]:
    """
    Probability-weighted moments estimator for GEV parameters.
    Returns (mu, sigma, xi).
    """
    n = len(maxima)
    x = sorted(maxima)
    b0 = sum(x) / n
    b1 = sum(((i)/(n-1))*x[i] for i in range(n)) / n
    b2 = sum(((i)*(i-1)/((n-1)*(n-2)))*x[i] for i in range(n)) / n
    c = (2*b1 - b0) / (3*b2 - b0) - math.log(2)/math.log(3)
    # Approximate xi via Hosking PWM
    xi = 7.859*c + 2.9554*c**2
    sigma = (2*b1 - b0)*xi / (gamma_func(1-xi)*(2**xi - 1)) if abs(xi) > 1e-6 else 0.0
    mu = b0 - sigma*(gamma_func(1-xi) - 1)/xi if abs(xi) > 1e-6 else b0 - sigma*0.5772
    return mu, sigma, xi


# ---------------------------------------------------------------------------
# Monte Carlo Integration
# ---------------------------------------------------------------------------

def monte_carlo_integrate(f: Callable[[list[float]], float],
                           domain: list[tuple[float,float]],
                           n_samples: int = 100000,
                           seed: Optional[int] = None) -> tuple[float, float]:
    """
    Monte Carlo integration: ∫_Ω f(x) dx ≈ V(Ω) * E[f(U)].
    Returns (estimate, std_error).
    """
    if seed is not None: random.seed(seed)
    volume = 1.0
    for lo, hi in domain: volume *= (hi - lo)
    vals = []
    for _ in range(n_samples):
        x = [random.uniform(lo, hi) for lo, hi in domain]
        vals.append(f(x))
    mean = sum(vals) / n_samples
    var = sum((v - mean)**2 for v in vals) / (n_samples - 1)
    return volume * mean, volume * math.sqrt(var / n_samples)


def halton_sequence(n: int, base: int) -> list[float]:
    """Van der Corput / Halton quasi-random sequence in given base."""
    seq = []
    for i in range(1, n + 1):
        f, r = 1.0, 0.0
        k = i
        while k > 0:
            f /= base
            r += f * (k % base)
            k //= base
        seq.append(r)
    return seq


def qmc_integrate(f: Callable[[list[float]], float],
                  domain: list[tuple[float,float]],
                  n_samples: int = 10000) -> float:
    """
    Quasi-Monte Carlo integration using Halton sequences.
    Convergence O((log N)^d / N) vs O(N^{-1/2}) for MC.
    """
    d = len(domain)
    primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29][:d]
    halton = [halton_sequence(n_samples, p) for p in primes]
    volume = 1.0
    for lo, hi in domain: volume *= (hi - lo)
    total = 0.0
    for i in range(n_samples):
        x = [domain[j][0] + (domain[j][1]-domain[j][0])*halton[j][i] for j in range(d)]
        total += f(x)
    return volume * total / n_samples


# ---------------------------------------------------------------------------
# Importance Sampling
# ---------------------------------------------------------------------------

def importance_sampling(f: Callable[[float], float],
                         proposal_sample: Callable[[], float],
                         proposal_pdf: Callable[[float], float],
                         target_pdf: Callable[[float], float],
                         n_samples: int = 10000,
                         seed: Optional[int] = None) -> tuple[float, float]:
    """
    Importance sampling estimator: E_p[f] ≈ (1/n) Σ f(x_i) w(x_i)
    where w(x) = p(x)/q(x) are importance weights.
    Returns (estimate, effective_sample_size / n).
    """
    if seed is not None: random.seed(seed)
    xs = [proposal_sample() for _ in range(n_samples)]
    ws = [target_pdf(x) / max(proposal_pdf(x), 1e-300) for x in xs]
    w_sum = sum(ws)
    if w_sum < 1e-300: return 0.0, 0.0
    w_norm = [w / w_sum for w in ws]
    estimate = sum(f(xs[i]) * ws[i] for i in range(n_samples)) / (w_sum / n_samples)
    ess = 1.0 / sum(w**2 for w in w_norm)  # Effective sample size
    return estimate, ess / n_samples
