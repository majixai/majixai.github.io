# Information Theory — PhD-Level Reference

## Overview

Information theory (Shannon 1948) provides a mathematical theory of communication,
compression, and inference. This module covers entropy, channel capacity, coding
theorems, algorithmic information theory, and quantum information theory.

---

## 1. Entropy and Divergence

### 1.1 Shannon Entropy

$$H(X) = -\sum_x p(x)\log p(x) \quad [\text{bits for log}_2, \text{nats for ln}]$$

**Differential entropy:** $h(X) = -\int p(x)\log p(x)\,dx$ (not non-negative in general)

**Maximum entropy:** $H(X)$ is maximised by the uniform distribution: $H(X) \leq \log|\mathcal{X}|$.

### 1.2 Kullback–Leibler Divergence

$$D_{KL}(P\|Q) = \sum_x p(x)\log\frac{p(x)}{q(x)} \geq 0$$

with equality iff $P = Q$ (Gibbs inequality, follows from Jensen on $-\log$).

**Cross entropy:** $H(P,Q) = H(P) + D_{KL}(P\|Q)$

**Jensen–Shannon divergence:** $JSD(P\|Q) = \frac{1}{2}D_{KL}(P\|M) + \frac{1}{2}D_{KL}(Q\|M)$, $M = (P+Q)/2$

### 1.3 Mutual Information

$$I(X;Y) = H(X) + H(Y) - H(X,Y) = D_{KL}(p_{XY}\|p_X p_Y)$$

**Data processing inequality:** For $X \to Y \to Z$ Markov: $I(X;Z) \leq I(X;Y)$.

**Chain rule:** $I(X_1,\ldots,X_n;Y) = \sum_k I(X_k;Y|X_1,\ldots,X_{k-1})$

---

## 2. Source Coding

### 2.1 Shannon's Source Coding Theorem

For an i.i.d. source with entropy $H(X)$, $n$ symbols can be compressed to $nH(X)$
bits (lossless), and not below $H(X)$ bits per symbol.

**Typical set:** $A_\varepsilon^{(n)} = \{x^n : |{-\frac{1}{n}\log p(x^n)} - H|\leq\varepsilon\}$
satisfies $P(A_\varepsilon^{(n)}) \geq 1-\varepsilon$ and $|A_\varepsilon^{(n)}| \leq 2^{n(H+\varepsilon)}$.

### 2.2 Entropy Coding

**Huffman code:** Optimal prefix-free code; average length $H(X) \leq \bar{L} < H(X)+1$.

**Arithmetic coding:** Achieves entropy rate to arbitrary precision.

**Asymptotic Equipartition Property (AEP):**
$$-\frac{1}{n}\log p(X_1,\ldots,X_n) \xrightarrow{p} H(X)$$

### 2.3 Rate-Distortion Theory

$R(D) = \min_{p(\hat{x}|x): \mathbb{E}[d(X,\hat{X})]\leq D} I(X;\hat{X})$

For Gaussian source with $\mathbb{E}[X^2] = \sigma^2$, squared-error distortion:
$$R(D) = \frac{1}{2}\log\frac{\sigma^2}{D}, \quad 0 \leq D \leq \sigma^2$$

---

## 3. Channel Capacity

### 3.1 Shannon's Noisy Channel Theorem

**Channel capacity:** $C = \max_{p(x)} I(X;Y)$ [bits/channel use]

**Shannon's theorem:** For rate $R < C$, $\exists$ a code with arbitrarily small error.
For $R > C$, error probability is bounded away from 0.

### 3.2 AWGN Channel

$Y = X + Z$, $Z\sim\mathcal{N}(0,N_0/2)$, power constraint $\mathbb{E}[X^2]\leq P$:
$$C = \frac{1}{2}\log\!\left(1 + \frac{P}{N_0/2}\right) \quad [\text{bits/channel use}]$$

**Shannon–Hartley theorem:** $C = B\log_2(1 + S/N)$ [bits/second]

### 3.3 Fading Channels

**Ergodic capacity (fast fading):** $C = \mathbb{E}_h\!\left[\log(1+\frac{|h|^2 P}{N})\right]$

**Outage capacity:** $C_\varepsilon = \max R: P(\log(1+|h|^2 P/N) < R) \leq \varepsilon$

**MIMO capacity:** For $n_T\times n_R$ MIMO with channel $\mathbf{H}$:
$$C = \log\det\!\left(\mathbf{I}_{n_R} + \frac{P}{n_T}\mathbf{H}\mathbf{H}^\dagger\right)$$

---

## 4. Error-Correcting Codes

### 4.1 Linear Codes

An $[n,k,d]$ binary linear code has block length $n$, dimension $k$, minimum distance $d$.

**Hamming bound (sphere-packing):** $2^n / (|\text{ball of radius t}|) \leq 2^n / 2^k$

**Singleton bound:** $d \leq n - k + 1$ (MDS codes: Reed-Solomon, Gabidulin)

**Gilbert-Varshamov bound:** $\exists$ $[n,k,d]$ code with $k/n \geq 1 - H(d/n) - o(1)$.

### 4.2 LDPC and Turbo Codes

**LDPC codes** (Gallager 1962; Shannon-capacity approaching): Sparse bipartite Tanner graph;
decoded by belief propagation (sum-product algorithm).

**Turbo codes:** Parallel concatenation of two recursive systematic convolutional codes;
decoded by iterative BCJR algorithm (forward-backward).

**Polar codes** (Arıkan 2009): Achieve capacity for symmetric binary-input channels;
encoding/decoding complexity $O(n\log n)$ via channel polarisation.

---

## 5. Algorithmic Information Theory

**Kolmogorov complexity:** $K(x) = \min\{|p| : U(p) = x\}$ for universal Turing machine $U$.

**Invariance theorem:** $K_U(x) \leq K_{U'}(x) + c$ (constant independent of $x$).

**Incompressibility:** Most strings are incompressible: $|\{x : |x|=n, K(x) \leq n-c\}| \leq 2^{n-c+1}$.

**Minimum description length (MDL):** Model selection criterion:
$\text{MDL}(H|D) = K(H) + K(D|H)$ (trading off model complexity vs data fit).

---

## 6. Quantum Information Theory

**Quantum entropy:** $S(\rho) = -\text{tr}(\rho\log\rho)$

**Quantum mutual information:** $I(A;B)_\rho = S(\rho_A) + S(\rho_B) - S(\rho_{AB})$

**Holevo bound:** Accessible information from quantum ensemble $\{p_i, \rho_i\}$:
$$I(X;Y) \leq \chi = S\!\left(\sum_i p_i\rho_i\right) - \sum_i p_i S(\rho_i)$$

**Quantum channel capacity:** $Q_1 = \max_\rho(S(T(\rho)) - S_e(\rho,T))$ (coherent information)

**Quantum error correction:** $[[n,k,d]]$ codes; quantum Hamming, Singleton bounds.

---

## Subdirectories

| Directory | Content |
|---|---|
| `entropy/` | Shannon entropy, Rényi entropy, entropy inequalities, AEP |
| `channel_capacity/` | Shannon theorem, AWGN, MIMO, broadcast, MAC, relay channels |
| `coding_theory/` | Linear codes, LDPC, turbo, polar codes, Reed-Solomon |
| `algorithmic/` | Kolmogorov complexity, MDL, PAC learning, Solomonoff induction |
| `quantum_info_theory/` | Von Neumann entropy, holevo bound, quantum channel capacity |
