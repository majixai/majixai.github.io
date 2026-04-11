# Category Theory — PhD-Level Reference

## Overview

Category theory provides an abstract mathematical framework for studying structures
and their mappings.  It pervades modern mathematics — from homological algebra and
algebraic geometry to type theory and functional programming.

---

## 1. Categories, Functors, Natural Transformations

### 1.1 Categories

A **category** $\mathcal{C}$ consists of:
- Objects: $\text{Ob}(\mathcal{C})$
- Morphisms: $\text{Hom}_\mathcal{C}(A,B)$ for each pair $(A,B)$
- Composition: $f: A\to B$, $g: B\to C$ gives $g\circ f: A\to C$
- Identity: $\text{id}_A: A\to A$ for each $A$
- Axioms: associativity and unit laws

**Examples:**
- **Set:** sets and functions
- **Grp, Ring, Vect$_k$:** algebraic structures with homomorphisms
- **Top:** topological spaces and continuous maps
- **Pos:** posets and order-preserving maps
- **$\mathbf{Ω}$-Alg:** algebras for a monad

### 1.2 Functors

A **functor** $F: \mathcal{C} \to \mathcal{D}$ assigns objects to objects and morphisms
to morphisms, preserving composition and identities.

- **Covariant:** $F(g\circ f) = F(g)\circ F(f)$
- **Contravariant:** reverses arrows

**Examples:** Forgetful functors, free functors (left adjoints to forgetful functors),
$\text{Hom}(A,-)$ (covariant representable), $\text{Hom}(-,A)$ (contravariant).

### 1.3 Natural Transformations

A **natural transformation** $\eta: F \Rightarrow G$ between functors $F,G: \mathcal{C}\to\mathcal{D}$
assigns to each $A\in\mathcal{C}$ a morphism $\eta_A: F(A)\to G(A)$ s.t. for $f: A\to B$:
$$G(f)\circ\eta_A = \eta_B\circ F(f) \quad \text{(naturality square commutes)}$$

**Functor categories:** $[\mathcal{C},\mathcal{D}]$ or $\mathcal{D}^\mathcal{C}$ with functors as objects and natural transformations as morphisms.

---

## 2. Adjunctions

$F: \mathcal{C} \rightleftarrows \mathcal{D}: G$ is an **adjunction** ($F \dashv G$) if
$$\text{Hom}_\mathcal{D}(FC, D) \cong \text{Hom}_\mathcal{C}(C, GD) \quad \text{natural in $C,D$}$$

**Unit and counit:** $\eta: \text{Id}_\mathcal{C} \Rightarrow GF$ and $\varepsilon: FG \Rightarrow \text{Id}_\mathcal{D}$.

Triangle identities: $(\varepsilon F)\circ(F\eta) = \text{id}_F$ and $(G\varepsilon)\circ(\eta G) = \text{id}_G$.

**Examples:**
- Free-forgetful: $\text{Free} \dashv U$ (free group/module/etc.)
- Product $\dashv$ diagonal: $A\times- \dashv \text{Hom}(A,-)$ (currying/uncurrying)
- Suspension $\dashv$ loop space in homotopy theory

**RAPL:** Right adjoints preserve limits; left adjoints preserve colimits.

---

## 3. Limits and Colimits

A **limit** of a diagram $F: J\to\mathcal{C}$ is a terminal cone over $F$:
$\text{Lim}\,F = (L, \{p_j: L\to F(j)\}_j)$ universal.

| Diagram shape | Limit | Colimit |
|---|---|---|
| Empty | terminal object $1$ | initial object $0$ |
| Discrete (two objects) | product $A\times B$ | coproduct $A+B$ |
| Parallel pair $A \rightrightarrows B$ | equaliser | coequaliser |
| Cospan $A\to C\leftarrow B$ | pullback | pushout |

**Yoneda lemma:** For $F: \mathcal{C}\to\textbf{Set}$ and $A\in\mathcal{C}$:
$$\text{Nat}(\text{Hom}(A,-), F) \cong F(A)$$

Fully faithful embedding $\mathcal{C} \hookrightarrow [\mathcal{C}^{op},\textbf{Set}]$: $A \mapsto \text{Hom}(-,A)$.

---

## 4. Monads and Comonads

A **monad** $(T, \eta, \mu)$ on $\mathcal{C}$ consists of a functor $T: \mathcal{C}\to\mathcal{C}$
with natural transformations $\eta: \text{Id}\Rightarrow T$ (unit) and $\mu: T^2\Rightarrow T$ (multiplication)
satisfying associativity and unit laws.

**Kleisli category $\mathcal{C}_T$:** Objects = objects of $\mathcal{C}$; morphisms $A\to B$ = morphisms $A\to TB$ in $\mathcal{C}$.

**Eilenberg–Moore category:** Category of $T$-algebras $(A, a: TA\to A)$ satisfying coherence.

**Examples:** List monad (non-determinism), Maybe monad (partiality), State monad, Continuation monad (in FP).

---

## 5. Topos Theory

An **elementary topos** is a category with:
- All finite limits
- Exponentials $B^A$ (cartesian closed)
- A subobject classifier $\Omega$: $\text{Sub}(A) \cong \text{Hom}(A,\Omega)$

**Grothendieck topos:** Category of sheaves $\text{Sh}(C,J)$ on a site $(C,J)$.

**Internal logic:** Every topos has an internal higher-order intuitionistic logic
(Mitchell-Bénabou language).  The law of excluded middle may fail (non-Boolean toposes).

**Points and localic toposes:** A point of $\mathcal{E}$ is a geometric morphism $\text{Set}\to\mathcal{E}$.
Localic toposes ↔ locales ↔ pointless topology.

---

## 6. Higher Categories (∞-Categories)

An **$(\infty,1)$-category** (∞-category) has objects, morphisms, and $k$-morphisms for all $k$,
where $k$-morphisms are invertible for $k\geq 2$.

**Quasi-categories (Joyal):** Simplicial sets satisfying the inner horn filling condition
$\Lambda^n_k \hookrightarrow \Delta^n$ for $0 < k < n$.

**Complete Segal spaces (Rezk):** Fibrant objects in the Rezk model structure on bisimplicial sets.

**∞-Toposes (Lurie):** $\infty$-categories satisfying Giraud axioms; model $(\infty,1)$-sheaves.

**Higher Algebra:** $\mathbb{E}_n$-algebras, $\mathbb{A}_\infty$-algebras, spectra, stable
$\infty$-categories; framework for derived algebraic geometry.

**Cobordism hypothesis (Baez-Dolan, Lurie):** The $(\infty,n)$-category of fully dualised
$n$-dimensional topological field theories is generated by a single object (the point).

---

## 7. Applications

**Homological algebra via derived categories:** $D(\mathcal{A})$ is the ∞-categorical
localisation of chain complexes at quasi-isomorphisms; $R\text{Hom}$, $L\otimes$, six-functor formalism.

**Grothendieck's yoga of motives:** Universal cohomology theory for algebraic varieties;
motivic homotopy theory (Morel-Voevodsky).

**Type theory:** Homotopy type theory (HoTT) identifies types with spaces, terms with
points, identity proofs with paths; univalence axiom: equivalent types are equal.

---

## Subdirectories

| Directory | Content |
|---|---|
| `functors/` | Functor categories, Yoneda embedding, representability |
| `natural_transformations/` | Naturality, modifications, modifications |
| `adjunctions/` | Universal properties, free constructions, adjoint functor theorems |
| `topos/` | Grothendieck toposes, sheaves, internal logic, geometric morphisms |
| `higher_categories/` | ∞-categories, model categories, HoTT, cobordism hypothesis |
