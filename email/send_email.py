#!/usr/bin/env python3
"""
send_email.py — MajixAI Financial Email Sender
===============================================
Reads SMTP credentials from environment variables and sends a single
HTML financial report email.

Environment variables
---------------------
  SMTP_SERVER       — SMTP hostname   (e.g. smtp.gmail.com)
  SMTP_PORT         — SMTP port       (default: 587)
  SMTP_USERNAME     — SMTP login
  SMTP_PASSWORD     — SMTP password / app-password
  SENDER_EMAIL      — From address    (falls back to SMTP_USERNAME)
  RECIPIENT_EMAILS  — Comma-separated list of To addresses

Required argument
-----------------
  --mode   weekday_open | weekday_9am | weekday_10am | weekday_1pm |
           weekend_9am  | weekend_10pm

Optional
--------
  --dry-run   Print the email to stdout instead of sending.
"""

from __future__ import annotations

import argparse
import os
import smtplib
import ssl
import sys
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

# ── Bootstrap repo path ───────────────────────────────────────────────────────
_HERE = Path(__file__).resolve().parent
_REPO = _HERE.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

import importlib.util as _ilu

_fr_spec = _ilu.spec_from_file_location(
    "majix_financial_report",
    _HERE / "financial_report.py",
)
_fr_mod = _ilu.module_from_spec(_fr_spec)
_fr_spec.loader.exec_module(_fr_mod)

build_weekday_open_report  = _fr_mod.build_weekday_open_report
build_weekday_9am_report   = _fr_mod.build_weekday_9am_report
build_weekday_10am_report  = _fr_mod.build_weekday_10am_report
build_weekday_1pm_report   = _fr_mod.build_weekday_1pm_report
build_weekend_report       = _fr_mod.build_weekend_report

# ── Dispatch table ─────────────────────────────────────────────────────────────
def _build(mode: str, now: datetime):
    dispatch = {
        "weekday_open":  lambda: build_weekday_open_report(now),
        "weekday_9am":   lambda: build_weekday_9am_report(now),
        "weekday_10am":  lambda: build_weekday_10am_report(now),
        "weekday_1pm":   lambda: build_weekday_1pm_report(now),
        "weekend_9am":   lambda: build_weekend_report(now, "9am"),
        "weekend_10pm":  lambda: build_weekend_report(now, "10pm"),
    }
    fn = dispatch.get(mode)
    if fn is None:
        raise ValueError(f"Unknown mode: {mode!r}")
    return fn()


# ── SMTP sender ────────────────────────────────────────────────────────────────
def _send(subject: str, html: str, recipients: list[str], dry_run: bool = False) -> None:
    server   = os.environ.get("SMTP_SERVER", "")
    port     = int(os.environ.get("SMTP_PORT", "587"))
    username = os.environ.get("SMTP_USERNAME", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    sender   = os.environ.get("SENDER_EMAIL", username)

    if dry_run:
        print("=" * 70)
        print(f"DRY RUN — would send to: {recipients}")
        print(f"Subject : {subject}")
        print(f"From    : {sender}")
        print("-" * 70)
        print(html[:4000])
        print("=" * 70)
        return

    if not server:
        raise RuntimeError("SMTP_SERVER environment variable is not set.")
    if not username or not password:
        raise RuntimeError("SMTP_USERNAME / SMTP_PASSWORD are required.")
    if not recipients:
        raise RuntimeError("RECIPIENT_EMAILS is empty.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = sender
    msg["To"]      = ", ".join(recipients)

    # Plain-text fallback
    plain = (
        f"Financial Report: {subject}\n\n"
        "This email requires an HTML-capable mail client.\n"
        "View the live dashboard at https://majixai.github.io/majixai.github.io/yfinance/index.html"
    )
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(server, port) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ctx)
        smtp.login(username, password)
        smtp.sendmail(sender, recipients, msg.as_string())

    print(f"[send_email] Sent '{subject}' to {recipients}", flush=True)


# ── CLI ────────────────────────────────────────────────────────────────────────
def _parse() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Send a MajixAI financial email report.")
    p.add_argument(
        "--mode",
        required=True,
        choices=[
            "weekday_open", "weekday_9am", "weekday_10am",
            "weekday_1pm", "weekend_9am", "weekend_10pm",
        ],
        help="Report mode / schedule slot to generate",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print email to stdout instead of sending",
    )
    p.add_argument(
        "--out",
        default="",
        help="Also save the HTML report to this file path",
    )
    return p.parse_args()


def main() -> int:
    args     = _parse()
    now      = datetime.now(timezone.utc)
    subject, html = _build(args.mode, now)

    if args.out:
        Path(args.out).write_text(html, encoding="utf-8")
        print(f"[send_email] HTML written to {args.out}", file=sys.stderr)

    recipients_raw = os.environ.get("RECIPIENT_EMAILS", "")
    recipients     = [r.strip() for r in recipients_raw.split(",") if r.strip()]

    _send(subject, html, recipients, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
