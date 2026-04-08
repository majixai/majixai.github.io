# /pwa — Shared PWA Infrastructure

This directory is the single source of truth for Progressive Web App plumbing across every MajixAI sub-app. Any new app can plug straight in with two lines of configuration.

## Files

| File | Purpose |
|------|---------|
| `sw-core.js` | Unified service-worker logic (install · activate · fetch strategies · SHA-256 integrity · TTL · custom routing) |
| `hash-assets.js` | Node.js CLI — compute `sha256-<base64>` hashes for `SW_CONFIG.integrity` |
| `manifest-template.json` | Starter template for a new app's `manifest.json` |

---

## Quick start — adding PWA support to a new directory

### 1 — Create your `manifest.json`

Copy `pwa/manifest-template.json` into your app directory and fill in `name`, `short_name`, `description`, `theme_color`, `background_color`, and the `icons` array.

### 2 — Create your `sw.js`

```js
// myapp/sw.js
self.SW_CONFIG = {
  cacheVersion:  'myapp-v1',
  appShellFiles: ['./', './index.html', './manifest.json'],
  trustedCdnHosts: ['cdn.jsdelivr.net'],
};
importScripts('/pwa/sw-core.js');
```

### 3 — Register the service worker in your HTML

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }
</script>
```

### 4 — Link the manifest in `<head>`

```html
<link rel="manifest" href="./manifest.json">
<meta name="theme-color" content="#your-theme-color">
```

---

## SHA-256 Integrity verification

`sw-core.js` verifies the SHA-256 hash of every fetched resource that has an entry in `SW_CONFIG.integrity`. Tampered or mismatched assets are never written to the cache.

### Step 1 — Generate hashes with `hash-assets.js`

```bash
# Hash individual files
node pwa/hash-assets.js ./myapp/script.js ./myapp/style.css

# Hash files relative to an app directory
node pwa/hash-assets.js --base ./myapp  script.js style.css manifest.json

# Emit only the JSON object (useful for scripting)
node pwa/hash-assets.js --json ./myapp/script.js ./myapp/style.css
```

Example output:
```
  ./myapp/script.js                         sha256-aBcDeFgH...
  ./myapp/style.css                         sha256-IjKlMnOp...

// Paste into SW_CONFIG.integrity:
integrity: {
  "./myapp/script.js": "sha256-aBcDeFgH...",
  "./myapp/style.css": "sha256-IjKlMnOp..."
}
```

### Step 2 — Add to `SW_CONFIG`

```js
// myapp/sw.js
self.SW_CONFIG = {
  cacheVersion:  'myapp-v1',
  appShellFiles: ['./', './index.html', './manifest.json', './script.js', './style.css'],

  // Pin SHA-256 hashes.  Paths are matched as: exact URL, pathname, or ./relative.
  integrity: {
    './script.js': 'sha256-aBcDeFgH...',
    './style.css': 'sha256-IjKlMnOp...',
    // CDN resources can also be pinned:
    'https://cdn.jsdelivr.net/npm/lib@1.0/dist/lib.min.js': 'sha256-XyZ...',
  },

  // 'warn'    → log warning, skip caching, still serve to page  (default)
  // 'enforce' → reject mismatch; fall back to cache / offline page
  integrityMode: 'warn',
};
importScripts('/pwa/sw-core.js');
```

### Object form in `appShellFiles`

You can also pin hashes inline for shell files using the object form:

```js
appShellFiles: [
  './',
  { url: './index.html',  integrity: 'sha256-...' },
  { url: './script.js',   integrity: 'sha256-...' },
],
```

The SW passes the `integrity` attribute directly to the browser's `Request` constructor, so the browser enforces SRI natively during install.

---

## SW_CONFIG reference

All fields are **optional**; sensible defaults are applied by `sw-core.js`.

### Core

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cacheVersion` | `string` | `'majixai-pwa-v1'` | Cache-name prefix. Bump to invalidate all caches. |
| `appShellFiles` | `(string \| {url,integrity?})[]` | `['./', './index.html']` | Files pre-cached on install. |
| `offlineFallback` | `string` | `'./index.html'` | Served when navigation fails and no cache is available. |

### SHA-256 integrity

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `integrity` | `{ [urlOrPath]: 'sha256-<base64>' }` | `{}` | Hash map verified via `crypto.subtle` before caching. |
| `integrityMode` | `'warn' \| 'enforce'` | `'warn'` | `'warn'` skips caching on mismatch; `'enforce'` throws and falls back to cache/offline. |

### Network

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `networkTimeoutMs` | `number` | `0` | Milliseconds before falling back to cache. `0` disables. |
| `trustedCdnHosts` | `string[]` | Common CDNs | Hostnames served cache-first. |
| `imageCdnHosts` | `string[]` | `[]` | Image CDN hostnames served stale-while-revalidate. |
| `networkFirstExtensions` | `string[]` | `['.dat']` | File extensions served network-first. |
| `bypassHosts` | `string[]` | `[]` | Hostnames the SW leaves completely unhandled. |

### Cache

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `maxCacheAgeSeconds` | `number` | `0` | Runtime-cache TTL. Stale entries are re-fetched. `0` disables TTL. |
| `skipCachingPatterns` | `string[]` | `[]` | RegExp source strings — matching URLs are never cached. |

### Routing

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cacheStrategy` | `{ [pathPrefix]: strategy }` | `{}` | Per-path-prefix override. Strategies: `'cache-first'`, `'network-first'`, `'stale-while-revalidate'`. |
| `subappModules` | `{ [name]: string[] }` | `{}` | Paths cached on-demand when the subapp is first navigated to. |
| `customHandlers` | `{test(url,req):bool, handle(req):Promise<Response>}[]` | `[]` | Fully custom request handlers, evaluated before all built-in routing. |

---

## Cache strategy summary

| Scenario | Strategy |
|----------|---------|
| `customHandlers` match | Custom handler (highest priority) |
| `bypassHosts` match | Browser default — no SW intercept |
| `cacheStrategy` prefix match | Configured override |
| Navigation (HTML pages) | Network-first → cache fallback → `offlineFallback` |
| `networkFirstExtensions` files | Network-first → cache fallback |
| Same-origin static assets | Cache-first → network fill |
| Trusted CDN resources | Cache-first → network fill |
| Image CDN resources | Stale-while-revalidate |
| All other cross-origin | Direct `fetch()` with integrity check if configured |

---

## Runtime message channel

Pages can control the SW at runtime by posting messages:

```js
// Query SW status
navigator.serviceWorker.controller.postMessage({ type: 'SW_GET_STATUS' });
// → { type: 'SW_STATUS', payload: { cacheVersion, integrityMode, networkTimeout, maxCacheAge } }

// Clear the runtime cache (forces fresh fetches)
navigator.serviceWorker.controller.postMessage({ type: 'SW_CLEAR_RUNTIME_CACHE' });
// → { type: 'SW_CACHE_CLEARED', payload: { cache: '<name>' } }

// Force the waiting SW to take control immediately
navigator.serviceWorker.controller.postMessage({ type: 'SW_SKIP_WAITING' });
```

---

## Advanced examples

### Network timeout with graceful degradation

```js
self.SW_CONFIG = {
  cacheVersion:    'myapp-v1',
  appShellFiles:   ['./', './index.html', './manifest.json'],
  networkTimeoutMs: 3000,      // fall back to cache after 3 s
  offlineFallback:  './offline.html',
};
importScripts('/pwa/sw-core.js');
```

### TTL-based cache expiry

```js
self.SW_CONFIG = {
  cacheVersion:       'myapp-v1',
  appShellFiles:      ['./', './index.html'],
  maxCacheAgeSeconds:  3600,  // re-fetch runtime assets older than 1 hour
};
importScripts('/pwa/sw-core.js');
```

### Per-path routing overrides

```js
self.SW_CONFIG = {
  cacheVersion:  'myapp-v1',
  appShellFiles: ['./', './index.html'],
  cacheStrategy: {
    '/api/':     'network-first',            // always check server for API calls
    '/images/':  'stale-while-revalidate',   // instant load, refresh in background
    '/static/':  'cache-first',              // immutable assets
  },
};
importScripts('/pwa/sw-core.js');
```

### Fully custom handler

```js
self.SW_CONFIG = {
  cacheVersion:  'myapp-v1',
  appShellFiles: ['./', './index.html'],
  customHandlers: [
    {
      // Intercept all requests to /api/live/* and never cache them
      test:   (url) => url.pathname.startsWith('/api/live/'),
      handle: (req) => fetch(req),
    },
  ],
};
importScripts('/pwa/sw-core.js');
```

### App-specific event handlers (after importScripts)

Apps that need extra SW functionality can add event listeners **after** `importScripts`:

```js
// myapp/sw.js
self.SW_CONFIG = { cacheVersion: 'myapp-v1', appShellFiles: [...] };
importScripts('/pwa/sw-core.js');

// App-specific background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') event.waitUntil(syncData());
});

// App-specific message handler
self.addEventListener('message', (event) => {
  if (event.data?.type === 'MY_ACTION') { /* ... */ }
});
```

