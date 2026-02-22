#!/usr/bin/env python3
"""
Tests for S&P 500 Closing Price Projection Engine.

Tests cover core components:
- Technical indicators (RSI, MACD, Bollinger Bands)
- Black-Scholes model calculations
- Monte Carlo engine simulation and statistics
- Market time utilities
- Finance data loader
- Live data fetcher (with mocked network calls)
- SP Closing Projection engine integration
"""

import numpy as np
import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sp_closing_projection import (
    TechnicalIndicators,
    BlackScholesModel,
    MonteCarloEngine,
    MarketTimeUtils,
    FinanceDataLoader,
    LiveDataFetcher,
    SPClosingProjectionEngine,
    TRADING_DAYS_PER_YEAR,
    TRADING_MINUTES_PER_DAY,
    RISK_FREE_RATE,
    DEFAULT_VOLATILITY,
)


class TestTechnicalIndicators(unittest.TestCase):
    """Tests for TechnicalIndicators class."""

    def setUp(self):
        self.indicators = TechnicalIndicators()
        # Generate a simple uptrend price series
        np.random.seed(42)
        self.prices = np.cumsum(np.random.normal(0.5, 1.0, 50)) + 100

    def test_rsi_returns_float(self):
        rsi = self.indicators.calculate_rsi(self.prices)
        self.assertIsInstance(rsi, float)

    def test_rsi_range(self):
        rsi = self.indicators.calculate_rsi(self.prices)
        self.assertGreaterEqual(rsi, 0.0)
        self.assertLessEqual(rsi, 100.0)

    def test_rsi_short_data_returns_neutral(self):
        short_prices = np.array([100.0, 101.0])
        rsi = self.indicators.calculate_rsi(short_prices)
        self.assertEqual(rsi, 50.0)

    def test_rsi_all_gains_returns_100(self):
        rising_prices = np.arange(100, 120, dtype=float)
        rsi = self.indicators.calculate_rsi(rising_prices)
        self.assertEqual(rsi, 100.0)

    def test_macd_returns_tuple(self):
        result = self.indicators.calculate_macd(self.prices)
        self.assertEqual(len(result), 3)

    def test_macd_short_data(self):
        short_prices = np.array([100.0, 101.0])
        macd, signal, histogram = self.indicators.calculate_macd(short_prices)
        self.assertEqual(macd, 0.0)
        self.assertEqual(signal, 0.0)
        self.assertEqual(histogram, 0.0)

    def test_bollinger_bands_order(self):
        upper, middle, lower = self.indicators.calculate_bollinger_bands(self.prices)
        self.assertGreater(upper, middle)
        self.assertGreater(middle, lower)

    def test_bollinger_bands_short_data(self):
        short_prices = np.array([100.0])
        upper, middle, lower = self.indicators.calculate_bollinger_bands(short_prices)
        self.assertAlmostEqual(upper, 102.0)
        self.assertAlmostEqual(middle, 100.0)
        self.assertAlmostEqual(lower, 98.0)

    def test_vwap_calculation(self):
        prices = np.array([100.0, 101.0, 102.0])
        volumes = np.array([1000, 2000, 1000])
        vwap = self.indicators.calculate_vwap(prices, volumes)
        expected = (100 * 1000 + 101 * 2000 + 102 * 1000) / 4000
        self.assertAlmostEqual(vwap, expected, places=2)

    def test_vwap_empty_data(self):
        vwap = self.indicators.calculate_vwap(np.array([]), np.array([]))
        self.assertEqual(vwap, 0.0)


class TestBlackScholesModel(unittest.TestCase):
    """Tests for BlackScholesModel class."""

    def setUp(self):
        self.bsm = BlackScholesModel()
        self.S = 595.0   # Current price
        self.K = 595.0   # Strike (ATM)
        self.T = 30 / 365  # 30 days to expiration
        self.r = 0.0525  # Risk-free rate
        self.sigma = 0.16  # Volatility

    def test_normal_cdf_at_zero(self):
        self.assertAlmostEqual(self.bsm.normal_cdf(0), 0.5, places=5)

    def test_normal_cdf_extreme_values(self):
        self.assertAlmostEqual(self.bsm.normal_cdf(10), 1.0, places=5)
        self.assertAlmostEqual(self.bsm.normal_cdf(-10), 0.0, places=5)

    def test_d1_d2_calculation(self):
        d1, d2 = self.bsm.calculate_d1_d2(self.S, self.K, self.T, self.r, self.sigma)
        self.assertGreater(d1, d2)
        self.assertAlmostEqual(d1 - d2, self.sigma * np.sqrt(self.T), places=5)

    def test_d1_d2_zero_time(self):
        d1, d2 = self.bsm.calculate_d1_d2(self.S, self.K, 0, self.r, self.sigma)
        self.assertEqual(d1, 0.0)
        self.assertEqual(d2, 0.0)

    def test_call_price_positive(self):
        call = self.bsm.call_price(self.S, self.K, self.T, self.r, self.sigma)
        self.assertGreater(call, 0)

    def test_put_price_positive(self):
        put = self.bsm.put_price(self.S, self.K, self.T, self.r, self.sigma)
        self.assertGreater(put, 0)

    def test_put_call_parity(self):
        """Verify put-call parity: C - P = S - K*e^(-rT)."""
        call = self.bsm.call_price(self.S, self.K, self.T, self.r, self.sigma)
        put = self.bsm.put_price(self.S, self.K, self.T, self.r, self.sigma)
        expected_diff = self.S - self.K * np.exp(-self.r * self.T)
        self.assertAlmostEqual(call - put, expected_diff, places=2)

    def test_greeks_keys(self):
        greeks = self.bsm.calculate_greeks(self.S, self.K, self.T, self.r, self.sigma)
        expected_keys = {"delta", "gamma", "theta", "vega", "rho"}
        self.assertEqual(set(greeks.keys()), expected_keys)

    def test_atm_delta_near_half(self):
        greeks = self.bsm.calculate_greeks(self.S, self.K, self.T, self.r, self.sigma)
        self.assertAlmostEqual(greeks["delta"], 0.5, delta=0.1)


class TestMonteCarloEngine(unittest.TestCase):
    """Tests for MonteCarloEngine class."""

    def setUp(self):
        self.engine = MonteCarloEngine(
            current_price=595.0,
            sigma=0.16,
            mu=0.0525,
            simulations=1000,
            random_seed=42,
        )

    def test_simulate_paths_shape(self):
        paths = self.engine.simulate_paths(60)
        self.assertEqual(paths.shape, (61, 1000))

    def test_simulate_paths_starts_at_current(self):
        paths = self.engine.simulate_paths(10)
        np.testing.assert_array_equal(paths[0], 595.0)

    def test_simulate_paths_positive_prices(self):
        paths = self.engine.simulate_paths(60)
        self.assertTrue(np.all(paths > 0))

    def test_calculate_statistics_keys(self):
        paths = self.engine.simulate_paths(60)
        stats = self.engine.calculate_statistics(paths)
        expected_keys = {
            "mean", "std", "p05", "p10", "p25", "p50", "p75", "p90", "p95",
            "min", "max", "skewness", "kurtosis",
        }
        self.assertEqual(set(stats.keys()), expected_keys)

    def test_statistics_percentile_order(self):
        paths = self.engine.simulate_paths(60)
        stats = self.engine.calculate_statistics(paths)
        self.assertLessEqual(stats["min"], stats["p05"])
        self.assertLessEqual(stats["p05"], stats["p25"])
        self.assertLessEqual(stats["p25"], stats["p50"])
        self.assertLessEqual(stats["p50"], stats["p75"])
        self.assertLessEqual(stats["p75"], stats["p95"])
        self.assertLessEqual(stats["p95"], stats["max"])

    def test_probability_ranges(self):
        paths = self.engine.simulate_paths(60)
        probs = self.engine.calculate_probability_ranges(paths, 595.0)
        # Probabilities should sum close to 100
        self.assertAlmostEqual(
            probs["prob_above_current"] + probs["prob_below_current"], 100.0, places=1
        )

    def test_probability_range_values(self):
        paths = self.engine.simulate_paths(60)
        probs = self.engine.calculate_probability_ranges(paths, 595.0)
        for key, value in probs.items():
            self.assertGreaterEqual(value, 0.0)
            self.assertLessEqual(value, 100.0)


class TestMarketTimeUtils(unittest.TestCase):
    """Tests for MarketTimeUtils class."""

    def test_get_eastern_now_returns_datetime(self):
        now = MarketTimeUtils.get_eastern_now()
        self.assertIsInstance(now, datetime)

    def test_minutes_to_close_positive(self):
        minutes = MarketTimeUtils.minutes_to_close()
        self.assertGreater(minutes, 0)

    def test_next_close_time_format(self):
        close_time = MarketTimeUtils.next_close_time()
        self.assertIn("ET", close_time)
        self.assertIn("16:00:00", close_time)

    def test_hourly_intervals_not_empty(self):
        intervals = MarketTimeUtils.get_hourly_intervals_to_close()
        self.assertGreater(len(intervals), 0)

    def test_hourly_intervals_ascending(self):
        intervals = MarketTimeUtils.get_hourly_intervals_to_close()
        minutes = [m for _, m in intervals]
        for i in range(1, len(minutes)):
            self.assertGreaterEqual(minutes[i], minutes[i - 1])

    def test_is_market_open_returns_bool(self):
        result = MarketTimeUtils.is_market_open()
        self.assertIsInstance(result, bool)


class TestFinanceDataLoader(unittest.TestCase):
    """Tests for FinanceDataLoader class."""

    def test_load_with_nonexistent_dir(self):
        loader = FinanceDataLoader(repo_root="/nonexistent/path")
        data = loader.load_all_data()
        self.assertIn("prices", data)
        self.assertIn("sources", data)

    def test_load_with_repo_root(self):
        repo_root = os.path.join(os.path.dirname(__file__), "..")
        loader = FinanceDataLoader(repo_root=repo_root)
        data = loader.load_all_data()
        self.assertIsInstance(data["sources"], list)


class TestLiveDataFetcher(unittest.TestCase):
    """Tests for LiveDataFetcher with mocked HTTP calls."""

    @patch("sp_closing_projection.requests.get")
    def test_fetch_from_yahoo_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "chart": {
                "result": [{
                    "meta": {
                        "regularMarketPrice": 595.50,
                        "chartPreviousClose": 594.00,
                        "regularMarketVolume": 50000000,
                        "regularMarketDayHigh": 596.00,
                    },
                    "timestamp": [1700000000],
                    "indicators": {
                        "quote": [{
                            "close": [594.5, 595.0, 595.5],
                            "high": [595.0, 595.5, 596.0],
                            "low": [594.0, 594.5, 595.0],
                            "volume": [10000, 20000, 15000],
                        }]
                    },
                }]
            }
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = LiveDataFetcher.fetch_from_yahoo("SPY")
        self.assertIsNotNone(result)
        self.assertEqual(result["current_price"], 595.50)
        self.assertEqual(result["source"], "yahoo_finance")

    @patch("sp_closing_projection.requests.get")
    def test_fetch_from_yahoo_failure(self, mock_get):
        import requests as req
        mock_get.side_effect = req.exceptions.ConnectionError("Network error")
        result = LiveDataFetcher.fetch_from_yahoo("SPY")
        self.assertIsNone(result)

    @patch("sp_closing_projection.requests.get")
    def test_fetch_from_google_failure(self, mock_get):
        import requests as req
        mock_get.side_effect = req.exceptions.ConnectionError("Network error")
        result = LiveDataFetcher.fetch_from_google()
        self.assertIsNone(result)


class TestSPClosingProjectionEngine(unittest.TestCase):
    """Integration tests for the main projection engine."""

    def setUp(self):
        self.engine = SPClosingProjectionEngine(
            simulations=100,  # Low for speed
            repo_root=os.path.join(os.path.dirname(__file__), ".."),
        )

    @patch.object(LiveDataFetcher, "fetch_from_yahoo", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_from_google", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_quote_summary", return_value=None)
    def test_run_projection_returns_data(self, mock_quote, mock_google, mock_yahoo):
        result, paths = self.engine.run_projection()

        # Check top-level keys
        self.assertIn("ticker", result)
        self.assertIn("timestamp", result)
        self.assertIn("current_price", result)
        self.assertIn("market_state", result)
        self.assertIn("closing_projection", result)
        self.assertIn("minute_projection", result)
        self.assertIn("hourly_projections", result)
        self.assertIn("technical_indicators", result)
        self.assertIn("signal", result)
        self.assertIn("confidence", result)

    @patch.object(LiveDataFetcher, "fetch_from_yahoo", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_from_google", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_quote_summary", return_value=None)
    def test_closing_projection_keys(self, mock_quote, mock_google, mock_yahoo):
        result, _ = self.engine.run_projection()
        cp = result["closing_projection"]
        self.assertIn("projected_close", cp)
        self.assertIn("probability_above_current", cp)
        self.assertIn("probability_below_current", cp)
        self.assertIn("confidence_intervals", cp)
        self.assertIn("price_targets", cp)

    @patch.object(LiveDataFetcher, "fetch_from_yahoo", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_from_google", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_quote_summary", return_value=None)
    def test_minute_projection_keys(self, mock_quote, mock_google, mock_yahoo):
        result, _ = self.engine.run_projection()
        mp = result["minute_projection"]
        self.assertIn("projected_next_minute", mp)
        self.assertIn("prob_up_next_minute", mp)
        self.assertIn("prob_down_next_minute", mp)

    @patch.object(LiveDataFetcher, "fetch_from_yahoo", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_from_google", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_quote_summary", return_value=None)
    def test_hourly_projections_not_empty(self, mock_quote, mock_google, mock_yahoo):
        result, _ = self.engine.run_projection()
        self.assertGreater(len(result["hourly_projections"]), 0)

    @patch.object(LiveDataFetcher, "fetch_from_yahoo", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_from_google", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_quote_summary", return_value=None)
    def test_signal_valid(self, mock_quote, mock_google, mock_yahoo):
        result, _ = self.engine.run_projection()
        self.assertIn(result["signal"], ["BULLISH", "BEARISH", "NEUTRAL"])

    @patch.object(LiveDataFetcher, "fetch_from_yahoo", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_from_google", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_quote_summary", return_value=None)
    def test_confidence_range(self, mock_quote, mock_google, mock_yahoo):
        result, _ = self.engine.run_projection()
        self.assertGreaterEqual(result["confidence"], 0)
        self.assertLessEqual(result["confidence"], 100)

    def test_generate_minute_projection(self):
        proj = self.engine.generate_minute_projection(595.0, 0.16)
        self.assertIn("projected_next_minute", proj)
        self.assertIn("prob_up_next_minute", proj)
        self.assertAlmostEqual(
            proj["prob_up_next_minute"] + proj["prob_down_next_minute"],
            100.0,
            delta=1.0,
        )

    def test_generate_signal(self):
        stats = {
            "mean": 596.0, "std": 2.0, "p05": 592.0, "p25": 594.5,
            "p50": 596.0, "p75": 597.5, "p95": 600.0,
        }
        signal, confidence = self.engine._generate_signal(50.0, 0.5, stats, 595.0)
        self.assertIn(signal, ["BULLISH", "BEARISH", "NEUTRAL"])
        self.assertGreaterEqual(confidence, 0)


class TestJsonOutputSerializable(unittest.TestCase):
    """Test that output is JSON serializable."""

    @patch.object(LiveDataFetcher, "fetch_from_yahoo", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_from_google", return_value=None)
    @patch.object(LiveDataFetcher, "fetch_quote_summary", return_value=None)
    def test_output_is_json_serializable(self, mock_quote, mock_google, mock_yahoo):
        engine = SPClosingProjectionEngine(
            simulations=100,
            repo_root=os.path.join(os.path.dirname(__file__), ".."),
        )
        result, _ = engine.run_projection()
        # Should not raise
        json_str = json.dumps(result)
        self.assertIsInstance(json_str, str)
        # Should round-trip
        parsed = json.loads(json_str)
        self.assertEqual(parsed["ticker"], result["ticker"])


if __name__ == "__main__":
    unittest.main()
