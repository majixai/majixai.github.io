"""
Risk Service for risk management calculations.
"""
import math
from typing import List, Optional, Dict, Any


class RiskService:
    """Service class for risk calculations."""

    @staticmethod
    def calculate_var(
        returns: List[float],
        confidence_level: float = 0.95,
        portfolio_value: float = 1.0
    ) -> Optional[Dict[str, float]]:
        """
        Calculate parametric Value at Risk (VaR).

        Args:
            returns: List of historical returns.
            confidence_level: Confidence level (e.g., 0.95 for 95%).
            portfolio_value: Current portfolio value.

        Returns:
            Dictionary with VaR metrics or None if insufficient data.
        """
        if len(returns) < 2:
            return None

        mean = sum(returns) / len(returns)
        variance = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
        std_dev = math.sqrt(variance)

        # Z-scores for common confidence levels
        z_scores = {
            0.90: 1.282,
            0.95: 1.645,
            0.99: 2.326
        }
        z = z_scores.get(confidence_level, 1.645)

        var_percentage = mean - z * std_dev
        var_value = abs(var_percentage) * portfolio_value

        return {
            "confidence_level": confidence_level,
            "var_percentage": var_percentage,
            "var_value": var_value,
            "portfolio_value": portfolio_value
        }

    @staticmethod
    def calculate_cvar(
        returns: List[float],
        confidence_level: float = 0.95,
        portfolio_value: float = 1.0
    ) -> Optional[Dict[str, float]]:
        """
        Calculate Conditional Value at Risk (CVaR / Expected Shortfall).

        Args:
            returns: List of historical returns.
            confidence_level: Confidence level.
            portfolio_value: Current portfolio value.

        Returns:
            Dictionary with CVaR metrics or None if insufficient data.
        """
        if len(returns) < 5:
            return None

        sorted_returns = sorted(returns)
        cutoff_index = int(len(sorted_returns) * (1 - confidence_level))
        if cutoff_index == 0:
            cutoff_index = 1

        tail_returns = sorted_returns[:cutoff_index]
        cvar_percentage = sum(tail_returns) / len(tail_returns)
        cvar_value = abs(cvar_percentage) * portfolio_value

        return {
            "confidence_level": confidence_level,
            "cvar_percentage": cvar_percentage,
            "cvar_value": cvar_value,
            "portfolio_value": portfolio_value
        }

    @staticmethod
    def calculate_max_drawdown(prices: List[float]) -> Optional[Dict[str, float]]:
        """
        Calculate maximum drawdown from a price series.

        Args:
            prices: List of price values.

        Returns:
            Dictionary with max drawdown metrics or None if insufficient data.
        """
        if len(prices) < 2:
            return None

        peak = prices[0]
        max_dd = 0.0
        peak_idx = 0
        trough_idx = 0
        max_dd_start = 0
        max_dd_end = 0

        for i, price in enumerate(prices):
            if price > peak:
                peak = price
                peak_idx = i

            drawdown = (peak - price) / peak
            if drawdown > max_dd:
                max_dd = drawdown
                trough_idx = i
                max_dd_start = peak_idx
                max_dd_end = trough_idx

        return {
            "max_drawdown": max_dd,
            "peak_index": max_dd_start,
            "trough_index": max_dd_end,
            "peak_value": prices[max_dd_start],
            "trough_value": prices[max_dd_end]
        }

    @staticmethod
    def calculate_beta(
        asset_returns: List[float],
        market_returns: List[float]
    ) -> Optional[float]:
        """
        Calculate beta (systematic risk measure).

        Args:
            asset_returns: List of asset returns.
            market_returns: List of market returns.

        Returns:
            Beta value or None if insufficient data.
        """
        if len(asset_returns) != len(market_returns) or len(asset_returns) < 2:
            return None

        n = len(asset_returns)
        asset_mean = sum(asset_returns) / n
        market_mean = sum(market_returns) / n

        covariance = sum(
            (a - asset_mean) * (m - market_mean)
            for a, m in zip(asset_returns, market_returns)
        ) / (n - 1)

        market_variance = sum(
            (m - market_mean) ** 2 for m in market_returns
        ) / (n - 1)

        if market_variance == 0:
            return None

        return covariance / market_variance
