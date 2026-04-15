# /events — Centralised Event Handling Core

This directory is the single source of truth for event handling across every MajixAI sub-app and new directory. Any module can publish and subscribe to events through a shared bus with zero dependencies.

---

## Files

| File | Purpose |
|---|---|
| `events-core.js` | Full event bus: pub/sub, namespacing, priority, middleware, debounce/throttle, history, persistence, cross-tab broadcast |

---

## Quick start — adding event handling to a new directory

### 1 — Load the core script in your HTML

```html
<script src="/events/events-core.js"></script>
<script>
  window.EVENTS_CONFIG = {
    namespace: 'myapp',   // prefix all events: 'myapp:click', etc.
  };
  MajixEvents.init();
</script>
```

### 2 — Subscribe to events

```js
// Basic subscription — listens for 'myapp:user:login'
MajixEvents.on('user:login', (payload) => {
  console.log('User logged in:', payload.username);
});

// One-time handler
MajixEvents.once('app:ready', () => {
  console.log('App is ready!');
});

// Wildcard — catch all events in the 'data' sub-namespace
MajixEvents.on('data:*', (payload, event) => {
  console.log(`Data event [${event}]:`, payload);
});

// Global wildcard — every event
MajixEvents.on('*', (payload, event) => {
  console.log(`Event fired: ${event}`, payload);
});
```

### 3 — Emit events

```js
// Simple emit (async, returns Promise)
await MajixEvents.emit('user:login', { username: 'alice' });

// Sync emit (returns array of handler return values)
MajixEvents.emitSync('app:ready');

// Broadcast to all open tabs
MajixEvents.emit('cart:updated', { items: 3 }, { broadcast: true });

// Persist to localStorage for later replay
MajixEvents.emit('analytics:pageview', { path: '/dashboard' }, { persist: true });
```

### 4 — Unsubscribe

```js
// Option A — use the returned unsubscribe function
const unsub = MajixEvents.on('user:logout', handler);
unsub();

// Option B — pass the original handler reference
MajixEvents.off('user:logout', handler);
```

---

## EVENTS_CONFIG options

| Key | Type | Default | Description |
|---|---|---|---|
| `namespace` | `string` | `''` | Prefix automatically prepended to every event name. |
| `broadcastKey` | `string` | `'majixai-events'` | `BroadcastChannel` name used for cross-tab communication. |
| `historyLimit` | `number` | `200` | Maximum number of events kept in the in-memory history ring. |
| `persist` | `boolean` | `false` | When `true`, every `emit()` call also writes to `localStorage`. |
| `persistKey` | `string` | `'majixai-ev'` | `localStorage` key prefix for persisted events. |
| `persistLimit` | `number` | `100` | Maximum number of persisted entries per event name. |

---

## Priority

Handlers with higher `priority` numbers run first. Default is `0`.

```js
// Critical handler runs before default
MajixEvents.on('error:critical', alertAdmin,   { priority: 10 });
MajixEvents.on('error:critical', logToConsole, { priority:  0 });
MajixEvents.on('error:critical', cleanup,      { priority: -5 });
```

---

## Middleware

Middleware intercepts every `emit()` before handlers are invoked. It can transform the payload, add metadata, or block propagation.

```js
// Add timestamp to every payload
MajixEvents.use((event, payload, next) => {
  next(Object.assign({ _ts: Date.now() }, payload));
});

// Block events that fail validation
MajixEvents.use((event, payload, next) => {
  if (event.startsWith('payment:') && !payload.amount) {
    console.warn('[Events] Payment event missing amount — blocked');
    return; // do not call next()
  }
  next(payload);
});

// Async middleware
MajixEvents.use(async (event, payload, next) => {
  const enriched = await fetchEnrichment(payload);
  next(enriched);
});
```

---

## Debounce and Throttle

```js
// Only run handler 300 ms after the last 'search:query' burst
MajixEvents.debounce('search:query', (payload) => {
  doSearch(payload.term);
}, 300);

// Rate-limit to once per 1000 ms
MajixEvents.throttle('scroll:position', (payload) => {
  updateIndicator(payload.y);
}, 1000);
```

---

## Piping events

Forward one event stream as another, with an optional payload transform.

```js
// Forward 'legacy:click' as 'ui:click' unchanged
MajixEvents.pipe('legacy:click', 'ui:click');

// Transform payload while piping
MajixEvents.pipe('raw:data', 'processed:data', (payload) => ({
  ...payload,
  normalised: payload.value / 100,
}));
```

---

## Event history and replay

```js
// Get all events fired so far
const all = MajixEvents.history();

// Get only 'myapp:user:*' events
const userEvents = MajixEvents.history('myapp:user:*');

// Replay all 'myapp:analytics:*' events through current subscribers
MajixEvents.replay('myapp:analytics:*');

// Replay through a custom handler
MajixEvents.replay('myapp:analytics:*', (payload, event) => {
  reprocessAnalytics(event, payload);
});

// Clear history for a specific pattern
MajixEvents.clearHistory('myapp:debug:*');

// Clear all history
MajixEvents.clearHistory();
```

---

## Cross-tab broadcast

Events emitted with `{ broadcast: true }` are sent through a `BroadcastChannel` and re-emitted in every other open tab/window on the same origin. The re-emitted payload has `_fromBroadcast: true` merged in so handlers can distinguish the source.

```js
// Tab A — emit to all tabs
MajixEvents.emit('session:expired', {}, { broadcast: true });

// Tab B — receives the event automatically
MajixEvents.on('session:expired', (payload) => {
  if (!payload._fromBroadcast) return; // optional guard
  redirectToLogin();
});
```

---

## Persistent events (localStorage)

Events emitted with `{ persist: true }` (or when `EVENTS_CONFIG.persist = true`) are stored in `localStorage`. On the next page load you can replay them.

```js
// Page load — replay any stored analytics events
MajixEvents.replay('analytics:pageview');
```

---

## Full API reference

### `MajixEvents.init([config])`
Initialise the bus. Reads `window.EVENTS_CONFIG` if no argument is provided and opens the `BroadcastChannel`.

### `MajixEvents.configure(config)`
Merge additional config at runtime.

### `MajixEvents.on(event, handler [, options])`
Subscribe. Returns an `unsubscribe()` function.

| Option | Type | Default | Description |
|---|---|---|---|
| `once` | `boolean` | `false` | Auto-remove after first invocation. |
| `priority` | `number` | `0` | Higher = runs earlier. |
| `prepend` | `boolean` | `false` | Insert at the front before sorting by priority. |

### `MajixEvents.once(event, handler [, options])`
Shorthand for `on(event, handler, { once: true })`.

### `MajixEvents.off(event, handler)`
Remove a specific handler.

### `MajixEvents.emit(event [, payload [, options]])`
Async emit. Runs middleware chain then all matching handlers. Returns `Promise<Array>`.

| Option | Type | Default | Description |
|---|---|---|---|
| `broadcast` | `boolean` | `false` | Send via `BroadcastChannel` to other tabs. |
| `persist` | `boolean` | `false` | Write to `localStorage`. |
| `async` | `boolean` | `false` | Defer handler invocation to next event-loop tick. |

### `MajixEvents.emitSync(event [, payload])`
Synchronous emit. Bypasses middleware. Returns `Array` of handler return values.

### `MajixEvents.use(middleware)`
Register `(event, payload, next) => void` middleware. Call `next(newPayload)` to continue.

### `MajixEvents.replay(event [, handler])`
Replay history (and persisted entries if enabled) for `event`.

### `MajixEvents.history([filter])`
Return history array. `filter` supports wildcards.

### `MajixEvents.clearHistory([filter])`
Remove history entries. Omit `filter` to clear all.

### `MajixEvents.debounce(event, handler, wait [, options])`
Subscribe with debouncing. Returns `unsubscribe()`.

### `MajixEvents.throttle(event, handler, wait [, options])`
Subscribe with throttling. Returns `unsubscribe()`.

### `MajixEvents.pipe(source, target [, transform])`
Forward `source` events as `target` events. Returns `unsubscribe()`.

### `MajixEvents.destroy()`
Remove all subscriptions, middleware, history, and close the `BroadcastChannel`.

---

## Usage pattern for a new directory

```html
<!-- myapp/index.html -->
<script src="/events/events-core.js"></script>
<script>
  window.EVENTS_CONFIG = {
    namespace:    'myapp',
    broadcastKey: 'majixai-events',
    historyLimit: 100,
  };
  MajixEvents.init();

  // Log all events in development
  if (location.hostname === 'localhost') {
    MajixEvents.on('*', (payload, event) => {
      console.debug('[Events]', event, payload);
    }, { priority: -99 });
  }
</script>
```

```js
// myapp/app.js
MajixEvents.on('ui:button:click', (payload) => {
  // handle button click
});

document.querySelector('#myBtn').addEventListener('click', () => {
  MajixEvents.emit('ui:button:click', { id: 'myBtn', ts: Date.now() });
});
```
