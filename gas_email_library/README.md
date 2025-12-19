# GAS Email Library

A comprehensive Google Apps Script library for sending emails with advanced features, including integrations with Google Drive, Sheets, and Docs. This library also demonstrates how to leverage GitHub as a file-based database for templates and other assets, using gzipped `.dat` files and SQLite databases.

## Using SQLite with Google Apps Script

This library includes a demonstration of how to retrieve a SQLite database file (`logs.db.gz`) from a GitHub repository. However, it's important to understand the following limitations:

*   **No Server-Side SQLite:** Google Apps Script's server-side environment does not have a native (JDBC) connector or library for interacting with SQLite databases. This means you cannot directly query or modify the `.db` file from a `.gs` script.
*   **Client-Side Interaction:** The `getDatabaseBlob` function retrieves the database file as a `Blob`. The primary use case for this is to pass the blob to the client-side (e.g., a sidebar or web app created with `HtmlService`). From there, you can use a JavaScript-based library like `sql.js` to open and interact with the database in the user's browser.
*   **External Services:** Alternatively, the blob could be forwarded to an external service or API (e.g., a Cloud Function, a VM) that has the necessary tools to process SQLite files.

The included function is a proof-of-concept for file retrieval, not a direct database integration.
