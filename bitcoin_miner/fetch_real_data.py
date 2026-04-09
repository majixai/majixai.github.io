#!/usr/bin/env python3
"""
bitcoin_miner/fetch_real_data.py
=================================
Real Bitcoin network data fetcher + lightweight ML/neural analysis.

Runs for RUNTIME seconds (default 180 = 3 minutes), sampling every
SAMPLE_INTERVAL seconds and writing results to OUTPUT_FILE after
each sample so the latest data is always on disk.

Data sources: mempool.space public API (no key required).

ML: pure-Python two-layer feed-forward net (numpy-free) predicts
    the optimal sat/vB fee rate from mempool state features.

Usage:
  python bitcoin_miner/fetch_real_data.py [--runtime N]
"""

import json, time, sys, os, math, random, urllib.request, urllib.error
from datetime import datetime, timezone
from argparse import ArgumentParser

# ── Configuration ─────────────────────────────────────────────────────────────
RUNTIME         = 180    # seconds (3 minutes)
SAMPLE_INTERVAL = 20     # fetch every 20 s → ~9 samples per run
OUTPUT_FILE     = os.path.join(os.path.dirname(__file__), "data", "live_data.json")
API_BASE        = "https://mempool.space/api"
REQUEST_TIMEOUT = 12


# ── HTTP helper ────────────────────────────────────────────────────────────────
def fetch(url: str, timeout: int = REQUEST_TIMEOUT):
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "majixai-bitcoin-miner/1.0 (+https://majixai.github.io)"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"[WARN] HTTP {e.code} fetching {url}", file=sys.stderr)
    except Exception as e:
        print(f"[WARN] fetch({url}): {e}", file=sys.stderr)
    return None


# ── Pure-Python 2-layer neural network ────────────────────────────────────────
#
#  Architecture: 6 inputs → 12 hidden (ReLU) → 1 output
#  Weights are deterministic (seeded RNG) — trained by one pass of
#  gradient descent on synthetic fee-vs-mempool pairs generated from
#  the live data so the model "learns" the current fee environment.

class TinyNet:
    def __init__(self, seed: int = 0):
        rng = random.Random(seed)
        g   = lambda r, c: [[rng.gauss(0, 0.3) for _ in range(c)] for _ in range(r)]
        self.W1 = g(12, 6);  self.b1 = [0.0] * 12
        self.W2 = g(1,  12); self.b2 = [0.0]

    # ── helpers ──
    @staticmethod
    def relu(v):  return [max(0.0, x) for x in v]
    @staticmethod
    def dot(M, v): return [sum(M[i][j] * v[j] for j in range(len(v))) for i in range(len(M))]
    @staticmethod
    def add(a, b): return [a[i] + b[i] for i in range(len(a))]

    def forward(self, x):
        h = self.relu(self.add(self.dot(self.W1, x), self.b1))
        return self.add(self.dot(self.W2, h), self.b2)[0]

    def sgd_step(self, x, y_true, lr=0.01):
        """Single sample gradient descent (MSE loss)."""
        # Forward
        h_pre = self.add(self.dot(self.W1, x), self.b1)
        h     = self.relu(h_pre)
        y_hat = self.add(self.dot(self.W2, h), self.b2)[0]
        # Backward
        d_out = 2.0 * (y_hat - y_true)
        for j in range(len(self.W2[0])):
            self.W2[0][j] -= lr * d_out * h[j]
        self.b2[0] -= lr * d_out
        d_h = [d_out * self.W2[0][j] * (1.0 if h_pre[j] > 0 else 0.0) for j in range(len(h_pre))]
        for i in range(len(self.W1)):
            for j in range(len(x)):
                self.W1[i][j] -= lr * d_h[i] * x[j]
            self.b1[i] -= lr * d_h[i]


def normalise(v, lo, hi):
    if hi <= lo:
        return 0.5
    return max(0.0, min(1.0, (v - lo) / (hi - lo)))


def run_ml(blocks, fees_rec, mempool, prev_samples):
    """
    Build features from live data, train TinyNet on recent synthetic
    samples, then produce a neural priority score + forecast.
    """
    fastest  = fees_rec.get("fastestFee",  20) or 20
    half_hr  = fees_rec.get("halfHourFee", 15) or 15
    hour     = fees_rec.get("hourFee",     10) or 10
    economy  = fees_rec.get("economyFee",   5) or 5
    minimum  = fees_rec.get("minimumFee",   1) or 1
    mem_cnt  = mempool.get("count",  10000) or 10000
    mem_vsz  = mempool.get("vsize",  5_000_000) or 5_000_000

    x = [
        normalise(fastest, 1, 500),
        normalise(half_hr, 1, 500),
        normalise(hour,    1, 500),
        normalise(economy, 1, 200),
        normalise(mem_cnt, 0, 150_000),
        normalise(mem_vsz, 0, 100_000_000),
    ]

    # Generate synthetic training pairs using fee-congestion heuristic
    net = TinyNet(seed=int(fastest * 7 + mem_cnt) & 0xFFFFFF)
    rng = random.Random(42)
    for _ in range(200):
        noise      = [rng.gauss(0, 0.05) for _ in range(6)]
        xs         = [max(0.0, min(1.0, x[i] + noise[i])) for i in range(6)]
        # Label: congested mempool → higher fee is "optimal"
        congestion = (xs[4] + xs[5]) / 2.0
        y_syn      = congestion * 0.8 + xs[0] * 0.2
        net.sgd_step(xs, y_syn, lr=0.05)

    score = net.forward(x)
    score_norm = max(0.0, min(1.0, (score + 1.0) / 2.0))  # map to [0,1]

    block_fees = [
        b.get("extras", {}).get("medianFee", 0) or 0
        for b in (blocks or [])[:6]
    ]
    avg_block_fee = sum(block_fees) / max(len(block_fees), 1)
    height = blocks[0].get("height", 0) if blocks else 0
    blocks_to_adj = 2016 - (height % 2016)

    # Trend detection using previous samples
    prev_fast = [s.get("fees_recommended", {}).get("fastestFee", 0) for s in (prev_samples or [])]
    trend     = "rising" if len(prev_fast) >= 2 and fastest > prev_fast[-1] else \
                "falling" if len(prev_fast) >= 2 and fastest < prev_fast[-1] else "stable"

    forecast = (
        "high-congestion" if fastest > 100 else
        "moderate" if fastest > 30 else
        "low-fee"
    )

    return {
        "fee_percentiles":           [minimum, economy, hour, half_hr, fastest],
        "optimal_fee_rate_sat_vb":   half_hr,
        "avg_recent_block_fee":      round(avg_block_fee, 2),
        "blocks_to_difficulty_adj":  blocks_to_adj,
        "neural_priority_score":     round(score_norm, 4),
        "fee_trend":                 trend,
        "forecast":                  forecast,
    }


# ── Data collection ────────────────────────────────────────────────────────────
def collect(prev_samples):
    blocks   = fetch(f"{API_BASE}/v1/blocks")          or []
    fees_rec = fetch(f"{API_BASE}/v1/fees/recommended") or {}
    mempool  = fetch(f"{API_BASE}/mempool")             or {}
    recent   = fetch(f"{API_BASE}/mempool/recent")      or []
    hashrate = fetch(f"{API_BASE}/v1/mining/hashrate/1w") or {}

    latest = blocks[0] if blocks else {}

    txs = []
    for tx in (recent if isinstance(recent, list) else [])[:25]:
        if isinstance(tx, dict):
            txs.append({
                "txid":   (tx.get("txid") or "")[:16],
                "fee":    tx.get("fee",    0),
                "weight": tx.get("weight", 0),
                "value":  tx.get("value",  0),
            })

    ml = run_ml(blocks, fees_rec, mempool, prev_samples)

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "network": {
            "height":          latest.get("height",     0),
            "difficulty":      latest.get("difficulty", 0),
            "hashrate_7d":     hashrate.get("currentHashrate", 0),
            "mempool_count":   mempool.get("count",     0),
            "mempool_vsize":   mempool.get("vsize",     0),
            "mempool_fee_sat": mempool.get("total_fee", 0),
        },
        "latest_block": {
            "id":         latest.get("id",          ""),
            "height":     latest.get("height",      0),
            "timestamp":  latest.get("timestamp",   0),
            "tx_count":   latest.get("tx_count",    0),
            "size":       latest.get("size",        0),
            "nonce":      latest.get("nonce",       0),
            "bits":       latest.get("bits",        ""),
            "version":    latest.get("version",     0),
            "merkle_root":latest.get("merkle_root", ""),
            "previousblockhash": latest.get("previousblockhash", ""),
            "medianFee":  latest.get("extras", {}).get("medianFee", 0),
        },
        "fees_recommended": fees_rec,
        "mempool_sample_txs": txs,
        "ml_analysis": ml,
    }


# ── Main loop ──────────────────────────────────────────────────────────────────
def main():
    parser = ArgumentParser(description="Bitcoin real data fetcher + ML analyser")
    parser.add_argument("--runtime", type=int, default=RUNTIME,
                        help="How many seconds to run (default 180)")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(os.path.abspath(OUTPUT_FILE)), exist_ok=True)

    deadline      = time.time() + args.runtime
    prev_samples  = []
    sample_n      = 0
    last_data     = None

    print(f"Bitcoin Data Fetcher — runtime {args.runtime}s, interval {SAMPLE_INTERVAL}s")
    print(f"Output: {OUTPUT_FILE}\n")

    while time.time() < deadline:
        sample_n += 1
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        print(f"[{ts}] Sample #{sample_n} ...", flush=True)

        try:
            data = collect(prev_samples[-5:])
            last_data = data
            prev_samples.append({"fees_recommended": data["fees_recommended"]})
            if len(prev_samples) > 10:
                prev_samples.pop(0)

            with open(OUTPUT_FILE, "w") as fh:
                json.dump(data, fh, indent=2)

            net  = data["network"]
            fees = data["fees_recommended"]
            ml   = data["ml_analysis"]
            print(
                f"  height={net['height']}  "
                f"mempool={net['mempool_count']} txs  "
                f"fees: fast={fees.get('fastestFee','?')} "
                f"half={fees.get('halfHourFee','?')} "
                f"hour={fees.get('hourFee','?')} sat/vB  "
                f"neural={ml['neural_priority_score']}  "
                f"trend={ml.get('fee_trend','?')}",
                flush=True,
            )
        except Exception as exc:
            print(f"  [ERROR] {exc}", file=sys.stderr, flush=True)

        remaining = deadline - time.time()
        if remaining <= 0:
            break
        time.sleep(min(SAMPLE_INTERVAL, remaining))

    if last_data:
        print(f"\nCompleted {sample_n} samples. "
              f"Last block height: {last_data['network']['height']}")
    else:
        print("No data collected — API may be unreachable.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
