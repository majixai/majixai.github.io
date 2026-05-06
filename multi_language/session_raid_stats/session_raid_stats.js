/**
 * session_raid_stats.js — JavaScript (ES2020) port of the Session Raid Stats indicator
 * ======================================================================================
 * Tracks up to three intraday sessions, detects range-extension raids, buckets
 * raid sizes, and computes empirical reach-probabilities for each level.
 *
 * Works in Node.js 14+ or any modern browser (no external dependencies).
 *
 * Usage (Node.js):
 *   const { SessionConfig, RaidEngine, SessionRaidStats } = require('./session_raid_stats.js');
 *   const cfg = new SessionConfig({ sessionStart: '02:00', sessionEnd: '02:15' });
 *   const engine = new RaidEngine(cfg);
 *   bars.forEach(b => engine.onBar(b.timeMs, b.open, b.high, b.low, b.close));
 *   console.log(engine.getStats());
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BUCKETS = 6;
const BC = MAX_BUCKETS + 1; // 7 buckets: 0-5 + overflow

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

class SessionConfig {
  /**
   * @param {object} opts
   * @param {string}  opts.sessionStart   - "HH:MM" local exchange time
   * @param {string}  opts.sessionEnd     - "HH:MM"
   * @param {number}  [opts.minRaidPts]
   * @param {number}  [opts.cutoffMins]   - 0 = no cutoff
   * @param {number}  [opts.bucketStart]
   * @param {number}  [opts.bucketStep]
   * @param {number}  [opts.tzOffsetHrs]  - e.g. -5 for ET (simplified, no DST)
   */
  constructor({
    sessionStart,
    sessionEnd,
    minRaidPts  = 5.0,
    cutoffMins  = 120,
    bucketStart = 20.0,
    bucketStep  = 10.0,
    tzOffsetHrs = -5.0,
  } = {}) {
    this.sessionStart  = sessionStart;
    this.sessionEnd    = sessionEnd;
    this.minRaidPts    = minRaidPts;
    this.cutoffMins    = cutoffMins;
    this.bucketStart   = bucketStart;
    this.bucketStep    = bucketStep;
    this.tzOffsetHrs   = tzOffsetHrs;
  }

  levelPts(n) {
    return this.bucketStart + (n - 1) * this.bucketStep;
  }

  get levels() {
    return Array.from({ length: MAX_BUCKETS }, (_, i) => this.levelPts(i + 1));
  }
}

// ---------------------------------------------------------------------------
// Bucket helpers
// ---------------------------------------------------------------------------

function bucketIndex(value, cfg) {
  const lvls = cfg.levels;
  for (let i = 0; i < MAX_BUCKETS - 1; i++) {
    if (value < lvls[i + 1]) return i;
  }
  if (value < lvls[MAX_BUCKETS - 1] + cfg.bucketStep) return MAX_BUCKETS - 1;
  return MAX_BUCKETS; // overflow
}

function cumulativeCounts(counts) {
  const cum = new Array(counts.length).fill(0);
  let running = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    running += counts[i];
    cum[i] = running;
  }
  return cum;
}

function updateProbCache(hiCounts, loCounts, dayCount, probHi, probLo) {
  if (dayCount <= 0) return;
  const cumH = cumulativeCounts(hiCounts);
  const cumL = cumulativeCounts(loCounts);
  for (let i = 0; i < BC; i++) {
    probHi[i] = (cumH[i] / dayCount) * 100;
    probLo[i] = (cumL[i] / dayCount) * 100;
  }
}

// ---------------------------------------------------------------------------
// Session time helpers
// ---------------------------------------------------------------------------

function parseHHMM(s) {
  const [h, m] = s.split(':').map(Number);
  return { h, m };
}

function barLocalMins(timeMs, tzOffsetHrs) {
  const localMs = timeMs + tzOffsetHrs * 3_600_000;
  const d = new Date(localMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function inSession(timeMs, cfg) {
  const mins  = barLocalMins(timeMs, cfg.tzOffsetHrs);
  const start = parseHHMM(cfg.sessionStart);
  const end   = parseHHMM(cfg.sessionEnd);
  const sm    = start.h * 60 + start.m;
  const em    = end.h   * 60 + end.m;
  return mins >= sm && mins < em;
}

function withinCutoff(timeMs, rangeEndMs, cutoffMins) {
  if (cutoffMins === 0) return true;
  return (timeMs - rangeEndMs) <= cutoffMins * 60_000;
}

// ---------------------------------------------------------------------------
// Raid engine
// ---------------------------------------------------------------------------

class RaidEngine {
  constructor(cfg, maxDays = 500) {
    this.cfg      = cfg;
    this.maxDays  = maxDays;

    // Mutable per-session state
    this._s = this._freshState();

    this._hiCounts = new Array(BC).fill(0);
    this._loCounts = new Array(BC).fill(0);
    this._probHi   = new Array(BC).fill(0);
    this._probLo   = new Array(BC).fill(0);
    this._dayCount = 0;
    this._prevInS  = false;
  }

  _freshState() {
    return {
      hi: null, lo: null, endMs: null, active: false,
      hiMax: null, hiTouch: false, hiConf: false, hiPts: null,
      loMin: null, loTouch: false, loConf: false, loPts: null,
      cutExp: false,
    };
  }

  onBar(timeMs, open, high, low, close) {
    const cfg = this.cfg;
    const s   = this._s;
    const inS = inSession(timeMs, cfg);

    // Session open
    if (inS && !this._prevInS) {
      this._s = this._freshState();
      this._s.hi = high;
      this._s.lo = low;
      Object.assign(s, this._s); // rebind local ref
    }

    // Expand range
    if (inS && s.hi !== null) {
      if (high > s.hi) s.hi = high;
      if (low  < s.lo) s.lo = low;
    }

    // Session close
    if (!inS && this._prevInS && s.hi !== null) {
      s.endMs  = timeMs;
      s.active = true;
      if (this._dayCount < this.maxDays) this._dayCount++;
    }

    // Raid detection
    if (s.active) {
      if (withinCutoff(timeMs, s.endMs, cfg.cutoffMins)) {
        if (high > s.hi) {
          const ext = high - s.hi;
          if (ext >= cfg.minRaidPts && (s.hiMax === null || high > s.hiMax)) {
            s.hiMax   = high;
            s.hiPts   = ext;
            s.hiTouch = true;
          }
        }
        if (low < s.lo) {
          const ext = s.lo - low;
          if (ext >= cfg.minRaidPts && (s.loMin === null || low < s.loMin)) {
            s.loMin   = low;
            s.loPts   = ext;
            s.loTouch = true;
          }
        }
      } else if (!s.cutExp) {
        if (s.hiTouch) {
          const idx = bucketIndex(s.hiPts, cfg);
          this._hiCounts[idx]++;
          s.hiConf = true;
        }
        if (s.loTouch) {
          const idx = bucketIndex(s.loPts, cfg);
          this._loCounts[idx]++;
          s.loConf = true;
        }
        updateProbCache(this._hiCounts, this._loCounts, this._dayCount,
          this._probHi, this._probLo);
        s.cutExp = true;
      }
    }

    this._prevInS = inS;
  }

  getStats() {
    return {
      probHi:   [...this._probHi],
      probLo:   [...this._probLo],
      dayCount: this._dayCount,
    };
  }
}

// ---------------------------------------------------------------------------
// Three-session facade
// ---------------------------------------------------------------------------

class SessionRaidStats {
  constructor(cfg1, cfg2, cfg3, maxDays = 500) {
    this.e1 = new RaidEngine(cfg1, maxDays);
    this.e2 = new RaidEngine(cfg2, maxDays);
    this.e3 = new RaidEngine(cfg3, maxDays);
  }

  onBar(timeMs, open, high, low, close) {
    this.e1.onBar(timeMs, open, high, low, close);
    this.e2.onBar(timeMs, open, high, low, close);
    this.e3.onBar(timeMs, open, high, low, close);
  }

  stats() {
    return { r1: this.e1.getStats(), r2: this.e2.getStats(), r3: this.e3.getStats() };
  }
}

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SessionConfig, RaidEngine, SessionRaidStats,
    bucketIndex, cumulativeCounts, updateProbCache };
}

// ---------------------------------------------------------------------------
// Quick self-test (Node.js: node session_raid_stats.js)
// ---------------------------------------------------------------------------

if (typeof require !== 'undefined' && require.main === module) {
  // Seeded pseudo-random (simple LCG)
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };

  const cfg = new SessionConfig({ sessionStart: '02:00', sessionEnd: '02:15' });
  const engine = new RaidEngine(cfg, 100);

  const baseMs  = 1704182400000; // 2024-01-02 07:00 UTC = 02:00 ET
  const msMin   = 60_000;
  let price     = 4500;

  for (let day = 0; day < 5; day++) {
    const dayOff = day * 24 * 60 * msMin;
    for (let m = 0; m < 8 * 60; m++) {
      const t  = baseMs + dayOff + m * msMin;
      const o  = price;
      const h  = o + rand() * 4;
      const l  = o - rand() * 4;
      const c  = l + rand() * (h - l);
      price = c;
      engine.onBar(t, o, h, l, c);
    }
  }

  const stats = engine.getStats();
  console.log('Day count:', stats.dayCount);
  console.log('prob_hi  :', stats.probHi.map(p => p.toFixed(1) + '%').join(' '));
  console.log('prob_lo  :', stats.probLo.map(p => p.toFixed(1) + '%').join(' '));
}
