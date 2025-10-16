import os
import json
from datetime import datetime
import pandas as pd

ALERTS_DIR = 'tradingview-alerts'
OUTPUT_CSV = 'daily_signals.csv'

def aggregate_alerts():
    """
    Reads all JSON alert files from the ALERTS_DIR, aggregates the number
    of buy and sell signals per day, and saves the result to a CSV file.
    """
    if not os.path.exists(ALERTS_DIR):
        print(f"Directory '{ALERTS_DIR}' not found. Exiting.")
        # Create an empty CSV so the workflow doesn't fail
        pd.DataFrame(columns=['time', 'buy_signals', 'sell_signals']).to_csv(OUTPUT_CSV, index=False)
        return

    daily_counts = {}

    for filename in os.listdir(ALERTS_DIR):
        if filename.endswith('.json'):
            filepath = os.path.join(ALERTS_DIR, filename)
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)

                # Extract signal type and timestamp
                signal_type = data.get('signal_type', '').lower()
                timestamp_str = data.get('time')

                if not timestamp_str:
                    print(f"Skipping {filename}: missing 'time' field.")
                    continue

                # Get the date part of the timestamp (e.g., '2025-10-15')
                date_key = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00')).strftime('%Y-%m-%d')

                # Initialize day in dictionary if not present
                if date_key not in daily_counts:
                    daily_counts[date_key] = {'buy_signals': 0, 'sell_signals': 0}

                # Increment the appropriate counter
                if 'buy' in signal_type:
                    daily_counts[date_key]['buy_signals'] += 1
                elif 'sell' in signal_type:
                    daily_counts[date_key]['sell_signals'] += 1

            except json.JSONDecodeError:
                print(f"Skipping {filename}: could not decode JSON.")
            except Exception as e:
                print(f"An error occurred while processing {filename}: {e}")

    if not daily_counts:
        print("No valid alert files found to aggregate.")
        return

    # Convert dictionary to a list of records for DataFrame creation
    df_data = []
    for date, counts in daily_counts.items():
        df_data.append({
            'time': date,
            'buy_signals': counts['buy_signals'],
            'sell_signals': counts['sell_signals']
        })

    # Create and sort the DataFrame
    df = pd.DataFrame(df_data)
    df['time'] = pd.to_datetime(df['time'])
    df = df.sort_values(by='time')

    # Format time column for CSV
    df['time'] = df['time'].dt.strftime('%Y-%m-%d')

    # Save to CSV
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Successfully aggregated {len(df)} days of data into '{OUTPUT_CSV}'.")


if __name__ == '__main__':
    aggregate_alerts()