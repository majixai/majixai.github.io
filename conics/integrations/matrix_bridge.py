"""
conics/integrations/matrix_bridge.py
======================================
Bridge between conics/ and matrix/matrix_core.py.

Provides:
    normal_matrix_solve(xs, ys, zs)
        — builds the 6×6 normal-equations system using matrix_core.mat_mul /
          matrix_core.lu_solve, then delegates to conics.fit_ols.

    conic_via_svd(xs, ys, zs)
        — least-squares conic fit via economy SVD (matrix_core.svd_thin).

Usage:
    from conics.integrations.matrix_bridge import normal_matrix_solve
    result = normal_matrix_solve(xs, ys, zs)
"""

from __future__ import annotations

import os
import sys
from typing import List, Optional

# --- inject matrix/ into sys.path ----------------------------------------
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_MATRIX_DIR = os.path.join(_REPO_ROOT, "matrix")
if _MATRIX_DIR not in sys.path:
    sys.path.insert(0, _MATRIX_DIR)

try:
    from matrix_core import mat_mul, mat_T, zeros, eye  # type: ignore[import]
    _MATRIX_CORE_AVAILABLE = True
except ImportError:
    _MATRIX_CORE_AVAILABLE = False

# --- conics core ---------------------------------------------------------
sys.path.insert(0, os.path.join(_REPO_ROOT, "conics", "python"))
from conics import ConicCoeffs, ConicDecomposition, FitResult, decompose  # type: ignore[import]


def _lu_solve_generic(A_mat: List[List[float]], b: List[float]) -> Optional[List[float]]:
    """Solve A·x = b via Gaussian elimination with partial pivoting."""
    n = len(b)
    aug = [A_mat[i][:] + [b[i]] for i in range(n)]
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


def normal_matrix_solve(
    xs: List[float],
    ys: List[float],
    zs: List[float],
) -> Optional[FitResult]:
    """
    Fit z = Ax² + Bxy + Cy² + Dx + Ey + F via the 6×6 normal equations.

    When matrix_core is available, uses its mat_mul for the accumulation step.
    Falls back to a self-contained Python solver otherwise.

    Returns FitResult or None on a singular normal matrix.
    """
    n = len(xs)
    if n < 6:
        return None

    # Build design matrix rows
    Phi: List[List[float]] = []
    for i in range(n):
        x, y = xs[i], ys[i]
        Phi.append([x*x, x*y, y*y, x, y, 1.0])

    if _MATRIX_CORE_AVAILABLE:
        # Use matrix_core.mat_mul: (M^T·M) and (M^T·z)
        PhiT = mat_T(Phi)
        MtM  = mat_mul(PhiT, Phi)
        Mtz  = mat_mul(PhiT, [[z] for z in zs])
        b    = [row[0] for row in Mtz]
    else:
        MtM  = [[0.0] * 6 for _ in range(6)]
        b    = [0.0] * 6
        for i in range(n):
            phi = Phi[i]
            for r in range(6):
                for c in range(6):
                    MtM[r][c] += phi[r] * phi[c]
                b[r] += phi[r] * zs[i]

    theta = _lu_solve_generic(MtM, b)
    if theta is None:
        return None

    cc = ConicCoeffs(*theta)

    z_mean = sum(zs) / n
    ss_res = sum((zs[i] - cc.eval(xs[i], ys[i]))**2 for i in range(n))
    ss_tot = sum((zs[i] - z_mean)**2 for i in range(n))
    r2     = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    d = decompose(cc)
    d.rss = ss_res
    d.r2  = r2
    return FitResult(coeffs=cc, decomp=d, rss=ss_res, r2=r2)


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
    res = normal_matrix_solve(xp, yp, zp)
    if res:
        print(f"matrix_bridge: {res.decomp.kind}, R²={res.r2:.4f}")
    else:
        print("matrix_bridge: fit failed")
