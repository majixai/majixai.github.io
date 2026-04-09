#!/usr/bin/env python3
"""
bitcoin_miner/fetch_real_data.py
=================================
Real Bitcoin network data fetcher + ML/neural analysis engine.

Runs for RUNTIME seconds (default 180 = 3 minutes), sampling every
SAMPLE_INTERVAL seconds and writing results to OUTPUT_FILE after each
sample so the latest data is always on disk.

Data sources:
  - mempool.space public API  (primary)
  - blockstream.info API      (fallback for blocks/fees)
  - coindesk.com BPI API      (price fallback)

ML/Analytics:
  - 3-layer feed-forward net (10-32-16-1, numpy-free) predicts optimal sat/vB
  - Fee histogram + percentile analysis
  - Block time regularity scoring
  - Network health scoring (0-100)
  - Anomaly detection via z-score
  - Profitability engine (configurable hardware)
  - Historical rolling buffer for trend / volatility

Usage:
  python bitcoin_miner/fetch_real_data.py [--runtime N] [--interval N]
                                          [--hashrate-ths N] [--power-w N]
                                          [--elec-cost N]
"""

import json
import time
import sys
import os
import math
import random
import threading
import statistics
import urllib.request
import urllib.error
from datetime import datetime, timezone
from argparse import ArgumentParser

# ==============================================================================
# SECTION 1 - Configuration
# ==============================================================================

RUNTIME          = 180
SAMPLE_INTERVAL  = 20
REQUEST_TIMEOUT  = 12
MAX_RETRIES      = 3
RETRY_BACKOFF    = 2.0
HISTORY_MAX_SAMPLES = 288

_DIR           = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE    = os.path.join(_DIR, "data", "live_data.json")
HISTORY_FILE   = os.path.join(_DIR, "data", "history.json")

API_BASE             = "https://mempool.space/api"
BLOCKSTREAM_BASE     = "https://blockstream.info/api"
BLOCKCHAIN_INFO_BASE = "https://blockchain.info"
COINDESK_PRICE_URL   = "https://api.coindesk.com/v1/bpi/currentprice/USD.json"

NN_INPUTS_V1         = 6
NN_HIDDEN_V1         = 12
NN_TRAINING_ITERS    = 200

NN_INPUTS_V2         = 10
NN_HIDDEN1_V2        = 32
NN_HIDDEN2_V2        = 16
NN_TRAINING_ITERS_V2 = 400

# ==============================================================================
# SECTION 2 - HTTP helpers
# ==============================================================================

_UA = "majixai-bitcoin-miner/2.0 (+https://majixai.github.io)"


def fetch(url: str, timeout: int = REQUEST_TIMEOUT):
    """Single-attempt HTTP GET returning parsed JSON or None."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"[WARN] HTTP {e.code} fetching {url}", file=sys.stderr)
    except Exception as e:
        print(f"[WARN] fetch({url}): {e}", file=sys.stderr)
    return None


def fetch_with_retry(
    url: str,
    retries: int = MAX_RETRIES,
    backoff: float = RETRY_BACKOFF,
    timeout: int = REQUEST_TIMEOUT,
):
    """
    HTTP GET with exponential-backoff retry.

    Attempts the request up to `retries` times.  Between attempts waits
    backoff * 2^attempt seconds.  4xx responses are not retried.
    Returns parsed JSON on success or None after all retries are exhausted.
    """
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": _UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read().decode())
                if attempt > 0:
                    print(
                        f"[INFO] {url} succeeded on attempt {attempt + 1}",
                        file=sys.stderr,
                    )
                return data
        except urllib.error.HTTPError as e:
            print(
                f"[WARN] HTTP {e.code} {url} (attempt {attempt + 1}/{retries})",
                file=sys.stderr,
            )
            if 400 <= e.code < 500:
                return None
        except Exception as e:
            print(
                f"[WARN] {url} attempt {attempt + 1}/{retries}: {e}",
                file=sys.stderr,
            )
        if attempt < retries - 1:
            wait = backoff * (2 ** attempt)
            print(f"[INFO] Retrying {url} in {wait:.1f}s", file=sys.stderr)
            time.sleep(wait)
    print(f"[ERROR] All {retries} attempts failed for {url}", file=sys.stderr)
    return None


# ==============================================================================
# SECTION 3 - Multi-source price aggregation
# ==============================================================================

def fetch_price_usd() -> dict:
    """
    Aggregate BTC/USD price from three sources in priority order:
      1. mempool.space /v1/prices
      2. CoinDesk BPI
      3. blockchain.info ticker

    Returns dict with usd, eur, gbp, source, timestamp keys.
    """
    _ts = datetime.now(timezone.utc).isoformat()
    _default = {"usd": 0.0, "eur": 0.0, "gbp": 0.0, "source": "unavailable", "timestamp": _ts}

    # Source 1: mempool.space
    data = fetch_with_retry(f"{API_BASE}/v1/prices")
    if data and isinstance(data, dict) and data.get("USD"):
        return {
            "usd":       float(data.get("USD", 0)),
            "eur":       float(data.get("EUR", 0)),
            "gbp":       float(data.get("GBP", 0)),
            "source":    "mempool.space",
            "timestamp": _ts,
        }

    # Source 2: CoinDesk
    print("[INFO] Trying CoinDesk price fallback", file=sys.stderr)
    cd = fetch_with_retry(COINDESK_PRICE_URL)
    if cd and isinstance(cd, dict):
        try:
            usd_raw = cd["bpi"]["USD"]["rate"].replace(",", "")
            return {
                "usd":       float(usd_raw),
                "eur":       0.0,
                "gbp":       0.0,
                "source":    "coindesk",
                "timestamp": _ts,
            }
        except (KeyError, ValueError, TypeError):
            pass

    # Source 3: blockchain.info
    print("[INFO] Trying blockchain.info price fallback", file=sys.stderr)
    bl = fetch_with_retry(f"{BLOCKCHAIN_INFO_BASE}/ticker")
    if bl and isinstance(bl, dict) and bl.get("USD"):
        try:
            return {
                "usd":       float(bl["USD"].get("last", 0)),
                "eur":       float(bl.get("EUR", {}).get("last", 0)),
                "gbp":       float(bl.get("GBP", {}).get("last", 0)),
                "source":    "blockchain.info",
                "timestamp": _ts,
            }
        except (KeyError, ValueError, TypeError):
            pass

    print("[WARN] All price sources failed.", file=sys.stderr)
    return _default


# ==============================================================================
# SECTION 4 - Fee histogram
# ==============================================================================

def _percentile_from_bands(bands: list, pct: float) -> float:
    """
    Approximate the fee-rate at `pct` percentile from a list of
    {"min_fee", "max_fee", "vsize"} band dicts sorted by min_fee.
    """
    if not bands:
        return 0.0
    total_vsize = sum(b.get("vsize", 0) for b in bands)
    if total_vsize == 0:
        return 0.0
    target = total_vsize * (pct / 100.0)
    cumulative = 0.0
    for b in sorted(bands, key=lambda x: x.get("min_fee", 0)):
        cumulative += b.get("vsize", 0)
        if cumulative >= target:
            lo = b.get("min_fee", 0)
            hi = b.get("max_fee", lo)
            return (lo + hi) / 2.0
    return bands[-1].get("max_fee", 0)


def fetch_fee_histogram() -> dict:
    """
    Build a fee-rate histogram from mempool.space projected blocks endpoint.

    Returns bands list plus p10/p25/p50/p75/p90/p99 percentile markers.
    """
    _empty = {
        "bands": [], "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0, "p99": 0,
        "total_tx_count": 0, "total_vsize_mb": 0.0, "source": "unavailable",
    }

    raw = fetch_with_retry(f"{API_BASE}/v1/fees/mempool-blocks")
    if not raw or not isinstance(raw, list):
        return _empty

    bands: list = []
    total_tx    = 0
    total_vsize = 0

    for blk in raw:
        if not isinstance(blk, dict):
            continue
        fee_rng    = blk.get("feeRange", [])
        n_txs      = blk.get("nTx",       0)
        block_vsz  = blk.get("blockVSize", 0)
        total_tx   += n_txs
        total_vsize += block_vsz

        if len(fee_rng) >= 2:
            lo = float(fee_rng[0])
            hi = float(fee_rng[-1])
            bands.append({"min_fee": round(lo, 2), "max_fee": round(hi, 2),
                          "count": n_txs, "vsize": block_vsz})
        elif len(fee_rng) == 1:
            f = float(fee_rng[0])
            bands.append({"min_fee": round(f, 2), "max_fee": round(f, 2),
                          "count": n_txs, "vsize": block_vsz})

    bands.sort(key=lambda b: b["min_fee"])
    return {
        "bands":           bands,
        "p10":             round(_percentile_from_bands(bands, 10),  2),
        "p25":             round(_percentile_from_bands(bands, 25),  2),
        "p50":             round(_percentile_from_bands(bands, 50),  2),
        "p75":             round(_percentile_from_bands(bands, 75),  2),
        "p90":             round(_percentile_from_bands(bands, 90),  2),
        "p99":             round(_percentile_from_bands(bands, 99),  2),
        "total_tx_count":  total_tx,
        "total_vsize_mb":  round(total_vsize / 1_000_000, 3),
        "source":          "mempool.space",
    }


# ==============================================================================
# SECTION 5 - Lightning network stats
# ==============================================================================

def fetch_lightning_stats() -> dict:
    """
    Fetch Lightning Network statistics from mempool.space /v1/lightning/statistics/latest.

    Returns node count, channel count, capacity and fee metrics.
    Falls back to zero values on any API error.
    """
    _fallback = {
        "node_count": 0, "channel_count": 0, "total_capacity_btc": 0.0,
        "avg_capacity_sat": 0, "avg_fee_rate_ppm": 0, "avg_base_fee_msat": 0,
        "med_capacity_sat": 0, "source": "unavailable",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    data = fetch_with_retry(f"{API_BASE}/v1/lightning/statistics/latest")
    if not data or not isinstance(data, dict):
        return _fallback

    latest = data.get("latest", data)
    try:
        return {
            "node_count":         int(latest.get("node_count",       latest.get("channel_count", 0))),
            "channel_count":      int(latest.get("channel_count",    0)),
            "total_capacity_btc": round(int(latest.get("total_capacity", 0)) / 1e8, 4),
            "avg_capacity_sat":   int(latest.get("avg_capacity",     0)),
            "avg_fee_rate_ppm":   int(latest.get("avg_fee_rate",     0)),
            "avg_base_fee_msat":  int(latest.get("avg_base_fee_mtokens", latest.get("avg_base_fee_msat", 0))),
            "med_capacity_sat":   int(latest.get("med_capacity",     0)),
            "source":             "mempool.space",
            "timestamp":          datetime.now(timezone.utc).isoformat(),
        }
    except (TypeError, ValueError):
        return _fallback


# ==============================================================================
# SECTION 6 - Mining pool breakdown
# ==============================================================================

def fetch_mining_pools() -> dict:
    """
    Fetch weekly mining pool statistics from mempool.space.

    Returns the top-10 pools sorted by block count with name,
    estimated hashrate share (%), and block count.
    """
    _fallback = {"pools": [], "period": "1w", "total_blocks": 0, "source": "unavailable"}

    data = fetch_with_retry(f"{API_BASE}/v1/mining/pools/1w")
    if not data or not isinstance(data, dict):
        return _fallback

    pools_raw  = data.get("pools",      [])
    total_blks = data.get("blockCount", 0)
    pools_out  = []

    for pool in pools_raw[:10]:
        if not isinstance(pool, dict):
            continue
        blk_count = int(pool.get("blockCount", 0))
        share_pct = round(blk_count / total_blks * 100, 2) if total_blks > 0 else 0.0
        pools_out.append({
            "name":           pool.get("name",  "Unknown"),
            "slug":           pool.get("slug",  ""),
            "block_count":    blk_count,
            "share_pct":      share_pct,
            "avg_fees_btc":   round(pool.get("avgFees",   0) / 1e8, 6),
            "avg_reward_btc": round(pool.get("avgReward", 0) / 1e8, 6),
        })

    pools_out.sort(key=lambda p: p["block_count"], reverse=True)
    return {"pools": pools_out, "period": "1w", "total_blocks": total_blks, "source": "mempool.space"}


# ==============================================================================
# SECTION 7 - Mempool cluster analysis
# ==============================================================================

def analyse_mempool_clusters(mempool_blocks: list) -> dict:
    """
    Analyse projected mempool blocks to identify fee-rate clusters and fee cliffs.

    Divides the projected blocks into high/medium/low fee clusters and
    detects any sharp fee drop (cliff) between adjacent blocks.

    Args:
        mempool_blocks: list from mempool.space /api/v1/fees/mempool-blocks

    Returns dict with cluster stats and cliff detection results.
    """
    _empty = {
        "high_fee_cluster":   {"count": 0, "min_fee": 0, "max_fee": 0, "vsize": 0},
        "medium_fee_cluster": {"count": 0, "min_fee": 0, "max_fee": 0, "vsize": 0},
        "low_fee_cluster":    {"count": 0, "min_fee": 0, "max_fee": 0, "vsize": 0},
        "fee_cliff_detected": False, "fee_cliff_at_sat_vb": 0.0,
        "fee_cliff_drop_pct": 0.0, "total_tx_count": 0,
    }

    if not mempool_blocks or not isinstance(mempool_blocks, list):
        return _empty

    ranges: list = []
    for blk in mempool_blocks:
        if not isinstance(blk, dict):
            continue
        fee_rng = blk.get("feeRange", [])
        n_txs   = blk.get("nTx",       0)
        vsize   = blk.get("blockVSize", 0)
        if fee_rng:
            lo = float(fee_rng[0])
            hi = float(fee_rng[-1])
            ranges.append({"lo": lo, "hi": hi, "count": n_txs, "vsize": vsize})

    ranges.sort(key=lambda r: r["hi"], reverse=True)
    n_ranges = len(ranges)

    third = max(1, n_ranges // 3)
    high_group   = ranges[:third]
    medium_group = ranges[third: 2 * third]
    low_group    = ranges[2 * third:]

    def _cluster_stats(group):
        if not group:
            return {"count": 0, "min_fee": 0, "max_fee": 0, "vsize": 0}
        return {
            "count":   sum(g["count"] for g in group),
            "min_fee": round(min(g["lo"] for g in group), 2),
            "max_fee": round(max(g["hi"] for g in group), 2),
            "vsize":   sum(g["vsize"] for g in group),
        }

    cliff_detected = False
    cliff_at       = 0.0
    cliff_drop_pct = 0.0
    for i in range(1, len(ranges)):
        prev_lo = ranges[i - 1]["lo"]
        curr_hi = ranges[i]["hi"]
        if prev_lo > 0 and curr_hi > 0:
            drop = (prev_lo - curr_hi) / prev_lo
            if drop > 0.5 and drop > cliff_drop_pct:
                cliff_detected = True
                cliff_at       = round(prev_lo, 2)
                cliff_drop_pct = round(drop * 100, 1)

    return {
        "high_fee_cluster":   _cluster_stats(high_group),
        "medium_fee_cluster": _cluster_stats(medium_group),
        "low_fee_cluster":    _cluster_stats(low_group),
        "fee_cliff_detected": cliff_detected,
        "fee_cliff_at_sat_vb": cliff_at,
        "fee_cliff_drop_pct": cliff_drop_pct,
        "total_tx_count":     sum(r["count"] for r in ranges),
    }


# ==============================================================================
# SECTION 8 - Network health score
# ==============================================================================

def compute_network_health(
    blocks: list,
    fees_rec: dict,
    mempool: dict,
    hashrate: dict,
) -> dict:
    """
    Score the Bitcoin network health from 0-100 based on five factors:
      1. Block time regularity   (0-20 pts)
      2. Mempool backlog         (0-20 pts)
      3. Fee market stability    (0-20 pts)
      4. Hashrate trend          (0-20 pts)
      5. Difficulty alignment    (0-20 pts)

    Returns score, letter grade, per-factor breakdown, and key metrics.
    """
    factors: dict = {}

    # Factor 1: block time regularity
    block_time_score = 10
    if blocks and len(blocks) >= 3:
        ts_list = [b.get("timestamp", 0) for b in blocks[:10] if b.get("timestamp")]
        if len(ts_list) >= 3:
            gaps = [ts_list[i] - ts_list[i + 1] for i in range(len(ts_list) - 1)]
            avg_gap = statistics.mean(gaps)
            try:
                std_gap = statistics.stdev(gaps)
            except statistics.StatisticsError:
                std_gap = 0
            deviation_ratio = abs(avg_gap - 600) / 600
            block_time_score = max(0, 20 - int(deviation_ratio * 30) - int(std_gap / 60))
    factors["block_time_regularity"] = min(20, max(0, block_time_score))

    # Factor 2: mempool backlog
    mem_count = mempool.get("count", 0) or 0
    if mem_count < 5_000:
        backlog_score = 20
    elif mem_count < 20_000:
        backlog_score = 16
    elif mem_count < 50_000:
        backlog_score = 12
    elif mem_count < 100_000:
        backlog_score = 7
    elif mem_count < 200_000:
        backlog_score = 3
    else:
        backlog_score = 0
    factors["mempool_backlog"] = backlog_score

    # Factor 3: fee market stability
    fastest  = fees_rec.get("fastestFee",  1) or 1
    hour_fee = fees_rec.get("hourFee",     1) or 1
    spread   = fastest / max(hour_fee, 1)
    if spread < 1.5:
        fee_stability = 20
    elif spread < 3.0:
        fee_stability = 15
    elif spread < 6.0:
        fee_stability = 10
    elif spread < 10.0:
        fee_stability = 5
    else:
        fee_stability = 0
    factors["fee_market_stability"] = fee_stability

    # Factor 4: hashrate trend
    current_hr  = hashrate.get("currentHashrate",   0) or 0
    current_dif = hashrate.get("currentDifficulty", 0) or 0
    hashrate_score = 10
    hashrates_hist = hashrate.get("hashrates", [])
    if hashrates_hist and len(hashrates_hist) >= 2:
        hr_vals = [h.get("avgHashrate", 0) for h in hashrates_hist[-7:] if h.get("avgHashrate")]
        if len(hr_vals) >= 2:
            recent_avg  = statistics.mean(hr_vals[-3:])
            earlier_avg = statistics.mean(hr_vals[:3])
            if earlier_avg > 0:
                trend_ratio = recent_avg / earlier_avg
                if trend_ratio > 1.02:
                    hashrate_score = 20
                elif trend_ratio > 1.0:
                    hashrate_score = 16
                elif trend_ratio > 0.98:
                    hashrate_score = 12
                else:
                    hashrate_score = 5
    factors["hashrate_trend"] = min(20, max(0, hashrate_score))

    # Factor 5: difficulty / hashrate alignment
    align_score = 10
    if current_hr > 0 and current_dif > 0:
        expected_dif = current_hr * 600 / (2 ** 32)
        if expected_dif > 0:
            ratio = current_dif / expected_dif
            if 0.9 < ratio < 1.1:
                align_score = 20
            elif 0.8 < ratio < 1.2:
                align_score = 15
            elif 0.7 < ratio < 1.3:
                align_score = 8
            else:
                align_score = 2
    factors["difficulty_alignment"] = min(20, max(0, align_score))

    total_score = max(0, min(100, sum(factors.values())))
    grade = (
        "A" if total_score >= 85 else
        "B" if total_score >= 70 else
        "C" if total_score >= 55 else
        "D" if total_score >= 40 else "F"
    )

    return {
        "score":               total_score,
        "grade":               grade,
        "factors":             factors,
        "mempool_count":       mem_count,
        "fastest_fee_sat_vb":  fastest,
        "current_hashrate_eh": round(current_hr / 1e18, 3),
    }


# ==============================================================================
# SECTION 9 - Block time analysis
# ==============================================================================

def analyse_block_times(blocks: list) -> dict:
    """
    Characterise recent block production timing.

    Computes average/std/min/max block times, blocks per hour,
    estimated seconds until next block, and a regularity percentage.

    Args:
        blocks: list of block dicts with "timestamp" field (Unix seconds)
    """
    _empty = {
        "avg_block_time_s": 600, "std_dev_s": 0.0, "fastest_block_s": 600,
        "slowest_block_s": 600, "blocks_per_hour": 6.0,
        "estimated_next_block_s": 600, "sample_size": 0,
        "regularity_pct": 100.0, "last_block_age_s": 0,
    }

    if not blocks or len(blocks) < 2:
        return _empty

    ts_list = []
    for b in blocks[:20]:
        ts = b.get("timestamp", 0)
        if ts and isinstance(ts, (int, float)) and ts > 1_000_000_000:
            ts_list.append(int(ts))

    if len(ts_list) < 2:
        return _empty

    ts_list.sort(reverse=True)
    gaps = [ts_list[i] - ts_list[i + 1] for i in range(len(ts_list) - 1)]
    gaps = [g for g in gaps if 0 < g < 7200]

    if not gaps:
        return _empty

    avg_gap = statistics.mean(gaps)
    try:
        std_dev = statistics.stdev(gaps)
    except statistics.StatisticsError:
        std_dev = 0.0

    now_ts   = int(time.time())
    age      = max(0, now_ts - ts_list[0])
    est_next = max(0, int(avg_gap - age))

    median_gap = sorted(gaps)[len(gaps) // 2]
    regular    = sum(1 for g in gaps if g < 2 * median_gap)
    regularity = round(regular / len(gaps) * 100, 1)

    return {
        "avg_block_time_s":        round(avg_gap, 1),
        "std_dev_s":               round(std_dev, 1),
        "fastest_block_s":         int(min(gaps)),
        "slowest_block_s":         int(max(gaps)),
        "blocks_per_hour":         round(3600 / avg_gap, 2) if avg_gap > 0 else 0.0,
        "estimated_next_block_s":  est_next,
        "sample_size":             len(gaps),
        "regularity_pct":          regularity,
        "last_block_age_s":        age,
    }


# ==============================================================================
# SECTION 10 - Fee acceleration detection
# ==============================================================================

def detect_fee_acceleration(prev_samples: list) -> dict:
    """
    Compute fee velocity over the last 15-minute window of samples.

    Flags "accelerating" if velocity > +2 sat/vB/min,
          "decelerating" if velocity < -2 sat/vB/min.

    Args:
        prev_samples: list of {"ts": float, "fees_recommended": {"fastestFee": X}}

    Returns velocity, direction, magnitude, and endpoint fees.
    """
    _empty = {
        "velocity_sat_vb_per_min": 0.0, "direction": "stable",
        "magnitude": "weak", "fee_15m_ago_sat_vb": 0.0,
        "fee_now_sat_vb": 0.0, "sample_count": 0,
    }

    if not prev_samples or len(prev_samples) < 2:
        return _empty

    now_ts = time.time()
    cutoff = now_ts - 900
    window = [s for s in prev_samples if s.get("ts", 0) >= cutoff]
    if len(window) < 2:
        window = prev_samples[-min(5, len(prev_samples)):]
    if len(window) < 2:
        return _empty

    fees_series = sorted(
        (
            (s.get("ts", now_ts),
             s.get("fees_recommended", {}).get("fastestFee", 0) or 0)
            for s in window
        ),
        key=lambda x: x[0],
    )

    t0, f0 = fees_series[0]
    t1, f1 = fees_series[-1]
    elapsed_min = (t1 - t0) / 60.0
    if elapsed_min < 0.01:
        return _empty

    velocity = (f1 - f0) / elapsed_min

    if velocity > 2.0:
        direction = "accelerating"
    elif velocity < -2.0:
        direction = "decelerating"
    else:
        direction = "stable"

    abs_v = abs(velocity)
    magnitude = "strong" if abs_v > 10.0 else "moderate" if abs_v > 3.0 else "weak"

    return {
        "velocity_sat_vb_per_min": round(velocity, 4),
        "direction":               direction,
        "magnitude":               magnitude,
        "fee_15m_ago_sat_vb":      round(f0, 2),
        "fee_now_sat_vb":          round(f1, 2),
        "sample_count":            len(fees_series),
    }


# ==============================================================================
# SECTION 11 - Price volatility
# ==============================================================================

def compute_price_volatility(price_history: list) -> dict:
    """
    Compute annualised volatility from a list of {"timestamp", "usd"} records.

    Uses log-return standard deviation scaled to annualised figure.
    Also reports 24h and 7d price changes.
    """
    _empty = {
        "annualised_volatility_pct": 0.0, "daily_volatility_pct": 0.0,
        "change_24h_pct": 0.0, "change_7d_pct": 0.0,
        "price_min": 0.0, "price_max": 0.0, "sample_count": 0,
    }

    if not price_history or len(price_history) < 2:
        return _empty

    prices = [float(r["usd"]) for r in price_history if r.get("usd") and float(r.get("usd", 0)) > 0]
    if len(prices) < 2:
        return _empty

    log_returns = [
        math.log(prices[i] / prices[i - 1])
        for i in range(1, len(prices))
        if prices[i - 1] > 0 and prices[i] > 0
    ]
    if not log_returns:
        return _empty

    try:
        daily_std = statistics.stdev(log_returns)
    except statistics.StatisticsError:
        daily_std = 0.0

    samples_per_day = 288
    ann_vol = daily_std * math.sqrt(samples_per_day * 365) * 100

    old_24h = prices[max(0, len(prices) - min(288, len(prices)))]
    change_24h = round((prices[-1] - old_24h) / old_24h * 100, 2) if old_24h > 0 else 0.0

    change_7d = round((prices[-1] - prices[0]) / prices[0] * 100, 2) if prices[0] > 0 else 0.0

    return {
        "annualised_volatility_pct": round(ann_vol, 2),
        "daily_volatility_pct":      round(daily_std * 100, 4),
        "change_24h_pct":            change_24h,
        "change_7d_pct":             change_7d,
        "price_min":                 round(min(prices), 2),
        "price_max":                 round(max(prices), 2),
        "sample_count":              len(prices),
    }


# ==============================================================================
# SECTION 12 - Supply stats
# ==============================================================================

def _total_subsidy_up_to_height(height: int) -> float:
    """Sum total BTC subsidy issued from block 0 up to (and including) height."""
    total   = 0.0
    subsidy = 50.0
    epoch   = 0
    while True:
        epoch_start = epoch * 210_000
        epoch_end   = epoch_start + 210_000
        if epoch_start > height:
            break
        blocks_in_epoch = min(epoch_end, height + 1) - epoch_start
        total  += subsidy * blocks_in_epoch
        subsidy /= 2.0
        if subsidy < 1e-10:
            break
        epoch += 1
    return total


def fetch_supply_stats(height: int = 0) -> dict:
    """
    Estimate Bitcoin circulating supply and supply schedule from block height.

    If height == 0, fetches the current tip from mempool.space.

    Returns mined supply, remaining supply, % mined, next halving details.
    """
    if height == 0:
        tip = fetch_with_retry(f"{API_BASE}/blocks/tip/height")
        if tip and isinstance(tip, int):
            height = tip
        else:
            height = 840_000

    mined      = _total_subsidy_up_to_height(height)
    max_supply = 20_999_999.9769
    remaining  = max_supply - mined
    pct_mined  = round(mined / max_supply * 100, 6)
    halvings   = height // 210_000
    subsidy    = block_subsidy_btc(height)
    next_halv  = (halvings + 1) * 210_000
    blocks_to  = next_halv - height

    return {
        "height":                 height,
        "mined_supply_btc":       round(mined, 4),
        "remaining_supply_btc":   round(remaining, 4),
        "max_supply_btc":         round(max_supply, 4),
        "pct_mined":              pct_mined,
        "current_subsidy_btc":    subsidy,
        "halvings_elapsed":       halvings,
        "next_halving_block":     next_halv,
        "blocks_to_next_halving": blocks_to,
        "estimated_final_btc":    round(max_supply, 4),
    }


# ==============================================================================
# SECTION 13 - TinyNet (original 2-layer net, preserved)
# ==============================================================================

class TinyNet:
    """
    Original 2-layer feed-forward network preserved for backward compatibility.

    Architecture: NN_INPUTS_V1 (6) -> NN_HIDDEN_V1 (12, ReLU) -> 1 (linear)
    Pure Python, no external dependencies.
    """

    def __init__(self, seed: int = 0):
        rng = random.Random(seed)
        g   = lambda r, c: [[rng.gauss(0, 0.3) for _ in range(c)] for _ in range(r)]
        self.W1 = g(NN_HIDDEN_V1, NN_INPUTS_V1)
        self.b1 = [0.0] * NN_HIDDEN_V1
        self.W2 = g(1, NN_HIDDEN_V1)
        self.b2 = [0.0]

    @staticmethod
    def relu(v):
        return [max(0.0, x) for x in v]

    @staticmethod
    def dot(M, v):
        return [sum(M[i][j] * v[j] for j in range(len(v))) for i in range(len(M))]

    @staticmethod
    def add(a, b):
        return [a[i] + b[i] for i in range(len(a))]

    def forward(self, x):
        h = self.relu(self.add(self.dot(self.W1, x), self.b1))
        return self.add(self.dot(self.W2, h), self.b2)[0]

    def sgd_step(self, x, y_true, lr: float = 0.01):
        """Single-sample gradient descent (MSE loss)."""
        h_pre = self.add(self.dot(self.W1, x), self.b1)
        h     = self.relu(h_pre)
        y_hat = self.add(self.dot(self.W2, h), self.b2)[0]
        d_out = 2.0 * (y_hat - y_true)
        for j in range(len(self.W2[0])):
            self.W2[0][j] -= lr * d_out * h[j]
        self.b2[0] -= lr * d_out
        d_h = [
            d_out * self.W2[0][j] * (1.0 if h_pre[j] > 0 else 0.0)
            for j in range(len(h_pre))
        ]
        for i in range(len(self.W1)):
            for j in range(len(x)):
                self.W1[i][j] -= lr * d_h[i] * x[j]
            self.b1[i] -= lr * d_h[i]


# ==============================================================================
# SECTION 14 - NeuralNet3: 3-layer net with momentum SGD
# ==============================================================================

class NeuralNet3:
    """
    3-layer feed-forward network with momentum SGD (pure Python, no numpy).

    Architecture:
      Input  (10) -> Hidden-1 (32, ReLU) -> Hidden-2 (16, ReLU) -> Output (1)

    Momentum velocity terms are maintained for all weight matrices and
    bias vectors to speed convergence on the synthetic training data.

    Input feature order (10 features):
      0  fastest_fee_norm         normalised 0-1 in [1, 500] sat/vB
      1  half_hour_fee_norm       normalised 0-1 in [1, 500] sat/vB
      2  hour_fee_norm            normalised 0-1 in [1, 500] sat/vB
      3  economy_fee_norm         normalised 0-1 in [1, 200] sat/vB
      4  min_fee_norm             normalised 0-1 in [1, 100] sat/vB
      5  mempool_count_norm       normalised 0-1 in [0, 150_000]
      6  mempool_vsize_norm       normalised 0-1 in [0, 100_000_000]
      7  block_time_norm          normalised 0-1 in [60, 1800] s
      8  hashrate_norm            normalised 0-1 in [0, 1000] EH/s
      9  price_volatility_norm    normalised 0-1 in [0, 300] % ann.
    """

    MOMENTUM = 0.9

    def __init__(self, seed: int = 0):
        rng = random.Random(seed)

        def _xavier(rows: int, cols: int) -> list:
            scale = math.sqrt(2.0 / cols)
            return [[rng.gauss(0, scale) for _ in range(cols)] for _ in range(rows)]

        self.W1 = _xavier(NN_HIDDEN1_V2, NN_INPUTS_V2)
        self.b1 = [0.0] * NN_HIDDEN1_V2
        self.W2 = _xavier(NN_HIDDEN2_V2, NN_HIDDEN1_V2)
        self.b2 = [0.0] * NN_HIDDEN2_V2
        self.W3 = _xavier(1, NN_HIDDEN2_V2)
        self.b3 = [0.0]

        # Momentum velocity buffers (matching weight shapes)
        self.vW1 = [[0.0] * NN_INPUTS_V2   for _ in range(NN_HIDDEN1_V2)]
        self.vb1 = [0.0] * NN_HIDDEN1_V2
        self.vW2 = [[0.0] * NN_HIDDEN1_V2  for _ in range(NN_HIDDEN2_V2)]
        self.vb2 = [0.0] * NN_HIDDEN2_V2
        self.vW3 = [[0.0] * NN_HIDDEN2_V2  for _ in range(1)]
        self.vb3 = [0.0]

    # ---- static helpers -------------------------------------------------------

    @staticmethod
    def relu(v: list) -> list:
        return [max(0.0, x) for x in v]

    @staticmethod
    def dot(M: list, v: list) -> list:
        return [sum(M[i][j] * v[j] for j in range(len(v))) for i in range(len(M))]

    @staticmethod
    def add(a: list, b: list) -> list:
        return [a[i] + b[i] for i in range(len(a))]

    # ---- forward pass ---------------------------------------------------------

    def forward(self, x: list) -> float:
        """Compute the network output (scalar) for input vector x."""
        self._last_x = x
        self._pre1   = self.add(self.dot(self.W1, x),        self.b1)
        self._h1     = self.relu(self._pre1)
        self._pre2   = self.add(self.dot(self.W2, self._h1), self.b2)
        self._h2     = self.relu(self._pre2)
        self._pre3   = self.add(self.dot(self.W3, self._h2), self.b3)
        return self._pre3[0]

    # ---- SGD step with momentum -----------------------------------------------

    def sgd_step(self, x: list, y_true: float, lr: float = 0.01):
        """
        Single-sample gradient descent step with momentum.

        Performs full back-propagation through all three layers and
        updates weights using velocity-based momentum.
        """
        y_hat = self.forward(x)

        # Output-layer delta (MSE loss derivative)
        d3 = [2.0 * (y_hat - y_true)]

        # Gradients: layer 3
        dW3 = [[d3[0] * self._h2[j] for j in range(NN_HIDDEN2_V2)]]
        db3 = [d3[0]]

        # Gradients: layer 2
        d_h2   = [d3[0] * self.W3[0][j] for j in range(NN_HIDDEN2_V2)]
        d_pre2 = [d_h2[j] * (1.0 if self._pre2[j] > 0 else 0.0)
                  for j in range(NN_HIDDEN2_V2)]
        dW2    = [[d_pre2[i] * self._h1[j]
                   for j in range(NN_HIDDEN1_V2)]
                  for i in range(NN_HIDDEN2_V2)]
        db2    = d_pre2[:]

        # Gradients: layer 1
        d_h1   = [
            sum(self.W2[k][j] * d_pre2[k] for k in range(NN_HIDDEN2_V2))
            for j in range(NN_HIDDEN1_V2)
        ]
        d_pre1 = [d_h1[j] * (1.0 if self._pre1[j] > 0 else 0.0)
                  for j in range(NN_HIDDEN1_V2)]
        dW1    = [[d_pre1[i] * x[j]
                   for j in range(NN_INPUTS_V2)]
                  for i in range(NN_HIDDEN1_V2)]
        db1    = d_pre1[:]

        # Apply momentum updates
        m = self.MOMENTUM
        for i in range(NN_HIDDEN1_V2):
            for j in range(NN_INPUTS_V2):
                self.vW1[i][j] = m * self.vW1[i][j] + dW1[i][j]
                self.W1[i][j] -= lr * self.vW1[i][j]
            self.vb1[i] = m * self.vb1[i] + db1[i]
            self.b1[i] -= lr * self.vb1[i]

        for i in range(NN_HIDDEN2_V2):
            for j in range(NN_HIDDEN1_V2):
                self.vW2[i][j] = m * self.vW2[i][j] + dW2[i][j]
                self.W2[i][j] -= lr * self.vW2[i][j]
            self.vb2[i] = m * self.vb2[i] + db2[i]
            self.b2[i] -= lr * self.vb2[i]

        for j in range(NN_HIDDEN2_V2):
            self.vW3[0][j] = m * self.vW3[0][j] + dW3[0][j]
            self.W3[0][j] -= lr * self.vW3[0][j]
        self.vb3[0] = m * self.vb3[0] + db3[0]
        self.b3[0] -= lr * self.vb3[0]


# ==============================================================================
# SECTION 15 - Normalisation helpers
# ==============================================================================

def normalise(v, lo, hi):
    """Clamp and normalise v from [lo, hi] to [0, 1]."""
    if hi <= lo:
        return 0.5
    return max(0.0, min(1.0, (v - lo) / (hi - lo)))


def normalise_block_time(avg_gap_s: float) -> float:
    """Map average block time (seconds) to [0,1] where 600 s = 0.5."""
    return normalise(avg_gap_s, 60, 1800)


def normalise_hashrate(hr_eh: float) -> float:
    """Map hashrate in EH/s to [0,1] over a 0-1000 EH/s reference range."""
    return normalise(hr_eh, 0, 1000)


# ==============================================================================
# SECTION 16 - Original run_ml (preserved for backward compat)
# ==============================================================================

def run_ml(blocks, fees_rec, mempool, prev_samples):
    """
    Original 6-feature ML analysis using TinyNet.

    Preserved from v1 for backward compatibility.  Consumers should
    prefer run_ml_v2() which uses the deeper NeuralNet3 with 10 features.
    """
    fastest  = fees_rec.get("fastestFee",  20) or 20
    half_hr  = fees_rec.get("halfHourFee", 15) or 15
    hour     = fees_rec.get("hourFee",     10) or 10
    economy  = fees_rec.get("economyFee",   5) or 5
    minimum  = fees_rec.get("minimumFee",   1) or 1
    mem_cnt  = mempool.get("count",  10_000) or 10_000
    mem_vsz  = mempool.get("vsize",  5_000_000) or 5_000_000

    x = [
        normalise(fastest, 1, 500),
        normalise(half_hr, 1, 500),
        normalise(hour,    1, 500),
        normalise(economy, 1, 200),
        normalise(mem_cnt, 0, 150_000),
        normalise(mem_vsz, 0, 100_000_000),
    ]

    net = TinyNet(seed=int(fastest * 7 + mem_cnt) & 0xFFFFFF)
    rng = random.Random(42)
    for _ in range(NN_TRAINING_ITERS):
        noise = [rng.gauss(0, 0.05) for _ in range(6)]
        xs    = [max(0.0, min(1.0, x[i] + noise[i])) for i in range(6)]
        congestion = (xs[4] + xs[5]) / 2.0
        y_syn = congestion * 0.8 + xs[0] * 0.2
        net.sgd_step(xs, y_syn, lr=0.05)

    score      = net.forward(x)
    score_norm = max(0.0, min(1.0, (score + 1.0) / 2.0))

    block_fees    = [b.get("extras", {}).get("medianFee", 0) or 0 for b in (blocks or [])[:6]]
    avg_block_fee = sum(block_fees) / max(len(block_fees), 1)
    height        = blocks[0].get("height", 0) if blocks else 0
    blocks_to_adj = 2016 - (height % 2016)

    prev_fast = [s.get("fees_recommended", {}).get("fastestFee", 0) for s in (prev_samples or [])]
    trend = (
        "rising"  if len(prev_fast) >= 2 and fastest > prev_fast[-1] else
        "falling" if len(prev_fast) >= 2 and fastest < prev_fast[-1] else
        "stable"
    )
    forecast = (
        "high-congestion" if fastest > 100 else
        "moderate"        if fastest > 30  else
        "low-fee"
    )

    return {
        "fee_percentiles":          [minimum, economy, hour, half_hr, fastest],
        "optimal_fee_rate_sat_vb":  half_hr,
        "avg_recent_block_fee":     round(avg_block_fee, 2),
        "blocks_to_difficulty_adj": blocks_to_adj,
        "neural_priority_score":    round(score_norm, 4),
        "fee_trend":                trend,
        "forecast":                 forecast,
    }


# ==============================================================================
# SECTION 17 - Extended ML: run_ml_v2 using NeuralNet3
# ==============================================================================

def run_ml_v2(
    blocks:       list,
    fees_rec:     dict,
    mempool:      dict,
    hashrate:     dict,
    price_hist:   list,
    prev_samples: list,
) -> dict:
    """
    Extended ML analysis using NeuralNet3 with all 10 input features.

    Produces a richer output dict covering neural score, fee trend,
    forecast, fee acceleration, optimal fee, confidence band, and
    difficulty-adjustment countdown.

    Args:
        blocks:       recent block list from mempool.space
        fees_rec:     fee-rate recommendations dict
        mempool:      current mempool stats dict
        hashrate:     7-day hashrate data dict
        price_hist:   list of {"timestamp", "usd"} price records
        prev_samples: list of previous fee sample dicts with "ts" key

    Returns extended ML analysis dict.
    """
    fastest  = float(fees_rec.get("fastestFee",  20) or 20)
    half_hr  = float(fees_rec.get("halfHourFee", 15) or 15)
    hour_f   = float(fees_rec.get("hourFee",     10) or 10)
    economy  = float(fees_rec.get("economyFee",   5) or 5)
    minimum  = float(fees_rec.get("minimumFee",   1) or 1)
    mem_cnt  = float(mempool.get("count",  10_000) or 10_000)
    mem_vsz  = float(mempool.get("vsize",  5_000_000) or 5_000_000)

    bt_analysis = analyse_block_times(blocks)
    avg_bt      = bt_analysis.get("avg_block_time_s", 600)

    current_hr  = float(hashrate.get("currentHashrate", 500e18) or 500e18)
    hr_eh       = current_hr / 1e18

    vol         = compute_price_volatility(price_hist)
    ann_vol_pct = vol.get("annualised_volatility_pct", 50.0) or 50.0

    x = [
        normalise(fastest,     1,   500),
        normalise(half_hr,     1,   500),
        normalise(hour_f,      1,   500),
        normalise(economy,     1,   200),
        normalise(minimum,     1,   100),
        normalise(mem_cnt,     0,   150_000),
        normalise(mem_vsz,     0,   100_000_000),
        normalise_block_time(avg_bt),
        normalise_hashrate(hr_eh),
        normalise(ann_vol_pct, 0,   300),
    ]

    net = NeuralNet3(seed=int(fastest * 13 + mem_cnt * 0.001) & 0xFFFFFF)
    rng = random.Random(int(fastest + mem_cnt) & 0xFFFF)

    for _ in range(NN_TRAINING_ITERS_V2):
        noise = [rng.gauss(0, 0.04) for _ in range(NN_INPUTS_V2)]
        xs    = [max(0.0, min(1.0, x[i] + noise[i])) for i in range(NN_INPUTS_V2)]
        congestion = xs[5] * 0.4 + xs[6] * 0.3 + xs[0] * 0.2 + xs[9] * 0.1
        net.sgd_step(xs, congestion, lr=0.03)

    raw_score  = net.forward(x)
    score_norm = max(0.0, min(1.0, (raw_score + 1.0) / 2.0))

    block_fees    = [float(b.get("extras", {}).get("medianFee", 0) or 0) for b in (blocks or [])[:6]]
    avg_block_fee = sum(block_fees) / max(len(block_fees), 1)
    height        = blocks[0].get("height", 0) if blocks else 0
    blocks_to_adj = 2016 - (height % 2016)

    prev_fast = [s.get("fees_recommended", {}).get("fastestFee", 0) for s in (prev_samples or [])]
    fee_trend = (
        "rising"  if len(prev_fast) >= 2 and fastest > prev_fast[-1] else
        "falling" if len(prev_fast) >= 2 and fastest < prev_fast[-1] else
        "stable"
    )
    forecast = (
        "high-congestion" if fastest > 100 else
        "moderate"        if fastest > 30  else
        "low-fee"
    )

    accel    = detect_fee_acceleration(prev_samples)
    velocity = accel.get("velocity_sat_vb_per_min", 0.0)

    predicted_next_fee = round(max(minimum, fastest + velocity * (avg_bt / 60.0)), 2)
    optimal_fee        = round(half_hr + score_norm * (fastest - half_hr) * 0.5, 2)

    confidence = 0.5
    if len(prev_fast) >= 3:
        try:
            std_f  = statistics.stdev(prev_fast[-5:])
            mean_f = statistics.mean(prev_fast[-5:])
            cv     = std_f / max(mean_f, 1)
            confidence = max(0.0, min(1.0, 1.0 - cv))
        except statistics.StatisticsError:
            confidence = 0.5

    return {
        "neural_priority_score":     round(score_norm, 4),
        "fee_trend":                 fee_trend,
        "forecast":                  forecast,
        "fee_acceleration":          accel.get("direction", "stable"),
        "fee_velocity_sat_min":      round(velocity, 4),
        "optimal_fee_sat_vb":        optimal_fee,
        "avg_recent_block_fee":      round(avg_block_fee, 2),
        "blocks_to_difficulty_adj":  blocks_to_adj,
        "predicted_next_fee":        predicted_next_fee,
        "confidence":                round(confidence, 4),
        "fee_percentiles":           [minimum, economy, hour_f, half_hr, fastest],
        "input_features":            [round(f, 4) for f in x],
        "block_time_analysis":       bt_analysis,
        "price_volatility":          vol,
    }


# ==============================================================================
# SECTION 18 - Profitability engine
# ==============================================================================

def compute_profitability(
    hashrate_ths:              float,
    power_watts:               float,
    electricity_cost_usd_kwh:  float,
    btc_price:                 float,
    network_hashrate:          float,
    block_reward_btc:          float,
) -> dict:
    """
    Compute comprehensive mining profitability metrics.

    Calculates daily BTC earned, daily revenue, electricity cost,
    net profit, ROI estimate, and an efficiency score.

    Args:
        hashrate_ths:             miner hashrate in TH/s
        power_watts:              miner power draw in watts
        electricity_cost_usd_kwh: electricity price per kWh
        btc_price:                current BTC/USD price
        network_hashrate:         total network hashrate in H/s
        block_reward_btc:         current full block reward (subsidy + fees) in BTC

    Returns dict with daily/monthly/annual figures plus ROI and efficiency.
    """
    _err = {
        "error": "invalid inputs", "daily_btc": 0.0,
        "daily_revenue_usd": 0.0, "daily_electricity_usd": 0.0,
        "daily_profit_usd": 0.0, "monthly_profit_usd": 0.0,
        "roi_days": 0, "efficiency_score": 0.0, "profitable": False,
    }
    if any(v <= 0 for v in [hashrate_ths, power_watts, btc_price, network_hashrate]):
        return _err

    miner_hs           = hashrate_ths * 1e12
    net_hs             = max(network_hashrate, 1.0)
    share              = miner_hs / net_hs
    blocks_per_day     = share * 144
    daily_btc          = blocks_per_day * block_reward_btc
    daily_revenue_usd  = daily_btc * btc_price
    kwh_per_day        = power_watts * 24 / 1000.0
    daily_elec_usd     = kwh_per_day * electricity_cost_usd_kwh
    daily_profit_usd   = daily_revenue_usd - daily_elec_usd
    monthly_profit_usd = daily_profit_usd * 30.0
    annual_profit_usd  = daily_profit_usd * 365.0
    revenue_per_kwh    = daily_revenue_usd / max(kwh_per_day, 0.001)

    if daily_elec_usd > 0:
        efficiency_score = min(100.0, (daily_revenue_usd / daily_elec_usd) * 30.0)
    else:
        efficiency_score = 100.0

    breakeven_price    = daily_elec_usd / daily_btc if daily_btc > 0 else 0.0
    hardware_cost_proxy = power_watts * 2.0
    roi_days = int(hardware_cost_proxy / daily_profit_usd) if daily_profit_usd > 0 else 0

    return {
        "hashrate_ths":          hashrate_ths,
        "power_watts":           power_watts,
        "electricity_cost_kwh":  electricity_cost_usd_kwh,
        "network_hashrate_eh":   round(net_hs / 1e18, 3),
        "miner_share_pct":       round(share * 100, 8),
        "blocks_per_day":        round(blocks_per_day, 6),
        "daily_btc":             round(daily_btc, 8),
        "daily_revenue_usd":     round(daily_revenue_usd, 4),
        "daily_electricity_usd": round(daily_elec_usd, 4),
        "daily_profit_usd":      round(daily_profit_usd, 4),
        "monthly_profit_usd":    round(monthly_profit_usd, 2),
        "annual_profit_usd":     round(annual_profit_usd, 2),
        "revenue_per_kwh_usd":   round(revenue_per_kwh, 4),
        "efficiency_score":      round(efficiency_score, 2),
        "breakeven_btc_price":   round(breakeven_price, 2),
        "roi_days":              roi_days,
        "profitable":            daily_profit_usd > 0,
        "btc_price_used":        btc_price,
    }


# ==============================================================================
# SECTION 19 - Anomaly detector
# ==============================================================================

def detect_anomalies(current_fees: dict, fee_history: list) -> dict:
    """
    Detect fee-rate and mempool size anomalies via z-score analysis.

    Flags a fee spike when the current fastest fee is > 3 standard
    deviations from the historical rolling mean.  Also flags a mempool
    spike when the current mempool count exceeds twice the 1-hour average.

    Args:
        current_fees: dict with "fastestFee", "hourFee", "mempool_count" keys
        fee_history:  list of historical fee dicts with the same keys

    Returns dict with fee_spike flag, z-score, mempool_spike flag,
    human-readable anomaly list, and severity level.
    """
    _default = {
        "fee_spike": False, "fee_z_score": 0.0, "mempool_spike": False,
        "anomalies": [], "severity": "normal", "mean_fee_hist": 0.0,
        "std_fee_hist": 0.0,
    }

    if not fee_history or len(fee_history) < 3:
        return _default

    current_fast = float(current_fees.get("fastestFee", 0) or 0)
    hist_fees    = [float(h.get("fastestFee", 0) or 0) for h in fee_history if h.get("fastestFee")]

    if len(hist_fees) < 3 or current_fast == 0:
        return _default

    try:
        mean_fee = statistics.mean(hist_fees)
        std_fee  = statistics.stdev(hist_fees)
    except statistics.StatisticsError:
        return _default

    z_score   = (current_fast - mean_fee) / max(std_fee, 0.001)
    fee_spike = abs(z_score) > 3.0
    anomalies = []

    if z_score > 3.0:
        anomalies.append(
            f"Fee spike: {current_fast:.1f} sat/vB is {z_score:.1f}σ above mean ({mean_fee:.1f})"
        )
    elif z_score < -3.0:
        anomalies.append(
            f"Fee crash: {current_fast:.1f} sat/vB is {abs(z_score):.1f}σ below mean"
        )

    mem_counts    = [float(h.get("mempool_count", 0) or 0) for h in fee_history[-12:] if h.get("mempool_count")]
    mempool_spike = False
    current_mem   = float(current_fees.get("mempool_count", 0) or 0)
    if mem_counts and len(mem_counts) >= 2 and current_mem > 0:
        try:
            avg_mem = statistics.mean(mem_counts)
            if avg_mem > 0 and current_mem > avg_mem * 2.0:
                mempool_spike = True
                anomalies.append(
                    f"Mempool spike: {int(current_mem):,} txs is >2x 1h avg ({int(avg_mem):,})"
                )
        except statistics.StatisticsError:
            pass

    current_hour = float(current_fees.get("hourFee", 0) or 0)
    if current_fast > 0 and current_hour > 0:
        spread = current_fast / current_hour
        if spread > 20:
            anomalies.append(f"Extreme fee spread: fastest ({current_fast:.0f}) is {spread:.0f}x hour fee")

    severity = "normal"
    if anomalies:
        severity = "critical" if abs(z_score) > 5.0 or mempool_spike else "warning"

    return {
        "fee_spike":      fee_spike,
        "fee_z_score":    round(z_score, 4),
        "mempool_spike":  mempool_spike,
        "anomalies":      anomalies,
        "severity":       severity,
        "mean_fee_hist":  round(mean_fee, 2),
        "std_fee_hist":   round(std_fee, 2),
    }


# ==============================================================================
# SECTION 20 - HistoryBuffer
# ==============================================================================

class HistoryBuffer:
    """
    Thread-safe persistent rolling history buffer backed by a JSON file.

    Trims to HISTORY_MAX_SAMPLES (288 = 24 h at 5-min intervals) on each
    append.  Provides dot-notation field extraction and rolling statistics.

    Usage:
        buf = HistoryBuffer()
        buf.append(sample_dict)
        mean_fee = buf.rolling_mean("fees_recommended.fastestFee", 12)
        buf.save()
    """

    def __init__(
        self,
        filepath:    str = HISTORY_FILE,
        max_samples: int = HISTORY_MAX_SAMPLES,
    ):
        self.filepath    = filepath
        self.max_samples = max_samples
        self._data: list = []
        self._lock       = threading.Lock()
        self._load()

    # ---- persistence ----------------------------------------------------------

    def _load(self):
        """Load existing history from JSON file if present."""
        try:
            if os.path.exists(self.filepath):
                with open(self.filepath, "r") as fh:
                    raw = json.load(fh)
                    if isinstance(raw, list):
                        self._data = raw
        except Exception as e:
            print(f"[WARN] HistoryBuffer load: {e}", file=sys.stderr)
            self._data = []

    def save(self):
        """Atomically persist the current buffer to disk."""
        try:
            os.makedirs(os.path.dirname(os.path.abspath(self.filepath)), exist_ok=True)
            with self._lock:
                with open(self.filepath, "w") as fh:
                    json.dump(self._data, fh)
        except Exception as e:
            print(f"[WARN] HistoryBuffer save: {e}", file=sys.stderr)

    # ---- mutation -------------------------------------------------------------

    def append(self, sample: dict):
        """Append a new sample and auto-trim if over capacity."""
        with self._lock:
            self._data.append(sample)
        self.trim(self.max_samples)

    def trim(self, max_n: int):
        """Discard oldest entries beyond max_n."""
        with self._lock:
            if len(self._data) > max_n:
                self._data = self._data[-max_n:]

    # ---- retrieval ------------------------------------------------------------

    def get_recent(self, n: int) -> list:
        """Return last n samples as a list copy (most-recent last)."""
        with self._lock:
            return list(self._data[-n:])

    def get_all(self) -> list:
        """Return entire buffer as a list copy."""
        with self._lock:
            return list(self._data)

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)

    # ---- rolling statistics ---------------------------------------------------

    def _get_field_values(self, field: str, n: int) -> list:
        """
        Extract numeric values for a (possibly dot-separated) field from
        the last n samples.  Silently skips missing or non-numeric entries.
        """
        samples = self.get_recent(n)
        values  = []
        for s in samples:
            parts = field.split(".")
            val   = s
            try:
                for p in parts:
                    val = val[p]
                if isinstance(val, (int, float)) and val is not None:
                    values.append(float(val))
            except (KeyError, TypeError):
                pass
        return values

    def rolling_mean(self, field: str, n: int) -> float:
        """Rolling arithmetic mean for `field` over last `n` samples."""
        vals = self._get_field_values(field, n)
        return round(statistics.mean(vals), 6) if vals else 0.0

    def rolling_std(self, field: str, n: int) -> float:
        """Rolling standard deviation for `field` over last `n` samples."""
        vals = self._get_field_values(field, n)
        if len(vals) < 2:
            return 0.0
        try:
            return round(statistics.stdev(vals), 6)
        except statistics.StatisticsError:
            return 0.0

    def rolling_min(self, field: str, n: int) -> float:
        """Rolling minimum for `field` over last `n` samples."""
        vals = self._get_field_values(field, n)
        return round(min(vals), 6) if vals else 0.0

    def rolling_max(self, field: str, n: int) -> float:
        """Rolling maximum for `field` over last `n` samples."""
        vals = self._get_field_values(field, n)
        return round(max(vals), 6) if vals else 0.0

    def get_price_history(self, n: int = HISTORY_MAX_SAMPLES) -> list:
        """Return list of {"timestamp", "usd"} dicts from history buffer."""
        samples = self.get_recent(n)
        out = []
        for s in samples:
            ts  = s.get("updated_at", "")
            usd = 0.0
            try:
                usd = float(s.get("price", {}).get("usd", 0) or 0)
            except (TypeError, ValueError):
                pass
            if usd > 0:
                out.append({"timestamp": ts, "usd": usd})
        return out

    def get_fee_history(self, n: int = HISTORY_MAX_SAMPLES) -> list:
        """Return list of fee dicts (for anomaly detection) from history buffer."""
        samples = self.get_recent(n)
        out = []
        for s in samples:
            fees  = s.get("fees_recommended", {}) or {}
            mpool = s.get("network", {}) or {}
            entry = dict(fees)
            entry["mempool_count"] = mpool.get("mempool_count", 0)
            out.append(entry)
        return out


# ==============================================================================
# SECTION 21 - Block reward helpers (original, extended)
# ==============================================================================

def block_subsidy_btc(height: int) -> float:
    """Return the block subsidy in BTC for the epoch containing `height`."""
    halvings = height // 210_000
    if halvings >= 64:
        return 0.0
    return 50.0 / (2 ** halvings)


def reward_info(height: int, total_fees_sat: int, price_usd: float) -> dict:
    """
    Compute full block reward info: subsidy, total reward, next halving.

    Args:
        height:         current block height
        total_fees_sat: total transaction fees in satoshis
        price_usd:      current BTC/USD price

    Returns dict with subsidy, total reward in BTC and USD, halving schedule.
    """
    halvings       = height // 210_000
    subsidy        = block_subsidy_btc(height)
    reward_btc     = subsidy + total_fees_sat / 1e8
    next_halving   = (halvings + 1) * 210_000
    blocks_to_halv = next_halving - height
    return {
        "halvings":                halvings,
        "block_subsidy_btc":       round(subsidy, 8),
        "total_block_reward_btc":  round(reward_btc, 8),
        "total_block_reward_usd":  round(reward_btc * price_usd, 2) if price_usd else 0,
        "next_halving_block":      next_halving,
        "blocks_to_halving":       blocks_to_halv,
    }


# ==============================================================================
# SECTION 22 - Parallel fetch infrastructure
# ==============================================================================

def _thread_fetch(results: dict, key: str, func, *args):
    """Thread worker: call func(*args), store result in shared dict under key."""
    try:
        results[key] = func(*args)
    except Exception as e:
        print(f"[WARN] thread '{key}': {e}", file=sys.stderr)
        results[key] = None


def _parallel_fetch(**fetch_specs) -> dict:
    """
    Dispatch multiple fetch functions concurrently using daemon threads.

    Each kwarg maps a result key to a tuple of (callable, *args).
    All threads are joined with a timeout of REQUEST_TIMEOUT + 5 seconds.

    Returns a dict mapping each key to its fetched value (or None on failure).
    """
    results = {}
    threads = []
    for key, spec in fetch_specs.items():
        func = spec[0]
        args = spec[1:]
        t    = threading.Thread(
            target=_thread_fetch,
            args=(results, key, func, *args),
            daemon=True,
        )
        threads.append(t)
        t.start()
    for t in threads:
        t.join(timeout=REQUEST_TIMEOUT + 5)
    return results


# ==============================================================================
# SECTION 23 - Extended collect()
# ==============================================================================

def collect(
    prev_samples:   list,
    history_buffer  = None,
    hashrate_ths:   float = 100.0,
    power_watts:    float = 3000.0,
    elec_cost:      float = 0.10,
) -> dict:
    """
    Fetch ALL data sources in parallel and merge into one enriched snapshot.

    Phase 1 parallel fetches: blocks, fees, mempool, recent txs, hashrate,
                               mempool projected blocks.
    Phase 2 parallel fetches: price (multi-source), fee histogram, lightning,
                               mining pools.

    Then runs both ML engines, all analysis functions, anomaly detection,
    profitability calculation, and assembles the final output dict.

    Args:
        prev_samples:   recent fee sample dicts with "ts" timestamp key
        history_buffer: optional HistoryBuffer for price/fee history
        hashrate_ths:   miner hashrate in TH/s (profitability)
        power_watts:    miner power draw in watts (profitability)
        elec_cost:      electricity cost USD/kWh (profitability)

    Returns the complete enriched data snapshot dict.
    """
    # Phase 1: primary network data
    primary = _parallel_fetch(
        blocks         = (fetch_with_retry, f"{API_BASE}/v1/blocks"),
        fees_rec       = (fetch_with_retry, f"{API_BASE}/v1/fees/recommended"),
        mempool        = (fetch_with_retry, f"{API_BASE}/mempool"),
        recent_txs     = (fetch_with_retry, f"{API_BASE}/mempool/recent"),
        hashrate       = (fetch_with_retry, f"{API_BASE}/v1/mining/hashrate/1w"),
        mempool_blocks = (fetch_with_retry, f"{API_BASE}/v1/fees/mempool-blocks"),
    )

    blocks         = primary.get("blocks")        or []
    fees_rec       = primary.get("fees_rec")       or {}
    mempool        = primary.get("mempool")        or {}
    recent_txs_raw = primary.get("recent_txs")     or []
    hashrate       = primary.get("hashrate")       or {}
    mempool_blocks = primary.get("mempool_blocks") or []

    # Phase 2: supplementary data
    secondary = _parallel_fetch(
        price         = (fetch_price_usd,),
        fee_histogram = (fetch_fee_histogram,),
        lightning     = (fetch_lightning_stats,),
        mining_pools  = (fetch_mining_pools,),
    )

    price_info    = secondary.get("price")         or {"usd": 0.0, "eur": 0.0, "gbp": 0.0, "source": "unavailable"}
    fee_histogram = secondary.get("fee_histogram") or {}
    lightning     = secondary.get("lightning")     or {}
    mining_pools  = secondary.get("mining_pools")  or {}

    latest    = blocks[0] if blocks else {}
    height    = latest.get("height", 0)
    price_usd = float(price_info.get("usd", 0) or 0)

    # Build recent-tx sample list
    txs = []
    for tx in (recent_txs_raw if isinstance(recent_txs_raw, list) else [])[:25]:
        if isinstance(tx, dict):
            txs.append({
                "txid":   (tx.get("txid") or "")[:16],
                "fee":    tx.get("fee",    0),
                "weight": tx.get("weight", 0),
                "value":  tx.get("value",  0),
            })

    # Historical context
    price_hist = []
    fee_hist   = []
    if history_buffer is not None:
        price_hist = history_buffer.get_price_history()
        fee_hist   = history_buffer.get_fee_history()

    # ML analysis
    ml_v1 = run_ml(blocks, fees_rec, mempool, prev_samples)
    ml_v2 = run_ml_v2(blocks, fees_rec, mempool, hashrate, price_hist, prev_samples)

    # Reward info
    total_fees_sat = int(latest.get("extras", {}).get("totalFees", 0) or 0)
    rew            = reward_info(height, total_fees_sat, price_usd)

    # Supplementary analyses
    block_time_analysis = analyse_block_times(blocks)
    mempool_clusters    = analyse_mempool_clusters(mempool_blocks)
    network_health      = compute_network_health(blocks, fees_rec, mempool, hashrate)
    supply_stats        = fetch_supply_stats(height)

    net_hashrate  = float(hashrate.get("currentHashrate", 500e18) or 500e18)
    block_reward  = rew.get("total_block_reward_btc", 3.125)
    profitability = compute_profitability(
        hashrate_ths, power_watts, elec_cost, price_usd, net_hashrate, block_reward,
    )

    anomalies         = detect_anomalies(
        dict(fees_rec, mempool_count=mempool.get("count", 0)),
        fee_hist,
    )
    fee_acceleration  = detect_fee_acceleration(prev_samples)
    price_volatility  = compute_price_volatility(price_hist)

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "network": {
            "height":          height,
            "difficulty":      latest.get("difficulty", 0),
            "hashrate_7d":     hashrate.get("currentHashrate", 0),
            "mempool_count":   mempool.get("count",     0),
            "mempool_vsize":   mempool.get("vsize",     0),
            "mempool_fee_sat": mempool.get("total_fee", 0),
        },
        "latest_block": {
            "id":                latest.get("id",           ""),
            "height":            height,
            "timestamp":         latest.get("timestamp",    0),
            "tx_count":          latest.get("tx_count",     0),
            "size":              latest.get("size",         0),
            "nonce":             latest.get("nonce",        0),
            "bits":              latest.get("bits",         ""),
            "version":           latest.get("version",      0),
            "merkle_root":       latest.get("merkle_root",  ""),
            "previousblockhash": latest.get("previousblockhash", ""),
            "medianFee":         latest.get("extras", {}).get("medianFee", 0),
            "totalFees":         total_fees_sat,
        },
        "fees_recommended":   fees_rec,
        "fee_histogram":      fee_histogram,
        "mempool_sample_txs": txs,
        "ml_analysis":        ml_v1,
        "ml_analysis_v2":     ml_v2,
        "price": {
            "usd":       price_usd,
            "eur":       price_info.get("eur", 0.0),
            "gbp":       price_info.get("gbp", 0.0),
            "source":    price_info.get("source", "unavailable"),
            "timestamp": price_info.get("timestamp", ""),
        },
        "rewards":             rew,
        "block_time_analysis": block_time_analysis,
        "mempool_clusters":    mempool_clusters,
        "network_health":      network_health,
        "supply_stats":        supply_stats,
        "lightning":           lightning,
        "mining_pools":        mining_pools,
        "profitability":       profitability,
        "anomalies":           anomalies,
        "fee_acceleration":    fee_acceleration,
        "price_volatility":    price_volatility,
        "hardware_config": {
            "hashrate_ths":  hashrate_ths,
            "power_watts":   power_watts,
            "elec_cost_kwh": elec_cost,
        },
    }


# ==============================================================================
# SECTION 24 - Run-summary helpers
# ==============================================================================

def compute_run_summary(samples: list) -> dict:
    """
    Compute aggregate statistics over all samples collected in a run.

    Extracts min/max/avg for fee tiers, price, neural score, mempool
    count, block height, and network health score.

    Args:
        samples: list of full data snapshot dicts from collect()

    Returns dict with per-field stats sub-dicts.
    """
    if not samples:
        return {}

    def _extract(field_path: str) -> list:
        parts = field_path.split(".")
        vals  = []
        for s in samples:
            v = s
            try:
                for p in parts:
                    v = v[p]
                if isinstance(v, (int, float)) and v is not None and v != 0:
                    vals.append(float(v))
            except (KeyError, TypeError):
                pass
        return vals

    def _stats(vals: list) -> dict:
        if not vals:
            return {"min": 0, "max": 0, "avg": 0, "count": 0}
        return {
            "min":   round(min(vals), 4),
            "max":   round(max(vals), 4),
            "avg":   round(statistics.mean(vals), 4),
            "count": len(vals),
        }

    return {
        "sample_count":  len(samples),
        "fastest_fee":   _stats(_extract("fees_recommended.fastestFee")),
        "half_hour_fee": _stats(_extract("fees_recommended.halfHourFee")),
        "hour_fee":      _stats(_extract("fees_recommended.hourFee")),
        "economy_fee":   _stats(_extract("fees_recommended.economyFee")),
        "price_usd":     _stats(_extract("price.usd")),
        "neural_score":  _stats(_extract("ml_analysis.neural_priority_score")),
        "mempool_count": _stats(_extract("network.mempool_count")),
        "block_height":  _stats(_extract("network.height")),
        "health_score":  _stats(_extract("network_health.score")),
    }


# ==============================================================================
# SECTION 25 - Rich console output
# ==============================================================================

_ANSI_RESET  = "\033[0m"
_ANSI_BOLD   = "\033[1m"
_ANSI_GREEN  = "\033[32m"
_ANSI_YELLOW = "\033[33m"
_ANSI_RED    = "\033[31m"
_ANSI_CYAN   = "\033[36m"
_ANSI_WHITE  = "\033[37m"

_USE_COLOR = sys.stdout.isatty()


def _col(text: str, code: str) -> str:
    """Wrap text in ANSI colour code if stdout is a TTY."""
    return f"{code}{text}{_ANSI_RESET}" if _USE_COLOR else text


def _fee_color(fee: float) -> str:
    """Return ANSI colour code appropriate for a fee level."""
    if fee > 100:
        return _ANSI_RED
    if fee > 30:
        return _ANSI_YELLOW
    return _ANSI_GREEN


def _grade_color(grade: str) -> str:
    """Return ANSI colour code for a health grade letter."""
    return {"A": _ANSI_GREEN, "B": _ANSI_GREEN, "C": _ANSI_YELLOW,
            "D": _ANSI_YELLOW, "F": _ANSI_RED}.get(grade, _ANSI_WHITE)


def print_sample_table(sample_n: int, data: dict):
    """
    Print a single-line per-sample status row.

    Columns: index | time | block height | BTC price | fast/half/hour fees |
             neural score | health grade | mempool count | trend | accel | anomaly
    """
    ts       = datetime.now(timezone.utc).strftime("%H:%M:%S")
    net      = data.get("network",          {})
    fees     = data.get("fees_recommended", {})
    ml       = data.get("ml_analysis_v2",   data.get("ml_analysis", {}))
    health   = data.get("network_health",   {})
    price    = data.get("price",            {})
    anom     = data.get("anomalies",        {})
    accel    = data.get("fee_acceleration", {})

    height   = net.get("height",       0)
    price_v  = price.get("usd",        0)
    fast     = fees.get("fastestFee",  0)
    half     = fees.get("halfHourFee", 0)
    hour     = fees.get("hourFee",     0)
    neural   = ml.get("neural_priority_score", 0)
    grade    = health.get("grade",     "?")
    h_score  = health.get("score",     0)
    mem_cnt  = net.get("mempool_count", 0)
    trend    = ml.get("fee_trend",     "?")
    anom_sev = anom.get("severity",    "normal")
    direction = accel.get("direction", "stable")

    anom_str = (
        _col(anom_sev.upper(), _ANSI_RED)    if anom_sev == "critical" else
        _col(anom_sev,         _ANSI_YELLOW) if anom_sev == "warning"  else
        _col(anom_sev,         _ANSI_GREEN)
    )

    fast_str  = _col(f"{fast:>4}", _fee_color(fast))
    half_str  = _col(f"{half:>4}", _fee_color(half))
    hour_str  = _col(f"{hour:>4}", _fee_color(hour))
    grade_str = _col(f"{grade}", _grade_color(grade))

    trend_sym = {"rising": "up", "falling": "dn", "stable": "--"}.get(trend, "?")
    accel_sym = {"accelerating": "^^", "decelerating": "vv", "stable": "~~"}.get(direction, "?")

    print(
        f"  [{_col(ts, _ANSI_CYAN)}] "
        f"#{sample_n:<3} "
        f"blk={_col(str(height), _ANSI_BOLD)} "
        f"${price_v:>8,.0f} "
        f"fees {fast_str}/{half_str}/{hour_str} sat/vB "
        f"neural={_col(f'{neural:.3f}', _ANSI_CYAN)} "
        f"health={grade_str}({h_score}) "
        f"mem={mem_cnt:>6,} "
        f"trend={trend}[{trend_sym}] "
        f"accel=[{accel_sym}] "
        f"anom={anom_str}",
        flush=True,
    )


def print_run_summary(summary: dict, samples: list):
    """
    Print a formatted end-of-run statistics summary table including
    min/max/avg for all fee tiers, price, neural score, mempool size,
    and network health.  Also shows last-sample metrics for supply,
    volatility, profitability, mining pools, and Lightning.
    """
    if not summary:
        return

    sep = "=" * 70
    print()
    print(_col(sep, _ANSI_BOLD))
    print(_col("  BITCOIN DATA FETCHER v2  -  RUN SUMMARY", _ANSI_BOLD))
    print(_col(sep, _ANSI_BOLD))

    n = summary.get("sample_count", 0)
    print(f"  Samples collected      : {n}")

    def _row(label: str, stats: dict, unit: str = ""):
        mn  = stats.get("min", 0)
        mx  = stats.get("max", 0)
        avg = stats.get("avg", 0)
        print(f"  {label:<24}  min={mn:>10.2f}  max={mx:>10.2f}  avg={avg:>10.2f}{unit}")

    print()
    print("  Fee rates (sat/vB):")
    _row("  Fastest",   summary.get("fastest_fee",   {}))
    _row("  Half-hour", summary.get("half_hour_fee", {}))
    _row("  Hour",      summary.get("hour_fee",      {}))
    _row("  Economy",   summary.get("economy_fee",   {}))
    print()
    _row("BTC price (USD)",     summary.get("price_usd",    {}), " USD")
    _row("Neural score",        summary.get("neural_score", {}))
    _row("Mempool tx count",    summary.get("mempool_count",{}))
    _row("Network health score",summary.get("health_score", {}), "/100")

    if samples:
        last   = samples[-1]
        health = last.get("network_health",   {})
        pools  = last.get("mining_pools",     {}).get("pools", [])
        lng    = last.get("lightning",        {})
        supply = last.get("supply_stats",     {})
        profit = last.get("profitability",    {})
        vol    = last.get("price_volatility", {})
        anom   = last.get("anomalies",        {})

        print()
        print(f"  Network health (last)  : {health.get('score',0)}/100  grade={health.get('grade','?')}")
        print(f"  Supply mined           : {supply.get('pct_mined',0):.4f}%  "
              f"({supply.get('mined_supply_btc',0):,.2f} BTC)")
        print(f"  Blocks to halving      : {supply.get('blocks_to_next_halving',0):,}")
        print(f"  Price volatility (ann) : {vol.get('annualised_volatility_pct',0):.1f}%")
        print(f"  Daily profit (100TH/s) : ${profit.get('daily_profit_usd',0):.4f}")
        print(f"  Profitable             : {profit.get('profitable', False)}")
        if anom.get("anomalies"):
            print(f"  Anomalies detected     : {len(anom['anomalies'])}")
        if pools:
            print(f"  Top mining pool        : {pools[0].get('name','?')} "
                  f"({pools[0].get('share_pct',0):.1f}%)")
        if lng.get("channel_count", 0):
            print(f"  Lightning channels     : {lng.get('channel_count',0):,}")

    print(_col(sep, _ANSI_BOLD))
    print()


# ==============================================================================
# SECTION 26 - Main loop
# ==============================================================================

def main():
    parser = ArgumentParser(description="Bitcoin real data fetcher + ML analyser v2")
    parser.add_argument(
        "--runtime",      type=int,   default=RUNTIME,
        help=f"Total run duration in seconds (default {RUNTIME})",
    )
    parser.add_argument(
        "--interval",     type=int,   default=SAMPLE_INTERVAL,
        help=f"Seconds between samples (default {SAMPLE_INTERVAL})",
    )
    parser.add_argument(
        "--hashrate-ths", type=float, default=100.0,
        help="Miner hashrate in TH/s for profitability calc (default 100)",
    )
    parser.add_argument(
        "--power-w",      type=float, default=3000.0,
        help="Miner power draw in watts (default 3000)",
    )
    parser.add_argument(
        "--elec-cost",    type=float, default=0.10,
        help="Electricity cost in USD/kWh (default 0.10)",
    )
    parser.add_argument(
        "--no-history",   action="store_true",
        help="Disable persistent history file accumulation",
    )
    args = parser.parse_args()

    os.makedirs(os.path.dirname(os.path.abspath(OUTPUT_FILE)),  exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(HISTORY_FILE)), exist_ok=True)

    history_buf = None
    if not args.no_history:
        history_buf = HistoryBuffer(HISTORY_FILE, HISTORY_MAX_SAMPLES)
        print(
            f"[INFO] History buffer: {len(history_buf)} existing samples "
            f"(max {HISTORY_MAX_SAMPLES})",
            file=sys.stderr,
        )

    deadline     = time.time() + args.runtime
    interval     = args.interval
    prev_samples = []
    all_samples  = []
    sample_n     = 0
    last_data    = None

    print(
        _col(
            f"Bitcoin Data Fetcher v2  runtime={args.runtime}s  "
            f"interval={interval}s  output={OUTPUT_FILE}",
            _ANSI_BOLD,
        )
    )
    print(
        f"Hardware: {args.hashrate_ths} TH/s  "
        f"{args.power_w} W  "
        f"${args.elec_cost:.3f}/kWh\n"
    )

    while time.time() < deadline:
        sample_n += 1
        ts_str = datetime.now(timezone.utc).strftime("%H:%M:%S")
        print(f"[{ts_str}] Collecting sample #{sample_n} ...", flush=True)

        try:
            data = collect(
                prev_samples   = prev_samples[-10:],
                history_buffer = history_buf,
                hashrate_ths   = args.hashrate_ths,
                power_watts    = args.power_w,
                elec_cost      = args.elec_cost,
            )
            last_data = data
            all_samples.append(data)

            prev_samples.append({
                "ts":               time.time(),
                "fees_recommended": data.get("fees_recommended", {}),
            })
            if len(prev_samples) > 30:
                prev_samples.pop(0)

            with open(OUTPUT_FILE, "w") as fh:
                json.dump(data, fh, indent=2)

            if history_buf is not None:
                history_sample = {
                    "updated_at":       data.get("updated_at", ""),
                    "fees_recommended": data.get("fees_recommended", {}),
                    "price":            data.get("price", {}),
                    "network":          data.get("network", {}),
                    "network_health":   data.get("network_health", {}),
                    "ml_analysis": {
                        k: v for k, v in data.get("ml_analysis", {}).items()
                        if not isinstance(v, list)
                    },
                }
                history_buf.append(history_sample)
                history_buf.save()

            print_sample_table(sample_n, data)

            for msg in data.get("anomalies", {}).get("anomalies", []):
                print(f"  [ANOMALY] {msg}", flush=True)

        except Exception as exc:
            import traceback
            print(f"  [ERROR] Sample #{sample_n}: {exc}", file=sys.stderr, flush=True)
            traceback.print_exc(file=sys.stderr)

        remaining = deadline - time.time()
        if remaining <= 0:
            break
        time.sleep(min(interval, remaining))

    summary = compute_run_summary(all_samples)
    print_run_summary(summary, all_samples)

    if last_data:
        net    = last_data.get("network",        {})
        health = last_data.get("network_health", {})
        print(
            f"Completed {sample_n} samples.  "
            f"Last block height: {net.get('height',0):,}  "
            f"Network health: {health.get('score',0)}/100 ({health.get('grade','?')})"
        )
    else:
        print("No data collected - API may be unreachable.", file=sys.stderr)
        sys.exit(1)


# ==============================================================================
# Entry point
# ==============================================================================

if __name__ == "__main__":
    main()
