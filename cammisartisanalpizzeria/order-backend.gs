const ORDER_HEADERS = [
  'Timestamp',
  'Customer Name',
  'Phone',
  'Fulfillment',
  'Address',
  'City',
  'Payment',
  'Notes',
  'Subtotal',
  'Tax',
  'Delivery Fee',
  'Total',
  'Items'
];

function doGet() {
  return jsonResponse_({
    ok: true,
    message: 'Cammis order endpoint is active.'
  });
}

function doPost(e) {
  try {
    const rawBody = (e && e.postData && e.postData.contents) || '{}';
    const payload = parsePayload_(rawBody);

    if (!payload || typeof payload !== 'object') {
      throw new Error('Request body must be a JSON object.');
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('Order must include at least one item.');
    }

    const spreadsheet = getTargetSpreadsheet_();
    const sheet = ensureOrdersSheet_(spreadsheet);

    const itemSummary = payload.items
      .map(function (item) {
        const name = String(item && item.name ? item.name : '').trim();
        const qty = Number(item && item.qty);
        if (!name || !Number.isFinite(qty) || qty <= 0) {
          throw new Error('One or more order items are invalid.');
        }
        return qty + 'x ' + name;
      })
      .join(' | ');

    const row = [
      new Date().toISOString(),
      String(payload.name || ''),
      String(payload.phone || ''),
      String(payload.fulfillment || 'pickup'),
      String(payload.address || ''),
      String(payload.city || ''),
      String(payload.payment || ''),
      String(payload.notes || ''),
      numberOrZero_(payload.subtotal),
      numberOrZero_(payload.tax),
      numberOrZero_(payload.deliveryFee),
      numberOrZero_(payload.total),
      itemSummary
    ];

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet.appendRow(row);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({
      ok: true,
      message: 'Order received.'
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error('Order submission failed:', message);
    return jsonResponse_({
      ok: false,
      error: message,
      details: 'Check CAMMIS_SPREADSHEET_ID in Script Properties and confirm the web app is deployed.'
    });
  }
}

function parsePayload_(rawBody) {
  if (!rawBody || !String(rawBody).trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error('Request body is not valid JSON: ' + error.message);
  }
}

function getTargetSpreadsheet_() {
  const scriptProps = PropertiesService.getScriptProperties();
  const spreadsheetId = (scriptProps.getProperty('CAMMIS_SPREADSHEET_ID') || '').trim();

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureOrdersSheet_(spreadsheet) {
  if (!spreadsheet) {
    throw new Error('No spreadsheet is available. Add CAMMIS_SPREADSHEET_ID in Script Properties.');
  }

  let sheet = spreadsheet.getSheetByName('Orders');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Orders');
    sheet.appendRow(ORDER_HEADERS);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ORDER_HEADERS);
  }

  return sheet;
}

function numberOrZero_(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
