"""
Market Model for handling market data operations.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime


class MarketModel:
    """Model class for market data operations."""

    def __init__(self, data_source: str = "default"):
        """
        Initialize the MarketModel.

        Args:
            data_source: Data source identifier.
        """
        self.data_source = data_source
        self._cache: Dict[str, Any] = {}
        self._last_update: Optional[datetime] = None

    def get_market_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve market data for a given symbol.

        Args:
            symbol: Stock/asset symbol.

        Returns:
            Dictionary containing market data or None if not found.
        """
        if symbol in self._cache:
            return self._cache[symbol]
        return None

    def update_market_data(self, symbol: str, data: Dict[str, Any]) -> bool:
        """
        Update market data for a given symbol.

        Args:
            symbol: Stock/asset symbol.
            data: Market data dictionary.

        Returns:
            True if update successful, False otherwise.
        """
        try:
            self._cache[symbol] = data
            self._last_update = datetime.now()
            return True
        except Exception:
            return False

    def get_symbols(self) -> List[str]:
        """
        Get all available symbols.

        Returns:
            List of symbol strings.
        """
        return list(self._cache.keys())

    def clear_cache(self) -> None:
        """Clear the market data cache."""
        self._cache.clear()
        self._last_update = None
