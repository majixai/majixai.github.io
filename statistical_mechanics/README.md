# Statistical Mechanics — PhD-Level Reference

## Overview

Statistical mechanics connects microscopic quantum/classical dynamics to macroscopic
thermodynamics via probability theory. This module covers equilibrium and
nonequilibrium statistical mechanics, renormalisation group theory, phase transitions,
and Monte Carlo methods.

---

## 1. Equilibrium Statistical Mechanics

### 1.1 Ensemble Theory

**Microcanonical ensemble:** Fixed $N, V, E$. Entropy $S = k_B\ln\Omega(E)$ where
$\Omega(E)$ counts microstates.

**Canonical ensemble:** Fixed $N, V, T$. Partition function:
$$Z = \text{Tr}\,e^{-\beta\hat{H}} = \sum_n e^{-\beta E_n}$$

Free energy: $F = -k_BT\ln Z$.  Average energy: $\langle E\rangle = -\frac{\partial\ln Z}{\partial\beta}$.

**Grand canonical:** Fixed $\mu, V, T$.  $\mathcal{Z} = \text{Tr}\,e^{-\beta(\hat{H}-\mu\hat{N})}$.
Grand potential: $\Omega = -k_BT\ln\mathcal{Z}$.

### 1.2 Classical Ideal Gas

$$Z = \frac{1}{N!}\left(\frac{V}{\lambda_{th}^3}\right)^N, \quad \lambda_{th} = \sqrt{\frac{2\pi\hbar^2}{mk_BT}}$$

**Sackur–Tetrode equation:**
$$S = Nk_B\left[\ln\frac{V}{N\lambda_{th}^3} + \frac{5}{2}\right]$$

---

## 2. Phase Transitions and Critical Phenomena

### 2.1 Ising Model

$$H = -J\sum_{\langle i,j\rangle}s_is_j - h\sum_i s_i, \quad s_i \in \{-1,+1\}$$

**Mean-field theory:** Replace $s_j \approx m$ (magnetisation):
$$m = \tanh\!\left(\beta(zJm + h)\right)$$

For $h=0$: spontaneous magnetisation below $T_c$ where $\beta_c z J = 1$, so $T_c = zJ/k_B$.

**Exact solution (1D Ising):** $Z = (2\cosh\beta J)^N$ via transfer matrix.

**Exact solution (2D Ising, Onsager 1944):** $T_c/J = 2/\ln(1+\sqrt{2}) \approx 2.269$.

### 2.2 Landau Theory

Near $T_c$, expand free energy in order parameter $\phi$:
$$\mathcal{F}[\phi] = \int d^dx\left[a\phi^2 + b\phi^4 + c|\nabla\phi|^2\right]$$

For $a = a_0(T-T_c)$: second-order transition at $T_c$.  Mean-field exponents:
$\beta=1/2$, $\gamma=1$, $\nu=1/2$, $\eta=0$.

### 2.3 Critical Exponents and Scaling

Near the critical point, with $t = (T-T_c)/T_c$:
- Specific heat: $C \sim |t|^{-\alpha}$
- Order parameter: $m \sim (-t)^\beta$
- Susceptibility: $\chi \sim |t|^{-\gamma}$
- Correlation length: $\xi \sim |t|^{-\nu}$
- Correlation function: $G(r) \sim r^{-(d-2+\eta)}$ at $T_c$

**Scaling relations:** $\alpha + 2\beta + \gamma = 2$ (Rushbrooke); $\gamma = \nu(2-\eta)$ (Fisher)

---

## 3. Renormalisation Group (RG)

### 3.1 Block Spin Transformation (Kadanoff)

Coarse-grain: group spins in blocks of size $b$; rescale.  Fixed points of the
RG flow correspond to phase transitions.

### 3.2 Wilson's Field-Theoretic RG

For a $\phi^4$ theory in $d$ dimensions, integrate out momentum modes $\Lambda/b < k < \Lambda$:

**$\beta$-function:** $\mu\frac{dg}{d\mu} = \beta(g)$ where $g$ is the coupling.

**Fixed points:** $\beta(g^*) = 0$.  IR stable fixed points are universality classes.

**$\varepsilon$-expansion:** In $d = 4-\varepsilon$, to one loop:
$$g^* = \frac{16\pi^2\varepsilon}{3} + O(\varepsilon^2), \quad \eta = \frac{\varepsilon^2}{54} + O(\varepsilon^3)$$

**Universality:** Systems with the same $d$, symmetry group, and order parameter dimension
share critical exponents (same universality class).

---

## 4. Nonequilibrium Statistical Mechanics

### 4.1 Langevin Equation

$$m\ddot{x} = -\gamma\dot{x} + F(x) + \xi(t), \quad \langle\xi(t)\xi(t')\rangle = 2\gamma k_BT\,\delta(t-t')$$

**Fluctuation-dissipation theorem:** The noise strength and friction coefficient are related
by temperature — a deep consequence of time-reversal symmetry.

### 4.2 Green–Kubo Relations

Transport coefficients from time-correlation functions:

$$\eta = \frac{V}{k_BT}\int_0^\infty \langle P_{xy}(0)P_{xy}(t)\rangle\,dt \quad \text{(viscosity)}$$

$$D = \frac{1}{3}\int_0^\infty \langle v(0)\cdot v(t)\rangle\,dt \quad \text{(diffusion)}$$

### 4.3 Jarzynski Equality and Fluctuation Theorems

**Jarzynski equality:** $\langle e^{-\beta W}\rangle = e^{-\beta\Delta F}$

**Crooks fluctuation theorem:** $\frac{P_F(W)}{P_R(-W)} = e^{\beta(W-\Delta F)}$

---

## 5. Monte Carlo Methods

### 5.1 Metropolis Algorithm

Propose state $x' \sim q(x'|x)$; accept with $\alpha = \min(1, p(x')q(x|x')/(p(x)q(x'|x)))$.

**Detailed balance:** $p(x)\pi(x\to x') = p(x')\pi(x'\to x)$ ensures $p$ is stationary.

### 5.2 Cluster Algorithms

**Swendsen–Wang:** At each step, identify clusters of like spins connected with
probability $p_{\text{bond}} = 1 - e^{-2\beta J}$; flip each cluster with probability $1/2$.
Eliminates critical slowing down ($z \approx 0$ vs $z \approx 2$ for Metropolis).

**Wolff algorithm:** Single-cluster variant; more efficient near $T_c$.

### 5.3 Estimating Free Energies

**Wang–Landau algorithm:** Adaptively estimates the density of states $g(E)$:
$g(E) \to g(E)\cdot f$ when state $E$ is visited; histogram flattened by decreasing $\ln f$.

---

## Subdirectories

| Directory | Content |
|---|---|
| `equilibrium/` | Ensembles, partition functions, thermodynamics, quantum statistics |
| `nonequilibrium/` | Langevin, Fokker-Planck, Green-Kubo, fluctuation theorems |
| `renormalization_group/` | Block spin, Wilson RG, ε-expansion, universality classes |
| `phase_transitions/` | Landau theory, Ising, XY, Potts models, topological transitions |
| `monte_carlo/` | Metropolis, cluster algorithms, Wang-Landau, HMC for physics |
