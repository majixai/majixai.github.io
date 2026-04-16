# Advanced Calculus — PhD-Level Reference

## Overview

This module covers multivariable calculus, exterior differential forms, vector
calculus on manifolds, complex analysis, fractional calculus, calculus of
variations, stochastic calculus, and asymptotic methods — forming a broad
analytic backbone for modern mathematics, physics, and quantitative modeling.

---

## 1. Multivariable Calculus

### 1.1 Differentiation

**Fréchet derivative:** $f: U \subset \mathbb{R}^m \to \mathbb{R}^n$ is Fréchet
differentiable at $\mathbf{x}_0$ if $\exists$ linear $Df(\mathbf{x}_0): \mathbb{R}^m\to\mathbb{R}^n$ s.t.
$$\lim_{\mathbf{h}\to\mathbf{0}} \frac{\|f(\mathbf{x}_0+\mathbf{h}) - f(\mathbf{x}_0) - Df(\mathbf{x}_0)\mathbf{h}\|}{\|\mathbf{h}\|} = 0$$

**Gâteaux derivative:**
$$D_G f(x;h)=\lim_{t\to 0}\frac{f(x+th)-f(x)}{t}$$
When $D_G f$ is linear/continuous in $h$ and locally uniform, it agrees with Fréchet differentiability.

**Chain rule:** $D(f \circ g)(\mathbf{x}) = Df(g(\mathbf{x})) \circ Dg(\mathbf{x})$

**Implicit function theorem:** If $F: \mathbb{R}^n\times\mathbb{R}^m \to \mathbb{R}^m$,
$F(\mathbf{x}_0, \mathbf{y}_0) = \mathbf{0}$, and $D_{\mathbf{y}}F$ is invertible, then locally
$\mathbf{y} = g(\mathbf{x})$ and $Dg = -(D_{\mathbf{y}}F)^{-1} D_{\mathbf{x}}F$.

**Inverse function theorem:** If $Df(\mathbf{x}_0)$ is invertible, then $f$ is
a local $C^1$-diffeomorphism near $\mathbf{x}_0$ with $(f^{-1})'(\mathbf{y}_0) = [Df(\mathbf{x}_0)]^{-1}$.

**Taylor's theorem (multivariate):**
$$f(\mathbf{x}+\mathbf{h}) = \sum_{|\alpha|\leq k}\frac{\partial^\alpha f(\mathbf{x})}{\alpha!}\mathbf{h}^\alpha + R_k$$

### 1.2 Integration and Measure Interaction

**Change of variables:**
$$\int_{\phi(U)} f(\mathbf{y})\,d\mathbf{y} = \int_U f(\phi(\mathbf{x}))|\det J_\phi(\mathbf{x})|\,d\mathbf{x}$$

**Coarea formula (Euclidean form):** for Lipschitz $u: \mathbb{R}^n\to\mathbb{R}^m$,
$$\int_{\mathbb{R}^n} g(x)J_m u(x)\,dx = \int_{\mathbb{R}^m}\left(\int_{u^{-1}(y)} g\,d\mathcal{H}^{n-m}\right)dy$$

**Fubini–Tonelli:** For $f \in L^1(\mathbb{R}^m\times\mathbb{R}^n)$:
$$\int\!\!\int f(x,y)\,dx\,dy = \int\!\left(\int f(x,y)\,dx\right)dy = \int\!\left(\int f(x,y)\,dy\right)dx$$

---

## 2. Vector Calculus and Integral Theorems

**Green's theorem ($\mathbb{R}^2$):**
$$\oint_{\partial D}\!\!(P\,dx + Q\,dy) = \iint_D\!\!\left(\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y}\right)\!dA$$

**Stokes' theorem ($\mathbb{R}^3$):**
$$\oint_{\partial S} \mathbf{F}\cdot d\mathbf{r} = \iint_S (\nabla\times\mathbf{F})\cdot d\mathbf{S}$$

**Gauss' divergence theorem:**
$$\oiint_{\partial V} \mathbf{F}\cdot d\mathbf{S} = \iiint_V (\nabla\cdot\mathbf{F})\,dV$$

**Generalised Stokes theorem:** For a differential $k$-form $\omega$ on an
oriented $(k+1)$-manifold $M$ with boundary $\partial M$:
$$\int_M d\omega = \int_{\partial M}\omega$$

---

## 3. Differential Forms and Exterior Calculus

A differential $k$-form on $\mathbb{R}^n$ is
$\omega = \sum_{|I|=k} f_I\, dx^{i_1}\wedge\cdots\wedge dx^{i_k}$.

**Exterior derivative:** $d(f_I\, dx^I) = \sum_j \frac{\partial f_I}{\partial x_j} dx^j \wedge dx^I$

Properties: $d^2 = 0$, Leibniz rule
$d(\omega\wedge\eta) = d\omega\wedge\eta + (-1)^k\omega\wedge d\eta$.

**Hodge star:** $\star: \Omega^k \to \Omega^{n-k}$ satisfies
$\alpha\wedge\star\beta = \langle\alpha,\beta\rangle\,\mathrm{vol}$.

**Codifferential/Laplacian:**
$$\delta = (-1)^{nk+n+1}\star d\star,\quad \Delta = d\delta + \delta d$$

**de Rham cohomology:**
$$H^k_{dR}(M) = \ker(d: \Omega^k\to\Omega^{k+1}) / \mathrm{im}(d: \Omega^{k-1}\to\Omega^k)$$

**Poincaré lemma:** On a contractible domain, every closed form is exact.

---

## 4. Complex Analysis

### 4.1 Holomorphic Functions

Cauchy–Riemann equations:
$\frac{\partial u}{\partial x} = \frac{\partial v}{\partial y}$,
$\frac{\partial u}{\partial y} = -\frac{\partial v}{\partial x}$.

**Cauchy's integral theorem:** If $f$ is holomorphic in simply connected $D$:
$$\oint_\gamma f(z)\,dz = 0$$

**Cauchy integral formula:**
$$f^{(n)}(z_0) = \frac{n!}{2\pi i}\oint_\gamma \frac{f(z)}{(z-z_0)^{n+1}}\,dz$$

### 4.2 Residue Theorem

$$\oint_\gamma f(z)\,dz = 2\pi i \sum_k \mathrm{Res}(f, z_k)$$

Residue at a simple pole: $\mathrm{Res}(f,z_0) = \lim_{z\to z_0}(z-z_0)f(z)$.

At a pole of order $m$:
$$\mathrm{Res}(f,z_0) = \frac{1}{(m-1)!}\lim_{z\to z_0}\frac{d^{m-1}}{dz^{m-1}}[(z-z_0)^m f(z)]$$

### 4.3 Conformal Mapping

A holomorphic $f$ with $f'(z)\neq 0$ is conformal.
Riemann mapping theorem: every simply connected proper subdomain of $\mathbb{C}$
is biholomorphic to the unit disk.

---

## 5. Calculus of Variations

### 5.1 Euler–Lagrange Equations

Extremise $\mathcal{J}[u] = \int_a^b L(x, u, u')\,dx$ subject to boundary conditions.
Necessary condition:
$$\frac{\partial L}{\partial u} - \frac{d}{dx}\frac{\partial L}{\partial u'} = 0$$

For $\mathcal{J}[u] = \int_\Omega L(x,u,\nabla u)\,dx$:
$$\frac{\partial L}{\partial u} - \sum_i \frac{\partial}{\partial x_i}\frac{\partial L}{\partial u_{x_i}} = 0$$

### 5.2 Noether's Theorem

If $\mathcal{J}$ is invariant under a one-parameter group of transformations,
there is a corresponding conservation law.

### 5.3 Second Variation and Jacobi Fields

The second variation $\delta^2\mathcal{J}$ determines local minimality.
Jacobi equation:
$$\frac{d}{dx}(P\eta') - Q\eta = 0$$
with $P = L_{u'u'}$, $Q = L_{uu} - \frac{d}{dx}L_{uu'}$.

---

## 6. Fractional Calculus

**Grünwald–Letnikov fractional derivative:**
$${}_{GL}D^\alpha f(t) = \lim_{h\to 0} h^{-\alpha}\sum_{k=0}^\infty (-1)^k \binom{\alpha}{k} f(t-kh)$$

**Caputo derivative:**
$${}^C D_t^\alpha f(t)=\frac{1}{\Gamma(1-\alpha)}\int_0^t \frac{f'(\tau)}{(t-\tau)^\alpha}\,d\tau,\quad 0<\alpha<1$$

**Riesz fractional Laplacian:**
$$(-\Delta)^{\alpha/2} f(x) = C_{n,\alpha}\, \mathrm{p.v.}\int_{\mathbb{R}^n}\frac{f(x)-f(y)}{|x-y|^{n+\alpha}}\,dy$$

Applications: anomalous diffusion, viscoelasticity, fractional quantum mechanics.

---

## 7. Geometric Calculus on Manifolds

**Levi-Civita connection:** unique torsion-free metric-compatible connection $\nabla$.

**Geodesic equation:**
$$\ddot{x}^k + \Gamma^k_{ij}\dot{x}^i\dot{x}^j = 0$$

**First/second variation of arc length and energy** provide curvature-sensitive
stability information for geodesics and minimizers.

**Bochner identity (scalar version):**
$$\frac{1}{2}\Delta |\nabla f|^2 = |\nabla^2 f|^2 + \langle \nabla f, \nabla \Delta f\rangle + \mathrm{Ric}(\nabla f,\nabla f)$$

---

## 8. Asymptotic and Singular Perturbation Methods

**Laplace method:** for $I(\lambda)=\int e^{-\lambda\phi(x)}a(x)dx$, dominant
contribution comes from minima of $\phi$ as $\lambda\to\infty$.

**Method of stationary phase:** oscillatory integrals
$$\int e^{i\lambda\phi(x)}a(x)dx$$
localize near critical points of phase $\phi$.

**Matched asymptotic expansions:** combine inner/outer expansions to resolve
boundary-layer scales in singular perturbation problems.

---

## 9. Stochastic Calculus

For semimartingale $X_t$ and smooth $f$:

**Itô formula:**
$$df(X_t,t)=\partial_t f\,dt + \nabla f\cdot dX_t + \frac12\mathrm{Tr}(\sigma\sigma^\top \nabla^2 f)\,dt$$
when $dX_t=b\,dt+\sigma\,dW_t$.

**Stratonovich conversion:**
$$\sigma\circ dW_t = \sigma\,dW_t + \frac12(\nabla\sigma\,\sigma)dt$$

Connections: diffusion generators, Fokker–Planck equations, variational control,
and stochastic differential geometry.

---

## 10. Nonsmooth and Convex Calculus

**Subdifferential (convex):**
$$\partial f(x)=\{g: f(y)\ge f(x)+\langle g,y-x\rangle,\ \forall y\}$$

**Clarke generalized gradient:** extends derivative notions to locally Lipschitz
maps and underpins nonsmooth optimization and control.

**Envelope theorem / Danskin-type results** characterize directional derivatives
of value functions with max/sup structure.

---

## 11. PDE-Linked Calculus Themes

- Sobolev spaces $W^{k,p}(\Omega)$ and weak derivatives
- Integration by parts in weak form and variational formulations
- Energy methods and coercivity (Lax–Milgram setting)
- Elliptic regularity heuristics and bootstrap arguments
- Conservation vs dissipation from structural identities

---

## Subdirectories

| Directory | Content |
|---|---|
| `multivariable/` | Fréchet/Gâteaux derivatives, implicit/inverse function theorems, integration/coarea |
| `vector/` | Grad, div, curl, Green/Stokes/Gauss, curvilinear coordinates |
| `differential_forms/` | Exterior algebra, de Rham cohomology, Hodge theory |
| `exterior_calculus/` | Cartan calculus, Lie derivative, connection forms, curvature |
| `complex/` | Complex analysis, residues, conformal maps, Riemann surfaces |
| `fractional/` | Riemann–Liouville, Caputo, Riesz operators, Mittag-Leffler functions |
| `calculus_of_variations/` | Euler–Lagrange, Noether, Hamiltonian formalism, optimal control |
| `geometric/` | Levi-Civita connection, geodesics, curvature identities, Bochner methods |
| `asymptotic/` | Laplace/stationary phase, WKB, boundary layers, matched asymptotics |
| `stochastic/` | Itô/Stratonovich calculus, SDEs, generators, Fokker–Planck links |
| `nonsmooth/` | Subgradients, Clarke calculus, variational analysis, convex dual tools |
