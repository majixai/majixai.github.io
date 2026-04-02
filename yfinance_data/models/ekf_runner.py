"""
EKF Runner — applies the ExtendedKalmanFilter to yfinance OHLCV data.

Calibrates EKF parameters from the price series, runs the batch filter,
generates a short-horizon price forecast, and persists results as
gzip-compressed JSON `.dat` files.

Storage layout (relative to *data_dir*):
  states/TICKER_YYYY.dat          — filtered state vectors for the year
  predictions/TICKER_next_close.dat — latest forecast & summary
"""

from __future__ import annotations

import gzip
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from models.bayesian_ekf import ExtendedKalmanFilter

logger = logging.getLogger(__name__)


class EKFRunner:
    """
    High-level runner that wires OHLCV price data to the EKF and manages
    compressed `.dat` storage.

    Parameters
    ----------
    data_dir : str
        Base directory for output `.dat` files.
        Sub-directories ``states/`` and ``predictions/`` are created
        automatically.
    forecast_days : int
        Number of trading days to predict ahead (default 5).
    """

    def __init__(self, data_dir: str = ".", forecast_days: int = 5) -> None:
        self.data_dir = data_dir
        self.forecast_days = forecast_days
        self._states_dir = os.path.join(data_dir, "states")
        self._pred_dir = os.path.join(data_dir, "predictions")
        os.makedirs(self._states_dir, exist_ok=True)
        os.makedirs(self._pred_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_for_ticker(
        self,
        ticker: str,
        df: pd.DataFrame,
        ekf_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Run the EKF on a single ticker's OHLCV DataFrame.

        Parameters
        ----------
        ticker : str
        df : pd.DataFrame
            Must contain a ``Close`` column (or ``close``).
        ekf_params : dict, optional
            Override any EKF constructor keyword arguments.

        Returns
        -------
        dict with summary statistics, forecasts, and file paths.
        Returns an empty dict if data is insufficient or an error occurs.
        """
        close_prices = _extract_close(df)
        if close_prices is None or len(close_prices) < 10:
            logger.warning(
                "%s: insufficient data (%d rows) — skipping EKF",
                ticker,
                0 if close_prices is None else len(close_prices),
            )
            return {}

        try:
            log_prices = np.log(close_prices.astype(float))
            ekf = self._build_ekf(log_prices, ekf_params)
            filtered = ekf.batch_filter(log_prices)
            forecasts = ekf.predict_next(n_steps=self.forecast_days)

            predicted_log = forecasts[0]["log_price"] if forecasts else log_prices[-1]
            predicted_close = float(np.exp(predicted_log))
            last_close = float(close_prices[-1])
            predicted_return = (predicted_close - last_close) / last_close

            result: Dict[str, Any] = {
                "ticker": ticker,
                "last_close": round(last_close, 6),
                "predicted_close": round(predicted_close, 6),
                "predicted_return_pct": round(predicted_return * 100, 4),
                "filtered_volatility": round(filtered[-1]["volatility"], 8),
                "filtered_momentum_angle": round(filtered[-1]["momentum_angle"], 6),
                "posterior_cov_trace": round(filtered[-1]["P_trace"], 8),
                "forecast_horizon_days": self.forecast_days,
                "n_observations": len(log_prices),
                "filtered_at": datetime.now().isoformat(),
                "forecasts": forecasts,
                # Strip heavy per-step lists; keep compact summary per bar
                "filtered_states": _compact_states(filtered),
            }

            states_path = self._store_states(ticker, filtered)
            pred_path = self._store_predictions(ticker, result)
            result["states_dat"] = states_path
            result["predictions_dat"] = pred_path

            logger.info(
                "%s → predicted close $%.4f (%+.2f%%) | vol=%.6f | Θ=%.4f",
                ticker,
                predicted_close,
                predicted_return * 100,
                filtered[-1]["volatility"],
                filtered[-1]["momentum_angle"],
            )
            return result

        except Exception as exc:  # noqa: BLE001
            logger.warning("%s: EKF failed — %s", ticker, exc)
            return {}

    def run_batch(
        self,
        data_dict: Dict[str, pd.DataFrame],
        ekf_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Run EKF analysis for multiple tickers.

        Parameters
        ----------
        data_dict : dict  {ticker: DataFrame}
        ekf_params : dict, optional
            Shared parameter overrides applied to every ticker.

        Returns
        -------
        dict  {ticker: result_dict}  (tickers that failed are omitted)
        """
        results: Dict[str, Dict[str, Any]] = {}
        for ticker, df in data_dict.items():
            result = self.run_for_ticker(ticker, df, ekf_params)
            if result:
                results[ticker] = result
        return results

    def load_states(
        self, ticker: str, year: Optional[int] = None
    ) -> Dict[str, Any]:
        """Load filtered state vectors previously stored for *ticker*."""
        if year is None:
            year = datetime.now().year
        path = os.path.join(self._states_dir, f"{ticker}_{year}.dat")
        return _read_dat(path)

    def load_predictions(self, ticker: str) -> Dict[str, Any]:
        """Load the latest next-close prediction for *ticker*."""
        path = os.path.join(self._pred_dir, f"{ticker}_next_close.dat")
        return _read_dat(path)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_ekf(
        log_prices: np.ndarray,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> ExtendedKalmanFilter:
        """
        Calibrate EKF parameters from the log-price series and construct
        the filter, then optionally apply caller overrides.
        """
        log_returns = np.diff(log_prices)
        mu = float(np.mean(log_returns))
        init_vol = max(float(np.var(log_returns)), 1e-10)
        sigma_v = max(float(np.std(np.diff(log_returns) ** 2)) * 10.0, 0.01)
        P_ref = float(np.median(log_prices))
        R = max(init_vol * 0.1, 1e-8)

        params: Dict[str, Any] = dict(
            mu=mu,
            kappa=2.0,
            theta_v=init_vol,
            sigma_v=sigma_v,
            dt=1.0,
            P_ref=P_ref,
            x0=np.array([log_prices[0], init_vol, 0.0]),
            R=R,
        )
        if overrides:
            params.update(overrides)
            # Ensure x0 is ndarray if caller passed a list
            if "x0" in overrides and not isinstance(overrides["x0"], np.ndarray):
                params["x0"] = np.array(overrides["x0"], dtype=float)

        return ExtendedKalmanFilter(**params)

    def _store_states(
        self, ticker: str, states: List[Dict[str, Any]]
    ) -> str:
        """Compress and persist filtered state vectors."""
        year = datetime.now().year
        path = os.path.join(self._states_dir, f"{ticker}_{year}.dat")
        payload = {
            "ticker": ticker,
            "year": year,
            "stored_at": datetime.now().isoformat(),
            "states": states,
        }
        _write_dat(path, payload)
        return path

    def _store_predictions(
        self, ticker: str, prediction: Dict[str, Any]
    ) -> str:
        """Compress and persist next-close prediction."""
        path = os.path.join(self._pred_dir, f"{ticker}_next_close.dat")
        _write_dat(path, prediction)
        return path


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _extract_close(df: pd.DataFrame) -> Optional[np.ndarray]:
    """Return the Close price array regardless of column capitalisation."""
    for col in ("Close", "close", "CLOSE", "Adj Close", "adj_close"):
        if col in df.columns:
            series = df[col].dropna()
            if len(series) > 0:
                return series.values.astype(float)
    return None


def _compact_states(states: List[Dict[str, Any]]) -> List[Dict[str, float]]:
    """
    Strip ``x_posterior`` (verbose) from each step dict to keep the stored
    file small while retaining all scalar diagnostics.
    """
    keep = {"log_price", "volatility", "momentum_angle", "innovation", "P_trace"}
    return [{k: v for k, v in s.items() if k in keep} for s in states]


def _write_dat(path: str, payload: Any) -> None:
    """Serialise *payload* to JSON and write as gzip to *path*."""
    data = json.dumps(payload, default=_json_default).encode("utf-8")
    with gzip.open(path, "wb") as fh:
        fh.write(data)


def _read_dat(path: str) -> Dict[str, Any]:
    """Read and decompress a `.dat` file, returning the decoded JSON."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"EKF data file not found: {path}")
    with gzip.open(path, "rb") as fh:
        return json.loads(fh.read().decode("utf-8"))


def _json_default(obj: Any) -> Any:
    """JSON serialisation fallback for numpy scalar/array types."""
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")
