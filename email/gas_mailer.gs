/**
 * gas_mailer.gs — MajixAI Financial Email Webhook
 * =================================================
 * Deploy this file as a Google Apps Script Web App
 * (Execute as: Me  |  Who has access: Anyone with the link).
 *
 * The deployed URL becomes the value for the GAS_WEBHOOK_URL secret
 * in GitHub Actions, and for the EMAIL_GAS_WEBHOOK_URL environment
 * variable when using Python's --transport gas mode.
 *
 * ── Webhook contract ────────────────────────────────────────────────────────
 * POST  <deployed-url>
 * Headers: Content-Type: application/json
 * Body (JSON):
 *   {
 *     "secret":     "<GAS_WEBHOOK_SECRET>",   // required when GAS_WEBHOOK_SECRET script property is set
 *     "subject":    "📈 Pre-Market Bull Alert — Monday, May 4 2026",
 *     "html":       "<html>…full HTML body…</html>",
 *     "recipients": "alice@example.com,bob@example.com",
 *     "mode":       "weekday_open"             // optional, logged only
 *   }
 *
 * Response (JSON):
 *   { "ok": true,  "sent": 2 }
 *   { "ok": false, "error": "…" }
 *
 * ── GitHub → GAS webhook flow ───────────────────────────────────────────────
 * The workflow can also notify GAS via a GitHub repository-dispatch event
 * which is forwarded here by a small GitHub webhook.  In that case the
 * payload is wrapped in:
 *   { "action": "financial_email", "client_payload": { …same fields… } }
 *
 * ── GAS-native schedule (optional) ─────────────────────────────────────────
 * Install time-based triggers by calling installFinancialEmailTriggers()
 * once from the GAS editor.  Each trigger calls the matching slot function
 * (e.g. sendWeekdayOpen) which fetches the latest report data directly.
 * Both the webhook path and the native trigger path are supported
 * independently; use whichever fits your deployment.
 *
 * ── Required script properties ──────────────────────────────────────────────
 * Set these in Project Settings → Script properties:
 *   GAS_WEBHOOK_SECRET   — shared secret validated on every doPost call
 *   RECIPIENT_EMAILS     — comma-separated fallback recipient list
 *   GITHUB_WEBHOOK_URL   — (optional) URL to notify GitHub after sending
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const PROP_SECRET        = 'GAS_WEBHOOK_SECRET';
const PROP_RECIPIENTS    = 'RECIPIENT_EMAILS';
const PROP_GITHUB_WH     = 'GITHUB_WEBHOOK_URL';
const REPORT_PAGES_BASE  = 'https://majixai.github.io/majixai.github.io';

// Schedule slots → { dayOfWeek[], hour (24h) }
// dayOfWeek: 0=Sunday … 6=Saturday  (same as JS Date.getDay())
const SCHEDULE_SLOTS = [
  { name: 'weekday_open',  days: [1,2,3,4,5], hour:  6, fn: 'sendWeekdayOpen'  },
  { name: 'weekday_9am',   days: [1,2,3,4,5], hour:  9, fn: 'sendWeekday9am'   },
  { name: 'weekday_10am',  days: [1,2,3,4,5], hour: 10, fn: 'sendWeekday10am'  },
  { name: 'weekday_1pm',   days: [1,2,3,4,5], hour: 13, fn: 'sendWeekday1pm'   },
  { name: 'weekend_9am',   days: [0,6],        hour:  9, fn: 'sendWeekendMorning' },
  { name: 'weekend_10pm',  days: [0,6],        hour: 22, fn: 'sendWeekendEvening' },
];


// ── Webhook entry point ───────────────────────────────────────────────────────

/**
 * Handles HTTP POST from GitHub Actions (or any caller).
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Support GitHub repository-dispatch wrapper
    const payload = (body.action === 'financial_email' && body.client_payload)
      ? body.client_payload
      : body;

    // Validate shared secret
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty(PROP_SECRET);
    if (expectedSecret && payload.secret !== expectedSecret) {
      return _jsonOut({ ok: false, error: 'Unauthorized' }, 403);
    }

    const subject    = payload.subject    || '(no subject)';
    const html       = payload.html       || '';
    const plain      = payload.plain      || _htmlToPlain(html);
    const recipients = _parseRecipients(payload.recipients);
    const mode       = payload.mode       || 'unknown';

    if (!html) {
      return _jsonOut({ ok: false, error: 'html body is required' });
    }
    if (recipients.length === 0) {
      return _jsonOut({ ok: false, error: 'No recipients provided' });
    }

    const sent = _sendEmails(subject, html, plain, recipients);

    // Optional: notify GitHub that the email was sent
    _notifyGitHub({ mode: mode, sent: sent, subject: subject });

    console.log(`[gas_mailer] doPost sent ${sent} email(s) for mode=${mode}`);
    return _jsonOut({ ok: true, sent: sent, mode: mode });

  } catch (err) {
    console.error('[gas_mailer] doPost error:', err.message);
    return _jsonOut({ ok: false, error: err.message });
  }
}

/**
 * Handles HTTP GET — returns a simple health-check response.
 * Useful to verify the deployment URL is live.
 */
function doGet() {
  return _jsonOut({ ok: true, service: 'MajixAI gas_mailer', version: '1.0' });
}


// ── Core send helper ──────────────────────────────────────────────────────────

/**
 * Sends an HTML email to one or more recipients via MailApp.
 * Falls back to GmailApp if MailApp quota is exhausted.
 *
 * @param {string}   subject
 * @param {string}   html
 * @param {string}   plain   - plain-text fallback
 * @param {string[]} recipients
 * @returns {number} number of emails actually sent
 */
function _sendEmails(subject, html, plain, recipients) {
  let sent = 0;
  recipients.forEach(function (to) {
    try {
      MailApp.sendEmail({
        to:       to,
        subject:  subject,
        htmlBody: html,
        body:     plain,
      });
      sent++;
    } catch (mailErr) {
      // Quota may be exhausted — try GmailApp as fallback
      console.warn('[gas_mailer] MailApp failed, trying GmailApp:', mailErr.message);
      try {
        GmailApp.sendEmail(to, subject, plain, { htmlBody: html });
        sent++;
      } catch (gmailErr) {
        console.error('[gas_mailer] GmailApp also failed for', to, ':', gmailErr.message);
      }
    }
  });
  return sent;
}


// ── GAS-native scheduled triggers ────────────────────────────────────────────

// Set of exact handler function names managed by this script.
// Used to avoid accidentally deleting unrelated triggers.
const _MANAGED_FN_NAMES = new Set(
  SCHEDULE_SLOTS.map(function (s) { return s.fn; })
);

/**
 * Install all time-based triggers.
 * Run this ONCE manually from the GAS editor.
 * It will delete existing MajixAI triggers before recreating them.
 */
function installFinancialEmailTriggers() {
  // Remove only the triggers created by this script (exact function-name match)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (_MANAGED_FN_NAMES.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  SCHEDULE_SLOTS.forEach(function (slot) {
    // GAS time-based triggers only support daily/weekly, not "weekdays only".
    // We therefore create a single daily trigger per slot-function and let
    // the slot function itself check the day-of-week at runtime.
    ScriptApp.newTrigger(slot.fn)
      .timeBased()
      .atHour(slot.hour)
      .nearMinute(0)
      .everyDays(1)
      .inTimezone('America/New_York')
      .create();
    console.log('[gas_mailer] Installed trigger for', slot.fn, 'at hour', slot.hour);
  });

  console.log('[gas_mailer] All triggers installed.');
}

/**
 * Remove all MajixAI financial email triggers.
 */
function removeFinancialEmailTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (_MANAGED_FN_NAMES.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });
  console.log('[gas_mailer] All financial email triggers removed.');
}


// ── Slot functions (called by triggers) ──────────────────────────────────────
// Each function checks the current day-of-week and skips if out-of-schedule.

function sendWeekdayOpen()    { _dispatchSlot('weekday_open',  [1,2,3,4,5]); }
function sendWeekday9am()     { _dispatchSlot('weekday_9am',   [1,2,3,4,5]); }
function sendWeekday10am()    { _dispatchSlot('weekday_10am',  [1,2,3,4,5]); }
function sendWeekday1pm()     { _dispatchSlot('weekday_1pm',   [1,2,3,4,5]); }
function sendWeekendMorning() { _dispatchSlot('weekend_9am',   [0,6]);        }
function sendWeekendEvening() { _dispatchSlot('weekend_10pm',  [0,6]);        }

/**
 * Core dispatcher for schedule slots.
 * Builds a minimal HTML email directly from GAS (no Python needed).
 *
 * @param {string}   modeName
 * @param {number[]} allowedDays  0=Sun … 6=Sat
 */
function _dispatchSlot(modeName, allowedDays) {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat in local timezone
  if (allowedDays.indexOf(dow) === -1) {
    console.log('[gas_mailer] Skipping', modeName, '— not a scheduled day (DOW=' + dow + ')');
    return;
  }

  const recipients = _parseRecipients(
    PropertiesService.getScriptProperties().getProperty(PROP_RECIPIENTS) || ''
  );
  if (recipients.length === 0) {
    console.error('[gas_mailer] No recipients configured in Script Properties.');
    return;
  }

  const subject = _buildGasSubject(modeName, now);
  const html    = _buildGasHtml(modeName, now);
  const plain   = _htmlToPlain(html);

  const sent = _sendEmails(subject, html, plain, recipients);
  console.log('[gas_mailer] Slot', modeName, '→ sent', sent, 'email(s)');

  _notifyGitHub({ mode: modeName, sent: sent, subject: subject });
}


// ── GAS-side HTML report builder ──────────────────────────────────────────────
// This is a lightweight fallback used when the GAS trigger fires independently
// (without Python generating the HTML).  For full advanced metrics, rely on the
// GitHub Actions → GAS webhook flow where Python builds the full report.

function _buildGasSubject(mode, now) {
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'EEEE, MMMM d yyyy');
  const prefixes = {
    weekday_open:  '🌅 Pre-Market Bull Alert',
    weekday_9am:   '📊 9 AM Market Snapshot',
    weekday_10am:  '🔔 10 AM Mid-Morning Report',
    weekday_1pm:   '🏦 1 PM Indices Close Report',
    weekend_9am:   '🌅 Weekend Market Morning Digest',
    weekend_10pm:  '🌙 Weekend Market Evening Digest',
  };
  return (prefixes[mode] || '📈 Financial Report') + ' — ' + dateStr;
}

function _buildGasHtml(mode, now) {
  const ts      = Utilities.formatDate(now, 'UTC', "yyyy-MM-dd HH:mm 'UTC'");
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'EEEE, MMMM d yyyy');
  const subject = _buildGasSubject(mode, now);

  // Fetch index data via GOOGLEFINANCE (GAS built-in)
  const indices = _fetchIndicesGas();

  let rows = '';
  indices.forEach(function (idx) {
    const chgClass = idx.change >= 0 ? 'bull' : 'bear';
    const sign     = idx.change >= 0 ? '+' : '';
    rows += '<tr>'
      + '<td><strong>' + idx.label + '</strong></td>'
      + '<td>' + (idx.price  ? idx.price.toFixed(2)  : '—') + '</td>'
      + '<td class="' + chgClass + '">' + sign + (idx.change ? idx.change.toFixed(2) : '0.00') + '%</td>'
      + '</tr>';
  });

  const chartLinks = [
    [REPORT_PAGES_BASE + '/dji_1pm_close/dji_1pm_prediction.png',            'DJI 1PM Prediction'],
    [REPORT_PAGES_BASE + '/dji_monte_carlo/dji_simulation_output.png',        'DJI Monte Carlo'],
    [REPORT_PAGES_BASE + '/sp_closing_projection/sp_closing_projection_output.png', 'S&P 500 Projection'],
    [REPORT_PAGES_BASE + '/yfinance_chart/index.html',                        'Interactive Charts'],
    [REPORT_PAGES_BASE + '/yfinance/index.html',                              'Live Dashboard'],
  ].map(function (pair) {
    return '<li><a href="' + pair[0] + '">' + pair[1] + '</a></li>';
  }).join('');

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
    + '<style>'
    + 'body{margin:0;padding:0;background:#0d1117;color:#e6edf3;font-family:Arial,sans-serif;font-size:14px}'
    + '.wrap{max-width:800px;margin:0 auto;padding:20px}'
    + 'h1{color:#58a6ff;font-size:20px}'
    + '.sub{color:#8b949e;font-size:12px;margin-bottom:16px}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:16px}'
    + 'th{background:#21262d;color:#8b949e;font-size:11px;text-transform:uppercase;padding:6px 10px;text-align:left}'
    + 'td{padding:6px 10px;border-bottom:1px solid #21262d}'
    + '.bull{color:#00c853;font-weight:600}'
    + '.bear{color:#d50000;font-weight:600}'
    + '.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px 18px;margin-bottom:14px}'
    + 'a{color:#58a6ff}footer{color:#8b949e;font-size:11px;margin-top:20px;border-top:1px solid #21262d;padding-top:10px}'
    + '</style></head><body><div class="wrap">'
    + '<h1>📈 ' + subject + '</h1>'
    + '<div class="sub">Generated by GAS · ' + ts + '</div>'
    + '<div class="card">'
    + '<h2 style="color:#58a6ff;font-size:15px">📊 Major Indices</h2>'
    + '<table><thead><tr><th>Index</th><th>Last</th><th>Chg%</th></tr></thead><tbody>'
    + rows
    + '</tbody></table></div>'
    + '<div class="card">'
    + '<h2 style="color:#58a6ff;font-size:15px">🔗 Chart Links</h2>'
    + '<ul>' + chartLinks + '</ul>'
    + '<p style="font-size:12px;color:#8b949e">Note: For full advanced metrics (GBM forecasts, RSI, MACD, OU κ, '
    + 'Higuchi FD) use the GitHub Actions → GAS webhook flow.</p>'
    + '</div>'
    + '<footer>MajixAI Financial Reports · Not financial advice.</footer>'
    + '</div></body></html>';
}

/**
 * Fetch major index data using UrlFetchApp (Yahoo Finance).
 * Returns an array of {label, ticker, price, change} objects.
 * Falls back to empty values if the fetch fails.
 */
function _fetchIndicesGas() {
  const INDICES = [
    { label: 'S&P 500',      ticker: '%5EGSPC' },
    { label: 'Dow Jones',    ticker: '%5EDJI'  },
    { label: 'NASDAQ',       ticker: '%5EIXIC' },
    { label: 'Russell 2000', ticker: '%5ERUT'  },
    { label: 'VIX',          ticker: '%5EVIX'  },
  ];

  return INDICES.map(function (idx) {
    try {
      const url  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + idx.ticker
        + '?interval=1d&range=2d';
      const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
      const json   = JSON.parse(resp.getContentText());
      const result = json.chart.result[0];
      const closes = result.indicators.quote[0].close;
      const last   = closes[closes.length - 1];
      const prev   = closes[closes.length - 2] || last;
      return {
        label:  idx.label,
        ticker: idx.ticker,
        price:  last,
        change: prev ? ((last / prev) - 1) * 100 : 0,
      };
    } catch (e) {
      console.warn('[gas_mailer] _fetchIndicesGas failed for', idx.ticker, ':', e.message);
      return { label: idx.label, ticker: idx.ticker, price: null, change: 0 };
    }
  });
}


// ── Optional GitHub notification ─────────────────────────────────────────────

/**
 * POST a small status payload back to a GitHub webhook URL (if configured).
 * This lets you see in GitHub that the email was dispatched by GAS.
 *
 * @param {Object} info  { mode, sent, subject }
 */
function _notifyGitHub(info) {
  const url = PropertiesService.getScriptProperties().getProperty(PROP_GITHUB_WH);
  if (!url) return; // Not configured — skip silently
  try {
    UrlFetchApp.fetch(url, {
      method:      'post',
      contentType: 'application/json',
      payload:     JSON.stringify({
        event_type:     'gas_email_sent',
        client_payload: {
          mode:    info.mode,
          sent:    info.sent,
          subject: info.subject,
          ts:      new Date().toISOString(),
        },
      }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    console.warn('[gas_mailer] _notifyGitHub failed:', e.message);
  }
}


// ── Utility helpers ───────────────────────────────────────────────────────────

/**
 * Parse a comma-separated recipients string into an array of trimmed addresses.
 * Accepts both a plain string and an array.
 *
 * @param {string|string[]} raw
 * @returns {string[]}
 */
function _parseRecipients(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

/**
 * Very lightweight HTML → plain-text strip (removes tags, decodes common entities).
 *
 * @param {string} html
 * @returns {string}
 */
function _htmlToPlain(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Return a JSON ContentService response.
 *
 * @param {Object} data
 * @param {number} [_status]  ignored — GAS does not support custom status codes
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function _jsonOut(data, _status) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
