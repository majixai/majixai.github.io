# PhD-Level Mathematical Sciences Index

This repository contains a comprehensive library of PhD-level mathematics, physics,
and computer science. Each directory contains:

- `README.md` — theoretical overview with full mathematical notation
- `*_core.py` — pure-Python implementation (no external dependencies)
- `*-core.js` — browser/Node.js JavaScript implementation (global IIFE)
- Sub-directories for major topics

---

## Directory Map

### 🔢 Pure Mathematics

| Directory | Topics |
|---|---|
| [`/calculus/`](calculus/README.md) | Multivariable, vector, differential forms, exterior calculus, complex, fractional, CoV |
| [`/measure_theory/`](measure_theory/README.md) | Lebesgue, Lp spaces, ergodic, geometric measure, Hausdorff |
| [`/functional_analysis/`](functional_analysis/README.md) | Banach/Hilbert spaces, operators, spectral theory, distributions, RKHS |
| [`/algebra/`](algebra/README.md) | Lie algebras, representation theory, commutative, homological, Galois |
| [`/topology/`](topology/README.md) | Algebraic, differential, knot theory, persistent homology |
| [`/manifolds/`](manifolds/README.md) | Riemannian, symplectic, fiber bundles, connections, characteristic classes |
| [`/category_theory/`](category_theory/README.md) | Categories, functors, adjunctions, topos, ∞-categories |

### 📊 Applied Mathematics and Statistics

| Directory | Topics |
|---|---|
| [`/regression/`](regression/README.md) | OLS, GLS, ridge, LASSO, Bayesian, GP, survival, multivariate |
| [`/bayes/`](bayes/README.md) | MH, HMC, NUTS, Gibbs, VI, WAIC, Dirichlet process |
| [`/differential_equations/`](differential_equations/README.md) | RK45, Adams, implicit, SDE (EM/Milstein), PDE (FD/CN), BVP, fractional, DDE |
| [`/transformations/`](transformations/README.md) | Fourier, Laplace, Z, Wavelet, Hilbert, Radon, Mellin, fractional |
| [`/matrix/`](matrix/README.md) | SVD, QR, Cholesky, spectral, random matrices, Kronecker, matrix functions |
| [`/optimization/`](optimization/README.md) | GD/Nesterov/Adam/BFGS/L-BFGS, ADMM/LASSO, SA, DE, SDP, optimal control |
| [`/probability/`](probability/README.md) | Processes, martingales, large deviations, EVT, QMC, IS |
| [`/numerical_methods/`](numerical_methods/README.md) | CG, GMRES, root finding, spline, Richardson, GL quadrature, FD/FEM, Chebyshev |
| [`/calculus/`](calculus/README.md) | Multivariable, differential forms, complex analysis, fractional calculus |

### ⚛️ Physics

| Directory | Topics |
|---|---|
| [`/quantum_mechanics/`](quantum_mechanics/README.md) | States/gates, QFT, Grover, perturbation theory, channels, entanglement |
| [`/statistical_mechanics/`](statistical_mechanics/README.md) | Ensembles, Ising, Landau, RG, Langevin, Monte Carlo |

### 💻 Computer Science

| Directory | Topics |
|---|---|
| [`/information_theory/`](information_theory/README.md) | Entropy, channel capacity, coding, Kolmogorov, quantum IT |
| [`/complexity_theory/`](complexity_theory/README.md) | P/NP/PH, circuits, communication, PCP, FPT, approximation |
| [`/cryptography/`](cryptography/README.md) | RSA, ECC, LWE/RLWE, ZK proofs, post-quantum NIST standards |

---

## Implementation Standards

### Python (`*_core.py`)
- **Zero external dependencies** — pure Python stdlib
- Self-contained linear algebra (Gaussian elimination, Cholesky)
- Type-annotated, docstring with math

### JavaScript (`*-core.js`)
- **Global IIFE** pattern: `window.MajixXxx`
- Follows project convention (`no ES modules`)
- Works in browser and Node.js

---

## Mathematical Notation Conventions

| Symbol | Meaning |
|---|---|
| $\hat{\boldsymbol{\beta}}$ | Estimated parameter vector |
| $\mathcal{L}(\theta)$ | Log-likelihood |
| $\nabla f$, $\nabla^2 f$ | Gradient, Hessian |
| $\mathcal{O}$, $o$, $\Theta$ | Big-O, little-o, Theta asymptotics |
| $\mathbb{E}[X]$, $\text{Var}[X]$ | Expectation, variance |
| $\mathcal{N}(\mu, \sigma^2)$ | Normal distribution |
| $\text{tr}(\mathbf{A})$, $\det(\mathbf{A})$ | Trace, determinant |
| $\otimes$ | Kronecker/tensor product |
| $\langle\cdot,\cdot\rangle$ | Inner product |
| $\|\cdot\|_p$ | p-norm |
| $\rightarrow_p$, $\rightarrow_d$ | Convergence in probability, distribution |
| $\sim$, $\propto$ | Distributed as, proportional to |
