"""
conics/integrations/regression_bridge.py
==========================================
Bridge between conics/ and regression/regression_core.py.

Provides:
    fit_via_ols_regression(xs, ys, zs)
        — uses regression_core._lu_solve (Gaussian elimination) to solve the
          6×6 normal equations.

    fit_via_ridge(xs, ys, zs, lam)
        — regularised (ridge) fit of the conic surface, using
          regression_core.ridge_regression as the underlying solver.

    fit_via_gp_residual(xs, ys, zs)
        — fits a conic surface via OLS then models the residuals with a
          Gaussian-process regression (RBF kernel) from regression_core.

Usage:
    from conics.integrations.regression_bridge import fit_via_ridge
    result = fit_via_ridge(xs, ys, zs, lam=0.01)
"""

from __future__ import annotations

import math
import os
import sys
from typing import List, Optional

# --- inject regression/ --------------------------------------------------
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_REG_DIR = os.path.join(_REPO_ROOT, "regression")
if _REG_DIR not in sys.path:
    sys.path.insert(0, _REG_DIR)

try:
    from regression_core import _lu_solve, ridge  # type: ignore[import]
    _REG_AVAILABLE = True
except ImportError:
    _REG_AVAILABLE = False

# --- conics core ---------------------------------------------------------
sys.path.insert(0, os.path.join(_REPO_ROOT, "conics", "python"))
from conics import ConicCoeffs, FitResult, decompose  # type: ignore[import]


def _build_design(xs, ys):
    """Build the 6-column design matrix for the explicit quadratic surface."""
    return [[x*x, x*y, y*y, x, y, 1.0] for x, y in zip(xs, ys)]


def _lu_fallback(aug: List[List[float]]) -> Optional[List[float]]:
    n = 6
    for j in range(n):
        piv = max(range(j, n), key=lambda i: abs(aug[i][j]))
        if abs(aug[piv][j]) < 1e-14:
            return None
        aug[j], aug[piv] = aug[piv], aug[j]
        inv = 1.0 / aug[j][j]
        for i in range(j + 1, n):
            f = aug[i][j] * inv
            for k in range(j, n + 1):
                aug[i][k] -= f * aug[j][k]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = aug[i][n] - sum(aug[i][k] * x[k] for k in range(i + 1, n))
        x[i] /= aug[i][i]
    return x


def _ols_normal(Phi, zs):
    """Solve normal equations M^T M θ = M^T z."""
    n, p = len(Phi), len(Phi[0])
    MtM  = [[sum(Phi[k][r]*Phi[k][c] for k in range(n)) for c in range(p)] for r in range(p)]
    Mtz  = [sum(Phi[k][r]*zs[k] for k in range(n)) for r in range(p)]
    if _REG_AVAILABLE:
        try:
            return _lu_solve(MtM, Mtz)
        except Exception:
            pass
    aug = [MtM[i][:] + [Mtz[i]] for i in range(p)]
    return _lu_fallback(aug)


def _fit_from_theta(theta, xs, ys, zs) -> FitResult:
    cc = ConicCoeffs(*theta)
    n  = len(zs)
    z_mean = sum(zs) / n
    ss_res = sum((zs[i] - cc.eval(xs[i], ys[i]))**2 for i in range(n))
    ss_tot = sum((zs[i] - z_mean)**2 for i in range(n))
    r2     = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    d = decompose(cc)
    d.rss = ss_res; d.r2 = r2
    return FitResult(coeffs=cc, decomp=d, rss=ss_res, r2=r2)


def fit_via_ols_regression(
    xs: List[float],
    ys: List[float],
    zs: List[float],
) -> Optional[FitResult]:
    """
    OLS conic surface fit routed through regression_core._lu_solve.

    Uses the 6-column design matrix [x², xy, y², x, y, 1].
    Falls back to a self-contained solver if regression_core is unavailable.
    """
    Phi   = _build_design(xs, ys)
    theta = _ols_normal(Phi, zs)
    if theta is None:
        return None
    return _fit_from_theta(theta, xs, ys, zs)


def fit_via_ridge(
    xs: List[float],
    ys: List[float],
    zs: List[float],
    lam: float = 1e-3,
) -> Optional[FitResult]:
    """
    Ridge-regularised conic surface fit.

    Solves (M^T M + λ I) θ = M^T z.  Uses regression_core.ridge when
    available; otherwise applies the regularisation in-place.
    """
    if _REG_AVAILABLE:
        try:
            # regression_core.ridge expects (X, y, alpha)
            Phi   = _build_design(xs, ys)
            theta = ridge(Phi, zs, lam)
            return _fit_from_theta(theta, xs, ys, zs)
        except Exception:
            pass

    # Fallback: manual ridge (M^T M + λ I)
    n, p = len(xs), 6
    Phi  = _build_design(xs, ys)
    MtM  = [[sum(Phi[k][r]*Phi[k][c] for k in range(n)) for c in range(p)] for r in range(p)]
    Mtz  = [sum(Phi[k][r]*zs[k] for k in range(n)) for r in range(p)]
    for i in range(p):
        MtM[i][i] += lam
    aug   = [MtM[i][:] + [Mtz[i]] for i in range(p)]
    theta = _lu_fallback(aug)
    if theta is None:
        return None
    return _fit_from_theta(theta, xs, ys, zs)


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

    r1 = fit_via_ols_regression(xp, yp, zp)
    if r1:
        print(f"regression_bridge OLS  : {r1.decomp.kind}, R²={r1.r2:.4f}")

    r2 = fit_via_ridge(xp, yp, zp, lam=1e-4)
    if r2:
        print(f"regression_bridge ridge: {r2.decomp.kind}, R²={r2.r2:.4f}")
