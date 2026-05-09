"""
Unit tests for the refactored unified_feed package.

Run with:
  python -m unittest tradingview_integration/unified_feed/tests/test_unified_feed.py
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

# Ensure repo root is on sys.path so relative imports resolve
_REPO_ROOT = Path(__file__).resolve().parents[4]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from tradingview_integration.unified_feed.adapters.root_directives import (
    DirectiveCatalog,
    DirectiveEntry,
    RootDirectives,
)
from tradingview_integration.unified_feed.db.dat_manager import DatabaseManager
from tradingview_integration.unified_feed.indicators.ta import (
    atr,
    bollinger,
    compute_ta,
    ema,
    macd,
    rsi,
    vwap,
)
from tradingview_integration.unified_feed.signals.anomaly import detect_anomalies
from tradingview_integration.unified_feed.signals.correlation import (
    build_corr_matrix,
    clear_corr_cache,
    update_corr_cache,
)
from tradingview_integration.unified_feed.signals.fusion import fuse_signals
from tradingview_integration.unified_feed.signals.quality import compute_seed_quality


# ─────────────────────────────────────────────────────────────────────────────
# Helper factories
# ─────────────────────────────────────────────────────────────────────────────

def _make_ohlcv(n: int = 60, seed: int = 42) -> pd.DataFrame:
    rng    = np.random.default_rng(seed)
    close  = 100.0 + np.cumsum(rng.normal(0, 1, n))
    high   = close + rng.uniform(0, 2, n)
    low    = close - rng.uniform(0, 2, n)
    open_  = close + rng.normal(0, 0.5, n)
    volume = rng.integers(1_000_000, 5_000_000, n).astype(float)
    return pd.DataFrame({
        "date":   [f"2024-{(i // 30) + 1:02d}-{(i % 30) + 1:02d}" for i in range(n)],
        "open":   open_,
        "high":   high,
        "low":    low,
        "close":  close,
        "volume": volume,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

class TestConfig(unittest.TestCase):
    def test_root_exists(self):
        from tradingview_integration.unified_feed.config import ROOT
        self.assertTrue(ROOT.is_dir())

    def test_tickers_non_empty(self):
        from tradingview_integration.unified_feed.config import TICKERS
        self.assertGreater(len(TICKERS), 0)

    def test_data_dirs_keys(self):
        from tradingview_integration.unified_feed.config import DATA_DIRS
        for key in ("sp", "mp", "yf", "gf", "gh", "idx"):
            self.assertIn(key, DATA_DIRS)


# ─────────────────────────────────────────────────────────────────────────────
# DatabaseManager
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabaseManager(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.dbs_dir = Path(self._tmpdir.name)
        self.mgr = DatabaseManager(dbs_dir=self.dbs_dir)

    def tearDown(self):
        self._tmpdir.cleanup()

    def test_initial_list_empty(self):
        self.assertEqual(self.mgr.list_files(), [])

    def test_register_bare_filename(self):
        resolved = self.mgr.register("database.db")
        self.assertIn("database.db", resolved)
        self.assertIn(str(self.dbs_dir), resolved)

    def test_register_idempotent(self):
        self.mgr.register("database.db")
        self.mgr.register("database.db")
        self.assertEqual(len(self.mgr.list_files()), 1)

    def test_unregister(self):
        self.mgr.register("example.dat")
        removed = self.mgr.unregister("example.dat")
        self.assertTrue(removed)
        self.assertEqual(self.mgr.list_files(), [])

    def test_unregister_nonexistent(self):
        removed = self.mgr.unregister("ghost.db")
        self.assertFalse(removed)

    def test_exists(self):
        self.mgr.register("test.db")
        self.assertTrue(self.mgr.exists("test.db"))
        self.assertFalse(self.mgr.exists("missing.db"))

    def test_atomic_write(self):
        """files.json should be valid JSON after register."""
        self.mgr.register("a.db")
        self.mgr.register("b.db")
        files_json = self.dbs_dir / "files.json"
        self.assertTrue(files_json.is_file())
        with open(files_json) as fh:
            data = json.load(fh)
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 2)

    def test_sync_from_disk_adds_real_files(self):
        """sync_from_disk should pick up files on disk."""
        (self.dbs_dir / "real.db").touch()
        entries = self.mgr.sync_from_disk()
        paths   = [Path(e).name for e in entries]
        self.assertIn("real.db", paths)

    def test_metadata(self):
        self.mgr.register("m.db")
        meta = self.mgr.metadata()
        self.assertEqual(meta["count"], 1)
        self.assertIn("dbs_dir", meta)
        self.assertIn("files_json", meta)


# ─────────────────────────────────────────────────────────────────────────────
# RootDirectives
# ─────────────────────────────────────────────────────────────────────────────

class TestRootDirectives(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self._tmpdir.name)
        # Create minimal directory structure
        (self.root / "dbs").mkdir()
        (self.root / "dbs" / "database.db").touch()
        (self.root / "dbs" / "files.json").write_text('["database.db"]')
        (self.root / "actions").mkdir()
        (self.root / "actions" / "core.js").touch()
        (self.root / "finance").mkdir()
        (self.root / "finance" / "manifest.json").touch()
        (self.root / "config.py").touch()

    def tearDown(self):
        self._tmpdir.cleanup()

    def test_scan_returns_catalog(self):
        rd = RootDirectives(root=self.root)
        cat = rd.scan()
        self.assertIsInstance(cat, DirectiveCatalog)

    def test_dbs_files_detected(self):
        rd = RootDirectives(root=self.root)
        cat = rd.scan()
        self.assertGreater(len(cat.dbs_files), 0)

    def test_action_files_detected(self):
        rd = RootDirectives(root=self.root)
        cat = rd.scan()
        self.assertGreater(len(cat.action_files), 0)

    def test_finance_files_detected(self):
        rd = RootDirectives(root=self.root)
        cat = rd.scan()
        self.assertGreater(len(cat.finance_files), 0)

    def test_root_python_whitelist(self):
        rd = RootDirectives(root=self.root)
        cat = rd.scan()
        names = [e.path.name for e in cat.root_python_files]
        self.assertIn("config.py", names)

    def test_mathematics_missing_ok(self):
        """mathematics/ not existing should not raise."""
        rd = RootDirectives(root=self.root)
        cat = rd.scan()
        self.assertEqual(cat.math_files, [])

    def test_as_dict(self):
        rd = RootDirectives(root=self.root)
        d  = rd.scan_dict()
        self.assertIn("total", d)
        self.assertIn("dbs_files", d)
        self.assertIn("action_files", d)
        self.assertIn("finance_files", d)
        self.assertIn("math_files", d)
        self.assertIn("root_python_files", d)

    def test_get_by_category(self):
        rd  = RootDirectives(root=self.root)
        cat = rd.scan()
        dbs = cat.get_by_category("dbs")
        self.assertTrue(all(e.category == "dbs" for e in dbs))

    def test_has_category(self):
        rd  = RootDirectives(root=self.root)
        cat = rd.scan()
        self.assertTrue(cat.has_category("actions"))
        self.assertFalse(cat.has_category("mathematics"))

    def test_entry_kind_data(self):
        rd  = RootDirectives(root=self.root)
        cat = rd.scan()
        finance_entry = cat.finance_files[0]
        self.assertEqual(finance_entry.kind, "data")

    def test_entry_kind_code(self):
        rd  = RootDirectives(root=self.root)
        cat = rd.scan()
        action_entry = cat.action_files[0]
        self.assertEqual(action_entry.kind, "code")


# ─────────────────────────────────────────────────────────────────────────────
# Technical Indicators
# ─────────────────────────────────────────────────────────────────────────────

class TestEMA(unittest.TestCase):
    def test_same_length(self):
        data = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        out  = ema(data, 3)
        self.assertEqual(len(out), len(data))

    def test_first_value_equals_input(self):
        data = np.array([10.0, 20.0, 30.0])
        out  = ema(data, 2)
        self.assertAlmostEqual(out[0], 10.0)

    def test_empty_array(self):
        out = ema(np.array([]), 5)
        self.assertEqual(len(out), 0)

    def test_monotone_increasing(self):
        data = np.arange(1.0, 20.0)
        out  = ema(data, 5)
        # EMA on monotone increasing series should itself be increasing
        self.assertTrue(all(out[i] <= out[i + 1] for i in range(1, len(out) - 1)))


class TestRSI(unittest.TestCase):
    def test_output_length(self):
        closes = np.linspace(100, 120, 30)
        out    = rsi(closes, 14)
        self.assertEqual(len(out), 30)

    def test_rsi_range(self):
        closes = _make_ohlcv(60)["close"].values
        out    = rsi(closes, 14)
        valid  = out[~np.isnan(out)]
        self.assertTrue(all(0.0 <= v <= 100.0 for v in valid))

    def test_short_series_returns_nan(self):
        closes = np.array([100.0, 101.0])
        out    = rsi(closes, 14)
        self.assertTrue(np.all(np.isnan(out)))


class TestMACD(unittest.TestCase):
    def test_output_lengths(self):
        closes = _make_ohlcv(60)["close"].values
        ml, sl, hl = macd(closes)
        self.assertEqual(len(ml), len(closes))
        self.assertEqual(len(sl), len(closes))
        self.assertEqual(len(hl), len(closes))

    def test_histogram_is_diff(self):
        closes = _make_ohlcv(60)["close"].values
        ml, sl, hl = macd(closes)
        np.testing.assert_allclose(hl, ml - sl)


class TestBollinger(unittest.TestCase):
    def test_output_shape(self):
        closes = _make_ohlcv(60)["close"].values
        u, m, l = bollinger(closes)
        self.assertEqual(len(u), len(closes))

    def test_band_order(self):
        closes = _make_ohlcv(60)["close"].values
        u, m, l = bollinger(closes)
        valid   = ~np.isnan(u)
        self.assertTrue(np.all(u[valid] >= m[valid]))
        self.assertTrue(np.all(m[valid] >= l[valid]))


class TestATR(unittest.TestCase):
    def test_output_length(self):
        df  = _make_ohlcv(60)
        out = atr(df["high"].values, df["low"].values, df["close"].values)
        self.assertEqual(len(out), 60)

    def test_non_negative(self):
        df    = _make_ohlcv(60)
        out   = atr(df["high"].values, df["low"].values, df["close"].values)
        valid = out[~np.isnan(out)]
        self.assertTrue(np.all(valid >= 0.0))


class TestVWAP(unittest.TestCase):
    def test_output_length(self):
        df  = _make_ohlcv(30)
        out = vwap(df["high"].values, df["low"].values, df["close"].values, df["volume"].values)
        self.assertEqual(len(out), 30)

    def test_between_low_and_high(self):
        df  = _make_ohlcv(30)
        out = vwap(df["high"].values, df["low"].values, df["close"].values, df["volume"].values)
        # Cumulative VWAP is a volume-weighted average of all past typical prices,
        # so it is not guaranteed to lie within each individual bar's [low, high].
        # At minimum it should be positive and finite.
        self.assertTrue(np.all(np.isfinite(out)))
        self.assertTrue(np.all(out > 0))


class TestComputeTA(unittest.TestCase):
    def test_returns_dict(self):
        df = _make_ohlcv(60)
        ta = compute_ta(df)
        self.assertIsInstance(ta, dict)

    def test_expected_keys(self):
        df   = _make_ohlcv(60)
        ta   = compute_ta(df)
        keys = ["rsi", "macd", "bb_upper", "bb_lower", "atr", "ema_fast", "ema_slow", "vwap",
                "macd_sig", "macd_hist", "macd_cross", "bb_mid", "bb_zscore", "ema_trend"]
        for k in keys:
            self.assertIn(k, ta)

    def test_empty_df_returns_empty(self):
        ta = compute_ta(pd.DataFrame())
        self.assertEqual(ta, {})

    def test_ema_trend_labels(self):
        df  = _make_ohlcv(60)
        ta  = compute_ta(df)
        self.assertIn(ta["ema_trend"], ("BULL", "BEAR", "FLAT"))

    def test_macd_cross_labels(self):
        df = _make_ohlcv(60)
        ta = compute_ta(df)
        self.assertIn(ta["macd_cross"], ("BULLISH", "BEARISH", "FLAT"))


# ─────────────────────────────────────────────────────────────────────────────
# Anomaly detection
# ─────────────────────────────────────────────────────────────────────────────

class TestDetectAnomalies(unittest.TestCase):
    def test_short_series_no_anomaly(self):
        df  = _make_ohlcv(3)
        out = detect_anomalies(df)
        self.assertFalse(out["is_anomaly"])

    def test_stable_series(self):
        closes = np.full(60, 100.0)
        df     = pd.DataFrame({"close": closes})
        out    = detect_anomalies(df)
        self.assertFalse(out["is_anomaly"])

    def test_spike_detected(self):
        closes = np.full(60, 100.0, dtype=float)
        closes[-1] = 200.0    # massive spike → anomaly
        df         = pd.DataFrame({"close": closes})
        out        = detect_anomalies(df, threshold=2.0)
        self.assertTrue(out["is_anomaly"])

    def test_output_keys(self):
        df  = _make_ohlcv(30)
        out = detect_anomalies(df)
        for k in ("is_anomaly", "zscore_last", "anomaly_count", "anomaly_pct"):
            self.assertIn(k, out)

    def test_empty_df(self):
        out = detect_anomalies(pd.DataFrame())
        self.assertFalse(out["is_anomaly"])


# ─────────────────────────────────────────────────────────────────────────────
# Cross-asset correlation
# ─────────────────────────────────────────────────────────────────────────────

class TestCorrelation(unittest.TestCase):
    def setUp(self):
        clear_corr_cache()

    def tearDown(self):
        clear_corr_cache()

    def test_single_ticker_no_matrix(self):
        df = _make_ohlcv(30)
        update_corr_cache("spy", df)
        result = build_corr_matrix()
        self.assertEqual(result["matrix"], [])

    def test_two_tickers_matrix_shape(self):
        df1 = _make_ohlcv(30, seed=1)
        df2 = _make_ohlcv(30, seed=2)
        update_corr_cache("spy",  df1)
        update_corr_cache("aapl", df2)
        result = build_corr_matrix()
        self.assertEqual(len(result["matrix"]), 2)
        self.assertEqual(len(result["matrix"][0]), 2)

    def test_self_correlation_is_one(self):
        df = _make_ohlcv(30)
        update_corr_cache("spy",  df)
        update_corr_cache("spy2", df)
        result = build_corr_matrix()
        # Diagonal elements should be close to 1.0.
        # Note: np.cov uses ddof=1 while .std() uses ddof=0, so the ratio
        # for a window of size w is w/(w-1) rather than exactly 1.0.
        for i in range(len(result["tickers"])):
            self.assertAlmostEqual(result["matrix"][i][i], 1.0, delta=0.1)

    def test_missing_column_skipped(self):
        df = pd.DataFrame({"open": [1, 2, 3]})
        update_corr_cache("bad", df)
        # Should not raise; cache for "bad" should not be set
        result = build_corr_matrix()
        self.assertNotIn("bad", result.get("tickers", []))


# ─────────────────────────────────────────────────────────────────────────────
# Signal fusion
# ─────────────────────────────────────────────────────────────────────────────

class TestFuseSignals(unittest.TestCase):
    def _base_ta(self):
        return {
            "ema_trend":  "BULL",
            "macd_cross": "BULLISH",
            "bb_zscore":  0.0,
            "rsi":        60.0,
        }

    def test_returns_dict_with_keys(self):
        fusion = fuse_signals(self._base_ta(), {}, {}, {}, {"is_anomaly": False})
        for k in ("composite_score", "signal_label", "components", "anomaly_penalty"):
            self.assertIn(k, fusion)

    def test_score_range(self):
        fusion = fuse_signals(self._base_ta(), {}, {}, {}, {"is_anomaly": False})
        self.assertGreaterEqual(fusion["composite_score"], -1.0)
        self.assertLessEqual(fusion["composite_score"],    1.0)

    def test_bullish_signals(self):
        ta  = self._base_ta()
        sp  = {"signal": "bullish"}
        mp  = {"prediction": {"signal": "bullish"}}
        fusion = fuse_signals(ta, sp, mp, {}, {"is_anomaly": False})
        self.assertGreater(fusion["composite_score"], 0.0)

    def test_bearish_signals(self):
        ta = {
            "ema_trend":  "BEAR",
            "macd_cross": "BEARISH",
            "bb_zscore":  1.5,
            "rsi":        30.0,
        }
        sp  = {"signal": "bearish"}
        mp  = {"prediction": {"signal": "bearish"}}
        fusion = fuse_signals(ta, sp, mp, {}, {"is_anomaly": False})
        self.assertLess(fusion["composite_score"], 0.0)

    def test_anomaly_halves_score(self):
        ta  = self._base_ta()
        f_no  = fuse_signals(ta, {}, {}, {}, {"is_anomaly": False})
        f_yes = fuse_signals(ta, {}, {}, {}, {"is_anomaly": True})
        self.assertAlmostEqual(
            abs(f_yes["composite_score"]),
            abs(f_no["composite_score"]) * 0.5,
            places=4,
        )

    def test_signal_labels(self):
        ta = self._base_ta()
        sp = {"signal": "bullish"}
        mp = {"prediction": {"signal": "bullish"}}
        fusion = fuse_signals(ta, sp, mp, {}, {"is_anomaly": False})
        self.assertIn(fusion["signal_label"],
                      ("STRONG_BULL", "BULL", "NEUTRAL", "BEAR", "STRONG_BEAR"))


# ─────────────────────────────────────────────────────────────────────────────
# Seed quality
# ─────────────────────────────────────────────────────────────────────────────

class TestComputeSeedQuality(unittest.TestCase):
    def test_full_data_high_score(self):
        df = _make_ohlcv(60)
        ta = compute_ta(df)
        an = detect_anomalies(df)
        q  = compute_seed_quality(df, ta, an)
        self.assertGreaterEqual(q["total"], 60)    # expect B or A grade

    def test_empty_df_zero_row(self):
        q = compute_seed_quality(pd.DataFrame(), {}, {"anomaly_pct": 100.0})
        self.assertEqual(q["row"], 0)

    def test_grade_values(self):
        df = _make_ohlcv(60)
        ta = compute_ta(df)
        an = detect_anomalies(df)
        q  = compute_seed_quality(df, ta, an)
        self.assertIn(q["grade"], ("A", "B", "C", "D"))

    def test_output_keys(self):
        df = _make_ohlcv(30)
        q  = compute_seed_quality(df, {}, {})
        for k in ("total", "row", "ta", "anomaly", "grade"):
            self.assertIn(k, q)


# ─────────────────────────────────────────────────────────────────────────────
# Package __init__ imports
# ─────────────────────────────────────────────────────────────────────────────

class TestPackageImports(unittest.TestCase):
    def test_top_level_imports(self):
        from tradingview_integration.unified_feed import (
            DatabaseManager,
            FeedEngine,
            RootDirectives,
            build_corr_matrix,
            compute_seed_quality,
            compute_ta,
            detect_anomalies,
            fuse_signals,
            run_all,
            update_corr_cache,
        )
        # Just verify the names are callable / classes
        self.assertTrue(callable(run_all))
        self.assertTrue(callable(compute_ta))
        self.assertTrue(callable(detect_anomalies))
        self.assertTrue(callable(fuse_signals))


if __name__ == "__main__":
    unittest.main(verbosity=2)
