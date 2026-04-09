// --- Roulette Game Logic Module ---
// Core spinning mechanics and prize selection

/**
 * Calculate weighted random selection from segments
 * @param {Array} segments - Array of segment objects with weights
 * @returns {Object} Selected segment
 */
function getWeightedRandomSegment(segments) {
    // Calculate total weight
    const totalWeight = segments.reduce((sum, segment) => sum + (segment.weight || 1), 0);
    
    // Generate random number in range [0, totalWeight)
    let randomValue = Math.random() * totalWeight;
    
    // Find the segment that corresponds to this random value
    let weightSum = 0;
    for (const segment of segments) {
        weightSum += (segment.weight || 1);
        if (randomValue < weightSum) {
            return segment;
        }
    }
    
    // Fallback: return random segment (should not reach here normally)
    return segments[Math.floor(Math.random() * segments.length)];
}

/**
 * Calculate the final rotation angle for the wheel
 * @param {number} segmentIndex - Index of target segment
 * @param {number} totalSegments - Total number of segments
 * @param {number} rotations - Number of full rotations
 * @returns {number} Final rotation angle in degrees
 */
function calculateSpinAngle(segmentIndex, totalSegments, rotations = 5) {
    // Each segment spans this many degrees
    const segmentAngle = 360 / totalSegments;
    
    // Calculate target angle (center of segment)
    // Wheel spins clockwise, so we need to position correctly
    const targetAngle = (segmentIndex * segmentAngle) + (segmentAngle / 2);
    
    // Add full rotations and randomize landing position within segment
    const randomOffset = (Math.random() - 0.5) * segmentAngle * 0.7;
    const finalAngle = (rotations * 360) + (360 - targetAngle) + randomOffset;
    
    return finalAngle;
}

/**
 * Process a spin request
 * @param {Object} kv - Key-value store object
 * @param {string} username - User requesting the spin
 * @param {number} tipAmount - Amount tipped
 * @param {Object} config - Roulette configuration
 * @returns {Object} Spin result with all necessary data
 */
function processSpin(kv, username, tipAmount, config) {
    // Import tracker functions (assumed available in scope)
    // These would be included via Chaturbate's shared code mechanism
    
    // Check if tip meets minimum
    if (tipAmount < config.spinCost) {
        return {
            success: false,
            error: 'insufficient_tip',
            message: `Need ${config.spinCost} tokens for a spin. You tipped ${tipAmount}.`,
            requiredAmount: config.spinCost,
            tippedAmount: tipAmount
        };
    }
    
    // Check cooldown if function exists
    if (typeof checkSpinCooldown === 'function') {
        const cooldownCheck = checkSpinCooldown(kv, username, config.spinCooldown || 0);
        if (!cooldownCheck.canSpin) {
            return {
                success: false,
                error: 'cooldown',
                message: `Please wait ${cooldownCheck.remainingSeconds} seconds before spinning again.`,
                remainingSeconds: cooldownCheck.remainingSeconds
            };
        }
    }
    
    // Select winning segment
    const result = getWeightedRandomSegment(config.segments);
    const segmentIndex = config.segments.findIndex(s => s.id === result.id);
    
    // Calculate animation angle
    const spinAngle = calculateSpinAngle(
        segmentIndex, 
        config.segments.length, 
        config.spinRotations || 5
    );
    
    // Record spin in tracking if function exists
    if (typeof recordSpin === 'function') {
        recordSpin(kv, username, tipAmount, result);
    }
    
    // Set cooldown if function exists
    if (typeof setLastSpinTime === 'function') {
        setLastSpinTime(kv, username);
    }
    
    // Calculate number of spins earned (tip may cover multiple)
    const spinsEarned = config.allowMultipleSpins 
        ? Math.floor(tipAmount / config.spinCost)
        : 1;
    
    return {
        success: true,
        username: username,
        tipAmount: tipAmount,
        spinsEarned: spinsEarned,
        result: {
            segmentId: result.id,
            label: result.label,
            prize: result.prize,
            tokens: result.tokens || 0,
            color: result.color
        },
        animation: {
            angle: spinAngle,
            duration: config.spinDuration || 4000,
            segmentIndex: segmentIndex
        },
        timestamp: Date.now()
    };
}

/**
 * Format spin result message for chat
 * @param {Object} spinResult - Result from processSpin
 * @returns {string} Formatted message
 */
function formatSpinResultMessage(spinResult) {
    if (!spinResult.success) {
        return spinResult.message;
    }
    
    const { username, result } = spinResult;
    const emoji = result.tokens > 0 ? '🎉💰' : '🎰';
    
    let message = `${emoji} ${username} spun the roulette and landed on: ${result.label}!`;
    
    if (result.tokens > 0) {
        message += ` They won ${result.tokens} tokens! 🎊`;
    } else if (result.prize && result.label !== 'Try Again!') {
        message += ` Prize: ${result.prize}! 🌟`;
    }
    
    return message;
}

/**
 * Format leaderboard for display
 * @param {Array} leaderboard - Array of leaderboard entries
 * @returns {string} Formatted leaderboard string
 */
function formatLeaderboard(leaderboard) {
    if (leaderboard.length === 0) {
        return "🎰 No spins recorded yet! Be the first to spin!";
    }
    
    let message = "🏆 ROULETTE LEADERBOARD 🏆\n";
    leaderboard.forEach((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${entry.username}: ${entry.totalSpins} spins (${entry.totalTipped} tokens)\n`;
    });
    
    return message;
}

/**
 * Format statistics summary for display
 * @param {Object} stats - Stats summary object
 * @returns {string} Formatted stats string
 */
function formatStatsSummary(stats) {
    return `📊 ROULETTE STATS 📊
🎰 Total Spins: ${stats.totalSpins}
💎 Tokens Collected: ${stats.totalTokensSpent}
🎁 Tokens Awarded: ${stats.totalTokensAwarded}
👥 Unique Players: ${stats.uniquePlayers}
⏱️ Session Time: ${stats.sessionDurationMinutes} minutes`;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getWeightedRandomSegment,
        calculateSpinAngle,
        processSpin,
        formatSpinResultMessage,
        formatLeaderboard,
        formatStatsSummary
    };
}

// ─── Jackpot Mechanics ────────────────────────────────────────────────────────

/**
 * Add a tip-based contribution to the roulette jackpot pool.
 * @param {number} tipAmount
 * @param {Object} kv
 * @param {Object} config
 * @returns {number} New jackpot total
 */
function addToRouletteJackpot(tipAmount, kv, config) {
    const rate         = (config && config.jackpotContribRate) || 0.05;
    const contribution = Math.floor((Number(tipAmount) || 0) * rate);
    const current      = Number(kv.get('roulette_jackpot_pool') || (config && config.jackpotSeed) || 200);
    const newTotal     = current + contribution;
    kv.set('roulette_jackpot_pool', newTotal);
    console.log(`[Roulette] Jackpot: ${current} + ${contribution} = ${newTotal}`);
    return newTotal;
}

/**
 * Claim and reset the roulette jackpot pool.
 * @param {Object} kv
 * @param {Object} config
 * @returns {number} Amount won
 */
function claimRouletteJackpot(kv, config) {
    const jackpot = Number(kv.get('roulette_jackpot_pool') || 0);
    const seed    = (config && config.jackpotSeed) || 200;
    kv.set('roulette_jackpot_pool', seed);
    kv.set('roulette_last_jackpot', { tokens: jackpot, timestamp: Date.now() });
    console.log(`[Roulette] Jackpot claimed: ${jackpot}. Pool reset to ${seed}.`);
    return jackpot;
}

/**
 * Get current jackpot pool value.
 * @param {Object} kv
 * @param {Object} config
 * @returns {number}
 */
function getRouletteJackpot(kv, config) {
    return Number(kv.get('roulette_jackpot_pool') || (config && config.jackpotSeed) || 200);
}

// ─── Streak Mechanics ─────────────────────────────────────────────────────────

/**
 * Update a user's roulette win streak.
 * @param {string} username
 * @param {boolean} isWin
 * @param {Object} kv
 * @returns {{ streak: number, multiplier: number }}
 */
function updateRouletteStreak(username, isWin, kv) {
    const key    = `roulette_streak_${username}`;
    const streak = Number(kv.get(key) || 0);

    if (isWin) {
        const newStreak  = streak + 1;
        kv.set(key, newStreak);
        const multiplier = newStreak >= 10 ? 2.0
                         : newStreak >= 5  ? 1.5
                         : newStreak >= 3  ? 1.25
                         : newStreak >= 2  ? 1.1
                         : 1.0;
        console.log(`[Roulette] ${username} streak: ${newStreak} (×${multiplier})`);
        return { streak: newStreak, multiplier };
    }

    kv.set(key, 0);
    return { streak: 0, multiplier: 1.0 };
}

/**
 * Get a user's current roulette win streak.
 * @param {string} username
 * @param {Object} kv
 * @returns {number}
 */
function getRouletteStreak(username, kv) {
    return Number(kv.get(`roulette_streak_${username}`) || 0);
}

// ─── Hot / Cold Segment Tracking ─────────────────────────────────────────────

/**
 * Record that a segment was hit.
 * @param {number|string} segmentId
 * @param {string} segmentLabel
 * @param {Object} kv
 */
function recordSegmentHit(segmentId, segmentLabel, kv) {
    const raw = kv.get('roulette_segment_hits') || '{}';
    let hits;
    try { hits = JSON.parse(raw); } catch (_) { hits = {}; }

    const key = String(segmentId);
    if (!hits[key]) hits[key] = { id: segmentId, label: segmentLabel, count: 0 };
    hits[key].count++;
    hits[key].lastHit = Date.now();

    kv.set('roulette_segment_hits', JSON.stringify(hits));
}

/**
 * Get the hottest segments (most hit this session).
 * @param {Object} kv
 * @param {number} topN
 * @returns {Array<{ label: string, count: number }>}
 */
function getHotRouletteSegments(kv, topN = 3) {
    const raw = kv.get('roulette_segment_hits') || '{}';
    let hits;
    try { hits = JSON.parse(raw); } catch (_) { return []; }

    return Object.values(hits)
        .sort((a, b) => b.count - a.count)
        .slice(0, topN)
        .map(s => ({ label: s.label, count: s.count }));
}

/**
 * Get the coldest segments (least hit this session).
 * @param {Object} kv
 * @param {number} topN
 * @returns {Array<{ label: string, count: number }>}
 */
function getColdRouletteSegments(kv, topN = 3) {
    const raw = kv.get('roulette_segment_hits') || '{}';
    let hits;
    try { hits = JSON.parse(raw); } catch (_) { return []; }

    return Object.values(hits)
        .filter(s => s.count > 0)
        .sort((a, b) => a.count - b.count)
        .slice(0, topN)
        .map(s => ({ label: s.label, count: s.count }));
}

// ─── Daily Challenge ──────────────────────────────────────────────────────────

/**
 * Get or initialize today's daily challenge.
 * @param {Object} kv
 * @param {Array} segments
 * @returns {Object} Current challenge
 */
function getDailyChallenge(kv, segments) {
    const today    = new Date().toDateString();
    const rawChall = kv.get('roulette_daily_challenge');
    let challenge;
    try { challenge = rawChall ? JSON.parse(rawChall) : null; } catch (_) { challenge = null; }

    if (!challenge || challenge.date !== today) {
        // Generate a new challenge
        const dailyChallenges = [
            { type: 'hit_segment',  description: 'Hit the JACKPOT segment',      target: 'JACKPOT!',  reward: 100 },
            { type: 'spin_count',   description: 'Reach 10 spins this session',   target: 10,          reward: 50  },
            { type: 'win_streak',   description: 'Achieve a 3-spin win streak',   target: 3,           reward: 75  },
            { type: 'total_tips',   description: 'Tip 500+ tokens today',         target: 500,         reward: 100 },
            { type: 'unique_spinners', description: 'Have 5+ unique spinners',    target: 5,           reward: 50  },
        ];
        const picked   = dailyChallenges[Math.floor(Math.random() * dailyChallenges.length)];
        challenge = { date: today, ...picked, progress: 0, completed: false };
        kv.set('roulette_daily_challenge', JSON.stringify(challenge));
    }
    return challenge;
}

/**
 * Update daily challenge progress and check if completed.
 * @param {string} type - Challenge type key
 * @param {number} newProgress - New progress value
 * @param {Object} kv
 * @returns {{ completed: boolean, justCompleted: boolean }} Status
 */
function updateDailyChallenge(type, newProgress, kv) {
    const rawChall = kv.get('roulette_daily_challenge');
    let challenge;
    try { challenge = rawChall ? JSON.parse(rawChall) : null; } catch (_) { return { completed: false, justCompleted: false }; }

    if (!challenge || challenge.type !== type) return { completed: false, justCompleted: false };
    if (challenge.completed) return { completed: true, justCompleted: false };

    const wasCompleted = challenge.completed;
    challenge.progress = Math.max(challenge.progress, newProgress);
    if (challenge.progress >= challenge.target) {
        challenge.completed = true;
    }

    kv.set('roulette_daily_challenge', JSON.stringify(challenge));
    return { completed: challenge.completed, justCompleted: challenge.completed && !wasCompleted };
}

/**
 * Format a daily challenge for chat display.
 * @param {Object} kv
 * @param {Array} [segments]
 * @returns {string}
 */
function formatDailyChallenge(kv, segments) {
    const challenge = getDailyChallenge(kv, segments || []);
    const progress  = challenge.progress || 0;
    const pct       = Math.min(100, Math.floor((progress / challenge.target) * 100));
    const bar       = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));

    const status = challenge.completed ? '✅ COMPLETED!' : `${progress}/${challenge.target} (${pct}%)`;
    return [
        `🏆 DAILY CHALLENGE 🏆`,
        `Task: ${challenge.description}`,
        `Progress: ${status}`,
        `[${bar}]`,
        `Reward: ${challenge.reward} bonus tokens on completion!`,
    ].join('\n');
}

// ─── Lucky Fortune ────────────────────────────────────────────────────────────

const ROULETTE_FORTUNES = [
    "🎡 The wheel spins in your favor tonight! Expect a big win!",
    "🔴 Red is your lucky color — watch for it on the next spin!",
    "⚫ The darkest slot holds the brightest prize. Take a chance!",
    "🌟 Your winning streak is about to begin. Don't stop now!",
    "🍀 Fortune favors the brave — and the generous tipper!",
    "💎 A rare prize awaits the persistent spinner. Keep going!",
    "🔮 The crystal ball sees your name written on the jackpot!",
    "🌈 After every losing spin comes a glorious win. Persevere!",
    "🎯 Your aim is true — you'll hit the target segment soon!",
    "⚡ An electric win is charging up just for you!",
    "🏆 Champions spin boldly. Tonight, be a champion!",
    "🎭 Fate is theatrical — your winning moment is dramatic!",
    "🐉 The dragon of fortune roars your name tonight!",
    "🌙 Under tonight's moon, every spin carries extra magic!",
    "🦁 Roar like a winner — because you're about to become one!",
];

/**
 * Generate a lucky fortune for a roulette player.
 * @param {string} [username]
 * @returns {string}
 */
function generateRouletteFortune(username) {
    const fortune = ROULETTE_FORTUNES[Math.floor(Math.random() * ROULETTE_FORTUNES.length)];
    return username ? `🔮 ${username}'s Fortune: ${fortune}` : `🔮 ${fortune}`;
}

// ─── Combo Multiplier ─────────────────────────────────────────────────────────

/**
 * Calculate a combo multiplier for rapid consecutive tips.
 * Rewards viewers who tip multiple times in a short window.
 * @param {string} username
 * @param {number} tipAmount
 * @param {Object} kv
 * @param {number} [windowMs=60000] - Combo window (default 1 minute)
 * @returns {{ multiplier: number, comboCount: number }}
 */
function calculateComboMultiplier(username, tipAmount, kv, windowMs = 60000) {
    const key     = `roulette_combo_${username}`;
    const now     = Date.now();
    const rawCombo = kv.get(key);
    let combo;
    try { combo = rawCombo ? JSON.parse(rawCombo) : null; } catch (_) { combo = null; }

    if (!combo || (now - combo.lastTipTime) > windowMs) {
        // Start new combo
        combo = { count: 1, lastTipTime: now, totalInWindow: tipAmount };
    } else {
        combo.count++;
        combo.lastTipTime = now;
        combo.totalInWindow += tipAmount;
    }

    kv.set(key, JSON.stringify(combo));

    const multiplier = combo.count >= 5 ? 2.0
                     : combo.count >= 3 ? 1.5
                     : combo.count >= 2 ? 1.2
                     : 1.0;

    return { multiplier, comboCount: combo.count };
}

// ─── Session Gift Spin Tracking ───────────────────────────────────────────────

/**
 * Gift a free spin to a user (broadcaster/mod only).
 * Records gift in KV for next spin retrieval.
 * @param {string} targetUsername
 * @param {string} gifterUsername
 * @param {Object} kv
 * @returns {boolean} Success
 */
function giftFreeSpin(targetUsername, gifterUsername, kv) {
    const key     = `roulette_gifted_spins_${targetUsername}`;
    const current = Number(kv.get(key) || 0);
    kv.set(key, current + 1);
    console.log(`[Roulette] ${gifterUsername} gifted a spin to ${targetUsername}. Total gifts: ${current + 1}`);
    return true;
}

/**
 * Consume a gifted spin for a user.
 * @param {string} username
 * @param {Object} kv
 * @returns {boolean} True if a gifted spin was consumed
 */
function consumeGiftedSpin(username, kv) {
    const key     = `roulette_gifted_spins_${username}`;
    const current = Number(kv.get(key) || 0);
    if (current > 0) {
        kv.set(key, current - 1);
        return true;
    }
    return false;
}

/**
 * Check how many gifted spins a user has.
 * @param {string} username
 * @param {Object} kv
 * @returns {number}
 */
function getGiftedSpinCount(username, kv) {
    return Number(kv.get(`roulette_gifted_spins_${username}`) || 0);
}

// ─── Achievement Checks (Roulette-Specific) ───────────────────────────────────

/**
 * Check roulette achievements and return any earned ones.
 * @param {string} username
 * @param {Object} kv
 * @param {{ isWin: boolean, isJackpot: boolean, streak: number, tipAmount: number }} spinResult
 * @returns {string[]} Array of achievement messages
 */
function checkRouletteAchievements(username, kv, spinResult) {
    const messages = [];

    // Jackpot winner
    if (spinResult.isJackpot) {
        const jackpotWins = Number(kv.get(`roulette_jackpot_wins_${username}`) || 0) + 1;
        kv.set(`roulette_jackpot_wins_${username}`, jackpotWins);
        if (jackpotWins === 1) {
            messages.push(`🏅 ACHIEVEMENT UNLOCKED for ${username}: 💰 First Jackpot Win! LEGENDARY!`);
        }
        if (jackpotWins >= 3) {
            messages.push(`🏅 ACHIEVEMENT UNLOCKED for ${username}: 💰💰 Jackpot Hat Trick! Incredible!`);
        }
    }

    // Win streak milestones
    if (spinResult.streak === 3)  messages.push(`🏅 ${username} achieved a 3-WIN STREAK! 🔥`);
    if (spinResult.streak === 5)  messages.push(`🏅 ${username} achieved a 5-WIN STREAK! ⚡ UNSTOPPABLE!`);
    if (spinResult.streak === 10) messages.push(`🏅 ${username} reached a 10-WIN STREAK! 👑 LEGENDARY!`);

    // Big tip achievement
    if (spinResult.tipAmount >= 500) {
        const bigTips = Number(kv.get(`roulette_big_tips_${username}`) || 0) + 1;
        kv.set(`roulette_big_tips_${username}`, bigTips);
        if (bigTips === 1) messages.push(`🏅 ACHIEVEMENT UNLOCKED for ${username}: 💸 Big Spender!`);
    }

    return messages;
}
