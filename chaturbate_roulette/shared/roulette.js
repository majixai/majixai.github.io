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
