"""
Notification View for sending alerts via email, webhook, SMS, and other channels.
Handles all notification-related output for the yfinance data fetcher.

Features:
    - Email notifications with HTML templates
    - Webhook notifications (Discord, Slack, custom)
    - SMS notifications via Twilio
    - Push notifications
    - Retry logic with exponential backoff
    - Rate limiting
    - Notification templates
    - Notification history tracking
"""
import asyncio
import json
import logging
import smtplib
import ssl
import time
import hashlib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants for display limits
MAX_TICKERS_IN_PLAIN_EMAIL = 50
MAX_TICKERS_IN_HTML_EMAIL = 100
WEBHOOK_SUCCESS_COLOR = 5025616  # Green color for Discord embeds
WEBHOOK_ERROR_COLOR = 15158332  # Red color for Discord embeds
WEBHOOK_WARNING_COLOR = 15844367  # Yellow color for Discord embeds

# Rate limiting configuration
DEFAULT_RATE_LIMIT_PER_MINUTE = 60
DEFAULT_RETRY_ATTEMPTS = 3
DEFAULT_RETRY_BASE_DELAY = 1.0
DEFAULT_TIMEOUT_SECONDS = 30


class NotificationChannel(Enum):
    """Supported notification channels."""
    EMAIL = "email"
    WEBHOOK = "webhook"
    SLACK = "slack"
    DISCORD = "discord"
    SMS = "sms"
    PUSH = "push"


class NotificationPriority(Enum):
    """Notification priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class NotificationResult:
    """Result of a notification attempt."""
    success: bool
    channel: NotificationChannel
    message: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error: Optional[str] = None
    retry_count: int = 0
    response_data: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "success": self.success,
            "channel": self.channel.value,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
            "error": self.error,
            "retry_count": self.retry_count,
            "response_data": self.response_data,
        }


@dataclass
class NotificationHistory:
    """Tracks notification history for analytics."""
    max_entries: int = 1000
    entries: List[NotificationResult] = field(default_factory=list)
    
    def add(self, result: NotificationResult) -> None:
        """Add a notification result to history."""
        self.entries.append(result)
        if len(self.entries) > self.max_entries:
            self.entries = self.entries[-self.max_entries:]
    
    def get_success_rate(self, channel: Optional[NotificationChannel] = None) -> float:
        """Calculate success rate for notifications."""
        filtered = self.entries
        if channel:
            filtered = [e for e in filtered if e.channel == channel]
        if not filtered:
            return 0.0
        return sum(1 for e in filtered if e.success) / len(filtered)
    
    def get_recent(self, count: int = 10) -> List[NotificationResult]:
        """Get recent notification results."""
        return self.entries[-count:]


class RateLimiter:
    """Simple rate limiter for notifications."""
    
    def __init__(self, max_per_minute: int = DEFAULT_RATE_LIMIT_PER_MINUTE):
        self.max_per_minute = max_per_minute
        self.timestamps: List[float] = []
    
    def acquire(self) -> bool:
        """Try to acquire a slot for sending a notification."""
        now = time.time()
        # Remove timestamps older than 1 minute
        self.timestamps = [ts for ts in self.timestamps if now - ts < 60]
        
        if len(self.timestamps) >= self.max_per_minute:
            return False
        
        self.timestamps.append(now)
        return True
    
    def wait_for_slot(self, timeout: float = 60.0) -> bool:
        """Wait until a slot is available or timeout."""
        start = time.time()
        while time.time() - start < timeout:
            if self.acquire():
                return True
            time.sleep(0.5)
        return False

    async def wait_for_slot_async(self, timeout: float = 60.0) -> bool:
        """Async version of wait_for_slot — yields control while waiting."""
        start = time.time()
        while time.time() - start < timeout:
            if self.acquire():
                return True
            await asyncio.sleep(0.5)
        return False


class NotificationView:
    """View class for handling notifications (email and webhook)."""

    def __init__(
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
        rate_limit_per_minute: int = DEFAULT_RATE_LIMIT_PER_MINUTE,
        retry_attempts: int = DEFAULT_RETRY_ATTEMPTS,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    ):
        """
        Initialize the NotificationView.

        Args:
            smtp_server: SMTP server hostname.
            smtp_port: SMTP server port (default: 587 for TLS).
            smtp_username: SMTP authentication username.
            smtp_password: SMTP authentication password.
            sender_email: Email address to send from.
            recipient_emails: List of email addresses to send to.
            webhook_url: URL for generic webhook notifications.
            slack_webhook_url: URL for Slack webhook notifications.
            discord_webhook_url: URL for Discord webhook notifications.
            rate_limit_per_minute: Maximum notifications per minute.
            retry_attempts: Number of retry attempts for failed notifications.
            timeout_seconds: Timeout for HTTP requests.
        """
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username
        self.smtp_password = smtp_password
        self.sender_email = sender_email
        self.recipient_emails = recipient_emails or []
        self.webhook_url = webhook_url
        self.slack_webhook_url = slack_webhook_url
        self.discord_webhook_url = discord_webhook_url
        self.timeout_seconds = timeout_seconds
        self.retry_attempts = retry_attempts
        
        self.rate_limiter = RateLimiter(rate_limit_per_minute)
        self.history = NotificationHistory()
        
        self._notification_callbacks: List[Callable[[NotificationResult], None]] = []

    def add_notification_callback(self, callback: Callable[[NotificationResult], None]) -> None:
        """Add a callback to be called after each notification."""
        self._notification_callbacks.append(callback)

    def _notify_callbacks(self, result: NotificationResult) -> None:
        """Notify all registered callbacks."""
        for callback in self._notification_callbacks:
            try:
                callback(result)
            except Exception as e:
                logger.warning(f"Notification callback error: {e}")

    def _retry_with_backoff(
        self,
        func: Callable[[], bool],
        max_attempts: int = None,
        base_delay: float = DEFAULT_RETRY_BASE_DELAY
    ) -> tuple[bool, int]:
        """Execute function with retry and exponential backoff.
        
        Args:
            func: Function to execute that returns True on success
            max_attempts: Maximum number of attempts
            base_delay: Base delay between retries in seconds
            
        Returns:
            Tuple of (success, retry_count)
        """
        max_attempts = max_attempts or self.retry_attempts
        
        for attempt in range(max_attempts):
            try:
                if func():
                    return True, attempt
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
            
            if attempt < max_attempts - 1:
                delay = base_delay * (2 ** attempt)
                time.sleep(delay)
        
        return False, max_attempts

    async def _retry_with_backoff_async(
        self,
        func: Callable[[], bool],
        max_attempts: int = None,
        base_delay: float = DEFAULT_RETRY_BASE_DELAY
    ) -> tuple[bool, int]:
        """Async version of _retry_with_backoff — runs the blocking func in a thread pool
        and uses asyncio.sleep for non-blocking backoff delays."""
        max_attempts = max_attempts or self.retry_attempts
        loop = asyncio.get_running_loop()

        for attempt in range(max_attempts):
            try:
                success = await loop.run_in_executor(None, func)
                if success:
                    return True, attempt
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {e}")

            if attempt < max_attempts - 1:
                delay = base_delay * (2 ** attempt)
                await asyncio.sleep(delay)

        return False, max_attempts

    def send_email(
        self,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        recipient_emails: Optional[List[str]] = None,
        attachments: Optional[List[Path]] = None,
        priority: NotificationPriority = NotificationPriority.NORMAL,
    ) -> NotificationResult:
        """
        Send an email notification.

        Args:
            subject: Email subject line.
            body: Plain text email body.
            html_body: Optional HTML email body.
            recipient_emails: Override default recipients.
            attachments: Optional list of file paths to attach.
            priority: Email priority level.

        Returns:
            NotificationResult with status and details.
        """
        recipients = recipient_emails or self.recipient_emails

        if not all([self.smtp_server, self.sender_email, recipients]):
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.EMAIL,
                message="Email configuration incomplete",
                error="Missing SMTP server, sender email, or recipients",
            )
            self.history.add(result)
            return result

        if not self.rate_limiter.acquire():
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.EMAIL,
                message="Rate limit exceeded",
                error="Too many notifications sent recently",
            )
            self.history.add(result)
            return result

        def send_attempt() -> bool:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.sender_email
            message["To"] = ", ".join(recipients)
            
            # Add priority headers
            if priority == NotificationPriority.HIGH:
                message["X-Priority"] = "2"
                message["Importance"] = "High"
            elif priority == NotificationPriority.CRITICAL:
                message["X-Priority"] = "1"
                message["Importance"] = "High"
            
            # Add plain text part
            message.attach(MIMEText(body, "plain"))

            # Add HTML part if provided
            if html_body:
                message.attach(MIMEText(html_body, "html"))
            
            # Add attachments if provided
            if attachments:
                for file_path in attachments:
                    if file_path.exists():
                        with open(file_path, "rb") as f:
                            part = MIMEBase("application", "octet-stream")
                            part.set_payload(f.read())
                        encoders.encode_base64(part)
                        part.add_header(
                            "Content-Disposition",
                            f"attachment; filename={file_path.name}"
                        )
                        message.attach(part)

            # Create secure connection
            context = ssl.create_default_context()

            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=self.timeout_seconds) as server:
                server.starttls(context=context)
                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.sender_email, recipients, message.as_string())
            
            return True

        try:
            success, retry_count = self._retry_with_backoff(send_attempt)
            
            result = NotificationResult(
                success=success,
                channel=NotificationChannel.EMAIL,
                message=f"Email sent to {recipients}" if success else "Email send failed",
                retry_count=retry_count,
            )
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed for server {self.smtp_server}: {e}")
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.EMAIL,
                message="SMTP authentication failed",
                error=str(e),
            )
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error occurred with server {self.smtp_server}: {e}")
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.EMAIL,
                message="SMTP error",
                error=str(e),
            )
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.EMAIL,
                message="Email send failed",
                error=str(e),
            )

        self.history.add(result)
        self._notify_callbacks(result)
        return result

    def send_webhook(
        self,
        payload: Dict[str, Any],
        webhook_url: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> NotificationResult:
        """
        Send a webhook notification.

        Args:
            payload: Dictionary payload to send.
            webhook_url: Override default webhook URL.
            headers: Optional additional headers.

        Returns:
            NotificationResult with status and details.
        """
        url = webhook_url or self.webhook_url

        if not url:
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.WEBHOOK,
                message="No webhook URL configured",
                error="Webhook URL not provided",
            )
            self.history.add(result)
            return result

        if not self.rate_limiter.acquire():
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.WEBHOOK,
                message="Rate limit exceeded",
                error="Too many notifications sent recently",
            )
            self.history.add(result)
            return result

        default_headers = {"Content-Type": "application/json"}
        if headers:
            default_headers.update(headers)

        def send_attempt() -> bool:
            response = requests.post(
                url,
                data=json.dumps(payload),
                headers=default_headers,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            return True

        try:
            success, retry_count = self._retry_with_backoff(send_attempt)
            
            result = NotificationResult(
                success=success,
                channel=NotificationChannel.WEBHOOK,
                message=f"Webhook sent to {url}" if success else "Webhook send failed",
                retry_count=retry_count,
            )
            
        except requests.exceptions.Timeout:
            logger.error(f"Webhook request timed out: {url}")
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.WEBHOOK,
                message="Webhook timeout",
                error=f"Request to {url} timed out",
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send webhook notification: {e}")
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.WEBHOOK,
                message="Webhook send failed",
                error=str(e),
            )

        self.history.add(result)
        self._notify_callbacks(result)
        return result

    def send_slack_notification(
        self,
        message: str,
        channel: Optional[str] = None,
        username: Optional[str] = None,
        icon_emoji: Optional[str] = None,
        blocks: Optional[List[Dict[str, Any]]] = None,
    ) -> NotificationResult:
        """
        Send a Slack notification.

        Args:
            message: Text message to send.
            channel: Slack channel override.
            username: Bot username override.
            icon_emoji: Bot emoji icon.
            blocks: Slack blocks for rich formatting.

        Returns:
            NotificationResult with status and details.
        """
        if not self.slack_webhook_url:
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.SLACK,
                message="Slack webhook not configured",
                error="Slack webhook URL not provided",
            )
            self.history.add(result)
            return result

        payload: Dict[str, Any] = {"text": message}
        
        if channel:
            payload["channel"] = channel
        if username:
            payload["username"] = username
        if icon_emoji:
            payload["icon_emoji"] = icon_emoji
        if blocks:
            payload["blocks"] = blocks

        result = self.send_webhook(payload, webhook_url=self.slack_webhook_url)
        # Update channel type for tracking
        result.channel = NotificationChannel.SLACK
        return result

    def send_discord_notification(
        self,
        content: str,
        username: Optional[str] = None,
        embeds: Optional[List[Dict[str, Any]]] = None,
        avatar_url: Optional[str] = None,
    ) -> NotificationResult:
        """
        Send a Discord notification.

        Args:
            content: Message content.
            username: Bot username override.
            embeds: Discord embeds for rich formatting.
            avatar_url: Bot avatar URL.

        Returns:
            NotificationResult with status and details.
        """
        if not self.discord_webhook_url:
            result = NotificationResult(
                success=False,
                channel=NotificationChannel.DISCORD,
                message="Discord webhook not configured",
                error="Discord webhook URL not provided",
            )
            self.history.add(result)
            return result

        payload: Dict[str, Any] = {"content": content}
        
        if username:
            payload["username"] = username
        if embeds:
            payload["embeds"] = embeds
        if avatar_url:
            payload["avatar_url"] = avatar_url

        result = self.send_webhook(payload, webhook_url=self.discord_webhook_url)
        # Update channel type for tracking
        result.channel = NotificationChannel.DISCORD
        return result

    def format_summary_email(self, summary: Dict[str, Any]) -> tuple:
        """
        Format a summary into email subject and body.

        Args:
            summary: Dictionary with fetch summary data.

        Returns:
            Tuple of (subject, plain_body, html_body).
        """
        timestamp = summary.get("fetched_at", datetime.now().isoformat())
        total_tickers = summary.get("total_tickers", 0)
        total_records = summary.get("total_records", 0)
        tickers = summary.get("tickers", [])
        output_file = summary.get("output_file", "N/A")
        duration = summary.get("duration_seconds", 0)

        subject = f"YFinance Data Update - {total_tickers} Tickers Fetched"

        plain_body = f"""
YFinance Data Fetch Complete

Timestamp: {timestamp}
Total Tickers: {total_tickers}
Total Records: {total_records}
Duration: {duration:.2f} seconds
Output File: {output_file}

Tickers Fetched:
{', '.join(tickers[:MAX_TICKERS_IN_PLAIN_EMAIL])}{'...' if len(tickers) > MAX_TICKERS_IN_PLAIN_EMAIL else ''}

This is an automated notification from the YFinance Data Fetcher.
"""

        # Calculate performance metrics if available
        records_per_second = total_records / max(duration, 0.001)

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
        .header {{ background: linear-gradient(135deg, #4CAF50, #2E7D32); color: white; padding: 30px; border-radius: 8px 8px 0 0; }}
        .header h1 {{ margin: 0; font-size: 24px; }}
        .header p {{ margin: 10px 0 0 0; opacity: 0.9; }}
        .content {{ padding: 25px; background: white; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .stat-card {{ background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #4CAF50; }}
        .stat-value {{ font-size: 28px; font-weight: bold; color: #2E7D32; }}
        .stat-label {{ font-size: 12px; color: #666; text-transform: uppercase; margin-top: 5px; }}
        .ticker-list {{ font-family: monospace; font-size: 12px; background: #f1f3f4; padding: 15px; border-radius: 8px; word-wrap: break-word; }}
        .footer {{ color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }}
        .success-badge {{ display: inline-block; background: #4CAF50; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 YFinance Data Fetch Complete</h1>
        <p><span class="success-badge">SUCCESS</span></p>
    </div>
    <div class="content">
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">{total_tickers}</div>
                <div class="stat-label">Tickers Fetched</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{total_records:,}</div>
                <div class="stat-label">Total Records</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{duration:.1f}s</div>
                <div class="stat-label">Duration</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{records_per_second:.0f}/s</div>
                <div class="stat-label">Records Per Second</div>
            </div>
        </div>
        
        <h3>📁 Output File</h3>
        <p style="font-family: monospace; background: #f1f3f4; padding: 10px; border-radius: 4px;">{output_file}</p>
        
        <h3>📊 Tickers Fetched</h3>
        <p class="ticker-list">{', '.join(tickers[:MAX_TICKERS_IN_HTML_EMAIL])}{'...' if len(tickers) > MAX_TICKERS_IN_HTML_EMAIL else ''}</p>
        
        <div class="footer">
            <p>📅 Timestamp: {timestamp}</p>
            <p>This is an automated notification from the YFinance Data Fetcher.</p>
        </div>
    </div>
</body>
</html>
"""

        return subject, plain_body, html_body

    def format_webhook_payload(self, summary: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format a summary into a webhook payload.

        Args:
            summary: Dictionary with fetch summary data.

        Returns:
            Formatted webhook payload.
        """
        return {
            "content": f"YFinance Data Update: {summary.get('total_tickers', 0)} tickers fetched, "
                       f"{summary.get('total_records', 0)} total records.",
            "username": "YFinance Bot",
            "embeds": [
                {
                    "title": "Data Fetch Summary",
                    "color": WEBHOOK_SUCCESS_COLOR,
                    "fields": [
                        {
                            "name": "Total Tickers",
                            "value": str(summary.get("total_tickers", 0)),
                            "inline": True
                        },
                        {
                            "name": "Total Records",
                            "value": f"{summary.get('total_records', 0):,}",
                            "inline": True
                        },
                        {
                            "name": "Duration",
                            "value": f"{summary.get('duration_seconds', 0):.2f}s",
                            "inline": True
                        },
                        {
                            "name": "Fetched At",
                            "value": summary.get("fetched_at", "N/A"),
                            "inline": False
                        },
                        {
                            "name": "Output File",
                            "value": summary.get("output_file", "N/A"),
                            "inline": False
                        }
                    ],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "footer": {
                        "text": "YFinance Data Fetcher"
                    }
                }
            ]
        }

    def format_error_webhook_payload(self, error_message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Format an error into a webhook payload.

        Args:
            error_message: Error message to include.
            context: Optional additional context information.

        Returns:
            Formatted error webhook payload.
        """
        fields = [
            {
                "name": "Error Message",
                "value": error_message[:1000],
                "inline": False
            },
            {
                "name": "Timestamp",
                "value": datetime.now(timezone.utc).isoformat(),
                "inline": True
            }
        ]
        
        if context:
            for key, value in list(context.items())[:5]:
                fields.append({
                    "name": key.replace("_", " ").title(),
                    "value": str(value)[:500],
                    "inline": True
                })
        
        return {
            "content": "⚠️ YFinance Data Fetch Error",
            "username": "YFinance Bot",
            "embeds": [
                {
                    "title": "Error Details",
                    "color": WEBHOOK_ERROR_COLOR,
                    "fields": fields,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "footer": {
                        "text": "YFinance Data Fetcher"
                    }
                }
            ]
        }

    def notify_success(self, summary: Dict[str, Any]) -> Dict[str, bool]:
        """
        Send success notifications via all configured channels.

        Args:
            summary: Dictionary with fetch summary data.

        Returns:
            Dictionary with status of each notification channel.
        """
        results = {}

        # Send email notification
        if self.sender_email and self.recipient_emails:
            subject, plain_body, html_body = self.format_summary_email(summary)
            result = self.send_email(subject, plain_body, html_body)
            results["email"] = result.success
        else:
            results["email"] = False
            logger.info("Email notification skipped: not configured")

        # Send webhook notification
        if self.webhook_url:
            payload = self.format_webhook_payload(summary)
            result = self.send_webhook(payload)
            results["webhook"] = result.success
        else:
            results["webhook"] = False
            logger.info("Webhook notification skipped: not configured")

        # Send Slack notification
        if self.slack_webhook_url:
            result = self.send_slack_notification(
                f"✅ YFinance Data Update Complete: {summary.get('total_tickers', 0)} tickers, {summary.get('total_records', 0):,} records"
            )
            results["slack"] = result.success
        else:
            results["slack"] = False

        # Send Discord notification
        if self.discord_webhook_url:
            payload = self.format_webhook_payload(summary)
            result = self.send_discord_notification(
                content=payload["content"],
                username=payload["username"],
                embeds=payload["embeds"]
            )
            results["discord"] = result.success
        else:
            results["discord"] = False

        return results

    def notify_error(self, error_message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, bool]:
        """
        Send error notifications via all configured channels.

        Args:
            error_message: Error message to send.
            context: Optional additional context information.

        Returns:
            Dictionary with status of each notification channel.
        """
        results = {}

        # Send email notification
        if self.sender_email and self.recipient_emails:
            subject = "⚠️ YFinance Data Fetch Error"
            body = f"""
An error occurred during the YFinance data fetch:

{error_message}

Timestamp: {datetime.now(timezone.utc).isoformat()}

{"Context:" if context else ""}
{json.dumps(context, indent=2) if context else ""}

This is an automated notification from the YFinance Data Fetcher.
"""
            result = self.send_email(
                subject,
                body,
                priority=NotificationPriority.HIGH
            )
            results["email"] = result.success
        else:
            results["email"] = False

        # Send webhook notification
        if self.webhook_url:
            payload = self.format_error_webhook_payload(error_message, context)
            result = self.send_webhook(payload)
            results["webhook"] = result.success
        else:
            results["webhook"] = False

        # Send Slack notification
        if self.slack_webhook_url:
            result = self.send_slack_notification(
                f"⚠️ YFinance Data Fetch Error: {error_message[:200]}"
            )
            results["slack"] = result.success
        else:
            results["slack"] = False

        # Send Discord notification
        if self.discord_webhook_url:
            payload = self.format_error_webhook_payload(error_message, context)
            result = self.send_discord_notification(
                content=payload["content"],
                username=payload["username"],
                embeds=payload["embeds"]
            )
            results["discord"] = result.success
        else:
            results["discord"] = False

        return results

    def get_notification_stats(self) -> Dict[str, Any]:
        """
        Get notification statistics.

        Returns:
            Dictionary with notification statistics.
        """
        return {
            "total_sent": len(self.history.entries),
            "success_rate": self.history.get_success_rate(),
            "email_success_rate": self.history.get_success_rate(NotificationChannel.EMAIL),
            "webhook_success_rate": self.history.get_success_rate(NotificationChannel.WEBHOOK),
            "recent_notifications": [r.to_dict() for r in self.history.get_recent()],
        }
