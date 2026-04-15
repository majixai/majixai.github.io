# /actions — Shared Action Dispatcher Core

This directory is the single source of truth for client-side action dispatching across every MajixAI sub-app.  
Any page can plug straight in with two lines of configuration and get a namespaced action bus with middleware, history, async support, and localStorage persistence — for free.

## Files

| File | Purpose |
|------|---------|
| `actions-core.js` | Unified action dispatcher: namespacing, middleware pipeline, handler registration, action history, async dispatch, localStorage persistence |
| `index.html` | Live demo and full documentation page |
| `README.md` | This file |

---

## Quick start — adding actions-core to any page

### 1 — Configure and load actions-core

Set `window.ACTIONS_CONFIG` **before** loading the script, then call `MajixActions.init()` after the DOM is ready:

```html
<script>
  window.ACTIONS_CONFIG = {
    namespace:    'myapp',       // all types become 'myapp/...'
    logToConsole: true,          // helpful during development
    persistHistory: true,        // replay actions on reload
  };
</script>
<script src="/actions/actions-core.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    MajixActions.init();

    // Register handlers
    MajixActions.on('search', function (payload) {
      console.log('search for:', payload.query);
    });

    // Dispatch an action
    MajixActions.dispatch('search', { query: 'SPY' });
  });
</script>
```

---

## ACTIONS_CONFIG reference

All fields are **optional**; sensible defaults are applied by `actions-core.js`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `namespace` | `string` | `'majix'` | Prefix prepended to every action type (`namespace/type`). Use a unique value per app. |
| `historyLimit` | `number` | `200` | Maximum actions kept in the in-memory log. Set `0` to disable history. |
| `persistHistory` | `boolean` | `false` | Persist history to localStorage on every dispatch. |
| `storageKey` | `string` | `'majixActionsHistory'` | localStorage key for persisted history. |
| `logToConsole` | `boolean` | `false` | Log every dispatch to the browser console. |
| `logLevel` | `'debug'\|'info'\|'warn'\|'error'` | `'info'` | Minimum severity level for console output. |
| `onDispatch` | `function(action)` | `null` | Callback called synchronously after every successful dispatch. |
| `onError` | `function(err, action)` | `null` | Callback called when a handler throws. If omitted, errors are re-thrown. |
| `middleware` | `function[]` | `[]` | Array of middleware functions `(action, next) => void` run before handlers. |

---

## Public API

After the script is loaded, `window.MajixActions` exposes:

### `MajixActions.init()`

Reads `window.ACTIONS_CONFIG`, sets up middleware, and loads any persisted history. Safe to call multiple times (re-initializes configuration).

### `MajixActions.on(type, handler) → unsubscribe`

Register a handler for the given action type(s). `type` may be a string or an array of strings.  
Use `'*'` as a wildcard to receive every dispatched action.  
Returns an **unsubscribe function** — call it to remove the handler.

```js
var off = MajixActions.on('data/load', function (payload) { /* ... */ });
off(); // removes the handler
```

### `MajixActions.once(type, handler) → unsubscribe`

Register a one-time handler. Automatically removed after the first invocation.

### `MajixActions.dispatch(type, payload?, meta?) → result`

Dispatch an action through the middleware pipeline and into registered handlers.  
`type` is auto-namespaced. Returns the handler's return value (or `undefined`).

```js
MajixActions.dispatch('data/load', { ticker: 'SPY' });
```

### `MajixActions.dispatchAsync(type, payload?, meta?) → Promise`

Like `dispatch`, but always returns a `Promise`. Useful when handlers perform async work.

```js
await MajixActions.dispatchAsync('data/save', { rows: [...] });
```

### `MajixActions.use(middlewareFn)`

Append a middleware function to the pipeline. Middleware runs in insertion order.

```js
MajixActions.use(function (action, next) {
  console.time(action.type);
  next(action);
  console.timeEnd(action.type);
});
```

### `MajixActions.off(type?)`

Remove all handlers for the given action type. Omit `type` to remove **all** handlers.

### `MajixActions.history(limit?) → action[]`

Returns a copy of the in-memory action log, most recent first.

```js
var last10 = MajixActions.history(10);
```

### `MajixActions.clearHistory()`

Clear the in-memory log and the localStorage entry (if `persistHistory` is enabled).

### `MajixActions.hasHandler(type) → boolean`

Returns `true` if at least one handler is registered for the given type.

### `MajixActions.config`

Read-only reference to the current resolved configuration object.

---

## Middleware

Middleware functions receive `(action, next)` and must call `next(action)` to continue the pipeline.  
They may mutate the action object before passing it on:

```js
// Timestamp middleware (already built-in via meta.timestamp, but as example)
MajixActions.use(function (action, next) {
  action.meta.processedAt = Date.now();
  next(action);
});

// Logging middleware
MajixActions.use(function (action, next) {
  console.group('[action]', action.type);
  next(action);
  console.groupEnd();
});

// Auth guard middleware
MajixActions.use(function (action, next) {
  if (action.type.startsWith('admin/') && !isAdminUser()) {
    console.warn('Blocked admin action — not authorized');
    return;  // don't call next → action is cancelled
  }
  next(action);
});
```

---

## Examples

### Minimal — button click dispatches an action

```html
<button id="refresh-btn">Refresh</button>

<script>
  window.ACTIONS_CONFIG = { namespace: 'dashboard', logToConsole: true };
</script>
<script src="/actions/actions-core.js"></script>
<script>
  MajixActions.init();
  MajixActions.on('refresh', function () {
    location.reload();
  });
  document.getElementById('refresh-btn').addEventListener('click', function () {
    MajixActions.dispatch('refresh');
  });
</script>
```

### Async data fetch

```js
MajixActions.on('data/fetch', function (payload) {
  return fetch('/api/data?ticker=' + payload.ticker)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      MajixActions.dispatch('data/loaded', data);
    });
});

MajixActions.dispatch('data/fetch', { ticker: 'AAPL' });
```

### Replay persisted history on reload

```js
window.ACTIONS_CONFIG = { namespace: 'myapp', persistHistory: true };
// ...
MajixActions.init();

// After init, history() contains actions from the previous session
MajixActions.history().reverse().forEach(function (a) {
  console.log('Previous action:', a.type, a.meta.timestamp);
});
```
