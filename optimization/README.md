# Optimization — PhD-Level Reference

## Overview

Optimisation theory spans convex analysis, nonlinear programming, the calculus of
variations, optimal control theory, semidefinite programming, and combinatorial
optimisation — with applications from machine learning to aerospace.

---

## 1. Convex Optimisation

A set $C \subset \mathbb{R}^n$ is **convex** if $\lambda x + (1-\lambda)y \in C$ for all
$x,y\in C$, $\lambda\in[0,1]$.  $f$ is **convex** if
$f(\lambda x + (1-\lambda)y) \leq \lambda f(x) + (1-\lambda)f(y)$.

### 1.1 Optimality Conditions (KKT)

For $\min f_0(x)$ s.t. $f_i(x) \leq 0$, $h_j(x) = 0$, the KKT conditions are:
- Primal feasibility: $f_i(x^*) \leq 0$, $h_j(x^*) = 0$
- Dual feasibility: $\lambda_i^* \geq 0$
- Complementary slackness: $\lambda_i^* f_i(x^*) = 0$
- Stationarity: $\nabla f_0 + \sum_i\lambda_i^*\nabla f_i + \sum_j\nu_j^*\nabla h_j = 0$

For convex problems satisfying constraint qualification (e.g., Slater's condition),
KKT is necessary and sufficient.

### 1.2 Duality

**Lagrangian:** $L(x,\lambda,\nu) = f_0(x) + \sum_i\lambda_i f_i(x) + \sum_j\nu_j h_j(x)$

**Dual function:** $g(\lambda,\nu) = \inf_x L(x,\lambda,\nu)$ (concave in $\lambda,\nu$)

**Strong duality** (Slater): $p^* = d^*$ when strict interior feasibility holds.

### 1.3 Proximal Algorithms

**Proximal operator:** $\text{prox}_f(v) = \operatorname*{argmin}_x\left\{f(x) + \frac{1}{2}\|x-v\|^2\right\}$

**ADMM (alternating direction method of multipliers):**
$$x^{k+1} = \operatorname*{argmin}_x \mathcal{L}_\rho(x, z^k, y^k)$$
$$z^{k+1} = \operatorname*{argmin}_z \mathcal{L}_\rho(x^{k+1}, z, y^k)$$
$$y^{k+1} = y^k + \rho(Ax^{k+1} + Bz^{k+1} - c)$$

Convergence rate $O(1/k)$ for convex problems.

### 1.4 Mirror Descent and Bregman Divergences

$x^{k+1} = \operatorname*{argmin}_x \left\{\langle\nabla f(x^k), x\rangle + \frac{1}{\eta_k} D_\psi(x, x^k)\right\}$

where $D_\psi(x,y) = \psi(x) - \psi(y) - \langle\nabla\psi(y), x-y\rangle$ is the
Bregman divergence.  Choosing $\psi = \frac{1}{2}\|\cdot\|^2$ recovers gradient descent;
$\psi = \sum_i x_i\log x_i$ gives multiplicative weights.

---

## 2. Nonlinear Programming

### 2.1 Gradient Methods

**Gradient descent:** $x^{k+1} = x^k - \alpha_k\nabla f(x^k)$

**Convergence for $L$-smooth convex $f$:** $f(x^k) - f^* \leq \frac{L\|x^0-x^*\|^2}{2k}$

**Polyak–Łojasiewicz inequality:** $\frac{1}{2}\|\nabla f\|^2 \geq \mu(f-f^*)$ implies
linear convergence $f(x^k) - f^* \leq (1-\mu/L)^k(f(x^0)-f^*)$.

### 2.2 Newton and Quasi-Newton Methods

**Newton step:** $\Delta x_{nt} = -[\nabla^2 f(x)]^{-1}\nabla f(x)$

Quadratic convergence: $\|x^{k+1}-x^*\| = O(\|x^k-x^*\|^2)$

**BFGS:** Approximate the inverse Hessian update:
$$H^{k+1} = \left(I - \rho_k s_k y_k^\top\right)H^k\left(I - \rho_k y_k s_k^\top\right) + \rho_k s_k s_k^\top$$

where $s_k = x^{k+1}-x^k$, $y_k = \nabla f^{k+1}-\nabla f^k$, $\rho_k = 1/(y_k^\top s_k)$.

**L-BFGS:** Memory-efficient BFGS storing only the last $m$ curvature pairs.

---

## 3. Semidefinite Programming

$$\min_{X \in \mathbb{S}^n} \langle C, X\rangle \quad \text{s.t.} \quad \langle A_i, X\rangle = b_i, \; X \succeq 0$$

SDP generalises LP (replacing non-negativity with PSD cone constraint).

**Interior point methods:** Solve via primal-dual path-following with barrier
$-\log\det X$; polynomial complexity in $\log(1/\varepsilon)$.

**Sums of Squares (SOS):** A polynomial $p(x)$ is SOS iff $p(x) = \mathbf{m}(x)^\top Q\mathbf{m}(x)$
for some $Q \succeq 0$, enabling global polynomial optimisation via SDP.

---

## 4. Optimal Control

### 4.1 Pontryagin Maximum Principle

For $\dot{x} = f(x,u)$, $\min \int_0^T L(x,u)\,dt + g(x(T))$:

Introduce costate $\lambda(t)$ (adjoint variable) satisfying:
$$\dot{\lambda} = -\frac{\partial \mathcal{H}}{\partial x}, \quad \mathcal{H}(x,u,\lambda) = L(x,u) + \lambda^\top f(x,u)$$

Optimality: $u^*(t) = \operatorname*{argmin}_u \mathcal{H}(x^*(t), u, \lambda(t))$

Transversality: $\lambda(T) = \nabla g(x^*(T))$

### 4.2 Hamilton–Jacobi–Bellman Equation

Value function $V(x,t) = \min_u \int_t^T L + g$:
$$-\frac{\partial V}{\partial t} = \min_u\left\{L(x,u) + \nabla_x V \cdot f(x,u)\right\}$$

**LQR (Linear-Quadratic Regulator):** $\dot{x} = Ax+Bu$, $J = \int_0^\infty (x^\top Qx + u^\top Ru)\,dt$.
Optimal feedback: $u^* = -R^{-1}B^\top Px$ where $P$ solves the ARE:
$A^\top P + PA - PBR^{-1}B^\top P + Q = 0$

---

## 5. Calculus of Variations

**Euler–Lagrange equation:** $\frac{\partial L}{\partial y} - \frac{d}{dx}\frac{\partial L}{\partial y'} = 0$

**Brachistochrone problem:** Cycloid is the solution to the minimum-time path problem.

**Geodesic:** On Riemannian manifold $(M,g)$, $\frac{D}{dt}\dot{\gamma} = 0$ (autoparallel transport).

**Weierstrass sufficient conditions:** An extremal satisfies the strengthened Legendre
condition ($L_{y'y'} > 0$) and Weierstrass excess function $E \geq 0$.

---

## Subdirectories

| Directory | Content |
|---|---|
| `convex/` | Convex sets, functions, conjugates, KKT, LP, QP, interior point |
| `nonlinear/` | GD, Newton, BFGS, L-BFGS, trust-region, line search |
| `calculus_of_variations/` | Euler-Lagrange, Noether, geodesics, minimal surfaces |
| `optimal_control/` | Pontryagin, HJB, LQR, MPC, dynamic programming |
| `semidefinite/` | SDP, SOCP, SOS, moment relaxations, Lovász theta |
| `combinatorial/` | Integer programming, branch-and-bound, cuts, approximation |
