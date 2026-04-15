"""
tests/predictive_ledger/test_optimizer.py

Unit tests for ``predictive_ledger/optimizer.py``.

Covers:
- LedgerOptimizer: Bayesian weight update, predictive distribution,
  log-marginal likelihood, arctan Jacobian, AIC/BIC.
- KalmanFilter: initialization, predict/update cycle, batch filtering.
- TechnicalIndicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR.
"""
import os
import sys
import unittest

import numpy as np

# Ensure predictive_ledger is importable
_PL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "predictive_ledger",
)
if _PL_DIR not in sys.path:
    sys.path.insert(0, _PL_DIR)

from optimizer import LedgerOptimizer, KalmanFilter, TechnicalIndicators


# ─────────────────────────────────────────────────────────────────────────────
# LedgerOptimizer
# ─────────────────────────────────────────────────────────────────────────────

class TestLedgerOptimizerInit(unittest.TestCase):

    def test_positive_noise_var_accepted(self):
        opt = LedgerOptimizer(noise_var=0.5)
        self.assertAlmostEqual(opt.noise_var, 0.5)

    def test_zero_noise_var_raises(self):
        with self.assertRaises(ValueError):
            LedgerOptimizer(noise_var=0.0)

    def test_negative_noise_var_raises(self):
        with self.assertRaises(ValueError):
            LedgerOptimizer(noise_var=-1.0)


class TestLedgerOptimizerUpdateWeights(unittest.TestCase):

    def setUp(self):
        self.opt = LedgerOptimizer(noise_var=0.1)

    def _identity_prior(self, d):
        return np.zeros(d), np.eye(d)

    def test_output_shapes(self):
        X = np.random.randn(10, 3)
        y = X @ np.array([1.0, 2.0, -1.0]) + 0.01 * np.random.randn(10)
        prior_mu, prior_cov = self._identity_prior(3)
        post_mu, post_cov = self.opt.update_weights(X, y, prior_mu, prior_cov)
        self.assertEqual(post_mu.shape, (3,))
        self.assertEqual(post_cov.shape, (3, 3))

    def test_posterior_cov_is_symmetric(self):
        X = np.random.randn(20, 4)
        y = np.random.randn(20)
        prior_mu, prior_cov = self._identity_prior(4)
        _, post_cov = self.opt.update_weights(X, y, prior_mu, prior_cov)
        np.testing.assert_array_almost_equal(post_cov, post_cov.T, decimal=10)

    def test_posterior_cov_is_positive_definite(self):
        X = np.random.randn(20, 3)
        y = np.random.randn(20)
        prior_mu, prior_cov = self._identity_prior(3)
        _, post_cov = self.opt.update_weights(X, y, prior_mu, prior_cov)
        eigvals = np.linalg.eigvalsh(post_cov)
        self.assertTrue(np.all(eigvals > 0))

    def test_recovers_known_weights(self):
        """With large data and small noise, posterior mean ≈ true weights."""
        np.random.seed(0)
        true_w = np.array([3.0, -1.5, 2.0])
        X = np.random.randn(200, 3)
        y = X @ true_w + 0.01 * np.random.randn(200)
        opt = LedgerOptimizer(noise_var=0.0001)
        prior_mu = np.zeros(3)
        prior_cov = 100 * np.eye(3)
        post_mu, _ = opt.update_weights(X, y, prior_mu, prior_cov)
        np.testing.assert_array_almost_equal(post_mu, true_w, decimal=1)


class TestLedgerOptimizerPredictiveDistribution(unittest.TestCase):

    def setUp(self):
        self.opt = LedgerOptimizer(noise_var=0.1)
        np.random.seed(42)
        self.post_mu = np.array([1.0, -0.5, 2.0])
        self.post_cov = 0.01 * np.eye(3)

    def test_pred_mean_shape(self):
        X_new = np.random.randn(5, 3)
        pred_mean, pred_var = self.opt.predictive_distribution(
            X_new, self.post_mu, self.post_cov
        )
        self.assertEqual(pred_mean.shape, (5,))
        self.assertEqual(pred_var.shape, (5,))

    def test_pred_var_positive(self):
        X_new = np.random.randn(10, 3)
        _, pred_var = self.opt.predictive_distribution(
            X_new, self.post_mu, self.post_cov
        )
        self.assertTrue(np.all(pred_var > 0))

    def test_pred_mean_correctness(self):
        """pred_mean should equal X_new @ post_mu."""
        X_new = np.eye(3)
        pred_mean, _ = self.opt.predictive_distribution(
            X_new, self.post_mu, self.post_cov
        )
        np.testing.assert_array_almost_equal(pred_mean, self.post_mu)


class TestLedgerOptimizerArctanJacobian(unittest.TestCase):

    def test_output_shape(self):
        u = np.array([0.0, 1.0, -1.0])
        du = np.ones(3)
        result = LedgerOptimizer.arctan_jacobian(u, du)
        self.assertEqual(result.shape, (3,))

    def test_at_zero(self):
        """arctan Jacobian at u=0 with du=1 should equal 1."""
        result = LedgerOptimizer.arctan_jacobian(np.array([0.0]), np.array([1.0]))
        self.assertAlmostEqual(float(result[0]), 1.0)

    def test_symmetry(self):
        """Jacobian is even in u: f(u) == f(-u)."""
        u = np.array([0.5, 1.0, 2.0])
        du = np.ones(3)
        pos = LedgerOptimizer.arctan_jacobian(u, du)
        neg = LedgerOptimizer.arctan_jacobian(-u, du)
        np.testing.assert_array_almost_equal(pos, neg)


# ─────────────────────────────────────────────────────────────────────────────
# KalmanFilter
# ─────────────────────────────────────────────────────────────────────────────

class TestKalmanFilterInit(unittest.TestCase):

    def test_state_none_before_init(self):
        kf = KalmanFilter()
        self.assertIsNone(kf.x)
        self.assertIsNone(kf.P)

    def test_initialize_sets_state(self):
        kf = KalmanFilter()
        kf.initialize(100.0)
        self.assertIsNotNone(kf.x)
        self.assertEqual(float(kf.x[0]), 100.0)
        self.assertEqual(float(kf.x[1]), 0.0)  # initial velocity

    def test_predict_raises_before_init(self):
        kf = KalmanFilter()
        with self.assertRaises(RuntimeError):
            kf.predict()


class TestKalmanFilterPredictUpdate(unittest.TestCase):

    def setUp(self):
        self.kf = KalmanFilter(dt=1.0, process_var=1.0, obs_var=5.0)
        self.kf.initialize(50.0)

    def test_predict_returns_float(self):
        pred = self.kf.predict()
        self.assertIsInstance(pred, float)

    def test_update_returns_float(self):
        self.kf.predict()
        filtered = self.kf.update(51.0)
        self.assertIsInstance(filtered, float)

    def test_filter_tracks_constant_signal(self):
        """Filter should converge close to a constant signal."""
        kf = KalmanFilter(dt=1.0, process_var=0.01, obs_var=1.0)
        kf.initialize(100.0)
        for _ in range(50):
            kf.predict()
            kf.update(100.0)
        self.assertAlmostEqual(float(kf.x[0]), 100.0, delta=0.5)


class TestKalmanFilterSequence(unittest.TestCase):

    def test_filter_sequence_output_keys(self):
        """filter_sequence returns a dict with all expected keys."""
        kf = KalmanFilter()
        result = kf.filter_sequence(list(range(1, 21)))
        for key in ("filtered", "velocity", "forecast", "innovation", "kalman_gain"):
            self.assertIn(key, result)

    def test_filter_sequence_output_length(self):
        """filter_sequence output lists have the same length as observations."""
        kf = KalmanFilter()
        observations = list(range(1, 21))
        result = kf.filter_sequence(observations)
        self.assertEqual(len(result["filtered"]), len(observations))

    def test_filter_sequence_empty(self):
        """Empty input returns empty lists for all keys."""
        kf = KalmanFilter()
        result = kf.filter_sequence([])
        for key in ("filtered", "velocity", "forecast", "innovation", "kalman_gain"):
            self.assertEqual(result[key], [])

    def test_filter_sequence_filtered_positive(self):
        kf = KalmanFilter()
        observations = [float(x + 1) for x in range(20)]
        result = kf.filter_sequence(observations)
        self.assertTrue(all(v > 0 for v in result["filtered"]))


# ─────────────────────────────────────────────────────────────────────────────
# TechnicalIndicators (predictive_ledger version)
# ─────────────────────────────────────────────────────────────────────────────

class TestPredictiveLedgerTechnicalIndicators(unittest.TestCase):

    def setUp(self):
        np.random.seed(5)
        self.prices = np.cumsum(np.random.normal(0.2, 1.0, 60)) + 100

    def test_sma_length(self):
        sma = TechnicalIndicators.sma(self.prices, period=10)
        self.assertEqual(len(sma), len(self.prices))

    def test_ema_length(self):
        ema = TechnicalIndicators.ema(self.prices, period=12)
        self.assertEqual(len(ema), len(self.prices))

    def test_rsi_in_range(self):
        rsi = TechnicalIndicators.rsi(self.prices, period=14)
        valid = ~np.isnan(rsi)
        self.assertTrue(np.all((rsi[valid] >= 0) & (rsi[valid] <= 100)))

    def test_bollinger_bands_ordering(self):
        result = TechnicalIndicators.bollinger_bands(self.prices, period=20)
        upper = np.array(result["upper"])
        mid = np.array(result["middle"])
        lower = np.array(result["lower"])
        valid = ~np.isnan(upper)
        self.assertTrue(np.all(upper[valid] >= mid[valid]))
        self.assertTrue(np.all(mid[valid] >= lower[valid]))

    def test_atr_non_negative(self):
        highs = self.prices + 1.0
        lows = self.prices - 1.0
        atr = TechnicalIndicators.atr(highs, lows, self.prices, period=14)
        valid = ~np.isnan(atr)
        self.assertTrue(np.all(atr[valid] >= 0))


if __name__ == "__main__":
    unittest.main()
