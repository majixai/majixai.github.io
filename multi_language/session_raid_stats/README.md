# Session Raid Stats — Multi-Language Implementations

Port of the **Session Raid Stats** Pine Script v6 indicator across multiple languages.

## What it Does

Tracks up to three configurable intraday sessions (default: 02:00–02:15, 09:00–09:15, 13:00–13:15 ET).
For each session it:

1. Records the session high and low to define the *range*.
2. Detects *raids* — price moves that extend beyond the range by at least a minimum threshold within an optional time cutoff.
3. Buckets each confirmed raid into one of seven size classes (six configurable levels + overflow).
4. Computes cumulative reach-probabilities: the percentage of historical sessions in which price
   reached *at least* a given level.

## Mathematical Concepts

| Component | Concept |
|-----------|---------|
| `bucket_index(value)` | Piecewise classification / arithmetic level sequence |
| `cumulative(counts)` | Reverse-cumulative sum (survival function of the discrete distribution) |
| `update_prob_cache(…)` | Empirical cumulative distribution function (ECDF) estimation |
| `within_cutoff(…)` | Time-gated event detection |

## Files

| File | Language |
|------|----------|
| `session_raid_stats.py` | Python 3 |
| `session_raid_stats.R` | R |
| `session_raid_stats.go` | Go |
| `session_raid_stats.js` | JavaScript (ES2020) |
| `SessionRaidStats.java` | Java 11+ |

## Related Pine Script

`tradingview_integration/pine_script/session_raid_stats.pine`

## Related Math Snippets

| Path | Description |
|------|-------------|
| `probability/session_raid_buckets.py` | Bucket distribution & ECDF probabilities |
| `calculus/stochastic/session_raid_stats.py` | Session range as a stochastic process |
| `numerical_methods/range_extension_levels.py` | Arithmetic level sequence generation |
| `matrix/raid_array_ops.py` | Array counting and reverse-cumulative sum |
