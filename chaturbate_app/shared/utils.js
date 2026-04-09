// --- Code executed BEFORE every event handler ---
// Shared utility functions and constants available to all event handlers.

// ─── Color Constants ──────────────────────────────────────────────────────────
const APP_BLUE    = '#00539B';
const APP_GREEN   = '#00ff00';
const APP_RED     = '#ff0000';
const APP_GOLD    = '#FFD700';
const APP_PURPLE  = '#9B59B6';
const APP_PINK    = '#FF69B4';
const APP_TEAL    = '#1ABC9C';
const APP_ORANGE  = '#E67E22';

// ─── Prefix Constants ────────────────────────────────────────────────────────
const APP_DEFAULT_PREFIX = '!';
const APP_COMMAND_PREFIXES = ['!', '/'];

// ─── VIP Tier Thresholds (lifetime tokens tipped) ────────────────────────────
const VIP_TIERS = [
    { name: 'Bronze',   minTokens: 0,     emoji: '🥉', color: '#CD7F32' },
    { name: 'Silver',   minTokens: 500,   emoji: '🥈', color: '#C0C0C0' },
    { name: 'Gold',     minTokens: 2000,  emoji: '🥇', color: '#FFD700' },
    { name: 'Platinum', minTokens: 5000,  emoji: '💎', color: '#00BFFF' },
    { name: 'Diamond',  minTokens: 15000, emoji: '💍', color: '#FF00FF' },
    { name: 'Legend',   minTokens: 50000, emoji: '👑', color: '#FF4500' },
];

// ─── Achievement Definitions ─────────────────────────────────────────────────
const ACHIEVEMENTS = {
    first_tip:        { label: 'First Tip!',          emoji: '🎯', threshold: 1    },
    ten_tips:         { label: '10 Tips!',             emoji: '🔥', threshold: 10   },
    big_spender:      { label: 'Big Spender!',         emoji: '💸', threshold: 500  },
    whale:            { label: 'Whale!',               emoji: '🐋', threshold: 5000 },
    first_follow:     { label: 'New Follower!',        emoji: '❤️', threshold: 1    },
    fanclub_member:   { label: 'Fanclub Member!',      emoji: '⭐', threshold: 1    },
    spin_master:      { label: 'Spin Master (10 spins)',emoji: '🎰', threshold: 10  },
    jackpot_winner:   { label: 'Jackpot Winner!',      emoji: '🏆', threshold: 1    },
    media_buyer:      { label: 'Media Collector!',     emoji: '📸', threshold: 5    },
    chatterbox:       { label: 'Chatterbox (100 msgs)',emoji: '💬', threshold: 100  },
};

// ─── Lucky Fortunes Pool ─────────────────────────────────────────────────────
const LUCKY_FORTUNES = [
    "✨ The stars align in your favor today! Expect something wonderful!",
    "🔥 Your energy is unstoppable — fortune favors the bold!",
    "💎 A diamond shines brightest under pressure. Keep going!",
    "🌈 Good vibes are heading your way like a freight train of joy!",
    "🍀 Today is your lucky day! The wheel of fortune spins in your direction!",
    "👑 You carry the energy of royalty. The room bows to your presence!",
    "🌟 A big win is on the horizon — stay in the game!",
    "💖 Love and luck surround you tonight. Enjoy every moment!",
    "🎯 You are precisely where you are meant to be right now!",
    "🚀 Something exciting is about to happen — brace yourself!",
    "🦋 Transformation is in the air — ride the wave!",
    "🌙 Under tonight's moon, your wishes carry extra power!",
    "⚡ Electric energy flows through this room tonight — you're part of it!",
    "🍓 Sweet surprises await those who dare to spin!",
    "🎪 Life is a carnival and tonight you have VIP access!",
    "🔮 The crystal ball sees a dazzling win in your near future!",
    "💃 Dance like nobody's watching — your lucky charm is activated!",
    "🎊 Confetti is already falling in the universe just for you!",
    "🌺 Bloom where you're planted — riches grow from positive energy!",
    "🦄 Rare and magical things happen to those who believe. Believe!",
];

// ─── Streak Emoji Ladder ─────────────────────────────────────────────────────
const STREAK_EMOJIS = ['🎯','🔥','🔥🔥','⚡','💥','🌟','👑','💎','🏆','🚀'];

// ─── Permission Helpers ───────────────────────────────────────────────────────

/**
 * Check if the given user may use an admin/mod command.
 * @param {Object} user - $user object passed from the handler
 * @param {Object} kv   - $kv store reference
 * @returns {boolean}
 */
function canUserUseAdminCommand(user, kv) {
    if (!user) return false;
    if (user.is_broadcaster) return true;
    if (user.is_mod) return true;
    const modUsernames = (kv && kv.get('moderator_usernames')) || [];
    if (user.username && modUsernames.includes(user.username)) return true;
    return false;
}

/**
 * Return true if the username is in the broadcaster / mod / VIP list.
 * @param {string} username
 * @param {Object} kv
 * @returns {boolean}
 */
function isVipUser(username, kv) {
    if (!username || !kv) return false;
    const vipUsers = kv.get('vip_users') || [];
    return vipUsers.includes(username);
}

// ─── Command Parsing ──────────────────────────────────────────────────────────

/**
 * Extract a command and its arguments from a message string.
 * @param {string} messageText
 * @param {string} prefix
 * @returns {{ command: string, args: string[] }|null}
 */
function extractCommand(messageText, prefix) {
    if (!messageText || !prefix || !messageText.startsWith(prefix)) return null;
    const parts = messageText.substring(prefix.length).trim().split(/\s+/);
    return { command: parts[0].toLowerCase(), args: parts.slice(1) };
}

/**
 * Find the index of the first slash-prefixed word in a (possibly pre-split) array.
 * @param {string[]} message - Array of words
 * @returns {number} Index or -1
 */
function getCommandIndex(message) {
    for (let i = 0; i < message.length; i++) {
        if (message[i].charAt(0) === '/') return i;
    }
    return -1;
}

// ─── Number & Token Formatting ────────────────────────────────────────────────

/**
 * Format a number with thousands-separating commas.
 * @param {number} n
 * @returns {string} e.g. 1,234,567
 */
function formatNumber(n) {
    return Number(n || 0).toLocaleString('en-US');
}

/**
 * Friendly token label — "1 token" vs "42 tokens".
 * @param {number} amount
 * @returns {string}
 */
function formatTokens(amount) {
    const n = Number(amount) || 0;
    return `${formatNumber(n)} ${n === 1 ? 'token' : 'tokens'}`;
}

/**
 * Shorten large numbers for compact display (1.2k, 3.4m, etc.).
 * @param {number} n
 * @returns {string}
 */
function shortNumber(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

// ─── Progress Display ─────────────────────────────────────────────────────────

/**
 * Generate a Unicode block progress bar.
 * @param {number} current  - Current value
 * @param {number} total    - Maximum value
 * @param {number} width    - Number of characters wide (default 20)
 * @returns {string} e.g. "████████░░░░░░░░░░░░ 40%"
 */
function generateProgressBar(current, total, width = 20) {
    if (!total || total <= 0) return '░'.repeat(width) + ' 0%';
    const pct  = Math.min(1, current / total);
    const fill = Math.round(pct * width);
    const empty = width - fill;
    const bar  = '█'.repeat(fill) + '░'.repeat(empty);
    return `${bar} ${Math.floor(pct * 100)}%`;
}

/**
 * Generate an emoji-based progress bar (hearts/stars).
 * @param {number} current
 * @param {number} total
 * @param {number} steps
 * @param {{ filled?: string, empty?: string }} opts
 * @returns {string}
 */
function generateEmojiProgressBar(current, total, steps = 10, opts = {}) {
    const filled = opts.filled || '❤️';
    const empty  = opts.empty  || '🖤';
    const pct    = Math.min(1, (current || 0) / (total || 1));
    const done   = Math.round(pct * steps);
    return filled.repeat(done) + empty.repeat(steps - done);
}

// ─── Time Helpers ─────────────────────────────────────────────────────────────

/**
 * Return a human-readable "time ago" string from a Unix ms timestamp.
 * @param {number} timestamp - Date.now()-style ms
 * @returns {string} e.g. "3 minutes ago"
 */
function getTimeAgo(timestamp) {
    const diff = Date.now() - (timestamp || 0);
    const sec  = Math.floor(diff / 1000);
    if (sec < 60)   return `${sec} second${sec !== 1 ? 's' : ''} ago`;
    const min  = Math.floor(sec / 60);
    if (min < 60)   return `${min} minute${min !== 1 ? 's' : ''} ago`;
    const hr   = Math.floor(min / 60);
    if (hr  < 24)   return `${hr} hour${hr !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hr / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Format milliseconds as MM:SS or HH:MM:SS.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
    const totalSec = Math.floor((ms || 0) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ─── VIP Tier System ──────────────────────────────────────────────────────────

/**
 * Determine a user's VIP tier based on lifetime tokens tipped.
 * @param {number} lifetimeTokens
 * @returns {{ name: string, emoji: string, color: string, minTokens: number }}
 */
function calculateUserTier(lifetimeTokens) {
    const tokens = Number(lifetimeTokens) || 0;
    let tier = VIP_TIERS[0];
    for (const t of VIP_TIERS) {
        if (tokens >= t.minTokens) tier = t;
    }
    return tier;
}

/**
 * Get the next VIP tier above the current one, or null if already Legend.
 * @param {number} lifetimeTokens
 * @returns {{ tier: Object, tokensNeeded: number }|null}
 */
function getNextTier(lifetimeTokens) {
    const tokens = Number(lifetimeTokens) || 0;
    for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
        if (tokens >= VIP_TIERS[i].minTokens) {
            const next = VIP_TIERS[i + 1];
            if (!next) return null;
            return { tier: next, tokensNeeded: next.minTokens - tokens };
        }
    }
    return { tier: VIP_TIERS[1], tokensNeeded: VIP_TIERS[1].minTokens - tokens };
}

// ─── Achievement System ───────────────────────────────────────────────────────

/**
 * Check whether a user has just crossed an achievement threshold.
 * @param {string} achievementKey - Key in ACHIEVEMENTS
 * @param {number} currentValue   - User's current counter value (after update)
 * @returns {{ label: string, emoji: string }|null} The earned achievement or null
 */
function checkAchievement(achievementKey, currentValue) {
    const achievement = ACHIEVEMENTS[achievementKey];
    if (!achievement) return null;
    if (currentValue === achievement.threshold) return achievement;
    return null;
}

/**
 * Return a formatted badge string for an achievement.
 * @param {{ label: string, emoji: string }} achievement
 * @param {string} username
 * @returns {string}
 */
function getAchievementBadge(achievement, username) {
    if (!achievement) return '';
    return `🏅 ACHIEVEMENT UNLOCKED for ${username}: ${achievement.emoji} ${achievement.label}`;
}

// ─── Streak Helpers ───────────────────────────────────────────────────────────

/**
 * Get a themed emoji for the current win-streak level.
 * @param {number} streak
 * @returns {string}
 */
function getStreakEmoji(streak) {
    const idx = Math.min(streak - 1, STREAK_EMOJIS.length - 1);
    return idx >= 0 ? STREAK_EMOJIS[idx] : '';
}

/**
 * Calculate a streak token bonus multiplier.
 * @param {number} streak - Current consecutive wins
 * @returns {number} Multiplier (1.0 = no bonus)
 */
function calculateStreakMultiplier(streak) {
    if (streak <= 1)  return 1.0;
    if (streak <= 3)  return 1.1;
    if (streak <= 5)  return 1.25;
    if (streak <= 10) return 1.5;
    return 2.0; // Cap at 2× for mega streaks
}

// ─── Random / Fun Helpers ─────────────────────────────────────────────────────

/**
 * Pick a random element from an array.
 * @param {Array} arr
 * @returns {*}
 */
function pickRandom(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Return a random lucky fortune message, optionally prefixed with the username.
 * @param {string} [username]
 * @returns {string}
 */
function generateLuckyFortune(username) {
    const fortune = pickRandom(LUCKY_FORTUNES);
    return username ? `🔮 ${username}'s Fortune: ${fortune}` : `🔮 ${fortune}`;
}

/**
 * Pluralize a word based on count.
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string} e.g. "1 spin" or "3 spins"
 */
function pluralize(count, singular, plural) {
    const word = count === 1 ? singular : (plural || singular + 's');
    return `${count} ${word}`;
}

/**
 * Clamp a number between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Generate a random integer in [min, max] inclusive.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Tip Goal Helpers ─────────────────────────────────────────────────────────

/**
 * Format a tip-goal progress line suitable for chat or panel display.
 * @param {number} current
 * @param {number} target
 * @param {string} [goalLabel]
 * @returns {string}
 */
function formatTipGoal(current, target, goalLabel) {
    const label = goalLabel || 'Tip Goal';
    if (!target || target <= 0) return `${label}: Not Set`;
    const pct  = Math.min(100, Math.floor((current / target) * 100));
    const bar  = generateProgressBar(current, target, 15);
    return `${label}: ${formatNumber(current)} / ${formatNumber(target)} tokens\n${bar}`;
}

/**
 * Determine whether a tip-goal milestone was just crossed and return a celebration string.
 * Milestones fire at 25 %, 50 %, 75 %, 90 %, and 100 %.
 * @param {number} previousTotal
 * @param {number} newTotal
 * @param {number} goal
 * @returns {string|null} Celebration message or null
 */
function checkTipGoalMilestone(previousTotal, newTotal, goal) {
    if (!goal || goal <= 0) return null;
    const milestones = [25, 50, 75, 90, 100];
    for (const pct of milestones) {
        const threshold = Math.floor(goal * (pct / 100));
        if (previousTotal < threshold && newTotal >= threshold) {
            if (pct === 100) {
                return `🎉🎊 TIP GOAL REACHED! ${formatNumber(goal)} tokens! THANK YOU! 🎊🎉`;
            }
            return `🎯 ${pct}% of the Tip Goal reached! ${formatNumber(newTotal)} / ${formatNumber(goal)} tokens — keep going! 💪`;
        }
    }
    return null;
}

// ─── Jackpot Helpers ──────────────────────────────────────────────────────────

/**
 * Calculate the jackpot contribution from a tip.
 * @param {number} tipAmount
 * @param {number} [contributionRate=0.05] - Fraction of tip added to jackpot
 * @returns {number} Tokens to add to jackpot pool
 */
function calculateJackpotContribution(tipAmount, contributionRate = 0.05) {
    return Math.floor((Number(tipAmount) || 0) * contributionRate);
}

/**
 * Format a jackpot announcement string.
 * @param {number} jackpot
 * @returns {string}
 */
function formatJackpotDisplay(jackpot) {
    return `💰 JACKPOT POOL: ${formatTokens(jackpot)} 💰`;
}

// ─── Leaderboard Formatter ────────────────────────────────────────────────────

/**
 * Format a top-N list into a ranked string for chat display.
 * @param {Array<{ username: string, score: number }>} entries
 * @param {{ title?: string, scoreLabel?: string, limit?: number }} opts
 * @returns {string}
 */
function formatLeaderboard(entries, opts = {}) {
    const title      = opts.title      || '🏆 LEADERBOARD 🏆';
    const scoreLabel = opts.scoreLabel || 'tokens';
    const limit      = opts.limit      || 10;
    const MEDALS     = ['🥇', '🥈', '🥉'];

    const top = (entries || []).slice(0, limit);
    if (top.length === 0) return `${title}\nNo entries yet!`;

    const lines = top.map((e, i) => {
        const rank = MEDALS[i] || `${i + 1}.`;
        return `${rank} ${e.username}: ${formatNumber(e.score)} ${scoreLabel}`;
    });
    return `${title}\n${lines.join('\n')}`;
}
