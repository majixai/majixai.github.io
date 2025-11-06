# Google Analytics Integration

This directory contains scripts and configuration for integrating with Google Analytics using the Measurement Protocol (GA4).

## `logger.py`

This script provides a logging mechanism to send analytics events directly to Google Analytics from a server-side application.

### Prerequisites

Before using this script, you must have:
1.  A Google Analytics 4 property.
2.  A **Measurement ID** from your GA4 data stream.
3.  An **API Secret** for the Measurement Protocol.

You must set the following environment variables with your GA4 credentials:
- `GA_API_SECRET`
- `GA_MEASUREMENT_ID`

### Usage

To log and send an event, import and use the `log_event` function from the `logger` module:

```python
from logger import log_event

# Log an event with parameters and a specific client ID
log_event(
    event_name='button_click',
    event_params={'button_name': 'submit_form', 'page_location': '/contact'},
    client_id='user_12345'
)

# Log an event with a generated client ID
log_event(
    event_name='page_view',
    event_params={'page_title': 'Home Page', 'page_location': '/'}
)
```

Events will be sent to your Google Analytics property and also logged to the `analytics.log` file in this directory for debugging purposes.

## Testing

This project uses `pytest` for unit testing. To run the tests, first install the dependencies:

```bash
pip install -r google_analytics/requirements.txt
```

Then, from the root of the repository, run `pytest`:

```bash
pytest google_analytics/
```

## GitHub Actions Workflow

This directory includes a GitHub Actions workflow defined in `.github/workflows/analytics_event.yml`. This workflow automatically sends a `repository_push` event to Google Analytics whenever code is pushed to the `google_analytics` directory.

To use this workflow, you must configure the `GA_API_SECRET` and `GA_MEASUREMENT_ID` as secrets in your GitHub repository settings.
