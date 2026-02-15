/**
 * GAS webhook receiver for yfinance Git datastore pipeline.
 *
 * Expected payload keys:
 * - event
 * - run_utc
 * - git { repo, branch, commit, remote }
 * - base_dir
 * - tickers
 * - period
 * - interval
 * - summary[]
 *
 * Optional Script Properties:
 * - SHEET_ID: Google Sheet ID for logging
 * - SHEET_NAME: Tab name (default: WebhookRuns)
 * - CALENDAR_ID: Calendar for event logging (optional)
 * - GMAIL_TO: Fallback email recipient (optional)
 * - DRIVE_FOLDER_ID: Folder for compressed run archives (optional)
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const eventName = payload.event || 'unknown_event';
    const runUtc = payload.run_utc || new Date().toISOString();

    logToSheet_(payload);
    const serviceResults = processServices_(payload);

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        event: eventName,
        run_utc: runUtc,
        rows_logged: (payload.summary || []).length,
        services: serviceResults,
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function processServices_(payload) {
  const serviceFlags = payload.services || {};
  const props = PropertiesService.getScriptProperties();

  const enableCalendar = serviceFlags.calendar === true;
  const enableGmail = serviceFlags.gmail === true;
  const enableDriveCompression = serviceFlags.driveCompression === true;

  const results = {
    calendar: { enabled: enableCalendar, ok: false, details: '' },
    gmail: { enabled: enableGmail, ok: false, details: '' },
    driveCompression: { enabled: enableDriveCompression, ok: false, details: '' },
  };

  if (enableCalendar) {
    try {
      const calendarId = (payload.calendar && payload.calendar.calendarId) || props.getProperty('CALENDAR_ID');
      const title = (payload.calendar && payload.calendar.title) || `YFinance datastore run: ${(payload.git || {}).repo || ''}`;
      const notes = buildRunSummaryText_(payload);

      if (!calendarId) {
        results.calendar.details = 'missing calendarId and CALENDAR_ID property';
      } else {
        const cal = CalendarApp.getCalendarById(calendarId);
        if (!cal) {
          results.calendar.details = 'calendar not found';
        } else {
          const start = new Date(payload.run_utc || new Date().toISOString());
          const end = new Date(start.getTime() + 30 * 60 * 1000);
          cal.createEvent(title, start, end, { description: notes });
          results.calendar.ok = true;
          results.calendar.details = 'event created';
        }
      }
    } catch (err) {
      results.calendar.details = String(err);
    }
  }

  if (enableGmail) {
    try {
      const recipient = (payload.gmail && payload.gmail.to) || props.getProperty('GMAIL_TO');
      const subject = (payload.gmail && payload.gmail.subject) || `YFinance run ${payload.run_utc || ''}`;
      const body = (payload.gmail && payload.gmail.body) || buildRunSummaryText_(payload);

      if (!recipient) {
        results.gmail.details = 'missing recipient and GMAIL_TO property';
      } else {
        GmailApp.sendEmail(recipient, subject, body);
        results.gmail.ok = true;
        results.gmail.details = `email sent to ${recipient}`;
      }
    } catch (err) {
      results.gmail.details = String(err);
    }
  }

  if (enableDriveCompression) {
    try {
      const folderId = (payload.drive && payload.drive.folderId) || props.getProperty('DRIVE_FOLDER_ID');
      if (!folderId) {
        results.driveCompression.details = 'missing folderId and DRIVE_FOLDER_ID property';
      } else {
        const folder = DriveApp.getFolderById(folderId);
        const json = JSON.stringify(payload, null, 2);
        const blob = Utilities.newBlob(json, 'application/json', `run_${Date.now()}.json`);
        const gzBlob = Utilities.gzip(blob, `${blob.getName()}.gz`);
        folder.createFile(gzBlob);
        results.driveCompression.ok = true;
        results.driveCompression.details = 'compressed archive created in Drive';
      }
    } catch (err) {
      results.driveCompression.details = String(err);
    }
  }

  return results;
}

function buildRunSummaryText_(payload) {
  const git = payload.git || {};
  const summary = payload.summary || [];
  const header = [
    `event: ${payload.event || ''}`,
    `run_utc: ${payload.run_utc || ''}`,
    `repo: ${git.repo || ''}`,
    `branch: ${git.branch || ''}`,
    `commit: ${git.commit || ''}`,
    `interval: ${payload.interval || ''}`,
  ];

  const rows = summary.map((item) => (
    `${item.ticker || ''}: rows=${item.rows || 0}, appended=${item.appended_rows || 0}, patterns=${item.patterns || 0}`
  ));

  return header.concat(['', 'summary:'], rows).join('\n');
}

function logToSheet_(payload) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  const sheetName = props.getProperty('SHEET_NAME') || 'WebhookRuns';
  if (!sheetId) return;

  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'logged_at', 'event', 'run_utc', 'repo', 'branch', 'commit', 'remote',
      'ticker', 'rows', 'appended_rows', 'patterns', 'sha256', 'csv', 'dat', 'manifest', 'plot',
    ]);
  }

  const git = payload.git || {};
  const summary = payload.summary || [];

  if (!summary.length) {
    sheet.appendRow([
      new Date().toISOString(), payload.event || '', payload.run_utc || '',
      git.repo || '', git.branch || '', git.commit || '', git.remote || '',
      '', '', '', '', '', '', '', '', '',
    ]);
    return;
  }

  summary.forEach((item) => {
    sheet.appendRow([
      new Date().toISOString(),
      payload.event || '',
      payload.run_utc || '',
      git.repo || '',
      git.branch || '',
      git.commit || '',
      git.remote || '',
      item.ticker || '',
      item.rows || 0,
      item.appended_rows || 0,
      item.patterns || 0,
      item.sha256 || '',
      item.csv || '',
      item.dat || '',
      item.manifest || '',
      item.plot || '',
    ]);
  });
}
