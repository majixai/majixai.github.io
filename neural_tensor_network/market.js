/**
 * market.js — Real-time market data simulator for stocks and crypto.
 * Generates OHLCV data, computes technical indicators, and emits
 * MarketTick events that feed the neural network.
 */

export const ASSETS = [
  { id: 'NVDA',  name: 'NVIDIA',        type: 'stock',  basePrice: 875.0 },
  { id: 'TSLA',  name: 'Tesla',         type: 'stock',  basePrice: 248.0 },
  { id: 'META',  name: 'Meta',          type: 'stock',  basePrice: 510.0 },
  { id: 'BTC',   name: 'Bitcoin',       type: 'crypto', basePrice: 68500 },
  { id: 'ETH',   name: 'Ethereum',      type: 'crypto', basePrice: 3400  },
  { id: 'SOL',   name: 'Solana',        type: 'crypto', basePrice: 175.0 },
];

/** Simple Exponential Moving Average */
function ema(prices, period) {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = prices[0];
  for (let i = 1; i < prices.length; i++) e = prices[i] * k + e * (1 - k);
  return e;
}

/** RSI from close prices */
function rsi(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}

/** MACD signal: ema12 - ema26 */
function macd(prices) {
  if (prices.length < 26) return 0;
  return ema(prices.slice(-12), 12) - ema(prices.slice(-26), 26);
}

/** Momentum: (price_now - price_n_ago) / price_n_ago */
function momentum(prices, n = 10) {
  if (prices.length < n + 1) return 0;
  const prev = prices[prices.length - n - 1];
  if (!prev) return 0;
  return (prices[prices.length - 1] - prev) / prev;
}

/** Bollinger band position: (price - lower) / (upper - lower) [0,1] */
function bollingerPos(prices, period = 20) {
  if (prices.length < period) return 0.5;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period) || 1e-8;
  const upper = mean + 2 * std;
  const lower = mean - 2 * std;
  return Math.min(1, Math.max(0, (prices[prices.length - 1] - lower) / (upper - lower)));
}

export class MarketSimulator extends EventTarget {
  constructor() {
    super();
    this._prices = {}; // id -> [close prices]
    this._volumes = {}; // id -> [volumes]
    this._trendBias = {}; // id -> slight drift bias
    this._tickInterval = null;

    for (const asset of ASSETS) {
      this._prices[asset.id] = [asset.basePrice];
      this._volumes[asset.id] = [1e6 * (0.5 + Math.random())];
      // Slight bullish bias (offset 0.4 skews range toward positive drift)
      // so more assets start in a mild uptrend, matching typical bull-market conditions.
      this._trendBias[asset.id] = (Math.random() - 0.4) * 0.002;
    }
  }

  /** Generate next OHLCV tick for an asset */
  _nextTick(asset) {
    const prices = this._prices[asset.id];
    const last = prices[prices.length - 1];
    const volatility = asset.type === 'crypto' ? 0.018 : 0.009;
    const bias = this._trendBias[asset.id];

    // Random walk with drift
    const change = (Math.random() - 0.5) * 2 * volatility + bias;
    const close = Math.max(last * (1 + change), 0.01);

    const high = close * (1 + Math.random() * volatility * 0.5);
    const low = close * (1 - Math.random() * volatility * 0.5);
    const open = last;
    const volume = this._volumes[asset.id].slice(-1)[0] * (0.8 + Math.random() * 0.4);

    prices.push(close);
    this._volumes[asset.id].push(volume);
    if (prices.length > 200) { prices.shift(); this._volumes[asset.id].shift(); }

    // Slowly shift bias (mean-reverting trend changes)
    this._trendBias[asset.id] += (Math.random() - 0.5) * 0.0005;
    this._trendBias[asset.id] = Math.max(-0.003, Math.min(0.003, this._trendBias[asset.id]));

    const pct24h = prices.length > 1
      ? ((close - prices[Math.max(0, prices.length - 24)]) / prices[Math.max(0, prices.length - 24)] * 100)
      : 0;

    return { open, high, low, close, volume, pct24h: pct24h.toFixed(2) };
  }

  /** Build a feature vector [length=12] for the neural net */
  buildFeatureVector(assetId) {
    const prices = this._prices[assetId];
    const volumes = this._volumes[assetId];
    const last = prices[prices.length - 1];
    const basePrice = ASSETS.find(a => a.id === assetId)?.basePrice || 1;

    return [
      last / basePrice - 1,                          // normalized price deviation
      rsi(prices) / 100,                              // RSI [0,1]
      macd(prices) / (last || 1),                     // MACD normalized
      momentum(prices, 5),                            // 5-bar momentum
      momentum(prices, 10),                           // 10-bar momentum
      bollingerPos(prices),                           // Bollinger position
      ema(prices.slice(-5), 5) / (last || 1) - 1,    // EMA5 vs current
      ema(prices.slice(-20), 20) / (last || 1) - 1,  // EMA20 vs current
      Math.log(volumes[volumes.length - 1] / 1e6 + 1) / 10, // log volume
      this._trendBias[assetId] * 100,                 // trend bias signal
      prices.length > 2 ? (prices[prices.length-1] - prices[prices.length-2]) / prices[prices.length-2] : 0, // 1-bar return
      prices.length > 5 ? (Math.max(...prices.slice(-5)) - Math.min(...prices.slice(-5))) / (last || 1) : 0,  // 5-bar range
    ];
  }

  /** Compute "target" bullish signal from recent price action (for supervised training) */
  buildTargetVector() {
    return ASSETS.map(asset => {
      const prices = this._prices[asset.id];
      if (prices.length < 2) return 0.5;
      const recent = prices.slice(-10);
      const slope = (recent[recent.length - 1] - recent[0]) / (recent[0] || 1);
      // Sigmoid-like mapping of slope to [0,1]
      return 1 / (1 + Math.exp(-slope * 100));
    });
  }

  /** Get current snapshot for all assets */
  getSnapshot() {
    return ASSETS.map(asset => {
      const tick = this._nextTick(asset);
      const features = this.buildFeatureVector(asset.id);
      return {
        ...asset,
        ...tick,
        features,
        rsiVal: (rsi(this._prices[asset.id]) || 50).toFixed(1),
        macdVal: macd(this._prices[asset.id]).toFixed(2),
        emaSignal: this.buildFeatureVector(asset.id)[6] > 0 ? 'above' : 'below',
      };
    });
  }

  start(intervalMs = 4000) {
    if (this._tickInterval) return;
    this._tickInterval = setInterval(() => {
      const snapshot = this.getSnapshot();
      this.dispatchEvent(new CustomEvent('tick', { detail: snapshot }));
    }, intervalMs);
    // Emit immediately
    setTimeout(() => {
      const snapshot = this.getSnapshot();
      this.dispatchEvent(new CustomEvent('tick', { detail: snapshot }));
    }, 100);
  }

  stop() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }
}
