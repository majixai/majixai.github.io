#!/usr/bin/env python3
"""
send_email.py — MajixAI Financial Email Sender
===============================================
Generates an HTML financial report and dispatches it via one of two
transport mechanisms.  Google Apps Script (GAS) webhook is the default
because it requires no SMTP credentials and works entirely through
Google's infrastructure.

Transport options (--transport / EMAIL_TRANSPORT env var)
---------------------------------------------------------
  gas    (default) — POST the HTML report to a deployed GAS Web App webhook.
                     The GAS script then calls MailApp / GmailApp to send.
                     Required env vars:
                       EMAIL_GAS_WEBHOOK_URL  — deployed GAS web-app URL
                       EMAIL_GAS_SECRET       — shared secret (optional but recommended)
                       RECIPIENT_EMAILS       — comma-separated To addresses

  smtp   (opt-in)  — Send directly via Python smtplib (STARTTLS).
                     Required env vars:
                       SMTP_SERVER, SMTP_PORT (default 587)
                       SMTP_USERNAME, SMTP_PASSWORD
                       SENDER_EMAIL           — From address
                       RECIPIENT_EMAILS       — comma-separated To addresses

Required argument
-----------------
  --mode   weekday_open | weekday_9am | weekday_10am | weekday_1pm |
           weekend_9am  | weekend_10pm

Optional flags
--------------
  --transport gas|smtp  Override transport (default: gas)
  --dry-run             Print the payload without sending
  --out <path>          Save the generated HTML to a file
"""

from __future__ import annotations

import argparse
import json
import os
import smtplib
import ssl
import sys
import urllib.request
import urllib.error
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

_cfg_spec = _ilu.spec_from_file_location(
    "majix_email_runtime_config",
    _HERE / "runtime_config.py",
)
_cfg_mod = _ilu.module_from_spec(_cfg_spec)
_cfg_spec.loader.exec_module(_cfg_mod)

build_weekday_open_report      = _fr_mod.build_weekday_open_report
build_weekday_9am_report       = _fr_mod.build_weekday_9am_report
build_weekday_10am_report      = _fr_mod.build_weekday_10am_report
build_weekday_1pm_report       = _fr_mod.build_weekday_1pm_report
build_weekend_report           = _fr_mod.build_weekend_report
# Trading-prompt agent slots
build_overnight_day_plan_report  = _fr_mod.build_overnight_day_plan_report
build_overnight_bull_pick_report = _fr_mod.build_overnight_bull_pick_report
build_overnight_project_report   = _fr_mod.build_overnight_project_report
build_premarket_1pm_proj_report  = _fr_mod.build_premarket_1pm_proj_report
build_premarket_followup_report  = _fr_mod.build_premarket_followup_report
build_premarket_extra_report     = _fr_mod.build_premarket_extra_report
build_market_bullnews_report     = _fr_mod.build_market_bullnews_report
build_market_midday_report       = _fr_mod.build_market_midday_report
build_market_1pm_et_report       = _fr_mod.build_market_1pm_et_report
load_email_runtime_config        = _cfg_mod.load_email_runtime_config
get_runtime_value                = _cfg_mod.get_runtime_value


# ── Report builder dispatch ───────────────────────────────────────────────────

def _build(mode: str, now: datetime):
    dispatch = {
        "weekday_open":        lambda: build_weekday_open_report(now),
        "weekday_9am":         lambda: build_weekday_9am_report(now),
        "weekday_10am":        lambda: build_weekday_10am_report(now),
        "weekday_1pm":         lambda: build_weekday_1pm_report(now),
        "weekend_9am":         lambda: build_weekend_report(now, "9am"),
        "weekend_10pm":        lambda: build_weekend_report(now, "10pm"),
        # Trading-prompt agent slots
        "overnight_day_plan":  lambda: build_overnight_day_plan_report(now),
        "overnight_bull_pick": lambda: build_overnight_bull_pick_report(now),
        "overnight_project":   lambda: build_overnight_project_report(now),
        "premarket_1pm_proj":  lambda: build_premarket_1pm_proj_report(now),
        "premarket_followup":  lambda: build_premarket_followup_report(now),
        "premarket_extra":     lambda: build_premarket_extra_report(now),
        "market_bullnews":     lambda: build_market_bullnews_report(now),
        "market_midday":       lambda: build_market_midday_report(now),
        "market_1pm_et":       lambda: build_market_1pm_et_report(now),
    }
    fn = dispatch.get(mode)
    if fn is None:
        raise ValueError(f"Unknown mode: {mode!r}")
    return fn()


# ── GAS webhook transport (default) ──────────────────────────────────────────

def _send_via_gas(
    subject: str,
    html: str,
    recipients: list[str],
    mode: str,
    dry_run: bool = False,
) -> None:
    """
    POST the generated HTML report to the GAS Web App webhook.

    The GAS script (email/gas_mailer.gs) receives the payload and uses
    MailApp / GmailApp to deliver the email from the Google account that
    deployed the web app.  No SMTP credentials are needed.

    Environment variables
    ---------------------
    EMAIL_GAS_WEBHOOK_URL  — Required.  Deployed GAS Web App URL.
    EMAIL_GAS_SECRET       — Optional.  Shared secret validated by GAS.
    """
    runtime_config = load_email_runtime_config(os.environ)
    webhook_url = str(
        get_runtime_value(
            runtime_config,
            "gasWebhookUrl",
            "emailGasWebhookUrl",
            env=os.environ,
            env_key="EMAIL_GAS_WEBHOOK_URL",
            default="",
        )
    ).strip()
    secret = str(
        get_runtime_value(
            runtime_config,
            "gasSecret",
            "emailGasSecret",
            env=os.environ,
            env_key="EMAIL_GAS_SECRET",
            default="",
        )
    ).strip()

    payload = {
        "subject":    subject,
        "html":       html,
        "recipients": ",".join(recipients),
        "mode":       mode,
    }
    if secret:
        payload["secret"] = secret

    if dry_run:
        print("=" * 70)
        print(f"DRY RUN [GAS] — would POST to: {webhook_url or '(EMAIL_GAS_WEBHOOK_URL not set)'}")
        print(f"Subject    : {subject}")
        print(f"Recipients : {recipients}")
        print(f"Mode       : {mode}")
        print(f"Payload keys: {list(payload.keys())}")
        print(f"HTML preview:\n{html[:3000]}")
        print("=" * 70)
        return

    if not webhook_url:
        raise RuntimeError(
            "EMAIL_GAS_WEBHOOK_URL is not set.  "
            "Deploy email/gas_mailer.gs as a GAS Web App and set the URL."
        )
    if not recipients:
        raise RuntimeError("RECIPIENT_EMAILS is empty.")

    data    = json.dumps(payload).encode("utf-8")
    req     = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body)
            if not result.get("ok"):
                err_msg = result.get("error") or f"unexpected response: {body}"
                raise RuntimeError(f"GAS webhook returned error: {err_msg}")
            sent = result.get("sent", 0)
            print(f"[send_email/gas] Webhook accepted — {sent} email(s) sent for mode={mode}", flush=True)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GAS webhook HTTP {exc.code}: {body}") from exc


# ── SMTP transport (opt-in) ───────────────────────────────────────────────────

def _send_via_smtp(
    subject: str,
    html: str,
    recipients: list[str],
    dry_run: bool = False,
) -> None:
    """
    Send the HTML report directly via Python smtplib (STARTTLS).

    Environment variables
    ---------------------
    SMTP_SERVER      — Required.  SMTP hostname (e.g. smtp.gmail.com).
    SMTP_PORT        — Optional.  Default 587.
    SMTP_USERNAME    — Required.  SMTP login.
    SMTP_PASSWORD    — Required.  SMTP password / app-password.
    SENDER_EMAIL     — Optional.  From address (falls back to SMTP_USERNAME).
    """
    runtime_config = load_email_runtime_config(os.environ)
    server = str(
        get_runtime_value(runtime_config, "smtpServer", env=os.environ, env_key="SMTP_SERVER", default="")
    )
    port = int(
        get_runtime_value(runtime_config, "smtpPort", env=os.environ, env_key="SMTP_PORT", default="587")
    )
    username = str(
        get_runtime_value(runtime_config, "smtpUsername", env=os.environ, env_key="SMTP_USERNAME", default="")
    )
    password = str(
        get_runtime_value(runtime_config, "smtpPassword", env=os.environ, env_key="SMTP_PASSWORD", default="")
    )
    sender = str(
        get_runtime_value(runtime_config, "senderEmail", env=os.environ, env_key="SENDER_EMAIL", default="")
    ) or username

    if dry_run:
        print("=" * 70)
        print(f"DRY RUN [SMTP] — server={server}:{port}  from={sender}")
        print(f"Subject    : {subject}")
        print(f"Recipients : {recipients}")
        print(f"HTML preview:\n{html[:3000]}")
        print("=" * 70)
        return

    if not server:
        raise RuntimeError("SMTP_SERVER environment variable is not set.")
    if not username or not password:
        raise RuntimeError("SMTP_USERNAME / SMTP_PASSWORD are required.")
    if not recipients:
        raise RuntimeError("RECIPIENT_EMAILS is empty.")

    plain = (
        f"Financial Report: {subject}\n\n"
        "This email requires an HTML-capable mail client.\n"
        "View the live dashboard at "
        "https://majixai.github.io/majixai.github.io/yfinance/index.html"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = sender
    msg["To"]      = ", ".join(recipients)
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(server, port) as smtp:
        smtp.starttls(context=ctx)
        smtp.login(username, password)
        smtp.sendmail(sender, recipients, msg.as_string())

    print(f"[send_email/smtp] Sent '{subject}' to {recipients}", flush=True)


# ── CLI ────────────────────────────────────────────────────────────────────────

def _parse() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Send a MajixAI financial email report.")
    p.add_argument(
        "--mode",
        required=True,
        choices=[
            "weekday_open", "weekday_9am", "weekday_10am",
            "weekday_1pm", "weekend_9am", "weekend_10pm",
            # Trading-prompt agent slots
            "overnight_day_plan", "overnight_bull_pick", "overnight_project",
            "premarket_1pm_proj", "premarket_followup", "premarket_extra",
            "market_bullnews", "market_midday", "market_1pm_et",
        ],
        help="Report mode / schedule slot to generate",
    )
    p.add_argument(
        "--transport",
        choices=["gas", "smtp"],
        default=(
            os.environ.get("EMAIL_TRANSPORT")
            or str(load_email_runtime_config(os.environ).get("transport", "gas"))
        ),
        help=(
            "Email transport: 'gas' (default) uses the GAS webhook; "
            "'smtp' uses Python smtplib directly"
        ),
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the payload without actually sending",
    )
    p.add_argument(
        "--out",
        default="",
        help="Also save the generated HTML report to this file path",
    )
    return p.parse_args()


def main() -> int:
    args = _parse()
    now  = datetime.now(timezone.utc)
    runtime_config = load_email_runtime_config(os.environ)

    subject, html = _build(args.mode, now)

    if args.out:
        Path(args.out).write_text(html, encoding="utf-8")
        print(f"[send_email] HTML written to {args.out}", file=sys.stderr)

    recipients_raw = str(
        get_runtime_value(
            runtime_config,
            "recipients",
            "recipientEmails",
            env=os.environ,
            env_key="RECIPIENT_EMAILS",
            default="",
        )
    )
    recipients     = [r.strip() for r in recipients_raw.split(",") if r.strip()]

    transport = args.transport
    print(f"[send_email] transport={transport}  mode={args.mode}", file=sys.stderr)

    if transport == "gas":
        _send_via_gas(subject, html, recipients, args.mode, dry_run=args.dry_run)
    else:
        _send_via_smtp(subject, html, recipients, dry_run=args.dry_run)

    return 0


if __name__ == "__main__":
    sys.exit(main())
