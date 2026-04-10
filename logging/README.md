# /logging — Shared Logging Infrastructure

This directory is the single source of truth for application logging across every MajixAI sub-app. Any page or script can plug in with two lines of configuration.

## Files

| File | Purpose |
|------|---------|
| `logging-core.js` | Unified logging library (multi-target output · level filtering · ring buffer · perf timers · IndexedDB · remote batching) |
| `index.html` | Interactive demo and live API documentation |

---

## Quick start — adding logging to any page

### 1 — Include the library

```html
<script src="/logging/logging-core.js"></script>
```

### 2 — Configure and initialise

```js
window.LOGGER_CONFIG = {
  namespace: 'my-app',
  level:     'DEBUG',
  targets:   ['console', 'memory'],
};
MajixLogger.init();
```

### 3 — Log away

```js
MajixLogger.info('Page loaded');
MajixLogger.warn('Slow network detected', { latencyMs: 1200 });
MajixLogger.error('Fetch failed', { url: '/api/data', status: 500 });
```

---

## Output targets

| Target | Description |
|--------|-------------|
| `console` | Colour-coded output to `window.console` |
| `memory` | In-process ring buffer — query with `MajixLogger.query()` |
| `localStorage` | Persisted to `localStorage` under `localStorageKey` |
| `indexedDB` | Persisted to IndexedDB — query with `MajixLogger.queryDB()` |
| `remote` | Batched HTTP POST to `remoteUrl` |

Any combination of targets may be active at once.

---

## Log levels

Levels in ascending severity order: `TRACE` · `DEBUG` · `INFO` · `WARN` · `ERROR` · `FATAL`

Only entries at or above the configured `level` are processed.

```js
MajixLogger.setLevel('WARN');  // suppress TRACE/DEBUG/INFO at runtime
```

---

## LOGGER_CONFIG reference

All fields are **optional**; sensible defaults are applied by `logging-core.js`.

### Core

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `namespace` | `string` | `'app'` | Prefix for every entry's `namespace` field. |
| `level` | `string` | `'DEBUG'` | Minimum log level. |
| `targets` | `string[]` | `['console','memory']` | Active output targets. |
| `meta` | `object` | `{}` | Static fields merged into every entry. |
| `timestampFormat` | `'iso'|'unix'|'relative'` | `'iso'` | Timestamp representation. |
| `includeStack` | `boolean` | `false` | Attach stack trace to WARN/ERROR/FATAL entries. |

### Memory buffer

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `bufferSize` | `number` | `500` | Maximum entries in the ring buffer. |

### localStorage

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `localStorageKey` | `string` | `'majix_log'` | Key used in `localStorage`. |
| `localStorageMax` | `number` | `200` | Maximum entries kept in `localStorage`. |

### IndexedDB

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `dbName` | `string` | `'MajixLog'` | IndexedDB database name. |
| `dbStore` | `string` | `'entries'` | Object store name. |
| `dbMaxEntries` | `number` | `5000` | Maximum entries before oldest are purged. |

### Remote

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `remoteUrl` | `string` | `''` | HTTP endpoint for POSTing log batches. |
| `remoteBatchSize` | `number` | `10` | Entries to accumulate before auto-flushing. |
| `remoteFlushMs` | `number` | `5000` | Max ms between flushes even if batch is not full. |

---

## API reference

### Logging

```js
MajixLogger.trace(msg, data?)
MajixLogger.debug(msg, data?)
MajixLogger.info(msg, data?)
MajixLogger.warn(msg, data?)
MajixLogger.error(msg, data?)
MajixLogger.fatal(msg, data?)
MajixLogger.log(level, msg, data?)   // generic
```

`data` is an optional plain object whose keys are merged into the log entry.

### Child loggers

```js
const auth = MajixLogger.child('auth', { userId: 42 });
auth.info('Login successful');
// → namespace: 'my-app:auth', userId: 42
```

### Performance timers

```js
MajixLogger.time('fetchData');
// … async work …
MajixLogger.timeEnd('fetchData');
// → DEBUG [app] fetchData: 123.456ms  { elapsed_ms: 123.456 }
```

### Memory buffer query

```js
// All entries
MajixLogger.query();

// Filtered
MajixLogger.query({ level: 'WARN', namespace: 'auth', limit: 20 });

// Search
MajixLogger.query({ search: 'failed' });

// Time range (unix ms)
MajixLogger.query({ since: Date.now() - 60000 });
```

Filter fields: `level`, `namespace`, `since`, `until`, `limit`, `search`.

### JSON export

```js
const json = MajixLogger.exportJSON();
// JSON array of all in-memory entries
```

### IndexedDB query (async)

```js
MajixLogger.queryDB({ level: 'ERROR', limit: 50 }, function (err, entries) {
  console.log(entries);
});

MajixLogger.clearDB();
```

### Remote flush

```js
MajixLogger.flush();   // immediately POST any pending batch
```

### Runtime configuration

```js
MajixLogger.setLevel('INFO');
MajixLogger.addTarget('localStorage');
MajixLogger.removeTarget('console');
```

### Event bus

```js
MajixLogger.on('entry', function (entry) {
  // called for every dispatched log entry
});

MajixLogger.on('flush', function ({ count, url }) {
  // called after a successful remote flush
});

MajixLogger.on('error', function (err) {
  // called on internal errors (DB open failures, fetch errors, etc.)
});

MajixLogger.off('entry', handler);
```

---

## Usage examples

### Basic app logging

```js
window.LOGGER_CONFIG = {
  namespace: 'dashboard',
  level:     'INFO',
  targets:   ['console', 'memory'],
  meta:      { appVersion: '2.1.0' },
};
MajixLogger.init();

MajixLogger.info('Dashboard ready');
```

### Persist logs across page reloads

```js
window.LOGGER_CONFIG = {
  namespace: 'tracker',
  targets:   ['console', 'memory', 'localStorage', 'indexedDB'],
  level:     'DEBUG',
};
MajixLogger.init();
```

### Send errors to a remote endpoint

```js
window.LOGGER_CONFIG = {
  namespace:      'trading',
  level:          'INFO',
  targets:        ['console', 'memory', 'remote'],
  remoteUrl:      'https://logs.example.com/ingest',
  remoteBatchSize: 5,
  remoteFlushMs:  10000,
};
MajixLogger.init();
```

### Structured logging with child loggers

```js
MajixLogger.init({ namespace: 'api', level: 'DEBUG', targets: ['console', 'memory'] });

const req = MajixLogger.child('request', { requestId: 'abc-123' });
req.info('Received');
req.debug('Validating payload', { bodySize: 512 });
req.warn('Rate limit approaching', { remaining: 3 });
```

### Stack trace capture

```js
window.LOGGER_CONFIG = {
  namespace:    'app',
  includeStack: true,   // attaches stack to WARN/ERROR/FATAL
  targets:      ['console', 'memory'],
};
MajixLogger.init();

MajixLogger.error('Unexpected state', { code: 'E_INVALID' });
```
