// --- Spin Wheel Shared Logic ---
// Core mechanics for the slot-style spin wheel feature.

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Load spin wheel configuration from $kv or return defaults.
 * @param {Object} kv
 * @returns {Object}
 */
function getSpinWheelConfig(kv) {
    const configString = kv.get('spin_wheel_config');
    if (configString) {
        try {
            return { ...getDefaultSpinWheelConfig(), ...JSON.parse(configString) };
        } catch (e) {
            console.error("[spin_wheel] Error parsing config from $kv:", e);
            return getDefaultSpinWheelConfig();
        }
    }
    return getDefaultSpinWheelConfig();
}

/**
 * Save spin wheel configuration to $kv.
 * @param {Object} kv
 * @param {Object} config
 */
function saveSpinWheelConfig(kv, config) {
    try {
        kv.set('spin_wheel_config', JSON.stringify(config));
    } catch (e) {
        console.error("[spin_wheel] Error saving config:", e);
    }
}

/**
 * Return the default spin wheel configuration.
 * @returns {Object}
 */
function getDefaultSpinWheelConfig() {
    return {
        segments: [
            { id: 1, label: "Panties!",       tokens: 25,  weight: 1.0, color: '#FF69B4', custom: null },
            { id: 2, label: "Flash!",          tokens: 50,  weight: 1.0, color: '#FF4500', custom: null },
            { id: 3, label: "Anal!",           tokens: 200, weight: 0.5, color: '#8B0000', custom: null },
            { id: 4, label: "No Reward",       tokens: 0,   weight: 1.5, color: '#555555', custom: null },
            { id: 5, label: "Bonus Prize!",    tokens: 75,  weight: 0.8, color: '#FFD700', custom: "Special Animation" },
            { id: 6, label: "Another Chance",  tokens: 0,   weight: 1.2, color: '#9B59B6', custom: null },
            { id: 7, label: "Dance!",          tokens: 0,   weight: 1.3, color: '#1ABC9C', custom: "Sexy Dance" },
            { id: 8, label: "JACKPOT! 🏆",     tokens: 500, weight: 0.1, color: '#FFD700', custom: null, isJackpot: true },
        ],
        spinThreshold: 100,       // Minimum tip to earn a spin
        jackpotContribRate: 0.05, // 5% of each tip feeds the jackpot
        jackpotSeed: 200,         // Starting jackpot tokens
        cooldownSeconds: 0,       // 0 = no cooldown between spins
        allowMultipleSpins: true, // Big tips = multiple spins
        streakBonusEnabled: true, // Consecutive spins earn a streak bonus
        achievementsEnabled: true,
    };
}

// ─── Weighted Random Spin ─────────────────────────────────────────────────────

/**
 * Select a random segment weighted by each segment's `weight` property.
 * @param {Object} config - Spin wheel config
 * @returns {Object} Selected segment
 */
function getRandomWeightedSpinResult(config) {
    const segments = config.segments;
    const totalWeight = segments.reduce((sum, seg) => sum + (seg.weight || 1), 0);
    let randomValue = Math.random() * totalWeight;
    let weightSum = 0;

    for (const seg of segments) {
        weightSum += (seg.weight || 1);
        if (randomValue < weightSum) return seg;
    }
    // Fallback
    return segments[Math.floor(Math.random() * segments.length)];
}

// ─── Jackpot Pool ─────────────────────────────────────────────────────────────

/**
 * Add the tip-based contribution to the jackpot pool.
 * @param {number} tipAmount
 * @param {Object} kv
 * @param {Object} config
 * @returns {number} New jackpot total
 */
function addToJackpot(tipAmount, kv, config) {
    const rate        = config.jackpotContribRate || 0.05;
    const contribution = Math.floor((Number(tipAmount) || 0) * rate);
    const current     = Number(kv.get('spin_jackpot_pool') || config.jackpotSeed || 200);
    const newTotal    = current + contribution;
    kv.set('spin_jackpot_pool', newTotal);
    console.log(`[spin_wheel] Jackpot pool: ${current} + ${contribution} = ${newTotal}`);
    return newTotal;
}

/**
 * Claim and reset the jackpot pool, returning the won amount.
 * @param {Object} kv
 * @param {Object} config
 * @returns {number} Jackpot tokens won
 */
function claimJackpot(kv, config) {
    const jackpot = Number(kv.get('spin_jackpot_pool') || config.jackpotSeed || 200);
    const seed    = config.jackpotSeed || 200;
    kv.set('spin_jackpot_pool', seed); // Reset to seed value
    kv.set('spin_last_jackpot_winner', { tokens: jackpot, timestamp: Date.now() });
    console.log(`[spin_wheel] Jackpot of ${jackpot} claimed! Pool reset to ${seed}.`);
    return jackpot;
}

/**
 * Get current jackpot pool value.
 * @param {Object} kv
 * @param {Object} config
 * @returns {number}
 */
function getJackpotPool(kv, config) {
    return Number(kv.get('spin_jackpot_pool') || (config && config.jackpotSeed) || 200);
}

// ─── Spin Opportunity ─────────────────────────────────────────────────────────

/**
 * Check cooldown and threshold, then grant spin opportunity to the user.
 * Returns number of spins earned (0 if not eligible).
 * @param {string} username
 * @param {number} tipAmount
 * @param {Object} kv
 * @param {Object} config
 * @returns {number} Number of spins earned
 */
function grantSpinOpportunity(username, tipAmount, kv, config) {
    const cfg = config || getSpinWheelConfig(kv);
    const threshold = Number(cfg.spinThreshold) || 100;

    if (tipAmount < threshold) return 0;

    // Cooldown check
    if (cfg.cooldownSeconds > 0) {
        const lastSpin = Number(kv.get(`spin_last_time_${username}`) || 0);
        const elapsed  = (Date.now() - lastSpin) / 1000;
        if (elapsed < cfg.cooldownSeconds) return 0;
    }

    const spins = cfg.allowMultipleSpins ? Math.floor(tipAmount / threshold) : 1;
    kv.set(`spin_last_time_${username}`, Date.now());
    return spins;
}

// ─── Streak Tracking ──────────────────────────────────────────────────────────

/**
 * Update the user's win streak. Call AFTER determining if the spin was a win.
 * @param {string} username
 * @param {boolean} isWin
 * @param {Object} kv
 * @returns {{ streak: number, multiplier: number }}
 */
function updateSpinStreak(username, isWin, kv) {
    const key    = `spin_streak_${username}`;
    const streak = Number(kv.get(key) || 0);

    if (isWin) {
        const newStreak = streak + 1;
        kv.set(key, newStreak);
        const multiplier = typeof calculateStreakMultiplier === 'function'
            ? calculateStreakMultiplier(newStreak) : 1.0;
        console.log(`[spin_wheel] ${username} streak: ${newStreak} (×${multiplier})`);
        return { streak: newStreak, multiplier };
    } else {
        kv.set(key, 0);
        return { streak: 0, multiplier: 1.0 };
    }
}

/**
 * Get a user's current spin streak.
 * @param {string} username
 * @param {Object} kv
 * @returns {number}
 */
function getSpinStreak(username, kv) {
    return Number(kv.get(`spin_streak_${username}`) || 0);
}

// ─── Spin Statistics ──────────────────────────────────────────────────────────

/**
 * Record a spin result in global stats stored in $kv.
 * @param {string} username
 * @param {number} tipAmount
 * @param {Object} result     - The selected segment
 * @param {Object} kv
 */
function recordSpinStat(username, tipAmount, result, kv) {
    const statsRaw = kv.get('spin_stats') || '{}';
    let stats;
    try { stats = JSON.parse(statsRaw); } catch (_) { stats = {}; }

    // Global counters
    stats.totalSpins       = (stats.totalSpins || 0) + 1;
    stats.totalTokensIn    = (stats.totalTokensIn || 0) + tipAmount;
    stats.totalTokensOut   = (stats.totalTokensOut || 0) + (result.tokens || 0);

    // Per-user
    if (!stats.users) stats.users = {};
    if (!stats.users[username]) {
        stats.users[username] = { spins: 0, tipped: 0, won: 0, lastSpin: 0 };
    }
    stats.users[username].spins++;
    stats.users[username].tipped  += tipAmount;
    stats.users[username].won     += (result.tokens || 0);
    stats.users[username].lastSpin = Date.now();

    // Per-segment
    if (!stats.segments) stats.segments = {};
    const segKey = String(result.id || result.label);
    if (!stats.segments[segKey]) stats.segments[segKey] = { hits: 0, tokensOut: 0, label: result.label };
    stats.segments[segKey].hits++;
    stats.segments[segKey].tokensOut += (result.tokens || 0);

    kv.set('spin_stats', JSON.stringify(stats));
}

/**
 * Get the spin wheel leaderboard (top tippers).
 * @param {Object} kv
 * @param {number} limit
 * @returns {Array<{ username: string, score: number }>}
 */
function getSpinLeaderboard(kv, limit = 10) {
    const statsRaw = kv.get('spin_stats') || '{}';
    let stats;
    try { stats = JSON.parse(statsRaw); } catch (_) { return []; }

    return Object.entries(stats.users || {})
        .map(([username, u]) => ({ username, score: u.tipped }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

/**
 * Format a brief stats summary string.
 * @param {Object} kv
 * @returns {string}
 */
function formatSpinWheelStats(kv) {
    const statsRaw = kv.get('spin_stats') || '{}';
    let stats;
    try { stats = JSON.parse(statsRaw); } catch (_) { return '📊 No spin stats yet!'; }

    const players  = Object.keys(stats.users || {}).length;
    const netIn    = (stats.totalTokensIn || 0) - (stats.totalTokensOut || 0);
    return [
        `🎰 SPIN WHEEL STATS 🎰`,
        `Total Spins: ${stats.totalSpins || 0}`,
        `Tokens In: ${stats.totalTokensIn || 0}`,
        `Tokens Awarded: ${stats.totalTokensOut || 0}`,
        `Net: ${netIn}`,
        `Unique Spinners: ${players}`,
    ].join('\n');
}

// ─── Spin Outcome Handler ─────────────────────────────────────────────────────

/**
 * Announce a spin outcome to the room chat via `callback`.
 * Handles jackpot segments specially.
 * @param {Object} result     - Winning segment
 * @param {string} username
 * @param {Object} callback   - $callback object
 * @param {Object} kv
 * @param {Object} [config]
 */
function handleSpinOutcome(result, username, callback, kv, config) {
    const chat = msg => {
        if (callback && typeof callback.chat === 'function') callback.chat(msg);
    };

    // Jackpot segment
    if (result.isJackpot) {
        const cfg        = config || getSpinWheelConfig(kv);
        const jackpotWon = claimJackpot(kv, cfg);
        chat(`🏆🎉 JACKPOT! ${username} hit the JACKPOT and won ${jackpotWon} tokens! 🎉🏆`);
        console.log(`[spin_wheel] JACKPOT: ${username} won ${jackpotWon} tokens.`);
        return;
    }

    if (result.tokens > 0) {
        chat(`🎉 ${username} spun the wheel and won ${result.tokens} bonus tokens! [${result.label}] 🎉`);
        console.log(`[spin_wheel] ${username} won ${result.tokens} tokens.`);
    } else if (result.custom) {
        chat(`🎉 ${username} landed on "${result.label}"! Time for a ${result.custom}! 🎉`);
    } else {
        chat(`🎰 ${username} spun and landed on "${result.label}". Better luck next time!`);
    }
}

/**
 * Announce a streak celebration if the streak is noteworthy.
 * @param {string} username
 * @param {number} streak
 * @param {Object} callback
 */
function announceStreak(username, streak, callback) {
    if (!callback || typeof callback.chat !== 'function') return;
    if (streak < 2) return;

    const emoji = typeof getStreakEmoji === 'function' ? getStreakEmoji(streak) : '🔥';
    if (streak === 2)  callback.chat(`${emoji} ${username} is on a 2-spin win streak! 🔥`);
    if (streak === 3)  callback.chat(`🔥🔥 ${username} is HOT with a 3-spin streak! Don't stop now!`);
    if (streak === 5)  callback.chat(`⚡⚡ INCREDIBLE! ${username} has a 5-SPIN STREAK! The wheel loves you! ⚡⚡`);
    if (streak === 10) callback.chat(`👑 LEGENDARY! ${username} reached a 10-SPIN WIN STREAK! You're unstoppable! 👑`);
}

/**
 * Get a hot-segment summary (most-landed segments this session).
 * @param {Object} kv
 * @param {number} topN
 * @returns {string}
 */
function getHotSegments(kv, topN = 3) {
    const statsRaw = kv.get('spin_stats') || '{}';
    let stats;
    try { stats = JSON.parse(statsRaw); } catch (_) { return '🔥 No data yet.'; }

    const sorted = Object.values(stats.segments || {})
        .sort((a, b) => b.hits - a.hits)
        .slice(0, topN);

    if (sorted.length === 0) return '🔥 No segment data yet.';
    const lines = sorted.map((s, i) => `${i + 1}. ${s.label} (${s.hits} hits)`);
    return `🔥 HOT SEGMENTS:\n${lines.join('\n')}`;
}
