# Partial Differential Equations — PhD Reference

## Classification of Second-Order Linear PDEs

$$Au_{xx} + Bu_{xy} + Cu_{yy} + Du_x + Eu_y + Fu = G$$

**Discriminant:** $\Delta = B^2 - 4AC$
- $\Delta < 0$: **Elliptic** (Laplace, Poisson)
- $\Delta = 0$: **Parabolic** (Heat equation)
- $\Delta > 0$: **Hyperbolic** (Wave equation)

---

## 1. Elliptic PDEs

**Laplace equation:** $\nabla^2 u = 0$

**Mean value property:** $u(x_0) = \frac{1}{|B_r|}\int_{B_r} u\,dx$ for harmonic $u$.

**Green's function for half-space ($\mathbb{R}^n_+$):**
$$G(x,y) = \Phi(x-y) - \Phi(x-y^*)$$
where $\Phi$ is the fundamental solution, $y^*$ is the reflection of $y$.

**Maximum principle:** A harmonic function on a bounded domain attains its max/min on the boundary.

**Poisson equation:** $-\nabla^2 u = f$.
Fundamental solution $\Phi$: $-\nabla^2\Phi = \delta(x)$.

For $n=3$: $\Phi(x) = \frac{1}{4\pi|x|}$, $\Phi(x) = \frac{1}{2\pi}\log|x|$ for $n=2$.

---

## 2. Parabolic PDEs

**Heat equation:** $u_t = \alpha\nabla^2 u$

**Heat kernel:** $K(x,t) = (4\pi\alpha t)^{-n/2}\exp(-|x|^2/(4\alpha t))$

Solution: $u(x,t) = (K(\cdot,t)*u_0)(x)$

**Maximum principle:** $\max_{Q_T} u = \max_{\partial_p Q_T} u$ (parabolic boundary).

**Energy estimate:**
$$\frac{d}{dt}\|u\|_2^2 = -2\alpha\|\nabla u\|_2^2 \leq 0$$

---

## 3. Hyperbolic PDEs

**Wave equation:** $u_{tt} = c^2\nabla^2 u$

**D'Alembert solution (1D):**
$$u(x,t) = \frac{f(x+ct)+f(x-ct)}{2} + \frac{1}{2c}\int_{x-ct}^{x+ct}g(s)\,ds$$

**Finite speed of propagation:** Domain of dependence principle.

**Kirchhoff's formula (3D):**
$$u(x,t) = \frac{\partial}{\partial t}\left(\frac{1}{4\pi c^2 t}\int_{|y|=ct}g(x+y)\,dS\right) + \frac{1}{4\pi c^2 t}\int_{|y|=ct}f(x+y)\,dS$$

---

## 4. Sobolev Spaces

**$W^{k,p}(\Omega)$:** Functions with distributional derivatives up to order $k$ in $L^p(\Omega)$.

$H^k = W^{k,2}$: Hilbert space with inner product $\langle u,v\rangle_{H^k} = \sum_{|\alpha|\leq k}\int_\Omega D^\alpha u\,D^\alpha v\,dx$.

**Sobolev embedding:** $W^{k,p}(\Omega) \hookrightarrow C^{0,\alpha}(\Omega)$ when $kp > n$ (and $\alpha = k - n/p$).

**Trace theorem:** $\gamma: H^1(\Omega) \to H^{1/2}(\partial\Omega)$ is bounded and surjective.

---

## 5. Spectral Methods

**Galerkin method:** Find $u_h \in V_h$ s.t. $a(u_h, v_h) = (f, v_h)$ for all $v_h \in V_h$.

For Poisson: $a(u,v) = \int_\Omega \nabla u\cdot\nabla v\,dx$.

**Chebyshev expansion:** $u(x) \approx \sum_{k=0}^N c_k T_k(x)$ where $T_k(\cos\theta) = \cos(k\theta)$.

Exponential convergence for analytic $u$.
