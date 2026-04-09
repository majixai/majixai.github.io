"""
Tests for pine_poi_updater.py — cache, staleness, and change computation.
"""
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pine_poi_updater as ppu


class TestQuotesDbReadWrite(unittest.TestCase):
    """Test cache (quotes_db) load/save round-trip."""

    def test_load_missing_file_returns_empty_dict(self):
        with patch.object(ppu, "QUOTES_DB_PATH", Path("/nonexistent/quotes_db.json")):
            result = ppu._load_quotes_db()
        self.assertEqual(result, {})

    def test_save_and_load_round_trip(self):
        sample = {
            "SPY": {
                "price": "500.12",
                "change": "1.5",
                "change_pct": "0.3",
                "previous_close": "498.62",
                "asof": "2024-01-02T15:00:00+00:00",
                "source": "yfinance",
            }
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "quotes_db.json"
            with patch.object(ppu, "QUOTES_DB_PATH", db_path), \
                 patch.object(ppu, "DATA_DIR", Path(tmpdir)):
                ppu._save_quotes_db(sample)
                loaded = ppu._load_quotes_db()
        self.assertEqual(loaded, sample)

    def test_load_corrupt_file_returns_empty_dict(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("not valid json {{{{")
            fpath = Path(f.name)
        try:
            with patch.object(ppu, "QUOTES_DB_PATH", fpath):
                result = ppu._load_quotes_db()
            self.assertEqual(result, {})
        finally:
            fpath.unlink(missing_ok=True)


class TestStalenessLogic(unittest.TestCase):
    """Test _is_stale() with various cache states."""

    def test_empty_entry_is_stale(self):
        self.assertTrue(ppu._is_stale({}))

    def test_missing_asof_is_stale(self):
        self.assertTrue(ppu._is_stale({"price": "100"}))

    def test_fresh_entry_is_not_stale(self):
        recent = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        self.assertFalse(ppu._is_stale({"asof": recent}, ttl_minutes=60))

    def test_old_entry_is_stale(self):
        old = (datetime.now(timezone.utc) - timedelta(minutes=120)).isoformat()
        self.assertTrue(ppu._is_stale({"asof": old}, ttl_minutes=60))

    def test_exactly_at_ttl_boundary_is_stale(self):
        # Exactly at TTL should be considered stale
        at_ttl = (datetime.now(timezone.utc) - timedelta(minutes=60, seconds=1)).isoformat()
        self.assertTrue(ppu._is_stale({"asof": at_ttl}, ttl_minutes=60))

    def test_naive_datetime_treated_as_utc(self):
        # Naive ISO string (no tz) should still work
        recent = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)).isoformat()
        self.assertFalse(ppu._is_stale({"asof": recent}, ttl_minutes=60))

    def test_invalid_asof_is_stale(self):
        self.assertTrue(ppu._is_stale({"asof": "not-a-date"}))


class TestChangeComputation(unittest.TestCase):
    """Test that fetch_quote computes change/change_pct from price and previous_close."""

    def _make_live_result(self, price, prev_close, change=None, change_pct=None):
        return {
            "price":          str(price),
            "change":         str(change) if change is not None else None,
            "change_pct":     str(change_pct) if change_pct is not None else None,
            "previous_close": str(prev_close),
            "source":         "yfinance",
            "error":          None,
        }

    def test_change_computed_when_provider_omits_it(self):
        """If provider gives price + previous_close but no change, script computes it."""
        price      = 510.0
        prev_close = 500.0
        price_cache: dict = {}
        quotes_db: dict   = {}

        with patch.object(ppu, "_fetch_yfinance",
                          return_value=self._make_live_result(price, prev_close)):
            q = ppu.fetch_quote("SPY", "NYSEARCA", price_cache, quotes_db)

        self.assertEqual(q["price"], "510.0")
        self.assertIsNotNone(q["change"])
        self.assertAlmostEqual(float(q["change"]), 10.0, places=2)
        self.assertIsNotNone(q["change_pct"])
        self.assertAlmostEqual(float(q["change_pct"]), 2.0, places=2)

    def test_change_not_overwritten_when_already_set(self):
        """If provider already supplies change, do not overwrite it."""
        price_cache: dict = {}
        quotes_db: dict   = {}

        with patch.object(ppu, "_fetch_yfinance",
                          return_value=self._make_live_result(
                              510.0, 500.0, change=10.0, change_pct=2.0)):
            q = ppu.fetch_quote("SPY", "NYSEARCA", price_cache, quotes_db)

        self.assertAlmostEqual(float(q["change"]), 10.0, places=4)
        self.assertAlmostEqual(float(q["change_pct"]), 2.0, places=4)

    def test_no_change_when_no_previous_close(self):
        """Without previous_close, change stays None."""
        price_cache: dict = {}
        quotes_db: dict   = {}

        live = {
            "price":          "510.0",
            "change":         None,
            "change_pct":     None,
            "previous_close": None,
            "source":         "yfinance",
            "error":          None,
        }
        with patch.object(ppu, "_fetch_yfinance", return_value=live):
            q = ppu.fetch_quote("SPY", "NYSEARCA", price_cache, quotes_db)

        self.assertIsNone(q["change"])
        self.assertIsNone(q["change_pct"])

    def test_cache_fallback_on_provider_failure(self):
        """When both providers fail, cached value is used with source='cache'."""
        price_cache: dict = {}
        cached_entry = {
            "price":          "480.0",
            "change":         "-2.5",
            "change_pct":     "-0.52",
            "previous_close": "482.5",
            "asof":           (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat(),
            "source":         "yfinance",
        }
        quotes_db = {"SPY": cached_entry}

        failed = {"price": None, "change": None, "change_pct": None,
                  "previous_close": None, "source": None,
                  "error": "connection error"}
        with patch.object(ppu, "_fetch_yfinance", return_value=failed), \
             patch.object(ppu, "_fetch_yahoo_chart", return_value=failed):
            q = ppu.fetch_quote("SPY", "NYSEARCA", price_cache, quotes_db)

        self.assertEqual(q["price"], "480.0")
        self.assertEqual(q["source"], "cache")
        self.assertIsNotNone(q["error"])

    def test_none_fields_when_no_data_at_all(self):
        """Without cached data and with providers failing, fields stay None."""
        price_cache: dict = {}
        quotes_db: dict   = {}

        failed = {"price": None, "change": None, "change_pct": None,
                  "previous_close": None, "source": None,
                  "error": "timeout"}
        with patch.object(ppu, "_fetch_yfinance", return_value=failed), \
             patch.object(ppu, "_fetch_yahoo_chart", return_value=failed):
            q = ppu.fetch_quote("SPY", "NYSEARCA", price_cache, quotes_db)

        self.assertIsNone(q["price"])
        self.assertIsNone(q["change"])
        self.assertIsNone(q["change_pct"])


class TestComputeMomentum(unittest.TestCase):
    """Test _compute_momentum always returns complete dict."""

    def test_empty_prices_returns_full_dict(self):
        result = ppu._compute_momentum([])
        self.assertIn("momentum_5b", result)
        self.assertIn("rsi_proxy", result)
        self.assertIn("trend_arrow", result)
        self.assertIn("avg_gain_bars", result)
        self.assertIn("avg_loss_bars", result)
        self.assertIsNone(result["momentum_5b"])
        self.assertIsNone(result["rsi_proxy"])

    def test_single_price_returns_full_dict(self):
        result = ppu._compute_momentum([100.0])
        self.assertIn("avg_gain_bars", result)
        self.assertIn("avg_loss_bars", result)

    def test_five_prices_computes_momentum(self):
        prices = [100.0, 101.0, 102.0, 103.0, 105.0]
        result = ppu._compute_momentum(prices)
        self.assertIsNotNone(result["momentum_5b"])
        self.assertAlmostEqual(result["momentum_5b"], 5.0, places=1)
        self.assertEqual(result["trend_arrow"], "▲")

    def test_declining_prices_trend_arrow(self):
        prices = [105.0, 104.0, 103.0]
        result = ppu._compute_momentum(prices)
        self.assertEqual(result["trend_arrow"], "▼")


class TestYfSymbol(unittest.TestCase):
    """Test _yf_symbol mapping."""

    def test_regular_ticker(self):
        self.assertEqual(ppu._yf_symbol("SPY", "NYSEARCA"), "SPY")

    def test_vix_gets_caret(self):
        self.assertEqual(ppu._yf_symbol("VIX", "INDEXCBOE"), "^VIX")

    def test_crypto_unchanged(self):
        self.assertEqual(ppu._yf_symbol("BTC-USD", "CRYPTO"), "BTC-USD")


if __name__ == "__main__":
    unittest.main()
