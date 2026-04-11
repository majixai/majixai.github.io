# Topology — PhD-Level Reference

## Overview

Topology studies properties of spaces preserved under continuous deformations.
This module spans point-set topology through algebraic and differential topology,
knot theory, and computational persistent homology.

---

## 1. Point-Set Topology

A **topological space** $(X, \tau)$ is a set with a collection $\tau$ of "open"
subsets satisfying: $\emptyset, X \in \tau$; arbitrary unions and finite intersections
of open sets are open.

**Compactness:** $(X,\tau)$ is compact if every open cover has a finite subcover.
*Heine–Borel:* $K \subset \mathbb{R}^n$ is compact iff closed and bounded.

**Connectedness:** $X$ is connected iff not the union of two disjoint non-empty open sets.
Path-connectedness implies connectedness; the converse fails for the topologist's sine curve.

**Separation axioms:** $T_1$: points are closed. $T_2$ (Hausdorff): distinct points
have disjoint neighbourhoods. $T_3$ (regular): point and closed set can be separated.
$T_4$ (normal): disjoint closed sets have disjoint open neighbourhoods.

**Urysohn's lemma:** In a normal space, disjoint closed sets $A, B$ can be
separated by a continuous function $f: X \to [0,1]$ with $f|_A = 0$, $f|_B = 1$.

---

## 2. Homotopy Theory

### 2.1 Fundamental Group

$\pi_1(X, x_0) = $ homotopy classes of loops based at $x_0$ (under concatenation).

**van Kampen's theorem:** For $X = A \cup B$ with $A, B, A\cap B$ path-connected:
$$\pi_1(X) \cong \pi_1(A) *_{\pi_1(A\cap B)} \pi_1(B)$$

Examples: $\pi_1(S^1) \cong \mathbb{Z}$, $\pi_1(S^n) = 0$ ($n\geq 2$), $\pi_1(\text{torus}) \cong \mathbb{Z}^2$.

### 2.2 Higher Homotopy Groups

$\pi_n(X, x_0) = $ homotopy classes of maps $(S^n, *) \to (X, x_0)$.

$\pi_n$ is abelian for $n \geq 2$.  The homotopy groups of spheres are largely unknown;
e.g., $\pi_3(S^2) \cong \mathbb{Z}$ (Hopf fibration).

### 2.3 Fibrations and the Long Exact Sequence

For a fibration $F \hookrightarrow E \twoheadrightarrow B$:
$$\cdots \to \pi_n(F) \to \pi_n(E) \to \pi_n(B) \to \pi_{n-1}(F) \to \cdots$$

---

## 3. Homology Theory

### 3.1 Simplicial Homology

A **simplicial complex** $K$ has chain groups $C_n(K;\mathbb{Z})$ with boundary maps
$\partial_n: C_n \to C_{n-1}$ satisfying $\partial_{n-1}\circ\partial_n = 0$.

$$H_n(K) = \ker\partial_n / \text{im}\,\partial_{n+1}$$

**Euler characteristic:** $\chi(K) = \sum_n (-1)^n \text{rank}\,H_n(K) = \sum_n (-1)^n |\text{$n$-simplices}|$

### 3.2 Singular and de Rham Cohomology

**de Rham theorem:** $H^k_{dR}(M) \cong H^k(M;\mathbb{R})$ (singular cohomology with real coefficients).

**Universal coefficient theorem:** $H^n(X;\mathbb{Z}) \cong \operatorname{Hom}(H_n(X),\mathbb{Z}) \oplus \operatorname{Ext}^1(H_{n-1}(X),\mathbb{Z})$

**Poincaré duality:** For a closed oriented $n$-manifold: $H^k(M) \cong H_{n-k}(M)$.

---

## 4. Differential Topology

**Smooth manifold:** $M$ is a smooth $n$-manifold if locally diffeomorphic to $\mathbb{R}^n$
via a compatible atlas.

**Transversality:** $f: M \to N$ is transverse to $Z \subset N$ if $df(T_xM) + T_{f(x)}Z = T_{f(x)}N$.
Then $f^{-1}(Z)$ is a manifold of dimension $\dim M - \dim N + \dim Z$.

**Whitney embedding theorem:** Every smooth $n$-manifold embeds smoothly in $\mathbb{R}^{2n}$.

**Morse theory:** For a smooth $f: M \to \mathbb{R}$ with non-degenerate critical points,
$M$ has the homotopy type of a CW complex with one $k$-cell per index-$k$ critical point.

**Morse inequalities:** $b_k \leq c_k$ where $b_k = \text{rank}\,H_k(M)$ and $c_k$ = number of index-$k$ critical points.

---

## 5. Knot Theory

A **knot** $K \subset S^3$ is a smooth embedding of $S^1$.  Two knots are equivalent
if related by ambient isotopy.

**Alexander polynomial:** $\Delta_K(t)$ is a knot invariant defined via the Seifert matrix $V$:
$$\Delta_K(t) = \det(t^{1/2}V - t^{-1/2}V^\top)$$

**Jones polynomial:** $V_K(t)$ is a Laurent polynomial invariant defined via the
Kauffman bracket and skein relation:
$$V_+(t) - V_-(t) = (t^{1/2} - t^{-1/2})V_0(t)$$

**HOMFLY polynomial:** Two-variable generalisation:
$$\ell\cdot P_+ + m\cdot P_0 + \ell^{-1} P_- = 0$$

---

## 6. Persistent Homology

For a filtered simplicial complex $\emptyset = K_0 \subset K_1 \subset \cdots \subset K_n = K$,
persistent homology tracks birth and death of homological features.

**Persistence diagram:** The multiset $\{(b_i, d_i)\}$ where $b_i$ = birth, $d_i$ = death
of the $i$-th topological feature.  Features with large $|d_i - b_i|$ are significant.

**Stability theorem (Cohen-Steiner et al.):** The bottleneck distance between
persistence diagrams is stable under small perturbations of the filtration function:
$$d_B(\text{Dgm}(f), \text{Dgm}(g)) \leq \|f - g\|_\infty$$

**Rips and Čech complexes:** Used for topological data analysis (TDA) to extract
topology from point cloud data.

---

## Subdirectories

| Directory | Content |
|---|---|
| `algebraic/` | Homology, cohomology, homotopy groups, spectral sequences |
| `differential/` | Smooth manifolds, Morse theory, characteristic classes |
| `knot_theory/` | Knot invariants, braid groups, categorification |
| `persistent_homology/` | TDA, Rips/Čech complexes, barcodes, Wasserstein distance |
| `geometric/` | CAT(0) spaces, hyperbolic geometry, geometric group theory |
