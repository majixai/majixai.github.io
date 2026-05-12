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
 * Store secrets only in Script Properties / GitHub Actions secrets. Do not
 * paste PATs or API keys into source files.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const PROP_SECRET        = 'GAS_WEBHOOK_SECRET';
const PROP_RECIPIENTS    = 'RECIPIENT_EMAILS';
const PROP_GITHUB_WH     = 'GITHUB_WEBHOOK_URL';
const PROP_CALENDAR_ID   = 'TRADING_CALENDAR_ID';   // Google Calendar ID for trading events
const REPORT_PAGES_BASE  = 'https://majixai.github.io/majixai.github.io';

// Schedule slots → { dayOfWeek[], hour (24h), minute, fn, calendarTitle }
// dayOfWeek: 0=Sunday … 6=Saturday  (same as JS Date.getDay())
// All times in America/New_York (ET).
const SCHEDULE_SLOTS = [
  // ── Legacy UTC-aligned slots (preserved for backward compatibility) ──────
  { name: 'weekday_open',  days: [1,2,3,4,5], hour:  6, minute:  0, fn: 'sendWeekdayOpen',      calendarTitle: '🌅 Pre-Market Bull Alert'         },
  { name: 'weekday_9am',   days: [1,2,3,4,5], hour:  9, minute:  0, fn: 'sendWeekday9am',        calendarTitle: '📊 9 AM Market Snapshot'           },
  { name: 'weekday_10am',  days: [1,2,3,4,5], hour: 10, minute:  0, fn: 'sendWeekday10am',       calendarTitle: '🔔 10 AM Mid-Morning Report'       },
  { name: 'weekday_1pm',   days: [1,2,3,4,5], hour: 13, minute:  0, fn: 'sendWeekday1pm',        calendarTitle: '🏦 1 PM Indices Close Report'      },
  { name: 'weekend_9am',   days: [0,6],        hour:  9, minute:  0, fn: 'sendWeekendMorning',    calendarTitle: '🌅 Weekend Market Morning Digest'  },
  { name: 'weekend_10pm',  days: [0,6],        hour: 22, minute:  0, fn: 'sendWeekendEvening',    calendarTitle: '🌙 Weekend Market Evening Digest'  },
  // ── Trading-Prompt Agent slots (ET times) ────────────────────────────────
  // Includes Sunday night so Monday's regular session has a 10 PM ET forecast.
  { name: 'nightly_ixic_forecast', days: [0,1,2,3,4], hour: 22, minute:  0, fn: 'sendNightlyIXICForecast', calendarTitle: '🌙 IXIC Nightly Forecast' },
  { name: 'overnight_day_plan',  days: [1,2,3,4,5], hour: 23, minute:  0, fn: 'sendOvernightDayPlan',   calendarTitle: '🌙 Trading Day Ahead Plan'         },
  { name: 'overnight_bull_pick', days: [1,2,3,4,5], hour:  1, minute:  0, fn: 'sendOvernightBullPick',  calendarTitle: '⚡ Most Bullish Pick Alert'        },
  { name: 'overnight_project',   days: [1,2,3,4,5], hour:  3, minute:  0, fn: 'sendOvernightProject',   calendarTitle: '🛠️ Overnight Project Brief'       },
  { name: 'premarket_1pm_proj',  days: [1,2,3,4,5], hour:  4, minute:  0, fn: 'sendPremarket1pmProj',   calendarTitle: '📐 Projected 1 PM Close Brief'    },
  { name: 'premarket_followup',  days: [1,2,3,4,5], hour:  5, minute: 30, fn: 'sendPremarketFollowup',  calendarTitle: '📊 Pre-Market Follow-Up (5:30 AM)' },
  { name: 'premarket_extra',     days: [1,2,3,4,5], hour:  6, minute: 30, fn: 'sendPremarketExtra',     calendarTitle: '🔔 Pre-Market Final Brief (6:30 AM)'},
  { name: 'market_bullnews',     days: [1,2,3,4,5], hour: 10, minute:  0, fn: 'sendMarketBullNews',     calendarTitle: '⚡ Bull Momentum / News Alert (10 AM)'},
  { name: 'market_midday',       days: [1,2,3,4,5], hour: 11, minute: 59, fn: 'sendMarketMidday',       calendarTitle: '⏱️ Midday Market Follow-Up (11:59 AM)'},
  { name: 'market_1pm_et',       days: [1,2,3,4,5], hour: 13, minute:  0, fn: 'sendMarket1pmET',        calendarTitle: '🏦 1 PM ET Index Feedback + Next Day Plan'},
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

    // Create a Google Calendar event for this report slot
    const slot = SCHEDULE_SLOTS.find(function (s) { return s.name === mode; });
    _createCalendarEvent(
      (slot && slot.calendarTitle) ? slot.calendarTitle : subject,
      mode,
      new Date()
    );

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
  return _jsonOut({ ok: true, service: 'MajixAI gas_mailer', version: '2.0', features: ['email', 'calendar'] });
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
      .nearMinute(slot.minute || 0)
      .everyDays(1)
      .inTimezone('America/New_York')
      .create();
    console.log('[gas_mailer] Installed trigger for', slot.fn,
                'at hour', slot.hour, 'min', (slot.minute || 0));
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

function sendWeekdayOpen()    { _dispatchSlot('weekday_open',       [1,2,3,4,5]); }
function sendWeekday9am()     { _dispatchSlot('weekday_9am',        [1,2,3,4,5]); }
function sendWeekday10am()    { _dispatchSlot('weekday_10am',       [1,2,3,4,5]); }
function sendWeekday1pm()     { _dispatchSlot('weekday_1pm',        [1,2,3,4,5]); }
function sendWeekendMorning() { _dispatchSlot('weekend_9am',        [0,6]);        }
function sendWeekendEvening() { _dispatchSlot('weekend_10pm',       [0,6]);        }
// Trading-Prompt Agent slots
function sendNightlyIXICForecast() { _dispatchSlot('nightly_ixic_forecast', [0,1,2,3,4]); }
function sendOvernightDayPlan()  { _dispatchSlot('overnight_day_plan',  [1,2,3,4,5]); }
function sendOvernightBullPick() { _dispatchSlot('overnight_bull_pick', [1,2,3,4,5]); }
function sendOvernightProject()  { _dispatchSlot('overnight_project',   [1,2,3,4,5]); }
function sendPremarket1pmProj()  { _dispatchSlot('premarket_1pm_proj',  [1,2,3,4,5]); }
function sendPremarketFollowup() { _dispatchSlot('premarket_followup',  [1,2,3,4,5]); }
function sendPremarketExtra()    { _dispatchSlot('premarket_extra',     [1,2,3,4,5]); }
function sendMarketBullNews()    { _dispatchSlot('market_bullnews',     [1,2,3,4,5]); }
function sendMarketMidday()      { _dispatchSlot('market_midday',       [1,2,3,4,5]); }
function sendMarket1pmET()       { _dispatchSlot('market_1pm_et',       [1,2,3,4,5]); }

/**
 * Core dispatcher for schedule slots.
 * Builds a minimal HTML email directly from GAS (no Python needed),
 * sends it via Gmail, and creates a Google Calendar event.
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

  // Create a Google Calendar event for this report slot
  const slot = SCHEDULE_SLOTS.find(function (s) { return s.name === modeName; });
  if (slot) {
    _createCalendarEvent(slot.calendarTitle || subject, modeName, now);
  }

  _notifyGitHub({ mode: modeName, sent: sent, subject: subject });
}


// ── GAS-side HTML report builder ──────────────────────────────────────────────
// This is a lightweight fallback used when the GAS trigger fires independently
// (without Python generating the HTML).  For full advanced metrics, rely on the
// GitHub Actions → GAS webhook flow where Python builds the full report.

function _buildGasSubject(mode, now) {
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'EEEE, MMMM d yyyy');
  const prefixes = {
    weekday_open:       '🌅 Pre-Market Bull Alert',
    weekday_9am:        '📊 9 AM Market Snapshot',
    weekday_10am:       '🔔 10 AM Mid-Morning Report',
    weekday_1pm:        '🏦 1 PM Indices Close Report',
    weekend_9am:        '🌅 Weekend Market Morning Digest',
    weekend_10pm:       '🌙 Weekend Market Evening Digest',
    nightly_ixic_forecast: '🌙 IXIC Nightly Market Forecast',
    overnight_day_plan: '🌙 Trading Day Ahead Plan',
    overnight_bull_pick:'⚡ Most Bullish Pick Alert',
    overnight_project:  '🛠️ Overnight Project Brief',
    premarket_1pm_proj: '📐 Projected 1 PM Close',
    premarket_followup: '📊 Pre-Market Follow-Up (5:30 AM)',
    premarket_extra:    '🔔 Pre-Market Final Brief (6:30 AM)',
    market_bullnews:    '⚡ Bull Momentum / News Alert (10 AM)',
    market_midday:      '⏱️ Midday Market Follow-Up (11:59 AM)',
    market_1pm_et:      '🏦 1 PM ET Index Feedback + Next Day Plan',
  };
  return (prefixes[mode] || '📈 Financial Report') + ' — ' + dateStr;
}

function _buildGasHtml(mode, now) {
  const ts      = Utilities.formatDate(now, 'UTC', "yyyy-MM-dd HH:mm 'UTC'");
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'EEEE, MMMM d yyyy');
  const subject = _buildGasSubject(mode, now);

  // Fetch index data via UrlFetchApp (Yahoo Finance)
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
    [REPORT_PAGES_BASE + '/ixic_lstm_forecast/output/ixic_summary.json',        'IXIC Forecast Summary JSON'],
    [REPORT_PAGES_BASE + '/dji_1pm_close/dji_1pm_prediction.png',            'DJI 1PM Prediction'],
    [REPORT_PAGES_BASE + '/dji_monte_carlo/dji_simulation_output.png',        'DJI Monte Carlo'],
    [REPORT_PAGES_BASE + '/sp_closing_projection/sp_closing_projection_output.png', 'S&P 500 Projection'],
    [REPORT_PAGES_BASE + '/yfinance_chart/index.html',                        'Interactive Charts'],
    [REPORT_PAGES_BASE + '/yfinance/index.html',                              'Live Dashboard'],
  ].map(function (pair) {
    return '<li><a href="' + pair[0] + '">' + pair[1] + '</a></li>';
  }).join('');

  // Trading-prompt agent: additional prompt cards for new slots
  const tradingPromptCards = {
    nightly_ixic_forecast: [
      'Forecast the next IXIC session OHLCV using weekly, daily, hourly, and 15-minute structure.',
      'Highlight repeated patterns across weekly/daily vs hourly/15-minute behaviour and note invalidation levels.',
      'If Gemini augmentation is enabled elsewhere, keep it rate-limited and sourced from secure secret storage only.',
    ],
    overnight_day_plan: [
      'Summarise macro drivers for the next session and suggest 3 entry setups.',
      'Outline the bull vs bear open scenarios for S&P 500 based on overnight futures.',
      'List the 5 key support/resistance levels for DJI and NASDAQ entering tomorrow.',
    ],
    overnight_bull_pick: [
      'Which stock has the strongest GBM + RSI + MACD confluence? Provide a trade thesis.',
      'Describe overnight on-chain signals for the top-ranked crypto bull pick.',
      'Compare Higuchi FD of top stock vs top crypto and implied next-day volatility.',
    ],
    overnight_project: [
      'Review OU mean-reversion strategy performance and suggest parameter recalibrations.',
      'Generate a 3-point GBM simulation brief for SPY, QQQ, and BTC.',
      'Outline a VIX-derivative hedge strategy if RSI > 70 or < 30 at the open.',
    ],
    premarket_1pm_proj: [
      'What is the most likely S&P 500 level at 1 PM ET? Give bull, base, and bear cases.',
      'Estimate probability DJI closes above its 20-day MA by 1 PM using GBM + RSI.',
      'If projected 1 PM close is within 0.5% of pre-market level, suggest range-bound strategies.',
    ],
    premarket_followup: [
      'Which sector shows the strongest pre-market momentum from the top movers list?',
      'Describe risk:reward for a gap-up continuation vs fade-the-gap for top 3 picks.',
      'Has the overnight bull narrative changed? What new catalyst or risk factor emerged?',
    ],
    premarket_extra: [
      'Final: rank today\'s 3 highest-conviction trades with entry, target, stop, and confidence.',
      'Does VIX level suggest elevated uncertainty? How should position sizing be adjusted?',
      'Identify early-morning news events creating gap-open opportunities in the first 30 min.',
    ],
    market_bullnews: [
      'Alert: scan for RSI > 75 AND bull_score > 5 movers. News-driven or pure momentum?',
      'If S&P 500 is up > 1.5% by 10 AM, is this a sustainable trend day or overextension?',
      'Identify the single most news-driven bull catalyst now and outline a momentum trade plan.',
    ],
    market_midday: [
      'Compare 11:59 AM index levels against the 4 AM projected 1 PM close. Which scenario?',
      'For open morning positions, hold through lunch or take partial profits? Assess momentum.',
      'Preview afternoon catalysts (Fed speaker, auction, MOC imbalances) and directional bias.',
    ],
    market_1pm_et: [
      'Evaluate today\'s index performance vs pre-market projection. Describe variance and cause.',
      'Forecast the final 3 PM close range for S&P 500 with confidence percentages.',
      'Plan tomorrow\'s top 3 trading opportunities based on today\'s sector performance.',
      'Review today\'s top bull movers: continuation vs consolidation potential tomorrow?',
      'Summarise today\'s session learnings and how to refine tomorrow\'s pre-market brief.',
    ],
  };

  let promptSection = '';
  const prompts = tradingPromptCards[mode];
  if (prompts && prompts.length > 0) {
    promptSection = '<div class="card">'
      + '<h2 style="color:#58a6ff;font-size:15px">💡 Trading Prompts</h2>'
      + '<ol style="padding-left:20px;line-height:1.8">'
      + prompts.map(function (p) { return '<li style="margin-bottom:6px">' + p + '</li>'; }).join('')
      + '</ol></div>';
  }

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
    + promptSection
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


// ── Google Calendar integration ───────────────────────────────────────────────

/**
 * Create (or update) a 30-minute Google Calendar event for a report slot.
 *
 * Calendar selection (in priority order):
 *   1. TRADING_CALENDAR_ID script property — a dedicated "MajixAI Trading" calendar ID.
 *   2. The script owner's primary calendar (CalendarApp.getDefaultCalendar()).
 *
 * The event title matches the slot's calendarTitle.
 * An existing event on the same day with the same title is updated rather than
 * duplicated.
 *
 * @param {string} title      Human-readable event title (e.g. '🌙 Trading Day Ahead Plan').
 * @param {string} modeName   Internal mode identifier for description metadata.
 * @param {Date}   now        The current Date (used as the event start time).
 */
function _createCalendarEvent(title, modeName, now) {
  try {
    const calId = PropertiesService.getScriptProperties().getProperty(PROP_CALENDAR_ID);
    const cal   = calId
      ? CalendarApp.getCalendarById(calId)
      : CalendarApp.getDefaultCalendar();

    if (!cal) {
      console.warn('[gas_mailer] _createCalendarEvent: calendar not found. '
        + 'Set TRADING_CALENDAR_ID script property or ensure default calendar is accessible.');
      return;
    }

    const start = new Date(now.getTime());
    const end   = new Date(start.getTime() + 30 * 60 * 1000); // 30-minute event

    const description = 'MajixAI Trading Prompt Agent\n'
      + 'Mode: ' + modeName + '\n'
      + 'Generated: ' + now.toISOString() + '\n\n'
      + 'Open the email report for full index data, GBM forecasts, and trading prompts.\n'
      + 'Dashboard: ' + REPORT_PAGES_BASE + '/yfinance/index.html';

    // Check for a duplicate event on the same calendar day with the same title
    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = cal.getEvents(dayStart, dayEnd).filter(function (ev) {
      return ev.getTitle() === title;
    });

    if (existing.length > 0) {
      // Update the first matching event instead of creating a duplicate
      const ev = existing[0];
      ev.setTime(start, end);
      ev.setDescription(description);
      console.log('[gas_mailer] Calendar event updated:', title, start.toISOString());
    } else {
      cal.createEvent(title, start, end, { description: description });
      console.log('[gas_mailer] Calendar event created:', title, start.toISOString());
    }
  } catch (err) {
    console.warn('[gas_mailer] _createCalendarEvent failed:', err.message);
  }
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
