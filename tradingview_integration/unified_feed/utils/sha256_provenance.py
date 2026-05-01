"""sha256_provenance — atomic artifact provenance helpers.

Every artifact written by the unified_feed pipeline is accompanied by:
  <artifact>.meta.json  — JSON metadata sidecar (timestamps, source, version, …)
  <artifact>.sha256     — single-line hex SHA-256 digest of the artifact file

Both files are written atomically (write to a .tmp sibling then os.replace)
so a reader never sees a partial sidecar.

Public API
----------
sha256_of_file(path)
    Return hex SHA-256 of the file at *path*.

sha256_of_bytes(data)
    Return hex SHA-256 of raw *bytes*.

write_metadata_atomic(artifact_path, metadata_dict)
    Write .meta.json and .sha256 sidecars atomically.

verify_artifact(artifact_path, strict=True) -> tuple[bool, str, str]
    Read the .sha256 sidecar and compare against the live file.
    Returns (ok, expected_hex, actual_hex).
    Raises RuntimeError on mismatch when strict=True.

db_register_artifact(session, artifact_path, metadata_dict)
    Optional: insert a row into the artifact_metadata table via a
    SQLAlchemy-compatible session.  Does nothing if session is None.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Core hash helpers
# ---------------------------------------------------------------------------

def sha256_of_file(path: str | Path, chunk: int = 1 << 20) -> str:
    """Return lower-hex SHA-256 of the file at *path* (streaming, safe for large files)."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def sha256_of_bytes(data: bytes) -> str:
    """Return lower-hex SHA-256 of *data*."""
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# Atomic sidecar writers
# ---------------------------------------------------------------------------

def _atomic_write(dest: Path, content: bytes) -> None:
    """Write *content* to *dest* atomically via a .tmp sibling."""
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    try:
        tmp.write_bytes(content)
        os.replace(tmp, dest)
    except Exception:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise


def write_metadata_atomic(
    artifact_path: str | Path,
    metadata_dict: dict[str, Any],
) -> tuple[Path, Path]:
    """Write .meta.json and .sha256 sidecars next to *artifact_path*.

    The SHA-256 is computed from the artifact file itself and injected into
    the metadata dict under the key ``sha256`` before serialising.

    Parameters
    ----------
    artifact_path:
        Path to the artifact file that must already exist.
    metadata_dict:
        Arbitrary metadata to store in the .meta.json sidecar.
        ``sha256``, ``artifact``, and ``written_at`` keys are always
        overwritten by this function.

    Returns
    -------
    (meta_path, sha256_path) : tuple of the two sidecar Paths.
    """
    artifact_path = Path(artifact_path)
    if not artifact_path.exists():
        raise FileNotFoundError(f"Artifact not found: {artifact_path}")

    digest = sha256_of_file(artifact_path)

    meta = dict(metadata_dict)
    meta["sha256"]      = digest
    meta["artifact"]    = artifact_path.name
    meta["written_at"]  = datetime.now(timezone.utc).isoformat()

    meta_path   = artifact_path.with_suffix(artifact_path.suffix + ".meta.json")
    sha256_path = artifact_path.with_suffix(artifact_path.suffix + ".sha256")

    _atomic_write(meta_path,   json.dumps(meta, indent=2).encode())
    _atomic_write(sha256_path, (digest + "\n").encode())

    log.debug("provenance written: %s  sha256=%s", artifact_path.name, digest[:12])
    return meta_path, sha256_path


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

def verify_artifact(
    artifact_path: str | Path,
    strict: bool = True,
) -> tuple[bool, str, str]:
    """Verify the SHA-256 sidecar for *artifact_path*.

    Parameters
    ----------
    artifact_path:
        Path to the artifact file.
    strict:
        When True (default) raise RuntimeError on digest mismatch.

    Returns
    -------
    (ok, expected_hex, actual_hex)
    """
    artifact_path = Path(artifact_path)
    sha256_path   = artifact_path.with_suffix(artifact_path.suffix + ".sha256")

    if not sha256_path.exists():
        msg = f"SHA-256 sidecar missing: {sha256_path}"
        if strict:
            raise FileNotFoundError(msg)
        log.warning(msg)
        return False, "", ""

    expected = sha256_path.read_text().strip()
    actual   = sha256_of_file(artifact_path)
    ok       = expected == actual

    if not ok:
        msg = (
            f"SHA-256 mismatch for {artifact_path.name}: "
            f"expected {expected[:12]}… got {actual[:12]}…"
        )
        log.error(msg)
        if strict:
            raise RuntimeError(msg)

    return ok, expected, actual


# ---------------------------------------------------------------------------
# Optional DB registration
# ---------------------------------------------------------------------------

def db_register_artifact(
    session: Any,
    artifact_path: str | Path,
    metadata_dict: dict[str, Any],
) -> None:
    """Insert a provenance row into the *artifact_metadata* table.

    This is a best-effort helper.  If *session* is None or the insert fails,
    the error is logged and silently swallowed so the caller's write path is
    never blocked by DB availability.

    The *artifact_metadata* table is expected to have at minimum:
      artifact_name TEXT, sha256 TEXT, written_at TEXT, metadata TEXT

    Compatible with SQLAlchemy Core ``Connection`` (``execute``) and ORM
    ``Session`` (``execute``).  Also accepts a plain sqlite3 ``Connection``
    via its ``.execute()`` method.
    """
    if session is None:
        return

    artifact_path = Path(artifact_path)
    sha256_path   = artifact_path.with_suffix(artifact_path.suffix + ".sha256")

    digest     = sha256_path.read_text().strip() if sha256_path.exists() else ""
    written_at = metadata_dict.get("written_at", datetime.now(timezone.utc).isoformat())
    meta_json  = json.dumps(metadata_dict)

    sql = (
        "INSERT INTO artifact_metadata (artifact_name, sha256, written_at, metadata) "
        "VALUES (?, ?, ?, ?)"
    )
    try:
        session.execute(sql, (artifact_path.name, digest, written_at, meta_json))
        if hasattr(session, "commit"):
            session.commit()
        log.debug("artifact_metadata row inserted: %s", artifact_path.name)
    except Exception as exc:  # noqa: BLE001
        log.warning("db_register_artifact failed for %s: %s", artifact_path.name, exc)
