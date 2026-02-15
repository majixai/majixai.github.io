"""
Formatters utility module for formatting financial data.
"""
from typing import Optional, List
from datetime import datetime


class Formatters:
    """Utility class for formatting financial data."""

    @staticmethod
    def format_currency(value: float, currency: str = "USD", decimals: int = 2) -> str:
        """
        Format a value as currency.

        Args:
            value: Numeric value.
            currency: Currency code.
            decimals: Number of decimal places.

        Returns:
            Formatted currency string.
        """
        symbols = {
            "USD": "$",
            "EUR": "€",
            "GBP": "£",
            "JPY": "¥"
        }
        symbol = symbols.get(currency, currency + " ")
        return f"{symbol}{value:,.{decimals}f}"

    @staticmethod
    def format_percentage(value: float, decimals: int = 2) -> str:
        """
        Format a value as percentage.

        Args:
            value: Numeric value (0.05 = 5%).
            decimals: Number of decimal places.

        Returns:
            Formatted percentage string.
        """
        return f"{value * 100:.{decimals}f}%"

    @staticmethod
    def format_number(value: float, decimals: int = 2) -> str:
        """
        Format a number with thousand separators.

        Args:
            value: Numeric value.
            decimals: Number of decimal places.

        Returns:
            Formatted number string.
        """
        return f"{value:,.{decimals}f}"

    @staticmethod
    def format_date(date: datetime, fmt: str = "%Y-%m-%d") -> str:
        """
        Format a datetime object as string.

        Args:
            date: Datetime object.
            fmt: Date format string.

        Returns:
            Formatted date string.
        """
        return date.strftime(fmt)

    @staticmethod
    def format_large_number(value: float) -> str:
        """
        Format large numbers with suffixes (K, M, B, T).

        Args:
            value: Numeric value.

        Returns:
            Formatted string with suffix.
        """
        suffixes = [
            (1e12, "T"),
            (1e9, "B"),
            (1e6, "M"),
            (1e3, "K")
        ]

        for threshold, suffix in suffixes:
            if abs(value) >= threshold:
                return f"{value / threshold:.2f}{suffix}"

        return f"{value:.2f}"
