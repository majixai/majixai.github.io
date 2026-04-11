# Regression — PhD-Level Reference

## Overview

Regression analysis is the mathematical study of relationships between a response variable
**Y** and a set of predictors **X**, framed within statistical decision theory and
functional analysis.

---

## 1. Classical Linear Model

### 1.1 Ordinary Least Squares (OLS)

Given the linear model

$$\mathbf{y} = \mathbf{X}\boldsymbol{\beta} + \boldsymbol{\varepsilon}, \quad \boldsymbol{\varepsilon} \sim \mathcal{N}(\mathbf{0}, \sigma^2 \mathbf{I}_n)$$

the OLS estimator minimises the residual sum of squares:

$$\hat{\boldsymbol{\beta}}_{\text{OLS}} = \operatorname*{argmin}_{\boldsymbol{\beta}} \|\mathbf{y} - \mathbf{X}\boldsymbol{\beta}\|_2^2 = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$$

**Gauss–Markov Theorem:** Under the classical assumptions (strict exogeneity,
spherical disturbances, full rank **X**), the OLS estimator is the *Best Linear
Unbiased Estimator* (BLUE) in the sense that no other linear unbiased estimator
has smaller variance.

**Frisch–Waugh–Lovell Theorem:** The OLS estimator of a sub-vector $\boldsymbol{\beta}_2$
in the partitioned model $\mathbf{y} = \mathbf{X}_1\boldsymbol{\beta}_1 + \mathbf{X}_2\boldsymbol{\beta}_2 + \boldsymbol{\varepsilon}$
equals the OLS estimator from regressing $\mathbf{M}_1\mathbf{y}$ on $\mathbf{M}_1\mathbf{X}_2$,
where $\mathbf{M}_1 = \mathbf{I} - \mathbf{X}_1(\mathbf{X}_1^\top\mathbf{X}_1)^{-1}\mathbf{X}_1^\top$.

### 1.2 Generalised Least Squares (GLS)

When $\boldsymbol{\varepsilon} \sim \mathcal{N}(\mathbf{0}, \sigma^2\boldsymbol{\Omega})$
with $\boldsymbol{\Omega}$ positive definite and known:

$$\hat{\boldsymbol{\beta}}_{\text{GLS}} = (\mathbf{X}^\top\boldsymbol{\Omega}^{-1}\mathbf{X})^{-1}\mathbf{X}^\top\boldsymbol{\Omega}^{-1}\mathbf{y}$$

The transformation $\mathbf{P}^{-1}\mathbf{y}$, $\mathbf{P}^{-1}\mathbf{X}$ where
$\boldsymbol{\Omega}^{-1} = (\mathbf{P}^{-1})^\top\mathbf{P}^{-1}$ reduces GLS to OLS.

---

## 2. Regularised Regression

### 2.1 Ridge Regression ($\ell_2$ penalty)

$$\hat{\boldsymbol{\beta}}_{\text{ridge}} = (\mathbf{X}^\top\mathbf{X} + \lambda\mathbf{I})^{-1}\mathbf{X}^\top\mathbf{y}, \quad \lambda > 0$$

The ridge estimator shrinks singular values $d_j$ to $d_j/(d_j^2+\lambda)$ in the
SVD $\mathbf{X} = \mathbf{U}\mathbf{D}\mathbf{V}^\top$ and reduces variance at the
cost of bias. The optimal $\lambda$ minimises mean squared error and can be chosen
by generalised cross-validation (GCV):

$$\text{GCV}(\lambda) = \frac{n^{-1}\|\mathbf{y} - \hat{\mathbf{y}}_\lambda\|^2}{(1 - n^{-1}\operatorname{tr}(\mathbf{H}_\lambda))^2}$$

where $\mathbf{H}_\lambda = \mathbf{X}(\mathbf{X}^\top\mathbf{X}+\lambda\mathbf{I})^{-1}\mathbf{X}^\top$.

### 2.2 LASSO ($\ell_1$ penalty)

$$\hat{\boldsymbol{\beta}}_{\text{LASSO}} = \operatorname*{argmin}_{\boldsymbol{\beta}}\left\{\frac{1}{2n}\|\mathbf{y}-\mathbf{X}\boldsymbol{\beta}\|_2^2 + \lambda\|\boldsymbol{\beta}\|_1\right\}$$

The soft-thresholding operator $S_\lambda(\cdot)$ characterises coordinate-descent updates.
Under the *restricted eigenvalue condition* (REC) with constant $\kappa$,

$$\|\hat{\boldsymbol{\beta}}_{\text{LASSO}} - \boldsymbol{\beta}^*\|_2 \leq \frac{4\lambda\sqrt{s}}{\kappa}$$

with probability $\geq 1 - 2\exp(-n\lambda^2/2)$ when $\lambda \geq 2\sigma\sqrt{\log p / n}$
and $s = \|\boldsymbol{\beta}^*\|_0$.

### 2.3 Elastic Net

$$\hat{\boldsymbol{\beta}}_{\text{EN}} = \operatorname*{argmin}_{\boldsymbol{\beta}}\left\{\frac{1}{2n}\|\mathbf{y}-\mathbf{X}\boldsymbol{\beta}\|_2^2 + \lambda_1\|\boldsymbol{\beta}\|_1 + \frac{\lambda_2}{2}\|\boldsymbol{\beta}\|_2^2\right\}$$

The elastic net interpolates between ridge and LASSO, encouraging grouped selection
of correlated predictors.

---

## 3. Nonlinear Regression

The model $y_i = f(\mathbf{x}_i; \boldsymbol{\theta}) + \varepsilon_i$ requires iterative
minimisation of $S(\boldsymbol{\theta}) = \sum_i (y_i - f(\mathbf{x}_i;\boldsymbol{\theta}))^2$.

**Gauss–Newton algorithm:**
$$\boldsymbol{\theta}^{(t+1)} = \boldsymbol{\theta}^{(t)} + \left(\mathbf{J}^\top\mathbf{J}\right)^{-1}\mathbf{J}^\top\mathbf{r}$$

where $\mathbf{J}_{ij} = \partial f(\mathbf{x}_i;\boldsymbol{\theta})/\partial\theta_j$ and
$r_i = y_i - f(\mathbf{x}_i;\boldsymbol{\theta}^{(t)})$.

**Levenberg–Marquardt** adds a damping factor: $(\mathbf{J}^\top\mathbf{J} + \mu\mathbf{I})^{-1}$.

---

## 4. Generalised Linear Models (GLM)

The GLM specifies:
- **Random component:** $Y_i \sim$ exponential family with mean $\mu_i$
- **Systematic component:** $\eta_i = \mathbf{x}_i^\top\boldsymbol{\beta}$
- **Link function:** $g(\mu_i) = \eta_i$

Score equations: $\mathbf{X}^\top\mathbf{W}(\mathbf{y} - \boldsymbol{\mu}) = \mathbf{0}$

solved by **Iteratively Reweighted Least Squares (IRLS)**:
$$\hat{\boldsymbol{\beta}}^{(t+1)} = (\mathbf{X}^\top\mathbf{W}^{(t)}\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{W}^{(t)}\mathbf{z}^{(t)}$$

with working response $z_i^{(t)} = \eta_i^{(t)} + (y_i - \mu_i^{(t)})g'(\mu_i^{(t)})$.

---

## 5. Gaussian Process Regression

A Gaussian process $f \sim \mathcal{GP}(m, k)$ is specified by a mean function
$m(\mathbf{x})$ and positive-definite kernel $k(\mathbf{x},\mathbf{x}')$.

**Posterior predictive distribution** at test points $\mathbf{X}_*$:

$$f_* | \mathbf{X}, \mathbf{y}, \mathbf{X}_* \sim \mathcal{N}(\bar{f}_*, \operatorname{cov}(f_*))$$

$$\bar{f}_* = K(\mathbf{X}_*, \mathbf{X})[K(\mathbf{X},\mathbf{X}) + \sigma_n^2\mathbf{I}]^{-1}\mathbf{y}$$

$$\operatorname{cov}(f_*) = K(\mathbf{X}_*,\mathbf{X}_*) - K(\mathbf{X}_*,\mathbf{X})[K(\mathbf{X},\mathbf{X})+\sigma_n^2\mathbf{I}]^{-1}K(\mathbf{X},\mathbf{X}_*)$$

Kernel examples: Squared Exponential $k(\mathbf{x},\mathbf{x}') = \sigma^2\exp\!\left(-\tfrac{\|\mathbf{x}-\mathbf{x}'\|^2}{2\ell^2}\right)$,
Matérn-$5/2$, Rational Quadratic, Spectral Mixture.

---

## 6. Survival Analysis Regression

**Cox Proportional Hazards Model:**
$$\lambda(t|\mathbf{x}) = \lambda_0(t)\exp(\mathbf{x}^\top\boldsymbol{\beta})$$

Partial likelihood (Cox, 1972):
$$\mathcal{L}_\text{partial}(\boldsymbol{\beta}) = \prod_{i:\delta_i=1}\frac{\exp(\mathbf{x}_i^\top\boldsymbol{\beta})}{\sum_{j\in\mathcal{R}(t_i)}\exp(\mathbf{x}_j^\top\boldsymbol{\beta})}$$

---

## 7. Multivariate Regression

**Reduced Rank Regression (RRR):** Constrains $\mathbf{B}$ to have rank $r < \min(p,q)$:
$$\hat{\mathbf{B}}_{\text{RRR}} = \mathbf{A}_r\mathbf{G}_r^\top$$
where $\mathbf{A}_r, \mathbf{G}_r$ are the leading $r$ left/right singular vectors of
$\hat{\mathbf{B}}_{\text{OLS}}$ weighted by $\hat{\boldsymbol{\Sigma}}_{YY}^{1/2}$ and
$\hat{\boldsymbol{\Sigma}}_{XX}^{1/2}$.

---

## Subdirectories

| Directory | Content |
|---|---|
| `linear/` | OLS, GLS, FGLS, WLS, instrumental variables |
| `nonlinear/` | Gauss–Newton, Levenberg–Marquardt, separable NLS |
| `logistic/` | Binary/multinomial/ordinal logistic, probit, complementary log-log |
| `regularized/` | Ridge, LASSO, elastic net, SCAD, MCP, group LASSO |
| `bayesian/` | Bayesian linear model, spike-and-slab, horseshoe prior |
| `gaussian_process/` | GP regression, sparse GPs, deep kernel learning |
| `kernel/` | Nadaraya–Watson, local polynomial, reproducing kernel Hilbert spaces |
| `survival/` | Cox PH, AFT models, frailty models, competing risks |
| `multivariate/` | MANOVA, canonical correlation, reduced rank, SUR |
| `time_series/` | ARMA regression, state-space, dynamic linear models |
