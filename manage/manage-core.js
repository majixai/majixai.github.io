/**
 * manage-core.js  —  Centralized README Processing Library for majixai.github.io
 *
 * Parses, renders, and updates marker-delimited sections in Markdown documents.
 * Works in any browser page; zero dependencies.
 *
 * Usage:
 *   <script src="/manage/manage-core.js"></script>
 *
 *   window.MANAGE_CONFIG = {
 *     namespace:    'my-app',
 *     storageKey:   'majix-manage',
 *     historyLimit: 50,
 *     onChange:     (section, newContent) => {},
 *   };
 *   MajixManage.init();
 *
 * Marker convention:
 *   <!-- START_SECTION_NAME -->
 *   …content…
 *   <!-- END_SECTION_NAME -->
 *
 * Core API (all methods return `this` unless noted):
 *   MajixManage.init(config?)
 *   MajixManage.parse(markdown)             → { sections: Map<name, {content, raw}>, source }
 *   MajixManage.getSection(name)            → string | null
 *   MajixManage.setSection(name, content)   → updated markdown string
 *   MajixManage.removeSection(name)         → updated markdown string
 *   MajixManage.addSection(name, content, position?)  → updated markdown string
 *   MajixManage.listSections()              → string[]
 *   MajixManage.render(markdownStr, targetEl?)  → HTMLElement
 *   MajixManage.renderSection(name, targetEl?)  → HTMLElement
 *   MajixManage.load(url)                   → Promise<string>
 *   MajixManage.save(content, filename?)    → void
 *   MajixManage.history()                   → {timestamp, section, old, new}[]
 *   MajixManage.undo()                      → string | null
 *   MajixManage.redo()                      → string | null
 *   MajixManage.export(format?)             → string
 *   MajixManage.on(event, fn)               → this
 *   MajixManage.off(event, fn)              → this
 *   MajixManage.emit(event, ...args)        → this
 */

(function (global) {
  'use strict';

  // ─── Defaults ───────────────────────────────────────────────────────────────

  const DEFAULTS = {
    namespace:    'majix-manage',
    storageKey:   'majix-manage-doc',
    historyLimit: 100,
    onChange:     null,
    onLoad:       null,
    onRender:     null,
  };

  // ─── Section marker patterns ─────────────────────────────────────────────────

  const START_RE = /<!--\s*START_([A-Z0-9_]+)\s*-->/gi;
  const END_RE   = /<!--\s*END_([A-Z0-9_]+)\s*-->/gi;

  function makeStartMarker(name) { return `<!-- START_${name} -->`; }
  function makeEndMarker(name)   { return `<!-- END_${name} -->`; }

  function sectionPattern(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
      `(<!--\\s*START_${escaped}\\s*-->)[\\s\\S]*?(<!--\\s*END_${escaped}\\s*-->)`,
      'gi'
    );
  }

  // ─── Minimal Markdown → HTML renderer ───────────────────────────────────────

  function mdToHtml(md) {
    if (!md) return '';

    // Headings
    let html = md
      .replace(/^#{6}\s+(.*)$/gm, '<h6>$1</h6>')
      .replace(/^#{5}\s+(.*)$/gm, '<h5>$1</h5>')
      .replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>')
      .replace(/^#{3}\s+(.*)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s+(.*)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

    // Fenced code blocks
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const langClass = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${langClass}>${escHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold / italic
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Links & images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr>');

    // Block quotes
    html = html.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');

    // Tables (simple GFM)
    html = html.replace(/(^\|.+\|\n)(^\|[-:| ]+\|\n)((?:^\|.+\|\n?)*)/gm, (_, head, sep, body) => {
      const thRow = head.trim().split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
      const tbRows = body.trim().split('\n').map(row =>
        '<tr>' + row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
      ).join('');
      return `<table><thead><tr>${thRow}</tr></thead><tbody>${tbRows}</tbody></table>`;
    });

    // Ordered / unordered lists
    html = buildLists(html);

    // Paragraphs (lines separated by blank lines)
    html = html.replace(/^(?!<[a-z])(.*\S.*)$/gm, '<p>$1</p>');
    html = html.replace(/<\/p>\n<p>/g, '</p><p>');

    return html;
  }

  function buildLists(html) {
    // Unordered
    html = html.replace(/((?:^[-*+]\s+.+\n?)+)/gm, block => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*+]\s+/, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    });
    // Ordered
    html = html.replace(/((?:^\d+\.\s+.+\n?)+)/gm, block => {
      const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('');
      return `<ol>${items}</ol>`;
    });
    return html;
  }

  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── History ring buffer ─────────────────────────────────────────────────────

  class HistoryBuffer {
    constructor(limit) {
      this._limit  = limit;
      this._items  = [];
      this._cursor = -1;
    }

    push(entry) {
      // Discard any forward history
      this._items = this._items.slice(0, this._cursor + 1);
      this._items.push(entry);
      if (this._items.length > this._limit) this._items.shift();
      this._cursor = this._items.length - 1;
    }

    undo() {
      if (this._cursor < 0) return null;
      const entry = this._items[this._cursor--];
      return entry;
    }

    redo() {
      if (this._cursor >= this._items.length - 1) return null;
      return this._items[++this._cursor];
    }

    all() { return [...this._items]; }
    clear() { this._items = []; this._cursor = -1; }
  }

  // ─── MajixManage IIFE ────────────────────────────────────────────────────────

  const MajixManage = (function () {

    let _cfg = Object.assign({}, DEFAULTS);
    let _source = '';          // current raw markdown
    let _sections = new Map(); // name → { content, startIdx, endIdx }
    let _history = new HistoryBuffer(DEFAULTS.historyLimit);
    let _listeners = {};

    // ── Event helpers ────────────────────────────────────────────────────────

    function on(event, fn) {
      (_listeners[event] = _listeners[event] || []).push(fn);
      return pub;
    }

    function off(event, fn) {
      if (!_listeners[event]) return pub;
      _listeners[event] = _listeners[event].filter(f => f !== fn);
      return pub;
    }

    function emit(event, ...args) {
      (_listeners[event] || []).forEach(fn => fn(...args));
      return pub;
    }

    // ── Internal section parser ──────────────────────────────────────────────

    function _parse(markdown) {
      const sectionMap = new Map();
      const startMatches = [];

      // Reset regex state
      const startRe = /<!--\s*START_([A-Z0-9_]+)\s*-->/gi;
      const endRe   = /<!--\s*END_([A-Z0-9_]+)\s*-->/gi;

      let m;
      while ((m = startRe.exec(markdown)) !== null) {
        startMatches.push({ name: m[1].toUpperCase(), idx: m.index, fullLen: m[0].length });
      }

      for (const sm of startMatches) {
        const name = sm.name;
        const endMarker = `<!-- END_${name} -->`;
        const endIdx = markdown.indexOf(endMarker, sm.idx + sm.fullLen);
        if (endIdx === -1) continue;

        const contentStart = sm.idx + sm.fullLen;
        const content = markdown.slice(contentStart, endIdx).replace(/^\n/, '').replace(/\n$/, '');
        sectionMap.set(name, {
          content,
          raw:      markdown.slice(sm.idx, endIdx + endMarker.length),
          startIdx: sm.idx,
          endIdx:   endIdx + endMarker.length,
        });
      }

      return sectionMap;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Initialize the library.
     * @param {Object} [config] - override DEFAULTS
     */
    function init(config) {
      _cfg = Object.assign({}, DEFAULTS, config || global.MANAGE_CONFIG || {});
      _history = new HistoryBuffer(_cfg.historyLimit);

      // Restore persisted document if available
      if (_cfg.storageKey) {
        try {
          const saved = localStorage.getItem(_cfg.storageKey);
          if (saved) { _source = saved; _sections = _parse(_source); }
        } catch (_) { /* localStorage unavailable */ }
      }

      emit('init', _cfg);
      return pub;
    }

    /**
     * Parse a markdown string.  Stores it as the current document.
     * @param {string} markdown
     * @returns {{ sections: Map, source: string }}
     */
    function parse(markdown) {
      _source   = markdown || '';
      _sections = _parse(_source);
      emit('parse', { sections: _sections, source: _source });
      _persist();
      return { sections: _sections, source: _source };
    }

    /**
     * Return the content of a named section, or null if not found.
     * @param {string} name  - section name (case-insensitive, will be uppercased)
     */
    function getSection(name) {
      const sec = _sections.get(name.toUpperCase());
      return sec ? sec.content : null;
    }

    /**
     * Replace the content of a named section.
     * @param {string} name
     * @param {string} content
     * @returns {string}  Updated full document
     */
    function setSection(name, content) {
      const key = name.toUpperCase();
      const old = getSection(key);
      _history.push({ timestamp: Date.now(), section: key, old, new: content });

      const pattern = sectionPattern(key);
      const start   = makeStartMarker(key);
      const end     = makeEndMarker(key);
      const replacement = `${start}\n${content}\n${end}`;

      if (_sections.has(key)) {
        _source = _source.replace(pattern, replacement);
      } else {
        // Append new section
        _source += `\n${replacement}\n`;
      }

      _sections = _parse(_source);
      _persist();
      emit('change', key, content, old);
      if (typeof _cfg.onChange === 'function') _cfg.onChange(key, content);
      return _source;
    }

    /**
     * Remove a named section entirely from the document.
     * @param {string} name
     * @returns {string}  Updated full document
     */
    function removeSection(name) {
      const key = name.toUpperCase();
      const old = getSection(key);
      if (old === null) return _source;

      _history.push({ timestamp: Date.now(), section: key, old, new: null });
      _source = _source.replace(sectionPattern(key), '').replace(/\n{3,}/g, '\n\n');
      _sections = _parse(_source);
      _persist();
      emit('remove', key);
      return _source;
    }

    /**
     * Add a new section at the given position (line number or 'start'/'end').
     * @param {string} name
     * @param {string} content
     * @param {number|'start'|'end'} [position='end']
     * @returns {string}
     */
    function addSection(name, content, position) {
      const key   = name.toUpperCase();
      const block = `${makeStartMarker(key)}\n${content || ''}\n${makeEndMarker(key)}`;

      if (_sections.has(key)) {
        return setSection(key, content); // update existing
      }

      const lines = _source.split('\n');
      if (position === 'start') {
        lines.unshift(block);
      } else if (typeof position === 'number') {
        lines.splice(Math.max(0, Math.min(position, lines.length)), 0, block);
      } else {
        lines.push(block);
      }

      _history.push({ timestamp: Date.now(), section: key, old: null, new: content });
      _source   = lines.join('\n');
      _sections = _parse(_source);
      _persist();
      emit('add', key, content);
      return _source;
    }

    /**
     * Return all section names present in the current document.
     * @returns {string[]}
     */
    function listSections() {
      return Array.from(_sections.keys());
    }

    /**
     * Render the full markdown document (or a string) to HTML inside targetEl.
     * Returns the created wrapper element.
     * @param {string}  [markdownStr]  - defaults to current document
     * @param {HTMLElement|string} [targetEl]
     * @returns {HTMLElement}
     */
    function render(markdownStr, targetEl) {
      const md  = (markdownStr !== undefined) ? markdownStr : _source;
      const el  = resolveEl(targetEl);
      const div = el || document.createElement('div');
      div.className = (div.className ? div.className + ' ' : '') + 'mgr-doc';
      div.innerHTML = mdToHtml(md);
      emit('render', div);
      if (typeof _cfg.onRender === 'function') _cfg.onRender(div);
      return div;
    }

    /**
     * Render a single named section.
     * @param {string} name
     * @param {HTMLElement|string} [targetEl]
     * @returns {HTMLElement|null}
     */
    function renderSection(sectionName, targetEl) {
      const content = getSection(sectionName);
      if (content === null) return null;
      const div = resolveEl(targetEl) || document.createElement('div');
      div.className = (div.className ? div.className + ' ' : '') + 'mgr-section';
      div.dataset.section = sectionName.toUpperCase();
      div.innerHTML = mdToHtml(content);
      return div;
    }

    /**
     * Fetch a remote markdown file and parse it.
     * @param {string} url
     * @returns {Promise<string>}
     */
    function load(url) {
      return fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
          return r.text();
        })
        .then(text => {
          parse(text);
          emit('load', url, text);
          if (typeof _cfg.onLoad === 'function') _cfg.onLoad(url, text);
          return text;
        });
    }

    /**
     * Trigger a download of the current document (or a provided string).
     * @param {string} [content]
     * @param {string} [filename='README.md']
     */
    function save(content, filename) {
      const text = (content !== undefined) ? content : _source;
      const name = filename || 'README.md';
      const blob = new Blob([text], { type: 'text/markdown' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      emit('save', name);
    }

    /**
     * Return the full change history.
     * @returns {{timestamp, section, old, new}[]}
     */
    function history() {
      return _history.all();
    }

    /**
     * Undo the last setSection / addSection / removeSection.
     * @returns {string|null} Updated document, or null if nothing to undo
     */
    function undo() {
      const entry = _history.undo();
      if (!entry) return null;
      if (entry.old === null) {
        removeSection(entry.section);
      } else {
        setSection(entry.section, entry.old);
      }
      return _source;
    }

    /**
     * Redo the last undone operation.
     * @returns {string|null}
     */
    function redo() {
      const entry = _history.redo();
      if (!entry) return null;
      if (entry.new === null) {
        removeSection(entry.section);
      } else {
        setSection(entry.section, entry.new);
      }
      return _source;
    }

    /**
     * Export the current document in the requested format.
     * @param {'markdown'|'json'|'html'} [format='markdown']
     * @returns {string}
     */
    function exportDoc(format) {
      switch ((format || 'markdown').toLowerCase()) {
        case 'json': {
          const obj = {};
          _sections.forEach((v, k) => { obj[k] = v.content; });
          return JSON.stringify({ source: _source, sections: obj }, null, 2);
        }
        case 'html':
          return mdToHtml(_source);
        default:
          return _source;
      }
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    function _persist() {
      if (!_cfg.storageKey) return;
      try { localStorage.setItem(_cfg.storageKey, _source); } catch (_) {}
    }

    function resolveEl(ref) {
      if (!ref) return null;
      if (typeof ref === 'string') return document.querySelector(ref);
      return ref;
    }

    // ── Public surface ───────────────────────────────────────────────────────

    const pub = {
      init,
      parse,
      getSection,
      setSection,
      removeSection,
      addSection,
      listSections,
      render,
      renderSection,
      load,
      save,
      history,
      undo,
      redo,
      export: exportDoc,
      on,
      off,
      emit,
      /** Expose internals for advanced usage */
      _mdToHtml: mdToHtml,
      VERSION: '1.0.0',
    };

    return pub;
  }());

  // Expose globally
  global.MajixManage = MajixManage;

}(typeof window !== 'undefined' ? window : this));
