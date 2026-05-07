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
 */

import { GoogleGenAI } from '@google/genai';
import * as marked from 'marked';
import { PacketRouter } from './packet-router.js';

const MODEL_NAME = 'gemini-1.5-flash-latest';
const MAX_DESC_LENGTH = 120;
const MAX_HISTORY_TURNS = 6;
const MAX_STRUCTURE_PREVIEW = 12;

const packetRouter = new PacketRouter();

const chatContainer = document.getElementById('chat-container');
const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const apiKeyInput = document.getElementById('api-key-input');
const routingDisplay = document.getElementById('routing-display');
const routingDiagnostics = document.getElementById('routing-diagnostics');
const selfAwareStatus = document.getElementById('self-aware-status');

const selfAwareToggle = document.getElementById('self-aware-toggle');
const structureScanToggle = document.getElementById('structure-scan-toggle');
const memoryToggle = document.getElementById('memory-toggle');
const responseProfileSelect = document.getElementById('response-profile');
const routingBudgetSelect = document.getElementById('routing-budget');

const appState = {
  turns: [],
  lastRouting: null,
};

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

function scrollBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendHtml(html, role) {
  const div = document.createElement('div');
  div.className = `${role}-message w3-margin-bottom`;
  div.innerHTML = html;
  chatContainer.appendChild(div);
  scrollBottom();
  return div;
}

function appendText(text, role) {
  const div = document.createElement('div');
  div.className = `${role}-message w3-margin-bottom`;
  div.textContent = text;
  chatContainer.appendChild(div);
  scrollBottom();
  return div;
}

async function renderMarkdown(text) {
  try {
    return await marked.parse(text || '');
  } catch (_) {
    return text || '';
  }
}

function updateSelfAwareStatus(routing) {
  if (!selfAwareStatus) return;
  const selfAwareEnabled = !!selfAwareToggle?.checked;
  const structureEnabled = !!structureScanToggle?.checked;
  const memoryEnabled = !!memoryToggle?.checked;

  const routeCount = routing?.diagnostics?.routeCount ?? 0;
  const structureCount = routing?.diagnostics?.structureEntryCount ?? 0;
  const confidence = routing?.diagnostics?.confidence ?? 0;

  selfAwareStatus.innerHTML = '';

  const badges = [
    { label: selfAwareEnabled ? 'Self-aware ON' : 'Self-aware OFF', cls: selfAwareEnabled ? 'status-on' : 'status-off' },
    { label: structureEnabled ? 'Structure scan ON' : 'Structure scan OFF', cls: structureEnabled ? 'status-on' : 'status-off' },
    { label: memoryEnabled ? 'Memory ON' : 'Memory OFF', cls: memoryEnabled ? 'status-on' : 'status-off' },
    { label: `Routes ${routeCount}`, cls: 'status-neutral' },
    { label: `Entries ${structureCount}`, cls: 'status-neutral' },
    { label: `Confidence ${confidence}%`, cls: 'status-neutral' },
  ];

  badges.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = `status-chip ${item.cls}`;
    chip.textContent = item.label;
    selfAwareStatus.appendChild(chip);
  });
}

function showRoutingPipeline(nodes) {
  if (!routingDisplay) return;
  if (!nodes || nodes.length === 0) {
    routingDisplay.style.display = 'none';
    return;
  }

  routingDisplay.style.display = 'block';
  routingDisplay.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'routing-label';
  label.textContent = 'Routing through: ';
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
    routingDiagnostics.style.display = 'none';
    return;
  }

  const d = routing.diagnostics;
  routingDiagnostics.style.display = 'block';
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

  routingDiagnostics.appendChild(row1);
  routingDiagnostics.appendChild(row2);
  routingDiagnostics.appendChild(row3);
}

function responseGuidance(profile) {
  const map = {
    concise: 'Respond in concise format with direct actionable points only.',
    balanced: 'Respond with balanced detail: short explanation + concrete steps.',
    deep: 'Respond with in-depth technical detail, assumptions, and edge-case reasoning.',
    strategist: 'Respond as a systems strategist: include architecture decisions and tradeoffs.',
  };
  return map[profile] ?? map.balanced;
}

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

function localHelpText() {
  return [
    'Local commands:',
    '/help                     show command help',
    '/self                     show router self-profile',
    '/scan <terms>             search current structure metadata',
    '/routes <terms>           alias of /scan',
    '/memory clear             clear local short-term memory',
  ].join('\n');
}

async function handleLocalCommand(rawPrompt) {
  const prompt = safe(rawPrompt).trim();
  if (!prompt.startsWith('/')) return false;

  await packetRouter.ready();

  const [cmd, ...rest] = prompt.split(/\s+/);
  const query = rest.join(' ').trim();

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

    const html = await renderMarkdown(lines.join('\n'));
    appendHtml(html, 'model');
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

    const html = await renderMarkdown(lines.join('\n'));
    appendHtml(html, 'model');
    return true;
  }

  appendText(`Unknown command: ${cmd}. Try /help`, 'error');
  return true;
}

function buildSelfAwarePreamble(prompt, routing) {
  const selfAwareEnabled = !!selfAwareToggle?.checked;
  const profile = safe(responseProfileSelect?.value || 'balanced');

  const preambleLines = [
    '=== MAJIXAI SELF-AWARE DIRECTIVE ===',
    `timestamp=${nowIso()}`,
    `model=${MODEL_NAME}`,
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
  updateSelfAwareStatus(routing);

  const selfAwarePreamble = buildSelfAwarePreamble(prompt, routing);
  const contextHeader = safe(routing.contextHeader);

  return {
    routing,
    enrichedPrompt: `${selfAwarePreamble}\n\n${contextHeader}`,
  };
}

async function requestModelResponse(apiKey, enrichedPrompt) {
  const genAI = new GoogleGenAI({ apiKey });
  const chat = genAI.startChat({
    model: MODEL_NAME,
    history: getChatHistoryForModel(),
  });

  const result = await chat.sendMessage(enrichedPrompt);
  return result.response.text();
}

async function handleSend() {
  const prompt = safe(promptInput?.value).trim();
  if (!prompt) return;

  appendText(prompt, 'user');
  promptInput.value = '';

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
  const thinkingEl = appendHtml('<em>Thinking with structure-aware routing…</em>', 'thinking');

  try {
    const { enrichedPrompt, routing } = await buildEnrichedPrompt(prompt);

    rememberTurn('user', prompt);

    const responseText = await requestModelResponse(apiKey, enrichedPrompt);
    const html = await renderMarkdown(responseText);

    const responseEl = document.createElement('div');
    responseEl.className = 'model-message w3-margin-bottom';
    responseEl.innerHTML = html;

    chatContainer.replaceChild(responseEl, thinkingEl);
    rememberTurn('model', responseText);

    updateSelfAwareStatus(routing);
    scrollBottom();
  } catch (err) {
    const errEl = document.createElement('div');
    errEl.className = 'error-message w3-margin-bottom';
    errEl.textContent = 'Error: ' + (err?.message || String(err));
    chatContainer.replaceChild(errEl, thinkingEl);
    console.error('AI request failed:', err);
  } finally {
    sendBtn.disabled = false;
    promptInput.focus();
  }
}

function wireUI() {
  sendBtn.addEventListener('click', handleSend);

  promptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSend();
    }
  });

  [selfAwareToggle, structureScanToggle, memoryToggle, responseProfileSelect, routingBudgetSelect]
    .filter(Boolean)
    .forEach((el) => {
      el.addEventListener('change', () => updateSelfAwareStatus(appState.lastRouting));
    });
}

async function initialize() {
  await packetRouter.ready();
  updateSelfAwareStatus({ diagnostics: packetRouter.route('', 1).diagnostics });
  appendText('Type /help to view local self-aware commands.', 'thinking');
  wireUI();
}

initialize();
