/**
 * Retrieves a gzipped SQLite database file from a Git repository.
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
    logEvent('getDatabaseBlob', 'SUCCESS', `Successfully fetched database blob from: ${repoUrl}`);
    return response.getBlob();
  } catch (e) {
    logEvent('getDatabaseBlob', 'ERROR', e.toString());
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
    logEvent('sendEmailFromGitTemplate', 'SUCCESS', `Email from git template "${templateName}" sent to: ${to}`);
  } catch (e) {
    logEvent('sendEmailFromGitTemplate', 'ERROR', e.toString());
  }
}
