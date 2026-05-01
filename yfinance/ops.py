"""
Centralized yfinance operations used across this repository.

Extended with:
  - Router          : lightweight action-based request router
  - ActionRegistry  : register/dispatch named data-pipeline actions
  - DataStore       : in-process SQLite-backed key-value database
  - GpuDispatch     : thin NumPy/CuPy GPU dispatch shim
  - NeuralBridge    : one-call access to the yfinance_data neural forecaster
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np

from . import _REAL_YFINANCE

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Core yfinance wrappers (unchanged public API)
# ---------------------------------------------------------------------------


def download(*args: Any, **kwargs: Any):
    """
    Wrapper around yfinance.download with repo defaults.
    """
    kwargs.setdefault("progress", False)
    return _REAL_YFINANCE.download(*args, **kwargs)


def ticker(symbol: str):
    """
    Return a yfinance.Ticker instance for symbol.
    """
    return _REAL_YFINANCE.Ticker(symbol)


def ticker_history(symbol: str, **kwargs: Any):
    """
    Convenience helper for Ticker.history.
    """
    return ticker(symbol).history(**kwargs)


def ticker_info(symbol: str) -> Dict[str, Any]:
    """
    Convenience helper for Ticker.info.
    """
    info = ticker(symbol).info
    return info if isinstance(info, dict) else {}


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------


class Router:
    """
    Lightweight action-based request router for the yfinance pipeline.

    Routes string *action* names to registered handler callables, enabling
    a clean pipeline dispatch pattern (similar to an HTTP router but for
    in-process data operations).

    Example
    -------
    >>> router = Router()
    >>> @router.route("fetch")
    ... def _fetch(ctx):
    ...     return download(ctx["ticker"])
    >>> result = router.dispatch("fetch", {"ticker": "AAPL"})
    """

    def __init__(self) -> None:
        self._routes: Dict[str, Callable[[Dict[str, Any]], Any]] = {}
        self._middleware: List[Callable[[str, Dict[str, Any]], None]] = []

    def route(self, action: str) -> Callable:
        """Decorator: register a handler for *action*."""

        def decorator(fn: Callable) -> Callable:
            self._routes[action] = fn
            return fn

        return decorator

    def add_middleware(self, fn: Callable[[str, Dict[str, Any]], None]) -> None:
        """Register a pre-dispatch middleware (called before every handler)."""
        self._middleware.append(fn)

    def dispatch(self, action: str, ctx: Optional[Dict[str, Any]] = None) -> Any:
        """
        Dispatch *action* with optional context dict.

        Raises
        ------
        KeyError
            When no handler is registered for *action*.
        """
        ctx = ctx or {}
        for mw in self._middleware:
            mw(action, ctx)
        if action not in self._routes:
            raise KeyError(f"Router: no handler registered for action '{action}'")
        return self._routes[action](ctx)

    def registered_actions(self) -> List[str]:
        """Return sorted list of all registered action names."""
        return sorted(self._routes)


# Module-level default router (shared pipeline entry point)
_default_router = Router()


def get_router() -> Router:
    """Return the module-level default Router instance."""
    return _default_router


# ---------------------------------------------------------------------------
# ActionRegistry (named pipeline actions)
# ---------------------------------------------------------------------------


class ActionRegistry:
    """
    Named pipeline action registry with async dispatch support.

    Actions are callables that accept a *context* dict and return a result.
    They can be dispatched synchronously or asynchronously via a thread pool.

    Example
    -------
    >>> registry = ActionRegistry()
    >>> registry.register("zone_scan")(lambda ctx: classify_many(ctx["frames"]))
    >>> future = registry.dispatch_async("zone_scan", {"frames": frames})
    >>> result = future.result(timeout=30)
    """

    def __init__(self, max_workers: int = 4) -> None:
        self._actions: Dict[str, Callable] = {}
        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="yfaction")
        self._lock = threading.Lock()

    def register(self, name: str) -> Callable:
        """Decorator: register a callable under *name*."""

        def decorator(fn: Callable) -> Callable:
            with self._lock:
                self._actions[name] = fn
            return fn

        return decorator

    def dispatch(self, name: str, ctx: Optional[Dict[str, Any]] = None) -> Any:
        """Synchronously execute action *name* with *ctx*."""
        ctx = ctx or {}
        with self._lock:
            fn = self._actions.get(name)
        if fn is None:
            raise KeyError(f"ActionRegistry: unknown action '{name}'")
        logger.debug("ActionRegistry: dispatching '%s'", name)
        return fn(ctx)

    def dispatch_async(self, name: str, ctx: Optional[Dict[str, Any]] = None) -> Future:
        """Dispatch action *name* asynchronously; returns a Future."""
        ctx = ctx or {}
        with self._lock:
            fn = self._actions.get(name)
        if fn is None:
            raise KeyError(f"ActionRegistry: unknown action '{name}'")
        return self._pool.submit(fn, ctx)

    def list_actions(self) -> List[str]:
        """Return sorted list of registered action names."""
        with self._lock:
            return sorted(self._actions)


# Module-level default registry
_default_registry = ActionRegistry()


def get_action_registry() -> ActionRegistry:
    """Return the module-level default ActionRegistry."""
    return _default_registry


# ---------------------------------------------------------------------------
# DataStore (SQLite-backed key-value DB)
# ---------------------------------------------------------------------------


class DataStore:
    """
    In-process SQLite key-value datastore for caching yfinance results.

    Supports string keys and JSON-serialisable values.  Thread-safe via WAL
    mode and a per-connection lock.

    Parameters
    ----------
    path : str | Path
        Path to the SQLite database file.  Pass ``":memory:"`` for an
        in-memory database (useful in tests).

    Example
    -------
    >>> db = DataStore(":memory:")
    >>> db.put("AAPL_info", {"sector": "Technology"})
    >>> info = db.get("AAPL_info")
    """

    def __init__(self, path: str | Path = ":memory:") -> None:
        self._path = str(path)
        self._lock = threading.Lock()
        self._conn: Optional[sqlite3.Connection] = None
        self._connect()

    def _connect(self) -> None:
        self._conn = sqlite3.connect(self._path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS kv "
            "(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at REAL NOT NULL)"
        )
        self._conn.commit()

    def put(self, key: str, value: Any) -> None:
        """Insert or replace *key* → *value* (must be JSON-serialisable)."""
        import time

        payload = json.dumps(value)
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO kv(key, value, updated_at) VALUES(?,?,?)",
                (key, payload, time.time()),
            )
            self._conn.commit()

    def get(self, key: str, default: Any = None) -> Any:
        """Return the stored value for *key*, or *default* if absent."""
        with self._lock:
            cur = self._conn.execute("SELECT value FROM kv WHERE key=?", (key,))
            row = cur.fetchone()
        if row is None:
            return default
        return json.loads(row[0])

    def delete(self, key: str) -> None:
        """Remove *key* from the store."""
        with self._lock:
            self._conn.execute("DELETE FROM kv WHERE key=?", (key,))
            self._conn.commit()

    def keys(self, pattern: Optional[str] = None) -> List[str]:
        """Return all keys, optionally filtered by SQL LIKE *pattern*."""
        with self._lock:
            if pattern:
                cur = self._conn.execute("SELECT key FROM kv WHERE key LIKE ?", (pattern,))
            else:
                cur = self._conn.execute("SELECT key FROM kv ORDER BY key")
            return [row[0] for row in cur.fetchall()]

    def clear(self) -> None:
        """Delete all entries."""
        with self._lock:
            self._conn.execute("DELETE FROM kv")
            self._conn.commit()

    def close(self) -> None:
        """Close the underlying database connection."""
        with self._lock:
            if self._conn:
                self._conn.close()
                self._conn = None


# Module-level default in-memory store (replaced with a file path in production)
_default_store = DataStore(":memory:")


def get_datastore() -> DataStore:
    """Return the module-level default DataStore."""
    return _default_store


# ---------------------------------------------------------------------------
# GpuDispatch
# ---------------------------------------------------------------------------


class GpuDispatch:
    """
    Thin GPU dispatch shim.

    Attempts to import CuPy; falls back to NumPy transparently.  All public
    methods accept plain NumPy arrays and return NumPy arrays regardless of
    whether a GPU was used.

    Example
    -------
    >>> gpu = GpuDispatch()
    >>> result = gpu.rolling_std(close_array, window=20)
    """

    def __init__(self) -> None:
        self._xp = self._resolve_backend()
        self.backend = "cupy" if self._xp.__name__ == "cupy" else "numpy"
        if self.backend == "cupy":
            logger.info("GpuDispatch: CuPy backend active (GPU acceleration enabled)")
        else:
            logger.debug("GpuDispatch: NumPy backend (CPU only)")

    @staticmethod
    def _resolve_backend():
        try:
            import cupy as cp  # noqa: PLC0415

            cp.zeros(1)  # Probe: raises if no GPU
            return cp
        except Exception:
            return np

    def to_device(self, arr: np.ndarray):
        """Transfer *arr* to the active device (GPU or CPU)."""
        if self.backend == "cupy":
            return self._xp.asarray(arr)
        return arr

    def to_numpy(self, arr) -> np.ndarray:
        """Return *arr* as a plain NumPy array regardless of backend."""
        if self.backend == "cupy":
            return self._xp.asnumpy(arr)
        return np.asarray(arr)

    def rolling_std(self, arr: np.ndarray, window: int) -> np.ndarray:
        """Vectorised rolling standard deviation (device-accelerated)."""
        x = self.to_device(arr.astype(np.float64))
        n = len(x)
        out = self._xp.zeros(n)
        for i in range(window - 1, n):
            seg = x[max(0, i - window + 1): i + 1]
            out[i] = float(self._xp.std(seg, ddof=1) if len(seg) > 1 else 0.0)
        return self.to_numpy(out)

    def ema(self, arr: np.ndarray, span: int) -> np.ndarray:
        """Exponential moving average (device-accelerated)."""
        alpha = 2.0 / (span + 1.0)
        x = self.to_device(arr.astype(np.float64))
        out = self._xp.empty_like(x)
        out[0] = x[0]
        for i in range(1, len(x)):
            out[i] = alpha * x[i] + (1.0 - alpha) * out[i - 1]
        return self.to_numpy(out)

    def batch_correlation(self, matrix: np.ndarray) -> np.ndarray:
        """
        Compute correlation matrix of *matrix* (rows = observations, cols = features).
        Uses cuBLAS via CuPy when available.
        """
        x = self.to_device(matrix.astype(np.float64))
        # Centre columns
        x_c = x - self._xp.mean(x, axis=0)
        norm = self._xp.linalg.norm(x_c, axis=0) + 1e-12
        x_n = x_c / norm
        corr = (x_n.T @ x_n) / max(len(matrix) - 1, 1)
        return self.to_numpy(corr)

    def svd_features(self, matrix: np.ndarray, k: int = 4) -> Tuple[np.ndarray, np.ndarray]:
        """
        Truncated SVD: return (singular_values[:k], right_vectors[:k]).
        Used for eigenvalue-based market regime detection.
        """
        x = self.to_device(matrix.astype(np.float64))
        U, s, Vt = self._xp.linalg.svd(x, full_matrices=False)
        return self.to_numpy(s[:k]), self.to_numpy(Vt[:k])


# Module-level GPU dispatch singleton
_gpu = GpuDispatch()


def get_gpu() -> GpuDispatch:
    """Return the module-level GpuDispatch instance."""
    return _gpu


# ---------------------------------------------------------------------------
# NeuralBridge
# ---------------------------------------------------------------------------


class NeuralBridge:
    """
    One-call access to the yfinance_data neural forecaster from within the
    yfinance facade package.

    Resolves the ``yfinance_data.models.neural_forecaster`` module at runtime
    so the ``yfinance`` package does not hard-depend on TensorFlow.

    Example
    -------
    >>> bridge = NeuralBridge()
    >>> result = bridge.infer(close=close_arr, volume=vol_arr)
    >>> result["signal"]   # 'BUY' | 'HOLD' | 'SELL'
    """

    def __init__(self) -> None:
        self._forecaster = None
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return
        try:
            import importlib.util  # noqa: PLC0415
            import sys  # noqa: PLC0415

            repo_root = Path(__file__).resolve().parent.parent
            if str(repo_root) not in sys.path:
                sys.path.insert(0, str(repo_root))
            from yfinance_data.models.neural_forecaster import NeuralForecaster  # noqa: PLC0415

            fc = NeuralForecaster()
            fc.build_model()
            self._forecaster = fc
            logger.info("NeuralBridge: NeuralForecaster loaded successfully")
        except Exception as exc:
            logger.warning("NeuralBridge: could not load NeuralForecaster (%s); using stub", exc)
        self._loaded = True

    def infer(
        self,
        close: np.ndarray,
        volume: np.ndarray,
        high: Optional[np.ndarray] = None,
        low: Optional[np.ndarray] = None,
        ekf_state: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Run neural inference and return a signal dict.

        Falls back to a heuristic NumPy approximation when TensorFlow or the
        forecaster model is unavailable.

        Returns
        -------
        dict with keys: signal, buy_prob, hold_prob, sell_prob, confidence, method
        """
        self._load()
        if self._forecaster is not None:
            try:
                return self._forecaster.infer(
                    close=close, volume=volume, high=high, low=low, ekf_state=ekf_state
                )
            except Exception as exc:
                logger.warning("NeuralBridge: inference failed (%s); falling back", exc)

        # Heuristic NumPy fallback — log-return momentum proxy
        closes = np.asarray(close, dtype=np.float64)
        if len(closes) < 5:
            return {"signal": "HOLD", "buy_prob": 0.33, "hold_prob": 0.34, "sell_prob": 0.33,
                    "confidence": 0.34, "method": "stub"}
        log_rets = np.diff(np.log(np.maximum(closes, 1e-10)))
        mu = float(log_rets[-20:].mean()) if len(log_rets) >= 20 else float(log_rets.mean())
        sigma = float(log_rets[-20:].std(ddof=1) + 1e-12)
        z = mu / sigma
        exp_z = np.exp([z * 1.5, -abs(z) * 0.5, -z * 1.5])
        probs = exp_z / exp_z.sum()
        idx = int(np.argmax(probs))
        classes = ["BUY", "HOLD", "SELL"]
        return {
            "signal": classes[idx],
            "buy_prob": round(float(probs[0]), 4),
            "hold_prob": round(float(probs[1]), 4),
            "sell_prob": round(float(probs[2]), 4),
            "confidence": round(float(probs[idx]), 4),
            "method": "heuristic numpy fallback",
        }


# Module-level bridge singleton
_neural_bridge = NeuralBridge()


def get_neural_bridge() -> NeuralBridge:
    """Return the module-level NeuralBridge."""
    return _neural_bridge


def neural_infer(
    close: np.ndarray,
    volume: np.ndarray,
    high: Optional[np.ndarray] = None,
    low: Optional[np.ndarray] = None,
    ekf_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Convenience function: run neural inference via the module-level bridge.
    """
    return _neural_bridge.infer(close=close, volume=volume, high=high, low=low,
                                ekf_state=ekf_state)

