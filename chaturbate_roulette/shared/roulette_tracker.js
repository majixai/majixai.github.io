// --- Roulette Tracking Module ---
// Tracks spin history, statistics, and user records

/**
 * Initialize tracking data structure
 * @returns {Object} Empty tracking data
 */
function initTrackingData() {
    return {
        totalSpins: 0,
        totalTokensSpent: 0,
        totalTokensAwarded: 0,
        spinHistory: [],
        userStats: {},
        segmentStats: {},
        sessionStartTime: Date.now(),
        lastUpdated: Date.now()
    };
}

/**
 * Get tracking data from KV store
 * @param {Object} kv - Key-value store object
 * @returns {Object} Tracking data
 */
function getTrackingData(kv) {
    const dataString = kv.get('roulette_tracking');
    if (dataString) {
        try {
            return JSON.parse(dataString);
        } catch (e) {
            console.error("Error parsing tracking data:", e);
            return initTrackingData();
        }
    }
    return initTrackingData();
}

/**
 * Save tracking data to KV store
 * @param {Object} kv - Key-value store object
 * @param {Object} data - Tracking data to save
 */
function saveTrackingData(kv, data) {
    data.lastUpdated = Date.now();
    try {
        kv.set('roulette_tracking', JSON.stringify(data));
    } catch (e) {
        console.error("Error saving tracking data:", e);
    }
}

/**
 * Record a spin result
 * @param {Object} kv - Key-value store object
 * @param {string} username - User who spun
 * @param {number} tipAmount - Amount tipped
 * @param {Object} result - Spin result segment
 */
function recordSpin(kv, username, tipAmount, result) {
    const data = getTrackingData(kv);
    
    // Update totals
    data.totalSpins++;
    data.totalTokensSpent += tipAmount;
    data.totalTokensAwarded += (result.tokens || 0);
    
    // Add to history (keep last 100 spins)
    const spinRecord = {
        username: username,
        tipAmount: tipAmount,
        result: result.label,
        tokens: result.tokens || 0,
        timestamp: Date.now()
    };
    data.spinHistory.unshift(spinRecord);
    if (data.spinHistory.length > 100) {
        data.spinHistory = data.spinHistory.slice(0, 100);
    }
    
    // Update user stats
    if (!data.userStats[username]) {
        data.userStats[username] = {
            totalSpins: 0,
            totalTipped: 0,
            totalWon: 0,
            lastSpin: null,
            wins: []
        };
    }
    data.userStats[username].totalSpins++;
    data.userStats[username].totalTipped += tipAmount;
    data.userStats[username].totalWon += (result.tokens || 0);
    data.userStats[username].lastSpin = Date.now();
    if (result.tokens > 0) {
        data.userStats[username].wins.push({
            prize: result.label,
            tokens: result.tokens,
            timestamp: Date.now()
        });
    }
    
    // Update segment stats
    const segmentId = result.id || result.label;
    if (!data.segmentStats[segmentId]) {
        data.segmentStats[segmentId] = {
            label: result.label,
            hits: 0,
            totalAwarded: 0
        };
    }
    data.segmentStats[segmentId].hits++;
    data.segmentStats[segmentId].totalAwarded += (result.tokens || 0);
    
    saveTrackingData(kv, data);
    return spinRecord;
}

/**
 * Get user statistics
 * @param {Object} kv - Key-value store object
 * @param {string} username - Username to look up
 * @returns {Object|null} User stats or null if not found
 */
function getUserStats(kv, username) {
    const data = getTrackingData(kv);
    return data.userStats[username] || null;
}

/**
 * Get leaderboard (top spinners by tokens spent)
 * @param {Object} kv - Key-value store object
 * @param {number} limit - Number of entries to return
 * @returns {Array} Leaderboard entries
 */
function getLeaderboard(kv, limit = 10) {
    const data = getTrackingData(kv);
    const entries = Object.entries(data.userStats)
        .map(([username, stats]) => ({
            username,
            totalSpins: stats.totalSpins,
            totalTipped: stats.totalTipped,
            totalWon: stats.totalWon
        }))
        .sort((a, b) => b.totalTipped - a.totalTipped)
        .slice(0, limit);
    return entries;
}

/**
 * Get biggest winners (by tokens won)
 * @param {Object} kv - Key-value store object
 * @param {number} limit - Number of entries to return
 * @returns {Array} Winner entries
 */
function getBiggestWinners(kv, limit = 10) {
    const data = getTrackingData(kv);
    const entries = Object.entries(data.userStats)
        .map(([username, stats]) => ({
            username,
            totalWon: stats.totalWon,
            totalSpins: stats.totalSpins
        }))
        .filter(e => e.totalWon > 0)
        .sort((a, b) => b.totalWon - a.totalWon)
        .slice(0, limit);
    return entries;
}

/**
 * Get recent spin history
 * @param {Object} kv - Key-value store object
 * @param {number} limit - Number of entries to return
 * @returns {Array} Recent spins
 */
function getRecentSpins(kv, limit = 10) {
    const data = getTrackingData(kv);
    return data.spinHistory.slice(0, limit);
}

/**
 * Get segment statistics
 * @param {Object} kv - Key-value store object
 * @returns {Object} Segment stats
 */
function getSegmentStats(kv) {
    const data = getTrackingData(kv);
    return data.segmentStats;
}

/**
 * Get overall statistics summary
 * @param {Object} kv - Key-value store object
 * @returns {Object} Summary statistics
 */
function getStatsSummary(kv) {
    const data = getTrackingData(kv);
    const uniquePlayers = Object.keys(data.userStats).length;
    const sessionDuration = Date.now() - data.sessionStartTime;
    
    return {
        totalSpins: data.totalSpins,
        totalTokensSpent: data.totalTokensSpent,
        totalTokensAwarded: data.totalTokensAwarded,
        netProfit: data.totalTokensSpent - data.totalTokensAwarded,
        uniquePlayers: uniquePlayers,
        avgSpinsPerPlayer: uniquePlayers > 0 ? (data.totalSpins / uniquePlayers).toFixed(2) : 0,
        sessionDurationMinutes: Math.floor(sessionDuration / 60000),
        lastUpdated: data.lastUpdated
    };
}

/**
 * Reset tracking data (admin only)
 * @param {Object} kv - Key-value store object
 */
function resetTrackingData(kv) {
    saveTrackingData(kv, initTrackingData());
}

/**
 * Check if user can spin (cooldown check)
 * @param {Object} kv - Key-value store object
 * @param {string} username - Username to check
 * @param {number} cooldownSeconds - Cooldown period in seconds
 * @returns {Object} { canSpin: boolean, remainingSeconds: number }
 */
function checkSpinCooldown(kv, username, cooldownSeconds) {
    if (cooldownSeconds <= 0) {
        return { canSpin: true, remainingSeconds: 0 };
    }
    
    const lastSpinTime = kv.get(`roulette_last_spin_${username}`);
    if (!lastSpinTime) {
        return { canSpin: true, remainingSeconds: 0 };
    }
    
    const parsedTime = parseInt(lastSpinTime, 10);
    if (isNaN(parsedTime)) {
        // Invalid data, allow spin
        return { canSpin: true, remainingSeconds: 0 };
    }
    
    const elapsed = (Date.now() - parsedTime) / 1000;
    if (elapsed >= cooldownSeconds) {
        return { canSpin: true, remainingSeconds: 0 };
    }
    
    return { 
        canSpin: false, 
        remainingSeconds: Math.ceil(cooldownSeconds - elapsed) 
    };
}

/**
 * Set last spin time for cooldown tracking
 * @param {Object} kv - Key-value store object
 * @param {string} username - Username
 */
function setLastSpinTime(kv, username) {
    kv.set(`roulette_last_spin_${username}`, Date.now().toString());
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initTrackingData,
        getTrackingData,
        saveTrackingData,
        recordSpin,
        getUserStats,
        getLeaderboard,
        getBiggestWinners,
        getRecentSpins,
        getSegmentStats,
        getStatsSummary,
        resetTrackingData,
        checkSpinCooldown,
        setLastSpinTime
    };
}
