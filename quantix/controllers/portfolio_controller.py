"""
Portfolio Controller for orchestrating portfolio operations.
"""
import os
import sys
from typing import Dict, List, Optional, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.portfolio_model import PortfolioModel


class PortfolioController:
    """Controller class for portfolio operations."""

    def __init__(self, model: Optional[PortfolioModel] = None):
        """
        Initialize the PortfolioController.

        Args:
            model: PortfolioModel instance (created if not provided).
        """
        self.model = model or PortfolioModel()

    def add_position(self, symbol: str, quantity: float) -> Dict[str, Any]:
        """
        Add a position to the portfolio.

        Args:
            symbol: Stock/asset symbol.
            quantity: Number of shares/units.

        Returns:
            Result dictionary with success status.
        """
        success = self.model.add_holding(symbol, quantity)
        return {
            "success": success,
            "symbol": symbol,
            "quantity": quantity,
            "message": "Position added" if success else "Failed to add position"
        }

    def remove_position(self, symbol: str, quantity: float) -> Dict[str, Any]:
        """
        Remove a position from the portfolio.

        Args:
            symbol: Stock/asset symbol.
            quantity: Number of shares/units.

        Returns:
            Result dictionary with success status.
        """
        success = self.model.remove_holding(symbol, quantity)
        return {
            "success": success,
            "symbol": symbol,
            "quantity": quantity,
            "message": "Position removed" if success else "Insufficient holdings or position not found"
        }

    def get_portfolio(self) -> Dict[str, Any]:
        """
        Get current portfolio state.

        Returns:
            Dictionary with portfolio holdings and summary.
        """
        return {
            "holdings": self.model.get_holdings(),
            "summary": self.model.get_portfolio_summary()
        }

    def get_transaction_history(self) -> List[Dict[str, Any]]:
        """
        Get portfolio transaction history.

        Returns:
            List of transaction records.
        """
        return self.model.get_transactions()
