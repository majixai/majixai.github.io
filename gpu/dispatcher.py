"""
gpu/dispatcher.py — GPU Task Dispatcher
=========================================
Routes computation tasks to the best available backend through a thread-pool
queue.  Any script in any subdirectory can register and submit tasks.

Usage
-----
    from gpu.dispatcher import GPUDispatcher, Task

    dispatcher = GPUDispatcher()

    # Fire-and-forget
    future = dispatcher.submit("tensor_ops.hosvd", data=my_array, rank=3)
    result = future.result()          # blocks until done

    # With a callback
    dispatcher.submit("matrix_ops.matmul", a=A, b=B,
                      callback=lambda r: print("done", r))

    dispatcher.shutdown()
"""
from __future__ import annotations

import json
import logging
import sys
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from gpu.manager import GPUManager

# ── Config ─────────────────────────────────────────────────────────────────────
_CONFIG_PATH = Path(__file__).resolve().parent / "config.json"

def _load_config() -> Dict[str, Any]:
    if _CONFIG_PATH.exists():
        with open(_CONFIG_PATH) as fh:
            return json.load(fh)
    return {}


# ── Logging ────────────────────────────────────────────────────────────────────
def _make_logger(level: str = "INFO") -> logging.Logger:
    log = logging.getLogger("gpu.dispatcher")
    if not log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [gpu.dispatcher] %(levelname)s %(message)s")
        )
        log.addHandler(handler)
    log.setLevel(getattr(logging, level.upper(), logging.INFO))
    return log


# ── Task dataclass ─────────────────────────────────────────────────────────────
@dataclass
class Task:
    """Represents a single GPU/CPU compute task."""
    kernel: str                                  # e.g. "tensor_ops.hosvd"
    kwargs: Dict[str, Any] = field(default_factory=dict)
    callback: Optional[Callable[[Any], None]] = None
    priority: int = 0                            # lower = higher priority (reserved)


# ── Dispatcher ────────────────────────────────────────────────────────────────
class GPUDispatcher:
    """
    Thread-pool based task dispatcher.

    Parameters
    ----------
    manager : GPUManager, optional
        Supply an existing GPUManager instance, or one will be created.
    max_workers : int, optional
        Thread-pool size (defaults to config.json → task_queue.max_workers).
    """

    def __init__(
        self,
        manager: Optional[GPUManager] = None,
        max_workers: Optional[int] = None,
    ) -> None:
        self._cfg = _load_config()
        log_level = self._cfg.get("logging", {}).get("level", "INFO")
        self.log = _make_logger(log_level)

        self.manager = manager or GPUManager.get_instance()
        nw = max_workers or self._cfg.get("task_queue", {}).get("max_workers", 4)
        self._pool = ThreadPoolExecutor(max_workers=nw, thread_name_prefix="gpu_worker")
        self._timeout = self._cfg.get("task_queue", {}).get("timeout_seconds", 300)
        self._retry_on_oom = self._cfg.get("task_queue", {}).get("retry_on_oom", True)
        self._retry_delay = self._cfg.get("task_queue", {}).get("retry_delay_seconds", 2)
        self._lock = threading.Lock()
        self._submitted = 0
        self._completed = 0
        self._failed = 0

        self.log.info(
            "GPUDispatcher ready — backend=%s workers=%d",
            self.manager.backend,
            nw,
        )

    # ── Kernel registry ───────────────────────────────────────────────────────
    _KERNEL_REGISTRY: Dict[str, Callable[..., Any]] = {}

    @classmethod
    def register(cls, name: str) -> Callable:
        """Decorator to register a callable under a kernel name."""
        def decorator(fn: Callable) -> Callable:
            cls._KERNEL_REGISTRY[name] = fn
            return fn
        return decorator

    # ── Submit ────────────────────────────────────────────────────────────────
    def submit(
        self,
        kernel: str,
        callback: Optional[Callable[[Any], None]] = None,
        **kwargs: Any,
    ) -> Future:
        """
        Submit a task for asynchronous execution.

        Parameters
        ----------
        kernel : str
            Registered kernel name (e.g. ``"tensor_ops.hosvd"``).
        callback : callable, optional
            Called with the result upon successful completion.
        **kwargs
            Forwarded to the kernel function.

        Returns
        -------
        concurrent.futures.Future
        """
        task = Task(kernel=kernel, kwargs=kwargs, callback=callback)
        with self._lock:
            self._submitted += 1
        future = self._pool.submit(self._run_task, task)
        return future

    def submit_task(self, task: Task) -> Future:
        """Submit a pre-built :class:`Task` object."""
        return self.submit(task.kernel, callback=task.callback, **task.kwargs)

    # ── Internal execution ────────────────────────────────────────────────────
    def _run_task(self, task: Task) -> Any:
        kernel_fn = self._KERNEL_REGISTRY.get(task.kernel)
        if kernel_fn is None:
            raise KeyError(
                f"Unknown kernel '{task.kernel}'. "
                f"Registered: {list(self._KERNEL_REGISTRY)}"
            )

        attempt = 0
        while True:
            attempt += 1
            try:
                with self.manager.device():
                    with self.manager.timed(task.kernel):
                        result = kernel_fn(self.manager, **task.kwargs)
                with self._lock:
                    self._completed += 1
                if task.callback:
                    task.callback(result)
                return result

            except MemoryError as exc:
                if self._retry_on_oom and attempt <= 2:
                    self.log.warning(
                        "OOM on attempt %d for '%s' — retrying in %ds",
                        attempt,
                        task.kernel,
                        self._retry_delay,
                    )
                    time.sleep(self._retry_delay)
                else:
                    with self._lock:
                        self._failed += 1
                    raise

            except Exception as exc:
                with self._lock:
                    self._failed += 1
                self.log.error("Task '%s' failed: %s", task.kernel, exc, exc_info=True)
                raise

    # ── Stats ─────────────────────────────────────────────────────────────────
    def stats(self) -> Dict[str, int]:
        with self._lock:
            return {
                "submitted": self._submitted,
                "completed": self._completed,
                "failed": self._failed,
                "pending": self._submitted - self._completed - self._failed,
            }

    def log_stats(self) -> None:
        self.log.info("stats=%s", self.stats())

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    def shutdown(self, wait: bool = True) -> None:
        """Shut down the thread pool."""
        self.log.info("Shutting down dispatcher (wait=%s)", wait)
        self._pool.shutdown(wait=wait)

    def __enter__(self) -> "GPUDispatcher":
        return self

    def __exit__(self, *_: Any) -> None:
        self.shutdown()

    def __repr__(self) -> str:
        return f"GPUDispatcher(backend={self.manager.backend!r}, stats={self.stats()})"
