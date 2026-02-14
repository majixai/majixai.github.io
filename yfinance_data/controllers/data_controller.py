"""
Data Controller for orchestrating yfinance data fetching operations.
Coordinates between Model (data) and View (notifications).
"""
import logging
import os
import sys
from datetime import datetime
from typing import List, Optional, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.data_model import DataModel
from views.notification_view import NotificationView

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DataController:
    """Controller class for orchestrating data fetch operations."""

    def __init__(
        self,
        model: Optional[DataModel] = None,
        view: Optional[NotificationView] = None,
        data_dir: str = "yfinance_data",
    ):
        """
        Initialize the DataController.

        Args:
            model: DataModel instance (created if not provided).
            view: NotificationView instance (created if not provided).
            data_dir: Directory to store data files.
        """
        self.data_dir = data_dir
        self.model = model or DataModel(data_dir=data_dir)
        self.view = view or NotificationView()
        self.results: Dict[str, Any] = {}

    def configure_notifications(
        self,
        smtp_server: Optional[str] = None,
        smtp_port: int = 587,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        sender_email: Optional[str] = None,
        recipient_emails: Optional[List[str]] = None,
        webhook_url: Optional[str] = None,
    ) -> None:
        """
        Configure notification settings.

        Args:
            smtp_server: SMTP server hostname.
            smtp_port: SMTP server port.
            smtp_username: SMTP authentication username.
            smtp_password: SMTP authentication password.
            sender_email: Email address to send from.
            recipient_emails: List of recipient email addresses.
            webhook_url: Webhook URL for notifications.
        """
        self.view = NotificationView(
            smtp_server=smtp_server,
            smtp_port=smtp_port,
            smtp_username=smtp_username,
            smtp_password=smtp_password,
            sender_email=sender_email,
            recipient_emails=recipient_emails,
            webhook_url=webhook_url,
        )
        logger.info("Notification settings configured")

    def fetch_and_store(
        self,
        tickers: List[str],
        period: str = "1y",
        interval: str = "1d",
        output_filename: Optional[str] = None,
        send_notifications: bool = True,
    ) -> Dict[str, Any]:
        """
        Main method to fetch data for tickers, store it, and send notifications.

        Args:
            tickers: List of stock ticker symbols.
            period: Data period (e.g., '1y', '6mo').
            interval: Data interval (e.g., '1d', '1h').
            output_filename: Custom output filename for the .dat file.
            send_notifications: Whether to send notifications on completion.

        Returns:
            Dictionary with operation results.
        """
        start_time = datetime.now()
        logger.info(f"Starting data fetch for {len(tickers)} tickers...")

        try:
            # Create/reset the database
            self.model.create_database()

            # Fetch data for all tickers
            data_dict = self.model.fetch_multiple_tickers(
                tickers=tickers,
                period=period,
                interval=interval
            )

            # Store data in database
            stored_count = self.model.store_multiple(data_dict)

            # Compress to .dat file
            if output_filename:
                output_path = self.model.compress_database(output_filename)
            else:
                output_path = self.model.compress_to_single_dat()

            # Get summary
            summary = self.model.get_summary(data_dict)
            summary["output_file"] = output_path
            summary["duration_seconds"] = (datetime.now() - start_time).total_seconds()
            summary["stored_count"] = stored_count

            self.results = {
                "success": True,
                "summary": summary,
                "output_file": output_path,
            }

            logger.info(f"Data fetch complete. {summary['total_tickers']} tickers, "
                       f"{summary['total_records']} records in {summary['duration_seconds']:.2f}s")

            # Send notifications
            if send_notifications:
                notification_results = self.view.notify_success(summary)
                self.results["notifications"] = notification_results

            return self.results

        except Exception as e:
            error_message = str(e)
            logger.error(f"Data fetch failed: {error_message}")

            self.results = {
                "success": False,
                "error": error_message,
            }

            # Send error notifications
            if send_notifications:
                notification_results = self.view.notify_error(error_message)
                self.results["notifications"] = notification_results

            return self.results

        finally:
            self.model.close()

    def fetch_by_category(
        self,
        category_tickers: Dict[str, List[str]],
        period: str = "1y",
        interval: str = "1d",
        send_notifications: bool = True,
    ) -> Dict[str, Any]:
        """
        Fetch data organized by ticker categories.

        Args:
            category_tickers: Dictionary mapping category names to ticker lists.
            period: Data period.
            interval: Data interval.
            send_notifications: Whether to send notifications.

        Returns:
            Dictionary with operation results for all categories.
        """
        all_results = {}
        all_tickers = []

        for category, tickers in category_tickers.items():
            all_tickers.extend(tickers)

        # Deduplicate tickers
        unique_tickers = list(dict.fromkeys(all_tickers))

        result = self.fetch_and_store(
            tickers=unique_tickers,
            period=period,
            interval=interval,
            send_notifications=send_notifications
        )

        return result

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the last operation."""
        return self.results
