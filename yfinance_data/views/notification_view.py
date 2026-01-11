"""
Notification View for sending alerts via email and webhook.
Handles all notification-related output for the yfinance data fetcher.
"""
import json
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, Optional, List

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
            webhook_url: URL for webhook notifications.
        """
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username
        self.smtp_password = smtp_password
        self.sender_email = sender_email
        self.recipient_emails = recipient_emails or []
        self.webhook_url = webhook_url

    def send_email(
        self,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        recipient_emails: Optional[List[str]] = None,
    ) -> bool:
        """
        Send an email notification.

        Args:
            subject: Email subject line.
            body: Plain text email body.
            html_body: Optional HTML email body.
            recipient_emails: Override default recipients.

        Returns:
            True if email sent successfully, False otherwise.
        """
        recipients = recipient_emails or self.recipient_emails

        if not all([self.smtp_server, self.sender_email, recipients]):
            logger.warning("Email configuration incomplete. Skipping email notification.")
            return False

        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.sender_email
            message["To"] = ", ".join(recipients)

            # Add plain text part
            message.attach(MIMEText(body, "plain"))

            # Add HTML part if provided
            if html_body:
                message.attach(MIMEText(html_body, "html"))

            # Create secure connection
            context = ssl.create_default_context()

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls(context=context)
                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.sender_email, recipients, message.as_string())

            logger.info(f"Email sent successfully to {recipients}")
            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed for server {self.smtp_server}: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error occurred with server {self.smtp_server}: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    def send_webhook(
        self,
        payload: Dict[str, Any],
        webhook_url: Optional[str] = None,
    ) -> bool:
        """
        Send a webhook notification.

        Args:
            payload: Dictionary payload to send.
            webhook_url: Override default webhook URL.

        Returns:
            True if webhook sent successfully, False otherwise.
        """
        url = webhook_url or self.webhook_url

        if not url:
            logger.warning("No webhook URL configured. Skipping webhook notification.")
            return False

        try:
            headers = {"Content-Type": "application/json"}
            response = requests.post(
                url,
                data=json.dumps(payload),
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            logger.info(f"Webhook notification sent successfully to {url}")
            return True

        except requests.exceptions.Timeout:
            logger.error(f"Webhook request timed out: {url}")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send webhook notification: {e}")
            return False

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

        subject = f"YFinance Data Update - {total_tickers} Tickers Fetched"

        plain_body = f"""
YFinance Data Fetch Complete

Timestamp: {timestamp}
Total Tickers: {total_tickers}
Total Records: {total_records}
Output File: {output_file}

Tickers Fetched:
{', '.join(tickers[:MAX_TICKERS_IN_PLAIN_EMAIL])}{'...' if len(tickers) > MAX_TICKERS_IN_PLAIN_EMAIL else ''}

This is an automated notification from the YFinance Data Fetcher.
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background-color: #4CAF50; color: white; padding: 20px; }}
        .content {{ padding: 20px; }}
        .stats {{ background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 5px; }}
        .ticker-list {{ font-family: monospace; font-size: 12px; }}
        .footer {{ color: #666; font-size: 12px; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>YFinance Data Fetch Complete</h1>
    </div>
    <div class="content">
        <div class="stats">
            <p><strong>Timestamp:</strong> {timestamp}</p>
            <p><strong>Total Tickers:</strong> {total_tickers}</p>
            <p><strong>Total Records:</strong> {total_records}</p>
            <p><strong>Output File:</strong> {output_file}</p>
        </div>
        <h3>Tickers Fetched:</h3>
        <p class="ticker-list">{', '.join(tickers[:MAX_TICKERS_IN_HTML_EMAIL])}{'...' if len(tickers) > MAX_TICKERS_IN_HTML_EMAIL else ''}</p>
        <div class="footer">
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
                            "value": str(summary.get("total_records", 0)),
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
                    "timestamp": datetime.now().isoformat()
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
            results["email"] = self.send_email(subject, plain_body, html_body)
        else:
            results["email"] = False
            logger.info("Email notification skipped: not configured")

        # Send webhook notification
        if self.webhook_url:
            payload = self.format_webhook_payload(summary)
            results["webhook"] = self.send_webhook(payload)
        else:
            results["webhook"] = False
            logger.info("Webhook notification skipped: not configured")

        return results

    def notify_error(self, error_message: str) -> Dict[str, bool]:
        """
        Send error notifications via all configured channels.

        Args:
            error_message: Error message to send.

        Returns:
            Dictionary with status of each notification channel.
        """
        results = {}

        # Send email notification
        if self.sender_email and self.recipient_emails:
            subject = "YFinance Data Fetch Error"
            body = f"""
An error occurred during the YFinance data fetch:

{error_message}

Timestamp: {datetime.now().isoformat()}

This is an automated notification from the YFinance Data Fetcher.
"""
            results["email"] = self.send_email(subject, body)
        else:
            results["email"] = False

        # Send webhook notification
        if self.webhook_url:
            payload = {
                "content": f"⚠️ YFinance Data Fetch Error: {error_message}",
                "username": "YFinance Bot",
            }
            results["webhook"] = self.send_webhook(payload)
        else:
            results["webhook"] = False

        return results
