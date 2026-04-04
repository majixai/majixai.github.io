/**
 * MajixAI Client-Side Router
 *
 * A lightweight router for the majixai.github.io multi-project static site.
 * Loads the routes manifest, resolves paths, drives History-API navigation,
 * and dispatches `route:change` events so any page can react to navigation.
 *
 * Usage (ES module):
 *   import { router } from './router.js';
 *   router.navigate('/best/');
 *   router.on('route:change', ({ detail }) => console.log(detail));
 *
 * Usage (classic script tag with type="module"):
 *   <script type="module" src="router/router.js"></script>
 *   window.addEventListener('route:change', handler);
 */

const ROUTES_URL = new URL('./routes.json', import.meta.url).href;

class Router extends EventTarget {
  /** @type {import('./routes.json').routes} */
  #routes = [];
  /** @type {Map<string, object>} path → route object */
  #index = new Map();
  #ready = false;
  #readyCallbacks = [];

  constructor() {
    super();
    this.#init();
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  async #init() {
    try {
      const res = await fetch(ROUTES_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
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
   *
   * @param {string} query
   * @returns {object[]} matching routes, sorted by relevance
   */
  search(query) {
    if (!query || !query.trim()) return [...this.#routes];
    const terms = query.trim().toLowerCase().split(/\s+/);

    const scored = this.#routes.map(route => {
      const haystack = [
        route.name,
        route.desc,
        route.category,
        route.lastCommitMessage ?? '',
      ]
        .join(' ')
        .toLowerCase();

      const score = terms.reduce(
        (acc, term) => acc + (haystack.includes(term) ? 1 : 0),
        0,
      );
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
   * Navigate to a route path using the History API and dispatch `route:change`.
   * Falls back to a direct `location.assign` when the History API is unavailable.
   *
   * @param {string} path  Route path (e.g. '/best/') or full URL.
   * @param {boolean} [replace=false]  Use replaceState instead of pushState.
   */
  navigate(path, replace = false) {
    const route = this.resolve(path);
    const target = route
      ? new URL(route.path, 'https://majixai.github.io').href
      : path;

    if (typeof history !== 'undefined' && history.pushState) {
      if (replace) {
        history.replaceState({ route }, '', target);
      } else {
        history.pushState({ route }, '', target);
      }
      this.#dispatchChange(route, target);
    } else {
      window.location.assign(target);
    }
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  #listenPopState() {
    if (typeof window === 'undefined') return;
    window.addEventListener('popstate', event => {
      const route = event.state?.route ?? this.resolve(location.pathname);
      this.#dispatchChange(route, location.href);
    });
  }

  #dispatchChange(route, url) {
    /** @type {CustomEvent} */
    const event = new CustomEvent('route:change', {
      bubbles: true,
      detail: { route, url },
    });
    this.dispatchEvent(event);
    // Also fire on window so non-module scripts can listen
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('route:change', { detail: { route, url } }));
    }
  }
}

export const router = new Router();
export default router;
