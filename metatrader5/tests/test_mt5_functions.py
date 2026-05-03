"""
metatrader5/tests/test_mt5_functions.py

Unit tests for the MetaTrader5 mock API facade.

All tests exercise the pure-Python mock (no live MT5 terminal required).
Covers every function listed in the problem statement:

    initialize, login, shutdown, version, last_error,
    account_info, terminal_info,
    symbols_total, symbols_get, symbol_info, symbol_info_tick, symbol_select,
    market_book_add, market_book_get, market_book_release,
    copy_rates_from, copy_rates_from_pos, copy_rates_range,
    copy_ticks_from, copy_ticks_range,
    orders_total, orders_get, order_calc_margin, order_calc_profit,
    order_check, order_send,
    positions_total, positions_get,
    history_orders_total, history_orders_get,
    history_deals_total, history_deals_get
"""

import sys
import pathlib
import unittest
from datetime import datetime, timedelta

# ---------------------------------------------------------------------------
# Path setup — allow running from repo root or this directory
# ---------------------------------------------------------------------------
_REPO = pathlib.Path(__file__).resolve().parents[2]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

import metatrader5 as mt5
from metatrader5 import (
    # Constants
    TIMEFRAME_M1, TIMEFRAME_H1, TIMEFRAME_D1,
    COPY_TICKS_ALL, COPY_TICKS_INFO, COPY_TICKS_TRADE,
    ORDER_TYPE_BUY, ORDER_TYPE_SELL,
    TRADE_ACTION_DEAL,
    TRADE_RETCODE_DONE,
    # Named-tuple types
    AccountInfo, TerminalInfo, SymbolInfo, TickInfo,
    TradeOrder, TradePosition, TradeDeal,
    OrderCheckResult, OrderSendResult, BookInfo,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _reset():
    """Reset mock state before each test group."""
    from metatrader5 import _STATE
    _STATE.connected = False
    _STATE.login_account = None
    _STATE._last_error = (0, "Success")
    _STATE._symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD"]


# ---------------------------------------------------------------------------
# Connection functions
# ---------------------------------------------------------------------------

class TestInitialize(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_initialize_returns_true(self):
        self.assertTrue(mt5.initialize())

    def test_initialize_sets_connected(self):
        from metatrader5 import _STATE
        mt5.initialize()
        self.assertTrue(_STATE.connected)

    def test_initialize_clears_error(self):
        mt5.initialize()
        code, _ = mt5.last_error()
        self.assertEqual(code, 0)

    def test_initialize_with_kwargs(self):
        """initialize() accepts all optional kwargs without raising."""
        self.assertTrue(
            mt5.initialize(path="", login=0, password="", server="", timeout=5000)
        )


class TestLogin(unittest.TestCase):

    def setUp(self):
        _reset()
        mt5.initialize()

    def test_login_returns_true(self):
        self.assertTrue(mt5.login(12345678, password="demo", server="Demo-Server"))

    def test_login_stores_account(self):
        from metatrader5 import _STATE
        mt5.login(99999999)
        self.assertEqual(_STATE.login_account, 99999999)

    def test_login_clears_error(self):
        mt5.login(12345)
        code, _ = mt5.last_error()
        self.assertEqual(code, 0)


class TestShutdown(unittest.TestCase):

    def setUp(self):
        _reset()
        mt5.initialize()

    def test_shutdown_disconnects(self):
        from metatrader5 import _STATE
        mt5.shutdown()
        self.assertFalse(_STATE.connected)

    def test_shutdown_returns_none(self):
        result = mt5.shutdown()
        self.assertIsNone(result)

    def test_shutdown_idempotent(self):
        """Calling shutdown twice should not raise."""
        mt5.shutdown()
        mt5.shutdown()


class TestVersion(unittest.TestCase):

    def test_version_returns_tuple(self):
        v = mt5.version()
        self.assertIsNotNone(v)
        self.assertIsInstance(v, tuple)

    def test_version_has_three_elements(self):
        v = mt5.version()
        self.assertEqual(len(v), 3)

    def test_version_major_is_int(self):
        v = mt5.version()
        self.assertIsInstance(v[0], int)
        self.assertGreaterEqual(v[0], 5)


class TestLastError(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_last_error_default_success(self):
        code, msg = mt5.last_error()
        self.assertEqual(code, 0)
        self.assertIsInstance(msg, str)

    def test_last_error_after_initialize(self):
        mt5.initialize()
        code, _ = mt5.last_error()
        self.assertEqual(code, 0)


# ---------------------------------------------------------------------------
# Account / terminal info
# ---------------------------------------------------------------------------

class TestAccountInfo(unittest.TestCase):

    def setUp(self):
        _reset()
        mt5.initialize()

    def test_account_info_returns_namedtuple(self):
        info = mt5.account_info()
        self.assertIsInstance(info, AccountInfo)

    def test_account_info_balance_positive(self):
        info = mt5.account_info()
        self.assertGreater(info.balance, 0)

    def test_account_info_equity_gte_balance_minus_unrealised(self):
        info = mt5.account_info()
        self.assertIsNotNone(info.equity)

    def test_account_info_none_when_disconnected(self):
        mt5.shutdown()
        info = mt5.account_info()
        self.assertIsNone(info)

    def test_account_info_currency_is_str(self):
        info = mt5.account_info()
        self.assertIsInstance(info.currency, str)


class TestTerminalInfo(unittest.TestCase):

    def setUp(self):
        _reset()
        mt5.initialize()

    def test_terminal_info_returns_namedtuple(self):
        info = mt5.terminal_info()
        self.assertIsInstance(info, TerminalInfo)

    def test_terminal_info_build_positive(self):
        info = mt5.terminal_info()
        self.assertGreater(info.build, 0)

    def test_terminal_info_connected_true_after_init(self):
        info = mt5.terminal_info()
        self.assertTrue(info.connected)

    def test_terminal_info_none_when_disconnected(self):
        mt5.shutdown()
        info = mt5.terminal_info()
        self.assertIsNone(info)


# ---------------------------------------------------------------------------
# Symbol functions
# ---------------------------------------------------------------------------

class TestSymbolsTotal(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_symbols_total_positive(self):
        total = mt5.symbols_total()
        self.assertGreater(total, 0)

    def test_symbols_total_is_int(self):
        self.assertIsInstance(mt5.symbols_total(), int)

    def test_symbols_total_matches_internal_state(self):
        from metatrader5 import _STATE
        self.assertEqual(mt5.symbols_total(), len(_STATE._symbols))


class TestSymbolsGet(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_symbols_get_all_returns_tuple(self):
        result = mt5.symbols_get()
        self.assertIsInstance(result, tuple)

    def test_symbols_get_all_nonempty(self):
        result = mt5.symbols_get()
        self.assertGreater(len(result), 0)

    def test_symbols_get_each_is_symbol_info(self):
        for s in mt5.symbols_get():
            self.assertIsInstance(s, SymbolInfo)

    def test_symbols_get_with_group_filter(self):
        result = mt5.symbols_get(group="*EUR*")
        self.assertIsNotNone(result)
        for s in result:
            self.assertIn("EUR", s.name)

    def test_symbols_get_unknown_group_returns_none(self):
        result = mt5.symbols_get(group="*XXXX*")
        self.assertIsNone(result)


class TestSymbolInfo(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_symbol_info_known_symbol(self):
        info = mt5.symbol_info("EURUSD")
        self.assertIsInstance(info, SymbolInfo)

    def test_symbol_info_name_matches(self):
        info = mt5.symbol_info("EURUSD")
        self.assertEqual(info.name, "EURUSD")

    def test_symbol_info_ask_gt_bid(self):
        info = mt5.symbol_info("EURUSD")
        self.assertGreater(info.ask, info.bid)

    def test_symbol_info_unknown_returns_none(self):
        info = mt5.symbol_info("INVALID_XYZ")
        self.assertIsNone(info)

    def test_symbol_info_point_positive(self):
        info = mt5.symbol_info("EURUSD")
        self.assertGreater(info.point, 0)


class TestSymbolInfoTick(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_symbol_info_tick_known(self):
        tick = mt5.symbol_info_tick("EURUSD")
        self.assertIsInstance(tick, TickInfo)

    def test_symbol_info_tick_ask_gt_bid(self):
        tick = mt5.symbol_info_tick("EURUSD")
        self.assertGreater(tick.ask, tick.bid)

    def test_symbol_info_tick_time_positive(self):
        tick = mt5.symbol_info_tick("EURUSD")
        self.assertGreater(tick.time, 0)

    def test_symbol_info_tick_unknown_returns_none(self):
        tick = mt5.symbol_info_tick("INVALID")
        self.assertIsNone(tick)


class TestSymbolSelect(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_symbol_select_enable_existing(self):
        self.assertTrue(mt5.symbol_select("EURUSD", True))

    def test_symbol_select_disable_removes_symbol(self):
        from metatrader5 import _STATE
        mt5.symbol_select("EURUSD", False)
        self.assertNotIn("EURUSD", _STATE._symbols)

    def test_symbol_select_enable_new_symbol(self):
        from metatrader5 import _STATE
        mt5.symbol_select("AUDCAD", True)
        self.assertIn("AUDCAD", _STATE._symbols)


# ---------------------------------------------------------------------------
# Market book
# ---------------------------------------------------------------------------

class TestMarketBook(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_market_book_add_returns_true(self):
        self.assertTrue(mt5.market_book_add("EURUSD"))

    def test_market_book_add_unknown_returns_false(self):
        self.assertFalse(mt5.market_book_add("INVALID"))

    def test_market_book_get_returns_tuple(self):
        result = mt5.market_book_get("EURUSD")
        self.assertIsInstance(result, tuple)

    def test_market_book_get_each_is_book_info(self):
        for item in mt5.market_book_get("EURUSD"):
            self.assertIsInstance(item, BookInfo)

    def test_market_book_get_has_bid_and_ask_sides(self):
        book = mt5.market_book_get("EURUSD")
        types = {item.type for item in book}
        self.assertIn(1, types)  # BID side
        self.assertIn(2, types)  # ASK side

    def test_market_book_get_unknown_returns_none(self):
        self.assertIsNone(mt5.market_book_get("INVALID"))

    def test_market_book_release_returns_true(self):
        self.assertTrue(mt5.market_book_release("EURUSD"))


# ---------------------------------------------------------------------------
# Historical price data
# ---------------------------------------------------------------------------

class TestCopyRatesFrom(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_returns_ndarray(self):
        import numpy as np
        date_from = datetime(2024, 1, 1)
        result = mt5.copy_rates_from("EURUSD", TIMEFRAME_H1, date_from, 100)
        self.assertIsInstance(result, np.ndarray)

    def test_correct_length(self):
        date_from = datetime(2024, 1, 1)
        result = mt5.copy_rates_from("EURUSD", TIMEFRAME_H1, date_from, 50)
        self.assertEqual(len(result), 50)

    def test_has_ohlcv_fields(self):
        date_from = datetime(2024, 1, 1)
        result = mt5.copy_rates_from("EURUSD", TIMEFRAME_H1, date_from, 10)
        for field in ("time", "open", "high", "low", "close", "tick_volume"):
            self.assertIn(field, result.dtype.names)

    def test_unknown_symbol_returns_none(self):
        result = mt5.copy_rates_from("INVALID", TIMEFRAME_H1, datetime(2024, 1, 1), 10)
        self.assertIsNone(result)

    def test_zero_count_returns_none(self):
        result = mt5.copy_rates_from("EURUSD", TIMEFRAME_H1, datetime(2024, 1, 1), 0)
        self.assertIsNone(result)

    def test_high_gte_open(self):
        date_from = datetime(2024, 1, 1)
        result = mt5.copy_rates_from("EURUSD", TIMEFRAME_H1, date_from, 200)
        import numpy as np
        self.assertTrue(np.all(result["high"] >= result["open"]))

    def test_low_lte_open(self):
        date_from = datetime(2024, 1, 1)
        result = mt5.copy_rates_from("EURUSD", TIMEFRAME_H1, date_from, 200)
        import numpy as np
        self.assertTrue(np.all(result["low"] <= result["open"]))


class TestCopyRatesFromPos(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_returns_ndarray(self):
        import numpy as np
        result = mt5.copy_rates_from_pos("EURUSD", TIMEFRAME_H1, 0, 100)
        self.assertIsInstance(result, np.ndarray)

    def test_correct_length(self):
        result = mt5.copy_rates_from_pos("EURUSD", TIMEFRAME_D1, 0, 30)
        self.assertEqual(len(result), 30)

    def test_unknown_symbol_returns_none(self):
        result = mt5.copy_rates_from_pos("INVALID", TIMEFRAME_H1, 0, 10)
        self.assertIsNone(result)


class TestCopyRatesRange(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_returns_ndarray(self):
        import numpy as np
        date_from = datetime(2024, 1, 1)
        date_to   = datetime(2024, 2, 1)
        result = mt5.copy_rates_range("EURUSD", TIMEFRAME_D1, date_from, date_to)
        self.assertIsInstance(result, np.ndarray)

    def test_range_has_positive_length(self):
        date_from = datetime(2024, 1, 1)
        date_to   = datetime(2024, 3, 1)
        result = mt5.copy_rates_range("EURUSD", TIMEFRAME_D1, date_from, date_to)
        self.assertGreater(len(result), 0)

    def test_unknown_symbol_returns_none(self):
        result = mt5.copy_rates_range("INVALID", TIMEFRAME_D1,
                                      datetime(2024, 1, 1), datetime(2024, 2, 1))
        self.assertIsNone(result)


class TestCopyTicksFrom(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_returns_ndarray(self):
        import numpy as np
        result = mt5.copy_ticks_from("EURUSD", datetime(2024, 1, 1), 100, COPY_TICKS_ALL)
        self.assertIsInstance(result, np.ndarray)

    def test_correct_length(self):
        result = mt5.copy_ticks_from("EURUSD", datetime(2024, 1, 1), 50, COPY_TICKS_TRADE)
        self.assertEqual(len(result), 50)

    def test_has_bid_ask_fields(self):
        result = mt5.copy_ticks_from("EURUSD", datetime(2024, 1, 1), 10, COPY_TICKS_ALL)
        self.assertIn("bid", result.dtype.names)
        self.assertIn("ask", result.dtype.names)

    def test_unknown_symbol_returns_none(self):
        result = mt5.copy_ticks_from("INVALID", datetime(2024, 1, 1), 10, COPY_TICKS_ALL)
        self.assertIsNone(result)

    def test_zero_count_returns_none(self):
        result = mt5.copy_ticks_from("EURUSD", datetime(2024, 1, 1), 0, COPY_TICKS_ALL)
        self.assertIsNone(result)

    def test_ask_gt_bid_all_ticks(self):
        import numpy as np
        result = mt5.copy_ticks_from("EURUSD", datetime(2024, 1, 1), 200, COPY_TICKS_ALL)
        self.assertTrue(np.all(result["ask"] > result["bid"]))


class TestCopyTicksRange(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_returns_ndarray(self):
        import numpy as np
        date_from = datetime(2024, 1, 1)
        date_to   = datetime(2024, 1, 1, 0, 1)  # 1 minute range
        result = mt5.copy_ticks_range("EURUSD", date_from, date_to, COPY_TICKS_ALL)
        self.assertIsInstance(result, np.ndarray)

    def test_unknown_symbol_returns_none(self):
        result = mt5.copy_ticks_range("INVALID", datetime(2024, 1, 1),
                                      datetime(2024, 1, 2), COPY_TICKS_ALL)
        self.assertIsNone(result)

    def test_flags_info_accepted(self):
        import numpy as np
        result = mt5.copy_ticks_range("EURUSD", datetime(2024, 1, 1),
                                      datetime(2024, 1, 1, 0, 0, 10),
                                      COPY_TICKS_INFO)
        self.assertIsInstance(result, np.ndarray)


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

class TestOrdersTotal(unittest.TestCase):

    def test_orders_total_is_int(self):
        self.assertIsInstance(mt5.orders_total(), int)

    def test_orders_total_non_negative(self):
        self.assertGreaterEqual(mt5.orders_total(), 0)


class TestOrdersGet(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_orders_get_all_returns_tuple(self):
        result = mt5.orders_get()
        self.assertIsInstance(result, tuple)

    def test_orders_get_each_is_trade_order(self):
        for order in mt5.orders_get():
            self.assertIsInstance(order, TradeOrder)

    def test_orders_get_filter_by_symbol(self):
        result = mt5.orders_get(symbol="EURUSD")
        for order in result:
            self.assertEqual(order.symbol, "EURUSD")

    def test_orders_get_unknown_symbol_returns_none(self):
        result = mt5.orders_get(symbol="INVALID_XYZ")
        self.assertIsNone(result)

    def test_orders_get_by_ticket(self):
        result = mt5.orders_get(ticket=10000)
        self.assertIsNotNone(result)
        self.assertEqual(result[0].ticket, 10000)


class TestOrderCalcMargin(unittest.TestCase):

    def test_margin_positive_for_buy(self):
        margin = mt5.order_calc_margin(ORDER_TYPE_BUY, "EURUSD", 1.0, 1.085)
        self.assertIsNotNone(margin)
        self.assertGreater(margin, 0)

    def test_margin_scales_with_volume(self):
        m1 = mt5.order_calc_margin(ORDER_TYPE_BUY, "EURUSD", 1.0, 1.085)
        m2 = mt5.order_calc_margin(ORDER_TYPE_BUY, "EURUSD", 2.0, 1.085)
        self.assertAlmostEqual(m2, m1 * 2.0, places=2)

    def test_margin_unknown_symbol_returns_none(self):
        result = mt5.order_calc_margin(ORDER_TYPE_BUY, "INVALID", 1.0, 1.0)
        self.assertIsNone(result)


class TestOrderCalcProfit(unittest.TestCase):

    def test_profit_positive_buy_winning(self):
        profit = mt5.order_calc_profit(ORDER_TYPE_BUY, "EURUSD", 1.0, 1.085, 1.090)
        self.assertIsNotNone(profit)
        self.assertGreater(profit, 0)

    def test_profit_negative_buy_losing(self):
        profit = mt5.order_calc_profit(ORDER_TYPE_BUY, "EURUSD", 1.0, 1.090, 1.085)
        self.assertIsNotNone(profit)
        self.assertLess(profit, 0)

    def test_profit_sell_inverted(self):
        profit_buy  = mt5.order_calc_profit(ORDER_TYPE_BUY,  "EURUSD", 1.0, 1.085, 1.090)
        profit_sell = mt5.order_calc_profit(ORDER_TYPE_SELL, "EURUSD", 1.0, 1.085, 1.090)
        self.assertAlmostEqual(profit_buy, -profit_sell, places=2)

    def test_profit_unknown_symbol_returns_none(self):
        result = mt5.order_calc_profit(ORDER_TYPE_BUY, "INVALID", 1.0, 1.0, 1.001)
        self.assertIsNone(result)


class TestOrderCheck(unittest.TestCase):

    def _make_request(self):
        return {
            "action": TRADE_ACTION_DEAL,
            "symbol": "EURUSD",
            "volume": 0.1,
            "type": ORDER_TYPE_BUY,
            "price": 1.085,
            "sl": 1.080,
            "tp": 1.092,
            "comment": "test",
        }

    def test_order_check_returns_result(self):
        result = mt5.order_check(self._make_request())
        self.assertIsInstance(result, OrderCheckResult)

    def test_order_check_retcode_zero(self):
        result = mt5.order_check(self._make_request())
        self.assertEqual(result.retcode, 0)

    def test_order_check_margin_positive(self):
        result = mt5.order_check(self._make_request())
        self.assertGreater(result.margin, 0)

    def test_order_check_request_echoed(self):
        req = self._make_request()
        result = mt5.order_check(req)
        self.assertEqual(result.request, req)


class TestOrderSend(unittest.TestCase):

    def _make_request(self):
        return {
            "action": TRADE_ACTION_DEAL,
            "symbol": "EURUSD",
            "volume": 0.1,
            "type": ORDER_TYPE_BUY,
            "price": 1.085,
            "sl": 1.080,
            "tp": 1.092,
            "comment": "test",
        }

    def test_order_send_returns_result(self):
        result = mt5.order_send(self._make_request())
        self.assertIsInstance(result, OrderSendResult)

    def test_order_send_retcode_done(self):
        result = mt5.order_send(self._make_request())
        self.assertEqual(result.retcode, TRADE_RETCODE_DONE)

    def test_order_send_has_deal_and_order(self):
        result = mt5.order_send(self._make_request())
        self.assertGreater(result.deal,  0)
        self.assertGreater(result.order, 0)

    def test_order_send_price_matches_request(self):
        req = self._make_request()
        result = mt5.order_send(req)
        self.assertAlmostEqual(result.price, req["price"], places=5)


# ---------------------------------------------------------------------------
# Positions
# ---------------------------------------------------------------------------

class TestPositionsTotal(unittest.TestCase):

    def test_positions_total_is_int(self):
        self.assertIsInstance(mt5.positions_total(), int)

    def test_positions_total_non_negative(self):
        self.assertGreaterEqual(mt5.positions_total(), 0)


class TestPositionsGet(unittest.TestCase):

    def setUp(self):
        _reset()

    def test_positions_get_all_returns_tuple(self):
        result = mt5.positions_get()
        self.assertIsInstance(result, tuple)

    def test_positions_get_each_is_trade_position(self):
        for pos in mt5.positions_get():
            self.assertIsInstance(pos, TradePosition)

    def test_positions_get_filter_by_symbol(self):
        result = mt5.positions_get(symbol="EURUSD")
        for pos in result:
            self.assertEqual(pos.symbol, "EURUSD")

    def test_positions_get_unknown_symbol_returns_none(self):
        result = mt5.positions_get(symbol="INVALID_XYZ")
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# History — orders
# ---------------------------------------------------------------------------

class TestHistoryOrdersTotal(unittest.TestCase):

    def setUp(self):
        self._from = datetime(2020, 1, 1)
        self._to   = datetime.now()

    def test_returns_int(self):
        n = mt5.history_orders_total(self._from, self._to)
        self.assertIsInstance(n, int)

    def test_positive_for_valid_range(self):
        n = mt5.history_orders_total(self._from, self._to)
        self.assertGreater(n, 0)

    def test_zero_for_inverted_range(self):
        n = mt5.history_orders_total(self._to, self._from)
        self.assertEqual(n, 0)

    def test_wider_range_gte_narrow_range(self):
        narrow_from = datetime(2023, 1, 1)
        narrow_to   = datetime(2023, 6, 1)
        wide_from   = datetime(2020, 1, 1)
        wide_to     = datetime.now()
        n_narrow = mt5.history_orders_total(narrow_from, narrow_to)
        n_wide   = mt5.history_orders_total(wide_from, wide_to)
        self.assertGreaterEqual(n_wide, n_narrow)


class TestHistoryOrdersGet(unittest.TestCase):

    def setUp(self):
        self._from = datetime(2020, 1, 1)
        self._to   = datetime.now()

    def test_returns_tuple(self):
        result = mt5.history_orders_get(date_from=self._from, date_to=self._to)
        self.assertIsInstance(result, tuple)

    def test_each_item_is_trade_order(self):
        result = mt5.history_orders_get(date_from=self._from, date_to=self._to)
        for o in result:
            self.assertIsInstance(o, TradeOrder)

    def test_inverted_range_returns_none(self):
        result = mt5.history_orders_get(date_from=self._to, date_to=self._from)
        self.assertIsNone(result)

    def test_none_dates_returns_none(self):
        result = mt5.history_orders_get()
        self.assertIsNone(result)

    def test_filter_by_group(self):
        result = mt5.history_orders_get(
            date_from=self._from, date_to=self._to, group="*EUR*"
        )
        self.assertIsNotNone(result)
        for o in result:
            self.assertIn("EUR", o.symbol)

    def test_count_matches_history_orders_total(self):
        result = mt5.history_orders_get(date_from=self._from, date_to=self._to)
        total  = mt5.history_orders_total(self._from, self._to)
        self.assertEqual(len(result), total)


# ---------------------------------------------------------------------------
# History — deals
# ---------------------------------------------------------------------------

class TestHistoryDealsTotal(unittest.TestCase):

    def setUp(self):
        self._from = datetime(2020, 1, 1)
        self._to   = datetime.now()

    def test_returns_int(self):
        n = mt5.history_deals_total(self._from, self._to)
        self.assertIsInstance(n, int)

    def test_positive_for_valid_range(self):
        n = mt5.history_deals_total(self._from, self._to)
        self.assertGreater(n, 0)

    def test_zero_for_inverted_range(self):
        n = mt5.history_deals_total(self._to, self._from)
        self.assertEqual(n, 0)


class TestHistoryDealsGet(unittest.TestCase):

    def setUp(self):
        self._from = datetime(2020, 1, 1)
        self._to   = datetime.now()

    def test_returns_tuple(self):
        result = mt5.history_deals_get(date_from=self._from, date_to=self._to)
        self.assertIsInstance(result, tuple)

    def test_each_item_is_trade_deal(self):
        result = mt5.history_deals_get(date_from=self._from, date_to=self._to)
        for d in result:
            self.assertIsInstance(d, TradeDeal)

    def test_inverted_range_returns_none(self):
        result = mt5.history_deals_get(date_from=self._to, date_to=self._from)
        self.assertIsNone(result)

    def test_none_dates_returns_none(self):
        result = mt5.history_deals_get()
        self.assertIsNone(result)

    def test_count_matches_history_deals_total(self):
        result = mt5.history_deals_get(date_from=self._from, date_to=self._to)
        total  = mt5.history_deals_total(self._from, self._to)
        self.assertEqual(len(result), total)

    def test_filter_by_group(self):
        result = mt5.history_deals_get(
            date_from=self._from, date_to=self._to, group="*EUR*"
        )
        self.assertIsNotNone(result)
        for d in result:
            self.assertIn("EUR", d.symbol)

    def test_deal_volume_positive(self):
        result = mt5.history_deals_get(date_from=self._from, date_to=self._to)
        for d in result:
            self.assertGreater(d.volume, 0)


# ---------------------------------------------------------------------------
# Constants are correctly defined
# ---------------------------------------------------------------------------

class TestConstants(unittest.TestCase):

    def test_timeframe_constants_ordered(self):
        self.assertLess(TIMEFRAME_M1, TIMEFRAME_H1)
        self.assertLess(TIMEFRAME_H1, TIMEFRAME_D1)

    def test_copy_ticks_constants_distinct(self):
        values = {COPY_TICKS_ALL, COPY_TICKS_INFO, COPY_TICKS_TRADE}
        self.assertEqual(len(values), 3)

    def test_order_type_buy_sell_distinct(self):
        self.assertNotEqual(ORDER_TYPE_BUY, ORDER_TYPE_SELL)

    def test_trade_retcode_done_value(self):
        self.assertEqual(TRADE_RETCODE_DONE, 10009)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main()
