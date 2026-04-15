# Differential Equations — PhD-Level Reference

## Overview

Differential equations are the language of continuous dynamical systems, governing
phenomena from quantum mechanics to fluid dynamics.  This module covers ordinary,
partial, stochastic, fractional, and functional differential equations at research depth.

---

## 1. Ordinary Differential Equations (ODEs)

### 1.1 Existence and Uniqueness

**Picard–Lindelöf theorem:** If $f: U \to \mathbb{R}^n$ is Lipschitz continuous in
$\mathbf{x}$ on an open set $U \subset \mathbb{R}\times\mathbb{R}^n$, then the IVP
$\dot{\mathbf{x}} = f(t,\mathbf{x})$, $\mathbf{x}(t_0) = \mathbf{x}_0$ has a unique
local solution.  Global existence follows if $f$ satisfies a linear growth bound.

### 1.2 Linear Systems

$$\dot{\mathbf{x}} = \mathbf{A}(t)\mathbf{x} + \mathbf{b}(t)$$

The fundamental matrix solution satisfies $\dot{\boldsymbol{\Phi}} = \mathbf{A}\boldsymbol{\Phi}$,
$\boldsymbol{\Phi}(t_0) = \mathbf{I}$.  For constant $\mathbf{A}$:
$\boldsymbol{\Phi}(t) = e^{\mathbf{A}(t-t_0)}$.

**Floquet theory:** For $T$-periodic $\mathbf{A}(t)$, $\boldsymbol{\Phi}(t+T) = \boldsymbol{\Phi}(t)\boldsymbol{\Phi}(T)$.
The Floquet multipliers $\mu_i = \exp(\lambda_i T)$ determine stability.

### 1.3 Phase Plane and Stability

**Lyapunov stability:** The equilibrium $\mathbf{x}^*$ is **Lyapunov stable** if
$\forall\varepsilon>0, \exists\delta>0$ s.t. $\|\mathbf{x}_0 - \mathbf{x}^*\|<\delta \Rightarrow \|\mathbf{x}(t)-\mathbf{x}^*\|<\varepsilon$.

**Lyapunov's direct method:** If $V: U \to \mathbb{R}$ satisfies $V(\mathbf{x}^*)=0$,
$V(\mathbf{x})>0$ for $\mathbf{x}\neq\mathbf{x}^*$, and $\dot{V} \leq 0$, then $\mathbf{x}^*$ is stable.
Asymptotic stability requires $\dot{V} < 0$.

### 1.4 Numerical Methods for ODEs

**Runge-Kutta 4 (classical):**
$$k_1 = hf(t_n, y_n), \quad k_2 = hf\!\left(t_n+\tfrac{h}{2}, y_n+\tfrac{k_1}{2}\right)$$
$$k_3 = hf\!\left(t_n+\tfrac{h}{2}, y_n+\tfrac{k_2}{2}\right), \quad k_4 = hf(t_n+h, y_n+k_3)$$
$$y_{n+1} = y_n + \tfrac{1}{6}(k_1+2k_2+2k_3+k_4) + O(h^5)$$

**Dormand–Prince (RK45):** Embedded Runge-Kutta pair for adaptive step size
control via Richardson extrapolation error estimate.

**Implicit methods (stiff equations):** For $\dot{y} = Ay$ with $A$ having large
negative eigenvalues, implicit trapezoidal (Crank–Nicolson) and BDF methods are A-stable.

---

## 2. Partial Differential Equations (PDEs)

### 2.1 Classification

Second-order linear PDE $\sum_{i,j} a_{ij} u_{x_ix_j} + \cdots = 0$:
- **Elliptic:** $\det(a_{ij}) > 0$ (all eigenvalues same sign). E.g., Laplace $\Delta u = 0$.
- **Parabolic:** $\det(a_{ij}) = 0$. E.g., Heat $u_t = \Delta u$.
- **Hyperbolic:** $\det(a_{ij}) < 0$ (eigenvalues of mixed sign). E.g., Wave $u_{tt} = c^2\Delta u$.

### 2.2 Elliptic PDEs

**Laplace equation:** $\Delta u = 0$. Solutions are harmonic functions satisfying
the mean value property $u(\mathbf{x}) = \frac{1}{|B_r|}\int_{B_r(\mathbf{x})} u\, dy$.

**Fundamental solution:** $\Phi(\mathbf{x}) = -\frac{1}{2\pi}\log|\mathbf{x}|$ ($n=2$), $\frac{1}{(n-2)\omega_n |\mathbf{x}|^{n-2}}$ ($n\geq 3$).

**Sobolev spaces:** $H^k(\Omega) = W^{k,2}(\Omega) = \{u \in L^2 : D^\alpha u \in L^2, |\alpha|\leq k\}$.

**Lax–Milgram:** For a bounded, coercive bilinear form $B[u,v]$ on $H_0^1(\Omega)$,
there exists unique $u$ with $B[u,v] = \langle f,v\rangle$ for all $v$.

### 2.3 Parabolic PDEs

**Heat equation:** $u_t = \Delta u$. Heat kernel:
$$\Phi(x,t) = \frac{1}{(4\pi t)^{n/2}}\exp\!\left(-\frac{|x|^2}{4t}\right)$$

**Maximum principle:** If $u_t - \Delta u \leq 0$ in $\Omega_T = \Omega\times(0,T)$,
then $\max_{\bar{\Omega}_T} u = \max_{\partial_p\Omega_T} u$ (parabolic boundary).

### 2.4 Hyperbolic PDEs

**Wave equation:** $u_{tt} = c^2\Delta u$. d'Alembert formula ($n=1$):
$$u(x,t) = \frac{f(x+ct)+f(x-ct)}{2} + \frac{1}{2c}\int_{x-ct}^{x+ct} g(s)\,ds$$

**Method of characteristics:** For first-order $F(x,y,u,u_x,u_y) = 0$, the
characteristic ODEs $\dot{x} = F_p$, $\dot{y} = F_q$, $\dot{u} = pF_p + qF_q$,
$\dot{p} = -(F_x + pF_u)$, $\dot{q} = -(F_y + qF_u)$ project solutions onto
the $(x,y)$ plane.

---

## 3. Stochastic Differential Equations (SDEs)

### 3.1 Itô Stochastic Calculus

**Itô integral:** $\int_0^T H_t\,dW_t = L^2\text{-}\lim \sum H_{t_i}(W_{t_{i+1}}-W_{t_i})$
(non-anticipating/adapted integrands only).

**Itô isometry:** $\mathbb{E}\!\left[\left(\int_0^T H_t\,dW_t\right)^2\right] = \int_0^T \mathbb{E}[H_t^2]\,dt$

**Itô's lemma:** For $f \in C^2$:
$$df(X_t) = f'(X_t)\,dX_t + \frac{1}{2}f''(X_t)\,d\langle X\rangle_t$$

For $dX_t = \mu(X_t)\,dt + \sigma(X_t)\,dW_t$:
$$df = \left(\mu f' + \tfrac{1}{2}\sigma^2 f''\right)dt + \sigma f'\,dW_t$$

### 3.2 Fokker–Planck Equation

For the SDE $dX_t = \mu(X_t,t)\,dt + \sigma(X_t,t)\,dW_t$, the density $p(x,t)$
satisfies:
$$\frac{\partial p}{\partial t} = -\frac{\partial}{\partial x}[\mu p] + \frac{1}{2}\frac{\partial^2}{\partial x^2}[\sigma^2 p]$$

### 3.3 Geometric Brownian Motion

$$dS_t = \mu S_t\,dt + \sigma S_t\,dW_t \implies S_t = S_0\exp\!\left((\mu - \tfrac{\sigma^2}{2})t + \sigma W_t\right)$$

---

## 4. Fractional Differential Equations

**Riemann–Liouville fractional integral:**
$$\mathcal{I}^\alpha f(t) = \frac{1}{\Gamma(\alpha)}\int_0^t (t-s)^{\alpha-1} f(s)\,ds$$

**Caputo derivative:**
$${}^C_0D_t^\alpha f(t) = \frac{1}{\Gamma(n-\alpha)}\int_0^t \frac{f^{(n)}(s)}{(t-s)^{\alpha-n+1}}\,ds$$

where $n = \lceil\alpha\rceil$.  Particularly suited to initial value problems since
it requires only integer-order initial conditions.

**Fractional oscillator:** ${}^CD^\alpha x + \omega^2 x = 0$ has solutions involving
the Mittag-Leffler function $E_\alpha(-\omega^2 t^\alpha)$.

---

## 5. Delay Differential Equations

$$\dot{x}(t) = f(t, x(t), x(t-\tau))$$

Characteristic equation for linear DDE $\dot{x} = ax(t) + bx(t-\tau)$:
$$\lambda = a + b e^{-\lambda\tau}$$

Stability analysis requires locating roots of this transcendental equation
in the complex plane.  The Hayes–Stépán conditions characterise stability
boundaries in $(a,b)$-parameter space.

---

## Subdirectories

| Directory | Content |
|---|---|
| `ode/` | RK4, RK45, Euler, Adams-Bashforth, BDF, stiff solvers |
| `pde/` | Finite differences, spectral methods, FEM for elliptic/parabolic/hyperbolic |
| `stochastic/` | Euler-Maruyama, Milstein, Runge-Kutta for SDEs |
| `functional_de/` | Integro-differential, Volterra, Fredholm equations |
| `delay/` | DDEs with constant/variable delay, neutral DDEs |
| `fractional/` | Caputo, Riemann-Liouville, Grünwald-Letnikov schemes |
| `geometric/` | Variational integrators, symplectic methods, Lie group integrators |
