# GAS Email Library & Web App

A full-fledged Google Apps Script application that provides a comprehensive email-sending toolkit. It features a modular, multi-file backend, a robust logging system, and multiple user interfaces including a standalone Web App, a Google Workspace Add-on, and a programmatic API endpoint.

This library also demonstrates how to leverage GitHub as a file-based database for templates and other assets, using gzipped `.dat` files and SQLite databases.

## Features

- **Modular Architecture**: The backend is split into multiple services (`EmailService`, `IntegrationService`, `LoggingService`, etc.) for improved maintainability.
- **Centralized Logging**: All operations are logged to a designated Google Sheet for easy monitoring and debugging.
- **Google Workspace Add-on**: A custom menu ("Email Library") appears in Google Docs, Sheets, and Slides for seamless integration.
- **Standalone Web App**: A user-friendly web interface for sending emails directly.
- **API Endpoint**: A `doPost` handler allows programmatic access from external services like GitHub Actions.
- **Core Email Functionality**:
    - Send basic emails.
    - Send emails with attachments from Google Drive.
    - Perform mail-merges using data from Google Sheets.
    - Use Google Docs as email templates.
- **"Git as a Database"**: Fetch email templates or other assets (like SQLite databases) directly from a GitHub repository at runtime.

## Project Structure

- `EmailService.gs`: Contains the core functions for sending emails.
- `IntegrationService.gs`: Handles interactions with external services, such as fetching files from GitHub.
- `LoggingService.gs`: Provides a centralized function to log events to a Google Sheet.
- `WebApp.gs`: Contains the `doGet` and `doPost` handlers for the web app and API endpoint.
- `Addon.gs`: Contains the `onOpen` logic to create the custom add-on menu in the Google Workspace UI.
- `index.html` / `sidebar.html`: The HTML files for the user interfaces.
- `javascript.html` / `stylesheet.html`: Shared client-side script and CSS.

## Setup and Deployment

1.  **Create the Logging Sheet**:
    - Go to [sheet.new](https://sheet.new) in your browser to create a new Google Sheet.
    - Copy the **Sheet ID** from the URL. The ID is the long string of characters between `/d/` and `/edit`.

2.  **Configure `LoggingService.gs`**:
    - Open the `gas_email_library/LoggingService.gs` file.
    - Replace the placeholder `YOUR_SHEET_ID_HERE` with the ID you copied in the previous step.

3.  **Deploy the Script**:
    - In the Apps Script editor, click **Deploy > New deployment**.
    - Select **Web app** as the deployment type.
    - Give it a description, and under **Who has access**, select who should be able to use the app.
    - Click **Deploy**.
    - **Important**: Authorize the script's permissions when prompted.
    - After deployment, a URL will be provided for your web app.

## Usage

### As a Google Workspace Add-on

After deployment, open any Google Doc, Sheet, or Slide. A new menu item named **Email Library** will appear. From here, you can open the web app or the sidebar.

### As a Standalone Web App

Navigate to the Web App URL you received during deployment to use the application in a standard browser window.

### As an API Endpoint

Send a `POST` request to the Web App URL with a JSON payload. This is ideal for automation and integration with services like GitHub Actions.

**Example `curl` command:**
```bash
curl -L -X POST 'YOUR_WEB_APP_URL' \
-H 'Content-Type: application/json' \
--data-raw '{
  "action": "sendEmail",
  "params": {
    "to": "recipient@example.com",
    "subject": "API Test",
    "body": "This email was sent from the API."
  }
}'
```

## "Git as a Database" & SQLite Limitations

This library demonstrates how to retrieve a SQLite database file (`logs.db.gz`) from a GitHub repository. However, it's important to understand the following limitations:

-   **No Server-Side SQLite**: Google Apps Script's server-side environment does not have a native library for interacting with SQLite databases. You cannot directly query or modify the `.db` file from a `.gs` script.
-   **Client-Side Interaction**: The `getDatabaseBlob` function retrieves the file as a `Blob`, which can be passed to a client-side interface (built with `HtmlService`) and processed in the browser using a JavaScript library like `sql.js`.
-   **External Services**: The blob could also be forwarded to an external service (e.g., a Cloud Function) that has the necessary tools to process SQLite files.
