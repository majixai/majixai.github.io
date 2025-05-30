# Web Stock Data Viewer

## Description

This is a simple browser-based application designed to display simulated stock data entries. It dynamically fetches new data, updates the view, and leverages browser LocalStorage to persist a short history of data entries.

The `script.js` attempts to provide a structure for fetching from a real stock API, but by default, and for reliable demonstration, it uses a placeholder data source (`https://jsonplaceholder.typicode.com/todos/1`).

## How to Use

Simply open the `index.html` file in a modern web browser that supports HTML5, CSS3, and modern JavaScript (ES6+).

```
web_stock_viewer/index.html
```

No special server setup is required as it's a client-side application.

## Features

-   **Real-time Updates**: Displays new data entries fetched every second (simulated).
-   **LocalStorage Persistence**: Stores the last 10 data entries (timestamp and data content) in the browser's LocalStorage.
-   **History on Load**: On page load, it retrieves and displays any previously stored data entries from LocalStorage.
-   **Dynamic View**: New data appears at the top of the list, and the display is capped at a certain number of entries to maintain performance.
-   **Basic Styling**: Includes a simple CSS stylesheet for presentation.

## Important Notes & Limitations

-   **Data Source**: The application primarily uses a placeholder API (`https://jsonplaceholder.typicode.com/todos/1`) for demonstration purposes. This is due to the common complexities (CORS restrictions, API key requirements, rate limits) of accessing live financial data APIs directly from client-side JavaScript without a backend proxy. The `script.js` file contains commented-out sections that illustrate how one might attempt to integrate a real stock API (e.g., Polygon.io), but this is not active by default.
-   **Storage**: Data is stored in the browser's LocalStorage. This means the data is specific to the browser and device you use and will persist until the LocalStorage is cleared for this site.
-   **No Backend**: This is a purely client-side application. It does not involve any server-side processing or database beyond the browser's LocalStorage.
-   **Demo Purposes**: The primary goal is to demonstrate front-end techniques for fetching, displaying, and storing data, rather than providing a production-ready financial analysis tool.
