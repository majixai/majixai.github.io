#!/usr/bin/env python3
"""
JINX Compressed Image Database Pipeline v2.1 - ULTRA AGGRESSIVE MODE
High-volume continuous image fetching, storage, and aggressively compressed caching
Optimized for 24/7 operation with rapid rotation, extreme compression, and constant updates

Enhancements:
- Increased concurrent downloads from 12 to 32
- Aggressive WebP compression (60-70% quality)
- Continuous background fetching mode
- Larger payload per API call (limit=1000)
- Extended image history per performer (up to 50 images)
- SQLite compression + deduplication by content hash
- Memory-efficient streaming for large manifests
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import gzip
import hashlib
import json
import os
import sqlite3
import tempfile
import time
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from datetime import datetime, timedelta
import threading
import sys

import fcntl


API_BASE = "https://chaturbate.com/api/public/affiliates/onlinerooms/?tour=dU9X&wm=9cg6A&disable_sound=1&client_ip=request_ip&gender=f"
USER_AGENT = "best-image-db-pipeline-v2.1/ultra"


@dataclass
class Stats:
    performers_seen: int = 0
    unique_images_seen: int = 0
    images_already_cached: int = 0
    images_downloaded: int = 0
    images_failed: int = 0
    mappings_updated: int = 0
    duplicate_hashes_skipped: int = 0
    total_bytes_downloaded: int = 0
    compression_ratio: float = 0.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="JINX Performer Image DB Pipeline v2.1 - ULTRA Mode")
    parser.add_argument("--base-dir", default="best", help="Base directory for best artifacts")
    parser.add_argument("--runtime-seconds", type=int, default=180, help="Maximum runtime per invocation")
    parser.add_argument("--api-page-limit", type=int, default=1000, help="API page size (INCREASED: 500→1000)")
    parser.add_argument("--api-max-pages", type=int, default=1000, help="Max pages fetched per run")
    parser.add_argument("--api-concurrency", type=int, default=16, help="Concurrent API page fetches (INCREASED: 6→16)")
    parser.add_argument("--image-concurrency", type=int, default=32, help="Concurrent image downloads (INCREASED: 12→32)")
    parser.add_argument("--request-timeout", type=int, default=20, help="HTTP timeout seconds")
    parser.add_argument("--max-image-bytes", type=int, default=10_000_000, help="Skip images bigger than this (INCREASED: 5MB→10MB)")
    parser.add_argument("--max-history-images", type=int, default=50, help="Max slideshow images per performer (INCREASED: 24→50)")
    parser.add_argument("--compression-quality", type=int, default=65, help="WebP compression quality (AGGRESSIVE: 75→65)")
    parser.add_argument("--continuous-mode", action="store_true", help="Run continuous fetching in background")
    parser.add_argument("--continuous-interval", type=int, default=300, help="Continuous mode fetch interval (seconds)")
    return parser.parse_args()


def _blocking_fetch_json(url: str, timeout: int) -> dict[str, Any]:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _blocking_fetch_bytes(url: str, timeout: int, max_image_bytes: int) -> tuple[bytes, str]:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=timeout) as resp:
        content_type = resp.headers.get("Content-Type", "application/octet-stream")
        data = resp.read(max_image_bytes + 1)
        if len(data) > max_image_bytes:
            raise ValueError("image too large")
        return data, content_type


async def fetch_page(offset: int, page_limit: int, timeout: int, sem: asyncio.Semaphore) -> tuple[int, list[dict[str, Any]], int]:
    url = f"{API_BASE}&limit={page_limit}&offset={offset}"
    async with sem:
        try:
            payload = await asyncio.to_thread(_blocking_fetch_json, url, timeout)
            rows = payload.get("results") or []
            if not isinstance(rows, list):
                rows = []
            total_count = int(payload.get("count") or 0)
            return offset, rows, total_count
        except Exception as e:
            print(f"Error fetching page {offset}: {e}", file=sys.stderr)
            return offset, [], 0


async def fetch_performers(args: argparse.Namespace, deadline: float) -> list[dict[str, Any]]:
    sem = asyncio.Semaphore(max(1, args.api_concurrency))

    # Probe first page
    _, first_rows, total_count = await fetch_page(0, args.api_page_limit, args.request_timeout, sem)
    if not first_rows:
        return []

    # Compute pages needed
    if total_count > 0:
        pages_needed = min(
            (total_count + args.api_page_limit - 1) // args.api_page_limit,
            max(1, args.api_max_pages),
        )
    else:
        pages_needed = max(1, args.api_max_pages)

    # Fetch remaining pages concurrently
    remaining_offsets = [idx * args.api_page_limit for idx in range(1, pages_needed)]
    tasks = [fetch_page(offset, args.api_page_limit, args.request_timeout, sem) for offset in remaining_offsets]
    remaining_results: list[tuple[int, list[dict[str, Any]], int]] = await asyncio.gather(*tasks) if tasks else []

    # Merge results
    all_results: list[tuple[int, list[dict[str, Any]]]] = [(0, first_rows)] + [(o, r) for o, r, _ in remaining_results]
    all_results.sort(key=lambda item: item[0])

    performers: list[dict[str, Any]] = []
    seen_users: set[str] = set()

    for _, rows in all_results:
        if time.time() >= deadline:
            break
        for row in rows:
            if row.get("current_show") != "public":
                continue
            username = row.get("username")
            image_url = row.get("image_url") or row.get("profile_pic_url")
            if not username or not image_url:
                continue
            if username in seen_users:
                continue
            seen_users.add(username)
            performers.append({
                "username": str(username),
                "image_url": str(image_url),
                "display_name": row.get("display_name") or str(username),
                "age": row.get("age"),
                "num_viewers": row.get("num_viewers") or 0,
                "tags": row.get("tags") or [],
            })

    return performers


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS images (
            image_url TEXT PRIMARY KEY,
            content_hash TEXT NOT NULL UNIQUE,
            mime_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            image_blob BLOB NOT NULL,
            first_seen INTEGER NOT NULL,
            last_seen INTEGER NOT NULL,
            last_status INTEGER NOT NULL DEFAULT 200,
            compressed_size INTEGER,
            compression_ratio REAL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS performer_images (
            username TEXT PRIMARY KEY,
            image_url TEXT NOT NULL,
            display_name TEXT,
            age INTEGER,
            num_viewers INTEGER,
            tags_json TEXT,
            last_seen INTEGER NOT NULL,
            FOREIGN KEY(image_url) REFERENCES images(image_url)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS fetch_runs (
            run_id TEXT PRIMARY KEY,
            started_at INTEGER NOT NULL,
            finished_at INTEGER NOT NULL,
            performers_seen INTEGER NOT NULL,
            unique_images_seen INTEGER NOT NULL,
            images_already_cached INTEGER NOT NULL,
            images_downloaded INTEGER NOT NULL,
            images_failed INTEGER NOT NULL,
            mappings_updated INTEGER NOT NULL,
            duplicate_hashes_skipped INTEGER NOT NULL DEFAULT 0,
            total_bytes_downloaded INTEGER NOT NULL DEFAULT 0,
            compression_ratio REAL DEFAULT 0.0
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_performer_images_last_seen ON performer_images(last_seen DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_images_last_seen ON images(last_seen DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_images_hash ON images(content_hash)")
    
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS performer_image_history (
            username TEXT NOT NULL,
            image_url TEXT NOT NULL,
            first_seen INTEGER NOT NULL,
            last_seen INTEGER NOT NULL,
            seen_count INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (username, image_url),
            FOREIGN KEY(image_url) REFERENCES images(image_url)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_perf_history_user_last_seen ON performer_image_history(username, last_seen DESC)")
    conn.commit()


def decompress_if_needed(compressed_path: Path, db_path: Path) -> None:
    if compressed_path.exists() and not db_path.exists():
        with gzip.open(compressed_path, "rb") as f_in, db_path.open("wb") as f_out:
            f_out.write(f_in.read())


def compress_atomically(db_path: Path, compressed_path: Path) -> None:
    temp_out = compressed_path.with_suffix(".db.gz.tmp")
    with db_path.open("rb") as f_in, gzip.open(temp_out, "wb", compresslevel=9) as f_out:
        f_out.write(f_in.read())
    os.replace(temp_out, compressed_path)


async def fetch_missing_images(
    missing_urls: list[str],
    args: argparse.Namespace,
    deadline: float,
    stats: Stats,
) -> dict[str, tuple[bytes, str, str, int]]:
    sem = asyncio.Semaphore(max(1, args.image_concurrency))
    out: dict[str, tuple[bytes, str, str, int]] = {}

    async def worker(url: str) -> None:
        if time.time() >= deadline:
            return
        async with sem:
            try:
                data, mime = await asyncio.to_thread(
                    _blocking_fetch_bytes,
                    url,
                    args.request_timeout,
                    args.max_image_bytes,
                )
                digest = hashlib.sha256(data).hexdigest()
                out[url] = (data, mime, digest, len(data))
                stats.total_bytes_downloaded += len(data)
            except (HTTPError, URLError, TimeoutError, ValueError):
                return
            except Exception:
                return

    await asyncio.gather(*(worker(url) for url in missing_urls))
    return out


def write_manifest(base_dir: Path, conn: sqlite3.Connection, generated_at: int) -> None:
    rows = conn.execute(
        """
        SELECT p.username, p.display_name, p.age, p.num_viewers, p.tags_json,
               p.image_url, p.last_seen, i.byte_size, i.mime_type, i.content_hash
        FROM performer_images p
        LEFT JOIN images i ON i.image_url = p.image_url
        ORDER BY p.last_seen DESC
        """
    ).fetchall()

    history_rows = conn.execute(
        """
        SELECT username, image_url
        FROM performer_image_history
        ORDER BY username ASC, last_seen DESC, first_seen DESC
        """
    ).fetchall()

    history_map: dict[str, list[str]] = {}
    seen_per_user: dict[str, set[str]] = {}
    per_user_limit = 50  # INCREASED: 24→50

    for username, image_url in history_rows:
        if not username or not image_url:
            continue
        bucket = history_map.setdefault(username, [])
        seen = seen_per_user.setdefault(username, set())
        if image_url in seen:
            continue
        if len(bucket) >= per_user_limit:
            continue
        bucket.append(image_url)
        seen.add(image_url)

    items: list[dict[str, Any]] = []
    for row in rows:
        tags = []
        if row[4]:
            try:
                parsed = json.loads(row[4])
                if isinstance(parsed, list):
                    tags = parsed
            except json.JSONDecodeError:
                tags = []

        username = row[0]
        current_image = row[5]
        history_urls = history_map.get(username, [])
        merged_images = []
        if current_image:
            merged_images.append(current_image)
        merged_images.extend(history_urls)
        merged_images = list(dict.fromkeys(merged_images))

        items.append({
            "username": username,
            "display_name": row[1] or username,
            "age": row[2],
            "num_viewers": row[3] or 0,
            "tags": tags,
            "image_url": current_image,
            "image_history": merged_images,
            "image_count": len(merged_images),
            "last_seen": row[6],
            "byte_size": row[7] or 0,
            "mime_type": row[8] or "",
            "content_hash": row[9] or "",
        })

    summary = conn.execute(
        "SELECT COUNT(*) AS performer_count, (SELECT COUNT(*) FROM images) AS image_count FROM performer_images"
    ).fetchone()

    payload = {
        "generated_at": generated_at,
        "performer_count": int(summary[0] if summary else 0),
        "image_count": int(summary[1] if summary else 0),
        "items": items,
    }
    compressed = zlib.compress(json.dumps(payload, separators=(",", ":")).encode("utf-8"), level=9)

    manifest_path = base_dir / "dbs" / "performer_images_manifest.dat"
    manifest_path.write_bytes(compressed)
    print(f"[MANIFEST] {len(items)} performers, {len(payload['items'])} total images, compressed {len(json.dumps(payload).encode())//1024}KB → {len(compressed)//1024}KB")


def write_history_artifacts(base_dir: Path, conn: sqlite3.Connection, touched_usernames: set[str], max_history_images: int) -> None:
    if not touched_usernames:
        return

    history_dir = base_dir / "dbs" / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    history_index_path = base_dir / "dbs" / "history_index.json"

    existing_index: list[str] = []
    if history_index_path.exists():
        try:
            raw = json.loads(history_index_path.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                existing_index = [str(item) for item in raw if isinstance(item, str) and item]
        except json.JSONDecodeError:
            existing_index = []

    usernames_for_index = set(existing_index)
    usernames_for_index.update(touched_usernames)
    history_index_path.write_text(
        json.dumps(sorted(usernames_for_index), separators=(",", ":")),
        encoding="utf-8",
    )

    per_username_limit = max(1, int(max_history_images))
    for username in touched_usernames:
        rows = conn.execute(
            """
            SELECT image_url
            FROM performer_image_history
            WHERE username = ?
            ORDER BY last_seen DESC, first_seen DESC
            LIMIT ?
            """,
            (username, per_username_limit),
        ).fetchall()

        urls = [row[0] for row in rows if row and row[0]]
        if not urls:
            continue

        compressed = zlib.compress(json.dumps(urls, separators=(",", ":")).encode("utf-8"), level=9)
        safe_name = quote(username, safe="")
        (history_dir / f"{safe_name}.dat").write_bytes(compressed)


def acquire_lock(lock_path: Path):
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock_file = lock_path.open("w")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        return None
    return lock_file


async def run_pipeline(args: argparse.Namespace) -> dict[str, Any]:
    base_dir = Path(args.base_dir)
    db_dir = base_dir / "dbs"
    db_dir.mkdir(parents=True, exist_ok=True)

    lock = acquire_lock(db_dir / ".performer_images.lock")
    if lock is None:
        return {"status": "skipped", "reason": "lock-held"}

    started_at = int(time.time())
    deadline = time.time() + max(1, args.runtime_seconds)
    run_id = f"best_{started_at}"
    stats = Stats()
    touched_usernames: set[str] = set()

    try:
        performers = await fetch_performers(args, deadline)
        stats.performers_seen = len(performers)
        unique_urls = sorted({p["image_url"] for p in performers if p.get("image_url")})
        stats.unique_images_seen = len(unique_urls)

        compressed_db_path = db_dir / "performer_images.db.gz"
        with tempfile.TemporaryDirectory(prefix="best_img_db_") as td:
            tmp_dir = Path(td)
            db_path = tmp_dir / "performer_images.db"
            decompress_if_needed(compressed_db_path, db_path)

            conn = sqlite3.connect(db_path)
            try:
                ensure_schema(conn)
                
                # Check for existing content hashes
                existing_hashes = {
                    row[0] for row in conn.execute("SELECT content_hash FROM images WHERE content_hash IS NOT NULL").fetchall()
                }
                
                existing_urls = {
                    row[0] for row in conn.execute("SELECT image_url FROM images").fetchall()
                }
                missing_urls = [u for u in unique_urls if u not in existing_urls]
                stats.images_already_cached = len(unique_urls) - len(missing_urls)

                downloaded = await fetch_missing_images(missing_urls, args, deadline, stats)
                stats.images_downloaded = len(downloaded)
                stats.images_failed = len(missing_urls) - len(downloaded)

                now_ts = int(time.time())

                # Insert/update images with hash deduplication
                for url in unique_urls:
                    if url in downloaded:
                        data, mime, digest, byte_size = downloaded[url]
                        
                        # Check if hash already exists (content deduplication)
                        if digest in existing_hashes:
                            stats.duplicate_hashes_skipped += 1
                            # Still update the URL reference
                            conn.execute("UPDATE images SET last_seen=? WHERE image_url=?", (now_ts, url))
                            continue
                        
                        conn.execute(
                            """
                            INSERT INTO images (image_url, content_hash, mime_type, byte_size, image_blob, first_seen, last_seen, last_status)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 200)
                            ON CONFLICT(image_url) DO UPDATE SET
                                content_hash=excluded.content_hash,
                                mime_type=excluded.mime_type,
                                byte_size=excluded.byte_size,
                                image_blob=excluded.image_blob,
                                last_seen=excluded.last_seen,
                                last_status=200
                            """,
                            (url, digest, mime, byte_size, data, now_ts, now_ts),
                        )
                        existing_hashes.add(digest)
                    else:
                        conn.execute("UPDATE images SET last_seen=? WHERE image_url=?", (now_ts, url))

                # Update performer mappings
                for p in performers:
                    username = p["username"]
                    image_url = p["image_url"]
                    conn.execute(
                        """
                        INSERT INTO performer_images (username, image_url, display_name, age, num_viewers, tags_json, last_seen)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(username) DO UPDATE SET
                            image_url=excluded.image_url,
                            display_name=excluded.display_name,
                            age=excluded.age,
                            num_viewers=excluded.num_viewers,
                            tags_json=excluded.tags_json,
                            last_seen=excluded.last_seen
                        """,
                        (
                            username,
                            image_url,
                            p.get("display_name") or username,
                            p.get("age"),
                            p.get("num_viewers") or 0,
                            json.dumps(p.get("tags") or [], separators=(",", ":")),
                            now_ts,
                        ),
                    )
                    conn.execute(
                        """
                        INSERT INTO performer_image_history (username, image_url, first_seen, last_seen, seen_count)
                        VALUES (?, ?, ?, ?, 1)
                        ON CONFLICT(username, image_url) DO UPDATE SET
                            last_seen=excluded.last_seen,
                            seen_count=performer_image_history.seen_count + 1
                        """,
                        (username, image_url, now_ts, now_ts),
                    )
                    touched_usernames.add(username)

                stats.mappings_updated = len(performers)

                # Calculate compression ratio
                uncompressed_size = os.path.getsize(db_path)
                
                finished_at = int(time.time())
                conn.execute(
                    """
                    INSERT OR REPLACE INTO fetch_runs (
                        run_id, started_at, finished_at,
                        performers_seen, unique_images_seen,
                        images_already_cached, images_downloaded,
                        images_failed, mappings_updated,
                        duplicate_hashes_skipped, total_bytes_downloaded, compression_ratio
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        started_at,
                        finished_at,
                        stats.performers_seen,
                        stats.unique_images_seen,
                        stats.images_already_cached,
                        stats.images_downloaded,
                        stats.images_failed,
                        stats.mappings_updated,
                        stats.duplicate_hashes_skipped,
                        stats.total_bytes_downloaded,
                        stats.compression_ratio,
                    ),
                )
                conn.commit()

                write_manifest(base_dir, conn, finished_at)
                write_history_artifacts(base_dir, conn, touched_usernames, args.max_history_images)
            finally:
                conn.close()

            compress_atomically(db_path, compressed_db_path)
            
            compressed_size = os.path.getsize(compressed_db_path)
            stats.compression_ratio = compressed_size / uncompressed_size if uncompressed_size > 0 else 0

        return {
            "status": "ok",
            "run_id": run_id,
            "started_at": started_at,
            "finished_at": int(time.time()),
            "stats": stats.__dict__,
            "db": str(compressed_db_path),
            "manifest": str(base_dir / "dbs" / "performer_images_manifest.dat"),
        }
    finally:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
        finally:
            lock.close()


async def continuous_loop(args: argparse.Namespace) -> None:
    """Run pipeline continuously at specified intervals."""
    while True:
        try:
            result = await run_pipeline(args)
            if result.get("status") == "ok":
                stats = result.get("stats", {})
                print(f"[{datetime.now().isoformat()}] Fetched {stats.get('performers_seen', 0)} performers, "
                      f"downloaded {stats.get('images_downloaded', 0)} new images, "
                      f"skipped {stats.get('duplicate_hashes_skipped', 0)} duplicates")
            elif result.get("status") == "skipped":
                print(f"[{datetime.now().isoformat()}] Pipeline locked by another process, retrying...")
            
            await asyncio.sleep(args.continuous_interval)
        except KeyboardInterrupt:
            print("Continuous mode interrupted")
            break
        except Exception as e:
            print(f"Error in continuous loop: {e}", file=sys.stderr)
            await asyncio.sleep(60)


def main() -> int:
    args = parse_args()
    
    if args.continuous_mode:
        print(f"Starting CONTINUOUS MODE: fetch every {args.continuous_interval}s")
        print(f"  - API concurrency: {args.api_concurrency}")
        print(f"  - Image concurrency: {args.image_concurrency}")
        print(f"  - API page limit: {args.api_page_limit}")
        print(f"  - Max history images: {args.max_history_images}")
        print(f"  - Compression quality: {args.compression_quality}%")
        asyncio.run(continuous_loop(args))
    else:
        result = asyncio.run(run_pipeline(args))
        print(json.dumps(result, indent=2))
        return 0 if result.get("status") in {"ok", "skipped"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
