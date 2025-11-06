# Scraped Financial Data Viewer

## Purpose

This project is a simple, static frontend application designed to display financial data. It fetches a compressed SQLite database file (`finance.db.gz`), decompresses it in the browser, and then queries the database to display the most recent price for a list of stock tickers in an HTML table.

## How It Works

1.  **Loads Libraries**: The `index.html` file loads `sql.js` (for SQLite operations in WebAssembly) and `pako.js` (for Gzip decompression) from a CDN.
2.  **Fetches Data**: The `script.js` file fetches the `finance.db.gz` file from the server.
3.  **Decompresses Database**: The fetched data is decompressed from Gzip format into a raw SQLite database file using `pako.js`.
4.  **Initializes Database**: `sql.js` is used to load the decompressed database into the browser's memory.
5.  **Queries and Renders**: The script executes a SQL query to get the latest price for each ticker and dynamically generates an HTML table to display the results.

## Setup and Usage

This is a fully client-side application and does not require a build step or complex setup.

1.  **Prerequisites**: You need a local web server to serve the files. This is necessary because the `fetch` API has security restrictions (CORS) that prevent it from loading local files directly using the `file://` protocol.

2.  **Running a Local Server**: You can use Python's built-in HTTP server or any other simple server.
    *   Navigate to the `scrape` directory in your terminal.
    *   Run the command: `python -m http.server`
    *   This will start a server, typically on port 8000.

3.  **Viewing the Page**:
    *   Open your web browser and navigate to `http://localhost:8000`.
    *   The page will load, and you should see a "Loading..." message followed by a table of financial data.

## File Structure

-   `index.html`: The main HTML file that provides the structure of the page.
-   `style.css`: Contains the styles for the page, including the table formatting.
-   `script.js`: The core logic for fetching, decompressing, and displaying the data.
-   `finance.db.gz`: The compressed SQLite database containing the financial data.
