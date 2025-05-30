import sqlite3
import time
import datetime # Added for ISO 8601 timestamp
# requests library needs to be installed. You can install it using: pip install requests
import requests

# --- Configuration ---
PRIMARY_URL = "https://finance.google.com/finance?q=NASDAQ:TSLA"
FALLBACK_URL = "https://jsonplaceholder.typicode.com/todos/1" # Placeholder for testing
DB_NAME = "stock_fetcher/index.db" # Store DB in the same directory
TABLE_NAME = "stock_data"

# --- Functions ---

def fetch_data(url, fallback_url):
    """
    Fetches data from the given URL.
    If the primary URL fails, it attempts to fetch from the fallback URL.
    """
    try:
        response = requests.get(url, timeout=10) # Added timeout
        response.raise_for_status()  # Raises an HTTPError for bad responses (4XX or 5XX)
        # For Google Finance, we'd ideally parse the HTML to get the price.
        # For this example, we'll just store the first 500 chars of the content
        # as a proxy for the data, since parsing HTML robustly is complex.
        # If it were a JSON API, we'd do response.json()
        data_content = response.text[:500]
        print(f"Successfully fetched data from: {url}")
        return data_content
    except requests.exceptions.RequestException as e:
        print(f"Error fetching from {url}: {e}")
        print(f"Falling back to: {fallback_url}")
        try:
            response = requests.get(fallback_url, timeout=10)
            response.raise_for_status()
            data_content = response.text # Store the full content of fallback
            print(f"Successfully fetched data from fallback: {fallback_url}")
            return data_content
        except requests.exceptions.RequestException as fallback_e:
            print(f"Error fetching from fallback {fallback_url}: {fallback_e}")
            return f"Failed to fetch from both primary and fallback URLs. Main error: {e}, Fallback error: {fallback_e}"

def init_db(db_name):
    """
    Initializes the SQLite database and creates the stock_data table if it doesn't exist.
    """
    try:
        conn = sqlite3.connect(db_name)
        cursor = conn.cursor()
        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            timestamp TEXT NOT NULL,
            data TEXT
        )
        """)
        conn.commit()
        print(f"Database '{db_name}' initialized and table '{TABLE_NAME}' ensured.")
    except sqlite3.Error as e:
        print(f"Database error during initialization: {e}")
    finally:
        if conn:
            conn.close()

# --- Main Script ---
if __name__ == "__main__":
    init_db(DB_NAME)
    conn = None # Initialize conn to None

    try:
        while True:
            # 1. Fetch data
            fetched_content = fetch_data(PRIMARY_URL, FALLBACK_URL)

            # 2. Get current timestamp
            current_timestamp = datetime.datetime.now().isoformat()

            # 3. Connect to database and insert data
            try:
                conn = sqlite3.connect(DB_NAME)
                cursor = conn.cursor()
                cursor.execute(f"INSERT INTO {TABLE_NAME} (timestamp, data) VALUES (?, ?)",
                               (current_timestamp, fetched_content))
                conn.commit()
                print(f"Timestamp: {current_timestamp} - Data: '{fetched_content[:100]}...' - Stored in database.") # Log snippet
            except sqlite3.Error as e:
                print(f"Database error during data insertion: {e}")
            finally:
                if conn:
                    conn.close()

            # 4. Wait for 1 second
            time.sleep(1)

    except KeyboardInterrupt:
        print("\nScript interrupted by user. Exiting gracefully...")
    except Exception as e: # Catch any other unexpected errors in the main loop
        print(f"An unexpected error occurred in the main loop: {e}")
    finally:
        if conn: # Ensure connection is closed if loop breaks unexpectedly
            conn.close()
        print("Script finished.")
