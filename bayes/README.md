# Bayesian Inference — PhD-Level Reference

## Overview

Bayesian statistics treats parameters as random variables with prior distributions,
updating beliefs through the likelihood to obtain posterior distributions.  This
module covers the full spectrum from conjugate models to non-parametric methods.

---

## 1. Foundations

**Bayes' theorem:**
$$p(\boldsymbol{\theta}|\mathbf{y}) = \frac{p(\mathbf{y}|\boldsymbol{\theta})\,p(\boldsymbol{\theta})}{p(\mathbf{y})}$$

where $p(\mathbf{y}) = \int p(\mathbf{y}|\boldsymbol{\theta})\,p(\boldsymbol{\theta})\,d\boldsymbol{\theta}$ is the *marginal likelihood*.

**Posterior predictive distribution:**
$$p(\tilde{y}|\mathbf{y}) = \int p(\tilde{y}|\boldsymbol{\theta})\,p(\boldsymbol{\theta}|\mathbf{y})\,d\boldsymbol{\theta}$$

---

## 2. Exponential Family and Conjugate Priors

For the exponential family $p(\mathbf{y}|\boldsymbol{\eta}) = h(\mathbf{y})\exp(\boldsymbol{\eta}^\top T(\mathbf{y}) - A(\boldsymbol{\eta}))$,
conjugate priors have the form $p(\boldsymbol{\eta}|\boldsymbol{\chi},\nu) \propto \exp(\boldsymbol{\eta}^\top\boldsymbol{\chi} - \nu A(\boldsymbol{\eta}))$
with posterior parameters $\boldsymbol{\chi}' = \boldsymbol{\chi} + \sum T(\mathbf{y}_i)$, $\nu' = \nu + n$.

| Likelihood | Conjugate Prior | Posterior |
|---|---|---|
| $\text{Binomial}(n,\theta)$ | $\text{Beta}(\alpha,\beta)$ | $\text{Beta}(\alpha+k,\beta+n-k)$ |
| $\text{Poisson}(\lambda)$ | $\text{Gamma}(\alpha,\beta)$ | $\text{Gamma}(\alpha+\sum y_i, \beta+n)$ |
| $\mathcal{N}(\mu,\sigma^2)$ (known $\sigma^2$) | $\mathcal{N}(\mu_0,\tau_0^2)$ | $\mathcal{N}(\mu_n,\tau_n^2)$ |
| $\mathcal{N}(\mu,\sigma^2)$ | Normal-InvGamma | Normal-InvGamma |
| $\text{Multinomial}$ | $\text{Dirichlet}(\boldsymbol{\alpha})$ | $\text{Dirichlet}(\boldsymbol{\alpha}+\mathbf{n})$ |

---

## 3. Markov Chain Monte Carlo (MCMC)

### 3.1 Metropolis–Hastings Algorithm

At state $\boldsymbol{\theta}^{(t)}$, propose $\boldsymbol{\theta}^* \sim q(\cdot|\boldsymbol{\theta}^{(t)})$.
Accept with probability:
$$\alpha = \min\!\left(1,\frac{p(\boldsymbol{\theta}^*|\mathbf{y})\,q(\boldsymbol{\theta}^{(t)}|\boldsymbol{\theta}^*)}{p(\boldsymbol{\theta}^{(t)}|\mathbf{y})\,q(\boldsymbol{\theta}^*|\boldsymbol{\theta}^{(t)})}\right)$$

Detailed balance ensures $\pi = p(\cdot|\mathbf{y})$ is the stationary distribution.

### 3.2 Hamiltonian Monte Carlo (HMC)

Augment with momentum $\mathbf{p} \sim \mathcal{N}(\mathbf{0},\mathbf{M})$ and
simulate Hamiltonian dynamics:
$$H(\boldsymbol{\theta},\mathbf{p}) = -\log p(\boldsymbol{\theta}|\mathbf{y}) + \frac{1}{2}\mathbf{p}^\top\mathbf{M}^{-1}\mathbf{p}$$

Leapfrog integrator (time-reversible, volume-preserving):
$$\mathbf{p}_{t+\epsilon/2} = \mathbf{p}_t + \frac{\epsilon}{2}\nabla_{\boldsymbol{\theta}}\log p(\boldsymbol{\theta}_t|\mathbf{y})$$
$$\boldsymbol{\theta}_{t+\epsilon} = \boldsymbol{\theta}_t + \epsilon\mathbf{M}^{-1}\mathbf{p}_{t+\epsilon/2}$$
$$\mathbf{p}_{t+\epsilon} = \mathbf{p}_{t+\epsilon/2} + \frac{\epsilon}{2}\nabla_{\boldsymbol{\theta}}\log p(\boldsymbol{\theta}_{t+\epsilon}|\mathbf{y})$$

### 3.3 No-U-Turn Sampler (NUTS)

NUTS (Hoffman & Gelman 2014) dynamically selects the trajectory length by
detecting when the Hamiltonian trajectory turns back on itself:
$$(\boldsymbol{\theta}^- - \boldsymbol{\theta}^-_{\text{anchor}}) \cdot \mathbf{p}^- < 0 \quad \text{or} \quad (\boldsymbol{\theta}^+ - \boldsymbol{\theta}^-_{\text{anchor}}) \cdot \mathbf{p}^+ < 0$$

### 3.4 Gibbs Sampling

Sample each coordinate from its full conditional:
$$\boldsymbol{\theta}_j^{(t+1)} \sim p(\theta_j | \boldsymbol{\theta}_{-j}^{(t)}, \mathbf{y})$$

Especially efficient when full conditionals are conjugate.

---

## 4. Variational Inference

**ELBO:** Approximate $p(\boldsymbol{\theta}|\mathbf{y})$ by $q(\boldsymbol{\theta};\boldsymbol{\phi})$
minimising $\text{KL}(q\|p)$.  Equivalently, maximise:
$$\mathcal{L}(\boldsymbol{\phi}) = \mathbb{E}_q[\log p(\mathbf{y},\boldsymbol{\theta})] - \mathbb{E}_q[\log q(\boldsymbol{\theta};\boldsymbol{\phi})]$$

**Mean-field VI:** Factorise $q(\boldsymbol{\theta}) = \prod_j q_j(\theta_j)$; optimal factors:
$$\log q_j^*(\theta_j) = \mathbb{E}_{-j}[\log p(\mathbf{y},\boldsymbol{\theta})] + \text{const}$$

**Reparameterisation trick (VAE):** For $q_\phi(\mathbf{z}|\mathbf{x}) = \mathcal{N}(\boldsymbol{\mu}_\phi, \text{diag}(\boldsymbol{\sigma}_\phi^2))$:
$$\mathbf{z} = \boldsymbol{\mu}_\phi + \boldsymbol{\sigma}_\phi \odot \boldsymbol{\epsilon}, \quad \boldsymbol{\epsilon}\sim\mathcal{N}(\mathbf{0},\mathbf{I})$$
enabling gradient estimation $\nabla_\phi\mathcal{L}$ via the REINFORCE / score-function estimator.

---

## 5. Hierarchical Bayesian Models

**Partial pooling:** $y_{ij} | \theta_j \sim p(y|\theta_j)$, $\theta_j | \boldsymbol{\phi} \sim p(\theta|\boldsymbol{\phi})$, $\boldsymbol{\phi} \sim p(\boldsymbol{\phi})$.

**Eight schools (Rubin 1981):** Canonical hierarchical normal model:
$$y_j | \theta_j \sim \mathcal{N}(\theta_j, \sigma_j^2), \quad \theta_j|\mu,\tau \sim \mathcal{N}(\mu,\tau^2), \quad \mu,\tau \sim p_0$$

**Non-centred parameterisation:** Replace $\theta_j = \mu + \tau\eta_j$, $\eta_j\sim\mathcal{N}(0,1)$
to remove the funnel geometry in the posterior.

---

## 6. Bayesian Nonparametrics

**Dirichlet Process (Ferguson 1973):** $G \sim \text{DP}(\alpha, G_0)$ has properties:
- $G(A) \sim \text{Beta}(\alpha G_0(A), \alpha(1-G_0(A)))$
- Conjugacy: posterior is $\text{DP}(\alpha+n, \frac{\alpha G_0 + \sum \delta_{\theta_i}}{\alpha+n})$
- Stick-breaking: $G = \sum_{k=1}^\infty \pi_k\delta_{\theta_k}$, $\pi_k = v_k\prod_{j<k}(1-v_j)$, $v_k \overset{iid}{\sim} \text{Beta}(1,\alpha)$

**Chinese Restaurant Process:** Predictive:
$$\theta_{n+1} | \theta_1,\ldots,\theta_n \sim \frac{\alpha}{\alpha+n}G_0 + \frac{1}{\alpha+n}\sum_{i=1}^n\delta_{\theta_i}$$

**Gaussian Process prior:** $f \sim \mathcal{GP}(m,k)$ provides a nonparametric
prior over functions directly.

---

## 7. Model Selection

**Bayes Factor:** $B_{10} = \frac{p(\mathbf{y}|M_1)}{p(\mathbf{y}|M_0)}$

**Bayesian Information Criterion (BIC):** $\text{BIC} = -2\log\mathcal{L}(\hat{\boldsymbol{\theta}}) + k\log n$
(Laplace approximation to marginal likelihood)

**WAIC:** $\text{WAIC} = -2\sum_i\left(\log\mathbb{E}_\theta p(y_i|\theta) - \mathbb{V}_\theta[\log p(y_i|\theta)]\right)$

---

## Subdirectories

| Directory | Content |
|---|---|
| `inference/` | Conjugate models, Laplace approximation, EP |
| `mcmc/` | Metropolis-Hastings, HMC, NUTS, SGLD, parallel tempering |
| `variational/` | ELBO, mean-field, SVI, normalising flows |
| `networks/` | Bayesian networks, belief propagation, junction tree |
| `hierarchical/` | Partial pooling, multilevel models, hyperpriors |
| `nonparametric/` | DP, GP, Indian buffet process, beta process |
| `decision_theory/` | Utility, loss functions, admissibility, minimax Bayes |
