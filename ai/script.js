/**
 * ai/script.js
 * Handles prompt submission, streaming AI response, and markdown rendering.
 * Uses Google GenAI (Gemini) via ESM import map.
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

function appendMessage(html, role) {
  const div = document.createElement('div');
  div.className = role + '-message w3-margin-bottom';
  div.innerHTML = html;
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
    appendMessage('⚠️ Please enter your Gemini API key.', 'error');
    return;
  }
  if (!prompt) return;

  // Show user message
  appendMessage(await renderMarkdown(prompt), 'user');
  promptInput.value = '';
  sendBtn.disabled = true;

  // Thinking indicator
  const thinkingEl = appendMessage('<em>Thinking…</em>', 'thinking');

  try {
    const ai   = new GoogleGenAI({ apiKey });
    const chat = ai.startChat({ model: MODEL_NAME, history: [] });

    // Use streaming so we can update the bubble incrementally
    const stream = await chat.sendMessageStream(prompt);

    let fullText = '';
    const responseEl = document.createElement('div');
    responseEl.className = 'model-message w3-margin-bottom';
    chatContainer.replaceChild(responseEl, thinkingEl);

    for await (const chunk of stream) {
      fullText += chunk.text();
      responseEl.innerHTML = await renderMarkdown(fullText);
      scrollBottom();
    }

  } catch (err) {
    chatContainer.replaceChild(
      (() => {
        const e = document.createElement('div');
        e.className = 'error-message w3-margin-bottom';
        e.textContent = 'Error: ' + (err.message || String(err));
        return e;
      })(),
      thinkingEl
    );
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
