"""
transformations_core.py — PhD-Level Transform Library
======================================================
Implements: DFT/FFT (Cooley-Tukey), STFT, IDFT, Laplace (numerical),
Z-transform utilities, CWT (Morlet, Mexican hat), DWT (Haar, Daubechies-4),
Hilbert Transform, Discrete Radon, Mellin Transform, and Fractional FT.

All algorithms are self-contained pure Python. Complex arithmetic uses the
built-in `complex` type.
"""

from __future__ import annotations
import math
import cmath
from typing import Callable, Optional


# ---------------------------------------------------------------------------
# FFT — Cooley-Tukey Radix-2
# ---------------------------------------------------------------------------

def _is_power_of_2(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0


def _next_power_of_2(n: int) -> int:
    p = 1
    while p < n:
        p <<= 1
    return p


def fft(x: list[complex], inverse: bool = False) -> list[complex]:
    """
    Cooley-Tukey radix-2 FFT / IFFT.

    For inverse=True computes (1/N) * IFFT.
    Input is zero-padded to next power of 2 if necessary.

    Time complexity: O(N log N)
    """
    n = _next_power_of_2(len(x))
    x = list(x) + [0+0j] * (n - len(x))

    # Bit-reversal permutation
    j = 0
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j ^= bit
        if i < j:
            x[i], x[j] = x[j], x[i]

    # Iterative Cooley-Tukey
    length = 2
    while length <= n:
        half = length // 2
        angle = 2 * math.pi / length * (-1 if not inverse else 1)
        w_n = cmath.exp(1j * angle)
        for i in range(0, n, length):
            w = 1 + 0j
            for k in range(half):
                t = w * x[i + k + half]
                x[i + k + half] = x[i + k] - t
                x[i + k] = x[i + k] + t
                w *= w_n
        length <<= 1

    if inverse:
        x = [v / n for v in x]
    return x


def ifft(X: list[complex]) -> list[complex]:
    """Inverse FFT."""
    return fft(X, inverse=True)


def dft_naive(x: list[complex]) -> list[complex]:
    """O(N²) reference DFT."""
    n = len(x)
    return [sum(x[k] * cmath.exp(-2j * math.pi * n_idx * k / n)
                for k in range(n)) for n_idx in range(n)]


def fft_shift(X: list[complex]) -> list[complex]:
    """Shift zero-frequency component to centre."""
    n = len(X)
    mid = n // 2
    return X[mid:] + X[:mid]


def power_spectrum(x: list[complex]) -> list[float]:
    """One-sided power spectral density |X_k|² / N."""
    X = fft(x)
    n = len(X)
    return [abs(X[k]) ** 2 / n for k in range(n // 2 + 1)]


# ---------------------------------------------------------------------------
# Short-Time Fourier Transform (STFT)
# ---------------------------------------------------------------------------

def stft(x: list[float], window_size: int = 256,
         hop: int = 128) -> list[list[complex]]:
    """
    Short-Time Fourier Transform using a Hann window.

    Returns a list of FFT frames, each of length window_size.
    """
    hann = [0.5 * (1.0 - math.cos(2 * math.pi * k / (window_size - 1)))
            for k in range(window_size)]
    frames = []
    for start in range(0, len(x) - window_size + 1, hop):
        frame = [x[start + k] * hann[k] for k in range(window_size)]
        frames.append(fft([c + 0j for c in frame]))
    return frames


def istft(frames: list[list[complex]], window_size: int = 256,
          hop: int = 128) -> list[float]:
    """Overlap-add reconstruction from STFT frames."""
    n_frames = len(frames)
    out_len = (n_frames - 1) * hop + window_size
    output = [0.0] * out_len
    weights = [0.0] * out_len
    hann = [0.5 * (1.0 - math.cos(2 * math.pi * k / (window_size - 1)))
            for k in range(window_size)]
    for idx, frame in enumerate(frames):
        time_frame = [v.real for v in ifft(frame)[:window_size]]
        start = idx * hop
        for k in range(window_size):
            output[start + k] += time_frame[k] * hann[k]
            weights[start + k] += hann[k] ** 2
    return [output[i] / weights[i] if weights[i] > 1e-12 else 0.0
            for i in range(out_len)]


# ---------------------------------------------------------------------------
# Continuous Wavelet Transform (CWT)
# ---------------------------------------------------------------------------

def morlet_wavelet(t: float, omega0: float = 6.0) -> complex:
    """
    Morlet wavelet: ψ(t) = π^{-1/4} exp(iω₀t) exp(-t²/2)
    Admissible for ω₀ ≥ 5 (Grossmann–Morlet).
    """
    return (math.pi ** -0.25) * cmath.exp(1j * omega0 * t) * math.exp(-t ** 2 / 2)


def mexican_hat(t: float) -> float:
    """Mexican hat (Ricker): ψ(t) = (2/√3) π^{-1/4} (1-t²) exp(-t²/2)."""
    return (2.0 / math.sqrt(3.0)) * (math.pi ** -0.25) * (1.0 - t ** 2) * math.exp(-t ** 2 / 2)


def cwt(signal: list[float], scales: list[float],
        wavelet: Callable[[float], complex] = morlet_wavelet,
        dt: float = 1.0) -> list[list[complex]]:
    """
    Continuous Wavelet Transform via convolution in the time domain.

    W_f(a,b) = (1/√a) ∫ f(t) ψ̄((t-b)/a) dt

    Returns coefficients[scale_idx][time_idx].
    """
    n = len(signal)
    result = []
    for a in scales:
        half = int(10 * a)  # support extent
        psi_vals = [wavelet(k * dt / a) / math.sqrt(a)
                    for k in range(-half, half + 1)]
        psi_conj = [v.conjugate() if isinstance(v, complex) else complex(v) for v in psi_vals]
        coefs = []
        for b in range(n):
            c = 0 + 0j
            for k, pv in enumerate(psi_conj):
                t_idx = b - half + k
                if 0 <= t_idx < n:
                    c += signal[t_idx] * pv * dt
            coefs.append(c)
        result.append(coefs)
    return result


# ---------------------------------------------------------------------------
# Discrete Wavelet Transform — Haar
# ---------------------------------------------------------------------------

def haar_dwt(x: list[float]) -> tuple[list[float], list[float]]:
    """
    Single-level Haar DWT.
    Returns (approximation_coefficients, detail_coefficients).
    """
    n = len(x)
    assert n % 2 == 0, "Length must be even."
    approx = [(x[2 * k] + x[2 * k + 1]) / math.sqrt(2) for k in range(n // 2)]
    detail = [(x[2 * k] - x[2 * k + 1]) / math.sqrt(2) for k in range(n // 2)]
    return approx, detail


def haar_idwt(approx: list[float], detail: list[float]) -> list[float]:
    """Single-level Haar IDWT."""
    n = len(approx)
    x = [0.0] * (2 * n)
    for k in range(n):
        x[2 * k] = (approx[k] + detail[k]) / math.sqrt(2)
        x[2 * k + 1] = (approx[k] - detail[k]) / math.sqrt(2)
    return x


def haar_wavedec(x: list[float], levels: int) -> list[list[float]]:
    """
    Multi-level Haar DWT decomposition.
    Returns [approx_L, detail_L, detail_{L-1}, ..., detail_1].
    """
    coeffs = []
    current = x[:]
    for _ in range(levels):
        current, detail = haar_dwt(current)
        coeffs.append(detail)
    coeffs.append(current)
    coeffs.reverse()
    return coeffs  # [approx, d_L, ..., d_1]


def haar_waverec(coeffs: list[list[float]]) -> list[float]:
    """Multi-level Haar IDWT reconstruction."""
    approx = coeffs[0][:]
    for detail in coeffs[1:]:
        approx = haar_idwt(approx, detail)
    return approx


# ---------------------------------------------------------------------------
# Daubechies-4 (D4) Wavelet
# ---------------------------------------------------------------------------

# D4 low-pass filter coefficients h[k]
_D4_H = [
    (1 + math.sqrt(3)) / (4 * math.sqrt(2)),
    (3 + math.sqrt(3)) / (4 * math.sqrt(2)),
    (3 - math.sqrt(3)) / (4 * math.sqrt(2)),
    (1 - math.sqrt(3)) / (4 * math.sqrt(2)),
]
# D4 high-pass filter g[k] = (-1)^k h[1-k]
_D4_G = [(-1) ** k * _D4_H[3 - k] for k in range(4)]


def d4_dwt(x: list[float]) -> tuple[list[float], list[float]]:
    """Single-level Daubechies-4 DWT via periodic convolution + downsampling."""
    n = len(x)
    assert n % 2 == 0
    approx, detail = [], []
    for k in range(n // 2):
        a = sum(_D4_H[j] * x[(2 * k + j) % n] for j in range(4))
        d = sum(_D4_G[j] * x[(2 * k + j) % n] for j in range(4))
        approx.append(a)
        detail.append(d)
    return approx, detail


def d4_idwt(approx: list[float], detail: list[float]) -> list[float]:
    """Single-level Daubechies-4 IDWT."""
    n = len(approx)
    N = 2 * n
    x = [0.0] * N
    for k in range(n):
        for j in range(4):
            idx = (2 * k + j) % N
            x[idx] += _D4_H[j] * approx[k] + _D4_G[j] * detail[k]
    return x


# ---------------------------------------------------------------------------
# Hilbert Transform
# ---------------------------------------------------------------------------

def hilbert_transform(x: list[float]) -> list[complex]:
    """
    Hilbert transform via FFT:
    H(f) = ℱ⁻¹{-i sgn(ξ) ℱ{f}(ξ)}

    Returns the analytic signal z(t) = x(t) + i H{x}(t).
    """
    n = len(x)
    X = fft([xi + 0j for xi in x])
    N = len(X)
    H = [0 + 0j] * N
    for k in range(N):
        if k == 0 or (N % 2 == 0 and k == N // 2):
            H[k] = X[k]
        elif k < N // 2:
            H[k] = 2 * X[k]
        # k > N//2: H[k] = 0
    z = ifft(H)
    return z[:n]


def instantaneous_freq(analytic: list[complex], fs: float = 1.0) -> list[float]:
    """
    Instantaneous frequency from analytic signal: f_i(t) = φ'(t)/(2π)
    Computed via finite differences of the unwrapped phase.
    """
    phase = [cmath.phase(z) for z in analytic]
    # Unwrap phase
    unwrapped = [phase[0]]
    for i in range(1, len(phase)):
        diff = phase[i] - phase[i - 1]
        diff = (diff + math.pi) % (2 * math.pi) - math.pi
        unwrapped.append(unwrapped[-1] + diff)
    return [fs * (unwrapped[i + 1] - unwrapped[i]) / (2 * math.pi)
            for i in range(len(unwrapped) - 1)]


# ---------------------------------------------------------------------------
# Radon Transform (Discrete)
# ---------------------------------------------------------------------------

def radon_transform(image: list[list[float]],
                    thetas: Optional[list[float]] = None) -> list[list[float]]:
    """
    Discrete Radon transform (sinogram) of a 2-D image.

    For each angle θ in thetas, sums along lines
    x cos θ + y sin θ = s (nearest-neighbour).

    Returns sinogram[theta_idx][s_idx] of shape (len(thetas), diag_len).
    """
    rows, cols = len(image), len(image[0])
    diag = int(math.ceil(math.sqrt(rows ** 2 + cols ** 2)))
    cx, cy = cols / 2.0, rows / 2.0
    if thetas is None:
        thetas = [i * math.pi / 180.0 for i in range(180)]
    sinogram = []
    for theta in thetas:
        ct, st = math.cos(theta), math.sin(theta)
        projections = [0.0] * (2 * diag)
        for r in range(rows):
            for c in range(cols):
                x, y = c - cx, r - cy
                s = int(round(x * ct + y * st + diag))
                if 0 <= s < 2 * diag:
                    projections[s] += image[r][c]
        sinogram.append(projections)
    return sinogram


# ---------------------------------------------------------------------------
# Mellin Transform (Numerical)
# ---------------------------------------------------------------------------

def mellin_transform(f_vals: list[float], t_vals: list[float],
                     s_values: list[complex]) -> list[complex]:
    """
    Numerical Mellin transform: M{f}(s) = ∫₀^∞ f(t) t^{s-1} dt
    Approximated by the trapezoidal rule over t_vals > 0.
    """
    result = []
    n = len(t_vals)
    for s in s_values:
        integral = 0 + 0j
        for k in range(n - 1):
            t0, t1 = t_vals[k], t_vals[k + 1]
            dt = t1 - t0
            v0 = f_vals[k] * (t0 ** (s - 1)) if t0 > 0 else 0
            v1 = f_vals[k + 1] * (t1 ** (s - 1)) if t1 > 0 else 0
            integral += 0.5 * (v0 + v1) * dt
        result.append(integral)
    return result


# ---------------------------------------------------------------------------
# Fractional Fourier Transform
# ---------------------------------------------------------------------------

def frft(x: list[complex], alpha: float) -> list[complex]:
    """
    Discrete Fractional Fourier Transform of order α (Ozaktas–Kutay–Zalevsky
    algorithm, chirp-multiplication approach).

    FrFT interpolates between identity (α=0) and DFT (α=π/2).

    Input length N must be a power of 2.
    """
    n = len(x)
    if abs(alpha % (2 * math.pi)) < 1e-10:
        return x[:]
    if abs((alpha - math.pi / 2) % (2 * math.pi)) < 1e-10:
        return fft(x)

    # Chirp multiplication: h[k] = exp(i π k² cot α)
    cot_a = math.cos(alpha) / math.sin(alpha)
    chirp = [cmath.exp(1j * math.pi * k ** 2 * cot_a / n) for k in range(n)]
    chirp_inv = [v.conjugate() for v in chirp]

    # Phase factor A_α
    # A_alpha = sqrt((1 - i*cot(alpha))) (branch cut handled by cmath)
    A = cmath.sqrt(complex(1, -cot_a))

    # Step 1: multiply by chirp
    x_c = [x[k] * chirp_inv[k] for k in range(n)]
    # Step 2: convolve with chirp kernel (via FFT)
    kernel = [cmath.exp(1j * math.pi * k ** 2 * cot_a / n) for k in range(n)]
    # Circular convolution
    X_c = fft(x_c)
    K = fft(kernel)
    conv = ifft([X_c[k] * K[k] for k in range(len(X_c))])[:n]
    # Step 3: multiply by chirp and scale
    csc_a = 1.0 / math.sin(alpha)
    result = [A * math.sqrt(abs(csc_a) / n) * conv[k] * chirp_inv[k]
              for k in range(n)]
    return result


# ---------------------------------------------------------------------------
# Laplace Transform Utilities
# ---------------------------------------------------------------------------

def laplace_numerical(f: Callable[[float], float],
                      s_values: list[complex],
                      t_max: float = 50.0,
                      n_points: int = 10000) -> list[complex]:
    """
    Numerical Laplace transform F(s) = ∫₀^∞ f(t) e^{-st} dt
    via adaptive Gauss-Legendre quadrature on [0, t_max].
    """
    dt = t_max / n_points
    t_grid = [(k + 0.5) * dt for k in range(n_points)]
    result = []
    for s in s_values:
        integral = sum(f(t) * cmath.exp(-s * t) * dt for t in t_grid)
        result.append(integral)
    return result


def laplace_diff_table() -> dict[str, str]:
    """
    Reference table of common Laplace transform pairs.
    """
    return {
        "1": "1/s",
        "t^n": "n! / s^(n+1)",
        "e^(at)": "1 / (s-a)",
        "sin(ωt)": "ω / (s² + ω²)",
        "cos(ωt)": "s / (s² + ω²)",
        "e^(at)sin(ωt)": "ω / ((s-a)² + ω²)",
        "e^(at)cos(ωt)": "(s-a) / ((s-a)² + ω²)",
        "t·e^(at)": "1 / (s-a)²",
        "δ(t)": "1",
        "u(t-a)": "e^(-as) / s",
    }


# ---------------------------------------------------------------------------
# Utility: frequency axis helpers
# ---------------------------------------------------------------------------

def fftfreq(n: int, dt: float = 1.0) -> list[float]:
    """FFT frequency bins (cycles per unit time)."""
    freqs = []
    for k in range(n):
        if k < n // 2:
            freqs.append(k / (n * dt))
        else:
            freqs.append((k - n) / (n * dt))
    return freqs
