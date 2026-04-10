// /events/events-core.js  —  Centralised Event Handling Core for MajixAI
//
// Usage (browser global script):
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
// Usage (ES module):
//
//   import MajixEvents from '/events/events-core.js';
//   MajixEvents.configure({ namespace: 'myapp' });
//
// ── API summary ────────────────────────────────────────────────────────────────
//
//   MajixEvents.on(event, handler [, options])
//     Subscribe.  event may be a namespaced string ('myapp:click') or a
//     wildcard ('myapp:*' or '*').  options: { once, priority, prepend }.
//     Returns an unsubscribe function.
//
//   MajixEvents.once(event, handler [, options])
//     Shorthand for on() with { once: true }.
//
//   MajixEvents.off(event, handler)
//     Remove a specific subscription.
//
//   MajixEvents.emit(event [, payload [, options]])
//     Fire an event.  options: { broadcast, persist, async }.
//     Returns a Promise that resolves after all handlers have run.
//
//   MajixEvents.emitSync(event [, payload])
//     Synchronous variant of emit(); returns array of handler return values.
//
//   MajixEvents.use(middleware)
//     Register a middleware function: (event, payload, next) => payload.
//
//   MajixEvents.replay(event [, handler])
//     Replay all history entries matching event (wildcard-aware) through
//     handler (or all current subscribers if omitted).
//
//   MajixEvents.history([filter])
//     Return event history array, optionally filtered by event pattern.
//
//   MajixEvents.clearHistory([event])
//     Clear history (optionally only entries matching event pattern).
//
//   MajixEvents.debounce(event, handler, wait [, options])
//     Subscribe with automatic debouncing.  Returns unsubscribe function.
//
//   MajixEvents.throttle(event, handler, wait [, options])
//     Subscribe with automatic throttling.  Returns unsubscribe function.
//
//   MajixEvents.pipe(sourceEvent, targetEvent [, transform])
//     Forward every sourceEvent as targetEvent, optionally transforming payload.
//     Returns an unsubscribe function.
//
//   MajixEvents.configure(config)
//     Merge additional configuration at runtime.
//
//   MajixEvents.destroy()
//     Remove all subscriptions, middleware, close BroadcastChannel, clear history.
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

  // ── Internal state ────────────────────────────────────────────────────────

  /** @type {Map<string, Array<{handler: Function, once: boolean, priority: number, id: number}>>} */
  const _listeners  = new Map();
  /** @type {Array<Function>}  */
  const _middleware = [];
  /** @type {Array<{event: string, payload: *, ts: number}>} */
  const _history    = [];

  let _cfg = {
    namespace:    '',
    broadcastKey: 'majixai-events',
    historyLimit: 200,
    persist:      false,
    persistKey:   'majixai-ev',
    persistLimit: 100,
  };

  let _channel = null;   // BroadcastChannel instance
  let _idSeq   = 0;      // monotonic subscription ID

  // ── Config ────────────────────────────────────────────────────────────────

  function configure(overrides) {
    if (!overrides || typeof overrides !== 'object') return;
    Object.assign(_cfg, overrides);
    _initChannel();
  }

  function _applyWindowConfig() {
    if (typeof window !== 'undefined' && window.EVENTS_CONFIG) {
      configure(window.EVENTS_CONFIG);
    }
  }

  // ── BroadcastChannel ──────────────────────────────────────────────────────

  function _initChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    if (_channel) { try { _channel.close(); } catch { /* ignore */ } }
    _channel = new BroadcastChannel(_cfg.broadcastKey);
    _channel.onmessage = (ev) => {
      const data = ev.data || {};
      if (data._majixEvent) {
        const payload = Object.assign({}, data.payload, { _fromBroadcast: true });
        _dispatchLocal(data.event, payload);
      }
    };
  }

  // ── Namespace helper ──────────────────────────────────────────────────────

  function _qualify(event) {
    if (!_cfg.namespace || event.includes(':') || event === '*') return event;
    return `${_cfg.namespace}:${event}`;
  }

  // ── Wildcard matching ─────────────────────────────────────────────────────

  function _matches(pattern, event) {
    if (pattern === '*' || pattern === event) return true;
    // 'ns:*' matches any 'ns:...'
    if (pattern.endsWith(':*')) {
      const ns = pattern.slice(0, -1); // 'ns:'
      return event.startsWith(ns);
    }
    // glob-style: single segment wildcard (*) matching
    const re = new RegExp(
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^:]+') + '$'
    );
    return re.test(event);
  }

  // ── Subscription management ───────────────────────────────────────────────

  function on(rawEvent, handler, options) {
    if (typeof rawEvent !== 'string' || typeof handler !== 'function') {
      throw new TypeError('[MajixEvents] on() requires (string, function)');
    }
    const event    = _qualify(rawEvent);
    const opts     = Object.assign({ once: false, priority: 0, prepend: false }, options);
    const id       = ++_idSeq;
    // Store `pattern` so once-removal can find the correct listener list.
    const entry    = { handler, once: !!opts.once, priority: Number(opts.priority) || 0, id, pattern: event };

    if (!_listeners.has(event)) _listeners.set(event, []);
    const list = _listeners.get(event);

    if (opts.prepend) {
      list.unshift(entry);
    } else {
      list.push(entry);
    }

    // Keep descending priority order after insert
    list.sort((a, b) => b.priority - a.priority);

    return function unsubscribe() { off(rawEvent, handler); };
  }

  function once(rawEvent, handler, options) {
    return on(rawEvent, handler, Object.assign({}, options, { once: true }));
  }

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

  // ── Middleware ────────────────────────────────────────────────────────────

  function use(middleware) {
    if (typeof middleware !== 'function') {
      throw new TypeError('[MajixEvents] use() requires a function');
    }
    _middleware.push(middleware);
  }

  // Apply middleware chain to (event, payload); returns final payload.
  function _applyMiddleware(event, payload) {
    return new Promise((resolve, reject) => {
      let index = 0;
      function next(current) {
        if (index >= _middleware.length) { resolve(current); return; }
        const mw = _middleware[index++];
        try {
          const result = mw(event, current, next);
          // If the middleware returns a Promise, wait for it and then
          // continue the chain via next() rather than short-circuit resolve().
          if (result && typeof result.then === 'function') {
            result.then(v => { if (v !== undefined) next(v); }).catch(reject);
          }
        } catch (err) {
          reject(err);
        }
      }
      next(payload);
    });
  }

  // ── History ───────────────────────────────────────────────────────────────

  function _recordHistory(event, payload) {
    _history.push({ event, payload, ts: Date.now() });
    if (_history.length > _cfg.historyLimit) {
      _history.splice(0, _history.length - _cfg.historyLimit);
    }
  }

  function history(filter) {
    if (!filter) return _history.slice();
    return _history.filter(h => _matches(filter, h.event));
  }

  function clearHistory(filter) {
    if (!filter) { _history.length = 0; return; }
    const indices = [];
    _history.forEach((h, i) => { if (_matches(filter, h.event)) indices.push(i); });
    for (let i = indices.length - 1; i >= 0; i--) _history.splice(indices[i], 1);
  }

  // ── Persistence (localStorage) ────────────────────────────────────────────

  function _persistEvent(event, payload) {
    if (typeof localStorage === 'undefined') return;
    try {
      const key      = `${_cfg.persistKey}:${event}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ payload, ts: Date.now() });
      if (existing.length > _cfg.persistLimit) {
        existing.splice(0, existing.length - _cfg.persistLimit);
      }
      localStorage.setItem(key, JSON.stringify(existing));
    } catch { /* quota exceeded or unavailable */ }
  }

  function _loadPersisted(event) {
    if (typeof localStorage === 'undefined') return [];
    try {
      const key = `${_cfg.persistKey}:${_qualify(event)}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
  }

  // ── Core dispatch ─────────────────────────────────────────────────────────

  // Collect all subscriber lists whose pattern matches the emitted event name.
  function _collectHandlers(event) {
    const result = [];
    for (const [pattern, entries] of _listeners.entries()) {
      if (_matches(pattern, event)) result.push(...entries);
    }
    // Sort final list by priority descending, stable by id
    result.sort((a, b) => b.priority - a.priority || a.id - b.id);
    return result;
  }

  // Synchronously invoke handlers and prune once-entries.
  function _invokeHandlers(event, payload) {
    const matched = _collectHandlers(event);
    const results = [];
    for (const entry of matched) {
      if (entry.once) {
        // Use entry.pattern to find the correct listener list (which may be a
        // wildcard key like 'ns:*', not the concrete emitted event name).
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
        console.error(`[MajixEvents] Handler error on "${event}":`, err);
      }
    }
    return results;
  }

  // Local-only dispatch (no middleware, no broadcast, no persist)
  function _dispatchLocal(event, payload) {
    _recordHistory(event, payload);
    return _invokeHandlers(event, payload);
  }

  // ── Public emit (async) ────────────────────────────────────────────────────

  async function emit(rawEvent, payload, options) {
    const event = _qualify(rawEvent);
    const opts  = Object.assign({ broadcast: false, persist: false, async: false }, options);

    let finalPayload = payload;
    if (_middleware.length > 0) {
      try {
        finalPayload = await _applyMiddleware(event, payload);
      } catch (err) {
        console.error(`[MajixEvents] Middleware error on "${event}":`, err);
        return [];
      }
    }

    _recordHistory(event, finalPayload);
    if (opts.persist || _cfg.persist) _persistEvent(event, finalPayload);

    if (opts.broadcast && _channel) {
      _channel.postMessage({ _majixEvent: true, event, payload: finalPayload });
    }

    if (opts.async) {
      return new Promise(resolve => {
        setTimeout(() => resolve(_invokeHandlers(event, finalPayload)), 0);
      });
    }

    return _invokeHandlers(event, finalPayload);
  }

  // ── Public emitSync ───────────────────────────────────────────────────────

  function emitSync(rawEvent, payload) {
    const event = _qualify(rawEvent);
    _recordHistory(event, payload);
    return _invokeHandlers(event, payload);
  }

  // ── Replay ────────────────────────────────────────────────────────────────

  function replay(rawEvent, handler) {
    const event   = _qualify(rawEvent);
    const entries = history(event);

    // Also include persisted entries not yet in memory history
    if (_cfg.persist) {
      const persisted = _loadPersisted(rawEvent);
      for (const p of persisted) {
        if (!entries.find(e => e.ts === p.ts)) {
          entries.push({ event, payload: p.payload, ts: p.ts });
        }
      }
      entries.sort((a, b) => a.ts - b.ts);
    }

    for (const entry of entries) {
      if (handler) {
        try { handler(entry.payload, entry.event); } catch (err) {
          console.error(`[MajixEvents] Replay handler error on "${entry.event}":`, err);
        }
      } else {
        _invokeHandlers(entry.event, entry.payload);
      }
    }
  }

  // ── Debounce / Throttle ───────────────────────────────────────────────────

  function debounce(rawEvent, handler, wait, options) {
    let timer = null;
    function debounced(payload, event) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        handler(payload, event);
      }, wait);
    }
    return on(rawEvent, debounced, options);
  }

  function throttle(rawEvent, handler, wait, options) {
    let last = 0;
    let timer = null;
    function throttled(payload, event) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        last = now;
        handler(payload, event);
      } else if (!timer) {
        timer = setTimeout(() => {
          last  = Date.now();
          timer = null;
          handler(payload, event);
        }, remaining);
      }
    }
    return on(rawEvent, throttled, options);
  }

  // ── Pipe ──────────────────────────────────────────────────────────────────

  function pipe(sourceEvent, targetEvent, transform) {
    return on(sourceEvent, (payload) => {
      const next = (typeof transform === 'function') ? transform(payload) : payload;
      emit(targetEvent, next);
    });
  }

  // ── Destroy ───────────────────────────────────────────────────────────────

  function destroy() {
    _listeners.clear();
    _middleware.length = 0;
    _history.length    = 0;
    if (_channel) {
      try { _channel.close(); } catch { /* ignore */ }
      _channel = null;
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init(config) {
    if (config) configure(config);
    else _applyWindowConfig();
    _initChannel();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  const MajixEvents = {
    init,
    configure,
    on,
    once,
    off,
    emit,
    emitSync,
    use,
    replay,
    history,
    clearHistory,
    debounce,
    throttle,
    pipe,
    destroy,
  };

  // ── Export ────────────────────────────────────────────────────────────────

  // ES module
  if (typeof exports !== 'undefined') {
    exports.default = MajixEvents;
    exports.MajixEvents = MajixEvents;
  }

  // Browser global
  if (typeof window !== 'undefined') {
    window.MajixEvents = MajixEvents;
    // Auto-init if config already set
    if (window.EVENTS_CONFIG) MajixEvents.init();
  }

  // Service-worker global
  if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.MajixEvents = MajixEvents;
  }

})();
