# YFinance Data

A Python-based Progressive Web App (PWA) that fetches historical and real-time price data for 1 300+ stock tickers using [yfinance](https://pypi.org/project/yfinance/), stores the data in a compressed SQLite `.dat` file, and serves it to a browser-based viewer with charting support.

## Architecture (MVC)

```
yfinance_data/
├── main.py                   # CLI entry point
├── fetch_data.py             # Legacy standalone fetcher (webhook support)
├── tickers.py                # 1 300+ tickers grouped by sector/index/category
├── requirements.txt          # Python dependencies
├── controllers/
│   └── data_controller.py    # Orchestrates fetch, store, notify; progress tracking
├── models/
│   ├── data_model.py         # SQLite + gzip storage; yfinance fetch per ticker
│   ├── bayesian_ekf.py       # Bayesian Extended Kalman Filter for price smoothing
│   └── ekf_runner.py         # Runs EKF over fetched price series
├── views/
│   └── notification_view.py  # Email, webhook (Discord/Slack), SMS, push notifications
├── tests/                    # Unit tests
├── index.html                # Browser viewer (PWA)
├── script.js                 # Client-side data decompression & Chart.js rendering
├── style.css                 # Styling
├── manifest.json             # PWA manifest
└── sw.js                     # Service worker for offline support
```

## Features

- **Batch async fetching** — concurrent ticker downloads via `ThreadPoolExecutor` with configurable batch size and progress callbacks.
- **Compressed storage** — data is stored as gzip-compressed SQLite in `yfinance.dat` for efficient GitHub commits and client-side loading.
- **Bayesian EKF** — optional Extended Kalman Filter smoothing applied to price series.
- **Notifications** — email (HTML templates), webhook (Discord/Slack/custom), SMS via Twilio, and push notifications; all with exponential-backoff retry.
- **Browser viewer** — PWA that decompresses `yfinance.dat` client-side (pako + sql.js) and renders interactive Chart.js charts.
- **Offline support** — service worker caches static assets for offline access.

## Usage

### Command-line

```bash
pip install -r requirements.txt
python main.py
# or with options:
python main.py --tickers AAPL MSFT --period 1y
```

### Environment Variables

| Variable | Description |
|---|---|
| `SMTP_SERVER` | SMTP hostname for email notifications |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USERNAME` | SMTP auth username |
| `SMTP_PASSWORD` | SMTP auth password |
| `SENDER_EMAIL` | From address |
| `RECIPIENT_EMAILS` | Comma-separated recipient list |
| `WEBHOOK_URL` | Webhook endpoint (Discord/Slack/custom) |

### GitHub Actions

The `yfinance_collector.yml` workflow fetches data on a schedule and commits `yfinance.dat` back to the repository. The `yfinance_data.yml` workflow triggers on pushes to `yfinance_data/**`, runs unit tests, then executes `fetch_data.py`.

### Browser viewer

Serve the directory with any static web server and open `index.html`. The viewer fetches `yfinance.dat`, decompresses it with [pako](https://github.com/nodeca/pako), queries it with [sql.js](https://sql.js.org/), and renders charts with [Chart.js](https://www.chartjs.org/).

## Dependencies

```
yfinance
pandas
requests
numpy
```

## Testing

```bash
python -m unittest yfinance_data/test_fetch_data.py
python -m unittest yfinance_data/test_sp_stdev.py
```

## Last Updated

Data sync — 2026-04-02.
