# Google Apps Script Webhook Decompression Service

This project provides a Google Apps Script web app that acts as a webhook endpoint to decompress files stored in Google Drive. It can also log the decompressed content to a Google Sheet and forward it to another webhook.

## Features

1.  **Webhook Endpoint**: Receives a JSON payload with a Google Drive file ID.
2.  **File Decompression**: Retrieves the specified file from Google Drive and decompresses it.
3.  **Google Sheets Logging**: Optionally logs the decompressed content to a specified Google Sheet.
4.  **Webhook Forwarding**: Optionally forwards the decompressed content to another URL.

## How to Use

1.  **Deploy the script as a web app.**
    *   In the Apps Script editor, click `Deploy` > `New deployment`.
    *   Select `Web app` as the deployment type.
    *   Configure the web app, ensuring you grant access to "Anyone" if you intend to call it from an external service.
    *   Copy the generated web app URL.
2.  **Send a POST Request**: Send an HTTP POST request to the deployed web app URL with a JSON payload.

## Live Documentation

Once deployed, the web app's URL will serve an HTML page containing detailed documentation on the webhook's usage, including the required JSON payload structure and `curl` examples.

### Example Payload

```json
{
  "fileId": "YOUR_GOOGLE_DRIVE_FILE_ID",
  "logSheetId": "OPTIONAL_GOOGLE_SHEET_ID",
  "forwardUrl": "OPTIONAL_WEBHOOK_URL"
}
```

## Git-Based Triggering via GitHub Actions

This project includes a GitHub Action workflow that automatically triggers the webhook whenever the `google_script_project/trigger.json` file is updated on the `main` branch.

### How it Works

1.  **Update `trigger.json`**: Modify the `trigger.json` file in this directory with the Google Drive `fileId` of the compressed file you want to process.
2.  **Commit and Push**: Commit and push the change to the `main` branch.
3.  **Action Executes**: The GitHub Action will automatically detect the change, read the `fileId` from the file, and send a POST request to the webhook.

### Setup

To enable this functionality, you must configure a secret in your GitHub repository settings:

1.  Go to `Settings` > `Secrets and variables` > `Actions`.
2.  Create a new repository secret named `GAS_WEBHOOK_URL`.
3.  Set the value to the deployment URL of your Google Apps Script web app.
