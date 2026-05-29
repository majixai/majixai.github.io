"""
range_extension_levels.py — Numerical Methods / Range Extension Level Sequence
===============================================================================
Mathematical snippet extracted from the Session Raid Stats indicator.

Covers the generation and numerical analysis of the arithmetic level sequence
used to mark range-extension (raid) thresholds on the chart, and related
interpolation / root-finding utilities for inverse-level queries.

No external dependencies — pure Python 3.
"""

from __future__ import annotations

import math
from typing import Callable, List, Optional, Tuple


# ---------------------------------------------------------------------------
# 1. Arithmetic Level Sequence
# ---------------------------------------------------------------------------

def level_sequence(start: float, step: float, n: int = 6) -> List[float]:
    """
    Generate n equally-spaced range-extension levels.

    L_k = start + (k-1) * step,  k = 1, ..., n

    This is the arithmetic progression used by the Pine Script indicator to
    place horizontal lines at fixed point offsets beyond the session range.

    Args:
        start: First level in points (e.g. 20 pts beyond range boundary).
        step:  Distance between consecutive levels (e.g. 10 pts).
        n:     Number of levels (default 6, matching MAX_BUCKETS).

    Returns:
        Sorted list [L_1, ..., L_n].
    """
    return [start + i * step for i in range(n)]


# ---------------------------------------------------------------------------
# 2. Level from index (0-based) and its inverse
# ---------------------------------------------------------------------------

def level_at(k: int, start: float, step: float) -> float:
    """
    Return the level value for 0-based index k.

    L_k = start + k * step
    """
    return start + k * step


def index_at_level(level: float, start: float, step: float) -> float:
    """
    Return the (possibly fractional) 0-based index corresponding to `level`.

    k = (level - start) / step

    Useful for continuous interpolation between discrete levels.
    """
    if step == 0:
        raise ValueError("step must be non-zero")
    return (level - start) / step


# ---------------------------------------------------------------------------
# 3. Linear interpolation between levels
# ---------------------------------------------------------------------------

def lerp_level(alpha: float, start: float, step: float) -> float:
    """
    Linearly interpolate between levels given a fractional index alpha.

    result = start + alpha * step

    For alpha=0 → first level; alpha=1 → second level, etc.
    """
    return start + alpha * step


def inverse_lerp(level: float, start: float, step: float) -> float:
    """
    Inverse of lerp_level: given a level value return the fractional index.

    alpha = (level - start) / step
    """
    return index_at_level(level, start, step)


# ---------------------------------------------------------------------------
# 4. Bisection — find the level crossing a probability threshold
# ---------------------------------------------------------------------------

def bisect(f: Callable[[float], float], a: float, b: float,
           tol: float = 1e-10, max_iter: int = 200) -> Tuple[float, int]:
    """
    Bisection root-finder for f(x) = 0 on [a, b].

    Requires f(a) * f(b) < 0 (simple bracket).

    Application: given an empirical reach-probability function p(level), find
    the level L* such that p(L*) = target_probability.

    Args:
        f:        Function to find the root of.
        a, b:     Bracket endpoints with f(a)*f(b) < 0.
        tol:      Absolute convergence tolerance on |b-a|.
        max_iter: Maximum iterations.

    Returns:
        (root, iterations_used)
    """
    fa, fb = f(a), f(b)
    if fa * fb > 0:
        raise ValueError("f(a) and f(b) must have opposite signs")
    for i in range(max_iter):
        mid = (a + b) / 2
        if (b - a) / 2 < tol:
            return mid, i + 1
        fm = f(mid)
        if fa * fm <= 0:
            b, fb = mid, fm
        else:
            a, fa = mid, fm
    return (a + b) / 2, max_iter


# ---------------------------------------------------------------------------
# 5. Secant method — faster convergence for smooth probability functions
# ---------------------------------------------------------------------------

def secant(f: Callable[[float], float], x0: float, x1: float,
           tol: float = 1e-10, max_iter: int = 100) -> Tuple[float, int]:
    """
    Secant method for f(x) = 0.

    Convergence order ≈ 1.618 (golden ratio).

    Application: faster alternative to bisection for finding L* such that
    the smooth ECDF probability curve crosses a target value.

    Args:
        f:        Target function.
        x0, x1:  Two distinct starting guesses.
        tol:      Tolerance on |x1 - x0|.
        max_iter: Maximum iterations.

    Returns:
        (root, iterations_used)
    """
    f0, f1 = f(x0), f(x1)
    for i in range(max_iter):
        if abs(f1 - f0) < 1e-15:
            break
        x2 = x1 - f1 * (x1 - x0) / (f1 - f0)
        x0, f0 = x1, f1
        x1, f1 = x2, f(x2)
        if abs(x1 - x0) < tol:
            return x1, i + 1
    return x1, max_iter


# ---------------------------------------------------------------------------
# 6. Level density and spacing analysis
# ---------------------------------------------------------------------------

def level_density(levels: List[float]) -> List[float]:
    """
    Compute the spacing (density) between consecutive levels.

    For uniform arithmetic progressions all spacings equal the step.
    Useful as a sanity-check or for non-uniform custom level grids.

    Returns:
        List of n-1 consecutive differences.
    """
    return [levels[i + 1] - levels[i] for i in range(len(levels) - 1)]


def cumulative_levels(levels: List[float]) -> List[float]:
    """
    Return the cumulative sum of levels, i.e. the partial sums.

    Not commonly used directly, but helpful for normalisation when the
    levels represent incremental widths rather than absolute thresholds.
    """
    cum = []
    total = 0.0
    for lv in levels:
        total += lv
        cum.append(total)
    return cum


# ---------------------------------------------------------------------------
# 7. Nearest-level lookup (O(n) linear scan)
# ---------------------------------------------------------------------------

def nearest_level(value: float, levels: List[float]) -> Tuple[int, float]:
    """
    Find the closest level to `value` by absolute distance.

    Args:
        value:  Query value in points.
        levels: Sorted list of level thresholds.

    Returns:
        (index, level_value) of the nearest level.
    """
    best_i = 0
    best_d = abs(value - levels[0])
    for i in range(1, len(levels)):
        d = abs(value - levels[i])
        if d < best_d:
            best_d, best_i = d, i
    return best_i, levels[best_i]


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    lvls = level_sequence(20.0, 10.0)
    print("Levels         :", lvls)
    print("Densities      :", level_density(lvls))
    print("index_at(35)   :", index_at_level(35.0, 20.0, 10.0))   # → 1.5
    print("level_at(2)    :", level_at(2, 20.0, 10.0))             # → 40.0
    print("nearest(37)    :", nearest_level(37.0, lvls))           # → (1, 30.0)

    # Inverse problem: find level L* where BM reach-prob crosses 30 %
    import math as _m
    sigma, T = 8.0, 120
    # p(L) = erfc(L / (sigma * sqrt(2*T)))  → target = 0.30
    target = 0.30
    prob_fn = lambda L: _m.erfc(L / (sigma * _m.sqrt(2 * T))) - target
    root, iters = bisect(prob_fn, 0.1, 200.0)
    print(f"\nLevel for 30% BM reach-prob: {root:.2f} pts (bisect, {iters} iters)")
    root2, iters2 = secant(prob_fn, 30.0, 40.0)
    print(f"Level for 30% BM reach-prob: {root2:.2f} pts (secant, {iters2} iters)")
