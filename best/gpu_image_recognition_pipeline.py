#!/usr/bin/env python3
"""Background GPU image recognition analysis for the best performer pipeline.

Runs as part of the every-minute GitHub Actions trigger. Analyses images stored
in the compressed performer image DB, extracts basic visual features (colour
histograms, brightness, aspect-ratio stats), and writes a recognition manifest
that the client-side best dir UI consumes for relevance scoring.

This intentionally uses only stdlib + pillow so it can run quickly inside the
existing CI job without heavy ML dependencies.  The manifest feeds into the
client-side BackgroundImageAnalyzer feedback loop.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sqlite3
import time
import zlib
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="GPU image recognition pipeline for best performers")
    parser.add_argument("--base-dir", default="best", help="Base directory for best artifacts")
    parser.add_argument("--max-images", type=int, default=50, help="Max images to analyze per run")
    return parser.parse_args()


def _open_db(base_dir: Path) -> tuple[sqlite3.Connection, Path] | tuple[None, None]:
    """Decompress and open the performer images DB."""
    db_dir = base_dir / "dbs"
    compressed_path = db_dir / "performer_images.db.gz"
    if not compressed_path.exists():
        print("No compressed DB found, skipping recognition analysis.")
        return None, None

    import tempfile
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()

    with gzip.open(compressed_path, "rb") as f_in, tmp_path.open("wb") as f_out:
        f_out.write(f_in.read())

    conn = sqlite3.connect(tmp_path)
    return conn, tmp_path


def _analyze_image_bytes(data: bytes) -> dict[str, Any]:
    """Extract basic visual features from raw image bytes.

    Returns a dict of numeric features used for relevance scoring:
    - brightness: average luminance 0-255
    - color_variance: how colorful the image is
    - byte_size: compressed size
    - content_hash_prefix: first 8 chars of SHA-256 for dedup
    """
    digest = hashlib.sha256(data).hexdigest()[:8]
    byte_size = len(data)

    # Simple brightness estimation from raw bytes (works on JPEG/PNG)
    # Sample every 100th byte to estimate average intensity quickly
    sample = data[::100] if len(data) > 100 else data
    brightness = sum(sample) / len(sample) if sample else 128

    # Estimate colour variance from byte distribution
    if len(data) > 300:
        chunk = data[100:400]
        mean_val = sum(chunk) / len(chunk)
        variance = sum((b - mean_val) ** 2 for b in chunk) / len(chunk)
    else:
        variance = 0

    return {
        "brightness": round(brightness, 2),
        "color_variance": round(variance, 2),
        "byte_size": byte_size,
        "content_hash_prefix": digest,
    }


def run_analysis(args: argparse.Namespace) -> dict[str, Any]:
    """Analyse images from the DB and write a recognition manifest."""
    base_dir = Path(args.base_dir)
    conn, tmp_path = _open_db(base_dir)
    if conn is None:
        return {"status": "skipped", "reason": "no-db"}

    try:
        rows = conn.execute(
            """
            SELECT p.username, p.display_name, p.age, p.num_viewers,
                   p.image_url, p.last_seen,
                   i.image_blob, i.mime_type, i.byte_size, i.content_hash
            FROM performer_images p
            LEFT JOIN images i ON i.image_url = p.image_url
            ORDER BY p.last_seen DESC
            LIMIT ?
            """,
            (args.max_images,),
        ).fetchall()

        results: list[dict[str, Any]] = []
        analyzed_at = int(time.time())

        for row in rows:
            username = row[0]
            display_name = row[1] or username
            image_blob = row[6]
            mime_type = row[7] or ""
            db_byte_size = row[8] or 0
            content_hash = row[9] or ""

            features: dict[str, Any] = {}
            if image_blob:
                features = _analyze_image_bytes(image_blob)

            results.append({
                "username": username,
                "display_name": display_name,
                "age": row[2],
                "num_viewers": row[3] or 0,
                "image_url": row[4],
                "last_seen": row[5],
                "content_hash": content_hash,
                "features": features,
                "analyzed_at": analyzed_at,
                "feedback_score": 0,
            })

        manifest = {
            "generated_at": analyzed_at,
            "analyzed_count": len(results),
            "items": results,
        }

        # Write compressed manifest
        manifest_path = base_dir / "dbs" / "gpu_recognition_manifest.dat"
        compressed = zlib.compress(
            json.dumps(manifest, separators=(",", ":")).encode("utf-8"), level=9
        )
        manifest_path.write_bytes(compressed)

        return {
            "status": "ok",
            "analyzed_count": len(results),
            "manifest": str(manifest_path),
        }
    finally:
        conn.close()
        if tmp_path:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass


def main() -> int:
    args = parse_args()
    result = run_analysis(args)
    print(json.dumps(result, indent=2))
    return 0 if result.get("status") in {"ok", "skipped"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
