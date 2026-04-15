// /events/events-core.js  —  Centralised Event Handling Core for MajixAI
// Version 2.0.0
//
// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
//
// MajixEvents is a full-featured, zero-dependency event bus designed for use
// across all MajixAI apps.  It runs in browsers, Web Workers, Service Workers,
// and Node.js without modification.
//
// Core capabilities
// ─────────────────
//   • pub/sub with wildcard patterns and namespace scoping
//   • synchronous and asynchronous emit
//   • middleware pipeline (transform / filter / log)
//   • priority-ordered handler invocation
//   • debounce and throttle subscriptions (with cancel/flush)
//   • pipe / forward between event names
//   • in-memory history with replay
//   • localStorage and IndexedDB persistence
//   • cross-tab BroadcastChannel relay
//   • event batching / transactions
//   • request-response (ask / answer) pattern
//   • scoped sub-buses (EventScope)
//   • payload schema validation
//   • live metrics and statistics
//   • plugin system for reusable extensions
//   • stream combinators: merge, zip, race, combineLatest, sequence
//   • event queue with FIFO / LIFO / priority modes
//   • deduplication / idempotency guards
//   • conditional router
//   • strict ordering with sequence numbers
//   • snapshot / restore
//   • Worker / ServiceWorker message bridge
//
// ══════════════════════════════════════════════════════════════════════════════
// QUICK-START
// ══════════════════════════════════════════════════════════════════════════════
//
// ── Browser (global script) ───────────────────────────────────────────────────
//
//   <script src="/events/events-core.js"></script>
//   <script>
//     window.EVENTS_CONFIG = {
//       namespace:     'myapp',          // module/directory name
//       broadcastKey:  'majixai-events', // BroadcastChannel name
//       historyLimit:  100,              // max events kept in history
//       persist:       true,             // persist events to localStorage
//       persistKey:    'majixai-ev',     // localStorage key prefix
//       persistLimit:  50,               // max persisted events
//     };
//     MajixEvents.init();
//   </script>
//
// ── ES module ────────────────────────────────────────────────────────────────
//
//   import MajixEvents from '/events/events-core.js';
//   MajixEvents.configure({ namespace: 'myapp' });
//
// ── Node.js (CommonJS) ───────────────────────────────────────────────────────
//
//   const { MajixEvents } = require('./events-core.js');
//   MajixEvents.configure({ namespace: 'server' });
//
// ══════════════════════════════════════════════════════════════════════════════
// FULL API REFERENCE
// ══════════════════════════════════════════════════════════════════════════════
//
// ── Core subscription ─────────────────────────────────────────────────────────
//
//   MajixEvents.on(event, handler [, options])
//     Subscribe to an event.
//     • event     — string; may include namespace ('ns:name'), wildcard
//                   ('ns:*'), or global wildcard ('*').
//     • handler   — function(payload, eventName) — called for each matching emit.
//     • options   — object (all optional):
//         once      {boolean}  — auto-unsubscribe after first call.   Default false.
//         priority  {number}   — higher numbers run first.            Default 0.
//         prepend   {boolean}  — insert before same-priority entries. Default false.
//         tag       {string}   — arbitrary label for group operations. Default ''.
//         id        {string}   — caller-supplied stable ID.           Auto-assigned.
//     Returns an unsubscribe function.
//
//   MajixEvents.once(event, handler [, options])
//     Shorthand for on() with { once: true }.
//
//   MajixEvents.off(event, handler)
//     Remove a specific subscription identified by event + handler reference.
//
//   MajixEvents.offById(subscriptionId)
//     Remove a subscription by its stable string or numeric ID.
//
//   MajixEvents.offByTag(tag)
//     Remove all subscriptions that carry the given tag label.
//
//   MajixEvents.offAll([event])
//     Remove every subscription for an event (or all events if omitted).
//
//   MajixEvents.count([event])
//     Return the number of active subscriptions, optionally filtered by event.
//
//   MajixEvents.listEvents()
//     Return an array of all event names that currently have at least one
//     subscriber.
//
// ── Emit ──────────────────────────────────────────────────────────────────────
//
//   MajixEvents.emit(event [, payload [, options]])
//     Fire an event asynchronously.
//     • options:
//         broadcast  {boolean} — relay via BroadcastChannel to other tabs.
//         persist    {boolean} — save to localStorage (overrides global flag).
//         async      {boolean} — defer handlers to next microtask.
//         idb        {boolean} — save to IndexedDB in addition to localStorage.
//         dedupe     {boolean} — skip if identical event+payload within window.
//         dedupeWindow {number} ms window for deduplication. Default 50.
//     Returns a Promise<Array> of handler return values.
//
//   MajixEvents.emitSync(event [, payload [, options]])
//     Synchronous variant — no middleware, no async side-effects.
//     Returns an Array of handler return values.
//
//   MajixEvents.emitMany(pairs)
//     Emit an array of [event, payload] pairs sequentially.
//     Returns a Promise<Array> of all handler return values.
//
//   MajixEvents.emitParallel(pairs)
//     Emit an array of [event, payload] pairs in parallel.
//     Returns a Promise<Array[]> — one results array per emission.
//
// ── Middleware ────────────────────────────────────────────────────────────────
//
//   MajixEvents.use(middleware)
//     Register a middleware: (event, payload, next) => payload.
//     Call next(modifiedPayload) to continue the chain.
//     A middleware may be async (return a Promise).
//
//   MajixEvents.unuse(middleware)
//     Remove a previously registered middleware.
//
//   MajixEvents.clearMiddleware()
//     Remove all middleware.
//
// ── History ───────────────────────────────────────────────────────────────────
//
//   MajixEvents.history([filter])
//     Return a copy of the in-memory history, optionally filtered by event
//     pattern (supports wildcards).
//
//   MajixEvents.historyFor(event [, limit])
//     Return the most recent `limit` entries for a specific event.
//
//   MajixEvents.historySince(timestamp)
//     Return all history entries emitted after `timestamp` (ms since epoch).
//
//   MajixEvents.historyBetween(from, to)
//     Return history entries emitted between two timestamps.
//
//   MajixEvents.clearHistory([event])
//     Clear history, optionally scoped to an event pattern.
//
//   MajixEvents.exportHistory([filter])
//     Serialize the history (or filtered subset) to a JSON string.
//
//   MajixEvents.importHistory(jsonString [, merge])
//     Restore history from a JSON string.  If merge=true existing entries are
//     kept; otherwise history is replaced.
//
// ── Replay ────────────────────────────────────────────────────────────────────
//
//   MajixEvents.replay(event [, handler [, options]])
//     Replay all history entries matching event through handler (or current
//     subscribers if handler is omitted).
//     • options:
//         includePersisted {boolean} — include localStorage entries. Default true.
//         from  {number} — only replay entries with ts >= from.
//         to    {number} — only replay entries with ts <= to.
//         limit {number} — cap the number of replayed entries.
//
//   MajixEvents.replayAll([handler])
//     Replay the entire history through handler or current subscribers.
//
// ── Timing helpers ────────────────────────────────────────────────────────────
//
//   MajixEvents.debounce(event, handler, wait [, options])
//     Subscribe with debouncing.  Returns { unsubscribe, cancel, flush }.
//
//   MajixEvents.throttle(event, handler, wait [, options])
//     Subscribe with throttling (leading + optional trailing).
//     options: { leading=true, trailing=true }.
//     Returns { unsubscribe, cancel }.
//
//   MajixEvents.delay(event, handler, ms [, options])
//     Subscribe and invoke handler `ms` milliseconds after each emission.
//     Returns { unsubscribe, cancel }.
//
//   MajixEvents.sample(event, handler, interval [, options])
//     Invoke handler at most once per `interval` ms with the latest payload.
//     Returns { unsubscribe, cancel }.
//
//   MajixEvents.audit(event, handler, durationMs [, options])
//     Like throttle but always fires at end of window regardless of timing.
//     Returns { unsubscribe, cancel }.
//
// ── Pipe / Forward ───────────────────────────────────────────────────────────
//
//   MajixEvents.pipe(sourceEvent, targetEvent [, transform [, options]])
//     Forward every sourceEvent as targetEvent, optionally transforming payload.
//     Returns unsubscribe function.
//
//   MajixEvents.filter(event, predicate, handler [, options])
//     Only invoke handler when predicate(payload, event) returns truthy.
//     Returns unsubscribe function.
//
//   MajixEvents.map(event, transform, targetEvent [, options])
//     Map every emission to a new payload and re-emit on targetEvent.
//     Returns unsubscribe function.
//
//   MajixEvents.tap(event, sideEffect [, options])
//     Subscribe for side effects; does not affect the payload.
//     Returns unsubscribe function.
//
// ── Batching / Transactions ───────────────────────────────────────────────────
//
//   MajixEvents.batch(fn)
//     Execute fn() synchronously; all emit() calls inside are queued and
//     flushed as a single atomic group at the end.  Subscribers see each
//     event individually but no event fires until fn() returns.
//     Returns a Promise that resolves when all queued events have been
//     dispatched.
//
//   MajixEvents.buffer(event, count [, options])
//     Collect `count` emissions of event then deliver them as an array to
//     a single synthetic '[event]:buffered' emission.
//     Returns unsubscribe function.
//
//   MajixEvents.window(event, durationMs [, options])
//     Collect all emissions of event in a time window and deliver as an array.
//     Returns unsubscribe function.
//
// ── Request / Response ────────────────────────────────────────────────────────
//
//   MajixEvents.ask(event [, payload [, timeout]])
//     Emit event and wait for a single response via MajixEvents.answer(event, …).
//     Returns a Promise<responsePayload>.  Rejects after `timeout` ms (default 5000).
//
//   MajixEvents.answer(event, handler)
//     Register a handler that will respond to ask() calls.
//     handler(payload, reply) — call reply(responsePayload) to respond.
//     Returns unsubscribe function.
//
// ── Scoped Sub-Bus ───────────────────────────────────────────────────────────
//
//   MajixEvents.scope(namespace)
//     Create a lightweight EventScope sub-bus.  All events emitted or subscribed
//     through the scope are automatically prefixed with 'namespace:'.
//     A scope exposes the same API as MajixEvents (on, once, off, emit, …).
//     Returns an EventScope instance.
//
// ── Schema Validation ─────────────────────────────────────────────────────────
//
//   MajixEvents.defineSchema(event, schema)
//     Register a validation schema for an event.
//     schema — plain object where each key maps to a validator:
//       • a type string ('string', 'number', 'boolean', 'object', 'array')
//       • a function(value) → boolean/string (false/string = validation error)
//       • { type, required, min, max, pattern, enum, validator }
//     Schemas cascade: a wildcard schema ('ns:*') applies to all ns:… events.
//
//   MajixEvents.removeSchema(event)
//     Remove the schema for an event.
//
//   MajixEvents.validate(event, payload)
//     Validate payload against the registered schema for event.
//     Returns { valid: boolean, errors: string[] }.
//
//   MajixEvents.setSchemaMode(mode)
//     'warn'  — log validation errors but still dispatch (default).
//     'throw' — throw ValidationError on invalid payload.
//     'drop'  — silently discard invalid emissions.
//
// ── Metrics / Statistics ──────────────────────────────────────────────────────
//
//   MajixEvents.metrics([event])
//     Return a metrics snapshot:
//       { event, emitCount, handlerCount, errorCount,
//         lastEmitAt, avgHandlerMs, totalHandlerMs, peakHandlerMs }
//
//   MajixEvents.metricsAll()
//     Return an array of snapshots for every tracked event.
//
//   MajixEvents.resetMetrics([event])
//     Reset counters (all events or just one).
//
//   MajixEvents.enableMetrics(flag)
//     Enable or disable metrics collection globally (default: false).
//
// ── Plugins ───────────────────────────────────────────────────────────────────
//
//   MajixEvents.plugin(pluginObject)
//     Register a plugin.  A plugin is an object with:
//       { name: string, install(bus): void }
//     install() receives the MajixEvents bus and can add new methods or
//     middleware.  Plugins are de-duped by name.
//     Returns MajixEvents for chaining.
//
//   MajixEvents.hasPlugin(name)
//     Returns true if a plugin with that name has been registered.
//
// ── Combinators ──────────────────────────────────────────────────────────────
//
//   MajixEvents.merge(events, targetEvent [, options])
//     Re-emit any of the source events on targetEvent.
//     Returns unsubscribe function.
//
//   MajixEvents.zip(events, targetEvent [, options])
//     Wait for one emission from each source event, then emit
//     targetEvent with an array of payloads (in source order).
//     Repeats when all sources have emitted again.
//     Returns unsubscribe function.
//
//   MajixEvents.race(events, targetEvent [, options])
//     Emit targetEvent with the first payload to arrive from any source;
//     unsubscribes all others.
//     Returns unsubscribe function.
//
//   MajixEvents.combineLatest(events, targetEvent [, options])
//     Emit targetEvent with an array of the latest value from each source
//     whenever any source emits (once all sources have emitted at least once).
//     Returns unsubscribe function.
//
//   MajixEvents.sequence(steps)
//     Compose a multi-step workflow:
//       steps = [ { event, handler(payload) }, … ]
//     Returns a Promise that resolves when the last step's handler resolves.
//
// ── Queue ─────────────────────────────────────────────────────────────────────
//
//   MajixEvents.createQueue(name [, options])
//     Create a named event queue.
//     options: { mode: 'fifo'|'lifo'|'priority', maxSize, concurrency }
//     Returns a Queue instance with: .enqueue(event, payload), .flush(),
//     .pause(), .resume(), .clear(), .size.
//
// ── Deduplication ────────────────────────────────────────────────────────────
//
//   MajixEvents.dedupeOn(event [, keyFn [, windowMs]])
//     Suppress duplicate emissions of event within windowMs (default 0 = always).
//     keyFn(payload) → string key used for dedup comparison. Default: JSON.stringify.
//     Returns unsubscribe function.
//
// ── Router ────────────────────────────────────────────────────────────────────
//
//   MajixEvents.createRouter(routeMap)
//     Build a conditional router from a routeMap object:
//       { 'source-event': [ { when(payload) → bool, target: 'target-event' [, transform] }, … ] }
//     Returns { start(), stop() }.
//
// ── Ordering / Sequence Numbers ───────────────────────────────────────────────
//
//   Each event in history carries an auto-incremented `seq` field.
//   MajixEvents.historyFrom(seqNumber) returns all entries with seq >= seqNumber.
//
// ── Snapshot / Restore ───────────────────────────────────────────────────────
//
//   MajixEvents.snapshot()
//     Serialize current history + config to a JSON string.
//
//   MajixEvents.restore(snapshotString)
//     Restore from a snapshot (replaces history; merges config).
//
// ── Worker Bridge ─────────────────────────────────────────────────────────────
//
//   MajixEvents.connectWorker(worker [, options])
//     Bridge MajixEvents to a Worker or SharedWorker.
//     events emitted in either context are forwarded to the other.
//     options: { events: ['list', 'of', 'events'] } — whitelist (default: all).
//     Returns { disconnect() }.
//
// ── Utility ───────────────────────────────────────────────────────────────────
//
//   MajixEvents.configure(config)
//     Merge additional configuration at runtime.
//
//   MajixEvents.destroy()
//     Tear down everything: listeners, middleware, channel, queues, history.
//
//   MajixEvents.version
//     String: '2.0.0'.
//
// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION REFERENCE
// ══════════════════════════════════════════════════════════════════════════════
//
//   namespace        {string}   — auto-qualify unscoped event names.  Default ''.
//   broadcastKey     {string}   — BroadcastChannel name.  Default 'majixai-events'.
//   historyLimit     {number}   — max in-memory history entries.  Default 200.
//   persist          {boolean}  — persist every emit to localStorage.  Default false.
//   persistKey       {string}   — localStorage key prefix.  Default 'majixai-ev'.
//   persistLimit     {number}   — max persisted entries per event.  Default 100.
//   idb              {boolean}  — also persist to IndexedDB.  Default false.
//   idbName          {string}   — IndexedDB database name.  Default 'MajixEventsDB'.
//   idbStore         {string}   — IndexedDB object store name.  Default 'events'.
//   metrics          {boolean}  — collect performance metrics.  Default false.
//   schemaMode       {string}   — validation mode: 'warn'|'throw'|'drop'.  Default 'warn'.
//   errorHandler     {Function} — global error handler(err, event, payload).
//   maxListeners     {number}   — warn if a single event exceeds this.  Default 100.
//   debug            {boolean}  — verbose console logging.  Default false.
//
// ══════════════════════════════════════════════════════════════════════════════
// WILDCARD PATTERNS
// ══════════════════════════════════════════════════════════════════════════════
//
//   '*'           — matches every event.
//   'ns:*'        — matches every event starting with 'ns:'.
//   'ns:foo*'     — matches 'ns:foo', 'ns:foobar', etc.
//   'ns:*:end'    — matches 'ns:anything:end'.
//   'a:*:*'       — matches 'a:x:y', 'a:hello:world', etc.
//
//   Patterns are compiled to RegExp and cached for performance.
//
// ══════════════════════════════════════════════════════════════════════════════
// PRIORITY
// ══════════════════════════════════════════════════════════════════════════════
//
//   Higher numbers run first.  Default priority = 0.
//   Use priority: 10 for critical / validation handlers.
//   Use priority: -10 for cleanup / logging handlers.
//   Same-priority handlers run in insertion order (stable sort).
//
// ══════════════════════════════════════════════════════════════════════════════
// CROSS-TAB COMMUNICATION
// ══════════════════════════════════════════════════════════════════════════════
//
//   emit(event, payload, { broadcast: true }) posts the event through the
//   BroadcastChannel so all other tabs / windows receive it.
//   Incoming broadcast events are re-emitted locally with
//   { _fromBroadcast: true } merged into the payload.
//   The tab that originally emitted the event does NOT receive its own
//   broadcast back (deduplication via origin tab ID).
//
// ══════════════════════════════════════════════════════════════════════════════
// PERSISTENCE
// ══════════════════════════════════════════════════════════════════════════════
//
//   localStorage persistence
//   ────────────────────────
//   emit(event, payload, { persist: true }) stores the entry in localStorage.
//   Keys are of the form: `${persistKey}:${qualifiedEvent}`.
//   Each key holds a JSON-serialised array of { payload, ts, seq } objects.
//   The array is capped at persistLimit entries (oldest are dropped first).
//   Use MajixEvents.replay(event) to replay persisted entries.
//
//   IndexedDB persistence
//   ─────────────────────
//   Set idb: true in config (or pass { idb: true } per emit) to also store
//   events in IndexedDB.  This supports larger payloads and richer querying.
//   The DB is opened lazily on first use.  All writes are fire-and-forget
//   (background) to avoid blocking the event dispatch path.
//   Use MajixEvents.queryIdb(options) to query the store:
//     options: { event, from, to, limit, offset }
//   Use MajixEvents.clearIdb([event]) to delete stored records.
//
// ══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ══════════════════════════════════════════════════════════════════════════════
//
//   By default handler errors are caught, logged to console.error, and
//   recorded in metrics.  The global errorHandler config option lets you
//   intercept them:
//     window.EVENTS_CONFIG = {
//       errorHandler(err, event, payload) {
//         Sentry.captureException(err, { extra: { event, payload } });
//       }
//     };
//
// ══════════════════════════════════════════════════════════════════════════════
// EXAMPLES
// ══════════════════════════════════════════════════════════════════════════════
//
//   // Basic subscribe / emit
//   MajixEvents.on('user:login', payload => console.log('Logged in', payload));
//   await MajixEvents.emit('user:login', { userId: 42 });
//
//   // Once subscription
//   MajixEvents.once('app:ready', () => initUI());
//
//   // Wildcard
//   MajixEvents.on('user:*', (payload, event) => console.log(event, payload));
//
//   // Debounce
//   const { unsubscribe } = MajixEvents.debounce('search:query', handleSearch, 300);
//
//   // Request / Response
//   MajixEvents.answer('data:fetch', (payload, reply) =>
//     fetch(payload.url).then(r => r.json()).then(reply));
//   const data = await MajixEvents.ask('data:fetch', { url: '/api/data' });
//
//   // Scoped sub-bus
//   const ui = MajixEvents.scope('ui');
//   ui.on('click', handler);   // subscribes to 'ui:click'
//   ui.emit('click', { x, y }); // emits 'ui:click'
//
//   // Batch
//   await MajixEvents.batch(() => {
//     MajixEvents.emit('a', 1);
//     MajixEvents.emit('b', 2);
//     MajixEvents.emit('c', 3);
//   });
//
//   // Combinator — zip
//   MajixEvents.zip(['data:loaded', 'auth:ready'], 'app:init');
//   MajixEvents.on('app:init', ([data, auth]) => bootstrap(data, auth));
//
//   // Schema validation
//   MajixEvents.defineSchema('user:update', {
//     userId: { type: 'number', required: true },
//     name:   { type: 'string', min: 1, max: 100 },
//   });
//
//   // Metrics
//   MajixEvents.enableMetrics(true);
//   console.log(MajixEvents.metrics('user:login'));
//
//   // Plugin
//   MajixEvents.plugin({
//     name: 'logger',
//     install(bus) {
//       bus.use((event, payload, next) => {
//         console.log('[event]', event, payload);
//         next(payload);
//       });
//     },
//   });
//
// ── Priority ───────────────────────────────────────────────────────────────────
//   Higher numbers run first.  Default priority = 0.
//   Use priority: 10 for critical handlers, priority: -10 for cleanup work.
//
// ── Cross-tab communication ────────────────────────────────────────────────────
//   emit(event, payload, { broadcast: true }) posts the event through a
//   BroadcastChannel so all other tabs receive it.  Incoming broadcast events
//   are re-emitted locally with { _fromBroadcast: true } merged into the payload.
//
// ── Persistence ───────────────────────────────────────────────────────────────
//   emit(event, payload, { persist: true }) also stores the entry in
//   localStorage so it survives page reloads and can be replayed via
//   MajixEvents.replay().

(() => {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  // VERSION
  // ══════════════════════════════════════════════════════════════════════════

  const VERSION = '2.0.0';

  // ══════════════════════════════════════════════════════════════════════════
  // INTERNAL STATE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Map of qualified event pattern → array of subscriber entries.
   * @type {Map<string, Array<SubscriberEntry>>}
   *
   * SubscriberEntry shape:
   *   { handler, once, priority, id, pattern, tag, callerTag }
   */
  const _listeners  = new Map();

  /** @type {Array<Function>} middleware pipeline */
  const _middleware = [];

  /**
   * In-memory event history.
   * Each entry: { event, payload, ts, seq }
   * @type {Array<HistoryEntry>}
   */
  const _history = [];

  /** Monotonically increasing subscription ID */
  let _idSeq = 0;

  /** Monotonically increasing event sequence number */
  let _seqSeq = 0;

  /** Compiled RegExp cache for wildcard patterns */
  const _patternCache = new Map();

  /** Deduplication tracking: `event|serialisedPayload` → last-seen timestamp */
  const _dedupeMap = new Map();

  /** Batch mode — truthy while inside MajixEvents.batch() */
  let _batchDepth = 0;
  /** @type {Array<{event:string, payload:*, options:object}>} */
  const _batchQueue = [];

  /** IndexedDB handle (opened lazily) */
  let _idb = null;
  let _idbOpenPromise = null;

  /** Installed plugins — keyed by name */
  const _plugins = new Map();

  /** Metrics store — keyed by qualified event name */
  const _metrics = new Map();

  /** Schema registry — keyed by event pattern */
  const _schemas = new Map();

  /** Named queues */
  const _queues = new Map();

  /** Tab / context identity for broadcast dedup */
  const _tabId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  /** Default configuration */
  let _cfg = {
    namespace:    '',
    broadcastKey: 'majixai-events',
    historyLimit: 200,
    persist:      false,
    persistKey:   'majixai-ev',
    persistLimit: 100,
    idb:          false,
    idbName:      'MajixEventsDB',
    idbStore:     'events',
    metrics:      false,
    schemaMode:   'warn',   // 'warn' | 'throw' | 'drop'
    errorHandler: null,
    maxListeners: 100,
    debug:        false,
  };

  let _channel = null;   // BroadcastChannel instance

  // ══════════════════════════════════════════════════════════════════════════
  // LOGGING HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  function _log(...args) {
    if (_cfg.debug) console.log('[MajixEvents]', ...args);
  }

  function _warn(...args) {
    console.warn('[MajixEvents]', ...args);
  }

  function _error(...args) {
    console.error('[MajixEvents]', ...args);
  }

  function _handleError(err, event, payload) {
    if (typeof _cfg.errorHandler === 'function') {
      try { _cfg.errorHandler(err, event, payload); } catch { /* ignore */ }
    } else {
      _error(`Handler error on "${event}":`, err);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Merge additional configuration at runtime.
   * @param {object} overrides
   */
  function configure(overrides) {
    if (!overrides || typeof overrides !== 'object') return;
    Object.assign(_cfg, overrides);
    _initChannel();
    _log('configured', _cfg);
  }

  function _applyWindowConfig() {
    if (typeof window !== 'undefined' && window.EVENTS_CONFIG) {
      configure(window.EVENTS_CONFIG);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BROADCASTCHANNEL
  // ══════════════════════════════════════════════════════════════════════════

  function _initChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    if (_channel) {
      try { _channel.close(); } catch { /* ignore */ }
      _channel = null;
    }
    _channel = new BroadcastChannel(_cfg.broadcastKey);
    _channel.onmessage = _onBroadcastMessage;
    _channel.onmessageerror = (ev) => _error('BroadcastChannel message error', ev);
    _log('BroadcastChannel open:', _cfg.broadcastKey);
  }

  function _onBroadcastMessage(ev) {
    const data = ev.data || {};
    if (!data._majixEvent) return;
    // Ignore messages we sent ourselves
    if (data._tabId === _tabId) return;
    const payload = Object.assign({}, data.payload, { _fromBroadcast: true });
    _log('broadcast receive', data.event, payload);
    _dispatchLocal(data.event, payload);
  }

  function _broadcastEmit(event, payload) {
    if (!_channel) return;
    try {
      _channel.postMessage({ _majixEvent: true, event, payload, _tabId });
    } catch (err) {
      _error('BroadcastChannel postMessage failed:', err);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NAMESPACE HELPER
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Qualify a raw event name with the configured namespace.
   * Unscoped event 'foo' with namespace 'ns' → 'ns:foo'.
   * Already-scoped events (containing ':') are returned as-is.
   * @param {string} event
   * @returns {string}
   */
  function _qualify(event) {
    if (!_cfg.namespace) return event;
    if (event === '*' || event.includes(':')) return event;
    return `${_cfg.namespace}:${event}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WILDCARD PATTERN MATCHING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Compile a glob pattern to RegExp, with caching.
   * Wildcards:
   *   '*'  anywhere → matches one or more chars that are not ':'
   *   '**' → matches anything (including ':')
   * @param {string} pattern
   * @returns {RegExp}
   */
  function _compilePattern(pattern) {
    if (_patternCache.has(pattern)) return _patternCache.get(pattern);
    // Escape special regex chars, then replace glob wildcards
    const reStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex specials
      .replace(/\*\*/g, '\x00')               // placeholder for **
      .replace(/\*/g, '[^:]+')                // * = non-colon chars
      .replace(/\x00/g, '.+');                // ** = anything
    const re = new RegExp(`^${reStr}$`);
    _patternCache.set(pattern, re);
    return re;
  }

  /**
   * Test whether a subscriber `pattern` matches an emitted `event` name.
   * @param {string} pattern  — the subscription key (may contain wildcards)
   * @param {string} event    — the concrete emitted event name
   * @returns {boolean}
   */
  function _matches(pattern, event) {
    if (pattern === '*' || pattern === event) return true;
    // Fast path: 'ns:*' matches any 'ns:…'
    if (pattern.endsWith(':*') && !pattern.slice(0, -1).includes('*')) {
      return event.startsWith(pattern.slice(0, -1));
    }
    return _compilePattern(pattern).test(event);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to an event.
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {object}   [options]
   * @param {boolean}  [options.once=false]
   * @param {number}   [options.priority=0]
   * @param {boolean}  [options.prepend=false]
   * @param {string}   [options.tag='']
   * @param {string}   [options.id]      — caller-supplied stable ID
   * @returns {Function} unsubscribe
   */
  function on(rawEvent, handler, options) {
    if (typeof rawEvent !== 'string' || typeof handler !== 'function') {
      throw new TypeError('[MajixEvents] on() requires (string, function)');
    }
    const event = _qualify(rawEvent);
    const opts  = Object.assign({ once: false, priority: 0, prepend: false, tag: '', id: null }, options);
    const id    = opts.id !== null ? opts.id : ++_idSeq;

    const entry = {
      handler,
      once:     !!opts.once,
      priority: Number(opts.priority) || 0,
      id,
      pattern:  event,
      tag:      opts.tag || '',
    };

    if (!_listeners.has(event)) _listeners.set(event, []);
    const list = _listeners.get(event);

    // Warn if exceeding max-listeners threshold
    if (list.length >= _cfg.maxListeners) {
      _warn(`Possible memory leak — ${list.length + 1} subscribers on "${event}"`);
    }

    if (opts.prepend) {
      list.unshift(entry);
    } else {
      list.push(entry);
    }

    // Keep descending priority order; ties broken by insertion order (id)
    list.sort((a, b) => b.priority - a.priority || a.id - b.id);

    _log('on', event, { id, priority: entry.priority, once: entry.once });

    return function unsubscribe() { _removeEntry(entry); };
  }

  /**
   * Subscribe once (auto-unsubscribe after first invocation).
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function once(rawEvent, handler, options) {
    return on(rawEvent, handler, Object.assign({}, options, { once: true }));
  }

  /**
   * Remove a subscription by event name + handler reference.
   * @param {string}   rawEvent
   * @param {Function} handler
   */
  function off(rawEvent, handler) {
    const event = _qualify(rawEvent);
    if (!_listeners.has(event)) return;
    const list = _listeners.get(event).filter(e => e.handler !== handler);
    if (list.length === 0) {
      _listeners.delete(event);
    } else {
      _listeners.set(event, list);
    }
  }

  /**
   * Remove a subscription by its numeric or string ID.
   * @param {number|string} subId
   */
  function offById(subId) {
    for (const [event, list] of _listeners.entries()) {
      const filtered = list.filter(e => e.id !== subId);
      if (filtered.length !== list.length) {
        if (filtered.length === 0) _listeners.delete(event);
        else _listeners.set(event, filtered);
        return;
      }
    }
  }

  /**
   * Remove all subscriptions that share the given tag label.
   * @param {string} tag
   */
  function offByTag(tag) {
    for (const [event, list] of _listeners.entries()) {
      const filtered = list.filter(e => e.tag !== tag);
      if (filtered.length === 0) _listeners.delete(event);
      else _listeners.set(event, filtered);
    }
  }

  /**
   * Remove all subscriptions for a specific event, or every subscription.
   * @param {string} [rawEvent]
   */
  function offAll(rawEvent) {
    if (rawEvent === undefined) {
      _listeners.clear();
      return;
    }
    const event = _qualify(rawEvent);
    _listeners.delete(event);
  }

  /**
   * Internal helper: remove a specific entry object from its pattern list.
   * @param {object} entry
   */
  function _removeEntry(entry) {
    const list = _listeners.get(entry.pattern);
    if (!list) return;
    const idx = list.indexOf(entry);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) _listeners.delete(entry.pattern);
  }

  /**
   * Return the number of active subscriptions.
   * @param {string} [rawEvent] — if given, count only subscriptions for that event
   * @returns {number}
   */
  function count(rawEvent) {
    if (rawEvent === undefined) {
      let total = 0;
      for (const list of _listeners.values()) total += list.length;
      return total;
    }
    const event = _qualify(rawEvent);
    return (_listeners.get(event) || []).length;
  }

  /**
   * Return an array of all event names that currently have subscribers.
   * @returns {string[]}
   */
  function listEvents() {
    return Array.from(_listeners.keys()).filter(k => (_listeners.get(k) || []).length > 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MIDDLEWARE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register a middleware function.
   * Signature: (event: string, payload: *, next: (payload) => void) => void | Promise
   * @param {Function} mw
   */
  function use(mw) {
    if (typeof mw !== 'function') {
      throw new TypeError('[MajixEvents] use() requires a function');
    }
    _middleware.push(mw);
    _log('middleware added, total:', _middleware.length);
  }

  /**
   * Remove a previously registered middleware.
   * @param {Function} mw
   */
  function unuse(mw) {
    const idx = _middleware.indexOf(mw);
    if (idx !== -1) _middleware.splice(idx, 1);
  }

  /**
   * Remove all middleware.
   */
  function clearMiddleware() {
    _middleware.length = 0;
  }

  /**
   * Run event+payload through the middleware chain.
   * Returns a Promise that resolves with the final (possibly transformed) payload.
   * If any middleware does not call next(), the chain stalls and we resolve with
   * the last payload passed into next().
   * @param {string} event
   * @param {*}      payload
   * @returns {Promise<*>}
   */
  function _applyMiddleware(event, payload) {
    return new Promise((resolve, reject) => {
      let index = 0;
      function next(current) {
        if (index >= _middleware.length) { resolve(current); return; }
        const mw = _middleware[index++];
        try {
          const result = mw(event, current, next);
          if (result && typeof result.then === 'function') {
            result.then(v => { if (v !== undefined) next(v); else resolve(current); }).catch(reject);
          }
          // If the middleware is synchronous and did not return a Promise,
          // it is expected to have called next() itself.
        } catch (err) {
          reject(err);
        }
      }
      next(payload);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HISTORY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Append an entry to the in-memory history buffer.
   * @param {string} event
   * @param {*}      payload
   */
  function _recordHistory(event, payload) {
    const seq = ++_seqSeq;
    _history.push({ event, payload, ts: Date.now(), seq });
    if (_history.length > _cfg.historyLimit) {
      _history.splice(0, _history.length - _cfg.historyLimit);
    }
  }

  /**
   * Return a shallow copy of the history, optionally filtered by pattern.
   * @param {string} [filter]  — event pattern (supports wildcards)
   * @returns {HistoryEntry[]}
   */
  function history(filter) {
    if (!filter) return _history.slice();
    return _history.filter(h => _matches(filter, h.event));
  }

  /**
   * Return the most recent `limit` entries for a specific event.
   * @param {string} rawEvent
   * @param {number} [limit=10]
   * @returns {HistoryEntry[]}
   */
  function historyFor(rawEvent, limit) {
    const event = _qualify(rawEvent);
    const all   = _history.filter(h => _matches(event, h.event));
    return all.slice(-Math.max(1, limit || 10));
  }

  /**
   * Return all history entries emitted after a given timestamp.
   * @param {number} timestamp  — ms since epoch
   * @returns {HistoryEntry[]}
   */
  function historySince(timestamp) {
    return _history.filter(h => h.ts > timestamp);
  }

  /**
   * Return history entries emitted between two timestamps (inclusive).
   * @param {number} from
   * @param {number} to
   * @returns {HistoryEntry[]}
   */
  function historyBetween(from, to) {
    return _history.filter(h => h.ts >= from && h.ts <= to);
  }

  /**
   * Return all history entries with seq number >= seqNumber.
   * @param {number} seqNumber
   * @returns {HistoryEntry[]}
   */
  function historyFrom(seqNumber) {
    return _history.filter(h => h.seq >= seqNumber);
  }

  /**
   * Clear history entries, optionally scoped to an event pattern.
   * @param {string} [filter]
   */
  function clearHistory(filter) {
    if (!filter) { _history.length = 0; return; }
    for (let i = _history.length - 1; i >= 0; i--) {
      if (_matches(filter, _history[i].event)) _history.splice(i, 1);
    }
  }

  /**
   * Serialise the history (or a subset) to a JSON string.
   * @param {string} [filter]
   * @returns {string}
   */
  function exportHistory(filter) {
    return JSON.stringify(filter ? history(filter) : _history);
  }

  /**
   * Restore history from a JSON string.
   * @param {string}  jsonString
   * @param {boolean} [merge=false] — if true, merge; otherwise replace
   */
  function importHistory(jsonString, merge) {
    let entries;
    try { entries = JSON.parse(jsonString); } catch { return; }
    if (!Array.isArray(entries)) return;
    if (!merge) _history.length = 0;
    for (const e of entries) {
      if (e && typeof e.event === 'string') _history.push(e);
    }
    _history.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (_history.length > _cfg.historyLimit) {
      _history.splice(0, _history.length - _cfg.historyLimit);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE  ── localStorage
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Persist a single event emission to localStorage.
   * @param {string} event    — qualified event name
   * @param {*}      payload
   * @param {number} seq
   */
  function _persistToLocalStorage(event, payload, seq) {
    if (typeof localStorage === 'undefined') return;
    try {
      const key      = `${_cfg.persistKey}:${event}`;
      const existing = _lsGet(key);
      existing.push({ payload, ts: Date.now(), seq });
      if (existing.length > _cfg.persistLimit) {
        existing.splice(0, existing.length - _cfg.persistLimit);
      }
      localStorage.setItem(key, JSON.stringify(existing));
    } catch { /* quota exceeded or unavailable */ }
  }

  function _lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }

  /**
   * Load all persisted entries for an event from localStorage.
   * @param {string} rawEvent
   * @returns {Array<{payload:*, ts:number, seq:number}>}
   */
  function _loadPersisted(rawEvent) {
    if (typeof localStorage === 'undefined') return [];
    const key = `${_cfg.persistKey}:${_qualify(rawEvent)}`;
    return _lsGet(key);
  }

  /**
   * Clear all persisted entries for an event from localStorage.
   * If event is omitted, clears ALL MajixEvents keys.
   * @param {string} [rawEvent]
   */
  function clearPersisted(rawEvent) {
    if (typeof localStorage === 'undefined') return;
    if (rawEvent) {
      const key = `${_cfg.persistKey}:${_qualify(rawEvent)}`;
      localStorage.removeItem(key);
      return;
    }
    const prefix = `${_cfg.persistKey}:`;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE  ── IndexedDB
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Open (or return cached) the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  function _openIdb() {
    if (_idb) return Promise.resolve(_idb);
    if (_idbOpenPromise) return _idbOpenPromise;
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));

    _idbOpenPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(_cfg.idbName, 1);
      req.onupgradeneeded = (ev) => {
        const db    = ev.target.result;
        const store = db.createObjectStore(_cfg.idbStore, { keyPath: 'id', autoIncrement: true });
        store.createIndex('event', 'event', { unique: false });
        store.createIndex('ts',    'ts',    { unique: false });
      };
      req.onsuccess = (ev) => {
        _idb = ev.target.result;
        _idbOpenPromise = null;
        resolve(_idb);
      };
      req.onerror = (ev) => {
        _idbOpenPromise = null;
        reject(ev.target.error);
      };
    });
    return _idbOpenPromise;
  }

  /**
   * Write an event to IndexedDB (fire-and-forget; errors are logged).
   * @param {string} event
   * @param {*}      payload
   * @param {number} ts
   * @param {number} seq
   */
  function _persistToIdb(event, payload, ts, seq) {
    _openIdb().then(db => {
      const tx    = db.transaction(_cfg.idbStore, 'readwrite');
      const store = tx.objectStore(_cfg.idbStore);
      store.add({ event, payload, ts, seq });
    }).catch(err => _error('IDB write error:', err));
  }

  /**
   * Query IndexedDB for stored events.
   * @param {object} [opts]
   * @param {string} [opts.event]  — exact event name (no wildcards)
   * @param {number} [opts.from]   — minimum ts
   * @param {number} [opts.to]     — maximum ts
   * @param {number} [opts.limit]  — max records returned
   * @param {number} [opts.offset] — skip first N matching records
   * @returns {Promise<Array>}
   */
  function queryIdb(opts) {
    opts = opts || {};
    return _openIdb().then(db => new Promise((resolve, reject) => {
      const tx     = db.transaction(_cfg.idbStore, 'readonly');
      const store  = tx.objectStore(_cfg.idbStore);
      const index  = opts.event ? store.index('event') : store.index('ts');
      const range  = opts.event
        ? IDBKeyRange.only(opts.event)
        : (opts.from || opts.to)
          ? IDBKeyRange.bound(opts.from || 0, opts.to || Infinity)
          : null;
      const req    = index.openCursor(range);
      const result = [];
      let skipped  = 0;
      const limit  = opts.limit  || Infinity;
      const offset = opts.offset || 0;

      req.onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (!cursor || result.length >= limit) { resolve(result); return; }
        if (skipped < offset) { skipped++; cursor.continue(); return; }
        result.push(cursor.value);
        cursor.continue();
      };
      req.onerror = (ev) => reject(ev.target.error);
    }));
  }

  /**
   * Delete records from IndexedDB.
   * @param {string} [rawEvent] — if omitted, clears everything
   * @returns {Promise<void>}
   */
  function clearIdb(rawEvent) {
    return _openIdb().then(db => new Promise((resolve, reject) => {
      const tx    = db.transaction(_cfg.idbStore, 'readwrite');
      const store = tx.objectStore(_cfg.idbStore);
      if (!rawEvent) {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror   = (ev) => reject(ev.target.error);
        return;
      }
      const event = _qualify(rawEvent);
      const index = store.index('event');
      const req   = index.openCursor(IDBKeyRange.only(event));
      req.onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (!cursor) { resolve(); return; }
        cursor.delete();
        cursor.continue();
      };
      req.onerror = (ev) => reject(ev.target.error);
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DEDUPLICATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Check whether an emission is a duplicate within its dedup window.
   * @param {string} event
   * @param {*}      payload
   * @param {number} windowMs
   * @returns {boolean}  true if this is a duplicate (should be suppressed)
   */
  function _isDupe(event, payload, windowMs) {
    let serialised;
    try { serialised = JSON.stringify(payload); } catch { serialised = String(payload); }
    const key  = `${event}|${serialised}`;
    const now  = Date.now();
    const last = _dedupeMap.get(key);
    if (last !== undefined && (now - last) < windowMs) return true;
    _dedupeMap.set(key, now);
    // Evict stale entries periodically
    if (_dedupeMap.size > 2000) {
      for (const [k, t] of _dedupeMap.entries()) {
        if (now - t > windowMs * 10) _dedupeMap.delete(k);
      }
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCHEMA VALIDATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register a validation schema for an event.
   * @param {string} rawEvent
   * @param {object} schema
   */
  function defineSchema(rawEvent, schema) {
    if (typeof rawEvent !== 'string' || !schema || typeof schema !== 'object') {
      throw new TypeError('[MajixEvents] defineSchema(event, schema) requires (string, object)');
    }
    _schemas.set(_qualify(rawEvent), schema);
  }

  /**
   * Remove a registered schema.
   * @param {string} rawEvent
   */
  function removeSchema(rawEvent) {
    _schemas.delete(_qualify(rawEvent));
  }

  /**
   * Validate a payload against registered schema(s) for an event.
   * Wildcard schemas ('ns:*') are also applied.
   * @param {string} rawEvent
   * @param {*}      payload
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validate(rawEvent, payload) {
    const event  = _qualify(rawEvent);
    const errors = [];

    // Collect applicable schemas: exact match + any matching wildcard
    const applicable = [];
    for (const [pattern, schema] of _schemas.entries()) {
      if (_matches(pattern, event)) applicable.push(schema);
    }

    for (const schema of applicable) {
      for (const [field, rule] of Object.entries(schema)) {
        const value = payload != null ? payload[field] : undefined;
        _validateField(field, value, rule, payload, errors);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Internal: validate a single field against a rule.
   * @param {string} field
   * @param {*}      value
   * @param {*}      rule    — string type, Function, or descriptor object
   * @param {*}      payload — full payload (for cross-field validators)
   * @param {string[]} errors
   */
  function _validateField(field, value, rule, payload, errors) {
    if (typeof rule === 'string') {
      // Rule is a type string
      if (!_checkType(value, rule)) {
        errors.push(`Field "${field}" must be of type "${rule}" (got ${typeof value})`);
      }
      return;
    }

    if (typeof rule === 'function') {
      // Rule is a custom validator function
      const result = rule(value, payload);
      if (result === false) {
        errors.push(`Field "${field}" failed custom validation`);
      } else if (typeof result === 'string') {
        errors.push(result);
      }
      return;
    }

    if (typeof rule === 'object' && rule !== null) {
      // Rule is a descriptor
      const { type, required, min, max, pattern, enum: enumVals, validator } = rule;

      if (required && (value === undefined || value === null)) {
        errors.push(`Field "${field}" is required`);
        return;
      }
      if (value === undefined || value === null) return; // optional, absent — OK

      if (type && !_checkType(value, type)) {
        errors.push(`Field "${field}" must be of type "${type}" (got ${typeof value})`);
      }
      if (min !== undefined) {
        const len = typeof value === 'string' || Array.isArray(value) ? value.length : value;
        if (len < min) errors.push(`Field "${field}" minimum is ${min}`);
      }
      if (max !== undefined) {
        const len = typeof value === 'string' || Array.isArray(value) ? value.length : value;
        if (len > max) errors.push(`Field "${field}" maximum is ${max}`);
      }
      if (pattern && !(new RegExp(pattern).test(String(value)))) {
        errors.push(`Field "${field}" does not match pattern "${pattern}"`);
      }
      if (enumVals && !enumVals.includes(value)) {
        errors.push(`Field "${field}" must be one of: ${enumVals.join(', ')}`);
      }
      if (typeof validator === 'function') {
        const result = validator(value, payload);
        if (result === false) errors.push(`Field "${field}" failed custom validation`);
        else if (typeof result === 'string') errors.push(result);
      }
    }
  }

  /** @param {*} value @param {string} type @returns {boolean} */
  function _checkType(value, type) {
    if (type === 'array')  return Array.isArray(value);
    if (type === 'null')   return value === null;
    if (type === 'any')    return true;
    return typeof value === type;
  }

  /**
   * Set the schema validation mode.
   * @param {'warn'|'throw'|'drop'} mode
   */
  function setSchemaMode(mode) {
    if (!['warn', 'throw', 'drop'].includes(mode)) {
      throw new TypeError('[MajixEvents] setSchemaMode must be "warn", "throw", or "drop"');
    }
    _cfg.schemaMode = mode;
  }

  /**
   * Internal: run schema validation for an emission.
   * Returns false if the emission should be dropped.
   * @param {string} event
   * @param {*}      payload
   * @returns {boolean} — false = drop
   */
  function _runValidation(event, payload) {
    if (_schemas.size === 0) return true;
    const { valid, errors } = validate(event, payload);
    if (valid) return true;

    const msg = `[MajixEvents] Schema validation failed for "${event}":\n  ${errors.join('\n  ')}`;
    if (_cfg.schemaMode === 'throw') {
      const err = new Error(msg);
      err.name  = 'ValidationError';
      throw err;
    }
    if (_cfg.schemaMode === 'drop') {
      _warn(msg);
      return false;
    }
    _warn(msg);
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // METRICS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get or create a metrics record for an event.
   * @param {string} event
   * @returns {MetricsRecord}
   */
  function _getMetricsRecord(event) {
    if (!_metrics.has(event)) {
      _metrics.set(event, {
        event,
        emitCount:      0,
        handlerCount:   0,
        errorCount:     0,
        lastEmitAt:     null,
        avgHandlerMs:   0,
        totalHandlerMs: 0,
        peakHandlerMs:  0,
      });
    }
    return _metrics.get(event);
  }

  /**
   * Record timing data for handler invocations.
   * @param {string} event
   * @param {number} elapsedMs
   * @param {number} handlerCount
   * @param {number} errorCount
   */
  function _recordMetrics(event, elapsedMs, handlerCount, errorCount) {
    if (!_cfg.metrics) return;
    const rec = _getMetricsRecord(event);
    rec.emitCount++;
    rec.handlerCount    += handlerCount;
    rec.errorCount      += errorCount;
    rec.lastEmitAt       = Date.now();
    rec.totalHandlerMs  += elapsedMs;
    rec.avgHandlerMs     = rec.totalHandlerMs / rec.emitCount;
    if (elapsedMs > rec.peakHandlerMs) rec.peakHandlerMs = elapsedMs;
  }

  /**
   * Return a metrics snapshot for one event.
   * @param {string} [rawEvent]
   * @returns {MetricsRecord|null}
   */
  function metrics(rawEvent) {
    if (!rawEvent) return null;
    const event = _qualify(rawEvent);
    return Object.assign({}, _getMetricsRecord(event));
  }

  /**
   * Return metrics snapshots for all tracked events.
   * @returns {MetricsRecord[]}
   */
  function metricsAll() {
    return Array.from(_metrics.values()).map(r => Object.assign({}, r));
  }

  /**
   * Reset metrics counters.
   * @param {string} [rawEvent] — if omitted, resets everything
   */
  function resetMetrics(rawEvent) {
    if (rawEvent) {
      _metrics.delete(_qualify(rawEvent));
    } else {
      _metrics.clear();
    }
  }

  /**
   * Enable or disable metrics collection globally.
   * @param {boolean} flag
   */
  function enableMetrics(flag) {
    _cfg.metrics = !!flag;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CORE DISPATCH
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Collect all subscriber entries whose pattern matches the emitted event.
   * @param {string} event
   * @returns {SubscriberEntry[]}
   */
  function _collectHandlers(event) {
    const result = [];
    for (const [pattern, entries] of _listeners.entries()) {
      if (_matches(pattern, event)) result.push(...entries);
    }
    // Sort by priority (desc), then by insertion order (asc by id)
    result.sort((a, b) => b.priority - a.priority || a.id - b.id);
    return result;
  }

  /**
   * Synchronously invoke matched handlers; prune once-entries.
   * @param {string} event
   * @param {*}      payload
   * @returns {{ results: Array, errorCount: number, elapsed: number }}
   */
  function _invokeHandlers(event, payload) {
    const matched    = _collectHandlers(event);
    const results    = [];
    let   errorCount = 0;
    const t0         = _cfg.metrics ? Date.now() : 0;

    for (const entry of matched) {
      if (entry.once) {
        const list = _listeners.get(entry.pattern);
        if (list) {
          const idx = list.indexOf(entry);
          if (idx !== -1) list.splice(idx, 1);
          if (list.length === 0) _listeners.delete(entry.pattern);
        }
      }
      try {
        results.push(entry.handler(payload, event));
      } catch (err) {
        errorCount++;
        _handleError(err, event, payload);
      }
    }

    if (_cfg.metrics) {
      _recordMetrics(event, Date.now() - t0, matched.length, errorCount);
    }

    return { results, errorCount, elapsed: _cfg.metrics ? Date.now() - t0 : 0 };
  }

  /**
   * Local-only dispatch (no middleware, no broadcast, no persist side-effects).
   * Used for replay and broadcast inbound.
   * @param {string} event
   * @param {*}      payload
   * @returns {Array}
   */
  function _dispatchLocal(event, payload) {
    _recordHistory(event, payload);
    return _invokeHandlers(event, payload).results;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH MODE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Execute fn() in batch mode — all emit() calls are queued and flushed
   * atomically after fn() returns.
   * @param {Function} fn  — synchronous function; may contain multiple emit()s
   * @returns {Promise<void>}
   */
  async function batch(fn) {
    _batchDepth++;
    try {
      fn();
    } finally {
      _batchDepth--;
    }
    if (_batchDepth === 0) {
      const queued = _batchQueue.splice(0);
      for (const item of queued) {
        await emit(item.rawEvent, item.payload, item.options);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC EMIT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Emit an event asynchronously.
   * @param {string} rawEvent
   * @param {*}      [payload]
   * @param {object} [options]
   * @param {boolean}[options.broadcast]
   * @param {boolean}[options.persist]
   * @param {boolean}[options.async]
   * @param {boolean}[options.idb]
   * @param {boolean}[options.dedupe]
   * @param {number} [options.dedupeWindow]
   * @returns {Promise<Array>}
   */
  async function emit(rawEvent, payload, options) {
    // Batch mode — queue instead of dispatching immediately
    if (_batchDepth > 0) {
      _batchQueue.push({ rawEvent, payload, options });
      return [];
    }

    const event = _qualify(rawEvent);
    const opts  = Object.assign({
      broadcast:   false,
      persist:     false,
      async:       false,
      idb:         false,
      dedupe:      false,
      dedupeWindow: 50,
    }, options);

    // Deduplication check
    if (opts.dedupe && _isDupe(event, payload, opts.dedupeWindow)) {
      _log('dedupe suppressed', event);
      return [];
    }

    // Schema validation
    if (!_runValidation(event, payload)) return [];

    // Middleware pipeline
    let finalPayload = payload;
    if (_middleware.length > 0) {
      try {
        finalPayload = await _applyMiddleware(event, payload);
      } catch (err) {
        _handleError(err, event, payload);
        return [];
      }
    }

    // Record history (before handlers so replay works inside handlers)
    _recordHistory(event, finalPayload);

    // Persist to localStorage
    const shouldPersistLs = opts.persist || _cfg.persist;
    if (shouldPersistLs) {
      const latestSeq = _history.length ? _history[_history.length - 1].seq : 0;
      _persistToLocalStorage(event, finalPayload, latestSeq);
    }

    // Persist to IndexedDB
    const shouldPersistIdb = opts.idb || _cfg.idb;
    if (shouldPersistIdb) {
      const latestSeq = _history.length ? _history[_history.length - 1].seq : 0;
      _persistToIdb(event, finalPayload, Date.now(), latestSeq);
    }

    // Cross-tab broadcast
    if (opts.broadcast) _broadcastEmit(event, finalPayload);

    _log('emit', event, finalPayload);

    // Async dispatch (defer to next microtask)
    if (opts.async) {
      return new Promise(resolve => {
        setTimeout(() => resolve(_invokeHandlers(event, finalPayload).results), 0);
      });
    }

    return _invokeHandlers(event, finalPayload).results;
  }

  /**
   * Synchronous emit — no middleware, no async side-effects.
   * @param {string} rawEvent
   * @param {*}      [payload]
   * @param {object} [options]
   * @returns {Array}
   */
  function emitSync(rawEvent, payload, options) {
    const event = _qualify(rawEvent);

    if (options && options.dedupe && _isDupe(event, payload, options.dedupeWindow || 50)) {
      return [];
    }

    if (!_runValidation(event, payload)) return [];

    _recordHistory(event, payload);

    if ((options && options.persist) || _cfg.persist) {
      const latestSeq = _history.length ? _history[_history.length - 1].seq : 0;
      _persistToLocalStorage(event, payload, latestSeq);
    }

    if (options && options.broadcast) _broadcastEmit(event, payload);

    return _invokeHandlers(event, payload).results;
  }

  /**
   * Emit an array of [event, payload] pairs sequentially.
   * @param {Array<[string, *]>} pairs
   * @returns {Promise<Array>}
   */
  async function emitMany(pairs) {
    const all = [];
    for (const [ev, pl] of pairs) {
      const results = await emit(ev, pl);
      all.push(...results);
    }
    return all;
  }

  /**
   * Emit an array of [event, payload] pairs in parallel.
   * @param {Array<[string, *]>} pairs
   * @returns {Promise<Array[]>}
   */
  function emitParallel(pairs) {
    return Promise.all(pairs.map(([ev, pl]) => emit(ev, pl)));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REPLAY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Replay history entries matching an event pattern through a handler
   * (or current subscribers if handler is omitted).
   * @param {string}   rawEvent
   * @param {Function} [handler]
   * @param {object}   [options]
   * @param {boolean}  [options.includePersisted=true]
   * @param {number}   [options.from]
   * @param {number}   [options.to]
   * @param {number}   [options.limit]
   */
  function replay(rawEvent, handler, options) {
    const event = _qualify(rawEvent);
    const opts  = Object.assign({ includePersisted: true }, options);
    let   entries = history(event);

    // Merge persisted entries not yet in memory
    if (opts.includePersisted && _cfg.persist) {
      const persisted = _loadPersisted(rawEvent);
      for (const p of persisted) {
        if (!entries.find(e => e.ts === p.ts)) {
          entries.push({ event, payload: p.payload, ts: p.ts, seq: p.seq || 0 });
        }
      }
      entries.sort((a, b) => a.ts - b.ts);
    }

    if (opts.from !== undefined) entries = entries.filter(e => e.ts >= opts.from);
    if (opts.to   !== undefined) entries = entries.filter(e => e.ts <= opts.to);
    if (opts.limit !== undefined) entries = entries.slice(-opts.limit);

    for (const entry of entries) {
      if (handler) {
        try { handler(entry.payload, entry.event); } catch (err) {
          _handleError(err, entry.event, entry.payload);
        }
      } else {
        _invokeHandlers(entry.event, entry.payload);
      }
    }
  }

  /**
   * Replay the entire history through handler or current subscribers.
   * @param {Function} [handler]
   */
  function replayAll(handler) {
    const entries = _history.slice();
    for (const entry of entries) {
      if (handler) {
        try { handler(entry.payload, entry.event); } catch (err) {
          _handleError(err, entry.event, entry.payload);
        }
      } else {
        _invokeHandlers(entry.event, entry.payload);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TIMING HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe with automatic debouncing.
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {number}   wait       — milliseconds
   * @param {object}   [options]
   * @returns {{ unsubscribe: Function, cancel: Function, flush: Function }}
   */
  function debounce(rawEvent, handler, wait, options) {
    let timer       = null;
    let lastPayload = undefined;
    let lastEvent   = undefined;

    function debounced(payload, event) {
      lastPayload = payload;
      lastEvent   = event;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        handler(lastPayload, lastEvent);
      }, wait);
    }

    const unsub = on(rawEvent, debounced, options);

    function cancel() {
      clearTimeout(timer);
      timer = null;
    }

    function flush() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        handler(lastPayload, lastEvent);
      }
    }

    return { unsubscribe: unsub, cancel, flush };
  }

  /**
   * Subscribe with automatic throttling (leading + optional trailing edge).
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {number}   wait       — milliseconds
   * @param {object}   [options]
   * @param {boolean}  [options.leading=true]
   * @param {boolean}  [options.trailing=true]
   * @returns {{ unsubscribe: Function, cancel: Function }}
   */
  function throttle(rawEvent, handler, wait, options) {
    const opts     = Object.assign({ leading: true, trailing: true }, options);
    let   last     = 0;
    let   timer    = null;
    let   pending  = null;

    function throttled(payload, event) {
      const now       = Date.now();
      const remaining = wait - (now - last);

      if (remaining <= 0 || remaining > wait) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        if (opts.leading) handler(payload, event);
        pending = null;
      } else {
        pending = { payload, event };
        if (!timer && opts.trailing) {
          timer = setTimeout(() => {
            last  = opts.leading ? Date.now() : 0;
            timer = null;
            if (pending) { handler(pending.payload, pending.event); pending = null; }
          }, remaining);
        }
      }
    }

    const unsub = on(rawEvent, throttled, options);

    function cancel() {
      clearTimeout(timer);
      timer   = null;
      pending = null;
    }

    return { unsubscribe: unsub, cancel };
  }

  /**
   * Subscribe and invoke handler `ms` milliseconds after each emission.
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {number}   ms
   * @param {object}   [options]
   * @returns {{ unsubscribe: Function, cancel: Function }}
   */
  function delay(rawEvent, handler, ms, options) {
    const timers = new Set();

    function delayed(payload, event) {
      const t = setTimeout(() => {
        timers.delete(t);
        handler(payload, event);
      }, ms);
      timers.add(t);
    }

    const unsub = on(rawEvent, delayed, options);

    function cancel() {
      for (const t of timers) clearTimeout(t);
      timers.clear();
    }

    return { unsubscribe: unsub, cancel };
  }

  /**
   * Sample: invoke handler at most once per interval with the latest payload.
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {number}   interval   — milliseconds
   * @param {object}   [options]
   * @returns {{ unsubscribe: Function, cancel: Function }}
   */
  function sample(rawEvent, handler, interval, options) {
    let latest  = undefined;
    let hasNew  = false;
    let timer   = null;

    function sampled(payload) {
      latest = payload;
      hasNew = true;
      if (!timer) {
        timer = setInterval(() => {
          if (hasNew) {
            handler(latest, rawEvent);
            hasNew = false;
          }
        }, interval);
      }
    }

    const unsub = on(rawEvent, sampled, options);

    function cancel() {
      clearInterval(timer);
      timer  = null;
      hasNew = false;
    }

    return { unsubscribe: unsub, cancel };
  }

  /**
   * Audit: always fires at end of window regardless of exact timing.
   * Similar to throttle trailing but strictly window-based.
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {number}   durationMs
   * @param {object}   [options]
   * @returns {{ unsubscribe: Function, cancel: Function }}
   */
  function audit(rawEvent, handler, durationMs, options) {
    let latest  = undefined;
    let latestE = undefined;
    let timer   = null;

    function audited(payload, event) {
      latest  = payload;
      latestE = event;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          handler(latest, latestE);
        }, durationMs);
      }
    }

    const unsub = on(rawEvent, audited, options);

    function cancel() {
      clearTimeout(timer);
      timer = null;
    }

    return { unsubscribe: unsub, cancel };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PIPE / FILTER / MAP / TAP
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Forward every sourceEvent as targetEvent, optionally transforming payload.
   * @param {string}   sourceEvent
   * @param {string}   targetEvent
   * @param {Function} [transform]  — (payload) => newPayload
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function pipe(sourceEvent, targetEvent, transform, options) {
    return on(sourceEvent, (payload) => {
      const next = (typeof transform === 'function') ? transform(payload) : payload;
      emit(targetEvent, next);
    }, options);
  }

  /**
   * Subscribe with a predicate filter — handler is only called when
   * predicate(payload, event) returns truthy.
   * @param {string}   rawEvent
   * @param {Function} predicate
   * @param {Function} handler
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function filter(rawEvent, predicate, handler, options) {
    return on(rawEvent, (payload, event) => {
      if (predicate(payload, event)) handler(payload, event);
    }, options);
  }

  /**
   * Map: transform each emission and re-emit on targetEvent.
   * @param {string}   rawEvent
   * @param {Function} transform
   * @param {string}   targetEvent
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function map(rawEvent, transform, targetEvent, options) {
    return on(rawEvent, (payload) => {
      emit(targetEvent, transform(payload));
    }, options);
  }

  /**
   * Tap: subscribe for side effects without affecting the payload.
   * @param {string}   rawEvent
   * @param {Function} sideEffect
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function tap(rawEvent, sideEffect, options) {
    return on(rawEvent, (payload, event) => {
      try { sideEffect(payload, event); } catch (err) {
        _handleError(err, event, payload);
      }
    }, options);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BUFFER / WINDOW
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Collect `count` emissions of rawEvent then re-emit as '[event]:buffered'
   * with an array payload.
   * @param {string} rawEvent
   * @param {number} count
   * @param {object} [options]
   * @returns {Function} unsubscribe
   */
  function buffer(rawEvent, count, options) {
    const buf   = [];
    const event = _qualify(rawEvent);
    return on(rawEvent, (payload) => {
      buf.push(payload);
      if (buf.length >= count) {
        const chunk = buf.splice(0, count);
        emit(`${event}:buffered`, chunk);
      }
    }, options);
  }

  /**
   * Collect all emissions of rawEvent in a time window and re-emit as
   * '[event]:windowed' with an array payload.
   * @param {string} rawEvent
   * @param {number} durationMs
   * @param {object} [options]
   * @returns {Function} unsubscribe
   */
  function window(rawEvent, durationMs, options) {
    const event = _qualify(rawEvent);
    let   buf   = [];
    let   timer = null;

    function flush() {
      if (buf.length === 0) return;
      const chunk = buf.splice(0);
      emit(`${event}:windowed`, chunk);
    }

    const unsub = on(rawEvent, (payload) => {
      buf.push(payload);
      if (!timer) {
        timer = setTimeout(() => { timer = null; flush(); }, durationMs);
      }
    }, options);

    return unsub;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REQUEST / RESPONSE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Emit an event and wait for a single response.
   * The answering handler calls reply(responsePayload).
   * @param {string} rawEvent
   * @param {*}      [payload]
   * @param {number} [timeout=5000]   — ms before rejecting
   * @returns {Promise<*>}
   */
  function ask(rawEvent, payload, timeout) {
    const ms = timeout || 5000;
    return new Promise((resolve, reject) => {
      const replyChannel = `${_qualify(rawEvent)}:__reply__:${++_idSeq}`;
      let   timer        = null;

      const unsub = once(replyChannel, (response) => {
        clearTimeout(timer);
        resolve(response);
      });

      timer = setTimeout(() => {
        unsub();
        reject(new Error(`[MajixEvents] ask("${rawEvent}") timed out after ${ms}ms`));
      }, ms);

      emit(rawEvent, Object.assign({}, payload, { _replyChannel: replyChannel }));
    });
  }

  /**
   * Register a handler that responds to ask() calls.
   * @param {string}   rawEvent
   * @param {Function} handler  — (payload, reply) => void
   * @returns {Function} unsubscribe
   */
  function answer(rawEvent, handler) {
    return on(rawEvent, (payload, event) => {
      const replyChannel = payload && payload._replyChannel;
      function reply(response) {
        if (replyChannel) emit(replyChannel, response);
      }
      try {
        const result = handler(payload, reply);
        // Support async handlers that return a Promise
        if (result && typeof result.then === 'function') {
          result.then(r => { if (r !== undefined && replyChannel) emit(replyChannel, r); })
                .catch(err => _handleError(err, event, payload));
        }
      } catch (err) {
        _handleError(err, event, payload);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCOPED SUB-BUS (EventScope)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a scoped sub-bus.  All event names are prefixed with 'namespace:'.
   * @param {string} namespace
   * @returns {EventScope}
   */
  function scope(namespace) {
    if (typeof namespace !== 'string' || !namespace) {
      throw new TypeError('[MajixEvents] scope() requires a non-empty namespace string');
    }
    return new EventScope(namespace);
  }

  /**
   * Lightweight proxy that prefixes all event names with a namespace.
   */
  class EventScope {
    /**
     * @param {string} ns — namespace prefix
     */
    constructor(ns) {
      this._ns = ns;
    }

    /** @param {string} event @returns {string} */
    _q(event) {
      if (event === '*' || event.startsWith('*')) return event;
      return `${this._ns}:${event}`;
    }

    on(event, handler, options) {
      return MajixEvents.on(this._q(event), handler, options);
    }

    once(event, handler, options) {
      return MajixEvents.once(this._q(event), handler, options);
    }

    off(event, handler) {
      return MajixEvents.off(this._q(event), handler);
    }

    offAll(event) {
      return MajixEvents.offAll(event !== undefined ? this._q(event) : undefined);
    }

    emit(event, payload, options) {
      return MajixEvents.emit(this._q(event), payload, options);
    }

    emitSync(event, payload, options) {
      return MajixEvents.emitSync(this._q(event), payload, options);
    }

    debounce(event, handler, wait, options) {
      return MajixEvents.debounce(this._q(event), handler, wait, options);
    }

    throttle(event, handler, wait, options) {
      return MajixEvents.throttle(this._q(event), handler, wait, options);
    }

    delay(event, handler, ms, options) {
      return MajixEvents.delay(this._q(event), handler, ms, options);
    }

    pipe(sourceEvent, targetEvent, transform, options) {
      return MajixEvents.pipe(this._q(sourceEvent), this._q(targetEvent), transform, options);
    }

    filter(event, predicate, handler, options) {
      return MajixEvents.filter(this._q(event), predicate, handler, options);
    }

    map(event, transform, targetEvent, options) {
      return MajixEvents.map(this._q(event), transform, this._q(targetEvent), options);
    }

    tap(event, sideEffect, options) {
      return MajixEvents.tap(this._q(event), sideEffect, options);
    }

    replay(event, handler, options) {
      return MajixEvents.replay(this._q(event), handler, options);
    }

    history(filter) {
      return MajixEvents.history(filter ? this._q(filter) : `${this._ns}:*`);
    }

    ask(event, payload, timeout) {
      return MajixEvents.ask(this._q(event), payload, timeout);
    }

    answer(event, handler) {
      return MajixEvents.answer(this._q(event), handler);
    }

    batch(fn) {
      return MajixEvents.batch(fn);
    }

    scope(childNs) {
      return MajixEvents.scope(`${this._ns}:${childNs}`);
    }

    destroy() {
      MajixEvents.offAll(this._q('*'));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMBINATORS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Re-emit any of the source events on targetEvent.
   * @param {string[]} events
   * @param {string}   targetEvent
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function merge(events, targetEvent, options) {
    if (!Array.isArray(events)) throw new TypeError('[MajixEvents] merge() expects an array of event names');
    const unsubs = events.map(ev =>
      on(ev, (payload) => emit(targetEvent, payload), options)
    );
    return function unsubscribe() { unsubs.forEach(u => u()); };
  }

  /**
   * Wait for one emission from each source event, then emit targetEvent with
   * an array of payloads (in source order).  Repeats when all sources fire again.
   * @param {string[]} events
   * @param {string}   targetEvent
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function zip(events, targetEvent, options) {
    if (!Array.isArray(events)) throw new TypeError('[MajixEvents] zip() expects an array of event names');

    // Each source has its own queue of received payloads
    /** @type {Array<Array<*>>} */
    const queues = events.map(() => []);

    const unsubs = events.map((ev, i) =>
      on(ev, (payload) => {
        queues[i].push(payload);
        // If every queue has at least one entry, dequeue and emit
        if (queues.every(q => q.length > 0)) {
          const combo = queues.map(q => q.shift());
          emit(targetEvent, combo);
        }
      }, options)
    );

    return function unsubscribe() { unsubs.forEach(u => u()); };
  }

  /**
   * Emit targetEvent with the first payload to arrive from any source event.
   * Unsubscribes from all sources after first emission.
   * @param {string[]} events
   * @param {string}   targetEvent
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function race(events, targetEvent, options) {
    if (!Array.isArray(events)) throw new TypeError('[MajixEvents] race() expects an array of event names');
    let done = false;
    const unsubs = [];

    for (const ev of events) {
      const unsub = on(ev, (payload) => {
        if (done) return;
        done = true;
        unsubs.forEach(u => u());
        emit(targetEvent, payload);
      }, options);
      unsubs.push(unsub);
    }

    return function unsubscribe() { if (!done) { done = true; unsubs.forEach(u => u()); } };
  }

  /**
   * Emit targetEvent with an array of the latest values whenever any source
   * emits (once all sources have emitted at least once).
   * @param {string[]} events
   * @param {string}   targetEvent
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function combineLatest(events, targetEvent, options) {
    if (!Array.isArray(events)) throw new TypeError('[MajixEvents] combineLatest() expects an array of event names');

    const sentinel = Symbol('uninitialised');
    const latest   = events.map(() => sentinel);

    const unsubs = events.map((ev, i) =>
      on(ev, (payload) => {
        latest[i] = payload;
        if (latest.every(v => v !== sentinel)) {
          emit(targetEvent, latest.slice());
        }
      }, options)
    );

    return function unsubscribe() { unsubs.forEach(u => u()); };
  }

  /**
   * Multi-step workflow: subscribe to each step's event in sequence.
   * Each handler receives the payload of that step's event.
   * @param {Array<{event:string, handler:Function}>} steps
   * @returns {Promise<void>}
   */
  function sequence(steps) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(steps) || steps.length === 0) { resolve(); return; }
      let stepIndex = 0;

      function runStep() {
        if (stepIndex >= steps.length) { resolve(); return; }
        const { event, handler } = steps[stepIndex++];
        once(event, async (payload) => {
          try {
            await handler(payload);
            runStep();
          } catch (err) {
            reject(err);
          }
        });
      }

      runStep();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EVENT QUEUE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Create a named, durable event queue.
   * @param {string} name
   * @param {object} [options]
   * @param {'fifo'|'lifo'|'priority'} [options.mode='fifo']
   * @param {number} [options.maxSize=Infinity]
   * @param {number} [options.concurrency=1]
   * @returns {EventQueue}
   */
  function createQueue(name, options) {
    if (_queues.has(name)) return _queues.get(name);
    const q = new EventQueue(name, options);
    _queues.set(name, q);
    return q;
  }

  /**
   * Internal event queue implementation.
   */
  class EventQueue {
    /**
     * @param {string} name
     * @param {object} [opts]
     */
    constructor(name, opts) {
      this.name        = name;
      this._opts       = Object.assign({ mode: 'fifo', maxSize: Infinity, concurrency: 1 }, opts);
      /** @type {Array<{event:string, payload:*, priority:number}>} */
      this._queue      = [];
      this._paused     = false;
      this._running    = 0;
      this._drainCbs   = [];
    }

    /** Number of items currently in the queue. */
    get size() { return this._queue.length; }

    /**
     * Add an item to the queue.
     * @param {string} event
     * @param {*}      payload
     * @param {number} [priority=0]  — used only in 'priority' mode
     */
    enqueue(event, payload, priority) {
      if (this._queue.length >= this._opts.maxSize) {
        _warn(`Queue "${this.name}" is full (maxSize=${this._opts.maxSize}); dropping item`);
        return;
      }
      this._queue.push({ event, payload, priority: priority || 0 });
      if (this._opts.mode === 'priority') {
        this._queue.sort((a, b) => b.priority - a.priority);
      }
      this._tick();
    }

    /** Pause processing (items still enqueue). */
    pause() { this._paused = true; }

    /** Resume processing. */
    resume() { this._paused = false; this._tick(); }

    /** Discard all queued items. */
    clear() { this._queue.length = 0; }

    /**
     * Force-flush all queued items immediately (bypasses concurrency/pause).
     * @returns {Promise<void>}
     */
    async flush() {
      const items = this._queue.splice(0);
      for (const item of items) {
        await emit(item.event, item.payload);
      }
      this._notifyDrain();
    }

    /**
     * Return a Promise that resolves when the queue drains to zero.
     * @returns {Promise<void>}
     */
    drain() {
      if (this._queue.length === 0 && this._running === 0) return Promise.resolve();
      return new Promise(resolve => this._drainCbs.push(resolve));
    }

    _tick() {
      if (this._paused) return;
      while (this._running < this._opts.concurrency && this._queue.length > 0) {
        const item = this._opts.mode === 'lifo' ? this._queue.pop() : this._queue.shift();
        this._running++;
        emit(item.event, item.payload).then(() => {
          this._running--;
          this._tick();
          if (this._queue.length === 0 && this._running === 0) this._notifyDrain();
        }).catch(err => {
          this._running--;
          _handleError(err, item.event, item.payload);
          this._tick();
        });
      }
    }

    _notifyDrain() {
      const cbs = this._drainCbs.splice(0);
      cbs.forEach(cb => cb());
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DEDUPLICATION (per-event guard)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Suppress duplicate emissions of rawEvent within windowMs.
   * @param {string}   rawEvent
   * @param {Function} [keyFn]     — (payload) → string   default: JSON.stringify
   * @param {number}   [windowMs=0] — 0 = always dedupe; >0 = dedupe within window
   * @returns {Function} unsubscribe (removes the dedup guard)
   */
  function dedupeOn(rawEvent, keyFn, windowMs) {
    const event    = _qualify(rawEvent);
    const win      = windowMs !== undefined ? windowMs : 0;
    const getKey   = typeof keyFn === 'function' ? keyFn : (p) => {
      try { return JSON.stringify(p); } catch { return String(p); }
    };
    const seen     = new Map();   // key → last-seen ts

    // Prepend a high-priority handler that cancels propagation if duplicate
    // We implement "drop" by checking in a middleware-style interception:
    // the cleanest way is to install a high-priority subscriber that throws
    // a sentinel to abort subsequent handlers — but that would pollute the
    // error log.  Instead we use the _dedupeMap shared store:
    const unsub = on(rawEvent, (payload) => {
      const key = getKey(payload);
      const now = Date.now();
      const prev = seen.get(key);
      if (prev !== undefined && (win === 0 || now - prev < win)) {
        // Duplicate — do nothing in this handler
      } else {
        seen.set(key, now);
      }
    }, { priority: 99999 });

    return unsub;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONDITIONAL ROUTER
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build a conditional event router.
   * @param {object} routeMap
   *   { 'source-event': [ { when(payload)→bool, target: 'target-event', transform? }, … ] }
   * @returns {{ start: Function, stop: Function }}
   */
  function createRouter(routeMap) {
    const unsubs = [];

    function start() {
      for (const [sourceEvent, routes] of Object.entries(routeMap)) {
        const unsub = on(sourceEvent, (payload) => {
          for (const route of routes) {
            if (!route.when || route.when(payload)) {
              const next = typeof route.transform === 'function'
                ? route.transform(payload)
                : payload;
              emit(route.target, next);
              if (route.exclusive) break;  // stop after first match
            }
          }
        });
        unsubs.push(unsub);
      }
    }

    function stop() {
      unsubs.forEach(u => u());
      unsubs.length = 0;
    }

    return { start, stop };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SNAPSHOT / RESTORE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Serialise current history + config to a JSON string.
   * @returns {string}
   */
  function snapshot() {
    return JSON.stringify({
      version: VERSION,
      ts:      Date.now(),
      config:  _cfg,
      history: _history,
    });
  }

  /**
   * Restore from a snapshot string.
   * Replaces current history and merges stored config.
   * @param {string} snapshotString
   */
  function restore(snapshotString) {
    let data;
    try { data = JSON.parse(snapshotString); } catch { return; }
    if (!data || typeof data !== 'object') return;
    if (data.config) configure(data.config);
    if (Array.isArray(data.history)) {
      _history.length = 0;
      for (const e of data.history) {
        if (e && typeof e.event === 'string') _history.push(e);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WORKER BRIDGE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Bridge MajixEvents to a Worker or SharedWorker.
   * Events emitted in this context are forwarded to the Worker, and vice versa.
   * @param {Worker|MessagePort} worker
   * @param {object}  [options]
   * @param {string[]} [options.events]  — whitelist of event names to forward (default: all)
   * @returns {{ disconnect: Function }}
   */
  function connectWorker(worker, options) {
    const opts         = options || {};
    const allowedSet   = opts.events ? new Set(opts.events) : null;
    const port         = worker.port || worker;   // handle SharedWorker

    function onWorkerMessage(ev) {
      const data = ev.data || {};
      if (!data._majixWorkerEvent) return;
      _dispatchLocal(data.event, data.payload);
    }

    port.addEventListener('message', onWorkerMessage);
    if (typeof port.start === 'function') port.start();

    // Forward local emissions to the worker
    const unsub = on('*', (payload, event) => {
      if (allowedSet && !allowedSet.has(event)) return;
      try {
        port.postMessage({ _majixWorkerEvent: true, event, payload });
      } catch { /* structured clone may fail */ }
    });

    function disconnect() {
      unsub();
      port.removeEventListener('message', onWorkerMessage);
    }

    return { disconnect };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PLUGIN SYSTEM
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Register a plugin.
   * @param {{ name: string, install: Function }} pluginObj
   * @returns {object} MajixEvents (for chaining)
   */
  function plugin(pluginObj) {
    if (!pluginObj || typeof pluginObj.name !== 'string' || typeof pluginObj.install !== 'function') {
      throw new TypeError('[MajixEvents] plugin() requires { name: string, install: Function }');
    }
    if (_plugins.has(pluginObj.name)) {
      _warn(`Plugin "${pluginObj.name}" is already installed`);
      return MajixEvents;
    }
    _plugins.set(pluginObj.name, pluginObj);
    pluginObj.install(MajixEvents);
    _log('plugin installed:', pluginObj.name);
    return MajixEvents;
  }

  /**
   * Check whether a plugin is installed.
   * @param {string} name
   * @returns {boolean}
   */
  function hasPlugin(name) {
    return _plugins.has(name);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DESTROY / INIT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Tear down everything: listeners, middleware, channel, queues, history.
   */
  function destroy() {
    _listeners.clear();
    _middleware.length = 0;
    _history.length    = 0;
    _batchQueue.length = 0;
    _batchDepth        = 0;
    _dedupeMap.clear();
    _patternCache.clear();
    _metrics.clear();
    _schemas.clear();
    _plugins.clear();
    _queues.forEach(q => q.clear());
    _queues.clear();
    if (_channel) {
      try { _channel.close(); } catch { /* ignore */ }
      _channel = null;
    }
    if (_idb) {
      try { _idb.close(); } catch { /* ignore */ }
      _idb = null;
    }
    _log('destroyed');
  }

  /**
   * Initialise the event bus.
   * @param {object} [config]
   */
  function init(config) {
    if (config) configure(config);
    else _applyWindowConfig();
    _initChannel();
    _log('initialised, version', VERSION);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BUILT-IN PLUGINS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Logger plugin — logs every event to the console.
   * Enable with: MajixEvents.plugin(MajixEvents.plugins.logger)
   */
  const _loggerPlugin = {
    name: 'logger',
    install(bus) {
      bus.use((event, payload, next) => {
        console.log(`[MajixEvents:logger] ${event}`, payload);
        next(payload);
      });
    },
  };

  /**
   * Timestamp plugin — adds a _ts field to every emitted payload object.
   * Enable with: MajixEvents.plugin(MajixEvents.plugins.timestamp)
   */
  const _timestampPlugin = {
    name: 'timestamp',
    install(bus) {
      bus.use((event, payload, next) => {
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          next(Object.assign({ _ts: Date.now() }, payload));
        } else {
          next(payload);
        }
      });
    },
  };

  /**
   * Immutable plugin — deep-freezes every payload before delivery.
   * Enable with: MajixEvents.plugin(MajixEvents.plugins.immutable)
   */
  const _immutablePlugin = {
    name: 'immutable',
    install(bus) {
      function deepFreeze(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        Object.getOwnPropertyNames(obj).forEach(name => deepFreeze(obj[name]));
        return Object.freeze(obj);
      }
      bus.use((event, payload, next) => {
        try { next(deepFreeze(payload)); } catch { next(payload); }
      });
    },
  };

  /**
   * Retry plugin — automatically retry failed handler executions.
   * Enable with: MajixEvents.plugin(MajixEvents.plugins.retry({ maxAttempts: 3, delay: 100 }))
   */
  function _retryPlugin(opts) {
    const maxAttempts = (opts && opts.maxAttempts) || 3;
    const retryDelay  = (opts && opts.delay)        || 100;
    return {
      name: 'retry',
      install(bus) {
        const origHandler = bus._invokeHandlersForRetry;
        void origHandler; // suppress lint
        // Wrap global errorHandler to schedule a retry
        const prevErrorHandler = _cfg.errorHandler;
        _cfg.errorHandler = function retryErrorHandler(err, event, payload) {
          const key    = `${event}|${Date.now()}`;
          const tries  = (retryErrorHandler._attempts = retryErrorHandler._attempts || new Map());
          const count  = (tries.get(key) || 0) + 1;
          if (count < maxAttempts) {
            tries.set(key, count);
            setTimeout(() => {
              tries.delete(key);
              bus.emit(event, payload).catch(() => {});
            }, retryDelay * count);
          } else {
            tries.delete(key);
            if (typeof prevErrorHandler === 'function') prevErrorHandler(err, event, payload);
            else console.error('[MajixEvents:retry] Exhausted retries for', event, err);
          }
        };
      },
    };
  }

  /**
   * Circuit-breaker plugin — stops forwarding events to handlers after a
   * configurable number of consecutive errors.
   * Enable with: MajixEvents.plugin(MajixEvents.plugins.circuitBreaker({ threshold: 5, resetMs: 30000 }))
   */
  function _circuitBreakerPlugin(opts) {
    const threshold = (opts && opts.threshold) || 5;
    const resetMs   = (opts && opts.resetMs)   || 30000;
    return {
      name: 'circuitBreaker',
      install(bus) {
        const errorCounts = new Map();   // event → { count, openedAt }

        bus.use((event, payload, next) => {
          const state = errorCounts.get(event);
          if (state && state.count >= threshold) {
            if (Date.now() - state.openedAt < resetMs) {
              _warn(`[circuit-breaker] Circuit OPEN for "${event}", dropping event`);
              return;  // drop event
            }
            // Reset after timeout
            errorCounts.delete(event);
          }
          next(payload);
        });

        const prevErrorHandler = _cfg.errorHandler;
        _cfg.errorHandler = function cbErrorHandler(err, event, payload) {
          const state = errorCounts.get(event) || { count: 0, openedAt: 0 };
          state.count++;
          if (state.count >= threshold) state.openedAt = Date.now();
          errorCounts.set(event, state);
          if (typeof prevErrorHandler === 'function') prevErrorHandler(err, event, payload);
          else console.error('[MajixEvents:circuitBreaker] Handler error on', event, err);
        };
      },
    };
  }

  /**
   * Perf plugin — measures handler execution time and emits a
   * 'majixevents:perf' event with { event, elapsed } after each dispatch.
   * Enable with: MajixEvents.plugin(MajixEvents.plugins.perf)
   */
  const _perfPlugin = {
    name: 'perf',
    install(bus) {
      bus.use((event, payload, next) => {
        const t0 = performance && performance.now ? performance.now() : Date.now();
        next(payload);
        const elapsed = (performance && performance.now ? performance.now() : Date.now()) - t0;
        // Emit async so it doesn't re-enter the same middleware
        Promise.resolve().then(() =>
          bus.emitSync('majixevents:perf', { event, elapsed })
        );
      });
    },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITY HELPERS (public)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Wait for the next emission of rawEvent and resolve with its payload.
   * @param {string} rawEvent
   * @param {number} [timeout=0]  — 0 = no timeout
   * @returns {Promise<*>}
   */
  function next(rawEvent, timeout) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const unsub = once(rawEvent, (payload) => {
        if (timer) clearTimeout(timer);
        resolve(payload);
      });
      if (timeout && timeout > 0) {
        timer = setTimeout(() => {
          unsub();
          reject(new Error(`[MajixEvents] next("${rawEvent}") timed out after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * Convert the next N emissions of rawEvent into an async iterable.
   * @param {string} rawEvent
   * @param {number} [count=Infinity]
   * @returns {AsyncIterable<*>}
   */
  function toAsyncIterable(rawEvent, count) {
    const max    = count !== undefined ? count : Infinity;
    let   seen   = 0;
    const queue  = [];
    let   resolve = null;

    const unsub = on(rawEvent, (payload) => {
      if (resolve) { const r = resolve; resolve = null; r({ value: payload, done: false }); }
      else queue.push(payload);
      seen++;
      if (seen >= max) unsub();
    });

    return {
      [Symbol.asyncIterator]() {
        return {
          next() {
            if (queue.length > 0) {
              return Promise.resolve({ value: queue.shift(), done: false });
            }
            if (seen >= max) {
              return Promise.resolve({ value: undefined, done: true });
            }
            return new Promise(res => { resolve = res; });
          },
          return() { unsub(); return Promise.resolve({ done: true }); },
        };
      },
    };
  }

  /**
   * Accumulate all emissions of rawEvent with a reducer function.
   * Emits '[event]:accumulated' with the running accumulation after each step.
   * @param {string}   rawEvent
   * @param {Function} reducer   — (accumulator, payload, event) => accumulator
   * @param {*}        initial   — initial accumulator value
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function scan(rawEvent, reducer, initial, options) {
    const event = _qualify(rawEvent);
    let   acc   = initial;
    return on(rawEvent, (payload, ev) => {
      acc = reducer(acc, payload, ev);
      emit(`${event}:accumulated`, acc);
    }, options);
  }

  /**
   * Count emissions of rawEvent and emit '[event]:count' with the running total.
   * @param {string} rawEvent
   * @param {object} [options]
   * @returns {Function} unsubscribe
   */
  function countEmissions(rawEvent, options) {
    const event = _qualify(rawEvent);
    let   n     = 0;
    return on(rawEvent, () => {
      emit(`${event}:count`, ++n);
    }, options);
  }

  /**
   * Distinct: only pass through payloads that differ from the previous one.
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {Function} [compareFn]  — (prev, curr) => boolean (true = same)
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function distinct(rawEvent, handler, compareFn, options) {
    let prev = Symbol('uninit');
    const isSame = typeof compareFn === 'function'
      ? compareFn
      : (a, b) => {
          try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
        };

    return on(rawEvent, (payload, event) => {
      if (prev !== Symbol('uninit') && isSame(prev, payload)) return;
      prev = payload;
      handler(payload, event);
    }, options);
  }

  /**
   * Take: subscribe and auto-unsubscribe after `n` invocations.
   * @param {string}   rawEvent
   * @param {number}   n
   * @param {Function} handler
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function take(rawEvent, n, handler, options) {
    let count = 0;
    let unsub;
    unsub = on(rawEvent, (payload, event) => {
      count++;
      handler(payload, event);
      if (count >= n) unsub();
    }, options);
    return unsub;
  }

  /**
   * Skip: invoke handler only after the first `n` emissions are ignored.
   * @param {string}   rawEvent
   * @param {number}   n
   * @param {Function} handler
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function skip(rawEvent, n, handler, options) {
    let count = 0;
    return on(rawEvent, (payload, event) => {
      if (count < n) { count++; return; }
      handler(payload, event);
    }, options);
  }

  /**
   * TakeUntil: subscribe until notifierEvent fires, then unsubscribe.
   * @param {string}   rawEvent
   * @param {string}   notifierEvent
   * @param {Function} handler
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function takeUntil(rawEvent, notifierEvent, handler, options) {
    const unsub = on(rawEvent, handler, options);
    once(notifierEvent, () => unsub());
    return unsub;
  }

  /**
   * Pairwise: emit handler with pairs of consecutive payloads.
   * @param {string}   rawEvent
   * @param {Function} handler   — (prev, curr, event) => void
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function pairwise(rawEvent, handler, options) {
    let prev = undefined;
    let hasPrev = false;
    return on(rawEvent, (payload, event) => {
      if (!hasPrev) { prev = payload; hasPrev = true; return; }
      handler(prev, payload, event);
      prev = payload;
    }, options);
  }

  /**
   * StartWith: emit synthetic startup emission before real subscriptions fire.
   * @param {string}   rawEvent
   * @param {*}        initialPayload
   * @param {Function} handler
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function startWith(rawEvent, initialPayload, handler, options) {
    // Deliver initial value immediately (synchronously)
    try { handler(initialPayload, rawEvent); } catch (err) {
      _handleError(err, rawEvent, initialPayload);
    }
    return on(rawEvent, handler, options);
  }

  /**
   * SwitchMap: for each emission of rawEvent, unsubscribe from the previous
   * inner event and subscribe to the new one returned by projectionFn.
   * @param {string}   rawEvent
   * @param {Function} projectionFn  — (payload) => innerEventName
   * @param {Function} handler       — called for each inner emission
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function switchMap(rawEvent, projectionFn, handler, options) {
    let innerUnsub = null;
    const outerUnsub = on(rawEvent, (payload) => {
      if (innerUnsub) { innerUnsub(); innerUnsub = null; }
      const innerEvent = projectionFn(payload);
      if (innerEvent) {
        innerUnsub = on(innerEvent, handler);
      }
    }, options);
    return function unsubscribe() {
      outerUnsub();
      if (innerUnsub) innerUnsub();
    };
  }

  /**
   * MergeMap: for each emission of rawEvent, subscribe to the inner event
   * returned by projectionFn.  Does NOT unsubscribe previous inner streams.
   * @param {string}   rawEvent
   * @param {Function} projectionFn  — (payload) => innerEventName
   * @param {Function} handler       — called for each inner emission
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function mergeMap(rawEvent, projectionFn, handler, options) {
    const innerUnsubs = [];
    const outerUnsub  = on(rawEvent, (payload) => {
      const innerEvent = projectionFn(payload);
      if (innerEvent) innerUnsubs.push(on(innerEvent, handler));
    }, options);
    return function unsubscribe() {
      outerUnsub();
      innerUnsubs.forEach(u => u());
    };
  }

  /**
   * ExhaustMap: for each emission of rawEvent, subscribe to the inner event
   * returned by projectionFn — but only if there is no active inner stream.
   * @param {string}   rawEvent
   * @param {Function} projectionFn  — (payload) => innerEventName
   * @param {Function} handler       — called for each inner emission
   * @param {object}   [options]
   * @returns {Function} unsubscribe
   */
  function exhaustMap(rawEvent, projectionFn, handler, options) {
    let active = false;
    let innerUnsub = null;
    const outerUnsub = on(rawEvent, (payload) => {
      if (active) return;
      const innerEvent = projectionFn(payload);
      if (!innerEvent) return;
      active     = true;
      innerUnsub = on(innerEvent, (innerPayload, innerEv) => {
        handler(innerPayload, innerEv);
        active = false;
        if (innerUnsub) { innerUnsub(); innerUnsub = null; }
      });
    }, options);
    return function unsubscribe() {
      outerUnsub();
      if (innerUnsub) innerUnsub();
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INDEXED DB  –  queryIdb / clearIdb (public aliases already defined above)
  // ══════════════════════════════════════════════════════════════════════════
  //   queryIdb(options) — defined in IDB section
  //   clearIdb([event]) — defined in IDB section

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API OBJECT
  // ══════════════════════════════════════════════════════════════════════════

  const MajixEvents = {

    // ── Meta ─────────────────────────────────────────────────────────────
    version: VERSION,

    // ── Lifecycle ────────────────────────────────────────────────────────
    init,
    configure,
    destroy,

    // ── Core subscription ────────────────────────────────────────────────
    on,
    once,
    off,
    offById,
    offByTag,
    offAll,
    count,
    listEvents,

    // ── Emit ─────────────────────────────────────────────────────────────
    emit,
    emitSync,
    emitMany,
    emitParallel,

    // ── Middleware ───────────────────────────────────────────────────────
    use,
    unuse,
    clearMiddleware,

    // ── History ──────────────────────────────────────────────────────────
    history,
    historyFor,
    historySince,
    historyBetween,
    historyFrom,
    clearHistory,
    exportHistory,
    importHistory,

    // ── Replay ───────────────────────────────────────────────────────────
    replay,
    replayAll,

    // ── Timing helpers ───────────────────────────────────────────────────
    debounce,
    throttle,
    delay,
    sample,
    audit,

    // ── Pipe / Filter / Map / Tap ────────────────────────────────────────
    pipe,
    filter,
    map,
    tap,

    // ── Buffer / Window ──────────────────────────────────────────────────
    buffer,
    window,

    // ── Request / Response ───────────────────────────────────────────────
    ask,
    answer,

    // ── Scope ────────────────────────────────────────────────────────────
    scope,

    // ── Combinators ──────────────────────────────────────────────────────
    merge,
    zip,
    race,
    combineLatest,
    sequence,

    // ── Queue ────────────────────────────────────────────────────────────
    createQueue,

    // ── Deduplication ────────────────────────────────────────────────────
    dedupeOn,

    // ── Router ───────────────────────────────────────────────────────────
    createRouter,

    // ── Schema validation ────────────────────────────────────────────────
    defineSchema,
    removeSchema,
    validate,
    setSchemaMode,

    // ── Metrics ──────────────────────────────────────────────────────────
    metrics,
    metricsAll,
    resetMetrics,
    enableMetrics,

    // ── Plugins ──────────────────────────────────────────────────────────
    plugin,
    hasPlugin,
    plugins: {
      logger:         _loggerPlugin,
      timestamp:      _timestampPlugin,
      immutable:      _immutablePlugin,
      retry:          _retryPlugin,
      circuitBreaker: _circuitBreakerPlugin,
      perf:           _perfPlugin,
    },

    // ── Operators / Utilities ─────────────────────────────────────────────
    next,
    toAsyncIterable,
    scan,
    countEmissions,
    distinct,
    take,
    skip,
    takeUntil,
    pairwise,
    startWith,
    switchMap,
    mergeMap,
    exhaustMap,

    // ── Persistence ──────────────────────────────────────────────────────
    clearPersisted,
    queryIdb,
    clearIdb,

    // ── Snapshot ─────────────────────────────────────────────────────────
    snapshot,
    restore,

    // ── Worker bridge ────────────────────────────────────────────────────
    connectWorker,

    // ── Batch ────────────────────────────────────────────────────────────
    batch,
  };

  // ══════════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════════
  // NODE.JS EventEmitter COMPATIBILITY LAYER
  // ══════════════════════════════════════════════════════════════════════════
  //
  // MajixEventEmitter provides a drop-in replacement for Node.js EventEmitter.
  // It delegates all operations to the main MajixEvents bus, with events
  // namespaced by a unique emitter ID so different emitter instances remain
  // isolated.
  //
  // Usage:
  //   const emitter = new MajixEvents.EventEmitter();
  //   emitter.on('data', handler);
  //   emitter.emit('data', { value: 42 });
  //   emitter.removeListener('data', handler);
  //   emitter.removeAllListeners();
  //
  // The emitter class also supports the standard 'error' and 'newListener'
  // meta-events that Node.js EventEmitter emits.
  //
  // ── EventEmitter API ─────────────────────────────────────────────────────
  //
  //   new MajixEvents.EventEmitter([options])
  //     options: { captureRejections: boolean }
  //
  //   emitter.on(event, listener)              — add listener; returns this
  //   emitter.addListener(event, listener)     — alias for on()
  //   emitter.once(event, listener)            — add one-time listener
  //   emitter.off(event, listener)             — remove listener
  //   emitter.removeListener(event, listener)  — alias for off()
  //   emitter.removeAllListeners([event])      — remove all for event/all
  //   emitter.emit(event, ...args)             — synchronous emit; returns bool
  //   emitter.listeners(event)                 — copy of listeners array
  //   emitter.listenerCount(event)             — count listeners for event
  //   emitter.eventNames()                     — all subscribed event names
  //   emitter.rawListeners(event)              — listeners with once wrappers
  //   emitter.prependListener(event, listener)
  //   emitter.prependOnceListener(event, listener)
  //   emitter.setMaxListeners(n)
  //   emitter.getMaxListeners()
  //   emitter.destroy()
  //
  // ── Static members ────────────────────────────────────────────────────────
  //
  //   MajixEvents.EventEmitter.defaultMaxListeners     {number}
  //   MajixEvents.EventEmitter.listenerCount(em, evt)  {number}
  //
  // ── Notes ─────────────────────────────────────────────────────────────────
  //
  //   When more than one argument is passed to emit(), the arguments are
  //   wrapped into an array automatically.
  //   The 'error' event throws synchronously if no handler is registered,
  //   matching Node.js behaviour.

  class EventEmitter {
    /** @param {object} [options] */
    constructor(options) {
      this._opts         = Object.assign({ captureRejections: false }, options);
      this._emitterId    = `__ee_${++_idSeq}__`;
      this._maxListeners = EventEmitter.defaultMaxListeners;
      /** @type {Map<string, Function[]>} event → originalListeners */
      this._entries      = new Map();
      /** @type {Map<Function, Function>} originalListener → wrappedListener */
      this._wrappers     = new Map();
      /** @type {Map<Function, Function>} wrappedListener → unsubFn */
      this._unsubs       = new Map();
    }

    /** Build a namespaced event key unique to this emitter instance. */
    _k(e) { return `${this._emitterId}:${e}`; }

    /**
     * Add a persistent listener.
     * @param {string}   event
     * @param {Function} listener
     * @returns {this}
     */
    on(event, listener) {
      if (typeof listener !== 'function') throw new TypeError('listener must be a function');
      const key  = this._k(event);
      const list = this._entries.get(event) || [];
      const w    = (payload) => {
        const args = Array.isArray(payload) && payload.__eeArgs ? payload : [payload];
        listener.apply(this, args);
      };
      list.push(listener);
      this._entries.set(event, list);
      this._unsubs.set(w, MajixEvents.on(key, w));
      this._wrappers.set(listener, w);
      if (list.length > this._maxListeners && this._maxListeners > 0) {
        _warn(`EventEmitter: possible memory leak — ${list.length} listeners for "${event}"`);
      }
      // Fire 'newListener' meta-event (skip if this IS the newListener call to avoid recursion)
      if (event !== 'newListener') this.emit('newListener', event, listener);
      return this;
    }

    /** Alias for on(). */
    addListener(event, listener) { return this.on(event, listener); }

    /**
     * Add a one-time listener that auto-removes after first invocation.
     * @param {string}   event
     * @param {Function} listener
     * @returns {this}
     */
    once(event, listener) {
      if (typeof listener !== 'function') throw new TypeError('listener must be a function');
      const key  = this._k(event);
      const list = this._entries.get(event) || [];
      const w    = (payload) => {
        // Self-remove
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) this._entries.delete(event);
        this._wrappers.delete(listener);
        this._unsubs.delete(w);
        const args = Array.isArray(payload) && payload.__eeArgs ? payload : [payload];
        listener.apply(this, args);
      };
      list.push(listener);
      this._entries.set(event, list);
      const unsub = MajixEvents.on(key, w, { once: true });
      this._unsubs.set(w, unsub);
      this._wrappers.set(listener, w);
      if (event !== 'newListener') this.emit('newListener', event, listener);
      return this;
    }

    /**
     * Remove a listener.
     * @param {string}   event
     * @param {Function} listener
     * @returns {this}
     */
    off(event, listener) {
      const list = this._entries.get(event);
      if (!list) return this;
      const idx = list.indexOf(listener);
      if (idx === -1) return this;
      list.splice(idx, 1);
      if (list.length === 0) this._entries.delete(event);

      const w = this._wrappers.get(listener);
      if (w) {
        const u = this._unsubs.get(w);
        if (u) u();
        this._unsubs.delete(w);
        this._wrappers.delete(listener);
      }
      if (event !== 'removeListener') this.emit('removeListener', event, listener);
      return this;
    }

    /** Alias for off(). */
    removeListener(event, listener) { return this.off(event, listener); }

    /**
     * Remove all listeners for an event, or for all events.
     * @param {string} [event]
     * @returns {this}
     */
    removeAllListeners(event) {
      const events = event ? [event] : Array.from(this._entries.keys());
      for (const ev of events) {
        const list = this._entries.get(ev);
        if (!list) continue;
        for (const l of list.slice()) this.off(ev, l);
      }
      return this;
    }

    /**
     * Emit an event synchronously.  Multiple args are wrapped into an array.
     * Throws if event is 'error' and no handler is registered.
     * @param {string} event
     * @param {...*}   args
     * @returns {boolean}  true if there were any listeners
     */
    emit(event, ...args) {
      const list = this._entries.get(event);
      if (event === 'error' && (!list || list.length === 0)) {
        const err = args[0] instanceof Error ? args[0] : new Error(String(args[0]));
        throw err;
      }
      if (!list || list.length === 0) return false;
      const payload = args.length === 1 ? args[0] : Object.assign(args, { __eeArgs: true });
      MajixEvents.emitSync(this._k(event), payload);
      return true;
    }

    /** Return a copy of the listeners array for event. */
    listeners(event)      { return (this._entries.get(event) || []).slice(); }

    /** Return the count of listeners for event. */
    listenerCount(event)  { return (this._entries.get(event) || []).length; }

    /** Return all event names that have at least one listener. */
    eventNames() {
      return Array.from(this._entries.keys()).filter(k => (this._entries.get(k) || []).length > 0);
    }

    /** Return listeners including once-wrappers (mirrors Node rawListeners). */
    rawListeners(event) {
      return (this._entries.get(event) || []).map(l => this._wrappers.get(l) || l);
    }

    /** Prepend a persistent listener. */
    prependListener(event, listener)     { return this.on(event, listener); }

    /** Prepend a one-time listener. */
    prependOnceListener(event, listener) { return this.once(event, listener); }

    /** Set the max-listeners warning threshold for this instance. */
    setMaxListeners(n)  { this._maxListeners = n; return this; }

    /** Return the max-listeners warning threshold. */
    getMaxListeners()   { return this._maxListeners; }

    /** Remove all listeners and clear internal state. */
    destroy()           { this.removeAllListeners(); }
  }

  /** Global default max-listeners threshold (mirrors Node.js default of 10). */
  EventEmitter.defaultMaxListeners = 10;

  /** Static helper matching Node.js API. */
  EventEmitter.listenerCount = (emitter, event) => emitter.listenerCount(event);

  MajixEvents.EventEmitter = EventEmitter;

  // ══════════════════════════════════════════════════════════════════════════
  // STATE STORE  (event-driven state management)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // A lightweight, event-driven state store inspired by Redux/Flux.
  // State changes are triggered by dispatching typed actions.  Subscribers
  // are notified through the MajixEvents bus as well as directly.
  //
  // Usage:
  //   const store = MajixEvents.createStore('app', { count: 0 }, {
  //     INCREMENT: (state, { by = 1 }) => ({ ...state, count: state.count + by }),
  //     RESET:     ()                  => ({ count: 0 }),
  //   });
  //
  //   store.dispatch('INCREMENT', { by: 5 });
  //   console.log(store.getState());  // { count: 5 }
  //
  //   const unsub = store.subscribe((newState, prevState, action) => {
  //     console.log(action.type, newState);
  //   });
  //
  //   store.reset();
  //   unsub();
  //   store.destroy();
  //
  // ── Store API ─────────────────────────────────────────────────────────────
  //
  //   MajixEvents.createStore(name, initialState [, reducers])
  //   store.dispatch(actionType [, payload])  — returns new state
  //   store.subscribe(handler)                — returns unsubscribe fn
  //   store.getState()                        — shallow clone of current state
  //   store.reset()                           — reset to initial state
  //   store.replaceReducer(newReducers)
  //   store.addReducer(actionType, fn)
  //   store.removeReducer(actionType)
  //   store.useMiddleware(fn)  — (action, state, next) => void
  //   store.travelTo(index)    — time-travel to history[index]
  //   store.history            — read-only array: { action, prevState, nextState, ts }
  //   store.destroy()
  //
  // ── Events emitted by the store ───────────────────────────────────────────
  //
  //   '${name}:action'  — fired before reducer;  payload: { type, payload }
  //   '${name}:change'  — fired after  reducer;  payload: { state, prevState, action }
  //   '${name}:reset'   — fired on reset;         payload: { state }

  /** JSON round-trip deep clone. */
  function _deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
  }

  /**
   * Create an event-driven state store.
   * @param {string} name
   * @param {object} initialState
   * @param {object} [reducers]
   * @returns {Store}
   */
  function createStore(name, initialState, reducers) {
    return new Store(name, initialState, reducers);
  }

  class Store {
    /**
     * @param {string} name
     * @param {object} initialState
     * @param {object} [reducers]
     */
    constructor(name, initialState, reducers) {
      if (typeof name !== 'string' || !name) {
        throw new TypeError('[MajixEvents.Store] name must be a non-empty string');
      }
      this.name          = name;
      this._initial      = _deepClone(initialState || {});
      this._state        = _deepClone(this._initial);
      this._reducers     = Object.assign({}, reducers);
      this._middleware   = [];
      this._history      = [];
      this._historyLimit = 100;
      this._subscribers  = [];
    }

    /**
     * Return a shallow clone of the current state.
     * @returns {object}
     */
    getState() { return Object.assign({}, this._state); }

    /**
     * Dispatch an action.  Runs through store middleware, applies reducer,
     * updates state, emits change events.
     * @param {string} type
     * @param {*}      [payload]
     * @returns {object} new state
     */
    dispatch(type, payload) {
      const action = { type, payload };
      MajixEvents.emitSync(`${this.name}:action`, action);

      // Store-level middleware
      let finalAction = action;
      if (this._middleware.length > 0) {
        finalAction = this._runMiddleware(action);
        if (!finalAction) return this._state;
      }

      const prevState = this._state;
      const reducer   = this._reducers[finalAction.type];
      let nextState   = prevState;

      if (typeof reducer === 'function') {
        try {
          nextState = reducer(Object.assign({}, prevState), finalAction.payload);
        } catch (err) {
          _handleError(err, `${this.name}:dispatch`, finalAction);
          return prevState;
        }
      } else {
        _warn(`[Store "${this.name}"] No reducer for action type "${finalAction.type}"`);
      }

      this._state = nextState;

      // Time-travel history
      this._history.push({ action: finalAction, prevState, nextState, ts: Date.now() });
      if (this._history.length > this._historyLimit) this._history.shift();

      // Notify via MajixEvents bus
      const changePayload = { state: nextState, prevState, action: finalAction };
      MajixEvents.emitSync(`${this.name}:change`, changePayload);

      // Notify direct subscribers
      for (const sub of this._subscribers.slice()) {
        try { sub(nextState, prevState, finalAction); } catch (err) {
          _handleError(err, `${this.name}:subscriber`, finalAction);
        }
      }

      return nextState;
    }

    /**
     * Subscribe to state changes.
     * @param {Function} handler  — (newState, prevState, action) => void
     * @returns {Function} unsubscribe
     */
    subscribe(handler) {
      if (typeof handler !== 'function') throw new TypeError('handler must be a function');
      this._subscribers.push(handler);
      return () => {
        const idx = this._subscribers.indexOf(handler);
        if (idx !== -1) this._subscribers.splice(idx, 1);
      };
    }

    /**
     * Reset state to initial value.
     * @returns {object} reset state
     */
    reset() {
      this._state = _deepClone(this._initial);
      this._history.length = 0;
      MajixEvents.emitSync(`${this.name}:reset`, { state: this._state });
      for (const sub of this._subscribers.slice()) {
        try { sub(this._state, this._state, { type: '@@RESET', payload: null }); } catch { /* ignore */ }
      }
      return this._state;
    }

    /** Replace the entire reducer map. */
    replaceReducer(newReducers)  { this._reducers = Object.assign({}, newReducers); }

    /** Add or replace a single reducer. */
    addReducer(type, reducer)    { this._reducers[type] = reducer; }

    /** Remove a single reducer. */
    removeReducer(type)          { delete this._reducers[type]; }

    /** Register store-level middleware: (action, state, next) => void. */
    useMiddleware(mw)            { this._middleware.push(mw); }

    /** @internal Run store middleware chain. */
    _runMiddleware(action) {
      let result = action;
      for (const mw of this._middleware) {
        if (result === null) return null;
        let passed = null;
        mw(result, this._state, (next) => { passed = next; });
        result = passed !== null ? passed : result;
      }
      return result;
    }

    /**
     * Time-travel: restore state from history[index].
     * @param {number} index
     * @returns {object} restored state
     */
    travelTo(index) {
      const entry = this._history[index];
      if (!entry) return this._state;
      this._state = Object.assign({}, entry.nextState);
      return this._state;
    }

    /** Read-only copy of the time-travel history. */
    get history() { return this._history.slice(); }

    /** Tear down the store. */
    destroy() {
      this._subscribers.length = 0;
      this._middleware.length  = 0;
      this._history.length     = 0;
    }
  }

  MajixEvents.createStore = createStore;
  MajixEvents.Store       = Store;

  // ══════════════════════════════════════════════════════════════════════════
  // COMMAND BUS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // A lightweight command dispatcher with middleware and async handler support.
  // Commands are single-handler (unlike events which are multi-subscriber).
  // Attempting to dispatch an unregistered command throws by default.
  //
  // Usage:
  //   const cmd = MajixEvents.createCommandBus();
  //
  //   cmd.register('CreateUser', async ({ name, email }) => {
  //     const user = await db.create({ name, email });
  //     await MajixEvents.emit('user:created', user);
  //     return user;
  //   });
  //
  //   const user = await cmd.dispatch('CreateUser', { name: 'Alice', email: 'a@b.com' });
  //
  // ── CommandBus API ────────────────────────────────────────────────────────
  //
  //   createCommandBus([options])
  //     options:
  //       strict {boolean} — throw if no handler registered (default true)
  //     Returns a CommandBus instance.
  //
  //   bus.register(commandType, handler)   — returns bus for chaining
  //   bus.unregister(commandType)
  //   bus.dispatch(commandType [, payload]) — returns Promise<result>
  //   bus.use(middleware)  — (commandType, payload, next) => * | Promise<*>
  //   bus.has(commandType) — returns boolean
  //   bus.destroy()
  //
  // ── Post-dispatch events ──────────────────────────────────────────────────
  //
  //   'command:${commandType}:done'  — emitted with { commandType, payload, result }

  /**
   * Create a command bus.
   * @param {object} [options]
   * @param {boolean}[options.strict=true]
   * @returns {CommandBus}
   */
  function createCommandBus(options) {
    return new CommandBus(options);
  }

  class CommandBus {
    /** @param {object} [opts] */
    constructor(opts) {
      this._opts       = Object.assign({ strict: true }, opts);
      this._handlers   = new Map();
      this._middleware = [];
    }

    /**
     * Register a handler for a command type.
     * @param {string}   commandType
     * @param {Function} handler
     * @returns {this}
     */
    register(commandType, handler) {
      if (typeof commandType !== 'string') throw new TypeError('commandType must be a string');
      if (typeof handler !== 'function')   throw new TypeError('handler must be a function');
      if (this._handlers.has(commandType)) {
        _warn(`CommandBus: replacing handler for "${commandType}"`);
      }
      this._handlers.set(commandType, handler);
      return this;
    }

    /** Remove a handler. */
    unregister(commandType) { this._handlers.delete(commandType); }

    /**
     * Dispatch a command.
     * @param {string} commandType
     * @param {*}      [payload]
     * @returns {Promise<*>}
     */
    async dispatch(commandType, payload) {
      const handler = this._handlers.get(commandType);
      if (!handler) {
        if (this._opts.strict) {
          throw new Error(`[CommandBus] No handler registered for "${commandType}"`);
        }
        return undefined;
      }
      let current = payload;
      if (this._middleware.length > 0) {
        current = await this._applyMw(commandType, payload);
      }
      const result = await handler(current);
      MajixEvents.emit(`command:${commandType}:done`, { commandType, payload: current, result });
      return result;
    }

    /**
     * Register middleware.
     * @param {Function} mw
     * @returns {this}
     */
    use(mw) { this._middleware.push(mw); return this; }

    /** Check if a handler is registered. */
    has(commandType) { return this._handlers.has(commandType); }

    /** @internal */
    _applyMw(commandType, payload) {
      return new Promise((resolve, reject) => {
        let i = 0;
        const step = (current) => {
          if (i >= this._middleware.length) { resolve(current); return; }
          const mw = this._middleware[i++];
          try {
            const r = mw(commandType, current, step);
            if (r && typeof r.then === 'function') {
              r.then(v => { if (v !== undefined) resolve(v); }).catch(reject);
            }
          } catch (err) { reject(err); }
        };
        step(payload);
      });
    }

    /** Remove all handlers and middleware. */
    destroy() {
      this._handlers.clear();
      this._middleware.length = 0;
    }
  }

  MajixEvents.createCommandBus = createCommandBus;
  MajixEvents.CommandBus       = CommandBus;

  // ══════════════════════════════════════════════════════════════════════════
  // EVENT SOURCING HELPERS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Lightweight event-sourcing primitives.  Aggregates maintain state derived
  // from an append-only stream of domain events.
  //
  // Usage:
  //   const orderHandlers = {
  //     OrderPlaced:   (state, payload) => ({ ...state, status: 'placed',  ...payload }),
  //     OrderShipped:  (state, payload) => ({ ...state, status: 'shipped', trackingId: payload.id }),
  //     OrderCancelled:(state)          => ({ ...state, status: 'cancelled' }),
  //   };
  //
  //   const order = MajixEvents.createAggregate('Order-1', orderHandlers, { status: 'new' });
  //   order.apply({ type: 'OrderPlaced', payload: { orderId: 1, total: 99.99 } });
  //   console.log(order.getState());  // { status: 'placed', orderId: 1, total: 99.99 }
  //
  //   const store = MajixEvents.createEventStore();
  //   store.append('Order-1', order.getUncommitted());
  //   order.markCommitted();
  //
  // ── Aggregate API ─────────────────────────────────────────────────────────
  //
  //   MajixEvents.createAggregate(id, applyHandlers [, initialState])
  //   aggregate.apply({ type, payload })  — apply domain event; returns new state
  //   aggregate.getState()               — current state (shallow clone)
  //   aggregate.getUncommitted()         — uncommitted events list
  //   aggregate.markCommitted()          — clear uncommitted list
  //   aggregate.loadFrom(events)         — rebuild state from past events
  //   aggregate.on(eventType, handler)   — subscribe to apply notifications
  //                                        returns unsubscribe fn
  //
  // ── EventSourceStore API ──────────────────────────────────────────────────
  //
  //   MajixEvents.createEventStore([options])
  //     options: { streamLimit: number }  — max events per stream
  //
  //   store.append(streamId, events)            — append events to stream
  //   store.load(streamId [, fromSeq])          — load events from stream
  //   store.loadAll([fromSeq])                  — all events across all streams
  //   store.snapshot(streamId, state, seq)      — save snapshot
  //   store.getSnapshot(streamId)               — retrieve latest snapshot
  //   store.streams()                           — array of stream IDs
  //   store.destroy()                           — clear all data

  /**
   * Create an event-sourcing aggregate.
   * @param {string} id
   * @param {object} applyHandlers
   * @param {object} [initialState]
   * @returns {Aggregate}
   */
  function createAggregate(id, applyHandlers, initialState) {
    return new Aggregate(id, applyHandlers, initialState);
  }

  class Aggregate {
    /**
     * @param {string} id
     * @param {object} handlers  — { eventType: (state, payload) => newState }
     * @param {object} [initial] — seed state
     */
    constructor(id, handlers, initial) {
      this.id           = id;
      this._handlers    = Object.assign({}, handlers);
      this._initial     = _deepClone(initial || {});
      this._state       = _deepClone(this._initial);
      this._uncommitted = [];
      this._version     = 0;
      this._subs        = new Map();   // eventType → handlers[]
    }

    /**
     * Apply a domain event; update state.
     * @param {{ type: string, payload: * }} domainEvent
     * @returns {object} new state
     */
    apply(domainEvent) {
      const handler = this._handlers[domainEvent.type];
      let newState  = this._state;
      if (typeof handler === 'function') {
        try {
          newState = handler(Object.assign({}, this._state), domainEvent.payload);
        } catch (err) {
          _handleError(err, `aggregate:${this.id}:${domainEvent.type}`, domainEvent);
        }
      }

      this._state = newState;
      this._version++;
      const entry = Object.assign({ ts: Date.now(), seq: this._version }, domainEvent);
      this._uncommitted.push(entry);

      // Notify local subscribers
      const subs = this._subs.get(domainEvent.type) || [];
      for (const s of subs) {
        try { s(newState, entry); } catch { /* ignore */ }
      }

      return newState;
    }

    /** Return shallow clone of current state. */
    getState()       { return Object.assign({}, this._state); }

    /** Return copy of uncommitted events. */
    getUncommitted() { return this._uncommitted.slice(); }

    /** Clear the uncommitted events list. */
    markCommitted()  { this._uncommitted.length = 0; }

    /**
     * Replay a sequence of past events to rebuild state.
     * @param {Array} events
     */
    loadFrom(events) {
      this._state   = _deepClone(this._initial);
      this._version = 0;
      for (const ev of events) {
        const h = this._handlers[ev.type];
        if (typeof h === 'function') {
          this._state = h(Object.assign({}, this._state), ev.payload);
        }
        this._version++;
      }
    }

    /**
     * Subscribe to a specific event type being applied.
     * @param {string}   eventType
     * @param {Function} handler   — (newState, domainEvent) => void
     * @returns {Function} unsubscribe
     */
    on(eventType, handler) {
      const subs = this._subs.get(eventType) || [];
      subs.push(handler);
      this._subs.set(eventType, subs);
      return () => {
        const list = this._subs.get(eventType);
        if (list) {
          const idx = list.indexOf(handler);
          if (idx !== -1) list.splice(idx, 1);
        }
      };
    }
  }

  /**
   * Create an in-memory event source store.
   * @param {object} [options]
   * @param {number} [options.streamLimit=Infinity]
   * @returns {EventSourceStore}
   */
  function createEventStore(options) {
    return new EventSourceStore(options);
  }

  class EventSourceStore {
    /** @param {object} [opts] */
    constructor(opts) {
      this._opts      = Object.assign({ streamLimit: Infinity }, opts);
      /** @type {Map<string, Array>} streamId → events */
      this._streams   = new Map();
      /** @type {Map<string, { state:*, seq:number, ts:number }>} */
      this._snapshots = new Map();
    }

    /**
     * Append events to a stream.
     * @param {string} streamId
     * @param {Array}  events
     */
    append(streamId, events) {
      if (!this._streams.has(streamId)) this._streams.set(streamId, []);
      const stream = this._streams.get(streamId);
      for (const ev of events) {
        stream.push(Object.assign({ ts: Date.now(), streamId }, ev));
        if (stream.length > this._opts.streamLimit) stream.shift();
      }
    }

    /**
     * Load events from a stream.
     * @param {string} streamId
     * @param {number} [fromSeq=0]
     * @returns {Array}
     */
    load(streamId, fromSeq) {
      const s = this._streams.get(streamId) || [];
      return fromSeq ? s.filter((_, i) => i >= fromSeq) : s.slice();
    }

    /**
     * Load all events across all streams, sorted by ts.
     * @param {number} [fromSeq=0]
     * @returns {Array}
     */
    loadAll(fromSeq) {
      const all = [];
      for (const s of this._streams.values()) all.push(...s);
      all.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      return fromSeq ? all.slice(fromSeq) : all;
    }

    /**
     * Save a snapshot.
     * @param {string} streamId
     * @param {*}      state
     * @param {number} seq
     */
    snapshot(streamId, state, seq) {
      this._snapshots.set(streamId, { state: _deepClone(state), seq, ts: Date.now() });
    }

    /**
     * Retrieve the latest snapshot for a stream.
     * @param {string} streamId
     * @returns {{ state:*, seq:number, ts:number }|null}
     */
    getSnapshot(streamId) { return this._snapshots.get(streamId) || null; }

    /** List all stream IDs. */
    streams() { return Array.from(this._streams.keys()); }

    /** Destroy all data. */
    destroy() { this._streams.clear(); this._snapshots.clear(); }
  }

  MajixEvents.createAggregate  = createAggregate;
  MajixEvents.Aggregate        = Aggregate;
  MajixEvents.createEventStore = createEventStore;
  MajixEvents.EventSourceStore = EventSourceStore;

  // ══════════════════════════════════════════════════════════════════════════
  // DISTRIBUTED TRACING  (correlation / causation tracking)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Attach trace IDs and causation chains to event payloads automatically.
  // Useful for understanding event flows in complex distributed systems.
  //
  // Usage:
  //   MajixEvents.enableTracing({ maxTraces: 500 });
  //
  //   // Emit with a new root trace
  //   const { context } = await MajixEvents.emitTraced('order:placed', { orderId: 1 });
  //
  //   // Emit as a child span of the order trace
  //   await MajixEvents.emitTraced('payment:requested', { amount: 99 }, context);
  //
  //   // Inspect the trace
  //   const spans = MajixEvents.getTrace(context.traceId);
  //
  // ── Trace payload fields ──────────────────────────────────────────────────
  //
  //   _traceId      — root trace identifier
  //   _spanId       — this emission's unique span identifier
  //   _parentSpanId — parent span ID (null for root spans)
  //   _causedBy     — { event, spanId } of the immediate cause
  //
  // ── Tracing API ───────────────────────────────────────────────────────────
  //
  //   MajixEvents.enableTracing([options])
  //     options: { maxTraces: number }  — default 1000
  //
  //   MajixEvents.disableTracing()
  //
  //   MajixEvents.emitTraced(event, payload [, parentContext])
  //     Returns Promise<{ results: Array, context: { traceId, spanId, event } }>.
  //
  //   MajixEvents.withTrace(traceId, fn)
  //     Execute fn() with traceId as the active context identifier.
  //     Returns the return value of fn().
  //
  //   MajixEvents.getTrace(traceId)
  //     Return array of span records: { event, spanId, parentSpanId, ts, payload }.
  //
  //   MajixEvents.clearTraces([traceId])
  //     Clear trace data (specific trace or all traces).

  let _tracingEnabled   = false;
  let _tracingMaxTraces = 1000;
  /** @type {Map<string, Array>} traceId → spans */
  const _traces = new Map();

  /** Generate a short unique ID (UUID v4 or fallback). */
  function _genId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Enable trace injection.
   * @param {object} [options]
   * @param {number} [options.maxTraces=1000]
   */
  function enableTracing(options) {
    _tracingEnabled   = true;
    _tracingMaxTraces = (options && options.maxTraces) || 1000;
    _log('tracing enabled, maxTraces:', _tracingMaxTraces);
  }

  /** Disable trace injection. */
  function disableTracing() { _tracingEnabled = false; }

  /**
   * Emit an event with full distributed tracing context.
   * @param {string} rawEvent
   * @param {*}      [payload]
   * @param {{ traceId?: string, spanId?: string, event?: string }} [parentContext]
   * @returns {Promise<{ results: Array, context: object }>}
   */
  async function emitTraced(rawEvent, payload, parentContext) {
    const traceId      = (parentContext && parentContext.traceId) || _genId();
    const spanId       = _genId();
    const parentSpanId = parentContext && parentContext.spanId;

    const traced = Object.assign({}, payload, {
      _traceId:      traceId,
      _spanId:       spanId,
      _parentSpanId: parentSpanId || null,
      _causedBy:     parentContext
        ? { event: parentContext.event, spanId: parentSpanId }
        : null,
    });

    // Evict oldest trace if over limit
    if (!_traces.has(traceId)) {
      if (_traces.size >= _tracingMaxTraces) {
        const oldest = _traces.keys().next().value;
        _traces.delete(oldest);
      }
      _traces.set(traceId, []);
    }
    _traces.get(traceId).push({
      event:        _qualify(rawEvent),
      spanId,
      parentSpanId: parentSpanId || null,
      ts:           Date.now(),
      payload:      traced,
    });

    const results = await emit(rawEvent, traced);
    return { results, context: { traceId, spanId, event: _qualify(rawEvent) } };
  }

  /**
   * Execute fn() with a specific traceId as the active context.
   * @param {string}   traceId
   * @param {Function} fn
   * @returns {*}
   */
  function withTrace(traceId, fn) {
    // Simple synchronous wrapper — future: async-context propagation
    return fn(traceId);
  }

  /**
   * Return all span records for a trace.
   * @param {string} traceId
   * @returns {Array}
   */
  function getTrace(traceId) { return (_traces.get(traceId) || []).slice(); }

  /**
   * Clear trace data.
   * @param {string} [traceId]  — if omitted, clears all
   */
  function clearTraces(traceId) {
    if (traceId) _traces.delete(traceId);
    else _traces.clear();
  }

  MajixEvents.enableTracing  = enableTracing;
  MajixEvents.disableTracing = disableTracing;
  MajixEvents.emitTraced     = emitTraced;
  MajixEvents.withTrace      = withTrace;
  MajixEvents.getTrace       = getTrace;
  MajixEvents.clearTraces    = clearTraces;

  // ══════════════════════════════════════════════════════════════════════════
  // SCHEDULED / RECURRING EVENTS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Schedule events to fire once or on a repeating interval.
  //
  // Usage:
  //   // Fire 'heartbeat' every 5 seconds
  //   const h = MajixEvents.schedule('heartbeat', { source: 'scheduler' },
  //     { interval: 5000 });
  //   h.stop();
  //
  //   // Fire 'init' once after 200 ms
  //   MajixEvents.schedule('init', null, { delay: 200 });
  //
  //   // Fire 'tick' 10 times then stop, immediately on start
  //   MajixEvents.schedule('tick', null, { interval: 1000, times: 10, leading: true });
  //
  //   // List / stop all schedules
  //   MajixEvents.scheduleAll();
  //   MajixEvents.stopAllSchedules();
  //
  // ── schedule handle API ───────────────────────────────────────────────────
  //
  //   handle.fired    {number}  — number of times fired so far
  //   handle.stop()             — cancel the schedule
  //   handle.reset()            — reset the fired counter

  /** @type {Set} active schedule handles */
  const _schedules = new Set();

  /**
   * Schedule an event emission.
   * @param {string} rawEvent
   * @param {*}      [payload]
   * @param {object} [options]
   * @param {number} [options.delay]       — fire once after N ms
   * @param {number} [options.interval]    — fire every N ms
   * @param {number} [options.times]       — max firings (default: Infinity)
   * @param {boolean}[options.leading]     — fire immediately on start (default false)
   * @returns {{ fired: number, stop: Function, reset: Function }}
   */
  function schedule(rawEvent, payload, options) {
    const opts  = Object.assign({ times: Infinity, leading: false }, options);
    let   fired   = 0;
    let   timer   = null;
    let   stopped = false;

    const handle = {
      get fired()  { return fired; },
      stop() {
        stopped = true;
        clearTimeout(timer);
        clearInterval(timer);
        timer = null;
        _schedules.delete(handle);
      },
      reset() { fired = 0; },
    };

    function fire() {
      if (stopped) return;
      fired++;
      emit(rawEvent, payload).catch(err => _handleError(err, rawEvent, payload));
      if (opts.times !== Infinity && fired >= opts.times) handle.stop();
    }

    if (opts.interval) {
      if (opts.leading) fire();
      timer = setInterval(() => { if (!stopped) fire(); }, opts.interval);
    } else if (opts.delay !== undefined) {
      timer = setTimeout(() => {
        if (!stopped) fire();
        _schedules.delete(handle);
      }, opts.delay);
    }

    _schedules.add(handle);
    return handle;
  }

  /** Return array of all active schedule handles. */
  function scheduleAll()       { return Array.from(_schedules); }

  /** Stop all active schedules. */
  function stopAllSchedules() {
    Array.from(_schedules).forEach(h => h.stop());
    _schedules.clear();
  }

  MajixEvents.schedule         = schedule;
  MajixEvents.scheduleAll      = scheduleAll;
  MajixEvents.stopAllSchedules = stopAllSchedules;

  // ══════════════════════════════════════════════════════════════════════════
  // CROSS-FRAME MESSAGING  (iframe ↔ parent postMessage bridge)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Forward events between a parent page and embedded iframes using the
  // window.postMessage API.
  //
  // Security note: always set options.origin to the expected origin; never
  // use '*' in production.
  //
  // Usage (parent page):
  //   const bridge = MajixEvents.connectFrame(
  //     document.getElementById('myIframe'),
  //     { origin: 'https://embed.example.com', events: ['data:update', 'ui:*'] }
  //   );
  //   bridge.disconnect();
  //
  // Usage (inside iframe):
  //   const bridge = MajixEvents.connectFrame(window.parent,
  //     { origin: 'https://host.example.com' });
  //
  // ── connectFrame API ──────────────────────────────────────────────────────
  //
  //   MajixEvents.connectFrame(target [, options])
  //     target    — HTMLIFrameElement, its contentWindow, or window.parent
  //     options:
  //       origin  {string}    — allowed origin.   Default: '*'
  //       events  {string[]}  — event name whitelist.  Default: forward all.
  //     Returns { disconnect() }.

  /**
   * Bridge events to/from an iframe via postMessage.
   * @param {HTMLIFrameElement|Window} target
   * @param {object} [options]
   * @param {string}   [options.origin='*']
   * @param {string[]} [options.events]
   * @returns {{ disconnect: Function }}
   */
  function connectFrame(target, options) {
    const opts       = options || {};
    const origin     = opts.origin || '*';
    const allowedSet = opts.events ? new Set(opts.events) : null;
    // Resolve actual postMessage target
    const win = (target && target.contentWindow) ? target.contentWindow : target;

    function onMessage(ev) {
      if (origin !== '*' && ev.origin !== origin) return;
      const data = ev.data || {};
      if (!data._majixFrameEvent) return;
      _dispatchLocal(data.event, data.payload);
    }

    if (typeof window !== 'undefined') window.addEventListener('message', onMessage);

    // Forward local events to the target frame
    const unsub = on('*', (payload, event) => {
      if (allowedSet && !allowedSet.has(event)) return;
      if (!win || !win.postMessage) return;
      try { win.postMessage({ _majixFrameEvent: true, event, payload }, origin); }
      catch { /* structured clone failure */ }
    });

    return {
      disconnect() {
        unsub();
        if (typeof window !== 'undefined') window.removeEventListener('message', onMessage);
      },
    };
  }

  MajixEvents.connectFrame = connectFrame;

  // ══════════════════════════════════════════════════════════════════════════
  // EVENT PROTOCOL REGISTRY
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Self-documenting event protocol definitions.
  //
  // Defining a protocol:
  //   1. Documents the event's purpose and payload shape
  //   2. Automatically registers the payload as a validation schema
  //   3. Generates markdown documentation via generateProtocolDocs()
  //
  // Usage:
  //   MajixEvents.defineProtocol('user:login', {
  //     description: 'Emitted when a user successfully authenticates.',
  //     payload: {
  //       userId:   { type: 'number', required: true },
  //       username: { type: 'string', required: true, max: 64 },
  //       roles:    { type: 'array',  required: false },
  //     },
  //     emittedBy: ['components/auth/LoginForm'],
  //     handledBy: ['services/session', 'analytics/tracker'],
  //     since:     '1.0.0',
  //   });
  //
  //   const proto = MajixEvents.getProtocol('user:login');
  //   const docs  = MajixEvents.generateProtocolDocs();
  //
  // ── Protocol API ──────────────────────────────────────────────────────────
  //
  //   MajixEvents.defineProtocol(event, definition)
  //   MajixEvents.removeProtocol(event)
  //   MajixEvents.getProtocol(event)        — definition or null
  //   MajixEvents.listProtocols()           — array of all definitions
  //   MajixEvents.generateProtocolDocs()    — markdown string

  /** @type {Map<string, object>} event → protocol definition */
  const _protocols = new Map();

  /**
   * Define an event protocol.
   * @param {string} rawEvent
   * @param {object} definition
   */
  function defineProtocol(rawEvent, definition) {
    const event = _qualify(rawEvent);
    _protocols.set(event, Object.assign({ event }, definition));
    // Auto-register schema
    if (definition.payload) _schemas.set(event, definition.payload);
  }

  /**
   * Remove a protocol definition.
   * @param {string} rawEvent
   */
  function removeProtocol(rawEvent) { _protocols.delete(_qualify(rawEvent)); }

  /**
   * Retrieve a protocol definition.
   * @param {string} rawEvent
   * @returns {object|null}
   */
  function getProtocol(rawEvent) { return _protocols.get(_qualify(rawEvent)) || null; }

  /**
   * List all protocol definitions.
   * @returns {object[]}
   */
  function listProtocols() { return Array.from(_protocols.values()); }

  /**
   * Generate markdown documentation for all registered protocols.
   * @returns {string}
   */
  function generateProtocolDocs() {
    const lines = ['# Event Protocol Documentation\n\n*Generated by MajixEvents*\n'];

    if (_protocols.size === 0) {
      lines.push('\n*No protocols defined.*');
      return lines.join('\n');
    }

    for (const proto of _protocols.values()) {
      lines.push(`\n## \`${proto.event}\``);

      if (proto.deprecated) {
        const replacement = proto.replacedBy ? ` — use \`${proto.replacedBy}\`` : '';
        lines.push(`\n> ⚠️ **Deprecated**${replacement}`);
      }

      if (proto.description) lines.push(`\n${proto.description}`);
      if (proto.since)        lines.push(`\n**Since:** ${proto.since}`);

      if (proto.emittedBy && proto.emittedBy.length) {
        lines.push(`\n**Emitted by:** ${proto.emittedBy.map(s => `\`${s}\``).join(', ')}`);
      }
      if (proto.handledBy && proto.handledBy.length) {
        lines.push(`\n**Handled by:** ${proto.handledBy.map(s => `\`${s}\``).join(', ')}`);
      }

      if (proto.payload && Object.keys(proto.payload).length) {
        lines.push('\n**Payload fields:**\n');
        lines.push('| Field | Type | Required | Constraints |');
        lines.push('|-------|------|:--------:|-------------|');
        for (const [field, rule] of Object.entries(proto.payload)) {
          const type  = typeof rule === 'string' ? rule : (rule.type || 'any');
          const req   = typeof rule === 'object' && rule.required ? '✓' : '';
          const notes = typeof rule === 'object'
            ? [
                rule.min  !== undefined ? `min: ${rule.min}` : '',
                rule.max  !== undefined ? `max: ${rule.max}` : '',
                rule.enum             ? `enum: [${rule.enum.join(', ')}]` : '',
                rule.pattern          ? `pattern: \`${rule.pattern}\`` : '',
              ].filter(Boolean).join('; ')
            : '';
          lines.push(`| \`${field}\` | \`${type}\` | ${req} | ${notes} |`);
        }
      }

      lines.push('\n---');
    }
    return lines.join('\n');
  }

  MajixEvents.defineProtocol       = defineProtocol;
  MajixEvents.removeProtocol       = removeProtocol;
  MajixEvents.getProtocol          = getProtocol;
  MajixEvents.listProtocols        = listProtocols;
  MajixEvents.generateProtocolDocs = generateProtocolDocs;

  // ══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK  &  DIAGNOSTICS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Returns a diagnostic snapshot of the current bus state.
  //
  // Usage:
  //   const h = MajixEvents.health();
  //   if (h.status !== 'ok') console.warn(h.warnings);
  //
  //   MajixEvents.diagnose();  // pretty-print to console
  //
  // ── health() return shape ────────────────────────────────────────────────
  //
  //   {
  //     status:         'ok' | 'warn' | 'error'
  //     version:        string
  //     subscriptions:  number   — total active subscriptions
  //     events:         number   — distinct subscribed event patterns
  //     historySize:    number   — in-memory history entry count
  //     middleware:     number   — installed middleware functions
  //     plugins:        string[] — installed plugin names
  //     broadcastOpen:  boolean  — BroadcastChannel open
  //     idbOpen:        boolean  — IndexedDB open
  //     metricsEnabled: boolean
  //     tracingEnabled: boolean
  //     batchDepth:     number   — nested batch depth (0 = not batching)
  //     batchQueued:    number   — queued events waiting for batch flush
  //     schedules:      number   — active schedule handles
  //     protocols:      number   — registered protocol definitions
  //     schemas:        number   — registered validation schemas
  //     queues:         number   — named event queues
  //     warnings:       string[] — advisory messages
  //   }

  /**
   * Return a health/diagnostic snapshot.
   * @returns {object}
   */
  function health() {
    const warnings  = [];
    const subsTotal = count();

    if (subsTotal > _cfg.maxListeners * 5) {
      warnings.push(`High subscription count: ${subsTotal} (maxListeners=${_cfg.maxListeners})`);
    }
    if (_history.length >= _cfg.historyLimit) {
      warnings.push(`History at capacity: ${_history.length}/${_cfg.historyLimit}`);
    }
    if (_batchDepth > 0) {
      warnings.push(`Batch transaction in progress (depth=${_batchDepth}, queued=${_batchQueue.length})`);
    }
    if (_middleware.length > 20) {
      warnings.push(`Unusually high middleware count: ${_middleware.length}`);
    }

    return {
      status:         warnings.length === 0 ? 'ok' : 'warn',
      version:        VERSION,
      subscriptions:  subsTotal,
      events:         listEvents().length,
      historySize:    _history.length,
      middleware:     _middleware.length,
      plugins:        Array.from(_plugins.keys()),
      broadcastOpen:  _channel !== null,
      idbOpen:        _idb !== null,
      metricsEnabled: _cfg.metrics,
      tracingEnabled: _tracingEnabled,
      batchDepth:     _batchDepth,
      batchQueued:    _batchQueue.length,
      schedules:      _schedules.size,
      protocols:      _protocols.size,
      schemas:        _schemas.size,
      queues:         _queues.size,
      warnings,
    };
  }

  /**
   * Pretty-print a diagnostic summary to the console.
   */
  function diagnose() {
    const h    = health();
    const pad  = (s, n) => String(s).padEnd(n);
    const box  = (label, value) => `║  ${pad(label + ':', 16)} ${pad(value, 20)} ║`;

    const lines = [
      `\n╔══════════════════════════════════════╗`,
      `║   MajixEvents Diagnostics v${pad(h.version, 10)} ║`,
      `╠══════════════════════════════════════╣`,
      box('Status',        h.status),
      box('Subscriptions', h.subscriptions),
      box('Events',        h.events),
      box('History',       `${h.historySize} / ${_cfg.historyLimit}`),
      box('Middleware',    h.middleware),
      box('Plugins',       h.plugins.length),
      box('Schedules',     h.schedules),
      box('Broadcast',     h.broadcastOpen ? 'open' : 'closed'),
      box('IDB',           h.idbOpen ? 'open' : 'closed'),
      box('Metrics',       h.metricsEnabled ? 'on' : 'off'),
      box('Tracing',       h.tracingEnabled ? 'on' : 'off'),
      box('Protocols',     h.protocols),
      box('Schemas',       h.schemas),
      box('Queues',        h.queues),
    ];

    if (h.plugins.length) {
      lines.push(`╠══════════════════════════════════════╣`);
      lines.push(`║  Installed plugins:                  ║`);
      h.plugins.forEach(p => lines.push(`║    ${pad(p, 34)} ║`));
    }

    if (h.warnings.length) {
      lines.push(`╠══════════════════════════════════════╣`);
      lines.push(`║  ⚠ Warnings:                         ║`);
      h.warnings.forEach(w => lines.push(`║    ${pad(w.slice(0, 34), 34)} ║`));
    }

    lines.push(`╚══════════════════════════════════════╝\n`);
    console.log(lines.join('\n'));
  }

  MajixEvents.health   = health;
  MajixEvents.diagnose = diagnose;

  // ══════════════════════════════════════════════════════════════════════════
  // TESTING UTILITIES
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Helpers for unit-testing code that uses MajixEvents.
  //
  // ── spy(event) ────────────────────────────────────────────────────────────
  //
  //   Capture all emissions of event.
  //   Returns:
  //     { calls,          — array of { payload, event, ts }
  //       callCount,      — number of calls so far
  //       calledWith(p),  — true if any call had payload matching p
  //       reset(),        — clear recorded calls
  //       restore() }     — unsubscribe the spy
  //
  // ── mock(event, returnValue) ──────────────────────────────────────────────
  //
  //   Replace all handlers for event with a mock returning returnValue.
  //   Returns { restore() }.
  //
  // ── assertEmitted(event [, n]) ────────────────────────────────────────────
  //
  //   Throws AssertionError if event was not emitted at least n times in
  //   in-memory history.  n defaults to 1.
  //
  // ── waitForEvent(event [, timeout]) ─────────────────────────────────────
  //
  //   Alias for MajixEvents.next(event, timeout).
  //   Returns a Promise that resolves with the next payload.
  //
  // ── sandbox() ─────────────────────────────────────────────────────────────
  //
  //   Create an isolated test sandbox.  All subscriptions created through
  //   the sandbox are cleaned up when sandbox.restore() is called.
  //   Returns an object with { on, once, spy, mock, emit, emitSync, restore }.
  //
  // ── Example (jest) ────────────────────────────────────────────────────────
  //
  //   let box;
  //   beforeEach(() => { box = MajixEvents.sandbox(); });
  //   afterEach(()  => { box.restore(); MajixEvents.clearHistory(); });
  //
  //   it('emits user:created on registration', async () => {
  //     const s = box.spy('user:created');
  //     await register({ username: 'alice' });
  //     expect(s.callCount).toBe(1);
  //     expect(s.calledWith({ username: 'alice' })).toBe(true);
  //   });

  /**
   * Create a spy for an event.
   * @param {string} rawEvent
   * @returns {object}
   */
  function spy(rawEvent) {
    const calls = [];
    const unsub = on(rawEvent, (payload, event) => {
      calls.push({ payload, event, ts: Date.now() });
    });

    const eqKey = (p) => { try { return JSON.stringify(p); } catch { return String(p); } };

    return {
      get calls()     { return calls.slice(); },
      get callCount() { return calls.length; },
      reset()         { calls.length = 0; },
      restore()       { unsub(); },
      calledWith(expected) {
        return calls.some(c => eqKey(c.payload) === eqKey(expected));
      },
      lastCall()   { return calls[calls.length - 1] || null; },
      firstCall()  { return calls[0] || null; },
    };
  }

  /**
   * Replace handlers for an event with a mock.
   * @param {string} rawEvent
   * @param {*}      returnValue
   * @returns {{ restore: Function }}
   */
  function mock(rawEvent, returnValue) {
    const event  = _qualify(rawEvent);
    const backup = (_listeners.get(event) || []).slice();
    _listeners.delete(event);
    const unsub  = on(rawEvent, () => returnValue);
    return {
      restore() {
        unsub();
        if (backup.length > 0) _listeners.set(event, backup);
        else _listeners.delete(event);
      },
    };
  }

  /**
   * Assert that event was emitted at least n times.
   * @param {string} rawEvent
   * @param {number} [n=1]
   * @throws {Error}
   */
  function assertEmitted(rawEvent, n) {
    const min     = n !== undefined ? n : 1;
    const entries = history(_qualify(rawEvent));
    if (entries.length < min) {
      throw new Error(
        `[MajixEvents.assertEmitted] "${rawEvent}" was emitted ${entries.length} time(s) ` +
        `but expected at least ${min}.`
      );
    }
  }

  /**
   * Create a test sandbox.
   * @returns {object}
   */
  function sandbox() {
    const unsubs = [];

    return {
      on(event, handler, opts) {
        const u = MajixEvents.on(event, handler, opts);
        unsubs.push(u);
        return u;
      },
      once(event, handler, opts) {
        const u = MajixEvents.once(event, handler, opts);
        unsubs.push(u);
        return u;
      },
      spy(event) {
        const s = MajixEvents.spy(event);
        unsubs.push(() => s.restore());
        return s;
      },
      mock(event, rv) {
        const m = MajixEvents.mock(event, rv);
        unsubs.push(() => m.restore());
        return m;
      },
      emit:     (...args) => MajixEvents.emit(...args),
      emitSync: (...args) => MajixEvents.emitSync(...args),
      restore() {
        unsubs.forEach(u => { try { u(); } catch { /* ignore */ } });
        unsubs.length = 0;
      },
    };
  }

  MajixEvents.spy           = spy;
  MajixEvents.mock          = mock;
  MajixEvents.assertEmitted = assertEmitted;
  MajixEvents.sandbox       = sandbox;
  MajixEvents.waitForEvent  = next;


  // ══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE OPTIMISATION GUIDE
  // ══════════════════════════════════════════════════════════════════════════
  //
  // MajixEvents is engineered for low-latency dispatch, but at scale there are
  // several practices that can further improve throughput and memory usage.
  //
  // ── Subscription hygiene ──────────────────────────────────────────────────
  //
  //   • Always store and call the unsubscribe function returned by on():
  //       const unsub = MajixEvents.on('my:event', handler);
  //       // … later …
  //       unsub();
  //     Failing to unsubscribe is the most common source of memory leaks.
  //
  //   • Use once() for one-shot initialisation instead of manually calling
  //     off() inside the handler.
  //
  //   • Group related subscriptions with a shared tag and use offByTag():
  //       MajixEvents.on('click', h1, { tag: 'pageA' });
  //       MajixEvents.on('hover', h2, { tag: 'pageA' });
  //       // …
  //       MajixEvents.offByTag('pageA');  // removes both at once
  //
  //   • Use takeUntil() to automatically unsubscribe when a lifecycle event fires:
  //       MajixEvents.takeUntil('data:stream', 'view:destroyed', handleData);
  //
  // ── Wildcard cost ─────────────────────────────────────────────────────────
  //
  //   Wildcards ('*', 'ns:*', 'ns:foo*') are compiled to RegExp and cached.
  //   The first match after startup incurs compilation cost; subsequent matches
  //   are cached lookups.  For hot paths, prefer exact event names.
  //
  //   Pattern cache is shared: if you have 1,000 unique wildcard patterns the
  //   cache grows to 1,000 entries.  Call MajixEvents._patternCache.clear()
  //   (internal) if memory is a concern after a major route change.
  //
  // ── Middleware cost ───────────────────────────────────────────────────────
  //
  //   Each emit() call walks the entire middleware chain with async awaiting.
  //   Keep middleware lean.  For CPU-only work (logging, stamping) consider
  //   a synchronous tap() subscriber on '*' instead, which avoids the async
  //   overhead entirely:
  //     MajixEvents.tap('*', (payload, event) => logger.log(event, payload));
  //
  // ── History limit ────────────────────────────────────────────────────────
  //
  //   History is capped at historyLimit entries.  If you never replay history,
  //   set historyLimit: 0 in config to disable history recording entirely:
  //     MajixEvents.configure({ historyLimit: 0 });
  //
  // ── Metrics overhead ─────────────────────────────────────────────────────
  //
  //   enableMetrics(true) adds a Date.now() call and several map lookups per
  //   dispatch.  Keep disabled in production unless you specifically need
  //   timing data.
  //
  // ── Batching ─────────────────────────────────────────────────────────────
  //
  //   When emitting many events in a tight loop, wrapping them in batch()
  //   prevents intermediate subscribers from seeing partial state:
  //     await MajixEvents.batch(() => {
  //       for (const item of items) MajixEvents.emit('item:added', item);
  //     });
  //
  //   This also avoids redundant DOM re-renders when multiple events would
  //   each trigger a UI update.
  //
  // ── emitSync vs emit ──────────────────────────────────────────────────────
  //
  //   emitSync() skips middleware and Promise overhead entirely.  Use it
  //   for synchronous hot paths (e.g. high-frequency mouse events, render
  //   ticks) where middleware is not needed:
  //     MajixEvents.emitSync('render:tick', { ts: Date.now() });
  //
  // ── Priority tuning ──────────────────────────────────────────────────────
  //
  //   Handler lists are kept in descending priority order (stable sort by id).
  //   High-priority handlers (priority: 10) run first and can cancel further
  //   dispatch by throwing a special sentinel (future v3 API).
  //   Low-priority handlers (priority: -10) are useful for cleanup and logging
  //   that should never interfere with business logic.
  //
  // ── Large payloads ───────────────────────────────────────────────────────
  //
  //   Payloads are passed by reference — handlers receive the same object.
  //   If handlers must not mutate the payload, enable the 'immutable' plugin:
  //     MajixEvents.plugin(MajixEvents.plugins.immutable);
  //   This deep-freezes every payload before delivery.  There is a cost:
  //   deep-freeze walks the entire object tree.  For large payloads,
  //   consider only freezing at the outermost level in your own middleware.
  //
  // ── Broadcast channel throttling ─────────────────────────────────────────
  //
  //   BroadcastChannel messages go through the structured-clone algorithm.
  //   Very large payloads (>1 MB) may block for noticeable periods.
  //   Use throttle() on the emitting side, or only broadcast summary data.
  //
  // ══════════════════════════════════════════════════════════════════════════
  // SECURITY CONSIDERATIONS
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ── Schema validation ─────────────────────────────────────────────────────
  //
  //   Validate all externally-originated payloads (from iframes, workers,
  //   or broadcast messages) before acting on them.  Register schemas for
  //   sensitive event types and set schemaMode: 'throw' or 'drop':
  //
  //     MajixEvents.setSchemaMode('drop');
  //     MajixEvents.defineSchema('auth:token', {
  //       token: { type: 'string', pattern: '^[A-Za-z0-9._-]+$', required: true },
  //     });
  //
  // ── postMessage origin ────────────────────────────────────────────────────
  //
  //   Always specify the expected origin in connectFrame():
  //     MajixEvents.connectFrame(iframe, { origin: 'https://trusted.example.com' });
  //   Using origin: '*' allows any page to inject events into your bus.
  //
  // ── Sensitive payloads ───────────────────────────────────────────────────
  //
  //   Do not emit passwords, tokens, or PII as event payloads.  Handlers
  //   may be inspected via history(), stored in localStorage, or forwarded
  //   to other tabs via broadcast.
  //   Use a dedicated encrypted store and emit only identifiers (e.g. userId)
  //   rather than raw credentials.
  //
  // ── Prototype pollution ───────────────────────────────────────────────────
  //
  //   If handling events from untrusted sources, validate that payload keys
  //   do not include '__proto__', 'constructor', or 'prototype'.  The
  //   schema validator can detect this with a custom validator:
  //
  //     MajixEvents.defineSchema('external:data', {
  //       data: {
  //         validator: (v) => {
  //           if (v && typeof v === 'object') {
  //             const keys = Object.keys(v);
  //             if (keys.some(k => ['__proto__','constructor','prototype'].includes(k))) {
  //               return 'Prototype pollution attempt detected';
  //             }
  //           }
  //           return true;
  //         }
  //       }
  //     });
  //
  // ── IndexedDB data ────────────────────────────────────────────────────────
  //
  //   Data written to IndexedDB persists indefinitely and is accessible to
  //   any script running on the same origin.  Use clearIdb() on logout or
  //   session end to remove sensitive event records.
  //
  // ── localStorage data ────────────────────────────────────────────────────
  //
  //   Persisted events are stored as plain JSON in localStorage under the
  //   configured persistKey prefix.  Any script on the same origin can read
  //   them.  Avoid persisting payloads that contain credentials or PII.
  //   Use clearPersisted() on session end.
  //
  // ══════════════════════════════════════════════════════════════════════════
  // MIGRATION GUIDE  ──  v1 → v2
  // ══════════════════════════════════════════════════════════════════════════
  //
  // v2 is backwards-compatible for the core API (on/once/off/emit/emitSync).
  // The following changes may require attention:
  //
  // ── Breaking changes ──────────────────────────────────────────────────────
  //
  //   1. emit() now always returns a Promise<Array>.
  //      v1: const results = emit('event', data);   // array
  //      v2: const results = await emit('event', data);  // Promise<array>
  //      Fix: add await, or use emitSync() if synchronous return is needed.
  //
  //   2. Middleware signature changed to (event, payload, next) => void.
  //      v1: use(mw)  where mw = (event, payload) => newPayload
  //      v2: use(mw)  where mw = (event, payload, next) => { next(newPayload); }
  //      Fix: wrap return value in next() call.
  //
  //   3. History entries now include a seq field.
  //      v1: { event, payload, ts }
  //      v2: { event, payload, ts, seq }
  //      Fix: update any code that destructures history entries.
  //
  //   4. off() no longer accepts an options object; only (event, handler).
  //      Fix: use offById(id) or offByTag(tag) for group removal.
  //
  // ── New additions (no changes needed) ────────────────────────────────────
  //
  //   • offById, offByTag, offAll, count, listEvents
  //   • emitMany, emitParallel
  //   • unuse, clearMiddleware
  //   • historyFor, historySince, historyBetween, historyFrom
  //   • exportHistory, importHistory
  //   • replayAll
  //   • throttle options { leading, trailing }
  //   • debounce returns { unsubscribe, cancel, flush }
  //   • throttle returns { unsubscribe, cancel }
  //   • delay, sample, audit
  //   • filter, map, tap
  //   • buffer, window
  //   • ask, answer
  //   • scope() → EventScope
  //   • merge, zip, race, combineLatest, sequence
  //   • createQueue
  //   • dedupeOn
  //   • createRouter
  //   • defineSchema, validate, setSchemaMode
  //   • enableMetrics, metrics, metricsAll, resetMetrics
  //   • plugin, plugins.{logger,timestamp,immutable,retry,circuitBreaker,perf}
  //   • next, toAsyncIterable, scan, countEmissions, distinct, take, skip
  //   • takeUntil, pairwise, startWith, switchMap, mergeMap, exhaustMap
  //   • clearPersisted, queryIdb, clearIdb
  //   • snapshot, restore
  //   • connectWorker, connectFrame
  //   • batch
  //   • EventEmitter
  //   • createStore, Store
  //   • createCommandBus, CommandBus
  //   • createAggregate, Aggregate
  //   • createEventStore, EventSourceStore
  //   • enableTracing, emitTraced, getTrace, clearTraces
  //   • schedule, scheduleAll, stopAllSchedules
  //   • defineProtocol, getProtocol, listProtocols, generateProtocolDocs
  //   • health, diagnose
  //   • spy, mock, assertEmitted, waitForEvent, sandbox
  //
  // ══════════════════════════════════════════════════════════════════════════
  // RECIPES  ──  common patterns and complete examples
  // ══════════════════════════════════════════════════════════════════════════
  //
  // ── Recipe 1: Application initialisation sequence ─────────────────────────
  //
  //   MajixEvents.sequence([
  //     { event: 'config:loaded',  handler: async (cfg) => { applyConfig(cfg); } },
  //     { event: 'db:connected',   handler: async ()    => { await createSchema(); } },
  //     { event: 'auth:ready',     handler: async ()    => { renderApp(); } },
  //   ]);
  //   // Elsewhere, emit each event when its step completes:
  //   await MajixEvents.emit('config:loaded', loadedConfig);
  //   await MajixEvents.emit('db:connected');
  //   await MajixEvents.emit('auth:ready');
  //
  // ── Recipe 2: Real-time search with debounce ───────────────────────────────
  //
  //   const searchScope = MajixEvents.scope('search');
  //
  //   const { unsubscribe } = searchScope.debounce('query', async ({ q }) => {
  //     const results = await api.search(q);
  //     await searchScope.emit('results', results);
  //   }, 300);
  //
  //   inputEl.addEventListener('input', e =>
  //     searchScope.emit('query', { q: e.target.value }));
  //
  //   searchScope.on('results', renderResults);
  //
  //   // Cleanup on unmount
  //   unsubscribe();
  //   searchScope.destroy();
  //
  // ── Recipe 3: Request / response pattern ─────────────────────────────────
  //
  //   // In a data service module:
  //   MajixEvents.answer('user:fetch', async ({ userId }, reply) => {
  //     const user = await db.users.find(userId);
  //     reply(user);
  //   });
  //
  //   // In a component:
  //   const user = await MajixEvents.ask('user:fetch', { userId: 42 }, 3000);
  //   renderUser(user);
  //
  // ── Recipe 4: Cross-tab shopping cart ─────────────────────────────────────
  //
  //   // Persist cart events and broadcast to all tabs:
  //   MajixEvents.on('cart:item:added', payload => {
  //     updateLocalUI(payload);
  //   });
  //
  //   async function addToCart(item) {
  //     await MajixEvents.emit('cart:item:added', item, {
  //       broadcast: true,
  //       persist:   true,
  //     });
  //   }
  //
  //   // On page load, replay persisted cart events to restore state:
  //   MajixEvents.configure({ persist: true });
  //   MajixEvents.replay('cart:item:added', payload => {
  //     cart.items.push(payload);
  //   });
  //
  // ── Recipe 5: Event-driven state with time travel ─────────────────────────
  //
  //   const counterStore = MajixEvents.createStore('counter', { value: 0 }, {
  //     INC:   (s, { by = 1 }) => ({ value: s.value + by }),
  //     DEC:   (s, { by = 1 }) => ({ value: s.value - by }),
  //     RESET: ()              => ({ value: 0 }),
  //   });
  //
  //   // Subscribe to state changes:
  //   counterStore.subscribe((newState) => {
  //     document.getElementById('counter').textContent = newState.value;
  //   });
  //
  //   // Dispatch actions:
  //   counterStore.dispatch('INC', { by: 5 });
  //   counterStore.dispatch('INC');
  //   counterStore.dispatch('DEC', { by: 2 });
  //   // state = { value: 4 }
  //
  //   // Time-travel to the second history entry:
  //   counterStore.travelTo(1);
  //   // state = { value: 5 }
  //
  // ── Recipe 6: CQRS with command bus + event store ─────────────────────────
  //
  //   const commands = MajixEvents.createCommandBus();
  //   const events   = MajixEvents.createEventStore();
  //
  //   const order = MajixEvents.createAggregate('Order-42', {
  //     OrderCreated:  (s, p) => ({ ...s, ...p, status: 'created' }),
  //     OrderShipped:  (s, p) => ({ ...s, trackingId: p.trackingId, status: 'shipped' }),
  //   }, { status: 'new' });
  //
  //   commands.register('CreateOrder', async (payload) => {
  //     order.apply({ type: 'OrderCreated', payload });
  //     events.append('Order-42', order.getUncommitted());
  //     order.markCommitted();
  //     await MajixEvents.emit('order:created', order.getState());
  //     return order.getState();
  //   });
  //
  //   const newOrder = await commands.dispatch('CreateOrder', {
  //     orderId: 42, items: [{ sku: 'ABC', qty: 1 }], total: 49.99
  //   });
  //
  // ── Recipe 7: Distributed tracing across services ─────────────────────────
  //
  //   MajixEvents.enableTracing({ maxTraces: 200 });
  //
  //   // Root emission (starts a new trace)
  //   const { context: rootCtx } = await MajixEvents.emitTraced(
  //     'request:received', { method: 'POST', path: '/orders' }
  //   );
  //
  //   // Child emissions (linked to the root trace)
  //   const { context: authCtx } = await MajixEvents.emitTraced(
  //     'auth:check', { token: '...' }, rootCtx
  //   );
  //   await MajixEvents.emitTraced('db:query', { table: 'orders' }, authCtx);
  //
  //   // Inspect the entire trace
  //   const spans = MajixEvents.getTrace(rootCtx.traceId);
  //   console.log(spans.map(s => s.event));
  //   // ['ns:request:received', 'ns:auth:check', 'ns:db:query']
  //
  // ── Recipe 8: Hot configuration reload ───────────────────────────────────
  //
  //   // Register protocol for validation
  //   MajixEvents.defineProtocol('config:reload', {
  //     description: 'Trigger a configuration reload from the remote source.',
  //     payload: {
  //       source: { type: 'string', enum: ['remote', 'local', 'env'], required: true },
  //       force:  { type: 'boolean' },
  //     },
  //     since: '2.0.0',
  //   });
  //
  //   MajixEvents.setSchemaMode('drop');  // silently ignore invalid requests
  //
  //   MajixEvents.on('config:reload', async ({ source }) => {
  //     const cfg = await loadConfig(source);
  //     MajixEvents.configure(cfg.events || {});
  //     await MajixEvents.emit('config:reloaded', cfg);
  //   });
  //
  //   // Schedule a config refresh every 5 minutes
  //   MajixEvents.schedule('config:reload', { source: 'remote' }, { interval: 300_000 });
  //
  // ── Recipe 9: Worker pool with event bus ──────────────────────────────────
  //
  //   const workers = [new Worker('/workers/task.js'), new Worker('/workers/task.js')];
  //
  //   const bridges = workers.map((w, i) =>
  //     MajixEvents.connectWorker(w, { events: ['task:assign', 'task:cancel'] })
  //   );
  //
  //   MajixEvents.on('task:complete', ({ taskId, result }) => {
  //     db.save(taskId, result);
  //   });
  //
  //   // Distribute tasks to workers via events (workers emit 'task:complete' when done)
  //   await MajixEvents.emit('task:assign', { taskId: 1, data: heavyPayload });
  //
  //   // Cleanup
  //   bridges.forEach(b => b.disconnect());
  //
  // ── Recipe 10: Snapshot/restore for offline resilience ────────────────────
  //
  //   // On page unload: save a snapshot
  //   window.addEventListener('beforeunload', () => {
  //     const snap = MajixEvents.snapshot();
  //     sessionStorage.setItem('eventsSnapshot', snap);
  //   });
  //
  //   // On page load: restore the snapshot
  //   const saved = sessionStorage.getItem('eventsSnapshot');
  //   if (saved) {
  //     MajixEvents.restore(saved);
  //     // Replay any unhandled events
  //     MajixEvents.replayAll();
  //   }
  //
  // ── Recipe 11: Stream operators pipeline ─────────────────────────────────
  //
  //   // Build a reactive data pipeline:
  //   // rawClicks → deduplicated → throttled at 60fps → mapped to coords
  //   //          → filtered to canvas area → rendered
  //
  //   MajixEvents.dedupeOn('ui:rawClick', null, 16);
  //
  //   const { unsubscribe: unthrottle } = MajixEvents.throttle(
  //     'ui:rawClick', (p) => {
  //       MajixEvents.emit('ui:click', { x: p.clientX, y: p.clientY });
  //     }, 16   // ~60 fps
  //   );
  //
  //   MajixEvents.filter('ui:click',
  //     ({ x, y }) => x >= 0 && x < canvasW && y >= 0 && y < canvasH,
  //     (coords) => renderer.drawDot(coords)
  //   );
  //
  // ── Recipe 12: A/B testing with router ───────────────────────────────────
  //
  //   const router = MajixEvents.createRouter({
  //     'experiment:action': [
  //       {
  //         when: (p) => p.userId % 2 === 0,
  //         target: 'experiment:variantA',
  //       },
  //       {
  //         when: (p) => p.userId % 2 !== 0,
  //         target: 'experiment:variantB',
  //       },
  //     ],
  //   });
  //
  //   router.start();
  //
  //   MajixEvents.on('experiment:variantA', handleVariantA);
  //   MajixEvents.on('experiment:variantB', handleVariantB);
  //
  //   await MajixEvents.emit('experiment:action', { userId: 42, type: 'buttonClick' });
  //   // → routes to 'experiment:variantA' since 42 is even
  //
  //   router.stop();
  //
  // ══════════════════════════════════════════════════════════════════════════
  // TYPED EVENT REGISTRY  (runtime type-safe subscriptions)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // TypedEventRegistry provides a way to register event type mappings at
  // runtime and look them up for documentation / auto-complete tooling.
  //
  // Usage:
  //   const registry = MajixEvents.createTypedRegistry();
  //   registry.register('user:login', { userId: 'number', username: 'string' });
  //   registry.get('user:login');    // → { userId: 'number', username: 'string' }
  //   registry.list();               // → [ { event, types } ]
  //   registry.validate('user:login', payload);   // → { valid, errors }
  //
  // This is a runtime complement to TypeScript interface declarations.  In a
  // TypeScript project, prefer interface-based typing.

  /**
   * Create a typed event registry.
   * @returns {TypedEventRegistry}
   */
  function createTypedRegistry() {
    return new TypedEventRegistry();
  }

  class TypedEventRegistry {
    constructor() {
      /** @type {Map<string, object>} event → type map */
      this._types = new Map();
    }

    /**
     * Register type information for an event.
     * @param {string} rawEvent
     * @param {object} types   — { fieldName: typeName }
     * @returns {this}
     */
    register(rawEvent, types) {
      this._types.set(_qualify(rawEvent), types);
      return this;
    }

    /**
     * Retrieve type information for an event.
     * @param {string} rawEvent
     * @returns {object|null}
     */
    get(rawEvent) {
      return this._types.get(_qualify(rawEvent)) || null;
    }

    /**
     * List all registered event type mappings.
     * @returns {Array<{ event: string, types: object }>}
     */
    list() {
      return Array.from(this._types.entries()).map(([event, types]) => ({ event, types }));
    }

    /**
     * Validate a payload against the registered type map for an event.
     * Only checks typeof; does not support nested types.
     * @param {string} rawEvent
     * @param {*}      payload
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(rawEvent, payload) {
      const types  = this.get(rawEvent);
      const errors = [];
      if (!types) return { valid: true, errors };

      for (const [field, expectedType] of Object.entries(types)) {
        const value = payload != null ? payload[field] : undefined;
        if (expectedType === 'array') {
          if (!Array.isArray(value)) {
            errors.push(`Field "${field}": expected array, got ${typeof value}`);
          }
        } else if (typeof value !== expectedType) {
          errors.push(`Field "${field}": expected ${expectedType}, got ${typeof value}`);
        }
      }

      return { valid: errors.length === 0, errors };
    }

    /** Generate a markdown table documenting all registered types. */
    generateDocs() {
      const lines = ['# Typed Event Registry\n'];
      for (const { event, types } of this.list()) {
        lines.push(`## \`${event}\`\n`);
        lines.push('| Field | Type |');
        lines.push('|-------|------|');
        for (const [field, type] of Object.entries(types)) {
          lines.push(`| \`${field}\` | \`${type}\` |`);
        }
        lines.push('');
      }
      return lines.join('\n');
    }

    /** Remove all registrations. */
    clear() { this._types.clear(); }
  }

  MajixEvents.createTypedRegistry = createTypedRegistry;
  MajixEvents.TypedEventRegistry  = TypedEventRegistry;

  // ══════════════════════════════════════════════════════════════════════════
  // CIRCUIT-BREAKER  (standalone helper, complements the plugin)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // A standalone per-event circuit-breaker that wraps subscriptions rather than
  // middleware.  Useful when you need fine-grained control over which specific
  // handler is protected.
  //
  // Usage:
  //   const cb = MajixEvents.createCircuitBreaker('payments:process', handler, {
  //     threshold:  3,      // open after 3 consecutive errors
  //     resetMs:    60000,  // auto-reset after 60 s
  //     onOpen:     () => alertOps('payments circuit open!'),
  //     onClose:    () => alertOps('payments circuit closed'),
  //   });
  //   cb.stop();            // unsubscribe
  //   cb.state              // 'closed' | 'open' | 'half-open'
  //   cb.reset()            // manually reset to 'closed'

  /**
   * Create a per-subscription circuit breaker.
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {object}   [options]
   * @param {number}   [options.threshold=5]   — consecutive errors before opening
   * @param {number}   [options.resetMs=30000] — ms after which to try half-open
   * @param {Function} [options.onOpen]        — called when circuit opens
   * @param {Function} [options.onClose]       — called when circuit closes
   * @returns {{ state: string, reset: Function, stop: Function }}
   */
  function createCircuitBreaker(rawEvent, handler, options) {
    const opts         = Object.assign({ threshold: 5, resetMs: 30000 }, options);
    let   errors       = 0;
    let   state        = 'closed';    // 'closed' | 'open' | 'half-open'
    let   openedAt     = null;

    const unsub = on(rawEvent, (payload, event) => {
      // Check if circuit should transition to half-open
      if (state === 'open') {
        if (Date.now() - openedAt >= opts.resetMs) {
          state = 'half-open';
        } else {
          return;  // drop
        }
      }

      try {
        const result = handler(payload, event);
        // On success, close the circuit
        if (state === 'half-open') {
          state  = 'closed';
          errors = 0;
          if (typeof opts.onClose === 'function') opts.onClose();
        } else {
          errors = 0;  // reset on success
        }
        return result;
      } catch (err) {
        errors++;
        if (errors >= opts.threshold && state !== 'open') {
          state    = 'open';
          openedAt = Date.now();
          if (typeof opts.onOpen === 'function') opts.onOpen(err);
        }
        _handleError(err, event, payload);
      }
    });

    return {
      get state()  { return state; },
      reset() {
        state    = 'closed';
        errors   = 0;
        openedAt = null;
      },
      stop() { unsub(); },
    };
  }

  MajixEvents.createCircuitBreaker = createCircuitBreaker;

  // ══════════════════════════════════════════════════════════════════════════
  // RATE LIMITER
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Token-bucket rate limiter for event handlers.  Prevents a runaway emitter
  // from overwhelming subscribers.
  //
  // Usage:
  //   const rl = MajixEvents.rateLimitOn('api:request', handler, {
  //     rate:     10,    // max 10 calls
  //     per:      1000,  // per 1000 ms
  //     onLimit:  (payload) => logger.warn('rate limited', payload),
  //   });
  //   rl.stop();         // unsubscribe

  /**
   * Subscribe with a token-bucket rate limiter.
   * @param {string}   rawEvent
   * @param {Function} handler
   * @param {object}   [options]
   * @param {number}   [options.rate=10]     — max calls allowed
   * @param {number}   [options.per=1000]    — per N milliseconds
   * @param {Function} [options.onLimit]     — called when rate limit is hit
   * @returns {{ stop: Function, stats: Function }}
   */
  function rateLimitOn(rawEvent, handler, options) {
    const opts      = Object.assign({ rate: 10, per: 1000 }, options);
    let   tokens    = opts.rate;
    let   lastFill  = Date.now();
    let   limitHits = 0;
    let   totalCalls = 0;

    const unsub = on(rawEvent, (payload, event) => {
      const now     = Date.now();
      const elapsed = now - lastFill;

      // Refill tokens proportionally to elapsed time
      if (elapsed >= opts.per) {
        tokens   = opts.rate;
        lastFill = now;
      } else {
        const refill = Math.floor((elapsed / opts.per) * opts.rate);
        tokens = Math.min(opts.rate, tokens + refill);
        if (refill > 0) lastFill = now;
      }

      if (tokens > 0) {
        tokens--;
        totalCalls++;
        return handler(payload, event);
      } else {
        limitHits++;
        if (typeof opts.onLimit === 'function') {
          try { opts.onLimit(payload, event); } catch { /* ignore */ }
        }
      }
    });

    return {
      stop() { unsub(); },
      stats() { return { tokens, totalCalls, limitHits }; },
      reset() { tokens = opts.rate; limitHits = 0; totalCalls = 0; lastFill = Date.now(); },
    };
  }

  MajixEvents.rateLimitOn = rateLimitOn;

  // ══════════════════════════════════════════════════════════════════════════
  // STALE-WHILE-REVALIDATE  CACHE PATTERN
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Serve stale (cached) data immediately while triggering a background
  // refresh.  A common pattern for UI data that needs to feel instant.
  //
  // Usage:
  //   MajixEvents.staleWhileRevalidate(
  //     'dashboard:data',           // event to listen on
  //     async () => fetchDashboard(), // revalidation function
  //     { ttl: 30000 }              // stale after 30 s
  //   );
  //
  //   // Subscribe to 'dashboard:data:fresh' for fresh data
  //   MajixEvents.on('dashboard:data:fresh', updateUI);
  //
  //   // Trigger from a button — serves cached version instantly, refreshes in bg
  //   await MajixEvents.emit('dashboard:data');

  /**
   * Set up a stale-while-revalidate caching pattern.
   * @param {string}   rawEvent          — trigger event
   * @param {Function} revalidateFn      — async () => freshPayload
   * @param {object}   [options]
   * @param {number}   [options.ttl=0]   — stale after N ms (0 = always revalidate)
   * @returns {{ stop: Function, invalidate: Function }}
   */
  function staleWhileRevalidate(rawEvent, revalidateFn, options) {
    const opts      = Object.assign({ ttl: 0 }, options);
    const event     = _qualify(rawEvent);
    let   cached    = null;
    let   cachedAt  = 0;
    let   fetching  = false;

    function isStale() {
      if (cached === null) return true;
      if (opts.ttl === 0) return true;
      return Date.now() - cachedAt > opts.ttl;
    }

    async function revalidate() {
      if (fetching) return;
      fetching = true;
      try {
        const fresh = await revalidateFn();
        cached     = fresh;
        cachedAt   = Date.now();
        await emit(`${event}:fresh`, fresh);
      } catch (err) {
        _handleError(err, `${event}:revalidate`, null);
      } finally {
        fetching = false;
      }
    }

    const unsub = on(rawEvent, (payload) => {
      // Serve stale data immediately if available
      if (cached !== null) {
        emit(`${event}:stale`, cached);
      }
      // Revalidate in background if stale
      if (isStale()) revalidate();
    });

    return {
      stop()       { unsub(); },
      invalidate() { cached = null; cachedAt = 0; },
      get cached() { return cached; },
    };
  }

  MajixEvents.staleWhileRevalidate = staleWhileRevalidate;

  // ══════════════════════════════════════════════════════════════════════════
  // UNDO / REDO  (command history)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Track invertible operations and support undo/redo via events.
  //
  // Usage:
  //   const um = MajixEvents.createUndoManager();
  //
  //   // When user performs an action, record it:
  //   um.record({
  //     do:   () => { items.push(newItem); emit('list:updated', items); },
  //     undo: () => { items.pop();         emit('list:updated', items); },
  //   });
  //
  //   // Undo / Redo
  //   await um.undo();  // emits 'undoManager:undo' with the reverted command
  //   await um.redo();  // emits 'undoManager:redo' with the re-applied command
  //
  //   um.canUndo   // boolean
  //   um.canRedo   // boolean
  //   um.clearHistory()

  /**
   * Create an undo manager.
   * @param {object} [options]
   * @param {number} [options.limit=50]  — max history length
   * @returns {UndoManager}
   */
  function createUndoManager(options) {
    return new UndoManager(options);
  }

  class UndoManager {
    /** @param {object} [opts] */
    constructor(opts) {
      this._opts  = Object.assign({ limit: 50 }, opts);
      this._past  = [];   // executed commands
      this._future = [];  // undone commands (available for redo)
    }

    /**
     * Execute and record a reversible command.
     * @param {{ do: Function, undo: Function }} command
     */
    async record(command) {
      if (typeof command.do !== 'function' || typeof command.undo !== 'function') {
        throw new TypeError('[UndoManager] command must have { do, undo } functions');
      }
      await command.do();
      this._past.push(command);
      this._future.length = 0;  // clear redo stack
      if (this._past.length > this._opts.limit) this._past.shift();
      await MajixEvents.emit('undoManager:record', { command });
    }

    /**
     * Undo the last command.
     * @returns {Promise<void>}
     */
    async undo() {
      const command = this._past.pop();
      if (!command) return;
      await command.undo();
      this._future.push(command);
      await MajixEvents.emit('undoManager:undo', { command });
    }

    /**
     * Redo the last undone command.
     * @returns {Promise<void>}
     */
    async redo() {
      const command = this._future.pop();
      if (!command) return;
      await command.do();
      this._past.push(command);
      await MajixEvents.emit('undoManager:redo', { command });
    }

    /** true if undo is available */
    get canUndo() { return this._past.length > 0; }

    /** true if redo is available */
    get canRedo() { return this._future.length > 0; }

    /** Clear all history. */
    clearHistory() { this._past.length = 0; this._future.length = 0; }
  }

  MajixEvents.createUndoManager = createUndoManager;
  MajixEvents.UndoManager       = UndoManager;

  // ══════════════════════════════════════════════════════════════════════════
  // PRESENCE  (online/offline status sharing)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Track which "participants" (users, sessions, tabs) are currently online
  // by using heartbeat events over BroadcastChannel.
  //
  // Usage:
  //   const presence = MajixEvents.createPresence('session-abc', {
  //     heartbeatInterval: 5000,
  //     timeoutMs:         15000,
  //   });
  //   presence.start();
  //
  //   MajixEvents.on('presence:joined',  ({ id })  => console.log(id, 'joined'));
  //   MajixEvents.on('presence:left',    ({ id })  => console.log(id, 'left'));
  //   MajixEvents.on('presence:list',    (list)    => renderOnlineUsers(list));
  //
  //   presence.getList()  // → ['session-abc', 'session-xyz', …]
  //   presence.stop()

  /**
   * Create a presence tracker using BroadcastChannel heartbeats.
   * @param {string} participantId   — unique ID for this participant
   * @param {object} [options]
   * @param {number} [options.heartbeatInterval=5000]  — ms between heartbeats
   * @param {number} [options.timeoutMs=15000]         — ms before a participant is considered offline
   * @returns {Presence}
   */
  function createPresence(participantId, options) {
    return new Presence(participantId, options);
  }

  class Presence {
    /**
     * @param {string} id
     * @param {object} [opts]
     */
    constructor(id, opts) {
      this.id             = id;
      this._opts          = Object.assign({ heartbeatInterval: 5000, timeoutMs: 15000 }, opts);
      /** @type {Map<string, number>} participantId → last-seen ts */
      this._participants  = new Map();
      this._heartbeatTimer = null;
      this._pruneTimer     = null;
      this._started        = false;
    }

    /** Start broadcasting and listening. */
    start() {
      if (this._started) return;
      this._started = true;

      // Listen for heartbeats from other participants
      MajixEvents.on('presence:heartbeat', ({ id }) => {
        const wasPresent = this._participants.has(id);
        this._participants.set(id, Date.now());
        if (!wasPresent && id !== this.id) {
          MajixEvents.emitSync('presence:joined', { id });
          MajixEvents.emitSync('presence:list', this.getList());
        }
      });

      // Broadcast our own heartbeat
      this._heartbeatTimer = setInterval(() => {
        MajixEvents.emit('presence:heartbeat', { id: this.id }, { broadcast: true });
      }, this._opts.heartbeatInterval);

      // Prune stale participants
      this._pruneTimer = setInterval(() => {
        const cutoff = Date.now() - this._opts.timeoutMs;
        for (const [pid, ts] of this._participants.entries()) {
          if (ts < cutoff) {
            this._participants.delete(pid);
            MajixEvents.emitSync('presence:left', { id: pid });
            MajixEvents.emitSync('presence:list', this.getList());
          }
        }
      }, this._opts.heartbeatInterval);

      // Announce ourselves immediately
      MajixEvents.emit('presence:heartbeat', { id: this.id }, { broadcast: true });
    }

    /** Stop broadcasting and listening. */
    stop() {
      clearInterval(this._heartbeatTimer);
      clearInterval(this._pruneTimer);
      this._heartbeatTimer = null;
      this._pruneTimer     = null;
      this._started        = false;
      // Broadcast departure
      MajixEvents.emit('presence:leave', { id: this.id }, { broadcast: true });
    }

    /**
     * Return a list of currently-online participant IDs.
     * @returns {string[]}
     */
    getList() {
      return Array.from(this._participants.keys());
    }

    /**
     * Check if a participant is currently online.
     * @param {string} participantId
     * @returns {boolean}
     */
    isOnline(participantId) {
      const ts = this._participants.get(participantId);
      if (ts === undefined) return false;
      return Date.now() - ts < this._opts.timeoutMs;
    }
  }

  MajixEvents.createPresence = createPresence;
  MajixEvents.Presence       = Presence;


  // ══════════════════════════════════════════════════════════════════════════
  // CHANGELOG
  // ══════════════════════════════════════════════════════════════════════════
  //
  // v2.9.0  (current)
  //   + Presence tracker (createPresence / Presence)
  //   + Undo/Redo manager (createUndoManager / UndoManager)
  //   + Stale-while-revalidate cache pattern (staleWhileRevalidate)
  //   + Rate limiter (rateLimitOn)
  //   + Standalone circuit-breaker helper (createCircuitBreaker)
  //   + Typed event registry (createTypedRegistry / TypedEventRegistry)
  //   + Testing utilities: spy, mock, assertEmitted, waitForEvent, sandbox
  //   + Health check and diagnostics: health(), diagnose()
  //   + Event protocol registry: defineProtocol, getProtocol,
  //       listProtocols, generateProtocolDocs
  //   + Distributed tracing: enableTracing, emitTraced, getTrace, clearTraces
  //   + Scheduled/recurring events: schedule, scheduleAll, stopAllSchedules
  //   + Cross-frame bridge: connectFrame
  //   + Command bus: createCommandBus / CommandBus
  //   + State store: createStore / Store
  //   + Event sourcing: createAggregate / Aggregate,
  //       createEventStore / EventSourceStore
  //   + Node.js EventEmitter compatibility layer
  //
  // v2.8.0
  //   + EventScope with full sub-bus isolation
  //   + exhaustMap, mergeMap, switchMap, scan, distinct, take, skip,
  //       takeUntil, pairwise, startWith, countEmissions, toAsyncIterable
  //   + EventQueue with pause/resume/drain/destroy
  //   + Deduplication helper: dedupeOn
  //   + Conditional router: createRouter
  //   + Schema validation: defineSchema, removeSchema, validate, setSchemaMode
  //   + Metrics: enableMetrics, metrics, metricsAll, resetMetrics
  //   + Built-in plugins: logger, timestamp, immutable, retry,
  //       circuitBreaker, perf
  //   + Snapshot/restore
  //   + Worker bridge: connectWorker
  //   + Batch transactions
  //
  // v2.7.0
  //   + Request/response: ask, answer
  //   + Stream combinators: merge, zip, race, combineLatest, sequence
  //   + Reactive operators: filter, map, tap, buffer, window,
  //       delay, sample, audit
  //   + Stream helpers: next (Promise-based one-shot)
  //   + Debounce enhancements: cancel, flush
  //   + Throttle enhancements: cancel
  //   + Plugin system: plugin(), use(), unuse(), clearMiddleware()
  //
  // v2.6.0
  //   + offById, offByTag, offAll
  //   + count, listEvents
  //   + emitMany, emitParallel
  //   + historyFor, historySince, historyBetween, historyFrom
  //   + exportHistory, importHistory, clearHistory
  //   + replayAll, replay
  //   + BroadcastChannel integration
  //   + IndexedDB persistence
  //
  // v2.5.0
  //   + Namespace support (configure({ namespace }))
  //   + Priority-ordered handlers
  //   + Wildcard subscriptions ('*', 'ns:*', 'ns:foo*')
  //   + localStorage persistence
  //
  // v2.0.0
  //   + Async emit with middleware pipeline
  //   + emitSync for synchronous hot paths
  //   + Scoped unsubscribe (unsub functions)
  //   + once() one-shot subscriptions
  //   + debounce / throttle built-in
  //   + History ring buffer
  //
  // v1.0.0
  //   Initial release: on / off / emit (synchronous)
  //
  // ══════════════════════════════════════════════════════════════════════════
  // VERSION CONSTANT  (accessible at runtime)
  // ══════════════════════════════════════════════════════════════════════════

  // Re-expose version for runtime inspection
  MajixEvents.VERSION = VERSION;

  // ══════════════════════════════════════════════════════════════════════════
  // SYMBOL EXPORTS  (constants for well-known event names)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Using named constants for system event names avoids typos and makes it
  // easy to find all usages with a code search.
  //
  // Usage:
  //   MajixEvents.on(MajixEvents.SYS.INIT, handler);
  //   MajixEvents.on(MajixEvents.SYS.ERROR, handleError);

  MajixEvents.SYS = Object.freeze({
    INIT:           '@@majix/init',
    DESTROY:        '@@majix/destroy',
    ERROR:          '@@majix/error',
    BATCH_START:    '@@majix/batch:start',
    BATCH_END:      '@@majix/batch:end',
    REPLAY_START:   '@@majix/replay:start',
    REPLAY_END:     '@@majix/replay:end',
    MIDDLEWARE_ERR: '@@majix/middleware:error',
    IDB_READY:      '@@majix/idb:ready',
    IDB_ERROR:      '@@majix/idb:error',
    BROADCAST_MSG:  '@@majix/broadcast:message',
    SW_READY:       '@@majix/sw:ready',
  });


  // ══════════════════════════════════════════════════════════════════════════
  // UTILITY: createEventGroup
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Group related events so they can all be subscribed to or unsubscribed
  // from in a single call.
  //
  // Usage:
  //   const group = MajixEvents.createEventGroup([
  //     ['user:login',   handleLogin],
  //     ['user:logout',  handleLogout],
  //     ['user:profile', handleProfile],
  //   ]);
  //   group.subscribe();   // subscribe all
  //   group.unsubscribe(); // unsubscribe all
  //   group.add('user:delete', handleDelete);
  //   group.remove('user:profile');

  /**
   * Create an event group.
   * @param {Array<[string, Function, object?]>} entries  — [event, handler, opts?]
   * @returns {{ subscribe, unsubscribe, add, remove }}
   */
  function createEventGroup(entries) {
    const _entries = (entries || []).map(e => ({ event: e[0], handler: e[1], opts: e[2] }));
    const _unsubs  = new Map();  // event → unsubFn

    return {
      subscribe() {
        for (const { event, handler, opts } of _entries) {
          if (!_unsubs.has(event)) {
            _unsubs.set(event, MajixEvents.on(event, handler, opts));
          }
        }
      },
      unsubscribe() {
        for (const unsub of _unsubs.values()) unsub();
        _unsubs.clear();
      },
      add(event, handler, opts) {
        _entries.push({ event, handler, opts });
        // If already subscribed, subscribe the new entry immediately
        if (_unsubs.size > 0 && !_unsubs.has(event)) {
          _unsubs.set(event, MajixEvents.on(event, handler, opts));
        }
      },
      remove(event) {
        const idx = _entries.findIndex(e => e.event === event);
        if (idx !== -1) _entries.splice(idx, 1);
        const unsub = _unsubs.get(event);
        if (unsub) { unsub(); _unsubs.delete(event); }
      },
    };
  }

  MajixEvents.createEventGroup = createEventGroup;

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITY: once promise (alias already exposed as next(), added here
  //          for discoverability as awaitEvent)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Usage:
  //   const payload = await MajixEvents.awaitEvent('server:ready', 10000);

  MajixEvents.awaitEvent = next;

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITY: forwardEvents
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Forward matching events from this bus to another MajixEvents instance
  // (e.g. a child scope or a different bus object entirely).
  //
  // Usage:
  //   const childBus = MajixEvents.scope('child');
  //   const stop = MajixEvents.forwardEvents(['data:*', 'ui:resize'], childBus);
  //   // all 'data:*' and 'ui:resize' events are re-emitted on childBus
  //   stop();  // stop forwarding

  /**
   * Forward events matching patterns to another bus.
   * @param {string|string[]} patterns  — one or more event patterns
   * @param {object}          targetBus — another MajixEvents-compatible object
   * @returns {Function} stop forwarding
   */
  function forwardEvents(patterns, targetBus) {
    const list   = Array.isArray(patterns) ? patterns : [patterns];
    const unsubs = list.map(pat =>
      on(pat, (payload, event) => {
        if (targetBus && typeof targetBus.emit === 'function') {
          targetBus.emit(event, payload);
        }
      })
    );
    return () => unsubs.forEach(u => u());
  }

  MajixEvents.forwardEvents = forwardEvents;

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITY: onceAll
  // ══════════════════════════════════════════════════════════════════════════
  //
  // Wait for ALL of a set of events to fire at least once, then call handler.
  //
  // Usage:
  //   MajixEvents.onceAll(['db:ready', 'config:loaded', 'auth:ready'], () => {
  //     startApp();
  //   });

  /**
   * Call handler once all specified events have fired at least once.
   * @param {string[]} events
   * @param {Function} handler
   * @returns {Function} cancel (unsubscribes without calling handler)
   */
  function onceAll(events, handler) {
    const pending = new Set(events);
    const unsubs  = [];

    for (const event of events) {
      unsubs.push(
        on(event, () => {
          pending.delete(event);
          if (pending.size === 0) {
            unsubs.forEach(u => u());
            try { handler(); } catch (err) { _handleError(err, 'onceAll', events); }
          }
        })
      );
    }

    return () => unsubs.forEach(u => u());
  }

  MajixEvents.onceAll = onceAll;

  // EXPORT
  // ══════════════════════════════════════════════════════════════════════════

  // CommonJS / Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports         = MajixEvents;
    module.exports.default = MajixEvents;
    module.exports.MajixEvents = MajixEvents;
  }

  // Browser global
  if (typeof window !== 'undefined') {
    window.MajixEvents = MajixEvents;
    // Auto-init if config already set
    if (window.EVENTS_CONFIG) MajixEvents.init();
  }

  // Service-worker / worker global (self, no window)
  if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.MajixEvents = MajixEvents;
    if (self.EVENTS_CONFIG) MajixEvents.init();
  }

})();
