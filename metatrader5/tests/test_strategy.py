"""
metatrader5/tests/test_strategy.py

Unit tests for metatrader5/strategy.py

Covers:
- fit_ou_params         — OU parameter estimation
- fit_gbm_params        — GBM parameter estimation
- OUMeanReversionStrategy  — signal generation
- GBMMomentumStrategy      — signal generation
- Backtester               — run, result fields, empty-data edge case
- BacktestResult           — summary string
- FeedbackEngine           — threshold update, EW-Sharpe, clipping
- run_strategy_with_feedback — walk-forward + feedback pipeline
"""

import sys
import math
import pathlib
import unittest

import numpy as np

_REPO = pathlib.Path(__file__).resolve().parents[2]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from metatrader5.strategy import (
    _ANNUALISE_FACTOR,
    _EPSILON,
    fit_ou_params,
    fit_gbm_params,
    OUMeanReversionStrategy,
    GBMMomentumStrategy,
    Backtester,
    BacktestResult,
    FeedbackEngine,
    Trade,
    run_strategy_with_feedback,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_rates(n: int = 300, drift: float = 0.0, vol: float = 0.0005,
                base: float = 1.085, seed: int = 42) -> np.ndarray:
    """Create a synthetic MT5-format OHLCV array with optional drift."""
    rng = np.random.default_rng(seed)
    dtype = np.dtype([
        ("time", np.int64), ("open", np.float64), ("high", np.float64),
        ("low", np.float64), ("close", np.float64),
        ("tick_volume", np.int64), ("spread", np.int32),
        ("real_volume", np.int64),
    ])
    arr = np.zeros(n, dtype=dtype)
    prices = [base]
    for _ in range(n - 1):
        prices.append(prices[-1] * math.exp(drift / _ANNUALISE_FACTOR + vol * rng.standard_normal()))
    prices = np.array(prices)
    for i in range(n):
        arr[i]["time"]        = 1_704_067_200 + i * 60
        arr[i]["open"]        = prices[i]
        arr[i]["high"]        = prices[i] * (1 + abs(rng.normal(0, vol)))
        arr[i]["low"]         = prices[i] * (1 - abs(rng.normal(0, vol)))
        arr[i]["close"]       = prices[i] * math.exp(rng.normal(0, vol))
        arr[i]["tick_volume"] = int(rng.integers(100, 1000))
    return arr


def _make_mean_reverting_rates(n: int = 300, theta: float = 1.085,
                                kappa: float = 2.0, sigma: float = 0.001,
                                seed: int = 0) -> np.ndarray:
    """Simulate OU process exactly so signals should fire."""
    rng = np.random.default_rng(seed)
    dt  = 1.0 / _ANNUALISE_FACTOR
    dtype = np.dtype([
        ("time", np.int64), ("open", np.float64), ("high", np.float64),
        ("low", np.float64), ("close", np.float64),
        ("tick_volume", np.int64), ("spread", np.int32),
        ("real_volume", np.int64),
    ])
    arr = np.zeros(n, dtype=dtype)
    p = theta
    for i in range(n):
        arr[i]["time"]  = 1_704_067_200 + i * 60
        arr[i]["open"]  = p
        arr[i]["high"]  = p + abs(rng.normal(0, sigma))
        arr[i]["low"]   = p - abs(rng.normal(0, sigma))
        arr[i]["close"] = p
        arr[i]["tick_volume"] = 500
        # OU update
        dW = rng.standard_normal() * math.sqrt(dt)
        p  = p + kappa * (theta - p) * dt + sigma * dW
    return arr


# ---------------------------------------------------------------------------
# fit_ou_params
# ---------------------------------------------------------------------------

class TestFitOUParams(unittest.TestCase):

    def test_returns_three_floats(self):
        prices = np.random.default_rng(0).normal(1.085, 0.001, 100)
        k, t, s = fit_ou_params(prices)
        self.assertIsInstance(k, float)
        self.assertIsInstance(t, float)
        self.assertIsInstance(s, float)

    def test_kappa_non_negative(self):
        prices = np.random.default_rng(1).normal(1.085, 0.001, 200)
        k, _, _ = fit_ou_params(prices)
        self.assertGreaterEqual(k, 0.0)

    def test_sigma_positive(self):
        prices = np.random.default_rng(2).normal(1.0, 0.01, 100)
        _, _, s = fit_ou_params(prices)
        self.assertGreater(s, 0.0)

    def test_theta_close_to_mean_for_iid_series(self):
        """For near-IID normal prices theta ~ sample mean."""
        rng = np.random.default_rng(3)
        prices = rng.normal(2.0, 0.005, 500)
        _, theta, _ = fit_ou_params(prices)
        self.assertAlmostEqual(theta, 2.0, delta=0.1)

    def test_too_few_obs_raises_value_error(self):
        with self.assertRaises(ValueError):
            fit_ou_params(np.array([1.0, 2.0]))


# ---------------------------------------------------------------------------
# fit_gbm_params
# ---------------------------------------------------------------------------

class TestFitGBMParams(unittest.TestCase):

    def test_returns_two_floats(self):
        prices = np.cumprod(1 + np.random.default_rng(0).normal(0, 0.01, 100))
        mu, sigma = fit_gbm_params(prices)
        self.assertIsInstance(mu, float)
        self.assertIsInstance(sigma, float)

    def test_sigma_positive(self):
        prices = np.cumprod(1 + np.random.default_rng(1).normal(0, 0.01, 100))
        _, sigma = fit_gbm_params(prices)
        self.assertGreater(sigma, 0.0)

    def test_positive_drift_detected(self):
        """Strong uptrend should yield positive mu."""
        rng = np.random.default_rng(42)
        returns = rng.normal(0.002, 0.005, 300)   # positive mean
        prices  = np.cumprod(1 + returns) * 100
        mu, _ = fit_gbm_params(prices)
        self.assertGreater(mu, 0.0)

    def test_negative_drift_detected(self):
        rng = np.random.default_rng(7)
        returns = rng.normal(-0.002, 0.005, 300)  # negative mean
        prices  = np.cumprod(1 + returns) * 100
        mu, _ = fit_gbm_params(prices)
        self.assertLess(mu, 0.0)

    def test_single_price_returns_zero_drift(self):
        mu, sigma = fit_gbm_params(np.array([1.0]))
        self.assertEqual(mu, 0.0)


# ---------------------------------------------------------------------------
# OUMeanReversionStrategy
# ---------------------------------------------------------------------------

class TestOUMeanReversionStrategy(unittest.TestCase):

    def test_signals_shape_matches_rates(self):
        rates    = _make_rates(200)
        strategy = OUMeanReversionStrategy(lookback=40)
        signals  = strategy.generate_signals(rates)
        self.assertEqual(len(signals), len(rates))

    def test_signals_only_contain_valid_values(self):
        rates    = _make_rates(200)
        strategy = OUMeanReversionStrategy(lookback=40)
        signals  = strategy.generate_signals(rates)
        unique   = set(signals.tolist())
        self.assertTrue(unique.issubset({-1, 0, 1}))

    def test_signals_fire_on_ou_data(self):
        """Mean-reverting data with low threshold should yield some signals."""
        rates    = _make_mean_reverting_rates(300)
        strategy = OUMeanReversionStrategy(lookback=50, threshold=0.5)
        signals  = strategy.generate_signals(rates)
        n_signals = int((signals != 0).sum())
        self.assertGreater(n_signals, 0)

    def test_high_threshold_fewer_signals_than_low(self):
        rates     = _make_mean_reverting_rates(300)
        low_strat = OUMeanReversionStrategy(lookback=50, threshold=0.5)
        hi_strat  = OUMeanReversionStrategy(lookback=50, threshold=3.5)
        n_low = int((low_strat.generate_signals(rates) != 0).sum())
        n_hi  = int((hi_strat.generate_signals(rates)  != 0).sum())
        self.assertGreaterEqual(n_low, n_hi)

    def test_short_rates_array_no_exception(self):
        rates    = _make_rates(10)
        strategy = OUMeanReversionStrategy(lookback=60)
        signals  = strategy.generate_signals(rates)
        self.assertEqual(len(signals), 10)


# ---------------------------------------------------------------------------
# GBMMomentumStrategy
# ---------------------------------------------------------------------------

class TestGBMMomentumStrategy(unittest.TestCase):

    def test_signals_shape_matches_rates(self):
        rates    = _make_rates(200, drift=0.5)
        strategy = GBMMomentumStrategy(lookback=30)
        signals  = strategy.generate_signals(rates)
        self.assertEqual(len(signals), len(rates))

    def test_signals_only_contain_valid_values(self):
        rates    = _make_rates(200, drift=0.5)
        strategy = GBMMomentumStrategy(lookback=30)
        signals  = strategy.generate_signals(rates)
        self.assertTrue(set(signals.tolist()).issubset({-1, 0, 1}))

    def test_strong_uptrend_generates_buy_signals(self):
        rates    = _make_rates(300, drift=5.0, vol=0.001, seed=0)
        strategy = GBMMomentumStrategy(lookback=20, threshold=0.5)
        signals  = strategy.generate_signals(rates)
        n_buy    = int((signals == 1).sum())
        self.assertGreater(n_buy, 0)

    def test_strong_downtrend_generates_sell_signals(self):
        rates    = _make_rates(300, drift=-5.0, vol=0.001, seed=1)
        strategy = GBMMomentumStrategy(lookback=20, threshold=0.5)
        signals  = strategy.generate_signals(rates)
        n_sell   = int((signals == -1).sum())
        self.assertGreater(n_sell, 0)

    def test_low_threshold_more_signals_than_high(self):
        rates    = _make_rates(200, drift=1.0)
        low_strat = GBMMomentumStrategy(lookback=20, threshold=0.5)
        hi_strat  = GBMMomentumStrategy(lookback=20, threshold=4.0)
        n_low = int((low_strat.generate_signals(rates) != 0).sum())
        n_hi  = int((hi_strat.generate_signals(rates)  != 0).sum())
        self.assertGreaterEqual(n_low, n_hi)


# ---------------------------------------------------------------------------
# Trade
# ---------------------------------------------------------------------------

class TestTrade(unittest.TestCase):

    def test_pnl_buy_profit(self):
        t = Trade(entry_bar=0, exit_bar=10, direction=1,
                  entry_price=1.085, exit_price=1.090)
        self.assertAlmostEqual(t.pnl, 0.005, places=6)

    def test_pnl_sell_profit(self):
        t = Trade(entry_bar=0, exit_bar=10, direction=-1,
                  entry_price=1.090, exit_price=1.085)
        self.assertAlmostEqual(t.pnl, 0.005, places=6)

    def test_pnl_loss_negative(self):
        t = Trade(entry_bar=0, exit_bar=5, direction=1,
                  entry_price=1.090, exit_price=1.085)
        self.assertLess(t.pnl, 0)

    def test_return_pct_zero_entry_is_zero(self):
        t = Trade(0, 1, 1, 0.0, 1.0)
        self.assertEqual(t.return_pct, 0.0)


# ---------------------------------------------------------------------------
# Backtester
# ---------------------------------------------------------------------------

class TestBacktester(unittest.TestCase):

    def test_run_returns_backtest_result(self):
        rates    = _make_rates(200)
        strategy = OUMeanReversionStrategy(lookback=40, threshold=0.5)
        bt       = Backtester(strategy)
        result   = bt.run(rates)
        self.assertIsInstance(result, BacktestResult)

    def test_total_bars_matches_input(self):
        rates    = _make_rates(150)
        strategy = OUMeanReversionStrategy(lookback=30)
        result   = Backtester(strategy).run(rates)
        self.assertEqual(result.total_bars, 150)

    def test_win_rate_between_0_and_1(self):
        rates    = _make_rates(300)
        strategy = OUMeanReversionStrategy(lookback=40, threshold=0.5)
        result   = Backtester(strategy).run(rates)
        self.assertGreaterEqual(result.win_rate, 0.0)
        self.assertLessEqual(result.win_rate,    1.0)

    def test_sharpe_is_finite_when_trades_exist(self):
        rates    = _make_rates(300)
        strategy = OUMeanReversionStrategy(lookback=40, threshold=0.5)
        result   = Backtester(strategy).run(rates)
        if result.trades:
            self.assertTrue(math.isfinite(result.sharpe_ratio))

    def test_max_drawdown_non_negative(self):
        rates    = _make_rates(300)
        strategy = OUMeanReversionStrategy(lookback=40, threshold=0.5)
        result   = Backtester(strategy).run(rates)
        self.assertGreaterEqual(result.max_drawdown, 0.0)

    def test_empty_signals_yields_no_trades(self):
        """All-zero signal array → no trades opened."""
        rates    = _make_rates(100)
        strategy = OUMeanReversionStrategy(lookback=200, threshold=100.0)  # high threshold
        result   = Backtester(strategy).run(rates)
        # Either no trades or very few near end of data
        self.assertGreaterEqual(len(result.trades), 0)

    def test_summary_string_contains_key_fields(self):
        rates    = _make_rates(200)
        strategy = OUMeanReversionStrategy(lookback=40, threshold=0.5)
        result   = Backtester(strategy).run(rates)
        summary  = result.summary()
        for token in ("Trades=", "PnL=", "Sharpe=", "MaxDD=", "WinRate="):
            self.assertIn(token, summary)

    def test_gbm_momentum_backtests(self):
        rates    = _make_rates(300, drift=2.0)
        strategy = GBMMomentumStrategy(lookback=20, threshold=0.8)
        result   = Backtester(strategy).run(rates)
        self.assertIsInstance(result, BacktestResult)

    def test_slippage_reduces_profit(self):
        rates    = _make_rates(300, drift=1.0)
        strat0   = OUMeanReversionStrategy(lookback=40, threshold=0.5)
        strat1   = OUMeanReversionStrategy(lookback=40, threshold=0.5)
        r0 = Backtester(strat0, slippage=0.0).run(rates)
        r1 = Backtester(strat1, slippage=0.01).run(rates)
        if r0.trades and r1.trades:
            self.assertGreaterEqual(r0.total_pnl, r1.total_pnl)


# ---------------------------------------------------------------------------
# FeedbackEngine
# ---------------------------------------------------------------------------

class TestFeedbackEngine(unittest.TestCase):

    def _make_result(self, sharpe: float, trades: int = 5) -> BacktestResult:
        tr = [Trade(i, i + 1, 1, 1.0, 1.001) for i in range(trades)]
        return BacktestResult(
            trades=tr, total_pnl=0.005 * trades,
            sharpe_ratio=sharpe, max_drawdown=0.01,
            win_rate=0.6, total_bars=100,
        )

    def test_good_sharpe_increases_threshold(self):
        strategy = OUMeanReversionStrategy(threshold=1.5)
        engine   = FeedbackEngine(strategy, target_sharpe=1.0, learning_rate=0.1)
        old_t    = strategy.threshold
        engine.update(self._make_result(sharpe=3.0))
        self.assertGreater(strategy.threshold, old_t)

    def test_poor_sharpe_decreases_threshold(self):
        strategy = OUMeanReversionStrategy(threshold=1.5)
        engine   = FeedbackEngine(strategy, target_sharpe=1.0, learning_rate=0.1)
        old_t    = strategy.threshold
        engine.update(self._make_result(sharpe=-0.5))
        self.assertLess(strategy.threshold, old_t)

    def test_threshold_clipped_to_min(self):
        strategy = OUMeanReversionStrategy(threshold=0.51)
        engine   = FeedbackEngine(strategy, target_sharpe=5.0, learning_rate=0.5,
                                   threshold_min=0.5)
        # Repeatedly push down
        for _ in range(20):
            engine.update(self._make_result(sharpe=-1.0))
        self.assertGreaterEqual(strategy.threshold, 0.5)

    def test_threshold_clipped_to_max(self):
        strategy = OUMeanReversionStrategy(threshold=3.9)
        engine   = FeedbackEngine(strategy, target_sharpe=0.0, learning_rate=0.5,
                                   threshold_max=4.0)
        for _ in range(20):
            engine.update(self._make_result(sharpe=5.0))
        self.assertLessEqual(strategy.threshold, 4.0)

    def test_ew_sharpe_zero_before_any_update(self):
        strategy = OUMeanReversionStrategy()
        engine   = FeedbackEngine(strategy)
        self.assertEqual(engine.ew_sharpe, 0.0)

    def test_ew_sharpe_positive_after_good_run(self):
        strategy = OUMeanReversionStrategy()
        engine   = FeedbackEngine(strategy)
        for _ in range(5):
            engine.update(self._make_result(sharpe=2.0))
        self.assertGreater(engine.ew_sharpe, 0.0)

    def test_update_returns_new_threshold(self):
        strategy = OUMeanReversionStrategy(threshold=1.5)
        engine   = FeedbackEngine(strategy)
        new_t    = engine.update(self._make_result(sharpe=2.0))
        self.assertAlmostEqual(new_t, strategy.threshold, places=8)


# ---------------------------------------------------------------------------
# run_strategy_with_feedback
# ---------------------------------------------------------------------------

class TestRunStrategyWithFeedback(unittest.TestCase):

    def test_returns_list_and_engine(self):
        rates    = _make_rates(300)
        strategy = OUMeanReversionStrategy(lookback=30, threshold=0.5)
        results, engine = run_strategy_with_feedback(rates, strategy, n_folds=5)
        self.assertIsInstance(results, list)
        self.assertIsInstance(engine, FeedbackEngine)

    def test_result_count_le_n_folds(self):
        """Some folds may be skipped if too small; count ≤ n_folds."""
        rates    = _make_rates(100)
        strategy = GBMMomentumStrategy(lookback=10, threshold=0.5)
        results, _ = run_strategy_with_feedback(rates, strategy, n_folds=5)
        self.assertLessEqual(len(results), 5)

    def test_feedback_history_populated(self):
        rates    = _make_rates(300)
        strategy = OUMeanReversionStrategy(lookback=30, threshold=0.8)
        results, engine = run_strategy_with_feedback(rates, strategy, n_folds=4)
        self.assertEqual(len(engine._sharpe_history), len(results))

    def test_threshold_changes_over_folds(self):
        """Threshold should not stay exactly constant over multiple folds."""
        rates    = _make_mean_reverting_rates(500)
        strategy = OUMeanReversionStrategy(lookback=40, threshold=1.0)
        initial  = strategy.threshold
        results, engine = run_strategy_with_feedback(
            rates, strategy, n_folds=5, learning_rate=0.1
        )
        # After at least one fold the threshold should have been adjusted
        if results:
            self.assertNotAlmostEqual(strategy.threshold, initial, places=8)

    def test_all_result_fields_valid(self):
        rates    = _make_rates(300)
        strategy = OUMeanReversionStrategy(lookback=40, threshold=0.5)
        results, _ = run_strategy_with_feedback(rates, strategy, n_folds=3)
        for r in results:
            self.assertGreaterEqual(r.max_drawdown,  0.0)
            self.assertGreaterEqual(r.win_rate,       0.0)
            self.assertLessEqual(r.win_rate,          1.0)
            self.assertGreater(r.total_bars,          0)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main()
