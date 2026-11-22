/**
 * S&P 500 minute collector and daily market-open report.
 *
 * One-time setup: set SP500_REPORT_FOLDER_ID (optional) and
 * SP500_CALENDAR_ID (optional) in Script Properties, then run setupSp500Automation().
 * Authorize Sheets, Drive, Calendar and external requests when prompted.
 * All times and market dates use America/New_York.
 */
const SP500 = {
  SYMBOL: '^GSPC',
  TIMEZONE: 'America/New_York',
  SHEET_NAME: 'S&P 500 minute data',
  HEADERS: ['Captured at (ET)', 'Market bar time (ET)', 'Symbol', 'Price', 'Open', 'High', 'Low', 'Previous close', 'Volume'],
  CALENDAR_TITLE: 'S&P 500 Market Open',
  REPORT_PREFIX: 'S&P 500 Daily Market Report'
};

/** Install one-minute collection and daily 8:15 ET calendar/report triggers. */
function setupSp500Automation() {
  const ss = getOrCreateSpreadsheet_();
  ensureSheet_(ss);
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (['collectSp500Minute', 'runSp500MarketOpen'].indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('collectSp500Minute').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('runSp500MarketOpen').timeBased().everyDays(1).atHour(8).nearMinute(15).inTimezone(SP500.TIMEZONE).create();
  Logger.log('Installed one-minute S&P collector and daily 8:15 AM ET market-open handler. Spreadsheet: ' + ss.getUrl());
}

/** Collect the latest S&P 500 (^GSPC) bar and append one row per trigger minute. */
function collectSp500Minute() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const ss = getOrCreateSpreadsheet_();
    const sheet = ensureSheet_(ss);
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1m';
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SAndP500MarketCollector/1.0)' }
    });
    if (response.getResponseCode() !== 200) throw new Error('Yahoo Finance returned HTTP ' + response.getResponseCode());
    const payload = JSON.parse(response.getContentText());
    const result = payload.chart && payload.chart.result && payload.chart.result[0];
    if (!result || !result.timestamp || !result.timestamp.length) throw new Error('No current ^GSPC price data returned.');
    const i = result.timestamp.length - 1;
    const quote = result.indicators.quote[0];
    const marketTime = new Date(result.timestamp[i] * 1000);
    const capturedAt = new Date();
    const row = [
      Utilities.formatDate(capturedAt, SP500.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(marketTime, SP500.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      SP500.SYMBOL,
      quote.close[i] == null ? '' : quote.close[i],
      quote.open[i] == null ? '' : quote.open[i],
      quote.high[i] == null ? '' : quote.high[i],
      quote.low[i] == null ? '' : quote.low[i],
      result.meta.chartPreviousClose || result.meta.previousClose || '',
      quote.volume[i] == null ? '' : quote.volume[i]
    ];
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

/** Runs daily near 8:15 AM ET; creates a calendar event and a PDF on open days. */
function runSp500MarketOpen() {
  const now = new Date();
  if (!isUsEquityMarketOpen_(now)) return;
  createMarketOpenEvent_(now);
  createDailyPdfReport_(now);
}

function getOrCreateSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SP500_SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('S&P 500 Minute Market Data');
  props.setProperty('SP500_SPREADSHEET_ID', ss.getId());
  return ss;
}

function ensureSheet_(ss) {
  let sheet = ss.getSheetByName(SP500.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SP500.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SP500.HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, SP500.HEADERS.length).setFontWeight('bold').setBackground('#163a5f').setFontColor('#ffffff');
    sheet.autoResizeColumns(1, SP500.HEADERS.length);
  }
  return sheet;
}

function createMarketOpenEvent_(date) {
  const calendarId = PropertiesService.getScriptProperties().getProperty('SP500_CALENDAR_ID');
  const calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : CalendarApp.getDefaultCalendar();
  if (!calendar) throw new Error('Could not access the configured Google Calendar.');
  const day = Utilities.formatDate(date, SP500.TIMEZONE, 'yyyy-MM-dd');
  const localStart = parseLocalDate_(day, 8, 15);
  const existing = calendar.getEventsForDay(localStart).some(function (event) {
    return event.getTitle() === SP500.CALENDAR_TITLE && Utilities.formatDate(event.getStartTime(), SP500.TIMEZONE, 'yyyy-MM-dd') === day;
  });
  if (!existing) {
    calendar.createEvent(SP500.CALENDAR_TITLE, localStart, new Date(localStart.getTime() + 15 * 60000), {
      description: 'Daily S&P 500 market-open reminder. S&P-only automated report is saved as a PDF in Google Drive.'
    });
  }
}

function parseLocalDate_(day, hour, minute) {
  // Use a fixed offset from the actual ET date to construct the exact 8:15 AM local instant.
  const probe = new Date(day + 'T12:00:00Z');
  const offsetParts = Utilities.formatDate(probe, SP500.TIMEZONE, 'XXX').split(':');
  const offsetHours = Number(offsetParts[0]);
  const offsetMinutes = offsetParts[1] ? Number(offsetParts[1]) : 0;
  const utcMinutes = hour * 60 + minute - offsetHours * 60 - (offsetHours < 0 ? -offsetMinutes : offsetMinutes);
  return new Date(Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth(), probe.getUTCDate(), Math.floor(utcMinutes / 60), utcMinutes % 60));
}

function createDailyPdfReport_(date) {
  const ss = getOrCreateSpreadsheet_();
  const sheet = ensureSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(date, SP500.TIMEZONE, 'yyyy-MM-dd');
  const rows = values.slice(1).filter(function (row) {
    return row[2] === SP500.SYMBOL && row[3] !== '' && String(row[0]).slice(0, 10) < today;
  });
  const doc = DocumentApp.create(SP500.REPORT_PREFIX + ' — ' + today);
  const body = doc.getBody();
  body.appendParagraph('S&P 500 — Daily Market Report').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('Prepared ' + Utilities.formatDate(date, SP500.TIMEZONE, 'EEEE, MMMM d, yyyy h:mm a z')).setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
  body.appendParagraph('Scope: S&P 500 index (^GSPC) only. Source: Yahoo Finance chart endpoint; collection is best-effort and may be delayed or unavailable. This report is informational, not investment advice.');
  body.appendPageBreak();
  body.appendParagraph('Executive Summary').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  if (!rows.length) {
    body.appendParagraph('No prior-session minute observations were available at report time. Check the collector authorization, trigger history, and Yahoo Finance availability.');
  } else {
    const latestDay = rows.map(function (r) { return String(r[0]).slice(0, 10); }).sort().pop();
    const session = rows.filter(function (r) { return String(r[0]).slice(0, 10) === latestDay; });
    const prices = session.map(function (r) { return Number(r[3]); }).filter(function (n) { return isFinite(n); });
    const first = prices[0], last = prices[prices.length - 1];
    const high = Math.max.apply(null, prices), low = Math.min.apply(null, prices);
    const change = first ? (last / first - 1) * 100 : 0;
    body.appendParagraph('Observation date: ' + latestDay + ' (ET)');
    body.appendParagraph('Recorded observations: ' + session.length);
    body.appendParagraph('First / latest recorded price: ' + formatPrice_(first) + ' / ' + formatPrice_(last));
    body.appendParagraph('Observed high / low: ' + formatPrice_(high) + ' / ' + formatPrice_(low));
    body.appendParagraph('Change across captured observations: ' + change.toFixed(3) + '%');
    body.appendParagraph('Previous close: ' + formatPrice_(Number(session[session.length - 1][7])));
    body.appendParagraph('Note: intraday observations are sampled from the latest available Yahoo Finance 1-minute bar; this is not an exchange-certified tick feed.');
    body.appendPageBreak();
    body.appendParagraph('Minute-by-Minute Data').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('All available S&P 500 observations from the latest recorded session are included below.');
    const tableRows = [['Captured (ET)', 'Bar time (ET)', 'Close', 'Open', 'High', 'Low', 'Volume']];
    session.forEach(function (r) {
      tableRows.push([String(r[0]), String(r[1]), formatPrice_(Number(r[3])), formatPrice_(Number(r[4])), formatPrice_(Number(r[5])), formatPrice_(Number(r[6])), r[8] === '' ? '—' : String(r[8])]);
    });
    body.appendTable(tableRows);
    body.appendPageBreak();
    body.appendParagraph('Methodology and Limitations').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendListItem('Ticker is fixed to ^GSPC; no other index, stock, cryptoasset, or security is queried or reported.');
    body.appendListItem('Minute triggers are best effort and may run late or be skipped due to Apps Script quotas or platform scheduling.');
    body.appendListItem('Outside regular trading hours, the upstream endpoint may return a stale latest bar. Captured time and source-bar time are recorded separately.');
    body.appendListItem('The market calendar handles standard US equity holidays; unscheduled exchange closures should be added to isUsEquityMarketOpen_ when announced.');
    body.appendParagraph('Data source: Yahoo Finance chart endpoint for ^GSPC. Values are provided as-is, may be delayed, and are not guaranteed complete or accurate.');
  }
  doc.saveAndClose();
  const pdfBlob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF).setName(doc.getName() + '.pdf');
  const folderId = PropertiesService.getScriptProperties().getProperty('SP500_REPORT_FOLDER_ID');
  const pdfFile = folderId ? DriveApp.getFolderById(folderId).createFile(pdfBlob) : DriveApp.createFile(pdfBlob);
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  Logger.log('Created S&P 500 PDF report: ' + pdfFile.getUrl());
}

/** Standard US equity market holidays (weekends and major scheduled closures). */
function isUsEquityMarketOpen_(date) {
  const day = Number(Utilities.formatDate(date, SP500.TIMEZONE, 'u'));
  if (day > 5) return false;
  const year = Number(Utilities.formatDate(date, SP500.TIMEZONE, 'yyyy'));
  const monthDay = Utilities.formatDate(date, SP500.TIMEZONE, 'MM-dd');
  return usMarketHolidays_(year).indexOf(monthDay) === -1;
}

function usMarketHolidays_(year) {
  const dates = [];
  function add(date) { dates.push(Utilities.formatDate(date, SP500.TIMEZONE, 'MM-dd')); }
  function observed(month, day) {
    const d = new Date(Date.UTC(year, month - 1, day, 12));
    const weekday = d.getUTCDay();
    if (weekday === 6) d.setUTCDate(d.getUTCDate() - 1);
    if (weekday === 0) d.setUTCDate(d.getUTCDate() + 1);
    add(d);
  }
  function nthWeekday(month, weekday, nth) {
    const d = new Date(Date.UTC(year, month - 1, 1, 12));
    while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCDate(d.getUTCDate() + 7 * (nth - 1)); add(d);
  }
  function lastWeekday(month, weekday) {
    const d = new Date(Date.UTC(year, month, 0, 12));
    while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
    add(d);
  }
  observed(1, 1);
  nthWeekday(1, 1, 3);
  nthWeekday(2, 1, 3);
  const easter = easterSunday_(year); easter.setUTCDate(easter.getUTCDate() - 2); add(easter);
  lastWeekday(5, 1);
  if (year >= 2022) observed(6, 19);
  observed(7, 4);
  nthWeekday(9, 1, 1);
  nthWeekday(11, 4, 4);
  observed(12, 25);
  return dates;
}

function easterSunday_(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatPrice_(value) { return isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'; }
