# /logging — Shared Logging Core

This directory is the single source of truth for client-side logging across every MajixAI sub-app.  
Any page can plug straight in with two lines of configuration, getting multi-target output (console, localStorage, IndexedDB, remote HTTP), level filtering, performance timers, JSON export, and an in-memory ring buffer — for free.

## Files

| File | Purpose |
|------|---------|
| `logging-core.js` | Unified logging: console, localStorage, IndexedDB, remote targets, level filtering, performance timers, ring buffer, JSON export |
| `index.html` | Live demo and full documentation page |
| `README.md` | This file |

---

## Quick start — adding logging-core to any page

### 1 — Configure and load logging-core

Set `window.LOGGER_CONFIG` **before** loading the script, then call `MajixLogger.init()` after the DOM is ready:

```html
<script>
  window.LOGGER_CONFIG = {
    appName: 'myapp',
    level:   'info',           // hide debug messages in production
    targets: ['console', 'memory', 'localStorage'],
  };
</script>
<script src="/logging/logging-core.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    MajixLogger.init();
    MajixLogger.info('App started');
    MajixLogger.debug('Verbose detail', { someValue: 42 });
  });
</script>
```

---

## LOGGER_CONFIG reference

All fields are **optional**; sensible defaults are applied by `logging-core.js`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `appName` | `string` | `'majix'` | Label prepended to every log entry. |
| `level` | `'debug'\|'info'\|'warn'\|'error'\|'none'` | `'debug'` | Minimum level to process. `'none'` silences all output. |
| `targets` | `string[]` | `['console','memory']` | Output destinations. Supported: `'console'`, `'memory'`, `'localStorage'`, `'indexedDB'`, `'remote'`. |
| `storageKey` | `string` | `'majixLogs'` | localStorage key for the `'localStorage'` target. |
| `dbName` | `string` | `'MajixLogDB'` | IndexedDB database name. |
| `dbStoreName` | `string` | `'logs'` | IndexedDB object-store name. |
| `memoryLimit` | `number` | `500` | Maximum entries in the in-memory ring buffer. |
| `localStorageLimit` | `number` | `200` | Maximum entries kept in localStorage. |
| `remoteUrl` | `string\|null` | `null` | HTTP endpoint for remote logging (POST JSON). |
| `remoteFlushInterval` | `number` | `0` | Milliseconds between automatic remote flushes. `0` disables auto-flush. |
| `remoteBatchSize` | `number` | `50` | Entries per remote POST request. |
| `formatter` | `function(entry)` | `null` | Transform entries before writing. Must return the entry. |
| `onLog` | `function(entry)` | `null` | Callback invoked after every write. |
| `consoleTimestamp` | `boolean` | `true` | Include ISO timestamp in console output. |
| `consoleColorize` | `boolean` | `true` | Use CSS colour styling in browser console. |

---

## Log entry shape

Every entry written to any target has the following structure:

```js
{
  id:        1,                           // auto-incrementing sequence number
  level:     'info',                      // 'debug' | 'info' | 'warn' | 'error'
  appName:   'myapp',
  message:   'App started',
  data:      null,                        // optional second argument to log call
  context:   null,                        // optional third argument (string tag)
  timestamp: 1712345678901,              // Date.now()
  isoTime:   '2024-04-05T12:34:38.901Z',
}
```

---

## Public API

After the script is loaded, `window.MajixLogger` exposes:

### `MajixLogger.init()`

Reads `window.LOGGER_CONFIG` and starts the remote flush timer if configured.

### `MajixLogger.debug(message, data?, context?)`
### `MajixLogger.info(message, data?, context?)`
### `MajixLogger.warn(message, data?, context?)`
### `MajixLogger.error(message, data?, context?)`

Write an entry at the given severity level. `data` can be any serialisable value. `context` is a string tag (e.g. `'auth'`, `'network'`).

```js
MajixLogger.info('User signed in', { userId: 42 }, 'auth');
MajixLogger.error('Fetch failed', { status: 500, url: '/api/data' }, 'network');
```

### `MajixLogger.log(level, message, data?, context?)`

Log at a dynamic level string. Unknown values fall back to `'info'`.

### `MajixLogger.perf(label, durationMs, extra?)`

Log a performance measurement at `'info'` level with `context: 'perf'`.

### `MajixLogger.time(label) → stopFn`

Start a named timer. Call the returned function to stop it, log the elapsed time, and return the milliseconds.

```js
var stop = MajixLogger.time('data-fetch');
fetch('/api/data').then(function () { stop(); });
```

### `MajixLogger.getEntries(filter?) → entry[]`

Return a copy of the in-memory buffer, optionally filtered by `{ level, appName, since, context }`.

```js
var errors = MajixLogger.getEntries({ level: 'warn' });
```

### `MajixLogger.clear()`

Clear the in-memory buffer and the localStorage entry.

### `MajixLogger.exportJSON(filter?) → string`

Return all (or filtered) in-memory entries as a pretty-printed JSON string, suitable for download or copy-paste debugging.

### `MajixLogger.flush()`

Immediately POST any queued remote entries. Useful before page unload.

### `MajixLogger.queryDB(opts?) → Promise<entry[]>`

Query IndexedDB entries. `opts` may include `{ level, since, until, limit }`.

```js
MajixLogger.queryDB({ level: 'error', limit: 50 }).then(function (entries) {
  console.table(entries);
});
```

### `MajixLogger.config`

Read-only view of the current resolved configuration.

### `MajixLogger.size`

Number of entries currently in the in-memory buffer.

---

## Examples

### Remote logging with automatic flush every 30 s

```html
<script>
  window.LOGGER_CONFIG = {
    appName:             'trading-app',
    level:               'warn',
    targets:             ['console', 'memory', 'remote'],
    remoteUrl:           'https://logs.example.com/ingest',
    remoteFlushInterval: 30000,
    remoteBatchSize:     100,
  };
</script>
<script src="/logging/logging-core.js"></script>
<script>
  MajixLogger.init();
  window.addEventListener('beforeunload', function () { MajixLogger.flush(); });
</script>
```

### Download a log file from the browser

```js
var json = MajixLogger.exportJSON({ level: 'warn' });
var blob = new Blob([json], { type: 'application/json' });
var a    = document.createElement('a');
a.href   = URL.createObjectURL(blob);
a.download = 'app-logs.json';
a.click();
```

### Using with actions-core

```js
// Log every dispatched action
window.ACTIONS_CONFIG = {
  onDispatch: function (action) {
    MajixLogger.debug('action dispatched', action, 'actions');
  },
};
MajixActions.init();
```
