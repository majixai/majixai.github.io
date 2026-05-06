"""
session_raid_buckets.py — Probability / Session Raid Bucket Distribution
=========================================================================
Mathematical snippet extracted from the Session Raid Stats indicator.

Covers:
  - Arithmetic level-sequence generation
  - Piecewise bucket classification (f_bucketIndex)
  - Reverse-cumulative sum (survival function of a discrete distribution)
  - Empirical Cumulative Distribution Function (ECDF) estimation over sessions

This module is self-contained and has no external dependencies.
"""

from __future__ import annotations

from typing import List, Tuple


# ---------------------------------------------------------------------------
# Level sequence (arithmetic progression)
# ---------------------------------------------------------------------------

def level_sequence(start: float, step: float, n: int = 6) -> List[float]:
    """
    Generate n equally-spaced threshold levels beginning at `start`.

    Level k (1-indexed):  L_k = start + (k-1) * step
    These correspond to the range-extension levels in the Pine Script indicator.

    Args:
        start: The first level in points beyond the range boundary.
        step:  Distance between consecutive levels.
        n:     Number of levels (default 6).

    Returns:
        List of n threshold values [L_1, ..., L_n].
    """
    return [start + i * step for i in range(n)]


# ---------------------------------------------------------------------------
# Bucket classification
# ---------------------------------------------------------------------------

def bucket_index(value: float, levels: List[float], overflow_step: float) -> int:
    """
    Classify a positive value into one of len(levels)+1 buckets.

    Bucket layout (0-based):
      bucket 0:         value < levels[1]
      bucket 1:  levels[1] <= value < levels[2]
      ...
      bucket n-2: levels[n-2] <= value < levels[n-1]
      bucket n-1: levels[n-1] <= value < levels[n-1] + overflow_step
      bucket n  : value >= levels[n-1] + overflow_step   (overflow)

    The overflow_step is typically equal to the level step so the final
    named bucket has the same width as all others.

    Args:
        value:         The raw measurement to classify (e.g. raid size in pts).
        levels:        Sorted list of n threshold values.
        overflow_step: Width of the last named bucket.

    Returns:
        0-based integer bucket index.
    """
    n = len(levels)
    for i in range(n - 1):
        if value < levels[i + 1]:
            return i
    if value < levels[-1] + overflow_step:
        return n - 1
    return n  # overflow


# ---------------------------------------------------------------------------
# Reverse-cumulative sum (survival function)
# ---------------------------------------------------------------------------

def cumulative_counts(counts: List[int]) -> List[int]:
    """
    Compute the reverse-cumulative (suffix) sum of a count array.

    cum[i] = sum(counts[i:])

    This gives the number of observations that reached *at least* bucket i,
    i.e. the empirical survival function of the discrete distribution.

    Complexity: O(n) time and space.

    Args:
        counts: Raw per-bucket counts (non-negative integers).

    Returns:
        Suffix-sum array of the same length.
    """
    n   = len(counts)
    cum = [0] * n
    running = 0
    for i in range(n - 1, -1, -1):
        running += counts[i]
        cum[i] = running
    return cum


# ---------------------------------------------------------------------------
# ECDF probability cache
# ---------------------------------------------------------------------------

def update_prob_cache(
    hi_counts: List[int],
    lo_counts: List[int],
    day_count: int,
) -> Tuple[List[float], List[float]]:
    """
    Estimate the probability (%) of reaching *at least* each level.

    Uses the empirical cumulative distribution function (ECDF):

        P̂(X ≥ level_i) = #{sessions where raid reached level_i or beyond} / N * 100

    where N = day_count (total sessions observed).

    Args:
        hi_counts: Per-bucket counts for high-side raids.
        lo_counts: Per-bucket counts for low-side raids.
        day_count: Total number of historical sessions.

    Returns:
        (prob_hi, prob_lo): Two lists of reach-probabilities in [0, 100].
    """
    if day_count <= 0:
        n = len(hi_counts)
        return [0.0] * n, [0.0] * n

    cum_h = cumulative_counts(hi_counts)
    cum_l = cumulative_counts(lo_counts)
    prob_hi = [c / day_count * 100.0 for c in cum_h]
    prob_lo = [c / day_count * 100.0 for c in cum_l]
    return prob_hi, prob_lo


# ---------------------------------------------------------------------------
# Marginal (non-cumulative) probability
# ---------------------------------------------------------------------------

def marginal_probs(counts: List[int], day_count: int) -> List[float]:
    """
    Compute per-bucket marginal probabilities (PMF estimates).

        P̂(X = bucket_i) = counts[i] / day_count * 100

    Args:
        counts:    Per-bucket hit counts.
        day_count: Total sessions.

    Returns:
        List of marginal probabilities (%) summing to at most 100.
    """
    if day_count <= 0:
        return [0.0] * len(counts)
    return [c / day_count * 100.0 for c in counts]


# ---------------------------------------------------------------------------
# Summary statistics for a raid distribution
# ---------------------------------------------------------------------------

def raid_distribution_summary(counts: List[int], levels: List[float], day_count: int) -> dict:
    """
    Compute summary statistics for one side (high or low) of a raid distribution.

    Returns a dict with:
        prob_cumulative:  P(reach >= level_i) for each level (survival function values)
        prob_marginal:    P(raid size fell in bucket_i) for each bucket
        mean_bucket:      Expected bucket index (probability-weighted mean)
        mode_bucket:      Bucket index with highest marginal probability
        n_sessions:       Total sessions with any confirmed raid
    """
    prob_c = update_prob_cache(counts, counts, day_count)[0]  # symmetric call
    prob_m = marginal_probs(counts, day_count)
    total  = sum(counts)
    mean_b = sum(i * p for i, p in enumerate(prob_m)) / 100.0 if total > 0 else float('nan')
    mode_b = max(range(len(counts)), key=lambda i: counts[i]) if total > 0 else -1
    return {
        "prob_cumulative": prob_c,
        "prob_marginal":   prob_m,
        "mean_bucket":     mean_b,
        "mode_bucket":     mode_b,
        "n_sessions":      total,
    }


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    lvls   = level_sequence(20.0, 10.0)
    print("Levels:", lvls)

    # Simulate 10 days of raid sizes
    import random; random.seed(0)
    raid_sizes = [random.uniform(5, 80) for _ in range(10)]
    hi_counts  = [0] * 7
    for sz in raid_sizes:
        idx = bucket_index(sz, lvls, 10.0)
        hi_counts[idx] += 1

    lo_counts = [0] * 7
    prob_hi, prob_lo = update_prob_cache(hi_counts, lo_counts, 10)
    print("hi_counts:", hi_counts)
    print("prob_hi  :", [f"{p:.1f}%" for p in prob_hi])

    summary = raid_distribution_summary(hi_counts, lvls, 10)
    print("Summary  :", summary)
