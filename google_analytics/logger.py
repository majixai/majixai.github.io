import logging
import requests
import os
import uuid

# GA4 Measurement Protocol endpoint
GA_ENDPOINT = "https://www.google-analytics.com/mp/collect"

# --- Logger Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='google_analytics/analytics.log',
    filemode='a'
)
logger = logging.getLogger(__name__)

def log_event(event_name, event_params={}, client_id=None):
    """
    Logs an event to a local file and sends it to Google Analytics 4.

    Args:
        event_name (str): The name of the event to track.
        event_params (dict, optional): A dictionary of parameters for the event. Defaults to {}.
        client_id (str, optional): A unique identifier for the client. If not provided, a random UUID is generated.
    """
    # Get sensitive data from environment variables inside the function
    api_secret = os.environ.get("GA_API_SECRET")
    measurement_id = os.environ.get("GA_MEASUREMENT_ID")

    if not api_secret or not measurement_id:
        error_msg = "GA_API_SECRET and GA_MEASUREMENT_ID environment variables must be set."
        logger.error(error_msg)
        print(f"ERROR: {error_msg}")
        return

    if client_id is None:
        client_id = str(uuid.uuid4())

    payload = {
        "client_id": client_id,
        "events": [{
            "name": event_name,
            "params": event_params
        }]
    }

    # Log to local file
    log_message = f"Event: '{event_name}', Params: {event_params}, Client ID: '{client_id}'"
    logger.info(log_message)
    print(f"Logged to file: {log_message}")

    # Send to Google Analytics
    try:
        response = requests.post(
            f"{GA_ENDPOINT}?api_secret={api_secret}&measurement_id={measurement_id}",
            json=payload
        )
        response.raise_for_status()  # Raise an exception for bad status codes
        print(f"Successfully sent event '{event_name}' to Google Analytics.")
        logger.info(f"GA Response: {response.status_code}")
    except requests.exceptions.RequestException as e:
        error_msg = f"Failed to send event to Google Analytics: {e}"
        logger.error(error_msg)
        print(f"ERROR: {error_msg}")


if __name__ == '__main__':
    print("Running example usage of the logger.")
    print("NOTE: This will fail unless you set the GA_API_SECRET and GA_MEASUREMENT_ID environment variables.")

    # Example usage:
    log_event(
        event_name='button_click',
        event_params={'button_name': 'submit_form', 'page_location': '/contact'},
        client_id='test_client_123'
    )
    log_event(
        event_name='page_view',
        event_params={'page_title': 'Home Page', 'page_location': '/'}
    )
