import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Adjust the path to import the script from the parent directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'yfinance_data')))

from fetch_data import send_webhook_notification

class TestFetchData(unittest.TestCase):

    @patch('fetch_data.requests.post')
    def test_send_webhook_notification_success(self, mock_post):
        """
        Tests that the webhook notification is sent successfully.
        """
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        test_url = "https://fake-webhook.com/test"
        send_webhook_notification(test_url)

        mock_post.assert_called_once()
        # Verify that the URL passed to the mock is the one we specified
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], test_url)

    @patch('fetch_data.requests.post')
    def test_send_webhook_notification_no_url(self, mock_post):
        """
        Tests that no request is sent if the URL is empty or None.
        """
        send_webhook_notification(None)
        mock_post.assert_not_called()

        send_webhook_notification("")
        mock_post.assert_not_called()

if __name__ == '__main__':
    unittest.main()
