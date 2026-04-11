# Manifolds and Differential Geometry — PhD-Level Reference

## Overview

Differential geometry studies smooth manifolds with geometric structures — metrics,
connections, curvature — and their applications in physics (general relativity, gauge
theories) and mathematics (topology, geometric analysis).

---

## 1. Smooth Manifolds

An $n$-dimensional smooth manifold $M$ is a second-countable Hausdorff space with
a maximal smooth atlas $\{(U_\alpha, \phi_\alpha)\}$ where transition maps
$\phi_\beta \circ \phi_\alpha^{-1}$ are $C^\infty$.

**Tangent space:** $T_pM = $ derivations $v: C^\infty(M)\to\mathbb{R}$ (Leibniz rule).
In coordinates: $T_pM = \text{span}\{\partial/\partial x^1, \ldots, \partial/\partial x^n\}$.

**Cotangent space:** $T_p^*M = (T_pM)^*$; basis $\{dx^1,\ldots,dx^n\}$.

**Vector fields:** $\Gamma(TM) = $ smooth sections; Lie bracket $[X,Y]f = X(Yf)-Y(Xf)$.

---

## 2. Riemannian Geometry

A **Riemannian metric** $g = g_{ij}\,dx^i\otimes dx^j$ is a smooth symmetric
positive-definite $(0,2)$-tensor.

### 2.1 Levi-Civita Connection

The unique torsion-free metric-compatible connection $\nabla$:
$$\Gamma^k_{ij} = \frac{1}{2}g^{kl}\left(\partial_i g_{jl} + \partial_j g_{il} - \partial_l g_{ij}\right) \quad \text{(Christoffel symbols)}$$

**Geodesics:** $\nabla_{\dot\gamma}\dot\gamma = 0$, i.e.,
$$\ddot\gamma^k + \Gamma^k_{ij}\dot\gamma^i\dot\gamma^j = 0$$

**Geodesics are locally length-minimising.**

### 2.2 Curvature

**Riemann curvature tensor:**
$$R(X,Y)Z = \nabla_X\nabla_YZ - \nabla_Y\nabla_XZ - \nabla_{[X,Y]}Z$$

In coordinates: $R^l{}_{kij} = \partial_i\Gamma^l_{jk} - \partial_j\Gamma^l_{ik} + \Gamma^l_{im}\Gamma^m_{jk} - \Gamma^l_{jm}\Gamma^m_{ik}$

**Ricci tensor:** $R_{ij} = R^k{}_{ikj}$

**Scalar curvature:** $R = g^{ij}R_{ij}$

**Sectional curvature:** $K(\sigma) = g(R(X,Y)Y,X)/(g(X,X)g(Y,Y)-g(X,Y)^2)$ for 2-plane $\sigma = \text{span}(X,Y)$.

### 2.3 Geometric Comparison Theorems

**Gauss-Bonnet theorem ($n=2$):**
$$\int_M K\,dA + \int_{\partial M}\kappa_g\,ds = 2\pi\chi(M)$$

**Bonnet-Myers theorem:** Ricci curvature $\geq (n-1)/R^2 > 0$ implies $\text{diam}(M) \leq \pi R$ and $\pi_1(M)$ is finite.

**Cheeger-Gromov convergence:** A sequence of Riemannian manifolds converges in the Gromov-Hausdorff sense if curvature, diameter, and injectivity radius conditions are satisfied.

---

## 3. Connections and Curvature (Gauge Theory)

A **connection** on a principal bundle $P(M,G)$ is a $\mathfrak{g}$-valued 1-form
$A = A_\mu^a T_a\,dx^\mu$ (gauge potential).

**Curvature 2-form:** $F = dA + A\wedge A$, i.e., $F_{\mu\nu} = \partial_\mu A_\nu - \partial_\nu A_\mu + [A_\mu, A_\nu]$

**Yang-Mills equations:** $D_\mu F^{\mu\nu} = 0$, where $D$ is the covariant derivative.
$D_\mu = \partial_\mu + [A_\mu, \cdot]$ in adjoint representation.

**Self-dual instantons:** $F = *F$ (anti-self-dual: $F = -*F$) are absolute minima of
the Yang-Mills action. Classified by instanton number $k = -\frac{1}{8\pi^2}\int \text{tr}(F\wedge F) \in \mathbb{Z}$.

---

## 4. Symplectic Geometry

A **symplectic manifold** $(M^{2n}, \omega)$ has a closed non-degenerate 2-form $\omega$.

**Darboux theorem:** Locally, $\omega = \sum_i dp_i \wedge dq_i$ (no local invariants!).

**Hamiltonian mechanics:** Vector field $X_H$ s.t. $\iota_{X_H}\omega = dH$.
Hamilton's equations: $\dot{q}^i = \partial H/\partial p_i$, $\dot{p}_i = -\partial H/\partial q^i$.

**Liouville's theorem:** $\omega^n/n!$ is a preserved volume form (incompressible flow).

**Symplectomorphisms:** $\phi^*\omega = \omega$.  The group $\text{Symp}(M,\omega)$ is infinite-dimensional.

**Gromov's non-squeezing:** A ball $B^{2n}(r)$ cannot be symplectically embedded into a
cylinder $Z^{2n}(R)$ if $r > R$.

---

## 5. Fiber Bundles and Characteristic Classes

**Principal $G$-bundle:** $P \xrightarrow{\pi} M$ with free transitive $G$-action on fibers.

**Associated vector bundle:** $E = P \times_\rho V$ for representation $\rho: G \to GL(V)$.

**Chern classes:** For complex vector bundle $E\to M$:
$c(E) = 1 + c_1(E) + c_2(E) + \cdots \in H^*(M;\mathbb{Z})$

Defined via curvature: $c_k(E) = \left[\frac{1}{(2\pi i)^k}\text{Pf}\,\Omega\right]$ (Chern-Weil theory).

**Pontryagin classes:** $p_k(E) = (-1)^k c_{2k}(E_\mathbb{C}) \in H^{4k}(M;\mathbb{Z})$

**Euler class:** $e(E) \in H^n(M;\mathbb{Z})$ for oriented rank-$n$ bundle; $\langle e(TM),[M]\rangle = \chi(M)$.

**Atiyah-Singer index theorem:**
$$\text{ind}(D) = \int_M \hat{A}(M)\,\text{ch}(E)$$
for Dirac operator $D$ — unifies Gauss-Bonnet, Hirzebruch signature, Riemann-Roch.

---

## 6. General Relativity

**Einstein field equations:**
$$G_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4}T_{\mu\nu}$$

where $G_{\mu\nu} = R_{\mu\nu} - \frac{1}{2}Rg_{\mu\nu}$ is the Einstein tensor.

**Schwarzschild metric:**
$$ds^2 = -\left(1-\frac{r_s}{r}\right)c^2dt^2 + \left(1-\frac{r_s}{r}\right)^{-1}dr^2 + r^2d\Omega^2$$
$r_s = 2GM/c^2$ (Schwarzschild radius). Event horizon at $r = r_s$.

**Penrose singularity theorem:** Existence of a trapped surface implies a singularity
(under dominant energy condition + geodesic completeness assumptions).

---

## Subdirectories

| Directory | Content |
|---|---|
| `riemannian/` | Metrics, geodesics, curvature, comparison geometry, Ricci flow |
| `symplectic/` | Symplectic manifolds, Hamiltonian systems, Floer homology |
| `fiber_bundles/` | Principal bundles, associated bundles, gauge theory |
| `connections/` | Ehresmann connections, parallel transport, holonomy groups |
| `characteristic_classes/` | Chern, Pontryagin, Euler classes, index theorems |
