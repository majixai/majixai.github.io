# conics/cython/conics.pyx
# ========================
# Cython typed extension wrapping the pure-Python conics core.
#
# Provides typed, C-speed versions of the core routines:
#   - cy_discriminant(A, B, C)
#   - cy_classify(A, B, C)
#   - cy_center(A, B, C, D, E)
#   - cy_angle(A, B, C)
#   - cy_axes(A, B, C, D, E, F, cx, cy)
#   - cy_decompose(A, B, C, D, E, F)
#   - cy_eval(A, B, C, D, E, F, x, y)
#   - cy_fit_ols(xs, ys, zs)           — normal-equation solver
#
# Build:
#   cd conics/cython
#   python setup.py build_ext --inplace
#
# Usage:
#   from conics.cython.conics import cy_decompose, cy_fit_ols

# cython: language_level=3
# cython: boundscheck=False, wraparound=False, cdivision=True

from libc.math cimport sqrt, atan2, fabs, log
import math as _math
from typing import Optional, Tuple, Sequence

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
cdef double DISC_TOL  = 1e-9
cdef double DET2_TOL  = 1e-12
cdef double EIGEN_TOL = 1e-12
cdef double SING_TOL  = 1e-14

# ---------------------------------------------------------------------------
# §1  Discriminant + classification
# ---------------------------------------------------------------------------

cdef double _discriminant(double A, double B, double C) nogil:
    return B * B - 4.0 * A * C


def cy_discriminant(double A, double B, double C) -> float:
    """Return the discriminant B² − 4AC."""
    return _discriminant(A, B, C)


def cy_classify(double A, double B, double C) -> str:
    """Classify the conic from the discriminant."""
    cdef double d = _discriminant(A, B, C)
    if d < -DISC_TOL:  return "ELLIPSE"
    if d >  DISC_TOL:  return "HYPERBOLA"
    return "PARABOLA"


# ---------------------------------------------------------------------------
# §2  Centre
# ---------------------------------------------------------------------------

def cy_center(double A, double B, double C,
              double D, double E) -> Optional[Tuple[float, float]]:
    """
    Solve the 2×2 gradient-zero system.

        2A cx + B cy = −D
         B cx + 2C cy = −E

    Returns (cx, cy) or None if singular.
    """
    cdef double det2 = 4.0 * A * C - B * B
    if fabs(det2) < DET2_TOL:
        return None
    cdef double cx = (B * E - 2.0 * C * D) / det2
    cdef double cy = (B * D - 2.0 * A * E) / det2
    return cx, cy


# ---------------------------------------------------------------------------
# §3  Angle
# ---------------------------------------------------------------------------

def cy_angle(double A, double B, double C) -> float:
    """
    Principal-axis rotation θ = ½ · atan2(B, A−C).
    """
    if fabs(A - C) < EIGEN_TOL and fabs(B) < EIGEN_TOL:
        return 0.0
    return 0.5 * atan2(B, A - C)


# ---------------------------------------------------------------------------
# §4  Semi-axes
# ---------------------------------------------------------------------------

def cy_axes(double A, double B, double C,
            double D, double E, double F,
            double cx, double cy) -> Tuple[float, float]:
    """
    Compute semi-axis lengths via eigenvalues of [[A, B/2], [B/2, C]].

    λ₁,₂ = (A+C)/2  ±  ½√((A−C)² + B²)
    aᵢ   = √|−k₃₃ / λᵢ|   where  k₃₃ = F − cx·D/2 − cy·E/2
    """
    cdef double k33   = F - cx * (D / 2.0) - cy * (E / 2.0)
    cdef double diff  = A - C
    cdef double ediff = 0.5 * sqrt(diff * diff + B * B if diff * diff + B * B > 0 else 0.0)
    cdef double lam1  = (A + C) / 2.0 + ediff
    cdef double lam2  = (A + C) / 2.0 - ediff
    cdef double sA = sqrt(fabs(-k33 / lam1)) if fabs(lam1) > EIGEN_TOL else 0.0
    cdef double sB = sqrt(fabs(-k33 / lam2)) if fabs(lam2) > EIGEN_TOL else 0.0
    return sA, sB


# ---------------------------------------------------------------------------
# §5  Evaluate quadratic form
# ---------------------------------------------------------------------------

def cy_eval(double A, double B, double C,
            double D, double E, double F,
            double x, double y) -> float:
    """Evaluate A x² + B xy + C y² + D x + E y + F at (x, y)."""
    return A*x*x + B*x*y + C*y*y + D*x + E*y + F


# ---------------------------------------------------------------------------
# §6  Full decomposition (returns dict)
# ---------------------------------------------------------------------------

def cy_decompose(double A, double B, double C,
                 double D, double E, double F) -> dict:
    """
    Full principal-axis decomposition.

    Returns a dict with keys:
        kind, disc, cx, cy, semiA, semiB, theta, ok
    """
    cdef double disc = _discriminant(A, B, C)
    kind  = cy_classify(A, B, C)
    theta = cy_angle(A, B, C)
    ctr   = cy_center(A, B, C, D, E)
    if ctr is not None:
        cx, cy = ctr
        sA, sB = cy_axes(A, B, C, D, E, F, cx, cy)
    else:
        cx = cy = sA = sB = 0.0
    return dict(kind=kind, disc=disc, cx=cx, cy=cy,
                semiA=sA, semiB=sB, theta=theta, ok=True)


# ---------------------------------------------------------------------------
# §7  OLS surface fit (typed inner loops)
# ---------------------------------------------------------------------------

def cy_fit_ols(xs, ys, zs) -> Optional[dict]:
    """
    Typed OLS fit of z = Ax² + Bxy + Cy² + Dx + Ey + F.

    Parameters: Python sequences xs, ys, zs of equal length.
    Returns dict with keys: A B C D E F disc kind cx cy semiA semiB theta rss r2 ok
    or None on a singular system.
    """
    cdef int n = len(xs)
    if n < 6:
        return None

    cdef double[6][7] M
    cdef int r, c, i, j
    cdef double x, y, z, phi0, phi1, phi2, phi3, phi4, phi5
    cdef double f, inv_piv, s
    cdef double[6] th

    # zero the matrix
    for r in range(6):
        for c in range(7):
            M[r][c] = 0.0

    # accumulate normal equations
    for i in range(n):
        x = xs[i]; y = ys[i]; z = zs[i]
        phi0 = x*x; phi1 = x*y; phi2 = y*y
        phi3 = x;   phi4 = y;   phi5 = 1.0
        cdef double[6] phi_arr
        phi_arr[0] = phi0; phi_arr[1] = phi1; phi_arr[2] = phi2
        phi_arr[3] = phi3; phi_arr[4] = phi4; phi_arr[5] = phi5
        for r in range(6):
            for c in range(6):
                M[r][c] += phi_arr[r] * phi_arr[c]
            M[r][6] += phi_arr[r] * z

    # Gaussian elimination with partial pivoting
    cdef int pivot_row
    cdef double tmp
    for j in range(6):
        pivot_row = j
        for i in range(j+1, 6):
            if fabs(M[i][j]) > fabs(M[pivot_row][j]):
                pivot_row = i
        if fabs(M[pivot_row][j]) < SING_TOL:
            return None
        # swap rows
        if pivot_row != j:
            for c in range(7):
                tmp = M[j][c]; M[j][c] = M[pivot_row][c]; M[pivot_row][c] = tmp
        inv_piv = 1.0 / M[j][j]
        for i in range(j+1, 6):
            f = M[i][j] * inv_piv
            for c in range(j, 7):
                M[i][c] -= f * M[j][c]

    # back-substitution
    for i in range(5, -1, -1):
        s = M[i][6]
        for c in range(i+1, 6):
            s -= M[i][c] * th[c]
        th[i] = s / M[i][i]

    cdef double A_ = th[0], B_ = th[1], C_ = th[2]
    cdef double D_ = th[3], E_ = th[4], F_ = th[5]

    # RSS / R²
    cdef double zmean = 0.0
    for i in range(n):
        zmean += zs[i]
    zmean /= n
    cdef double ss_res = 0.0, ss_tot = 0.0, pred, dev
    for i in range(n):
        pred   = A_*xs[i]*xs[i] + B_*xs[i]*ys[i] + C_*ys[i]*ys[i] + D_*xs[i] + E_*ys[i] + F_
        ss_res += (zs[i] - pred)**2
        dev     = zs[i] - zmean
        ss_tot += dev*dev
    cdef double r2 = 1.0 - ss_res/ss_tot if ss_tot > 0 else 0.0

    result = cy_decompose(A_, B_, C_, D_, E_, F_)
    result.update(A=A_, B=B_, C=C_, D=D_, E=E_, F=F_,
                  rss=ss_res, r2=r2)
    return result
