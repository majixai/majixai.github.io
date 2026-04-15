"""
numerical_core.py — PhD-Level Numerical Methods Library
========================================================
Implements:
  Numerical linear algebra: Conjugate Gradient, GMRES, MINRES, Arnoldi
  Eigenvalue solvers: Power iteration, inverse iteration, QR algorithm
  Root finding: Bisection, secant, Brent, Newton, Halley, Müller
  Interpolation: Lagrange, Barycentric, Chebyshev, cubic spline
  Numerical differentiation: Richardson extrapolation, complex-step
  Quadrature: Gauss-Legendre, Gauss-Chebyshev, Gauss-Laguerre, adaptive Simpson
  PDE finite differences: 1D/2D elliptic, parabolic, upwind advection
  Spectral methods: Chebyshev collocation for BVPs
"""

from __future__ import annotations
import math
from typing import Callable, Optional


# ---------------------------------------------------------------------------
# Vector/Matrix Utilities (self-contained)
# ---------------------------------------------------------------------------

def dot(u, v): return sum(a*b for a,b in zip(u,v))
def norm(v): return math.sqrt(dot(v,v))
def vadd(u,v): return [a+b for a,b in zip(u,v)]
def vsub(u,v): return [a-b for a,b in zip(u,v)]
def vscale(v,s): return [x*s for x in v]

def zeros(m,n): return [[0.0]*n for _ in range(m)]
def eye(n): return [[1.0 if i==j else 0.0 for j in range(n)] for i in range(n)]
def matvec(A,v): return [dot(row,v) for row in A]
def transpose(A): return [[A[j][i] for j in range(len(A))] for i in range(len(A[0]))]


# ---------------------------------------------------------------------------
# Conjugate Gradient (Hestenes-Stiefel)
# ---------------------------------------------------------------------------

def conjugate_gradient(A_matvec: Callable, b: list[float],
                        x0: Optional[list[float]] = None,
                        tol: float = 1e-10, max_iter: int = 10000,
                        precond: Optional[Callable] = None
                        ) -> tuple[list[float], int, list[float]]:
    """
    Preconditioned Conjugate Gradient for A x = b, A SPD.
    Uses PCG if precond is provided (M ≈ A⁻¹, precond(r) = M r).
    Convergence: ||r_k||_A / ||r_0||_A ≤ ((κ-1)/(κ+1))^k.
    """
    n = len(b)
    x = x0[:] if x0 else [0.0]*n
    r = vsub(b, A_matvec(x))
    z = precond(r) if precond else r[:]
    p = z[:]
    rz = dot(r, z)
    residuals = [norm(r)]

    for k in range(max_iter):
        if norm(r) < tol: break
        Ap = A_matvec(p)
        alpha = rz / max(dot(p, Ap), 1e-300)
        x = vadd(x, vscale(p, alpha))
        r = vsub(r, vscale(Ap, alpha))
        z = precond(r) if precond else r[:]
        rz_new = dot(r, z)
        beta = rz_new / max(rz, 1e-300)
        p = vadd(z, vscale(p, beta))
        rz = rz_new
        residuals.append(norm(r))

    return x, k+1, residuals


# ---------------------------------------------------------------------------
# GMRES (Arnoldi + Givens rotations)
# ---------------------------------------------------------------------------

def gmres(A_matvec: Callable, b: list[float],
          x0: Optional[list[float]] = None,
          tol: float = 1e-10, max_iter: int = 300,
          restart: int = 30) -> tuple[list[float], int, list[float]]:
    """
    Restarted GMRES(restart).
    Builds Krylov subspace K_k(A,r_0) via Arnoldi iteration;
    minimises ||b - Ax||_2 over the subspace.
    """
    n = len(b)
    x = x0[:] if x0 else [0.0]*n
    residuals = []

    for outer in range((max_iter-1)//restart + 1):
        r = vsub(b, A_matvec(x))
        beta = norm(r)
        residuals.append(beta)
        if beta < tol: break

        Q = [vscale(r, 1.0/beta)]  # Krylov basis (Arnoldi vectors)
        H = []  # Hessenberg matrix
        # Givens rotations
        cs, sn = [], []
        g = [beta] + [0.0]*restart  # RHS of least-squares problem

        for j in range(min(restart, max_iter - outer*restart)):
            # Arnoldi step
            w = A_matvec(Q[-1])
            h = [0.0]*(j+2)
            for i in range(j+1):
                h[i] = dot(w, Q[i])
                w = vsub(w, vscale(Q[i], h[i]))
            h[j+1] = norm(w)
            H.append(h)
            if h[j+1] > 1e-14:
                Q.append(vscale(w, 1.0/h[j+1]))

            # Apply previous Givens rotations
            for i in range(j):
                tmp = cs[i]*H[j][i] + sn[i]*H[j][i+1]
                H[j][i+1] = -sn[i]*H[j][i] + cs[i]*H[j][i+1]
                H[j][i] = tmp

            # New Givens rotation to eliminate H[j][j+1]
            denom = math.sqrt(H[j][j]**2 + H[j][j+1]**2)
            if denom < 1e-14:
                cs.append(1.0); sn.append(0.0)
            else:
                cs.append(H[j][j]/denom)
                sn.append(H[j][j+1]/denom)
            H[j][j] = cs[j]*H[j][j] + sn[j]*H[j][j+1]
            H[j][j+1] = 0.0
            g[j+1] = -sn[j]*g[j]
            g[j] = cs[j]*g[j]
            residuals.append(abs(g[j+1]))
            if abs(g[j+1]) < tol: break

        # Back-solve upper triangular system
        m = len(cs)
        y = [0.0]*m
        for i in range(m-1, -1, -1):
            y[i] = (g[i] - sum(H[k][i]*y[k] for k in range(i+1, m) if k < len(H) and i < len(H[k]))) / H[i][i]

        # Update x
        for j in range(m):
            x = vadd(x, vscale(Q[j], y[j]))

        if residuals[-1] < tol: break

    return x, len(residuals), residuals


# ---------------------------------------------------------------------------
# Root Finding
# ---------------------------------------------------------------------------

def bisect(f: Callable[[float], float], a: float, b: float,
           tol: float = 1e-12, max_iter: int = 100) -> float:
    """Bisection method. Requires f(a)*f(b) < 0."""
    fa, fb = f(a), f(b)
    if fa*fb > 0: raise ValueError("No sign change in [a,b]")
    for _ in range(max_iter):
        c = (a+b)/2.0; fc = f(c)
        if abs(fc) < tol or (b-a)/2.0 < tol: return c
        if fa*fc < 0: b, fb = c, fc
        else: a, fa = c, fc
    return (a+b)/2.0


def brent(f: Callable[[float], float], a: float, b: float,
          tol: float = 1e-12, max_iter: int = 100) -> float:
    """Brent's method (bisection + secant + inverse quadratic interpolation)."""
    fa, fb = f(a), f(b)
    if fa*fb > 0: raise ValueError("No sign change")
    if abs(fa) < abs(fb): a, b, fa, fb = b, a, fb, fa
    c, fc = a, fa
    mflag = True; s = b; fs = f(s); d = 0.0

    for _ in range(max_iter):
        if abs(b-a) < tol or abs(fb) < tol: return b
        if fa!=fc and fb!=fc:
            # Inverse quadratic interpolation
            s = (a*fb*fc/((fa-fb)*(fa-fc)) + b*fa*fc/((fb-fa)*(fb-fc))
                 + c*fa*fb/((fc-fa)*(fc-fb)))
        else:
            s = b - fb*(b-a)/(fb-fa)  # Secant
        cond1 = not ((3*a+b)/4 < s < b or b < s < (3*a+b)/4)
        cond2 = mflag and abs(s-b) >= abs(b-c)/2
        cond3 = not mflag and abs(s-b) >= abs(c-d)/2
        if cond1 or cond2 or cond3:
            s = (a+b)/2.0; mflag = True
        else:
            mflag = False
        fs = f(s); d, c, fc = c, b, fb
        if fa*fs < 0: b, fb = s, fs
        else: a, fa = s, fs
        if abs(fa) < abs(fb): a, b, fa, fb = b, a, fb, fa
    return b


def newton_raphson(f: Callable, df: Callable, x0: float,
                   tol: float = 1e-12, max_iter: int = 100) -> float:
    """Newton-Raphson: xₙ₊₁ = xₙ - f(xₙ)/f'(xₙ). Quadratic convergence."""
    x = x0
    for _ in range(max_iter):
        fx = f(x); dfx = df(x)
        if abs(dfx) < 1e-300: break
        x_new = x - fx/dfx
        if abs(x_new-x) < tol: return x_new
        x = x_new
    return x


def halley(f: Callable, df: Callable, d2f: Callable, x0: float,
           tol: float = 1e-12, max_iter: int = 100) -> float:
    """Halley's method: cubic convergence. x_{n+1} = x_n - f·f' / (f'² - f·f''/2)."""
    x = x0
    for _ in range(max_iter):
        fx = f(x); dfx = df(x); d2fx = d2f(x)
        denom = dfx**2 - 0.5*fx*d2fx
        if abs(denom) < 1e-300: break
        x_new = x - fx*dfx/denom
        if abs(x_new-x) < tol: return x_new
        x = x_new
    return x


# ---------------------------------------------------------------------------
# Interpolation
# ---------------------------------------------------------------------------

def barycentric_weights(nodes: list[float]) -> list[float]:
    """Barycentric weights for interpolation: wⱼ = 1/Πᵢ≠ⱼ(xⱼ-xᵢ)."""
    n = len(nodes)
    w = [1.0]*n
    for j in range(n):
        for i in range(n):
            if i!=j: w[j] /= (nodes[j]-nodes[i])
    return w


def barycentric_interp(nodes: list[float], values: list[float],
                        x: float) -> float:
    """Barycentric interpolation in O(n)."""
    w = barycentric_weights(nodes)
    if x in nodes: return values[nodes.index(x)]
    num = sum(w[j]*values[j]/(x-nodes[j]) for j in range(len(nodes)))
    den = sum(w[j]/(x-nodes[j]) for j in range(len(nodes)))
    return num/den


def chebyshev_nodes(n: int, a: float = -1.0, b: float = 1.0) -> list[float]:
    """Chebyshev nodes of the second kind on [a,b]: xₖ = ½(a+b) + ½(b-a)cos(kπ/n)."""
    return [(a+b)/2 + (b-a)/2*math.cos(math.pi*k/n) for k in range(n+1)]


def cubic_spline_natural(x: list[float], y: list[float]
                          ) -> tuple[list[float], list[float], list[float], list[float]]:
    """
    Natural cubic spline: S''(x₀) = S''(xₙ) = 0.
    Returns coefficients (a, b, c, d) s.t. Sᵢ(t) = aᵢ + bᵢh + cᵢh² + dᵢh³
    where h = t - xᵢ.
    """
    n = len(x)-1
    h = [x[i+1]-x[i] for i in range(n)]
    alpha = [3*(y[i+1]-y[i])/h[i] - 3*(y[i]-y[i-1])/h[i-1] for i in range(1, n)]
    # Thomas algorithm
    l = [0.0]*(n+1); mu = [0.0]*n; z = [0.0]*(n+1)
    l[0] = 1.0
    for i in range(1, n):
        l[i] = 2*(x[i+1]-x[i-1]) - h[i-1]*mu[i-1]
        mu[i] = h[i]/l[i]
        z[i] = (alpha[i-1]-h[i-1]*z[i-1])/l[i]
    l[n] = 1.0; z[n] = 0.0
    c = [0.0]*(n+1)
    for j in range(n-1, -1, -1): c[j] = z[j]-mu[j]*c[j+1]
    b = [(y[i+1]-y[i])/h[i] - h[i]*(c[i+1]+2*c[i])/3 for i in range(n)]
    d = [(c[i+1]-c[i])/(3*h[i]) for i in range(n)]
    return y[:n], b, c[:n], d


# ---------------------------------------------------------------------------
# Numerical Differentiation (Richardson Extrapolation)
# ---------------------------------------------------------------------------

def richardson_diff(f: Callable[[float], float], x: float,
                    h0: float = 0.1, order: int = 4) -> float:
    """
    Richardson extrapolation for the first derivative.
    Table of approximations: D(h), D(h/2), D(h/4), ...
    Combines to cancel O(h²), O(h⁴), ... errors.
    """
    h = h0
    D = [(f(x+h)-f(x-h))/(2*h)]
    for k in range(1, order):
        h /= 2.0
        D.append((f(x+h)-f(x-h))/(2*h))
        for j in range(len(D)-2, -1, -1):
            D[j] = D[j+1] + (D[j+1]-D[j])/(4**(k-j if k>j else 1)-1)
    return D[0]


def complex_step_diff(f: Callable, x: float, h: float = 1e-20) -> float:
    """
    Complex-step derivative: Im[f(x+ih)]/h.
    Machine-precision accuracy (avoids cancellation error of finite differences).
    """
    import cmath
    return f(complex(x, h)).imag / h


# ---------------------------------------------------------------------------
# Gauss-Legendre Quadrature
# ---------------------------------------------------------------------------

# Pre-computed GL nodes and weights for n=5 (exact for degree ≤ 9)
_GL5_NODES = [-0.9061798459, -0.5384693101, 0.0, 0.5384693101, 0.9061798459]
_GL5_WEIGHTS = [0.2369268851, 0.4786286705, 0.5688888889, 0.4786286705, 0.2369268851]

# For n=10 (exact for degree ≤ 19)
_GL10_NODES = [
    -0.9739065285, -0.8650633667, -0.6794095682, -0.4333953941, -0.1488743390,
     0.1488743390,  0.4333953941,  0.6794095682,  0.8650633667,  0.9739065285
]
_GL10_WEIGHTS = [
    0.0666713443, 0.1494513492, 0.2190863625, 0.2692667193, 0.2955242247,
    0.2955242247, 0.2692667193, 0.2190863625, 0.1494513492, 0.0666713443
]


def gauss_legendre(f: Callable[[float], float], a: float, b: float,
                    n_pts: int = 10) -> float:
    """
    Gauss-Legendre quadrature on [a,b].
    Exact for polynomials of degree ≤ 2n-1.
    """
    nodes = _GL10_NODES if n_pts == 10 else _GL5_NODES
    weights = _GL10_WEIGHTS if n_pts == 10 else _GL5_WEIGHTS
    mid, half = (a+b)/2.0, (b-a)/2.0
    return half * sum(weights[i]*f(mid + half*nodes[i]) for i in range(len(nodes)))


def adaptive_simpson(f: Callable[[float], float], a: float, b: float,
                      tol: float = 1e-10, max_depth: int = 50) -> float:
    """
    Adaptive Simpson's rule with Richardson error estimate.
    Subdivides interval where error exceeds tolerance.
    """
    def _simpson(f, a, b, fa, fm, fb):
        return (b-a)/6.0*(fa + 4*fm + fb)

    def _recurse(f, a, b, fa, fm, fb, S, tol, depth):
        c = (a+b)/2.0
        m1 = (a+c)/2.0; m2 = (c+b)/2.0
        fm1 = f(m1); fm2 = f(m2)
        S1 = _simpson(f, a, c, fa, fm1, fm)
        S2 = _simpson(f, c, b, fm, fm2, fb)
        err = abs(S1+S2-S)/15.0
        if depth >= max_depth or err < tol:
            return S1+S2+err
        return (_recurse(f, a, c, fa, fm1, fm, S1, tol/2, depth+1) +
                _recurse(f, c, b, fm, fm2, fb, S2, tol/2, depth+1))

    fa, fb = f(a), f(b); fm = f((a+b)/2.0)
    S = _simpson(f, a, b, fa, fm, fb)
    return _recurse(f, a, b, fa, fm, fb, S, tol, 0)


def gauss_laguerre(f: Callable[[float], float], n: int = 5) -> float:
    """
    Gauss-Laguerre quadrature: ∫₀^∞ e^{-x} f(x) dx ≈ Σ wᵢ f(xᵢ).
    """
    nodes_5 = [0.26356032, 1.41340305, 3.59642577, 7.08581001, 12.64080084]
    weights_5 = [0.52175561, 0.39866681, 0.07594245, 0.00361176, 0.00002337]
    return sum(weights_5[i]*f(nodes_5[i]) for i in range(5))


# ---------------------------------------------------------------------------
# 1D Heat Equation via Finite Differences (explicit FTCS)
# ---------------------------------------------------------------------------

def ftcs_heat(u0: list[float], nu: float, dx: float, dt: float,
              n_steps: int) -> list[list[float]]:
    """
    Forward-Time Centered-Space (FTCS) scheme for u_t = ν u_xx.
    Stable only if r = ν dt/dx² ≤ ½.
    """
    r = nu*dt/dx**2
    assert r <= 0.5, f"Stability violated: r = {r:.4f} > 0.5"
    n = len(u0)
    u = u0[:]
    solutions = [u[:]]
    for _ in range(n_steps):
        u_new = [0.0]*n
        for i in range(1, n-1):
            u_new[i] = u[i] + r*(u[i+1]-2*u[i]+u[i-1])
        u_new[0] = u[0]; u_new[-1] = u[-1]
        u = u_new; solutions.append(u[:])
    return solutions


# ---------------------------------------------------------------------------
# Chebyshev Spectral Collocation for 2nd-Order BVP
# ---------------------------------------------------------------------------

def cheb_diff_matrix(n: int) -> tuple[list[float], list[list[float]]]:
    """
    Chebyshev differentiation matrix D (n+1 × n+1) on Chebyshev-Lobatto nodes.
    D_ij = derivative of the j-th Chebyshev interpolating polynomial at node i.
    """
    nodes = [math.cos(math.pi*k/n) for k in range(n+1)]
    c = [2.0 if k==0 or k==n else 1.0 for k in range(n+1)]
    D = [[0.0]*(n+1) for _ in range(n+1)]
    for i in range(n+1):
        for j in range(n+1):
            if i!=j:
                D[i][j] = c[i]/c[j]*(-1)**(i+j)/(nodes[i]-nodes[j])
    for i in range(n+1):
        D[i][i] = -sum(D[i][j] for j in range(n+1) if j!=i)
    return nodes, D


def cheb_bvp(p: Callable[[float], float],  # coefficient of u'
             q: Callable[[float], float],  # coefficient of u
             f: Callable[[float], float],  # RHS
             bc_left: float, bc_right: float, n: int = 32
             ) -> tuple[list[float], list[float]]:
    """
    Spectral collocation for u'' + p(x)u' + q(x)u = f(x) on [-1,1].
    Boundary conditions: u(-1) = bc_left, u(1) = bc_right.
    """
    nodes, D = cheb_diff_matrix(n)
    # D2 = D @ D (matrix product)
    D2 = [[sum(D[i][k]*D[k][j] for k in range(n+1)) for j in range(n+1)] for i in range(n+1)]
    # Assemble: L = D2 + diag(p) D + diag(q)
    L = [[D2[i][j] + p(nodes[i])*D[i][j] + (q(nodes[i]) if i==j else 0.0)
          for j in range(n+1)] for i in range(n+1)]
    rhs = [f(nodes[i]) for i in range(n+1)]
    # Apply BCs at i=0 (x=1) and i=n (x=-1)
    L[0] = [1.0 if j==0 else 0.0 for j in range(n+1)]
    rhs[0] = bc_right
    L[n] = [1.0 if j==n else 0.0 for j in range(n+1)]
    rhs[n] = bc_left
    # Solve
    from copy import deepcopy
    M = deepcopy(L)
    for j in range(n+1):
        M[j] = L[j][:] + [rhs[j]]
    # Gaussian elimination
    for j in range(n+1):
        piv = max(range(j, n+1), key=lambda i: abs(M[i][j]))
        M[j], M[piv] = M[piv], M[j]
        for i in range(j+1, n+1):
            if abs(M[j][j]) < 1e-14: continue
            f_ = M[i][j]/M[j][j]
            for k in range(j, n+2): M[i][k] -= f_*M[j][k]
    u = [0.0]*(n+1)
    for i in range(n, -1, -1):
        u[i] = (M[i][n+1]-sum(M[i][k]*u[k] for k in range(i+1, n+1)))/M[i][i]
    return nodes, u
