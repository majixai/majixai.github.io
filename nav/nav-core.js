// /nav/nav-core.js — Shared Menu Processing Core for MajixAI
//
// Usage: set window.MENU_CONFIG before loading this script, then call
//   MajixNav.init();
//
// MENU_CONFIG options (all optional):
//
//   storageKey        {string}
//     localStorage / sessionStorage key for persisting links.
//     default: 'majixNavLinks'
//
//   dbName            {string}
//     IndexedDB database name.
//     default: 'MajixNavDB'
//
//   dbStoreName       {string}
//     IndexedDB object-store name.
//     default: 'links'
//
//   cookieName        {string}
//     Cookie key used for cookie-based persistence.
//     default: 'majixNavLinks'
//
//   cookieMaxAge      {number}
//     Cookie max-age in seconds.
//     default: 31536000  (1 year)
//
//   menuListSelector  {string}
//     CSS selector for the <ul> / <ol> that receives rendered items.
//     default: '#menu-list'
//
//   addFormSelector   {string}
//     CSS selector for the add-link form container.  When present, nav-core
//     injects the standard "Link Name / Link URL / Add Link" inputs.
//     default: '#add-link-container'
//
//   initialLinks      {Array<{name:string, url:string, [type]:string}>}
//     Hard-coded links inserted when no persisted data exists.
//     default: []
//
//   onLinkClick       {function(link, event)|null}
//     Optional callback invoked when a rendered link is clicked.
//     Receives the link object and the original DOM event.
//     default: null
//
//   copyOnClick       {boolean}
//     When true, clicking a rendered link copies its formatted Markdown
//     source ([name](url)) to the clipboard.
//     default: true
//
//   persistMethods    {string[]}
//     Storage back-ends to write to on every change.
//     Supported values: 'indexedDB', 'sessionStorage', 'cookie', 'localStorage'
//     default: ['indexedDB', 'sessionStorage', 'cookie', 'localStorage']
//

(function (global) {
    'use strict';

    // ─── Default config ───────────────────────────────────────────────────────

    var DEFAULT_CONFIG = {
        storageKey:       'majixNavLinks',
        dbName:           'MajixNavDB',
        dbStoreName:      'links',
        cookieName:       'majixNavLinks',
        cookieMaxAge:     31536000,
        menuListSelector: '#menu-list',
        addFormSelector:  '#add-link-container',
        initialLinks:     [],
        onLinkClick:      null,
        copyOnClick:      true,
        persistMethods:   ['indexedDB', 'sessionStorage', 'cookie', 'localStorage'],
    };

    // ─── Internal state ───────────────────────────────────────────────────────

    var _cfg = {};
    var _db  = null;   // IndexedDB instance

    // ─── Utility: shallow-merge two plain objects ─────────────────────────────

    function _merge(defaults, overrides) {
        var out = {};
        for (var key in defaults) {
            if (Object.prototype.hasOwnProperty.call(defaults, key)) {
                out[key] = defaults[key];
            }
        }
        if (overrides && typeof overrides === 'object') {
            for (var overrideKey in overrides) {
                if (Object.prototype.hasOwnProperty.call(overrides, overrideKey)) {
                    out[overrideKey] = overrides[overrideKey];
                }
            }
        }
        return out;
    }

    // ─── Utility: URL safety check ────────────────────────────────────────────

    function _isSafeUrl(url) {
        try {
            var parsed = new URL(url, global.location && global.location.href);
            return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch (e) {
            return false;
        }
    }

    // ─── Storage: IndexedDB ───────────────────────────────────────────────────

    function _openDB() {
        return new Promise(function (resolve) {
            if (!global.indexedDB) { return resolve(null); }
            if (_db) { return resolve(_db); }
            var req = global.indexedDB.open(_cfg.dbName, 1);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(_cfg.dbStoreName)) {
                    db.createObjectStore(_cfg.dbStoreName, { keyPath: 'url' });
                }
            };
            req.onsuccess = function (e) {
                _db = e.target.result;
                resolve(_db);
            };
            req.onerror = function () {
                console.warn('[nav-core] IndexedDB open failed:', req.error);
                resolve(null);
            };
        });
    }

    function _saveToIndexedDB(link) {
        _openDB().then(function (db) {
            if (!db) { return; }
            try {
                var tx    = db.transaction(_cfg.dbStoreName, 'readwrite');
                var store = tx.objectStore(_cfg.dbStoreName);
                store.put(link);
            } catch (err) {
                console.warn('[nav-core] IndexedDB put failed:', err);
            }
        });
    }

    function _deleteFromIndexedDB(url) {
        _openDB().then(function (db) {
            if (!db) { return; }
            try {
                var tx    = db.transaction(_cfg.dbStoreName, 'readwrite');
                var store = tx.objectStore(_cfg.dbStoreName);
                store.delete(url);
            } catch (err) {
                console.warn('[nav-core] IndexedDB delete failed:', err);
            }
        });
    }

    function _loadFromIndexedDB() {
        return _openDB().then(function (db) {
            if (!db) { return []; }
            return new Promise(function (resolve) {
                try {
                    var tx    = db.transaction(_cfg.dbStoreName, 'readonly');
                    var store = tx.objectStore(_cfg.dbStoreName);
                    if (store.getAll) {
                        var req = store.getAll();
                        req.onsuccess = function () { resolve(req.result || []); };
                        req.onerror   = function () { resolve([]); };
                    } else {
                        // Fallback cursor iteration for older browsers
                        var items = [];
                        var cursorReq = store.openCursor();
                        cursorReq.onsuccess = function (e) {
                            var cursor = e.target.result;
                            if (cursor) { items.push(cursor.value); cursor.continue(); }
                            else        { resolve(items); }
                        };
                        cursorReq.onerror = function () { resolve(items); };
                    }
                } catch (err) {
                    console.warn('[nav-core] IndexedDB read failed:', err);
                    resolve([]);
                }
            });
        });
    }

    // ─── Storage: sessionStorage ──────────────────────────────────────────────

    function _saveToSession(links) {
        try {
            global.sessionStorage.setItem(_cfg.storageKey, JSON.stringify(links));
        } catch (e) {
            console.warn('[nav-core] sessionStorage write failed:', e);
        }
    }

    function _loadFromSession() {
        try {
            var raw = global.sessionStorage.getItem(_cfg.storageKey);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    // ─── Storage: localStorage ────────────────────────────────────────────────

    function _saveToLocal(links) {
        try {
            global.localStorage.setItem(_cfg.storageKey, JSON.stringify(links));
        } catch (e) {
            console.warn('[nav-core] localStorage write failed:', e);
        }
    }

    function _loadFromLocal() {
        try {
            var raw = global.localStorage.getItem(_cfg.storageKey);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    // ─── Storage: cookies ─────────────────────────────────────────────────────

    function _saveToCookie(links) {
        try {
            var name = _cfg.cookieName;
            var val  = encodeURIComponent(JSON.stringify(links));
            var age  = _cfg.cookieMaxAge;
            global.document.cookie =
                name + '=' + val +
                ';path=/;max-age=' + age + ';SameSite=Lax';
        } catch (e) {
            console.warn('[nav-core] cookie write failed:', e);
        }
    }

    function _loadFromCookie() {
        try {
            var name = _cfg.cookieName;
            var pattern = new RegExp(
                '(?:^|.*;\\s*)' +
                name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                '\\s*=\\s*([^;]*).*$'
            );
            var raw = global.document.cookie.replace(pattern, '$1');
            return raw && raw !== global.document.cookie
                ? JSON.parse(decodeURIComponent(raw))
                : [];
        } catch (e) {
            return [];
        }
    }

    // ─── Persist to all configured back-ends ─────────────────────────────────

    function _persistAll(links) {
        var methods = _cfg.persistMethods;
        if (methods.indexOf('localStorage')   !== -1) { _saveToLocal(links);   }
        if (methods.indexOf('sessionStorage') !== -1) { _saveToSession(links); }
        if (methods.indexOf('cookie')         !== -1) { _saveToCookie(links);  }
        // IndexedDB is written per-item via _saveToIndexedDB / _deleteFromIndexedDB
    }

    // ─── Clipboard ────────────────────────────────────────────────────────────

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        // Legacy fallback
        return new Promise(function (resolve) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity  = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) { /* noop */ }
            document.body.removeChild(ta);
            resolve();
        });
    }

    // ─── DOM: render one link item ────────────────────────────────────────────

    function _renderLink(link, listEl) {
        if (!_isSafeUrl(link.url)) {
            console.warn('[nav-core] Skipping link with unsafe URL:', link.url);
            return;
        }

        var displayName = link.name || link.text || link.url;

        var li = document.createElement('li');
        li.setAttribute('data-url',  link.url);
        li.setAttribute('data-name', displayName);

        var a = document.createElement('a');
        a.href        = link.url;
        a.textContent = displayName;
        a.target      = '_blank';
        a.rel         = 'noopener noreferrer';
        li.appendChild(a);

        var del = document.createElement('button');
        del.className   = 'nav-core-delete-btn';
        del.textContent = '×';
        del.setAttribute('aria-label', 'Remove link');
        del.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            MajixNav.removeLink(link.url);
        });
        li.appendChild(del);

        li.addEventListener('click', function (e) {
            if (e.target === del) { return; }
            if (_cfg.copyOnClick) {
                var md = '[' + displayName + '](' + link.url + ')';
                copyToClipboard(md).catch(function () {});
            }
            if (typeof _cfg.onLinkClick === 'function') {
                _cfg.onLinkClick(link, e);
            }
        });

        listEl.appendChild(li);
    }

    // ─── DOM: inject add-link form ────────────────────────────────────────────

    function _injectAddForm() {
        var container = document.querySelector(_cfg.addFormSelector);
        if (!container) { return; }

        container.innerHTML =
            '<label class="nav-core-label">' +
                'Name&nbsp;<input type="text" id="nav-core-link-name" ' +
                'placeholder="Link name" autocomplete="off">' +
            '</label>' +
            '<label class="nav-core-label">' +
                'URL&nbsp;<input type="url" id="nav-core-link-url" ' +
                'placeholder="https://" autocomplete="off">' +
            '</label>' +
            '<button id="nav-core-add-btn" type="button">Add Link</button>';

        document.getElementById('nav-core-add-btn').addEventListener('click', function () {
            var name = document.getElementById('nav-core-link-name').value.trim();
            var url  = document.getElementById('nav-core-link-url').value.trim();
            if (!name || !url) {
                alert('Please enter both a name and a valid URL (http:// or https://).');
                return;
            }
            if (!_isSafeUrl(url)) {
                alert('URL must start with http:// or https://');
                return;
            }
            MajixNav.addLink({ name: name, url: url });
            document.getElementById('nav-core-link-name').value = '';
            document.getElementById('nav-core-link-url').value  = '';
        });
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    var MajixNav = {

        /**
         * Initialise nav-core.
         *
         * Reads window.MENU_CONFIG, merges with defaults, loads persisted links
         * (IndexedDB → localStorage → sessionStorage → cookie → initialLinks),
         * renders them, and wires up the optional add-link form.
         *
         * @returns {Promise<Array>} Resolves with the loaded link array.
         */
        init: function () {
            _cfg = _merge(DEFAULT_CONFIG, global.MENU_CONFIG || {});

            var listEl = document.querySelector(_cfg.menuListSelector);
            if (!listEl) {
                console.warn('[nav-core] menuListSelector not found:', _cfg.menuListSelector);
            }

            _injectAddForm();

            return _loadFromIndexedDB().then(function (idbLinks) {
                var local   = _loadFromLocal();
                var session = _loadFromSession();
                var cookie  = _loadFromCookie();

                var links = idbLinks.length   ? idbLinks
                          : local.length      ? local
                          : session.length    ? session
                          : cookie.length     ? cookie
                          : (_cfg.initialLinks || []);

                if (listEl) {
                    links.forEach(function (link) { _renderLink(link, listEl); });
                }
                return links;
            });
        },

        /**
         * Add a link to all storage back-ends and render it in the menu list.
         * If a link with the same URL already exists it is updated in storage
         * but not re-rendered.
         *
         * @param {{name:string, url:string, [type]:string}} link
         */
        addLink: function (link) {
            if (!link || !link.url) {
                console.warn('[nav-core] addLink: url is required');
                return;
            }
            if (!_isSafeUrl(link.url)) {
                console.warn('[nav-core] addLink: rejected unsafe URL:', link.url);
                return;
            }
            var normalized = { name: link.name || link.text || link.url, url: link.url };
            if (link.type) { normalized.type = link.type; }

            if (_cfg.persistMethods.indexOf('indexedDB') !== -1) {
                _saveToIndexedDB(normalized);
            }

            var existing = _loadFromLocal();
            var found    = false;
            for (var i = 0; i < existing.length; i++) {
                if (existing[i].url === normalized.url) {
                    existing[i] = normalized;
                    found = true;
                    break;
                }
            }
            if (!found) { existing.push(normalized); }
            _persistAll(existing);

            if (!found) {
                var listEl = document.querySelector(_cfg.menuListSelector);
                if (listEl) { _renderLink(normalized, listEl); }
            }
        },

        /**
         * Remove a link by URL from all storage back-ends and the DOM.
         *
         * @param {string} url
         */
        removeLink: function (url) {
            if (_cfg.persistMethods.indexOf('indexedDB') !== -1) {
                _deleteFromIndexedDB(url);
            }
            var links = _loadFromLocal().filter(function (l) { return l.url !== url; });
            _persistAll(links);

            var listEl = document.querySelector(_cfg.menuListSelector);
            if (listEl) {
                var items = listEl.querySelectorAll('li[data-url]');
                for (var i = 0; i < items.length; i++) {
                    if (items[i].getAttribute('data-url') === url) {
                        listEl.removeChild(items[i]);
                        break;
                    }
                }
            }
        },

        /**
         * Copy arbitrary text to the clipboard.
         * Uses the async Clipboard API where available, with a textarea fallback.
         *
         * @param {string} text
         * @returns {Promise<void>}
         */
        copyToClipboard: copyToClipboard,

        /**
         * Low-level storage helpers exposed for advanced callers.
         */
        storage: {
            saveToIndexedDB:   _saveToIndexedDB,
            loadFromIndexedDB: _loadFromIndexedDB,
            saveToSession:     _saveToSession,
            loadFromSession:   _loadFromSession,
            saveToLocal:       _saveToLocal,
            loadFromLocal:     _loadFromLocal,
            saveToCookie:      _saveToCookie,
            loadFromCookie:    _loadFromCookie,
        },

        /** Current resolved config (read-only). */
        get config() { return _cfg; },
    };

    global.MajixNav = MajixNav;

}(typeof window !== 'undefined' ? window : this));
