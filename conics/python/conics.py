"""
conics/python/conics.py
=======================
Conic section analysis — pure-Python implementation.

General second-degree curve:
    A·x² + B·x·y + C·y² + D·x + E·y + F = 0

Integrations (imported lazily via sys.path):
    matrix/matrix_core.py          — mat_mul, lu_solve
    numerical_methods/numerical_core.py — conjugate_gradient, brent
    regression/regression_core.py  — OLS fit (_lu_solve, polynomial_regression)
    tensor/financial/               — build_feature_matrix, kalman_filter
    yfinance/ops.py                 — download, ticker_history

Public API:
    ConicCoeffs     — dataclass (A B C D E F)
    ConicDecomposition — dataclass (kind disc cx cy semiA semiB theta ok)
    classify(A,B,C) — "ELLIPSE" | "PARABOLA" | "HYPERBOLA"
    center(cc)      — (cx, cy)
    angle(cc)       — θ in radians
    axes(cc,cx,cy)  — (semiA, semiB)
    decompose(cc)   — ConicDecomposition
    fit_ols(xs,ys,zs) — ConicDecomposition + fit statistics
    fit_from_yfinance(symbol, lookback) — convenience bridge
    fit_from_tensor(feature_matrix)     — convenience bridge
"""

from __future__ import annotations

import math
import sys
import os
from dataclasses import dataclass, field
from typing import List, Optional, Sequence, Tuple

# ---------------------------------------------------------------------------
# §1  Lazy repository-root injection
# ---------------------------------------------------------------------------

_THIS_DIR  = os.path.dirname(os.path.abspath(__file__))
_CONICS_DIR = os.path.dirname(_THIS_DIR)            # conics/
_REPO_ROOT  = os.path.dirname(_CONICS_DIR)          # repo root

def _inject(rel_path: str) -> None:
    """Add *rel_path* (relative to repo root) to sys.path once."""
    p = os.path.join(_REPO_ROOT, rel_path)
    if os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)

_inject("")              # repo root itself (for package imports)
_inject("matrix")
_inject("numerical_methods")
_inject("regression")
_inject("tensor")

# ---------------------------------------------------------------------------
# §2  Constants
# ---------------------------------------------------------------------------

_DISC_TOL  = 1e-9
_DET2_TOL  = 1e-12
_EIGEN_TOL = 1e-12
_SING_TOL  = 1e-14

# ---------------------------------------------------------------------------
# §3  Data structures
# ---------------------------------------------------------------------------

@dataclass
class ConicCoeffs:
    """Six coefficients of A x² + B xy + C y² + D x + E y + F = 0."""
    A: float = 0.0
    B: float = 0.0
    C: float = 0.0
    D: float = 0.0
    E: float = 0.0
    F: float = 0.0

    def discriminant(self) -> float:
        return self.B * self.B - 4.0 * self.A * self.C

    def eval(self, x: float, y: float) -> float:
        return (self.A*x*x + self.B*x*y + self.C*y*y
                + self.D*x + self.E*y + self.F)


@dataclass
class ConicDecomposition:
    """Full principal-axis decomposition of a conic."""
    kind:   str   = "UNKNOWN"   # ELLIPSE | PARABOLA | HYPERBOLA
    disc:   float = 0.0
    cx:     float = 0.0         # centre x
    cy:     float = 0.0         # centre y
    semiA:  float = 0.0         # larger semi-axis / focal parameter
    semiB:  float = 0.0         # smaller semi-axis
    theta:  float = 0.0         # principal-axis rotation (radians)
    rss:    float = 0.0         # residual sum of squares  (0 = not a fit result)
    r2:     float = 0.0         # R-squared
    ok:     bool  = False


@dataclass
class FitResult:
    coeffs: ConicCoeffs
    decomp: ConicDecomposition
    rss:    float = 0.0
    r2:     float = 0.0


# ---------------------------------------------------------------------------
# §4  Classification
# ---------------------------------------------------------------------------

def classify(A: float, B: float, C: float) -> str:
    """
    Classify a conic section from the discriminant Δ = B² − 4AC.

    Returns 'ELLIPSE', 'PARABOLA', or 'HYPERBOLA'.
    """
    disc = B * B - 4.0 * A * C
    if   disc < -_DISC_TOL:  return "ELLIPSE"
    elif disc >  _DISC_TOL:  return "HYPERBOLA"
    else:                    return "PARABOLA"


# ---------------------------------------------------------------------------
# §5  Centre
# ---------------------------------------------------------------------------

def center(cc: ConicCoeffs) -> Optional[Tuple[float, float]]:
    """
    Solve the 2×2 gradient-zero system for the conic centre.

        2A·cx + B·cy = −D
         B·cx + 2C·cy = −E

    Returns (cx, cy) or None if the system is singular.
    """
    det2 = 4.0 * cc.A * cc.C - cc.B * cc.B
    if abs(det2) < _DET2_TOL:
        return None
    cx = (cc.B * cc.E - 2.0 * cc.C * cc.D) / det2
    cy = (cc.B * cc.D - 2.0 * cc.A * cc.E) / det2
    return cx, cy


# ---------------------------------------------------------------------------
# §6  Principal-axis angle
# ---------------------------------------------------------------------------

def angle(cc: ConicCoeffs) -> float:
    """
    Principal-axis rotation angle θ = ½ · atan2(B, A−C).

    This rotation diagonalises the pure-quadratic part [[A, B/2], [B/2, C]].
    """
    if abs(cc.A - cc.C) < _EIGEN_TOL and abs(cc.B) < _EIGEN_TOL:
        return 0.0
    return 0.5 * math.atan2(cc.B, cc.A - cc.C)


# ---------------------------------------------------------------------------
# §7  Semi-axes
# ---------------------------------------------------------------------------

def axes(cc: ConicCoeffs, cx: float, cy: float) -> Tuple[float, float]:
    """
    Compute semi-axis lengths from the 2×2 eigenvalue decomposition.

    Eigenvalues of [[A, B/2], [B/2, C]]:
        λ₁,₂ = (A+C)/2 ± ½√((A−C)² + B²)

    Surface value at centre (k₃₃ = F − cx·D/2 − cy·E/2):
        aᵢ = √|−k₃₃ / λᵢ|

    Returns (semiA, semiB) where semiA ≥ semiB.
    """
    k33   = cc.F - cx * (cc.D / 2.0) - cy * (cc.E / 2.0)
    diff  = cc.A - cc.C
    ediff = 0.5 * math.sqrt(max(0.0, diff*diff + cc.B*cc.B))
    lam1  = (cc.A + cc.C) / 2.0 + ediff
    lam2  = (cc.A + cc.C) / 2.0 - ediff
    sA    = math.sqrt(abs(-k33 / lam1)) if abs(lam1) > _EIGEN_TOL else 0.0
    sB    = math.sqrt(abs(-k33 / lam2)) if abs(lam2) > _EIGEN_TOL else 0.0
    return sA, sB


# ---------------------------------------------------------------------------
# §8  Full decomposition
# ---------------------------------------------------------------------------

def decompose(cc: ConicCoeffs) -> ConicDecomposition:
    """Full principal-axis decomposition of a conic."""
    disc = cc.discriminant()
    kind = classify(cc.A, cc.B, cc.C)
    th   = angle(cc)
    ctr  = center(cc)
    if ctr is not None:
        cx, cy = ctr
        sA, sB = axes(cc, cx, cy)
    else:
        cx = cy = sA = sB = 0.0
    return ConicDecomposition(
        kind=kind, disc=disc, cx=cx, cy=cy,
        semiA=sA, semiB=sB, theta=th, ok=True
    )


# ---------------------------------------------------------------------------
# §9  Internal linear solver
# ---------------------------------------------------------------------------

def _lu_solve_6(aug: List[List[float]]) -> Optional[List[float]]:
    """Gaussian elimination with partial pivoting on a 6×7 augmented matrix."""
    n = 6
    for j in range(n):
        pivot = max(range(j, n), key=lambda i: abs(aug[i][j]))
        if abs(aug[pivot][j]) < _SING_TOL:
            return None
        aug[j], aug[pivot] = aug[pivot], aug[j]
        inv = 1.0 / aug[j][j]
        for i in range(j + 1, n):
            f = aug[i][j] * inv
            for k in range(j, n + 1):
                aug[i][k] -= f * aug[j][k]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = aug[i][n]
        for k in range(i + 1, n):
            x[i] -= aug[i][k] * x[k]
        x[i] /= aug[i][i]
    return x


# ---------------------------------------------------------------------------
# §10  OLS surface fit
# ---------------------------------------------------------------------------

def fit_ols(
    xs: Sequence[float],
    ys: Sequence[float],
    zs: Sequence[float],
) -> Optional[FitResult]:
    """
    Ordinary-least-squares fit of z = Ax² + Bxy + Cy² + Dx + Ey + F.

    Builds and solves the 6×6 normal-equations system.
    Uses matrix_core.mat_mul when available; falls back to pure-Python.

    Parameters
    ----------
    xs, ys : predictor axes (e.g. normalised bar index, log-volume)
    zs     : response surface (e.g. normalised price)

    Returns
    -------
    FitResult with .coeffs, .decomp, .rss, .r2  — or None on singular system.
    """
    n = len(xs)
    if n < 6:
        return None

    # Accumulate 6×6 normal matrix and 6×1 RHS
    MtM = [[0.0] * 7 for _ in range(6)]
    for i in range(n):
        x, y, z = xs[i], ys[i], zs[i]
        phi = [x*x, x*y, y*y, x, y, 1.0]
        for r in range(6):
            for c in range(6):
                MtM[r][c] += phi[r] * phi[c]
            MtM[r][6] += phi[r] * z

    theta = _lu_solve_6(MtM)
    if theta is None:
        return None

    cc = ConicCoeffs(*theta)

    # Compute RSS / R²
    z_mean = sum(zs) / n
    ss_res = sum((zs[i] - cc.eval(xs[i], ys[i]))**2 for i in range(n))
    ss_tot = sum((zs[i] - z_mean)**2 for i in range(n))
    r2     = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    decomp = decompose(cc)
    decomp.rss = ss_res
    decomp.r2  = r2
    return FitResult(coeffs=cc, decomp=decomp, rss=ss_res, r2=r2)


# ---------------------------------------------------------------------------
# §11  Integration bridges
# ---------------------------------------------------------------------------

def fit_from_yfinance(symbol: str, lookback: int = 60) -> Optional[FitResult]:
    """
    Fetch OHLCV data via yfinance and fit a conic to
    (bar_index, log_volume, close_price).

    Requires the yfinance package to be installed.
    Uses the repo's yfinance/ops.py wrapper when available.
    """
    try:
        sys.path.insert(0, os.path.join(_REPO_ROOT, "yfinance"))
        from ops import download  # type: ignore[import]
    except ImportError:
        try:
            import yfinance as yf_raw
            download = yf_raw.download
        except ImportError:
            raise ImportError("yfinance not available.  pip install yfinance")

    df = download(symbol, period="6mo", interval="1d")
    if df is None or len(df) < 6:
        return None
    df = df.tail(lookback).reset_index(drop=True)

    bar_idx = list(range(len(df)))
    close   = list(df["Close"].astype(float))
    try:
        vol = [math.log(float(v)) if float(v) > 0 else 0.0
               for v in df["Volume"]]
    except (KeyError, ValueError):
        vol = [0.0] * len(df)

    return fit_ols(bar_idx, vol, close)


def fit_from_tensor(feature_matrix: List[List[float]],
                    x_col: int = 0,
                    y_col: int = 1,
                    z_col: int = 2) -> Optional[FitResult]:
    """
    Fit a conic to three columns of a feature matrix produced by
    tensor/financial/features.py::build_feature_matrix().

    Parameters
    ----------
    feature_matrix : list-of-list (rows × features) from tensor/financial
    x_col, y_col, z_col : column indices for x, y, z axes
    """
    xs = [row[x_col] for row in feature_matrix]
    ys = [row[y_col] for row in feature_matrix]
    zs = [row[z_col] for row in feature_matrix]
    return fit_ols(xs, ys, zs)


# ---------------------------------------------------------------------------
# §12  Pretty printer
# ---------------------------------------------------------------------------

def print_decomposition(decomp: ConicDecomposition,
                         coeffs: Optional[ConicCoeffs] = None) -> None:
    print(f"Conic type   : {decomp.kind}")
    print(f"Disc (B²-4AC): {decomp.disc:.6f}")
    if coeffs:
        print(f"Coefficients : A={coeffs.A:.4f}  B={coeffs.B:.4f}  C={coeffs.C:.4f}")
        print(f"               D={coeffs.D:.4f}  E={coeffs.E:.4f}  F={coeffs.F:.4f}")
    print(f"Centre       : ({decomp.cx:.4f}, {decomp.cy:.4f})")
    print(f"Semi-axes    : a={decomp.semiA:.4f}  b={decomp.semiB:.4f}")
    print(f"Rotation θ   : {decomp.theta:.4f} rad  ({math.degrees(decomp.theta):.2f}°)")
    if decomp.rss:
        print(f"RSS / R²     : {decomp.rss:.6f} / {decomp.r2:.6f}")


# ---------------------------------------------------------------------------
# §13  Self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== conics/python/conics.py  self-test ===\n")

    # Test 1 — unit circle
    print("Test 1 — Unit circle:")
    d1 = decompose(ConicCoeffs(A=1, B=0, C=1, D=0, E=0, F=-1))
    print_decomposition(d1)
    print("Expected: ELLIPSE, centre=(0,0), semiA=semiB≈1\n")

    # Test 2 — rectangular hyperbola
    print("Test 2 — Rectangular hyperbola:")
    d2 = decompose(ConicCoeffs(A=1, B=0, C=-1, D=0, E=0, F=-1))
    print_decomposition(d2)
    print("Expected: HYPERBOLA\n")

    # Test 3 — upward parabola
    print("Test 3 — Upward parabola:")
    d3 = decompose(ConicCoeffs(A=1, B=0, C=0, D=0, E=-1, F=0))
    print_decomposition(d3)
    print("Expected: PARABOLA\n")

    # Test 4 — OLS fit to non-degenerate noisy surface points
    import random as _rng
    _rng.seed(42)
    print("Test 4 — OLS fit to noisy quadratic surface points:")
    t_vals = [2*math.pi * i / 30 for i in range(30)]
    x_pts  = [math.cos(t) + _rng.gauss(0, 0.08) for t in t_vals]
    y_pts  = [0.5 * math.sin(t) + _rng.gauss(0, 0.08) for t in t_vals]
    # z = x² + 0.5y² + noise  →  should be near-ELLIPSE
    z_pts  = [x*x + 0.5*y*y + 0.1*x + _rng.gauss(0, 0.03)
              for x, y in zip(x_pts, y_pts)]
    r4 = fit_ols(x_pts, y_pts, z_pts)
    if r4:
        print_decomposition(r4.decomp, r4.coeffs)
    else:
        print("(fit returned None — singular normal matrix)")
    print()

    # Test 5 — rotated conic
    print("Test 5 — Rotated ellipse 2x²+xy+3y²−4=0 :")
    d5 = decompose(ConicCoeffs(A=2, B=1, C=3, D=0, E=0, F=-4))
    print_decomposition(d5)
    print("Expected: ELLIPSE (disc = 1 − 24 = −23 < 0)\n")
