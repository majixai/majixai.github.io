"""
Unit tests for Quantix services.
"""
import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.calculation_service import CalculationService
from services.risk_service import RiskService


class TestCalculationService(unittest.TestCase):
    """Test cases for CalculationService."""

    def test_calculate_returns(self):
        """Test simple returns calculation."""
        prices = [100, 110, 105, 115]
        returns = CalculationService.calculate_returns(prices)

        self.assertEqual(len(returns), 3)
        self.assertAlmostEqual(returns[0], 0.1, places=4)  # 10% increase
        self.assertAlmostEqual(returns[1], -0.0455, places=4)  # ~4.5% decrease
        self.assertAlmostEqual(returns[2], 0.0952, places=4)  # ~9.5% increase

    def test_calculate_returns_insufficient_data(self):
        """Test returns with insufficient data."""
        result = CalculationService.calculate_returns([100])
        self.assertEqual(result, [])

    def test_calculate_log_returns(self):
        """Test log returns calculation."""
        prices = [100, 110]
        log_returns = CalculationService.calculate_log_returns(prices)

        self.assertEqual(len(log_returns), 1)
        self.assertAlmostEqual(log_returns[0], 0.0953, places=4)

    def test_calculate_mean(self):
        """Test mean calculation."""
        values = [10, 20, 30, 40, 50]
        mean = CalculationService.calculate_mean(values)
        self.assertEqual(mean, 30)

    def test_calculate_mean_empty(self):
        """Test mean with empty list."""
        result = CalculationService.calculate_mean([])
        self.assertIsNone(result)

    def test_calculate_variance(self):
        """Test variance calculation."""
        values = [2, 4, 4, 4, 5, 5, 7, 9]
        variance = CalculationService.calculate_variance(values)
        self.assertAlmostEqual(variance, 4.571, places=2)

    def test_calculate_std_dev(self):
        """Test standard deviation calculation."""
        values = [2, 4, 4, 4, 5, 5, 7, 9]
        std_dev = CalculationService.calculate_std_dev(values)
        self.assertAlmostEqual(std_dev, 2.138, places=2)

    def test_calculate_sharpe_ratio(self):
        """Test Sharpe ratio calculation."""
        returns = [0.01, 0.02, -0.01, 0.015, 0.005]
        sharpe = CalculationService.calculate_sharpe_ratio(returns)
        self.assertIsNotNone(sharpe)

    def test_calculate_portfolio_return(self):
        """Test portfolio return calculation."""
        weights = [0.5, 0.3, 0.2]
        returns = [0.10, 0.05, 0.02]
        port_return = CalculationService.calculate_portfolio_return(weights, returns)
        self.assertAlmostEqual(port_return, 0.069, places=3)


class TestRiskService(unittest.TestCase):
    """Test cases for RiskService."""

    def test_calculate_var(self):
        """Test VaR calculation."""
        returns = [-0.02, 0.01, -0.01, 0.02, -0.03, 0.015, 0.005, -0.015]
        var = RiskService.calculate_var(returns, 0.95, 1000000)

        self.assertIsNotNone(var)
        self.assertIn("var_value", var)
        self.assertIn("var_percentage", var)

    def test_calculate_var_insufficient_data(self):
        """Test VaR with insufficient data."""
        result = RiskService.calculate_var([0.01])
        self.assertIsNone(result)

    def test_calculate_cvar(self):
        """Test CVaR calculation."""
        returns = [-0.02, 0.01, -0.01, 0.02, -0.03, 0.015, 0.005, -0.015, -0.025, 0.01]
        cvar = RiskService.calculate_cvar(returns, 0.95, 1000000)

        self.assertIsNotNone(cvar)
        self.assertIn("cvar_value", cvar)
        self.assertIn("cvar_percentage", cvar)

    def test_calculate_max_drawdown(self):
        """Test max drawdown calculation."""
        prices = [100, 110, 105, 95, 90, 100, 85, 95]
        dd = RiskService.calculate_max_drawdown(prices)

        self.assertIsNotNone(dd)
        self.assertIn("max_drawdown", dd)
        # Max drawdown should be from 110 to 85 = 22.7%
        self.assertGreater(dd["max_drawdown"], 0.20)

    def test_calculate_beta(self):
        """Test beta calculation."""
        asset_returns = [0.02, -0.01, 0.03, -0.02, 0.01]
        market_returns = [0.01, -0.005, 0.02, -0.01, 0.005]
        beta = RiskService.calculate_beta(asset_returns, market_returns)

        self.assertIsNotNone(beta)
        # Asset has higher volatility, so beta should be > 1
        self.assertGreater(beta, 1.0)


if __name__ == "__main__":
    unittest.main()
