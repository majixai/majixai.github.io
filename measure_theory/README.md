# Measure Theory — PhD-Level Reference

## Overview

Measure theory provides the rigorous foundation for integration, probability theory,
ergodic theory, and harmonic analysis.  This module covers abstract measure spaces,
Lebesgue integration, $L^p$ spaces, and geometric measure theory.

---

## 1. Measure Spaces

A **measure space** $(\Omega, \mathcal{F}, \mu)$ consists of:
- A set $\Omega$ (sample space)
- A $\sigma$-algebra $\mathcal{F}$ (measurable sets): closed under countable unions and complements
- A measure $\mu: \mathcal{F} \to [0,\infty]$: $\sigma$-additive on disjoint sets

**Carathéodory extension theorem:** An outer measure $\mu^*$ on $2^\Omega$ restricts
to a complete measure on the $\sigma$-algebra of $\mu^*$-measurable sets.

**Lebesgue measure:** The unique translation-invariant measure on $(\mathbb{R}^n, \mathcal{B}(\mathbb{R}^n))$
with $\lambda([0,1]^n) = 1$.

---

## 2. Lebesgue Integration

For a non-negative measurable $f$, define
$$\int f\,d\mu = \sup\left\{\int \phi\,d\mu : 0 \leq \phi \leq f, \phi \text{ simple}\right\}$$

**Monotone Convergence Theorem (MCT):** If $0 \leq f_n \nearrow f$ a.e., then
$\int f_n\,d\mu \nearrow \int f\,d\mu$.

**Dominated Convergence Theorem (DCT):** If $f_n \to f$ a.e. and $|f_n| \leq g \in L^1$,
then $\int f_n\,d\mu \to \int f\,d\mu$.

**Fatou's lemma:** $\int \liminf_n f_n\,d\mu \leq \liminf_n \int f_n\,d\mu$

---

## 3. $L^p$ Spaces

$$L^p(\Omega,\mu) = \left\{f : \int |f|^p\,d\mu < \infty\right\}/\sim, \quad \|f\|_p = \left(\int |f|^p\right)^{1/p}$$

**Hölder's inequality:** $\int |fg|\,d\mu \leq \|f\|_p\|g\|_q$ for $1/p + 1/q = 1$

**Minkowski's inequality:** $\|f+g\|_p \leq \|f\|_p + \|g\|_p$

**Riesz–Fischer theorem:** $L^p(\mu)$ is complete (a Banach space) for $1 \leq p \leq \infty$.
$L^2(\mu)$ is a Hilbert space with inner product $\langle f,g\rangle = \int f\bar{g}\,d\mu$.

**Riesz representation theorem ($L^p$ dual):** $(L^p)^* \cong L^q$ for $1 \leq p < \infty$,
$1/p + 1/q = 1$.

---

## 4. Absolute Continuity and Radon–Nikodým

**Absolute continuity:** $\nu \ll \mu$ iff $\mu(E) = 0 \Rightarrow \nu(E) = 0$.

**Radon–Nikodým theorem:** If $\nu \ll \mu$ and both $\sigma$-finite, then $\exists$ unique
$h \in L^1(\mu)$ (the Radon–Nikodým derivative $d\nu/d\mu$) s.t. $\nu(E) = \int_E h\,d\mu$.

**Lebesgue decomposition:** $\nu = \nu_{ac} + \nu_s$ where $\nu_{ac} \ll \mu$ and $\nu_s \perp \mu$.

---

## 5. Product Measures and Disintegration

**Fubini–Tonelli theorem:** For $\sigma$-finite $(X,\mu)$, $(Y,\nu)$ and $f \in L^1(\mu\otimes\nu)$:
$$\int f\,d(\mu\otimes\nu) = \int_X\!\!\int_Y f(x,y)\,d\nu(y)\,d\mu(x) = \int_Y\!\!\int_X f(x,y)\,d\mu(x)\,d\nu(y)$$

**Disintegration:** For a measurable map $T: (X,\mu) \to (Y,\nu)$,
$\mu$ disintegrates over $\nu$ as $\mu = \int_Y \mu_y\,d\nu(y)$ where $\mu_y$ is concentrated on $T^{-1}(y)$.

---

## 6. Ergodic Theory

A measure-preserving transformation $T: (\Omega,\mathcal{F},\mu) \to (\Omega,\mathcal{F},\mu)$
satisfies $\mu(T^{-1}(A)) = \mu(A)$.

**Birkhoff ergodic theorem:** For $f \in L^1(\mu)$ and $T$ measure-preserving:
$$\frac{1}{n}\sum_{k=0}^{n-1} f(T^k x) \xrightarrow{\text{a.e.}} f^*(x) \in L^1(\mu)$$
with $\int f^*\,d\mu = \int f\,d\mu$.  If $T$ is ergodic, $f^* = \int f\,d\mu$ a.e.

**Von Neumann ergodic theorem ($L^2$):** The time average converges in $L^2$ to the
projection onto the $T$-invariant subspace.

**Mixing:** $T$ is mixing if $\mu(T^{-n}A \cap B) \to \mu(A)\mu(B)$.

---

## 7. Geometric Measure Theory

**Hausdorff measure:** $\mathcal{H}^s(E) = \lim_{\delta\to 0}\inf\left\{\sum_i r_i^s : E \subset \bigcup_i B_{r_i}, r_i \leq \delta\right\}$

**Hausdorff dimension:** $\dim_H(E) = \inf\{s \geq 0 : \mathcal{H}^s(E) = 0\}$

**Rectifiable sets:** $E \subset \mathbb{R}^n$ is $k$-rectifiable if $\mathcal{H}^k$-a.e. of $E$
can be covered by countably many Lipschitz images of $\mathbb{R}^k$.

**Area formula:** For Lipschitz $f: \mathbb{R}^m \to \mathbb{R}^n$:
$$\int_{\mathbb{R}^m} g(x)J_m f(x)\,d\mathcal{H}^m(x) = \int_{\mathbb{R}^n}\sum_{x\in f^{-1}(y)} g(x)\,d\mathcal{H}^m(y)$$
where $J_m f = \sqrt{\det(Df^\top Df)}$ is the $m$-dimensional Jacobian.

---

## Subdirectories

| Directory | Content |
|---|---|
| `lebesgue/` | Lebesgue integral, MCT, DCT, Fatou, differentiation of integrals |
| `functional_spaces/` | $L^p$ spaces, Sobolev spaces, interpolation, Orlicz spaces |
| `ergodic/` | Birkhoff, von Neumann, mixing, entropy, spectral theory |
| `geometric_measure/` | Hausdorff dimension, rectifiable sets, varifolds, GMT applications |
