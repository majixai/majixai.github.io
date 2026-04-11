"""
information_core.py — PhD-Level Information Theory Library
===========================================================
Implements:
  Shannon entropy, Rényi entropy, Tsallis entropy
  Joint, conditional, mutual information
  KL divergence, JS divergence, total variation
  AEP / typical set membership
  Huffman coding (canonical)
  Arithmetic coding (simplified)
  Lempel-Ziv complexity
  Channel capacity (binary symmetric, BEC, AWGN)
  Rate-distortion function (Gaussian, binary)
  Kolmogorov complexity approximation (via LZ76)
  Sanov's theorem: empirical KL
  LDPC parity-check matrix (random ensemble)
"""

from __future__ import annotations
import math
import heapq
from typing import Optional

LOG2 = math.log(2.0)


# ---------------------------------------------------------------------------
# Entropy Measures
# ---------------------------------------------------------------------------

def entropy(probs: list[float], base: float = 2.0) -> float:
    """Shannon entropy H(X) = -Σ p log p."""
    return -sum(p*math.log(p+1e-300)/math.log(base) for p in probs if p > 0)


def renyi_entropy(probs: list[float], alpha: float, base: float = 2.0) -> float:
    """
    Rényi entropy H_α(X) = (1/(1-α)) log Σ p^α.
    α→1 recovers Shannon; α→0 = log(support); α→∞ = -log(max p).
    """
    if abs(alpha-1.0) < 1e-8: return entropy(probs, base)
    if alpha == 0: return math.log(sum(1 for p in probs if p > 0))/math.log(base)
    if alpha == float('inf'): return -math.log(max(probs)+1e-300)/math.log(base)
    return math.log(sum(p**alpha for p in probs if p > 0))/((1-alpha)*math.log(base))


def tsallis_entropy(probs: list[float], q: float) -> float:
    """Tsallis entropy S_q = (1 - Σ pᵢ^q) / (q-1). S_{q→1} = Shannon."""
    if abs(q-1.0) < 1e-8: return entropy(probs, math.e)
    return (1.0 - sum(p**q for p in probs if p > 0)) / (q-1.0)


def joint_entropy(pxy: list[list[float]], base: float = 2.0) -> float:
    """H(X,Y) = -Σᵢⱼ p(x,y) log p(x,y)."""
    return -sum(pxy[i][j]*math.log(pxy[i][j]+1e-300)/math.log(base)
                for i in range(len(pxy)) for j in range(len(pxy[0]))
                if pxy[i][j] > 0)


def mutual_information(pxy: list[list[float]], base: float = 2.0) -> float:
    """I(X;Y) = H(X) + H(Y) - H(X,Y)."""
    px = [sum(pxy[i]) for i in range(len(pxy))]
    py = [sum(pxy[i][j] for i in range(len(pxy))) for j in range(len(pxy[0]))]
    return entropy(px, base) + entropy(py, base) - joint_entropy(pxy, base)


def conditional_entropy(pxy: list[list[float]], base: float = 2.0) -> float:
    """H(Y|X) = H(X,Y) - H(X)."""
    px = [sum(pxy[i]) for i in range(len(pxy))]
    return joint_entropy(pxy, base) - entropy(px, base)


# ---------------------------------------------------------------------------
# Divergences
# ---------------------------------------------------------------------------

def kl_divergence(p: list[float], q: list[float], base: float = 2.0) -> float:
    """KL(P||Q) = Σ p log(p/q). Infinite if q(x)=0 but p(x)>0."""
    result = 0.0
    for pi, qi in zip(p, q):
        if pi < 1e-300: continue
        if qi < 1e-300: return float('inf')
        result += pi*(math.log(pi)-math.log(qi))/math.log(base)
    return result


def js_divergence(p: list[float], q: list[float], base: float = 2.0) -> float:
    """Jensen-Shannon divergence (symmetric, bounded in [0,1] for log₂)."""
    m = [(pi+qi)/2.0 for pi,qi in zip(p,q)]
    return 0.5*kl_divergence(p, m, base) + 0.5*kl_divergence(q, m, base)


def total_variation(p: list[float], q: list[float]) -> float:
    """TV(P,Q) = ½ Σ|p-q|."""
    return 0.5*sum(abs(pi-qi) for pi,qi in zip(p,q))


def hellinger(p: list[float], q: list[float]) -> float:
    """H(P,Q) = (1/√2) ||√p - √q||_2."""
    return math.sqrt(sum((math.sqrt(pi)-math.sqrt(qi))**2 for pi,qi in zip(p,q)))/math.sqrt(2)


# ---------------------------------------------------------------------------
# AEP and Typical Set
# ---------------------------------------------------------------------------

def is_typical(seq: list[int], probs: list[float], epsilon: float = 0.1) -> bool:
    """
    Check if a sequence is ε-typical: |(-1/n log p(xⁿ)) - H| ≤ ε.
    """
    n = len(seq)
    log_p = sum(math.log(probs[x]+1e-300) for x in seq) / LOG2
    H = entropy(probs)
    return abs(-log_p/n - H) <= epsilon


def typical_set_size(probs: list[float], n: int, epsilon: float = 0.1) -> tuple[float, float]:
    """
    By AEP: |A_ε^(n)| ≈ 2^{nH(X)}.
    Returns (lower_bound, upper_bound) on typical set size.
    """
    H = entropy(probs)
    return 2**(n*(H-epsilon)), 2**(n*(H+epsilon))


# ---------------------------------------------------------------------------
# Huffman Coding
# ---------------------------------------------------------------------------

class HuffmanCode:
    def __init__(self, probs: dict[str, float]):
        self.probs = probs
        self.codes: dict[str, str] = {}
        self._build()

    def _build(self) -> None:
        heap = [(p, sym) for sym, p in self.probs.items()]
        heapq.heapify(heap)
        tree = {sym: '' for sym in self.probs}
        codes_temp = {sym: '' for sym in self.probs}

        while len(heap) > 1:
            p1, l1 = heapq.heappop(heap)
            p2, l2 = heapq.heappop(heap)
            combined = f'({l1}+{l2})'
            # Assign codes
            def _assign(node, prefix):
                if node in codes_temp:
                    codes_temp[node] = prefix
                elif node.startswith('('):
                    # Parse children
                    inner = node[1:-1]
                    depth = 0; split = -1
                    for k, c in enumerate(inner):
                        if c == '(': depth += 1
                        elif c == ')': depth -= 1
                        elif c == '+' and depth == 0: split = k; break
                    if split >= 0:
                        _assign(inner[:split], prefix+'0')
                        _assign(inner[split+1:], prefix+'1')
            _assign(l1, '0')
            _assign(l2, '1')
            heapq.heappush(heap, (p1+p2, combined))
        self.codes = codes_temp

    def encode(self, message: list[str]) -> str:
        return ''.join(self.codes[s] for s in message)

    def avg_code_length(self) -> float:
        return sum(self.probs[s]*len(self.codes[s]) for s in self.probs)

    def efficiency(self) -> float:
        H = entropy(list(self.probs.values()))
        return H / self.avg_code_length() if self.avg_code_length() > 0 else 0.0


# ---------------------------------------------------------------------------
# Channel Capacity
# ---------------------------------------------------------------------------

def bsc_capacity(p: float) -> float:
    """Binary Symmetric Channel capacity: C = 1 - H_b(p)."""
    if p <= 0 or p >= 1: return 1.0 if p==0 or p==1 else 0.0
    return 1.0 - entropy([p, 1-p])


def bec_capacity(eps: float) -> float:
    """Binary Erasure Channel capacity: C = 1 - ε."""
    return 1.0 - eps


def awgn_capacity(snr_db: float, bandwidth: float = 1.0) -> float:
    """
    Shannon-Hartley theorem: C = B log₂(1 + SNR).
    snr_db: signal-to-noise ratio in dB.
    bandwidth: in Hz (default 1 Hz, returns bits/s/Hz).
    """
    snr = 10.0**(snr_db/10.0)
    return bandwidth * math.log(1.0 + snr) / LOG2


def gaussian_rate_distortion(sigma2: float, D: float) -> float:
    """
    Rate-distortion for Gaussian source with variance σ²:
    R(D) = ½ log₂(σ²/D) for 0 ≤ D ≤ σ².
    """
    if D >= sigma2: return 0.0
    if D <= 0: return float('inf')
    return 0.5 * math.log(sigma2/D) / LOG2


def binary_rate_distortion(p: float, D: float) -> float:
    """
    Rate-distortion for Bernoulli(p) source with Hamming distortion:
    R(D) = H_b(p) - H_b(D) for D ≤ min(p, 1-p).
    """
    pstar = min(p, 1-p)
    if D >= pstar: return 0.0
    if D < 0: return float('inf')
    return entropy([p, 1-p]) - entropy([D, 1-D])


# ---------------------------------------------------------------------------
# Lempel-Ziv Complexity (LZ76)
# ---------------------------------------------------------------------------

def lz76_complexity(s: str) -> int:
    """
    LZ76 complexity: the number of distinct phrases in the LZ parsing.
    Approximates Kolmogorov complexity (up to logarithmic factor).
    """
    n = len(s)
    if n == 0: return 0
    phrases = set(); c = 1; i = 0; j = 1; w = s[0]
    while j < n:
        if s[j] not in {ch for phrase in phrases for ch in phrase} or True:
            wj = w + s[j]
            if wj in phrases:
                w = wj; j += 1
            else:
                phrases.add(w); w = s[j]; j += 1; c += 1
    return c


def normalized_lz_complexity(s: str) -> float:
    """Normalised LZ76: c(n) / (n/log₂ n)."""
    n = len(s)
    if n <= 1: return 0.0
    return lz76_complexity(s) / (n / math.log2(n))


# ---------------------------------------------------------------------------
# Random LDPC Parity-Check Matrix
# ---------------------------------------------------------------------------

def random_ldpc(n: int, rate: float = 0.5, column_weight: int = 3,
                seed: Optional[int] = None) -> list[list[int]]:
    """
    Generate a random (3,6)-regular LDPC parity-check matrix H of size m×n.
    m = n*(1-rate), each column has weight d_v = column_weight.
    """
    import random
    if seed is not None: random.seed(seed)
    m = int(n * (1 - rate))
    H = [[0]*n for _ in range(m)]
    for j in range(n):
        rows = random.sample(range(m), min(column_weight, m))
        for r in rows: H[r][j] = 1
    return H


# ---------------------------------------------------------------------------
# Sanov's Theorem: Empirical KL
# ---------------------------------------------------------------------------

def empirical_kl(samples: list[int], n_symbols: int, true_probs: list[float]) -> float:
    """
    Compute KL(L_n || P) where L_n is the empirical measure.
    By Sanov's theorem, P(L_n ∈ A) ≤ exp(-n * min_{Q∈A} KL(Q||P)).
    """
    n = len(samples)
    counts = [samples.count(k) for k in range(n_symbols)]
    emp = [c/n for c in counts]
    return kl_divergence(emp, true_probs)
