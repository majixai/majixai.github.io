"""
Unit tests for the Bayesian EKF module.

All tests are self-contained (no network I/O, no file I/O by default).
"""

import math
import os
import sys
import tempfile
import unittest

import numpy as np
import pandas as pd

# Add parent directory to path for imports when run directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.bayesian_ekf import ExtendedKalmanFilter, _symmetrise
from models.ekf_runner import (
    EKFRunner,
    _compact_states,
    _extract_close,
    _json_default,
    _read_dat,
    _write_dat,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_price_series(n: int = 120, seed: int = 42) -> np.ndarray:
    """Generate a simple random-walk close-price series."""
    rng = np.random.default_rng(seed)
    returns = rng.normal(0.0005, 0.01, n)
    prices = 100.0 * np.exp(np.cumsum(returns))
    return prices


def _make_ekf(P_ref: float = 0.0) -> ExtendedKalmanFilter:
    """Return a default EKF instance."""
    return ExtendedKalmanFilter(
        mu=0.0005,
        kappa=2.0,
        theta_v=1e-4,
        sigma_v=0.3,
        dt=1.0,
        P_ref=P_ref,
        R=1e-4,
    )


# ---------------------------------------------------------------------------
# Tests: ExtendedKalmanFilter
# ---------------------------------------------------------------------------


class TestEKFInit(unittest.TestCase):
    def test_default_state_shape(self):
        ekf = _make_ekf()
        self.assertEqual(ekf.x.shape, (3,))
        self.assertEqual(ekf.P_cov.shape, (3, 3))
        self.assertEqual(ekf.Q.shape, (3, 3))
        self.assertEqual(ekf.H.shape, (1, 3))

    def test_H_is_observation_of_P(self):
        ekf = _make_ekf()
        # H = [1, 0, 0] so it picks out the log-price component
        x = np.array([4.6, 1e-4, 0.1])
        self.assertAlmostEqual(float(ekf.H @ x), 4.6)

    def test_custom_x0(self):
        ekf = ExtendedKalmanFilter(x0=[1.0, 2e-4, 0.5])
        np.testing.assert_array_almost_equal(ekf.x, [1.0, 2e-4, 0.5])

    def test_volatility_floor_in_init(self):
        ekf = ExtendedKalmanFilter(theta_v=0.0)
        # theta_v=0 → Q diagonal should stay non-negative
        self.assertTrue(np.all(np.diag(ekf.Q) >= 0))


class TestProcessModel(unittest.TestCase):
    def test_output_shape(self):
        ekf = _make_ekf()
        x_new = ekf.process_model(ekf.x)
        self.assertEqual(x_new.shape, (3,))

    def test_P_advances_by_mu(self):
        ekf = ExtendedKalmanFilter(mu=0.001, kappa=0.0, dt=1.0, x0=[4.0, 1e-4, 0.0])
        x_new = ekf.process_model(ekf.x)
        self.assertAlmostEqual(x_new[0], 4.0 + 0.001)

    def test_V_mean_reverts(self):
        """When V < theta_v the process model should push V upward."""
        theta_v = 1e-3
        ekf = ExtendedKalmanFilter(kappa=5.0, theta_v=theta_v, dt=1.0, x0=[0.0, 1e-4, 0.0])
        x_new = ekf.process_model(ekf.x)
        self.assertGreater(x_new[1], ekf.x[1])  # V increased toward theta_v

    def test_V_stays_positive(self):
        """Volatility must never go negative."""
        ekf = ExtendedKalmanFilter(kappa=1000.0, theta_v=0.0, dt=1.0, x0=[0.0, 1e-6, 0.0])
        x_new = ekf.process_model(ekf.x)
        self.assertGreater(x_new[1], 0.0)

    def test_theta_bounded_by_arctan(self):
        """Θ increment = arctan(P - P_ref) * dt, bounded to (-π/2, π/2) per step."""
        ekf = ExtendedKalmanFilter(P_ref=0.0, dt=1.0, x0=[1e6, 1e-4, 0.0])
        x_new = ekf.process_model(ekf.x)
        # arctan(large number) ≈ π/2; Θ_new ≤ Θ_old + π/2
        theta_increment = x_new[2] - ekf.x[2]
        self.assertLessEqual(abs(theta_increment), math.pi / 2 + 1e-9)


class TestJacobianF(unittest.TestCase):
    def test_shape(self):
        ekf = _make_ekf()
        F = ekf.jacobian_F(ekf.x)
        self.assertEqual(F.shape, (3, 3))

    def test_top_row(self):
        """∂P_new/∂x = [1, 0, 0]"""
        ekf = _make_ekf()
        F = ekf.jacobian_F(ekf.x)
        np.testing.assert_array_almost_equal(F[0], [1.0, 0.0, 0.0])

    def test_V_row(self):
        """∂V_new/∂x = [0, 1-κ·dt, 0]"""
        ekf = ExtendedKalmanFilter(kappa=2.0, dt=0.5)
        F = ekf.jacobian_F(ekf.x)
        expected_dV_dV = 1.0 - 2.0 * 0.5
        self.assertAlmostEqual(F[1, 1], expected_dV_dV)
        self.assertAlmostEqual(F[1, 0], 0.0)
        self.assertAlmostEqual(F[1, 2], 0.0)

    def test_theta_row_diagonal_term(self):
        """∂Θ_new/∂Θ = 1"""
        ekf = _make_ekf()
        F = ekf.jacobian_F(ekf.x)
        self.assertAlmostEqual(F[2, 2], 1.0)

    def test_theta_P_derivative(self):
        """∂Θ_new/∂P = dt / (1 + (P-P_ref)²)"""
        P_ref = 4.0
        dt = 1.0
        P = 4.5
        ekf = ExtendedKalmanFilter(P_ref=P_ref, dt=dt, x0=[P, 1e-4, 0.0])
        F = ekf.jacobian_F(ekf.x)
        expected = dt / (1.0 + (P - P_ref) ** 2)
        self.assertAlmostEqual(F[2, 0], expected, places=10)

    def test_numerical_jacobian(self):
        """Compare analytic Jacobian against finite-difference approximation."""
        ekf = ExtendedKalmanFilter(mu=0.001, kappa=1.5, theta_v=2e-4, P_ref=4.6, dt=1.0,
                                   x0=[4.6, 2e-4, 0.2])
        x0 = ekf.x.copy()
        eps = 1e-6
        F_analytic = ekf.jacobian_F(x0)
        F_numeric = np.zeros((3, 3))
        f0 = ekf.process_model(x0)
        for j in range(3):
            x_eps = x0.copy()
            x_eps[j] += eps
            F_numeric[:, j] = (ekf.process_model(x_eps) - f0) / eps
        np.testing.assert_allclose(F_analytic, F_numeric, atol=1e-5)


class TestPredictUpdate(unittest.TestCase):
    def test_predict_returns_shapes(self):
        ekf = _make_ekf()
        x_prior, P_prior = ekf.predict()
        self.assertEqual(x_prior.shape, (3,))
        self.assertEqual(P_prior.shape, (3, 3))

    def test_covariance_grows_after_predict(self):
        """P_prior trace ≥ P_post trace (uncertainty increases without observation)."""
        ekf = _make_ekf()
        trace_before = np.trace(ekf.P_cov)
        _, P_prior = ekf.predict()
        self.assertGreaterEqual(np.trace(P_prior), trace_before - 1e-12)

    def test_update_reduces_uncertainty(self):
        """After a perfect observation, covariance trace should decrease."""
        ekf = _make_ekf()
        ekf.predict()
        P_after_predict = np.trace(ekf.P_cov)
        ekf.update(z_observed=ekf.x[0])  # observe exactly the predicted P
        P_after_update = np.trace(ekf.P_cov)
        self.assertLess(P_after_update, P_after_predict)

    def test_covariance_stays_symmetric(self):
        ekf = _make_ekf()
        for _ in range(20):
            ekf.predict()
            ekf.update(z_observed=float(ekf.x[0]) + 0.001)
        off_diag = ekf.P_cov - ekf.P_cov.T
        self.assertAlmostEqual(float(np.max(np.abs(off_diag))), 0.0, places=10)

    def test_covariance_stays_positive_definite(self):
        ekf = _make_ekf()
        for _ in range(50):
            ekf.predict()
            ekf.update(z_observed=float(ekf.x[0]) + np.random.normal(0, 0.01))
        eigenvalues = np.linalg.eigvalsh(ekf.P_cov)
        self.assertTrue(np.all(eigenvalues > 0))

    def test_volatility_stays_positive(self):
        ekf = _make_ekf()
        for z in np.random.default_rng(0).normal(4.6, 0.01, 100):
            ekf.predict()
            ekf.update(z_observed=float(z))
        self.assertGreater(float(ekf.x[1]), 0.0)

    def test_innovation_sign(self):
        """Positive observation surplus → positive innovation."""
        ekf = _make_ekf(P_ref=0.0)
        ekf.x = np.array([4.0, 1e-4, 0.0])
        ekf.predict()
        _, _, innovation = ekf.update(z_observed=5.0)
        self.assertGreater(innovation, 0.0)


class TestStep(unittest.TestCase):
    def test_step_returns_dict_keys(self):
        ekf = _make_ekf()
        result = ekf.step(z_observed=4.6)
        for key in ("log_price", "volatility", "momentum_angle",
                    "innovation", "P_trace", "x_posterior"):
            self.assertIn(key, result)

    def test_step_x_posterior_length(self):
        ekf = _make_ekf()
        result = ekf.step(z_observed=4.6)
        self.assertEqual(len(result["x_posterior"]), 3)


class TestBatchFilter(unittest.TestCase):
    def test_length(self):
        ekf = _make_ekf(P_ref=np.log(100.0))
        prices = _make_price_series(60)
        log_p = np.log(prices)
        results = ekf.batch_filter(log_p)
        self.assertEqual(len(results), 60)

    def test_all_volatilities_positive(self):
        ekf = _make_ekf(P_ref=np.log(100.0))
        prices = _make_price_series(60)
        log_p = np.log(prices)
        results = ekf.batch_filter(log_p)
        for r in results:
            self.assertGreater(r["volatility"], 0.0)

    def test_momentum_bounded(self):
        """
        Accumulated Θ over 120 observations should stay within a finite range.
        (Not a strict bound, but a sanity check for runaway accumulation.)
        """
        ekf = _make_ekf(P_ref=np.log(100.0))
        prices = _make_price_series(120)
        log_p = np.log(prices)
        results = ekf.batch_filter(log_p)
        final_theta = abs(results[-1]["momentum_angle"])
        self.assertLess(final_theta, 1e4)  # Very generous; catches explosions


class TestPredictNext(unittest.TestCase):
    def test_length(self):
        ekf = _make_ekf()
        forecasts = ekf.predict_next(n_steps=5)
        self.assertEqual(len(forecasts), 5)

    def test_does_not_mutate_state(self):
        ekf = _make_ekf()
        x_before = ekf.x.copy()
        P_before = ekf.P_cov.copy()
        ekf.predict_next(n_steps=10)
        np.testing.assert_array_equal(ekf.x, x_before)
        np.testing.assert_array_equal(ekf.P_cov, P_before)

    def test_uncertainty_grows_over_horizon(self):
        """P_trace should be non-decreasing across the forecast horizon."""
        ekf = _make_ekf()
        forecasts = ekf.predict_next(n_steps=10)
        traces = [fc["P_trace"] for fc in forecasts]
        for i in range(len(traces) - 1):
            self.assertLessEqual(traces[i], traces[i + 1] + 1e-12)


class TestSymmetrise(unittest.TestCase):
    def test_result_is_symmetric(self):
        M = np.array([[1.0, 2.0], [3.0, 4.0]])
        S = _symmetrise(M)
        np.testing.assert_array_almost_equal(S, S.T)


# ---------------------------------------------------------------------------
# Tests: EKFRunner
# ---------------------------------------------------------------------------


class TestExtractClose(unittest.TestCase):
    def test_capital_Close(self):
        df = pd.DataFrame({"Close": [100.0, 101.0]})
        arr = _extract_close(df)
        np.testing.assert_array_almost_equal(arr, [100.0, 101.0])

    def test_lowercase_close(self):
        df = pd.DataFrame({"close": [200.0, 201.0]})
        arr = _extract_close(df)
        self.assertIsNotNone(arr)

    def test_adj_close(self):
        df = pd.DataFrame({"Adj Close": [50.0, 51.0]})
        arr = _extract_close(df)
        self.assertIsNotNone(arr)

    def test_missing_column(self):
        df = pd.DataFrame({"Open": [100.0], "High": [102.0]})
        arr = _extract_close(df)
        self.assertIsNone(arr)

    def test_all_nan(self):
        df = pd.DataFrame({"Close": [float("nan"), float("nan")]})
        arr = _extract_close(df)
        # dropna removes all rows → length 0 → returns None
        self.assertIsNone(arr)


class TestCompactStates(unittest.TestCase):
    def test_removes_x_posterior(self):
        states = [
            {
                "log_price": 4.6,
                "volatility": 1e-4,
                "momentum_angle": 0.1,
                "innovation": 0.001,
                "P_trace": 0.05,
                "x_posterior": [4.6, 1e-4, 0.1],
            }
        ]
        compact = _compact_states(states)
        self.assertNotIn("x_posterior", compact[0])
        self.assertIn("log_price", compact[0])

    def test_length_preserved(self):
        states = [{"log_price": i, "volatility": 1e-4, "momentum_angle": 0.0,
                   "innovation": 0.0, "P_trace": 0.01} for i in range(10)]
        self.assertEqual(len(_compact_states(states)), 10)


class TestJsonDefault(unittest.TestCase):
    def test_numpy_int(self):
        self.assertEqual(_json_default(np.int64(7)), 7)

    def test_numpy_float(self):
        self.assertAlmostEqual(_json_default(np.float32(3.14)), 3.14, places=5)

    def test_numpy_array(self):
        result = _json_default(np.array([1.0, 2.0]))
        self.assertEqual(result, [1.0, 2.0])

    def test_unsupported_raises(self):
        with self.assertRaises(TypeError):
            _json_default(object())


class TestDatIO(unittest.TestCase):
    def test_round_trip(self):
        payload = {"ticker": "TEST", "values": [1.0, 2.0, 3.0], "n": 42}
        with tempfile.NamedTemporaryFile(suffix=".dat", delete=False) as tmp:
            path = tmp.name
        try:
            _write_dat(path, payload)
            loaded = _read_dat(path)
            self.assertEqual(loaded["ticker"], "TEST")
            self.assertEqual(loaded["values"], [1.0, 2.0, 3.0])
            self.assertEqual(loaded["n"], 42)
        finally:
            if os.path.exists(path):
                os.remove(path)

    def test_missing_file_raises(self):
        with self.assertRaises(FileNotFoundError):
            _read_dat("/tmp/__nonexistent_ekf_test__.dat")


class TestEKFRunnerForTicker(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.runner = EKFRunner(data_dir=self.tmpdir, forecast_days=3)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _make_df(self, n: int = 50, seed: int = 0) -> pd.DataFrame:
        prices = _make_price_series(n, seed)
        return pd.DataFrame({"Close": prices})

    def test_returns_dict_with_expected_keys(self):
        df = self._make_df()
        result = self.runner.run_for_ticker("AAPL", df)
        self.assertTrue(result)
        for key in ("ticker", "last_close", "predicted_close",
                    "predicted_return_pct", "filtered_volatility",
                    "filtered_momentum_angle", "posterior_cov_trace",
                    "forecast_horizon_days", "n_observations", "filtered_at",
                    "forecasts", "filtered_states"):
            self.assertIn(key, result, f"Missing key: {key}")

    def test_ticker_name_preserved(self):
        df = self._make_df()
        result = self.runner.run_for_ticker("MSFT", df)
        self.assertEqual(result["ticker"], "MSFT")

    def test_forecast_length(self):
        df = self._make_df()
        result = self.runner.run_for_ticker("X", df)
        self.assertEqual(len(result["forecasts"]), 3)

    def test_n_observations(self):
        df = self._make_df(n=80)
        result = self.runner.run_for_ticker("X", df)
        self.assertEqual(result["n_observations"], 80)

    def test_dat_files_created(self):
        df = self._make_df()
        result = self.runner.run_for_ticker("TSLA", df)
        self.assertTrue(os.path.exists(result["states_dat"]))
        self.assertTrue(os.path.exists(result["predictions_dat"]))

    def test_load_predictions_round_trip(self):
        df = self._make_df()
        result = self.runner.run_for_ticker("GOOG", df)
        pred = self.runner.load_predictions("GOOG")
        self.assertAlmostEqual(pred["predicted_close"], result["predicted_close"], places=4)

    def test_insufficient_data_returns_empty(self):
        df = pd.DataFrame({"Close": [100.0, 101.0]})
        result = self.runner.run_for_ticker("X", df)
        self.assertEqual(result, {})

    def test_lowercase_close_column(self):
        prices = _make_price_series(50)
        df = pd.DataFrame({"close": prices})
        result = self.runner.run_for_ticker("X", df)
        self.assertTrue(result)


class TestEKFRunnerBatch(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.runner = EKFRunner(data_dir=self.tmpdir, forecast_days=2)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_batch_returns_all_tickers(self):
        data = {
            "AAPL": pd.DataFrame({"Close": _make_price_series(60, 1)}),
            "MSFT": pd.DataFrame({"Close": _make_price_series(60, 2)}),
            "TSLA": pd.DataFrame({"Close": _make_price_series(60, 3)}),
        }
        results = self.runner.run_batch(data)
        self.assertEqual(set(results.keys()), {"AAPL", "MSFT", "TSLA"})

    def test_bad_ticker_skipped(self):
        data = {
            "GOOD": pd.DataFrame({"Close": _make_price_series(60)}),
            "BAD": pd.DataFrame({"NotClose": [1.0, 2.0]}),
        }
        results = self.runner.run_batch(data)
        self.assertIn("GOOD", results)
        self.assertNotIn("BAD", results)


if __name__ == "__main__":
    unittest.main()
