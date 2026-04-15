// --- Roulette Tracking Module ---
// Tracks spin history, statistics, and user records
// Optionally logs to GitHub via git_logger (Git-as-a-Database with Gzip .dat files)

const gitLogger = typeof require !== 'undefined' ? (() => { try { return require('./git_logger'); } catch (_) { return null; } })() : null;

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

// --- Git-as-a-Database integration (Gzip-compressed .dat files) ---

/** @type {Object|null} Cached logger config – populated by configureGitLogger */
let _gitLoggerConfig = null;

/** @type {{ successes: number, failures: number }} Counters for Git logging health monitoring */
const _gitLogStats = { successes: 0, failures: 0 };

/**
 * Get Git logging health counters.
 * @returns {{ successes: number, failures: number }}
 */
function getGitLogStats() {
    return { ..._gitLogStats };
}

/**
 * Configure GitHub logging for the tracker.
 * Must be called once before any git-backed logging occurs.
 * The PAT is read from the GITHUB_PAT environment variable – never hardcoded.
 * @param {Object} opts - { owner, repo, branch?, basePath? }
 */
function configureGitLogger(opts) {
    if (!gitLogger) {
        console.warn('[roulette_tracker] git_logger module is not available; GitHub logging disabled.');
        return;
    }
    _gitLoggerConfig = { ...gitLogger.getDefaultLoggerConfig(), ...opts };
}

/**
 * Push the current tracking snapshot to GitHub as a Gzip-compressed .dat file.
 * Safe to call when git logging is not configured (no-op in that case).
 * @param {Object} kv - Key-value store object
 * @returns {Promise<void>}
 */
async function syncTrackingToGitHub(kv) {
    if (!gitLogger || !_gitLoggerConfig) return;
    try {
        const data = getTrackingData(kv);
        await gitLogger.writeSnapshot(_gitLoggerConfig, 'tracking_snapshot', data);
        _gitLogStats.successes++;
    } catch (e) {
        _gitLogStats.failures++;
        console.error('[roulette_tracker] syncTrackingToGitHub failed:', e.message);
    }
}

/**
 * Append a single spin record to the GitHub spin log (.dat, Gzip-compressed).
 * @param {Object} spinRecord - The spin record to log
 * @returns {Promise<void>}
 */
async function logSpinToGitHub(spinRecord) {
    if (!gitLogger || !_gitLoggerConfig) return;
    try {
        await gitLogger.appendLog(_gitLoggerConfig, 'spins', {
            _action: 'spin',
            ...spinRecord
        });
        _gitLogStats.successes++;
    } catch (e) {
        _gitLogStats.failures++;
        console.error('[roulette_tracker] logSpinToGitHub failed:', e.message);
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

    // Fire-and-forget: log to GitHub (compressed .dat)
    logSpinToGitHub(spinRecord);

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
        configureGitLogger,
        getGitLogStats,
        syncTrackingToGitHub,
        logSpinToGitHub,
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

// ─── Enhanced Tracking Functions ─────────────────────────────────────────────

/**
 * Get the roulette leaderboard sorted by tokens tipped.
 * @param {Object} kv
 * @param {number} [limit=10]
 * @returns {Array<{ username: string, score: number, spins: number }>}
 */
function getRouletteLeaderboard(kv, limit = 10) {
    const data = getTrackingData(kv);
    return Object.entries(data.userStats || {})
        .map(([username, u]) => ({ username, score: u.tokensSpent || 0, spins: u.spins || 0, won: u.tokensAwarded || 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

/**
 * Format the leaderboard for chat display.
 * @param {Object} kv
 * @param {number} [limit=5]
 * @returns {string}
 */
function formatRouletteLeaderboard(kv, limit = 5) {
    const entries = getRouletteLeaderboard(kv, limit);
    if (entries.length === 0) return '🏆 No roulette data yet! Be the first to spin!';

    const medals = ['🥇', '🥈', '🥉'];
    const lines  = entries.map((e, i) =>
        `${medals[i] || `${i + 1}.`} ${e.username}: ${e.score} tokens (${e.spins} spins)`
    );
    return `🎡 ROULETTE LEADERBOARD 🎡\n${lines.join('\n')}\nTip to claim the top spot!`;
}

/**
 * Format a session summary for the broadcaster.
 * @param {Object} kv
 * @returns {string}
 */
function formatSessionSummary(kv) {
    const data = getTrackingData(kv);
    const now  = Date.now();
    const durationMs  = now - (data.sessionStartTime || now);
    const durationMin = Math.floor(durationMs / 60000);
    const spinners    = Object.keys(data.userStats || {}).length;
    const netTokens   = (data.totalTokensSpent || 0) - (data.totalTokensAwarded || 0);

    return [
        `🎡 SESSION SUMMARY ��`,
        `Duration: ${durationMin} minutes`,
        `Total Spins: ${data.totalSpins || 0}`,
        `Unique Spinners: ${spinners}`,
        `Tokens In: ${data.totalTokensSpent || 0}`,
        `Tokens Awarded: ${data.totalTokensAwarded || 0}`,
        `Net: ${netTokens}`,
    ].join('\n');
}

/**
 * Get personal spin stats for a user.
 * @param {string} username
 * @param {Object} kv
 * @returns {string}
 */
function getUserSpinSummary(username, kv) {
    const data    = getTrackingData(kv);
    const u       = (data.userStats || {})[username];
    const streak  = Number(kv.get(`roulette_streak_${username}`) || 0);
    const gifts   = Number(kv.get(`roulette_gifted_spins_${username}`) || 0);

    if (!u) {
        return `🎡 ${username} hasn't spun yet! Tip to play the roulette!`;
    }

    const winRate = u.spins > 0 ? Math.round((u.wins || 0) / u.spins * 100) : 0;
    return [
        `🎡 ${username}'s ROULETTE STATS 🎡`,
        `Spins: ${u.spins || 0} | Wins: ${u.wins || 0} (${winRate}%)`,
        `Tokens Tipped: ${u.tokensSpent || 0}`,
        `Tokens Won: ${u.tokensAwarded || 0}`,
        `Net: ${(u.tokensAwarded || 0) - (u.tokensSpent || 0)}`,
        `Win Streak: ${streak}${streak >= 3 ? ' 🔥' : ''}`,
        `Gifted Spins: ${gifts}`,
    ].join('\n');
}

/**
 * Record that a specific user won tokens (for win tracking separate from tokensAwarded).
 * @param {string} username
 * @param {boolean} isWin
 * @param {Object} kv
 */
function recordUserWin(username, isWin, kv) {
    const data = getTrackingData(kv);
    if (!data.userStats[username]) {
        data.userStats[username] = { spins: 0, wins: 0, tokensSpent: 0, tokensAwarded: 0 };
    }
    if (isWin) {
        data.userStats[username].wins = (data.userStats[username].wins || 0) + 1;
        saveTrackingData(kv, data);
    }
}

/**
 * Get a snapshot of hot/cold statistics for overlay display.
 * @param {Object} kv
 * @returns {{ hot: Array, cold: Array }}
 */
function getHotColdSnapshot(kv) {
    return {
        hot:  typeof getHotRouletteSegments  === 'function' ? getHotRouletteSegments(kv, 3)  : [],
        cold: typeof getColdRouletteSegments === 'function' ? getColdRouletteSegments(kv, 3) : [],
    };
}
