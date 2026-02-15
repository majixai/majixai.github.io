#!/usr/bin/env python3
"""Git-directory two-level datastore pipeline.

Level 1 (simple): CSV files with minimal per-bar calculations.
Level 2 (extensive): compressed .dat blobs in a content-addressed object store,
                     with index manifests (Git-style object directory layout).

Usage:
  python yfinance_chart/github_datastore_pipeline.py --tickers SPY QQQ AAPL
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import lzma
import os
import time
from threading import Lock
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import requests
from scipy.signal import savgol_filter

from lightweight_pattern_chart import calculate_overlays_and_calculus, fetch_ohlcv


INDEX_WRITE_LOCK = Lock()


def ensure_dirs(base: Path) -> dict[str, Path]:
    level1 = base / "level1_csv"
    level2 = base / "level2_datastore"
    objects = level2 / "objects"
    manifests = level2 / "manifests"
    manifest_history = manifests / "history"
    plots = base / "plots"

    for directory in (level1, level2, objects, manifests, manifest_history, plots):
        directory.mkdir(parents=True, exist_ok=True)

    return {
        "base": base,
        "level1": level1,
        "level2": level2,
        "objects": objects,
        "manifests": manifests,
        "manifest_history": manifest_history,
        "plots": plots,
    }


def lite_calculations(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["ret_1"] = out["close"].pct_change().fillna(0.0)
    out["hl_spread"] = (out["high"] - out["low"]) / np.maximum(out["close"], 1e-9)
    out["oc_spread"] = (out["close"] - out["open"]) / np.maximum(out["open"], 1e-9)
    out["sma_10"] = out["close"].rolling(10).mean()
    out["vol_z20"] = (out["volume"] - out["volume"].rolling(20).mean()) / (
        out["volume"].rolling(20).std() + 1e-9
    )

    close_vals = out["close"].to_numpy(dtype=float)
    if len(close_vals) >= 9:
        window = 9 if len(close_vals) >= 9 else max(5, len(close_vals) // 2 * 2 + 1)
        out["scipy_savgol"] = savgol_filter(close_vals, window_length=window, polyorder=2)
    else:
        out["scipy_savgol"] = close_vals

    return out


def _read_last_csv_time(file_path: Path) -> pd.Timestamp | None:
    if not file_path.exists() or file_path.stat().st_size == 0:
        return None
    try:
        tail = pd.read_csv(file_path, usecols=["time"]).tail(1)
        if tail.empty:
            return None
        return pd.to_datetime(tail.iloc[0]["time"], errors="coerce")
    except Exception:
        return None


def write_level1_csv(df_lite: pd.DataFrame, ticker: str, period: str, interval: str, level1_dir: Path) -> tuple[Path, int]:
    file_name = f"{ticker}_{period}_{interval}_lite.csv"
    file_path = level1_dir / file_name
    export_cols = [
        "time",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "ret_1",
        "hl_spread",
        "oc_spread",
        "sma_10",
        "vol_z20",
        "scipy_savgol",
    ]
    df_export = df_lite[export_cols].copy().sort_values("time")

    last_ts = _read_last_csv_time(file_path)
    if last_ts is not None:
        df_export = df_export[pd.to_datetime(df_export["time"]) > last_ts]

    if df_export.empty:
        return file_path, 0

    df_export["time"] = df_export["time"].astype(str)
    write_header = not file_path.exists() or file_path.stat().st_size == 0
    df_export.to_csv(file_path, mode="a", header=write_header, index=False)
    return file_path, int(len(df_export))


def _blob_bytes(payload: dict) -> bytes:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return lzma.compress(raw, preset=9 | lzma.PRESET_EXTREME)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_level2_dat(
    ticker: str,
    period: str,
    interval: str,
    df_lite: pd.DataFrame,
    overlays,
    calculus: pd.DataFrame,
    objects_dir: Path,
    manifests_dir: Path,
    manifest_history_dir: Path,
) -> tuple[str, Path, Path]:
    now = datetime.now(timezone.utc).isoformat()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    overlays_payload = [asdict(item) for item in overlays]
    calculus_tail = calculus.tail(min(len(calculus), 250)).replace({np.nan: None}).to_dict(orient="records")

    payload = {
        "meta": {
            "ticker": ticker,
            "period": period,
            "interval": interval,
            "created_utc": now,
            "rows": int(len(df_lite)),
        },
        "lite_tail": df_lite.tail(min(len(df_lite), 500)).replace({np.nan: None}).assign(time=lambda x: x["time"].astype(str)).to_dict(orient="records"),
        "overlays": overlays_payload,
        "calculus_tail": calculus_tail,
    }

    blob = _blob_bytes(payload)
    digest = _sha256(blob)
    prefix, suffix = digest[:2], digest[2:]
    object_dir = objects_dir / prefix
    object_dir.mkdir(parents=True, exist_ok=True)
    object_path = object_dir / f"{suffix}.dat"
    if not object_path.exists():
        object_path.write_bytes(blob)

    manifest = {
        "run_id": run_id,
        "ticker": ticker,
        "period": period,
        "interval": interval,
        "object": f"objects/{prefix}/{suffix}.dat",
        "sha256": digest,
        "size": len(blob),
        "created_utc": now,
    }

    history_dir = manifest_history_dir / ticker
    history_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = history_dir / f"{run_id}_{ticker}_{period}_{interval}_{digest[:12]}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    index_path = manifests_dir / "index.csv"
    with INDEX_WRITE_LOCK:
        index_exists = index_path.exists()
        with index_path.open("a", newline="", encoding="utf-8") as fp:
            writer = csv.DictWriter(
                fp,
                fieldnames=["run_id", "ticker", "period", "interval", "object", "sha256", "size", "created_utc"],
            )
            if not index_exists:
                writer.writeheader()
            writer.writerow(manifest)

    return digest, object_path, manifest_path


def write_plot(df_lite: pd.DataFrame, ticker: str, plots_dir: Path) -> Path:
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(df_lite["time"], df_lite["close"], label="close", linewidth=1.2)
    ax.plot(df_lite["time"], df_lite["scipy_savgol"], label="savgol", linewidth=1.2)
    ax.set_title(f"{ticker} close vs Savitzky-Golay")
    ax.legend(loc="best")
    ax.grid(alpha=0.25)
    path = plots_dir / f"{ticker}_close_savgol.png"
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)
    return path


def process_ticker(ticker: str, period: str, interval: str, dirs: dict[str, Path]) -> dict:
    df = fetch_ohlcv(ticker=ticker, period=period, interval=interval)
    df_lite = lite_calculations(df)
    overlays, calculus = calculate_overlays_and_calculus(df, max_patterns=90, min_score=0.08)

    level1_path, appended_rows = write_level1_csv(df_lite, ticker, period, interval, dirs["level1"])
    digest, object_path, manifest_path = write_level2_dat(
        ticker=ticker,
        period=period,
        interval=interval,
        df_lite=df_lite,
        overlays=overlays,
        calculus=calculus,
        objects_dir=dirs["objects"],
        manifests_dir=dirs["manifests"],
        manifest_history_dir=dirs["manifest_history"],
    )
    plot_path = write_plot(df_lite, ticker, dirs["plots"])

    return {
        "ticker": ticker,
        "rows": int(len(df_lite)),
        "appended_rows": int(appended_rows),
        "patterns": int(len(overlays)),
        "sha256": digest,
        "csv": str(level1_path),
        "dat": str(object_path),
        "manifest": str(manifest_path),
        "plot": str(plot_path),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Two-level Git-directory datastore pipeline")
    parser.add_argument("--tickers", nargs="+", default=["SPY", "QQQ", "AAPL"], help="Ticker list")
    parser.add_argument("--period", default="6mo", help="yfinance period")
    parser.add_argument("--interval", default="1d", help="yfinance interval")
    parser.add_argument(
        "--base-dir",
        default="github_data",
        help="Base directory for datastore (default: github_data)",
    )
    parser.add_argument("--workers", type=int, default=max(2, (os.cpu_count() or 4) // 2), help="Parallel workers")
    parser.add_argument(
        "--git-add",
        action="store_true",
        help="Run git add on generated datastore paths",
    )
    parser.add_argument(
        "--loop-minutely",
        action="store_true",
        help="Run continuously every 60 seconds in append-only mode",
    )
    parser.add_argument(
        "--loop-seconds",
        type=int,
        default=60,
        help="Loop interval in seconds when --loop-minutely is enabled (default: 60)",
    )
    parser.add_argument(
        "--gas-webhook-url",
        default=os.environ.get("GAS_WEBHOOK_URL", ""),
        help="Google Apps Script webhook URL (or set GAS_WEBHOOK_URL).",
    )
    return parser.parse_args()


def maybe_git_add(base_dir: Path) -> None:
    os.system(f"git add {base_dir} yfinance_chart/github_datastore_pipeline.py yfinance_chart/README.md yfinance_chart/requirements.txt >/dev/null 2>&1")


def _git_value(command: str) -> str:
    value = os.popen(command).read().strip()
    return value or "unknown"


def send_gas_webhook(gas_webhook_url: str, payload: dict) -> bool:
    if not gas_webhook_url:
        return False

    try:
        response = requests.post(
            gas_webhook_url,
            json=payload,
            timeout=15,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        print(f"GAS webhook sent successfully: status={response.status_code}")
        return True
    except requests.RequestException as exc:
        print(f"GAS webhook failed: {exc}")
        return False


def run_once(args: argparse.Namespace, dirs: dict[str, Path]) -> list[dict]:
    summaries = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = [pool.submit(process_ticker, ticker, args.period, args.interval, dirs) for ticker in args.tickers]
        for future in as_completed(futures):
            summaries.append(future.result())

    summaries.sort(key=lambda x: x["ticker"])
    print("\nGenerated datastore artifacts:")
    for item in summaries:
        print(
            f"- {item['ticker']}: rows={item['rows']} appended={item['appended_rows']} "
            f"patterns={item['patterns']} sha={item['sha256'][:12]} csv={item['csv']} dat={item['dat']}"
        )

    summary_log = dirs["base"] / "summary_log.jsonl"
    run_utc = datetime.now(timezone.utc).isoformat()
    with summary_log.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps({"run_utc": run_utc, "items": summaries}) + "\n")
    print(f"Summary log appended: {summary_log}")

    if args.gas_webhook_url:
        git_meta = {
            "repo": _git_value("git rev-parse --show-toplevel | xargs basename"),
            "branch": _git_value("git rev-parse --abbrev-ref HEAD"),
            "commit": _git_value("git rev-parse HEAD"),
            "remote": _git_value("git config --get remote.origin.url"),
        }
        webhook_payload = {
            "event": "yfinance_datastore_run",
            "run_utc": run_utc,
            "git": git_meta,
            "base_dir": str(dirs["base"]),
            "tickers": args.tickers,
            "period": args.period,
            "interval": args.interval,
            "summary": summaries,
        }
        send_gas_webhook(args.gas_webhook_url, webhook_payload)

    return summaries


def main() -> None:
    args = parse_args()
    dirs = ensure_dirs(Path(args.base_dir))

    if args.loop_minutely:
        interval = max(1, args.loop_seconds)
        print(f"Starting append-only loop: every {interval}s")
        while True:
            run_once(args, dirs)
            if args.git_add:
                maybe_git_add(dirs["base"])
            time.sleep(interval)
    else:
        run_once(args, dirs)
        if args.git_add:
            maybe_git_add(dirs["base"])
            print("Staged generated files with git add")


if __name__ == "__main__":
    main()
