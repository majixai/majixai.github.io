"""
tests/dji_monte_carlo/test_monte_carlo.py

Unit tests for ``dji_monte_carlo/monte_carlo_simulation.py``.

The simulation script executes at import time (module-level code), so
tests reload the module after setting environment variables to exercise
different parameter combinations.

Covers:
- Default parameter values.
- Environment-variable overrides.
- GBM path shape and positivity.
- Statistical sanity checks on the final-price distribution.
"""
import importlib
import importlib.util
import os
import sys
import unittest

import numpy as np

# Explicitly load dji_monte_carlo/monte_carlo_simulation.py by path to avoid
# collisions with sp_monte_carlo/monte_carlo_simulation.py (same module name).
_DJI_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "dji_monte_carlo",
)
_DJI_MODULE_PATH = os.path.join(_DJI_DIR, "monte_carlo_simulation.py")

# We patch plt.savefig and plt.close so the test does not create image files.
from unittest.mock import patch

# ---------------------------------------------------------------------------
# Helper to reload the module with custom env vars and mocked matplotlib
# ---------------------------------------------------------------------------
_ENV_KEYS = ["CURRENT_PRICE", "MINUTES_REMAINING", "SIMULATIONS", "SIGMA", "MU", "RANDOM_SEED"]

_MODULE_NAME = "dji_monte_carlo_simulation"  # unique name to avoid clashes


def _reload_mcs(env: dict | None = None):
    """Load/reload dji_monte_carlo/monte_carlo_simulation.py with given env vars."""
    saved = {k: os.environ.pop(k, None) for k in _ENV_KEYS}
    if env:
        os.environ.update({k: str(v) for k, v in env.items()})
    try:
        with patch("matplotlib.pyplot.savefig"), \
             patch("matplotlib.pyplot.close"), \
             patch("matplotlib.pyplot.tight_layout"), \
             patch("matplotlib.figure.Figure.add_subplot"), \
             patch("matplotlib.pyplot.figure"):
            spec = importlib.util.spec_from_file_location(_MODULE_NAME, _DJI_MODULE_PATH)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[_MODULE_NAME] = mod
            spec.loader.exec_module(mod)
            return mod
    finally:
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v
            else:
                os.environ.pop(k, None)


class TestDjiMonteCarloDefaults(unittest.TestCase):
    """Verify default configuration values."""

    @classmethod
    def setUpClass(cls):
        cls.mcs = _reload_mcs()

    def test_default_current_price(self):
        self.assertAlmostEqual(self.mcs.current_price, 52417.00)

    def test_default_minutes_remaining(self):
        self.assertEqual(self.mcs.minutes_remaining, 207)

    def test_default_simulations(self):
        self.assertEqual(self.mcs.simulations, 5000)

    def test_default_sigma(self):
        self.assertAlmostEqual(self.mcs.sigma, 0.14)

    def test_default_mu(self):
        self.assertAlmostEqual(self.mcs.mu, 0.02)


class TestDjiMonteCarloEnvOverrides(unittest.TestCase):
    """Verify that environment variables override the defaults."""

    def test_custom_current_price(self):
        mcs = _reload_mcs({"CURRENT_PRICE": "40000.00", "RANDOM_SEED": "1"})
        self.assertAlmostEqual(mcs.current_price, 40000.00)

    def test_custom_simulations(self):
        mcs = _reload_mcs({"SIMULATIONS": "100", "RANDOM_SEED": "1"})
        self.assertEqual(mcs.simulations, 100)

    def test_custom_sigma(self):
        mcs = _reload_mcs({"SIGMA": "0.20", "RANDOM_SEED": "1"})
        self.assertAlmostEqual(mcs.sigma, 0.20)


class TestDjiMonteCarloPathStatistics(unittest.TestCase):
    """Statistical sanity checks on the generated GBM paths."""

    @classmethod
    def setUpClass(cls):
        # Use a small, fast configuration for statistics tests
        cls.mcs = _reload_mcs(
            {"CURRENT_PRICE": "50000", "SIMULATIONS": "500",
             "MINUTES_REMAINING": "60", "SIGMA": "0.15",
             "MU": "0.0", "RANDOM_SEED": "42"}
        )

    def test_paths_shape(self):
        """paths has shape (minutes_remaining + 1, simulations)."""
        expected = (self.mcs.minutes_remaining + 1, self.mcs.simulations)
        self.assertEqual(self.mcs.paths.shape, expected)

    def test_paths_start_at_current_price(self):
        """All paths begin at current_price."""
        np.testing.assert_array_equal(
            self.mcs.paths[0],
            np.full(self.mcs.simulations, self.mcs.current_price),
        )

    def test_paths_are_positive(self):
        """GBM paths must never go negative."""
        self.assertTrue(np.all(self.mcs.paths > 0))

    def test_mean_close_near_start(self):
        """With zero drift the mean final price should be close to the start."""
        rel_diff = abs(self.mcs.mean_close - self.mcs.current_price) / self.mcs.current_price
        # Within 5 % for 500 simulations over 60 minutes
        self.assertLess(rel_diff, 0.05)

    def test_percentile_ordering(self):
        """p05 < p25 < mean < p75 < p95."""
        self.assertLess(self.mcs.p05, self.mcs.p25)
        self.assertLess(self.mcs.p25, self.mcs.mean_close)
        self.assertLess(self.mcs.mean_close, self.mcs.p75)
        self.assertLess(self.mcs.p75, self.mcs.p95)

    def test_final_prices_shape(self):
        """final_prices is a 1-D array of length equal to simulations."""
        self.assertEqual(self.mcs.final_prices.shape, (self.mcs.simulations,))


if __name__ == "__main__":
    unittest.main()
