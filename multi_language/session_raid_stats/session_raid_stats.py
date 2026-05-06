"""
session_raid_stats.py — Python 3 port of the Session Raid Stats Pine Script indicator
======================================================================================
Tracks up to three intraday sessions, detects range-extension raids, buckets raid
sizes, and computes empirical reach-probabilities for each level.

Usage
-----
    from session_raid_stats import SessionConfig, RaidEngine, RaidStats

    cfg = SessionConfig(
        session_start="02:00", session_end="02:15",
        min_raid_pts=5.0, cutoff_mins=120,
        bucket_start=20.0, bucket_step=10.0,
    )
    engine = RaidEngine(cfg)

    # Feed OHLC bars in chronological order:
    for bar in ohlc_bars:
        engine.on_bar(bar["time_ms"], bar["open"], bar["high"], bar["low"], bar["close"])

    stats = engine.get_stats()
    print(stats.prob_hi)  # cumulative reach-probability per level (high-side raids)
    print(stats.prob_lo)  # cumulative reach-probability per level (low-side raids)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone, time as dtime
from typing import List, Optional


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_BUCKETS = 6
BC = MAX_BUCKETS + 1  # 7 buckets: levels 0-5 + overflow


@dataclass
class SessionConfig:
    session_start: str   # "HH:MM"  (local exchange time, 24-h)
    session_end:   str   # "HH:MM"
    min_raid_pts:  float = 5.0
    cutoff_mins:   int   = 120    # 0 = no cutoff
    bucket_start:  float = 20.0
    bucket_step:   float = 10.0
    tz_offset_hrs: float = -5.0   # ET = UTC-5 (no DST adjustment in this simplified port)

    def level_pts(self, n: int) -> float:
        """Return the threshold in points for level n (1-indexed)."""
        return self.bucket_start + (n - 1) * self.bucket_step

    @property
    def levels(self) -> List[float]:
        return [self.level_pts(n) for n in range(1, MAX_BUCKETS + 1)]


# ---------------------------------------------------------------------------
# Bucket helpers
# ---------------------------------------------------------------------------

def bucket_index(value: float, cfg: SessionConfig) -> int:
    """Map a raid-size value to a 0-based bucket index (overflow = MAX_BUCKETS)."""
    lvls = cfg.levels
    for i in range(MAX_BUCKETS - 1):
        if value < lvls[i + 1]:
            return i
    # Check if it fits in the last named bucket
    if value < lvls[-1] + cfg.bucket_step:
        return MAX_BUCKETS - 1
    return MAX_BUCKETS  # overflow


def cumulative_counts(counts: List[int]) -> List[int]:
    """Reverse-cumulative sum: cum[i] = sum(counts[i:])."""
    cum = [0] * len(counts)
    running = 0
    for i in range(len(counts) - 1, -1, -1):
        running += counts[i]
        cum[i] = running
    return cum


def update_prob_cache(
    hi_counts: List[int],
    lo_counts: List[int],
    day_count: int,
    cache_hi: List[float],
    cache_lo: List[float],
) -> None:
    """Update ECDF probability caches in-place."""
    if day_count <= 0:
        return
    cum_h = cumulative_counts(hi_counts)
    cum_l = cumulative_counts(lo_counts)
    for i in range(len(cache_hi)):
        cache_hi[i] = cum_h[i] / day_count * 100.0
        cache_lo[i] = cum_l[i] / day_count * 100.0


# ---------------------------------------------------------------------------
# Session time helpers
# ---------------------------------------------------------------------------

def _parse_hhmm(s: str):
    parts = s.split(":")
    return int(parts[0]), int(parts[1])


def _bar_local_time(bar_time_ms: int, tz_offset_hrs: float) -> dtime:
    utc_ts = bar_time_ms / 1000.0
    offset_secs = tz_offset_hrs * 3600
    local_ts = utc_ts + offset_secs
    dt = datetime.utcfromtimestamp(local_ts)
    return dt.time()


def _in_session(bar_time_ms: int, cfg: SessionConfig) -> bool:
    t = _bar_local_time(bar_time_ms, cfg.tz_offset_hrs)
    sh, sm = _parse_hhmm(cfg.session_start)
    eh, em = _parse_hhmm(cfg.session_end)
    start = dtime(sh, sm)
    end   = dtime(eh, em)
    return start <= t < end


def _within_cutoff(bar_time_ms: int, range_end_ms: int, cutoff_mins: int) -> bool:
    if cutoff_mins == 0:
        return True
    return (bar_time_ms - range_end_ms) <= cutoff_mins * 60_000


# ---------------------------------------------------------------------------
# Per-session raid state
# ---------------------------------------------------------------------------

@dataclass
class RaidState:
    hi:        Optional[float] = None
    lo:        Optional[float] = None
    end_ms:    Optional[int]   = None
    active:    bool            = False
    hi_max:    Optional[float] = None
    hi_touch:  bool            = False
    hi_conf:   bool            = False
    hi_pts:    Optional[float] = None
    lo_min:    Optional[float] = None
    lo_touch:  bool            = False
    lo_conf:   bool            = False
    lo_pts:    Optional[float] = None
    cut_exp:   bool            = False


@dataclass
class RaidStats:
    prob_hi: List[float] = field(default_factory=lambda: [0.0] * BC)
    prob_lo: List[float] = field(default_factory=lambda: [0.0] * BC)
    day_count: int = 0


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class RaidEngine:
    """Processes chronological OHLC bars for one session configuration."""

    def __init__(self, cfg: SessionConfig, max_days: int = 500):
        self.cfg       = cfg
        self.max_days  = max_days
        self._state    = RaidState()
        self._hi_counts: List[int]   = [0] * BC
        self._lo_counts: List[int]   = [0] * BC
        self._prob_hi:   List[float] = [0.0] * BC
        self._prob_lo:   List[float] = [0.0] * BC
        self._day_count  = 0
        self._prev_in_session = False

    # ------------------------------------------------------------------
    def on_bar(self, time_ms: int, open_: float, high: float, low: float, close: float) -> None:
        cfg   = self.cfg
        state = self._state
        in_s  = _in_session(time_ms, cfg)

        # --- Session open: capture first bar
        if in_s and not self._prev_in_session:
            state.hi      = high
            state.lo      = low
            state.end_ms  = None
            state.active  = False
            state.hi_max  = None
            state.hi_touch = False
            state.hi_conf  = False
            state.hi_pts   = None
            state.lo_min   = None
            state.lo_touch = False
            state.lo_conf  = False
            state.lo_pts   = None
            state.cut_exp  = False

        # --- Session body: expand range
        if in_s and state.hi is not None:
            state.hi = max(state.hi, high)
            state.lo = min(state.lo, low)

        # --- Session close: activate raid detection
        if not in_s and self._prev_in_session and state.hi is not None:
            state.end_ms = time_ms
            state.active = True
            if self._day_count < self.max_days:
                self._day_count += 1

        # --- Raid detection (post-session)
        if state.active and state.end_ms is not None:
            if _within_cutoff(time_ms, state.end_ms, cfg.cutoff_mins):
                min_pts = cfg.min_raid_pts
                # High-side raid
                if high > state.hi:
                    ext = high - state.hi
                    if ext >= min_pts:
                        if state.hi_max is None or high > state.hi_max:
                            state.hi_max  = high
                            state.hi_pts  = ext
                            state.hi_touch = True
                # Low-side raid
                if low < state.lo:
                    ext = state.lo - low
                    if ext >= min_pts:
                        if state.lo_min is None or low < state.lo_min:
                            state.lo_min  = low
                            state.lo_pts  = ext
                            state.lo_touch = True
            else:
                # Cutoff expired — lock in confirmed raids for this session
                if not state.cut_exp:
                    if state.hi_touch and state.hi_pts is not None:
                        idx = bucket_index(state.hi_pts, cfg)
                        self._hi_counts[idx] += 1
                        state.hi_conf = True
                    if state.lo_touch and state.lo_pts is not None:
                        idx = bucket_index(state.lo_pts, cfg)
                        self._lo_counts[idx] += 1
                        state.lo_conf = True
                    update_prob_cache(
                        self._hi_counts, self._lo_counts, self._day_count,
                        self._prob_hi, self._prob_lo,
                    )
                    state.cut_exp = True

        self._prev_in_session = in_s

    # ------------------------------------------------------------------
    def get_stats(self) -> RaidStats:
        return RaidStats(
            prob_hi=self._prob_hi[:],
            prob_lo=self._prob_lo[:],
            day_count=self._day_count,
        )


# ---------------------------------------------------------------------------
# Three-session facade (mirrors the Pine Script indicator)
# ---------------------------------------------------------------------------

class SessionRaidStats:
    """Manages three raid engines simultaneously."""

    def __init__(
        self,
        cfg1: SessionConfig,
        cfg2: SessionConfig,
        cfg3: SessionConfig,
        max_days: int = 500,
    ):
        self.engine1 = RaidEngine(cfg1, max_days)
        self.engine2 = RaidEngine(cfg2, max_days)
        self.engine3 = RaidEngine(cfg3, max_days)

    def on_bar(self, time_ms: int, open_: float, high: float, low: float, close: float) -> None:
        self.engine1.on_bar(time_ms, open_, high, low, close)
        self.engine2.on_bar(time_ms, open_, high, low, close)
        self.engine3.on_bar(time_ms, open_, high, low, close)

    def stats(self):
        return (
            self.engine1.get_stats(),
            self.engine2.get_stats(),
            self.engine3.get_stats(),
        )


# ---------------------------------------------------------------------------
# Quick self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import random

    random.seed(42)
    cfg = SessionConfig("02:00", "02:15", min_raid_pts=5.0, cutoff_mins=120,
                        bucket_start=20.0, bucket_step=10.0)
    engine = RaidEngine(cfg, max_days=100)

    # Synthetic 1-minute bars for 5 trading days starting 2024-01-02 07:00 UTC (= 02:00 ET)
    base_price = 4500.0
    ms_per_min = 60_000
    session_open_utc_ms = 1704182400_000  # 2024-01-02 07:00 UTC

    for day in range(5):
        day_offset = day * 24 * 60 * ms_per_min
        price = base_price
        for minute in range(8 * 60):  # 8-hour window
            t = session_open_utc_ms + day_offset + minute * ms_per_min
            o = price
            h = o + random.uniform(0, 4)
            l = o - random.uniform(0, 4)
            c = random.uniform(l, h)
            price = c
            engine.on_bar(t, o, h, l, c)

    stats = engine.get_stats()
    print("Day count :", stats.day_count)
    print("prob_hi   :", [f"{p:.1f}%" for p in stats.prob_hi])
    print("prob_lo   :", [f"{p:.1f}%" for p in stats.prob_lo])
