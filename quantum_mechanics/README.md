# Quantum Mechanics — PhD-Level Reference

## Overview

Quantum mechanics describes physical reality at atomic and sub-atomic scales.
This module covers the mathematical formalism, quantum field theory, path integrals,
quantum information theory, many-body physics, and topological phases.

---

## 1. Mathematical Foundations

### 1.1 Hilbert Space Formalism (Dirac Notation)

**Postulates:**
1. State: $|\psi\rangle \in \mathcal{H}$ (unit vector in a complex Hilbert space)
2. Observables: self-adjoint operators $\hat{A} = \hat{A}^\dagger$
3. Measurement: eigenvalues $a_n$ with probabilities $P(a_n) = |\langle a_n|\psi\rangle|^2$
4. Collapse: state → $|a_n\rangle$ after measuring $a_n$
5. Evolution: $i\hbar\frac{d}{dt}|\psi\rangle = \hat{H}|\psi\rangle$ (Schrödinger equation)

**Canonical commutation relations:** $[\hat{x},\hat{p}] = i\hbar$

**Uncertainty principle (Robertson):** $\Delta A \cdot \Delta B \geq \frac{1}{2}|\langle[\hat{A},\hat{B}]\rangle|$

### 1.2 Schrödinger, Heisenberg, and Interaction Pictures

| Picture | State | Operator |
|---|---|---|
| Schrödinger | $|\psi(t)\rangle = U(t)|\psi_0\rangle$ | Time-independent |
| Heisenberg | Time-independent | $A(t) = U^\dagger(t)AU(t)$ |
| Interaction | $|\psi_I(t)\rangle = U_0^\dagger(t)|\psi_S(t)\rangle$ | $A_I(t) = U_0^\dagger A U_0$ |

**Heisenberg equation:** $\frac{dA}{dt} = \frac{i}{\hbar}[H,A] + \frac{\partial A}{\partial t}$

---

## 2. Harmonic Oscillator and Ladder Operators

$$\hat{H} = \hbar\omega\left(\hat{a}^\dagger\hat{a} + \frac{1}{2}\right)$$

$\hat{a}|n\rangle = \sqrt{n}|n-1\rangle$, $\hat{a}^\dagger|n\rangle = \sqrt{n+1}|n+1\rangle$

**Coherent states:** $\hat{a}|\alpha\rangle = \alpha|\alpha\rangle$,
$|\alpha\rangle = e^{-|\alpha|^2/2}\sum_n \frac{\alpha^n}{\sqrt{n!}}|n\rangle$

---

## 3. Perturbation Theory

### 3.1 Time-Independent Perturbation

$\hat{H} = \hat{H}_0 + \lambda\hat{V}$; expanding $E_n = E_n^{(0)} + \lambda E_n^{(1)} + \lambda^2 E_n^{(2)} + \cdots$:

$$E_n^{(1)} = \langle n^{(0)}|\hat{V}|n^{(0)}\rangle$$
$$E_n^{(2)} = \sum_{m\neq n}\frac{|\langle m^{(0)}|\hat{V}|n^{(0)}\rangle|^2}{E_n^{(0)}-E_m^{(0)}}$$

### 3.2 Time-Dependent Perturbation (Fermi's Golden Rule)

Transition rate from $|i\rangle$ to $|f\rangle$:
$$\Gamma_{i\to f} = \frac{2\pi}{\hbar}|\langle f|\hat{V}|i\rangle|^2\rho(E_f)$$

---

## 4. Quantum Field Theory

### 4.1 Second Quantisation

Replace wavefunctions by field operators. For bosons:
$$\hat{\phi}(\mathbf{x}) = \int\frac{d^3k}{(2\pi)^3}\frac{1}{\sqrt{2\omega_k}}\left(\hat{a}_k e^{i\mathbf{k}\cdot\mathbf{x}} + \hat{a}_k^\dagger e^{-i\mathbf{k}\cdot\mathbf{x}}\right)$$

**Klein–Gordon equation:** $(\Box + m^2)\phi = 0$, $\Box = \partial_\mu\partial^\mu$

**Dirac equation:** $(i\gamma^\mu\partial_\mu - m)\psi = 0$, $\{\gamma^\mu,\gamma^\nu\} = 2g^{\mu\nu}$

### 4.2 Path Integrals (Feynman)

Transition amplitude:
$$\langle x_f, t_f | x_i, t_i\rangle = \int \mathcal{D}[x(t)]\, e^{iS[x]/\hbar}$$

where $S[x] = \int_{t_i}^{t_f} L(x,\dot{x})\,dt$ is the classical action.

**Partition function:** $Z = \int\mathcal{D}[\phi]\, e^{-S_E[\phi]}$ (Euclidean, $t\to -i\tau$)

**Feynman rules:** Perturbative expansion of $Z$ in Feynman diagrams; propagators
$\sim 1/(k^2+m^2)$; vertices from $\mathcal{L}_{int}$.

---

## 5. Quantum Information and Computation

### 5.1 Qubits and Entanglement

**Qubit:** $|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$, $|\alpha|^2+|\beta|^2 = 1$

**Bell states (maximally entangled):**
$$|\Phi^\pm\rangle = \frac{|00\rangle\pm|11\rangle}{\sqrt{2}}, \quad |\Psi^\pm\rangle = \frac{|01\rangle\pm|10\rangle}{\sqrt{2}}$$

**Schmidt decomposition:** $|\psi\rangle = \sum_i\sqrt{\lambda_i}|\phi_i\rangle|\chi_i\rangle$ where $\lambda_i$ are
the Schmidt coefficients (eigenvalues of the reduced density matrix).

### 5.2 Quantum Channels and Density Matrices

**Density matrix:** $\rho = \sum_i p_i|\psi_i\rangle\langle\psi_i|$ ($\rho \succeq 0$, $\text{tr}\rho = 1$)

**Von Neumann entropy:** $S(\rho) = -\text{tr}(\rho\log\rho)$

**Kraus operators (quantum channel):** $\mathcal{E}(\rho) = \sum_k K_k\rho K_k^\dagger$, $\sum_k K_k^\dagger K_k = I$

### 5.3 Quantum Gates and Algorithms

**Universal gates:** $\{H, T, \text{CNOT}\}$ or $\{H, S, T, \text{CNOT}\}$

**Grover's algorithm:** Quadratic speedup for unstructured search: $O(\sqrt{N})$ vs $O(N)$

**Shor's algorithm:** Factoring in $O((\log N)^3)$ using quantum Fourier transform and
order-finding.

**Quantum error correction:** CSS codes, surface codes; threshold theorem:
fault-tolerant computation if error rate $p < p_{\text{threshold}} \approx 10^{-2}$.

---

## 6. Many-Body Physics and Topological Phases

### 6.1 Second Quantisation for Many-Body

Hamiltonian: $\hat{H} = \sum_{ij} t_{ij} \hat{c}_i^\dagger\hat{c}_j + \frac{1}{2}\sum_{ijkl}V_{ijkl}\hat{c}_i^\dagger\hat{c}_j^\dagger\hat{c}_l\hat{c}_k$

**Hubbard model:** $\hat{H} = -t\sum_{\langle i,j\rangle,\sigma}\hat{c}_{i\sigma}^\dagger\hat{c}_{j\sigma} + U\sum_i\hat{n}_{i\uparrow}\hat{n}_{i\downarrow}$

### 6.2 Topological Phases

**Berry phase:** $\gamma_n = i\oint \langle n(\mathbf{k})|\nabla_\mathbf{k}|n(\mathbf{k})\rangle\cdot d\mathbf{k}$

**Chern number:** $C_n = \frac{1}{2\pi}\int_{BZ} \Omega_n(\mathbf{k})\,d^2k$

where $\Omega_n$ is the Berry curvature.  Integer-valued, topological invariant.

**Bulk-boundary correspondence:** Non-zero Chern number implies existence of protected
edge/surface states (quantum Hall effect, topological insulators).

---

## Subdirectories

| Directory | Content |
|---|---|
| `foundations/` | Hilbert space formalism, measurement theory, interpretations |
| `field_theory/` | QED, QCD, Standard Model, renormalisation, anomalies |
| `path_integrals/` | Feynman path integral, instantons, WKB, semiclassical |
| `quantum_information/` | Qubits, entanglement, channels, QEC, complexity |
| `many_body/` | Hubbard model, BCS theory, Kondo effect, tensor networks |
| `topological/` | Berry phase, Chern insulators, Kitaev chain, anyons, TQFT |
