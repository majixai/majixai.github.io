"""
tests/market_prediction/test_market_predictor.py

Unit tests for ``market_prediction/market_predictor.py``.

Covers:
- TechnicalIndicators: RSI, MACD, Bollinger Bands.
- BlackScholesModel: call/put prices, Greeks, put-call parity.
- MonteCarloEngine: path shape, statistics, positivity.
"""
import math
import os
import sys
import unittest

import numpy as np

# Ensure the market_prediction directory is importable
_MP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "market_prediction",
)
if _MP_DIR not in sys.path:
    sys.path.insert(0, _MP_DIR)

from market_predictor import (
    TechnicalIndicators,
    BlackScholesModel,
    MonteCarloEngine,
)


# ─────────────────────────────────────────────────────────────────────────────
# TechnicalIndicators
# ─────────────────────────────────────────────────────────────────────────────

class TestTechnicalIndicatorsRSI(unittest.TestCase):

    def setUp(self):
        np.random.seed(0)
        self.prices = np.cumsum(np.random.normal(0.5, 1.0, 50)) + 100

    def test_rsi_in_range(self):
        rsi = TechnicalIndicators.calculate_rsi(self.prices)
        self.assertGreaterEqual(rsi, 0.0)
        self.assertLessEqual(rsi, 100.0)

    def test_rsi_returns_neutral_for_short_series(self):
        """When series is shorter than period + 1, RSI should return 50."""
        short = np.array([100.0, 101.0, 102.0])
        self.assertEqual(TechnicalIndicators.calculate_rsi(short, period=14), 50.0)

    def test_rsi_all_gains_returns_100(self):
        """Monotonically increasing series → RSI = 100."""
        rising = np.linspace(100, 200, 30)
        rsi = TechnicalIndicators.calculate_rsi(rising, period=14)
        self.assertAlmostEqual(rsi, 100.0, places=1)

    def test_rsi_all_losses_returns_near_zero(self):
        """Monotonically decreasing series → RSI near 0."""
        falling = np.linspace(200, 100, 30)
        rsi = TechnicalIndicators.calculate_rsi(falling, period=14)
        self.assertLess(rsi, 5.0)


class TestTechnicalIndicatorsMACD(unittest.TestCase):

    def setUp(self):
        np.random.seed(1)
        self.prices = np.cumsum(np.random.normal(0.3, 1.0, 60)) + 100

    def test_macd_returns_three_floats(self):
        macd, signal, hist = TechnicalIndicators.calculate_macd(self.prices)
        self.assertIsInstance(macd, float)
        self.assertIsInstance(signal, float)
        self.assertIsInstance(hist, float)

    def test_macd_short_series_returns_zeros(self):
        short = np.ones(20)
        macd, signal, hist = TechnicalIndicators.calculate_macd(short)
        self.assertEqual(macd, 0.0)
        self.assertEqual(signal, 0.0)
        self.assertEqual(hist, 0.0)

    def test_macd_histogram_equals_macd_minus_signal(self):
        macd, signal, hist = TechnicalIndicators.calculate_macd(self.prices)
        self.assertAlmostEqual(hist, macd - signal, places=10)


class TestTechnicalIndicatorsBollingerBands(unittest.TestCase):

    def setUp(self):
        self.prices = np.linspace(100, 120, 30)

    def test_band_ordering(self):
        upper, mid, lower = TechnicalIndicators.calculate_bollinger_bands(self.prices)
        self.assertGreater(upper, mid)
        self.assertGreater(mid, lower)

    def test_short_series_fallback(self):
        """With fewer prices than period, fallback values are returned."""
        prices = np.array([100.0, 101.0, 102.0])
        upper, mid, lower = TechnicalIndicators.calculate_bollinger_bands(prices, period=20)
        self.assertEqual(mid, 102.0)
        self.assertAlmostEqual(upper, 102.0 * 1.02, places=5)
        self.assertAlmostEqual(lower, 102.0 * 0.98, places=5)

    def test_constant_prices_give_zero_std_bands(self):
        """Constant price series → bands collapse around the mean."""
        prices = np.full(30, 150.0)
        upper, mid, lower = TechnicalIndicators.calculate_bollinger_bands(prices)
        self.assertAlmostEqual(mid, 150.0)
        self.assertAlmostEqual(upper, 150.0)
        self.assertAlmostEqual(lower, 150.0)


# ─────────────────────────────────────────────────────────────────────────────
# BlackScholesModel
# ─────────────────────────────────────────────────────────────────────────────

class TestBlackScholesModel(unittest.TestCase):

    # Standard parameters: ATM option with 30 days, 5 % rate, 20 % vol
    S = 100.0
    K = 100.0
    T = 30 / 365.0
    r = 0.05
    sigma = 0.20

    def test_call_price_positive(self):
        price = BlackScholesModel.call_price(self.S, self.K, self.T, self.r, self.sigma)
        self.assertGreater(price, 0.0)

    def test_put_price_positive(self):
        price = BlackScholesModel.put_price(self.S, self.K, self.T, self.r, self.sigma)
        self.assertGreater(price, 0.0)

    def test_put_call_parity(self):
        """C - P = S - K·e^(-rT)  (put-call parity)."""
        C = BlackScholesModel.call_price(self.S, self.K, self.T, self.r, self.sigma)
        P = BlackScholesModel.put_price(self.S, self.K, self.T, self.r, self.sigma)
        parity = self.S - self.K * math.exp(-self.r * self.T)
        self.assertAlmostEqual(C - P, parity, places=6)

    def test_call_increases_with_spot(self):
        """Higher spot price → higher call price."""
        c_low = BlackScholesModel.call_price(90, self.K, self.T, self.r, self.sigma)
        c_high = BlackScholesModel.call_price(110, self.K, self.T, self.r, self.sigma)
        self.assertGreater(c_high, c_low)

    def test_zero_time_to_expiry(self):
        """With T=0 the formula handles the edge case gracefully."""
        # d1 and d2 should both be 0.0 when T<=0
        d1, d2 = BlackScholesModel.calculate_d1_d2(self.S, self.K, 0.0, self.r, self.sigma)
        self.assertEqual(d1, 0.0)
        self.assertEqual(d2, 0.0)

    def test_greeks_keys_present(self):
        """calculate_greeks returns all five Greeks."""
        greeks = BlackScholesModel.calculate_greeks(
            self.S, self.K, self.T, self.r, self.sigma
        )
        for key in ("delta", "gamma", "theta", "vega", "rho"):
            self.assertIn(key, greeks)

    def test_call_delta_between_0_and_1(self):
        """Delta of a call must be in (0, 1)."""
        greeks = BlackScholesModel.calculate_greeks(
            self.S, self.K, self.T, self.r, self.sigma
        )
        self.assertGreater(greeks["delta"], 0.0)
        self.assertLess(greeks["delta"], 1.0)

    def test_gamma_positive(self):
        greeks = BlackScholesModel.calculate_greeks(
            self.S, self.K, self.T, self.r, self.sigma
        )
        self.assertGreater(greeks["gamma"], 0.0)


# ─────────────────────────────────────────────────────────────────────────────
# MonteCarloEngine
# ─────────────────────────────────────────────────────────────────────────────

class TestMonteCarloEngine(unittest.TestCase):

    def _engine(self, price=500.0, sigma=0.18, mu=0.0, sims=200, seed=7):
        return MonteCarloEngine(
            current_price=price, sigma=sigma, mu=mu,
            simulations=sims, random_seed=seed,
        )

    def test_simulate_paths_shape(self):
        engine = self._engine()
        paths = engine.simulate_paths(time_steps=30)
        self.assertEqual(paths.shape, (31, 200))

    def test_paths_start_at_current_price(self):
        engine = self._engine(price=400.0)
        paths = engine.simulate_paths(time_steps=10)
        np.testing.assert_array_equal(paths[0], np.full(200, 400.0))

    def test_paths_are_positive(self):
        engine = self._engine()
        paths = engine.simulate_paths(time_steps=60)
        self.assertTrue(np.all(paths > 0))

    def test_calculate_statistics_keys(self):
        engine = self._engine()
        paths = engine.simulate_paths(time_steps=30)
        stats = engine.calculate_statistics(paths)
        for key in ("mean", "std", "p05", "p25", "p50", "p75", "p95", "min", "max"):
            self.assertIn(key, stats)

    def test_statistics_ordering(self):
        engine = self._engine(sims=1000, seed=99)
        paths = engine.simulate_paths(time_steps=30)
        stats = engine.calculate_statistics(paths)
        self.assertLessEqual(stats["min"], stats["p05"])
        self.assertLessEqual(stats["p05"], stats["p25"])
        self.assertLessEqual(stats["p25"], stats["p50"])
        self.assertLessEqual(stats["p50"], stats["p75"])
        self.assertLessEqual(stats["p75"], stats["p95"])
        self.assertLessEqual(stats["p95"], stats["max"])

    def test_reproducibility_with_seed(self):
        paths1 = self._engine().simulate_paths(30)
        paths2 = self._engine().simulate_paths(30)
        np.testing.assert_array_equal(paths1, paths2)


if __name__ == "__main__":
    unittest.main()
