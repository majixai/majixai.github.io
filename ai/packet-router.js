/**
 * ai/packet-router.js
 *
 * Structure-aware packet router for MajixAI.
 *
 * Goals:
 * 1) Route each prompt through relevant root directories.
 * 2) Search current repository structure metadata (routes + projects manifests).
 * 3) Build rich context blocks and diagnostics for self-aware prompting.
 */

const ROUTES_URL = new URL('../router/routes.json', import.meta.url).href;
const PROJECTS_URL = new URL('../projects.json', import.meta.url).href;

const CACHE_KEY = 'majixai:packet-router:v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

const DEFAULT_MAX_NODES = 12;
const DEFAULT_MAX_STRUCTURE_MATCHES = 10;
const MAX_DESC_LENGTH = 140;
const MIN_TOKEN_LENGTH = 3;

const CATEGORY_KEYWORDS = {
  finance: [
    'stock', 'trade', 'market', 'portfolio', 'option', 'put', 'call',
    'price', 'invest', 'equity', 'bond', 'etf', 'reit', 'volatility',
    'dividend', 'yield', 'crypto', 'bitcoin', 'btc', 'dji', 'sp500',
    'dow', 'nasdaq', 'ticker', 'forecast', 'fintech',
  ],
  data: [
    'data', 'csv', 'database', 'db', 'chart', 'graph', 'plot',
    'dataset', 'table', 'record', 'query', 'sql', 'json', 'index',
    'analytics', 'metrics', 'statistics', 'history',
  ],
  gaming: [
    'game', 'golf', 'football', 'nfl', 'casino', 'poker', 'holdem',
    'dice', 'play', 'player', 'score', 'odds', 'strategy', 'playbook',
    'gridiron', 'touchdown',
  ],
  web: [
    'web', 'pwa', 'website', 'booking', 'hotel', 'reservation',
    'contact', 'form', 'ui', 'page', 'app', 'frontend', 'html',
    'css', 'javascript', 'responsive',
  ],
  tools: [
    'tool', 'utility', 'script', 'automation', 'api', 'bot', 'scrape',
    'fetch', 'generator', 'analyzer', 'monitor', 'tracker', 'manager',
    'chat', 'ai', 'ml', 'model', 'neural', 'wiki', 'blog', 'ledger',
  ],
  math: [
    'algebra', 'calculus', 'matrix', 'bayes', 'probability',
    'topology', 'manifold', 'tensor', 'differential', 'measure',
    'complexity', 'optimization', 'regression', 'numerical',
    'statistical', 'quantum', 'cryptography', 'information',
    'functional', 'category', 'transformations',
  ],
};

const MATH_DIRS = new Set([
  'algebra', 'bayes', 'calculus', 'category_theory', 'complexity_theory',
  'cryptography', 'differential_equations', 'functional_analysis',
  'information_theory', 'manifolds', 'matrix', 'measure_theory',
  'numerical_methods', 'optimization', 'probability', 'quantum_mechanics',
  'regression', 'statistical_mechanics', 'tensor', 'topology', 'transformations',
]);

function safeLower(value) {
  return (value ?? '').toString().toLowerCase();
}

function tokenize(text) {
  return safeLower(text)
    .split(/[^a-z0-9_/-]+/)
    .flatMap(segment => segment.split(/[/_-]+/))
    .map(s => s.trim())
    .filter(s => s.length >= MIN_TOKEN_LENGTH);
}

function unique(values) {
  return [...new Set(values)];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseProjects(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.projects)) return payload.projects;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

async function fetchJsonWithCache(url, keyHint) {
  const cacheKey = `${CACHE_KEY}:${keyHint}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < CACHE_TTL_MS) {
        return parsed.data;
      }
    }
  } catch (_) {
    // cache read is best-effort
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {
    // cache write is best-effort
  }

  return data;
}

export class PacketRouter {
  #routes = [];
  #projects = [];
  #structureEntries = [];
  #loadedAt = null;
  #readyPromise;

  constructor() {
    this.#readyPromise = this.#load();
  }

  ready() {
    return this.#readyPromise;
  }

  async #load() {
    try {
      const [routesManifest, projectsManifest] = await Promise.all([
        fetchJsonWithCache(ROUTES_URL, 'routes'),
        fetchJsonWithCache(PROJECTS_URL, 'projects'),
      ]);

      this.#routes = Array.isArray(routesManifest?.routes) ? routesManifest.routes : [];
      this.#projects = parseProjects(projectsManifest);

      for (const route of this.#routes) {
        if (MATH_DIRS.has(safeLower(route.name)) && safeLower(route.category) !== 'math') {
          route.category = 'math';
        }
      }

      this.#structureEntries = this.#buildStructureEntries();
      this.#loadedAt = new Date().toISOString();
    } catch (err) {
      console.warn('[PacketRouter] Manifest load failed:', err);
      this.#routes = [];
      this.#projects = [];
      this.#structureEntries = [];
      this.#loadedAt = new Date().toISOString();
    }
  }

  #buildStructureEntries() {
    const routeEntries = this.#routes.map(route => ({
      id: `route:${route.path || route.name}`,
      type: 'route',
      name: route.name ?? '',
      path: route.path ?? '',
      category: route.category ?? 'tools',
      description: route.desc ?? '',
      commitMessage: route.lastCommitMessage ?? '',
      tokens: unique([
        ...tokenize(route.name),
        ...tokenize(route.path),
        ...tokenize(route.category),
        ...tokenize(route.desc),
        ...tokenize(route.lastCommitMessage),
      ]),
    }));

    const projectEntries = this.#projects
      .map(project => {
        const name = project.name ?? project.title ?? '';
        const path = project.path ?? (name ? `/${name}/` : '');
        const category = project.category ?? 'tools';
        const description = project.desc ?? project.description ?? '';
        if (!name && !path) return null;
        return {
          id: `project:${path || name}`,
          type: 'project',
          name,
          path,
          category,
          description,
          commitMessage: '',
          tokens: unique([
            ...tokenize(name),
            ...tokenize(path),
            ...tokenize(category),
            ...tokenize(description),
          ]),
        };
      })
      .filter(Boolean);

    const merged = [...routeEntries, ...projectEntries];
    const seen = new Set();
    const deduped = [];

    for (const entry of merged) {
      const key = safeLower(entry.path || entry.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(entry);
    }

    return deduped;
  }

  #scoreEntry(entry, tokens, tokenSet) {
    let score = 0;

    const name = safeLower(entry.name);
    const path = safeLower(entry.path);
    const category = safeLower(entry.category);
    const description = safeLower(entry.description);
    const commitMessage = safeLower(entry.commitMessage);

    const categoryKeywords = CATEGORY_KEYWORDS[category] ?? [];
    for (const token of tokens) {
      if (categoryKeywords.includes(token)) score += 1;
      if (name.includes(token)) score += 6;
      if (path.includes(token)) score += 5;
      if (description.includes(token)) score += 2;
      if (commitMessage.includes(token)) score += 1;
      if (entry.tokens.includes(token)) score += 2;
    }

    // Exact category match boost if prompt references a category keyword directly.
    if (tokenSet.has(category)) {
      score += 4;
    }

    return score;
  }

  searchStructure(query, maxMatches = DEFAULT_MAX_STRUCTURE_MATCHES) {
    if (!query || !this.#structureEntries.length) return [];

    const tokens = unique(tokenize(query));
    const tokenSet = new Set(tokens);

    return this.#structureEntries
      .map(entry => ({ entry, score: this.#scoreEntry(entry, tokens, tokenSet) }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, clamp(maxMatches, 1, 60))
      .map(row => ({ ...row.entry, score: row.score }));
  }

  routeWithStructure(prompt, options = {}) {
    if (!prompt || !this.#structureEntries.length) {
      return {
        nodes: [],
        structureMatches: [],
        contextHeader: '',
        diagnostics: this.#emptyDiagnostics(prompt),
      };
    }

    const maxNodes = clamp(options.maxNodes ?? DEFAULT_MAX_NODES, 1, 40);
    const maxStructureMatches = clamp(
      options.maxStructureMatches ?? DEFAULT_MAX_STRUCTURE_MATCHES,
      1,
      60,
    );

    const tokens = unique(tokenize(prompt));
    const tokenSet = new Set(tokens);

    const scored = this.#structureEntries
      .map(entry => ({ entry, score: this.#scoreEntry(entry, tokens, tokenSet) }))
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score);

    const nodes = scored.slice(0, maxNodes).map(row => ({ ...row.entry, score: row.score }));
    const structureMatches = scored
      .slice(0, maxStructureMatches)
      .map(row => ({ ...row.entry, score: row.score }));

    const diagnostics = this.#buildDiagnostics(prompt, tokens, nodes);
    const contextHeader = this.#buildContextHeader(nodes, structureMatches, diagnostics, options);

    return { nodes, structureMatches, contextHeader, diagnostics };
  }

  route(prompt, maxNodes = DEFAULT_MAX_NODES) {
    const { nodes, contextHeader, diagnostics } = this.routeWithStructure(prompt, {
      maxNodes,
      maxStructureMatches: maxNodes,
      includeStructureDetails: false,
    });
    return { nodes, contextHeader, diagnostics };
  }

  #emptyDiagnostics(prompt) {
    return {
      promptLength: (prompt ?? '').length,
      tokenCount: tokenize(prompt).length,
      routedNodeCount: 0,
      uniqueCategories: [],
      confidence: 0,
      loadedAt: this.#loadedAt,
      routeCount: this.#routes.length,
      structureEntryCount: this.#structureEntries.length,
    };
  }

  #buildDiagnostics(prompt, tokens, nodes) {
    const scores = nodes.map(n => n.score);
    const avgScore = scores.length
      ? scores.reduce((sum, v) => sum + v, 0) / scores.length
      : 0;

    const confidence = clamp(Math.round(avgScore * 3), 0, 100);

    return {
      promptLength: (prompt ?? '').length,
      tokenCount: tokens.length,
      routedNodeCount: nodes.length,
      uniqueCategories: unique(nodes.map(n => safeLower(n.category)).filter(Boolean)),
      confidence,
      loadedAt: this.#loadedAt,
      routeCount: this.#routes.length,
      structureEntryCount: this.#structureEntries.length,
    };
  }

  #buildContextHeader(nodes, structureMatches, diagnostics, options) {
    if (!nodes.length) return '';

    const includeStructureDetails = options.includeStructureDetails !== false;
    const includeDiagnostics = options.includeDiagnostics !== false;

    const lines = [
      '=== MAJIXAI STRUCTURE ROUTING CONTEXT ===',
      'Use this context as routing metadata to improve answer relevance.',
      '',
      'Top routed nodes:',
      ...nodes.map((node, idx) =>
        `${idx + 1}. [${node.name}] (${node.category}) score=${node.score} path=${node.path} desc=${safeLower(node.description).slice(0, MAX_DESC_LENGTH)}`,
      ),
    ];

    if (includeStructureDetails) {
      lines.push('', 'Additional structure matches:');
      for (const match of structureMatches.slice(0, 12)) {
        lines.push(
          `- ${match.type}:${match.name} (${match.category}) score=${match.score} path=${match.path}`,
        );
      }
    }

    if (includeDiagnostics) {
      lines.push(
        '',
        `Diagnostics: confidence=${diagnostics.confidence} tokenCount=${diagnostics.tokenCount} routedNodes=${diagnostics.routedNodeCount} routeCount=${diagnostics.routeCount} structureEntries=${diagnostics.structureEntryCount}`,
      );
    }

    lines.push('=== END MAJIXAI STRUCTURE ROUTING CONTEXT ===', '');
    return lines.join('\n');
  }

  getSelfProfile() {
    return {
      name: 'MajixAI Structure-Aware Router',
      purpose: 'Route prompts through root directory metadata and structure matches',
      loadedAt: this.#loadedAt,
      routeCount: this.#routes.length,
      projectCount: this.#projects.length,
      structureEntryCount: this.#structureEntries.length,
      supportedCategories: unique(this.#structureEntries.map(e => safeLower(e.category)).filter(Boolean)),
      capabilities: [
        'Directory relevance scoring',
        'Structure search by prompt tokens',
        'Context header generation',
        'Routing diagnostics/confidence estimation',
      ],
    };
  }

  get routes() {
    return this.#routes;
  }

  get structureEntries() {
    return this.#structureEntries;
  }

  static pipelineLabel(nodes) {
    return nodes.map(node => `${node.category}/${node.name}`).join(' → ');
  }
}

export default PacketRouter;
