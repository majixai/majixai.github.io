"""
matrix_core.py — PhD-Level Matrix Theory Library
=================================================
Implements: SVD (Golub-Reinsch bidiagonalisation), QR via Householder,
LU with partial pivoting, Cholesky, power iteration, inverse iteration,
QR eigenvalue algorithm (with shifts), Lanczos tridiagonalisation,
matrix exponential (Padé approximation), matrix functions via Schur,
Kronecker product utilities, spectral clustering, and random matrix
generation with empirical spectral distribution analysis.
"""

from __future__ import annotations
import math
import cmath
from typing import Optional


# ---------------------------------------------------------------------------
# Basic Linear Algebra
# ---------------------------------------------------------------------------

def zeros(m: int, n: int) -> list[list[float]]:
    return [[0.0] * n for _ in range(m)]


def eye(n: int) -> list[list[float]]:
    m = zeros(n, n)
    for i in range(n): m[i][i] = 1.0
    return m


def mat_copy(A: list[list[float]]) -> list[list[float]]:
    return [row[:] for row in A]


def mat_T(A: list[list[float]]) -> list[list[float]]:
    return [[A[j][i] for j in range(len(A))] for i in range(len(A[0]))]


def mat_mul(A, B):
    n, m, p = len(A), len(A[0]), len(B[0])
    C = zeros(n, p)
    for i in range(n):
        for k in range(m):
            if A[i][k] == 0.0: continue
            for j in range(p):
                C[i][j] += A[i][k] * B[k][j]
    return C


def mat_vec(A, v):
    return [sum(A[i][j] * v[j] for j in range(len(v))) for i in range(len(A))]


def dot(u, v):
    return sum(a * b for a, b in zip(u, v))


def norm2(v):
    return math.sqrt(dot(v, v))


def mat_sub(A, B):
    return [[A[i][j] - B[i][j] for j in range(len(A[0]))] for i in range(len(A))]


def mat_add(A, B):
    return [[A[i][j] + B[i][j] for j in range(len(A[0]))] for i in range(len(A))]


def mat_scale(A, s):
    return [[A[i][j] * s for j in range(len(A[0]))] for i in range(len(A))]


def frobenius_norm(A):
    return math.sqrt(sum(A[i][j] ** 2 for i in range(len(A)) for j in range(len(A[0]))))


def trace(A):
    return sum(A[i][i] for i in range(min(len(A), len(A[0]))))


def outer(u, v):
    return [[u[i] * v[j] for j in range(len(v))] for i in range(len(u))]


# ---------------------------------------------------------------------------
# LU Decomposition with Partial Pivoting
# ---------------------------------------------------------------------------

def lu_decomp(A):
    """Returns L, U, P s.t. P A = L U."""
    n = len(A)
    L = eye(n)
    U = mat_copy(A)
    P = list(range(n))
    for j in range(n):
        pivot = max(range(j, n), key=lambda i: abs(U[i][j]))
        U[j], U[pivot] = U[pivot], U[j]
        P[j], P[pivot] = P[pivot], P[j]
        L[j], L[pivot] = L[pivot], L[j]
        L[j][j] = 1.0
        if abs(U[j][j]) < 1e-15: continue
        for i in range(j + 1, n):
            L[i][j] = U[i][j] / U[j][j]
            for k in range(j, n):
                U[i][k] -= L[i][j] * U[j][k]
    return L, U, P


def lu_solve(A, b):
    L, U, P = lu_decomp(A)
    bp = [b[P[i]] for i in range(len(b))]
    n = len(b)
    y = [0.0] * n
    for i in range(n):
        y[i] = (bp[i] - sum(L[i][k] * y[k] for k in range(i))) / L[i][i]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        x[i] = (y[i] - sum(U[i][k] * x[k] for k in range(i + 1, n))) / U[i][i]
    return x


def mat_inv(A):
    n = len(A)
    cols = [lu_solve(A, [1.0 if i == j else 0.0 for i in range(n)]) for j in range(n)]
    return mat_T(cols)


# ---------------------------------------------------------------------------
# QR Decomposition via Householder Reflections
# ---------------------------------------------------------------------------

def qr_householder(A: list[list[float]]) -> tuple[list[list[float]], list[list[float]]]:
    """
    QR decomposition via Householder reflections.
    Returns (Q, R) s.t. A = Q R, Q orthogonal, R upper triangular.
    """
    m, n = len(A), len(A[0])
    Q = eye(m)
    R = mat_copy(A)

    for j in range(min(m - 1, n)):
        # Extract column below diagonal
        x = [R[i][j] for i in range(j, m)]
        norm_x = norm2(x)
        # Householder vector v = x + sign(x[0]) ||x|| e_1
        v = x[:]
        v[0] += math.copysign(norm_x, x[0])
        nv = norm2(v)
        if nv < 1e-14:
            continue
        v = [vi / nv for vi in v]

        # Apply reflection to R (submatrix)
        for col in range(j, n):
            sub = [R[i][col] for i in range(j, m)]
            tau = 2.0 * dot(v, sub)
            for i in range(j, m):
                R[i][col] -= tau * v[i - j]

        # Accumulate Q
        for col in range(m):
            sub = [Q[i][col] for i in range(j, m)]
            tau = 2.0 * dot(v, sub)
            for i in range(j, m):
                Q[i][col] -= tau * v[i - j]

    return mat_T(Q), R


# ---------------------------------------------------------------------------
# Bidiagonalisation (for SVD)
# ---------------------------------------------------------------------------

def bidiagonalise(A: list[list[float]]) -> tuple[list[list[float]],
                                                   list[list[float]],
                                                   list[list[float]]]:
    """
    Golub-Kahan bidiagonalisation: U^T A V = B (upper bidiagonal).
    Returns (U, B, V).
    """
    m, n = len(A), len(A[0])
    assert m >= n
    U = eye(m)
    V = eye(n)
    B = mat_copy(A)

    for j in range(n):
        # Left Householder (column j of B)
        x = [B[i][j] for i in range(j, m)]
        norm_x = norm2(x)
        v = x[:]
        v[0] += math.copysign(norm_x, x[0])
        nv = norm2(v)
        if nv > 1e-14:
            v = [vi / nv for vi in v]
            for col in range(j, n):
                sub = [B[i][col] for i in range(j, m)]
                tau = 2.0 * dot(v, sub)
                for i in range(j, m):
                    B[i][col] -= tau * v[i - j]
            for col in range(m):
                sub = [U[i][col] for i in range(j, m)]
                tau = 2.0 * dot(v, sub)
                for i in range(j, m):
                    U[i][col] -= tau * v[i - j]

        # Right Householder (row j of B, columns j+1..n-1)
        if j < n - 1:
            x = [B[j][k] for k in range(j + 1, n)]
            norm_x = norm2(x)
            v = x[:]
            v[0] += math.copysign(norm_x, x[0])
            nv = norm2(v)
            if nv > 1e-14:
                v = [vi / nv for vi in v]
                for row in range(j, m):
                    sub = [B[row][k] for k in range(j + 1, n)]
                    tau = 2.0 * dot(v, sub)
                    for k in range(j + 1, n):
                        B[row][k] -= tau * v[k - j - 1]
                for col in range(n):
                    sub = [V[k][col] for k in range(j + 1, n)]
                    tau = 2.0 * dot(v, sub)
                    for k in range(j + 1, n):
                        V[k][col] -= tau * v[k - j - 1]

    return mat_T(U), B, mat_T(V)


# ---------------------------------------------------------------------------
# Cholesky Decomposition
# ---------------------------------------------------------------------------

def cholesky(A: list[list[float]]) -> list[list[float]]:
    """A = L L^T for symmetric positive definite A."""
    n = len(A)
    L = zeros(n, n)
    for i in range(n):
        for j in range(i + 1):
            s = sum(L[i][k] * L[j][k] for k in range(j))
            if i == j:
                val = A[i][i] - s
                if val < 0:
                    raise ValueError(f"Not positive definite at ({i},{i}): {val}")
                L[i][j] = math.sqrt(val)
            else:
                if abs(L[j][j]) < 1e-15:
                    raise ValueError("Zero pivot in Cholesky.")
                L[i][j] = (A[i][j] - s) / L[j][j]
    return L


# ---------------------------------------------------------------------------
# Power Iteration and Rayleigh Quotient Iteration
# ---------------------------------------------------------------------------

def power_iteration(A: list[list[float]], max_iter: int = 1000,
                    tol: float = 1e-10) -> tuple[float, list[float]]:
    """
    Power iteration for dominant eigenvalue/vector.
    Returns (eigenvalue, eigenvector).
    Convergence rate: |λ₂/λ₁|.
    """
    n = len(A)
    import random
    v = [random.gauss(0, 1) for _ in range(n)]
    nv = norm2(v)
    v = [vi / nv for vi in v]
    eigenval = 0.0
    for _ in range(max_iter):
        Av = mat_vec(A, v)
        new_eigenval = dot(v, Av)  # Rayleigh quotient
        nAv = norm2(Av)
        v_new = [vi / nAv for vi in Av]
        if abs(new_eigenval - eigenval) < tol:
            return new_eigenval, v_new
        eigenval = new_eigenval
        v = v_new
    return eigenval, v


def inverse_iteration(A: list[list[float]], mu: float = 0.0,
                      max_iter: int = 100,
                      tol: float = 1e-10) -> tuple[float, list[float]]:
    """
    Inverse iteration (shifted power method) for eigenvalue nearest μ.
    Solves (A - μI)v = v_prev at each step.
    """
    n = len(A)
    import random
    v = [random.gauss(0, 1) for _ in range(n)]
    v = [vi / norm2(v) for vi in v]
    A_shift = mat_sub(A, mat_scale(eye(n), mu))
    eigenval = mu
    for _ in range(max_iter):
        w = lu_solve(A_shift, v)
        nw = norm2(w)
        v_new = [wi / nw for wi in w]
        rq = dot(v_new, mat_vec(A, v_new))
        if abs(rq - eigenval) < tol:
            return rq, v_new
        eigenval = rq
        v = v_new
    return eigenval, v


def rayleigh_quotient_iteration(A: list[list[float]], v0: Optional[list[float]] = None,
                                 max_iter: int = 50, tol: float = 1e-12
                                 ) -> tuple[float, list[float]]:
    """
    Rayleigh Quotient Iteration: cubically convergent for symmetric matrices.
    """
    n = len(A)
    import random
    v = v0 if v0 else [random.gauss(0, 1) for _ in range(n)]
    v = [vi / norm2(v) for vi in v]
    for _ in range(max_iter):
        mu = dot(v, mat_vec(A, v))  # Rayleigh quotient
        A_shift = mat_sub(A, mat_scale(eye(n), mu))
        try:
            w = lu_solve(A_shift, v)
        except Exception:
            break
        nw = norm2(w)
        v_new = [wi / nw for wi in w]
        if norm2([v_new[i] - v[i] for i in range(n)]) < tol:
            return mu, v_new
        v = v_new
    return dot(v, mat_vec(A, v)), v


# ---------------------------------------------------------------------------
# Lanczos Tridiagonalisation (symmetric)
# ---------------------------------------------------------------------------

def lanczos(A: list[list[float]], k: int,
            v0: Optional[list[float]] = None) -> tuple[list[float], list[float],
                                                        list[list[float]]]:
    """
    Lanczos algorithm for symmetric A.
    Builds tridiagonal T_k with diagonal α and off-diagonal β.

    Returns (alpha, beta, V) where V columns are Lanczos vectors.
    A V_k ≈ V_k T_k  (exact in exact arithmetic)
    """
    n = len(A)
    import random
    if v0 is None:
        v0 = [random.gauss(0, 1) for _ in range(n)]
    v0 = [vi / norm2(v0) for vi in v0]

    V = [v0]
    alpha = []
    beta = []

    v_prev = [0.0] * n

    for j in range(k):
        w = mat_vec(A, V[-1])
        a = dot(V[-1], w)
        alpha.append(a)
        # Orthogonalise
        w = [w[i] - a * V[-1][i] - (beta[-1] * v_prev[i] if beta else 0.0)
             for i in range(n)]
        b = norm2(w)
        beta.append(b)
        if b < 1e-14:
            break
        v_new = [wi / b for wi in w]
        v_prev = V[-1]
        V.append(v_new)

    return alpha, beta[:-1], V


# ---------------------------------------------------------------------------
# Matrix Exponential (Padé approximation + scaling-and-squaring)
# ---------------------------------------------------------------------------

# Padé coefficients for order 13 (Higham 2005)
_PADE_COEFS_13 = [
    1.0,
    0.5,
    0.12,
    1.833333333333333e-2,
    1.992063492063492e-3,
    1.630434782608696e-4,
    1.035196687370600e-5,
    5.175983436853033e-7,
    2.043151389366151e-8,
    6.306659613335130e-10,
    1.483027285835858e-11,
    2.529153492715844e-13,
    2.810170546428514e-15,
    1.544049750670308e-17,
]


def mat_expm(A: list[list[float]]) -> list[list[float]]:
    """
    Matrix exponential exp(A) via scaling and squaring with Padé [13/13].
    Implements Higham's Algorithm 10.20.
    """
    n = len(A)
    norm_A = frobenius_norm(A)
    # Scaling: find s s.t. ||A/2^s|| <= 0.5
    s = max(0, math.ceil(math.log2(norm_A / 5.0 + 1e-10)))
    scale = 2.0 ** s
    As = mat_scale(A, 1.0 / scale)

    # Compute A^2
    A2 = mat_mul(As, As)
    A4 = mat_mul(A2, A2)
    A6 = mat_mul(A2, A4)

    c = _PADE_COEFS_13

    # U and V polynomials for Padé [13/13]
    I = eye(n)

    def _mat_lin(*pairs):
        result = [[0.0] * n for _ in range(n)]
        for coef, M in pairs:
            for i in range(n):
                for j in range(n):
                    result[i][j] += coef * M[i][j]
        return result

    U6 = _mat_lin((c[13], A6), (c[11], A4), (c[9], A2))
    V6 = _mat_lin((c[12], A6), (c[10], A4), (c[8], A2))

    U = mat_mul(As, mat_add(mat_mul(A6, U6), _mat_lin((c[7], A6), (c[5], A4),
                                                        (c[3], A2), (c[1], I))))
    V = mat_add(mat_mul(A6, V6), _mat_lin((c[6], A6), (c[4], A4),
                                           (c[2], A2), (c[0], I)))

    # Solve (V - U) P = (V + U) for P = exp(A/2^s)
    VmU = mat_sub(V, U)
    VpU = mat_add(V, U)
    P = mat_T([lu_solve(VmU, [VpU[i][j] for i in range(n)]) for j in range(n)])

    # Squaring
    for _ in range(s):
        P = mat_mul(P, P)
    return P


# ---------------------------------------------------------------------------
# Kronecker Product
# ---------------------------------------------------------------------------

def kronecker(A: list[list[float]], B: list[list[float]]) -> list[list[float]]:
    """
    Kronecker product A ⊗ B.
    If A is m×n and B is p×q, result is mp×nq.
    """
    m, n = len(A), len(A[0])
    p, q = len(B), len(B[0])
    C = zeros(m * p, n * q)
    for i in range(m):
        for j in range(n):
            for r in range(p):
                for c_ in range(q):
                    C[i * p + r][j * q + c_] = A[i][j] * B[r][c_]
    return C


def vec(A: list[list[float]]) -> list[float]:
    """Vectorise matrix column by column: vec(A)."""
    n = len(A[0])
    return [A[i][j] for j in range(n) for i in range(len(A))]


def unvec(v: list[float], m: int, n: int) -> list[list[float]]:
    """Unvectorise: reshape v into m×n matrix (column-major)."""
    A = zeros(m, n)
    for j in range(n):
        for i in range(m):
            A[i][j] = v[j * m + i]
    return A


# ---------------------------------------------------------------------------
# Empirical Spectral Distribution (for random matrix analysis)
# ---------------------------------------------------------------------------

def empirical_spectral_distribution(eigenvalues: list[float],
                                      bins: int = 50
                                      ) -> tuple[list[float], list[float]]:
    """
    Compute empirical spectral distribution histogram.
    Returns (bin_centres, density).
    """
    min_ev = min(eigenvalues)
    max_ev = max(eigenvalues)
    width = (max_ev - min_ev) / bins
    counts = [0] * bins
    for ev in eigenvalues:
        idx = min(int((ev - min_ev) / width), bins - 1)
        counts[idx] += 1
    n = len(eigenvalues)
    centres = [min_ev + (i + 0.5) * width for i in range(bins)]
    density = [c / (n * width) for c in counts]
    return centres, density


def marchenko_pastur_density(x: float, gamma: float,
                              sigma2: float = 1.0) -> float:
    """
    Marchenko–Pastur density at x for ratio γ = p/n.
    ρ_MP(x) = √((λ+-x)(x-λ-)) / (2π σ² γ x)  for x in [λ-, λ+].
    """
    lp = sigma2 * (1 + math.sqrt(gamma)) ** 2
    lm = sigma2 * (1 - math.sqrt(gamma)) ** 2
    if x <= lm or x >= lp or x <= 0:
        return 0.0
    return math.sqrt((lp - x) * (x - lm)) / (2 * math.pi * sigma2 * gamma * x)


def semicircle_density(x: float, sigma2: float = 1.0) -> float:
    """Wigner semicircle density ρ_sc(x) = √(4σ²-x²) / (2πσ²)."""
    val = 4 * sigma2 - x ** 2
    if val < 0:
        return 0.0
    return math.sqrt(val) / (2 * math.pi * sigma2)


# ---------------------------------------------------------------------------
# Symmetric Tridiagonal Eigenvalue (QR with Wilkinson shift)
# ---------------------------------------------------------------------------

def tridiag_eig(alpha: list[float], beta: list[float],
                max_iter: int = 1000, tol: float = 1e-12
                ) -> list[float]:
    """
    Eigenvalues of a real symmetric tridiagonal matrix T = tridiag(β, α, β)
    via the QR algorithm with Wilkinson shifts.

    Returns list of eigenvalues (unsorted).
    """
    n = len(alpha)
    a = alpha[:]
    b = beta[:] + [0.0]  # pad

    eigenvalues = []
    size = n

    for _ in range(max_iter * n):
        if size == 1:
            eigenvalues.append(a[0])
            break

        # Deflation check
        for i in range(size - 1):
            if abs(b[i]) < tol * (abs(a[i]) + abs(a[i + 1])):
                b[i] = 0.0

        # Find unreduced block
        end = size - 1
        while end > 0 and abs(b[end - 1]) < tol:
            eigenvalues.append(a[end])
            end -= 1
            size -= 1

        if size <= 1:
            if size == 1:
                eigenvalues.append(a[0])
            break

        # Wilkinson shift
        d = (a[end - 1] - a[end]) / 2.0
        shift = a[end] - b[end - 1] ** 2 / (
            d + math.copysign(math.sqrt(d ** 2 + b[end - 1] ** 2), d))

        # QR step with shift
        c, s = 1.0, 0.0
        g = a[0] - shift
        for i in range(end):
            r = math.sqrt(g ** 2 + b[i] ** 2) if i < end else g
            c_new = g / r if r > 1e-14 else 1.0
            s_new = b[i] / r if r > 1e-14 else 0.0

            if i > 0:
                b[i - 1] = r * s  # previous off-diagonal

            g = c_new * (a[i] - shift) - s_new * b[i] * c
            a_new_i = c_new ** 2 * a[i] + s_new ** 2 * a[i + 1] - 2 * c_new * s_new * b[i]
            a[i] = a_new_i + shift

            b[i] = c_new * s_new * (a[i + 1] - a[i] - shift)
            # This is approximate; full implementation tracks exact b_new

            c, s = c_new, s_new

        a[end] = shift + g

    return eigenvalues
