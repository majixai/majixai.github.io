"""
Validators utility module for validating financial data.
"""
from typing import List, Optional, Any
import re


class Validators:
    """Utility class for validating financial data."""

    @staticmethod
    def validate_symbol(symbol: str) -> bool:
        """
        Validate a stock/asset symbol.

        Args:
            symbol: Symbol string to validate.

        Returns:
            True if valid, False otherwise.
        """
        if not symbol or not isinstance(symbol, str):
            return False

        # Basic symbol pattern: 1-10 uppercase letters
        pattern = r'^[A-Z]{1,10}$'
        return bool(re.match(pattern, symbol.upper()))

    @staticmethod
    def validate_quantity(quantity: Any) -> bool:
        """
        Validate a quantity value.

        Args:
            quantity: Value to validate.

        Returns:
            True if valid, False otherwise.
        """
        try:
            q = float(quantity)
            return q > 0
        except (TypeError, ValueError):
            return False

    @staticmethod
    def validate_price(price: Any) -> bool:
        """
        Validate a price value.

        Args:
            price: Value to validate.

        Returns:
            True if valid, False otherwise.
        """
        try:
            p = float(price)
            return p >= 0
        except (TypeError, ValueError):
            return False

    @staticmethod
    def validate_weights(weights: List[float], tolerance: float = 0.001) -> bool:
        """
        Validate portfolio weights sum to 1.

        Args:
            weights: List of weight values.
            tolerance: Acceptable deviation from 1.0.

        Returns:
            True if weights sum to 1 (within tolerance), False otherwise.
        """
        if not weights:
            return False

        total = sum(weights)
        return abs(total - 1.0) <= tolerance

    @staticmethod
    def validate_returns(returns: List[float]) -> bool:
        """
        Validate a list of returns.

        Args:
            returns: List of return values.

        Returns:
            True if valid, False otherwise.
        """
        if not returns or not isinstance(returns, list):
            return False

        for r in returns:
            try:
                float(r)
            except (TypeError, ValueError):
                return False

        return True

    @staticmethod
    def validate_date_range(start_date: str, end_date: str) -> bool:
        """
        Validate that start_date is before end_date.

        Args:
            start_date: Start date string (YYYY-MM-DD).
            end_date: End date string (YYYY-MM-DD).

        Returns:
            True if valid range, False otherwise.
        """
        date_pattern = r'^\d{4}-\d{2}-\d{2}$'

        if not re.match(date_pattern, start_date):
            return False
        if not re.match(date_pattern, end_date):
            return False

        return start_date <= end_date
