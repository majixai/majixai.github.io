/**
 * pagination.js  — Centralized Paginator for majixai.github.io
 *
 * Manages pagination for any directory / page in the site.
 * Works with data arrays, existing table rows, list items, or card grids.
 *
 * Usage (plain <script src="/pagination/pagination.js">):
 *
 *   const pager = new Paginator({
 *     data: myArray,
 *     container: '#list',
 *     paginationEl: '#pagination',
 *     perPage: 10,
 *     render(item, container) { container.insertAdjacentHTML('beforeend', `<li>${item}</li>`); },
 *   });
 *
 * Static factories:
 *   Paginator.fromTable(tbodyEl, opts)
 *   Paginator.fromList(ulEl, opts)
 *   Paginator.fromCards(containerEl, opts)
 */

(function (global) {
  'use strict';

  // ─── Defaults ───────────────────────────────────────────────────────────────

  const DEFAULTS = {
    perPage:       10,
    maxVisible:    7,   // max numbered buttons before switching to ellipsis
    showFirstLast: true,
    showPrevNext:  true,
    urlHash:       false,
    hashParam:     'page',
    onPageChange:  null, // fn(page, visibleItems)
    render:        null, // fn(item, containerEl) — required for data-array mode
    paginationEl:  null, // selector | HTMLElement
    container:     null, // selector | HTMLElement — required for data-array mode
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function el(ref) {
    if (!ref) return null;
    return (typeof ref === 'string') ? document.querySelector(ref) : ref;
  }

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function readHashPage(param) {
    const hash = location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const v = parseInt(params.get(param), 10);
    return isNaN(v) ? 1 : v;
  }

  function writeHashPage(param, page) {
    const hash = location.hash.slice(1);
    const params = new URLSearchParams(hash);
    params.set(param, page);
    history.replaceState(null, '', '#' + params.toString());
  }

  // ─── Paginator class ─────────────────────────────────────────────────────────

  class Paginator {
    /**
     * @param {Object} opts
     * @param {Array}       [opts.data]          Items to paginate (data-array mode)
     * @param {Array}       [opts.domItems]       Pre-collected DOM children (DOM mode)
     * @param {string|HTMLElement} [opts.container]  Render target (data-array mode)
     * @param {string|HTMLElement} opts.paginationEl Pagination widget mount point
     * @param {number}      [opts.perPage=10]     Items per page
     * @param {number}      [opts.maxVisible=7]   Max numbered buttons
     * @param {boolean}     [opts.showFirstLast]  Show «/» first/last buttons
     * @param {boolean}     [opts.showPrevNext]   Show ‹/› prev/next buttons
     * @param {boolean}     [opts.urlHash]        Sync page to URL hash
     * @param {string}      [opts.hashParam]      Hash parameter name (default 'page')
     * @param {Function}    [opts.render]         fn(item, containerEl) — data-array mode
     * @param {Function}    [opts.onPageChange]   fn(page, visibleItems)
     */
    constructor(opts = {}) {
      this._cfg = Object.assign({}, DEFAULTS, opts);
      this._page = 1;
      this._domMode = false;
      this._items = [];

      // DOM mode: domItems were passed in directly
      if (Array.isArray(this._cfg.domItems)) {
        this._domMode = true;
        this._items = this._cfg.domItems;
      } else if (Array.isArray(this._cfg.data)) {
        this._items = this._cfg.data;
      }

      this._pgEl = el(this._cfg.paginationEl);
      this._containerEl = el(this._cfg.container);

      // Restore page from URL hash if requested
      if (this._cfg.urlHash) {
        this._page = clamp(readHashPage(this._cfg.hashParam), 1, this.pageCount);
      }

      this._render();
      this._buildControls();

      // Hash navigation (back/forward)
      if (this._cfg.urlHash) {
        this._hashHandler = () => {
          const p = clamp(readHashPage(this._cfg.hashParam), 1, this.pageCount);
          if (p !== this._page) { this._page = p; this._render(); this._updateControls(); }
        };
        window.addEventListener('hashchange', this._hashHandler);
      }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Current page number (1-based) */
    get page() { return this._page; }

    /** Total number of pages */
    get pageCount() {
      return Math.max(1, Math.ceil(this._items.length / this._cfg.perPage));
    }

    /** Total number of items */
    get total() { return this._items.length; }

    /** Items visible on the current page */
    get currentItems() {
      const { perPage } = this._cfg;
      const start = (this._page - 1) * perPage;
      return this._items.slice(start, start + perPage);
    }

    /** Navigate to a specific page */
    goTo(page) {
      const p = clamp(page, 1, this.pageCount);
      if (p === this._page) return this;
      this._page = p;
      if (this._cfg.urlHash) writeHashPage(this._cfg.hashParam, p);
      this._render();
      this._updateControls();
      return this;
    }

    next()  { return this.goTo(this._page + 1); }
    prev()  { return this.goTo(this._page - 1); }
    first() { return this.goTo(1); }
    last()  { return this.goTo(this.pageCount); }

    /**
     * Replace the data array and reset to page 1.
     * @param {Array} newData
     */
    setData(newData) {
      this._items = Array.isArray(newData) ? newData : [];
      this._page = 1;
      this._buildControls();
      this._render();
      return this;
    }

    /**
     * Update items per page and reset to page 1.
     * @param {number} n
     */
    setPerPage(n) {
      this._cfg.perPage = Math.max(1, n);
      this._page = clamp(this._page, 1, this.pageCount);
      this._buildControls();
      this._render();
      return this;
    }

    /** Remove event listeners and clear rendered pagination buttons */
    destroy() {
      if (this._hashHandler) window.removeEventListener('hashchange', this._hashHandler);
      if (this._pgEl) this._pgEl.innerHTML = '';
    }

    // ── Private: render visible items ─────────────────────────────────────────

    _render() {
      const items = this.currentItems;

      if (this._domMode) {
        // DOM mode — hide/show existing children
        const { perPage } = this._cfg;
        const start = (this._page - 1) * perPage;
        const end   = start + perPage;
        this._items.forEach((child, i) => {
          child.style.display = (i >= start && i < end) ? '' : 'none';
        });
      } else if (this._containerEl && typeof this._cfg.render === 'function') {
        this._containerEl.innerHTML = '';
        items.forEach(item => this._cfg.render(item, this._containerEl));
      }

      if (typeof this._cfg.onPageChange === 'function') {
        this._cfg.onPageChange(this._page, items);
      }
    }

    // ── Private: build pagination widget ──────────────────────────────────────

    _buildControls() {
      if (!this._pgEl) return;
      this._pgEl.innerHTML = '';
      this._pgEl.setAttribute('role', 'navigation');
      this._pgEl.setAttribute('aria-label', 'Pagination');
      this._pgEl.classList.add('pgr-nav');

      const { showFirstLast, showPrevNext } = this._cfg;

      if (showFirstLast) this._pgEl.appendChild(this._btn('first', '«', 'First page'));
      if (showPrevNext)  this._pgEl.appendChild(this._btn('prev',  '‹', 'Previous page'));

      this._numbersWrapper = document.createElement('span');
      this._numbersWrapper.className = 'pgr-numbers';
      this._pgEl.appendChild(this._numbersWrapper);

      if (showPrevNext)  this._pgEl.appendChild(this._btn('next',  '›', 'Next page'));
      if (showFirstLast) this._pgEl.appendChild(this._btn('last',  '»', 'Last page'));

      this._updateControls();
    }

    _btn(type, text, ariaLabel) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pgr-btn pgr-${type}`;
      b.innerHTML = text;
      b.setAttribute('aria-label', ariaLabel);
      b.addEventListener('click', () => {
        if      (type === 'first') this.first();
        else if (type === 'prev')  this.prev();
        else if (type === 'next')  this.next();
        else if (type === 'last')  this.last();
      });
      this[`_btn_${type}`] = b;
      return b;
    }

    _pageBtn(n) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pgr-btn pgr-page';
      b.dataset.page = n;
      b.textContent = n;
      b.setAttribute('aria-label', `Page ${n}`);
      if (n === this._page) {
        b.classList.add('pgr-active');
        b.setAttribute('aria-current', 'page');
      }
      b.addEventListener('click', () => this.goTo(n));
      return b;
    }

    _ellipsis() {
      const s = document.createElement('span');
      s.className = 'pgr-ellipsis';
      s.textContent = '…';
      s.setAttribute('aria-hidden', 'true');
      return s;
    }

    _updateControls() {
      if (!this._pgEl) return;

      const pc = this.pageCount;
      const cp = this._page;
      const { maxVisible, showFirstLast, showPrevNext } = this._cfg;

      // Update first/prev/next/last disabled state
      if (showFirstLast) {
        this._btn_first.disabled = (cp === 1);
        this._btn_last.disabled  = (cp === pc);
      }
      if (showPrevNext) {
        this._btn_prev.disabled = (cp === 1);
        this._btn_next.disabled = (cp === pc);
      }

      // Rebuild numbered buttons
      const w = this._numbersWrapper;
      w.innerHTML = '';

      if (pc <= maxVisible) {
        // Show all pages
        for (let i = 1; i <= pc; i++) w.appendChild(this._pageBtn(i));
      } else {
        // Windowed with ellipsis
        const half = Math.floor((maxVisible - 2) / 2);
        let rangeStart = clamp(cp - half, 2, pc - maxVisible + 3);
        let rangeEnd   = clamp(cp + half, maxVisible - 2, pc - 1);

        // Expand range to fill maxVisible slots (minus first + last)
        while ((rangeEnd - rangeStart + 1) < (maxVisible - 2)) {
          if (rangeStart > 2)        rangeStart--;
          else if (rangeEnd < pc - 1) rangeEnd++;
          else break;
        }

        w.appendChild(this._pageBtn(1));
        if (rangeStart > 2)    w.appendChild(this._ellipsis());
        for (let i = rangeStart; i <= rangeEnd; i++) w.appendChild(this._pageBtn(i));
        if (rangeEnd < pc - 1) w.appendChild(this._ellipsis());
        w.appendChild(this._pageBtn(pc));
      }
    }

    // ── Static factories ───────────────────────────────────────────────────────

    /**
     * Paginate an existing <tbody> or any element whose direct children are rows.
     * @param {string|HTMLElement} tbodyRef
     * @param {Object} [opts]
     * @returns {Paginator}
     */
    static fromTable(tbodyRef, opts = {}) {
      const tbody = el(tbodyRef);
      if (!tbody) throw new Error('Paginator.fromTable: element not found');
      const rows = Array.from(tbody.children);
      return new Paginator({ ...opts, domItems: rows });
    }

    /**
     * Paginate an existing <ul>/<ol> or any element whose direct children are items.
     * @param {string|HTMLElement} listRef
     * @param {Object} [opts]
     * @returns {Paginator}
     */
    static fromList(listRef, opts = {}) {
      const list = el(listRef);
      if (!list) throw new Error('Paginator.fromList: element not found');
      const items = Array.from(list.children);
      return new Paginator({ ...opts, domItems: items });
    }

    /**
     * Paginate an existing card grid container.
     * @param {string|HTMLElement} containerRef
     * @param {Object} [opts]
     * @returns {Paginator}
     */
    static fromCards(containerRef, opts = {}) {
      const container = el(containerRef);
      if (!container) throw new Error('Paginator.fromCards: element not found');
      const cards = Array.from(container.children);
      return new Paginator({ ...opts, domItems: cards });
    }
  }

  // ─── Expose globally ────────────────────────────────────────────────────────
  global.Paginator = Paginator;

}(typeof window !== 'undefined' ? window : this));
