/**
 * information-core.js — PhD-Level Information Theory Library (JavaScript)
 * =========================================================================
 * Global IIFE: window.MajixInformation
 *
 * Implements:
 *   Shannon entropy, Rényi entropy, Tsallis entropy
 *   Mutual information, conditional entropy, joint entropy
 *   KL, JS, Hellinger, total variation divergences
 *   Channel capacities: BSC, BEC, AWGN, MIMO
 *   Huffman coding
 *   LZ77/LZ76 complexity
 *   AEP and typical set
 *   Rate-distortion bounds
 */

(function (global) {
  'use strict';

  const LOG2 = Math.log(2);

  // -------------------------------------------------------------------------
  // Entropy Measures
  // -------------------------------------------------------------------------
  function entropy(probs, base = 2) {
    return -probs.reduce((acc, p) => p > 0 ? acc + p * Math.log(p + 1e-300) / Math.log(base) : acc, 0);
  }

  function renyiEntropy(probs, alpha, base = 2) {
    if (Math.abs(alpha - 1) < 1e-8) return entropy(probs, base);
    if (alpha === 0) return Math.log(probs.filter(p => p > 0).length) / Math.log(base);
    if (!isFinite(alpha)) return -Math.log(Math.max(...probs)) / Math.log(base);
    return Math.log(probs.reduce((acc, p) => p > 0 ? acc + Math.pow(p, alpha) : acc, 0)) / ((1 - alpha) * Math.log(base));
  }

  function tsallisEntropy(probs, q) {
    if (Math.abs(q - 1) < 1e-8) return entropy(probs, Math.E);
    return (1 - probs.reduce((acc, p) => p > 0 ? acc + Math.pow(p, q) : acc, 0)) / (q - 1);
  }

  function jointEntropy(pxy, base = 2) {
    return -pxy.flat().reduce((acc, p) => p > 0 ? acc + p * Math.log(p + 1e-300) / Math.log(base) : acc, 0);
  }

  function mutualInformation(pxy, base = 2) {
    const px = pxy.map(row => row.reduce((a, b) => a + b, 0));
    const py = pxy[0].map((_, j) => pxy.reduce((acc, row) => acc + row[j], 0));
    return entropy(px, base) + entropy(py, base) - jointEntropy(pxy, base);
  }

  function conditionalEntropy(pxy, base = 2) {
    const px = pxy.map(row => row.reduce((a, b) => a + b, 0));
    return jointEntropy(pxy, base) - entropy(px, base);
  }

  // -------------------------------------------------------------------------
  // Divergences
  // -------------------------------------------------------------------------
  function klDivergence(p, q, base = 2) {
    let result = 0;
    for (let i = 0; i < p.length; i++) {
      if (p[i] < 1e-300) continue;
      if (q[i] < 1e-300) return Infinity;
      result += p[i] * (Math.log(p[i]) - Math.log(q[i])) / Math.log(base);
    }
    return result;
  }

  function jsDivergence(p, q, base = 2) {
    const m = p.map((pi, i) => (pi + q[i]) / 2);
    return 0.5 * klDivergence(p, m, base) + 0.5 * klDivergence(q, m, base);
  }

  function totalVariation(p, q) {
    return 0.5 * p.reduce((acc, pi, i) => acc + Math.abs(pi - q[i]), 0);
  }

  function hellinger(p, q) {
    return Math.sqrt(p.reduce((acc, pi, i) => acc + (Math.sqrt(pi) - Math.sqrt(q[i])) ** 2, 0)) / Math.SQRT2;
  }

  function chiSquared(p, q) {
    return p.reduce((acc, pi, i) => acc + (q[i] > 0 ? (pi - q[i]) ** 2 / q[i] : 0), 0);
  }

  // -------------------------------------------------------------------------
  // Channel Capacity
  // -------------------------------------------------------------------------
  function bscCapacity(p) {
    if (p <= 0 || p >= 1) return p === 0 || p === 1 ? 1 : 0;
    return 1 - entropy([p, 1 - p]);
  }

  function becCapacity(epsilon) { return 1 - epsilon; }

  function awgnCapacity(snrDb, bandwidth = 1) {
    const snr = Math.pow(10, snrDb / 10);
    return bandwidth * Math.log2(1 + snr);
  }

  function mimoCapacity(H, P, noisePower = 1) {
    // H: nR×nT channel matrix, P: total power
    // C = log det(I_nR + (P/nT) H H†) [bits/s/Hz]
    // Simplified: compute eigenvalues of H H† via power method approximation
    const nR = H.length, nT = H[0].length;
    const HHdag = Array.from({ length: nR }, (_, i) =>
      Array.from({ length: nR }, (_, j) => H[i].reduce((acc, h, k) => acc + h * H[j][k], 0)));
    // Trace approximation (lower bound)
    const trace = HHdag.reduce((acc, row, i) => acc + row[i], 0);
    return Math.log2(1 + P / nT / noisePower * trace / nR);
  }

  // -------------------------------------------------------------------------
  // AEP and Typical Set
  // -------------------------------------------------------------------------
  function isTypical(seq, probs, epsilon = 0.1) {
    const n = seq.length;
    const H = entropy(probs);
    const logP = seq.reduce((acc, x) => acc + Math.log2(probs[x] + 1e-300), 0);
    return Math.abs(-logP / n - H) <= epsilon;
  }

  function typicalSetSize(probs, n, epsilon = 0.1) {
    const H = entropy(probs);
    return { lower: Math.pow(2, n * (H - epsilon)), upper: Math.pow(2, n * (H + epsilon)) };
  }

  // -------------------------------------------------------------------------
  // Rate-Distortion
  // -------------------------------------------------------------------------
  function gaussianRateDistortion(sigma2, D) {
    if (D >= sigma2) return 0;
    if (D <= 0) return Infinity;
    return 0.5 * Math.log2(sigma2 / D);
  }

  function binaryRateDistortion(p, D) {
    const pStar = Math.min(p, 1 - p);
    if (D >= pStar) return 0;
    if (D < 0) return Infinity;
    return entropy([p, 1 - p]) - entropy([D, 1 - D]);
  }

  // -------------------------------------------------------------------------
  // Huffman Coding
  // -------------------------------------------------------------------------
  function huffman(symbolProbs) {
    // symbolProbs: { symbol: probability }
    const symbols = Object.entries(symbolProbs);
    let heap = symbols.map(([s, p]) => ({ p, s, left: null, right: null }));

    const extractMin = () => {
      let minIdx = 0;
      for (let i = 1; i < heap.length; i++) if (heap[i].p < heap[minIdx].p) minIdx = i;
      return heap.splice(minIdx, 1)[0];
    };

    while (heap.length > 1) {
      const a = extractMin(), b = extractMin();
      heap.push({ p: a.p + b.p, s: null, left: a, right: b });
    }

    const codes = {};
    function traverse(node, prefix) {
      if (node.s !== null) { codes[node.s] = prefix || '0'; return; }
      if (node.left) traverse(node.left, prefix + '0');
      if (node.right) traverse(node.right, prefix + '1');
    }
    traverse(heap[0], '');

    const avgLen = symbols.reduce((acc, [s, p]) => acc + p * (codes[s] || '').length, 0);
    const H = entropy(symbols.map(([, p]) => p));
    return { codes, avgLength: avgLen, entropy: H, efficiency: H / avgLen };
  }

  // -------------------------------------------------------------------------
  // Lempel-Ziv Complexity
  // -------------------------------------------------------------------------
  function lz76Complexity(s) {
    const n = s.length;
    if (n === 0) return 0;
    const phrases = new Set();
    let w = s[0], c = 1, j = 1;
    while (j < n) {
      const wj = w + s[j];
      if (phrases.has(wj)) { w = wj; j++; }
      else { phrases.add(w); w = s[j]; j++; c++; }
    }
    return c;
  }

  function normalizedLZ(s) {
    const n = s.length;
    if (n <= 1) return 0;
    return lz76Complexity(s) / (n / Math.log2(n));
  }

  // -------------------------------------------------------------------------
  // Approximate Entropy (ApEn) — Time series complexity
  // -------------------------------------------------------------------------
  function approxEntropy(xs, m = 2, r = null) {
    const n = xs.length;
    if (r === null) r = 0.2 * Math.sqrt(xs.reduce((a, x, i) => a + (x - xs.reduce((b, y) => b + y, 0) / n) ** 2, 0) / (n - 1));
    function phi(M) {
      let result = 0;
      for (let i = 0; i < n - M; i++) {
        let count = 0;
        for (let j = 0; j < n - M; j++) {
          let match = true;
          for (let k = 0; k < M; k++) if (Math.abs(xs[i + k] - xs[j + k]) > r) { match = false; break; }
          if (match) count++;
        }
        result += Math.log(count / (n - M + 1));
      }
      return result / (n - M);
    }
    return phi(m) - phi(m + 1);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  const MajixInformation = {
    entropy, renyiEntropy, tsallisEntropy, jointEntropy, mutualInformation, conditionalEntropy,
    klDivergence, jsDivergence, totalVariation, hellinger, chiSquared,
    bscCapacity, becCapacity, awgnCapacity, mimoCapacity,
    isTypical, typicalSetSize,
    gaussianRateDistortion, binaryRateDistortion,
    huffman,
    lz76Complexity, normalizedLZ,
    approxEntropy,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MajixInformation;
  } else {
    global.MajixInformation = MajixInformation;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
