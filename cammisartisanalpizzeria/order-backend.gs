function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Cammis order endpoint is active.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName('Orders');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Orders');
      sheet.appendRow(['Timestamp', 'Customer Name', 'Phone', 'Fulfillment', 'Address', 'City', 'Payment', 'Notes', 'Subtotal', 'Tax', 'Delivery Fee', 'Total', 'Items']);
    }

    const itemSummary = (payload.items || []).map(item => `${item.qty}x ${item.name}`).join(' | ');
    const row = [
      new Date().toISOString(),
      payload.name || '',
      payload.phone || '',
      payload.fulfillment || 'pickup',
      payload.address || '',
      payload.city || '',
      payload.payment || '',
      payload.notes || '',
      payload.subtotal || 0,
      payload.tax || 0,
      payload.deliveryFee || 0,
      payload.total || 0,
      itemSummary
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, message: 'Order received.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
