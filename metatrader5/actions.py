"""
metatrader5/actions.py — MT5 Action Registry & Router

Wraps every MetaTrader 5 API function as a named action so the rest of the
MajixAI pipeline can dispatch MT5 operations through the same
``ActionRegistry`` / ``Router`` pattern used in ``yfinance/ops.py``.

Usage
-----
>>> from metatrader5.actions import get_mt5_registry, get_mt5_router
>>> registry = get_mt5_registry()
>>> result = registry.dispatch("initialize")
>>> rates  = registry.dispatch("copy_rates_from_pos",
...     {"symbol": "EURUSD", "timeframe": 16385, "start_pos": 0, "count": 100})
"""

from __future__ import annotations

import importlib.util
import inspect
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import metatrader5 as mt5


# ---------------------------------------------------------------------------
# Thin Router (mirrors yfinance/ops.py Router)
# ---------------------------------------------------------------------------

class Router:
    """Lightweight action-based request router for the MT5 pipeline."""

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
        self._middleware.append(fn)

    def dispatch(self, action: str, ctx: Optional[Dict[str, Any]] = None) -> Any:
        ctx = ctx or {}
        for mw in self._middleware:
            mw(action, ctx)
        if action not in self._routes:
            raise KeyError(f"MT5Router: no handler for action '{action}'")
        return self._routes[action](ctx)

    def registered_actions(self) -> List[str]:
        return sorted(self._routes)


# ---------------------------------------------------------------------------
# ActionRegistry (mirrors yfinance/ops.py ActionRegistry)
# ---------------------------------------------------------------------------

class ActionRegistry:
    """Named MT5 pipeline action registry with async dispatch support."""

    def __init__(self, max_workers: int = 4) -> None:
        self._actions: Dict[str, Callable] = {}
        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mt5action")
        self._lock = threading.Lock()

    def register(self, name: str) -> Callable:
        def decorator(fn: Callable) -> Callable:
            with self._lock:
                self._actions[name] = fn
            return fn
        return decorator

    def dispatch(self, name: str, ctx: Optional[Dict[str, Any]] = None) -> Any:
        ctx = ctx or {}
        with self._lock:
            fn = self._actions.get(name)
        if fn is None:
            raise KeyError(f"MT5ActionRegistry: unknown action '{name}'")
        return fn(ctx)

    def dispatch_async(self, name: str, ctx: Optional[Dict[str, Any]] = None) -> Future:
        ctx = ctx or {}
        with self._lock:
            fn = self._actions.get(name)
        if fn is None:
            raise KeyError(f"MT5ActionRegistry: unknown action '{name}'")
        return self._pool.submit(fn, ctx)

    def list_actions(self) -> List[str]:
        with self._lock:
            return sorted(self._actions)


# ---------------------------------------------------------------------------
# Build the default registry + router with all MT5 functions wired
# ---------------------------------------------------------------------------

_default_registry = ActionRegistry()
_default_router   = Router()
_REPO_ROOT = Path(__file__).resolve().parents[1]
_MATH_DIRECTORIES = (
    "calculus",
    "measure_theory",
    "functional_analysis",
    "algebra",
    "topology",
    "manifolds",
    "category_theory",
    "regression",
    "bayes",
    "differential_equations",
    "transformations",
    "matrix",
    "optimization",
    "probability",
    "numerical_methods",
    "quantum_mechanics",
    "statistical_mechanics",
    "information_theory",
    "complexity_theory",
    "cryptography",
)


def _python_core_path(directory: str) -> Optional[Path]:
    d = _REPO_ROOT / directory
    if not d.is_dir():
        return None
    candidate = d / f"{directory}_core.py"
    if candidate.exists():
        return candidate
    py_cores = sorted(d.glob("*_core.py"))
    return py_cores[0] if py_cores else None


def _js_core_path(directory: str) -> Optional[Path]:
    d = _REPO_ROOT / directory
    if not d.is_dir():
        return None
    candidate = d / f"{directory}-core.js"
    if candidate.exists():
        return candidate
    js_cores = sorted(d.glob("*-core.js"))
    return js_cores[0] if js_cores else None


def _math_catalog() -> Dict[str, Any]:
    directories = []
    for name in _MATH_DIRECTORIES:
        d = _REPO_ROOT / name
        if not d.is_dir():
            continue
        py_core = _python_core_path(name)
        js_core = _js_core_path(name)
        readme = d / "README.md"
        directories.append({
            "name": name,
            "path": str(d),
            "python_core": str(py_core) if py_core else None,
            "javascript_core": str(js_core) if js_core else None,
            "readme": str(readme) if readme.exists() else None,
        })
    return {"root": str(_REPO_ROOT), "directories": directories}


def _load_python_core_module(core_path: Path):
    module_key = f"majix_math_{core_path.parent.name}"
    spec = importlib.util.spec_from_file_location(module_key, core_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to create import spec for {core_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def get_mt5_registry() -> ActionRegistry:
    """Return the module-level default MT5 ActionRegistry."""
    return _default_registry


def get_mt5_router() -> Router:
    """Return the module-level default MT5 Router."""
    return _default_router


# ── Connection actions ───────────────────────────────────────────────────────

@_default_registry.register("initialize")
@_default_router.route("initialize")
def _action_initialize(ctx: Dict[str, Any]) -> bool:
    return mt5.initialize(
        path=ctx.get("path", ""),
        login=ctx.get("login", 0),
        password=ctx.get("password", ""),
        server=ctx.get("server", ""),
        timeout=ctx.get("timeout", 60000),
        portable=ctx.get("portable", False),
    )


@_default_registry.register("login")
@_default_router.route("login")
def _action_login(ctx: Dict[str, Any]) -> bool:
    return mt5.login(
        login=ctx["login"],
        password=ctx.get("password", ""),
        server=ctx.get("server", ""),
        timeout=ctx.get("timeout", 60000),
    )


@_default_registry.register("shutdown")
@_default_router.route("shutdown")
def _action_shutdown(ctx: Dict[str, Any]) -> None:
    mt5.shutdown()


@_default_registry.register("version")
@_default_router.route("version")
def _action_version(ctx: Dict[str, Any]):
    return mt5.version()


@_default_registry.register("last_error")
@_default_router.route("last_error")
def _action_last_error(ctx: Dict[str, Any]):
    return mt5.last_error()


# ── Account / terminal info actions ─────────────────────────────────────────

@_default_registry.register("account_info")
@_default_router.route("account_info")
def _action_account_info(ctx: Dict[str, Any]):
    return mt5.account_info()


@_default_registry.register("terminal_info")
@_default_router.route("terminal_info")
def _action_terminal_info(ctx: Dict[str, Any]):
    return mt5.terminal_info()


# ── Symbol actions ───────────────────────────────────────────────────────────

@_default_registry.register("symbols_total")
@_default_router.route("symbols_total")
def _action_symbols_total(ctx: Dict[str, Any]) -> int:
    return mt5.symbols_total()


@_default_registry.register("symbols_get")
@_default_router.route("symbols_get")
def _action_symbols_get(ctx: Dict[str, Any]):
    return mt5.symbols_get(group=ctx.get("group", ""))


@_default_registry.register("symbol_info")
@_default_router.route("symbol_info")
def _action_symbol_info(ctx: Dict[str, Any]):
    return mt5.symbol_info(ctx["symbol"])


@_default_registry.register("symbol_info_tick")
@_default_router.route("symbol_info_tick")
def _action_symbol_info_tick(ctx: Dict[str, Any]):
    return mt5.symbol_info_tick(ctx["symbol"])


@_default_registry.register("symbol_select")
@_default_router.route("symbol_select")
def _action_symbol_select(ctx: Dict[str, Any]) -> bool:
    return mt5.symbol_select(ctx["symbol"], ctx.get("enable", True))


# ── Market book actions ──────────────────────────────────────────────────────

@_default_registry.register("market_book_add")
@_default_router.route("market_book_add")
def _action_market_book_add(ctx: Dict[str, Any]) -> bool:
    return mt5.market_book_add(ctx["symbol"])


@_default_registry.register("market_book_get")
@_default_router.route("market_book_get")
def _action_market_book_get(ctx: Dict[str, Any]):
    return mt5.market_book_get(ctx["symbol"])


@_default_registry.register("market_book_release")
@_default_router.route("market_book_release")
def _action_market_book_release(ctx: Dict[str, Any]) -> bool:
    return mt5.market_book_release(ctx["symbol"])


# ── Historical price data actions ────────────────────────────────────────────

@_default_registry.register("copy_rates_from")
@_default_router.route("copy_rates_from")
def _action_copy_rates_from(ctx: Dict[str, Any]):
    return mt5.copy_rates_from(
        ctx["symbol"], ctx["timeframe"], ctx["date_from"], ctx["count"]
    )


@_default_registry.register("copy_rates_from_pos")
@_default_router.route("copy_rates_from_pos")
def _action_copy_rates_from_pos(ctx: Dict[str, Any]):
    return mt5.copy_rates_from_pos(
        ctx["symbol"], ctx["timeframe"],
        ctx.get("start_pos", 0), ctx["count"]
    )


@_default_registry.register("copy_rates_range")
@_default_router.route("copy_rates_range")
def _action_copy_rates_range(ctx: Dict[str, Any]):
    return mt5.copy_rates_range(
        ctx["symbol"], ctx["timeframe"],
        ctx["date_from"], ctx["date_to"]
    )


@_default_registry.register("copy_ticks_from")
@_default_router.route("copy_ticks_from")
def _action_copy_ticks_from(ctx: Dict[str, Any]):
    return mt5.copy_ticks_from(
        ctx["symbol"], ctx["date_from"], ctx["count"],
        ctx.get("flags", mt5.COPY_TICKS_ALL)
    )


@_default_registry.register("copy_ticks_range")
@_default_router.route("copy_ticks_range")
def _action_copy_ticks_range(ctx: Dict[str, Any]):
    return mt5.copy_ticks_range(
        ctx["symbol"], ctx["date_from"], ctx["date_to"],
        ctx.get("flags", mt5.COPY_TICKS_ALL)
    )


# ── Order actions ────────────────────────────────────────────────────────────

@_default_registry.register("orders_total")
@_default_router.route("orders_total")
def _action_orders_total(ctx: Dict[str, Any]) -> int:
    return mt5.orders_total()


@_default_registry.register("orders_get")
@_default_router.route("orders_get")
def _action_orders_get(ctx: Dict[str, Any]):
    return mt5.orders_get(
        symbol=ctx.get("symbol", ""),
        group=ctx.get("group", ""),
        ticket=ctx.get("ticket", 0),
    )


@_default_registry.register("order_calc_margin")
@_default_router.route("order_calc_margin")
def _action_order_calc_margin(ctx: Dict[str, Any]):
    return mt5.order_calc_margin(
        ctx["action"], ctx["symbol"], ctx["volume"], ctx["price"]
    )


@_default_registry.register("order_calc_profit")
@_default_router.route("order_calc_profit")
def _action_order_calc_profit(ctx: Dict[str, Any]):
    return mt5.order_calc_profit(
        ctx["action"], ctx["symbol"], ctx["volume"],
        ctx["price_open"], ctx["price_close"]
    )


@_default_registry.register("order_check")
@_default_router.route("order_check")
def _action_order_check(ctx: Dict[str, Any]):
    return mt5.order_check(ctx["request"])


@_default_registry.register("order_send")
@_default_router.route("order_send")
def _action_order_send(ctx: Dict[str, Any]):
    return mt5.order_send(ctx["request"])


# ── Position actions ─────────────────────────────────────────────────────────

@_default_registry.register("positions_total")
@_default_router.route("positions_total")
def _action_positions_total(ctx: Dict[str, Any]) -> int:
    return mt5.positions_total()


@_default_registry.register("positions_get")
@_default_router.route("positions_get")
def _action_positions_get(ctx: Dict[str, Any]):
    return mt5.positions_get(
        symbol=ctx.get("symbol", ""),
        group=ctx.get("group", ""),
        ticket=ctx.get("ticket", 0),
    )


# ── History actions ──────────────────────────────────────────────────────────

@_default_registry.register("history_orders_total")
@_default_router.route("history_orders_total")
def _action_history_orders_total(ctx: Dict[str, Any]) -> int:
    return mt5.history_orders_total(ctx["date_from"], ctx["date_to"])


@_default_registry.register("history_orders_get")
@_default_router.route("history_orders_get")
def _action_history_orders_get(ctx: Dict[str, Any]):
    return mt5.history_orders_get(
        date_from=ctx.get("date_from"),
        date_to=ctx.get("date_to"),
        group=ctx.get("group", ""),
        ticket=ctx.get("ticket", 0),
        position=ctx.get("position", 0),
    )


@_default_registry.register("history_deals_total")
@_default_router.route("history_deals_total")
def _action_history_deals_total(ctx: Dict[str, Any]) -> int:
    return mt5.history_deals_total(ctx["date_from"], ctx["date_to"])


@_default_registry.register("history_deals_get")
@_default_router.route("history_deals_get")
def _action_history_deals_get(ctx: Dict[str, Any]):
    return mt5.history_deals_get(
        date_from=ctx.get("date_from"),
        date_to=ctx.get("date_to"),
        group=ctx.get("group", ""),
        ticket=ctx.get("ticket", 0),
        position=ctx.get("position", 0),
    )


# ── Root mathematics integration actions ──────────────────────────────────────

@_default_registry.register("math_directories_catalog")
@_default_router.route("math_directories_catalog")
def _action_math_directories_catalog(ctx: Dict[str, Any]):
    return _math_catalog()


@_default_registry.register("math_execute")
@_default_router.route("math_execute")
def _action_math_execute(ctx: Dict[str, Any]):
    """
    Execute a callable from a root mathematical directory python core file.

    ctx:
      directory: str   (e.g. "probability")
      function:  str   (e.g. "normal_pdf")
      args:      list  (optional positional args)
      kwargs:    dict  (optional keyword args)
    """
    directory = ctx.get("directory")
    function_name = ctx.get("function")
    args = ctx.get("args", [])
    kwargs = ctx.get("kwargs", {})
    if not directory or not function_name:
        raise ValueError("math_execute requires 'directory' and 'function'")
    if directory not in _MATH_DIRECTORIES:
        raise KeyError(f"Unknown math directory '{directory}'")

    core_path = _python_core_path(directory)
    if core_path is None:
        raise KeyError(f"No python core module found for '{directory}'")

    module = _load_python_core_module(core_path)
    fn = getattr(module, function_name, None)
    if fn is None or not callable(fn):
        raise KeyError(f"Function '{function_name}' not found in '{directory}' core module")

    result = fn(*args, **kwargs)
    exports = [
        name for name, obj in inspect.getmembers(module)
        if callable(obj) and not name.startswith("_")
    ]
    return {
        "directory": directory,
        "python_core": str(core_path),
        "function": function_name,
        "available_exports": sorted(exports),
        "result": result,
    }
