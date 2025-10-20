import os
import gspread
from google.oauth2.service_account import Credentials
import pandas as pd
from datetime import datetime

def generate_report():
    """
    Fetches transaction data from a Google Sheet and generates a markdown report.
    """
    # --- Configuration ---
    # These values would typically be loaded from a config file or environment variables
    # For the GitHub Action, these will be passed in as secrets.
    sheet_id = os.environ.get('LOG_SHEET_ID')
    google_creds_json = os.environ.get('GOOGLE_API_CREDENTIALS')

    if not sheet_id or not google_creds_json:
        print("Missing required environment variables: LOG_SHEET_ID, GOOGLE_API_CREDENTIALS")
        return

    # --- Authenticate with Google Sheets ---
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds = Credentials.from_service_account_info(eval(google_creds_json), scopes=scopes)
    client = gspread.authorize(creds)

    # --- Fetch Data ---
    sheet = client.open_by_key(sheet_id).sheet1
    data = sheet.get_all_records()
    df = pd.DataFrame(data)

    if df.empty:
        print("No data to generate a report.")
        return

    # --- Analyze Data ---
    total_transactions = len(df)
    successful_transactions = len(df[df['Status'] == 'Success'])
    failed_transactions = len(df[df['Status'] == 'Failed'])

    # Ensure 'Fraud Score' is numeric for calculations
    df['Fraud Score'] = pd.to_numeric(df['Fraud Score'], errors='coerce')
    average_fraud_score = df['Fraud Score'].mean()
    highest_fraud_score = df['Fraud Score'].max()

    # --- Generate Report ---
    report = f"""
# Transaction Report - {datetime.now().strftime('%Y-%m-%d')}

## Summary

| Metric                  | Value                  |
| ----------------------- | ---------------------- |
| Total Transactions      | {total_transactions}   |
| Successful Transactions | {successful_transactions} |
| Failed Transactions     | {failed_transactions}  |
| Average Fraud Score     | {average_fraud_score:.2f} |
| Highest Fraud Score     | {highest_fraud_score}  |

## Recent Failed Transactions

| Timestamp | Card Holder | Fraud Score | Reason |
| --------- | ----------- | ----------- | ------ |
"""
    # Get the last 5 failed transactions
    failed_df = df[df['Status'] == 'Failed'].tail(5)
    for index, row in failed_df.iterrows():
        report += f"| {row['Timestamp']} | {row['Card Holder']} | {row['Fraud Score']} | {row['Error Message']} |\n"

    # --- Write Report ---
    with open('visa_api/TRANSACTION_REPORT.md', 'w') as f:
        f.write(report)

    print("Report generated successfully.")

if __name__ == "__main__":
    generate_report()