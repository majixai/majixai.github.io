/**
 * app.js — Main orchestrator for the Neural Tensor Adam Network.
 * Connects: MarketSimulator → MarketSignalNetwork → MLClient agents → UI
 *
 * Import map in index.html maps '@google/genai' to esm.sh CDN.
 */

import { MarketSimulator, ASSETS } from './market.js';
import { MarketSignalNetwork } from './network.js';
import { MessageBus, MLClient, AGENT_CONFIGS } from './agents.js';

// ─── State ────────────────────────────────────────────────────────────────────
let apiKey = '';
let running = false;
let market = null;
let network = null;
let bus = null;
let agents = [];
let autoReplyInterval = null;
const AUTO_REPLY_MS = 18000; // agents self-prompt every ~18 s when idle

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const chatFeed      = document.getElementById('chat-feed');
const apiKeyInput   = document.getElementById('api-key-input');
const btnStart      = document.getElementById('btn-start');
const btnStop       = document.getElementById('btn-stop');
const btnClear      = document.getElementById('btn-clear');
const btnSend       = document.getElementById('btn-send');
const userInput     = document.getElementById('user-input');
const targetSelect  = document.getElementById('target-select');
const statusBadge   = document.getElementById('status-badge');
const pulseDot      = document.getElementById('pulse-dot');

// Sidebar refs
const netSteps      = document.getElementById('net-steps');
const netLoss       = document.getElementById('net-loss');
const netAdamStep   = document.getElementById('net-adam-step');
const netLr         = document.getElementById('net-lr');
const lossCanvas    = document.getElementById('loss-canvas');
const layerViz      = document.getElementById('layer-viz');
const agentCardsEl  = document.getElementById('agent-cards');
const tickerBar     = document.getElementById('ticker-bar');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(p) {
  if (p >= 1000) return '$' + p.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (p >= 10)   return '$' + p.toFixed(2);
  return '$' + p.toFixed(4);
}

function timeStr() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function appendSysMsg(text) {
  const el = document.createElement('div');
  el.className = 'sys-msg';
  el.textContent = text;
  chatFeed.appendChild(el);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function appendAgentMessage(agentId, text, step) {
  const cfg = AGENT_CONFIGS.find(a => a.id === agentId) || { name: agentId, emoji: '🤖', color: '#888' };

  const wrapper = document.createElement('div');
  wrapper.className = 'msg';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.style.borderColor = cfg.color;
  avatar.textContent = cfg.emoji;

  const body = document.createElement('div');
  body.className = 'msg-body';

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerHTML = `<span class="msg-name" style="color:${cfg.color}">${cfg.name}</span>
    <span class="msg-time">${timeStr()}</span>
    ${step !== undefined ? `<span class="msg-step">step:${step}</span>` : ''}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  body.appendChild(meta);
  body.appendChild(bubble);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  chatFeed.appendChild(wrapper);
  chatFeed.scrollTop = chatFeed.scrollHeight;

  // Update agent card
  updateAgentCard(agentId, text, step);
  return wrapper;
}

function appendUserMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg user-msg';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.style.borderColor = '#00b8d4';
  avatar.textContent = '🧑';

  const body = document.createElement('div');
  body.className = 'msg-body';

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerHTML = `<span class="msg-name" style="color:#00b8d4">You</span><span class="msg-time">${timeStr()}</span>`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  body.appendChild(meta);
  body.appendChild(bubble);
  wrapper.appendChild(avatar);
  wrapper.appendChild(body);
  chatFeed.appendChild(wrapper);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

// ─── Ticker bar ───────────────────────────────────────────────────────────────

function updateTickerBar(snapshot, signals) {
  tickerBar.innerHTML = '';
  snapshot.forEach((asset, i) => {
    const sig = signals && signals[i];
    const up = parseFloat(asset.pct24h) >= 0;
    const item = document.createElement('div');
    item.className = 'ticker-item';

    let sigClass = 'sig-neutral';
    let sigText = '⚪';
    if (sig) {
      if (sig.signal.includes('STRONG')) { sigClass = 'sig-strong'; sigText = sig.signal; }
      else if (sig.signal.includes('BUY')) { sigClass = 'sig-buy'; sigText = sig.signal; }
      else if (sig.signal.includes('AVOID')) { sigClass = 'sig-avoid'; sigText = sig.signal; }
      else sigText = sig.signal;
    }

    item.innerHTML = `
      <span class="t-id">${asset.id}</span>
      <span class="t-price ${up ? 't-up' : 't-down'}">${formatPrice(asset.close)}</span>
      <span class="t-pct ${up ? 't-up' : 't-down'}">${up ? '▲' : '▼'} ${Math.abs(asset.pct24h)}%</span>
      <span class="t-sig ${sigClass}">${sigText}</span>
    `;
    tickerBar.appendChild(item);
  });
}

// ─── Sidebar: Network Monitor ─────────────────────────────────────────────────

function drawLossChart(lossHistory) {
  const ctx = lossCanvas.getContext('2d');
  const w = lossCanvas.offsetWidth || 240;
  const h = lossCanvas.offsetHeight || 70;
  lossCanvas.width = w;
  lossCanvas.height = h;
  ctx.clearRect(0, 0, w, h);

  if (!lossHistory || lossHistory.length < 2) return;

  const max = Math.max(...lossHistory) || 1;
  const min = Math.min(...lossHistory);
  const range = max - min || 1;

  ctx.beginPath();
  ctx.strokeStyle = '#00b8d4';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';

  lossHistory.forEach((v, i) => {
    const x = (i / (lossHistory.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill under curve
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.fillStyle = 'rgba(0,184,212,0.08)';
  ctx.fill();
}

function updateNetworkPanel(summary, lossHistory) {
  if (netSteps)    netSteps.textContent    = summary.steps;
  if (netLoss)     netLoss.textContent     = summary.avgLoss;
  if (netAdamStep) netAdamStep.textContent = summary.adamStep;
  if (netLr)       netLr.textContent       = summary.adamLr;

  if (layerViz && summary.layerShapes) {
    layerViz.innerHTML = summary.layerShapes
      .map((s, i) => `<span class="layer-node">${s}</span>${i < summary.layerShapes.length - 1 ? '<span class="layer-arrow">→</span>' : ''}`)
      .join('');
  }

  if (lossCanvas) drawLossChart(lossHistory);
}

// ─── Sidebar: Agent Cards ─────────────────────────────────────────────────────

function initAgentCards() {
  agentCardsEl.innerHTML = '';
  AGENT_CONFIGS.forEach(cfg => {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.id = `agent-card-${cfg.id}`;
    card.innerHTML = `
      <div class="agent-card-header">
        <div class="agent-dot" style="background:${cfg.color}"></div>
        <span class="agent-card-name" style="color:${cfg.color}">${cfg.emoji} ${cfg.name}</span>
        <span class="agent-msg-count" id="count-${cfg.id}">0 msgs</span>
      </div>
      <div class="agent-status" id="status-${cfg.id}">idle</div>
    `;
    agentCardsEl.appendChild(card);
  });
}

function updateAgentCard(agentId, lastText, step) {
  const countEl = document.getElementById(`count-${agentId}`);
  const statusEl = document.getElementById(`status-${agentId}`);
  if (countEl && step !== undefined) countEl.textContent = `${step + 1} msgs`;
  if (statusEl) {
    statusEl.textContent = lastText.slice(0, 55) + (lastText.length > 55 ? '…' : '');
    statusEl.className = 'agent-status';
  }
}

function setAgentThinking(agentId, thinking) {
  const statusEl = document.getElementById(`status-${agentId}`);
  if (statusEl) {
    statusEl.className = thinking ? 'agent-status thinking' : 'agent-status';
    if (thinking) statusEl.textContent = '⏳ thinking…';
  }
}

// ─── Core: Start / Stop ───────────────────────────────────────────────────────

async function startNetwork() {
  apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    appendSysMsg('⚠ Please enter your Gemini API key first.');
    return;
  }

  running = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  btnSend.disabled = false;
  statusBadge.textContent = 'Running';
  statusBadge.className = 'status-badge running';
  pulseDot.style.display = 'block';

  // Init components
  bus = new MessageBus();
  network = new MarketSignalNetwork(12, 32, 6);
  market = new MarketSimulator();

  // Init agents
  agents = AGENT_CONFIGS.map(cfg => new MLClient(cfg, bus, apiKey));
  await Promise.all(agents.map(a => a.init()));

  // Wire up agent response → UI
  agents.forEach(agent => {
    agent.addEventListener('response', (e) => {
      const { agentId, text, step } = e.detail;
      appendAgentMessage(agentId, text, step);
    });
    agent.addEventListener('error', (e) => {
      appendSysMsg(`⚠ ${e.detail.agentId}: ${e.detail.error}`);
    });
  });

  appendSysMsg('🧠 Neural Tensor Adam Network initializing…');

  // Market tick handler: train network + update agents + trigger kickstart
  let firstTick = true;
  market.addEventListener('tick', (e) => {
    if (!running) return;
    const snapshot = e.detail;
    const allFeatures = snapshot.flatMap(a => a.features);
    const inputVec = allFeatures.slice(0, network.inputSize); // use network.inputSize to avoid hardcoding
    const targetVec = market.buildTargetVector();

    const { loss, output } = network.train(inputVec, targetVec);
    const summary = network.summary();
    const signals = MarketSignalNetwork.interpretOutput(output, ASSETS.map(a => a.id));
    summary.signals = signals;

    // Push state to all agents
    agents.forEach(a => {
      a.updateNetworkState(summary);
      a.updateMarketSnapshot(snapshot);
    });

    updateTickerBar(snapshot, signals);
    updateNetworkPanel(summary, network.lossHistory);

    if (firstTick) {
      firstTick = false;
      // Staggered kickstart
      agents.forEach((agent, i) => {
        setTimeout(() => {
          setAgentThinking(agent.id, true);
          agent.kickstart(
            'Introduce yourself and give your initial bull market read on the current neural network signals and live market data. Start the conversation with the group.'
          ).then(() => setAgentThinking(agent.id, false));
        }, i * 3500);
      });
      appendSysMsg('📡 Market data streaming. Agents initializing…');
    }
  });

  // Listen for bus messages to show thinking state
  bus.addEventListener('message', (e) => {
    const { from } = e.detail;
    const agent = agents.find(a => a.id === from);
    if (agent) setAgentThinking(from, false);
  });

  market.start(5000);

  // Auto-reply loop: prompt TrendSynth every N seconds to keep conversation alive
  let autoRound = 0;
  autoReplyInterval = setInterval(async () => {
    if (!running || agents.length === 0) return;
    autoRound++;
    const cycleAgent = agents[autoRound % agents.length];
    setAgentThinking(cycleAgent.id, true);

    const summaryMsg = bus.getRecent(6).map(m => `[${m.from}]: ${m.content}`).join('\n');
    bus.post('system', null,
      `Round ${autoRound}: Update your analysis given the latest data and agent discussion.`,
      { type: 'auto-prompt', round: autoRound }
    );
  }, AUTO_REPLY_MS);

  appendSysMsg('✅ Network running. Agents will begin analysis shortly.');
  initAgentCards();
}

function stopNetwork() {
  running = false;
  if (market) market.stop();
  if (autoReplyInterval) { clearInterval(autoReplyInterval); autoReplyInterval = null; }

  btnStart.disabled = false;
  btnStop.disabled = true;
  btnSend.disabled = true;
  statusBadge.textContent = 'Stopped';
  statusBadge.className = 'status-badge stopped';
  pulseDot.style.display = 'none';

  appendSysMsg('🛑 Network stopped.');
}

function clearChat() {
  chatFeed.innerHTML = '';
  appendSysMsg('Chat cleared.');
}

// ─── User input → broadcast to target agent ───────────────────────────────────

async function sendUserMessage() {
  const text = userInput.value.trim();
  if (!text || !running) return;
  userInput.value = '';
  appendUserMessage(text);

  const target = targetSelect.value;
  bus.post('user', target === 'broadcast' ? null : target, text, { type: 'user' });
}

// ─── Event bindings ───────────────────────────────────────────────────────────

btnStart.addEventListener('click', startNetwork);
btnStop.addEventListener('click', stopNetwork);
btnClear.addEventListener('click', clearChat);
btnSend.addEventListener('click', sendUserMessage);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMessage(); }
});

// Do not persist the API key in storage to avoid clear-text storage of sensitive data

// ─── Init UI ──────────────────────────────────────────────────────────────────

initAgentCards();
appendSysMsg('🔑 Enter your Gemini API key and click Start to launch the neural network.');
