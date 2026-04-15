# Probability Theory — PhD-Level Reference

## Overview

Advanced probability theory — built on measure theory — provides the rigorous
framework for stochastic processes, martingales, large deviations, and random
fields, underpinning statistics, financial mathematics, and statistical physics.

---

## 1. Probability Spaces and Random Variables

A probability space $(\Omega, \mathcal{F}, \mathbb{P})$ satisfies $\mathbb{P}(\Omega) = 1$.

**Kolmogorov extension theorem:** A consistent family of finite-dimensional distributions
determines a unique probability measure on $(\mathbb{R}^\infty, \mathcal{B}^\infty)$.

**Characteristic function:** $\phi_X(t) = \mathbb{E}[e^{itX}]$ uniquely determines the distribution;
$X$ and $Y$ are independent iff $\phi_{X+Y} = \phi_X\phi_Y$.

**Lévy–Cramér continuity theorem:** $\phi_{X_n} \to \phi_X$ pointwise iff $X_n \xrightarrow{d} X$.

---

## 2. Laws of Large Numbers and CLT

**Strong LLN (Kolmogorov):** If $\{X_i\}$ i.i.d. with $\mathbb{E}|X_1| < \infty$, then
$\bar{X}_n \xrightarrow{\text{a.s.}} \mu$.

**CLT:** $\sqrt{n}(\bar{X}_n - \mu)/\sigma \xrightarrow{d} \mathcal{N}(0,1)$

**Lindeberg–Feller CLT:** Triangular arrays satisfy CLT under the Lindeberg condition
$\sum_k \mathbb{E}[X_{nk}^2 \mathbf{1}(|X_{nk}|>\varepsilon)] / s_n^2 \to 0$.

**Berry–Esseen bound:** $\sup_x |F_n(x) - \Phi(x)| \leq \frac{C \mathbb{E}|X|^3}{\sigma^3\sqrt{n}}$

---

## 3. Stochastic Processes

### 3.1 Brownian Motion (Wiener Process)

$\{W_t\}_{t\geq 0}$ is standard BM if: $W_0 = 0$; independent increments;
$W_t - W_s \sim \mathcal{N}(0,t-s)$; a.s. continuous paths.

**Quadratic variation:** $[W]_t = t$ a.s. (in contrast to smooth paths of zero QV).

**Reflection principle:** $\mathbb{P}(\max_{0\leq s\leq t} W_s \geq a) = 2\mathbb{P}(W_t \geq a)$

**Donsker's invariance principle:** Rescaled random walks converge to BM in $C[0,1]$.

### 3.2 Poisson Process

$N_t$ is a Poisson process with rate $\lambda$ if: $N_0=0$; independent increments;
$N_t - N_s \sim \text{Poisson}(\lambda(t-s))$.

**Compound Poisson process:** $X_t = \sum_{k=1}^{N_t} Y_k$ with $Y_k$ i.i.d.

### 3.3 Lévy Processes

A Lévy process has: $X_0 = 0$; independent and stationary increments; stochastic continuity.

**Lévy–Khintchine representation:**
$$\log\mathbb{E}[e^{i\xi X_t}] = t\left(i b\xi - \frac{1}{2}\sigma^2\xi^2 + \int\left(e^{i\xi x}-1-i\xi x\mathbf{1}_{|x|<1}\right)\nu(dx)\right)$$

where $\nu$ is the Lévy measure satisfying $\int \min(1,x^2)\,\nu(dx) < \infty$.

---

## 4. Martingales

$\{M_n\}$ is a **martingale** w.r.t. $\{\mathcal{F}_n\}$ if adapted, integrable,
and $\mathbb{E}[M_{n+1}|\mathcal{F}_n] = M_n$.

**Doob's optional stopping theorem:** If $\tau$ is a bounded stopping time,
$\mathbb{E}[M_\tau] = \mathbb{E}[M_0]$.

**Doob's $L^p$ inequality:** $\mathbb{E}[\max_{k\leq n}|M_k|^p] \leq \left(\frac{p}{p-1}\right)^p\mathbb{E}[|M_n|^p]$

**Doob's martingale convergence:** An $L^1$-bounded martingale converges a.s. and in $L^1$.

**Martingale representation theorem:** Every $\mathcal{F}_t^W$-martingale $M$ has the form
$M_t = M_0 + \int_0^t H_s\,dW_s$ for some adapted $H$.

---

## 5. Large Deviations

**Cramér's theorem:** For i.i.d. $\{X_i\}$ with log-moment generating function
$\Lambda(\theta) = \log\mathbb{E}[e^{\theta X}]$ (finite in a neighbourhood of 0):
$$\mathbb{P}(\bar{X}_n \geq x) = \exp(-n I(x) + o(n)), \quad I(x) = \sup_\theta(\theta x - \Lambda(\theta))$$

$I(\cdot)$ is the **Cramér rate function** (Legendre–Fenchel transform of $\Lambda$).

**Gärtner–Ellis theorem:** Under differentiability conditions on $\frac{1}{n}\Lambda_n(\theta) \to \Lambda(\theta)$, the LDP holds with rate function $I = \Lambda^*$.

**Sanov's theorem:** The LDP for empirical measures $L_n = \frac{1}{n}\sum \delta_{X_i}$ in the weak topology has rate function $I(\mu) = \text{KL}(\mu\|\mathbb{P})$.

---

## 6. Random Fields and SPDEs

A **random field** $\{X_t : t \in T\}$ for $T$ a metric space.

**Gaussian random field:** Specified by mean $m(t)$ and covariance $K(s,t)$.
Stationarity: $K(s,t) = C(s-t)$; isotropy: $C(x) = \tilde{C}(\|x\|)$.

**Matérn covariance:** $C(r) = \frac{2^{1-\nu}}{\Gamma(\nu)}\left(\frac{\sqrt{2\nu}r}{\ell}\right)^\nu K_\nu\!\left(\frac{\sqrt{2\nu}r}{\ell}\right)$

Sample paths have $\lfloor\nu\rfloor$ mean-square derivatives.

**SPDE:** $\frac{\partial u}{\partial t} = \mathcal{L}u + \sigma\dot{W}$ where $\dot{W}$ is space-time white noise.
Mild solution: $u(t) = S(t)u_0 + \int_0^t S(t-s)\sigma\,dW(s)$.

---

## Subdirectories

| Directory | Content |
|---|---|
| `stochastic_processes/` | BM, Poisson, Lévy, Markov chains, renewal theory |
| `martingales/` | Stopping times, convergence theorems, optional sampling |
| `large_deviations/` | Cramér, Gärtner-Ellis, Sanov, process-level LDP |
| `random_fields/` | Gaussian fields, covariance functions, Matérn, SPDEs |
| `extreme_value/` | GEV, GPD, block maxima, peaks over threshold, EVT |
