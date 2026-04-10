// /logging/logging-core.js  —  Shared Logging Library for MajixAI
//
// Usage: set window.LOGGER_CONFIG before calling MajixLogger.init()
//
// LOGGER_CONFIG options (all optional):
//
//   namespace        {string}
//     Prefix attached to every log entry's namespace field.
//     default: 'app'
//
//   level            'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
//     Minimum level that is processed.  Messages below this are dropped.
//     default: 'DEBUG'
//
//   targets          string[]
//     Active output targets.  Any subset of:
//       'console'    → window.console (colour-coded)
//       'memory'     → in-process ring buffer (queryable via MajixLogger.query())
//       'localStorage' → window.localStorage key 'majix_log'
//       'indexedDB'  → IndexedDB database 'MajixLog', object store 'entries'
//       'remote'     → HTTP POST to remoteUrl
//     default: ['console', 'memory']
//
//   bufferSize       {number}
//     Maximum entries kept in the memory ring buffer.  Oldest are evicted.
//     default: 500
//
//   remoteUrl        {string}
//     Endpoint for the 'remote' target.  Entries are POSTed as JSON.
//     default: ''
//
//   remoteBatchSize  {number}
//     Number of entries to accumulate before flushing to remoteUrl.
//     default: 10
//
//   remoteFlushMs    {number}
//     Maximum milliseconds between remote flushes even if batch is not full.
//     default: 5000
//
//   localStorageKey  {string}
//     localStorage key used by the 'localStorage' target.
//     default: 'majix_log'
//
//   localStorageMax  {number}
//     Maximum number of entries kept in localStorage (oldest are trimmed).
//     default: 200
//
//   dbName           {string}
//     IndexedDB database name.
//     default: 'MajixLog'
//
//   dbStore          {string}
//     IndexedDB object store name.
//     default: 'entries'
//
//   dbMaxEntries     {number}
//     Maximum entries in the IndexedDB store before old ones are purged.
//     default: 5000
//
//   timestampFormat  'iso' | 'unix' | 'relative'
//     How timestamps appear in log entries.
//     default: 'iso'
//
//   includeStack     boolean
//     Attach a stack-trace string to WARN / ERROR / FATAL entries.
//     default: false
//
//   meta             {object}
//     Static key/value pairs merged into every log entry.
//     default: {}
//
// ─────────────────────────────────────────────────────────────────────────────
// Public API (after init)
//
//   MajixLogger.trace(msg, data?)
//   MajixLogger.debug(msg, data?)
//   MajixLogger.info(msg, data?)
//   MajixLogger.warn(msg, data?)
//   MajixLogger.error(msg, data?)
//   MajixLogger.fatal(msg, data?)
//     Log a message at the given level.
//     data  — optional object merged into the entry.
//
//   MajixLogger.log(level, msg, data?)
//     Generic log method accepting a level string.
//
//   MajixLogger.child(namespace, extraMeta?)
//     Returns a child logger that prefixes namespace and merges extraMeta.
//
//   MajixLogger.time(label)
//   MajixLogger.timeEnd(label)
//     Performance timer — timeEnd logs elapsed ms at DEBUG level.
//
//   MajixLogger.query(filter?)
//     Returns entries from the in-memory buffer matching filter:
//       { level?, namespace?, since?, until?, limit?, search? }
//
//   MajixLogger.exportJSON()
//     Returns the memory buffer as a JSON string.
//
//   MajixLogger.queryDB(filter?, callback)
//     Async IndexedDB query.  Calls callback(err, entries[]).
//     filter: { level?, namespace?, since?, until?, limit? }
//
//   MajixLogger.clearDB(callback?)
//     Clears the IndexedDB store.  Calls optional callback(err).
//
//   MajixLogger.flush()
//     Immediately flushes any pending remote batch.
//
//   MajixLogger.setLevel(level)
//     Change the active minimum level at runtime.
//
//   MajixLogger.addTarget(target)
//   MajixLogger.removeTarget(target)
//     Dynamically add/remove an output target.
//
//   MajixLogger.on(event, handler)
//   MajixLogger.off(event, handler)
//     Subscribe to internal events: 'entry', 'flush', 'error'.
//
// ─────────────────────────────────────────────────────────────────────────────

(function (global) {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────

  var LEVELS = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 };

  var CONSOLE_STYLES = {
    TRACE: 'color:#9E9E9E',
    DEBUG: 'color:#64B5F6',
    INFO:  'color:#81C784',
    WARN:  'color:#FFB74D',
    ERROR: 'color:#E57373',
    FATAL: 'color:#E040FB;font-weight:bold',
  };

  // ── State ──────────────────────────────────────────────────────────────────

  var _cfg = {};
  var _levelNum = 1;        // default DEBUG
  var _buffer = [];         // ring buffer
  var _timers = {};         // perf timers
  var _db = null;           // IDBDatabase
  var _dbReady = false;
  var _dbQueue = [];        // entries queued before DB is ready
  var _remoteBatch = [];    // pending remote entries
  var _remoteTimer = null;
  var _listeners = {};      // event → [fn, …]
  var _initTime = Date.now();

  // ── Defaults ───────────────────────────────────────────────────────────────

  function _defaults(cfg) {
    return {
      namespace:       cfg.namespace       || 'app',
      level:           cfg.level           || 'DEBUG',
      targets:         cfg.targets         || ['console', 'memory'],
      bufferSize:      cfg.bufferSize      != null ? cfg.bufferSize      : 500,
      remoteUrl:       cfg.remoteUrl       || '',
      remoteBatchSize: cfg.remoteBatchSize != null ? cfg.remoteBatchSize : 10,
      remoteFlushMs:   cfg.remoteFlushMs   != null ? cfg.remoteFlushMs   : 5000,
      localStorageKey: cfg.localStorageKey || 'majix_log',
      localStorageMax: cfg.localStorageMax != null ? cfg.localStorageMax : 200,
      dbName:          cfg.dbName          || 'MajixLog',
      dbStore:         cfg.dbStore         || 'entries',
      dbMaxEntries:    cfg.dbMaxEntries    != null ? cfg.dbMaxEntries    : 5000,
      timestampFormat: cfg.timestampFormat || 'iso',
      includeStack:    cfg.includeStack    || false,
      meta:            cfg.meta            || {},
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _ts() {
    var now = Date.now();
    if (_cfg.timestampFormat === 'unix') return now;
    if (_cfg.timestampFormat === 'relative') return now - _initTime;
    return new Date(now).toISOString();
  }

  function _levelNum_of(name) {
    return LEVELS[name] != null ? LEVELS[name] : 1;
  }

  function _captureStack() {
    try { throw new Error('_stack_'); } catch (e) {
      return (e.stack || '').split('\n').slice(3).join('\n');
    }
  }

  function _emit(event, data) {
    (_listeners[event] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { /* swallow */ }
    });
  }

  // ── Entry builder ──────────────────────────────────────────────────────────

  function _buildEntry(level, namespace, msg, data, stack) {
    var entry = {
      ts:        _ts(),
      level:     level,
      namespace: namespace,
      message:   msg,
    };
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(function (k) { entry[k] = data[k]; });
    }
    var meta = _cfg.meta;
    Object.keys(meta).forEach(function (k) { if (entry[k] === undefined) entry[k] = meta[k]; });
    if (stack) entry.stack = stack;
    return entry;
  }

  // ── Ring buffer ────────────────────────────────────────────────────────────

  function _pushBuffer(entry) {
    _buffer.push(entry);
    if (_buffer.length > _cfg.bufferSize) _buffer.shift();
  }

  // ── Console target ─────────────────────────────────────────────────────────

  function _toConsole(entry) {
    if (typeof console === 'undefined') return;
    var style = CONSOLE_STYLES[entry.level] || '';
    var prefix = '[' + entry.level + '] [' + entry.namespace + ']';
    var fn;
    if (entry.level === 'ERROR' || entry.level === 'FATAL') {
      fn = console.error || console.log;
    } else if (entry.level === 'WARN') {
      fn = console.warn || console.log;
    } else if (entry.level === 'DEBUG' || entry.level === 'TRACE') {
      fn = console.debug || console.log;
    } else {
      fn = console.log;
    }
    try {
      fn.call(console, '%c' + prefix, style, entry.message,
        entry.stack ? '\n' + entry.stack : '');
    } catch (e) {
      console.log(prefix, entry.message);
    }
  }

  // ── localStorage target ────────────────────────────────────────────────────

  function _toLocalStorage(entry) {
    if (typeof localStorage === 'undefined') return;
    try {
      var key = _cfg.localStorageKey;
      var raw = localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      arr.push(entry);
      if (arr.length > _cfg.localStorageMax) arr = arr.slice(-_cfg.localStorageMax);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) { /* quota or parse error */ }
  }

  // ── IndexedDB target ───────────────────────────────────────────────────────

  function _openDB(callback) {
    if (typeof indexedDB === 'undefined') { callback(new Error('IndexedDB unavailable')); return; }
    var req = indexedDB.open(_cfg.dbName, 1);
    req.onupgradeneeded = function (ev) {
      var db = ev.target.result;
      if (!db.objectStoreNames.contains(_cfg.dbStore)) {
        var store = db.createObjectStore(_cfg.dbStore, { autoIncrement: true, keyPath: '_id' });
        store.createIndex('level',     'level',     { unique: false });
        store.createIndex('namespace', 'namespace', { unique: false });
        store.createIndex('ts',        'ts',        { unique: false });
      }
    };
    req.onsuccess = function (ev) { callback(null, ev.target.result); };
    req.onerror   = function (ev) { callback(ev.target.error); };
  }

  function _initDB() {
    if (typeof indexedDB === 'undefined') return;
    _openDB(function (err, db) {
      if (err) { _emit('error', err); return; }
      _db = db;
      _dbReady = true;
      _dbQueue.forEach(function (e) { _writeDB(e); });
      _dbQueue = [];
    });
  }

  function _writeDB(entry) {
    if (!_dbReady) { _dbQueue.push(entry); return; }
    if (!_db) return;
    try {
      var tx    = _db.transaction([_cfg.dbStore], 'readwrite');
      var store = tx.objectStore(_cfg.dbStore);
      store.add(entry);
      var countReq = store.count();
      countReq.onsuccess = function () {
        var excess = countReq.result - _cfg.dbMaxEntries;
        if (excess <= 0) return;
        var cur = store.openCursor();
        var deleted = 0;
        cur.onsuccess = function (ev) {
          var cursor = ev.target.result;
          if (cursor && deleted < excess) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      };
    } catch (e) { _emit('error', e); }
  }

  // ── Remote target ──────────────────────────────────────────────────────────

  function _toRemote(entry) {
    _remoteBatch.push(entry);
    if (_remoteBatch.length >= _cfg.remoteBatchSize) _flushRemote();
  }

  function _flushRemote() {
    if (!_cfg.remoteUrl || _remoteBatch.length === 0) return;
    var payload = _remoteBatch.slice();
    _remoteBatch = [];
    _emit('flush', { count: payload.length, url: _cfg.remoteUrl });
    try {
      fetch(_cfg.remoteUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        keepalive: true,
      }).catch(function (e) { _emit('error', e); });
    } catch (e) { _emit('error', e); }
  }

  function _scheduleRemoteFlush() {
    if (_remoteTimer) return;
    _remoteTimer = setTimeout(function () {
      _remoteTimer = null;
      _flushRemote();
    }, _cfg.remoteFlushMs);
  }

  // ── Core dispatch ──────────────────────────────────────────────────────────

  function _dispatch(level, namespace, msg, data) {
    if (_levelNum_of(level) < _levelNum) return;
    var stack = (_cfg.includeStack && _levelNum_of(level) >= LEVELS.WARN)
      ? _captureStack() : undefined;
    var entry = _buildEntry(level, namespace, msg, data, stack);

    var targets = _cfg.targets;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t === 'console')      _toConsole(entry);
      if (t === 'memory')       _pushBuffer(entry);
      if (t === 'localStorage') _toLocalStorage(entry);
      if (t === 'indexedDB')    _writeDB(entry);
      if (t === 'remote')       { _toRemote(entry); _scheduleRemoteFlush(); }
    }

    _emit('entry', entry);
  }

  // ── Child logger ───────────────────────────────────────────────────────────

  function _merge(a, b) {
    if (!a && !b) return undefined;
    var out = {};
    if (a) Object.keys(a).forEach(function (k) { out[k] = a[k]; });
    if (b) Object.keys(b).forEach(function (k) { out[k] = b[k]; });
    return out;
  }

  function _makeChild(namespace, extraMeta) {
    return {
      trace: function (msg, data) { _dispatch('TRACE', namespace, msg, _merge(extraMeta, data)); },
      debug: function (msg, data) { _dispatch('DEBUG', namespace, msg, _merge(extraMeta, data)); },
      info:  function (msg, data) { _dispatch('INFO',  namespace, msg, _merge(extraMeta, data)); },
      warn:  function (msg, data) { _dispatch('WARN',  namespace, msg, _merge(extraMeta, data)); },
      error: function (msg, data) { _dispatch('ERROR', namespace, msg, _merge(extraMeta, data)); },
      fatal: function (msg, data) { _dispatch('FATAL', namespace, msg, _merge(extraMeta, data)); },
      log:   function (level, msg, data) { _dispatch((level || 'INFO').toUpperCase(), namespace, msg, _merge(extraMeta, data)); },
      child: function (ns2, meta2) { return _makeChild(namespace + ':' + ns2, _merge(extraMeta, meta2)); },
      time:    function (label) { _timerStart(namespace + ':' + label); },
      timeEnd: function (label) { _timerEnd(namespace + ':' + label, namespace); },
    };
  }

  // ── Perf timers ────────────────────────────────────────────────────────────

  function _timerStart(label) {
    _timers[label] = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function _timerEnd(label, namespace) {
    var start = _timers[label];
    if (start == null) {
      _dispatch('WARN', namespace || _cfg.namespace, 'timer "' + label + '" not started');
      return;
    }
    var elapsed = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start).toFixed(3);
    delete _timers[label];
    _dispatch('DEBUG', namespace || _cfg.namespace, label + ': ' + elapsed + 'ms', { elapsed_ms: parseFloat(elapsed) });
  }

  // ── Query helpers ──────────────────────────────────────────────────────────

  function _matchEntry(entry, filter) {
    if (!filter) return true;
    if (filter.level && LEVELS[entry.level] < LEVELS[filter.level]) return false;
    if (filter.namespace && entry.namespace.indexOf(filter.namespace) === -1) return false;
    if (filter.since != null) {
      var ts = typeof entry.ts === 'string' ? new Date(entry.ts).getTime() : entry.ts;
      if (ts < filter.since) return false;
    }
    if (filter.until != null) {
      var ts2 = typeof entry.ts === 'string' ? new Date(entry.ts).getTime() : entry.ts;
      if (ts2 > filter.until) return false;
    }
    if (filter.search) {
      var s = filter.search.toLowerCase();
      if ((entry.message || '').toLowerCase().indexOf(s) === -1 &&
          (entry.namespace || '').toLowerCase().indexOf(s) === -1) return false;
    }
    return true;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  var MajixLogger = {

    init: function (config) {
      var raw = config || (typeof global.LOGGER_CONFIG !== 'undefined' ? global.LOGGER_CONFIG : {});
      _cfg         = _defaults(raw);
      _levelNum    = _levelNum_of(_cfg.level.toUpperCase());
      _initTime    = Date.now();
      _buffer      = [];
      _timers      = {};
      _remoteBatch = [];
      _listeners   = {};
      _dbReady     = false;
      _db          = null;
      _dbQueue     = [];

      if (_cfg.targets.indexOf('indexedDB') !== -1) _initDB();
      if (_cfg.targets.indexOf('remote') !== -1 && _cfg.remoteUrl) _scheduleRemoteFlush();

      _dispatch('INFO', _cfg.namespace, 'MajixLogger initialised', {
        level:   _cfg.level,
        targets: _cfg.targets,
      });
    },

    // ── Level shortcuts ──────────────────────────────────────────────────────

    trace: function (msg, data) { _dispatch('TRACE', _cfg.namespace, msg, data); },
    debug: function (msg, data) { _dispatch('DEBUG', _cfg.namespace, msg, data); },
    info:  function (msg, data) { _dispatch('INFO',  _cfg.namespace, msg, data); },
    warn:  function (msg, data) { _dispatch('WARN',  _cfg.namespace, msg, data); },
    error: function (msg, data) { _dispatch('ERROR', _cfg.namespace, msg, data); },
    fatal: function (msg, data) { _dispatch('FATAL', _cfg.namespace, msg, data); },

    log: function (level, msg, data) {
      _dispatch((level || 'INFO').toUpperCase(), _cfg.namespace, msg, data);
    },

    // ── Child logger ─────────────────────────────────────────────────────────

    child: function (namespace, extraMeta) {
      return _makeChild(_cfg.namespace + ':' + namespace, extraMeta);
    },

    // ── Perf timers ──────────────────────────────────────────────────────────

    time:    function (label) { _timerStart(label); },
    timeEnd: function (label) { _timerEnd(label); },

    // ── Memory buffer ─────────────────────────────────────────────────────────

    query: function (filter) {
      var results = _buffer.filter(function (e) { return _matchEntry(e, filter); });
      if (filter && filter.limit) results = results.slice(-filter.limit);
      return results;
    },

    exportJSON: function () {
      return JSON.stringify(_buffer, null, 2);
    },

    // ── IndexedDB API ─────────────────────────────────────────────────────────

    queryDB: function (filter, callback) {
      if (typeof callback !== 'function') { callback = filter; filter = {}; }
      if (!_dbReady || !_db) {
        setTimeout(function () { MajixLogger.queryDB(filter, callback); }, 100);
        return;
      }
      try {
        var results = [];
        var tx    = _db.transaction([_cfg.dbStore], 'readonly');
        var store = tx.objectStore(_cfg.dbStore);
        var limit = (filter && filter.limit) ? filter.limit : Infinity;
        var cur   = store.openCursor(null, 'prev');
        cur.onsuccess = function (ev) {
          var cursor = ev.target.result;
          if (!cursor || results.length >= limit) {
            callback(null, results.reverse());
            return;
          }
          if (_matchEntry(cursor.value, filter)) results.push(cursor.value);
          cursor.continue();
        };
        cur.onerror = function (ev) { callback(ev.target.error, []); };
      } catch (e) { callback(e, []); }
    },

    clearDB: function (callback) {
      if (!_dbReady || !_db) { if (callback) callback(new Error('DB not ready')); return; }
      try {
        var tx    = _db.transaction([_cfg.dbStore], 'readwrite');
        var store = tx.objectStore(_cfg.dbStore);
        var req   = store.clear();
        req.onsuccess = function () { if (callback) callback(null); };
        req.onerror   = function (ev) { if (callback) callback(ev.target.error); };
      } catch (e) { if (callback) callback(e); }
    },

    // ── Remote flush ──────────────────────────────────────────────────────────

    flush: function () { _flushRemote(); },

    // ── Runtime config ────────────────────────────────────────────────────────

    setLevel: function (level) {
      _cfg.level = level.toUpperCase();
      _levelNum  = _levelNum_of(_cfg.level);
    },

    addTarget: function (target) {
      if (_cfg.targets.indexOf(target) === -1) {
        _cfg.targets.push(target);
        if (target === 'indexedDB' && !_dbReady) _initDB();
      }
    },

    removeTarget: function (target) {
      _cfg.targets = _cfg.targets.filter(function (t) { return t !== target; });
    },

    // ── Event bus ─────────────────────────────────────────────────────────────

    on: function (event, handler) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(handler);
    },

    off: function (event, handler) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(function (h) { return h !== handler; });
    },

    // ── Introspection ─────────────────────────────────────────────────────────

    getConfig: function () { return JSON.parse(JSON.stringify(_cfg)); },
    getBuffer: function () { return _buffer.slice(); },
    getLevels: function () { return Object.keys(LEVELS); },
  };

  global.MajixLogger = MajixLogger;

}(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this));
