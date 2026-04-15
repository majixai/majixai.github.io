#!/usr/bin/env python3
"""
GitHub Actions runner for short-lived in-memory bitcoin miner sessions.
"""

from __future__ import annotations

import json
import importlib.util
import os
import re
import signal
import subprocess
import sys
import threading
import time
from hashlib import sha256
from argparse import ArgumentParser
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MINER_BIN = REPO_ROOT / "bitcoin_miner" / "miner"
HASHRATE_RE = re.compile(r"([0-9]+(?:\.[0-9]+)?)\s*H/s", re.IGNORECASE)


def _load_integrations() -> dict:
    status: dict[str, object] = {
        "tensor_financial": False,
        "neural_forecaster": False,
        "details": {},
    }
    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))

    try:
        import numpy as np  # noqa: PLC0415
        from tensor.financial import build_feature_matrix, compute_var  # noqa: PLC0415

        prices = np.linspace(65000.0, 66500.0, num=80, dtype=np.float64)
        features = build_feature_matrix(prices)
        var = compute_var(prices, confidence=0.95)
        status["tensor_financial"] = True
        status["details"]["tensor_financial"] = {
            "feature_shape": tuple(features.shape),
            "var_95": var.get("var"),
        }
    except Exception as exc:  # pragma: no cover - best-effort import path
        status["details"]["tensor_financial_error"] = str(exc)

    try:
        import numpy as np  # noqa: PLC0415

        module_path = REPO_ROOT / "yfinance_data" / "models" / "neural_forecaster.py"
        spec = importlib.util.spec_from_file_location("actions_neural_forecaster", module_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Unable to load neural forecaster module: {module_path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        NeuralForecaster = module.NeuralForecaster
        forecaster = NeuralForecaster(seq_len=5, n_features=7)
        close = np.array([1.0, 1.1, 1.2, 1.15, 1.22], dtype=np.float64)
        volume = np.array([10, 12, 11, 13, 12], dtype=np.float64)
        extracted = forecaster.extract_features(close=close, volume=volume)
        status["neural_forecaster"] = True
        status["details"]["neural_forecaster"] = {
            "feature_shape": tuple(extracted.shape),
        }
    except Exception as exc:  # pragma: no cover - best-effort import path
        status["details"]["neural_forecaster_error"] = str(exc)

    return status


def _stream_reader(stream, sink: list[str], stop_event: threading.Event) -> None:
    while not stop_event.is_set():
        line = stream.readline()
        if not line:
            break
        sink.append(line.rstrip("\n"))


def _terminate(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.send_signal(signal.SIGKILL)
        proc.wait(timeout=5)


def _in_memory_mine(seconds: int) -> dict:
    deadline = time.time() + max(1, seconds)
    base = os.urandom(76)
    nonce = 0
    total_hashes = 0
    best_prefix_zeros = 0

    while time.time() < deadline:
        block = base + nonce.to_bytes(4, "little", signed=False)
        digest = sha256(sha256(block).digest()).hexdigest()
        leading = len(digest) - len(digest.lstrip("0"))
        if leading > best_prefix_zeros:
            best_prefix_zeros = leading
        total_hashes += 1
        nonce = (nonce + 1) & 0xFFFFFFFF

    elapsed = max(0.001, seconds)
    return {
        "hashes": total_hashes,
        "hashrate_hs": round(total_hashes / elapsed, 2),
        "best_prefix_zeros": best_prefix_zeros,
    }


def run_mining_session(duration_seconds: int, threads: int, bits: str) -> dict:
    deadline = time.time() + duration_seconds
    output_lines: list[str] = []
    attempts = 0
    fallback = None

    while time.time() < deadline:
        attempts += 1
        start_idx = len(output_lines)
        proc = subprocess.Popen(
            [
                str(MINER_BIN),
                "--threads",
                str(threads),
                "--bits",
                bits,
                "--no-color",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(REPO_ROOT),
            bufsize=1,
        )
        assert proc.stdout is not None
        stop_event = threading.Event()
        reader = threading.Thread(
            target=_stream_reader,
            args=(proc.stdout, output_lines, stop_event),
            daemon=True,
        )
        reader.start()

        remaining = max(1, int(deadline - time.time()))
        try:
            proc.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            _terminate(proc)
        finally:
            stop_event.set()
            reader.join(timeout=2)

        recent_lines = output_lines[start_idx:]
        if any("sha-256 self-test failed" in ln.lower() for ln in recent_lines):
            remaining = int(max(1, deadline - time.time()))
            fallback = _in_memory_mine(remaining)
            break

        if time.time() < deadline:
            time.sleep(0.25)

    hash_rates = []
    for line in output_lines:
        match = HASHRATE_RE.search(line)
        if match:
            try:
                hash_rates.append(float(match.group(1)))
            except ValueError:
                pass

    return {
        "attempts": attempts,
        "line_count": len(output_lines),
        "max_hashrate_hs": max(hash_rates) if hash_rates else None,
        "fallback_in_memory": fallback,
        "last_lines": output_lines[-10:],
    }


def main() -> None:
    parser = ArgumentParser(description="Run bitcoin miner in-memory for GitHub Actions windows.")
    parser.add_argument("--duration-seconds", type=int, default=300)
    parser.add_argument("--slot", type=int, default=1)
    parser.add_argument("--threads", type=int, default=1)
    parser.add_argument("--bits", type=str, default="0x1d00ffff")
    args = parser.parse_args()

    if not MINER_BIN.exists():
        raise SystemExit(f"Miner binary not found: {MINER_BIN}")

    start = time.time()
    integrations = _load_integrations()
    mining = run_mining_session(
        duration_seconds=max(1, args.duration_seconds),
        threads=max(1, args.threads),
        bits=args.bits,
    )
    elapsed = round(time.time() - start, 2)

    result = {
        "slot": args.slot,
        "duration_seconds": args.duration_seconds,
        "elapsed_seconds": elapsed,
        "integrations": integrations,
        "mining": mining,
        "timestamp": int(time.time()),
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
