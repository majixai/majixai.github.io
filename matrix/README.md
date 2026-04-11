# Matrix Theory — PhD-Level Reference

## Overview

Advanced matrix theory unifies linear algebra, functional analysis, and
geometry.  This module covers spectral theory, matrix decompositions, random
matrix theory, perturbation theory, matrix functions, and connections to Lie
groups.

---

## 1. Matrix Decompositions

### 1.1 Singular Value Decomposition (SVD)

For $\mathbf{A} \in \mathbb{R}^{m\times n}$ (wlog $m \geq n$):
$$\mathbf{A} = \mathbf{U}\boldsymbol{\Sigma}\mathbf{V}^\top$$
where $\mathbf{U} \in O(m)$, $\mathbf{V} \in O(n)$, and
$\boldsymbol{\Sigma} = \operatorname{diag}(\sigma_1,\ldots,\sigma_n)$
with $\sigma_1 \geq \cdots \geq \sigma_n \geq 0$.

**Eckart–Young–Mirsky theorem:** The best rank-$r$ approximation in any
unitarily-invariant norm is
$$\mathbf{A}_r = \mathbf{U}_r\boldsymbol{\Sigma}_r\mathbf{V}_r^\top$$
where $\|\mathbf{A} - \mathbf{A}_r\|_F^2 = \sum_{i=r+1}^n \sigma_i^2$.

**Condition number:** $\kappa(\mathbf{A}) = \sigma_{\max}/\sigma_{\min}$.

### 1.2 QR Decomposition

$\mathbf{A} = \mathbf{Q}\mathbf{R}$ where $\mathbf{Q} \in O(m)$ and $\mathbf{R}$
upper triangular.  Computed via Householder reflections or Gram–Schmidt.

**Householder reflector:** $\mathbf{H} = \mathbf{I} - 2\mathbf{v}\mathbf{v}^\top/\|\mathbf{v}\|^2$,
$\mathbf{v} = \mathbf{x} + \text{sgn}(x_1)\|\mathbf{x}\|\mathbf{e}_1$.

### 1.3 Schur Decomposition

Every $\mathbf{A} \in \mathbb{C}^{n\times n}$ has a Schur decomposition
$\mathbf{A} = \mathbf{Q}\mathbf{T}\mathbf{Q}^*$ where $\mathbf{Q}$ is unitary
and $\mathbf{T}$ is upper triangular.  For real $\mathbf{A}$, the real Schur
form involves $2\times 2$ blocks for complex conjugate eigenvalue pairs.

### 1.4 Jordan Normal Form

$\mathbf{A} = \mathbf{P}\mathbf{J}\mathbf{P}^{-1}$ where
$$\mathbf{J} = \bigoplus_{i=1}^k J_{n_i}(\lambda_i), \quad
  J_m(\lambda) = \begin{pmatrix}\lambda & 1 \\ & \lambda & 1 \\ && \ddots \end{pmatrix}$$

Jordan blocks arise when the geometric multiplicity $< $ algebraic multiplicity.

### 1.5 Cholesky and LDL^T

For $\mathbf{A}$ symmetric positive definite:
$$\mathbf{A} = \mathbf{L}\mathbf{L}^\top \quad \text{(Cholesky)}$$
$$\mathbf{A} = \mathbf{L}\mathbf{D}\mathbf{L}^\top \quad \text{(LDL}^\top\text{, requires only }n\text{ square roots)}$$

---

## 2. Spectral Theory

### 2.1 Eigenvalue Algorithms

**Power iteration:** $\mathbf{x}^{(k+1)} = \mathbf{A}\mathbf{x}^{(k)}/\|\mathbf{A}\mathbf{x}^{(k)}\|$
converges at rate $|\lambda_2/\lambda_1|$.

**QR Algorithm (Francis double-shift):** Implicitly shifts the QR iteration
to accelerate convergence to Schur form.  Cubic cost $O(n^3)$ per iteration
but converges in $O(n)$ iterations on average.

**Lanczos Algorithm:** For symmetric $\mathbf{A}$, builds a tridiagonal matrix
$\mathbf{T}_k$ in $k$ steps with $\mathbf{A}\mathbf{V}_k = \mathbf{V}_k\mathbf{T}_k + r_k\mathbf{e}_k^\top$,
enabling computation of extreme eigenvalues in $O(nk)$ cost.

**Arnoldi Iteration:** Non-symmetric generalisation; connects to GMRES.

### 2.2 Spectral Theorem

For self-adjoint $\mathbf{A} \in \mathbb{R}^{n\times n}$:
$$\mathbf{A} = \sum_{i=1}^n \lambda_i \mathbf{u}_i\mathbf{u}_i^\top$$

The spectral theorem extends to compact self-adjoint operators on Hilbert spaces
(countable discrete spectrum) and bounded self-adjoint operators (continuous
spectral measure via the spectral resolution $\mathbf{A} = \int \lambda\, dE(\lambda)$).

---

## 3. Random Matrix Theory

### 3.1 Wigner Semicircle Law

For a symmetric random matrix $\mathbf{W}_n$ with i.i.d. entries (variance
$\sigma^2$, above diagonal), the empirical spectral distribution of
$\mathbf{W}_n / \sqrt{n}$ converges weakly almost surely to the semicircle law:
$$\rho_{\text{sc}}(x) = \frac{1}{2\pi\sigma^2}\sqrt{4\sigma^2 - x^2}\,\mathbf{1}_{|x|\leq 2\sigma}$$

### 3.2 Marchenko–Pastur Law

For $\mathbf{X} \in \mathbb{R}^{n\times p}$ with i.i.d. $\mathcal{N}(0,\sigma^2)$
entries, as $n,p \to \infty$ with $p/n \to \gamma \in (0,\infty)$, the empirical
spectral distribution of $\mathbf{S} = \mathbf{X}^\top\mathbf{X}/n$ converges to:
$$\rho_{\text{MP}}(x) = \frac{\sqrt{(\lambda_+ - x)(x - \lambda_-)}}
{2\pi\sigma^2\gamma x}\,\mathbf{1}_{[\lambda_-,\lambda_+]}(x)$$

where $\lambda_\pm = \sigma^2(1 \pm \sqrt{\gamma})^2$.

**Tracy–Widom distribution:** The fluctuations of the largest eigenvalue
$\lambda_{\max}(\mathbf{W}_n/\sqrt{n})$ around $2\sigma$ scale as $n^{-2/3}$
and follow the Tracy–Widom GUE/GOE distributions.

### 3.3 Free Probability

Voiculescu's free probability theory defines free independence as the
non-commutative analogue of classical independence.  For freely independent
self-adjoint operators $a, b$, the $R$-transform satisfies:
$$R_{a+b}(z) = R_a(z) + R_b(z)$$

The free convolution $\mu_a \boxplus \mu_b$ describes the spectrum of $a+b$.

---

## 4. Tensor Products and Kronecker Structure

The Kronecker product $\mathbf{A} \otimes \mathbf{B}$ satisfies:
$$(\mathbf{A} \otimes \mathbf{B})(\mathbf{C} \otimes \mathbf{D}) = (\mathbf{AC}) \otimes (\mathbf{BD})$$
$$(\mathbf{A} \otimes \mathbf{B})^\top = \mathbf{A}^\top \otimes \mathbf{B}^\top$$
$$\text{vec}(\mathbf{AXB}) = (\mathbf{B}^\top \otimes \mathbf{A})\text{vec}(\mathbf{X})$$

---

## 5. Matrix Functions

For analytic $f$ and diagonalisable $\mathbf{A} = \mathbf{P}\mathbf{\Lambda}\mathbf{P}^{-1}$:
$$f(\mathbf{A}) = \mathbf{P}\,\text{diag}(f(\lambda_1),\ldots,f(\lambda_n))\mathbf{P}^{-1}$$

**Matrix exponential:** $e^{\mathbf{A}t} = \sum_{k=0}^\infty \frac{(\mathbf{A}t)^k}{k!}$
solves $\dot{\mathbf{x}} = \mathbf{A}\mathbf{x}$.

**Matrix logarithm:** $\log\mathbf{A}$ exists and is real when all eigenvalues
are real positive.  Computed via Padé approximation or inverse scaling-and-squaring.

**Fréchet derivative:** $L_f(\mathbf{A}, \mathbf{E}) = \lim_{t\to 0}\frac{f(\mathbf{A}+t\mathbf{E})-f(\mathbf{A})}{t}$

---

## 6. Perturbation Theory

**Weyl's theorem:** For Hermitian $\mathbf{A}, \mathbf{E}$:
$$|\lambda_k(\mathbf{A}+\mathbf{E}) - \lambda_k(\mathbf{A})| \leq \|\mathbf{E}\|_2$$

**Davis–Kahan theorem:** The angle between eigenspaces satisfies:
$$\sin\Theta(\mathbf{V}, \hat{\mathbf{V}}) \leq \frac{\|\mathbf{E}\|_2}{\delta}$$
where $\delta$ is the spectral gap.

**Kato–Rellich theorem:** For a Hermitian holomorphic family $\mathbf{A}(t)$,
eigenvalues and eigenvectors are analytic in $t$ (simple spectrum).

---

## Subdirectories

| Directory | Content |
|---|---|
| `decompositions/` | SVD, QR, LU, Cholesky, LDL^T, Schur, Jordan |
| `spectral/` | Power iteration, QR algorithm, Lanczos, Arnoldi, LOBPCG |
| `random_matrices/` | Wigner, Marchenko–Pastur, Tracy–Widom, free probability |
| `tensor_products/` | Kronecker products, Tucker, CP, tensor train decompositions |
| `lie_groups/` | Matrix Lie groups, exponential map, adjoint representation |
| `perturbation/` | Weyl, Davis–Kahan, Bauer–Fike, Kato–Rellich, pseudospectra |
| `matrix_functions/` | Matrix exp, log, sqrt, sign function, Fréchet derivative |
