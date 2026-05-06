/**
 * ai/script.js
 * Handles prompt submission, AI response, and markdown rendering.
 * Uses Google GenAI (Gemini) via ESM import map – same SDK as chat/.
 */

import { GoogleGenAI } from '@google/genai';
import * as marked from 'marked';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MODEL_NAME = 'gemini-1.5-flash-latest';

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const chatContainer = document.getElementById('chat-container');
const promptInput   = document.getElementById('prompt-input');
const sendBtn       = document.getElementById('send-btn');
const apiKeyInput   = document.getElementById('api-key-input');

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

  // Thinking indicator
  const thinkingEl = appendHtml('<em>Thinking…</em>', 'thinking');

  try {
    const ai   = new GoogleGenAI({ apiKey });
    // A new chat session is created per send – this is intentional for single-turn
    // prompt solving where no conversation history needs to be preserved.
    const chat = ai.startChat({ model: MODEL_NAME, history: [] });

    const result       = await chat.sendMessage(prompt);
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
