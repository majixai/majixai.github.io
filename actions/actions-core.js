// /actions/actions-core.js — Shared Action Dispatcher Core for MajixAI
//
// Usage: set window.ACTIONS_CONFIG before loading this script, then call
//   MajixActions.init();
//
// ACTIONS_CONFIG options (all optional):
//
//   namespace         {string}
//     Prefix added to every action type string for namespacing.
//     default: 'majix'
//
//   historyLimit      {number}
//     Maximum number of dispatched actions stored in the in-memory log.
//     0 disables the in-memory log.
//     default: 200
//
//   persistHistory    {boolean}
//     When true, the action history is persisted to localStorage under
//     `storageKey` on every dispatch.
//     default: false
//
//   storageKey        {string}
//     localStorage key used when persistHistory is true.
//     default: 'majixActionsHistory'
//
//   logToConsole      {boolean}
//     When true, every dispatched action is printed to the browser console.
//     default: false
//
//   logLevel          'debug' | 'info' | 'warn' | 'error'
//     Minimum severity level for console output (requires logToConsole).
//     default: 'info'
//
//   onDispatch        {function(action)|null}
//     Optional callback invoked synchronously after every dispatch.
//     Receives the fully-resolved action object { type, payload, meta }.
//     default: null
//
//   onError           {function(err, action)|null}
//     Optional callback invoked when a handler throws.
//     If omitted, errors are re-thrown.
//     default: null
//
//   middleware        {function[]}
//     Array of middleware functions applied before handlers.
//     Each middleware: (action, next) => { /* mutate action or call next(action) */ }
//     default: []
//

(function (global) {
    'use strict';

    // ─── Default config ───────────────────────────────────────────────────────

    var DEFAULT_CONFIG = {
        namespace:      'majix',
        historyLimit:   200,
        persistHistory: false,
        storageKey:     'majixActionsHistory',
        logToConsole:   false,
        logLevel:       'info',
        onDispatch:     null,
        onError:        null,
        middleware:     [],
    };

    // ─── Internal state ───────────────────────────────────────────────────────

    var _cfg         = {};
    var _handlers    = {};   // { type: [fn, ...] }
    var _history     = [];
    var _middleware  = [];
    var _initialized = false;

    var LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

    // ─── Utility: shallow-merge two plain objects ─────────────────────────────

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

    // ─── Utility: namespace helper ────────────────────────────────────────────

    function _ns(type) {
        if (!_cfg.namespace || type === '*' || type.indexOf(_cfg.namespace + '/') === 0) return type;
        return _cfg.namespace + '/' + type;
    }

    // ─── Console logging ──────────────────────────────────────────────────────

    function _clog(level, msg, data) {
        if (!_cfg.logToConsole) return;
        if ((LOG_LEVELS[level] || 0) < (LOG_LEVELS[_cfg.logLevel] || 0)) return;
        var method = (level === 'debug') ? 'log' : level;
        if (data !== undefined) {
            console[method]('[actions-core]', msg, data);
        } else {
            console[method]('[actions-core]', msg);
        }
    }

    // ─── History management ───────────────────────────────────────────────────

    function _addToHistory(action) {
        if (_cfg.historyLimit === 0) return;
        _history.push(action);
        if (_history.length > _cfg.historyLimit) {
            _history.splice(0, _history.length - _cfg.historyLimit);
        }
        if (_cfg.persistHistory) {
            try {
                global.localStorage.setItem(_cfg.storageKey, JSON.stringify(_history));
            } catch (e) {
                _clog('warn', 'Failed to persist history to localStorage', e);
            }
        }
    }

    function _loadHistory() {
        if (!_cfg.persistHistory) return;
        try {
            var raw = global.localStorage && global.localStorage.getItem(_cfg.storageKey);
            if (raw) {
                _history = JSON.parse(raw) || [];
            }
        } catch (e) {
            _clog('warn', 'Failed to load history from localStorage', e);
        }
    }

    // ─── Middleware pipeline ──────────────────────────────────────────────────

    function _runMiddleware(action, finalCb) {
        var mw = _middleware.slice();
        function next(a) {
            if (!mw.length) { finalCb(a); return; }
            var fn = mw.shift();
            try { fn(a, next); } catch (e) { _handleError(e, a); }
        }
        next(action);
    }

    // ─── Error handling ───────────────────────────────────────────────────────

    function _handleError(err, action) {
        if (typeof _cfg.onError === 'function') {
            _cfg.onError(err, action);
        } else {
            throw err;
        }
    }

    // ─── Core dispatch ────────────────────────────────────────────────────────

    function _executeAction(action) {
        _addToHistory(action);
        _clog('info', 'dispatch \u2192 ' + action.type, action.payload);

        var list         = _handlers[action.type] || [];
        var wildcardList = _handlers['*'] || [];
        var allHandlers  = list.concat(wildcardList);

        var results = allHandlers.map(function (fn) {
            try {
                return fn(action.payload, action);
            } catch (e) {
                _handleError(e, action);
                return undefined;
            }
        });

        if (typeof _cfg.onDispatch === 'function') {
            try { _cfg.onDispatch(action); } catch (e) { _clog('warn', 'onDispatch threw', e); }
        }

        var hasPromise = results.some(function (r) { return r && typeof r.then === 'function'; });
        if (hasPromise) {
            return Promise.all(results.map(function (r) {
                return (r && typeof r.then === 'function') ? r : Promise.resolve(r);
            }));
        }
        return results.length === 1 ? results[0] : results;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    var MajixActions = {

        /**
         * Initialize the action dispatcher.
         * Reads window.ACTIONS_CONFIG, wires middleware, and loads persisted history.
         */
        init: function () {
            if (_initialized) {
                _clog('warn', 'MajixActions already initialized — re-initializing');
            }
            var userCfg = (global.ACTIONS_CONFIG && typeof global.ACTIONS_CONFIG === 'object')
                ? global.ACTIONS_CONFIG : {};
            _cfg        = _merge(DEFAULT_CONFIG, userCfg);
            _middleware = Array.isArray(_cfg.middleware) ? _cfg.middleware.slice() : [];
            _initialized = true;
            _loadHistory();
            _clog('info', 'initialized', _cfg);
        },

        /**
         * Register a handler for one or more action types.
         * @param {string|string[]} type     Action type(s). Use '*' for wildcard.
         * @param {function}        handler  fn(payload, action) → any | Promise<any>
         * @returns {function}  Unsubscribe function.
         */
        on: function (type, handler) {
            var types = Array.isArray(type) ? type : [type];
            types.forEach(function (t) {
                var key = _ns(t);
                if (!_handlers[key]) _handlers[key] = [];
                _handlers[key].push(handler);
            });
            return function () {
                types.forEach(function (t) {
                    var key = _ns(t);
                    var idx = (_handlers[key] || []).indexOf(handler);
                    if (idx !== -1) _handlers[key].splice(idx, 1);
                });
            };
        },

        /**
         * Register a one-time handler. Auto-removed after first invocation.
         * @param {string}   type
         * @param {function} handler
         * @returns {function} Unsubscribe function.
         */
        once: function (type, handler) {
            var key = _ns(type);
            var unsub;
            var wrapper = function (payload, action) {
                unsub();
                return handler(payload, action);
            };
            unsub = MajixActions.on(key, wrapper);
            return unsub;
        },

        /**
         * Dispatch an action through middleware and into registered handlers.
         * @param {string}  type     Action type.
         * @param {*}       payload  Optional payload.
         * @param {object}  meta     Optional metadata object.
         * @returns {*|Promise<*>} Handler result(s).
         */
        dispatch: function (type, payload, meta) {
            if (!_initialized) MajixActions.init();
            var action = {
                type:    _ns(type),
                payload: (payload !== undefined) ? payload : null,
                meta:    _merge({ timestamp: Date.now() }, meta || {}),
            };
            var result;
            _runMiddleware(action, function (a) { result = _executeAction(a); });
            return result;
        },

        /**
         * Async dispatch — always returns a Promise.
         * @param {string}  type
         * @param {*}       payload
         * @param {object}  meta
         * @returns {Promise<*>}
         */
        dispatchAsync: function (type, payload, meta) {
            try {
                var r = MajixActions.dispatch(type, payload, meta);
                return (r && typeof r.then === 'function') ? r : Promise.resolve(r);
            } catch (e) {
                return Promise.reject(e);
            }
        },

        /**
         * Add middleware to the pipeline (appended after any config-supplied middleware).
         * @param {function} fn  (action, next) => void
         */
        use: function (fn) {
            if (typeof fn === 'function') _middleware.push(fn);
        },

        /**
         * Remove all handlers for a given action type, or all handlers if type is omitted.
         * @param {string} [type]
         */
        off: function (type) {
            if (type === undefined) {
                _handlers = {};
            } else {
                delete _handlers[_ns(type)];
            }
        },

        /**
         * Returns a copy of the in-memory action history (most recent first).
         * @param {number} [limit]  Maximum entries to return.
         * @returns {object[]}
         */
        history: function (limit) {
            var copy = _history.slice().reverse();
            return (limit && limit > 0) ? copy.slice(0, limit) : copy;
        },

        /**
         * Clear the in-memory and persisted action history.
         */
        clearHistory: function () {
            _history = [];
            if (_cfg.persistHistory) {
                try { global.localStorage.removeItem(_cfg.storageKey); } catch (e) { /* ignore */ }
            }
        },

        /**
         * Check whether any handler is registered for the given type.
         * @param {string} type
         * @returns {boolean}
         */
        hasHandler: function (type) {
            var key = _ns(type);
            return !!(_handlers[key] && _handlers[key].length > 0);
        },

        /**
         * Read-only view of the current resolved configuration.
         */
        get config() { return _merge(_cfg, {}); },
    };

    global.MajixActions = MajixActions;

}(typeof window !== 'undefined' ? window : this));
