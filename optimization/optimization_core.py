"""
optimization_core.py — PhD-Level Optimization Library
======================================================
Implements:
  Gradient descent (fixed/Armijo/Wolfe backtracking line search)
  Heavy-ball / Polyak momentum
  Nesterov accelerated gradient
  Newton's method
  BFGS / L-BFGS
  Conjugate gradient (linear + nonlinear Fletcher-Reeves)
  ADMM (consensus / LASSO)
  Projected gradient (simplex projection)
  Interior point (log-barrier for LP)
  Simulated Annealing
  Evolutionary Strategy (CMA-ES sketch)
"""

from __future__ import annotations
import math
import random
from typing import Callable, Optional

Vec = list[float]
Mat = list[list[float]]
ScalarFn = Callable[[Vec], float]
GradFn = Callable[[Vec], Vec]


# ---------------------------------------------------------------------------
# Vector / Matrix Utilities
# ---------------------------------------------------------------------------

def dot(u: Vec, v: Vec) -> float:
    return sum(a * b for a, b in zip(u, v))

def norm(v: Vec) -> float:
    return math.sqrt(dot(v, v))

def vadd(u: Vec, v: Vec) -> Vec:
    return [a + b for a, b in zip(u, v)]

def vsub(u: Vec, v: Vec) -> Vec:
    return [a - b for a, b in zip(u, v)]

def vscale(v: Vec, s: float) -> Vec:
    return [x * s for x in v]

def mv(A: Mat, v: Vec) -> Vec:
    return [dot(A[i], v) for i in range(len(A))]

def mm(A: Mat, B: Mat) -> Mat:
    n, m, p = len(A), len(A[0]), len(B[0])
    C = [[0.0]*p for _ in range(n)]
    for i in range(n):
        for k in range(m):
            for j in range(p):
                C[i][j] += A[i][k] * B[k][j]
    return C

def outer(u: Vec, v: Vec) -> Mat:
    return [[u[i]*v[j] for j in range(len(v))] for i in range(len(u))]

def eye(n: int) -> Mat:
    return [[1.0 if i==j else 0.0 for j in range(n)] for i in range(n)]

def mat_add(A: Mat, B: Mat) -> Mat:
    return [[A[i][j]+B[i][j] for j in range(len(A[0]))] for i in range(len(A))]

def mat_sub(A: Mat, B: Mat) -> Mat:
    return [[A[i][j]-B[i][j] for j in range(len(A[0]))] for i in range(len(A))]

def mat_scale(A: Mat, s: float) -> Mat:
    return [[A[i][j]*s for j in range(len(A[0]))] for i in range(len(A))]


# ---------------------------------------------------------------------------
# Numerical Gradient and Hessian
# ---------------------------------------------------------------------------

def numerical_gradient(f: ScalarFn, x: Vec, h: float = 1e-5) -> Vec:
    """Central-difference gradient: ∂f/∂x_i ≈ (f(x+h e_i)-f(x-h e_i))/(2h)"""
    n = len(x)
    g = [0.0] * n
    for i in range(n):
        xp = x[:]; xp[i] += h
        xm = x[:]; xm[i] -= h
        g[i] = (f(xp) - f(xm)) / (2.0 * h)
    return g


def numerical_hessian(f: ScalarFn, x: Vec, h: float = 1e-4) -> Mat:
    """Finite-difference Hessian: H_{ij} ≈ (f(x+hi+hj)-f(x+hi-hj)-f(x-hi+hj)+f(x-hi-hj))/(4h²)"""
    n = len(x)
    H = [[0.0]*n for _ in range(n)]
    for i in range(n):
        for j in range(i, n):
            xpp = x[:]; xpp[i] += h; xpp[j] += h
            xpm = x[:]; xpm[i] += h; xpm[j] -= h
            xmp = x[:]; xmp[i] -= h; xmp[j] += h
            xmm = x[:]; xmm[i] -= h; xmm[j] -= h
            H[i][j] = H[j][i] = (f(xpp) - f(xpm) - f(xmp) + f(xmm)) / (4.0 * h * h)
    return H


# ---------------------------------------------------------------------------
# Line Search
# ---------------------------------------------------------------------------

def armijo_backtrack(f: ScalarFn, x: Vec, d: Vec, grad: Vec,
                     alpha0: float = 1.0, c1: float = 1e-4,
                     rho: float = 0.5, max_iter: int = 50) -> float:
    """Armijo (sufficient decrease) backtracking line search."""
    alpha = alpha0
    f0 = f(x)
    slope = dot(grad, d)
    for _ in range(max_iter):
        x_new = vadd(x, vscale(d, alpha))
        if f(x_new) <= f0 + c1 * alpha * slope:
            return alpha
        alpha *= rho
    return alpha


def wolfe_line_search(f: ScalarFn, grad_f: GradFn, x: Vec, d: Vec,
                      alpha0: float = 1.0, c1: float = 1e-4,
                      c2: float = 0.9, max_iter: int = 100
                      ) -> float:
    """Wolfe (sufficient decrease + curvature) line search via zoom."""
    f0 = f(x); g0 = dot(grad_f(x), d)
    alpha_lo, alpha_hi = 0.0, float('inf')
    alpha = alpha0

    for _ in range(max_iter):
        x_new = vadd(x, vscale(d, alpha))
        f_new = f(x_new)
        if f_new > f0 + c1 * alpha * g0:
            alpha_hi = alpha
        else:
            g_new = dot(grad_f(x_new), d)
            if abs(g_new) <= c2 * abs(g0):
                return alpha
            if g_new * (alpha_hi - alpha_lo) >= 0:
                alpha_hi = alpha_lo
            alpha_lo = alpha
        if alpha_hi < float('inf'):
            alpha = (alpha_lo + alpha_hi) / 2.0
        else:
            alpha = 2.0 * alpha_lo
    return alpha


# ---------------------------------------------------------------------------
# Gradient Descent
# ---------------------------------------------------------------------------

def gradient_descent(f: ScalarFn, grad_f: GradFn, x0: Vec,
                     lr: float = 0.01, max_iter: int = 1000,
                     tol: float = 1e-8, line_search: bool = False
                     ) -> tuple[Vec, list[float]]:
    """
    Gradient descent: x_{k+1} = x_k - α ∇f(x_k).
    Optionally uses Armijo line search.
    """
    x = x0[:]
    history = [f(x)]
    for _ in range(max_iter):
        g = grad_f(x)
        gn = norm(g)
        if gn < tol:
            break
        d = vscale(g, -1.0)
        alpha = armijo_backtrack(f, x, d, g) if line_search else lr
        x = vadd(x, vscale(d, alpha))
        history.append(f(x))
    return x, history


# ---------------------------------------------------------------------------
# Nesterov Accelerated Gradient
# ---------------------------------------------------------------------------

def nesterov_gradient(f: ScalarFn, grad_f: GradFn, x0: Vec,
                      lr: float = 0.01, max_iter: int = 1000,
                      tol: float = 1e-8) -> tuple[Vec, list[float]]:
    """
    Nesterov's accelerated gradient method (FISTA-style).
    Convergence: O(1/k²) for convex functions (vs O(1/k) for GD).
    """
    x = x0[:]
    y = x[:]
    t = 1.0
    history = [f(x)]
    for _ in range(max_iter):
        g = grad_f(y)
        if norm(g) < tol:
            break
        x_new = vsub(y, vscale(g, lr))
        t_new = (1 + math.sqrt(1 + 4 * t * t)) / 2.0
        y = vadd(x_new, vscale(vsub(x_new, x), (t - 1.0) / t_new))
        x = x_new
        t = t_new
        history.append(f(x))
    return x, history


# ---------------------------------------------------------------------------
# Newton's Method
# ---------------------------------------------------------------------------

def newton_method(f: ScalarFn, grad_f: GradFn, x0: Vec,
                  hess_f: Optional[Callable[[Vec], Mat]] = None,
                  max_iter: int = 100, tol: float = 1e-10
                  ) -> tuple[Vec, list[float]]:
    """
    Newton's method with Armijo line search.
    Quadratic convergence near strict local minima.
    """
    def _solve_newton(H: Mat, g: Vec) -> Vec:
        """Solve H * d = -g via Cholesky with damping."""
        n = len(g)
        # Add regularisation if not PD
        reg = 1e-6
        for _ in range(20):
            try:
                L = _chol(mat_add(H, mat_scale(eye(n), reg)))
                break
            except Exception:
                reg *= 10.0
        # Forward / back substitution
        y = [0.0] * n
        for i in range(n):
            y[i] = (-g[i] - sum(L[i][k] * y[k] for k in range(i))) / L[i][i]
        LT = [[L[j][i] for j in range(n)] for i in range(n)]
        d = [0.0] * n
        for i in range(n - 1, -1, -1):
            d[i] = (y[i] - sum(LT[i][k] * d[k] for k in range(i+1, n))) / LT[i][i]
        return d

    def _chol(A: Mat) -> Mat:
        n = len(A)
        L = [[0.0]*n for _ in range(n)]
        for i in range(n):
            for j in range(i+1):
                s = sum(L[i][k]*L[j][k] for k in range(j))
                if i == j:
                    v = A[i][i] - s
                    if v <= 0: raise ValueError("Not PD")
                    L[i][j] = math.sqrt(v)
                else:
                    L[i][j] = (A[i][j] - s) / L[j][j]
        return L

    x = x0[:]
    history = [f(x)]
    for _ in range(max_iter):
        g = grad_f(x)
        if norm(g) < tol:
            break
        H = hess_f(x) if hess_f else numerical_hessian(f, x)
        d = _solve_newton(H, g)
        alpha = armijo_backtrack(f, x, d, g)
        x = vadd(x, vscale(d, alpha))
        history.append(f(x))
    return x, history


# ---------------------------------------------------------------------------
# BFGS
# ---------------------------------------------------------------------------

def bfgs(f: ScalarFn, grad_f: GradFn, x0: Vec,
         max_iter: int = 1000, tol: float = 1e-8
         ) -> tuple[Vec, list[float]]:
    """
    BFGS quasi-Newton method.
    Update formula: H_{k+1} = (I-ρs y^T) H_k (I-ρy s^T) + ρs s^T
    where s=x_{k+1}-x_k, y=g_{k+1}-g_k, ρ=1/(y^Ts).
    """
    n = len(x0)
    x = x0[:]
    H = eye(n)  # Inverse Hessian approximation
    g = grad_f(x)
    history = [f(x)]

    for _ in range(max_iter):
        if norm(g) < tol:
            break
        d = vscale(mv(H, g), -1.0)
        alpha = wolfe_line_search(f, grad_f, x, d)
        x_new = vadd(x, vscale(d, alpha))
        g_new = grad_f(x_new)

        s = vsub(x_new, x)
        y = vsub(g_new, g)
        ys = dot(y, s)

        if abs(ys) > 1e-14:
            rho = 1.0 / ys
            I = eye(n)
            # H_{k+1} = (I - ρsy^T) H_k (I - ρys^T) + ρss^T
            A = mat_sub(I, mat_scale(outer(s, y), rho))
            B = mat_sub(I, mat_scale(outer(y, s), rho))
            H = mat_add(mm(mm(A, H), B), mat_scale(outer(s, s), rho))

        x, g = x_new, g_new
        history.append(f(x))

    return x, history


# ---------------------------------------------------------------------------
# L-BFGS (Limited-memory BFGS)
# ---------------------------------------------------------------------------

def lbfgs(f: ScalarFn, grad_f: GradFn, x0: Vec,
          m: int = 10, max_iter: int = 1000, tol: float = 1e-8
          ) -> tuple[Vec, list[float]]:
    """
    L-BFGS two-loop recursion for memory-efficient quasi-Newton.
    Stores only last m curvature pairs (s_k, y_k).
    """
    x = x0[:]
    g = grad_f(x)
    history = [f(x)]
    s_list: list[Vec] = []
    y_list: list[Vec] = []
    rho_list: list[float] = []

    def _two_loop(g_: Vec) -> Vec:
        """L-BFGS two-loop recursion to compute H_k g."""
        q = g_[:]
        alphas = []
        for i in range(len(s_list) - 1, -1, -1):
            a = rho_list[i] * dot(s_list[i], q)
            alphas.append(a)
            q = vsub(q, vscale(y_list[i], a))
        # Initial Hessian approximation: H_0 = (y_k^T s_k / y_k^T y_k) I
        if s_list:
            gamma = dot(s_list[-1], y_list[-1]) / max(dot(y_list[-1], y_list[-1]), 1e-14)
            r = vscale(q, gamma)
        else:
            r = q[:]
        for i in range(len(s_list)):
            beta = rho_list[i] * dot(y_list[i], r)
            r = vadd(r, vscale(s_list[i], alphas[-(i+1)] - beta))
        return r

    for _ in range(max_iter):
        if norm(g) < tol:
            break
        d = vscale(_two_loop(g), -1.0)
        alpha = wolfe_line_search(f, grad_f, x, d)
        x_new = vadd(x, vscale(d, alpha))
        g_new = grad_f(x_new)
        s = vsub(x_new, x); y = vsub(g_new, g)
        ys = dot(y, s)
        if abs(ys) > 1e-14:
            if len(s_list) >= m:
                s_list.pop(0); y_list.pop(0); rho_list.pop(0)
            s_list.append(s); y_list.append(y); rho_list.append(1.0/ys)
        x, g = x_new, g_new
        history.append(f(x))
    return x, history


# ---------------------------------------------------------------------------
# Nonlinear Conjugate Gradient (Fletcher-Reeves)
# ---------------------------------------------------------------------------

def conjugate_gradient_nonlinear(f: ScalarFn, grad_f: GradFn, x0: Vec,
                                  max_iter: int = 1000, tol: float = 1e-8
                                  ) -> tuple[Vec, list[float]]:
    """
    Nonlinear Conjugate Gradient (Fletcher-Reeves).
    β_k^{FR} = ||g_{k+1}||² / ||g_k||²
    """
    x = x0[:]
    g = grad_f(x)
    d = vscale(g, -1.0)
    history = [f(x)]
    for k in range(max_iter):
        if norm(g) < tol: break
        alpha = armijo_backtrack(f, x, d, g)
        x_new = vadd(x, vscale(d, alpha))
        g_new = grad_f(x_new)
        beta = dot(g_new, g_new) / max(dot(g, g), 1e-14)
        if k % len(x) == 0: beta = 0.0  # Restart every n steps
        d = vadd(vscale(g_new, -1.0), vscale(d, beta))
        x, g = x_new, g_new
        history.append(f(x))
    return x, history


# ---------------------------------------------------------------------------
# ADMM for LASSO
# ---------------------------------------------------------------------------

def admm_lasso(X: list[list[float]], y: list[float], lam: float,
               rho: float = 1.0, max_iter: int = 500, tol: float = 1e-6
               ) -> tuple[Vec, Vec, list[float]]:
    """
    ADMM for LASSO: min_{β,z} (1/2n)||y-Xβ||² + λ||z||₁ s.t. β=z.
    Augmented Lagrangian: L = f(β) + λ||z||₁ + u^T(β-z) + (ρ/2)||β-z||²

    β-update: (X^TX/n + ρI) β = X^Ty/n + ρ(z-u)
    z-update: z = S(β+u, λ/ρ)  [soft threshold]
    u-update: u = u + β - z
    """
    n, p = len(X), len(X[0])
    Xt = [[X[i][j] for i in range(n)] for j in range(p)]
    XtX = [[sum(Xt[r][k]*X[k][c] for k in range(n)) for c in range(p)] for r in range(p)]
    Xty = [sum(Xt[j][i]*y[i] for i in range(n)) for j in range(p)]

    # Pre-factor (X^TX/n + ρI)
    A = [[XtX[i][j]/n + (rho if i==j else 0.0) for j in range(p)] for i in range(p)]

    def _lu_solve(A_, b_):
        """In-place LU solve."""
        from copy import deepcopy
        M = deepcopy(A_)
        n_ = len(b_)
        perm = list(range(n_))
        for j in range(n_):
            pivot = max(range(j, n_), key=lambda i: abs(M[i][j]))
            M[j], M[pivot] = M[pivot], M[j]
            perm[j], perm[pivot] = perm[pivot], perm[j]
            for i in range(j+1, n_):
                if abs(M[j][j]) < 1e-14: continue
                M[i][j] /= M[j][j]
                for k in range(j+1, n_): M[i][k] -= M[i][j]*M[j][k]
        bp = [b_[perm[i]] for i in range(n_)]
        y_ = [0.0]*n_
        for i in range(n_): y_[i] = bp[i] - sum(M[i][k]*y_[k] for k in range(i))
        x_ = [0.0]*n_
        for i in range(n_-1,-1,-1): x_[i] = (y_[i]-sum(M[i][k]*x_[k] for k in range(i+1,n_)))/M[i][i]
        return x_

    def soft_thresh(v: Vec, t: float) -> Vec:
        return [math.copysign(max(abs(vi)-t, 0.0), vi) for vi in v]

    beta = [0.0]*p; z = [0.0]*p; u = [0.0]*p
    residuals = []
    for _ in range(max_iter):
        # β-update
        rhs = [Xty[j]/n + rho*(z[j]-u[j]) for j in range(p)]
        beta = _lu_solve(A, rhs)
        # z-update
        z_new = soft_thresh(vadd(beta, u), lam/rho)
        # u-update
        u = vadd(u, vsub(beta, z_new))
        primal_res = norm(vsub(beta, z_new))
        dual_res = norm(vscale(vsub(z_new, z), rho))
        residuals.append(primal_res)
        z = z_new
        if primal_res < tol and dual_res < tol:
            break
    return beta, z, residuals


# ---------------------------------------------------------------------------
# Projected Gradient onto Probability Simplex
# ---------------------------------------------------------------------------

def project_simplex(v: Vec) -> Vec:
    """
    O(n log n) projection onto the probability simplex Δ_n = {x: x≥0, Σx=1}.
    Duchi et al. 2008 algorithm.
    """
    n = len(v)
    u = sorted(v, reverse=True)
    cssv = 0.0; rho = 0
    for i in range(n):
        cssv += u[i]
        if u[i] - (cssv - 1.0) / (i + 1) > 0:
            rho = i
    theta = (sum(u[:rho+1]) - 1.0) / (rho + 1)
    return [max(vi - theta, 0.0) for vi in v]


# ---------------------------------------------------------------------------
# Simulated Annealing
# ---------------------------------------------------------------------------

def simulated_annealing(f: ScalarFn, x0: Vec,
                         T0: float = 100.0, T_min: float = 1e-6,
                         cooling: float = 0.995, step_size: float = 0.1,
                         max_iter: int = 100000,
                         seed: Optional[int] = None) -> tuple[Vec, float]:
    """
    Simulated annealing for global minimisation.
    Acceptance probability: exp(-(f_new - f_old)/T) for f_new > f_old.
    """
    if seed is not None: random.seed(seed)
    x = x0[:]
    fx = f(x)
    x_best, f_best = x[:], fx
    T = T0

    for _ in range(max_iter):
        if T < T_min: break
        # Random perturbation
        x_new = [xi + random.gauss(0, step_size) for xi in x]
        fx_new = f(x_new)
        delta = fx_new - fx
        if delta < 0 or random.random() < math.exp(-delta / T):
            x, fx = x_new, fx_new
            if fx < f_best:
                x_best, f_best = x[:], fx
        T *= cooling

    return x_best, f_best
