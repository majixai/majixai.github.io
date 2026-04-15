"""
tests/stock_fetcher/test_fetcher.py

Unit tests for ``stock_fetcher/fetcher.py``.

The module makes HTTP requests and writes to SQLite. All external
calls are mocked so the tests run without network access or disk I/O.

Covers:
- fetch_data: success path, fallback on primary failure, total failure.
- init_db: database and table creation.
"""
import os
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

# Ensure stock_fetcher is importable
_SF_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "stock_fetcher",
)
if _SF_DIR not in sys.path:
    sys.path.insert(0, _SF_DIR)

import fetcher


class TestFetchData(unittest.TestCase):
    """Tests for ``fetcher.fetch_data``."""

    def _mock_response(self, text="ok"):
        mock = MagicMock()
        mock.raise_for_status.return_value = None
        mock.text = text
        return mock

    @patch("fetcher.requests.get")
    def test_success_from_primary(self, mock_get):
        """Successful primary fetch returns the first 500 chars of the body."""
        body = "A" * 600
        mock_get.return_value = self._mock_response(text=body)

        result = fetcher.fetch_data("http://primary", "http://fallback")

        mock_get.assert_called_once()
        self.assertEqual(result, body[:500])

    @patch("fetcher.requests.get")
    def test_fallback_on_primary_failure(self, mock_get):
        """When primary fails, the fallback URL is tried and its content returned."""
        import requests as _req

        fallback_body = "fallback content"
        fallback_mock = self._mock_response(text=fallback_body)

        # First call raises, second call returns the fallback response
        mock_get.side_effect = [
            _req.exceptions.RequestException("primary down"),
            fallback_mock,
        ]

        result = fetcher.fetch_data("http://primary", "http://fallback")

        self.assertEqual(mock_get.call_count, 2)
        self.assertEqual(result, fallback_body)

    @patch("fetcher.requests.get")
    def test_both_fail_returns_error_string(self, mock_get):
        """When both URLs fail, a descriptive error string is returned."""
        import requests as _req

        mock_get.side_effect = _req.exceptions.RequestException("all down")
        result = fetcher.fetch_data("http://primary", "http://fallback")

        self.assertIn("Failed", result)

    @patch("fetcher.requests.get")
    def test_primary_returns_truncated_content(self, mock_get):
        """Body shorter than 500 chars is returned in full."""
        body = "short body"
        mock_get.return_value = self._mock_response(text=body)
        result = fetcher.fetch_data("http://primary", "http://fallback")
        self.assertEqual(result, body)


class TestInitDb(unittest.TestCase):
    """Tests for ``fetcher.init_db``."""

    def test_creates_table(self):
        """init_db creates the stock_data table in a temporary database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name

        try:
            fetcher.init_db(db_path)
            conn = sqlite3.connect(db_path)
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_data'"
            )
            self.assertIsNotNone(cursor.fetchone())
            conn.close()
        finally:
            os.unlink(db_path)

    def test_idempotent_create(self):
        """Calling init_db twice does not raise (IF NOT EXISTS)."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name

        try:
            fetcher.init_db(db_path)
            fetcher.init_db(db_path)  # should not raise
        finally:
            os.unlink(db_path)

    def test_table_has_expected_columns(self):
        """The stock_data table has timestamp and data columns."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name

        try:
            fetcher.init_db(db_path)
            conn = sqlite3.connect(db_path)
            info = conn.execute("PRAGMA table_info(stock_data)").fetchall()
            conn.close()
            col_names = {row[1] for row in info}
            self.assertIn("timestamp", col_names)
            self.assertIn("data", col_names)
        finally:
            os.unlink(db_path)

    def test_direct_insert_after_init(self):
        """After init_db, we can directly insert a row into the table."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = f.name

        try:
            fetcher.init_db(db_path)
            conn = sqlite3.connect(db_path)
            conn.execute(
                "INSERT INTO stock_data (timestamp, data) VALUES (?, ?)",
                ("2024-01-01T00:00:00", "test"),
            )
            conn.commit()
            count = conn.execute("SELECT COUNT(*) FROM stock_data").fetchone()[0]
            conn.close()
            self.assertEqual(count, 1)
        finally:
            os.unlink(db_path)


if __name__ == "__main__":
    unittest.main()
