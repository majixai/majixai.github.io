"""
Unit tests for Quantix models.
"""
import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.market_model import MarketModel
from models.portfolio_model import PortfolioModel


class TestMarketModel(unittest.TestCase):
    """Test cases for MarketModel."""

    def setUp(self):
        """Set up test fixtures."""
        self.model = MarketModel()

    def test_update_and_get_market_data(self):
        """Test updating and retrieving market data."""
        data = {"price": 100.0, "volume": 1000}
        result = self.model.update_market_data("AAPL", data)
        self.assertTrue(result)

        retrieved = self.model.get_market_data("AAPL")
        self.assertEqual(retrieved, data)

    def test_get_nonexistent_symbol(self):
        """Test retrieving data for nonexistent symbol."""
        result = self.model.get_market_data("UNKNOWN")
        self.assertIsNone(result)

    def test_get_symbols(self):
        """Test getting list of symbols."""
        self.model.update_market_data("AAPL", {"price": 100})
        self.model.update_market_data("GOOGL", {"price": 200})

        symbols = self.model.get_symbols()
        self.assertEqual(len(symbols), 2)
        self.assertIn("AAPL", symbols)
        self.assertIn("GOOGL", symbols)

    def test_clear_cache(self):
        """Test clearing the cache."""
        self.model.update_market_data("AAPL", {"price": 100})
        self.model.clear_cache()

        symbols = self.model.get_symbols()
        self.assertEqual(len(symbols), 0)


class TestPortfolioModel(unittest.TestCase):
    """Test cases for PortfolioModel."""

    def setUp(self):
        """Set up test fixtures."""
        self.model = PortfolioModel(portfolio_id="test_portfolio")

    def test_add_holding(self):
        """Test adding a holding."""
        result = self.model.add_holding("AAPL", 10)
        self.assertTrue(result)

        holdings = self.model.get_holdings()
        self.assertEqual(holdings["AAPL"], 10)

    def test_add_to_existing_holding(self):
        """Test adding to existing holding."""
        self.model.add_holding("AAPL", 10)
        self.model.add_holding("AAPL", 5)

        holdings = self.model.get_holdings()
        self.assertEqual(holdings["AAPL"], 15)

    def test_remove_holding(self):
        """Test removing from a holding."""
        self.model.add_holding("AAPL", 10)
        result = self.model.remove_holding("AAPL", 5)
        self.assertTrue(result)

        holdings = self.model.get_holdings()
        self.assertEqual(holdings["AAPL"], 5)

    def test_remove_holding_insufficient(self):
        """Test removing more than available."""
        self.model.add_holding("AAPL", 5)
        result = self.model.remove_holding("AAPL", 10)
        self.assertFalse(result)

    def test_remove_nonexistent_holding(self):
        """Test removing from nonexistent holding."""
        result = self.model.remove_holding("UNKNOWN", 10)
        self.assertFalse(result)

    def test_transaction_history(self):
        """Test transaction history recording."""
        self.model.add_holding("AAPL", 10)
        self.model.remove_holding("AAPL", 5)

        transactions = self.model.get_transactions()
        self.assertEqual(len(transactions), 2)
        self.assertEqual(transactions[0]["type"], "add")
        self.assertEqual(transactions[1]["type"], "remove")

    def test_portfolio_summary(self):
        """Test portfolio summary."""
        self.model.add_holding("AAPL", 10)
        self.model.add_holding("GOOGL", 5)

        summary = self.model.get_portfolio_summary()
        self.assertEqual(summary["portfolio_id"], "test_portfolio")
        self.assertEqual(summary["total_holdings"], 2)


if __name__ == "__main__":
    unittest.main()
