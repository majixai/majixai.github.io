"""
EKF Runner — applies the ExtendedKalmanFilter to yfinance OHLCV data.

Calibrates EKF parameters from the price series, runs the batch filter,
generates a short-horizon price forecast, and persists results via
:class:`EKFExporter`.

Storage layout (relative to *data_dir*):
  states/TICKER_YYYY.dat            — gzip-JSON filtered state vectors
  predictions/TICKER_next_close.dat — gzip-JSON next-close forecast

Parallelism
-----------
``EKFRunner.run_batch()`` accepts ``max_workers`` and ``use_processes``
arguments.  With ``use_processes=False`` (default) a
``ThreadPoolExecutor`` is used — safe for pure-numpy workloads and avoids
inter-process pickle overhead.  Set ``use_processes=True`` to offload
EKF computation to a ``ProcessPoolExecutor`` which bypasses the GIL and
scales across CPU cores for large ticker universes.

Import / Export
---------------
``EKFImporter``   — read OHLCV data from CSV, Parquet, JSON, gzip-JSON
                    (.dat), ZIP archives, and SQLite databases.
``EKFExporter``   — write EKF results to CSV, Parquet, JSON, gzip-JSON
                    (.dat), SQLite, and plain-text summaries.
``EKFRunner``     — orchestrates import → filter → export.
"""

from __future__ import annotations

import concurrent.futures
import csv
import gzip
import io
import json
import logging
import os
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

from models.bayesian_ekf import ExtendedKalmanFilter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Public re-exports so callers can do:  from models.ekf_runner import EKFRunner
# ---------------------------------------------------------------------------
__all__ = [
    "EKFRunner",
    "EKFImporter",
    "EKFExporter",
    "run_ticker_task",
]

# ---------------------------------------------------------------------------
# Module-level free functions (must be picklable for ProcessPoolExecutor)
# ---------------------------------------------------------------------------

def run_ticker_task(
    args: Tuple[str, np.ndarray, Optional[Dict[str, Any]], int],
) -> Tuple[str, Dict[str, Any]]:
    """
    Top-level picklable worker function for ``ProcessPoolExecutor``.

    Parameters
    ----------
    args : (ticker, close_prices, ekf_params, forecast_days)

    Returns
    -------
    (ticker, result_dict)  — result is empty dict on failure
    """
    ticker, close_prices, ekf_params, forecast_days = args
    if close_prices is None or len(close_prices) < 10:
        return ticker, {}
    try:
        log_prices = np.log(close_prices.astype(float))
        ekf = EKFRunner._build_ekf_static(log_prices, ekf_params)
        filtered = ekf.batch_filter(log_prices)
        forecasts = ekf.predict_next(n_steps=forecast_days)

        predicted_log = forecasts[0]["log_price"] if forecasts else float(log_prices[-1])
        predicted_close = float(np.exp(predicted_log))
        last_close = float(close_prices[-1])
        predicted_return = (predicted_close - last_close) / last_close

        return ticker, {
            "ticker": ticker,
            "last_close": round(last_close, 6),
            "predicted_close": round(predicted_close, 6),
            "predicted_return_pct": round(predicted_return * 100, 4),
            "filtered_volatility": round(filtered[-1]["volatility"], 8),
            "filtered_momentum_angle": round(filtered[-1]["momentum_angle"], 6),
            "posterior_cov_trace": round(filtered[-1]["P_trace"], 8),
            "forecast_horizon_days": forecast_days,
            "n_observations": len(log_prices),
            "filtered_at": datetime.now().isoformat(),
            "forecasts": forecasts,
            "filtered_states": _compact_states(filtered),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("%s: EKF computation failed — %s", ticker, exc)
        return ticker, {}


# ---------------------------------------------------------------------------
# EKFImporter
# ---------------------------------------------------------------------------

class EKFImporter:
    """
    Load OHLCV price data from a variety of file formats.

    Supported formats
    -----------------
    - **CSV**        — ``Date`` + ``Close`` columns (single ticker) or
                       ``Date`` + ``Close`` + ``Ticker`` (multi-ticker).
    - **Parquet**    — same column requirements as CSV.
    - **JSON**       — array of ``{date, close[, ticker]}`` records or
                       ``{ticker: [{date, close}…]}`` mapping.
    - **.dat**       — gzip-compressed JSON produced by :class:`EKFExporter`
                       or the legacy ``DataModel``.
    - **ZIP**        — archive whose members are any of the above.
    - **SQLite**     — database with a ``prices`` table containing
                       ``Date``, ``Close``, and optionally ``Ticker``.
    - **DataFrame**  — pass a ``pandas.DataFrame`` directly via
                       :py:meth:`from_dataframe`.

    All loaders return ``{ticker: DataFrame}`` where each DataFrame has
    at minimum a ``Close`` column.
    """

    # ------------------------------------------------------------------ #
    # Public entry points
    # ------------------------------------------------------------------ #

    def load(
        self,
        path: str,
        ticker_hint: str = "UNKNOWN",
        ticker_column: str = "Ticker",
        date_column: str = "Date",
        close_column: str = "Close",
    ) -> Dict[str, pd.DataFrame]:
        """
        Auto-detect format and load from *path*.

        Parameters
        ----------
        path : str
            File path.  Extension is used for format detection.
        ticker_hint : str
            Ticker name used when the file contains no ticker column.
        ticker_column, date_column, close_column : str
            Column-name overrides.

        Returns
        -------
        dict  {ticker: DataFrame}
        """
        lower = path.lower()
        if lower.endswith(".zip"):
            return self.from_zip(path, ticker_hint=ticker_hint)
        if lower.endswith(".parquet") or lower.endswith(".pq"):
            return self.from_parquet(path, ticker_hint=ticker_hint,
                                     ticker_column=ticker_column,
                                     close_column=close_column)
        if lower.endswith(".db") or lower.endswith(".sqlite"):
            return self.from_sqlite(path)
        if lower.endswith(".dat"):
            return self.from_dat(path)
        if lower.endswith(".json"):
            return self.from_json(path, ticker_hint=ticker_hint)
        # Default: CSV
        return self.from_csv(path, ticker_hint=ticker_hint,
                             ticker_column=ticker_column,
                             date_column=date_column,
                             close_column=close_column)

    def from_dataframe(
        self,
        df: pd.DataFrame,
        ticker: str = "UNKNOWN",
        close_column: str = "Close",
    ) -> Dict[str, pd.DataFrame]:
        """Wrap a pre-loaded DataFrame as an import result."""
        df = df.copy()
        col = _find_close_col(df, close_column)
        if col is None:
            raise ValueError(f"No recognised Close column in DataFrame (tried '{close_column}')")
        if col != "Close":
            df = df.rename(columns={col: "Close"})
        return {ticker: df}

    def from_csv(
        self,
        path: str,
        ticker_hint: str = "UNKNOWN",
        ticker_column: str = "Ticker",
        date_column: str = "Date",
        close_column: str = "Close",
        encoding: str = "utf-8",
    ) -> Dict[str, pd.DataFrame]:
        """
        Import from a CSV file.

        Supports single-ticker files (no Ticker column) and multi-ticker
        files (with a Ticker column).  Handles gzip-compressed CSV
        transparently when the path ends in ``.csv.gz``.
        """
        try:
            df = pd.read_csv(path, encoding=encoding)
            return self._split_by_ticker(df, ticker_hint, ticker_column,
                                         date_column, close_column)
        except Exception as exc:
            logger.error("from_csv(%s): %s", path, exc)
            return {}

    def from_csv_directory(
        self,
        directory: str,
        glob_pattern: str = "*.csv",
    ) -> Dict[str, pd.DataFrame]:
        """
        Import every CSV in *directory* that matches *glob_pattern*.

        Each file is expected to contain data for a single ticker.
        The ticker name is derived from the filename stem.
        """
        import fnmatch
        results: Dict[str, pd.DataFrame] = {}
        for fname in os.listdir(directory):
            if not fnmatch.fnmatch(fname, glob_pattern):
                continue
            path = os.path.join(directory, fname)
            ticker = os.path.splitext(fname)[0].upper()
            part = self.from_csv(path, ticker_hint=ticker)
            results.update(part)
        return results

    def from_parquet(
        self,
        path: str,
        ticker_hint: str = "UNKNOWN",
        ticker_column: str = "Ticker",
        close_column: str = "Close",
    ) -> Dict[str, pd.DataFrame]:
        """Import from a Parquet file (requires ``pyarrow`` or ``fastparquet``)."""
        try:
            df = pd.read_parquet(path)
            return self._split_by_ticker(df, ticker_hint, ticker_column,
                                         "Date", close_column)
        except ImportError:
            logger.error("Parquet support requires pyarrow or fastparquet.")
            return {}
        except Exception as exc:
            logger.error("from_parquet(%s): %s", path, exc)
            return {}

    def from_parquet_directory(
        self,
        directory: str,
    ) -> Dict[str, pd.DataFrame]:
        """Import all Parquet files in *directory* (one file per ticker)."""
        results: Dict[str, pd.DataFrame] = {}
        for fname in os.listdir(directory):
            if not fname.endswith(".parquet"):
                continue
            path = os.path.join(directory, fname)
            ticker = os.path.splitext(fname)[0].upper()
            part = self.from_parquet(path, ticker_hint=ticker)
            results.update(part)
        return results

    def from_json(
        self,
        path: str,
        ticker_hint: str = "UNKNOWN",
        encoding: str = "utf-8",
    ) -> Dict[str, pd.DataFrame]:
        """
        Import from a JSON file.

        Accepted schemas:

        * ``[{date: …, close: …}]``                     — single-ticker array
        * ``[{date: …, close: …, ticker: …}]``           — multi-ticker array
        * ``{ticker: [{date: …, close: …}]}``            — ticker-keyed mapping
        * EKF prediction dict (output of :class:`EKFExporter`)
        """
        try:
            with open(path, encoding=encoding) as fh:
                raw = json.load(fh)
            return self._parse_json_payload(raw, ticker_hint)
        except Exception as exc:
            logger.error("from_json(%s): %s", path, exc)
            return {}

    def from_json_string(
        self, json_str: str, ticker_hint: str = "UNKNOWN"
    ) -> Dict[str, pd.DataFrame]:
        """Import from a JSON string."""
        try:
            raw = json.loads(json_str)
            return self._parse_json_payload(raw, ticker_hint)
        except Exception as exc:
            logger.error("from_json_string: %s", exc)
            return {}

    def from_dat(self, path: str) -> Dict[str, pd.DataFrame]:
        """
        Import from a gzip-JSON ``.dat`` file produced by
        :class:`EKFExporter` or the legacy ``DataModel``.

        The file may contain either:

        * An EKF prediction dict  (``filtered_states`` key present)
        * The legacy SQLite-backup schema  (not useful for re-filtering)
        """
        try:
            payload = _read_dat(path)
        except Exception as exc:
            logger.error("from_dat(%s): %s", path, exc)
            return {}

        ticker = payload.get("ticker", os.path.basename(path))

        # EKF states .dat → reconstruct a Close-like series from log_prices
        if "filtered_states" in payload:
            states = payload["filtered_states"]
            df = pd.DataFrame([
                {"Close": float(np.exp(s["log_price"])),
                 "log_price": s["log_price"],
                 "volatility": s["volatility"],
                 "momentum_angle": s["momentum_angle"]}
                for s in states
            ])
            return {ticker: df}

        # Legacy DataModel compressed-SQLite .dat — not re-importable here
        logger.warning(
            "from_dat: %s appears to be a legacy SQLite backup — "
            "use DataModel.read_data() instead.", path
        )
        return {}

    def from_dat_directory(self, directory: str) -> Dict[str, pd.DataFrame]:
        """Import all ``.dat`` files from *directory*."""
        results: Dict[str, pd.DataFrame] = {}
        for fname in os.listdir(directory):
            if not fname.endswith(".dat"):
                continue
            part = self.from_dat(os.path.join(directory, fname))
            results.update(part)
        return results

    def from_zip(
        self,
        path: str,
        ticker_hint: str = "UNKNOWN",
    ) -> Dict[str, pd.DataFrame]:
        """
        Import from a ZIP archive.

        Each member is extracted to a temp directory and loaded with
        :py:meth:`load`.  The member's filename stem is used as ticker
        name when no Ticker column is present.
        """
        results: Dict[str, pd.DataFrame] = {}
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                with zipfile.ZipFile(path, "r") as zf:
                    zf.extractall(tmpdir)
                for root, _dirs, files in os.walk(tmpdir):
                    for fname in files:
                        fpath = os.path.join(root, fname)
                        hint = os.path.splitext(fname)[0].upper() or ticker_hint
                        part = self.load(fpath, ticker_hint=hint)
                        results.update(part)
        except Exception as exc:
            logger.error("from_zip(%s): %s", path, exc)
        return results

    def from_sqlite(
        self,
        path: str,
        table: str = "prices",
        close_column: str = "Close",
        ticker_column: str = "Ticker",
        date_column: str = "Date",
    ) -> Dict[str, pd.DataFrame]:
        """
        Import from a SQLite database.

        Parameters
        ----------
        path : str
            Path to the ``.db`` file.
        table : str
            Table name (default ``"prices"``).
        """
        try:
            conn = sqlite3.connect(path)
            try:
                df = pd.read_sql_query(f"SELECT * FROM {table}", conn)  # noqa: S608
            finally:
                conn.close()
            return self._split_by_ticker(df, "UNKNOWN", ticker_column,
                                         date_column, close_column)
        except Exception as exc:
            logger.error("from_sqlite(%s): %s", path, exc)
            return {}

    def from_dict_of_lists(
        self,
        data: Dict[str, List[float]],
    ) -> Dict[str, pd.DataFrame]:
        """
        Build DataFrames from a ``{ticker: [close_price, …]}`` mapping.

        Useful for testing or embedding price data inline.
        """
        result: Dict[str, pd.DataFrame] = {}
        for ticker, prices in data.items():
            result[ticker] = pd.DataFrame({"Close": prices})
        return result

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _split_by_ticker(
        self,
        df: pd.DataFrame,
        ticker_hint: str,
        ticker_column: str,
        date_column: str,
        close_column: str,
    ) -> Dict[str, pd.DataFrame]:
        """Split a flat DataFrame into per-ticker DataFrames."""
        # Normalise close column name
        col = _find_close_col(df, close_column)
        if col is None:
            logger.warning("No Close column found — columns: %s", list(df.columns))
            return {}
        if col != "Close":
            df = df.rename(columns={col: "Close"})

        if ticker_column in df.columns:
            return {
                str(ticker): sub.reset_index(drop=True)
                for ticker, sub in df.groupby(ticker_column)
            }
        return {ticker_hint: df.reset_index(drop=True)}

    def _parse_json_payload(
        self, raw: Any, ticker_hint: str
    ) -> Dict[str, pd.DataFrame]:
        """Dispatch JSON payload by schema."""
        if isinstance(raw, dict):
            # Ticker-keyed mapping
            if all(isinstance(v, list) for v in raw.values()):
                result = {}
                for t, records in raw.items():
                    if records and isinstance(records[0], dict):
                        sub = pd.DataFrame(records)
                        col = _find_close_col(sub, "close")
                        if col:
                            sub = sub.rename(columns={col: "Close"})
                        result[str(t)] = sub
                return result
            # Single EKF prediction / state dict
            ticker = raw.get("ticker", ticker_hint)
            if "filtered_states" in raw:
                states = raw["filtered_states"]
                df = pd.DataFrame([
                    {"Close": float(np.exp(s["log_price"]))} for s in states
                ])
                return {ticker: df}
        elif isinstance(raw, list) and raw:
            df = pd.DataFrame(raw)
            if "ticker" in df.columns or "Ticker" in df.columns:
                tc = "ticker" if "ticker" in df.columns else "Ticker"
                df = df.rename(columns={tc: "Ticker"})
                return self._split_by_ticker(
                    df, ticker_hint, "Ticker", "date", "close"
                )
            col = _find_close_col(df, "close")
            if col:
                df = df.rename(columns={col: "Close"})
                return {ticker_hint: df}
        logger.warning("Unrecognised JSON schema")
        return {}


# ---------------------------------------------------------------------------
# EKFExporter
# ---------------------------------------------------------------------------

class EKFExporter:
    """
    Write EKF results to a variety of output formats.

    All ``export_*`` methods accept the dict returned by
    :py:meth:`EKFRunner.run_batch` (``{ticker: result_dict}``) and write
    to the requested destination.

    Supported targets
    -----------------
    - **gzip-JSON .dat**  — one file per ticker under ``states/`` / ``predictions/``
    - **CSV**             — one combined file or one file per ticker
    - **Parquet**         — one combined file or one file per ticker
    - **JSON**            — summary or full (with states)
    - **SQLite**          — flat table of prediction rows
    - **Text summary**    — aligned table printed to stdout or a file
    - **ZIP archive**     — bundle of any of the above

    All methods return the path(s) written.
    """

    def __init__(self, output_dir: str = ".") -> None:
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    # ------------------------------------------------------------------ #
    # .dat  (gzip-JSON)
    # ------------------------------------------------------------------ #

    def export_states_dat(
        self,
        results: Dict[str, Dict[str, Any]],
        subdir: str = "states",
    ) -> List[str]:
        """
        Write filtered state vectors as gzip-JSON ``.dat`` files —
        one file per ticker under ``<output_dir>/<subdir>/``.

        Returns
        -------
        list of file paths written
        """
        out_dir = os.path.join(self.output_dir, subdir)
        os.makedirs(out_dir, exist_ok=True)
        paths = []
        year = datetime.now().year
        for ticker, res in results.items():
            path = os.path.join(out_dir, f"{ticker}_{year}.dat")
            payload = {
                "ticker": ticker,
                "year": year,
                "stored_at": datetime.now().isoformat(),
                "states": res.get("filtered_states", []),
            }
            _write_dat(path, payload)
            paths.append(path)
        return paths

    def export_predictions_dat(
        self,
        results: Dict[str, Dict[str, Any]],
        subdir: str = "predictions",
    ) -> List[str]:
        """
        Write next-close predictions as gzip-JSON ``.dat`` files —
        one file per ticker under ``<output_dir>/<subdir>/``.
        """
        out_dir = os.path.join(self.output_dir, subdir)
        os.makedirs(out_dir, exist_ok=True)
        paths = []
        for ticker, res in results.items():
            path = os.path.join(out_dir, f"{ticker}_next_close.dat")
            _write_dat(path, res)
            paths.append(path)
        return paths

    # ------------------------------------------------------------------ #
    # CSV
    # ------------------------------------------------------------------ #

    def export_predictions_csv(
        self,
        results: Dict[str, Dict[str, Any]],
        filename: str = "ekf_predictions.csv",
    ) -> str:
        """
        Write a combined CSV of prediction summaries (one row per ticker).

        Columns: Ticker, LastClose, PredictedClose, ReturnPct,
                 Volatility, MomentumAngle, CovTrace, FilteredAt,
                 ForecastHorizonDays, NObservations
        """
        path = os.path.join(self.output_dir, filename)
        rows = [_prediction_to_row(ticker, res) for ticker, res in results.items()]
        if not rows:
            return path
        fieldnames = list(rows[0].keys())
        with open(path, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        logger.info("Exported %d prediction rows → %s", len(rows), path)
        return path

    def export_predictions_csv_per_ticker(
        self,
        results: Dict[str, Dict[str, Any]],
        subdir: str = "predictions_csv",
    ) -> List[str]:
        """Write one CSV per ticker containing full filtered-state history."""
        out_dir = os.path.join(self.output_dir, subdir)
        os.makedirs(out_dir, exist_ok=True)
        paths = []
        for ticker, res in results.items():
            states = res.get("filtered_states", [])
            if not states:
                continue
            path = os.path.join(out_dir, f"{ticker}_states.csv")
            df = pd.DataFrame(states)
            df.insert(0, "Ticker", ticker)
            df.to_csv(path, index=False)
            paths.append(path)
        return paths

    def export_forecasts_csv(
        self,
        results: Dict[str, Dict[str, Any]],
        filename: str = "ekf_forecasts.csv",
    ) -> str:
        """
        Write forward forecast rows to CSV.

        Columns: Ticker, Day, LogPrice, EstimatedClose, Volatility,
                 MomentumAngle, CovTrace
        """
        path = os.path.join(self.output_dir, filename)
        rows: List[Dict[str, Any]] = []
        for ticker, res in results.items():
            for day_idx, fc in enumerate(res.get("forecasts", []), start=1):
                rows.append({
                    "Ticker": ticker,
                    "Day": day_idx,
                    "LogPrice": fc.get("log_price"),
                    "EstimatedClose": round(float(np.exp(fc["log_price"])), 6),
                    "Volatility": fc.get("volatility"),
                    "MomentumAngle": fc.get("momentum_angle"),
                    "CovTrace": fc.get("P_trace"),
                })
        if rows:
            fieldnames = list(rows[0].keys())
            with open(path, "w", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
        logger.info("Exported %d forecast rows → %s", len(rows), path)
        return path

    # ------------------------------------------------------------------ #
    # Parquet
    # ------------------------------------------------------------------ #

    def export_predictions_parquet(
        self,
        results: Dict[str, Dict[str, Any]],
        filename: str = "ekf_predictions.parquet",
    ) -> str:
        """
        Write prediction summaries to a Parquet file.

        Falls back to CSV if ``pyarrow`` / ``fastparquet`` is not installed.
        """
        path = os.path.join(self.output_dir, filename)
        rows = [_prediction_to_row(ticker, res) for ticker, res in results.items()]
        if not rows:
            return path
        df = pd.DataFrame(rows)
        try:
            df.to_parquet(path, index=False)
            logger.info("Exported %d prediction rows → %s (Parquet)", len(rows), path)
        except ImportError:
            fallback = path.replace(".parquet", ".csv")
            df.to_csv(fallback, index=False)
            logger.warning("pyarrow not installed — wrote CSV instead: %s", fallback)
            path = fallback
        return path

    def export_states_parquet(
        self,
        results: Dict[str, Dict[str, Any]],
        subdir: str = "states_parquet",
    ) -> List[str]:
        """Write one Parquet file per ticker containing filtered state history."""
        out_dir = os.path.join(self.output_dir, subdir)
        os.makedirs(out_dir, exist_ok=True)
        paths = []
        for ticker, res in results.items():
            states = res.get("filtered_states", [])
            if not states:
                continue
            path = os.path.join(out_dir, f"{ticker}_states.parquet")
            df = pd.DataFrame(states)
            df.insert(0, "Ticker", ticker)
            try:
                df.to_parquet(path, index=False)
            except ImportError:
                path = path.replace(".parquet", ".csv")
                df.to_csv(path, index=False)
            paths.append(path)
        return paths

    # ------------------------------------------------------------------ #
    # JSON
    # ------------------------------------------------------------------ #

    def export_summary_json(
        self,
        results: Dict[str, Dict[str, Any]],
        filename: str = "ekf_summary.json",
        include_states: bool = False,
    ) -> str:
        """
        Write a JSON summary of all EKF results.

        Parameters
        ----------
        include_states : bool
            When ``True``, include the full per-bar ``filtered_states``
            list.  When ``False`` (default), only prediction scalars and
            forward forecasts are written.
        """
        path = os.path.join(self.output_dir, filename)
        payload: Dict[str, Any] = {}
        for ticker, res in results.items():
            entry = {k: v for k, v in res.items()
                     if include_states or k != "filtered_states"}
            payload[ticker] = entry
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, default=_json_default)
        logger.info("Exported JSON summary → %s", path)
        return path

    def export_per_ticker_json(
        self,
        results: Dict[str, Dict[str, Any]],
        subdir: str = "predictions_json",
    ) -> List[str]:
        """Write one full JSON file per ticker (includes states and forecasts)."""
        out_dir = os.path.join(self.output_dir, subdir)
        os.makedirs(out_dir, exist_ok=True)
        paths = []
        for ticker, res in results.items():
            path = os.path.join(out_dir, f"{ticker}.json")
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(res, fh, indent=2, default=_json_default)
            paths.append(path)
        return paths

    # ------------------------------------------------------------------ #
    # SQLite
    # ------------------------------------------------------------------ #

    def export_predictions_sqlite(
        self,
        results: Dict[str, Dict[str, Any]],
        db_path: Optional[str] = None,
        table: str = "ekf_predictions",
    ) -> str:
        """
        Upsert prediction summaries into a SQLite database.

        The table is created with ``IF NOT EXISTS`` so multiple export
        calls append without duplication of the schema.
        """
        if db_path is None:
            db_path = os.path.join(self.output_dir, "ekf_results.db")
        rows = [_prediction_to_row(ticker, res) for ticker, res in results.items()]
        if not rows:
            return db_path
        df = pd.DataFrame(rows)
        conn = sqlite3.connect(db_path)
        try:
            df.to_sql(table, conn, if_exists="append", index=False)
            conn.commit()
        finally:
            conn.close()
        logger.info("Upserted %d rows into %s::%s", len(rows), db_path, table)
        return db_path

    def export_states_sqlite(
        self,
        results: Dict[str, Dict[str, Any]],
        db_path: Optional[str] = None,
        table: str = "ekf_states",
    ) -> str:
        """Append all filtered state rows to a SQLite ``ekf_states`` table."""
        if db_path is None:
            db_path = os.path.join(self.output_dir, "ekf_results.db")
        all_rows: List[Dict[str, Any]] = []
        for ticker, res in results.items():
            for i, s in enumerate(res.get("filtered_states", [])):
                row = {"Ticker": ticker, "BarIndex": i}
                row.update(s)
                all_rows.append(row)
        if not all_rows:
            return db_path
        df = pd.DataFrame(all_rows)
        conn = sqlite3.connect(db_path)
        try:
            df.to_sql(table, conn, if_exists="append", index=False)
            conn.commit()
        finally:
            conn.close()
        logger.info("Appended %d state rows into %s::%s", len(all_rows), db_path, table)
        return db_path

    # ------------------------------------------------------------------ #
    # Text summary
    # ------------------------------------------------------------------ #

    def export_text_summary(
        self,
        results: Dict[str, Dict[str, Any]],
        filename: Optional[str] = None,
    ) -> str:
        """
        Write an aligned text table of predictions.

        When *filename* is ``None`` the summary is printed to stdout and
        an empty string is returned.
        """
        lines = [
            "",
            "=" * 90,
            "EKF BAYESIAN STATE ESTIMATION — NEXT-CLOSE PREDICTIONS",
            "=" * 90,
            f"{'Ticker':<10} {'LastClose':>12} {'PredClose':>12} {'Return%':>9}"
            f"  {'Volatility':>12}  {'Theta(rad)':>10}  {'CovTrace':>10}",
            "-" * 90,
        ]
        for ticker in sorted(results):
            res = results[ticker]
            lines.append(
                f"{ticker:<10} "
                f"${res.get('last_close', 0):>11.4f} "
                f"${res.get('predicted_close', 0):>11.4f} "
                f"{res.get('predicted_return_pct', 0):>+8.2f}%  "
                f"{res.get('filtered_volatility', 0):>12.6f}  "
                f"{res.get('filtered_momentum_angle', 0):>10.4f}  "
                f"{res.get('posterior_cov_trace', 0):>10.6f}"
            )
        lines += [
            "=" * 90,
            f"Generated: {datetime.now().isoformat()}",
            "",
        ]
        text = "\n".join(lines)

        if filename is None:
            print(text)
            return ""
        path = os.path.join(self.output_dir, filename)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
        logger.info("Text summary → %s", path)
        return path

    # ------------------------------------------------------------------ #
    # ZIP bundle
    # ------------------------------------------------------------------ #

    def export_zip_bundle(
        self,
        results: Dict[str, Dict[str, Any]],
        filename: str = "ekf_export.zip",
        include_states_dat: bool = True,
        include_predictions_dat: bool = True,
        include_csv: bool = True,
        include_json: bool = True,
    ) -> str:
        """
        Bundle multiple export formats into a single ZIP archive.

        Parameters
        ----------
        include_states_dat, include_predictions_dat, include_csv, include_json
            Toggle which formats to include.

        Returns
        -------
        str  — path to the ZIP file
        """
        with tempfile.TemporaryDirectory() as staging:
            stager = EKFExporter(output_dir=staging)
            members: List[str] = []
            if include_states_dat:
                members.extend(stager.export_states_dat(results))
            if include_predictions_dat:
                members.extend(stager.export_predictions_dat(results))
            if include_csv:
                members.append(stager.export_predictions_csv(results))
                members.append(stager.export_forecasts_csv(results))
            if include_json:
                members.append(
                    stager.export_summary_json(results, include_states=False)
                )

            zip_path = os.path.join(self.output_dir, filename)
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for fpath in members:
                    if fpath and os.path.exists(fpath):
                        zf.write(fpath, arcname=os.path.relpath(fpath, staging))

        logger.info("ZIP bundle → %s", zip_path)
        return zip_path


# ---------------------------------------------------------------------------
# EKFRunner
# ---------------------------------------------------------------------------

class EKFRunner:
    """
    Orchestrate EKF analysis: calibrate, filter, forecast, persist.

    Parameters
    ----------
    data_dir : str
        Base directory for output ``.dat`` files.
    forecast_days : int
        Trading days to predict ahead (default 5).
    importer : EKFImporter, optional
        Custom importer.  A default instance is created if omitted.
    exporter : EKFExporter, optional
        Custom exporter writing to *data_dir*.  A default instance is
        created if omitted.
    """

    def __init__(
        self,
        data_dir: str = ".",
        forecast_days: int = 5,
        importer: Optional[EKFImporter] = None,
        exporter: Optional[EKFExporter] = None,
    ) -> None:
        self.data_dir = data_dir
        self.forecast_days = forecast_days
        self._states_dir = os.path.join(data_dir, "states")
        self._pred_dir = os.path.join(data_dir, "predictions")
        os.makedirs(self._states_dir, exist_ok=True)
        os.makedirs(self._pred_dir, exist_ok=True)
        self.importer = importer or EKFImporter()
        self.exporter = exporter or EKFExporter(output_dir=data_dir)

    # ------------------------------------------------------------------ #
    # Single-ticker entry point
    # ------------------------------------------------------------------ #

    def run_for_ticker(
        self,
        ticker: str,
        df: pd.DataFrame,
        ekf_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Run the EKF on a single ticker's OHLCV DataFrame.

        Parameters
        ----------
        ticker : str
        df : pd.DataFrame  — must contain a ``Close`` column (any case).
        ekf_params : dict, optional  — override any EKF constructor kwargs.

        Returns
        -------
        dict  with prediction scalars, state history, and file paths.
        Returns an empty dict on failure or insufficient data.
        """
        close_prices = _extract_close(df)
        if close_prices is None or len(close_prices) < 10:
            logger.warning(
                "%s: insufficient data (%d rows) — skipping EKF",
                ticker,
                0 if close_prices is None else len(close_prices),
            )
            return {}

        try:
            log_prices = np.log(close_prices.astype(float))
            ekf = self._build_ekf_static(log_prices, ekf_params)
            filtered = ekf.batch_filter(log_prices)
            forecasts = ekf.predict_next(n_steps=self.forecast_days)

            predicted_log = forecasts[0]["log_price"] if forecasts else float(log_prices[-1])
            predicted_close = float(np.exp(predicted_log))
            last_close = float(close_prices[-1])
            predicted_return = (predicted_close - last_close) / last_close

            result: Dict[str, Any] = {
                "ticker": ticker,
                "last_close": round(last_close, 6),
                "predicted_close": round(predicted_close, 6),
                "predicted_return_pct": round(predicted_return * 100, 4),
                "filtered_volatility": round(filtered[-1]["volatility"], 8),
                "filtered_momentum_angle": round(filtered[-1]["momentum_angle"], 6),
                "posterior_cov_trace": round(filtered[-1]["P_trace"], 8),
                "forecast_horizon_days": self.forecast_days,
                "n_observations": len(log_prices),
                "filtered_at": datetime.now().isoformat(),
                "forecasts": forecasts,
                "filtered_states": _compact_states(filtered),
            }

            states_path = self._store_states(ticker, filtered)
            pred_path = self._store_predictions(ticker, result)
            result["states_dat"] = states_path
            result["predictions_dat"] = pred_path

            logger.info(
                "%s → pred $%.4f (%+.2f%%) | vol=%.6f | Θ=%.4f",
                ticker,
                predicted_close,
                predicted_return * 100,
                filtered[-1]["volatility"],
                filtered[-1]["momentum_angle"],
            )
            return result

        except Exception as exc:  # noqa: BLE001
            logger.warning("%s: EKF failed — %s", ticker, exc)
            return {}

    # ------------------------------------------------------------------ #
    # Parallel batch entry point
    # ------------------------------------------------------------------ #

    def run_batch(
        self,
        data_dict: Dict[str, pd.DataFrame],
        ekf_params: Optional[Dict[str, Any]] = None,
        max_workers: int = 4,
        use_processes: bool = False,
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Run EKF analysis for multiple tickers in parallel.

        Parameters
        ----------
        data_dict : dict  {ticker: DataFrame}
        ekf_params : dict, optional
            Shared EKF parameter overrides applied to every ticker.
        max_workers : int
            Degree of parallelism.  Each worker processes one ticker at a
            time.  Set to 1 to run sequentially (useful for debugging).
        use_processes : bool
            ``False``  (default) — use ``ThreadPoolExecutor``; safe for
            pure-numpy code, zero pickle overhead, lower memory.
            ``True``   — use ``ProcessPoolExecutor``; bypasses the GIL,
            beneficial when each ticker has thousands of observations.
        progress_callback : callable, optional
            Called as ``progress_callback(ticker, result)`` after each
            ticker completes.

        Returns
        -------
        dict  {ticker: result_dict}  — failed tickers are omitted.
        """
        if not data_dict:
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        n = len(data_dict)
        logger.info(
            "EKF batch: %d tickers, max_workers=%d, executor=%s",
            n, max_workers,
            "ProcessPool" if use_processes else "ThreadPool",
        )

        if use_processes:
            # Build picklable tasks (close_prices arrays, not DataFrames)
            tasks: List[Tuple[str, np.ndarray, Optional[Dict[str, Any]], int]] = []
            for ticker, df in data_dict.items():
                arr = _extract_close(df)
                tasks.append((ticker, arr, ekf_params, self.forecast_days))

            executor_cls: Any = concurrent.futures.ProcessPoolExecutor
            futures_map: Dict[concurrent.futures.Future, str] = {}

            with executor_cls(max_workers=max_workers) as pool:
                for task in tasks:
                    fut = pool.submit(run_ticker_task, task)
                    futures_map[fut] = task[0]

                for fut in concurrent.futures.as_completed(futures_map):
                    ticker = futures_map[fut]
                    try:
                        _, res = fut.result()
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("%s: worker raised %s", ticker, exc)
                        res = {}

                    if res:
                        # Persist .dat files from main process
                        self._store_states(ticker, res.get("filtered_states", []))
                        self._store_predictions(ticker, res)
                        res["states_dat"] = os.path.join(
                            self._states_dir, f"{ticker}_{datetime.now().year}.dat"
                        )
                        res["predictions_dat"] = os.path.join(
                            self._pred_dir, f"{ticker}_next_close.dat"
                        )
                        results[ticker] = res

                    if progress_callback:
                        try:
                            progress_callback(ticker, res)
                        except Exception:  # noqa: BLE001
                            pass

        else:
            # ThreadPoolExecutor: run run_for_ticker directly
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
                future_to_ticker: Dict[concurrent.futures.Future, str] = {
                    pool.submit(self.run_for_ticker, ticker, df, ekf_params): ticker
                    for ticker, df in data_dict.items()
                }

                for fut in concurrent.futures.as_completed(future_to_ticker):
                    ticker = future_to_ticker[fut]
                    try:
                        res = fut.result()
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("%s: thread raised %s", ticker, exc)
                        res = {}

                    if res:
                        results[ticker] = res

                    if progress_callback:
                        try:
                            progress_callback(ticker, res)
                        except Exception:  # noqa: BLE001
                            pass

        logger.info("EKF batch complete: %d/%d succeeded", len(results), n)
        return results

    # ------------------------------------------------------------------ #
    # Import-then-run helpers
    # ------------------------------------------------------------------ #

    def run_from_file(
        self,
        path: str,
        ticker_hint: str = "UNKNOWN",
        ekf_params: Optional[Dict[str, Any]] = None,
        max_workers: int = 4,
        use_processes: bool = False,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Import price data from *path* (auto-detected format) and run
        the EKF batch.

        Returns ``{ticker: result_dict}``.
        """
        data_dict = self.importer.load(path, ticker_hint=ticker_hint)
        if not data_dict:
            logger.warning("run_from_file: no data loaded from %s", path)
            return {}
        return self.run_batch(
            data_dict,
            ekf_params=ekf_params,
            max_workers=max_workers,
            use_processes=use_processes,
        )

    def run_from_directory(
        self,
        directory: str,
        glob_pattern: str = "*.csv",
        ekf_params: Optional[Dict[str, Any]] = None,
        max_workers: int = 4,
        use_processes: bool = False,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Import all CSV files in *directory* and run the EKF batch.
        """
        data_dict = self.importer.from_csv_directory(directory, glob_pattern)
        if not data_dict:
            logger.warning("run_from_directory: no data loaded from %s", directory)
            return {}
        return self.run_batch(
            data_dict,
            ekf_params=ekf_params,
            max_workers=max_workers,
            use_processes=use_processes,
        )

    # ------------------------------------------------------------------ #
    # Export helpers (delegates to self.exporter)
    # ------------------------------------------------------------------ #

    def export_all(
        self,
        results: Dict[str, Dict[str, Any]],
        formats: Iterable[str] = ("dat", "csv", "json"),
        zip_bundle: bool = False,
    ) -> Dict[str, Any]:
        """
        Export results to every format listed in *formats*.

        Parameters
        ----------
        results : dict  {ticker: result_dict}
        formats : iterable of str
            Any combination of ``"dat"``, ``"csv"``, ``"parquet"``,
            ``"json"``, ``"sqlite"``, ``"txt"``.
        zip_bundle : bool
            When ``True`` also write a ZIP bundle of all exported files.

        Returns
        -------
        dict  {format_name: path_or_list_of_paths}
        """
        written: Dict[str, Any] = {}
        for fmt in formats:
            fmt = fmt.lower()
            if fmt == "dat":
                written["states_dat"] = self.exporter.export_states_dat(results)
                written["predictions_dat"] = self.exporter.export_predictions_dat(results)
            elif fmt == "csv":
                written["predictions_csv"] = self.exporter.export_predictions_csv(results)
                written["forecasts_csv"] = self.exporter.export_forecasts_csv(results)
                written["states_csv"] = self.exporter.export_predictions_csv_per_ticker(results)
            elif fmt == "parquet":
                written["predictions_parquet"] = self.exporter.export_predictions_parquet(results)
                written["states_parquet"] = self.exporter.export_states_parquet(results)
            elif fmt == "json":
                written["summary_json"] = self.exporter.export_summary_json(results)
                written["per_ticker_json"] = self.exporter.export_per_ticker_json(results)
            elif fmt == "sqlite":
                written["sqlite"] = self.exporter.export_predictions_sqlite(results)
                self.exporter.export_states_sqlite(results)
            elif fmt == "txt":
                written["txt"] = self.exporter.export_text_summary(
                    results, filename="ekf_summary.txt"
                )
            else:
                logger.warning("Unknown export format: %s", fmt)

        if zip_bundle:
            written["zip"] = self.exporter.export_zip_bundle(results)

        return written

    # ------------------------------------------------------------------ #
    # .dat read/write (legacy public API)
    # ------------------------------------------------------------------ #

    def load_states(
        self, ticker: str, year: Optional[int] = None
    ) -> Dict[str, Any]:
        """Load filtered state vectors previously stored for *ticker*."""
        if year is None:
            year = datetime.now().year
        return _read_dat(os.path.join(self._states_dir, f"{ticker}_{year}.dat"))

    def load_predictions(self, ticker: str) -> Dict[str, Any]:
        """Load the latest next-close prediction for *ticker*."""
        return _read_dat(os.path.join(self._pred_dir, f"{ticker}_next_close.dat"))

    # ------------------------------------------------------------------ #
    # Static calibration helper (also used by run_ticker_task)
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_ekf_static(
        log_prices: np.ndarray,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> ExtendedKalmanFilter:
        """
        Calibrate EKF parameters from *log_prices* and construct the filter.

        Exposed as a ``@staticmethod`` so it can be called from the
        module-level ``run_ticker_task`` worker without pickling ``self``.
        """
        log_returns = np.diff(log_prices)
        mu = float(np.mean(log_returns))
        init_vol = max(float(np.var(log_returns)), 1e-10)
        second_diff = np.diff(log_returns)
        sigma_v = max(float(np.std(second_diff ** 2)) * 10.0, 0.01) \
            if len(second_diff) > 1 else 0.1
        P_ref = float(np.median(log_prices))
        R = max(init_vol * 0.1, 1e-8)

        params: Dict[str, Any] = dict(
            mu=mu,
            kappa=2.0,
            theta_v=init_vol,
            sigma_v=sigma_v,
            dt=1.0,
            P_ref=P_ref,
            x0=np.array([log_prices[0], init_vol, 0.0]),
            R=R,
        )
        if overrides:
            params.update(overrides)
            if "x0" in overrides and not isinstance(overrides["x0"], np.ndarray):
                params["x0"] = np.array(overrides["x0"], dtype=float)

        return ExtendedKalmanFilter(**params)

    # Keep the instance alias for backwards compatibility
    _build_ekf = _build_ekf_static  # type: ignore[assignment]

    # ------------------------------------------------------------------ #
    # Private .dat persistence
    # ------------------------------------------------------------------ #

    def _store_states(
        self, ticker: str, states: List[Dict[str, Any]]
    ) -> str:
        year = datetime.now().year
        path = os.path.join(self._states_dir, f"{ticker}_{year}.dat")
        _write_dat(path, {
            "ticker": ticker,
            "year": year,
            "stored_at": datetime.now().isoformat(),
            "states": states,
        })
        return path

    def _store_predictions(
        self, ticker: str, prediction: Dict[str, Any]
    ) -> str:
        path = os.path.join(self._pred_dir, f"{ticker}_next_close.dat")
        _write_dat(path, prediction)
        return path


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _extract_close(df: pd.DataFrame) -> Optional[np.ndarray]:
    """Return the Close price array regardless of column capitalisation."""
    for col in ("Close", "close", "CLOSE", "Adj Close", "adj_close"):
        if col in df.columns:
            series = df[col].dropna()
            if len(series) > 0:
                return series.values.astype(float)
    return None


def _find_close_col(df: pd.DataFrame, preferred: str = "Close") -> Optional[str]:
    """Return the first matching close-price column name, or None."""
    candidates = [preferred, "Close", "close", "CLOSE", "Adj Close", "adj_close",
                  "close_price", "ClosePrice"]
    for c in candidates:
        if c in df.columns:
            return c
    return None


def _compact_states(states: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    """Remove the verbose ``x_posterior`` key from each step result."""
    keep = {"log_price", "volatility", "momentum_angle", "innovation", "P_trace"}
    return [{k: v for k, v in s.items() if k in keep} for s in states]


def _prediction_to_row(ticker: str, res: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten a prediction result dict into a CSV/SQLite-friendly row."""
    return {
        "Ticker": ticker,
        "LastClose": res.get("last_close"),
        "PredictedClose": res.get("predicted_close"),
        "ReturnPct": res.get("predicted_return_pct"),
        "Volatility": res.get("filtered_volatility"),
        "MomentumAngle": res.get("filtered_momentum_angle"),
        "CovTrace": res.get("posterior_cov_trace"),
        "FilteredAt": res.get("filtered_at"),
        "ForecastHorizonDays": res.get("forecast_horizon_days"),
        "NObservations": res.get("n_observations"),
    }


def _write_dat(path: str, payload: Any) -> None:
    """Serialise *payload* to JSON and write as gzip to *path*."""
    data = json.dumps(payload, default=_json_default).encode("utf-8")
    with gzip.open(path, "wb") as fh:
        fh.write(data)


def _read_dat(path: str) -> Dict[str, Any]:
    """Read and decompress a `.dat` file, returning decoded JSON."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"EKF data file not found: {path}")
    with gzip.open(path, "rb") as fh:
        return json.loads(fh.read().decode("utf-8"))


def _json_default(obj: Any) -> Any:
    """JSON serialisation fallback for numpy scalar/array types."""
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")



class EKFRunner:
    """
    High-level runner that wires OHLCV price data to the EKF and manages
    compressed `.dat` storage.

    Parameters
    ----------
    data_dir : str
        Base directory for output `.dat` files.
        Sub-directories ``states/`` and ``predictions/`` are created
        automatically.
    forecast_days : int
        Number of trading days to predict ahead (default 5).
    """

    def __init__(self, data_dir: str = ".", forecast_days: int = 5) -> None:
        self.data_dir = data_dir
        self.forecast_days = forecast_days
        self._states_dir = os.path.join(data_dir, "states")
        self._pred_dir = os.path.join(data_dir, "predictions")
        os.makedirs(self._states_dir, exist_ok=True)
        os.makedirs(self._pred_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_for_ticker(
        self,
        ticker: str,
        df: pd.DataFrame,
        ekf_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Run the EKF on a single ticker's OHLCV DataFrame.

        Parameters
        ----------
        ticker : str
        df : pd.DataFrame
            Must contain a ``Close`` column (or ``close``).
        ekf_params : dict, optional
            Override any EKF constructor keyword arguments.

        Returns
        -------
        dict with summary statistics, forecasts, and file paths.
        Returns an empty dict if data is insufficient or an error occurs.
        """
        close_prices = _extract_close(df)
        if close_prices is None or len(close_prices) < 10:
            logger.warning(
                "%s: insufficient data (%d rows) — skipping EKF",
                ticker,
                0 if close_prices is None else len(close_prices),
            )
            return {}

        try:
            log_prices = np.log(close_prices.astype(float))
            ekf = self._build_ekf(log_prices, ekf_params)
            filtered = ekf.batch_filter(log_prices)
            forecasts = ekf.predict_next(n_steps=self.forecast_days)

            predicted_log = forecasts[0]["log_price"] if forecasts else log_prices[-1]
            predicted_close = float(np.exp(predicted_log))
            last_close = float(close_prices[-1])
            predicted_return = (predicted_close - last_close) / last_close

            result: Dict[str, Any] = {
                "ticker": ticker,
                "last_close": round(last_close, 6),
                "predicted_close": round(predicted_close, 6),
                "predicted_return_pct": round(predicted_return * 100, 4),
                "filtered_volatility": round(filtered[-1]["volatility"], 8),
                "filtered_momentum_angle": round(filtered[-1]["momentum_angle"], 6),
                "posterior_cov_trace": round(filtered[-1]["P_trace"], 8),
                "forecast_horizon_days": self.forecast_days,
                "n_observations": len(log_prices),
                "filtered_at": datetime.now().isoformat(),
                "forecasts": forecasts,
                # Strip heavy per-step lists; keep compact summary per bar
                "filtered_states": _compact_states(filtered),
            }

            states_path = self._store_states(ticker, filtered)
            pred_path = self._store_predictions(ticker, result)
            result["states_dat"] = states_path
            result["predictions_dat"] = pred_path

            logger.info(
                "%s → predicted close $%.4f (%+.2f%%) | vol=%.6f | Θ=%.4f",
                ticker,
                predicted_close,
                predicted_return * 100,
                filtered[-1]["volatility"],
                filtered[-1]["momentum_angle"],
            )
            return result

        except Exception as exc:  # noqa: BLE001
            logger.warning("%s: EKF failed — %s", ticker, exc)
            return {}

    def run_batch(
        self,
        data_dict: Dict[str, pd.DataFrame],
        ekf_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Run EKF analysis for multiple tickers.

        Parameters
        ----------
        data_dict : dict  {ticker: DataFrame}
        ekf_params : dict, optional
            Shared parameter overrides applied to every ticker.

        Returns
        -------
        dict  {ticker: result_dict}  (tickers that failed are omitted)
        """
        results: Dict[str, Dict[str, Any]] = {}
        for ticker, df in data_dict.items():
            result = self.run_for_ticker(ticker, df, ekf_params)
            if result:
                results[ticker] = result
        return results

    def load_states(
        self, ticker: str, year: Optional[int] = None
    ) -> Dict[str, Any]:
        """Load filtered state vectors previously stored for *ticker*."""
        if year is None:
            year = datetime.now().year
        path = os.path.join(self._states_dir, f"{ticker}_{year}.dat")
        return _read_dat(path)

    def load_predictions(self, ticker: str) -> Dict[str, Any]:
        """Load the latest next-close prediction for *ticker*."""
        path = os.path.join(self._pred_dir, f"{ticker}_next_close.dat")
        return _read_dat(path)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_ekf(
        log_prices: np.ndarray,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> ExtendedKalmanFilter:
        """
        Calibrate EKF parameters from the log-price series and construct
        the filter, then optionally apply caller overrides.
        """
        log_returns = np.diff(log_prices)
        mu = float(np.mean(log_returns))
        init_vol = max(float(np.var(log_returns)), 1e-10)
        sigma_v = max(float(np.std(np.diff(log_returns) ** 2)) * 10.0, 0.01)
        P_ref = float(np.median(log_prices))
        R = max(init_vol * 0.1, 1e-8)

        params: Dict[str, Any] = dict(
            mu=mu,
            kappa=2.0,
            theta_v=init_vol,
            sigma_v=sigma_v,
            dt=1.0,
            P_ref=P_ref,
            x0=np.array([log_prices[0], init_vol, 0.0]),
            R=R,
        )
        if overrides:
            params.update(overrides)
            # Ensure x0 is ndarray if caller passed a list
            if "x0" in overrides and not isinstance(overrides["x0"], np.ndarray):
                params["x0"] = np.array(overrides["x0"], dtype=float)

        return ExtendedKalmanFilter(**params)

    def _store_states(
        self, ticker: str, states: List[Dict[str, Any]]
    ) -> str:
        """Compress and persist filtered state vectors."""
        year = datetime.now().year
        path = os.path.join(self._states_dir, f"{ticker}_{year}.dat")
        payload = {
            "ticker": ticker,
            "year": year,
            "stored_at": datetime.now().isoformat(),
            "states": states,
        }
        _write_dat(path, payload)
        return path

    def _store_predictions(
        self, ticker: str, prediction: Dict[str, Any]
    ) -> str:
        """Compress and persist next-close prediction."""
        path = os.path.join(self._pred_dir, f"{ticker}_next_close.dat")
        _write_dat(path, prediction)
        return path


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _extract_close(df: pd.DataFrame) -> Optional[np.ndarray]:
    """Return the Close price array regardless of column capitalisation."""
    for col in ("Close", "close", "CLOSE", "Adj Close", "adj_close"):
        if col in df.columns:
            series = df[col].dropna()
            if len(series) > 0:
                return series.values.astype(float)
    return None


def _compact_states(states: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    """
    Strip ``x_posterior`` (verbose) from each step dict to keep the stored
    file small while retaining all scalar diagnostics.
    """
    keep = {"log_price", "volatility", "momentum_angle", "innovation", "P_trace"}
    return [{k: v for k, v in s.items() if k in keep} for s in states]


def _write_dat(path: str, payload: Any) -> None:
    """Serialise *payload* to JSON and write as gzip to *path*."""
    data = json.dumps(payload, default=_json_default).encode("utf-8")
    with gzip.open(path, "wb") as fh:
        fh.write(data)


def _read_dat(path: str) -> Dict[str, Any]:
    """Read and decompress a `.dat` file, returning the decoded JSON."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"EKF data file not found: {path}")
    with gzip.open(path, "rb") as fh:
        return json.loads(fh.read().decode("utf-8"))


def _json_default(obj: Any) -> Any:
    """JSON serialisation fallback for numpy scalar/array types."""
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")
