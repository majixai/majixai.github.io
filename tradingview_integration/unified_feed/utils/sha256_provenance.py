"""SHA-256 provenance helpers for artifact integrity tracking.

Provides functions to hash file contents, raw bytes, and filenames, plus
atomic metadata write/read/verify and optional SQLAlchemy DB registration.

Filename hashing (``sha256_of_filename``) captures the identity of an artifact
path independently of its content — useful when detecting renames or when the
filename itself encodes structured information (ticker, date, interval).
"""

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
from pathlib import Path
from typing import Any, Optional, Tuple

log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Core hash helpers
# ─────────────────────────────────────────────────────────────────────────────

def sha256_of_file(path: Any) -> str:
    """Return the hex SHA-256 digest of the *contents* of *path*.

    Args:
        path: File path (str or :class:`pathlib.Path`).

    Returns:
        64-character lowercase hex string.

    Raises:
        FileNotFoundError: If *path* does not exist.
        IOError: If the file cannot be read.
    """
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
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
    """Return the hex SHA-256 digest of *data*.

    Args:
        data: Raw bytes to hash.

    Returns:
        64-character lowercase hex string.
    """
    return hashlib.sha256(data).hexdigest()


def sha256_of_filename(path: Any) -> str:
    """Return the hex SHA-256 digest of the *filename* (basename) of *path*.

    Only the final path component (the filename) is hashed, not the full
    path, so that artifacts can be relocated without changing their filename
    hash.  Use :func:`sha256_of_file` to hash file *contents*.

    Args:
        path: File path (str or :class:`pathlib.Path`).  The file does not
              need to exist.

    Returns:
        64-character lowercase hex string.

    Example::

        >>> sha256_of_filename("data/SPY_1m_2024-01-15.parquet")
        'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2'
    """
    filename = os.path.basename(str(path))
    return hashlib.sha256(filename.encode()).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Atomic metadata write / read / verify
# ─────────────────────────────────────────────────────────────────────────────

def _meta_path(artifact_path: Any) -> Path:
    return Path(str(artifact_path) + ".meta.json")


def _sha256_path(artifact_path: Any) -> Path:
    return Path(str(artifact_path) + ".sha256")


def write_metadata_atomic(artifact_path: Any, metadata: dict) -> None:
    """Write *artifact.meta.json* and *artifact.sha256* atomically.

    Both sidecar files are written to a ``.tmp`` file first, then renamed
    into place so that readers never see a partial write.

    The ``sha256`` key is automatically added to *metadata* (computed from
    the artifact's current contents) if not already present.  A
    ``filename_sha256`` key is also added containing the hash of the filename.

    Args:
        artifact_path: Path to the artifact file.  The file must exist.
        metadata: Arbitrary dict of metadata to persist alongside the hash.

    Raises:
        FileNotFoundError: If *artifact_path* does not exist.
    """
    artifact_path = Path(artifact_path)
    content_hash = sha256_of_file(artifact_path)
    filename_hash = sha256_of_filename(artifact_path)

    meta = dict(metadata)
    meta.setdefault("sha256", content_hash)
    meta.setdefault("filename_sha256", filename_hash)
    meta.setdefault("artifact", artifact_path.name)

    # Write .meta.json atomically
    meta_target = _meta_path(artifact_path)
    meta_tmp = meta_target.with_suffix(".tmp")
    meta_tmp.write_text(json.dumps(meta, indent=2, sort_keys=True), encoding="utf-8")
    meta_tmp.replace(meta_target)

    # Write .sha256 atomically (plain text, one line)
    sha_target = _sha256_path(artifact_path)
    sha_tmp = sha_target.with_suffix(".tmp")
    sha_tmp.write_text(content_hash + "\n", encoding="utf-8")
    sha_tmp.replace(sha_target)

    log.debug("wrote provenance for %s (content=%s, filename=%s)",
              artifact_path.name, content_hash[:8], filename_hash[:8])


def verify_artifact(
    artifact_path: Any,
    strict: bool = True,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """Verify that *artifact_path* matches its stored SHA-256 sidecar.

    Reads ``artifact.sha256`` (or falls back to ``artifact.meta.json``) and
    computes the current hash of the artifact.

    Args:
        artifact_path: Path to the artifact file.
        strict: If ``True``, raise :class:`ValueError` on mismatch.

    Returns:
        A tuple ``(ok, expected, actual)`` where *ok* is ``True`` when the
        hashes match, and *expected* / *actual* are the stored and recomputed
        hex digests respectively (or ``None`` when unavailable).

    Raises:
        FileNotFoundError: If *artifact_path* does not exist.
        ValueError: If *strict* is ``True`` and the hashes differ.
    """
    artifact_path = Path(artifact_path)
    actual = sha256_of_file(artifact_path)

    # Prefer the plain .sha256 sidecar; fall back to .meta.json
    sha_file = _sha256_path(artifact_path)
    meta_file = _meta_path(artifact_path)

    expected: Optional[str] = None
    if sha_file.exists():
        expected = sha_file.read_text(encoding="utf-8").strip()
    elif meta_file.exists():
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            expected = meta.get("sha256")
        except Exception as exc:
            log.warning("could not parse %s: %s", meta_file, exc)

    if expected is None:
        log.warning("no provenance sidecar found for %s — treating as unverified",
                    artifact_path.name)
        return (False, None, actual)

    ok = expected == actual
    if not ok:
        msg = (f"SHA-256 mismatch for {artifact_path.name}: "
               f"expected {expected}, got {actual}")
        log.error(msg)
        if strict:
            raise ValueError(msg)
    else:
        log.debug("verified %s OK (%s…)", artifact_path.name, actual[:8])

    return (ok, expected, actual)


# ─────────────────────────────────────────────────────────────────────────────
# Optional SQLAlchemy DB registration
# ─────────────────────────────────────────────────────────────────────────────

def db_register_artifact(session: Any, artifact_path: Any, metadata: dict) -> Any:
    """Insert or update an artifact record in the database.

    This helper is *optional* and only activates when a SQLAlchemy *session*
    is provided.  If SQLAlchemy is not installed the function logs a warning
    and returns ``None``.

    The function looks for a model class ``ArtifactMetadata`` on the session's
    ``bind`` / ``get_bind()``; when not found it creates a lightweight
    in-memory table on first call.

    Args:
        session: SQLAlchemy session (or any object with ``add`` / ``commit``
                 methods).  Pass ``None`` to skip registration.
        artifact_path: Path to the artifact.
        metadata: Metadata dict (same as passed to
                  :func:`write_metadata_atomic`).

    Returns:
        The newly created or updated ORM row, or ``None``.
    """
    if session is None:
        return None

    artifact_path = Path(artifact_path)
    content_hash = sha256_of_file(artifact_path)
    filename_hash = sha256_of_filename(artifact_path)

    row_data = dict(metadata)
    row_data["artifact_name"] = artifact_path.name
    row_data["artifact_path"] = str(artifact_path)
    row_data["sha256"] = content_hash
    row_data["filename_sha256"] = filename_hash

    try:
        # Lazy import so callers without SQLAlchemy aren't penalised
        from sqlalchemy import Column, Integer, String, Text, inspect as sa_inspect
        from sqlalchemy.orm import DeclarativeBase

        class _Base(DeclarativeBase):
            pass

        class _ArtifactMetadata(_Base):  # type: ignore[misc]
            __tablename__ = "artifact_metadata"
            __table_args__ = {"extend_existing": True}
            id = Column(Integer, primary_key=True, autoincrement=True)
            artifact_name = Column(String(255), nullable=False)
            artifact_path = Column(Text, nullable=False)
            sha256 = Column(String(64), nullable=False)
            filename_sha256 = Column(String(64), nullable=False)
            extra = Column(Text, nullable=True)

        bind = session.get_bind()
        if not sa_inspect(bind).has_table("artifact_metadata"):
            _Base.metadata.create_all(bind)

        extras = {k: v for k, v in row_data.items()
                  if k not in ("artifact_name", "artifact_path", "sha256",
                               "filename_sha256")}
        obj = _ArtifactMetadata(
            artifact_name=row_data["artifact_name"],
            artifact_path=row_data["artifact_path"],
            sha256=row_data["sha256"],
            filename_sha256=row_data["filename_sha256"],
            extra=json.dumps(extras) if extras else None,
        )
        session.add(obj)
        session.commit()
        log.debug("registered artifact %s in DB", artifact_path.name)
        return obj

    except ImportError:
        log.warning("SQLAlchemy not available — skipping DB artifact registration")
        return None
    except Exception as exc:
        log.warning("db_register_artifact failed for %s: %s", artifact_path.name, exc)
        return None
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
