# YFinance Data Collector with Concurrent Processing

This directory contains scripts for fetching and storing yfinance ticker data with **async, parallel, and concurrent processing** for optimal performance.

## Features

- **Concurrent Data Fetching**: Uses `ThreadPoolExecutor` with configurable worker threads (default: 20)
- **Thread-Safe Database Operations**: SQLite operations protected with threading locks
- **Multiple Time Intervals**: 
  - 1-minute data for 7 days
  - 1-hour data for 10 days  
  - 1-day data for 2 years
- **Compressed Storage**: Data stored in SQLite databases with VACUUM compression
- **Progress Tracking**: Real-time progress updates with ETA calculations
- **Error Handling**: Robust error handling with detailed logging

## Files

### Main Scripts

- **`fetch_all_ticker_data.py`** - Main concurrent data fetcher
  - Processes all tickers from DATA.txt
  - Uses ThreadPoolExecutor for parallel processing
  - Implements thread-safe database operations
  - Provides progress updates and statistics

- **`monitor_progress.py`** - Progress monitoring tool
  - Shows current progress for each interval
  - Displays database statistics
  - Lists recently processed tickers

- **`query_data.py`** - Data query utility
  - Query interface for stored data
  - Get data for specific tickers and intervals
  - Calculate price changes and statistics

### Data Files

- **`DATA.txt`** - List of ticker symbols to fetch (343 unique tickers)
- **`dbs/`** - Directory containing compressed SQLite databases
  - `ticker_data_1m.db` - 1-minute interval data
  - `ticker_data_1h.db` - 1-hour interval data
  - `ticker_data_1d.db` - 1-day interval data

## Usage

### Fetch All Data (Concurrent)

```bash
# Start concurrent data collection with 20 workers
python3 fetch_all_ticker_data.py

# Run in background
nohup python3 fetch_all_ticker_data.py > fetch_concurrent.log 2>&1 &
```

### Monitor Progress

```bash
# Check current progress
python3 monitor_progress.py
```

### Query Data

```python
from query_data import YFinanceDataQuery

# Initialize query interface
query = YFinanceDataQuery()

# Get all available tickers
tickers = query.get_all_tickers('1d')

# Get data for a specific ticker
df_1m = query.get_1m_data('AAPL')  # 1-minute data
df_1h = query.get_1h_data('AAPL')  # 1-hour data  
df_1d = query.get_1d_data('AAPL')  # 1-day data

# Get latest price
latest = query.get_latest_price('AAPL', '1d')

# Get price change
change = query.get_price_change('AAPL')
```

## Performance

### Concurrent vs Sequential

- **Sequential Processing**: ~3-4 seconds per ticker
- **Concurrent Processing (20 workers)**: ~0.5-1 seconds per ticker
- **Speedup**: **3-6x faster** with concurrent processing

### Example Statistics

Processing 343 tickers:
- **Sequential**: ~20-25 minutes
- **Concurrent (20 workers)**: ~5-8 minutes

## Technical Details

### Concurrency Implementation

```python
# ThreadPoolExecutor for parallel ticker processing
with ThreadPoolExecutor(max_workers=20) as executor:
    future_to_ticker = {
        executor.submit(fetch_all_intervals_for_ticker, ticker): ticker 
        for ticker in tickers
    }
    
    for future in as_completed(future_to_ticker):
        results = future.result()
        # Process results...
```

### Thread-Safe Database Operations

```python
# Thread locks prevent concurrent write conflicts
with self.db_locks[db_path]:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.executemany(sql, data)
    conn.commit()
    conn.close()
```

### Rate Limiting

- Small delays (0.1s) between interval requests for same ticker
- Controlled by max_workers parameter to avoid API rate limits
- Adjustable based on system resources and API constraints

## Configuration

Adjust concurrent workers in `fetch_all_ticker_data.py`:

```python
# Increase for faster processing (may hit API rate limits)
collector = YFinanceDataCollector(max_workers=30)

# Decrease for more conservative approach
collector = YFinanceDataCollector(max_workers=10)
```

## Database Schema

Each database contains a table with the following structure:

```sql
CREATE TABLE ticker_data_XX (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    datetime TEXT NOT NULL,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume INTEGER,
    adj_close REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticker, datetime)
);

-- Indexes for fast queries
CREATE INDEX idx_ticker ON ticker_data_XX(ticker);
CREATE INDEX idx_datetime ON ticker_data_XX(datetime);
CREATE INDEX idx_ticker_datetime ON ticker_data_XX(ticker, datetime);
```

## Requirements

```
yfinance>=0.2.28
pandas>=2.0.0
numpy>=1.24.0
```

## Notes

- Databases are automatically compressed using VACUUM after data collection
- Duplicate ticker-datetime combinations are handled with INSERT OR REPLACE
- Invalid tickers (company names with spaces) are automatically filtered out
- Progress updates every 10 tickers with ETA calculations
- Full statistics displayed upon completion

## Monitoring Commands

```bash
# Check if process is running
ps aux | grep fetch_all_ticker_data

# Check progress
python3 monitor_progress.py

# View live logs
tail -f fetch_concurrent.log

# Check database file sizes
du -sh dbs/*.db
```

## Example Output

```
Processing 343 tickers with 20 concurrent workers
Progress: 50/343 (14.6%) | Rate: 0.83 tickers/sec | ETA: 5.9 min
Progress: 100/343 (29.2%) | Rate: 0.91 tickers/sec | ETA: 4.5 min
...
Total time: 6.23 minutes
Average rate: 0.92 tickers/sec

1-minute data (7 days):
  Success: 341
  Failed: 2
  Records: 930,348

1-hour data (10 days):
  Success: 341  
  Failed: 2
  Records: 23,870

1-day data (2 years):
  Success: 343
  Failed: 0
  Records: 172,186
```
