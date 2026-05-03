"""
metatrader5/strategy.py — Backtested MT5 Strategies with Math-Feedback Engine

Implements two core strategies drawn from the repository's mathematical
directories (``calculus/stochastic``, ``probability``) and provides a
unified backtesting loop with a feedback / reinforcement mechanism.

Strategies
----------
1. **OUMeanReversionStrategy** — Ornstein-Uhlenbeck (stochastic calculus)
   Fits κ, θ, σ to a price series and generates BUY/SELL signals when
   price deviates beyond a z-score threshold from the long-run mean θ.
   Ref: calculus/stochastic — Itô SDE, Fokker-Planck, OU mean reversion.

2. **GBMMomentumStrategy** — Geometric Brownian Motion drift detector
   Estimates the GBM drift μ and vol σ via log-return statistics. Signals
   follow the sign of μ when the drift t-stat exceeds a confidence threshold.
   Ref: calculus/stochastic — GBM, probability_core.py normal_quantile.

Backtesting
-----------
``Backtester`` runs any strategy over an OHLCV numpy array (MT5 format),
accumulates trade PnL, and calculates Sharpe ratio and max drawdown.

Feedback Mechanism
------------------
``FeedbackEngine`` adjusts a strategy's signal threshold after each closed
trade using a running Sharpe estimate. Threshold shrinks on good runs and
widens on drawdown, providing a simple reinforcement loop.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional, Sequence, Tuple

import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EPSILON = 1e-10
_ANNUALISE_FACTOR = 252  # trading days per year


# ---------------------------------------------------------------------------
# Mathematical helpers (inline; mirroring probability/probability_core.py)
# ---------------------------------------------------------------------------

def _normal_cdf(x: float) -> float:
    """Standard normal CDF via math.erfc."""
    return 0.5 * math.erfc(-x / math.sqrt(2.0))


def _normal_quantile(p: float) -> float:
    """Rational approximation for the inverse normal CDF (Abramowitz & Stegun)."""
    if not (0.0 < p < 1.0):
        raise ValueError(f"p must be in (0,1); got {p}")
    if p < 0.5:
        t = math.sqrt(-2.0 * math.log(p))
        num = ((0.010328 * t + 0.802853) * t + 2.515517)
        den = (((0.001308 * t + 0.189269) * t + 1.432788) * t + 1.0)
        return -(t - num / den)
    return -_normal_quantile(1.0 - p)


def _rolling_mean(arr: np.ndarray, window: int) -> np.ndarray:
    out = np.full(len(arr), np.nan)
    for i in range(window - 1, len(arr)):
        out[i] = arr[i - window + 1: i + 1].mean()
    return out


def _rolling_std(arr: np.ndarray, window: int, ddof: int = 1) -> np.ndarray:
    out = np.full(len(arr), np.nan)
    for i in range(window - 1, len(arr)):
        out[i] = arr[i - window + 1: i + 1].std(ddof=ddof)
    return out


# ---------------------------------------------------------------------------
# OU parameter estimation (discrete-time MLE)
# ---------------------------------------------------------------------------

def fit_ou_params(
    prices: np.ndarray,
    dt: float = 1.0 / _ANNUALISE_FACTOR,
) -> Tuple[float, float, float]:
    """
    Estimate Ornstein-Uhlenbeck parameters (κ, θ, σ) via discrete OLS.

    The discrete OU update is:
        p_{t+1} = p_t * exp(-κ dt) + θ (1 - exp(-κ dt)) + ε_t

    Parameters
    ----------
    prices : np.ndarray
        1-D array of prices.
    dt : float
        Time step in years (default: 1 trading day = 1/252).

    Returns
    -------
    kappa : float   — mean-reversion speed (> 0 stable)
    theta : float   — long-run mean level
    sigma : float   — instantaneous volatility
    """
    if len(prices) < 10:
        raise ValueError("Need at least 10 price observations for OU fit.")
    x = prices[:-1]
    y = prices[1:]
    # OLS: y = a*x + b  (via normal equations)
    n = len(x)
    sum_x   = x.sum()
    sum_y   = y.sum()
    sum_xx  = (x * x).sum()
    sum_xy  = (x * y).sum()
    denom   = n * sum_xx - sum_x ** 2
    if abs(denom) < _EPSILON:
        # Degenerate: assume no mean reversion
        return 0.0, float(prices.mean()), float(prices.std(ddof=1))
    a = (n * sum_xy - sum_x * sum_y) / denom
    b = (sum_y - a * sum_x) / n
    a = max(a, _EPSILON)      # stability guard
    kappa = -math.log(a) / dt
    theta = b / (1.0 - a + _EPSILON)
    resid = y - (a * x + b)
    sigma = float(resid.std(ddof=1)) / math.sqrt(dt)
    return max(kappa, 0.0), float(theta), max(sigma, _EPSILON)


# ---------------------------------------------------------------------------
# GBM parameter estimation
# ---------------------------------------------------------------------------

def fit_gbm_params(
    prices: np.ndarray,
    dt: float = 1.0 / _ANNUALISE_FACTOR,
) -> Tuple[float, float]:
    """
    Estimate GBM drift μ and volatility σ from log-returns.

    Returns (mu, sigma) annualised.
    """
    if len(prices) < 2:
        return 0.0, _EPSILON
    log_returns = np.diff(np.log(np.maximum(prices, _EPSILON)))
    mu_dt    = float(log_returns.mean())
    sigma_dt = float(log_returns.std(ddof=1))
    mu    = mu_dt / dt + 0.5 * (sigma_dt / math.sqrt(dt)) ** 2
    sigma = sigma_dt / math.sqrt(dt)
    return mu, max(sigma, _EPSILON)


# ---------------------------------------------------------------------------
# Signal type
# ---------------------------------------------------------------------------

Signal = int  # +1 = BUY, -1 = SELL, 0 = HOLD


# ---------------------------------------------------------------------------
# Strategy interface
# ---------------------------------------------------------------------------

class BaseStrategy:
    """Abstract base class for MT5 strategies."""

    #: current z-score / confidence threshold for generating a signal
    threshold: float = 1.5

    def generate_signals(self, rates: np.ndarray) -> np.ndarray:
        """
        Given an MT5-format OHLCV rates array, return an int8 array of
        signals: +1 (BUY), -1 (SELL), 0 (HOLD).
        """
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Strategy 1: OU Mean Reversion
# ---------------------------------------------------------------------------

class OUMeanReversionStrategy(BaseStrategy):
    """
    Mean-reversion strategy based on Ornstein-Uhlenbeck dynamics.

    Uses ``calculus/stochastic`` theory:
      - Fits κ, θ, σ to recent close prices via discrete-time MLE.
      - Computes z-score z = (p - θ) / (σ / sqrt(2κ)).
      - BUY  when z < -threshold  (price significantly below mean).
      - SELL when z >  threshold  (price significantly above mean).

    Parameters
    ----------
    lookback : int
        Rolling window for OU parameter estimation.
    threshold : float
        |z-score| required to generate a signal (default 1.5 std).
    dt : float
        Time step in years.
    """

    def __init__(
        self,
        lookback: int = 60,
        threshold: float = 1.5,
        dt: float = 1.0 / _ANNUALISE_FACTOR,
    ) -> None:
        self.lookback  = lookback
        self.threshold = threshold
        self.dt        = dt

    def generate_signals(self, rates: np.ndarray) -> np.ndarray:
        close   = rates["close"].astype(np.float64)
        n       = len(close)
        signals = np.zeros(n, dtype=np.int8)

        for i in range(self.lookback, n):
            window = close[i - self.lookback: i]
            try:
                kappa, theta, sigma = fit_ou_params(window, self.dt)
            except ValueError:
                continue
            # Equilibrium standard deviation of the OU process
            sigma_eq = sigma / math.sqrt(max(2.0 * kappa, _EPSILON))
            if sigma_eq < _EPSILON:
                continue
            z = (close[i] - theta) / sigma_eq
            if z < -self.threshold:
                signals[i] = 1     # BUY: price below mean
            elif z > self.threshold:
                signals[i] = -1    # SELL: price above mean
        return signals


# ---------------------------------------------------------------------------
# Strategy 2: GBM Momentum
# ---------------------------------------------------------------------------

class GBMMomentumStrategy(BaseStrategy):
    """
    Momentum strategy based on Geometric Brownian Motion drift.

    Uses ``calculus/stochastic`` + ``probability`` theory:
      - Estimates drift μ and vol σ over a rolling lookback window.
      - Computes t-stat for μ: t = μ / (σ / sqrt(n)).
      - BUY  when t >  threshold (significant upward drift).
      - SELL when t < -threshold (significant downward drift).

    Parameters
    ----------
    lookback : int
        Rolling window of bars used for drift estimation.
    threshold : float
        |t-stat| required for a signal (default 1.5 ≈ 87% one-tail).
    dt : float
        Time step in years.
    """

    def __init__(
        self,
        lookback: int = 30,
        threshold: float = 1.5,
        dt: float = 1.0 / _ANNUALISE_FACTOR,
    ) -> None:
        self.lookback  = lookback
        self.threshold = threshold
        self.dt        = dt

    def generate_signals(self, rates: np.ndarray) -> np.ndarray:
        close   = rates["close"].astype(np.float64)
        n       = len(close)
        signals = np.zeros(n, dtype=np.int8)

        for i in range(self.lookback + 1, n):
            window = close[i - self.lookback - 1: i]
            mu, sigma = fit_gbm_params(window, self.dt)
            se = sigma / math.sqrt(max(self.lookback * self.dt, _EPSILON))
            t_stat = mu / max(se, _EPSILON)
            if t_stat > self.threshold:
                signals[i] = 1    # BUY
            elif t_stat < -self.threshold:
                signals[i] = -1   # SELL
        return signals


# ---------------------------------------------------------------------------
# Trade record
# ---------------------------------------------------------------------------

@dataclass
class Trade:
    entry_bar:  int
    exit_bar:   int
    direction:  int    # +1 BUY, -1 SELL
    entry_price: float
    exit_price:  float

    @property
    def pnl(self) -> float:
        return self.direction * (self.exit_price - self.entry_price)

    @property
    def return_pct(self) -> float:
        if self.entry_price == 0.0:
            return 0.0
        return self.direction * (self.exit_price - self.entry_price) / self.entry_price


# ---------------------------------------------------------------------------
# Backtester
# ---------------------------------------------------------------------------

@dataclass
class BacktestResult:
    trades: List[Trade] = field(default_factory=list)
    total_pnl: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    win_rate: float = 0.0
    total_bars: int = 0

    def summary(self) -> str:
        return (
            f"Trades={len(self.trades)}, PnL={self.total_pnl:.4f}, "
            f"Sharpe={self.sharpe_ratio:.3f}, MaxDD={self.max_drawdown:.4f}, "
            f"WinRate={self.win_rate:.2%}"
        )


class Backtester:
    """
    Event-driven backtester for MT5-format OHLCV rates arrays.

    Supports any ``BaseStrategy`` subclass.  Uses next-bar-open execution
    (signal on bar i → execute on open of bar i+1) and tracks PnL in price
    units (1 unit = 1 point of the contract; sizing is 1 lot throughout).

    Parameters
    ----------
    strategy : BaseStrategy
        The strategy to test.
    slippage : float
        Fixed slippage added to every entry / exit price (price units).
    """

    def __init__(
        self,
        strategy: BaseStrategy,
        slippage: float = 0.0002,
    ) -> None:
        self.strategy = strategy
        self.slippage = slippage

    def run(self, rates: np.ndarray) -> BacktestResult:
        """Run the backtest over *rates* and return a ``BacktestResult``."""
        signals = self.strategy.generate_signals(rates)
        open_prices  = rates["open"].astype(np.float64)
        n = len(rates)

        trades: List[Trade] = []
        position:  int   = 0
        entry_bar: int   = 0
        entry_px:  float = 0.0

        for i in range(1, n):
            sig = int(signals[i - 1])
            if position == 0 and sig != 0:
                # Open a new position at next-bar open + slippage
                position   = sig
                entry_bar  = i
                entry_px   = open_prices[i] + sig * self.slippage
            elif position != 0 and sig != 0 and sig != position:
                # Reverse: close current, open opposite
                exit_px = open_prices[i] - position * self.slippage
                trades.append(Trade(entry_bar, i, position, entry_px, exit_px))
                position  = sig
                entry_bar = i
                entry_px  = open_prices[i] + sig * self.slippage
            elif position != 0 and sig == 0:
                # Neutral signal → close position
                exit_px = open_prices[i] - position * self.slippage
                trades.append(Trade(entry_bar, i, position, entry_px, exit_px))
                position = 0

        # Force-close any open position at the last bar
        if position != 0:
            exit_px = open_prices[-1] - position * self.slippage
            trades.append(Trade(entry_bar, n - 1, position, entry_px, exit_px))

        return self._build_result(trades, n)

    # ------------------------------------------------------------------

    @staticmethod
    def _build_result(trades: List[Trade], n_bars: int) -> BacktestResult:
        if not trades:
            return BacktestResult(total_bars=n_bars)

        returns = np.array([t.return_pct for t in trades])
        total_pnl = float(sum(t.pnl for t in trades))
        win_rate  = float(sum(1 for t in trades if t.pnl > 0)) / len(trades)

        # Sharpe ratio (annualised, trade-level returns)
        mean_r = returns.mean()
        std_r  = returns.std(ddof=1) if len(returns) > 1 else _EPSILON
        sharpe = (mean_r / max(std_r, _EPSILON)) * math.sqrt(_ANNUALISE_FACTOR)

        # Max drawdown on cumulative PnL curve
        cum_pnl = np.cumsum([t.pnl for t in trades])
        peak    = np.maximum.accumulate(cum_pnl)
        drawdown = (peak - cum_pnl) / (np.abs(peak) + _EPSILON)
        max_dd  = float(drawdown.max()) if len(drawdown) > 0 else 0.0

        return BacktestResult(
            trades=trades,
            total_pnl=total_pnl,
            sharpe_ratio=float(sharpe),
            max_drawdown=max_dd,
            win_rate=win_rate,
            total_bars=n_bars,
        )


# ---------------------------------------------------------------------------
# Feedback Engine
# ---------------------------------------------------------------------------

class FeedbackEngine:
    """
    Adaptive threshold feedback loop for MT5 strategies.

    After every closed batch of trades the engine adjusts
    ``strategy.threshold`` using a running Sharpe ratio:

      - If Sharpe >= target  → tighten threshold (be more selective).
      - If Sharpe < target   → relax threshold (allow more signals).

    The adjustment magnitude is controlled by *learning_rate*.

    Parameters
    ----------
    strategy : BaseStrategy
        Strategy whose ``.threshold`` is updated.
    target_sharpe : float
        Desired minimum Sharpe ratio.
    learning_rate : float
        Fractional step size for threshold updates (0–1).
    threshold_min : float
        Lower bound for the threshold.
    threshold_max : float
        Upper bound for the threshold.
    """

    def __init__(
        self,
        strategy: BaseStrategy,
        target_sharpe: float = 1.0,
        learning_rate: float = 0.05,
        threshold_min: float = 0.5,
        threshold_max: float = 4.0,
    ) -> None:
        self.strategy       = strategy
        self.target_sharpe  = target_sharpe
        self.learning_rate  = learning_rate
        self.threshold_min  = threshold_min
        self.threshold_max  = threshold_max
        self._sharpe_history: List[float] = []

    def update(self, result: BacktestResult) -> float:
        """
        Update strategy threshold based on *result*.

        Returns the new threshold value.
        """
        self._sharpe_history.append(result.sharpe_ratio)
        # Exponentially weighted running Sharpe
        weights = np.array([
            (1.0 - self.learning_rate) ** (len(self._sharpe_history) - 1 - i)
            for i in range(len(self._sharpe_history))
        ])
        weights /= weights.sum()
        ew_sharpe = float(np.dot(weights, self._sharpe_history))

        # Adjust threshold
        if ew_sharpe >= self.target_sharpe:
            # Good performance: tighten (increase threshold → fewer signals)
            new_t = self.strategy.threshold * (1.0 + self.learning_rate)
        else:
            # Poor performance: relax (decrease threshold → more signals)
            new_t = self.strategy.threshold * (1.0 - self.learning_rate)

        new_t = float(np.clip(new_t, self.threshold_min, self.threshold_max))
        self.strategy.threshold = new_t
        return new_t

    @property
    def ew_sharpe(self) -> float:
        """Current exponentially-weighted Sharpe estimate."""
        if not self._sharpe_history:
            return 0.0
        weights = np.array([
            (1.0 - self.learning_rate) ** (len(self._sharpe_history) - 1 - i)
            for i in range(len(self._sharpe_history))
        ])
        weights /= weights.sum()
        return float(np.dot(weights, self._sharpe_history))


# ---------------------------------------------------------------------------
# Convenience: build + run a strategy pipeline with feedback
# ---------------------------------------------------------------------------

def run_strategy_with_feedback(
    rates: np.ndarray,
    strategy: BaseStrategy,
    n_folds: int = 5,
    target_sharpe: float = 1.0,
    learning_rate: float = 0.05,
    slippage: float = 0.0002,
) -> Tuple[List[BacktestResult], FeedbackEngine]:
    """
    Walk-forward backtest with feedback-driven threshold adaptation.

    Splits *rates* into *n_folds* equal segments.  After each fold the
    ``FeedbackEngine`` updates the strategy threshold for the next fold.

    Returns
    -------
    results : list[BacktestResult]
        One result per fold.
    engine : FeedbackEngine
        Feedback engine with cumulative Sharpe history.
    """
    backtester = Backtester(strategy, slippage=slippage)
    engine     = FeedbackEngine(strategy, target_sharpe=target_sharpe,
                                learning_rate=learning_rate)
    fold_size  = max(len(rates) // n_folds, 2)
    results: List[BacktestResult] = []

    for fold in range(n_folds):
        start = fold * fold_size
        end   = start + fold_size if fold < n_folds - 1 else len(rates)
        fold_rates = rates[start:end]
        if len(fold_rates) < 5:
            continue
        result = backtester.run(fold_rates)
        engine.update(result)
        results.append(result)

    return results, engine
