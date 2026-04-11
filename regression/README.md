# Regression Analysis — PhD-Level Reference

## Overview

Regression analysis models the conditional expectation (or other functionals) of a
response variable given predictors.  This module covers the full spectrum from
classical least-squares to Bayesian nonparametric methods, with emphasis on
statistical theory, asymptotic results, and computational algorithms.

---

## 1. Ordinary Least Squares (OLS)

### 1.1 Model and Estimator

$$\mathbf{y} = \mathbf{X}\boldsymbol{\beta} + \boldsymbol{\varepsilon}, \quad \boldsymbol{\varepsilon}\sim\mathcal{N}(\mathbf{0},\sigma^2\mathbf{I}_n)$$

Closed-form solution: $\hat{\boldsymbol{\beta}} = (\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top\mathbf{y}$

**Gauss-Markov theorem:** $\hat{\boldsymbol{\beta}}$ is the Best Linear Unbiased Estimator (BLUE):
$\text{Var}(\hat{\boldsymbol{\beta}}) = \sigma^2(\mathbf{X}^\top\mathbf{X})^{-1}$

### 1.2 Geometric Interpretation

$\hat{\mathbf{y}} = \mathbf{H}\mathbf{y}$ where $\mathbf{H} = \mathbf{X}(\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{X}^\top$
(hat matrix / projection matrix).

$\hat{\boldsymbol{\varepsilon}} = (\mathbf{I}-\mathbf{H})\mathbf{y}$; $\text{rank}(\mathbf{H}) = p$ (number of regressors).

**Frisch-Waugh-Lovell theorem:** The coefficient on $\mathbf{X}_2$ in $\mathbf{y} = \mathbf{X}_1\boldsymbol{\beta}_1+\mathbf{X}_2\boldsymbol{\beta}_2+\boldsymbol{\varepsilon}$
equals the OLS coefficient from regressing $\mathbf{M}_1\mathbf{y}$ on $\mathbf{M}_1\mathbf{X}_2$,
where $\mathbf{M}_1 = \mathbf{I} - \mathbf{H}_1$.

### 1.3 Inference

**t-statistic:** $t_j = \hat{\beta}_j / \text{SE}(\hat{\beta}_j)$ follows $t_{n-p}$ under $H_0: \beta_j = 0$.

**F-statistic:** $F = (R\hat{\boldsymbol{\beta}} - r)^\top[R(\mathbf{X}^\top\mathbf{X})^{-1}R^\top]^{-1}(R\hat{\boldsymbol{\beta}}-r)/(q\hat{\sigma}^2)$

**Heteroskedasticity-robust (HC0–HC3):**
$$\widehat{\text{Var}}_{HC0}(\hat{\boldsymbol{\beta}}) = (\mathbf{X}^\top\mathbf{X})^{-1}\left(\sum_i\hat\varepsilon_i^2\mathbf{x}_i\mathbf{x}_i^\top\right)(\mathbf{X}^\top\mathbf{X})^{-1}$$

### 1.4 Diagnostics

| Diagnostic | Formula |
|---|---|
| Leverage | $h_i = \mathbf{x}_i^\top(\mathbf{X}^\top\mathbf{X})^{-1}\mathbf{x}_i$ |
| Studentised residual | $r_i = \hat\varepsilon_i / (\hat\sigma\sqrt{1-h_i})$ |
| Cook's distance | $D_i = r_i^2 h_i / (p(1-h_i))$ |
| DFFITS | $\text{DFFITS}_i = r_i\sqrt{h_i/(1-h_i)}$ |

---

## 2. Generalised Least Squares (GLS)

For $\boldsymbol{\varepsilon}\sim\mathcal{N}(\mathbf{0},\sigma^2\boldsymbol{\Omega})$:
$$\hat{\boldsymbol{\beta}}_{GLS} = (\mathbf{X}^\top\boldsymbol{\Omega}^{-1}\mathbf{X})^{-1}\mathbf{X}^\top\boldsymbol{\Omega}^{-1}\mathbf{y}$$

BLUE when $\boldsymbol{\Omega}$ is known.  When unknown, use FGLS (feasible GLS)
with $\hat{\boldsymbol{\Omega}}$ estimated from OLS residuals.

---

## 3. Ridge Regression

Shrinkage estimator: $\hat{\boldsymbol{\beta}}_\lambda = (\mathbf{X}^\top\mathbf{X}+\lambda\mathbf{I})^{-1}\mathbf{X}^\top\mathbf{y}$

**Bias-variance tradeoff:**
$$\text{Bias}^2(\hat{\boldsymbol{\beta}}_\lambda) = \lambda^2\boldsymbol{\beta}^\top(\mathbf{X}^\top\mathbf{X}+\lambda\mathbf{I})^{-2}\boldsymbol{\beta}$$
$$\text{Var}(\hat{\boldsymbol{\beta}}_\lambda) = \sigma^2\text{tr}[(\mathbf{X}^\top\mathbf{X})(\mathbf{X}^\top\mathbf{X}+\lambda\mathbf{I})^{-2}]$$

**GCV for λ selection:**
$$\text{GCV}(\lambda) = \frac{\text{RSS}(\lambda)/n}{(1-\text{tr}(\mathbf{H}_\lambda)/n)^2}$$

---

## 4. LASSO and Sparsity

Objective: $\min_\beta \frac{1}{2n}\|\mathbf{y}-\mathbf{X}\boldsymbol{\beta}\|^2 + \lambda\|\boldsymbol{\beta}\|_1$

**KKT conditions:** $\frac{1}{n}\mathbf{x}_j^\top(\mathbf{y}-\mathbf{X}\hat{\boldsymbol{\beta}}) = \lambda\,\text{sgn}(\hat\beta_j)$ for $\hat\beta_j\neq 0$, $\leq\lambda$ for $\hat\beta_j=0$.

**Restricted Eigenvalue condition (REC):** For $S$ = true support, $|S|\leq s$:
$$\kappa^2(s) = \min_{\boldsymbol{\delta}\neq 0,\|\delta_{S^c}\|_1\leq 3\|\delta_S\|_1}\frac{\|\mathbf{X}\boldsymbol{\delta}\|_2^2}{n\|\boldsymbol{\delta}\|_2^2} > 0$$

Under REC, LASSO achieves $\|\hat{\boldsymbol{\beta}}-\boldsymbol{\beta}^*\|_2 = O(\lambda\sqrt{s})$.

---

## 5. Gaussian Process Regression

**Prior:** $f \sim \mathcal{GP}(m(\cdot), k(\cdot,\cdot))$

**Posterior** (after observing $\mathbf{y} = \mathbf{f} + \boldsymbol{\varepsilon}$, $\varepsilon_i \sim \mathcal{N}(0,\sigma^2)$):
$$f(\mathbf{x}_*) | \mathbf{y} \sim \mathcal{N}(\bar{f}(\mathbf{x}_*), \mathbb{V}[f(\mathbf{x}_*)])$$
$$\bar{f}(\mathbf{x}_*) = m(\mathbf{x}_*) + \mathbf{k}_*^\top(\mathbf{K}+\sigma^2\mathbf{I})^{-1}(\mathbf{y}-\mathbf{m})$$
$$\mathbb{V}[f(\mathbf{x}_*)] = k(\mathbf{x}_*,\mathbf{x}_*) - \mathbf{k}_*^\top(\mathbf{K}+\sigma^2\mathbf{I})^{-1}\mathbf{k}_*$$

**Hyperparameter optimisation via log marginal likelihood:**
$$\log p(\mathbf{y}|\mathbf{X},\boldsymbol{\theta}) = -\frac{1}{2}\mathbf{y}^\top\mathbf{K}_y^{-1}\mathbf{y} - \frac{1}{2}\log|\mathbf{K}_y| - \frac{n}{2}\log 2\pi$$

---

## 6. Logistic and Generalised Linear Models

**GLM:** $g(\mathbb{E}[Y|X]) = \mathbf{x}^\top\boldsymbol{\beta}$ where $g$ is the link function.

| Family | Link | Variance |
|---|---|---|
| Gaussian | Identity | $\sigma^2$ |
| Binomial | Logit $\log(p/(1-p))$ | $p(1-p)$ |
| Poisson | Log $\log\mu$ | $\mu$ |
| Gamma | Inverse $1/\mu$ | $\mu^2$ |
| Inverse Gaussian | $1/\mu^2$ | $\mu^3$ |

**Deviance:** $D(\mathbf{y};\hat{\boldsymbol{\mu}}) = 2[\ell(\mathbf{y};\mathbf{y}) - \ell(\mathbf{y};\hat{\boldsymbol{\mu}})]$

---

## 7. Survival Analysis (Cox PH)

**Hazard function:** $h(t|\mathbf{x}) = h_0(t)\exp(\mathbf{x}^\top\boldsymbol{\beta})$

**Partial log-likelihood:**
$$\ell(\boldsymbol{\beta}) = \sum_{i:\delta_i=1}\left[\mathbf{x}_i^\top\boldsymbol{\beta} - \log\sum_{j\in\mathcal{R}(t_i)}e^{\mathbf{x}_j^\top\boldsymbol{\beta}}\right]$$

**Breslow estimator for baseline hazard:**
$$\hat{H}_0(t) = \sum_{t_i\leq t,\delta_i=1}\frac{1}{\sum_{j\in\mathcal{R}(t_i)}\exp(\mathbf{x}_j^\top\hat{\boldsymbol{\beta}})}$$

---

## Subdirectories

| Directory | Content |
|---|---|
| `linear/` | OLS, GLS, FGLS, WLS, SUR |
| `nonlinear/` | NLS, Gauss-Newton, Levenberg-Marquardt |
| `logistic/` | Logistic, multinomial logit, probit, GLMs |
| `regularized/` | Ridge, LASSO, Elastic Net, SCAD, MCP |
| `bayesian/` | Bayesian linear regression, spike-and-slab, Horseshoe prior |
| `gaussian_process/` | GP regression, sparse GPs, deep kernels |
| `kernel/` | Kernel ridge regression, SVR, representer theorem |
| `time_series/` | AR, MA, ARMA, ARIMA, GARCH, state-space |
| `survival/` | Cox PH, AFT models, Kaplan-Meier |
| `multivariate/` | MANOVA, CCA, factor analysis, SEM |
