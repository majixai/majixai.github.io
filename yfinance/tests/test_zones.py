"""
Unit tests for yfinance/zones.py — zone detection logic.
"""
import math
import unittest

import numpy as np
import pandas as pd

# Allow running from repo root or yfinance/ directory
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

from yfinance.zones import (
    ATR_MEAN_WINDOW,
    ATR_STDEV_THRESHOLD,
    ATR_WINDOW,
    BULL_TRIGGER_PCT,
    CONSOL_PCT_THRESHOLD,
    CONSOL_RANGE_WINDOW,
    ZoneResult,
    ZoneSummary,
    _atr,
    _true_range,
    classify_from_batch_df,
    classify_many,
    classify_ticker,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_flat_df(n=60, price=100.0, high_bias=1.0, vol_range=1.0):
    """Create a synthetic OHLCV DataFrame with controllable range."""
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    close = np.full(n, price)
    high  = close + vol_range * high_bias
    low   = close - vol_range
    return pd.DataFrame(
        {"Open": close, "High": high, "Low": low, "Close": close, "Volume": 1_000_000},
        index=dates,
    )


def _make_expanding_vol_df(n=80, base_vol=1.0, spike_factor=10.0):
    """
    Flat price but ATR explodes in the last 10 bars.
    This should trigger an Expansion Zone.
    """
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    price = 200.0
    vol = np.full(n, base_vol)
    vol[-10:] = base_vol * spike_factor  # spike at end
    close = np.full(n, price)
    high  = close + vol
    low   = close - vol
    return pd.DataFrame(
        {"Open": close, "High": high, "Low": low, "Close": close, "Volume": 1_000_000},
        index=dates,
    )


def _make_bull_trigger_df(n=80, session_gain=0.05):
    """Expanding ATR + large last-session gain → Bull Trigger."""
    df = _make_expanding_vol_df(n=n, base_vol=1.0, spike_factor=12.0)
    price = 200.0
    df.iloc[-1, df.columns.get_loc("Close")] = price * (1 + session_gain)
    return df


def _make_consolidation_df(n=60, price=100.0):
    """Very tight range — consolidation zone expected."""
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    close = np.full(n, price)
    high  = close + 0.05   # < 0.1% range
    low   = close - 0.05
    return pd.DataFrame(
        {"Open": close, "High": high, "Low": low, "Close": close, "Volume": 1_000_000},
        index=dates,
    )


# ── True Range / ATR ──────────────────────────────────────────────────────────

class TestTrueRange(unittest.TestCase):
    def test_basic_shape(self):
        df = _make_flat_df(n=20)
        tr = _true_range(df)
        self.assertEqual(len(tr), 20)

    def test_no_negative_values(self):
        df = _make_flat_df(n=30, vol_range=2.0)
        tr = _true_range(df)
        self.assertTrue((tr.dropna() >= 0).all())

    def test_atr_length(self):
        df = _make_flat_df(n=50)
        atr = _atr(df, window=14)
        self.assertEqual(len(atr), 50)


# ── classify_ticker ───────────────────────────────────────────────────────────

class TestClassifyTicker(unittest.TestCase):
    def test_empty_df_returns_error(self):
        r = classify_ticker("X", pd.DataFrame())
        self.assertIsNotNone(r.error)
        self.assertFalse(r.expansion)

    def test_insufficient_rows_returns_error(self):
        df = _make_flat_df(n=5)
        r = classify_ticker("X", df)
        self.assertIsNotNone(r.error)

    def test_normal_flat_not_expansion(self):
        df = _make_flat_df(n=80, vol_range=1.0)
        r = classify_ticker("FLAT", df)
        self.assertFalse(r.expansion,
                         f"Expected no expansion; ATR z={r.atr_zscore}")

    def test_expanding_vol_triggers_expansion(self):
        df = _make_expanding_vol_df(n=80, base_vol=0.5, spike_factor=15.0)
        r = classify_ticker("EXP", df)
        self.assertTrue(r.expansion,
                        f"Expected expansion; ATR z={r.atr_zscore}")
        self.assertFalse(math.isnan(r.atr_zscore))
        self.assertGreater(r.atr_zscore, ATR_STDEV_THRESHOLD)

    def test_tight_range_consolidation(self):
        df = _make_consolidation_df(n=70)
        r = classify_ticker("CON", df)
        self.assertTrue(r.consolidation,
                        f"Expected consolidation; range_pct={r.range_pct}")
        self.assertLess(r.range_pct, CONSOL_PCT_THRESHOLD)

    def test_wide_range_not_consolidation(self):
        df = _make_flat_df(n=70, vol_range=5.0, price=100.0)  # 10% range
        r = classify_ticker("WIDE", df)
        self.assertFalse(r.consolidation,
                         f"Expected no consolidation; range_pct={r.range_pct}")

    def test_bull_trigger_requires_expansion_and_gain(self):
        df = _make_bull_trigger_df(n=80, session_gain=0.05)
        r = classify_ticker("BULL", df)
        self.assertTrue(r.expansion, "Expected expansion zone")
        self.assertGreater(r.session_gain_pct, BULL_TRIGGER_PCT)
        self.assertTrue(r.bull_trigger)

    def test_no_bull_trigger_without_expansion(self):
        # Flat volatility with big gain — no expansion → no bull trigger
        df = _make_flat_df(n=80, vol_range=1.0)
        df.iloc[-1, df.columns.get_loc("Close")] = df["Close"].iloc[-2] * 1.10
        r = classify_ticker("FLAT_BULL", df)
        # No expansion means no bull trigger regardless of gain
        if not r.expansion:
            self.assertFalse(r.bull_trigger)

    def test_result_has_ticker_name(self):
        df = _make_flat_df()
        r = classify_ticker("MYSTOCK", df)
        self.assertEqual(r.ticker, "MYSTOCK")

    def test_last_close_populated(self):
        df = _make_flat_df(price=250.0)
        r = classify_ticker("X", df)
        if r.error is None:
            self.assertAlmostEqual(r.last_close, 250.0, places=0)

    def test_to_dict_keys(self):
        df = _make_flat_df()
        r = classify_ticker("X", df)
        d = r.to_dict()
        for key in ("ticker", "expansion", "consolidation", "bull_trigger",
                    "atr", "atr_zscore", "range_pct", "session_gain_pct",
                    "last_close", "error"):
            self.assertIn(key, d)


# ── classify_many ─────────────────────────────────────────────────────────────

class TestClassifyMany(unittest.TestCase):
    def test_returns_zone_summary(self):
        frames = {
            "A": _make_flat_df(n=80),
            "B": _make_expanding_vol_df(n=80),
        }
        summary = classify_many(frames)
        self.assertIsInstance(summary, ZoneSummary)
        self.assertEqual(summary.total, 2)

    def test_expansion_counted(self):
        frames = {
            "EXP": _make_expanding_vol_df(n=80, base_vol=0.5, spike_factor=15.0),
            "FLAT": _make_flat_df(n=80),
        }
        summary = classify_many(frames)
        self.assertGreater(len(summary.expansion_zones), 0)

    def test_error_counted_for_empty_df(self):
        frames = {
            "EMPTY": pd.DataFrame(),
            "OK": _make_flat_df(n=80),
        }
        summary = classify_many(frames)
        self.assertEqual(len(summary.errors), 1)
        self.assertEqual(summary.errors[0].ticker, "EMPTY")

    def test_top_expansion_sorted_by_zscore(self):
        frames = {
            "BIG": _make_expanding_vol_df(n=80, base_vol=0.5, spike_factor=20.0),
            "MED": _make_expanding_vol_df(n=80, base_vol=0.5, spike_factor=12.0),
        }
        summary = classify_many(frames)
        top = summary.top_expansion(2)
        if len(top) >= 2:
            self.assertGreaterEqual(top[0].atr_zscore, top[1].atr_zscore)

    def test_top_consolidation_sorted_by_range(self):
        frames = {
            "TIGHT": _make_consolidation_df(n=70),
            "LESS": _make_flat_df(n=70, vol_range=0.5),
        }
        summary = classify_many(frames)
        if len(summary.consolidation_zones) >= 2:
            top = summary.top_consolidation(2)
            self.assertLessEqual(top[0].range_pct, top[1].range_pct)

    def test_to_dict_counts(self):
        frames = {
            "EXP": _make_expanding_vol_df(n=80, base_vol=0.5, spike_factor=15.0),
            "EMPTY": pd.DataFrame(),
        }
        summary = classify_many(frames)
        d = summary.to_dict()
        self.assertEqual(d["total"], 2)
        self.assertEqual(d["error_count"], 1)


# ── classify_from_batch_df ────────────────────────────────────────────────────

class TestClassifyFromBatchDf(unittest.TestCase):
    def _multi_df(self, ticker_data):
        """Build a MultiIndex DataFrame like yfinance batch output."""
        dfs = {}
        for sym, df in ticker_data.items():
            for col in df.columns:
                dfs[(col, sym)] = df[col]
        return pd.DataFrame(dfs)

    def test_empty_batch_df(self):
        summary = classify_from_batch_df(pd.DataFrame(), ["A", "B"])
        self.assertEqual(summary.total, 2)

    def test_single_ticker_no_multiindex(self):
        df = _make_flat_df(n=80)
        summary = classify_from_batch_df(df, ["SOLO"])
        self.assertEqual(summary.total, 1)

    def test_multiindex_two_tickers(self):
        tickers = ["X", "Y"]
        df_x = _make_flat_df(n=80)
        df_y = _make_expanding_vol_df(n=80, base_vol=0.5, spike_factor=15.0)
        batch = self._multi_df({"X": df_x, "Y": df_y})
        summary = classify_from_batch_df(batch, tickers)
        self.assertEqual(summary.total, 2)


if __name__ == "__main__":
    unittest.main()
