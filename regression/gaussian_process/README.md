# Gaussian Process Regression — PhD Reference

## Overview

A Gaussian process (GP) is a collection of random variables, any finite subset of which
follow a multivariate Gaussian distribution.  GP regression is a nonparametric Bayesian
approach that places a prior over functions.

---

## 1. Kernel Functions

The covariance function $k: \mathcal{X}\times\mathcal{X}\to\mathbb{R}$ must be
**positive semi-definite** (Mercer's condition): $\sum_{i,j} c_ic_j k(x_i,x_j) \geq 0$.

| Kernel | Formula | Properties |
|---|---|---|
| Squared Exponential | $k(x,x') = \sigma^2\exp(-\frac{\|x-x'\|^2}{2\ell^2})$ | Infinitely differentiable |
| Matérn ν=3/2 | $k(r) = \sigma^2(1+\frac{\sqrt{3}r}{\ell})\exp(-\frac{\sqrt{3}r}{\ell})$ | 1× differentiable |
| Matérn ν=5/2 | $k(r) = \sigma^2(1+\frac{\sqrt{5}r}{\ell}+\frac{5r^2}{3\ell^2})\exp(-\frac{\sqrt{5}r}{\ell})$ | 2× differentiable |
| Rational Quadratic | $k(r) = \sigma^2(1+\frac{r^2}{2\alpha\ell^2})^{-\alpha}$ | Mixture of SE kernels |
| Periodic | $k(r) = \sigma^2\exp(-\frac{2\sin^2(\pi r/p)}{\ell^2})$ | Captures periodicity |
| Linear | $k(x,x') = \sigma^2 x^\top x'$ | Reduces to BLR |

**Spectral density (Bochner's theorem):** Any stationary kernel $k(r) = k(x-x')$
corresponds to a positive Fourier transform (spectral density $S(\omega)$):
$$k(r) = \int S(\omega)\exp(i\omega^\top r)\,d\omega$$

---

## 2. GP Posterior and Hyperparameter Optimisation

The posterior marginal log-likelihood (log evidence):
$$\log p(\mathbf{y}|\mathbf{X},\boldsymbol{\theta}) = -\frac{1}{2}\mathbf{y}^\top K_y^{-1}\mathbf{y}
  -\frac{1}{2}\log|K_y| - \frac{n}{2}\log 2\pi$$

**Gradient for training:** $\frac{\partial\log p}{\partial\theta_j} = \frac{1}{2}\text{tr}\left(\left(K_y^{-1}\mathbf{y}\mathbf{y}^\top K_y^{-1} - K_y^{-1}\right)\frac{\partial K_y}{\partial\theta_j}\right)$

Complexity: $O(n^3)$ for Cholesky; $O(n^2)$ for gradient computation.

---

## 3. Sparse GP Approximations

**Nyström approximation:** $K \approx K_{nm}K_{mm}^{-1}K_{mn}$ using $m\ll n$ inducing points.

**FITC (Fully Independent Training Conditional):**
$$K_{FITC} = Q_{nn} + \text{diag}(K_{nn} - Q_{nn})$$
where $Q_{nn} = K_{nm}K_{mm}^{-1}K_{mn}$.

**Variational sparse GP (Titsias 2009):**
Inducing variables $\mathbf{u} = f(\mathbf{Z})$; maximise ELBO:
$$\mathcal{L}_{VFE} = \log\mathcal{N}(\mathbf{y};\mathbf{0}, Q_{ff}+\sigma^2 I) - \frac{1}{2\sigma^2}\text{tr}(K_{ff}-Q_{ff})$$

---

## 4. Deep Kernels and Neural Network Connections

**Deep kernel learning:** $k_\theta(x,x') = k_0(\phi_\theta(x), \phi_\theta(x'))$
where $\phi_\theta$ is a DNN feature extractor.

**Neural Tangent Kernel (NTK):** Infinite-width NN converges to a GP with
specific kernel (Jacot et al. 2018).

**Bayesian deep learning connection:** VI in BNN approximates GP posterior
for certain architectures in the infinite-width limit.
