#!/usr/bin/env python3
"""Fetch performer data and persist image cache into a compressed SQLite DB.

Design goals:
- Safe for frequent triggers (uses file lock + atomic writes)
- Async/concurrent fetch and image download
- Bounded runtime (default 180 seconds)
- Produces a compressed manifest for best/index.html viewer
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
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import fcntl


API_BASE = "https://chaturbate.com/api/public/affiliates/onlinerooms/?tour=dU9X&wm=9cg6A&disable_sound=1&client_ip=request_ip&gender=f"
USER_AGENT = "best-image-db-pipeline/1.0"


@dataclass
class Stats:
    performers_seen: int = 0
    unique_images_seen: int = 0
    images_already_cached: int = 0
    images_downloaded: int = 0
    images_failed: int = 0
    mappings_updated: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Best performer compressed image DB pipeline")
    parser.add_argument("--base-dir", default="best", help="Base directory for best artifacts")
    parser.add_argument("--runtime-seconds", type=int, default=180, help="Maximum runtime per invocation")
    parser.add_argument("--api-page-limit", type=int, default=500, help="API page size")
    parser.add_argument("--api-max-pages", type=int, default=6, help="Max pages fetched per run")
    parser.add_argument("--api-concurrency", type=int, default=6, help="Concurrent API page fetches")
    parser.add_argument("--image-concurrency", type=int, default=12, help="Concurrent image downloads")
    parser.add_argument("--request-timeout", type=int, default=20, help="HTTP timeout seconds")
    parser.add_argument("--max-image-bytes", type=int, default=5_000_000, help="Skip images bigger than this")
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


async def fetch_page(offset: int, page_limit: int, timeout: int, sem: asyncio.Semaphore) -> tuple[int, list[dict[str, Any]]]:
    url = f"{API_BASE}&limit={page_limit}&offset={offset}"
    async with sem:
        try:
            payload = await asyncio.to_thread(_blocking_fetch_json, url, timeout)
            rows = payload.get("results") or []
            if not isinstance(rows, list):
                rows = []
            return offset, rows
        except Exception:
            return offset, []


async def fetch_performers(args: argparse.Namespace, deadline: float) -> list[dict[str, Any]]:
    sem = asyncio.Semaphore(max(1, args.api_concurrency))
    offsets = [idx * args.api_page_limit for idx in range(max(1, args.api_max_pages))]
    tasks = [fetch_page(offset, args.api_page_limit, args.request_timeout, sem) for offset in offsets]
    results = await asyncio.gather(*tasks)
    results.sort(key=lambda item: item[0])

    performers: list[dict[str, Any]] = []
    seen_users: set[str] = set()

    for _, rows in results:
        if time.time() >= deadline:
            break
        if len(rows) < args.api_page_limit:
            stop_after_this = True
        else:
            stop_after_this = False

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
            performers.append(
                {
                    "username": str(username),
                    "image_url": str(image_url),
                    "display_name": row.get("display_name") or str(username),
                    "age": row.get("age"),
                    "num_viewers": row.get("num_viewers") or 0,
                    "tags": row.get("tags") or [],
                }
            )

        if stop_after_this:
            break

    return performers


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS images (
            image_url TEXT PRIMARY KEY,
            content_hash TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            image_blob BLOB NOT NULL,
            first_seen INTEGER NOT NULL,
            last_seen INTEGER NOT NULL,
            last_status INTEGER NOT NULL DEFAULT 200
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
            mappings_updated INTEGER NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_performer_images_last_seen ON performer_images(last_seen DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_images_last_seen ON images(last_seen DESC)")
    conn.commit()


def decompress_if_needed(compressed_path: Path, db_path: Path) -> None:
    if compressed_path.exists() and not db_path.exists():
        with gzip.open(compressed_path, "rb") as f_in, db_path.open("wb") as f_out:
            f_out.write(f_in.read())


def compress_atomically(db_path: Path, compressed_path: Path) -> None:
    temp_out = compressed_path.with_suffix(".db.gz.tmp")
    with db_path.open("rb") as f_in, gzip.open(temp_out, "wb") as f_out:
        f_out.write(f_in.read())
    os.replace(temp_out, compressed_path)


async def fetch_missing_images(
    missing_urls: list[str],
    args: argparse.Namespace,
    deadline: float,
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

        items.append(
            {
                "username": row[0],
                "display_name": row[1] or row[0],
                "age": row[2],
                "num_viewers": row[3] or 0,
                "tags": tags,
                "image_url": row[5],
                "last_seen": row[6],
                "byte_size": row[7] or 0,
                "mime_type": row[8] or "",
                "content_hash": row[9] or "",
            }
        )

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
                existing_urls = {
                    row[0] for row in conn.execute("SELECT image_url FROM images").fetchall()
                }
                missing_urls = [u for u in unique_urls if u not in existing_urls]
                stats.images_already_cached = len(unique_urls) - len(missing_urls)

                downloaded = await fetch_missing_images(missing_urls, args, deadline)
                stats.images_downloaded = len(downloaded)
                stats.images_failed = len(missing_urls) - len(downloaded)

                now_ts = int(time.time())

                for url in unique_urls:
                    if url in downloaded:
                        data, mime, digest, byte_size = downloaded[url]
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
                    else:
                        conn.execute(
                            "UPDATE images SET last_seen=? WHERE image_url=?",
                            (now_ts, url),
                        )

                for p in performers:
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
                            p["username"],
                            p["image_url"],
                            p.get("display_name") or p["username"],
                            p.get("age"),
                            p.get("num_viewers") or 0,
                            json.dumps(p.get("tags") or [], separators=(",", ":")),
                            now_ts,
                        ),
                    )

                stats.mappings_updated = len(performers)

                finished_at = int(time.time())
                conn.execute(
                    """
                    INSERT OR REPLACE INTO fetch_runs (
                        run_id, started_at, finished_at,
                        performers_seen, unique_images_seen,
                        images_already_cached, images_downloaded,
                        images_failed, mappings_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    ),
                )
                conn.commit()

                write_manifest(base_dir, conn, finished_at)
            finally:
                conn.close()

            compress_atomically(db_path, compressed_db_path)

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


def main() -> int:
    args = parse_args()
    result = asyncio.run(run_pipeline(args))
    print(json.dumps(result, indent=2))
    return 0 if result.get("status") in {"ok", "skipped"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
