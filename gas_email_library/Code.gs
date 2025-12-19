/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of script authorization
 * to only the current document containing the script. It's a best practice for
 * security and helps users understand the script's permissions.
 */

/**
 * Sends a basic email.
 *
 * @param {string} to The recipient's email address.
 * @param {string} subject The subject of the email.
 * @param {string} body The body of the email.
 */
function sendEmail(to, subject, body) {
  MailApp.sendEmail(to, subject, body);
  Logger.log('Email sent to: ' + to);
}

/**
 * Retrieves a gzipped SQLite database file from a Git repository.
 *
 * NOTE: Google Apps Script does not have a native library for interacting with
 * SQLite databases on the server side. This function demonstrates how to fetch
 * the database file as a blob. The blob could then be passed to a client-side
 * application (using HtmlService) where a JavaScript-based SQLite library
 * (like sql.js) could be used to interact with it, or it could be sent to an
 * external service that can process SQLite files.
 *
 * @param {string} repoUrl The raw URL to the `logs.db.gz` file.
 * @return {Blob} The gzipped database file as a blob.
 */
function getDatabaseBlob(repoUrl) {
  try {
    const response = UrlFetchApp.fetch(repoUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to fetch database file. Response code: ${response.getResponseCode()}`);
    }
    Logger.log('Successfully fetched the database blob.');
    return response.getBlob();
  } catch (e) {
    Logger.log('Error fetching database blob: ' + e.toString());
    return null;
  }
}

/**
 * Sends an email using a template from a gzipped JSON file stored in a Git repository.
 *
 * @param {string} to The recipient's email address.
 * @param {string} templateName The name of the template to use (e.g., "welcome").
 * @param {Object} replacements An object for placeholder substitution.
 * @param {string} repoUrl The raw URL to the `templates.dat` file in the GitHub repository.
 */
function sendEmailFromGitTemplate(to, templateName, replacements, repoUrl) {
  try {
    const response = UrlFetchApp.fetch(repoUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to fetch template file. Response code: ${response.getResponseCode()}`);
    }

    const blob = response.getBlob();
    const unzippedBlob = Utilities.unzip(blob)[0];
    const jsonString = unzippedBlob.getDataAsString();
    const templates = JSON.parse(jsonString);

    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template "${templateName}" not found.`);
    }

    let subject = template.subject;
    let body = template.body;

    for (const key in replacements) {
      const placeholder = new RegExp('{{' + key + '}}', 'g');
      subject = subject.replace(placeholder, replacements[key]);
      body = body.replace(placeholder, replacements[key]);
    }

    MailApp.sendEmail(to, subject, body);
    Logger.log(`Email from git template "${templateName}" sent to: ${to}`);
  } catch (e) {
    Logger.log('Error sending email from git template: ' + e.toString());
  }
}

/**
 * Sends an email using a Google Doc as a template.
 * Placeholders in the document should be in the format {{key}}.
 *
 * @param {string} to The recipient's email address.
 * @param {string} docId The ID of the Google Doc template.
 * @param {Object} replacements An object where keys are placeholders (without curly braces) and values are the replacements.
 */
function sendEmailFromDocTemplate(to, docId, replacements) {
  try {
    const doc = DocumentApp.openById(docId);
    let body = doc.getBody().getText();
    let subject = doc.getName(); // Use the document title as the subject

    for (const key in replacements) {
      const placeholder = new RegExp('{{' + key + '}}', 'g');
      body = body.replace(placeholder, replacements[key]);
      subject = subject.replace(placeholder, replacements[key]); // Also replace in subject
    }

    MailApp.sendEmail(to, subject, body, {
      htmlBody: body // Send as HTML to preserve some formatting
    });
    Logger.log(`Email from doc template sent to: ${to}`);
  } catch (e) {
    Logger.log('Error sending email from Doc template: ' + e.toString());
  }
}

/**
 * Performs a mail merge from a Google Sheet.
 * Assumes the first row of the sheet is the header row, and one of the columns is named 'Email'.
 * Placeholders in the templates should be in the format {{columnName}}.
 *
 * @param {string} sheetId The ID of the Google Sheet.
 * @param {string} subjectTemplate The subject line template.
 * @param {string} bodyTemplate The email body template.
 */
function sendMailMergeFromSheet(sheetId, subjectTemplate, bodyTemplate) {
  try {
    const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Get header row
    const emailColumnIndex = headers.indexOf('Email');

    if (emailColumnIndex === -1) {
      throw new Error('"Email" column not found in the sheet.');
    }

    data.forEach((row, index) => {
      const recipientEmail = row[emailColumnIndex];
      if (recipientEmail) {
        let subject = subjectTemplate;
        let body = bodyTemplate;

        headers.forEach((header, i) => {
          const placeholder = new RegExp('{{' + header + '}}', 'g');
          subject = subject.replace(placeholder, row[i]);
          body = body.replace(placeholder, row[i]);
        });

        MailApp.sendEmail(recipientEmail, subject, body);
        Logger.log(`Mail merge email sent to: ${recipientEmail}`);
      }
    });
  } catch (e) {
    Logger.log('Error performing mail merge: ' + e.toString());
  }
}

/**
 * Sends an email with a file from Google Drive as an attachment.
 *
 * @param {string} to The recipient's email address.
 * @param {string} subject The subject of the email.
 * @param {string} body The body of the email.
 * @param {string} fileId The ID of the file in Google Drive to attach.
 */
function sendEmailWithDriveAttachment(to, subject, body, fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    MailApp.sendEmail(to, subject, body, {
      attachments: [file.getAs(MimeType.PDF)] // Example: sending as PDF
    });
    Logger.log('Email with attachment sent to: ' + to);
  } catch (e) {
    Logger.log('Error sending email with attachment: ' + e.toString());
  }
}
