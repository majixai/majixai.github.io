// --- Roulette Configuration Module ---
// Manages configurable settings for the roulette game

/**
 * Default roulette wheel segments with prizes, colors, and weights
 * Weight affects probability: higher weight = more likely to land
 */
function getDefaultRouletteConfig() {
    return {
        // Wheel segments with prizes
        segments: [
            { id: 1, label: "Flash!", prize: "Flash for 10 seconds", color: "#FF6B6B", weight: 1.5, tokens: 0 },
            { id: 2, label: "Dance!", prize: "Sexy dance", color: "#4ECDC4", weight: 1.2, tokens: 0 },
            { id: 3, label: "Bonus 50!", prize: "50 bonus tokens", color: "#FFE66D", weight: 0.3, tokens: 50 },
            { id: 4, label: "Tease", prize: "Tease for 30 seconds", color: "#95E1D3", weight: 1.8, tokens: 0 },
            { id: 5, label: "Song Request", prize: "Request a song", color: "#F38181", weight: 1.0, tokens: 0 },
            { id: 6, label: "Try Again!", prize: "Better luck next time!", color: "#AA96DA", weight: 2.0, tokens: 0 },
            { id: 7, label: "Special Show!", prize: "Special 1-min show", color: "#FCBAD3", weight: 0.5, tokens: 0 },
            { id: 8, label: "Bonus 25!", prize: "25 bonus tokens", color: "#A8D8EA", weight: 0.6, tokens: 25 },
            { id: 9, label: "Pose", prize: "Strike a pose", color: "#C9CBA3", weight: 1.4, tokens: 0 },
            { id: 10, label: "JACKPOT!", prize: "Jackpot - 200 tokens!", color: "#FFD700", weight: 0.1, tokens: 200 }
        ],
        // Minimum tip amount to trigger a spin
        spinCost: 50,
        // Optional: Allow multiple spins per session
        allowMultipleSpins: true,
        // Cooldown between spins in seconds (0 = no cooldown)
        spinCooldown: 5,
        // Enable/disable tracking
        trackingEnabled: true,
        // Animation duration in milliseconds
        spinDuration: 4000,
        // Number of full rotations before stopping
        spinRotations: 5
    };
}

/**
 * Load roulette configuration from KV store
 * @param {Object} kv - Key-value store object
 * @returns {Object} Configuration object
 */
function getRouletteConfig(kv) {
    const configString = kv.get('roulette_config');
    if (configString) {
        try {
            const parsedConfig = JSON.parse(configString);
            // Merge with defaults to ensure all properties exist
            return { ...getDefaultRouletteConfig(), ...parsedConfig };
        } catch (e) {
            console.error("Error parsing roulette config from $kv:", e);
            return getDefaultRouletteConfig();
        }
    }
    return getDefaultRouletteConfig();
}

/**
 * Save roulette configuration to KV store
 * @param {Object} kv - Key-value store object
 * @param {Object} config - Configuration to save
 * @returns {boolean} Success status
 */
function saveRouletteConfig(kv, config) {
    try {
        kv.set('roulette_config', JSON.stringify(config));
        return true;
    } catch (e) {
        console.error("Error saving roulette config:", e);
        return false;
    }
}

/**
 * Update spin cost
 * @param {Object} kv - Key-value store object
 * @param {number} cost - New spin cost in tokens
 * @returns {boolean} Success status
 */
function setSpinCost(kv, cost) {
    const config = getRouletteConfig(kv);
    config.spinCost = parseInt(cost, 10);
    return saveRouletteConfig(kv, config);
}

/**
 * Add or update a segment
 * @param {Object} kv - Key-value store object
 * @param {Object} segment - Segment configuration
 * @returns {boolean} Success status
 */
function updateSegment(kv, segment) {
    const config = getRouletteConfig(kv);
    const existingIndex = config.segments.findIndex(s => s.id === segment.id);
    if (existingIndex >= 0) {
        config.segments[existingIndex] = { ...config.segments[existingIndex], ...segment };
    } else {
        segment.id = config.segments.length + 1;
        config.segments.push(segment);
    }
    return saveRouletteConfig(kv, config);
}

/**
 * Remove a segment by ID
 * @param {Object} kv - Key-value store object
 * @param {number} segmentId - Segment ID to remove
 * @returns {boolean} Success status
 */
function removeSegment(kv, segmentId) {
    const config = getRouletteConfig(kv);
    config.segments = config.segments.filter(s => s.id !== segmentId);
    return saveRouletteConfig(kv, config);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getDefaultRouletteConfig,
        getRouletteConfig,
        saveRouletteConfig,
        setSpinCost,
        updateSegment,
        removeSegment
    };
}

// ─── VIP Tiers for Roulette ───────────────────────────────────────────────────

/**
 * VIP tiers for roulette — determines bonus spin count and token multiplier.
 */
const ROULETTE_VIP_TIERS = [
    { name: 'Bronze',   minTokens: 0,     spinsBonus: 0, multiplier: 1.0, emoji: '🥉' },
    { name: 'Silver',   minTokens: 500,   spinsBonus: 0, multiplier: 1.1, emoji: '🥈' },
    { name: 'Gold',     minTokens: 2000,  spinsBonus: 1, multiplier: 1.25, emoji: '🥇' },
    { name: 'Platinum', minTokens: 5000,  spinsBonus: 1, multiplier: 1.5,  emoji: '💎' },
    { name: 'Diamond',  minTokens: 15000, spinsBonus: 2, multiplier: 1.75, emoji: '💍' },
    { name: 'Legend',   minTokens: 50000, spinsBonus: 3, multiplier: 2.0,  emoji: '👑' },
];

/**
 * Get the roulette VIP tier for a user by lifetime tokens.
 * @param {number} lifetimeTokens
 * @returns {Object} Tier object
 */
function getRouletteVipTier(lifetimeTokens) {
    const tokens = Number(lifetimeTokens) || 0;
    let tier = ROULETTE_VIP_TIERS[0];
    for (const t of ROULETTE_VIP_TIERS) {
        if (tokens >= t.minTokens) tier = t;
    }
    return tier;
}

// ─── Jackpot Configuration ────────────────────────────────────────────────────

/**
 * Default jackpot configuration for the roulette.
 */
function getDefaultJackpotConfig() {
    return {
        seed: 200,               // Starting jackpot when claimed or initialized
        contributionRate: 0.05,  // 5% of each tip goes to jackpot
        minJackpot: 200,         // Jackpot never goes below this
        jackpotSegmentLabel: 'JACKPOT!', // Label of the jackpot segment in wheel
    };
}

// ─── Daily Challenge Configuration ───────────────────────────────────────────

/**
 * Pool of possible daily challenges.
 */
function getDailyChallengePool() {
    return [
        { type: 'hit_segment',     description: 'Hit the JACKPOT segment',         target: 1,   reward: 200 },
        { type: 'spin_count',      description: 'Complete 15 spins this session',   target: 15,  reward: 100 },
        { type: 'win_streak',      description: 'Achieve a 4-spin win streak',      target: 4,   reward: 150 },
        { type: 'total_tips',      description: 'Tip 1000+ tokens today',           target: 1000, reward: 200 },
        { type: 'unique_spinners', description: 'Have 8 unique spinners today',     target: 8,   reward: 100 },
        { type: 'combo_spins',     description: 'Earn a 3-tip combo by one user',   target: 3,   reward: 75  },
        { type: 'bonus_segment',   description: 'Land on any Bonus segment 3 times', target: 3,  reward: 50  },
        { type: 'token_payout',    description: 'Award 200+ total bonus tokens',    target: 200, reward: 150 },
    ];
}

// ─── Announcement Templates ───────────────────────────────────────────────────

/**
 * Announcement rotation messages for the roulette app.
 * @param {number} spinCost - Minimum tip to earn a spin
 * @param {number} jackpot  - Current jackpot pool
 * @returns {string[]}
 */
function getRouletteAnnouncements(spinCost, jackpot) {
    return [
        `🎡 ROULETTE TIME! Tip ${spinCost}+ tokens to spin the wheel and win amazing prizes! 🎡`,
        `💰 The jackpot pool is currently ${jackpot} tokens — spin to WIN IT ALL! 🏆`,
        `🔥 Type !rjackpot to check the jackpot, !rstreak for your streak, !rfortune for your fortune!`,
        `🎯 Daily Challenge is active! Type !rdaily to see today's goal and earn bonus tokens!`,
        `🏆 Type !rtop to see the roulette leaderboard!`,
        `�� Mods can gift spins! Type !rgift [username] to give a free spin to someone!`,
        `🌟 VIP spinners earn bonus spins! Tip more to level up your tier and get multipliers!`,
        `🎡 Hot segments are where the wins cluster! Type !rhot to see what's hot tonight!`,
        `🎊 Spin combos are REAL — tip multiple times in a minute for a bonus multiplier!`,
        `💃 Follow the room to never miss a special show announcement!`,
    ];
}
