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
