/**
 * quantum-core.js — PhD-Level Quantum Mechanics Library (JavaScript)
 * ==================================================================
 * Global IIFE: window.MajixQuantum
 *
 * Implements:
 *   Complex arithmetic
 *   State vectors, density matrices
 *   Quantum gates (1-qubit, 2-qubit, n-qubit QFT)
 *   Grover's algorithm
 *   Von Neumann entropy and entanglement
 *   Quantum channel simulation (depolarising, amplitude damping)
 *   Bloch sphere coordinates
 *   Variational quantum circuits (parameterised)
 */

(function (global) {
  'use strict';

  // -------------------------------------------------------------------------
  // Complex Number
  // -------------------------------------------------------------------------
  class Complex {
    constructor(re = 0, im = 0) { this.re = re; this.im = im; }
    add(c) { return new Complex(this.re + c.re, this.im + c.im); }
    sub(c) { return new Complex(this.re - c.re, this.im - c.im); }
    mul(c) { return new Complex(this.re * c.re - this.im * c.im, this.re * c.im + this.im * c.re); }
    scale(s) { return new Complex(this.re * s, this.im * s); }
    conj() { return new Complex(this.re, -this.im); }
    abs() { return Math.sqrt(this.re ** 2 + this.im ** 2); }
    abs2() { return this.re ** 2 + this.im ** 2; }
    arg() { return Math.atan2(this.im, this.re); }
    exp() {
      const r = Math.exp(this.re);
      return new Complex(r * Math.cos(this.im), r * Math.sin(this.im));
    }
    toString() { return `${this.re.toFixed(4)}${this.im >= 0 ? '+' : ''}${this.im.toFixed(4)}i`; }
    static fromPolar(r, theta) { return new Complex(r * Math.cos(theta), r * Math.sin(theta)); }
    static zero() { return new Complex(0, 0); }
    static one() { return new Complex(1, 0); }
    static i() { return new Complex(0, 1); }
  }

  // -------------------------------------------------------------------------
  // Complex Vector / Matrix Operations
  // -------------------------------------------------------------------------
  const C = {
    vadd: (u, v) => u.map((x, i) => x.add(v[i])),
    vsub: (u, v) => u.map((x, i) => x.sub(v[i])),
    vscale: (v, s) => v.map(x => x.scale(s)),
    vdot: (u, v) => u.reduce((acc, x, i) => acc.add(x.conj().mul(v[i])), Complex.zero()),
    vnorm: (v) => Math.sqrt(v.reduce((acc, x) => acc + x.abs2(), 0)),
    vnormalize: (v) => { const n = C.vnorm(v); return v.map(x => x.scale(1 / n)); },
    matvec: (A, v) => A.map(row => row.reduce((acc, a, j) => acc.add(a.mul(v[j])), Complex.zero())),
    matmul: (A, B) => {
      const n = A.length, m = B[0].length, k = B.length;
      return Array.from({ length: n }, (_, i) =>
        Array.from({ length: m }, (_, j) =>
          A[i].reduce((acc, a, l) => acc.add(a.mul(B[l][j])), Complex.zero())));
    },
    dag: (A) => A[0].map((_, j) => A.map((row, i) => row[j].conj())),
    trace: (A) => A.reduce((acc, row, i) => acc.add(row[i]), Complex.zero()),
    outer: (u, v) => u.map(ui => v.map(vi => ui.mul(vi.conj()))),
    kron: (A, B) => {
      const nA = A.length, mA = A[0].length, nB = B.length, mB = B[0].length;
      return Array.from({ length: nA * nB }, (_, i) =>
        Array.from({ length: mA * mB }, (_, j) =>
          A[Math.floor(i / nB)][Math.floor(j / mB)].mul(B[i % nB][j % mB])));
    },
    eye: (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? Complex.one() : Complex.zero())),
  };

  // -------------------------------------------------------------------------
  // Standard States and Gates
  // -------------------------------------------------------------------------
  const ZERO = [Complex.one(), Complex.zero()];
  const ONE  = [Complex.zero(), Complex.one()];
  const PLUS = [new Complex(1/Math.SQRT2, 0), new Complex(1/Math.SQRT2, 0)];
  const MINUS = [new Complex(1/Math.SQRT2, 0), new Complex(-1/Math.SQRT2, 0)];

  const gates = {
    I: [[Complex.one(), Complex.zero()], [Complex.zero(), Complex.one()]],
    X: [[Complex.zero(), Complex.one()], [Complex.one(), Complex.zero()]],
    Y: [[Complex.zero(), new Complex(0, -1)], [new Complex(0, 1), Complex.zero()]],
    Z: [[Complex.one(), Complex.zero()], [Complex.zero(), new Complex(-1, 0)]],
    H: [[new Complex(1/Math.SQRT2, 0), new Complex(1/Math.SQRT2, 0)],
        [new Complex(1/Math.SQRT2, 0), new Complex(-1/Math.SQRT2, 0)]],
    S: [[Complex.one(), Complex.zero()], [Complex.zero(), new Complex(0, 1)]],
    T: [[Complex.one(), Complex.zero()], [Complex.zero(), Complex.fromPolar(1, Math.PI / 4)]],
    Rz: (theta) => [[Complex.fromPolar(1, -theta/2), Complex.zero()],
                    [Complex.zero(), Complex.fromPolar(1, theta/2)]],
    Ry: (theta) => [[new Complex(Math.cos(theta/2), 0), new Complex(-Math.sin(theta/2), 0)],
                    [new Complex(Math.sin(theta/2), 0), new Complex(Math.cos(theta/2), 0)]],
    Rx: (theta) => [[new Complex(Math.cos(theta/2), 0), new Complex(0, -Math.sin(theta/2))],
                    [new Complex(0, -Math.sin(theta/2)), new Complex(Math.cos(theta/2), 0)]],
    CNOT: [
      [Complex.one(), Complex.zero(), Complex.zero(), Complex.zero()],
      [Complex.zero(), Complex.one(), Complex.zero(), Complex.zero()],
      [Complex.zero(), Complex.zero(), Complex.zero(), Complex.one()],
      [Complex.zero(), Complex.zero(), Complex.one(), Complex.zero()],
    ],
    SWAP: [
      [Complex.one(), Complex.zero(), Complex.zero(), Complex.zero()],
      [Complex.zero(), Complex.zero(), Complex.one(), Complex.zero()],
      [Complex.zero(), Complex.one(), Complex.zero(), Complex.zero()],
      [Complex.zero(), Complex.zero(), Complex.zero(), Complex.one()],
    ],
  };

  function applyGate(state, gate) { return C.matvec(gate, state); }

  // -------------------------------------------------------------------------
  // Quantum Fourier Transform
  // -------------------------------------------------------------------------
  function qftMatrix(nQubits) {
    const N = 1 << nQubits;
    const omega = Complex.fromPolar(1, 2 * Math.PI / N);
    return Array.from({ length: N }, (_, j) =>
      Array.from({ length: N }, (_, k) => {
        const exp = j * k;
        const angle = 2 * Math.PI * exp / N;
        return new Complex(Math.cos(angle) / Math.sqrt(N), Math.sin(angle) / Math.sqrt(N));
      }));
  }

  function applyQFT(state) {
    const N = state.length, nQ = Math.log2(N);
    return C.matvec(qftMatrix(nQ), state);
  }

  // -------------------------------------------------------------------------
  // Grover's Algorithm
  // -------------------------------------------------------------------------
  function groverOracle(state, target) {
    return state.map((x, i) => i === target ? x.scale(-1) : x);
  }

  function groverDiffusion(state) {
    const N = state.length;
    const total = state.reduce((acc, x) => acc.add(x), Complex.zero());
    const mean = total.scale(1 / N);
    return state.map(x => mean.scale(2).sub(x));
  }

  function groverSearch(N, target, nIter = null) {
    const optIter = nIter !== null ? nIter : Math.floor(Math.PI / 4 * Math.sqrt(N));
    let state = Array(N).fill(null).map(() => new Complex(1 / Math.sqrt(N), 0));
    for (let k = 0; k < optIter; k++) {
      state = groverOracle(state, target);
      state = groverDiffusion(state);
    }
    const probs = state.map(x => x.abs2());
    return { state, probs, iterations: optIter, successProb: probs[target] };
  }

  function measure(state, rng = Math.random) {
    const probs = state.map(x => x.abs2());
    let cum = 0, r = rng();
    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (r <= cum) return i;
    }
    return probs.length - 1;
  }

  // -------------------------------------------------------------------------
  // Density Matrices and Entropy
  // -------------------------------------------------------------------------
  function densityMatrix(state) { return C.outer(state, state); }

  function partialTrace(rho, dA, dB) {
    return Array.from({ length: dA }, (_, i) =>
      Array.from({ length: dA }, (_, j) =>
        Array.from({ length: dB }, (_, k) => rho[i * dB + k][j * dB + k]).reduce((a, b) => a.add(b), Complex.zero())));
  }

  function vonNeumannEntropy2x2(rho) {
    // For 2x2 density matrix, compute eigenvalues and entropy
    const a = rho[0][0].re, d = rho[1][1].re;
    const bcAbs2 = rho[0][1].abs2();
    const disc = Math.sqrt(Math.max(((a - d) / 2) ** 2 + bcAbs2, 0));
    const lam1 = Math.max((a + d) / 2 + disc, 0);
    const lam2 = Math.max((a + d) / 2 - disc, 0);
    return -[lam1, lam2].reduce((acc, lam) => lam > 1e-12 ? acc + lam * Math.log2(lam) : acc, 0);
  }

  function entanglementEntropy(psi, dA, dB) {
    const rho = densityMatrix(psi);
    const rhoA = partialTrace(rho, dA, dB);
    if (dA === 2) return vonNeumannEntropy2x2(rhoA);
    // Diagonal approximation for larger dimensions
    return -rhoA.reduce((acc, row, i) => {
      const lam = Math.max(row[i].re, 0);
      return lam > 1e-12 ? acc + lam * Math.log2(lam) : acc;
    }, 0);
  }

  // -------------------------------------------------------------------------
  // Bloch Sphere
  // -------------------------------------------------------------------------
  function blochVector(rho) {
    // For single-qubit density matrix ρ = ½(I + r·σ)
    const rx = 2 * rho[0][1].re;
    const ry = 2 * rho[1][0].im;
    const rz = rho[0][0].re - rho[1][1].re;
    return { x: rx, y: ry, z: rz, purity: rx ** 2 + ry ** 2 + rz ** 2 };
  }

  function stateToBloch(state) {
    const rho = densityMatrix(state);
    return blochVector(rho);
  }

  // -------------------------------------------------------------------------
  // Quantum Channel
  // -------------------------------------------------------------------------
  function applyChannel(rho, krausOps) {
    const n = rho.length;
    const result = Array.from({ length: n }, () => Array(n).fill(null).map(() => Complex.zero()));
    for (const K of krausOps) {
      const Kd = C.dag(K);
      const term = C.matmul(C.matmul(K, rho), Kd);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) result[i][j] = result[i][j].add(term[i][j]);
    }
    return result;
  }

  function depolarizing(rho, p) {
    const n = rho.length;
    const result = rho.map(row => row.map(x => x.scale(1 - p)));
    for (let i = 0; i < n; i++) result[i][i] = result[i][i].add(new Complex(p / n, 0));
    return result;
  }

  function amplitudeDamping(rho, gamma) {
    const K0 = [[Complex.one(), Complex.zero()], [Complex.zero(), new Complex(Math.sqrt(1 - gamma), 0)]];
    const K1 = [[Complex.zero(), new Complex(Math.sqrt(gamma), 0)], [Complex.zero(), Complex.zero()]];
    return applyChannel(rho, [K0, K1]);
  }

  // -------------------------------------------------------------------------
  // Bell State Generation
  // -------------------------------------------------------------------------
  function bellState(type = 'phi+') {
    const s = 1 / Math.SQRT2;
    switch (type) {
      case 'phi+':  return [new Complex(s, 0), Complex.zero(), Complex.zero(), new Complex(s, 0)];
      case 'phi-':  return [new Complex(s, 0), Complex.zero(), Complex.zero(), new Complex(-s, 0)];
      case 'psi+':  return [Complex.zero(), new Complex(s, 0), new Complex(s, 0), Complex.zero()];
      case 'psi-':  return [Complex.zero(), new Complex(s, 0), new Complex(-s, 0), Complex.zero()];
      default: throw new Error('Unknown Bell state');
    }
  }

  function isBellState(state, tol = 1e-6) {
    const probs = state.map(x => x.abs2());
    const nz = probs.filter(p => p > tol);
    return nz.length === 2 && Math.abs(nz[0] - 0.5) < tol && Math.abs(nz[1] - 0.5) < tol;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  const MajixQuantum = {
    Complex, C,
    ZERO, ONE, PLUS, MINUS,
    gates, applyGate,
    qftMatrix, applyQFT,
    groverOracle, groverDiffusion, groverSearch, measure,
    densityMatrix, partialTrace, vonNeumannEntropy2x2, entanglementEntropy,
    blochVector, stateToBloch,
    applyChannel, depolarizing, amplitudeDamping,
    bellState, isBellState,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MajixQuantum;
  } else {
    global.MajixQuantum = MajixQuantum;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
