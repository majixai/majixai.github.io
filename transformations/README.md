# Transformations — PhD-Level Reference

## Overview

Integral and unitary transforms form the backbone of harmonic analysis, signal
processing, partial differential equations, and quantum mechanics.  This module
covers classical and modern transform theories to research depth.

---

## 1. Fourier Transform

### 1.1 Continuous Fourier Transform

For $f \in L^1(\mathbb{R}^n)$:
$$(\mathcal{F}f)(\boldsymbol{\xi}) = \hat{f}(\boldsymbol{\xi})
  = \int_{\mathbb{R}^n} f(\mathbf{x})\, e^{-2\pi i \boldsymbol{\xi}\cdot\mathbf{x}}\, d\mathbf{x}$$

**Inversion** (when $\hat{f} \in L^1$):
$$f(\mathbf{x}) = \int_{\mathbb{R}^n} \hat{f}(\boldsymbol{\xi})\, e^{2\pi i \boldsymbol{\xi}\cdot\mathbf{x}}\, d\boldsymbol{\xi}$$

**Extension to $L^2$** (Plancherel): $\mathcal{F}: L^2(\mathbb{R}^n) \to L^2(\mathbb{R}^n)$
is a unitary isometry:
$$\|\hat{f}\|_{L^2} = \|f\|_{L^2} \quad \text{(Parseval–Plancherel theorem)}$$

**Convolution theorem:** $\widehat{f * g} = \hat{f}\cdot\hat{g}$

**Uncertainty principle (Heisenberg):**
$$\|x f(x)\|_{L^2} \cdot \|\xi \hat{f}(\xi)\|_{L^2} \geq \frac{1}{4\pi}\|f\|_{L^2}^2$$

### 1.2 Discrete Fourier Transform (DFT)

For $\mathbf{x} \in \mathbb{C}^N$:
$$X_k = \sum_{n=0}^{N-1} x_n\, \omega_N^{nk}, \quad \omega_N = e^{-2\pi i/N}$$

The DFT matrix $\mathbf{F}_N$ with entries $(\mathbf{F}_N)_{kn} = \omega_N^{kn}/\sqrt{N}$
is unitary.

**Cooley–Tukey FFT** reduces $O(N^2)$ DFT to $O(N\log N)$ by the butterfly
decomposition exploiting the periodicity $\omega_N^{k+N/2} = -\omega_N^k$.

---

## 2. Laplace Transform

For $f : [0,\infty) \to \mathbb{C}$ of exponential order $\alpha$:
$$\mathcal{L}\{f\}(s) = F(s) = \int_0^\infty f(t)\, e^{-st}\, dt, \quad \operatorname{Re}(s) > \alpha$$

**Key properties:**

| Property | Formula |
|---|---|
| Linearity | $\mathcal{L}\{af+bg\} = aF+bG$ |
| Differentiation | $\mathcal{L}\{f^{(n)}\}(s) = s^n F(s) - \sum_{k=0}^{n-1} s^{n-1-k} f^{(k)}(0^+)$ |
| Integration | $\mathcal{L}\!\left\{\int_0^t f(\tau)\,d\tau\right\} = F(s)/s$ |
| Convolution | $\mathcal{L}\{f*g\} = F(s)G(s)$ |
| Initial value | $\lim_{t\to 0^+} f(t) = \lim_{s\to\infty} sF(s)$ |
| Final value | $\lim_{t\to\infty} f(t) = \lim_{s\to 0} sF(s)$ (poles in LHP) |

**Bromwich inversion integral:**
$$f(t) = \frac{1}{2\pi i}\int_{\gamma-i\infty}^{\gamma+i\infty} F(s)\, e^{st}\, ds$$

---

## 3. Z-Transform

For a sequence $\{x[n]\}_{n=-\infty}^\infty$:
$$\mathcal{Z}\{x[n]\}(z) = X(z) = \sum_{n=-\infty}^{\infty} x[n]\, z^{-n}$$

The region of convergence (ROC) is an annulus $r_1 < |z| < r_2$.

**Inverse Z-transform** (contour integral in ROC):
$$x[n] = \frac{1}{2\pi i}\oint_C X(z)\, z^{n-1}\, dz$$

Relationship to DTFT: $X(e^{i\omega}) = X(z)\big|_{z=e^{i\omega}}$ (unit circle
must lie in ROC).

---

## 4. Wavelet Transform

### 4.1 Continuous Wavelet Transform (CWT)

Given mother wavelet $\psi \in L^2(\mathbb{R})$ with $\int \psi = 0$:
$$\mathcal{W}_f(a,b) = \frac{1}{\sqrt{|a|}}\int_{-\infty}^\infty f(t)\,\overline{\psi\!\left(\frac{t-b}{a}\right)}\,dt$$

**Admissibility condition** $C_\psi = \int_0^\infty \frac{|\hat{\psi}(\omega)|^2}{\omega}\,d\omega < \infty$
ensures exact reconstruction:
$$f(t) = \frac{1}{C_\psi}\int_{-\infty}^\infty\int_{-\infty}^\infty
  \mathcal{W}_f(a,b)\psi_{a,b}(t)\frac{da\,db}{a^2}$$

### 4.2 Discrete Wavelet Transform (DWT)

Mallat's multi-resolution analysis (MRA): a nested chain of closed subspaces
$\cdots \subset V_{-1} \subset V_0 \subset V_1 \subset \cdots$, with scaling
function $\phi$ and wavelet $\psi$ related by the two-scale equations:
$$\phi(t) = \sqrt{2}\sum_k h[k]\phi(2t-k), \quad \psi(t) = \sqrt{2}\sum_k g[k]\phi(2t-k)$$

where $g[k] = (-1)^k h[1-k]$ (quadrature mirror filter).

Daubechies wavelets $D_N$ achieve $N$ vanishing moments with compact support of
length $2N-1$.

---

## 5. Hilbert Transform

$$(\mathcal{H}f)(t) = \text{p.v.}\frac{1}{\pi}\int_{-\infty}^\infty \frac{f(\tau)}{t-\tau}\,d\tau$$

Equivalent to: $\widehat{\mathcal{H}f}(\xi) = -i\,\text{sgn}(\xi)\,\hat{f}(\xi)$.

**Analytic signal:** $f_A(t) = f(t) + i(\mathcal{H}f)(t) = A(t)e^{i\phi(t)}$

where $A(t) = |f_A(t)|$ is the instantaneous amplitude and $\phi(t) = \arg f_A(t)$
the instantaneous phase. The instantaneous frequency is $\omega(t) = \phi'(t)/(2\pi)$.

---

## 6. Radon Transform

$$(\mathcal{R}f)(s,\theta) = \int_{-\infty}^\infty f(s\cos\theta - t\sin\theta,\, s\sin\theta + t\cos\theta)\,dt$$

i.e., the integral of $f$ over the line $\{x : x_1\cos\theta + x_2\sin\theta = s\}$.

**Filtered back-projection (FBP) inversion:**
$$f(x,y) = \int_0^\pi (\mathcal{R}f \ast h)(\mathbf{x}\cdot\boldsymbol{\theta},\theta)\,d\theta$$

where $h$ is the ramp filter $\hat{h}(\xi) = |\xi|$. Forms the mathematical
basis of CT reconstruction.

---

## 7. Mellin Transform

$$\mathcal{M}\{f\}(s) = \int_0^\infty f(t)\, t^{s-1}\, dt$$

Relates to the Fourier transform via $\mathcal{M}\{f\}(s) = \mathcal{F}\{f(e^t)\}(-s/2\pi i)$.
Useful for multiplicative convolutions and scale-invariant problems.

---

## 8. Fractional Fourier Transform

The fractional FT of order $\alpha$ interpolates between identity ($\alpha=0$)
and the ordinary FT ($\alpha=\pi/2$):
$$\mathcal{F}^\alpha\{f\}(u) = \int_{-\infty}^\infty K_\alpha(u,t) f(t)\, dt$$

Kernel:
$$K_\alpha(u,t) = A_\alpha \exp\!\left(i\pi(u^2\cot\alpha - 2ut\csc\alpha + t^2\cot\alpha)\right)$$

where $A_\alpha = \sqrt{1-i\cot\alpha}$.  Forms a unitary group on $L^2(\mathbb{R})$:
$\mathcal{F}^{\alpha+\beta} = \mathcal{F}^\alpha\mathcal{F}^\beta$.

---

## Subdirectories

| Directory | Content |
|---|---|
| `fourier/` | DFT, FFT, STFT, multi-dimensional FT, non-uniform FFT |
| `laplace/` | One-sided and two-sided Laplace, bilateral, Z-transform duality |
| `z_transform/` | Causal/anti-causal, ROC, partial fractions, transfer functions |
| `wavelet/` | CWT, DWT, MRA, Daubechies, biorthogonal, curvelet, shearlet |
| `hilbert/` | Analytic signal, instantaneous frequency, envelope detection |
| `radon/` | FBP, fan-beam CT, Hough transform |
| `mellin/` | Scale-invariant analysis, multiplicative convolution |
| `fractional/` | Fractional FT, fractional calculus operators |
| `geometric/` | Affine, projective, spherical harmonic transforms |
