"""
metatrader5 — MetaTrader 5 Python API facade for MajixAI.

When the real ``MetaTrader5`` package is installed this module is a thin
re-export of it.  In environments without a running MT5 terminal (CI, offline
analysis) a pure-Python mock is active instead, enabling unit tests and
back-testing pipelines to run without modification.

Public surface mirrors the official MT5 Python API:
  https://www.mql5.com/en/docs/integration/python_metatrader5
"""

from __future__ import annotations

import collections
import math
import struct
import time
from datetime import datetime
from typing import Any, List, Optional, Sequence, Tuple

import numpy as np

# ---------------------------------------------------------------------------
# Try the real package first
# ---------------------------------------------------------------------------

try:
    import MetaTrader5 as _REAL_MT5  # type: ignore

    # Re-export every public symbol from the real package so callers that
    # do ``import metatrader5 as mt5`` get the full live API.
    from MetaTrader5 import *  # noqa: F401, F403
    _MOCK_ACTIVE = False
except ImportError:  # pragma: no cover – live path not exercised in CI
    _REAL_MT5 = None
    _MOCK_ACTIVE = True


# ---------------------------------------------------------------------------
# Constants (MT5 API)
# ---------------------------------------------------------------------------

# Timeframes
TIMEFRAME_M1  = 1
TIMEFRAME_M2  = 2
TIMEFRAME_M3  = 3
TIMEFRAME_M4  = 4
TIMEFRAME_M5  = 5
TIMEFRAME_M6  = 6
TIMEFRAME_M10 = 10
TIMEFRAME_M12 = 12
TIMEFRAME_M15 = 15
TIMEFRAME_M20 = 20
TIMEFRAME_M30 = 30
TIMEFRAME_H1  = 16385
TIMEFRAME_H2  = 16386
TIMEFRAME_H3  = 16387
TIMEFRAME_H4  = 16388
TIMEFRAME_H6  = 16390
TIMEFRAME_H8  = 16392
TIMEFRAME_H12 = 16396
TIMEFRAME_D1  = 16408
TIMEFRAME_W1  = 32769
TIMEFRAME_MN1 = 49153

# Tick copy flags
COPY_TICKS_ALL   = -1
COPY_TICKS_INFO  = 1
COPY_TICKS_TRADE = 2

# Order types
ORDER_TYPE_BUY             = 0
ORDER_TYPE_SELL            = 1
ORDER_TYPE_BUY_LIMIT       = 2
ORDER_TYPE_SELL_LIMIT      = 3
ORDER_TYPE_BUY_STOP        = 4
ORDER_TYPE_SELL_STOP       = 5
ORDER_TYPE_BUY_STOP_LIMIT  = 6
ORDER_TYPE_SELL_STOP_LIMIT = 7
ORDER_TYPE_CLOSE_BY        = 8

# Trade actions
TRADE_ACTION_DEAL    = 1
TRADE_ACTION_PENDING = 5
TRADE_ACTION_SLTP    = 6
TRADE_ACTION_MODIFY  = 7
TRADE_ACTION_REMOVE  = 8
TRADE_ACTION_CLOSE_BY = 10

# Position types
POSITION_TYPE_BUY  = 0
POSITION_TYPE_SELL = 1

# Deal types
DEAL_TYPE_BUY  = 0
DEAL_TYPE_SELL = 1

# Return codes
TRADE_RETCODE_DONE = 10009


# ---------------------------------------------------------------------------
# Named tuple types (match the real MT5 API field names)
# ---------------------------------------------------------------------------

AccountInfo = collections.namedtuple("AccountInfo", [
    "login", "trade_mode", "leverage", "limit_orders", "margin_so_mode",
    "trade_allowed", "trade_expert", "margin_mode", "currency_digits",
    "fifo_close", "balance", "credit", "profit", "equity", "margin",
    "margin_free", "margin_level", "margin_so_call", "margin_so_so",
    "margin_initial", "margin_maintenance", "assets", "liabilities",
    "commission_blocked", "name", "server", "currency", "company",
])

TerminalInfo = collections.namedtuple("TerminalInfo", [
    "community_account", "community_connection", "connected",
    "dlls_allowed", "trade_allowed", "tradeapi_disabled",
    "email_enabled", "ftp_enabled", "notifications_enabled",
    "mqid", "build", "maxbars", "codepage", "ping_last", "community_balance",
    "retransmission", "company", "name", "language", "path", "data_path",
    "commondata_path",
])

SymbolInfo = collections.namedtuple("SymbolInfo", [
    "custom", "chart_mode", "select", "visible", "session_deals",
    "session_buy_orders", "session_sell_orders", "volume", "volumehigh",
    "volumelow", "time", "digits", "spread", "spread_float", "ticks_bookdepth",
    "trade_calc_mode", "trade_mode", "start_time", "expiration_time",
    "trade_stops_level", "trade_freeze_level", "trade_exemode",
    "swap_mode", "swap_rollover3days", "margin_hedged_use_leg",
    "expiration_mode", "filling_mode", "order_mode", "order_gtc_mode",
    "option_mode", "option_right", "bid", "bidhigh", "bidlow",
    "ask", "askhigh", "asklow", "last", "lasthigh", "lastlow",
    "volume_real", "volumehigh_real", "volumelow_real",
    "option_strike", "point", "trade_tick_value",
    "trade_tick_value_profit", "trade_tick_value_loss",
    "trade_tick_size", "trade_contract_size", "trade_accrued_interest",
    "trade_face_value", "trade_liquidity_rate",
    "volume_min", "volume_max", "volume_step", "volume_limit",
    "swap_long", "swap_short", "margin_initial", "margin_maintenance",
    "session_volume", "session_turnover", "session_interest",
    "session_buy_orders_volume", "session_sell_orders_volume",
    "session_open", "session_close", "session_aw", "session_price_settlement",
    "session_price_limit_min", "session_price_limit_max",
    "margin_hedged", "price_change", "price_volatility", "price_theoretical",
    "price_greeks_delta", "price_greeks_theta", "price_greeks_gamma",
    "price_greeks_vega", "price_greeks_rho", "price_greeks_omega",
    "price_sensitivity", "basis", "category", "currency_base",
    "currency_profit", "currency_margin", "bank", "description", "exchange",
    "formula", "isin", "name", "page", "path",
])

TickInfo = collections.namedtuple("TickInfo", [
    "time", "bid", "ask", "last", "volume", "time_msc",
    "flags", "volume_real",
])

TradeOrder = collections.namedtuple("TradeOrder", [
    "ticket", "time_setup", "time_setup_msc", "time_done", "time_done_msc",
    "time_expiration", "type", "type_time", "type_filling", "state",
    "magic", "position_id", "position_by_id", "reason", "volume_initial",
    "volume_current", "price_open", "sl", "tp", "price_current",
    "price_stoplimit", "symbol", "comment", "external_id",
])

TradePosition = collections.namedtuple("TradePosition", [
    "ticket", "time", "time_msc", "time_update", "time_update_msc", "type",
    "magic", "identifier", "reason", "volume", "price_open", "sl", "tp",
    "price_current", "swap", "profit", "symbol", "comment", "external_id",
])

TradeDeal = collections.namedtuple("TradeDeal", [
    "ticket", "order", "time", "time_msc", "type", "entry", "magic",
    "position_id", "reason", "volume", "price", "commission", "swap",
    "profit", "fee", "symbol", "comment", "external_id",
])

OrderCheckResult = collections.namedtuple("OrderCheckResult", [
    "retcode", "balance", "equity", "profit", "margin", "margin_free",
    "margin_level", "comment", "request",
])

OrderSendResult = collections.namedtuple("OrderSendResult", [
    "retcode", "deal", "order", "volume", "price", "bid", "ask",
    "comment", "request_id", "retcode_external", "request",
])

BookInfo = collections.namedtuple("BookInfo", ["type", "price", "volume", "volume_real"])


# ---------------------------------------------------------------------------
# Internal mock state
# ---------------------------------------------------------------------------

class _MockState:
    """Minimal in-process state shared across mock functions."""

    def __init__(self) -> None:
        self.connected: bool = False
        self.login_account: Optional[int] = None
        self._last_error: Tuple[int, str] = (0, "Success")
        self._symbols: List[str] = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD"]


_STATE = _MockState()

# ---------------------------------------------------------------------------
# Mock helper builders
# ---------------------------------------------------------------------------

def _mock_account_info() -> AccountInfo:
    return AccountInfo(
        login=_STATE.login_account or 12345678,
        trade_mode=0, leverage=100, limit_orders=200,
        margin_so_mode=0, trade_allowed=True, trade_expert=True,
        margin_mode=2, currency_digits=2, fifo_close=False,
        balance=10000.0, credit=0.0, profit=150.25,
        equity=10150.25, margin=200.0, margin_free=9950.25,
        margin_level=5075.125, margin_so_call=50.0, margin_so_so=20.0,
        margin_initial=0.0, margin_maintenance=0.0, assets=0.0,
        liabilities=0.0, commission_blocked=0.0,
        name="Demo Account", server="MetaQuotes-Demo",
        currency="USD", company="MetaQuotes Software Corp.",
    )


def _mock_terminal_info() -> TerminalInfo:
    return TerminalInfo(
        community_account=False, community_connection=False,
        connected=_STATE.connected, dlls_allowed=False,
        trade_allowed=True, tradeapi_disabled=False,
        email_enabled=False, ftp_enabled=False,
        notifications_enabled=False, mqid=False,
        build=3550, maxbars=100000, codepage=0, ping_last=42,
        community_balance=0.0, retransmission=0.0,
        company="MetaQuotes Software Corp.",
        name="MetaTrader 5", language="English",
        path="C:\\MetaTrader 5", data_path="C:\\MetaTrader 5\\MQL5",
        commondata_path="C:\\Users\\AppData\\Roaming\\MetaQuotes\\Terminal\\Common",
    )


def _mock_symbol_info(symbol: str) -> Optional[SymbolInfo]:
    if symbol not in _STATE._symbols:
        return None
    bid = 1.08500 if "EUR" in symbol else 100.0
    ask = bid + 0.00010
    return SymbolInfo(
        custom=False, chart_mode=0, select=True, visible=True,
        session_deals=0, session_buy_orders=0, session_sell_orders=0,
        volume=0, volumehigh=0, volumelow=0,
        time=int(time.time()), digits=5, spread=10, spread_float=True,
        ticks_bookdepth=10, trade_calc_mode=0, trade_mode=4,
        start_time=0, expiration_time=0, trade_stops_level=0,
        trade_freeze_level=0, trade_exemode=1, swap_mode=1,
        swap_rollover3days=3, margin_hedged_use_leg=False,
        expiration_mode=15, filling_mode=3, order_mode=127,
        order_gtc_mode=0, option_mode=0, option_right=0,
        bid=bid, bidhigh=bid + 0.005, bidlow=bid - 0.005,
        ask=ask, askhigh=ask + 0.005, asklow=ask - 0.005,
        last=0.0, lasthigh=0.0, lastlow=0.0,
        volume_real=0.0, volumehigh_real=0.0, volumelow_real=0.0,
        option_strike=0.0, point=0.00001, trade_tick_value=1.0,
        trade_tick_value_profit=1.0, trade_tick_value_loss=1.0,
        trade_tick_size=0.00001, trade_contract_size=100000.0,
        trade_accrued_interest=0.0, trade_face_value=0.0,
        trade_liquidity_rate=0.0, volume_min=0.01, volume_max=500.0,
        volume_step=0.01, volume_limit=0.0, swap_long=-0.5,
        swap_short=-1.2, margin_initial=0.0, margin_maintenance=0.0,
        session_volume=0.0, session_turnover=0.0, session_interest=0.0,
        session_buy_orders_volume=0.0, session_sell_orders_volume=0.0,
        session_open=bid - 0.001, session_close=bid + 0.001,
        session_aw=bid, session_price_settlement=0.0,
        session_price_limit_min=0.0, session_price_limit_max=0.0,
        margin_hedged=0.0, price_change=0.0, price_volatility=0.0,
        price_theoretical=0.0, price_greeks_delta=0.0,
        price_greeks_theta=0.0, price_greeks_gamma=0.0,
        price_greeks_vega=0.0, price_greeks_rho=0.0,
        price_greeks_omega=0.0, price_sensitivity=0.0,
        basis="", category="", currency_base="EUR",
        currency_profit="USD", currency_margin="EUR",
        bank="", description=f"{symbol} currency pair",
        exchange="", formula="", isin="",
        name=symbol, page="", path=f"Forex\\{symbol}",
    )


def _make_rates_array(n: int, base_price: float = 1.08500) -> np.ndarray:
    """Return a structured numpy array of OHLCV rates."""
    dtype = np.dtype([
        ("time", np.int64), ("open", np.float64), ("high", np.float64),
        ("low", np.float64), ("close", np.float64),
        ("tick_volume", np.int64), ("spread", np.int32),
        ("real_volume", np.int64),
    ])
    arr = np.zeros(n, dtype=dtype)
    rng = np.random.default_rng(42)
    prices = base_price + np.cumsum(rng.normal(0, 0.0001, n))
    now = int(time.time())
    for i in range(n):
        arr[i]["time"] = now - (n - i) * 60
        arr[i]["open"] = prices[i]
        arr[i]["high"] = prices[i] + abs(rng.normal(0, 0.0002))
        arr[i]["low"]  = prices[i] - abs(rng.normal(0, 0.0002))
        arr[i]["close"] = prices[i] + rng.normal(0, 0.0001)
        arr[i]["tick_volume"] = int(rng.integers(100, 1000))
        arr[i]["spread"] = 10
        arr[i]["real_volume"] = 0
    return arr


def _make_ticks_array(n: int, base_price: float = 1.08500) -> np.ndarray:
    """Return a structured numpy array of ticks."""
    dtype = np.dtype([
        ("time", np.int64), ("bid", np.float64), ("ask", np.float64),
        ("last", np.float64), ("volume", np.int64),
        ("time_msc", np.int64), ("flags", np.uint32),
        ("volume_real", np.float64),
    ])
    arr = np.zeros(n, dtype=dtype)
    rng = np.random.default_rng(42)
    now_ms = int(time.time() * 1000)
    for i in range(n):
        bid = base_price + rng.normal(0, 0.0001)
        arr[i]["time"] = now_ms // 1000 - (n - i)
        arr[i]["bid"] = bid
        arr[i]["ask"] = bid + 0.0001
        arr[i]["last"] = bid
        arr[i]["volume"] = int(rng.integers(1, 10))
        arr[i]["time_msc"] = now_ms - (n - i) * 1000
        arr[i]["flags"] = 6
        arr[i]["volume_real"] = float(arr[i]["volume"])
    return arr


def _make_orders(n: int = 2) -> Tuple[TradeOrder, ...]:
    now = int(time.time())
    return tuple(
        TradeOrder(
            ticket=10000 + i, time_setup=now - 3600, time_setup_msc=(now - 3600) * 1000,
            time_done=0, time_done_msc=0, time_expiration=0,
            type=ORDER_TYPE_BUY, type_time=0, type_filling=2, state=1,
            magic=0, position_id=0, position_by_id=0, reason=0,
            volume_initial=0.1, volume_current=0.1,
            price_open=1.085 + i * 0.001, sl=1.080, tp=1.090,
            price_current=1.086, price_stoplimit=0.0,
            symbol="EURUSD", comment="", external_id="",
        )
        for i in range(n)
    )


def _make_positions(n: int = 1) -> Tuple[TradePosition, ...]:
    now = int(time.time())
    return tuple(
        TradePosition(
            ticket=20000 + i, time=now - 7200, time_msc=(now - 7200) * 1000,
            time_update=now - 3600, time_update_msc=(now - 3600) * 1000,
            type=POSITION_TYPE_BUY, magic=0, identifier=20000 + i, reason=0,
            volume=0.1, price_open=1.085 + i * 0.001, sl=1.080, tp=1.092,
            price_current=1.086, swap=0.0, profit=10.0,
            symbol="EURUSD", comment="", external_id="",
        )
        for i in range(n)
    )


def _make_history_orders(
    date_from: datetime, date_to: datetime, n: int = 3
) -> Tuple[TradeOrder, ...]:
    ts_from = int(date_from.timestamp())
    ts_to   = int(date_to.timestamp())
    if ts_from >= ts_to:
        return ()
    step = max((ts_to - ts_from) // max(n, 1), 1)
    return tuple(
        TradeOrder(
            ticket=30000 + i, time_setup=ts_from + i * step,
            time_setup_msc=(ts_from + i * step) * 1000,
            time_done=ts_from + i * step + 10,
            time_done_msc=(ts_from + i * step + 10) * 1000,
            time_expiration=0, type=ORDER_TYPE_BUY if i % 2 == 0 else ORDER_TYPE_SELL,
            type_time=0, type_filling=2, state=3,
            magic=0, position_id=0, position_by_id=0, reason=0,
            volume_initial=0.1, volume_current=0.0,
            price_open=1.085 + i * 0.001, sl=0.0, tp=0.0,
            price_current=1.086, price_stoplimit=0.0,
            symbol="EURUSD", comment="history", external_id="",
        )
        for i in range(n)
    )


def _make_history_deals(
    date_from: datetime, date_to: datetime, n: int = 3
) -> Tuple[TradeDeal, ...]:
    ts_from = int(date_from.timestamp())
    ts_to   = int(date_to.timestamp())
    if ts_from >= ts_to:
        return ()
    step = max((ts_to - ts_from) // max(n, 1), 1)
    return tuple(
        TradeDeal(
            ticket=40000 + i, order=30000 + i,
            time=ts_from + i * step,
            time_msc=(ts_from + i * step) * 1000,
            type=DEAL_TYPE_BUY if i % 2 == 0 else DEAL_TYPE_SELL,
            entry=0, magic=0, position_id=0, reason=0,
            volume=0.1, price=1.085 + i * 0.001,
            commission=-0.5, swap=0.0,
            profit=10.0 * (1 if i % 2 == 0 else -1),
            fee=0.0, symbol="EURUSD", comment="", external_id="",
        )
        for i in range(n)
    )


# ---------------------------------------------------------------------------
# Mock API functions — only active when _MOCK_ACTIVE == True
# ---------------------------------------------------------------------------

def initialize(
    path: str = "",
    login: int = 0,
    password: str = "",
    server: str = "",
    timeout: int = 60000,
    portable: bool = False,
) -> bool:
    """Connect to the MetaTrader 5 terminal (mock: always succeeds)."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.initialize(
            path=path, login=login, password=password,
            server=server, timeout=timeout, portable=portable,
        )
    _STATE.connected = True
    _STATE._last_error = (0, "Success")
    return True


def login(
    login: int,
    password: str = "",
    server: str = "",
    timeout: int = 60000,
) -> bool:
    """Authorise connection to the trading account (mock: always succeeds)."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.login(login=login, password=password,
                               server=server, timeout=timeout)
    _STATE.login_account = login
    _STATE._last_error = (0, "Success")
    return True


def shutdown() -> None:
    """Close the connection to the MetaTrader 5 terminal."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.shutdown()
    _STATE.connected = False
    _STATE.login_account = None


def version() -> Optional[Tuple[int, int, str]]:
    """Return (major, minor, build) version tuple."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.version()
    return (5, 0, "3550 (22 Dec 2023)")


def last_error() -> Tuple[int, str]:
    """Return the last error as (error_code, description)."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.last_error()
    return _STATE._last_error


# -- Account / terminal info -------------------------------------------------

def account_info() -> Optional[AccountInfo]:
    """Return current account information."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.account_info()
    if not _STATE.connected:
        _STATE._last_error = (5, "IPC timeout")
        return None
    return _mock_account_info()


def terminal_info() -> Optional[TerminalInfo]:
    """Return MT5 terminal information."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.terminal_info()
    if not _STATE.connected:
        _STATE._last_error = (5, "IPC timeout")
        return None
    return _mock_terminal_info()


# -- Symbol functions --------------------------------------------------------

def symbols_total() -> int:
    """Return total number of financial instruments."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.symbols_total()
    return len(_STATE._symbols)


def symbols_get(group: str = "") -> Optional[Tuple[SymbolInfo, ...]]:
    """Return a tuple of SymbolInfo for all (or filtered) instruments."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.symbols_get(group=group) if group else _REAL_MT5.symbols_get()
    symbols = _STATE._symbols
    if group:
        symbols = [s for s in symbols if group.strip("*").upper() in s.upper()]
    result = tuple(_mock_symbol_info(s) for s in symbols)
    return result if result else None


def symbol_info(symbol: str) -> Optional[SymbolInfo]:
    """Return SymbolInfo for the given symbol."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.symbol_info(symbol)
    return _mock_symbol_info(symbol)


def symbol_info_tick(symbol: str) -> Optional[TickInfo]:
    """Return the latest tick for a symbol."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.symbol_info_tick(symbol)
    if symbol not in _STATE._symbols:
        return None
    bid = 1.08500 if "EUR" in symbol else 100.0
    return TickInfo(
        time=int(time.time()), bid=bid, ask=bid + 0.0001,
        last=bid, volume=1, time_msc=int(time.time() * 1000),
        flags=6, volume_real=1.0,
    )


def symbol_select(symbol: str, enable: bool = True) -> bool:
    """Select or deselect a symbol in MarketWatch."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.symbol_select(symbol, enable)
    if enable and symbol not in _STATE._symbols:
        _STATE._symbols.append(symbol)
    elif not enable and symbol in _STATE._symbols:
        _STATE._symbols.remove(symbol)
    return True


# -- Market book -------------------------------------------------------------

def market_book_add(symbol: str) -> bool:
    """Subscribe to the order book (DOM) for *symbol*."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.market_book_add(symbol)
    return symbol in _STATE._symbols


def market_book_get(symbol: str) -> Optional[Tuple[BookInfo, ...]]:
    """Return current order book snapshot."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.market_book_get(symbol)
    if symbol not in _STATE._symbols:
        return None
    bid = 1.08500 if "EUR" in symbol else 100.0
    return tuple(
        BookInfo(type=1, price=bid - i * 0.0001, volume=100 * (i + 1), volume_real=float(100 * (i + 1)))
        for i in range(5)
    ) + tuple(
        BookInfo(type=2, price=bid + (i + 1) * 0.0001, volume=80 * (i + 1), volume_real=float(80 * (i + 1)))
        for i in range(5)
    )


def market_book_release(symbol: str) -> bool:
    """Unsubscribe from the order book for *symbol*."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.market_book_release(symbol)
    return True


# -- Historical price data ---------------------------------------------------

def copy_rates_from(
    symbol: str,
    timeframe: int,
    date_from: datetime,
    count: int,
) -> Optional[np.ndarray]:
    """Copy *count* bars starting from *date_from* going forward."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.copy_rates_from(symbol, timeframe, date_from, count)
    if symbol not in _STATE._symbols or count <= 0:
        return None
    return _make_rates_array(count)


def copy_rates_from_pos(
    symbol: str,
    timeframe: int,
    start_pos: int,
    count: int,
) -> Optional[np.ndarray]:
    """Copy *count* bars starting at *start_pos* bars back from current bar."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.copy_rates_from_pos(symbol, timeframe, start_pos, count)
    if symbol not in _STATE._symbols or count <= 0:
        return None
    return _make_rates_array(count)


def copy_rates_range(
    symbol: str,
    timeframe: int,
    date_from: datetime,
    date_to: datetime,
) -> Optional[np.ndarray]:
    """Copy bars within a date range."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.copy_rates_range(symbol, timeframe, date_from, date_to)
    if symbol not in _STATE._symbols:
        return None
    ts_diff = int(date_to.timestamp()) - int(date_from.timestamp())
    tf_secs = max(timeframe * 60, 60)
    n = max(ts_diff // tf_secs, 1)
    return _make_rates_array(n)


def copy_ticks_from(
    symbol: str,
    date_from: datetime,
    count: int,
    flags: int = COPY_TICKS_ALL,
) -> Optional[np.ndarray]:
    """Copy *count* ticks starting from *date_from*."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.copy_ticks_from(symbol, date_from, count, flags)
    if symbol not in _STATE._symbols or count <= 0:
        return None
    return _make_ticks_array(count)


def copy_ticks_range(
    symbol: str,
    date_from: datetime,
    date_to: datetime,
    flags: int = COPY_TICKS_ALL,
) -> Optional[np.ndarray]:
    """Copy ticks in the given date range."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.copy_ticks_range(symbol, date_from, date_to, flags)
    if symbol not in _STATE._symbols:
        return None
    ts_diff = max(int(date_to.timestamp()) - int(date_from.timestamp()), 0)
    n = max(ts_diff, 1)  # 1 tick per second (mock)
    return _make_ticks_array(n)


# -- Live orders & positions -------------------------------------------------

def orders_total() -> int:
    """Return number of active orders."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.orders_total()
    return 2


def orders_get(
    symbol: str = "",
    group: str = "",
    ticket: int = 0,
) -> Optional[Tuple[TradeOrder, ...]]:
    """Return active orders (optionally filtered)."""
    if not _MOCK_ACTIVE:
        kwargs: dict = {}
        if symbol:
            kwargs["symbol"] = symbol
        if group:
            kwargs["group"] = group
        if ticket:
            kwargs["ticket"] = ticket
        return _REAL_MT5.orders_get(**kwargs)
    orders = _make_orders(2)
    if symbol:
        orders = tuple(o for o in orders if o.symbol == symbol)
    if ticket:
        orders = tuple(o for o in orders if o.ticket == ticket)
    return orders if orders else None


def order_calc_margin(
    action: int,
    symbol: str,
    volume: float,
    price: float,
) -> Optional[float]:
    """Calculate required margin for a hypothetical trade."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.order_calc_margin(action, symbol, volume, price)
    info = _mock_symbol_info(symbol)
    if info is None:
        return None
    return round(volume * info.trade_contract_size * price / 100.0, 2)


def order_calc_profit(
    action: int,
    symbol: str,
    volume: float,
    price_open: float,
    price_close: float,
) -> Optional[float]:
    """Calculate hypothetical profit for a closed trade."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.order_calc_profit(action, symbol, volume, price_open, price_close)
    info = _mock_symbol_info(symbol)
    if info is None:
        return None
    direction = 1 if action == ORDER_TYPE_BUY else -1
    pips = (price_close - price_open) / info.point
    return round(pips * info.trade_tick_value * volume * direction, 2)


def order_check(request: dict) -> Optional[OrderCheckResult]:
    """Pre-validate a trade request."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.order_check(request)
    margin = order_calc_margin(
        request.get("action", TRADE_ACTION_DEAL),
        request.get("symbol", "EURUSD"),
        request.get("volume", 0.1),
        request.get("price", 1.085),
    ) or 0.0
    return OrderCheckResult(
        retcode=0, balance=10000.0, equity=10150.0,
        profit=150.0, margin=margin,
        margin_free=10150.0 - margin,
        margin_level=10150.0 / max(margin, 1e-9) * 100,
        comment="Done", request=request,
    )


def order_send(request: dict) -> Optional[OrderSendResult]:
    """Send a trade request to the server."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.order_send(request)
    price = request.get("price", 1.085)
    return OrderSendResult(
        retcode=TRADE_RETCODE_DONE, deal=40001, order=30001,
        volume=request.get("volume", 0.1), price=price,
        bid=price - 0.00005, ask=price + 0.00005,
        comment="Request executed",
        request_id=1, retcode_external=0, request=request,
    )


def positions_total() -> int:
    """Return number of open positions."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.positions_total()
    return 1


def positions_get(
    symbol: str = "",
    group: str = "",
    ticket: int = 0,
) -> Optional[Tuple[TradePosition, ...]]:
    """Return open positions (optionally filtered)."""
    if not _MOCK_ACTIVE:
        kwargs: dict = {}
        if symbol:
            kwargs["symbol"] = symbol
        if group:
            kwargs["group"] = group
        if ticket:
            kwargs["ticket"] = ticket
        return _REAL_MT5.positions_get(**kwargs)
    positions = _make_positions(1)
    if symbol:
        positions = tuple(p for p in positions if p.symbol == symbol)
    if ticket:
        positions = tuple(p for p in positions if p.ticket == ticket)
    return positions if positions else None


# -- History -----------------------------------------------------------------

def history_orders_total(date_from: datetime, date_to: datetime) -> int:
    """Return number of orders placed within the specified date interval."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.history_orders_total(date_from, date_to)
    orders = _make_history_orders(date_from, date_to)
    return len(orders)


def history_orders_get(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    group: str = "",
    ticket: int = 0,
    position: int = 0,
) -> Optional[Tuple[TradeOrder, ...]]:
    """Return historical orders for a given interval / filter."""
    if not _MOCK_ACTIVE:
        kwargs: dict = {}
        if group:
            kwargs["group"] = group
        if ticket:
            kwargs["ticket"] = ticket
        if position:
            kwargs["position"] = position
        if date_from and date_to:
            return _REAL_MT5.history_orders_get(date_from, date_to, **kwargs)
        return _REAL_MT5.history_orders_get(**kwargs)
    if date_from is None or date_to is None:
        return None
    orders = _make_history_orders(date_from, date_to)
    if group:
        orders = tuple(o for o in orders if group.strip("*").upper() in o.symbol.upper())
    if ticket:
        orders = tuple(o for o in orders if o.ticket == ticket)
    return orders if orders else None


def history_deals_total(date_from: datetime, date_to: datetime) -> int:
    """Return number of deals (filled transactions) within the date interval."""
    if not _MOCK_ACTIVE:
        return _REAL_MT5.history_deals_total(date_from, date_to)
    deals = _make_history_deals(date_from, date_to)
    return len(deals)


def history_deals_get(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    group: str = "",
    ticket: int = 0,
    position: int = 0,
) -> Optional[Tuple[TradeDeal, ...]]:
    """Return historical deals for a given interval / filter."""
    if not _MOCK_ACTIVE:
        kwargs: dict = {}
        if group:
            kwargs["group"] = group
        if ticket:
            kwargs["ticket"] = ticket
        if position:
            kwargs["position"] = position
        if date_from and date_to:
            return _REAL_MT5.history_deals_get(date_from, date_to, **kwargs)
        return _REAL_MT5.history_deals_get(**kwargs)
    if date_from is None or date_to is None:
        return None
    deals = _make_history_deals(date_from, date_to)
    if group:
        deals = tuple(d for d in deals if group.strip("*").upper() in d.symbol.upper())
    if ticket:
        deals = tuple(d for d in deals if d.ticket == ticket)
    return deals if deals else None
