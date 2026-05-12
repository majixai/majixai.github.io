"""
conics/integrations/numerical_bridge.py
=========================================
Bridge between conics/ and numerical_methods/numerical_core.py.

Provides:
    fit_via_conjugate_gradient(xs, ys, zs)
        — solves the 6×6 normal-equations system using the CG iterator from
          numerical_core instead of Gaussian elimination (demonstrates the
          iterative route for large / well-conditioned systems).

    conic_roots_brent(cc, x_range, y_fixed)
        — finds the x-roots of the conic at a fixed y using Brent's method
          from numerical_core.

Usage:
    from conics.integrations.numerical_bridge import fit_via_conjugate_gradient
    result = fit_via_conjugate_gradient(xs, ys, zs)
"""

from __future__ import annotations

import math
import os
import sys
from typing import List, Optional, Tuple

# --- inject numerical_methods/ -------------------------------------------
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_NM_DIR = os.path.join(_REPO_ROOT, "numerical_methods")
if _NM_DIR not in sys.path:
    sys.path.insert(0, _NM_DIR)

try:
    from numerical_core import conjugate_gradient, brent  # type: ignore[import]
    _NM_AVAILABLE = True
except ImportError:
    _NM_AVAILABLE = False

# --- conics core ---------------------------------------------------------
sys.path.insert(0, os.path.join(_REPO_ROOT, "conics", "python"))
from conics import ConicCoeffs, FitResult, decompose  # type: ignore[import]


def _matvec(MtM: List[List[float]], v: List[float]) -> List[float]:
    return [sum(MtM[i][j] * v[j] for j in range(6)) for i in range(6)]


def fit_via_conjugate_gradient(
    xs: List[float],
    ys: List[float],
    zs: List[float],
    tol: float = 1e-10,
    max_iter: int = 2000,
) -> Optional[FitResult]:
    """
    OLS conic fit using conjugate gradient on the 6×6 normal equations.

    Falls back to pure-Python Gaussian elimination if numerical_core is not
    available.

    Returns FitResult or None on failure.
    """
    n = len(xs)
    if n < 6:
        return None

    # Build M^T·M and M^T·z
    MtM = [[0.0] * 6 for _ in range(6)]
    Mtz = [0.0] * 6
    for i in range(n):
        x, y, z = xs[i], ys[i], zs[i]
        phi = [x*x, x*y, y*y, x, y, 1.0]
        for r in range(6):
            for c in range(6):
                MtM[r][c] += phi[r] * phi[c]
            Mtz[r] += phi[r] * z

    if _NM_AVAILABLE:
        def mv(v): return _matvec(MtM, v)
        theta, _it, _res = conjugate_gradient(mv, Mtz, tol=tol, max_iter=max_iter)
    else:
        # Fallback: diagonal-preconditioned steepest descent
        theta = [0.0] * 6
        r = [Mtz[i] - sum(MtM[i][j] * theta[j] for j in range(6)) for i in range(6)]
        for _ in range(max_iter):
            rr = sum(a*a for a in r)
            if math.sqrt(rr) < tol:
                break
            Ar = _matvec(MtM, r)
            alpha = rr / max(sum(r[i]*Ar[i] for i in range(6)), 1e-14)
            theta = [theta[i] + alpha*r[i] for i in range(6)]
            r     = [r[i] - alpha*Ar[i]    for i in range(6)]

    cc = ConicCoeffs(*theta)
    z_mean = sum(zs) / n
    ss_res = sum((zs[i] - cc.eval(xs[i], ys[i]))**2 for i in range(n))
    ss_tot = sum((zs[i] - z_mean)**2 for i in range(n))
    r2     = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    d = decompose(cc)
    d.rss = ss_res
    d.r2  = r2
    return FitResult(coeffs=cc, decomp=d, rss=ss_res, r2=r2)


def conic_roots_brent(
    cc: ConicCoeffs,
    x_range: Tuple[float, float],
    y_fixed: float,
    tol: float = 1e-10,
) -> List[float]:
    """
    Find x-roots of the conic equation at y = y_fixed in x_range using
    Brent's method from numerical_core.

    The equation becomes:
        A x² + (B y + D) x + (C y² + E y + F) = 0

    Returns a list of at most 2 real roots found within x_range.
    """
    # Quadratic coefficients in x
    a_q = cc.A
    b_q = cc.B * y_fixed + cc.D
    c_q = cc.C * y_fixed**2 + cc.E * y_fixed + cc.F

    roots: List[float] = []

    if _NM_AVAILABLE:
        def f(x): return a_q*x*x + b_q*x + c_q
        xa, xb = x_range
        # Check sign changes in two sub-intervals
        xm = (xa + xb) / 2
        for interval in [(xa, xm), (xm, xb)]:
            try:
                root = brent(f, interval[0], interval[1], tol=tol)
                roots.append(root)
            except Exception:
                pass
    else:
        # Analytic quadratic formula
        if abs(a_q) < 1e-12:
            if abs(b_q) > 1e-12:
                roots.append(-c_q / b_q)
        else:
            disc_q = b_q*b_q - 4*a_q*c_q
            if disc_q >= 0:
                sq = math.sqrt(disc_q)
                roots.append((-b_q + sq) / (2*a_q))
                roots.append((-b_q - sq) / (2*a_q))

    xa, xb = x_range
    return [r for r in roots if xa <= r <= xb]


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import math, random as _rng
    _rng.seed(42)
    t_vals = [2 * math.pi * i / 30 for i in range(30)]
    xp = [math.cos(t) + _rng.gauss(0, 0.08) for t in t_vals]
    yp = [0.5 * math.sin(t) + _rng.gauss(0, 0.08) for t in t_vals]
    zp = [x*x + 0.5*y*y + 0.1*x + _rng.gauss(0, 0.03) for x, y in zip(xp, yp)]
    res = fit_via_conjugate_gradient(xp, yp, zp)
    if res:
        print(f"numerical_bridge CG: {res.decomp.kind}, R²={res.r2:.4f}")

    # Roots of unit circle at y=0: should be x=±1
    cc = ConicCoeffs(A=1, B=0, C=1, D=0, E=0, F=-1)
    rts = conic_roots_brent(cc, (-2.0, 2.0), 0.0)
    print(f"numerical_bridge roots at y=0: {[round(r, 6) for r in rts]}")
    print("Expected: [-1.0, 1.0]")
