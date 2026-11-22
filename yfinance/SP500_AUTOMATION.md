# S&P 500 Apps Script automation

`sp500_market_automation.gs` contains the S&P 500-only (`^GSPC`) implementation.

- Appends one latest available S&P 500 bar to a Google Sheet every minute.
- Creates a 15-minute Google Calendar event at 8:15 AM America/New_York on market-open weekdays.
- Saves an extensive multi-page PDF report in Google Drive from the latest recorded session.

## Setup

1. Open [script.google.com](https://script.google.com), create a standalone Apps Script project, and paste in `sp500_market_automation.gs`.
2. Set optional Script Properties:
   - `SP500_SPREADSHEET_ID`
   - `SP500_REPORT_FOLDER_ID`
   - `SP500_CALENDAR_ID`
3. Set the project time zone to **America/New_York** and run `setupSp500Automation()`.
4. Authorize Sheets, Drive, Calendar, and external requests.

The minute and daily triggers are Apps Script time-driven triggers, not GitHub Actions cron schedules. Apps Script scheduling is best-effort and may run late or skip executions. Yahoo Finance data availability and delay are not guaranteed.
