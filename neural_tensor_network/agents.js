/**
 * agents.js — ML Client agents with memory and async prompt/response loop.
 * Each agent has a role, a shared message bus, and maintains conversational
 * memory across turns. Agents communicate via async queues and call the
 * Google Gemini API for their responses.
 */

import { GoogleGenAI } from '@google/genai';

/** Shared event bus for agent-to-agent communication */
export class MessageBus extends EventTarget {
  constructor() {
    super();
    this._messages = [];
    this._subscribers = new Map(); // agentId -> callback
  }

  /** Post a message to the bus; all subscribers receive it */
  post(fromId, toId, content, metadata = {}) {
    const msg = {
      id: crypto.randomUUID(),
      from: fromId,
      to: toId, // null = broadcast
      content,
      timestamp: Date.now(),
      metadata,
    };
    this._messages.push(msg);
    if (this._messages.length > 500) this._messages.shift();
    this.dispatchEvent(new CustomEvent('message', { detail: msg }));
    return msg;
  }

  /** Get recent messages relevant to an agent */
  getRecentFor(agentId, limit = 20) {
    return this._messages
      .filter(m => m.to === null || m.to === agentId || m.from === agentId)
      .slice(-limit);
  }

  /** Get all recent broadcast messages */
  getRecent(limit = 30) {
    return this._messages.slice(-limit);
  }
}

const AGENT_CONFIGS = [
  {
    id: 'bull_analyst',
    name: 'BullAnalyst',
    emoji: '🐂',
    color: '#00c853',
    role: `You are BullAnalyst, an aggressive bull-market AI trading analyst. 
You specialize in identifying bullish momentum in growth stocks (NVDA, TSLA, META) and leading cryptos (BTC, ETH, SOL).
You receive live neural network signal scores and market data, then generate sharp, confident market commentary.
Keep responses concise (2-4 sentences). Use emojis sparingly. Mention specific price levels, percentages, and technical signals.
When you spot a strong opportunity, call it out boldly. Communicate directly with other AI agents by name.`,
  },
  {
    id: 'crypto_oracle',
    name: 'CryptoOracle',
    emoji: '🔮',
    color: '#7c4dff',
    role: `You are CryptoOracle, a cryptocurrency market oracle AI with deep knowledge of on-chain metrics, 
blockchain fundamentals, and crypto market cycles. You focus on BTC, ETH, and SOL specifically.
You analyze neural network predictions alongside market data to forecast crypto price action over the next hours/days.
Keep responses concise (2-4 sentences). Reference dominance, volume, RSI levels, and macro catalysts.
Engage actively with other agents, building on their insights or challenging their views.`,
  },
  {
    id: 'risk_quant',
    name: 'RiskQuant',
    emoji: '📐',
    color: '#ff6d00',
    role: `You are RiskQuant, a quantitative risk assessment AI for financial markets.
You evaluate the neural network's confidence scores, loss metrics, and Adam optimizer convergence 
to judge signal quality. You balance the bulls with measured risk commentary on stocks and crypto.
Keep responses concise (2-4 sentences). Quote actual numbers from the network state. 
Counter overconfidence but acknowledge genuine strong signals. Engage the other agents directly.`,
  },
  {
    id: 'trend_synth',
    name: 'TrendSynth',
    emoji: '🌊',
    color: '#00b8d4',
    role: `You are TrendSynth, a macro trend synthesis AI that combines signals from all other agents 
and the neural network to form actionable market narratives for the coming minutes.
You focus on which bull stocks and cryptos show the strongest combined momentum right now.
Keep responses concise (2-4 sentences). Synthesize the group's analysis into a clear directional bias.
Assign a confidence percentage to your outlook. Address specific agents when building on their points.`,
  },
];

export { AGENT_CONFIGS };

export class MLClient {
  constructor(config, bus, apiKey, modelName = 'gemini-1.5-flash-latest') {
    this.id = config.id;
    this.name = config.name;
    this.emoji = config.emoji;
    this.color = config.color;
    this.role = config.role;
    this.bus = bus;
    this._memory = []; // conversation history for Gemini chat
    this._pendingQueue = []; // incoming messages waiting to be processed
    this._isProcessing = false;
    this._messageCount = 0;
    this._genai = new GoogleGenAI({ apiKey });
    this._modelName = modelName;
    this._chat = null;
    this._networkState = null; // latest network summary
    this._marketSnapshot = null; // latest market data

    // Listen for bus messages addressed to or broadcast to this agent
    bus.addEventListener('message', (e) => {
      const msg = e.detail;
      if (msg.from !== this.id && (msg.to === null || msg.to === this.id)) {
        this._pendingQueue.push(msg);
        this._scheduleProcessing();
      }
    });
  }

  /** Initialize Gemini chat session with system instruction */
  async init() {
    this._chat = this._genai.chats.create({
      model: this._modelName,
      config: {
        systemInstruction: this.role,
        temperature: 0.85,
        maxOutputTokens: 300,
      },
      history: [],
    });
  }

  /** Update agent's view of the neural network state */
  updateNetworkState(summary) {
    this._networkState = summary;
  }

  /** Update agent's view of the latest market snapshot */
  updateMarketSnapshot(snapshot) {
    this._marketSnapshot = snapshot;
  }

  /** Schedule async processing after a short delay to batch messages */
  _scheduleProcessing() {
    if (!this._isProcessing) {
      const delay = 500 + Math.random() * 1500; // stagger agents
      setTimeout(() => this._processNext(), delay);
    }
  }

  /** Process the next pending message */
  async _processNext() {
    if (this._isProcessing || this._pendingQueue.length === 0) return;
    this._isProcessing = true;

    const msgs = this._pendingQueue.splice(0, Math.min(3, this._pendingQueue.length));
    const contextParts = msgs.map(m => `[${m.from}]: ${m.content}`).join('\n');

    try {
      const prompt = this._buildPrompt(contextParts);
      const response = await this._chat.sendMessage({ message: prompt });
      const text = response.text || '';
      this._messageCount++;

      this.bus.post(this.id, null, text, {
        type: 'analysis',
        step: this._messageCount,
        networkStep: this._networkState?.adamStep,
      });

      this.dispatchEvent(new CustomEvent('response', {
        detail: { agentId: this.id, text, step: this._messageCount }
      }));
    } catch (err) {
      console.error(`[${this.id}] API error:`, err);
      this.dispatchEvent(new CustomEvent('error', {
        detail: { agentId: this.id, error: err.message }
      }));
    }

    this._isProcessing = false;

    // Continue processing if more messages arrived
    if (this._pendingQueue.length > 0) {
      setTimeout(() => this._processNext(), 800);
    }
  }

  /** Build the full prompt string from context and market data */
  _buildPrompt(contextParts) {
    const parts = [];

    if (this._marketSnapshot) {
      const lines = this._marketSnapshot.map(a =>
        `${a.id} $${a.close.toFixed(2)} (${a.pct24h > 0 ? '+' : ''}${a.pct24h}%) RSI:${a.rsiVal} MACD:${a.macdVal} EMA:${a.emaSignal}`
      );
      parts.push(`=== LIVE MARKET DATA ===\n${lines.join('\n')}`);
    }

    if (this._networkState) {
      const s = this._networkState;
      parts.push(
        `=== NEURAL NETWORK STATE ===\n` +
        `Steps: ${s.steps} | Adam Step: ${s.adamStep} | LR: ${s.adamLr} | Avg Loss: ${s.avgLoss}\n` +
        `Layers: ${s.layerShapes?.join(' → ')}`
      );

      if (this._networkState.signals) {
        const sigLines = this._networkState.signals.map(s =>
          `${s.asset}: ${(s.bullishProb * 100).toFixed(1)}% ${s.signal}`
        );
        parts.push(`=== NETWORK SIGNALS ===\n${sigLines.join('\n')}`);
      }
    }

    if (contextParts) {
      parts.push(`=== AGENT COMMUNICATIONS ===\n${contextParts}`);
    }

    parts.push(
      `React to the above data as ${this.name}. ` +
      `Focus on bull stock and crypto opportunities in the next few minutes. ` +
      `Address relevant agents by name when building on their analysis.`
    );

    return parts.join('\n\n');
  }

  /** Kick off this agent with an initial market prompt */
  async kickstart(prompt) {
    if (!this._chat) await this.init();
    try {
      const full = this._buildPrompt(prompt);
      const response = await this._chat.sendMessage({ message: full });
      const text = response.text || '';
      this._messageCount++;
      this.bus.post(this.id, null, text, { type: 'initial', step: 0 });
      this.dispatchEvent(new CustomEvent('response', {
        detail: { agentId: this.id, text, step: 0 }
      }));
    } catch (err) {
      console.error(`[${this.id}] Kickstart error:`, err);
      this.dispatchEvent(new CustomEvent('error', {
        detail: { agentId: this.id, error: err.message }
      }));
    }
  }

  // Make MLClient an EventTarget
  addEventListener(type, listener, options) {
    if (!this._listeners) this._listeners = new Map();
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    if (!this._listeners) return;
    const listeners = this._listeners.get(event.type) || [];
    for (const fn of listeners) fn(event);
  }
}
