# Advanced Data Details Viewer

## Overview

This project is a self-contained web application designed to serve as a technical demonstration of a wide range of advanced frontend programming concepts. It functions as a data viewer that can fetch, process, and display data from various sources, including JSON and a gzipped SQLite database.

The primary goal is to showcase modern web development techniques and object-oriented design patterns in a practical, single-page application.

## How to Run Locally

Since this project uses `fetch` to load data files, it must be served by a web server to avoid CORS issues. You cannot simply open the `index.html` file directly from the filesystem (`file://`).

1.  **Navigate to the repository root directory.**
2.  **Start a simple Python web server:**
    ```bash
    python -m http.server
    ```
3.  **Open your web browser** and go to `http://localhost:8000/details/`.

## Directory Structure

```
details/
├── css/
│   └── style.css           # Custom styles for parallax, animations, and layout.
├── db/
│   └── finance.db.gz       # Gzipped SQLite database for demonstration.
├── js/
│   ├── models/
│   │   └── DataMapper.js   # Class for object mapping and bitwise operations.
│   ├── services/
│   │   ├── CacheService.js # In-memory cache implementation.
│   │   └── DataService.js  # Fetches and processes data from different sources.
│   ├── ui/
│   │   └── UIRenderer.js   # Handles all DOM manipulation and rendering.
│   ├── utils/
│   │   ├── Logger.js       # A utility with a timing decorator.
│   │   └── helpers.js      # Contains iterators and generators.
│   ├── app.js              # Main application entry point (IIFE).
│   └── types.js            # JSDoc type definitions (simulating interfaces).
├── index.html              # The main HTML file for the application.
└── README.md               # This file.
```

## Features Implemented

<!-- AUTO-GENERATED-FEATURES:START -->
#### Data Handling:
*   Loads and parses standard JSON data
*   Loads and queries a gzipped SQLite database
*   In-memory caching

#### UI & Styling:
*   Responsive layout (W3.CSS & Bootstrap)
*   Parallax effect
*   CSS animations with start/stop control
*   Layouts with CSS Grid and Flexbox

#### Advanced JavaScript & OOP:
*   Modular, class-based architecture
*   Private class members (`#`)
*   Decorators
*   `async/await` for asynchronous operations
*   Generators and Iterators
*   JSDoc type definitions
*   Bitwise operations
<!-- AUTO-GENERATED-FEATURES:END -->

This section is automatically updated by a GitHub Action. Do not edit it manually.

## Technical Concepts Demonstrated

-   **Protocols & Data Handling:** The `DataService` class acts as a protocol-based system, capable of handling different data source types (`json`, `sqlite`) through a single interface.
-   **CDNs:** Leverages Content Delivery Networks for popular libraries (Bootstrap, W3.CSS, `pako.js`, `sql.js`) to reduce local project weight and improve load times.
-   **Caching:** The `CacheService` provides a simple in-memory caching layer to prevent re-fetching of data.
-   **Object-Oriented Programming (OOP):** The entire JavaScript codebase is structured around classes (`DataService`, `UIRenderer`, `CacheService`, `DataMapper`) with clear responsibilities, encapsulation (private members), and static methods.
-   **Design Patterns:**
    *   **Module Pattern:** Files are structured as ES6 modules.
    *   **IIFE:** The `AppController` uses an IIFE to create a private scope and expose a public API.
    *   **Decorator Pattern:** The `timingDecorator` enhances the `loadData` method without altering its core logic.
-   **Asynchronous Operations:** The application makes extensive use of `async/await` to handle file fetching and data processing without blocking the main thread.
-   **Bitwise Operations:** The `DataMapper` uses bitwise flags to efficiently store and check for multiple product features within a single integer.
