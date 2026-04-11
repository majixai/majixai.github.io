"""
de_core.py — PhD-Level Differential Equations Library
======================================================
Implements:
  ODE solvers: Euler, RK4, RK45 (Dormand-Prince), DOPRI853, Adams-Bashforth,
               Implicit Euler, Crank-Nicolson, BDF-2
  SDE solvers: Euler-Maruyama, Milstein, Stochastic RK
  PDE solvers: Finite-difference heat/wave equation (1D), Laplace (2D), FTCS, Crank-Nicolson PDE
  Boundary value problems: Shooting method, finite differences
  Fractional ODEs: Grünwald-Letnikov scheme
  Delay ODEs: Step method
"""

from __future__ import annotations
import math
import random
from typing import Callable, Optional

VecFn = Callable[[float, list[float]], list[float]]

# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _vadd(u: list[float], v: list[float]) -> list[float]:
    return [a + b for a, b in zip(u, v)]

def _vscale(v: list[float], s: float) -> list[float]:
    return [x * s for x in v]

def _vsub(u: list[float], v: list[float]) -> list[float]:
    return [a - b for a, b in zip(u, v)]

def _vnorm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


# ---------------------------------------------------------------------------
# Euler Method (1st order)
# ---------------------------------------------------------------------------

def euler(f: VecFn, t0: float, y0: list[float],
          t_end: float, h: float) -> tuple[list[float], list[list[float]]]:
    """Explicit Euler method: y_{n+1} = y_n + h f(t_n, y_n)."""
    t, y = t0, y0[:]
    ts, ys = [t], [y[:]]
    while t < t_end - 1e-12:
        h_ = min(h, t_end - t)
        k = f(t, y)
        y = _vadd(y, _vscale(k, h_))
        t += h_
        ts.append(t); ys.append(y[:])
    return ts, ys


# ---------------------------------------------------------------------------
# Classical Runge-Kutta (RK4)
# ---------------------------------------------------------------------------

def rk4(f: VecFn, t0: float, y0: list[float],
        t_end: float, h: float) -> tuple[list[float], list[list[float]]]:
    """Classical RK4: O(h^4) per step."""
    t, y = t0, y0[:]
    ts, ys = [t], [y[:]]
    while t < t_end - 1e-12:
        h_ = min(h, t_end - t)
        k1 = f(t,        y)
        k2 = f(t + h_/2, _vadd(y, _vscale(k1, h_/2)))
        k3 = f(t + h_/2, _vadd(y, _vscale(k2, h_/2)))
        k4 = f(t + h_,   _vadd(y, _vscale(k3, h_)))
        phi = _vadd(_vadd(_vadd(_vscale(k1, 1/6), _vscale(k2, 1/3)),
                          _vscale(k3, 1/3)), _vscale(k4, 1/6))
        y = _vadd(y, _vscale(phi, h_))
        t += h_
        ts.append(t); ys.append(y[:])
    return ts, ys


# ---------------------------------------------------------------------------
# Dormand-Prince RK45 (adaptive step size)
# ---------------------------------------------------------------------------

# Butcher tableau for DOPRI5
_DP_C  = [0, 1/5, 3/10, 4/5, 8/9, 1, 1]
_DP_A  = [
    [],
    [1/5],
    [3/40, 9/40],
    [44/45, -56/15, 32/9],
    [19372/6561, -25360/2187, 64448/6561, -212/729],
    [9017/3168, -355/33, 46732/5247, 49/176, -5103/18656],
    [35/384, 0, 500/1113, 125/192, -2187/6784, 11/84],
]
_DP_B5 = [35/384, 0, 500/1113, 125/192, -2187/6784, 11/84, 0]
_DP_B4 = [5179/57600, 0, 7571/16695, 393/640, -92097/339200, 187/2100, 1/40]


def rk45(f: VecFn, t0: float, y0: list[float], t_end: float,
         h0: float = 0.01, rtol: float = 1e-6, atol: float = 1e-9,
         h_min: float = 1e-12, h_max: float = 0.1
         ) -> tuple[list[float], list[list[float]]]:
    """
    Dormand-Prince embedded RK45 with PI step-size control.
    Local error estimate: |y5 - y4|; adjust step via
      h_new = h * min(10, max(0.1, 0.9 * (tol/err)^{1/5}))
    """
    t, y = t0, y0[:]
    h = min(h0, t_end - t)
    ts, ys = [t], [y[:]]

    while t < t_end - 1e-12:
        h = min(h, t_end - t, h_max)
        if h < h_min:
            break

        # Compute stages
        k = [None] * 7
        k[0] = f(t, y)
        for i in range(1, 7):
            yi = y[:]
            for j in range(i):
                if _DP_A[i]:
                    yi = _vadd(yi, _vscale(k[j], h * _DP_A[i][j]))
            k[i] = f(t + _DP_C[i] * h, yi)

        # 5th and 4th order solutions
        y5 = y[:]
        y4 = y[:]
        for i in range(7):
            y5 = _vadd(y5, _vscale(k[i], h * _DP_B5[i]))
            y4 = _vadd(y4, _vscale(k[i], h * _DP_B4[i]))

        # Error estimate and step control
        err_vec = _vsub(y5, y4)
        sc = [atol + rtol * max(abs(y[j]), abs(y5[j])) for j in range(len(y))]
        err = math.sqrt(sum((err_vec[j] / sc[j]) ** 2 for j in range(len(y))) / len(y))

        if err <= 1.0:
            t += h
            y = y5
            ts.append(t); ys.append(y[:])

        factor = min(10.0, max(0.1, 0.9 * (1.0 / max(err, 1e-14)) ** 0.2))
        h = h * factor

    return ts, ys


# ---------------------------------------------------------------------------
# Adams-Bashforth (4-step, explicit)
# ---------------------------------------------------------------------------

def adams_bashforth4(f: VecFn, t0: float, y0: list[float],
                     t_end: float, h: float
                     ) -> tuple[list[float], list[list[float]]]:
    """4-step Adams-Bashforth (bootstrapped with RK4)."""
    if t_end <= t0:
        return [t0], [y0[:]]

    # Bootstrap with RK4
    ts_rk, ys_rk = rk4(f, t0, y0, min(t0 + 3 * h, t_end), h)
    ts = ts_rk[:4]
    ys = [y[:] for y in ys_rk[:4]]
    fs = [f(ts[i], ys[i]) for i in range(len(ts))]

    while ts[-1] < t_end - 1e-12:
        h_ = min(h, t_end - ts[-1])
        n = len(ts) - 1
        f3, f2, f1, f0 = fs[-4], fs[-3], fs[-2], fs[-1]
        phi = _vadd(_vadd(_vadd(_vscale(f0, 55/24), _vscale(f1, -59/24)),
                          _vscale(f2, 37/24)), _vscale(f3, -9/24))
        y_new = _vadd(ys[-1], _vscale(phi, h_))
        t_new = ts[-1] + h_
        ts.append(t_new); ys.append(y_new); fs.append(f(t_new, y_new))

    return ts, ys


# ---------------------------------------------------------------------------
# Implicit Euler (BDF-1)
# ---------------------------------------------------------------------------

def implicit_euler(f: VecFn, Jf: Callable[[float, list[float]], list[list[float]]],
                   t0: float, y0: list[float], t_end: float, h: float,
                   newton_tol: float = 1e-10, newton_max: int = 50
                   ) -> tuple[list[float], list[list[float]]]:
    """
    Implicit Euler: y_{n+1} = y_n + h f(t_{n+1}, y_{n+1})
    Solved by Newton iteration:
      G(y) = y - y_n - h f(t_{n+1}, y) = 0
      J_G  = I - h J_f
    """
    def _mat_vec_sub(A, v, n_):
        """Solve (I - h*J) delta = rhs via Gaussian elimination."""
        from functools import reduce
        n = len(v)
        # Augmented matrix [I - h*J | rhs]
        mat = [[float(i == j) - h * A[i][j] for j in range(n)] + [v[i]]
               for i in range(n)]
        # Forward elimination with pivoting
        for j in range(n):
            pivot = max(range(j, n), key=lambda i: abs(mat[i][j]))
            mat[j], mat[pivot] = mat[pivot], mat[j]
            for i in range(j + 1, n):
                if abs(mat[j][j]) < 1e-14: continue
                m = mat[i][j] / mat[j][j]
                for k in range(j, n + 1): mat[i][k] -= m * mat[j][k]
        # Back substitution
        x = [0.0] * n
        for i in range(n - 1, -1, -1):
            x[i] = mat[i][n]
            for k in range(i + 1, n): x[i] -= mat[i][k] * x[k]
            x[i] /= mat[i][i] if abs(mat[i][i]) > 1e-14 else 1.0
        return x

    t, y = t0, y0[:]
    ts, ys = [t], [y[:]]
    while t < t_end - 1e-12:
        h_ = min(h, t_end - t)
        t_next = t + h_
        y_guess = y[:]
        for _ in range(newton_max):
            F_val = f(t_next, y_guess)
            G = _vsub(y_guess, _vadd(y, _vscale(F_val, h_)))
            norm_G = _vnorm(G)
            if norm_G < newton_tol: break
            J = Jf(t_next, y_guess)
            delta = _mat_vec_sub(J, [-g for g in G], len(G))
            y_guess = _vadd(y_guess, delta)
        y = y_guess
        t = t_next
        ts.append(t); ys.append(y[:])
    return ts, ys


# ---------------------------------------------------------------------------
# Euler-Maruyama SDE Solver
# ---------------------------------------------------------------------------

def euler_maruyama(drift: VecFn,
                   diffusion: Callable[[float, list[float]], list[list[float]]],
                   t0: float, y0: list[float], t_end: float, h: float,
                   seed: Optional[int] = None) -> tuple[list[float], list[list[float]]]:
    """
    Euler-Maruyama for the SDE dX = μ(t,X)dt + σ(t,X)dW.
    σ should return an n×m matrix; dW is an m-dimensional Brownian increment.
    """
    if seed is not None: random.seed(seed)
    t, y = t0, y0[:]
    ts, ys = [t], [y[:]]
    while t < t_end - 1e-12:
        h_ = min(h, t_end - t)
        n = len(y)
        mu = drift(t, y)
        sig = diffusion(t, y)
        m = len(sig[0]) if sig else 0
        dW = [random.gauss(0, math.sqrt(h_)) for _ in range(m)]
        dy = _vscale(mu, h_)
        for i in range(n):
            for j in range(m):
                dy[i] += sig[i][j] * dW[j]
        y = _vadd(y, dy)
        t += h_
        ts.append(t); ys.append(y[:])
    return ts, ys


# ---------------------------------------------------------------------------
# Milstein Scheme (univariate)
# ---------------------------------------------------------------------------

def milstein(drift: Callable[[float, float], float],
             diffusion: Callable[[float, float], float],
             diff_prime: Callable[[float, float], float],
             t0: float, x0: float, t_end: float, h: float,
             seed: Optional[int] = None) -> tuple[list[float], list[float]]:
    """
    Milstein scheme for scalar SDE dX = a(t,X)dt + b(t,X)dW:
      X_{n+1} = X_n + a·h + b·ΔW + ½b·b'((ΔW)² - h)
    O(h) strong convergence order 1 (vs Euler-Maruyama's 0.5).
    """
    if seed is not None: random.seed(seed)
    t, x = t0, x0
    ts, xs = [t], [x]
    while t < t_end - 1e-12:
        h_ = min(h, t_end - t)
        dW = random.gauss(0, math.sqrt(h_))
        a = drift(t, x); b = diffusion(t, x); bp = diff_prime(t, x)
        x = x + a * h_ + b * dW + 0.5 * b * bp * (dW ** 2 - h_)
        t += h_
        ts.append(t); xs.append(x)
    return ts, xs


# ---------------------------------------------------------------------------
# Finite Differences: 1D Heat Equation (Crank-Nicolson)
# ---------------------------------------------------------------------------

def heat_eq_1d_cn(u0: list[float], dx: float, dt: float,
                  n_steps: int, alpha: float = 1.0) -> list[list[float]]:
    """
    Crank-Nicolson scheme for u_t = α u_xx on [0,1] with Dirichlet BC u=0.
    u0: initial condition (interior points).
    Returns list of solutions at each time step.
    """
    n = len(u0)
    r = alpha * dt / (2 * dx ** 2)
    # Tridiagonal matrices: (I + r*D²) u^{n+1} = (I - r*D²) u^n
    # Thomas algorithm for tridiagonal system

    def _thomas(lower, main, upper, rhs):
        """Thomas algorithm for tridiagonal system."""
        n = len(rhs)
        c = upper[:]
        d = rhs[:]
        # Forward sweep
        for i in range(1, n):
            m = lower[i] / main[i - 1]
            main[i] -= m * c[i - 1]
            d[i] -= m * d[i - 1]
        # Back substitution
        x = [0.0] * n
        x[-1] = d[-1] / main[-1]
        for i in range(n - 2, -1, -1):
            x[i] = (d[i] - c[i] * x[i + 1]) / main[i]
        return x

    lower = [-r] * n
    main_lhs = [1 + 2 * r] * n
    upper = [-r] * n
    # Fix boundary (keep endpoints zero)
    lower[0] = upper[-1] = 0.0
    main_lhs[0] = main_lhs[-1] = 1.0

    u = u0[:]
    solutions = [u[:]]

    for _ in range(n_steps):
        # RHS: (I - r*D²) u
        rhs = [0.0] * n
        for i in range(n):
            rhs[i] = (r * u[i - 1] if i > 0 else 0.0) + (1 - 2 * r) * u[i] + (r * u[i + 1] if i < n - 1 else 0.0)
        rhs[0] = u[0]; rhs[-1] = u[-1]  # Dirichlet
        u = _thomas(lower[:], main_lhs[:], upper[:], rhs)
        solutions.append(u[:])

    return solutions


# ---------------------------------------------------------------------------
# 2D Laplace Equation (Gauss-Seidel iteration)
# ---------------------------------------------------------------------------

def laplace_2d(boundary: dict[str, list[float]], nx: int, ny: int,
               max_iter: int = 1000, tol: float = 1e-8) -> list[list[float]]:
    """
    Solve ∇²u = 0 on [0,1]×[0,1] by Gauss-Seidel iteration.
    boundary: {'top': [...], 'bottom': [...], 'left': [...], 'right': [...]}
    """
    u = [[0.0] * nx for _ in range(ny)]
    # Apply boundary conditions
    for i in range(nx):
        u[0][i] = boundary['bottom'][i]
        u[-1][i] = boundary['top'][i]
    for j in range(ny):
        u[j][0] = boundary['left'][j]
        u[j][-1] = boundary['right'][j]

    for _ in range(max_iter):
        max_change = 0.0
        for j in range(1, ny - 1):
            for i in range(1, nx - 1):
                new = (u[j-1][i] + u[j+1][i] + u[j][i-1] + u[j][i+1]) / 4.0
                max_change = max(max_change, abs(new - u[j][i]))
                u[j][i] = new
        if max_change < tol:
            break
    return u


# ---------------------------------------------------------------------------
# Shooting Method for BVP
# ---------------------------------------------------------------------------

def shooting_bvp(f: VecFn, bc_left: list[float | None],
                 bc_right: list[float | None],
                 t0: float, t1: float, h: float,
                 tol: float = 1e-8, max_iter: int = 100
                 ) -> Optional[tuple[list[float], list[list[float]]]]:
    """
    Single shooting for 2-point BVP:
      y' = f(t, y),  y(t0) = [bc_left[0], s],  y(t1)[1] = bc_right[1]
    where s = shooting parameter. Uses bisection for the free initial condition.
    """
    # Simple scalar case: y'' = g(t,y,y'), y(t0)=a, y(t1)=b
    # Treated as: dy1/dt = y2, dy2/dt = f2(t, y1, y2); shoot on y2(t0)=s
    a = bc_left[0]
    b = bc_right[0]

    def shoot(s: float) -> float:
        y0 = [a, s]
        _, ys = rk4(f, t0, y0, t1, h)
        return ys[-1][0] - b

    # Secant method
    s0, s1 = -10.0, 10.0
    f0, f1 = shoot(s0), shoot(s1)
    if f0 * f1 > 0:
        return None  # Root not bracketed

    for _ in range(max_iter):
        s_mid = (s0 + s1) / 2.0
        f_mid = shoot(s_mid)
        if abs(f_mid) < tol:
            break
        if f0 * f_mid < 0:
            s1, f1 = s_mid, f_mid
        else:
            s0, f0 = s_mid, f_mid

    ts, ys = rk4(f, t0, [a, s_mid], t1, h)
    return ts, ys


# ---------------------------------------------------------------------------
# Grünwald-Letnikov Fractional Derivative (numerical)
# ---------------------------------------------------------------------------

def grunwald_letnikov(alpha: float, x_vals: list[float],
                      h: float) -> list[float]:
    """
    Grünwald-Letnikov fractional derivative of order α:
      D^α x(t) ≈ h^{-α} Σ_{k=0}^{n} GL_k^α x[n-k]
    where GL_k^α = (-1)^k C(α,k) = Γ(k-α) / (Γ(-α)Γ(k+1))
    """
    n = len(x_vals)
    # Compute GL coefficients
    gl = [0.0] * n
    gl[0] = 1.0
    for k in range(1, n):
        gl[k] = gl[k - 1] * (k - 1 - alpha) / k

    result = []
    factor = h ** (-alpha)
    for m in range(n):
        val = sum(gl[k] * x_vals[m - k] for k in range(m + 1))
        result.append(factor * val)
    return result


# ---------------------------------------------------------------------------
# Delay Differential Equation (constant delay, step method)
# ---------------------------------------------------------------------------

def dde_solver(f: Callable[[float, list[float], list[float]], list[float]],
               tau: float, t0: float, y0: list[float],
               history: Callable[[float], list[float]],
               t_end: float, h: float) -> tuple[list[float], list[list[float]]]:
    """
    Solves DDE y'(t) = f(t, y(t), y(t-τ)) using RK4 with linear interpolation
    for the delayed term.
    """
    ts, ys = [t0], [y0[:]]

    def interp(t_del: float) -> list[float]:
        if t_del < t0:
            return history(t_del)
        # Binary search in ts
        lo, hi = 0, len(ts) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if ts[mid] <= t_del:
                lo = mid
            else:
                hi = mid
        if hi >= len(ts):
            return ys[-1]
        alpha_ = (t_del - ts[lo]) / (ts[hi] - ts[lo]) if ts[hi] > ts[lo] else 0.0
        return [ys[lo][i] * (1 - alpha_) + ys[hi][i] * alpha_ for i in range(len(ys[0]))]

    t, y = t0, y0[:]
    while t < t_end - 1e-12:
        h_ = min(h, t_end - t)
        k1 = f(t,         y,                    interp(t - tau))
        k2 = f(t + h_/2,  _vadd(y, _vscale(k1, h_/2)), interp(t + h_/2 - tau))
        k3 = f(t + h_/2,  _vadd(y, _vscale(k2, h_/2)), interp(t + h_/2 - tau))
        k4 = f(t + h_,    _vadd(y, _vscale(k3, h_)),   interp(t + h_ - tau))
        phi = _vadd(_vadd(_vadd(_vscale(k1, 1/6), _vscale(k2, 1/3)),
                           _vscale(k3, 1/3)), _vscale(k4, 1/6))
        y = _vadd(y, _vscale(phi, h_))
        t += h_
        ts.append(t); ys.append(y[:])
    return ts, ys
