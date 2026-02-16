"""
Market Controller for orchestrating market data operations.
"""
import os
import sys
from typing import Dict, List, Optional, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.market_model import MarketModel


class MarketController:
    """Controller class for market data operations."""

    def __init__(self, model: Optional[MarketModel] = None):
        """
        Initialize the MarketController.

        Args:
            model: MarketModel instance (created if not provided).
        """
        self.model = model or MarketModel()

    def fetch_market_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Fetch and return market data for a symbol.

        Args:
            symbol: Stock/asset symbol.

        Returns:
            Market data dictionary or None.
        """
        return self.model.get_market_data(symbol)

    def update_market_data(self, symbol: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update market data for a symbol.

        Args:
            symbol: Stock/asset symbol.
            data: Market data to store.

        Returns:
            Result dictionary with success status.
        """
        success = self.model.update_market_data(symbol, data)
        return {
            "success": success,
            "symbol": symbol,
            "message": "Updated successfully" if success else "Update failed"
        }

    def get_all_symbols(self) -> List[str]:
        """
        Get all available symbols.

        Returns:
            List of symbol strings.
        """
        return self.model.get_symbols()

    def refresh_cache(self) -> Dict[str, Any]:
        """
        Clear and refresh the market data cache.

        Returns:
            Result dictionary with status.
        """
        self.model.clear_cache()
        return {
            "success": True,
            "message": "Cache cleared successfully"
        }
