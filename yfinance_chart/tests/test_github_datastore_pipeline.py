import argparse
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import requests

from yfinance_chart import github_datastore_pipeline as pipeline


class TestGasWebhookIntegration(unittest.TestCase):
    def test_send_gas_webhook_no_url(self):
        result = pipeline.send_gas_webhook("", {"x": 1})
        self.assertFalse(result)

    @patch("yfinance_chart.github_datastore_pipeline.requests.post")
    def test_send_gas_webhook_success(self, mock_post):
        response = MagicMock()
        response.raise_for_status.return_value = None
        response.status_code = 200
        mock_post.return_value = response

        payload = {"event": "yfinance_datastore_run"}
        result = pipeline.send_gas_webhook("https://example.com/webhook", payload)

        self.assertTrue(result)
        mock_post.assert_called_once()

    @patch("yfinance_chart.github_datastore_pipeline.requests.post")
    def test_send_gas_webhook_failure(self, mock_post):
        mock_post.side_effect = requests.RequestException("boom")
        payload = {"event": "yfinance_datastore_run"}
        result = pipeline.send_gas_webhook("https://example.com/webhook", payload)
        self.assertFalse(result)


class TestRunOnceWebhookPayload(unittest.TestCase):
    @patch("yfinance_chart.github_datastore_pipeline.send_gas_webhook")
    @patch("yfinance_chart.github_datastore_pipeline._git_value")
    @patch("yfinance_chart.github_datastore_pipeline.process_ticker")
    def test_run_once_posts_webhook_with_git_context(self, mock_process_ticker, mock_git_value, mock_send_webhook):
        mock_process_ticker.return_value = {
            "ticker": "SPY",
            "rows": 22,
            "appended_rows": 1,
            "patterns": 20,
            "sha256": "abc",
            "csv": "x.csv",
            "dat": "x.dat",
            "manifest": "x.json",
            "plot": "x.png",
        }
        mock_git_value.side_effect = ["majixai.github.io", "main", "deadbeef", "https://github.com/majixai/majixai.github.io.git"]
        mock_send_webhook.return_value = True

        with tempfile.TemporaryDirectory() as tmp_dir:
            dirs = pipeline.ensure_dirs(Path(tmp_dir) / "github_data")
            args = argparse.Namespace(
                tickers=["SPY"],
                period="1mo",
                interval="1d",
                workers=1,
                gas_webhook_url="https://script.google.com/macros/s/test/exec",
                gas_calendar=False,
                gas_gmail=False,
                gas_drive_compression=False,
                gas_calendar_id="",
                gas_calendar_title="",
                gas_gmail_to="",
                gas_gmail_subject="",
                gas_gmail_body="",
                gas_drive_folder_id="",
                git_add=False,
                loop_minutely=False,
                loop_seconds=60,
                base_dir=str(Path(tmp_dir) / "github_data"),
            )

            result = pipeline.run_once(args, dirs)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]["ticker"], "SPY")

            mock_send_webhook.assert_called_once()
            call_args = mock_send_webhook.call_args[0]
            self.assertEqual(call_args[0], "https://script.google.com/macros/s/test/exec")
            payload = call_args[1]

            self.assertEqual(payload["event"], "yfinance_datastore_run")
            self.assertEqual(payload["git"]["repo"], "majixai.github.io")
            self.assertEqual(payload["git"]["branch"], "main")
            self.assertEqual(payload["git"]["commit"], "deadbeef")
            self.assertEqual(payload["summary"][0]["ticker"], "SPY")

            summary_log = Path(tmp_dir) / "github_data" / "summary_log.jsonl"
            self.assertTrue(summary_log.exists())
            lines = summary_log.read_text(encoding="utf-8").strip().splitlines()
            self.assertGreaterEqual(len(lines), 1)
            parsed = json.loads(lines[-1])
            self.assertIn("run_utc", parsed)
            self.assertEqual(parsed["items"][0]["ticker"], "SPY")


if __name__ == "__main__":
    unittest.main()
