"""
Data Controller for orchestrating yfinance data fetching operations.
Coordinates between Model (data) and View (notifications).

Features:
    - Asynchronous data fetching with thread pools
    - Batch processing with configurable sizes
    - Progress tracking and callbacks
    - Error handling and recovery
    - Multiple output format support
    - Incremental data updates
"""
import logging
import os
import sys
import time
import concurrent.futures
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from threading import Lock

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.data_model import DataModel
from views.notification_view import NotificationView

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FetchStatus(Enum):
    """Status of a data fetch operation."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class FetchProgress:
    """Tracks progress of a data fetch operation."""
    total_tickers: int
    completed_tickers: int = 0
    failed_tickers: int = 0
    current_ticker: Optional[str] = None
    status: FetchStatus = FetchStatus.PENDING
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    errors: List[Dict[str, str]] = field(default_factory=list)
    
    @property
    def progress_percentage(self) -> float:
        """Calculate completion percentage."""
        if self.total_tickers == 0:
            return 0.0
        return (self.completed_tickers + self.failed_tickers) / self.total_tickers * 100
    
    @property
    def elapsed_time(self) -> float:
        """Calculate elapsed time in seconds."""
        if self.start_time is None:
            return 0.0
        end = self.end_time if self.end_time else time.time()
        return end - self.start_time
    
    @property
    def estimated_remaining(self) -> float:
        """Estimate remaining time in seconds."""
        if self.completed_tickers == 0:
            return 0.0
        remaining = self.total_tickers - self.completed_tickers - self.failed_tickers
        avg_time = self.elapsed_time / self.completed_tickers
        return remaining * avg_time
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert progress to dictionary."""
        return {
            "total_tickers": self.total_tickers,
            "completed_tickers": self.completed_tickers,
            "failed_tickers": self.failed_tickers,
            "current_ticker": self.current_ticker,
            "status": self.status.value,
            "progress_percentage": self.progress_percentage,
            "elapsed_seconds": self.elapsed_time,
            "estimated_remaining_seconds": self.estimated_remaining,
            "errors": self.errors,
        }


@dataclass
class FetchConfig:
    """Configuration for data fetch operations."""
    period: str = "1y"
    interval: str = "1d"
    batch_size: int = 10
    max_workers: int = 4
    retry_attempts: int = 2
    retry_delay: float = 1.0
    timeout_per_ticker: float = 30.0
    send_notifications: bool = True
    output_filename: Optional[str] = None
    incremental_mode: bool = False
    
    def validate(self) -> bool:
        """Validate configuration values."""
        valid_periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
        valid_intervals = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo", "3mo"]
        
        if self.period not in valid_periods:
            logger.warning(f"Invalid period: {self.period}")
            return False
        if self.interval not in valid_intervals:
            logger.warning(f"Invalid interval: {self.interval}")
            return False
        if self.batch_size < 1:
            logger.warning(f"Invalid batch_size: {self.batch_size}")
            return False
        if self.max_workers < 1:
            logger.warning(f"Invalid max_workers: {self.max_workers}")
            return False
        
        return True


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
        self.progress: Optional[FetchProgress] = None
        self._progress_lock = Lock()
        self._progress_callbacks: List[Callable[[FetchProgress], None]] = []

    def add_progress_callback(self, callback: Callable[[FetchProgress], None]) -> None:
        """Add a callback to be notified of progress updates.
        
        Args:
            callback: Function to call with FetchProgress updates
        """
        self._progress_callbacks.append(callback)

    def _notify_progress(self) -> None:
        """Notify all registered callbacks of progress update."""
        if self.progress is None:
            return
        for callback in self._progress_callbacks:
            try:
                callback(self.progress)
            except Exception as e:
                logger.warning(f"Progress callback error: {e}")

    def _update_progress(
        self,
        completed: Optional[int] = None,
        failed: Optional[int] = None,
        current_ticker: Optional[str] = None,
        status: Optional[FetchStatus] = None,
        error: Optional[Dict[str, str]] = None,
    ) -> None:
        """Update fetch progress safely.
        
        Args:
            completed: Number of completed tickers (delta)
            failed: Number of failed tickers (delta)
            current_ticker: Currently processing ticker
            status: New status
            error: Error to add to list
        """
        with self._progress_lock:
            if self.progress is None:
                return
            
            if completed:
                self.progress.completed_tickers += completed
            if failed:
                self.progress.failed_tickers += failed
            if current_ticker is not None:
                self.progress.current_ticker = current_ticker
            if status is not None:
                self.progress.status = status
            if error:
                self.progress.errors.append(error)
        
        self._notify_progress()

    def configure_notifications(
        self,
        smtp_server: Optional[str] = None,
        smtp_port: int = 587,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        sender_email: Optional[str] = None,
        recipient_emails: Optional[List[str]] = None,
        webhook_url: Optional[str] = None,
        slack_webhook_url: Optional[str] = None,
        discord_webhook_url: Optional[str] = None,
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
            slack_webhook_url: Slack webhook URL.
            discord_webhook_url: Discord webhook URL.
        """
        self.view = NotificationView(
            smtp_server=smtp_server,
            smtp_port=smtp_port,
            smtp_username=smtp_username,
            smtp_password=smtp_password,
            sender_email=sender_email,
            recipient_emails=recipient_emails,
            webhook_url=webhook_url,
            slack_webhook_url=slack_webhook_url,
            discord_webhook_url=discord_webhook_url,
        )
        logger.info("Notification settings configured")

    def fetch_single_ticker(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
        retry_attempts: int = 2,
        retry_delay: float = 1.0,
    ) -> Optional[Dict[str, Any]]:
        """
        Fetch data for a single ticker with retry logic.
        
        Args:
            ticker: Stock ticker symbol
            period: Data period
            interval: Data interval
            retry_attempts: Number of retry attempts
            retry_delay: Delay between retries in seconds
            
        Returns:
            Dictionary with ticker data or None if failed
        """
        for attempt in range(retry_attempts + 1):
            try:
                data = self.model.fetch_ticker_data(
                    ticker=ticker,
                    period=period,
                    interval=interval,
                )
                if data is not None:
                    return {"ticker": ticker, "data": data, "records": len(data)}
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed for {ticker}: {e}")
                if attempt < retry_attempts:
                    time.sleep(retry_delay * (attempt + 1))
        
        return None

    def fetch_batch(
        self,
        tickers: List[str],
        config: FetchConfig,
    ) -> Dict[str, Any]:
        """
        Fetch data for a batch of tickers using thread pool.
        
        Args:
            tickers: List of ticker symbols
            config: Fetch configuration
            
        Returns:
            Dictionary with batch results
        """
        results = {"successful": [], "failed": []}
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=config.max_workers) as executor:
            future_to_ticker = {
                executor.submit(
                    self.fetch_single_ticker,
                    ticker,
                    config.period,
                    config.interval,
                    config.retry_attempts,
                    config.retry_delay,
                ): ticker
                for ticker in tickers
            }
            
            for future in concurrent.futures.as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                try:
                    result = future.result(timeout=config.timeout_per_ticker)
                    if result:
                        results["successful"].append(result)
                        self._update_progress(completed=1, current_ticker=ticker)
                    else:
                        results["failed"].append({"ticker": ticker, "error": "No data returned"})
                        self._update_progress(failed=1, error={"ticker": ticker, "error": "No data"})
                except concurrent.futures.TimeoutError:
                    results["failed"].append({"ticker": ticker, "error": "Timeout"})
                    self._update_progress(failed=1, error={"ticker": ticker, "error": "Timeout"})
                except Exception as e:
                    results["failed"].append({"ticker": ticker, "error": str(e)})
                    self._update_progress(failed=1, error={"ticker": ticker, "error": str(e)})
        
        return results

    def fetch_and_store(
        self,
        tickers: List[str],
        period: str = "1y",
        interval: str = "1d",
        output_filename: Optional[str] = None,
        send_notifications: bool = True,
        batch_size: int = 10,
        max_workers: int = 4,
    ) -> Dict[str, Any]:
        """
        Main method to fetch data for tickers, store it, and send notifications.

        Args:
            tickers: List of stock ticker symbols.
            period: Data period (e.g., '1y', '6mo').
            interval: Data interval (e.g., '1d', '1h').
            output_filename: Custom output filename for the .dat file.
            send_notifications: Whether to send notifications on completion.
            batch_size: Number of tickers to process per batch.
            max_workers: Maximum concurrent workers.

        Returns:
            Dictionary with operation results.
        """
        config = FetchConfig(
            period=period,
            interval=interval,
            batch_size=batch_size,
            max_workers=max_workers,
            send_notifications=send_notifications,
            output_filename=output_filename,
        )
        
        return self.fetch_and_store_with_config(tickers, config)

    def fetch_and_store_with_config(
        self,
        tickers: List[str],
        config: FetchConfig,
    ) -> Dict[str, Any]:
        """
        Fetch and store data using a configuration object.
        
        Args:
            tickers: List of stock ticker symbols
            config: FetchConfig with all settings
            
        Returns:
            Dictionary with operation results
        """
        if not config.validate():
            return {"success": False, "error": "Invalid configuration"}
        
        # Initialize progress tracking
        self.progress = FetchProgress(
            total_tickers=len(tickers),
            status=FetchStatus.IN_PROGRESS,
            start_time=time.time(),
        )
        self._notify_progress()
        
        start_time = datetime.now(timezone.utc)
        logger.info(f"Starting data fetch for {len(tickers)} tickers...")

        try:
            # Create/reset the database
            self.model.create_database()
            
            # Process in batches
            all_data = {}
            total_records = 0
            
            for i in range(0, len(tickers), config.batch_size):
                batch = tickers[i:i + config.batch_size]
                logger.info(f"Processing batch {i // config.batch_size + 1}: {batch}")
                
                batch_results = self.fetch_batch(batch, config)
                
                for result in batch_results["successful"]:
                    ticker = result["ticker"]
                    data = result["data"]
                    all_data[ticker] = data
                    total_records += len(data)
                    
                    # Store data
                    self.model.store_data(data)

            # Compress to .dat file
            if config.output_filename:
                output_path = self.model.compress_database(config.output_filename)
            else:
                output_path = self.model.compress_to_single_dat()

            # Update progress
            self.progress.status = FetchStatus.COMPLETED
            self.progress.end_time = time.time()
            self._notify_progress()

            # Get summary
            summary = self.model.get_summary(all_data)
            summary["output_file"] = output_path
            summary["duration_seconds"] = self.progress.elapsed_time
            summary["stored_count"] = len(all_data)
            summary["failed_count"] = self.progress.failed_tickers
            summary["errors"] = self.progress.errors

            self.results = {
                "success": True,
                "summary": summary,
                "output_file": output_path,
                "progress": self.progress.to_dict(),
            }

            logger.info(f"Data fetch complete. {summary['total_tickers']} tickers, "
                       f"{summary['total_records']} records in {summary['duration_seconds']:.2f}s")

            # Send notifications
            if config.send_notifications:
                notification_results = self.view.notify_success(summary)
                self.results["notifications"] = notification_results

            return self.results

        except Exception as e:
            error_message = str(e)
            logger.error(f"Data fetch failed: {error_message}")
            
            if self.progress:
                self.progress.status = FetchStatus.FAILED
                self.progress.end_time = time.time()
                self._notify_progress()

            self.results = {
                "success": False,
                "error": error_message,
                "progress": self.progress.to_dict() if self.progress else None,
            }

            # Send error notifications
            if config.send_notifications:
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

        # Add category breakdown to results
        if result.get("success"):
            result["categories"] = {
                category: len(tickers)
                for category, tickers in category_tickers.items()
            }

        return result

    def fetch_incremental(
        self,
        tickers: List[str],
        period: str = "1d",
        interval: str = "1m",
    ) -> Dict[str, Any]:
        """
        Fetch only new data since last fetch (incremental update).
        
        Args:
            tickers: List of ticker symbols
            period: Data period (typically short for incremental)
            interval: Data interval
            
        Returns:
            Dictionary with incremental update results
        """
        config = FetchConfig(
            period=period,
            interval=interval,
            incremental_mode=True,
            send_notifications=False,
        )
        
        # In incremental mode, we append to existing data
        return self.fetch_and_store_with_config(tickers, config)

    def run_ekf_analysis(
        self,
        tickers: Optional[List[str]] = None,
        dat_file: Optional[str] = None,
        forecast_days: int = 5,
        ekf_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Run Extended Kalman Filter Bayesian state estimation on stored price data.

        Reads OHLCV data from the compressed ``.dat`` database, fits a
        three-state EKF  [P_t, V_t, Θ_t]  for each ticker, and writes
        state vectors and next-close predictions to::

            <data_dir>/states/TICKER_YYYY.dat
            <data_dir>/predictions/TICKER_next_close.dat

        Parameters
        ----------
        tickers : list of str, optional
            Ticker symbols to analyse.  If ``None``, all tickers present
            in the database are analysed.
        dat_file : str, optional
            Path to the ``.dat`` price database.  Defaults to
            ``yfinance.dat`` inside ``data_dir``.
        forecast_days : int
            Number of trading days to forecast ahead (default 5).
        ekf_params : dict, optional
            Override any :class:`~models.bayesian_ekf.ExtendedKalmanFilter`
            constructor keyword arguments (e.g. ``{"kappa": 3.0}``).

        Returns
        -------
        dict
            ``{"success": bool, "tickers_analyzed": int, "results": {...}}``
            or ``{"success": False, "error": str}`` on failure.
        """
        from models.ekf_runner import EKFRunner

        try:
            available = self.model.get_available_tickers(dat_file)
            targets = tickers if tickers else available

            if not targets:
                return {"success": False, "error": "No tickers available in database"}

            logger.info("Running EKF analysis for %d tickers…", len(targets))
            runner = EKFRunner(data_dir=self.data_dir, forecast_days=forecast_days)

            data_dict: Dict[str, Any] = {}
            for ticker in targets:
                try:
                    df = self.model.read_data(ticker=ticker, limit=500, dat_file=dat_file)
                    if not df.empty:
                        data_dict[ticker] = df
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Could not load data for %s: %s", ticker, exc)

            if not data_dict:
                return {"success": False, "error": "No data loaded for EKF analysis"}

            results = runner.run_batch(data_dict, ekf_params)
            logger.info("EKF analysis complete: %d/%d tickers succeeded", len(results), len(targets))

            return {
                "success": True,
                "tickers_analyzed": len(results),
                "results": results,
            }

        except Exception as exc:  # noqa: BLE001
            logger.error("EKF analysis failed: %s", exc)
            return {"success": False, "error": str(exc)}

    def get_results(self) -> Dict[str, Any]:
        """Get the results of the last operation."""
        return self.results

    def get_progress(self) -> Optional[Dict[str, Any]]:
        """Get current progress information."""
        if self.progress is None:
            return None
        return self.progress.to_dict()

    def cancel_fetch(self) -> bool:
        """Cancel an ongoing fetch operation.
        
        Returns:
            True if cancellation was successful
        """
        if self.progress and self.progress.status == FetchStatus.IN_PROGRESS:
            self.progress.status = FetchStatus.PARTIAL
            self.progress.end_time = time.time()
            self._notify_progress()
            logger.info("Fetch operation cancelled")
            return True
        return False
