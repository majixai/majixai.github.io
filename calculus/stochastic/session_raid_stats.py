"""
session_raid_stats.py — Stochastic Calculus / Session Range as a Stochastic Process
=====================================================================================
Mathematical snippet extracted from the Session Raid Stats indicator.

Models the intraday price path during and after a session window as a
stochastic process and analyses when (and how far) the process exits the
range [lo, hi] established during the session.

Topics covered:
  - Range as the running maximum/minimum of a Brownian path over [0, T]
  - First-passage time (FPT) approximation beyond the range boundary
  - Probability of reaching level L within time horizon t via reflection principle
  - OU-corrected drift for mean-reverting markets

No external dependencies — pure Python 3.
"""

from __future__ import annotations

import math
import random
from typing import Optional


# ---------------------------------------------------------------------------
# 1. Running Extrema (Range Formation)
# ---------------------------------------------------------------------------

def session_range(path: list[float]) -> tuple[float, float]:
    """
    Compute the [lo, hi] range from a sequence of prices observed during a session.

    For a discretised Brownian motion B_t on [0, T] this equals:
        M_T = max_{0 ≤ t ≤ T} B_t  (range high)
        m_T = min_{0 ≤ t ≤ T} B_t  (range low)

    The expected range width for a standard BM is:
        E[M_T - m_T] = sqrt(2π T / π) ≈ 2 * sqrt(T / π)

    Args:
        path: Ordered sequence of prices (e.g. close prices per bar).

    Returns:
        (lo, hi) tuple.
    """
    return min(path), max(path)


# ---------------------------------------------------------------------------
# 2. First-Passage Time — Brownian Motion beyond a flat barrier
# ---------------------------------------------------------------------------

def fpt_pdf_bm(t: float, a: float, sigma: float = 1.0) -> float:
    """
    PDF of the first-passage time τ_a = inf{t > 0 : B_t = a} for a standard
    Brownian motion B_t starting at 0, crossing barrier a > 0.

    This is the inverse-Gaussian (Lévy) density:

        f(t; a, σ) = (a / (σ * sqrt(2π t³))) * exp(- a² / (2 σ² t))

    Useful for estimating how long before a post-session raid reaches a
    given level, assuming price follows a driftless Brownian motion.

    Args:
        t:     Time (> 0).
        a:     Barrier level (> 0) in the same units as σ.
        sigma: Volatility (annualised if t is in years, per-bar if t is in bars).

    Returns:
        Probability density at time t.
    """
    if t <= 0 or a <= 0:
        return 0.0
    return (a / (sigma * math.sqrt(2 * math.pi * t ** 3))) * math.exp(-a ** 2 / (2 * sigma ** 2 * t))


def fpt_cdf_bm(t: float, a: float, sigma: float = 1.0) -> float:
    """
    CDF of the first-passage time for BM to reach barrier a > 0.

    By the reflection principle:
        P(τ_a ≤ t) = 2 * (1 - Φ(a / (σ sqrt(t))))
                   = erfc(a / (σ sqrt(2t)))

    where Φ is the standard normal CDF.

    Args:
        t:     Time horizon.
        a:     Barrier in points (same units as σ).
        sigma: Volatility.

    Returns:
        Probability that barrier is hit by time t.
    """
    if t <= 0 or a <= 0:
        return 0.0
    return math.erfc(a / (sigma * math.sqrt(2 * t)))


# ---------------------------------------------------------------------------
# 3. Reach-Probability over a Fixed Horizon (reflection principle)
# ---------------------------------------------------------------------------

def prob_reach_level(level: float, sigma: float, horizon_bars: float) -> float:
    """
    Probability that a driftless BM starting at 0 reaches `level` at any point
    within `horizon_bars` bars, using the reflection principle:

        P(max_{0 ≤ s ≤ T} B_s ≥ level) = 2 * (1 - Φ(level / (σ sqrt(T))))

    This provides a theoretical benchmark for the empirical reach-probabilities
    computed by the indicator.

    Args:
        level:         Target extension level in points.
        sigma:         Per-bar price volatility (standard deviation of log-returns
                       times current price, or simply ATR / sqrt(bars)).
        horizon_bars:  Number of bars in the observation window.

    Returns:
        Probability in [0, 1].
    """
    if level <= 0 or sigma <= 0 or horizon_bars <= 0:
        return 0.0
    z = level / (sigma * math.sqrt(horizon_bars))
    # erfc(x/sqrt(2)) = 2*(1-Phi(x))
    return math.erfc(z / math.sqrt(2))


# ---------------------------------------------------------------------------
# 4. Brownian Bridge — Price Constrained to Start and End Within Range
# ---------------------------------------------------------------------------

def brownian_bridge_exit_prob(a: float, b: float, t: float, sigma: float = 1.0) -> float:
    """
    Probability that a Brownian bridge starting at x=0, ending at x=0 at
    time T, exits the interval [-b, a] at some point in (0, T).

    Approximation via the reflection formula (Karatzas & Shreve §1.4):
        P(exit [-b, a]) ≈ sum_{k=-∞}^{∞} [exp(-2k(a)(b)/σ²T) - exp(-2(ka+(k+1)b)²/σ²T)]
    Simplified two-term approximation:
        P ≈ exp(-2ab / (σ² T))

    Relevant to estimating the probability that a post-session price path
    (which tends to revert to the range) still raids the boundary.

    Args:
        a:     Upper boundary (range extension to the high side).
        b:     Lower boundary (range extension to the low side).
        t:     Time horizon.
        sigma: Volatility.

    Returns:
        Approximate exit probability.
    """
    if a <= 0 or b <= 0 or t <= 0 or sigma <= 0:
        return 0.0
    return math.exp(-2 * a * b / (sigma ** 2 * t))


# ---------------------------------------------------------------------------
# 5. Ornstein-Uhlenbeck Drift Correction
# ---------------------------------------------------------------------------

def ou_corrected_reach_prob(level: float, sigma: float, kappa: float,
                             mu: float, x0: float, horizon_bars: float) -> float:
    """
    Approximate probability of an Ornstein-Uhlenbeck process reaching `level`
    within `horizon_bars` bars, starting at x0 = 0 (relative to range boundary).

    OU SDE:  dX_t = κ(μ - X_t) dt + σ dW_t

    For the post-session phase, μ ≈ 0 (price mean-reverts to the range) and
    x0 = 0 (price starts at the boundary).

    Approximation: scale the BM result by the ratio of OU to BM variance at
    horizon T.  The OU variance is:
        Var(X_T) = σ²/(2κ) * (1 - e^{-2κT})

    The BM variance is σ²T, so the effective volatility is:
        σ_eff = sqrt(Var(X_T) / T) = σ * sqrt((1 - e^{-2κT}) / (2κT))

    Args:
        level:         Target extension in points.
        sigma:         Instantaneous volatility of the OU process.
        kappa:         Mean-reversion speed (per bar).
        mu:            Long-run mean (usually 0 in relative coordinates).
        x0:            Starting position (0 = at range boundary).
        horizon_bars:  Observation window in bars.

    Returns:
        Approximate reach-probability in [0, 1].
    """
    if kappa <= 0:
        return prob_reach_level(level, sigma, horizon_bars)
    ou_var = sigma ** 2 / (2 * kappa) * (1 - math.exp(-2 * kappa * horizon_bars))
    sigma_eff = math.sqrt(ou_var / horizon_bars) if horizon_bars > 0 else sigma
    return prob_reach_level(level, sigma_eff, horizon_bars)


# ---------------------------------------------------------------------------
# 6. Monte-Carlo simulation of raid events
# ---------------------------------------------------------------------------

def simulate_raid_reach_probs(
    levels: list[float],
    sigma_per_bar: float,
    horizon_bars: int,
    n_paths: int = 10_000,
    seed: Optional[int] = None,
) -> list[float]:
    """
    Monte-Carlo estimate of reach-probabilities for a list of extension levels,
    assuming driftless Brownian motion with per-bar volatility `sigma_per_bar`.

    For each simulated path:
      - Start at x = 0 (range boundary)
      - Simulate `horizon_bars` increments ~ N(0, sigma_per_bar²)
      - Record the running maximum
      - For each level, check whether the maximum exceeded the level

    Args:
        levels:         Sorted list of target extension levels in points.
        sigma_per_bar:  Per-bar price volatility.
        horizon_bars:   Number of post-session bars to simulate.
        n_paths:        Number of Monte-Carlo paths.
        seed:           Optional RNG seed for reproducibility.

    Returns:
        List of reach-probabilities (%) for each level, in the same order.
    """
    rng = random.Random(seed)
    hits = [0] * len(levels)
    for _ in range(n_paths):
        x = 0.0
        running_max = 0.0
        for _ in range(horizon_bars):
            x += rng.gauss(0, sigma_per_bar)
            if x > running_max:
                running_max = x
        for j, lv in enumerate(levels):
            if running_max >= lv:
                hits[j] += 1
    return [h / n_paths * 100.0 for h in hits]


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Theoretical reach-probabilities via BM reflection principle
    levels = [20.0, 30.0, 40.0, 50.0, 60.0, 70.0]
    sigma  = 8.0   # typical per-bar ATR for a liquid futures market
    T      = 120   # 120-bar window (e.g. 2-hour cutoff at 1-min bars)

    print("=== Brownian Motion Reach-Probabilities (reflection principle) ===")
    for lv in levels:
        p = prob_reach_level(lv, sigma, T) * 100
        print(f"  Level {lv:5.1f} pts : {p:5.1f}%")

    print("\n=== OU-Corrected (κ=0.02) ===")
    for lv in levels:
        p = ou_corrected_reach_prob(lv, sigma, kappa=0.02, mu=0.0, x0=0.0,
                                     horizon_bars=T) * 100
        print(f"  Level {lv:5.1f} pts : {p:5.1f}%")

    print("\n=== Monte-Carlo (10 000 paths) ===")
    mc = simulate_raid_reach_probs(levels, sigma_per_bar=sigma, horizon_bars=T,
                                   n_paths=10_000, seed=42)
    for lv, p in zip(levels, mc):
        print(f"  Level {lv:5.1f} pts : {p:5.1f}%")
