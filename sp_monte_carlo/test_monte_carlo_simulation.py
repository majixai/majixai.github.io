"""
Tests for S&P 500 Monte Carlo Monday Close Simulation.

Validates the GBM Monte Carlo engine, statistical analysis,
and configuration handling.
"""

import unittest
from unittest.mock import patch
import numpy as np
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestMonteCarloSimulationConfig(unittest.TestCase):
    """Test simulation configuration and environment variable handling."""

    def test_default_parameters(self):
        """Test that default parameters are set correctly when no env vars."""
        import importlib
        # Remove any env overrides to test defaults
        env_keys = ['CURRENT_PRICE', 'MINUTES_REMAINING', 'SIMULATIONS',
                     'SIGMA', 'MU', 'RANDOM_SEED']
        saved = {k: os.environ.pop(k, None) for k in env_keys}
        try:
            import monte_carlo_simulation as mcs
            importlib.reload(mcs)
            self.assertEqual(mcs.current_price, 6025.00)
            self.assertEqual(mcs.minutes_remaining, 390)
            self.assertEqual(mcs.simulations, 5000)
            self.assertAlmostEqual(mcs.sigma, 0.16)
            self.assertAlmostEqual(mcs.mu, 0.03)
        finally:
            for k, v in saved.items():
                if v is not None:
                    os.environ[k] = v

    @patch.dict(os.environ, {'CURRENT_PRICE': '5800.50', 'MINUTES_REMAINING': '200', 'SIMULATIONS': '1000'})
    def test_custom_parameters_via_env(self):
        """Test that environment variables override defaults."""
        import importlib
        import monte_carlo_simulation as mcs
        importlib.reload(mcs)
        self.assertEqual(mcs.current_price, 5800.50)
        self.assertEqual(mcs.minutes_remaining, 200)
        self.assertEqual(mcs.simulations, 1000)


class TestGBMEngine(unittest.TestCase):
    """Test the Geometric Brownian Motion Monte Carlo engine."""

    def setUp(self):
        """Set up test parameters for a small simulation."""
        np.random.seed(42)
        self.current_price = 6025.00
        self.minutes_remaining = 10
        self.simulations = 100
        self.sigma = 0.16
        self.mu = 0.03
        self.dt = 1 / (252 * 390)

    def _run_simulation(self):
        """Run a small Monte Carlo simulation and return paths."""
        paths = np.zeros((self.minutes_remaining + 1, self.simulations))
        paths[0] = self.current_price
        for t in range(1, self.minutes_remaining + 1):
            Z = np.random.standard_normal(self.simulations)
            paths[t] = paths[t-1] * np.exp(
                (self.mu - 0.5 * self.sigma**2) * self.dt
                + self.sigma * np.sqrt(self.dt) * Z
            )
        return paths

    def test_paths_shape(self):
        """Test that simulation paths have correct dimensions."""
        paths = self._run_simulation()
        self.assertEqual(paths.shape, (self.minutes_remaining + 1, self.simulations))

    def test_paths_start_at_current_price(self):
        """Test that all paths start at the current price."""
        paths = self._run_simulation()
        np.testing.assert_array_equal(paths[0], self.current_price)

    def test_paths_are_positive(self):
        """Test that GBM produces only positive prices."""
        paths = self._run_simulation()
        self.assertTrue(np.all(paths > 0))

    def test_mean_close_near_start(self):
        """Test that mean close is reasonable relative to start price."""
        paths = self._run_simulation()
        final_prices = paths[-1]
        mean_close = np.mean(final_prices)
        # Over 10 minutes, price shouldn't move more than ~1%
        self.assertAlmostEqual(mean_close / self.current_price, 1.0, places=1)

    def test_reproducibility_with_seed(self):
        """Test that fixed seed produces identical results."""
        np.random.seed(42)
        paths1 = self._run_simulation()
        np.random.seed(42)
        paths2 = self._run_simulation()
        np.testing.assert_array_equal(paths1, paths2)

    def test_different_seeds_produce_different_results(self):
        """Test that different seeds produce different paths."""
        np.random.seed(42)
        paths1 = self._run_simulation()
        np.random.seed(99)
        paths2 = self._run_simulation()
        self.assertFalse(np.array_equal(paths1, paths2))


class TestStatisticalAnalysis(unittest.TestCase):
    """Test statistical analysis of simulation results."""

    def setUp(self):
        """Run a simulation for statistical tests."""
        np.random.seed(42)
        self.current_price = 6025.00
        minutes_remaining = 390
        simulations = 1000
        sigma = 0.16
        mu = 0.03
        dt = 1 / (252 * 390)

        paths = np.zeros((minutes_remaining + 1, simulations))
        paths[0] = self.current_price
        for t in range(1, minutes_remaining + 1):
            Z = np.random.standard_normal(simulations)
            paths[t] = paths[t-1] * np.exp(
                (mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * Z
            )
        self.final_prices = paths[-1]

    def test_percentile_ordering(self):
        """Test that percentiles are in correct order."""
        p05 = np.percentile(self.final_prices, 5)
        p25 = np.percentile(self.final_prices, 25)
        p50 = np.percentile(self.final_prices, 50)
        p75 = np.percentile(self.final_prices, 75)
        p95 = np.percentile(self.final_prices, 95)
        self.assertLess(p05, p25)
        self.assertLess(p25, p50)
        self.assertLess(p50, p75)
        self.assertLess(p75, p95)

    def test_mean_within_reasonable_range(self):
        """Test that mean close is within 5% of start price for a single day."""
        mean_close = np.mean(self.final_prices)
        pct_change = abs(mean_close - self.current_price) / self.current_price
        self.assertLess(pct_change, 0.05)

    def test_all_final_prices_positive(self):
        """Test that all final simulated prices are positive."""
        self.assertTrue(np.all(self.final_prices > 0))

    def test_volatility_range(self):
        """Test that 90% confidence interval is reasonable."""
        p05 = np.percentile(self.final_prices, 5)
        p95 = np.percentile(self.final_prices, 95)
        range_pct = (p95 - p05) / self.current_price
        # 90% range should be between 0.1% and 10% for a single day
        self.assertGreater(range_pct, 0.001)
        self.assertLess(range_pct, 0.10)


if __name__ == "__main__":
    unittest.main()
