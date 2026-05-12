/**
 * ai/script.js
 *
 * Expanded self-aware orchestration layer for the MajixAI Prompt Solver.
 *
 * Features:
 * - Structure-aware routing over current repository manifests
 * - Self-aware mode (capability and state disclosure in prompt preamble)
 * - Local slash commands for structure inspection without API usage
 * - Optional short-term memory across prompt turns
 * - Routing diagnostics and confidence UI
 * - Markdown rendering with syntax highlighting (marked + highlight.js)
 * - Message timestamps and copy-to-clipboard on AI responses
 * - Collapsible routing/diagnostics panel
 * - Character counter and model selector
 */

import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';
import { PacketRouter } from './packet-router.js';

const MAX_DESC_LENGTH = 120;
const MAX_HISTORY_TURNS = 6;
const MAX_STRUCTURE_PREVIEW = 12;
const CHAR_WARN_THRESHOLD = 3000;

// ── Markdown renderer ────────────────────────────────────────────────────────

/**
 * Render markdown text to sanitized HTML, with optional syntax highlighting.
 * Falls back to raw escaped text if marked is unavailable.
 */
function renderMarkdown(text) {
  const raw = marked.parse(String(text ?? ''));
  const clean = (typeof DOMPurify !== 'undefined')
    ? DOMPurify.sanitize(raw)
    : raw;

  // Apply syntax highlighting to fenced code blocks in a temporary DOM node
  if (typeof hljs !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = clean;
    temp.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
    return temp.innerHTML;
  }

  return clean;
}

// ── Router ───────────────────────────────────────────────────────────────────

const packetRouter = new PacketRouter();

// ── DOM refs ─────────────────────────────────────────────────────────────────

const chatContainer = document.getElementById('chat-container');
const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const apiKeyInput = document.getElementById('api-key-input');
const routingDisplay = document.getElementById('routing-display');
const routingDiagnostics = document.getElementById('routing-diagnostics');
const selfAwareStatus = document.getElementById('self-aware-status');
const explainabilityDisplay = document.getElementById('routing-explainability');
const routingCard = document.getElementById('routing-card');
const routingCardToggle = document.getElementById('routing-card-toggle');
const routingCardDetails = document.getElementById('routing-card-details');
const routingChevron = document.getElementById('routing-chevron');
const clearChatBtn = document.getElementById('clear-chat-btn');
const charCounter = document.getElementById('char-counter');

const selfAwareToggle = document.getElementById('self-aware-toggle');
const structureScanToggle = document.getElementById('structure-scan-toggle');
const memoryToggle = document.getElementById('memory-toggle');
const responseProfileSelect = document.getElementById('response-profile');
const routingBudgetSelect = document.getElementById('routing-budget');
const modelSelect = document.getElementById('model-select');

const appState = {
  turns: [],
  lastRouting: null,
  commandHistory: [],
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function safe(value) {
  return (value ?? '').toString();
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getModelName() {
  return safe(modelSelect?.value || 'gemini-1.5-flash-latest');
}

function scrollBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ── Message rendering ─────────────────────────────────────────────────────────

/**
 * Create a styled chat message element.
 * Model messages render markdown with a copy-to-clipboard button.
 */
function createMessageElement(text, role) {
  const wrapper = document.createElement('div');
  wrapper.className = `${role}-message w3-margin-bottom chat-message`;

  const content = document.createElement('div');
  content.className = 'msg-content';

  if (role === 'model') {
    content.innerHTML = renderMarkdown(text);
  } else {
    content.textContent = text;
  }

  wrapper.appendChild(content);

  if (role === 'model') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.innerHTML = '<i class="fa fa-copy"></i> Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = '<i class="fa fa-check"></i> Copied';
        setTimeout(() => { copyBtn.innerHTML = '<i class="fa fa-copy"></i> Copy'; }, 1800);
      }).catch(() => {});
    });

    actions.appendChild(copyBtn);
    wrapper.appendChild(actions);
  }

  const ts = document.createElement('div');
  ts.className = 'msg-time';
  ts.textContent = nowTime();
  wrapper.appendChild(ts);

  return wrapper;
}

function appendText(text, role) {
  const el = createMessageElement(text, role);
  chatContainer.appendChild(el);
  scrollBottom();
  return el;
}

// ── Self-aware status ─────────────────────────────────────────────────────────

function updateSelfAwareStatus(routing) {
  if (!selfAwareStatus) return;
  const selfAwareEnabled = !!selfAwareToggle?.checked;
  const structureEnabled = !!structureScanToggle?.checked;
  const memoryEnabled = !!memoryToggle?.checked;

  const routeCount = routing?.diagnostics?.routeCount ?? 0;
  const structureCount = routing?.diagnostics?.structureEntryCount ?? 0;
  const confidence = routing?.diagnostics?.confidence ?? 0;
  const taxonomyVersion = routing?.diagnostics?.taxonomyVersion ?? 'n/a';
  const taxonomyCategories = routing?.diagnostics?.taxonomyCategories ?? 0;

  selfAwareStatus.innerHTML = '';

  const badges = [
    { label: selfAwareEnabled ? 'Self-aware ON' : 'Self-aware OFF', cls: selfAwareEnabled ? 'status-on' : 'status-off' },
    { label: structureEnabled ? 'Structure scan ON' : 'Structure scan OFF', cls: structureEnabled ? 'status-on' : 'status-off' },
    { label: memoryEnabled ? 'Memory ON' : 'Memory OFF', cls: memoryEnabled ? 'status-on' : 'status-off' },
    { label: `Routes ${routeCount}`, cls: 'status-neutral' },
    { label: `Entries ${structureCount}`, cls: 'status-neutral' },
    { label: `Confidence ${confidence}%`, cls: 'status-neutral' },
    { label: `Taxonomy v${taxonomyVersion}`, cls: 'status-neutral' },
    { label: `Taxonomy Categories ${taxonomyCategories}`, cls: 'status-neutral' },
  ];

  badges.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = `status-chip ${item.cls}`;
    chip.textContent = item.label;
    selfAwareStatus.appendChild(chip);
  });
}

// ── Routing panel ─────────────────────────────────────────────────────────────

function showExplainability(routing) {
  if (!explainabilityDisplay) return;
  if (!routing?.nodes?.length) {
    explainabilityDisplay.innerHTML = '';
    return;
  }

  explainabilityDisplay.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'diag-row';
  title.textContent = 'routing_explainability:';
  explainabilityDisplay.appendChild(title);

  routing.nodes.slice(0, 8).forEach((node, idx) => {
    const line = document.createElement('div');
    line.className = 'diag-row';
    const reasons = (node.explain?.reasons || []).slice(0, 4).join('|') || 'n/a';
    const intents = (node.explain?.matchedIntents || []).slice(0, 4).join(',') || 'none';
    line.textContent = `${idx + 1}. ${node.category}/${node.name} score=${node.score} reasons=${reasons} intents=${intents}`;
    explainabilityDisplay.appendChild(line);
  });
}

function showRoutingPipeline(nodes) {
  if (!routingDisplay || !routingCard) return;
  if (!nodes || nodes.length === 0) {
    routingCard.style.display = 'none';
    routingDisplay.innerHTML = '';
    return;
  }

  routingCard.style.display = '';
  routingDisplay.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'routing-label';
  label.textContent = 'Routing: ';
  routingDisplay.appendChild(label);

  nodes.forEach((node, i) => {
    const chip = document.createElement('a');
    chip.className = `routing-chip routing-cat-${node.category || 'tools'}`;
    chip.href = `https://majixai.github.io${node.path || '/'}`;
    chip.target = '_blank';
    chip.rel = 'noopener';
    chip.textContent = `${node.name}`;
    chip.title = safe(node.description || node.desc || node.name).slice(0, MAX_DESC_LENGTH);

    routingDisplay.appendChild(chip);

    if (i < nodes.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'routing-arrow';
      arrow.textContent = ' → ';
      routingDisplay.appendChild(arrow);
    }
  });
}

function showRoutingDiagnostics(routing) {
  if (!routingDiagnostics) return;
  if (!routing?.diagnostics) {
    routingDiagnostics.innerHTML = '';
    return;
  }

  const d = routing.diagnostics;
  routingDiagnostics.innerHTML = '';

  const row1 = document.createElement('div');
  row1.className = 'diag-row';
  row1.textContent = `confidence=${d.confidence}% · tokens=${d.tokenCount} · nodes=${d.routedNodeCount}`;

  const row2 = document.createElement('div');
  row2.className = 'diag-row';
  row2.textContent = `routes=${d.routeCount} · structureEntries=${d.structureEntryCount} · loadedAt=${safe(d.loadedAt || 'n/a')}`;

  const row3 = document.createElement('div');
  row3.className = 'diag-row';
  row3.textContent = `categories=${(d.uniqueCategories || []).join(', ') || 'none'}`;

  const row4 = document.createElement('div');
  row4.className = 'diag-row';
  row4.textContent = `taxonomyVersion=${safe(d.taxonomyVersion || 'n/a')} · taxonomyCategories=${safe(d.taxonomyCategories || 0)}`;

  const row5 = document.createElement('div');
  row5.className = 'diag-row';
  row5.textContent = `detectedIntents=${(d.topIntents || []).join(', ') || 'none'}`;

  routingDiagnostics.appendChild(row1);
  routingDiagnostics.appendChild(row2);
  routingDiagnostics.appendChild(row3);
  routingDiagnostics.appendChild(row4);
  routingDiagnostics.appendChild(row5);
}

// ── Response guidance ─────────────────────────────────────────────────────────

function responseGuidance(profile) {
  const map = {
    concise: 'Respond in concise format with direct actionable points only.',
    balanced: 'Respond with balanced detail: short explanation + concrete steps.',
    deep: 'Respond with in-depth technical detail, assumptions, and edge-case reasoning.',
    strategist: 'Respond as a systems strategist: include architecture decisions and tradeoffs.',
  };
  return map[profile] ?? map.balanced;
}

// ── Memory ────────────────────────────────────────────────────────────────────

function getChatHistoryForModel() {
  if (!memoryToggle?.checked) return [];

  const recent = appState.turns.slice(-MAX_HISTORY_TURNS * 2);
  return recent.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));
}

function rememberTurn(role, text) {
  if (!memoryToggle?.checked) return;
  appState.turns.push({ role, text: safe(text), ts: nowIso() });
  if (appState.turns.length > MAX_HISTORY_TURNS * 2) {
    appState.turns = appState.turns.slice(-MAX_HISTORY_TURNS * 2);
  }
}

// ── Local commands ────────────────────────────────────────────────────────────

function localHelpText() {
  return [
    'Local commands:',
    '/help                     show command help',
    '/self                     show router self-profile',
    '/scan <terms>             search current structure metadata',
    '/routes <terms>           alias of /scan',
    '/taxonomy [query]         search taxonomy categories and entities',
    '/taxonomy stats           summarize taxonomy row sizes',
    '/explain <prompt>         explain why routing selected specific nodes',
    '/browse [category]        list structure entries (optionally filtered by category)',
    '/memory clear             clear local short-term memory',
    '/history                  show local command history',
  ].join('\n');
}

async function handleLocalCommand(rawPrompt) {
  const prompt = safe(rawPrompt).trim();
  if (!prompt.startsWith('/')) return false;

  await packetRouter.ready();

  const [cmd, ...rest] = prompt.split(/\s+/);
  const query = rest.join(' ').trim();
  appState.commandHistory.push({ cmd, query, ts: nowIso() });
  if (appState.commandHistory.length > 100) {
    appState.commandHistory = appState.commandHistory.slice(-100);
  }

  if (cmd === '/help') {
    appendText(localHelpText(), 'model');
    return true;
  }

  if (cmd === '/self') {
    const profile = packetRouter.getSelfProfile();
    const lines = [
      '# Self Profile',
      `- Name: ${profile.name}`,
      `- Purpose: ${profile.purpose}`,
      `- Loaded At: ${profile.loadedAt}`,
      `- Route Count: ${profile.routeCount}`,
      `- Project Count: ${profile.projectCount}`,
      `- Structure Entries: ${profile.structureEntryCount}`,
      `- Supported Categories: ${profile.supportedCategories.join(', ')}`,
      '',
      '## Capabilities',
      ...profile.capabilities.map((c) => `- ${c}`),
    ];

    appendText(lines.join('\n'), 'model');
    return true;
  }

  if (cmd === '/memory' && query.toLowerCase() === 'clear') {
    appState.turns = [];
    appendText('Local memory cleared.', 'model');
    return true;
  }

  if (cmd === '/scan' || cmd === '/routes') {
    if (!query) {
      appendText('Usage: /scan <terms>', 'error');
      return true;
    }

    const matches = packetRouter.searchStructure(query, 20);
    if (!matches.length) {
      appendText(`No structure matches found for: ${query}`, 'model');
      return true;
    }

    const lines = [
      `# Structure matches for "${query}"`,
      ...matches.map((m, i) =>
        `${i + 1}. **${m.name}** (${m.category}) — score=${m.score} — path: \`${m.path}\``,
      ),
    ];

    appendText(lines.join('\n'), 'model');
    return true;
  }

  if (cmd === '/taxonomy') {
    if (!query) {
      const profile = packetRouter.getSelfProfile();
      appendText(
        [
          '# Taxonomy quick view',
          `Version: ${profile.taxonomyVersion}`,
          `Category rows: ${profile.taxonomyCategories}`,
          'Use /taxonomy stats for aggregate counts or /taxonomy <query> for lookup.',
        ].join('\n'),
        'model',
      );
      return true;
    }

    if (query.toLowerCase() === 'stats') {
      const stats = packetRouter.getTaxonomyStats();
      const lines = [
        '# Taxonomy stats',
        ...stats.map((row) =>
          `- ${row.category}: synonyms=${row.synonyms}, bigrams=${row.bigrams}, intents=${row.intents}, intentPhrases=${row.intentPhrases}, entities=${row.entities}, hints=${row.routingHints}`,
        ),
      ];
      appendText(lines.join('\n'), 'model');
      return true;
    }

    const explanation = packetRouter.explainRouting(query, 8);
    const matches = explanation.taxonomyMatches || [];
    if (!matches.length) {
      appendText(`No taxonomy match for: ${query}`, 'model');
      return true;
    }
    appendText(
      [
        `# Taxonomy matches for "${query}"`,
        ...matches.map((m, idx) => `${idx + 1}. ${m.category} score=${m.score} entities=${(m.topEntities || []).join(', ')}`),
      ].join('\n'),
      'model',
    );
    return true;
  }

  if (cmd === '/explain') {
    if (!query) {
      appendText('Usage: /explain <prompt>', 'error');
      return true;
    }

    const explanation = packetRouter.explainRouting(query, 8);
    const routed = explanation.routed || {};
    showRoutingPipeline((routed.nodes || []).slice(0, MAX_STRUCTURE_PREVIEW));
    showRoutingDiagnostics(routed);
    showExplainability(routed);
    updateSelfAwareStatus(routed);

    const lines = [
      `# Routing explanation for "${query}"`,
      `- confidence: ${routed.diagnostics?.confidence ?? 0}`,
      `- categories: ${(routed.diagnostics?.uniqueCategories || []).join(', ') || 'none'}`,
      '',
      '## top routed nodes',
      ...(routed.nodes || []).slice(0, 8).map((node, i) => {
        const reasons = (node.explain?.reasons || []).slice(0, 6).join(', ') || 'none';
        const intents = (node.explain?.matchedIntents || []).slice(0, 6).join(', ') || 'none';
        return `${i + 1}. ${node.category}/${node.name} score=${node.score} reasons=[${reasons}] intents=[${intents}]`;
      }),
      '',
      '## taxonomy matches',
      ...(explanation.taxonomyMatches || []).slice(0, 8).map(
        (m, i) => `${i + 1}. ${m.category} score=${m.score} entities=${(m.topEntities || []).join(', ')}`,
      ),
    ];
    appendText(lines.join('\n'), 'model');
    return true;
  }

  if (cmd === '/browse') {
    const filter = query.toLowerCase();
    const entries = packetRouter.structureEntries
      .filter((entry) => !filter || safe(entry.category).toLowerCase() === filter)
      .slice(0, 120);
    if (!entries.length) {
      appendText(filter ? `No structure entries found for category: ${filter}` : 'No structure entries found.', 'model');
      return true;
    }
    appendText(
      [
        `# Structure browser${filter ? ` (${filter})` : ''}`,
        ...entries.map((entry, idx) => `${idx + 1}. ${entry.type}:${entry.name} (${entry.category}) path=${entry.path}`),
      ].join('\n'),
      'model',
    );
    return true;
  }

  if (cmd === '/history') {
    const rows = appState.commandHistory.slice(-25);
    if (!rows.length) {
      appendText('No command history yet.', 'model');
      return true;
    }
    appendText(
      [
        '# Recent local commands',
        ...rows.map((row, idx) => `${idx + 1}. ${row.ts} ${row.cmd} ${row.query}`),
      ].join('\n'),
      'model',
    );
    return true;
  }

  appendText(`Unknown command: ${cmd}. Try /help`, 'error');
  return true;
}

// ── Self-aware preamble ───────────────────────────────────────────────────────

function buildSelfAwarePreamble(prompt, routing) {
  const selfAwareEnabled = !!selfAwareToggle?.checked;
  const profile = safe(responseProfileSelect?.value || 'balanced');

  const preambleLines = [
    '=== MAJIXAI SELF-AWARE DIRECTIVE ===',
    `timestamp=${nowIso()}`,
    `model=${getModelName()}`,
    `responseProfile=${profile}`,
    `guidance=${responseGuidance(profile)}`,
  ];

  if (selfAwareEnabled) {
    const selfProfile = packetRouter.getSelfProfile();
    preambleLines.push(
      'selfAware=true',
      `selfName=${selfProfile.name}`,
      `selfPurpose=${selfProfile.purpose}`,
      `selfCapabilities=${selfProfile.capabilities.join('; ')}`,
      `selfCategoryCoverage=${selfProfile.supportedCategories.join(',')}`,
      `selfLoadedAt=${selfProfile.loadedAt}`,
    );
  } else {
    preambleLines.push('selfAware=false');
  }

  if (routing?.diagnostics) {
    const d = routing.diagnostics;
    preambleLines.push(
      `routingConfidence=${d.confidence}`,
      `routingNodeCount=${d.routedNodeCount}`,
      `routingCategories=${(d.uniqueCategories || []).join(',')}`,
      `routingTopIntents=${(d.topIntents || []).join(',')}`,
      `taxonomyVersion=${d.taxonomyVersion}`,
      `taxonomyCategoryCount=${d.taxonomyCategories}`,
    );
  }

  preambleLines.push(
    'Task: Use structure routing context as relevance hints, avoid claiming file reads not present in the context, and explicitly ground assumptions.',
    '=== END MAJIXAI SELF-AWARE DIRECTIVE ===',
    '',
    `User prompt: ${prompt}`,
  );

  return preambleLines.join('\n');
}

// ── Prompt enrichment ─────────────────────────────────────────────────────────

async function buildEnrichedPrompt(prompt) {
  await packetRouter.ready();

  const maxNodes = toInt(routingBudgetSelect?.value, 12);
  const structureEnabled = !!structureScanToggle?.checked;

  const routing = packetRouter.routeWithStructure(prompt, {
    maxNodes,
    maxStructureMatches: structureEnabled ? maxNodes * 2 : maxNodes,
    includeStructureDetails: structureEnabled,
    includeDiagnostics: true,
  });

  appState.lastRouting = routing;
  showRoutingPipeline(routing.nodes.slice(0, MAX_STRUCTURE_PREVIEW));
  showRoutingDiagnostics(routing);
  showExplainability(routing);
  updateSelfAwareStatus(routing);

  const selfAwarePreamble = buildSelfAwarePreamble(prompt, routing);
  const contextHeader = safe(routing.contextHeader);

  return {
    routing,
    enrichedPrompt: `${selfAwarePreamble}\n\n${contextHeader}`,
  };
}

// ── Model request ─────────────────────────────────────────────────────────────

async function requestModelResponse(apiKey, enrichedPrompt) {
  const genAI = new GoogleGenAI({ apiKey });
  const chat = genAI.startChat({
    model: getModelName(),
    history: getChatHistoryForModel(),
  });

  const result = await chat.sendMessage(enrichedPrompt);
  return result.response.text();
}

// ── Send handler ──────────────────────────────────────────────────────────────

async function handleSend() {
  const prompt = safe(promptInput?.value).trim();
  if (!prompt) return;

  appendText(prompt, 'user');
  promptInput.value = '';
  updateCharCounter();

  if (await handleLocalCommand(prompt)) {
    scrollBottom();
    return;
  }

  const apiKey = safe(apiKeyInput?.value).trim();
  if (!apiKey) {
    appendText('⚠️ Please enter your Gemini API key (or use /help for local commands).', 'error');
    return;
  }

  sendBtn.disabled = true;
  const thinkingEl = appendText('Thinking with structure-aware routing…', 'thinking');

  try {
    const { enrichedPrompt, routing } = await buildEnrichedPrompt(prompt);

    rememberTurn('user', prompt);

    const responseText = await requestModelResponse(apiKey, enrichedPrompt);

    const responseEl = createMessageElement(responseText, 'model');
    chatContainer.replaceChild(responseEl, thinkingEl);
    rememberTurn('model', responseText);

    updateSelfAwareStatus(routing);
    scrollBottom();
  } catch (err) {
    const errEl = createMessageElement('Error: ' + (err?.message || String(err)), 'error');
    chatContainer.replaceChild(errEl, thinkingEl);
    console.error('AI request failed:', err);
  } finally {
    sendBtn.disabled = false;
    promptInput.focus();
  }
}

// ── Character counter ─────────────────────────────────────────────────────────

function updateCharCounter() {
  if (!charCounter || !promptInput) return;
  const len = promptInput.value.length;
  charCounter.textContent = len.toLocaleString();
  charCounter.classList.toggle('warn', len >= CHAR_WARN_THRESHOLD);
}

// ── Clear chat ────────────────────────────────────────────────────────────────

function clearChat() {
  chatContainer.innerHTML = '';
  const hint = document.createElement('p');
  hint.className = 'chat-empty-hint w3-text-grey w3-center';
  hint.style.margin = '36px 0';
  hint.innerHTML = '<i class="fa fa-comments fa-2x"></i><br>Ask anything — responses use self-aware mode + structure routing.';
  chatContainer.appendChild(hint);
  appState.turns = [];
}

// ── Routing panel collapse ────────────────────────────────────────────────────

function toggleRoutingDetails() {
  if (!routingCardDetails || !routingChevron) return;
  const isOpen = routingCardDetails.style.display !== 'none';
  routingCardDetails.style.display = isOpen ? 'none' : '';
  routingChevron.classList.toggle('open', !isOpen);
  if (routingCardToggle) {
    routingCardToggle.setAttribute('aria-expanded', String(!isOpen));
  }
}

// ── Wire UI ───────────────────────────────────────────────────────────────────

function wireUI() {
  sendBtn.addEventListener('click', handleSend);

  promptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSend();
    }
  });

  promptInput.addEventListener('input', updateCharCounter);

  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', clearChat);
  }

  if (routingCardToggle) {
    routingCardToggle.addEventListener('click', toggleRoutingDetails);
    routingCardToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleRoutingDetails();
      }
    });
  }

  [selfAwareToggle, structureScanToggle, memoryToggle, responseProfileSelect, routingBudgetSelect, modelSelect]
    .filter(Boolean)
    .forEach((el) => {
      el.addEventListener('change', () => updateSelfAwareStatus(appState.lastRouting));
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initialize() {
  await packetRouter.ready();
  updateSelfAwareStatus({ diagnostics: packetRouter.route('', 1).diagnostics });
  appendText('Type /help to view local self-aware commands.', 'thinking');
  updateCharCounter();
  wireUI();
}

initialize();
