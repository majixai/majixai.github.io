"""
Calculation Service for quantitative finance computations.
"""
import math
from typing import List, Optional, Dict, Any


class CalculationService:
    """Service class for financial calculations."""

    @staticmethod
    def calculate_returns(prices: List[float]) -> List[float]:
        """
        Calculate simple returns from a list of prices.

        Args:
            prices: List of price values.

        Returns:
            List of return values.
        """
        if len(prices) < 2:
            return []

        returns = []
        for i in range(1, len(prices)):
            ret = (prices[i] - prices[i-1]) / prices[i-1]
            returns.append(ret)
        return returns

    @staticmethod
    def calculate_log_returns(prices: List[float]) -> List[float]:
        """
        Calculate logarithmic returns from a list of prices.

        Args:
            prices: List of price values.

        Returns:
            List of log return values.
        """
        if len(prices) < 2:
            return []

        log_returns = []
        for i in range(1, len(prices)):
            log_ret = math.log(prices[i] / prices[i-1])
            log_returns.append(log_ret)
        return log_returns

    @staticmethod
    def calculate_mean(values: List[float]) -> Optional[float]:
        """
        Calculate mean of a list of values.

        Args:
            values: List of numeric values.

        Returns:
            Mean value or None if empty.
        """
        if not values:
            return None
        return sum(values) / len(values)

    @staticmethod
    def calculate_variance(values: List[float], sample: bool = True) -> Optional[float]:
        """
        Calculate variance of a list of values.

        Args:
            values: List of numeric values.
            sample: If True, calculate sample variance (n-1), else population variance (n).

        Returns:
            Variance value or None if insufficient data.
        """
        n = len(values)
        if n < 2:
            return None

        mean = sum(values) / n
        squared_diffs = [(x - mean) ** 2 for x in values]
        divisor = n - 1 if sample else n
        return sum(squared_diffs) / divisor

    @staticmethod
    def calculate_std_dev(values: List[float], sample: bool = True) -> Optional[float]:
        """
        Calculate standard deviation of a list of values.

        Args:
            values: List of numeric values.
            sample: If True, calculate sample std dev.

        Returns:
            Standard deviation or None if insufficient data.
        """
        variance = CalculationService.calculate_variance(values, sample)
        if variance is None:
            return None
        return math.sqrt(variance)

    @staticmethod
    def calculate_sharpe_ratio(
        returns: List[float],
        risk_free_rate: float = 0.02,
        annualization_factor: float = 252
    ) -> Optional[float]:
        """
        Calculate Sharpe ratio.

        Args:
            returns: List of period returns.
            risk_free_rate: Annual risk-free rate.
            annualization_factor: Factor to annualize returns (252 for daily).

        Returns:
            Sharpe ratio or None if insufficient data.
        """
        if not returns:
            return None

        mean_return = sum(returns) / len(returns)
        std_dev = CalculationService.calculate_std_dev(returns)

        if std_dev is None or std_dev == 0:
            return None

        # Annualize
        annualized_return = mean_return * annualization_factor
        annualized_std = std_dev * math.sqrt(annualization_factor)

        return (annualized_return - risk_free_rate) / annualized_std

    @staticmethod
    def calculate_portfolio_return(
        weights: List[float],
        returns: List[float]
    ) -> Optional[float]:
        """
        Calculate weighted portfolio return.

        Args:
            weights: List of asset weights.
            returns: List of asset returns.

        Returns:
            Portfolio return or None if invalid input.
        """
        if len(weights) != len(returns):
            return None

        return sum(w * r for w, r in zip(weights, returns))
