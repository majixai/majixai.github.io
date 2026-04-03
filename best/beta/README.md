# Room Viewer — Beta

The **Beta** version of the Room Viewer is a modular, client-side web application for browsing and managing live rooms from the Chaturbate public API. It introduces a clean separation of concerns with dedicated modules for API access, UI rendering, storage, autoscrolling, and decorator-based enhancements.

## Architecture

| Module | Responsibility |
|---|---|
| `api.js` | Fetches online room data from the Chaturbate public API with pagination support |
| `ui.js` | Renders performer cards, manages viewport layout, handles user interactions |
| `storage.js` | Persists viewing history and saved messages using IndexedDB / localStorage |
| `autoscroller.js` | Smooth, interruptible auto-scroll for the online users list |
| `decorators.js` | Decorator pattern utilities that augment UI elements (badges, overlays) |
| `mappers.js` | Maps raw API responses to normalized internal data structures |
| `config.js` | Centralised configuration (API URL, fetch interval, limits, timeouts) |
| `script.js` | Application bootstrap and wiring of all modules |
| `style.css` | W3.CSS-based responsive layout with custom performer card styles |

## Features

- **Modular architecture** – each concern lives in its own file; easy to extend or replace.
- **Live API fetching** – polls Chaturbate public API every 2 minutes (configurable).
- **Viewing history** – stores clicked performers in IndexedDB with persistent cross-session recall.
- **Multi-viewport** – toggle between 2-viewport and 4-viewport main viewer layouts.
- **Auto-scroller** – optional smooth list scrolling that stops on user interaction.
- **Decorator overlays** – composable badge and label decorators applied to performer cards.
- **Tag & age filters** – filter the live list by tags, age, and username search.
- **PWA manifest** – installable as a Progressive Web App (`manifest.json`).

## Usage

Serve the directory with any static web server (e.g. `python -m http.server`) and open `index.html`. Because the app uses browser storage APIs and cross-origin fetch, it must be served over HTTP/HTTPS rather than opened as a local file.

## Configuration

Edit `config.js` to adjust:

- `apiUrlBase` — Chaturbate affiliate API endpoint.
- `apiLimit` — number of rooms per API page.
- `fetchIntervalDuration` — polling interval in milliseconds.
- `maxHistorySize` — cap on stored history entries.
- `apiFetchTimeout` — per-request fetch timeout.

## Dependencies (CDN)

- [jQuery 3.7.1](https://jquery.com/)
- [pako 2.1.0](https://github.com/nodeca/pako) — zlib compression for data payloads
- [W3.CSS](https://www.w3schools.com/w3css/)

## Last Updated

Slideshow and UI fixes — 2026-04-03.
