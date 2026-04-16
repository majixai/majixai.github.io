// /wiki/wiki-core.js — Shared Wiki Storage & Management Core for MajixAI
//
// Usage:
//   window.WIKI_CONFIG = { namespace: 'wiki', storageKey: 'majixWikiPages' };
//   <script src="/wiki/wiki-core.js"></script>
//   MajixWiki.init();
//
// If /actions/actions-core.js is loaded, MajixWiki can dispatch action events
// like page/create, page/update, page/delete, page/clear.

(function (root) {
  'use strict';

  var DEFAULTS = {
    namespace: 'wiki',
    storageKey: 'majixWikiPages',
    maxPages: 1000,
    autoPersist: true,
    autoDispatch: true
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function slugify(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ('wiki-' + Date.now());
  }

  var _idCounter = 0;
  function generateId() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') {
      return root.crypto.randomUUID();
    }
    _idCounter = (_idCounter + 1) % 1000000;
    return Date.now().toString(36) + '-' + _idCounter.toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  var _cfg = clone(DEFAULTS);
  var _pages = [];
  var _events = {};

  function emit(eventName, payload) {
    var handlers = _events[eventName] || [];
    handlers.slice().forEach(function (fn) {
      try {
        fn(payload);
      } catch (e) {
        try { console.warn('[MajixWiki] event handler error:', eventName, e); } catch (_) { /* noop */ }
      }
    });
  }

  function dispatch(actionType, payload) {
    if (!_cfg.autoDispatch) return;
    if (typeof root.MajixActions === 'undefined') return;
    try {
      root.MajixActions.dispatch(actionType, payload || {});
    } catch (e) {
      emit('error', { message: 'Action dispatch failed', actionType: actionType, error: e });
    }
  }

  function persist() {
    if (!_cfg.autoPersist) return;
    try {
      root.localStorage.setItem(_cfg.storageKey, JSON.stringify(_pages));
    } catch (e) {
      emit('error', { message: 'Failed to persist wiki pages', error: e });
    }
  }

  function load() {
    try {
      var raw = root.localStorage.getItem(_cfg.storageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      _pages = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      _pages = [];
      emit('error', { message: 'Failed to load wiki pages', error: e });
    }
  }

  function resolve(input) {
    var key = String(input || '');
    return _pages.find(function (p) { return p.id === key || p.slug === key; }) || null;
  }

  function ensureCapacity() {
    if (_pages.length <= _cfg.maxPages) return;
    _pages.sort(function (a, b) {
      return String(a.updatedAt || '').localeCompare(String(b.updatedAt || ''));
    });
    var removed = _pages.slice(0, Math.max(0, _pages.length - _cfg.maxPages));
    _pages = _pages.slice(_pages.length - _cfg.maxPages);
    emit('pages_truncated', { removed: clone(removed), kept: _pages.length, maxPages: _cfg.maxPages });
    dispatch('page/truncated', { removed: removed.length, kept: _pages.length, maxPages: _cfg.maxPages });
  }

  function uniqueSlug(base, selfId) {
    var candidate = slugify(base);
    var n = 2;
    while (_pages.some(function (p) { return p.slug === candidate && p.id !== selfId; })) {
      candidate = slugify(base) + '-' + n;
      n += 1;
    }
    return candidate;
  }

  var MajixWiki = {
    init: function (config) {
      _cfg = Object.assign({}, DEFAULTS, root.WIKI_CONFIG || {}, config || {});
      load();
      emit('init', { config: clone(_cfg), count: _pages.length });
      return this;
    },

    on: function (eventName, handler) {
      if (!_events[eventName]) _events[eventName] = [];
      _events[eventName].push(handler);
      return function () { MajixWiki.off(eventName, handler); };
    },

    off: function (eventName, handler) {
      if (!_events[eventName]) return;
      if (!handler) {
        delete _events[eventName];
        return;
      }
      _events[eventName] = _events[eventName].filter(function (h) { return h !== handler; });
      if (_events[eventName].length === 0) delete _events[eventName];
    },

    list: function () {
      return clone(_pages).sort(function (a, b) {
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
    },

    get: function (idOrSlug) {
      var page = resolve(idOrSlug);
      return page ? clone(page) : null;
    },

    create: function (input) {
      var title = String((input && input.title) || '').trim();
      if (!title) throw new Error('[MajixWiki] create: title is required');
      var createdAt = nowIso();
      var page = {
        id: generateId(),
        title: title,
        slug: uniqueSlug((input && input.slug) || title),
        content: String((input && input.content) || ''),
        tags: Array.isArray(input && input.tags) ? input.tags.map(String) : [],
        createdAt: createdAt,
        updatedAt: createdAt
      };
      _pages.push(page);
      ensureCapacity();
      persist();
      emit('create', clone(page));
      dispatch('page/create', clone(page));
      return clone(page);
    },

    update: function (idOrSlug, patch) {
      var page = resolve(idOrSlug);
      if (!page) return null;
      if (patch && patch.title !== undefined) {
        var nextTitle = String(patch.title).trim();
        if (!nextTitle) throw new Error('[MajixWiki] update: title cannot be empty');
        page.title = nextTitle;
      }
      if (patch && patch.slug !== undefined) {
        page.slug = uniqueSlug(String(patch.slug || page.title), page.id);
      }
      if (patch && patch.content !== undefined) page.content = String(patch.content || '');
      if (patch && patch.tags !== undefined) page.tags = Array.isArray(patch.tags) ? patch.tags.map(String) : [];
      page.updatedAt = nowIso();
      persist();
      emit('update', clone(page));
      dispatch('page/update', clone(page));
      return clone(page);
    },

    remove: function (idOrSlug) {
      var page = resolve(idOrSlug);
      if (!page) return false;
      _pages = _pages.filter(function (p) { return p.id !== page.id; });
      persist();
      emit('remove', clone(page));
      dispatch('page/delete', clone(page));
      return true;
    },

    search: function (query) {
      var q = String(query || '').trim().toLowerCase();
      if (!q) return this.list();
      return this.list().filter(function (p) {
        return p.title.toLowerCase().indexOf(q) !== -1 ||
          p.slug.toLowerCase().indexOf(q) !== -1 ||
          p.content.toLowerCase().indexOf(q) !== -1 ||
          (p.tags || []).join(' ').toLowerCase().indexOf(q) !== -1;
      });
    },

    clear: function () {
      _pages = [];
      persist();
      emit('clear', { ok: true });
      dispatch('page/clear', { ok: true });
    },

    importPages: function (pages, options) {
      var opts = Object.assign({ replace: false }, options || {});
      if (!Array.isArray(pages)) throw new Error('[MajixWiki] importPages: array required');
      if (opts.replace) _pages = [];
      pages.forEach(function (p) {
      if (!p || !p.title) return;
      var importedId = String(p.id || generateId());
      _pages.push({
          id: importedId,
          title: String(p.title),
          slug: uniqueSlug(p.slug || p.title, importedId),
          content: String(p.content || ''),
          tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
          createdAt: String(p.createdAt || nowIso()),
          updatedAt: String(p.updatedAt || nowIso())
        });
      });
      ensureCapacity();
      persist();
      emit('import', { count: _pages.length, replace: opts.replace });
      dispatch('page/import', { count: _pages.length, replace: opts.replace });
      return this.list();
    },

    exportPages: function () {
      return this.list();
    },

    count: function () {
      return _pages.length;
    },

    get config() {
      return clone(_cfg);
    }
  };

  MajixWiki.init();
  root.MajixWiki = MajixWiki;
}(typeof window !== 'undefined' ? window : this));
