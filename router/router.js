/**
 * MajixAI Client-Side Router
 *
 * A lightweight router for the majixai.github.io multi-project static site.
 * Loads the routes manifest (with sessionStorage caching), resolves paths,
 * drives History-API navigation, and dispatches `route:change` events so any
 * page can react to navigation.
 *
 * Usage (ES module):
 *   import { router } from './router.js';
 *   router.navigate('/best/');
 *   router.on('route:change', ({ detail }) => console.log(detail));
 *   router.beforeNavigate(({ to, cancel }) => { if (!allowed(to)) cancel(); });
 *
 * Usage (classic script tag with type="module"):
 *   <script type="module" src="router/router.js"></script>
 *   window.addEventListener('route:change', handler);
 */

const ROUTES_URL = new URL('./routes.json', import.meta.url).href;

/** sessionStorage key and TTL for the routes manifest cache. */
const CACHE_KEY = 'majixai:routes:v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class Router extends EventTarget {
  /** @type {Array<object>} */
  #routes = [];
  /** @type {Map<string, object>} path/name → route object */
  #index = new Map();
  #ready = false;
  #readyCallbacks = [];

  /** Internal navigation history stack. */
  #historyStack = [];
  /** Current position within #historyStack (-1 = empty). */
  #historyPos = -1;

  /** Registered beforeNavigate guards: (context) => void */
  #guards = [];

  constructor() {
    super();
    this.#init();
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  async #init() {
    try {
      const manifest = await this.#loadManifest();
      this.#routes = manifest.routes ?? [];
      this.#buildIndex();
      this.#ready = true;
      this.#readyCallbacks.forEach(fn => fn());
      this.#readyCallbacks = [];
      this.#listenPopState();
    } catch (err) {
      console.error('[Router] Failed to load routes manifest:', err);
    }
  }

  /**
   * Load the routes manifest, using sessionStorage as a short-lived cache.
   * @returns {Promise<object>} Parsed manifest object.
   */
  async #loadManifest() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS) {
          return data;
        }
      }
    } catch (_) {
      // sessionStorage unavailable or corrupt — fall through to network
    }

    const res = await fetch(ROUTES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (_) {
      // storage full or blocked — non-fatal
    }

    return data;
  }

  #buildIndex() {
    this.#index.clear();
    for (const route of this.#routes) {
      // Index by exact path (normalised to lower-case for case-insensitive lookup)
      this.#index.set(route.path.toLowerCase(), route);
      // Also index by name for convenience
      this.#index.set(route.name.toLowerCase(), route);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns a Promise that resolves once the routes manifest is loaded.
   * @returns {Promise<void>}
   */
  ready() {
    return new Promise(resolve => {
      if (this.#ready) resolve();
      else this.#readyCallbacks.push(resolve);
    });
  }

  /**
   * All loaded routes.
   * @returns {object[]}
   */
  get routes() {
    return this.#routes;
  }

  /**
   * Returns a sorted copy of all routes.
   *
   * @param {'name'|'lastUpdated'|'category'|'path'} [field='name']
   * @param {'asc'|'desc'} [direction='asc']
   * @returns {object[]}
   */
  sortedRoutes(field = 'name', direction = 'asc') {
    const dir = direction === 'desc' ? -1 : 1;
    return [...this.#routes].sort((a, b) => {
      const av = (a[field] ?? '').toString().toLowerCase();
      const bv = (b[field] ?? '').toString().toLowerCase();
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }

  /**
   * Returns the unique category values present in the loaded routes.
   * @returns {string[]}
   */
  getCategories() {
    return [...new Set(this.#routes.map(r => r.category).filter(Boolean))].sort();
  }

  /**
   * Resolve a pathname or name to a route object, or null if not found.
   * Performs: exact match → prefix match → fuzzy name match.
   *
   * @param {string} input  URL path (e.g. '/best/') or route name (e.g. 'best')
   * @returns {object|null}
   */
  resolve(input) {
    if (!input) return null;
    const key = input.toLowerCase().replace(/\/?$/, '/');

    // 1. Exact match on path or name
    if (this.#index.has(key)) return this.#index.get(key);

    // 2. Prefix match – find the deepest route whose path is a prefix of `key`
    let best = null;
    let bestLen = 0;
    for (const [indexedKey, route] of this.#index) {
      if (
        indexedKey.startsWith('/') &&        // only path keys
        key.startsWith(indexedKey) &&
        indexedKey.length > bestLen
      ) {
        best = route;
        bestLen = indexedKey.length;
      }
    }
    if (best) return best;

    // 3. Fuzzy: route name contains the input token
    const token = input.replace(/\//g, '').toLowerCase();
    return (
      this.#routes.find(r => r.name.toLowerCase().includes(token)) ?? null
    );
  }

  /**
   * Search routes by a free-text query (name, description, category).
   * Uses weighted scoring: name matches score higher than description matches.
   *
   * @param {string} query
   * @returns {object[]} matching routes, sorted by relevance
   */
  search(query) {
    if (!query || !query.trim()) return [...this.#routes];
    const terms = query.trim().toLowerCase().split(/\s+/);

    const scored = this.#routes.map(route => {
      const nameLower = (route.name ?? '').toLowerCase();
      const descLower = (route.desc ?? '').toLowerCase();
      const catLower  = (route.category ?? '').toLowerCase();
      const msgLower  = (route.lastCommitMessage ?? '').toLowerCase();

      let score = 0;
      for (const term of terms) {
        if (nameLower.includes(term)) score += 3;     // name carries most weight
        if (descLower.includes(term)) score += 2;
        if (catLower.includes(term))  score += 1;
        if (msgLower.includes(term))  score += 1;
      }
      return { route, score };
    });

    return scored
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ route }) => route);
  }

  /**
   * Filter routes by category.
   *
   * @param {string} category  e.g. 'finance', 'gaming', 'tools', 'web', 'data'
   * @returns {object[]}
   */
  filter(category) {
    if (!category || category === 'all') return [...this.#routes];
    return this.#routes.filter(
      r => r.category.toLowerCase() === category.toLowerCase(),
    );
  }

  /**
   * Register a navigation guard.  The callback receives a context object:
   *   { to: route|null, url: string, replace: boolean, cancel: () => void }
   * Calling `cancel()` aborts the navigation.
   *
   * @param {function(object): void} guard
   * @returns {() => void}  A function that removes the guard when called.
   */
  beforeNavigate(guard) {
    this.#guards.push(guard);
    return () => {
      this.#guards = this.#guards.filter(g => g !== guard);
    };
  }

  /**
   * Navigate to a route path using the History API and dispatch `route:change`.
   * Runs all registered beforeNavigate guards first.
   * Falls back to a direct `location.assign` when the History API is unavailable.
   *
   * @param {string} path     Route path (e.g. '/best/') or full URL.
   * @param {boolean} [replace=false]  Use replaceState instead of pushState.
   * @returns {boolean} `true` if navigation proceeded, `false` if cancelled.
   */
  navigate(path, replace = false) {
    const route = this.resolve(path);
    const target = route
      ? new URL(route.path, 'https://majixai.github.io').href
      : path;

    // Run guards
    let cancelled = false;
    const ctx = { to: route, url: target, replace, cancel: () => { cancelled = true; } };
    for (const guard of this.#guards) {
      guard(ctx);
      if (cancelled) return false;
    }

    this.#pushHistory(route, target, replace);
    return true;
  }

  /**
   * Navigate back in the internal history stack.
   * @returns {boolean} `true` if back-navigation was possible.
   */
  back() {
    if (this.#historyPos <= 0) return false;
    this.#historyPos -= 1;
    const entry = this.#historyStack[this.#historyPos];
    if (typeof history !== 'undefined' && history.go) history.go(-1);
    this.#dispatchChange(entry.route, entry.url);
    return true;
  }

  /**
   * Navigate forward in the internal history stack.
   * @returns {boolean} `true` if forward-navigation was possible.
   */
  forward() {
    if (this.#historyPos >= this.#historyStack.length - 1) return false;
    this.#historyPos += 1;
    const entry = this.#historyStack[this.#historyPos];
    if (typeof history !== 'undefined' && history.go) history.go(1);
    this.#dispatchChange(entry.route, entry.url);
    return true;
  }

  /**
   * Prefetch a route by injecting a `<link rel="prefetch">` element.
   * No-ops in environments without a DOM.
   *
   * @param {string} path  Route path or name to prefetch.
   */
  preload(path) {
    if (typeof document === 'undefined') return;
    const route = this.resolve(path);
    const href = route
      ? new URL(route.path, 'https://majixai.github.io').href
      : path;

    // Check for an existing prefetch link by iterating (avoids selector-injection risk)
    const existing = document.head.querySelectorAll('link[rel="prefetch"]');
    for (const el of existing) {
      if (el.href === href) return;
    }
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }

  /**
   * Convenience alias for `addEventListener`.
   * @param {string} event
   * @param {function} handler
   * @returns {() => void}  A function that removes the listener when called.
   */
  on(event, handler) {
    this.addEventListener(event, handler);
    return () => this.removeEventListener(event, handler);
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  #pushHistory(route, target, replace) {
    if (typeof history !== 'undefined' && history.pushState) {
      if (replace) {
        history.replaceState({ route }, '', target);
        if (this.#historyPos >= 0) {
          this.#historyStack[this.#historyPos] = { route, url: target };
        }
      } else {
        history.pushState({ route }, '', target);
        // Truncate forward entries and push new one
        this.#historyStack = this.#historyStack.slice(0, this.#historyPos + 1);
        this.#historyStack.push({ route, url: target });
        this.#historyPos = this.#historyStack.length - 1;
      }
      this.#dispatchChange(route, target);
    } else {
      window.location.assign(target);
    }
  }

  #listenPopState() {
    if (typeof window === 'undefined') return;
    window.addEventListener('popstate', event => {
      const route = event.state?.route ?? this.resolve(location.pathname);
      this.#dispatchChange(route, location.href);
    });
  }

  #dispatchChange(route, url) {
    const detail = { route, url };
    /** @type {CustomEvent} */
    const event = new CustomEvent('route:change', { bubbles: true, detail });
    this.dispatchEvent(event);
    // Also fire on window so non-module scripts can listen
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('route:change', { detail }));
    }
  }
}

export const router = new Router();
export default router;
