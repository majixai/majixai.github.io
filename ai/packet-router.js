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

import {
  STRUCTURE_TAXONOMY,
  TAXONOMY_META,
  taxonomyByCategory,
  taxonomySearch,
  taxonomyStats,
} from './structure-taxonomy.js';

const ROUTES_URL = new URL('../router/routes.json', import.meta.url).href;
const PROJECTS_URL = new URL('../projects.json', import.meta.url).href;

const CACHE_KEY = 'majixai:packet-router:v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

const DEFAULT_MAX_NODES = 12;
const DEFAULT_MAX_STRUCTURE_MATCHES = 10;
const MAX_DESC_LENGTH = 140;
const MIN_TOKEN_LENGTH = 3;
const TAXONOMY_MATCH_WEIGHT = 2;
const INTENT_MATCH_WEIGHT = 2;

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
  #taxonomyRows = STRUCTURE_TAXONOMY;
  #taxonomyIndex = new Map();
  #taxonomyHintsByToken = new Map();
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

      this.#buildTaxonomyIndex();
      this.#structureEntries = this.#buildStructureEntries();
      this.#loadedAt = new Date().toISOString();
    } catch (err) {
      console.warn('[PacketRouter] Manifest load failed:', err);
      this.#routes = [];
      this.#projects = [];
      this.#structureEntries = [];
      this.#buildTaxonomyIndex();
      this.#loadedAt = new Date().toISOString();
    }
  }

  #buildTaxonomyIndex() {
    this.#taxonomyIndex = new Map();
    this.#taxonomyHintsByToken = new Map();
    for (const row of this.#taxonomyRows) {
      const category = safeLower(row.category);
      this.#taxonomyIndex.set(category, row);
      for (const hint of row.routingHints || []) {
        const token = safeLower(hint.token);
        if (!token) continue;
        const list = this.#taxonomyHintsByToken.get(token) || [];
        list.push({ ...hint, category });
        this.#taxonomyHintsByToken.set(token, list);
      }
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
    const reasons = [];
    const matchedTokens = [];
    const matchedHints = [];
    const matchedIntents = [];

    const name = safeLower(entry.name);
    const path = safeLower(entry.path);
    const category = safeLower(entry.category);
    const description = safeLower(entry.description);
    const commitMessage = safeLower(entry.commitMessage);

    const categoryKeywords = CATEGORY_KEYWORDS[category] ?? [];
    for (const token of tokens) {
      if (categoryKeywords.includes(token)) {
        score += 1;
        reasons.push('category-keyword');
      }
      if (name.includes(token)) {
        score += 6;
        reasons.push('name-hit');
        matchedTokens.push(token);
      }
      if (path.includes(token)) {
        score += 5;
        reasons.push('path-hit');
        matchedTokens.push(token);
      }
      if (description.includes(token)) {
        score += 2;
        reasons.push('description-hit');
      }
      if (commitMessage.includes(token)) {
        score += 1;
        reasons.push('commit-hit');
      }
      if (entry.tokens.includes(token)) {
        score += 2;
        reasons.push('entry-token-hit');
      }
    }

    // Exact category match boost if prompt references a category keyword directly.
    if (tokenSet.has(category)) {
      score += 4;
      reasons.push('category-exact');
    }

    const taxonomy = this.#taxonomyIndex.get(category);
    if (taxonomy) {
      for (const token of tokens) {
        if (taxonomy.synonyms?.includes(token)) {
          score += TAXONOMY_MATCH_WEIGHT;
          reasons.push('taxonomy-synonym-hit');
        }
        if (taxonomy.bigrams?.includes(token)) {
          score += TAXONOMY_MATCH_WEIGHT + 1;
          reasons.push('taxonomy-bigram-hit');
        }
        if (taxonomy.intents?.includes(token)) {
          score += INTENT_MATCH_WEIGHT;
          matchedIntents.push(token);
          reasons.push('taxonomy-intent-hit');
        }
      }
    }

    for (const token of tokens) {
      const hints = this.#taxonomyHintsByToken.get(token);
      if (!hints || hints.length === 0) continue;
      for (const hint of hints) {
        if (hint.category !== category) continue;
        score += Number(hint.boost || 1);
        matchedHints.push({
          token,
          boost: Number(hint.boost || 1),
          reason: hint.reason || 'taxonomy-hint',
          pathHints: hint.pathHints || [],
        });
        reasons.push('taxonomy-routing-hint');
      }
    }

    return {
      score,
      explain: {
        reasons: unique(reasons),
        matchedTokens: unique(matchedTokens),
        matchedIntents: unique(matchedIntents),
        matchedHints: matchedHints.slice(0, 10),
      },
    };
  }

  searchStructure(query, maxMatches = DEFAULT_MAX_STRUCTURE_MATCHES) {
    if (!query || !this.#structureEntries.length) return [];

    const tokens = unique(tokenize(query));
    const tokenSet = new Set(tokens);

    return this.#structureEntries
      .map(entry => {
        const scored = this.#scoreEntry(entry, tokens, tokenSet);
        return {
          entry,
          score: scored.score,
          explain: scored.explain,
        };
      })
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, clamp(maxMatches, 1, 60))
      .map(row => ({ ...row.entry, score: row.score, explain: row.explain }));
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
      .map(entry => {
        const scoredEntry = this.#scoreEntry(entry, tokens, tokenSet);
        return {
          entry,
          score: scoredEntry.score,
          explain: scoredEntry.explain,
        };
      })
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score);

    const nodes = scored
      .slice(0, maxNodes)
      .map(row => ({ ...row.entry, score: row.score, explain: row.explain }));
    const structureMatches = scored
      .slice(0, maxStructureMatches)
      .map(row => ({ ...row.entry, score: row.score, explain: row.explain }));

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
      taxonomyVersion: TAXONOMY_META.version,
      taxonomyCategories: this.#taxonomyRows.length,
      topIntents: [],
    };
  }

  #buildDiagnostics(prompt, tokens, nodes) {
    const scores = nodes.map(n => n.score);
    const avgScore = scores.length
      ? scores.reduce((sum, v) => sum + v, 0) / scores.length
      : 0;

    const confidence = clamp(Math.round(avgScore * 3), 0, 100);
    const topIntents = unique(
      nodes.flatMap(node => node.explain?.matchedIntents || []),
    ).slice(0, 10);

    return {
      promptLength: (prompt ?? '').length,
      tokenCount: tokens.length,
      routedNodeCount: nodes.length,
      uniqueCategories: unique(nodes.map(n => safeLower(n.category)).filter(Boolean)),
      confidence,
      loadedAt: this.#loadedAt,
      routeCount: this.#routes.length,
      structureEntryCount: this.#structureEntries.length,
      taxonomyVersion: TAXONOMY_META.version,
      taxonomyCategories: this.#taxonomyRows.length,
      topIntents,
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
        const explainTag = (match.explain?.reasons || []).slice(0, 3).join('|');
        lines.push(
          `- ${match.type}:${match.name} (${match.category}) score=${match.score} path=${match.path} explain=${explainTag || 'n/a'}`,
        );
      }
    }

    if (includeDiagnostics) {
      lines.push(
        '',
        `Diagnostics: confidence=${diagnostics.confidence} tokenCount=${diagnostics.tokenCount} routedNodes=${diagnostics.routedNodeCount} routeCount=${diagnostics.routeCount} structureEntries=${diagnostics.structureEntryCount} taxonomyVersion=${diagnostics.taxonomyVersion} taxonomyCategories=${diagnostics.taxonomyCategories}`,
        `Detected intents: ${(diagnostics.topIntents || []).join(', ') || 'none'}`,
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
      taxonomyVersion: TAXONOMY_META.version,
      taxonomyCategories: this.#taxonomyRows.length,
      supportedCategories: unique(this.#structureEntries.map(e => safeLower(e.category)).filter(Boolean)),
      capabilities: [
        'Directory relevance scoring',
        'Structure search by prompt tokens',
        'Taxonomy-driven intent matching and hint boosts',
        'Context header generation',
        'Routing diagnostics/confidence estimation',
      ],
    };
  }

  getTaxonomyStats() {
    return taxonomyStats();
  }

  explainRouting(prompt, maxMatches = 8) {
    const routed = this.routeWithStructure(prompt, {
      maxNodes: maxMatches,
      maxStructureMatches: maxMatches * 2,
      includeStructureDetails: true,
      includeDiagnostics: true,
    });
    const taxonomyMatches = taxonomySearch(prompt, maxMatches);
    return {
      prompt,
      routed,
      taxonomyMatches,
      taxonomyCategoryDetails: unique(
        taxonomyMatches.map(m => taxonomyByCategory(m.category)).filter(Boolean),
      ),
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
