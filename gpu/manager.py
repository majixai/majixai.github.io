"""
gpu/manager.py — GPU Resource Manager
======================================
Central manager for GPU detection, backend selection, memory allocation,
and utilization monitoring.  Designed to be imported by any script in any
subdirectory of this repository.

Usage
-----
    from gpu.manager import GPUManager

    mgr = GPUManager()          # auto-selects best available backend
    print(mgr.backend)          # 'cuda' | 'mps' | 'tensorflow' | 'cpu'
    xp = mgr.xp                 # numpy-compatible array module (cupy or numpy)

    # Context manager — allocate / release
    with mgr.device():
        result = xp.dot(a, b)

    # Monitoring
    info = mgr.memory_info()    # dict with used / total / free bytes
    mgr.log_status()
"""
from __future__ import annotations

import json
import logging
import os
import sys
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, Optional

# ── Config ─────────────────────────────────────────────────────────────────────
_CONFIG_PATH = Path(__file__).resolve().parent / "config.json"

def _load_config() -> Dict[str, Any]:
    if _CONFIG_PATH.exists():
        with open(_CONFIG_PATH) as fh:
            return json.load(fh)
    return {}

# ── Logging ────────────────────────────────────────────────────────────────────
def _make_logger(level: str = "INFO") -> logging.Logger:
    log = logging.getLogger("gpu.manager")
    if not log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s [gpu.manager] %(levelname)s %(message)s"))
        log.addHandler(handler)
    log.setLevel(getattr(logging, level.upper(), logging.INFO))
    return log


class GPUManager:
    """
    Detect and manage the best available compute backend.

    Backends (in priority order)
    ----------------------------
    cuda        — NVIDIA GPU via CuPy
    mps         — Apple Silicon GPU via PyTorch MPS
    tensorflow  — GPU device detected by TensorFlow
    cpu         — NumPy (always available)
    """

    _instance: Optional["GPUManager"] = None
    _lock = threading.Lock()

    # ── Construction ───────────────────────────────────────────────────────────
    def __init__(self, backend: Optional[str] = None, device_id: int = 0) -> None:
        self._cfg = _load_config()
        log_level = self._cfg.get("logging", {}).get("level", "INFO")
        self.log = _make_logger(log_level)

        self._device_id = device_id
        self._backend: str = self._select_backend(backend)
        self._xp: Any = self._init_xp()
        self._tf_device: Optional[str] = None
        self._torch_device: Optional[Any] = None

        self.log.info("GPUManager initialized — backend=%s", self._backend)

    # ── Singleton helper (optional) ────────────────────────────────────────────
    @classmethod
    def get_instance(cls, **kwargs) -> "GPUManager":
        """Return a process-level singleton GPUManager."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(**kwargs)
            return cls._instance

    # ── Backend selection ──────────────────────────────────────────────────────
    def _select_backend(self, requested: Optional[str]) -> str:
        priority = self._cfg.get("backends", {}).get("priority", ["cuda", "mps", "tensorflow", "cpu"])
        candidates = [requested] if requested else priority

        for name in candidates:
            if name == "cuda" and self._probe_cuda():
                return "cuda"
            if name == "mps" and self._probe_mps():
                return "mps"
            if name == "tensorflow" and self._probe_tensorflow():
                return "tensorflow"
            if name == "cpu":
                return "cpu"
        return "cpu"

    @staticmethod
    def _probe_cuda() -> bool:
        try:
            import cupy as cp  # type: ignore
            cp.cuda.Device(0).compute_capability  # will raise if no GPU
            return True
        except Exception:
            return False

    @staticmethod
    def _probe_mps() -> bool:
        try:
            import torch  # type: ignore
            return torch.backends.mps.is_available()
        except Exception:
            return False

    @staticmethod
    def _probe_tensorflow() -> bool:
        try:
            import tensorflow as tf  # type: ignore
            gpus = tf.config.list_physical_devices("GPU")
            return len(gpus) > 0
        except Exception:
            return False

    # ── Array module (xp) ─────────────────────────────────────────────────────
    def _init_xp(self) -> Any:
        if self._backend == "cuda":
            import cupy as cp  # type: ignore
            return cp
        # All other backends use numpy for array operations
        import numpy as np
        return np

    @property
    def xp(self) -> Any:
        """Return the array module: cupy (CUDA) or numpy (everything else)."""
        return self._xp

    @property
    def backend(self) -> str:
        """Active backend name."""
        return self._backend

    # ── Device context manager ─────────────────────────────────────────────────
    @contextmanager
    def device(self) -> Generator[None, None, None]:
        """
        Context manager that sets the active compute device.

        Example
        -------
            with mgr.device():
                result = mgr.xp.dot(a, b)
        """
        if self._backend == "cuda":
            import cupy as cp  # type: ignore
            with cp.cuda.Device(self._device_id):
                yield
        elif self._backend == "mps":
            import torch  # type: ignore
            self._torch_device = torch.device("mps")
            yield
        elif self._backend == "tensorflow":
            import tensorflow as tf  # type: ignore
            device_name = f"/GPU:{self._device_id}"
            with tf.device(device_name):
                self._tf_device = device_name
                yield
        else:
            yield  # CPU — no special context needed

    # ── Memory info ───────────────────────────────────────────────────────────
    def memory_info(self) -> Dict[str, Any]:
        """Return memory usage dict {used, free, total} in bytes."""
        if self._backend == "cuda":
            try:
                import cupy as cp  # type: ignore
                pool = cp.get_default_memory_pool()
                used = pool.used_bytes()
                total = pool.total_bytes()
                return {"backend": "cuda", "used": used, "total": total, "free": max(0, total - used)}
            except Exception as exc:
                return {"backend": "cuda", "error": str(exc)}

        if self._backend == "mps":
            try:
                import torch  # type: ignore
                allocated = torch.mps.current_allocated_memory()
                return {"backend": "mps", "allocated": allocated}
            except Exception as exc:
                return {"backend": "mps", "error": str(exc)}

        if self._backend == "tensorflow":
            try:
                import tensorflow as tf  # type: ignore
                info = tf.config.experimental.get_memory_info(f"GPU:{self._device_id}")
                return {"backend": "tensorflow", **info}
            except Exception as exc:
                return {"backend": "tensorflow", "error": str(exc)}

        # CPU — report process RSS
        try:
            import resource
            rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
            return {"backend": "cpu", "rss_bytes": rss}
        except Exception:
            return {"backend": "cpu"}

    def log_status(self) -> None:
        """Log current backend and memory info."""
        info = self.memory_info()
        self.log.info("status=%s", info)

    # ── Array transfer helpers ─────────────────────────────────────────────────
    def to_device(self, array: Any) -> Any:
        """Transfer a numpy array to the active device (no-op on CPU)."""
        if self._backend == "cuda":
            import cupy as cp  # type: ignore
            return cp.asarray(array)
        if self._backend in ("mps", "tensorflow"):
            return array  # handled inside framework calls
        return array

    def to_host(self, array: Any) -> Any:
        """Transfer an array back to host (numpy).  No-op if already numpy."""
        if self._backend == "cuda":
            import cupy as cp  # type: ignore
            if isinstance(array, cp.ndarray):
                return cp.asnumpy(array)
        return array

    # ── Timing helper ─────────────────────────────────────────────────────────
    @contextmanager
    def timed(self, label: str = "task") -> Generator[None, None, None]:
        """Log wall-clock time for the wrapped block."""
        t0 = time.perf_counter()
        try:
            yield
        finally:
            elapsed = time.perf_counter() - t0
            self.log.info("timed label=%s elapsed=%.4fs", label, elapsed)

    # ── Repr ──────────────────────────────────────────────────────────────────
    def __repr__(self) -> str:
        return f"GPUManager(backend={self._backend!r}, device_id={self._device_id})"
