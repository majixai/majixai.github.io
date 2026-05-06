"""
ixic_lstm_forecast.workers.reporter
======================================
Distributed reporting worker.

``reporting_worker`` runs in a separate ``multiprocessing.Process``, consuming
``Tickers``-payload dicts from a ``multiprocessing.Queue``.  For each payload it:

1. Maps the raw dict into a typed ``Tickers`` dataclass.
2. Logs and prints a formatted report to stdout.
3. Delegates persistence to the ``IStorageEngine`` instance passed at start-up.

The worker terminates cleanly when it receives the sentinel value ``"TERMINATE"``.
"""

from __future__ import annotations

import logging
from multiprocessing import Queue
from typing import Any

from ixic_lstm_forecast.framework.base import QuantFrameworkBase, Tickers
from ixic_lstm_forecast.framework.interfaces import IStorageEngine

log = logging.getLogger(__name__)

# Bitwise left-shift applied to the base flag (0b00000001) when computing the
# binary signature.  A shift of 3 places the marker at bit position 3
# (0b00001000), OR'd with the high-bit mask (0b10000000) → 0b10001000 (136).
_BINARY_SHIFT_VAL: int = 3


def reporting_worker(queue: Queue, storage: IStorageEngine) -> None:  # type: ignore[type-arg]
    """
    Blocking worker loop — runs inside a dedicated child process.

    Parameters
    ----------
    queue:
        ``multiprocessing.Queue`` from which payload dicts (or the
        ``"TERMINATE"`` sentinel) are consumed.
    storage:
        An ``IStorageEngine`` implementation used to persist each
        ``Tickers`` struct.
    """
    log.info("[reporting_worker] worker process started — waiting for payloads...")

    while True:
        payload: Any = queue.get()

        # ── Termination sentinel ──────────────────────────────────────────
        if payload == "TERMINATE":
            log.info("[reporting_worker] TERMINATE sentinel received — shutting down.")
            break

        log.debug(
            "[reporting_worker] payload received — symbol=%s  recent=%.4f  projected=%.4f",
            payload.get("symbol"),
            payload.get("recent", float("nan")),
            payload.get("projected", float("nan")),
        )

        # ── Object mapping: dict → Tickers struct ─────────────────────────
        binary_sig = QuantFrameworkBase.calculate_binary_flag(shift_val=_BINARY_SHIFT_VAL)
        ticker_struct = Tickers(
            symbol=payload["symbol"],
            recent_close=payload["recent"],
            projected_close=payload["projected"],
            binary_signature=binary_sig,
        )

        log.info(
            "[reporting_worker] Tickers struct created — %s  "
            "binary_sig=%s  recent=%.4f  projected=%.4f",
            ticker_struct.symbol,
            bin(ticker_struct.binary_signature),
            ticker_struct.recent_close,
            ticker_struct.projected_close,
        )

        # ── Formatted console report ──────────────────────────────────────
        report_lines = [
            "",
            "========================================",
            f" DISTRIBUTED WORKER LOG: {ticker_struct.symbol}",
            "========================================",
            f" Binary Sig:          {bin(ticker_struct.binary_signature)}",
            f" Most Recent Close:   {ticker_struct.recent_close:.2f}",
            f" Projected Next:      {ticker_struct.projected_close:.2f}",
            "========================================",
            "",
        ]
        report = "\n".join(report_lines)
        print(report)
        log.info("[reporting_worker] console report printed for %s", ticker_struct.symbol)

        # ── Persist via storage engine ────────────────────────────────────
        log.info(
            "[reporting_worker] committing to storage engine (%s)...",
            type(storage).__name__,
        )
        storage.commit(ticker_struct)
        log.info("[reporting_worker] storage commit complete for %s", ticker_struct.symbol)

    log.info("[reporting_worker] worker loop exited cleanly.")
