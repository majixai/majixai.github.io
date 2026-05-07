"""
metatrader5/tests/test_actions.py

Unit tests for the MT5 action dispatcher (metatrader5/actions.py).

Covers:
- ActionRegistry: register, dispatch, dispatch_async, list_actions
- Router: route, dispatch, registered_actions
- All 30 registered MT5 actions (connection, symbols, market book, OHLCV,
  ticks, orders, positions, history)
"""

import sys
import pathlib
import unittest
from datetime import datetime

_REPO = pathlib.Path(__file__).resolve().parents[2]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

import metatrader5 as mt5
from metatrader5.actions import (
    ActionRegistry,
    Router,
    get_mt5_registry,
    get_mt5_router,
)


def _reset_mt5():
    from metatrader5 import _STATE
    _STATE.connected = False
    _STATE.login_account = None
    _STATE._last_error = (0, "Success")
    _STATE._symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD"]


# ---------------------------------------------------------------------------
# ActionRegistry unit tests
# ---------------------------------------------------------------------------

class TestActionRegistry(unittest.TestCase):

    def setUp(self):
        self.registry = ActionRegistry()

    def test_register_and_dispatch(self):
        @self.registry.register("add")
        def _add(ctx):
            return ctx["a"] + ctx["b"]

        result = self.registry.dispatch("add", {"a": 3, "b": 4})
        self.assertEqual(result, 7)

    def test_dispatch_unknown_raises_key_error(self):
        with self.assertRaises(KeyError):
            self.registry.dispatch("unknown_action")

    def test_list_actions_sorted(self):
        for name in ("zz", "aa", "mm"):
            self.registry.register(name)(lambda ctx: None)
        actions = self.registry.list_actions()
        self.assertEqual(actions, sorted(actions))

    def test_dispatch_async_returns_future(self):
        from concurrent.futures import Future

        @self.registry.register("noop")
        def _noop(ctx):
            return 42

        future = self.registry.dispatch_async("noop")
        self.assertIsInstance(future, Future)
        self.assertEqual(future.result(timeout=5), 42)

    def test_dispatch_async_unknown_raises_key_error(self):
        with self.assertRaises(KeyError):
            self.registry.dispatch_async("does_not_exist")

    def test_empty_ctx_defaults_to_empty_dict(self):
        @self.registry.register("no_ctx")
        def _fn(ctx):
            return ctx

        result = self.registry.dispatch("no_ctx")
        self.assertEqual(result, {})


# ---------------------------------------------------------------------------
# Router unit tests
# ---------------------------------------------------------------------------

class TestRouter(unittest.TestCase):

    def setUp(self):
        self.router = Router()

    def test_route_and_dispatch(self):
        @self.router.route("ping")
        def _ping(ctx):
            return "pong"

        self.assertEqual(self.router.dispatch("ping"), "pong")

    def test_dispatch_unknown_raises_key_error(self):
        with self.assertRaises(KeyError):
            self.router.dispatch("not_registered")

    def test_registered_actions_sorted(self):
        for a in ("z", "a", "m"):
            self.router.route(a)(lambda ctx: None)
        actions = self.router.registered_actions()
        self.assertEqual(actions, sorted(actions))

    def test_middleware_called_before_handler(self):
        log = []
        self.router.add_middleware(lambda a, ctx: log.append("mw"))

        @self.router.route("traced")
        def _fn(ctx):
            log.append("handler")
            return True

        self.router.dispatch("traced")
        self.assertEqual(log, ["mw", "handler"])

    def test_middleware_can_mutate_ctx(self):
        self.router.add_middleware(
            lambda a, ctx: ctx.update({"injected": True})
        )

        @self.router.route("check_inject")
        def _fn(ctx):
            return ctx.get("injected", False)

        self.assertTrue(self.router.dispatch("check_inject"))


# ---------------------------------------------------------------------------
# All registered MT5 actions (via module-level singletons)
# ---------------------------------------------------------------------------

class TestMT5RegistryActions(unittest.TestCase):

    def setUp(self):
        _reset_mt5()
        self.reg = get_mt5_registry()

    # ── Connection ──────────────────────────────────────────────────────────

    def test_action_initialize(self):
        result = self.reg.dispatch("initialize")
        self.assertTrue(result)

    def test_action_login(self):
        result = self.reg.dispatch("login", {"login": 12345678, "password": "demo"})
        self.assertTrue(result)

    def test_action_shutdown(self):
        self.reg.dispatch("initialize")
        self.reg.dispatch("shutdown")
        from metatrader5 import _STATE
        self.assertFalse(_STATE.connected)

    def test_action_version(self):
        v = self.reg.dispatch("version")
        self.assertIsInstance(v, tuple)
        self.assertEqual(len(v), 3)

    def test_action_last_error(self):
        code, msg = self.reg.dispatch("last_error")
        self.assertIsInstance(code, int)
        self.assertIsInstance(msg, str)

    # ── Account / terminal ──────────────────────────────────────────────────

    def test_action_account_info(self):
        self.reg.dispatch("initialize")
        from metatrader5 import AccountInfo
        info = self.reg.dispatch("account_info")
        self.assertIsInstance(info, AccountInfo)

    def test_action_terminal_info(self):
        self.reg.dispatch("initialize")
        from metatrader5 import TerminalInfo
        info = self.reg.dispatch("terminal_info")
        self.assertIsInstance(info, TerminalInfo)

    # ── Symbols ─────────────────────────────────────────────────────────────

    def test_action_symbols_total(self):
        n = self.reg.dispatch("symbols_total")
        self.assertIsInstance(n, int)
        self.assertGreater(n, 0)

    def test_action_symbols_get(self):
        result = self.reg.dispatch("symbols_get", {"group": ""})
        self.assertIsInstance(result, tuple)

    def test_action_symbol_info(self):
        from metatrader5 import SymbolInfo
        info = self.reg.dispatch("symbol_info", {"symbol": "EURUSD"})
        self.assertIsInstance(info, SymbolInfo)

    def test_action_symbol_info_tick(self):
        from metatrader5 import TickInfo
        tick = self.reg.dispatch("symbol_info_tick", {"symbol": "EURUSD"})
        self.assertIsInstance(tick, TickInfo)

    def test_action_symbol_select(self):
        result = self.reg.dispatch("symbol_select", {"symbol": "EURUSD", "enable": True})
        self.assertTrue(result)

    # ── Market book ─────────────────────────────────────────────────────────

    def test_action_market_book_add(self):
        self.assertTrue(self.reg.dispatch("market_book_add", {"symbol": "EURUSD"}))

    def test_action_market_book_get(self):
        result = self.reg.dispatch("market_book_get", {"symbol": "EURUSD"})
        self.assertIsInstance(result, tuple)
        self.assertGreater(len(result), 0)

    def test_action_market_book_release(self):
        self.assertTrue(self.reg.dispatch("market_book_release", {"symbol": "EURUSD"}))

    # ── OHLCV ────────────────────────────────────────────────────────────────

    def test_action_copy_rates_from(self):
        import numpy as np
        result = self.reg.dispatch("copy_rates_from", {
            "symbol": "EURUSD",
            "timeframe": mt5.TIMEFRAME_H1,
            "date_from": datetime(2024, 1, 1),
            "count": 50,
        })
        self.assertIsInstance(result, np.ndarray)
        self.assertEqual(len(result), 50)

    def test_action_copy_rates_from_pos(self):
        import numpy as np
        result = self.reg.dispatch("copy_rates_from_pos", {
            "symbol": "EURUSD",
            "timeframe": mt5.TIMEFRAME_H1,
            "start_pos": 0,
            "count": 30,
        })
        self.assertIsInstance(result, np.ndarray)
        self.assertEqual(len(result), 30)

    def test_action_copy_rates_range(self):
        import numpy as np
        result = self.reg.dispatch("copy_rates_range", {
            "symbol": "EURUSD",
            "timeframe": mt5.TIMEFRAME_D1,
            "date_from": datetime(2024, 1, 1),
            "date_to":   datetime(2024, 3, 1),
        })
        self.assertIsInstance(result, np.ndarray)

    # ── Ticks ────────────────────────────────────────────────────────────────

    def test_action_copy_ticks_from(self):
        import numpy as np
        result = self.reg.dispatch("copy_ticks_from", {
            "symbol": "EURUSD",
            "date_from": datetime(2024, 1, 1),
            "count": 100,
            "flags": mt5.COPY_TICKS_ALL,
        })
        self.assertIsInstance(result, np.ndarray)

    def test_action_copy_ticks_range(self):
        import numpy as np
        result = self.reg.dispatch("copy_ticks_range", {
            "symbol": "EURUSD",
            "date_from": datetime(2024, 1, 1),
            "date_to":   datetime(2024, 1, 1, 0, 10),
            "flags": mt5.COPY_TICKS_ALL,
        })
        self.assertIsInstance(result, np.ndarray)

    # ── Orders ────────────────────────────────────────────────────────────────

    def test_action_orders_total(self):
        n = self.reg.dispatch("orders_total")
        self.assertIsInstance(n, int)

    def test_action_orders_get(self):
        result = self.reg.dispatch("orders_get", {"symbol": "EURUSD"})
        self.assertIsInstance(result, tuple)

    def test_action_order_calc_margin(self):
        margin = self.reg.dispatch("order_calc_margin", {
            "action": mt5.ORDER_TYPE_BUY,
            "symbol": "EURUSD",
            "volume": 0.1,
            "price": 1.085,
        })
        self.assertIsNotNone(margin)
        self.assertGreater(margin, 0)

    def test_action_order_calc_profit(self):
        profit = self.reg.dispatch("order_calc_profit", {
            "action": mt5.ORDER_TYPE_BUY,
            "symbol": "EURUSD",
            "volume": 0.1,
            "price_open": 1.085,
            "price_close": 1.090,
        })
        self.assertIsNotNone(profit)
        self.assertGreater(profit, 0)

    def test_action_order_check(self):
        from metatrader5 import OrderCheckResult
        result = self.reg.dispatch("order_check", {
            "request": {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": "EURUSD",
                "volume": 0.1,
                "type": mt5.ORDER_TYPE_BUY,
                "price": 1.085,
            }
        })
        self.assertIsInstance(result, OrderCheckResult)

    def test_action_order_send(self):
        from metatrader5 import OrderSendResult
        result = self.reg.dispatch("order_send", {
            "request": {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": "EURUSD",
                "volume": 0.1,
                "type": mt5.ORDER_TYPE_BUY,
                "price": 1.085,
            }
        })
        self.assertIsInstance(result, OrderSendResult)
        self.assertEqual(result.retcode, mt5.TRADE_RETCODE_DONE)

    # ── Positions ─────────────────────────────────────────────────────────────

    def test_action_positions_total(self):
        n = self.reg.dispatch("positions_total")
        self.assertIsInstance(n, int)

    def test_action_positions_get(self):
        result = self.reg.dispatch("positions_get", {"symbol": "EURUSD"})
        self.assertIsInstance(result, tuple)

    # ── History ───────────────────────────────────────────────────────────────

    def test_action_history_orders_total(self):
        n = self.reg.dispatch("history_orders_total", {
            "date_from": datetime(2020, 1, 1),
            "date_to":   datetime.now(),
        })
        self.assertIsInstance(n, int)
        self.assertGreater(n, 0)

    def test_action_history_orders_get(self):
        result = self.reg.dispatch("history_orders_get", {
            "date_from": datetime(2020, 1, 1),
            "date_to":   datetime.now(),
        })
        self.assertIsInstance(result, tuple)

    def test_action_history_deals_total(self):
        n = self.reg.dispatch("history_deals_total", {
            "date_from": datetime(2020, 1, 1),
            "date_to":   datetime.now(),
        })
        self.assertIsInstance(n, int)
        self.assertGreater(n, 0)

    def test_action_history_deals_get(self):
        result = self.reg.dispatch("history_deals_get", {
            "date_from": datetime(2020, 1, 1),
            "date_to":   datetime.now(),
        })
        self.assertIsInstance(result, tuple)

    def test_action_math_directories_catalog(self):
        result = self.reg.dispatch("math_directories_catalog")
        self.assertIsInstance(result, dict)
        self.assertIn("directories", result)
        names = {entry["name"] for entry in result["directories"]}
        self.assertIn("probability", names)

    def test_action_math_execute(self):
        result = self.reg.dispatch("math_execute", {
            "directory": "probability",
            "function": "normal_pdf",
            "args": [0.0],
            "kwargs": {"mu": 0.0, "sigma": 1.0},
        })
        self.assertIsInstance(result, dict)
        self.assertIn("result", result)
        self.assertAlmostEqual(result["result"], 0.3989422804014327, places=10)

    def test_action_math_execute_invalid_directory_raises(self):
        with self.assertRaises(KeyError):
            self.reg.dispatch("math_execute", {
                "directory": "not_a_math_dir",
                "function": "normal_pdf",
            })

    def test_action_math_execute_invalid_function_raises(self):
        with self.assertRaises(KeyError):
            self.reg.dispatch("math_execute", {
                "directory": "probability",
                "function": "not_a_real_function",
            })

    def test_all_actions_registered(self):
        expected = {
            "initialize", "login", "shutdown", "version", "last_error",
            "account_info", "terminal_info",
            "symbols_total", "symbols_get", "symbol_info", "symbol_info_tick",
            "symbol_select",
            "market_book_add", "market_book_get", "market_book_release",
            "copy_rates_from", "copy_rates_from_pos", "copy_rates_range",
            "copy_ticks_from", "copy_ticks_range",
            "orders_total", "orders_get", "order_calc_margin",
            "order_calc_profit", "order_check", "order_send",
            "positions_total", "positions_get",
            "history_orders_total", "history_orders_get",
            "history_deals_total", "history_deals_get",
            "math_directories_catalog", "math_execute",
        }
        registered = set(self.reg.list_actions())
        self.assertTrue(expected.issubset(registered), expected - registered)


# ---------------------------------------------------------------------------
# Router mirrors the same actions
# ---------------------------------------------------------------------------

class TestMT5RouterActions(unittest.TestCase):

    def setUp(self):
        _reset_mt5()
        self.router = get_mt5_router()

    def test_initialize_via_router(self):
        result = self.router.dispatch("initialize")
        self.assertTrue(result)

    def test_history_orders_total_via_router(self):
        result = self.router.dispatch("history_orders_total", {
            "date_from": datetime(2020, 1, 1),
            "date_to":   datetime.now(),
        })
        self.assertIsInstance(result, int)
        self.assertGreater(result, 0)

    def test_all_router_actions_registered(self):
        expected = {
            "initialize", "login", "shutdown", "version", "last_error",
            "account_info", "terminal_info",
            "symbols_total", "symbols_get", "symbol_info", "symbol_info_tick",
            "symbol_select",
            "market_book_add", "market_book_get", "market_book_release",
            "copy_rates_from", "copy_rates_from_pos", "copy_rates_range",
            "copy_ticks_from", "copy_ticks_range",
            "orders_total", "orders_get", "order_calc_margin",
            "order_calc_profit", "order_check", "order_send",
            "positions_total", "positions_get",
            "history_orders_total", "history_orders_get",
            "history_deals_total", "history_deals_get",
            "math_directories_catalog", "math_execute",
        }
        registered = set(self.router.registered_actions())
        self.assertTrue(expected.issubset(registered), expected - registered)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main()
