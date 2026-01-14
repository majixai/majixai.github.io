"""
Tests for sp_stdev.py - S&P 500 standard deviation calculation.
"""

import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np

from sp_stdev import fetch_sp500_weekly_data, calculate_stdev


class TestSPStdev(unittest.TestCase):
    """Test cases for S&P 500 standard deviation calculation."""

    def test_calculate_stdev_with_valid_data(self):
        """Test standard deviation calculation with known values."""
        data = pd.DataFrame({
            "Close": [100.0, 110.0, 105.0, 115.0, 120.0]
        })
        stdev = calculate_stdev(data)
        expected_stdev = np.std([100.0, 110.0, 105.0, 115.0, 120.0], ddof=1)
        self.assertAlmostEqual(stdev, expected_stdev, places=5)

    def test_calculate_stdev_with_empty_data(self):
        """Test that empty data raises ValueError."""
        data = pd.DataFrame({"Close": []})
        with self.assertRaises(ValueError):
            calculate_stdev(data)

    def test_calculate_stdev_custom_column(self):
        """Test standard deviation calculation with a custom column."""
        data = pd.DataFrame({
            "Close": [100.0, 110.0, 105.0],
            "Open": [99.0, 108.0, 103.0]
        })
        stdev_open = calculate_stdev(data, column="Open")
        expected_stdev = np.std([99.0, 108.0, 103.0], ddof=1)
        self.assertAlmostEqual(stdev_open, expected_stdev, places=5)

    @patch("sp_stdev.yf.Ticker")
    def test_fetch_sp500_weekly_data(self, mock_ticker):
        """Test fetching S&P 500 data from yfinance."""
        mock_instance = MagicMock()
        mock_ticker.return_value = mock_instance

        mock_data = pd.DataFrame({
            "Close": [4000.0, 4050.0, 4100.0],
            "Open": [3990.0, 4040.0, 4090.0],
            "High": [4010.0, 4060.0, 4110.0],
            "Low": [3980.0, 4030.0, 4080.0],
            "Volume": [1000000, 1100000, 1200000]
        })
        mock_instance.history.return_value = mock_data

        result = fetch_sp500_weekly_data(period="10y", interval="1wk")

        mock_ticker.assert_called_once_with("^GSPC")
        mock_instance.history.assert_called_once_with(period="10y", interval="1wk")
        self.assertEqual(len(result), 3)


if __name__ == "__main__":
    unittest.main()
