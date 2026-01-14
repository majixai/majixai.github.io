#!/usr/bin/env python3
"""
YFinance Data Fetcher - Main Entry Point

This script fetches stock data from Yahoo Finance for hundreds of tickers,
stores it in compressed .dat files, and sends notifications via email and webhook.

Uses MVC design pattern:
- Model: Handles data fetching and storage
- View: Handles notifications (email and webhook)
- Controller: Orchestrates the operations

Usage:
    python main.py [options]

Environment Variables:
    SMTP_SERVER: SMTP server hostname
    SMTP_PORT: SMTP server port (default: 587)
    SMTP_USERNAME: SMTP authentication username
    SMTP_PASSWORD: SMTP authentication password
    SENDER_EMAIL: Email address to send from
    RECIPIENT_EMAILS: Comma-separated list of recipient emails
    WEBHOOK_URL: URL for webhook notifications
"""
import argparse
import os
import sys
import logging
from typing import List, Optional

# Add parent directory to path for imports when run directly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from controllers.data_controller import DataController
from tickers import TICKERS, TICKER_CATEGORIES

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_env_list(env_var: str, default: Optional[List[str]] = None) -> List[str]:
    """Get a comma-separated environment variable as a list."""
    value = os.environ.get(env_var, "")
    if value:
        return [item.strip() for item in value.split(",") if item.strip()]
    return default or []


def main():
    """Main entry point for the yfinance data fetcher."""
    parser = argparse.ArgumentParser(
        description="Fetch yfinance data for hundreds of tickers and store in .dat files."
    )
    parser.add_argument(
        "--period",
        default="1y",
        help="Data period (e.g., '1y', '6mo', '1mo'). Default: 1y"
    )
    parser.add_argument(
        "--interval",
        default="1d",
        help="Data interval (e.g., '1d', '1h', '5m'). Default: 1d"
    )
    parser.add_argument(
        "--output",
        help="Custom output filename for the .dat file"
    )
    parser.add_argument(
        "--webhook-url",
        help="Webhook URL for notifications (overrides env var)"
    )
    parser.add_argument(
        "--smtp-server",
        help="SMTP server hostname (overrides env var)"
    )
    parser.add_argument(
        "--smtp-port",
        type=int,
        default=587,
        help="SMTP server port. Default: 587"
    )
    parser.add_argument(
        "--sender-email",
        help="Email address to send from (overrides env var)"
    )
    parser.add_argument(
        "--recipient-emails",
        help="Comma-separated list of recipient emails (overrides env var)"
    )
    parser.add_argument(
        "--no-notifications",
        action="store_true",
        help="Disable all notifications"
    )
    parser.add_argument(
        "--tickers",
        help="Comma-separated list of specific tickers to fetch (overrides default list)"
    )
    parser.add_argument(
        "--category",
        choices=list(TICKER_CATEGORIES.keys()),
        help="Fetch only tickers from a specific category"
    )
    parser.add_argument(
        "--list-categories",
        action="store_true",
        help="List available ticker categories and exit"
    )
    parser.add_argument(
        "--list-tickers",
        action="store_true",
        help="List all tickers and exit"
    )
    parser.add_argument(
        "--show-data",
        action="store_true",
        help="Display data from the database"
    )
    parser.add_argument(
        "--show-ticker",
        help="Show data for a specific ticker"
    )
    parser.add_argument(
        "--show-summary",
        action="store_true",
        help="Show summary of data in the database"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Limit number of records to display (default: 100)"
    )

    args = parser.parse_args()

    # Handle list commands
    if args.list_categories:
        print("Available ticker categories:")
        for category, tickers in TICKER_CATEGORIES.items():
            print(f"  {category}: {len(tickers)} tickers")
        print(f"\nTotal unique tickers: {len(TICKERS)}")
        return 0

    if args.list_tickers:
        print(f"Total tickers: {len(TICKERS)}")
        for i, ticker in enumerate(TICKERS, 1):
            print(f"  {i:3d}. {ticker}")
        return 0

    # Handle data display commands
    script_dir = os.path.dirname(os.path.abspath(__file__))

    if args.show_summary:
        from models.data_model import DataModel
        model = DataModel(data_dir=script_dir)
        try:
            summary = model.get_data_summary()
            print("\n" + "=" * 60)
            print("DATABASE SUMMARY")
            print("=" * 60)
            print(f"Total Records: {summary['total_records']:,}")
            print(f"Unique Tickers: {summary['unique_tickers']}")
            print(f"Date Range: {summary['date_range']['min']} to {summary['date_range']['max']}")
            print("\nRecords per Ticker:")
            print("-" * 40)
            for ticker, count in list(summary['ticker_counts'].items())[:20]:
                print(f"  {ticker:10s}: {count:,} records")
            if len(summary['ticker_counts']) > 20:
                print(f"  ... and {len(summary['ticker_counts']) - 20} more tickers")
            print("=" * 60)
        except FileNotFoundError as e:
            logger.error(f"Error: {e}")
            return 1
        return 0

    if args.show_data or args.show_ticker:
        from models.data_model import DataModel
        model = DataModel(data_dir=script_dir)
        try:
            df = model.read_data(ticker=args.show_ticker, limit=args.limit)
            if df.empty:
                print("No data found in the database.")
                return 0

            print("\n" + "=" * 100)
            if args.show_ticker:
                print(f"DATA FOR TICKER: {args.show_ticker}")
            else:
                print("DATABASE CONTENTS")
            print("=" * 100)
            print(df.to_string(index=False))
            print("=" * 100)
            print(f"Total rows displayed: {len(df)}")
        except FileNotFoundError as e:
            logger.error(f"Error: {e}")
            return 1
        return 0

    # Determine which tickers to fetch
    if args.tickers:
        tickers_to_fetch = [t.strip() for t in args.tickers.split(",")]
    elif args.category:
        tickers_to_fetch = TICKER_CATEGORIES[args.category]
    else:
        tickers_to_fetch = TICKERS

    logger.info(f"Preparing to fetch {len(tickers_to_fetch)} tickers...")

    # Create controller - use current directory for data storage when run from yfinance_data dir
    controller = DataController(data_dir=script_dir)

    # Configure notifications from environment or command line
    smtp_server = args.smtp_server or os.environ.get("SMTP_SERVER")
    smtp_port = args.smtp_port or int(os.environ.get("SMTP_PORT", "587"))
    smtp_username = os.environ.get("SMTP_USERNAME")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    sender_email = args.sender_email or os.environ.get("SENDER_EMAIL")
    recipient_emails = (
        [e.strip() for e in args.recipient_emails.split(",")]
        if args.recipient_emails
        else get_env_list("RECIPIENT_EMAILS")
    )
    webhook_url = args.webhook_url or os.environ.get("WEBHOOK_URL")

    controller.configure_notifications(
        smtp_server=smtp_server,
        smtp_port=smtp_port,
        smtp_username=smtp_username,
        smtp_password=smtp_password,
        sender_email=sender_email,
        recipient_emails=recipient_emails,
        webhook_url=webhook_url,
    )

    # Fetch and store data
    results = controller.fetch_and_store(
        tickers=tickers_to_fetch,
        period=args.period,
        interval=args.interval,
        output_filename=args.output,
        send_notifications=not args.no_notifications,
    )

    # Log results
    if results.get("success"):
        summary = results.get("summary", {})
        logger.info(f"Success! Fetched {summary.get('total_tickers', 0)} tickers, "
                   f"{summary.get('total_records', 0)} records")
        logger.info(f"Output file: {results.get('output_file', 'N/A')}")
        return 0
    else:
        logger.error(f"Failed: {results.get('error', 'Unknown error')}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
