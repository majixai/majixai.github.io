/**
 * ai/script.js
 * Handles prompt submission, AI response, and markdown rendering.
 * Uses Google GenAI (Gemini) via ESM import map – same SDK as chat/.
 *
 * All root directories participate in each request via PacketRouter:
 * the router scores every registered dir against the prompt and injects
 * relevant directory context into the AI request, increasing throughput
 * of data packets through the full directory graph.
 */

import { GoogleGenAI } from '@google/genai';
import * as marked from 'marked';
import { PacketRouter } from './packet-router.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MODEL_NAME = 'gemini-1.5-flash-latest';

// Initialise the packet router (loads routes.json in background)
const packetRouter = new PacketRouter();

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const chatContainer   = document.getElementById('chat-container');
const promptInput     = document.getElementById('prompt-input');
const sendBtn         = document.getElementById('send-btn');
const apiKeyInput     = document.getElementById('api-key-input');
const routingDisplay  = document.getElementById('routing-display');

function scrollBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/** Append a bubble whose content is safe HTML (AI / system messages). */
function appendHtml(html, role) {
  const div = document.createElement('div');
  div.className = role + '-message w3-margin-bottom';
  div.innerHTML = html;
  chatContainer.appendChild(div);
  scrollBottom();
  return div;
}

/** Append a bubble whose content is plain text (user messages – avoids XSS). */
function appendText(text, role) {
  const div = document.createElement('div');
  div.className = role + '-message w3-margin-bottom';
  div.textContent = text;
  chatContainer.appendChild(div);
  scrollBottom();
  return div;
}

/** Show which directories were routed for this packet. */
function showRoutingPipeline(nodes) {
  if (!routingDisplay) return;
  if (nodes.length === 0) {
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
    chip.className = `routing-chip routing-cat-${node.category}`;
    chip.href = `https://majixai.github.io${node.path}`;
    chip.target = '_blank';
    chip.rel = 'noopener';
    chip.textContent = node.name;
    chip.title = node.desc ? node.desc.slice(0, 120) : node.name;
    routingDisplay.appendChild(chip);
    if (i < nodes.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'routing-arrow';
      arrow.textContent = ' → ';
      routingDisplay.appendChild(arrow);
    }
  });
}


async function renderMarkdown(text) {
  try {
    return await marked.parse(text || '');
  } catch (_) {
    return text || '';
  }
}

// ---------------------------------------------------------------------------
// Core AI logic
// ---------------------------------------------------------------------------
async function handleSend() {
  const apiKey = apiKeyInput.value.trim();
  const prompt = promptInput.value.trim();

  if (!apiKey) {
    appendText('⚠️ Please enter your Gemini API key.', 'error');
    return;
  }
  if (!prompt) return;

  // Show user message as plain text (safe – no innerHTML on user input)
  appendText(prompt, 'user');
  promptInput.value = '';
  sendBtn.disabled = true;

  // Route the prompt packet through all root directories
  await packetRouter.ready();
  const { nodes, contextHeader } = packetRouter.route(prompt);
  showRoutingPipeline(nodes);

  // Thinking indicator
  const thinkingEl = appendHtml('<em>Thinking…</em>', 'thinking');

  try {
    const ai   = new GoogleGenAI({ apiKey });
    // A new chat session is created per send – this is intentional for single-turn
    // prompt solving where no conversation history needs to be preserved.
    const chat = ai.startChat({ model: MODEL_NAME, history: [] });

    // Prepend routing context from all matched directories to enrich the answer
    const enrichedPrompt = contextHeader ? `${contextHeader}\n${prompt}` : prompt;

    const result       = await chat.sendMessage(enrichedPrompt);
    const responseText = await result.response.text();

    const responseEl = document.createElement('div');
    responseEl.className = 'model-message w3-margin-bottom';
    responseEl.innerHTML = await renderMarkdown(responseText);
    chatContainer.replaceChild(responseEl, thinkingEl);
    scrollBottom();

  } catch (err) {
    const errEl = document.createElement('div');
    errEl.className = 'error-message w3-margin-bottom';
    errEl.textContent = 'Error: ' + (err.message || String(err));
    chatContainer.replaceChild(errEl, thinkingEl);
    console.error('AI request failed:', err);
  } finally {
    sendBtn.disabled = false;
    promptInput.focus();
  }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
sendBtn.addEventListener('click', handleSend);

promptInput.addEventListener('keydown', (e) => {
  // Ctrl+Enter or Cmd+Enter submits
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    handleSend();
  }
});
