import pytest
from unittest.mock import patch, MagicMock
import os
import uuid
import requests

# Import the function to be tested
from google_analytics.logger import log_event

@pytest.fixture
def mock_env_vars(monkeypatch):
    """Fixture to set environment variables for GA."""
    monkeypatch.setenv("GA_API_SECRET", "test_secret")
    monkeypatch.setenv("GA_MEASUREMENT_ID", "test_measurement_id")

def test_log_event_missing_env_vars():
    """Test that the function handles missing environment variables gracefully."""
    with patch('builtins.print') as mock_print:
        log_event("test_event")
        mock_print.assert_called_with("ERROR: GA_API_SECRET and GA_MEASUREMENT_ID environment variables must be set.")

@patch('google_analytics.logger.requests.post')
def test_log_event_successful_call(mock_post, mock_env_vars):
    """Test a successful call to the Google Analytics API."""
    mock_response = MagicMock()
    mock_response.status_code = 204
    mock_post.return_value = mock_response

    event_name = "test_event"
    event_params = {"param1": "value1"}
    client_id = "test_client_id"

    log_event(event_name, event_params, client_id)

    # Check if requests.post was called with the correct arguments
    expected_url = "https://www.google-analytics.com/mp/collect?api_secret=test_secret&measurement_id=test_measurement_id"
    expected_payload = {
        "client_id": client_id,
        "events": [{"name": event_name, "params": event_params}]
    }
    mock_post.assert_called_once_with(expected_url, json=expected_payload)
    mock_response.raise_for_status.assert_called_once()

@patch('google_analytics.logger.requests.post')
def test_log_event_generates_client_id(mock_post, mock_env_vars):
    """Test that a client_id is generated if not provided."""
    mock_post.return_value = MagicMock(status_code=204)

    log_event("test_event")

    # Check that the payload contains a client_id
    call_args, call_kwargs = mock_post.call_args
    payload = call_kwargs.get('json', {})
    assert "client_id" in payload
    # Check if the client_id is a valid UUID
    try:
        uuid.UUID(payload["client_id"])
    except ValueError:
        pytest.fail("Generated client_id is not a valid UUID.")

@patch('google_analytics.logger.requests.post')
def test_log_event_api_failure(mock_post, mock_env_vars):
    """Test the handling of a failed API call."""
    mock_post.side_effect = requests.exceptions.RequestException("API is down")

    with patch('builtins.print') as mock_print:
        log_event("test_event")
        mock_print.assert_any_call("ERROR: Failed to send event to Google Analytics: API is down")
