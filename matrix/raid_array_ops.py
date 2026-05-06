"""
raid_array_ops.py — Matrix / Array Operations for Raid Statistics
==================================================================
Mathematical snippet extracted from the Session Raid Stats indicator.

Covers the 1-D array operations that underpin the indicator's statistical
accumulation engine:
  - Bucket-count vector initialisation and incremental update
  - Reverse-cumulative (suffix) sum
  - Probability normalisation (row-stochastic scaling)
  - Transition matrix between successive observation windows (for streaming updates)
  - Rank/argmax utilities

No external dependencies — pure Python 3.
"""

from __future__ import annotations

import math
from typing import List, Tuple, Optional


# ---------------------------------------------------------------------------
# 1. Bucket-count vector
# ---------------------------------------------------------------------------

def new_count_vector(n: int) -> List[int]:
    """Return a zero-initialised integer count vector of length n."""
    return [0] * n


def increment_bucket(counts: List[int], bucket: int) -> List[int]:
    """
    Increment the count at `bucket` (in-place) and return the vector.

    Args:
        counts: Mutable count vector.
        bucket: 0-based bucket index.

    Returns:
        The same (modified) counts list.
    """
    counts[bucket] += 1
    return counts


def add_count_vectors(a: List[int], b: List[int]) -> List[int]:
    """Element-wise addition of two count vectors of equal length."""
    return [x + y for x, y in zip(a, b)]


def scale_count_vector(counts: List[int], factor: float) -> List[float]:
    """Scale each element by factor (produces float vector)."""
    return [c * factor for c in counts]


# ---------------------------------------------------------------------------
# 2. Reverse-cumulative sum (suffix sum)
# ---------------------------------------------------------------------------

def suffix_sum(v: List[int]) -> List[int]:
    """
    Compute the suffix (reverse-cumulative) sum.

        out[i] = sum(v[i:])

    This equals the *survival function* of the discrete distribution defined
    by v when v is normalised to a PMF.

    Complexity: O(n).

    Args:
        v: Input vector of non-negative integers.

    Returns:
        Suffix-sum vector of the same length.
    """
    n   = len(v)
    out = [0] * n
    acc = 0
    for i in range(n - 1, -1, -1):
        acc   += v[i]
        out[i] = acc
    return out


def prefix_sum(v: List[int]) -> List[int]:
    """
    Compute the prefix (forward-cumulative) sum.

        out[i] = sum(v[:i+1])

    This is the standard CDF of the discrete distribution.
    """
    n   = len(v)
    out = [0] * n
    acc = 0
    for i in range(n):
        acc   += v[i]
        out[i] = acc
    return out


# ---------------------------------------------------------------------------
# 3. Probability normalisation
# ---------------------------------------------------------------------------

def to_prob_vector(counts: List[int], total: Optional[int] = None) -> List[float]:
    """
    Normalise a count vector to a probability mass function (PMF).

        p[i] = counts[i] / total

    Args:
        counts: Raw bucket counts.
        total:  Normalising constant (defaults to sum(counts)).

    Returns:
        PMF vector summing to 1.0 (or all zeros if total == 0).
    """
    if total is None:
        total = sum(counts)
    if total == 0:
        return [0.0] * len(counts)
    return [c / total for c in counts]


def to_percent_vector(counts: List[int], total: int) -> List[float]:
    """Like to_prob_vector but scaled to [0, 100]."""
    if total == 0:
        return [0.0] * len(counts)
    return [c / total * 100.0 for c in counts]


def survival_probs(counts: List[int], total: int) -> List[float]:
    """
    Compute survival-function probabilities (%).

        S[i] = P(X >= bucket_i) = suffix_sum(counts)[i] / total * 100

    These are the values displayed in the indicator's statistics table.

    Args:
        counts: Per-bucket hit counts.
        total:  Total number of sessions (denominator).

    Returns:
        Survival-function values in [0, 100].
    """
    suf = suffix_sum(counts)
    return to_percent_vector(suf, total)


# ---------------------------------------------------------------------------
# 4. Incremental streaming update
# ---------------------------------------------------------------------------

def update_survival_cache(
    counts: List[int],
    new_bucket: int,
    day_count: int,
    cache: List[float],
) -> Tuple[List[int], List[float]]:
    """
    Incrementally update the survival-probability cache when a new raid
    observation arrives.

    This avoids recomputing the full suffix sum from scratch by exploiting
    the linearity of the update:

        new_cache[i] = (old_cache[i] * (day_count - 1) / 100 + indicator(new_bucket >= i))
                       / day_count * 100

    Args:
        counts:     Current bucket counts (updated in-place).
        new_bucket: The bucket index of the newly confirmed raid.
        day_count:  New total session count (after incrementing).
        cache:      Current survival-probability cache (updated in-place).

    Returns:
        (counts, cache) — both updated in-place and returned.
    """
    counts[new_bucket] += 1
    n = len(cache)
    for i in range(n):
        # Number of hits at level >= i before update
        prev_hits = cache[i] * (day_count - 1) / 100.0
        # Add 1 if the new observation reaches level i or beyond
        new_hits  = prev_hits + (1.0 if new_bucket <= i else 0.0)
        cache[i]  = new_hits / day_count * 100.0
    return counts, cache


# ---------------------------------------------------------------------------
# 5. Running statistics (mean and variance of bucket index)
# ---------------------------------------------------------------------------

def running_mean_var(values: List[int]) -> Tuple[float, float]:
    """
    Compute the mean and (unbiased) variance of a list of bucket indices
    using Welford's online algorithm.

    Provides a compact characterisation of the raid-size distribution:
    a low mean indicates raids concentrate in small buckets (short raids),
    a high variance indicates a wide spread across levels.

    Returns:
        (mean, variance) — variance = 0 if fewer than 2 samples.
    """
    n = m = s = 0
    for x in values:
        n += 1
        delta = x - m
        m    += delta / n
        s    += delta * (x - m)
    if n < 2:
        return float(m), 0.0
    return m, s / (n - 1)


# ---------------------------------------------------------------------------
# 6. Argmax and rank utilities
# ---------------------------------------------------------------------------

def argmax(v: list) -> int:
    """Return the 0-based index of the maximum element."""
    best_i = 0
    for i in range(1, len(v)):
        if v[i] > v[best_i]:
            best_i = i
    return best_i


def rank_vector(v: list) -> List[int]:
    """
    Return the rank of each element (0 = largest).

    Ties are broken by original index (stable sort).
    """
    indexed = sorted(enumerate(v), key=lambda x: -x[1])
    ranks   = [0] * len(v)
    for rank, (orig_i, _) in enumerate(indexed):
        ranks[orig_i] = rank
    return ranks


# ---------------------------------------------------------------------------
# 7. Element-wise maximum (useful for combining hi/lo distributions)
# ---------------------------------------------------------------------------

def element_max(a: List[float], b: List[float]) -> List[float]:
    """Element-wise maximum of two vectors of equal length."""
    return [max(x, y) for x, y in zip(a, b)]


def element_min(a: List[float], b: List[float]) -> List[float]:
    """Element-wise minimum."""
    return [min(x, y) for x, y in zip(a, b)]


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Simulate 10 days of bucket observations
    import random; random.seed(0)
    BC = 7
    counts = new_count_vector(BC)
    bucket_obs = [random.randint(0, BC - 1) for _ in range(10)]

    for b in bucket_obs:
        increment_bucket(counts, b)

    print("counts       :", counts)
    print("suffix_sum   :", suffix_sum(counts))
    print("prefix_sum   :", prefix_sum(counts))
    print("survival (%) :", [f"{p:.1f}" for p in survival_probs(counts, 10)])
    print("argmax bucket:", argmax(counts))
    print("ranks        :", rank_vector(counts))

    mean, var = running_mean_var(bucket_obs)
    print(f"mean bucket  : {mean:.2f}")
    print(f"variance     : {var:.2f}")
