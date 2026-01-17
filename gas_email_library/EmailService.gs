/**
 * Sends a basic email.
 *
 * @param {string} to The recipient's email address.
 * @param {string} subject The subject of the email.
 * @param {string} body The body of the email.
 */
function sendEmail(to, subject, body) {
  try {
    MailApp.sendEmail(to, subject, body);
    logEvent('sendEmail', 'SUCCESS', `Email sent to: ${to}`);
  } catch (e) {
    logEvent('sendEmail', 'ERROR', e.toString());
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
      attachments: [file.getAs(MimeType.PDF)]
    });
    logEvent('sendEmailWithDriveAttachment', 'SUCCESS', `Email with attachment sent to: ${to}`);
  } catch (e) {
    logEvent('sendEmailWithDriveAttachment', 'ERROR', e.toString());
  }
}

/**
 * Performs a mail merge from a Google Sheet.
 *
 * @param {string} sheetId The ID of the Google Sheet.
 * @param {string} subjectTemplate The subject line template.
 * @param {string} bodyTemplate The email body template.
 */
function sendMailMergeFromSheet(sheetId, subjectTemplate, bodyTemplate) {
  try {
    const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const emailColumnIndex = headers.indexOf('Email');

    if (emailColumnIndex === -1) {
      throw new Error('"Email" column not found in the sheet.');
    }

    let emailsSent = 0;
    data.forEach((row) => {
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
        emailsSent++;
      }
    });
    logEvent('sendMailMergeFromSheet', 'SUCCESS', `Sent ${emailsSent} emails.`);
  } catch (e) {
    logEvent('sendMailMergeFromSheet', 'ERROR', e.toString());
  }
}

/**
 * Sends an email using a Google Doc as a template.
 *
 * @param {string} to The recipient's email address.
 * @param {string} docId The ID of the Google Doc template.
 * @param {Object} replacements An object for placeholder substitution.
 */
function sendEmailFromDocTemplate(to, docId, replacements) {
  try {
    const doc = DocumentApp.openById(docId);
    let body = doc.getBody().getText();
    let subject = doc.getName();

    for (const key in replacements) {
      const placeholder = new RegExp('{{' + key + '}}', 'g');
      body = body.replace(placeholder, replacements[key]);
      subject = subject.replace(placeholder, replacements[key]);
    }

    MailApp.sendEmail(to, subject, body);
    logEvent('sendEmailFromDocTemplate', 'SUCCESS', `Email from doc template sent to: ${to}`);
  } catch (e) {
    logEvent('sendEmailFromDocTemplate', 'ERROR', e.toString());
  }
}
