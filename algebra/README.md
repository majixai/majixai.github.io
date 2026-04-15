# Abstract Algebra — PhD-Level Reference

## Overview

Abstract algebra studies algebraic structures — groups, rings, fields, modules —
and their homomorphisms.  This module reaches research depth in Lie theory,
representation theory, homological algebra, and Galois theory.

---

## 1. Group Theory

**First isomorphism theorem:** $G/\ker\phi \cong \text{im}\,\phi$

**Jordan–Hölder theorem:** Any two composition series of a finite group have the
same length and the same (up to ordering) composition factors.

**Sylow theorems:** For $|G| = p^a m$, $\gcd(p,m)=1$:
- A Sylow $p$-subgroup of order $p^a$ exists
- All Sylow $p$-subgroups are conjugate
- The number $n_p$ of Sylow $p$-subgroups satisfies $n_p | m$ and $n_p \equiv 1 \pmod{p}$

---

## 2. Lie Groups and Lie Algebras

A **Lie group** $G$ is a smooth manifold with smooth group operations.

**Lie algebra:** $\mathfrak{g} = T_eG$ with Lie bracket $[X,Y] = XY - YX$.

**Exponential map:** $\exp: \mathfrak{g} \to G$; $\exp(tX)$ is the one-parameter subgroup.

**Baker–Campbell–Hausdorff formula:**
$$\log(\exp X \exp Y) = X + Y + \frac{1}{2}[X,Y] + \frac{1}{12}([X,[X,Y]] - [Y,[X,Y]]) + \cdots$$

**Adjoint representation:** $\text{Ad}_g: \mathfrak{g} \to \mathfrak{g}$, $\text{Ad}_g X = gXg^{-1}$;
$\text{ad}_X Y = [X,Y]$.

**Killing form:** $B(X,Y) = \text{tr}(\text{ad}_X \circ \text{ad}_Y)$.
Cartan's criterion: $\mathfrak{g}$ is semisimple iff $B$ is non-degenerate.

**Classification of simple Lie algebras:** $A_n = \mathfrak{sl}(n+1)$, $B_n = \mathfrak{so}(2n+1)$,
$C_n = \mathfrak{sp}(2n)$, $D_n = \mathfrak{so}(2n)$, and exceptional $G_2, F_4, E_6, E_7, E_8$.

---

## 3. Representation Theory

A **representation** of $G$ is a homomorphism $\rho: G \to GL(V)$.

**Maschke's theorem:** Every representation of a finite group over $\mathbb{C}$ (or $\mathbb{R}$) is
completely reducible (semisimple).

**Schur's lemma:** Any $G$-equivariant map between irreducible representations is
either zero or an isomorphism.

**Characters:** $\chi_V(g) = \text{tr}(\rho(g))$.  Characters form an orthonormal
basis for class functions: $\langle\chi_V, \chi_W\rangle = \delta_{VW}$.

**Character table:** Rows = irreducible characters; columns = conjugacy classes.
$\sum_i d_i^2 = |G|$ where $d_i = \chi_i(e) = \dim V_i$.

**Weyl character formula:** For a compact semisimple Lie group with dominant weight $\lambda$:
$$\chi_\lambda = \frac{\sum_{w\in W} \epsilon(w) e^{w(\lambda+\rho)}}{\sum_{w\in W}\epsilon(w)e^{w\rho}}$$

---

## 4. Commutative Algebra

**Noetherian rings:** Every ideal is finitely generated; ascending chain condition holds.
Hilbert basis theorem: $R$ Noetherian $\Rightarrow$ $R[x]$ Noetherian.

**Localisation:** $S^{-1}R = \{r/s : r\in R, s\in S\}/\sim$ for multiplicative $S$.
$R_\mathfrak{p} = (R\setminus\mathfrak{p})^{-1}R$ at prime $\mathfrak{p}$.

**Spectrum:** $\text{Spec}(R) = \{\mathfrak{p} \subset R : \mathfrak{p} \text{ prime}\}$
with Zariski topology; forms the basis of algebraic geometry.

**Dimension theory:** $\dim R = \sup\{n : \mathfrak{p}_0 \subsetneq \cdots \subsetneq \mathfrak{p}_n\}$.
For Noetherian local $(R,\mathfrak{m})$: $\dim R = \deg P_R(n)$ (Hilbert polynomial).

---

## 5. Homological Algebra

**Exact sequences:** $\cdots \to A \xrightarrow{f} B \xrightarrow{g} C \to \cdots$
with $\text{im}\,f = \ker g$.

**Tor and Ext:** Derived functors of $\otimes$ and $\text{Hom}$:
- $\text{Tor}_n^R(M,N)$: derived from projective resolution of $M$
- $\text{Ext}^n_R(M,N)$: derived from injective resolution of $N$

**Snake lemma:** A commutative diagram with exact rows yields a long exact sequence of kernels and cokernels.

**Derived categories:** $D(A)$ = homotopy category of bounded complexes over abelian $A$,
localised at quasi-isomorphisms.  Connects to D-modules, perverse sheaves, mirror symmetry.

---

## 6. Galois Theory

**Fundamental theorem:** For a Galois extension $L/K$ with group $\text{Gal}(L/K)$:
$$\{\text{intermediate fields}\} \xleftrightarrow{1:1} \{\text{subgroups of }\text{Gal}(L/K)\}$$
(order-reversing: larger field $\leftrightarrow$ smaller group)

**Galois group of $x^n - 1$:** $\text{Gal}(\mathbb{Q}(\zeta_n)/\mathbb{Q}) \cong (\mathbb{Z}/n\mathbb{Z})^*$

**Solvability by radicals:** $f$ is solvable by radicals iff $\text{Gal}(f)$ is a solvable group.
Abel–Ruffini: generic quintic is not solvable (Galois group $S_5$).

**Étale cohomology and $\ell$-adic representations:** The absolute Galois group
$\text{Gal}(\bar{\mathbb{Q}}/\mathbb{Q})$ acts on étale cohomology $H^i_{\text{ét}}(X_{\bar{\mathbb{Q}}}, \mathbb{Q}_\ell)$,
connecting number theory to geometry.

---

## Subdirectories

| Directory | Content |
|---|---|
| `lie_algebras/` | Structure theory, root systems, Dynkin diagrams, Cartan-Weyl |
| `representation_theory/` | Characters, Weyl character formula, Young tableaux, quantum groups |
| `commutative/` | Noetherian rings, primary decomposition, dimension, completions |
| `homological/` | Derived categories, spectral sequences, sheaf cohomology |
| `galois_theory/` | Field extensions, Galois correspondence, inverse Galois problem |
