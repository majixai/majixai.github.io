# Stock Data Fetcher

## Description

This project contains a Python script (`fetcher.py`) designed to periodically fetch financial data and store it locally.

Specifically, `fetcher.py`:
- Attempts to fetch data for the NASDAQ:TSLA ticker from Google Finance.
- If fetching from Google Finance fails, it uses a placeholder URL (`https://jsonplaceholder.typicode.com/todos/1`) as a fallback to retrieve some data.
- Stores the fetched data (or an error message if fetching failed) along with a timestamp into an SQLite database file named `index.db`.
- The script runs in an infinite loop, fetching and storing data every 1 second until manually stopped.

## Setup and Usage

### Prerequisites

- Python 3.x

### Installation

1.  **Clone the repository or download the files.**
2.  **Navigate to the `stock_fetcher` directory:**
    ```bash
    cd path/to/your/repository/stock_fetcher
    ```
3.  **Install the `requests` library:**
    The script uses the `requests` library to make HTTP requests. If you don't have it installed, you can install it using pip:
    ```bash
    pip install requests
    ```

### Running the Script

Once the prerequisites are met and the `requests` library is installed, you can run the script using:

```bash
python fetcher.py
```

The script will start fetching data and printing log messages to the console indicating its actions. To stop the script, press `Ctrl+C`.

## Database

The script will create and use an SQLite database file named `index.db` within the `stock_fetcher` directory. This file will store the `timestamp` and `data` for each fetch attempt. If the file doesn't exist, the script will create it automatically.
