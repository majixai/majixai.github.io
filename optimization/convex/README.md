# Convex Optimization — PhD Reference

## 1. Convexity and Duality Theory

### 1.1 Convex Functions

$f: \mathbb{R}^n \to \mathbb{R}$ is **convex** iff $\forall x,y \in \text{dom}\, f$, $\lambda\in[0,1]$:
$$f(\lambda x + (1-\lambda)y) \leq \lambda f(x) + (1-\lambda)f(y)$$

**First-order characterization:** $f(y) \geq f(x) + \nabla f(x)^\top(y-x)$ for all $x,y$.

**Second-order:** $\nabla^2 f(x) \succeq 0$ (positive semidefinite).

**Strongly convex with parameter $\mu$:** $f(y) \geq f(x)+\nabla f(x)^\top(y-x) + \frac{\mu}{2}\|y-x\|^2$.

**$L$-smooth:** $\|\nabla f(x)-\nabla f(y)\| \leq L\|x-y\|$, equivalently $\nabla^2 f \preceq LI$.

### 1.2 Conjugate Functions and Fenchel Duality

**Fenchel conjugate:** $f^*(y) = \sup_x\{y^\top x - f(x)\}$

$f^{**} = f$ for closed convex $f$.

**Young's inequality:** $f(x) + f^*(y) \geq x^\top y$ with equality iff $y \in \partial f(x)$.

**Fenchel-Rockafellar duality:**
$$\inf_x\{f(x) + g(Ax)\} = -\inf_y\{f^*(-A^\top y) + g^*(y)\}$$
(strong duality under constraint qualification)

---

## 2. KKT Conditions

**Primal:** $\min f(x)$ s.t. $g_i(x)\leq 0$, $h_j(x)=0$

**Lagrangian:** $L(x,\lambda,\nu) = f(x) + \sum_i\lambda_i g_i(x) + \sum_j\nu_j h_j(x)$

**KKT conditions (necessary + sufficient for convex problems):**
1. Stationarity: $\nabla_x L = 0$
2. Primal feasibility: $g_i(x^*)\leq 0$, $h_j(x^*)=0$
3. Dual feasibility: $\lambda_i \geq 0$
4. Complementary slackness: $\lambda_i g_i(x^*) = 0$

**Slater's condition** (sufficient for strong duality): $\exists x$ s.t. $g_i(x) < 0$ strictly.

---

## 3. Convergence Rates

| Algorithm | Condition | Rate |
|---|---|---|
| Gradient descent | $L$-smooth, convex | $O(L/k)$ |
| GD | $L$-smooth, $\mu$-strongly convex | $O(\exp(-\mu k/L))$ |
| Nesterov AGD | $L$-smooth, convex | $O(L/k^2)$ |
| AGD | $L$-smooth, $\mu$-strongly convex | $O(\exp(-\sqrt{\mu/L}\,k))$ |
| Subgradient | Lipschitz, convex | $O(1/\sqrt{k})$ |

**Information-theoretic lower bound** (Nemirovsky-Yudin): $O(L/k^2)$ is optimal for smooth convex optimization.

---

## 4. ADMM (Alternating Direction Method of Multipliers)

**Problem:** $\min f(x)+g(z)$ s.t. $Ax+Bz=c$

**Augmented Lagrangian:**
$$L_\rho(x,z,y) = f(x)+g(z)+y^\top(Ax+Bz-c)+\frac{\rho}{2}\|Ax+Bz-c\|^2$$

**ADMM iterations:**
1. $x^{k+1} = \arg\min_x L_\rho(x, z^k, y^k)$
2. $z^{k+1} = \arg\min_z L_\rho(x^{k+1}, z, y^k)$
3. $y^{k+1} = y^k + \rho(Ax^{k+1}+Bz^{k+1}-c)$

**Convergence:** O(1/k) for convex under mild conditions; linear for strongly convex.

---

## 5. Semidefinite Programming (SDP)

**Standard form:** $\min \text{tr}(CX)$ s.t. $\text{tr}(A_iX) = b_i$, $X \succeq 0$

**Applications:** MAX-CUT relaxation, sum-of-squares polynomials, MIMO beamforming, matrix completion.

**Interior-point algorithm:** $O(n^{3.5})$ per iteration for $n\times n$ matrices.

**SOS (Sum of Squares):** A polynomial $p(x)$ is SOS iff $p(x) = q(x)^\top q(x)$ for some polynomial vector $q$.
Positivstellensatz: $p \geq 0$ on $K$ can be certified by an SDP.
