/**
 * ai/packet-router.js
 *
 * Loads the site-wide routes manifest from router/routes.json and scores every
 * registered directory against the user's prompt.  The top-scoring directories
 * become "routing nodes" whose metadata is injected as context into the AI
 * request, allowing all root directories to participate in the throughput of
 * each data packet (prompt).
 *
 * Usage (ES module):
 *   import { PacketRouter } from './packet-router.js';
 *   const pr = new PacketRouter();
 *   await pr.ready();
 *   const { nodes, contextHeader } = pr.route(promptText);
 */

// ── Constants ──────────────────────────────────────────────────────────────

/** Path to the site-wide routes manifest, relative to this file's URL. */
const ROUTES_URL = new URL('../router/routes.json', import.meta.url).href;

/** Maximum number of routing nodes included per packet. */
const MAX_NODES = 8;

/** Maximum characters of a route description shown in routing context/UI. */
const MAX_DESC_LENGTH = 120;

/**
 * Per-category keyword banks used for keyword scoring.
 * Each category maps to an array of lower-case token strings.
 */
const CATEGORY_KEYWORDS = {
  finance: [
    'stock', 'trade', 'market', 'portfolio', 'option', 'put', 'call',
    'price', 'invest', 'equity', 'bond', 'etf', 'reit', 'bsm',
    'black-scholes', 'volatility', 'dividend', 'yield', 'crypto',
    'bitcoin', 'btc', 'dji', 'sp500', 's&p', 'dow', 'nasdaq',
    'quantix', 'jinx', 'etrade', 'ticker', 'forecast', 'fintech',
  ],
  data: [
    'data', 'csv', 'database', 'db', 'chart', 'graph', 'plot',
    'dataset', 'table', 'record', 'query', 'sql', 'json', 'index',
    'analytics', 'metrics', 'stats', 'statistics', 'history',
  ],
  gaming: [
    'game', 'golf', 'football', 'nfl', 'casino', 'poker', 'holdem',
    'dice', 'play', 'player', 'score', 'odds', 'strategy', 'playbook',
    'gridiron', 'touchdown', 'jinxcasino',
  ],
  web: [
    'web', 'pwa', 'website', 'booking', 'hotel', 'reservation',
    'contact', 'form', 'ui', 'page', 'app', 'frontend', 'html',
    'css', 'javascript', 'responsive',
  ],
  tools: [
    'tool', 'utility', 'script', 'automation', 'api', 'bot', 'scrape',
    'fetch', 'generator', 'analyzer', 'monitor', 'tracker', 'manager',
    'chat', 'ai', 'ml', 'tensorflow', 'model', 'neural', 'clip',
    'wiki', 'blog', 'menu', 'ledger', 'checkin',
  ],
  math: [
    'algebra', 'calculus', 'matrix', 'bayes', 'probability',
    'topology', 'manifold', 'tensor', 'differential', 'measure',
    'complexity', 'optimization', 'regression', 'numerical',
    'statistical', 'quantum', 'mechanics', 'cryptography',
    'information', 'functional', 'category', 'transformations',
  ],
};

// Math-specific dirs not in routes.json with category "math" — map them here
const MATH_DIRS = new Set([
  'algebra', 'bayes', 'calculus', 'category_theory', 'complexity_theory',
  'cryptography', 'differential_equations', 'functional_analysis',
  'information_theory', 'manifolds', 'matrix', 'measure_theory',
  'numerical_methods', 'optimization', 'probability', 'quantum_mechanics',
  'regression', 'statistical_mechanics', 'tensor', 'topology',
  'transformations',
]);

// ── PacketRouter ───────────────────────────────────────────────────────────

export class PacketRouter {
  /** @type {object[]} */
  #routes = [];
  #readyPromise;

  constructor() {
    this.#readyPromise = this.#load();
  }

  /** Returns a Promise that resolves once the manifest is loaded. */
  ready() {
    return this.#readyPromise;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  async #load() {
    try {
      const res = await fetch(ROUTES_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      this.#routes = manifest.routes ?? [];
      // Supplement category for known math dirs
      for (const r of this.#routes) {
        if (MATH_DIRS.has(r.name) && r.category !== 'math') {
          r.category = 'math';
        }
      }
    } catch (err) {
      console.warn('[PacketRouter] Could not load routes manifest:', err);
      this.#routes = [];
    }
  }

  /**
   * Score a single route against a tokenised prompt.
   * Returns a non-negative integer; higher is more relevant.
   *
   * @param {object} route
   * @param {string[]} tokens  Lower-case prompt tokens
   * @returns {number}
   */
  #score(route, tokens) {
    let score = 0;
    const name   = (route.name        ?? '').toLowerCase();
    const desc   = (route.desc        ?? '').toLowerCase();
    const cat    = (route.category    ?? '').toLowerCase();
    const msg    = (route.lastCommitMessage ?? '').toLowerCase();

    // 1. Category-level keyword match (broad signal)
    const catKws = CATEGORY_KEYWORDS[cat] ?? [];
    for (const token of tokens) {
      if (catKws.includes(token))  score += 1;
    }

    // 2. Direct token hits in the route's own metadata (strong signal)
    for (const token of tokens) {
      if (name.includes(token))    score += 4;
      if (desc.includes(token))    score += 2;
      if (msg.includes(token))     score += 1;
    }

    return score;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * All loaded routes.
   * @returns {object[]}
   */
  get routes() {
    return this.#routes;
  }

  /**
   * Route a data packet (prompt) through the directory graph.
   *
   * Returns the top-scoring nodes and a context header string ready to be
   * prepended to the AI prompt so all relevant directories contribute context.
   *
   * @param {string} prompt  The user's raw prompt text.
   * @param {number} [maxNodes=MAX_NODES]
   * @returns {{ nodes: object[], contextHeader: string }}
   */
  route(prompt, maxNodes = MAX_NODES) {
    if (!prompt || this.#routes.length === 0) {
      return { nodes: [], contextHeader: '' };
    }

    // Tokenise: lower-case, split on non-alphanumeric, remove short tokens
    const tokens = prompt
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 3);

    // Score every route
    const scored = this.#routes
      .map(route => ({ route, score: this.#score(route, tokens) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxNodes);

    const nodes = scored.map(s => s.route);

    // Build context header
    const contextHeader = nodes.length === 0
      ? ''
      : [
          '=== ROUTING CONTEXT ===',
          'The following site directories were identified as relevant data sources',
          'for this prompt. Use them as background knowledge when answering:',
          '',
          ...nodes.map(n =>
            `• [${n.name}] (${n.category}) – ${(n.desc || '').slice(0, MAX_DESC_LENGTH).replace(/\n/g, ' ')}`
          ),
          '=== END ROUTING CONTEXT ===',
          '',
        ].join('\n');

    return { nodes, contextHeader };
  }

  /**
   * Return a human-readable routing pipeline string.
   * e.g. "finance/options → finance/market → data/csv"
   *
   * @param {object[]} nodes
   * @returns {string}
   */
  static pipelineLabel(nodes) {
    return nodes.map(n => `${n.category}/${n.name}`).join(' → ');
  }
}

export default PacketRouter;
