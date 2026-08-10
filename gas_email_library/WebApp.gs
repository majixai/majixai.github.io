/**
 * Serves the main web app interface.
 *
 * @param {Object} e The event parameter.
 * @return {HtmlOutput} The HTML output for the web app.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('GAS Email Library')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/**
 * Handles POST requests, acting as an API endpoint for external services.
 * Expects a JSON payload with an 'action' key and a 'params' object.
 *
 * Example Payload:
 * {
 *   "action": "sendEmail",
 *   "params": {
 *     "to": "recipient@example.com",
 *     "subject": "API Test",
 *     "body": "This email was sent from the API."
 *   }
 * }
 *
 * @param {Object} e The event parameter, containing the POST data.
 * @return {ContentService.TextOutput} A JSON response.
 */
function doPost(e) {
  let response = { status: 'error', message: 'Invalid request' };

  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, params } = payload;

    // A simple router to dispatch actions
    switch (action) {
      case 'sendEmail':
        sendEmail(params.to, params.subject, params.body);
        response = { status: 'success', message: 'Action `sendEmail` executed.' };
        break;
      case 'sendEmailWithDriveAttachment':
        sendEmailWithDriveAttachment(params.to, params.subject, params.body, params.fileId);
        response = { status: 'success', message: 'Action `sendEmailWithDriveAttachment` executed.' };
        break;
      case 'sendMailMergeFromSheet':
        sendMailMergeFromSheet(params.sheetId, params.subjectTemplate, params.bodyTemplate);
        response = { status: 'success', message: 'Action `sendMailMergeFromSheet` executed.' };
        break;
      case 'sendEmailFromDocTemplate':
        sendEmailFromDocTemplate(params.to, params.docId, params.replacements);
        response = { status: 'success', message: 'Action `sendEmailFromDocTemplate` executed.' };
        break;
      default:
        response = { status: 'error', message: `Unknown action: ${action}` };
        break;
    }
  } catch (err) {
    response = { status: 'error', message: err.message };
    logEvent('doPost', 'ERROR', err.message);
  }

  return ContentService.createObjectOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Includes the content of another HTML file.
 * This is a common pattern for creating reusable components in GAS web apps.
 *
 * @param {string} filename The name of the file to include.
 * @return {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
