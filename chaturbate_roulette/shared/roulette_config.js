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
