# Numerical Methods — PhD-Level Reference

## Overview

Numerical analysis provides algorithms with rigorous error bounds for computing
approximations to solutions of equations, differential equations, and integrals.
This module covers numerical linear algebra, ODE/PDE solvers, finite elements,
spectral methods, and quadrature.

---

## 1. Numerical Linear Algebra

### 1.1 Condition Number and Floating Point

For $Ax = b$, the relative forward error satisfies:
$$\frac{\|\delta x\|}{\|x\|} \leq \kappa(A)\frac{\|\delta b\|}{\|b\|}$$

where $\kappa(A) = \|A\|\|A^{-1}\|$ is the **condition number**.

**Machine epsilon:** IEEE 754 double precision: $\epsilon_{\text{mach}} \approx 2.22\times 10^{-16}$.

### 1.2 Iterative Solvers

**Conjugate Gradient (CG):** For $A \succ 0$, minimises $\phi(x) = \frac{1}{2}x^\top Ax - b^\top x$:
$$p_k = r_k + \beta_k p_{k-1}, \quad \alpha_k = \frac{r_k^\top r_k}{p_k^\top Ap_k}$$

Convergence: $\frac{\|e_k\|_A}{\|e_0\|_A} \leq 2\left(\frac{\sqrt{\kappa}-1}{\sqrt{\kappa}+1}\right)^k$

**GMRES:** Minimises $\|b - Ax_k\|$ over the Krylov subspace $\mathcal{K}_k(A,b)$ using
Arnoldi iteration.  Converges in at most $n$ steps; with preconditioning $M^{-1}A$
achieves faster convergence.

**Preconditioners:** ILU(0), ILUTP, algebraic multigrid (AMG), incomplete Cholesky.

### 1.3 Eigenvalue Solvers

**Power method, QR algorithm, Lanczos:** Covered in `matrix/`.

**LOBPCG:** Locally optimal block preconditioned CG for large sparse symmetric eigenvalue problems.

---

## 2. Numerical ODEs

### 2.1 Runge-Kutta Methods

A Butcher tableau specifies an $s$-stage RK method:
$$k_i = f\!\left(t_n + c_i h,\, y_n + h\sum_{j=1}^{i-1} a_{ij}k_j\right)$$
$$y_{n+1} = y_n + h\sum_{i=1}^s b_i k_i$$

Order conditions: $\sum b_i = 1$ (1st order), $\sum b_i c_i = 1/2$ (2nd order), etc.

**Dormand-Prince (DOPRI5):** 5th-order method with embedded 4th-order for step control.

### 2.2 Stiff Problems and Implicit Methods

**A-stability:** A method is A-stable if applying it to $\dot{y} = \lambda y$ ($\text{Re}\,\lambda<0$)
gives bounded solutions for all $h > 0$.  Explicit RK methods are not A-stable.

**BDF methods:** $\sum_{k=0}^q \alpha_k y_{n+k} = h\beta_q f(t_{n+q}, y_{n+q})$
(implicit; orders 1–6 are A($\alpha$)-stable).

**Rosenbrock methods:** Semi-implicit; linearise $f$ at each step, solve one linear system.

---

## 3. Numerical PDEs

### 3.1 Finite Difference Methods

For $u_t = \Delta u$ on $[0,1]\times[0,T]$ with grid spacing $h$ and time step $\Delta t$:

**FTCS (explicit):** $u_j^{n+1} = u_j^n + \frac{\Delta t}{h^2}(u_{j+1}^n - 2u_j^n + u_{j-1}^n)$
Stable only if $r = \Delta t/h^2 \leq 1/2$ (CFL condition).

**Crank-Nicolson:** Unconditionally stable, second-order in both $h$ and $\Delta t$:
$$u_j^{n+1} - u_j^n = \frac{r}{2}(\delta_x^2 u_j^{n+1} + \delta_x^2 u_j^n)$$

**Von Neumann stability analysis:** Substitute $u_j^n = \hat{u}^n e^{ij\xi h}$; the method
is stable iff $|\hat{u}^{n+1}/\hat{u}^n| \leq 1$ for all $\xi$.

### 3.2 Finite Element Methods (FEM)

Weak form of $-\Delta u = f$: find $u \in H_0^1(\Omega)$ s.t.
$a(u,v) = (f,v)_{L^2}$ for all $v \in H_0^1(\Omega)$,

where $a(u,v) = \int_\Omega \nabla u \cdot \nabla v\, dx$.

Galerkin discretisation with basis $\{\phi_i\}$: $K\mathbf{u} = \mathbf{f}$,
$K_{ij} = a(\phi_j, \phi_i)$, $f_i = (f,\phi_i)$.

**Céa's lemma:** $\|u - u_h\|_{H^1} \leq \frac{C}{\alpha}\inf_{v_h\in V_h}\|u-v_h\|_{H^1}$

**$h$-refinement:** $O(h^p)$ error for $p$-th degree elements; $p$-refinement (hp-FEM)
achieves exponential convergence for smooth solutions.

---

## 4. Spectral Methods

Expand $u(x) = \sum_{k=0}^N \hat{u}_k \phi_k(x)$ using global basis functions.

**Chebyshev spectral method:** $\phi_k = T_k$ (Chebyshev polynomials); collocation at
Chebyshev–Gauss–Lobatto points achieves spectral (exponential) convergence for smooth $u$.

**Fourier spectral method:** For periodic problems, $u(x) = \sum_k c_k e^{ikx}$;
differentiation is exact in spectral space: $\partial_x u \leftrightarrow ik\,c_k$.

---

## 5. Numerical Integration (Quadrature)

### 5.1 Gaussian Quadrature

$\int_{-1}^1 f(x)\,dx \approx \sum_{k=1}^n w_k f(x_k)$

Gauss–Legendre with $n$ points is exact for polynomials of degree $\leq 2n-1$.
Nodes $x_k$ are roots of $P_n(x)$ (Legendre polynomials).

**Error:** $E_n = \frac{(n!)^4 \cdot 2^{2n+1}}{(2n)!(2n+1)![(2n)!]^2} f^{(2n)}(\xi)$

### 5.2 Adaptive Quadrature

Recursive subdivision + error estimation via Gauss-Kronrod G7-K15 pairs:
$\|I_{15} - I_7\|$ drives subdivision. Converges at spectral rate for smooth $f$.

### 5.3 Monte Carlo Integration

$\int_\Omega f\,d\mu \approx \frac{|\Omega|}{N}\sum_{k=1}^N f(x_k)$, $x_k \sim \text{Uniform}(\Omega)$.

Error $O(N^{-1/2})$, dimension-independent.  Quasi-Monte Carlo with low-discrepancy
sequences achieves $O((\log N)^d / N)$.

---

## Subdirectories

| Directory | Content |
|---|---|
| `linear_algebra/` | CG, GMRES, Krylov methods, preconditioning, sparse direct |
| `odes/` | RK4, RK45, BDF, Rosenbrock, event detection, DAEs |
| `pdes/` | Finite differences, method of lines, operator splitting |
| `finite_elements/` | FEM assembly, mesh refinement, hp-FEM, DG methods |
| `spectral_methods/` | Fourier, Chebyshev, pseudospectral, exponential integrators |
| `quadrature/` | Gaussian, Gauss-Kronrod, adaptive, Monte Carlo, quasi-MC |
