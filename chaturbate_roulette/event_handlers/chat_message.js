// --- Chat Message Event Handler ---
// PASTE INTO: Event Handlers -> Chat -> Chat Message
// Handles commands for roulette game

console.log("--- Roulette Chat Message Handler ---");

const ROULETTE_PREFIX = ['/', '!'];
const ROULETTE_COMMANDS = {};

// --- Helper Functions ---

async function sendRouletteNotice(message, options = {}) {
    await $room.sendNotice(message, options);
}

function logRoulette(level, message) {
    console.log(`Roulette - ${level.toUpperCase()}: ${message}`);
}

function parseRouletteCommand(messageText) {
    const prefix = ROULETTE_PREFIX.find(p => messageText.startsWith(p));
    if (!prefix) return null;
    
    const parts = messageText.substring(prefix.length).trim().split(' ');
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);
    return { prefix, commandName, args };
}

function registerRouletteCommand(name, handler, description = '', adminOnly = false) {
    ROULETTE_COMMANDS[name.toLowerCase()] = { handler, description, adminOnly };
}

function isRouletteAdmin(user) {
    if (!user) return false;
    if (user.is_broadcaster) return true;
    if ($room && $room.owner === user.username) return true;
    if (user.is_mod) return true;
    return false;
}

// --- Command Handlers ---

// Help command
async function handleRouletteHelp(args, user) {
    let helpMessage = "🎰 ROULETTE COMMANDS 🎰\n";
    
    for (const [name, info] of Object.entries(ROULETTE_COMMANDS)) {
        if (info.adminOnly && !isRouletteAdmin(user)) continue;
        const adminTag = info.adminOnly ? ' [ADMIN]' : '';
        helpMessage += `/${name}${adminTag}: ${info.description}\n`;
    }
    
    await sendRouletteNotice(helpMessage, { toUsername: user.username });
}
registerRouletteCommand('roulette_help', handleRouletteHelp, 'Show roulette commands');
registerRouletteCommand('rhelp', handleRouletteHelp, 'Show roulette commands');

// Stats command
async function handleRouletteStats(args, user) {
    const trackingString = $kv.get('roulette_tracking');
    if (!trackingString) {
        await sendRouletteNotice("📊 No stats available yet!", { toUsername: user.username });
        return;
    }
    
    const tracking = JSON.parse(trackingString);
    const uniquePlayers = Object.keys(tracking.userStats).length;
    const sessionMinutes = Math.floor((Date.now() - tracking.sessionStartTime) / 60000);
    
    const statsMessage = `📊 ROULETTE STATS 📊
🎰 Total Spins: ${tracking.totalSpins}
💎 Tokens Collected: ${tracking.totalTokensSpent}
🎁 Tokens Awarded: ${tracking.totalTokensAwarded}
💰 Net: ${tracking.totalTokensSpent - tracking.totalTokensAwarded} tokens
👥 Unique Players: ${uniquePlayers}
⏱️ Session: ${sessionMinutes} minutes`;
    
    await sendRouletteNotice(statsMessage, { toUsername: user.username });
}
registerRouletteCommand('roulette_stats', handleRouletteStats, 'View game statistics');
registerRouletteCommand('rstats', handleRouletteStats, 'View game statistics');

// Leaderboard command
async function handleRouletteTop(args, user) {
    const trackingString = $kv.get('roulette_tracking');
    if (!trackingString) {
        await sendRouletteNotice("🏆 No leaderboard data yet!", { toUsername: user.username });
        return;
    }
    
    const tracking = JSON.parse(trackingString);
    const entries = Object.entries(tracking.userStats)
        .map(([username, stats]) => ({
            username,
            totalSpins: stats.totalSpins,
            totalTipped: stats.totalTipped,
            totalWon: stats.totalWon
        }))
        .sort((a, b) => b.totalTipped - a.totalTipped)
        .slice(0, 10);
    
    if (entries.length === 0) {
        await sendRouletteNotice("🏆 No spins yet! Be the first!", { toUsername: user.username });
        return;
    }
    
    let message = "🏆 ROULETTE LEADERBOARD 🏆\n";
    entries.forEach((entry, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${entry.username}: ${entry.totalSpins} spins (${entry.totalTipped} tokens)\n`;
    });
    
    await sendRouletteNotice(message);
}
registerRouletteCommand('roulette_top', handleRouletteTop, 'View top spinners');
registerRouletteCommand('rtop', handleRouletteTop, 'View top spinners');

// My stats command
async function handleRouletteMe(args, user) {
    const trackingString = $kv.get('roulette_tracking');
    if (!trackingString) {
        await sendRouletteNotice("📊 No stats available!", { toUsername: user.username });
        return;
    }
    
    const tracking = JSON.parse(trackingString);
    const myStats = tracking.userStats[user.username];
    
    if (!myStats) {
        await sendRouletteNotice(`🎰 ${user.username}, you haven't spun yet! Tip to play!`, { toUsername: user.username });
        return;
    }
    
    const message = `📊 ${user.username}'s ROULETTE STATS 📊
🎰 Spins: ${myStats.totalSpins}
💎 Spent: ${myStats.totalTipped} tokens
🎁 Won: ${myStats.totalWon} tokens
📈 Net: ${myStats.totalWon - myStats.totalTipped} tokens`;
    
    await sendRouletteNotice(message, { toUsername: user.username });
}
registerRouletteCommand('roulette_me', handleRouletteMe, 'View your stats');
registerRouletteCommand('rme', handleRouletteMe, 'View your stats');

// Recent spins command
async function handleRouletteRecent(args, user) {
    const trackingString = $kv.get('roulette_tracking');
    if (!trackingString) {
        await sendRouletteNotice("📜 No recent spins!", { toUsername: user.username });
        return;
    }
    
    const tracking = JSON.parse(trackingString);
    const recentSpins = tracking.spinHistory.slice(0, 5);
    
    if (recentSpins.length === 0) {
        await sendRouletteNotice("📜 No recent spins yet!", { toUsername: user.username });
        return;
    }
    
    let message = "📜 RECENT SPINS 📜\n";
    recentSpins.forEach((spin, index) => {
        const winText = spin.tokens > 0 ? ` (+${spin.tokens})` : '';
        message += `${index + 1}. ${spin.username}: ${spin.result}${winText}\n`;
    });
    
    await sendRouletteNotice(message, { toUsername: user.username });
}
registerRouletteCommand('roulette_recent', handleRouletteRecent, 'View recent spins');
registerRouletteCommand('rrecent', handleRouletteRecent, 'View recent spins');

// Prize list command
async function handleRoulettePrizes(args, user) {
    const configString = $kv.get('roulette_config');
    if (!configString) {
        await sendRouletteNotice("🎁 Configuration not loaded!", { toUsername: user.username });
        return;
    }
    
    const config = JSON.parse(configString);
    
    let message = `🎁 ROULETTE PRIZES 🎁\nSpin Cost: ${config.spinCost} tokens\n\n`;
    config.segments.forEach(seg => {
        const tokenPrize = seg.tokens > 0 ? ` [+${seg.tokens} tokens]` : '';
        message += `• ${seg.label}${tokenPrize}\n`;
    });
    
    await sendRouletteNotice(message, { toUsername: user.username });
}
registerRouletteCommand('roulette_prizes', handleRoulettePrizes, 'View available prizes');
registerRouletteCommand('rprizes', handleRoulettePrizes, 'View available prizes');

// Winners command
async function handleRouletteWinners(args, user) {
    const trackingString = $kv.get('roulette_tracking');
    if (!trackingString) {
        await sendRouletteNotice("🏆 No winners yet!", { toUsername: user.username });
        return;
    }
    
    const tracking = JSON.parse(trackingString);
    const winners = Object.entries(tracking.userStats)
        .map(([username, stats]) => ({
            username,
            totalWon: stats.totalWon
        }))
        .filter(e => e.totalWon > 0)
        .sort((a, b) => b.totalWon - a.totalWon)
        .slice(0, 10);
    
    if (winners.length === 0) {
        await sendRouletteNotice("🏆 No token winners yet! Spin to be the first!", { toUsername: user.username });
        return;
    }
    
    let message = "🏆 BIGGEST WINNERS 🏆\n";
    winners.forEach((winner, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${winner.username}: ${winner.totalWon} tokens\n`;
    });
    
    await sendRouletteNotice(message);
}
registerRouletteCommand('roulette_winners', handleRouletteWinners, 'View biggest winners');
registerRouletteCommand('rwinners', handleRouletteWinners, 'View biggest winners');

// --- Admin Commands ---

// Set spin cost
async function handleRouletteSetCost(args, user) {
    if (!isRouletteAdmin(user)) {
        await sendRouletteNotice("❌ Admin only command!", { toUsername: user.username });
        return;
    }
    
    if (args.length !== 1 || isNaN(args[0])) {
        await sendRouletteNotice("Usage: /roulette_setcost [tokens]", { toUsername: user.username });
        return;
    }
    
    const newCost = parseInt(args[0], 10);
    if (newCost < 1) {
        await sendRouletteNotice("❌ Cost must be at least 1 token!", { toUsername: user.username });
        return;
    }
    
    const configString = $kv.get('roulette_config');
    const config = configString ? JSON.parse(configString) : {};
    config.spinCost = newCost;
    $kv.set('roulette_config', JSON.stringify(config));
    
    await sendRouletteNotice(`✅ Spin cost set to ${newCost} tokens!`);
    logRoulette('info', `${user.username} set spin cost to ${newCost}`);
}
registerRouletteCommand('roulette_setcost', handleRouletteSetCost, 'Set spin cost [tokens]', true);
registerRouletteCommand('rsetcost', handleRouletteSetCost, 'Set spin cost [tokens]', true);

// Set cooldown
async function handleRouletteSetCooldown(args, user) {
    if (!isRouletteAdmin(user)) {
        await sendRouletteNotice("❌ Admin only command!", { toUsername: user.username });
        return;
    }
    
    if (args.length !== 1 || isNaN(args[0])) {
        await sendRouletteNotice("Usage: /roulette_setcooldown [seconds]", { toUsername: user.username });
        return;
    }
    
    const newCooldown = parseInt(args[0], 10);
    
    const configString = $kv.get('roulette_config');
    const config = configString ? JSON.parse(configString) : {};
    config.spinCooldown = newCooldown;
    $kv.set('roulette_config', JSON.stringify(config));
    
    await sendRouletteNotice(`✅ Spin cooldown set to ${newCooldown} seconds!`, { toUsername: user.username });
    logRoulette('info', `${user.username} set spin cooldown to ${newCooldown}`);
}
registerRouletteCommand('roulette_setcooldown', handleRouletteSetCooldown, 'Set spin cooldown [seconds]', true);
registerRouletteCommand('rsetcd', handleRouletteSetCooldown, 'Set spin cooldown [seconds]', true);

// Reset stats
async function handleRouletteReset(args, user) {
    if (!isRouletteAdmin(user)) {
        await sendRouletteNotice("❌ Admin only command!", { toUsername: user.username });
        return;
    }
    
    const confirmArg = args[0]?.toLowerCase();
    if (confirmArg !== 'confirm') {
        await sendRouletteNotice("⚠️ This will reset ALL stats! Type /roulette_reset confirm", { toUsername: user.username });
        return;
    }
    
    const initialData = {
        totalSpins: 0,
        totalTokensSpent: 0,
        totalTokensAwarded: 0,
        spinHistory: [],
        userStats: {},
        segmentStats: {},
        sessionStartTime: Date.now(),
        lastUpdated: Date.now()
    };
    $kv.set('roulette_tracking', JSON.stringify(initialData));
    
    await sendRouletteNotice("✅ Roulette stats have been reset!");
    logRoulette('info', `${user.username} reset roulette stats`);
}
registerRouletteCommand('roulette_reset', handleRouletteReset, 'Reset all stats [confirm]', true);
registerRouletteCommand('rreset', handleRouletteReset, 'Reset all stats [confirm]', true);

// Announce roulette
async function handleRouletteAnnounce(args, user) {
    if (!isRouletteAdmin(user)) {
        await sendRouletteNotice("❌ Admin only command!", { toUsername: user.username });
        return;
    }
    
    const configString = $kv.get('roulette_config');
    const config = configString ? JSON.parse(configString) : { spinCost: 50 };
    
    const message = args.length > 0 
        ? args.join(' ')
        : `🎰 ROULETTE GAME IS ACTIVE! 🎰\nTip ${config.spinCost} tokens to spin the wheel and win prizes!\nType /rprizes to see what you can win!`;
    
    await sendRouletteNotice(message);
    logRoulette('info', `${user.username} triggered roulette announcement`);
}
registerRouletteCommand('roulette_announce', handleRouletteAnnounce, 'Send game announcement [message]', true);
registerRouletteCommand('rannounce', handleRouletteAnnounce, 'Send game announcement [message]', true);

// --- Main Handler Logic ---

(async () => {
    try {
        const messageBody = $message.body;
        const user = $user;
        
        // Check for command prefix
        const parsed = parseRouletteCommand(messageBody);
        if (!parsed) return; // Not a command
        
        const { commandName, args } = parsed;
        const commandInfo = ROULETTE_COMMANDS[commandName];
        
        if (!commandInfo) return; // Not a roulette command
        
        // Check admin permission
        if (commandInfo.adminOnly && !isRouletteAdmin(user)) {
            await sendRouletteNotice("❌ You don't have permission to use this command!", { toUsername: user.username });
            return;
        }
        
        // Execute command
        logRoulette('info', `${user.username} executed /${commandName} with args: ${args.join(' ')}`);
        await commandInfo.handler(args, user);
        
    } catch (error) {
        console.error("### ERROR in Roulette Chat Handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }
})();

// ─── New commands appended below ─────────────────────────────────────────────

// Ensure these use the same registerRouletteCommand and ROULETTE_COMMANDS pattern

// !rjackpot — Show jackpot pool
registerRouletteCommand('rjackpot', async (args, user) => {
    const jackpot   = Number($kv.get('roulette_jackpot_pool') || 0);
    const lastWin   = $kv.get('roulette_last_jackpot');
    const cfgRaw    = $kv.get('roulette_config') || '{}';
    const config    = JSON.parse(cfgRaw);
    let msg = `💰 ROULETTE JACKPOT: ${jackpot} tokens! Tip ${config.spinCost || 50}+ to spin and WIN IT ALL!`;
    if (lastWin) {
        try {
            const w = typeof lastWin === 'string' ? JSON.parse(lastWin) : lastWin;
            msg += `\nLast winner: ${w.tokens} tokens`;
        } catch (_) {}
    } else {
        msg += '\nNo jackpot winner yet — be the FIRST! 🏆';
    }
    await sendRouletteNotice(msg, { toUsername: user.username });
}, 'Show current jackpot pool');

// !rstreak — Show win streak
registerRouletteCommand('rstreak', async (args, user) => {
    const target  = (args[0] || user.username).toLowerCase();
    const streak  = typeof getRouletteStreak === 'function' ? getRouletteStreak(target, $kv) : 0;
    const emoji   = streak >= 10 ? '👑' : streak >= 5 ? '💥' : streak >= 3 ? '⚡' : '🔥';
    if (streak === 0) {
        await sendRouletteNotice(`🎡 ${target} has no active win streak. Spin to start one! 🎰`, { toUsername: user.username });
    } else {
        await sendRouletteNotice(`${emoji} ${target}'s win streak: ${streak}!`, { toUsername: user.username });
    }
}, 'Show win streak [username]');

// !rhot — Show hot segments
registerRouletteCommand('rhot', async (args, user) => {
    const hot  = typeof getHotRouletteSegments  === 'function' ? getHotRouletteSegments($kv, 5)  : [];
    const cold = typeof getColdRouletteSegments === 'function' ? getColdRouletteSegments($kv, 3) : [];
    let msg = '🔥 HOT SEGMENTS:\n';
    if (hot.length > 0)  msg += hot.map((s, i) => `${i + 1}. ${s.label} (${s.count} hits)`).join('\n');
    else msg += 'No data yet!';
    if (cold.length > 0) msg += '\n\n🧊 COLD SEGMENTS:\n' + cold.map((s, i) => `${i + 1}. ${s.label} (${s.count} hits)`).join('\n');
    await sendRouletteNotice(msg, { toUsername: user.username });
}, 'Show hot/cold segments');

// !rfortune — Lucky fortune reading
registerRouletteCommand('rfortune', async (args, user) => {
    const fortune = typeof generateRouletteFortune === 'function'
        ? generateRouletteFortune(user.username)
        : `🔮 ${user.username}: The wheel turns in your favor tonight! ✨`;
    await sendRouletteNotice(fortune, { toUsername: user.username });
}, 'Get your roulette fortune reading');

// !rdaily — Daily challenge status
registerRouletteCommand('rdaily', async (args, user) => {
    const msg = typeof formatDailyChallenge === 'function'
        ? formatDailyChallenge($kv)
        : '🏆 Daily challenge data not available.';
    await sendRouletteNotice(msg, { toUsername: user.username });
}, 'View today\'s daily challenge');

// !rtop — Roulette leaderboard
registerRouletteCommand('rtop', async (args, user) => {
    const msg = typeof formatRouletteLeaderboard === 'function'
        ? formatRouletteLeaderboard($kv, 10)
        : '🏆 Leaderboard not available.';
    await sendRouletteNotice(msg, { toUsername: user.username });
}, 'View roulette leaderboard');

// !rmystats — Personal stats
registerRouletteCommand('rmystats', async (args, user) => {
    const msg = typeof getUserSpinSummary === 'function'
        ? getUserSpinSummary(user.username, $kv)
        : '🎡 Personal stats not available.';
    await sendRouletteNotice(msg, { toUsername: user.username });
}, 'View your personal roulette stats');

// !rgift — Gift a spin (admin only)
registerRouletteCommand('rgift', async (args, user) => {
    if (!isRouletteAdmin(user)) {
        await sendRouletteNotice('❌ Admin only!', { toUsername: user.username });
        return;
    }
    if (!args[0]) {
        await sendRouletteNotice('Usage: !rgift [username]', { toUsername: user.username });
        return;
    }
    const target = args[0].toLowerCase();
    if (typeof giftFreeSpin === 'function') {
        giftFreeSpin(target, user.username, $kv);
        await sendRouletteNotice(`🎁 ${user.username} gifted a FREE SPIN to ${target}! 🎡`);
    } else {
        await sendRouletteNotice('❌ Gift spin function not available.', { toUsername: user.username });
    }
}, 'Gift a free spin to a user (admin)', true);

// !rsession — Session summary (admin only)
registerRouletteCommand('rsession', async (args, user) => {
    if (!isRouletteAdmin(user)) {
        await sendRouletteNotice('❌ Admin only!', { toUsername: user.username });
        return;
    }
    const msg = typeof formatSessionSummary === 'function'
        ? formatSessionSummary($kv)
        : '📊 Session summary not available.';
    await sendRouletteNotice(msg, { toUsername: user.username });
}, 'View session stats summary (admin)', true);

// !rsetjackpot — Manually set jackpot (admin only)
registerRouletteCommand('rsetjackpot', async (args, user) => {
    if (!isRouletteAdmin(user)) {
        await sendRouletteNotice('❌ Admin only!', { toUsername: user.username });
        return;
    }
    if (!args[0] || isNaN(args[0])) {
        await sendRouletteNotice('Usage: !rsetjackpot [amount]', { toUsername: user.username });
        return;
    }
    const amount = parseInt(args[0], 10);
    $kv.set('roulette_jackpot_pool', amount);
    await sendRouletteNotice(`✅ Roulette jackpot set to ${amount} tokens!`);
}, 'Set jackpot pool (admin)', true);

// !rachievements — Check user achievements
registerRouletteCommand('rachievements', async (args, user) => {
    const target = (args[0] || user.username).toLowerCase();
    const jackpotWins = Number($kv.get(`roulette_jackpot_wins_${target}`) || 0);
    const streak      = typeof getRouletteStreak === 'function' ? getRouletteStreak(target, $kv) : 0;
    const bigTips     = Number($kv.get(`roulette_big_tips_${target}`) || 0);
    const lines = [
        `🏅 ${target}'s ROULETTE ACHIEVEMENTS 🏅`,
        `💰 Jackpot Wins: ${jackpotWins}`,
        `🔥 Best Streak: (session) ${streak}`,
        `💸 Big Tips (500+): ${bigTips}`,
    ];
    await sendRouletteNotice(lines.join('\n'), { toUsername: user.username });
}, 'View roulette achievements [username]');
