// Google Apps Script — TradingView Integration Data Pipeline (Extended Edition)
//
// This script manages multi-file data synchronisation between Google Sheets /
// Drive and the GitHub repository that powers the TradingView Pine Seeds feed.
//
// Key operations:
//   1. updateDataFile()        — compress + push the primary sample CSV
//   2. pushAllDataFiles()      — batch push every file in DATA_FILES list
//   3. pushJsonPayload()       — construct and push a JSON analytics payload
//   4. validateDataIntegrity() — sanity-check CSV before committing
//   5. archiveSnapshot()       — write a timestamped archive copy
//   6. sendStatusEmail()       — email result summary (when NOTIFY_EMAIL set)
//   7. doGet(e)                — web-app endpoint for GitHub Actions trigger

// ─── CONFIGURATION ────────────────────────────────────────────────────────────
var GITHUB_USERNAME   = "your-username";
var GITHUB_REPO       = "your-repository";
var DEFAULT_BRANCH    = "main";
var COMMIT_AUTHOR     = "pine-poi-updater[bot]";
var COMMIT_EMAIL      = "pine-poi-updater@users.noreply.github.com";

// Primary data file
var SOURCE_CSV_PATH   = "data/sample_data.csv";
var DATA_FILE_PATH    = "data/my_data.dat";

// Batch file manifest — all files managed by this script
var DATA_FILES = [
  { src: "data/sample_data.csv",        dst: "data/my_data.dat",            compress: true  },
  { src: "data/google_finance_quotes.json", dst: "data/gf_quotes.json",     compress: false },
  { src: "data/quotes_snapshot.csv",    dst: "data/quotes_snapshot.csv",    compress: false },
  { src: "data/tensor_forecast.json",   dst: "data/tensor_forecast.json",   compress: false },
];

// Retry / rate-limit settings
var MAX_RETRIES       = 3;
var RETRY_DELAY_MS    = 2000;
var REQUEST_DELAY_MS  = 500;   // inter-request delay for batch push

// Email notification — leave blank to disable
var NOTIFY_EMAIL      = "";    // e.g. "you@example.com"

// Archive folder path inside the repo (timestamped snapshots)
var ARCHIVE_PREFIX    = "data/archive/";


// ─── 1. PRIMARY UPDATE ────────────────────────────────────────────────────────

/**
 * Main entry point: validate, compress, and push the primary CSV.
 * Called on a schedule or from doGet().
 */
function updateDataFile() {
  var token = _getToken();
  if (!token) return;

  var sourceData = fetchSourceDataFromGitHub(SOURCE_CSV_PATH);
  if (!sourceData) {
    Logger.log("Could not fetch source CSV. Aborting.");
    return;
  }

  // Validate before pushing
  var validation = validateDataIntegrity(sourceData);
  if (!validation.ok) {
    Logger.log("Data integrity check failed: " + validation.reason);
    sendStatusEmail("Data Update FAILED — integrity check", validation.reason);
    return;
  }
  Logger.log("Integrity check passed: " + validation.summary);

  var compressed = Utilities.gzip(Utilities.newBlob(sourceData, "text/plain"));
  var success    = pushToGitHubWithRetry(token, compressed.getBytes(), DATA_FILE_PATH);
  var msg        = success
    ? "Primary data file updated successfully."
    : "Failed to update primary data file after " + MAX_RETRIES + " attempts.";

  Logger.log(msg);
  sendStatusEmail("Data Update " + (success ? "OK" : "FAILED"), msg);
}


// ─── 2. BATCH PUSH ────────────────────────────────────────────────────────────

/**
 * Push every file listed in DATA_FILES from the repo source paths to their
 * destination paths.  Non-compressible files (JSON, uncompressed CSV) are
 * pushed as-is; compressible ones are gzip'd first.
 *
 * Each file fetch/push is wrapped in the full retry loop.
 */
function pushAllDataFiles() {
  var token   = _getToken();
  if (!token) return;

  var results = [];

  for (var i = 0; i < DATA_FILES.length; i++) {
    var spec = DATA_FILES[i];
    Utilities.sleep(REQUEST_DELAY_MS);

    Logger.log("[" + (i + 1) + "/" + DATA_FILES.length + "] Processing: " + spec.src);

    var data = fetchSourceDataFromGitHub(spec.src);
    if (!data) {
      results.push({ file: spec.src, status: "SKIP — fetch failed" });
      continue;
    }

    var bytes;
    if (spec.compress) {
      var blob = Utilities.gzip(Utilities.newBlob(data, "text/plain"));
      bytes    = blob.getBytes();
    } else {
      bytes = Utilities.newBlob(data, "text/plain").getBytes();
    }

    var ok = pushToGitHubWithRetry(token, bytes, spec.dst);
    results.push({ file: spec.dst, status: ok ? "OK" : "FAILED" });
  }

  var summary = results.map(function(r) {
    return r.file + " → " + r.status;
  }).join("\n");

  Logger.log("Batch push complete:\n" + summary);
  sendStatusEmail("Batch Push Summary", summary);
}


// ─── 3. JSON ANALYTICS PAYLOAD ────────────────────────────────────────────────

/**
 * Build a lightweight JSON payload summarising the current data snapshot
 * (row count, last date, simple price stats) and push it to the repo.
 *
 * Useful for the Pine Seeds indicator to display metadata without re-reading
 * the full dataset.
 */
function pushJsonPayload() {
  var token = _getToken();
  if (!token) return;

  var csvData = fetchSourceDataFromGitHub(SOURCE_CSV_PATH);
  if (!csvData) return;

  var stats   = computeCsvStats(csvData);
  var payload = {
    generated_at: new Date().toISOString(),
    source:       SOURCE_CSV_PATH,
    repo:         GITHUB_USERNAME + "/" + GITHUB_REPO,
    stats:        stats,
  };

  var jsonStr = JSON.stringify(payload, null, 2);
  var bytes   = Utilities.newBlob(jsonStr, "application/json").getBytes();
  var ok      = pushToGitHubWithRetry(token, bytes, "data/stats_payload.json");
  Logger.log("JSON payload push: " + (ok ? "OK" : "FAILED"));
}


// ─── 4. DATA INTEGRITY VALIDATION ─────────────────────────────────────────────

/**
 * Validate CSV content before committing to the repository.
 *
 * Checks:
 *   - Minimum row count (> 5 data rows after header)
 *   - Required column presence (date, close)
 *   - No more than 20% blank close values
 *   - Last-row date is parseable
 *
 * Returns: { ok: bool, reason: string, summary: string }
 */
function validateDataIntegrity(csvText) {
  if (!csvText || csvText.trim().length === 0) {
    return { ok: false, reason: "Empty CSV content.", summary: "" };
  }

  var lines  = csvText.trim().split("\n");
  var header = lines[0].toLowerCase().split(",").map(function(c) { return c.trim(); });

  var hasDate  = header.some(function(c) { return c === "date" || c === "time" || c === "datetime"; });
  var hasClose = header.some(function(c) { return c === "close" || c === "price"; });

  if (!hasDate) {
    return { ok: false, reason: "Missing date/time column in CSV header.", summary: header.join(",") };
  }
  if (!hasClose) {
    return { ok: false, reason: "Missing close/price column in CSV header.", summary: header.join(",") };
  }

  var dataLines = lines.slice(1).filter(function(l) { return l.trim().length > 0; });
  if (dataLines.length < 5) {
    return { ok: false, reason: "Too few data rows: " + dataLines.length, summary: "" };
  }

  // Check for blank close values
  var closeIdx = header.indexOf("close") !== -1 ? header.indexOf("close") : header.indexOf("price");
  var blanks   = 0;
  for (var i = 0; i < dataLines.length; i++) {
    var cols = dataLines[i].split(",");
    if (!cols[closeIdx] || cols[closeIdx].trim() === "") blanks++;
  }
  var blankPct = blanks / dataLines.length;
  if (blankPct > 0.20) {
    return {
      ok: false,
      reason: "Too many blank close values: " + (blankPct * 100).toFixed(1) + "%",
      summary: "",
    };
  }

  return {
    ok:      true,
    reason:  "",
    summary: dataLines.length + " rows, " + blanks + " blanks (" + (blankPct * 100).toFixed(1) + "%)",
  };
}


// ─── 5. CSV STATS ─────────────────────────────────────────────────────────────

/**
 * Parse a CSV string and return basic price statistics.
 *
 * @param {string} csvText
 * @return {{ rows, first_date, last_date, min_close, max_close, avg_close }}
 */
function computeCsvStats(csvText) {
  var lines  = csvText.trim().split("\n");
  if (lines.length < 2) return { rows: 0 };

  var header   = lines[0].toLowerCase().split(",").map(function(c) { return c.trim(); });
  var closeIdx = header.indexOf("close") !== -1 ? header.indexOf("close") : header.indexOf("price");
  var dateIdx  = ["date", "time", "datetime"].reduce(function(acc, k) {
    return acc !== -1 ? acc : header.indexOf(k);
  }, -1);

  var closes    = [];
  var firstDate = "";
  var lastDate  = "";

  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(",");
    if (closeIdx >= 0 && cols[closeIdx]) {
      var v = parseFloat(cols[closeIdx]);
      if (!isNaN(v)) closes.push(v);
    }
    if (dateIdx >= 0 && cols[dateIdx]) {
      var d = cols[dateIdx].trim();
      if (i === 1) firstDate = d;
      lastDate = d;
    }
  }

  if (closes.length === 0) return { rows: lines.length - 1 };

  var sum = closes.reduce(function(a, b) { return a + b; }, 0);
  return {
    rows:       lines.length - 1,
    first_date: firstDate,
    last_date:  lastDate,
    min_close:  Math.min.apply(null, closes).toFixed(4),
    max_close:  Math.max.apply(null, closes).toFixed(4),
    avg_close:  (sum / closes.length).toFixed(4),
    last_close: closes[closes.length - 1].toFixed(4),
  };
}


// ─── 6. ARCHIVE SNAPSHOT ──────────────────────────────────────────────────────

/**
 * Write a timestamped archive copy of the current CSV to data/archive/.
 * Format: data/archive/YYYY-MM-DD_HHMMSS_sample_data.csv
 */
function archiveSnapshot() {
  var token = _getToken();
  if (!token) return;

  var csvData = fetchSourceDataFromGitHub(SOURCE_CSV_PATH);
  if (!csvData) return;

  var now    = new Date();
  var stamp  = Utilities.formatDate(now, "UTC", "yyyy-MM-dd_HHmmss");
  var dstPath = ARCHIVE_PREFIX + stamp + "_sample_data.csv";

  var bytes = Utilities.newBlob(csvData, "text/csv").getBytes();
  var ok    = pushToGitHubWithRetry(token, bytes, dstPath);
  Logger.log("Archive snapshot: " + dstPath + " → " + (ok ? "OK" : "FAILED"));
}


// ─── 7. EMAIL NOTIFICATION ────────────────────────────────────────────────────

/**
 * Send a status email if NOTIFY_EMAIL is configured.
 *
 * @param {string} subject
 * @param {string} body
 */
function sendStatusEmail(subject, body) {
  if (!NOTIFY_EMAIL || NOTIFY_EMAIL.trim() === "") return;
  try {
    MailApp.sendEmail({
      to:      NOTIFY_EMAIL,
      subject: "[TradingView Pipeline] " + subject,
      body:    body + "\n\nRepo: " + GITHUB_USERNAME + "/" + GITHUB_REPO,
    });
  } catch (e) {
    Logger.log("Email send failed: " + e);
  }
}


// ─── 8. GITHUB HELPERS ────────────────────────────────────────────────────────

/**
 * Fetch the raw content of a file from the GitHub repository.
 *
 * @param {string} filePath  Path within the repo (e.g. "data/sample_data.csv")
 * @return {string|null}
 */
function fetchSourceDataFromGitHub(filePath) {
  var csvUrl = "https://raw.githubusercontent.com/"
    + GITHUB_USERNAME + "/" + GITHUB_REPO + "/" + DEFAULT_BRANCH + "/" + filePath;

  for (var attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      var resp = UrlFetchApp.fetch(csvUrl, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        return resp.getContentText();
      }
      Logger.log("Attempt " + attempt + ": fetch failed HTTP " + resp.getResponseCode() + " — " + csvUrl);
    } catch (e) {
      Logger.log("Attempt " + attempt + ": exception — " + e);
    }
    if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS * attempt);
  }
  return null;
}


/**
 * Get the current SHA of a file in the repo (needed for updates).
 *
 * @param {string} token   GitHub PAT
 * @param {string} dstPath Destination path in the repo
 * @return {string|null}   SHA string or null if file does not exist
 */
function _getFileSha(token, dstPath) {
  var apiUrl = "https://api.github.com/repos/"
    + GITHUB_USERNAME + "/" + GITHUB_REPO + "/contents/" + dstPath
    + "?ref=" + DEFAULT_BRANCH;

  var resp = UrlFetchApp.fetch(apiUrl, {
    method:  "get",
    headers: { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json" },
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() === 200) {
    return JSON.parse(resp.getContentText()).sha || null;
  }
  return null;
}


/**
 * Push raw bytes to a path in the GitHub repository.
 *
 * @param {string} token   GitHub PAT
 * @param {byte[]} content File content as byte array
 * @param {string} dstPath Destination path in the repo
 * @return {boolean}
 */
function pushToGitHub(token, content, dstPath) {
  var apiUrl = "https://api.github.com/repos/"
    + GITHUB_USERNAME + "/" + GITHUB_REPO + "/contents/" + dstPath;

  var sha    = _getFileSha(token, dstPath);
  var now    = new Date().toISOString();

  var payload = {
    message: "Automated data update (" + dstPath + ") — " + now,
    content: Utilities.base64Encode(content),
    branch:  DEFAULT_BRANCH,
    committer: { name: COMMIT_AUTHOR, email: COMMIT_EMAIL },
  };
  if (sha) payload.sha = sha;

  var resp = UrlFetchApp.fetch(apiUrl, {
    method:      "put",
    headers:     { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json" },
    contentType: "application/json",
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = resp.getResponseCode();
  if (code === 200 || code === 201) {
    Logger.log("GitHub PUT " + code + " — " + dstPath);
    return true;
  }
  Logger.log("GitHub PUT error " + code + " — " + resp.getContentText());
  return false;
}


/**
 * Retry wrapper for pushToGitHub.
 */
function pushToGitHubWithRetry(token, content, dstPath) {
  for (var attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (pushToGitHub(token, content, dstPath)) return true;
    Logger.log("Push attempt " + attempt + " failed for " + dstPath + ". Retrying…");
    if (attempt < MAX_RETRIES) Utilities.sleep(RETRY_DELAY_MS * attempt);
  }
  return false;
}


/**
 * Read the GitHub PAT from Script Properties.  Logs a warning if absent.
 */
function _getToken() {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) {
    Logger.log("GITHUB_TOKEN not found in Script Properties. Aborting.");
  }
  return token || null;
}


// ─── 9. WEB APP ENDPOINT ──────────────────────────────────────────────────────

/**
 * HTTP GET handler.  Supports ?action= parameter:
 *   ?action=update       (default) — run updateDataFile()
 *   ?action=batch        — run pushAllDataFiles()
 *   ?action=json         — run pushJsonPayload()
 *   ?action=archive      — run archiveSnapshot()
 *   ?action=status       — return JSON status without writing anything
 *
 * @param {object} e   Event object from UrlFetchApp
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "update";

  switch (action) {
    case "batch":
      pushAllDataFiles();
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ok", action: "batch" })
      ).setMimeType(ContentService.MimeType.JSON);

    case "json":
      pushJsonPayload();
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ok", action: "json_payload" })
      ).setMimeType(ContentService.MimeType.JSON);

    case "archive":
      archiveSnapshot();
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ok", action: "archive" })
      ).setMimeType(ContentService.MimeType.JSON);

    case "status":
      var csvData    = fetchSourceDataFromGitHub(SOURCE_CSV_PATH);
      var validation = csvData ? validateDataIntegrity(csvData) : { ok: false, reason: "fetch failed" };
      var stats      = csvData && validation.ok ? computeCsvStats(csvData) : {};
      return ContentService.createTextOutput(
        JSON.stringify({
          status:     "ok",
          action:     "status",
          validation: validation,
          stats:      stats,
          repo:       GITHUB_USERNAME + "/" + GITHUB_REPO,
          timestamp:  new Date().toISOString(),
        })
      ).setMimeType(ContentService.MimeType.JSON);

    default:
      updateDataFile();
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ok", action: "update" })
      ).setMimeType(ContentService.MimeType.JSON);
  }
}
