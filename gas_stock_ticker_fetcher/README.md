# Google Apps Script Stock Ticker Fetcher

## Description

This project is a simple web application built with Google Apps Script that allows users to fetch the latest price for a stock ticker. It uses a reliable method of creating a temporary Google Sheet and the `=GOOGLEFINANCE()` formula to retrieve the data.

## Features

- Simple user interface to enter a ticker symbol.
- Fetches near real-time stock data.
- Displays the result or an error message to the user.
- Built entirely within the Google Apps Script environment.

## How It Works

The application consists of a simple HTML frontend and a Google Apps Script backend.

1.  **Frontend (`index.html`)**: The user enters a ticker symbol and clicks a button. This action calls a backend function using `google.script.run`.
2.  **Backend (`Code.gs`)**: The `getTickerData(ticker)` function is executed.
    - It programmatically creates a new, temporary Google Spreadsheet.
    - It inserts the `=GOOGLEFINANCE("TICKER")` formula into a cell in the new sheet.
    - It waits a moment for the formula to calculate, reads the resulting value from the cell, and returns it to the frontend.
    - Finally, it sends the temporary spreadsheet to the trash to avoid cluttering the user's Google Drive.

This approach is used because the `=GOOGLEFINANCE` formula is only available within the Google Sheets environment and cannot be called directly from a standalone Apps Script.

## Setup and Deployment

To deploy this application, follow these steps:

1.  **Create a new Google Apps Script project:**
    - Go to [script.google.com](https://script.google.com/home/my) and create a new project.

2.  **Add the project files:**
    - Copy the content of `Code.gs` from this directory and paste it into the `Code.gs` file in your new project.
    - Create a new HTML file in the Apps Script editor (File > New > HTML file) and name it `index`. Copy the content of `index.html` into this new file.
    - Open the Project Settings (gear icon on the left) and check the box for "Show `appsscript.json` manifest file in editor".
    - Click on the `appsscript.json` file in the editor and copy the content of this directory's `appsscript.json` into it.

3.  **Deploy as a Web App:**
    - In the top-right corner, click **Deploy** > **New deployment**.
    - Click the gear icon next to "Select type" and choose **Web app**.
    - In the configuration:
        - Add a description (optional).
        - Set **Execute as** to **Me**.
        - Set **Who has access** to **Anyone**.
    - Click **Deploy**.

4.  **Authorize Permissions:**
    - Google will prompt you to authorize the script's permissions. Review and grant the permissions. The script requires access to:
        - **Google Sheets:** To create the temporary sheet where the `=GOOGLEFINANCE` formula is run.
        - **Google Drive:** To send the temporary sheet to the trash after the data has been retrieved. This is essential for keeping your Drive clean.

5.  **Get the URL:**
    - After deployment, you will be given a **Web app URL**. This is the public link to your new application.

## Usage

1.  Open the Web app URL in your browser.
2.  Enter a valid stock ticker symbol (e.g., `GOOGL`, `NASDAQ:TSLA`) into the input field.
3.  Click the "Fetch Data" button.
4.  The latest price will be displayed below the button. If there is an error (e.g., an invalid ticker), an error message will be shown instead.
