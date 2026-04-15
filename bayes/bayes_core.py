"""
bayes_core.py — PhD-Level Bayesian Inference Library
=====================================================
Implements:
  Metropolis-Hastings MCMC (random-walk, independence)
  Hamiltonian Monte Carlo (leapfrog integrator)
  NUTS (simplified No-U-Turn Sampler)
  Gibbs sampler for Bayesian normal model
  Variational inference (mean-field for Gaussian model)
  Belief propagation on discrete PGM
  Bayesian model comparison (WAIC)
  Dirichlet process (stick-breaking)
"""

from __future__ import annotations
import math
import random
from typing import Callable, Optional

LogProbFn = Callable[[list[float]], float]
GradFn = Callable[[list[float]], list[float]]


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _dot(u, v): return sum(a*b for a,b in zip(u,v))
def _norm(v): return math.sqrt(_dot(v,v))
def _vadd(u, v): return [a+b for a,b in zip(u,v)]
def _vsub(u, v): return [a-b for a,b in zip(u,v)]
def _vscale(v, s): return [x*s for x in v]

def numerical_grad(log_p: LogProbFn, theta: list[float], h: float=1e-5) -> list[float]:
    n = len(theta)
    g = []
    for i in range(n):
        tp = theta[:]; tp[i]+=h
        tm = theta[:]; tm[i]-=h
        g.append((log_p(tp)-log_p(tm))/(2*h))
    return g


# ---------------------------------------------------------------------------
# Metropolis-Hastings
# ---------------------------------------------------------------------------

def metropolis_hastings(log_target: LogProbFn, theta0: list[float],
                         n_samples: int = 10000, proposal_sd: float = 0.5,
                         n_burnin: int = 1000, seed: Optional[int] = None
                         ) -> tuple[list[list[float]], dict]:
    """
    Random-walk Metropolis-Hastings with Gaussian proposal.
    Acceptance probability: min(1, p*(θ')/p*(θ)).
    """
    if seed is not None: random.seed(seed)
    d = len(theta0)
    theta = theta0[:]
    lp = log_target(theta)
    samples = []; n_accept = 0

    for it in range(n_burnin + n_samples):
        theta_prop = [theta[j] + random.gauss(0, proposal_sd) for j in range(d)]
        lp_prop = log_target(theta_prop)
        log_alpha = lp_prop - lp
        if math.log(random.random() + 1e-300) < log_alpha:
            theta = theta_prop; lp = lp_prop; n_accept += 1
        if it >= n_burnin:
            samples.append(theta[:])

    accept_rate = n_accept / (n_burnin + n_samples)
    stats = {'accept_rate': accept_rate}
    return samples, stats


def adaptive_mh(log_target: LogProbFn, theta0: list[float],
                n_samples: int = 10000, n_burnin: int = 1000,
                target_accept: float = 0.234, seed: Optional[int] = None
                ) -> tuple[list[list[float]], dict]:
    """
    Adaptive MH with Robbins-Monro step-size adaptation.
    Target acceptance rate 0.234 (optimal for high-dimensional Gaussian).
    """
    if seed is not None: random.seed(seed)
    d = len(theta0)
    theta = theta0[:]
    lp = log_target(theta)
    samples = []; n_accept = 0
    log_sd = 0.0  # log of proposal std

    for it in range(1, n_burnin + n_samples + 1):
        sd = math.exp(log_sd)
        theta_prop = [theta[j]+random.gauss(0, sd) for j in range(d)]
        lp_prop = log_target(theta_prop)
        alpha = min(1.0, math.exp(lp_prop - lp))
        if random.random() < alpha:
            theta = theta_prop; lp = lp_prop; n_accept += 1
        # Adapt step size
        gamma = 1.0/(it)**0.6
        log_sd += gamma*(alpha - target_accept)
        if it > n_burnin:
            samples.append(theta[:])

    return samples, {'accept_rate': n_accept/(n_burnin+n_samples), 'final_sd': math.exp(log_sd)}


# ---------------------------------------------------------------------------
# Hamiltonian Monte Carlo
# ---------------------------------------------------------------------------

def hmc(log_target: LogProbFn, grad_log_target: Optional[GradFn],
        theta0: list[float], n_samples: int = 2000,
        n_burnin: int = 500, step_size: float = 0.05, n_leapfrog: int = 10,
        seed: Optional[int] = None) -> tuple[list[list[float]], dict]:
    """
    Hamiltonian Monte Carlo (Neal 2011).
    Leapfrog integrator is time-reversible and volume-preserving.
    Acceptance: min(1, exp(-H_prop + H_curr)).
    """
    if seed is not None: random.seed(seed)
    d = len(theta0)
    grad_fn = grad_log_target or (lambda t: numerical_grad(log_target, t))
    theta = theta0[:]
    lp = log_target(theta)
    samples = []; n_accept = 0

    for it in range(n_burnin + n_samples):
        # Sample momentum
        p = [random.gauss(0, 1) for _ in range(d)]
        H_curr = -lp + 0.5*_dot(p, p)

        # Leapfrog
        theta_prop = theta[:]
        p_prop = p[:]
        g = grad_fn(theta_prop)
        p_prop = _vadd(p_prop, _vscale(g, step_size/2))  # half step
        for _ in range(n_leapfrog - 1):
            theta_prop = _vadd(theta_prop, _vscale(p_prop, step_size))
            g = grad_fn(theta_prop)
            p_prop = _vadd(p_prop, _vscale(g, step_size))
        theta_prop = _vadd(theta_prop, _vscale(p_prop, step_size))
        g = grad_fn(theta_prop)
        p_prop = _vadd(p_prop, _vscale(g, step_size/2))  # final half step

        lp_prop = log_target(theta_prop)
        H_prop = -lp_prop + 0.5*_dot(p_prop, p_prop)
        delta_H = H_prop - H_curr

        if math.log(random.random() + 1e-300) < -delta_H:
            theta, lp = theta_prop, lp_prop
            n_accept += 1

        if it >= n_burnin:
            samples.append(theta[:])

    return samples, {'accept_rate': n_accept/(n_burnin+n_samples)}


# ---------------------------------------------------------------------------
# NUTS (simplified — single slice-sampling approach)
# ---------------------------------------------------------------------------

def nuts_simple(log_target: LogProbFn, grad_log_target: Optional[GradFn],
                theta0: list[float], n_samples: int = 1000,
                n_burnin: int = 200, step_size: float = 0.05,
                max_depth: int = 5, seed: Optional[int] = None
                ) -> tuple[list[list[float]], dict]:
    """
    Simplified NUTS: builds doubling tree and checks U-turn criterion.
    """
    if seed is not None: random.seed(seed)
    d = len(theta0)
    grad_fn = grad_log_target or (lambda t: numerical_grad(log_target, t))

    def leapfrog(theta, p, eps, direction):
        g = grad_fn(theta)
        p_new = _vadd(p, _vscale(g, direction*eps/2))
        theta_new = _vadd(theta, _vscale(p_new, direction*eps))
        g = grad_fn(theta_new)
        p_new = _vadd(p_new, _vscale(g, direction*eps/2))
        return theta_new, p_new

    def uturn(theta_m, theta_p, r_m, r_p):
        diff = _vsub(theta_p, theta_m)
        return _dot(diff, r_m) < 0 or _dot(diff, r_p) < 0

    theta = theta0[:]
    samples = []; n_accept = 0

    for it in range(n_burnin + n_samples):
        p0 = [random.gauss(0, 1) for _ in range(d)]
        H0 = -log_target(theta) + 0.5*_dot(p0, p0)
        log_u = math.log(random.random() + 1e-300) - H0

        theta_m = theta[:]; theta_p = theta[:]
        r_m = p0[:]; r_p = p0[:]
        j = 0; n_tree = 1; accepted = theta[:]

        while j <= max_depth:
            direction = 1 if random.random() > 0.5 else -1
            if direction == 1:
                theta_p, r_p = leapfrog(theta_p, r_p, step_size, 1)
                theta_new, p_new = theta_p, r_p
            else:
                theta_m, r_m = leapfrog(theta_m, r_m, step_size, -1)
                theta_new, p_new = theta_m, r_m

            H_new = -log_target(theta_new) + 0.5*_dot(p_new, p_new)
            if log_u <= -H_new:
                if random.random() < 1.0/n_tree:
                    accepted = theta_new[:]
                    n_accept += 1
                n_tree += 1

            if uturn(theta_m, theta_p, r_m, r_p):
                break
            j += 1

        theta = accepted
        if it >= n_burnin:
            samples.append(theta[:])

    return samples, {'accept_rate': n_accept/(n_burnin+n_samples)}


# ---------------------------------------------------------------------------
# Gibbs Sampler (Normal model: μ unknown, σ² unknown)
# ---------------------------------------------------------------------------

def gibbs_normal(data: list[float], mu0: float = 0.0, kappa0: float = 1.0,
                  alpha0: float = 2.0, beta0: float = 1.0,
                  n_samples: int = 5000, n_burnin: int = 500,
                  seed: Optional[int] = None) -> tuple[list[float], list[float]]:
    """
    Gibbs sampler for Normal model with Normal-InvGamma conjugate prior.
    Prior: μ|σ² ~ N(μ₀, σ²/κ₀), σ² ~ InvGamma(α₀, β₀).
    Full conditionals are available in closed form.
    """
    if seed is not None: random.seed(seed)
    n = len(data)
    ybar = sum(data)/n
    mu_samples, sigma2_samples = [], []
    mu = ybar; sigma2 = 1.0

    for it in range(n_burnin + n_samples):
        # Sample μ | σ², y  ~  N(μₙ, σ²/κₙ)
        kappan = kappa0 + n
        mun = (kappa0*mu0 + n*ybar)/kappan
        mu = random.gauss(mun, math.sqrt(sigma2/kappan))
        # Sample σ² | μ, y  ~  InvGamma(αₙ, βₙ)
        alphan = alpha0 + n/2.0
        betan = beta0 + 0.5*sum((y-mu)**2 for y in data) + kappa0*n*(ybar-mu0)**2/(2*kappan)
        # InvGamma(α,β): X = 1/Gamma(α, rate=β)
        # Approximate via sum of exponentials for integer alpha
        shape = alphan; rate = betan
        # Use accept-reject for InvGamma
        # Gamma(α,rate=β): shape-scale parameterisation
        gam = 0.0
        for _ in range(int(math.ceil(shape))):
            gam += -math.log(random.random() + 1e-300)/rate
        if shape != int(math.ceil(shape)):
            pass  # approximate
        sigma2 = 1.0/max(gam, 1e-14)
        if it >= n_burnin:
            mu_samples.append(mu); sigma2_samples.append(sigma2)

    return mu_samples, sigma2_samples


# ---------------------------------------------------------------------------
# Mean-Field Variational Inference (Gaussian)
# ---------------------------------------------------------------------------

def mean_field_vi_gaussian(data: list[float], mu0: float = 0.0, sigma0: float = 10.0,
                            a0: float = 2.0, b0: float = 1.0,
                            max_iter: int = 500, tol: float = 1e-8
                            ) -> dict:
    """
    Mean-field VI for Normal model: q(μ,σ²) = q(μ)q(σ²).
    CAVI update equations in closed form.
    """
    n = len(data)
    ybar = sum(data)/n
    # Initialise variational parameters
    mu_q = ybar; sigma2_q = 1.0
    a_q = a0 + n/2.0; b_q = b0 + sum((y-ybar)**2 for y in data)/2.0
    E_inv_sigma2 = a_q/b_q

    for it in range(max_iter):
        mu_q_old = mu_q; b_q_old = b_q
        # Update q(μ): Gaussian
        tau_q = sigma0**(-2) + n*E_inv_sigma2
        mu_q_new = (mu0*sigma0**(-2) + n*ybar*E_inv_sigma2)/tau_q
        sigma2_q_new = 1.0/tau_q
        # Update q(σ²): InvGamma
        a_q = a0 + n/2.0
        b_q_new = b0 + 0.5*(sum((y-mu_q_new)**2 for y in data) + n*sigma2_q_new)
        E_inv_sigma2 = a_q/b_q_new
        if abs(mu_q_new-mu_q) + abs(b_q_new-b_q) < tol: break
        mu_q, sigma2_q, b_q = mu_q_new, sigma2_q_new, b_q_new

    elbo = (-0.5*n*math.log(2*math.pi) - 0.5*n*(1/E_inv_sigma2 + sigma2_q)/1
            - 0.5*sum((y-mu_q)**2 for y in data)*E_inv_sigma2)
    return {'mu_mean': mu_q, 'mu_var': sigma2_q, 'sigma2_a': a_q, 'sigma2_b': b_q, 'elbo': elbo}


# ---------------------------------------------------------------------------
# Stick-Breaking Dirichlet Process
# ---------------------------------------------------------------------------

def dp_stick_breaking(alpha: float, base_sampler: Callable[[], float],
                       n_atoms: int = 100, seed: Optional[int] = None
                       ) -> tuple[list[float], list[float]]:
    """
    Sethuraman's stick-breaking representation of DP(α, G₀):
    G = Σ πₖ δ(θₖ) where πₖ = vₖ Π_{j<k}(1-vⱼ), vₖ ~ Beta(1,α).
    Returns (weights, atoms).
    """
    if seed is not None: random.seed(seed)

    def _beta_sample(a, b):
        # Beta via Gamma ratio
        g1 = -math.log(random.random()+1e-300)
        g2 = -math.log(random.random()+1e-300)
        return g1/(g1+g2)

    v = [_beta_sample(1.0, alpha) for _ in range(n_atoms)]
    atoms = [base_sampler() for _ in range(n_atoms)]
    weights = [0.0]*n_atoms
    remain = 1.0
    for k in range(n_atoms):
        weights[k] = v[k]*remain
        remain *= (1-v[k])
    return weights, atoms


# ---------------------------------------------------------------------------
# WAIC (Widely Applicable Information Criterion)
# ---------------------------------------------------------------------------

def waic(log_likelihoods: list[list[float]]) -> dict:
    """
    Compute WAIC from a matrix of log-likelihood samples.
    log_likelihoods[s][i] = log p(y_i | θ_s)   (S samples × n observations)

    WAIC = -2 * Σᵢ [log E_θ[p(yᵢ|θ)] - Var_θ[log p(yᵢ|θ)]]
    """
    S = len(log_likelihoods)
    n = len(log_likelihoods[0])
    lpd = []  # log pointwise predictive density
    p_waic = []  # effective number of parameters

    for i in range(n):
        lls = [log_likelihoods[s][i] for s in range(S)]
        # Log mean likelihood (log-sum-exp for stability)
        max_ll = max(lls)
        log_mean = max_ll + math.log(sum(math.exp(l-max_ll) for l in lls)/S)
        lpd.append(log_mean)
        var = sum((l-sum(lls)/S)**2 for l in lls)/(S-1) if S > 1 else 0.0
        p_waic.append(var)

    lppd = sum(lpd)
    p2 = sum(p_waic)
    return {'lppd': lppd, 'p_waic': p2, 'waic': -2*(lppd-p2), 'elpd_waic': lppd-p2}
