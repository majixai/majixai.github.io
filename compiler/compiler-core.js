// /compiler/compiler-core.js — Shared Compiler Core for MajixAI
//
// Usage: set window.COMPILER_CONFIG before loading this script, then call
//   MajixCompiler.init();
//
// COMPILER_CONFIG options (all optional):
//
//   logToConsole      {boolean}
//     Print compile/run events to the browser console.
//     default: false
//
//   logLevel          'debug' | 'info' | 'warn' | 'error'
//     Minimum severity level for console output (requires logToConsole).
//     default: 'info'
//
//   historyLimit      {number}
//     Maximum number of compile/run results stored in the in-memory log.
//     0 disables history.
//     default: 100
//
//   timeout           {number}
//     Default request timeout in milliseconds for remote language adapters.
//     0 disables the timeout.
//     default: 10000
//
//   apiEndpoint       {string}
//     Base URL used by the built-in HTTP adapter for remote languages.
//     Requests go to: <apiEndpoint>/<language>/<action>  (action = 'run' | 'compile')
//     default: '/compiler/api'
//
//   defaultLanguage   {string}
//     Language assumed by compile() / run() when none is supplied.
//     default: 'javascript'
//
//   adapters          {object}
//     Map of language → adapter to register during init() in addition to built-ins.
//     default: {}
//
//   onCompile         {function(result)|null}
//     Optional callback invoked after every successful compile or run.
//     Receives the full Result object.
//     default: null
//
//   onError           {function(err, lang, code)|null}
//     Optional callback invoked when an adapter throws or rejects.
//     If omitted, the rejected Promise propagates normally.
//     default: null
//
// ─── Adapter interface ────────────────────────────────────────────────────────
//
//   An adapter is a plain object with at least one of:
//     compile(code, options) → Promise<Result>
//     run(code, options)     → Promise<Result>
//
//   And the flags:
//     canCompile  {boolean}
//     canRun      {boolean}
//
//   Result shape:
//     {
//       language  : string,          // normalised language id
//       status    : 'ok'|'error'|'timeout',
//       stdout    : string,          // captured standard output
//       stderr    : string,          // captured standard error / diagnostics
//       exitCode  : number,          // 0 = success
//       elapsed   : number,          // ms
//       output    : *,               // arbitrary return value (compile artefact, etc.)
//       error     : string|null,     // human-readable error message
//     }
//
// ─── Built-in language adapters ──────────────────────────────────────────────
//
//   javascript / js    — sandboxed browser eval (console capture)
//   html               — renders code into a sandboxed iframe via blob URL
//   json               — validates and pretty-prints JSON
//   All other languages are registered as remote adapters that POST to
//   <apiEndpoint>/<language>/<action>.
//
//   Default remote languages: python (py), r, java, typescript (ts),
//     sql, bash/shell/sh, go, rust, c, cpp, ruby (rb), php, kotlin,
//     swift, perl, lua, scala
//

(function (global) {
    'use strict';

    // ─── Default config ───────────────────────────────────────────────────────

    var DEFAULT_CONFIG = {
        logToConsole:    false,
        logLevel:        'info',
        historyLimit:    100,
        timeout:         10000,
        apiEndpoint:     '/compiler/api',
        defaultLanguage: 'javascript',
        adapters:        {},
        onCompile:       null,
        onError:         null,
    };

    // ─── Internal state ───────────────────────────────────────────────────────

    var _cfg         = {};
    var _adapters    = {};   // { normalised-lang: adapter }
    var _aliases     = {};   // { alias: canonical }
    var _history     = [];
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

    // ─── Console logging ──────────────────────────────────────────────────────

    function _clog(level, msg, data) {
        if (!_cfg.logToConsole) return;
        if ((LOG_LEVELS[level] || 0) < (LOG_LEVELS[_cfg.logLevel] || 0)) return;
        var method = (level === 'debug') ? 'log' : level;
        if (data !== undefined) {
            console[method]('[compiler-core]', msg, data);
        } else {
            console[method]('[compiler-core]', msg);
        }
    }

    // ─── History management ───────────────────────────────────────────────────

    function _addToHistory(result) {
        if (_cfg.historyLimit === 0) return;
        _history.push(result);
        if (_history.length > _cfg.historyLimit) {
            _history.splice(0, _history.length - _cfg.historyLimit);
        }
    }

    // ─── Language normalisation ───────────────────────────────────────────────

    function _normalise(lang) {
        if (!lang) return _cfg.defaultLanguage || 'javascript';
        var l = String(lang).toLowerCase().trim();
        return _aliases[l] || l;
    }

    function _registerAlias(alias, canonical) {
        _aliases[alias.toLowerCase()] = canonical.toLowerCase();
    }

    // ─── Result builder ───────────────────────────────────────────────────────

    function _makeResult(lang, overrides) {
        return _merge({
            language:  lang,
            status:    'ok',
            stdout:    '',
            stderr:    '',
            exitCode:  0,
            elapsed:   0,
            output:    null,
            error:     null,
            timestamp: Date.now(),
        }, overrides || {});
    }

    // ─── Remote HTTP adapter ──────────────────────────────────────────────────

    function _remoteRequest(lang, action, code, options) {
        var timeout   = (options && options.timeout != null) ? options.timeout : _cfg.timeout;
        var endpoint  = _cfg.apiEndpoint.replace(/\/$/, '') + '/' + lang + '/' + action;
        var startTime = Date.now();

        return new Promise(function (resolve) {
            var timedOut   = false;
            var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;

            var timer = (timeout > 0) ? setTimeout(function () {
                timedOut = true;
                if (controller) controller.abort();
                resolve(_makeResult(lang, {
                    status:   'timeout',
                    stderr:   'Request timed out after ' + timeout + 'ms',
                    exitCode: -1,
                    elapsed:  Date.now() - startTime,
                    error:    'timeout',
                }));
            }, timeout) : null;

            var fetchOptions = {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ code: code, options: options || {} }),
            };
            if (controller) fetchOptions.signal = controller.signal;

            fetch(endpoint, fetchOptions)
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
                    return r.json();
                })
                .then(function (data) {
                    if (timer) clearTimeout(timer);
                    if (timedOut) return;
                    var result = _makeResult(lang, _merge(data, {
                        language: lang,
                        elapsed:  (data.elapsed != null) ? data.elapsed : (Date.now() - startTime),
                    }));
                    resolve(result);
                })
                .catch(function (e) {
                    if (timer) clearTimeout(timer);
                    if (timedOut || (e && e.name === 'AbortError')) return;
                    resolve(_makeResult(lang, {
                        status:   'error',
                        stderr:   e.message,
                        exitCode: 1,
                        elapsed:  Date.now() - startTime,
                        error:    e.message,
                    }));
                });
        });
    }

    function _makeRemoteAdapter(canonical) {
        return {
            canCompile: true,
            canRun:     true,
            compile: function (code, options) {
                return _remoteRequest(canonical, 'compile', code, options);
            },
            run: function (code, options) {
                return _remoteRequest(canonical, 'run', code, options);
            },
        };
    }

    // ─── Built-in: JavaScript (sandboxed browser eval) ────────────────────────

    var _jsAdapter = {
        canCompile: true,
        canRun:     true,

        compile: function (code) {
            // Syntax-check only via Function constructor
            return new Promise(function (resolve) {
                var startTime = Date.now();
                try {
                    new Function(code); // throws SyntaxError on invalid code
                    resolve(_makeResult('javascript', {
                        elapsed: Date.now() - startTime,
                        stdout:  'Syntax OK',
                    }));
                } catch (e) {
                    resolve(_makeResult('javascript', {
                        status:   'error',
                        stderr:   e.message,
                        exitCode: 1,
                        elapsed:  Date.now() - startTime,
                        error:    e.message,
                    }));
                }
            });
        },

        run: function (code) {
            return new Promise(function (resolve) {
                var stdout    = [];
                var stderr    = [];
                var startTime = Date.now();

                var savedLog   = console.log;
                var savedInfo  = console.info;
                var savedWarn  = console.warn;
                var savedError = console.error;
                var savedDir   = console.dir;

                function _capture(bucket, args) {
                    bucket.push(Array.prototype.slice.call(args).map(function (a) {
                        if (a === null)      return 'null';
                        if (a === undefined) return 'undefined';
                        if (typeof a === 'object') {
                            try { return JSON.stringify(a); } catch (e2) { return String(a); }
                        }
                        return String(a);
                    }).join(' '));
                }

                try {
                    /* eslint-disable no-console */
                    console.log   = function () { _capture(stdout, arguments); savedLog.apply(console, arguments); };
                    console.info  = function () { _capture(stdout, arguments); savedInfo.apply(console, arguments); };
                    console.warn  = function () { _capture(stdout, arguments); savedWarn.apply(console, arguments); };
                    console.error = function () { _capture(stderr, arguments); savedError.apply(console, arguments); };
                    console.dir   = function () { _capture(stdout, arguments); savedDir.apply(console, arguments); };
                    /* eslint-enable no-console */

                    var fn     = new Function(code);
                    var output = fn();

                    resolve(_makeResult('javascript', {
                        stdout:  stdout.join('\n'),
                        stderr:  stderr.join('\n'),
                        elapsed: Date.now() - startTime,
                        output:  output,
                    }));
                } catch (e) {
                    resolve(_makeResult('javascript', {
                        status:   'error',
                        stdout:   stdout.join('\n'),
                        stderr:   e.message,
                        exitCode: 1,
                        elapsed:  Date.now() - startTime,
                        error:    e.message,
                    }));
                } finally {
                    console.log   = savedLog;
                    console.info  = savedInfo;
                    console.warn  = savedWarn;
                    console.error = savedError;
                    console.dir   = savedDir;
                }
            });
        },
    };

    // ─── Built-in: HTML (iframe blob-URL preview) ─────────────────────────────

    var _htmlAdapter = {
        canCompile: false,
        canRun:     true,

        run: function (code) {
            return new Promise(function (resolve) {
                var startTime = Date.now();
                try {
                    var blob = new Blob([code], { type: 'text/html' });
                    var url  = URL.createObjectURL(blob);
                    resolve(_makeResult('html', {
                        elapsed: Date.now() - startTime,
                        stdout:  url,   // caller may set iframe.src = result.stdout
                        output:  url,
                    }));
                } catch (e) {
                    resolve(_makeResult('html', {
                        status:   'error',
                        stderr:   e.message,
                        exitCode: 1,
                        elapsed:  Date.now() - startTime,
                        error:    e.message,
                    }));
                }
            });
        },
    };

    // ─── Built-in: JSON (validate + pretty-print) ─────────────────────────────

    var _jsonAdapter = {
        canCompile: true,
        canRun:     true,

        compile: function (code) {
            return new Promise(function (resolve) {
                var startTime = Date.now();
                try {
                    JSON.parse(code);
                    resolve(_makeResult('json', {
                        elapsed: Date.now() - startTime,
                        stdout:  'Valid JSON',
                    }));
                } catch (e) {
                    resolve(_makeResult('json', {
                        status:   'error',
                        stderr:   e.message,
                        exitCode: 1,
                        elapsed:  Date.now() - startTime,
                        error:    e.message,
                    }));
                }
            });
        },

        run: function (code) {
            return new Promise(function (resolve) {
                var startTime = Date.now();
                try {
                    var parsed = JSON.parse(code);
                    var pretty = JSON.stringify(parsed, null, 2);
                    resolve(_makeResult('json', {
                        elapsed: Date.now() - startTime,
                        stdout:  pretty,
                        output:  parsed,
                    }));
                } catch (e) {
                    resolve(_makeResult('json', {
                        status:   'error',
                        stderr:   e.message,
                        exitCode: 1,
                        elapsed:  Date.now() - startTime,
                        error:    e.message,
                    }));
                }
            });
        },
    };

    // ─── Register defaults ────────────────────────────────────────────────────

    function _registerDefaults() {
        // Browser-native adapters
        _adapters['javascript'] = _jsAdapter;
        _adapters['html']       = _htmlAdapter;
        _adapters['json']       = _jsonAdapter;

        // Aliases for browser-native languages
        _registerAlias('js',  'javascript');
        _registerAlias('htm', 'html');

        // Remote language adapters
        var remoteLanguages = [
            'python', 'r', 'java', 'typescript',
            'sql', 'bash', 'shell', 'sh',
            'go', 'rust', 'c', 'cpp',
            'ruby', 'php', 'kotlin', 'swift',
            'perl', 'lua', 'scala',
        ];
        remoteLanguages.forEach(function (lang) {
            _adapters[lang] = _makeRemoteAdapter(lang);
        });

        // Aliases for remote languages
        _registerAlias('py',  'python');
        _registerAlias('ts',  'typescript');
        _registerAlias('rb',  'ruby');
        _registerAlias('c++', 'cpp');
    }

    // ─── Core execute ─────────────────────────────────────────────────────────

    function _execute(action, lang, code, options) {
        var canonical = _normalise(lang);
        var adapter   = _adapters[canonical];

        if (!adapter) {
            return Promise.resolve(_makeResult(canonical, {
                status:   'error',
                stderr:   'No adapter registered for language: ' + canonical,
                exitCode: 1,
                error:    'unsupported language: ' + canonical,
            }));
        }

        if (action === 'compile' && !adapter.compile) {
            return Promise.resolve(_makeResult(canonical, {
                status:   'error',
                stderr:   'Compile is not supported for ' + canonical + ' — try run() instead',
                exitCode: 1,
                error:    'compile not supported for ' + canonical,
            }));
        }

        if (action === 'run' && !adapter.run) {
            return Promise.resolve(_makeResult(canonical, {
                status:   'error',
                stderr:   'Run is not supported for ' + canonical + ' — try compile() instead',
                exitCode: 1,
                error:    'run not supported for ' + canonical,
            }));
        }

        _clog('info', action + ' [' + canonical + ']');

        return Promise.resolve()
            .then(function () {
                return action === 'compile'
                    ? adapter.compile(code, options || {})
                    : adapter.run(code, options || {});
            })
            .then(function (result) {
                result.language = canonical;
                _addToHistory(result);
                _clog('debug', action + ' result', result);
                if (typeof _cfg.onCompile === 'function') {
                    try { _cfg.onCompile(result); } catch (e) { _clog('warn', 'onCompile threw', e); }
                }
                return result;
            })
            .catch(function (err) {
                var errResult = _makeResult(canonical, {
                    status:   'error',
                    stderr:   err && err.message ? err.message : String(err),
                    exitCode: 1,
                    elapsed:  0,
                    error:    err && err.message ? err.message : String(err),
                });
                _addToHistory(errResult);
                if (typeof _cfg.onError === 'function') {
                    try { _cfg.onError(err, canonical, code); } catch (e2) { /* ignore */ }
                    return errResult;
                }
                throw err;
            });
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    var MajixCompiler = {

        /**
         * Initialize the compiler core.
         * Reads window.COMPILER_CONFIG and registers built-in + user adapters.
         * Safe to call multiple times (re-reads configuration).
         */
        init: function () {
            if (_initialized) {
                _clog('warn', 'MajixCompiler already initialized — re-initializing');
            }
            var userCfg  = (global.COMPILER_CONFIG && typeof global.COMPILER_CONFIG === 'object')
                ? global.COMPILER_CONFIG : {};
            _cfg         = _merge(DEFAULT_CONFIG, userCfg);
            _adapters    = {};
            _aliases     = {};
            _initialized = true;
            _registerDefaults();
            // Apply extra adapters from config
            if (userCfg.adapters && typeof userCfg.adapters === 'object') {
                for (var lang in userCfg.adapters) {
                    if (Object.prototype.hasOwnProperty.call(userCfg.adapters, lang)) {
                        _adapters[lang.toLowerCase()] = userCfg.adapters[lang];
                    }
                }
            }
            _clog('info', 'initialized', _cfg);
        },

        /**
         * Compile source code for the given language.
         * Uses the adapter's compile() method (syntax-check / transpile).
         * @param {string}  lang      Language identifier (e.g. 'python', 'js').
         * @param {string}  code      Source code to compile.
         * @param {object}  [options] Per-call overrides (e.g. { timeout: 5000 }).
         * @returns {Promise<Result>}
         */
        compile: function (lang, code, options) {
            if (!_initialized) MajixCompiler.init();
            return _execute('compile', lang, code, options);
        },

        /**
         * Compile and run source code for the given language.
         * @param {string}  lang
         * @param {string}  code
         * @param {object}  [options]
         * @returns {Promise<Result>}
         */
        run: function (lang, code, options) {
            if (!_initialized) MajixCompiler.init();
            return _execute('run', lang, code, options);
        },

        /**
         * Register a custom language adapter (or override a built-in one).
         * @param {string}   lang      Language identifier (e.g. 'brainfuck').
         * @param {object}   adapter   Object with compile() and/or run() methods.
         * @param {string[]} [aliases] Optional alias strings for this language.
         */
        register: function (lang, adapter, aliases) {
            if (!lang || typeof adapter !== 'object') {
                throw new Error('[compiler-core] register: lang and adapter are required');
            }
            var key = lang.toLowerCase().trim();
            _adapters[key] = adapter;
            if (Array.isArray(aliases)) {
                aliases.forEach(function (a) { _registerAlias(a, key); });
            }
            _clog('info', 'registered adapter for ' + key);
        },

        /**
         * Remove a registered language adapter.
         * @param {string} lang
         */
        unregister: function (lang) {
            var key = _normalise(lang);
            delete _adapters[key];
        },

        /**
         * Check whether a language has a registered adapter.
         * @param {string} lang
         * @returns {boolean}
         */
        isSupported: function (lang) {
            return !!_adapters[_normalise(lang)];
        },

        /**
         * List all registered canonical language identifiers.
         * @returns {string[]}
         */
        getSupportedLanguages: function () {
            return Object.keys(_adapters);
        },

        /**
         * Retrieve compilation/run history (most recent first).
         * @param {number} [limit]
         * @returns {Result[]}
         */
        history: function (limit) {
            var copy = _history.slice().reverse();
            return (limit && limit > 0) ? copy.slice(0, limit) : copy;
        },

        /**
         * Clear the in-memory compile/run history.
         */
        clearHistory: function () {
            _history = [];
        },

        /**
         * Read-only view of the current resolved configuration.
         */
        get config() { return _merge(_cfg, {}); },
    };

    global.MajixCompiler = MajixCompiler;

}(typeof window !== 'undefined' ? window : this));
