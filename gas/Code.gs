/**
 * Minimal Google Apps Script: Gmail + Calendar + compressed Drive.
 *
 * Reads today's Calendar events, gzip-compresses a summary, stores it
 * in Drive, and emails the recipient a link to the file.
 *
 * Required scopes (see appsscript.json):
 *   - https://www.googleapis.com/auth/gmail.send
 *   - https://www.googleapis.com/auth/calendar.readonly
 *   - https://www.googleapis.com/auth/drive.file
 */
function run() {
  const MS_PER_DAY = 86400000;
  const now   = new Date();
  const end   = new Date(now.getTime() + MS_PER_DAY); // next 24 h

  // 1. Calendar: collect today's event titles.
  const events  = CalendarApp.getDefaultCalendar().getEvents(now, end);
  const summary = events.length
    ? events.map(e => `${e.getTitle()} @ ${e.getStartTime().toLocaleTimeString()}`).join('\n')
    : 'No events in the next 24 hours.';

  // 2. Drive: gzip-compress the summary and (re)write it.
  const blob       = Utilities.newBlob(summary, 'text/plain', 'cal_summary.txt');
  const compressed = Utilities.gzip(blob);
  compressed.setName('cal_summary.txt.gz');

  const root     = DriveApp.getRootFolder();
  const existing = root.getFilesByName('cal_summary.txt.gz');
  while (existing.hasNext()) existing.next().setTrashed(true); // trash stale copy before recreating
  const file = root.createFile(compressed);

  // 3. Gmail: send a notification with the Drive file ID.
  const recipient = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(
    recipient,
    'Daily Calendar Summary (compressed)',
    `Drive file ID: ${file.getId()}\n\n${summary}`
  );

  Logger.log('Done. File: ' + file.getId());
}
