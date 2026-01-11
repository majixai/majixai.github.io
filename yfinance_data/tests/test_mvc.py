"""
Tests for the MVC components of the yfinance data fetcher.
"""
import unittest
from unittest.mock import patch, MagicMock
import os
import sys

import requests

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from views.notification_view import NotificationView
from tickers import TICKERS, TICKER_CATEGORIES, get_unique_tickers


class TestNotificationView(unittest.TestCase):
    """Tests for the NotificationView class."""

    def setUp(self):
        """Set up test fixtures."""
        self.view = NotificationView(
            smtp_server="smtp.test.com",
            smtp_port=587,
            smtp_username="test@test.com",
            smtp_password="password",
            sender_email="sender@test.com",
            recipient_emails=["recipient@test.com"],
            webhook_url="https://webhook.test.com/notify",
        )

    @patch('views.notification_view.requests.post')
    def test_send_webhook_success(self, mock_post):
        """Test successful webhook notification."""
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        payload = {"content": "Test message"}
        result = self.view.send_webhook(payload)

        self.assertTrue(result)
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://webhook.test.com/notify")

    @patch('views.notification_view.requests.post')
    def test_send_webhook_no_url(self, mock_post):
        """Test webhook notification with no URL configured."""
        view = NotificationView()
        result = view.send_webhook({"content": "Test"})

        self.assertFalse(result)
        mock_post.assert_not_called()

    @patch('views.notification_view.requests.post')
    def test_send_webhook_failure(self, mock_post):
        """Test webhook notification failure."""
        mock_post.side_effect = requests.exceptions.RequestException("Connection error")

        payload = {"content": "Test message"}
        result = self.view.send_webhook(payload)

        self.assertFalse(result)

    def test_format_summary_email(self):
        """Test email formatting from summary."""
        summary = {
            "total_tickers": 10,
            "total_records": 2500,
            "tickers": ["AAPL", "MSFT", "GOOGL"],
            "fetched_at": "2024-01-15T10:30:00",
            "output_file": "yfinance_data/yfinance.dat",
        }

        subject, plain_body, html_body = self.view.format_summary_email(summary)

        self.assertIn("10 Tickers", subject)
        self.assertIn("2500", plain_body)
        self.assertIn("AAPL", plain_body)
        self.assertIn("<html>", html_body)

    def test_format_webhook_payload(self):
        """Test webhook payload formatting."""
        summary = {
            "total_tickers": 10,
            "total_records": 2500,
            "tickers": ["AAPL", "MSFT"],
            "fetched_at": "2024-01-15T10:30:00",
            "output_file": "yfinance_data/yfinance.dat",
        }

        payload = self.view.format_webhook_payload(summary)

        self.assertIn("content", payload)
        self.assertIn("10 tickers", payload["content"])
        self.assertEqual(payload["username"], "YFinance Bot")


class TestTickers(unittest.TestCase):
    """Tests for the tickers module."""

    def test_tickers_list_not_empty(self):
        """Test that TICKERS list is not empty."""
        self.assertGreater(len(TICKERS), 0)

    def test_tickers_are_unique(self):
        """Test that all tickers in TICKERS are unique."""
        self.assertEqual(len(TICKERS), len(set(TICKERS)))

    def test_ticker_categories_not_empty(self):
        """Test that TICKER_CATEGORIES is not empty."""
        self.assertGreater(len(TICKER_CATEGORIES), 0)

    def test_each_category_has_tickers(self):
        """Test that each category has at least one ticker."""
        for category, tickers in TICKER_CATEGORIES.items():
            self.assertGreater(len(tickers), 0, f"Category {category} is empty")

    def test_get_unique_tickers(self):
        """Test the get_unique_tickers function."""
        unique = get_unique_tickers()
        self.assertEqual(len(unique), len(set(unique)))

    def test_minimum_ticker_count(self):
        """Test that we have at least 100 unique tickers (hundreds requirement)."""
        self.assertGreaterEqual(len(TICKERS), 100)

    def test_major_tickers_present(self):
        """Test that major tickers are present in the list."""
        major_tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"]
        for ticker in major_tickers:
            self.assertIn(ticker, TICKERS, f"Major ticker {ticker} not found")


class TestNotificationViewNoConfig(unittest.TestCase):
    """Tests for NotificationView with no configuration."""

    def test_notify_success_no_config(self):
        """Test notify_success with no configuration."""
        view = NotificationView()
        summary = {
            "total_tickers": 5,
            "total_records": 100,
            "tickers": ["AAPL"],
            "fetched_at": "2024-01-15T10:30:00",
        }

        results = view.notify_success(summary)

        # Both should be False since nothing is configured
        self.assertFalse(results["email"])
        self.assertFalse(results["webhook"])

    def test_notify_error_no_config(self):
        """Test notify_error with no configuration."""
        view = NotificationView()
        results = view.notify_error("Test error")

        self.assertFalse(results["email"])
        self.assertFalse(results["webhook"])


if __name__ == '__main__':
    unittest.main()
