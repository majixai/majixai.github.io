// /logging/logging-core.js — Shared Logging Core for MajixAI
//
// Usage: set window.LOGGER_CONFIG before loading this script, then call
//   MajixLogger.init();
//
// LOGGER_CONFIG options (all optional):
//
//   appName           {string}
//     Identifier prepended to every log entry.
//     default: 'majix'
//
//   level             'debug' | 'info' | 'warn' | 'error' | 'none'
//     Minimum level that will be processed.  'none' silences everything.
//     default: 'debug'
//
//   targets           {string[]}
//     Where logs are written.
//     Supported: 'console', 'localStorage', 'indexedDB', 'remote', 'memory'
//     default: ['console', 'memory']
//
//   storageKey        {string}
//     localStorage key for 'localStorage' target.
//     default: 'majixLogs'
//
//   dbName            {string}
//     IndexedDB database name for 'indexedDB' target.
//     default: 'MajixLogDB'
//
//   dbStoreName       {string}
//     IndexedDB object-store name.
//     default: 'logs'
//
//   memoryLimit       {number}
//     Maximum log entries kept in the in-memory buffer.
//     default: 500
//
//   localStorageLimit {number}
//     Maximum log entries kept in localStorage.
//     default: 200
//
//   remoteUrl         {string|null}
//     HTTP endpoint that receives POST requests with a JSON body
//     { entries: LogEntry[] } when the 'remote' target is enabled.
//     default: null
//
//   remoteFlushInterval {number}
//     Milliseconds between automatic remote flushes (0 = disabled).
//     default: 0
//
//   remoteBatchSize   {number}
//     Maximum entries per remote POST request.
//     default: 50
//
//   formatter         {function(entry)|null}
//     Optional function that transforms a log entry before it is written to
//     any target.  Must return the (possibly mutated) entry object.
//     default: null
//
//   onLog             {function(entry)|null}
//     Optional callback invoked after every log entry is written.
//     default: null
//
//   consoleTimestamp  {boolean}
//     Include a timestamp string in console output.
//     default: true
//
//   consoleColorize   {boolean}
//     Use CSS colour styling in the browser console.
//     default: true
//

(function (global) {
    'use strict';

    // ─── Level ordering ───────────────────────────────────────────────────────

    var LEVELS     = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
    var LEVEL_LABELS = ['debug', 'info', 'warn', 'error'];

    // ─── Default config ───────────────────────────────────────────────────────

    var DEFAULT_CONFIG = {
        appName:             'majix',
        level:               'debug',
        targets:             ['console', 'memory'],
        storageKey:          'majixLogs',
        dbName:              'MajixLogDB',
        dbStoreName:         'logs',
        memoryLimit:         500,
        localStorageLimit:   200,
        remoteUrl:           null,
        remoteFlushInterval: 0,
        remoteBatchSize:     50,
        formatter:           null,
        onLog:               null,
        consoleTimestamp:    true,
        consoleColorize:     true,
    };

    // ─── Internal state ───────────────────────────────────────────────────────

    var _cfg         = {};
    var _memory      = [];
    var _db          = null;
    var _remoteQueue = [];
    var _flushTimer  = null;
    var _initialized = false;
    var _seq         = 0;

    // ─── Console colours ──────────────────────────────────────────────────────

    var CONSOLE_STYLES = {
        debug: 'color:#9E9E9E',
        info:  'color:#29B6F6;font-weight:bold',
        warn:  'color:#FFA726;font-weight:bold',
        error: 'color:#EF5350;font-weight:bold',
    };

    // ─── Utility: shallow-merge ───────────────────────────────────────────────

    function _merge(defaults, overrides) {
        var out = {};
        for (var k in defaults) {
            if (Object.prototype.hasOwnProperty.call(defaults, k)) out[k] = defaults[k];
        }
        if (overrides && typeof overrides === 'object') {
            for (var ov in overrides) {
                if (Object.prototype.hasOwnProperty.call(overrides, ov)) out[ov] = overrides[ov];
            }
        }
        return out;
    }

    // ─── Entry builder ────────────────────────────────────────────────────────

    function _buildEntry(level, message, data, context) {
        var entry = {
            id:        ++_seq,
            level:     level,
            appName:   _cfg.appName,
            message:   String(message),
            data:      (data !== undefined) ? data : null,
            context:   context || null,
            timestamp: Date.now(),
            isoTime:   new Date().toISOString(),
        };
        if (typeof _cfg.formatter === 'function') {
            entry = _cfg.formatter(entry) || entry;
        }
        return entry;
    }

    // ─── Target: console ──────────────────────────────────────────────────────

    function _writeConsole(entry) {
        var method = (entry.level === 'debug') ? 'log' : entry.level;
        if (!console[method]) method = 'log';

        var prefix = '[' + entry.appName + ']';
        if (_cfg.consoleTimestamp) prefix += ' ' + entry.isoTime;
        prefix += ' [' + entry.level.toUpperCase() + ']';

        if (_cfg.consoleColorize && typeof window !== 'undefined') {
            var style = CONSOLE_STYLES[entry.level] || '';
            if (entry.data !== null) {
                console[method]('%c' + prefix + ' ' + entry.message, style, entry.data);
            } else {
                console[method]('%c' + prefix + ' ' + entry.message, style);
            }
        } else {
            if (entry.data !== null) {
                console[method](prefix + ' ' + entry.message, entry.data);
            } else {
                console[method](prefix + ' ' + entry.message);
            }
        }
    }

    // ─── Target: memory ───────────────────────────────────────────────────────

    function _writeMemory(entry) {
        _memory.push(entry);
        if (_memory.length > _cfg.memoryLimit) {
            _memory.splice(0, _memory.length - _cfg.memoryLimit);
        }
    }

    // ─── Target: localStorage ─────────────────────────────────────────────────

    function _writeLocalStorage(entry) {
        if (!global.localStorage) return;
        try {
            var raw  = global.localStorage.getItem(_cfg.storageKey);
            var list = raw ? JSON.parse(raw) : [];
            list.push(entry);
            if (list.length > _cfg.localStorageLimit) {
                list.splice(0, list.length - _cfg.localStorageLimit);
            }
            global.localStorage.setItem(_cfg.storageKey, JSON.stringify(list));
        } catch (e) { /* quota exceeded — ignore silently */ }
    }

    // ─── Target: IndexedDB ────────────────────────────────────────────────────

    function _openDB() {
        return new Promise(function (resolve) {
            if (!global.indexedDB) { return resolve(null); }
            if (_db) { return resolve(_db); }
            var req = global.indexedDB.open(_cfg.dbName, 1);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(_cfg.dbStoreName)) {
                    var store = db.createObjectStore(_cfg.dbStoreName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('level',     'level',     { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
            req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
            req.onerror   = function ()  { resolve(null); };
        });
    }

    function _writeIndexedDB(entry) {
        _openDB().then(function (db) {
            if (!db) return;
            try {
                var tx    = db.transaction(_cfg.dbStoreName, 'readwrite');
                var store = tx.objectStore(_cfg.dbStoreName);
                store.add(entry);
            } catch (e) { /* ignore */ }
        });
    }

    // ─── Target: remote ───────────────────────────────────────────────────────

    function _enqueueRemote(entry) {
        _remoteQueue.push(entry);
    }

    function _flushRemote() {
        if (!_cfg.remoteUrl || !_remoteQueue.length) return;
        var batch = _remoteQueue.splice(0, _cfg.remoteBatchSize);
        try {
            fetch(_cfg.remoteUrl, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ entries: batch }),
            }).catch(function () {
                // On failure push back to front of queue
                for (var i = batch.length - 1; i >= 0; i--) {
                    _remoteQueue.unshift(batch[i]);
                }
            });
        } catch (e) {
            for (var i = batch.length - 1; i >= 0; i--) {
                _remoteQueue.unshift(batch[i]);
            }
        }
    }

    function _startRemoteFlush() {
        if (_flushTimer) clearInterval(_flushTimer);
        if (_cfg.remoteFlushInterval > 0 && _cfg.remoteUrl) {
            _flushTimer = setInterval(_flushRemote, _cfg.remoteFlushInterval);
        }
    }

    // ─── Core write ───────────────────────────────────────────────────────────

    function _write(level, message, data, context) {
        if ((LEVELS[level] || 0) < (LEVELS[_cfg.level] || 0)) return;

        var entry = _buildEntry(level, message, data, context);
        var targets = _cfg.targets;

        if (targets.indexOf('console')      !== -1) _writeConsole(entry);
        if (targets.indexOf('memory')       !== -1) _writeMemory(entry);
        if (targets.indexOf('localStorage') !== -1) _writeLocalStorage(entry);
        if (targets.indexOf('indexedDB')    !== -1) _writeIndexedDB(entry);
        if (targets.indexOf('remote')       !== -1) _enqueueRemote(entry);

        if (typeof _cfg.onLog === 'function') {
            try { _cfg.onLog(entry); } catch (e) { /* ignore callback errors */ }
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    var MajixLogger = {

        /**
         * Initialize the logger.
         * Reads window.LOGGER_CONFIG and starts remote flush timer if configured.
         */
        init: function () {
            var userCfg  = (global.LOGGER_CONFIG && typeof global.LOGGER_CONFIG === 'object')
                ? global.LOGGER_CONFIG : {};
            _cfg         = _merge(DEFAULT_CONFIG, userCfg);
            _initialized = true;
            _startRemoteFlush();
        },

        /** Log at DEBUG level. */
        debug: function (message, data, context) { _write('debug', message, data, context); },

        /** Log at INFO level. */
        info: function (message, data, context)  { _write('info',  message, data, context); },

        /** Log at WARN level. */
        warn: function (message, data, context)  { _write('warn',  message, data, context); },

        /** Log at ERROR level. */
        error: function (message, data, context) { _write('error', message, data, context); },

        /**
         * Log at the given level string ('debug' | 'info' | 'warn' | 'error').
         * Falls back to 'info' for unknown values.
         */
        log: function (level, message, data, context) {
            var lvl = LEVEL_LABELS.indexOf(level) !== -1 ? level : 'info';
            _write(lvl, message, data, context);
        },

        /**
         * Log a performance timing entry.
         * @param {string} label
         * @param {number} durationMs
         * @param {object} [extra]
         */
        perf: function (label, durationMs, extra) {
            _write('info', label + ' took ' + durationMs + 'ms',
                _merge({ durationMs: durationMs }, extra || {}), 'perf');
        },

        /**
         * Start a named timer; returns a function that, when called, logs the elapsed time.
         * @param {string} label
         * @returns {function(): number}  Call to stop and log; returns elapsed ms.
         */
        time: function (label) {
            var t0 = Date.now();
            return function () {
                var ms = Date.now() - t0;
                MajixLogger.perf(label, ms);
                return ms;
            };
        },

        /**
         * Returns a copy of the in-memory log.
         * @param {object} [filter]  Optional { level, appName, since } filter.
         * @returns {object[]}
         */
        getEntries: function (filter) {
            var result = _memory.slice();
            if (filter) {
                if (filter.level) {
                    var minLvl = LEVELS[filter.level] || 0;
                    result = result.filter(function (e) { return (LEVELS[e.level] || 0) >= minLvl; });
                }
                if (filter.appName) {
                    result = result.filter(function (e) { return e.appName === filter.appName; });
                }
                if (filter.since) {
                    result = result.filter(function (e) { return e.timestamp >= filter.since; });
                }
                if (filter.context) {
                    result = result.filter(function (e) { return e.context === filter.context; });
                }
            }
            return result;
        },

        /**
         * Clear the in-memory log and the localStorage entry.
         */
        clear: function () {
            _memory = [];
            if (global.localStorage) {
                try { global.localStorage.removeItem(_cfg.storageKey); } catch (e) { /* ignore */ }
            }
        },

        /**
         * Export in-memory entries as a JSON string (for download/debugging).
         * @param {object} [filter]
         * @returns {string}
         */
        exportJSON: function (filter) {
            return JSON.stringify(MajixLogger.getEntries(filter), null, 2);
        },

        /**
         * Immediately flush any queued remote log entries.
         * Only relevant when the 'remote' target is enabled.
         */
        flush: function () { _flushRemote(); },

        /**
         * Query IndexedDB log entries by level and/or time range.
         * Returns a Promise<LogEntry[]>.
         * @param {object} [opts]  { level, since, until, limit }
         */
        queryDB: function (opts) {
            return _openDB().then(function (db) {
                if (!db) return [];
                return new Promise(function (resolve) {
                    var results = [];
                    var o       = opts || {};
                    try {
                        var tx      = db.transaction(_cfg.dbStoreName, 'readonly');
                        var store   = tx.objectStore(_cfg.dbStoreName);
                        var request = store.openCursor(null, 'prev');
                        request.onsuccess = function (e) {
                            var cursor = e.target.result;
                            if (!cursor) { resolve(results.reverse()); return; }
                            if (o.limit && results.length >= o.limit) { resolve(results.reverse()); return; }
                            var entry = cursor.value;
                            var ok = true;
                            if (o.level  && (LEVELS[entry.level] || 0) < (LEVELS[o.level] || 0)) ok = false;
                            if (o.since  && entry.timestamp < o.since)  ok = false;
                            if (o.until  && entry.timestamp > o.until)  ok = false;
                            if (ok) results.push(entry);
                            cursor.continue();
                        };
                        request.onerror = function () { resolve(results.reverse()); };
                    } catch (e) { resolve([]); }
                });
            });
        },

        /**
         * Read-only view of the current resolved configuration.
         */
        get config() { return _merge(_cfg, {}); },

        /**
         * Read-only count of entries currently in the in-memory buffer.
         */
        get size() { return _memory.length; },
    };

    global.MajixLogger = MajixLogger;

}(typeof window !== 'undefined' ? window : this));
