# Cryptography — PhD-Level Reference

## Overview

Modern cryptography is grounded in computational hardness assumptions from number
theory, algebraic geometry, and lattice theory. This module covers public-key
cryptography, elliptic curve cryptosystems, lattice-based post-quantum schemes,
zero-knowledge proofs, and related mathematical foundations.

---

## 1. Number Theory Foundations

### 1.1 Modular Arithmetic and Groups

$\mathbb{Z}/n\mathbb{Z}^* = (\mathbb{Z}/n\mathbb{Z})^\times$ has order $\phi(n)$ (Euler's totient).

**Euler's theorem:** $a^{\phi(n)} \equiv 1 \pmod{n}$ for $\gcd(a,n)=1$.

**Chinese Remainder Theorem:** $\mathbb{Z}/mn\mathbb{Z} \cong \mathbb{Z}/m\mathbb{Z} \times \mathbb{Z}/n\mathbb{Z}$ when $\gcd(m,n)=1$.

### 1.2 Discrete Logarithm Problem (DLP)

Given $g, h$ in a group $G$: find $x$ s.t. $g^x = h$.

**Index-Calculus (subexponential):** $L_{q}[\alpha,c] = O(\exp(c(\ln q)^\alpha(\ln\ln q)^{1-\alpha}))$
for $\alpha \in (0,1)$.

**Baby-step Giant-step:** $O(\sqrt{|G|})$ time and space.

### 1.3 RSA Cryptosystem

$n = pq$, $e$ s.t. $\gcd(e,\phi(n))=1$, $d = e^{-1} \pmod{\phi(n)}$.

Encrypt: $c = m^e \bmod n$.  Decrypt: $m = c^d \bmod n$.

Security relies on hardness of factoring $n$ (IFP) and the RSA problem.
OAEP padding makes RSA-OAEP IND-CCA2 secure under RSA assumption.

---

## 2. Elliptic Curve Cryptography (ECC)

### 2.1 Elliptic Curves

An elliptic curve over $\mathbb{F}_p$ ($p > 3$ prime):
$$E: y^2 = x^3 + ax + b, \quad 4a^3 + 27b^2 \neq 0 \pmod{p}$$

$E(\mathbb{F}_p)$ forms an abelian group under the chord-tangent law.

**Group law:** For $P_1 = (x_1,y_1)$, $P_2 = (x_2,y_2)$:
$$\lambda = \frac{y_2-y_1}{x_2-x_1} \text{ (if $P_1\neq P_2$)}, \quad \lambda = \frac{3x_1^2+a}{2y_1} \text{ (if $P_1=P_2$)}$$
$$x_3 = \lambda^2-x_1-x_2, \quad y_3 = \lambda(x_1-x_3)-y_1$$

**Hasse's theorem:** $|{|}E(\mathbb{F}_p)| - (p+1)| \leq 2\sqrt{p}$

### 2.2 ECDLP and Security

The Elliptic Curve Discrete Logarithm Problem: given $P, Q \in E(\mathbb{F}_p)$, find $k$ s.t. $Q = kP$.

No subexponential algorithm known for general curves (contrast DLP in $\mathbb{F}_p^*$).
Key size of 256 bits achieves ~128-bit security.

### 2.3 ECDSA and ECDH

**ECDH key exchange:** Alice: $(d_A, Q_A = d_AP)$; Bob: $(d_B, Q_B = d_BP)$; shared: $d_A Q_B = d_B Q_A = d_Ad_B P$.

**ECDSA signature:** Hash $e = H(m)$; random $k$; compute $r = (kP)_x \bmod n$, $s = k^{-1}(e+rd) \bmod n$.

### 2.4 Pairing-Based Cryptography

**Weil/Tate pairing:** $e: E[r]\times E[r] \to \mu_r \subset \mathbb{F}_{p^k}^*$ (bilinear).

Applications: IBE (Boneh-Franklin), BLS signatures (short), tripartite Diffie-Hellman.

---

## 3. Lattice-Based Cryptography (Post-Quantum)

### 3.1 Lattice Problems

A lattice $\mathcal{L} = \{B\mathbf{z} : \mathbf{z} \in \mathbb{Z}^n\}$ for $B \in \mathbb{R}^{m\times n}$.

**SVP (Shortest Vector Problem):** Find $\mathbf{v} \in \mathcal{L}$ minimising $\|\mathbf{v}\|$.

**CVP (Closest Vector Problem):** Given $\mathbf{t}$, find $\mathbf{v} \in \mathcal{L}$ minimising $\|\mathbf{t}-\mathbf{v}\|$.

**LWE (Learning With Errors):** Given $(A, b = As + e \bmod q)$, recover $s$, where $e$ is small.
Hardness reducible from worst-case lattice problems (Regev 2005).

**RLWE:** Ring variant: $b = as + e$ in $\mathbb{Z}_q[x]/(x^n+1)$; more efficient.

**NTRU:** Public key $h = f^{-1}g$ in a polynomial ring; encrypt with NTRU lattice.

### 3.2 NIST Post-Quantum Standards

- **CRYSTALS-Kyber (FIPS 203):** KEM based on Module-LWE.
- **CRYSTALS-Dilithium (FIPS 204):** Digital signatures based on Module-LWE.
- **SPHINCS+ (FIPS 205):** Hash-based signatures (no hardness assumptions).
- **FALCON:** Signatures based on NTRU lattices.

---

## 4. Zero-Knowledge Proofs

A ZKP allows a prover to convince a verifier that a statement is true without
revealing any information beyond its truth.

**Properties:**
1. **Completeness:** If true, honest prover convinces verifier
2. **Soundness:** If false, no cheating prover convinces verifier (except with negligible probability)
3. **Zero-knowledge:** Verifier learns nothing except truth of statement

**Sigma protocols:** Three-message (commit, challenge, respond) ZKP.

**Schnorr protocol:** Prove knowledge of DL $x$ s.t. $h = g^x$:
- Commit: $R = g^r$ for random $r$
- Challenge: $c \leftarrow V$
- Respond: $s = r + cx \bmod q$
- Verify: $g^s = R\cdot h^c$

**zk-SNARKs:** Non-interactive ZKP; succinct proof of size $O(1)$, verified in $O(1)$;
requires trusted setup.  Based on bilinear pairings + Groth16 or PLONK.

**zk-STARKs:** Transparent setup, post-quantum; based on FRI (Fast Reed-Solomon IOP).

---

## 5. Cryptographic Hash Functions and PRFs

**Hash function properties:** Collision resistance ($H(x)=H(x')$ hard to find),
preimage resistance, second preimage resistance.

**Random oracle model:** Idealised hash function; security proofs in ROM.

**Merkle-Damgård construction:** Iterates compression function; SHA-1, SHA-2.

**Sponge construction (SHA-3/Keccak):** Absorb + squeeze; security $\min(c/2, n)$ bits.

**Pseudorandom functions (PRF):** $F_k: \{0,1\}^n \to \{0,1\}^m$; computationally
indistinguishable from random function without key $k$.

---

## Subdirectories

| Directory | Content |
|---|---|
| `number_theory/` | Modular arithmetic, primality testing, factoring algorithms |
| `elliptic_curves/` | EC arithmetic, pairings, isogeny-based crypto |
| `lattice/` | LWE, RLWE, NTRU, lattice reduction (LLL, BKZ), Kyber |
| `zero_knowledge/` | Sigma protocols, SNARKs, STARKs, proof systems |
| `post_quantum/` | NIST PQC standards, code-based, multivariate, isogenies |
