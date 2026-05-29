/**
 * go-core.js  —  Goals Operations Manager for majixai.github.io
 *
 * Stores, tracks, and manages goals across all projects and future ops.
 * Works in any browser page; zero external dependencies.
 * Persists to localStorage; optionally dispatches MajixActions events.
 *
 * Usage:
 *   <script src="/go/go-core.js"></script>
 *
 *   window.GO_CONFIG = {
 *     namespace:    'go',
 *     storageKey:   'majixGoals',
 *     historyLimit: 100,
 *     autoDispatch: true,       // emit MajixActions events when window.MajixActions exists
 *     onChange:     (goal, op) => {},
 *   };
 *   MajixGo.init();
 *
 * Goal schema:
 *   id          string   — UUID v4
 *   title       string   — short goal title (required)
 *   description string   — full description / acceptance criteria
 *   status      string   — 'pending' | 'in-progress' | 'done' | 'cancelled' | 'blocked'
 *   priority    string   — 'low' | 'medium' | 'high' | 'critical'
 *   category    string   — matches projects.json category (finance, tools, gaming, …)
 *   tags        string[] — arbitrary labels
 *   linkedProject string — path key from projects.json, e.g. 'tradingview_integration'
 *   createdAt   string   — ISO-8601
 *   updatedAt   string   — ISO-8601
 *   dueDate     string   — ISO-8601 date (optional)
 *   notes       string   — freeform notes / progress log
 *   completedAt string   — ISO-8601 (set automatically when status → 'done')
 *
 * Core API:
 *   MajixGo.init(config?)
 *   MajixGo.add(goalData)            → goal
 *   MajixGo.update(id, patch)        → goal
 *   MajixGo.remove(id)               → bool
 *   MajixGo.get(id)                  → goal | null
 *   MajixGo.list(filter?)            → goal[]
 *   MajixGo.setStatus(id, status)    → goal
 *   MajixGo.search(query)            → goal[]
 *   MajixGo.stats()                  → { total, byStatus, byPriority, byCategory, overdue }
 *   MajixGo.export(format?)          → string  (format: 'json' | 'csv' | 'md')
 *   MajixGo.importJSON(jsonStr)      → { added, skipped }
 *   MajixGo.clear()                  → void
 *   MajixGo.undo()                   → goal | null
 *   MajixGo.redo()                   → goal | null
 *   MajixGo.on(event, fn)            → this
 *   MajixGo.off(event, fn)           → this
 *
 * Events:  'add' | 'update' | 'remove' | 'status' | 'clear' | 'import'
 */

(function (global) {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────────

  var STATUSES   = ['pending', 'in-progress', 'done', 'cancelled', 'blocked'];
  var PRIORITIES = ['low', 'medium', 'high', 'critical'];

  var DEFAULTS = {
    namespace:    'go',
    storageKey:   'majixGoals',
    historyLimit: 100,
    autoDispatch: true,
    onChange:     null,
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function nowIso() { return new Date().toISOString(); }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    // Fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function slugify(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ('goal-' + Date.now());
  }

  function isOverdue(goal) {
    if (!goal.dueDate || goal.status === 'done' || goal.status === 'cancelled') return false;
    return new Date(goal.dueDate) < new Date();
  }

  // ── Core IIFE ────────────────────────────────────────────────────────────────

  var MajixGo = (function () {

    var _cfg       = clone(DEFAULTS);
    var _goals     = {};   // id → goal
    var _undoStack = [];
    var _redoStack = [];
    var _listeners = {};   // event → fn[]
    var _initialized = false;

    // ── Storage ─────────────────────────────────────────────────────────────

    function _save() {
      try {
        global.localStorage.setItem(_cfg.storageKey, JSON.stringify(_goals));
      } catch (e) { /* quota / private mode */ }
    }

    function _load() {
      try {
        var raw = global.localStorage.getItem(_cfg.storageKey);
        if (raw) _goals = JSON.parse(raw) || {};
      } catch (e) { _goals = {}; }
    }

    // ── Events ───────────────────────────────────────────────────────────────

    function _emit(event) {
      var args = Array.prototype.slice.call(arguments, 1);
      (_listeners[event] || []).forEach(function (fn) {
        try { fn.apply(null, args); } catch (e) { /* listener error */ }
      });
      if (_cfg.onChange) {
        try { _cfg.onChange.apply(null, [event].concat(args)); } catch (e) {}
      }
      // Optional MajixActions integration
      if (_cfg.autoDispatch && global.MajixActions && typeof global.MajixActions.dispatch === 'function') {
        try {
          global.MajixActions.dispatch('goal/' + event, args[0] || null);
        } catch (e) {}
      }
    }

    // ── History ──────────────────────────────────────────────────────────────

    function _snapshot() {
      _undoStack.push(clone(_goals));
      if (_undoStack.length > _cfg.historyLimit) _undoStack.shift();
      _redoStack = [];
    }

    // ── Validation ───────────────────────────────────────────────────────────

    function _validateStatus(s) {
      if (STATUSES.indexOf(s) === -1) throw new Error('Invalid status: ' + s);
    }
    function _validatePriority(p) {
      if (p && PRIORITIES.indexOf(p) === -1) throw new Error('Invalid priority: ' + p);
    }

    // ── Public API ───────────────────────────────────────────────────────────

    function init(config) {
      if (config) {
        Object.keys(config).forEach(function (k) { _cfg[k] = config[k]; });
      }
      _load();
      _initialized = true;
      return api;
    }

    function add(data) {
      if (!data || !data.title) throw new Error('Goal title is required');
      _validateStatus(data.status || 'pending');
      _validatePriority(data.priority);

      _snapshot();
      var now = nowIso();
      var goal = {
        id:             uuid(),
        title:          String(data.title).trim(),
        description:    String(data.description || '').trim(),
        status:         data.status      || 'pending',
        priority:       data.priority    || 'medium',
        category:       data.category    || 'general',
        tags:           Array.isArray(data.tags) ? data.tags.slice() : [],
        linkedProject:  data.linkedProject  || '',
        createdAt:      now,
        updatedAt:      now,
        dueDate:        data.dueDate     || '',
        notes:          data.notes       || '',
        completedAt:    '',
      };
      _goals[goal.id] = goal;
      _save();
      _emit('add', clone(goal));
      return clone(goal);
    }

    function update(id, patch) {
      var goal = _goals[id];
      if (!goal) throw new Error('Goal not found: ' + id);
      if (patch.status)   _validateStatus(patch.status);
      if (patch.priority) _validatePriority(patch.priority);

      _snapshot();
      var wasNotDone = goal.status !== 'done';
      Object.keys(patch).forEach(function (k) {
        if (k !== 'id' && k !== 'createdAt') goal[k] = patch[k];
      });
      goal.updatedAt = nowIso();
      if (patch.status === 'done' && wasNotDone) goal.completedAt = goal.updatedAt;
      if (patch.status && patch.status !== 'done') goal.completedAt = '';

      _save();
      _emit('update', clone(goal));
      return clone(goal);
    }

    function remove(id) {
      if (!_goals[id]) return false;
      _snapshot();
      var removed = clone(_goals[id]);
      delete _goals[id];
      _save();
      _emit('remove', removed);
      return true;
    }

    function get(id) {
      return _goals[id] ? clone(_goals[id]) : null;
    }

    function list(filter) {
      var all = Object.values(_goals).map(function (g) { return clone(g); });
      if (!filter) return all;

      return all.filter(function (g) {
        if (filter.status   && g.status   !== filter.status)   return false;
        if (filter.priority && g.priority !== filter.priority) return false;
        if (filter.category && g.category !== filter.category) return false;
        if (filter.linkedProject && g.linkedProject !== filter.linkedProject) return false;
        if (filter.overdue  && !isOverdue(g))                  return false;
        if (filter.tag) {
          if (!Array.isArray(g.tags) || g.tags.indexOf(filter.tag) === -1) return false;
        }
        return true;
      });
    }

    function setStatus(id, status) {
      _validateStatus(status);
      return update(id, { status: status });
    }

    function search(query) {
      if (!query) return list();
      var q = String(query).toLowerCase();
      return Object.values(_goals)
        .filter(function (g) {
          return (
            g.title.toLowerCase().includes(q) ||
            g.description.toLowerCase().includes(q) ||
            g.notes.toLowerCase().includes(q) ||
            (g.tags || []).some(function (t) { return t.toLowerCase().includes(q); }) ||
            g.category.toLowerCase().includes(q)
          );
        })
        .map(function (g) { return clone(g); });
    }

    function stats() {
      var all = Object.values(_goals);
      var byStatus   = {};
      var byPriority = {};
      var byCategory = {};
      var overdueCount = 0;

      STATUSES.forEach(function (s) { byStatus[s] = 0; });
      PRIORITIES.forEach(function (p) { byPriority[p] = 0; });

      all.forEach(function (g) {
        byStatus[g.status]     = (byStatus[g.status]     || 0) + 1;
        byPriority[g.priority] = (byPriority[g.priority] || 0) + 1;
        byCategory[g.category] = (byCategory[g.category] || 0) + 1;
        if (isOverdue(g)) overdueCount++;
      });

      return {
        total:      all.length,
        byStatus:   byStatus,
        byPriority: byPriority,
        byCategory: byCategory,
        overdue:    overdueCount,
        completionRate: all.length
          ? Math.round((byStatus['done'] || 0) / all.length * 100)
          : 0,
      };
    }

    function exportData(format) {
      var all = list();
      format = (format || 'json').toLowerCase();

      if (format === 'csv') {
        var cols = ['id','title','status','priority','category','linkedProject','dueDate','createdAt','updatedAt','completedAt','tags','description','notes'];
        var lines = [cols.join(',')];
        all.forEach(function (g) {
          lines.push(cols.map(function (c) {
            var v = c === 'tags' ? (g.tags || []).join('|') : String(g[c] || '');
            return '"' + v.replace(/"/g, '""') + '"';
          }).join(','));
        });
        return lines.join('\n');
      }

      if (format === 'md') {
        var md = '# Goals\n\n';
        STATUSES.forEach(function (s) {
          var bucket = all.filter(function (g) { return g.status === s; });
          if (!bucket.length) return;
          md += '## ' + s.charAt(0).toUpperCase() + s.slice(1) + '\n\n';
          bucket.forEach(function (g) {
            var due = g.dueDate ? ' _(due ' + g.dueDate.slice(0, 10) + ')_' : '';
            md += '- **[' + g.priority.toUpperCase() + ']** ' + g.title + due + '\n';
            if (g.description) md += '  ' + g.description + '\n';
          });
          md += '\n';
        });
        return md;
      }

      return JSON.stringify(all, null, 2);
    }

    function importJSON(jsonStr) {
      var arr;
      try { arr = JSON.parse(jsonStr); } catch (e) { throw new Error('Invalid JSON'); }
      if (!Array.isArray(arr)) throw new Error('Expected a JSON array of goals');

      _snapshot();
      var added = 0, skipped = 0;
      arr.forEach(function (raw) {
        if (!raw || !raw.title) { skipped++; return; }
        if (raw.id && _goals[raw.id]) { skipped++; return; } // skip existing
        var goal = {
          id:            raw.id          || uuid(),
          title:         String(raw.title).trim(),
          description:   raw.description || '',
          status:        STATUSES.indexOf(raw.status) !== -1 ? raw.status : 'pending',
          priority:      PRIORITIES.indexOf(raw.priority) !== -1 ? raw.priority : 'medium',
          category:      raw.category    || 'general',
          tags:          Array.isArray(raw.tags) ? raw.tags : [],
          linkedProject: raw.linkedProject || '',
          createdAt:     raw.createdAt   || nowIso(),
          updatedAt:     raw.updatedAt   || nowIso(),
          dueDate:       raw.dueDate     || '',
          notes:         raw.notes       || '',
          completedAt:   raw.completedAt || '',
        };
        _goals[goal.id] = goal;
        added++;
      });
      _save();
      _emit('import', { added: added, skipped: skipped });
      return { added: added, skipped: skipped };
    }

    function clear() {
      _snapshot();
      _goals = {};
      _save();
      _emit('clear');
    }

    function undo() {
      if (!_undoStack.length) return null;
      _redoStack.push(clone(_goals));
      _goals = _undoStack.pop();
      _save();
      return clone(_goals);
    }

    function redo() {
      if (!_redoStack.length) return null;
      _undoStack.push(clone(_goals));
      _goals = _redoStack.pop();
      _save();
      return clone(_goals);
    }

    function on(event, fn) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(fn);
      return api;
    }

    function off(event, fn) {
      if (_listeners[event]) {
        _listeners[event] = _listeners[event].filter(function (f) { return f !== fn; });
      }
      return api;
    }

    // ── Expose STATUSES / PRIORITIES for UI ──────────────────────────────────

    var api = {
      init:        init,
      add:         add,
      update:      update,
      remove:      remove,
      get:         get,
      list:        list,
      setStatus:   setStatus,
      search:      search,
      stats:       stats,
      export:      exportData,
      importJSON:  importJSON,
      clear:       clear,
      undo:        undo,
      redo:        redo,
      on:          on,
      off:         off,
      STATUSES:    STATUSES,
      PRIORITIES:  PRIORITIES,
      isOverdue:   isOverdue,
    };

    return api;

  }());

  // ── Auto-init from window.GO_CONFIG ──────────────────────────────────────────

  MajixGo.init(global.GO_CONFIG || {});

  global.MajixGo = MajixGo;

}(typeof window !== 'undefined' ? window : this));
