# Functional Analysis — PhD-Level Reference

## Overview

Functional analysis extends linear algebra and calculus to infinite-dimensional
spaces, providing the rigorous framework for quantum mechanics, PDEs, signal
processing, and machine learning theory.

---

## 1. Banach Spaces

A **Banach space** is a complete normed vector space $(X, \|\cdot\|)$.

**Hahn–Banach theorem:** For a subspace $M \subset X$ and bounded linear functional
$f: M \to \mathbb{F}$, there exists an extension $F: X \to \mathbb{F}$ with $\|F\| = \|f\|$.

**Consequences:** The dual $X^*$ separates points; reflexivity $X^{**} \cong X$; separation theorems.

**Open mapping theorem:** A surjective bounded linear operator $T: X \to Y$ between
Banach spaces is an open map (images of open sets are open).

**Closed graph theorem:** $T: X \to Y$ is bounded iff its graph is closed in $X \times Y$.

**Uniform Boundedness Principle (Banach–Steinhaus):** If $\{T_\alpha\}$ is a family of
bounded linear operators with $\sup_\alpha \|T_\alpha x\| < \infty$ for each $x$,
then $\sup_\alpha \|T_\alpha\| < \infty$.

---

## 2. Hilbert Spaces

A **Hilbert space** is a complete inner product space $(H, \langle\cdot,\cdot\rangle)$.

**Riesz representation theorem:** Every bounded linear functional $f: H \to \mathbb{F}$
is of the form $f(x) = \langle x, y\rangle$ for a unique $y \in H$ (and $\|f\| = \|y\|$).

**Projection theorem:** For a closed convex $C \subset H$, every $x \in H$ has a
unique nearest point $\hat{x} = P_C x$ satisfying $\langle x - \hat{x}, c - \hat{x}\rangle \leq 0$ for all $c \in C$.

**Orthonormal bases:** $(H, \langle\cdot,\cdot\rangle)$ has an ONB $\{e_n\}$ s.t.
$x = \sum_n \langle x, e_n\rangle e_n$ (Parseval: $\|x\|^2 = \sum_n |\langle x,e_n\rangle|^2$).

---

## 3. Operator Theory

**Bounded operators:** $\mathcal{B}(X,Y) = \{T: X\to Y : \|T\| = \sup_{\|x\|=1}\|Tx\| < \infty\}$

**Compact operators:** $T: X \to Y$ is compact if it maps bounded sets to relatively compact sets.
Every compact operator is the limit of finite-rank operators (on a Hilbert space).

**Fredholm operators:** $T: X \to Y$ is Fredholm if $\ker T$ and $Y/\text{im}\,T$ are both finite-dimensional.
Fredholm index: $\text{ind}(T) = \dim\ker T - \dim\text{coker}\,T$.

**Atkinson's theorem:** $T$ is Fredholm iff it is invertible modulo compact operators.

---

## 4. Spectral Theory

The **spectrum** of $T \in \mathcal{B}(X)$:
$$\sigma(T) = \{\lambda \in \mathbb{C} : T - \lambda I \text{ is not invertible}\}$$

**Spectral radius:** $r(T) = \sup_{\lambda\in\sigma(T)}|\lambda| = \lim_{n\to\infty}\|T^n\|^{1/n}$

**Spectral theorem (compact self-adjoint):** If $T = T^*$ is compact on a Hilbert space,
then $T = \sum_n \lambda_n \langle\cdot, e_n\rangle e_n$ where $\lambda_n \to 0$ are eigenvalues
and $\{e_n\}$ are orthonormal eigenvectors.

**Spectral theorem (bounded self-adjoint):** There exists a unique spectral measure
$E: \mathcal{B}(\mathbb{R}) \to \mathcal{B}(H)$ s.t. $T = \int_\mathbb{R} \lambda\,dE(\lambda)$.

**Functional calculus:** For self-adjoint $T$ and bounded measurable $f$:
$f(T) = \int f(\lambda)\,dE(\lambda)$.

---

## 5. Semigroup Theory

A **$C_0$-semigroup** $\{S(t)\}_{t\geq 0}$ on a Banach space satisfies:
- $S(0) = I$
- $S(t+s) = S(t)S(s)$ (semigroup property)
- $\lim_{t\to 0^+} S(t)x = x$ for all $x$ (strong continuity)

**Generator:** $Ax = \lim_{t\to 0} (S(t)x - x)/t$ with domain $\mathcal{D}(A)$.

**Hille–Yosida theorem:** A closed densely-defined operator $A$ generates a $C_0$-semigroup
with $\|S(t)\| \leq Me^{\omega t}$ iff $(\lambda-A)^{-1}$ exists for $\lambda > \omega$ with
$\|(\lambda-A)^{-n}\| \leq M/(\lambda-\omega)^n$.

---

## 6. Distributions (Schwartz Theory)

**Test functions:** $\mathcal{D}(\Omega) = C_c^\infty(\Omega)$ with semi-norms $p_{\alpha,K}(\phi) = \sup_K |D^\alpha\phi|$

**Distributions:** $\mathcal{D}'(\Omega)$ = continuous linear functionals on $\mathcal{D}(\Omega)$

Derivative: $\langle T', \phi\rangle = -\langle T, \phi'\rangle$

**Tempered distributions:** $\mathcal{S}'(\mathbb{R}^n)$ = dual of Schwartz space $\mathcal{S}$;
the Fourier transform extends to a homeomorphism on $\mathcal{S}'$.

**Examples:** $\delta_x$ (Dirac delta), $\text{p.v.}(1/x)$, fundamental solutions of PDEs.

---

## 7. Reproducing Kernel Hilbert Spaces (RKHS)

A Hilbert space $\mathcal{H}$ of functions on $\mathcal{X}$ is an RKHS if evaluation
functionals $f \mapsto f(x)$ are bounded.  The **reproducing kernel** $K: \mathcal{X}\times\mathcal{X}\to\mathbb{R}$
satisfies $K(x,\cdot) \in \mathcal{H}$ and $f(x) = \langle f, K(x,\cdot)\rangle$.

**Mercer's theorem:** For a continuous positive definite kernel on a compact set,
$K(x,y) = \sum_i \lambda_i \phi_i(x)\phi_i(y)$ with uniform convergence.

**Representer theorem:** The minimiser of $\mathcal{J}[f] = \mathcal{L}(\{f(x_i)\}) + \lambda\|f\|_\mathcal{H}^2$
lies in $\text{span}\{K(x_i, \cdot)\}_{i=1}^n$.

---

## Subdirectories

| Directory | Content |
|---|---|
| `banach_spaces/` | Hahn-Banach, open mapping, closed graph, UBP, weak topologies |
| `hilbert_spaces/` | Riesz representation, projection, ONBs, orthogonal decomposition |
| `operator_theory/` | Compact, Fredholm, positive, unitary operators; C*-algebras |
| `spectral_theory/` | Spectral theorem, functional calculus, spectral measures |
| `distributions/` | Schwartz distributions, Sobolev embedding, fundamental solutions |
