"""
Portfolio Model for handling portfolio data and calculations.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime


class PortfolioModel:
    """Model class for portfolio management."""

    def __init__(self, portfolio_id: str = "default"):
        """
        Initialize the PortfolioModel.

        Args:
            portfolio_id: Unique portfolio identifier.
        """
        self.portfolio_id = portfolio_id
        self._holdings: Dict[str, float] = {}
        self._transactions: List[Dict[str, Any]] = []
        self._created_at: datetime = datetime.now()

    def add_holding(self, symbol: str, quantity: float) -> bool:
        """
        Add or update a holding in the portfolio.

        Args:
            symbol: Stock/asset symbol.
            quantity: Number of shares/units.

        Returns:
            True if successful.
        """
        if symbol in self._holdings:
            self._holdings[symbol] += quantity
        else:
            self._holdings[symbol] = quantity

        self._transactions.append({
            "type": "add",
            "symbol": symbol,
            "quantity": quantity,
            "timestamp": datetime.now().isoformat()
        })
        return True

    def remove_holding(self, symbol: str, quantity: float) -> bool:
        """
        Remove a quantity from a holding.

        Args:
            symbol: Stock/asset symbol.
            quantity: Number of shares/units to remove.

        Returns:
            True if successful, False if insufficient holdings.
        """
        if symbol not in self._holdings:
            return False

        if self._holdings[symbol] < quantity:
            return False

        self._holdings[symbol] -= quantity
        if self._holdings[symbol] == 0:
            del self._holdings[symbol]

        self._transactions.append({
            "type": "remove",
            "symbol": symbol,
            "quantity": quantity,
            "timestamp": datetime.now().isoformat()
        })
        return True

    def get_holdings(self) -> Dict[str, float]:
        """
        Get all current holdings.

        Returns:
            Dictionary of symbol to quantity.
        """
        return self._holdings.copy()

    def get_transactions(self) -> List[Dict[str, Any]]:
        """
        Get transaction history.

        Returns:
            List of transaction records.
        """
        return self._transactions.copy()

    def get_portfolio_summary(self) -> Dict[str, Any]:
        """
        Get portfolio summary.

        Returns:
            Dictionary with portfolio summary data.
        """
        return {
            "portfolio_id": self.portfolio_id,
            "total_holdings": len(self._holdings),
            "total_transactions": len(self._transactions),
            "created_at": self._created_at.isoformat()
        }
