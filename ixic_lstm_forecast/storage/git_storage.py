"""
ixic_lstm_forecast.storage.git_storage
========================================
GitDatabaseStorage — persists serialised ``Tickers`` structs as gzip-compressed
binary payloads written to the ``output/`` directory next to the module (or a
caller-specified path).

The file naming convention is::

    <symbol>_tickers_payload.dat.gz

which allows multiple ticker runs to coexist without overwriting each other.
"""

from __future__ import annotations

import gzip
import json
import logging
import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

# Default output directory is ``ixic_lstm_forecast/output/``
_DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"


class GitDatabaseStorage:
    """
    Saves serialised structs as Gzip-compressed pickle payloads.

    Parameters
    ----------
    output_dir:
        Directory where ``.dat.gz`` files are written.  Defaults to the
        ``output/`` sub-folder of the ``ixic_lstm_forecast`` package.
    """

    def __init__(self, output_dir: Path | str | None = None) -> None:
        self.output_dir = Path(output_dir) if output_dir else _DEFAULT_OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        log.info(
            "[GitDatabaseStorage] initialised — output_dir=%s", self.output_dir
        )

    # ------------------------------------------------------------------
    @staticmethod
    def _safe_filename(symbol: str) -> str:
        """
        Return a filesystem-safe version of *symbol*.

        Strips or replaces any character that is not alphanumeric, a dash,
        or an underscore.  This guards against path-traversal and OS-level
        filename restrictions on all major platforms.
        """
        import re
        safe = re.sub(r"[^\w\-]", "_", symbol)
        safe = safe.strip("_") or "unknown"
        log.debug("[GitDatabaseStorage] _safe_filename(%r) → %r", symbol, safe)
        return safe

    # ------------------------------------------------------------------
    def commit(self, data: Any) -> None:
        """
        Serialise *data* with pickle and write as a Gzip file.

        The filename encodes the ticker symbol (if ``data.symbol`` exists)
        and a UTC timestamp so that successive runs can be traced.

        Parameters
        ----------
        data:
            Any picklable object; typically a ``Tickers`` dataclass instance.
        """
        symbol = self._safe_filename(getattr(data, "symbol", "unknown"))
        ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        filename = self.output_dir / f"{symbol}_tickers_payload_{ts}.dat.gz"

        log.info(
            "[GitDatabaseStorage] commit — symbol=%s  target=%s",
            symbol,
            filename,
        )

        try:
            with gzip.open(filename, "wb") as fh:
                pickle.dump(data, fh)
            log.info(
                "[GitDatabaseStorage] committed successfully — file=%s  size_bytes=%d",
                filename,
                filename.stat().st_size,
            )
            print(f"[*] State committed to {filename} via binary Gzip.")
        except Exception as exc:  # pragma: no cover
            log.error(
                "[GitDatabaseStorage] commit FAILED — file=%s  error=%s",
                filename,
                exc,
                exc_info=True,
            )
            raise

        # Also write a human-readable JSON sidecar for easy inspection
        sidecar = filename.with_suffix("").with_suffix(".json")
        try:
            payload = {
                "symbol": getattr(data, "symbol", None),
                "recent_close": getattr(data, "recent_close", None),
                "projected_close": getattr(data, "projected_close", None),
                "binary_signature": getattr(data, "binary_signature", None),
                "binary_signature_bin": bin(getattr(data, "binary_signature", 0)),
                "committed_at": ts,
            }
            sidecar.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            log.info(
                "[GitDatabaseStorage] JSON sidecar written — file=%s", sidecar
            )
        except Exception as exc:  # pragma: no cover
            log.warning(
                "[GitDatabaseStorage] sidecar write failed (non-fatal) — %s", exc
            )

    # ------------------------------------------------------------------
    def __repr__(self) -> str:  # pragma: no cover
        return f"GitDatabaseStorage(output_dir={self.output_dir!r})"
