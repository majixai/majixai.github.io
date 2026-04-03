# Room Viewer — Gamma

The **Gamma** version of the Room Viewer is the most feature-rich edition, extending the Beta modular architecture with structured logging, an event bus, advanced filtering, retry logic, a relevance scorer, and a dedicated slideshow manager for performer image slideshows.

## Architecture

| Module | Responsibility |
|---|---|
| `api.js` | Fetches online rooms with exponential-backoff retry (3 attempts) |
| `ui.js` | Renders performer cards with overlay styles and slideshow integration |
| `storage.js` | IndexedDB / localStorage persistence for history and messages |
| `autoscroller.js` | Smooth, interruptible auto-scroll |
| `decorators.js` | Composable decorator utilities for badges and card enhancements |
| `events.js` | Lightweight `EventBus` for publish/subscribe decoupled communication |
| `filters.js` | Advanced filtering pipeline (tags, age, viewers, username search) with debounce |
| `logger.js` | Configurable log-level logger (`DEBUG`/`INFO`/`WARN`/`ERROR`) with in-memory ring buffer |
| `mappers.js` | Maps raw API responses to normalised internal data structures |
| `relevance-scorer.js` | Client-side relevance scoring for ranking performers |
| `slideshow-manager.js` | `SlideshowManager` class — controls image slideshow per performer card |
| `config.js` | Centralised configuration (API, logging, filtering, retry) |
| `script.js` | Application bootstrap |
| `style.css` | Performer card overlay styles and responsive grid layout |

## Features

- **EventBus** — decoupled component communication via pub/sub events.
- **Structured logging** — configurable log levels with a fixed-size in-memory buffer.
- **Retry with backoff** — failed API requests are automatically retried up to 3 times with exponential backoff.
- **Advanced filters** — minimum viewer count, debounced filter updates, quick-filter buttons.
- **Relevance scoring** — performers are ranked by a configurable relevance score.
- **SlideshowManager** — each performer card rotates through its image history with configurable min/max delay, a progress bar, and a slide counter.
- All Beta features: multi-viewport, viewing history, auto-scroll, tag/age filters, PWA manifest.

## Slideshow Manager

`SlideshowManager` drives the per-card image slideshow:

```js
const mgr = new SlideshowManager(imgElement, imageUrls, {
    minDelay: 2000,   // ms between slides (min)
    maxDelay: 6000,   // ms between slides (max)
    progressBar,      // optional <div> element for CSS progress
    counter,          // optional element showing "N/M"
});
mgr.start();
mgr.stop();
mgr.goTo(index);
```

Fixed in 2026-04-03 update: DOM `<img>` elements are now correctly updated on each slide transition.

## Usage

Serve the directory with any static web server and open `index.html`.

## Configuration

Edit `config.js` to adjust API, retry, logging, and filter settings:

- `apiRetryAttempts` / `apiRetryBaseDelay` — retry count and base backoff delay.
- `logLevel` / `maxLogEntries` — logging verbosity and ring-buffer size.
- `defaultMinViewers` / `filterDebounceDelay` — filter defaults.

## Dependencies (CDN)

- [jQuery 3.7.1](https://jquery.com/)
- [pako 2.1.0](https://github.com/nodeca/pako)
- [W3.CSS](https://www.w3schools.com/w3css/)

## Last Updated

Slideshow DOM update fix — 2026-04-03.
