# Payment API Integration with GenAI Fraud Analysis & Reporting

This directory contains a Google Apps Script project that provides a mock payment integration with support for Visa and Google Pay, along with generative AI-powered fraud analysis. It also includes a reporting system that logs all transaction attempts to a Google Sheet and generates a daily summary report.

## Features

-   **Payment Form:** A tabbed HTML form for users to pay with a credit card or Google Pay.
-   **Google Apps Script Backend:** A `code.gs` script that:
    -   Serves the payment form.
    -   Receives payment data from the form.
    -   Calls the Gemini API to analyze the transaction for fraud risk.
    -   Logs every transaction attempt to a designated Google Sheet.
    -   Simulates a payment processing step.
-   **Automated Reporting:** A GitHub Action that runs daily, executing a Python script (`generate_transaction_report.py`) to:
    -   Fetch transaction data from the Google Sheet.
    -   Generate a summary report in markdown format (`TRANSACTION_REPORT.md`).
    -   Commit the report back to the repository.
-   **Report Viewer:** A simple web page to display the daily transaction report.

## Accessing the Report

You can view the latest transaction report by accessing the web app URL with the `?page=report` parameter (e.g., `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?page=report`). The report is updated daily by the GitHub Action.

## Setup Instructions

To use this project, you need to set up a Google Sheet for logging and configure the script properties in your Google Apps Script project.

### 1. Create a Google Sheet

1.  Create a new Google Sheet in your Google Drive.
2.  Name the sheet "Visa Transaction Logs" or something similar.
3.  The first row of the sheet should be a header row with the following columns:
    `Timestamp`, `Card Holder`, `Card Number (Last 4)`, `Payment Method`, `Status`, `Transaction ID`, `Fraud Score`, `Fraud Explanation`, `Error Message`

### 2. Configure the Google Apps Script Project

1.  Open the `code.gs` file in the Google Apps Script editor.
2.  In the script editor, go to **Project Settings** > **Script Properties**.
3.  Add the following script properties:
    -   `GEMINI_API_KEY`: Your API key for the Gemini API.
    -   `VISA_API_KEY`: Your Visa API key (or a placeholder if you are only testing).
    -   `VISA_API_SECRET`: Your Visa API secret (or a placeholder).
    -   `LOG_SHEET_ID`: The ID of the Google Sheet you created in the previous step. You can get this from the sheet's URL (it's the long string of characters between `/d/` and `/edit`).
    -   `FRAUD_RISK_THRESHOLD`: The fraud score threshold (e.g., `75`) at which a transaction should be rejected.
    -   `REPO_URL`: The URL of your GitHub repository in the format `owner/repo` (e.g., `majixai/swe-agent-sandbox`).
4.  Run the `setApiCredentials` and `setConfiguration` functions from the script editor to initialize the settings. You only need to do this once.

### 3. Deploy the Web App

1.  In the script editor, click **Deploy** > **New deployment**.
2.  Select **Web app** as the deployment type.
3.  In the configuration, make sure to execute the app as "Me" and set who has access to "Anyone".
4.  Click **Deploy**. You will be given a URL for your web app.

### 4. Configure GitHub Secrets for Reporting

To enable the automated daily reporting, you need to add the following secrets to your GitHub repository settings:

1.  Go to your repository on GitHub and click on **Settings** > **Secrets and variables** > **Actions**.
2.  Click **New repository secret** for each of the following secrets:
    -   `LOG_SHEET_ID`: The ID of the Google Sheet you created for logging transactions.
    -   `GOOGLE_API_CREDENTIALS`: The JSON credentials for your Google service account. You will need to create a service account in the Google Cloud Console, give it access to the Google Sheets API, and download the JSON key file. The contents of this JSON file should be the value of the secret.

Now, your Visa payment form is ready to use, and it will log all transaction attempts to your Google Sheet. The GitHub Action will automatically generate a daily report from this data.