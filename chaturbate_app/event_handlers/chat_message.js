// --- Chat Message Event Handler ---
// Handles all chat commands with prefix "!" or "/".

const COMMAND_PREFIXES = ['/', '!'];
const COMMAND_HANDLERS = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendMsg(message, options = {}) {
    if ($room && typeof $room.sendNotice === 'function') {
        await $room.sendNotice(message, options);
    }
}

function logCmd(level, message) {
    console.log(`[ChatCmd] ${level.toUpperCase()}: ${message}`);
}

function parseCmd(messageText) {
    const prefix = COMMAND_PREFIXES.find(p => messageText.startsWith(p));
    if (!prefix) return null;
    const parts       = messageText.substring(prefix.length).trim().split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args        = parts.slice(1);
    return { prefix, commandName, args };
}

function registerCommand(name, handler, description = '', adminOnly = false) {
    for (const p of COMMAND_PREFIXES) {
        COMMAND_HANDLERS[`${p}${name.toLowerCase()}`] = { handler, description, adminOnly };
    }
}

function isChatAdmin(user) {
    if (!user) return false;
    if (user.is_broadcaster) return true;
    if ($room && $room.owner === user.username) return true;
    if (user.is_mod) return true;
    const modList = ($kv && $kv.get('moderator_usernames')) || [];
    return modList.includes(user.username);
}

// ─── Command: Help ────────────────────────────────────────────────────────────
async function handleHelp(args, user) {
    const isAdmin = isChatAdmin(user);
    const lines = ['🎮 AVAILABLE COMMANDS 🎮'];
    for (const [key, info] of Object.entries(COMMAND_HANDLERS)) {
        if (key.startsWith('/')) continue; // Show only '!' variants
        if (info.adminOnly && !isAdmin) continue;
        lines.push(`${key}${info.adminOnly ? ' [MOD]' : ''}: ${info.description}`);
    }
    await sendMsg(lines.join('\n'), { toUsername: user.username });
}
registerCommand('help', handleHelp, 'Show available commands');
registerCommand('commands', handleHelp, 'Show available commands');

// ─── Command: Tip Goal ────────────────────────────────────────────────────────
async function handleTipGoal(args, user) {
    const goalAmt  = Number($kv.get('tip_goal_target_amount')    || 0);
    const goalPrg  = Number($kv.get('tip_goal_current_progress') || 0);
    const goalLbl  = $kv.get('tip_goal_label')   || 'Show Goal';
    const goalRwd  = $kv.get('tip_goal_reward')  || '';

    if (goalAmt <= 0) {
        await sendMsg('🎯 No tip goal is currently set! Stay tuned! 🎯', { toUsername: user.username });
        return;
    }

    const pct = Math.min(100, Math.floor((goalPrg / goalAmt) * 100));
    const bar = typeof generateProgressBar === 'function'
        ? generateProgressBar(goalPrg, goalAmt, 20) : `${pct}%`;
    const emojiBar = typeof generateEmojiProgressBar === 'function'
        ? generateEmojiProgressBar(goalPrg, goalAmt, 10) : '';

    let msg = `🎯 ${goalLbl}\n${goalPrg} / ${goalAmt} tokens (${pct}%)\n${bar}`;
    if (emojiBar) msg += `\n${emojiBar}`;
    if (goalRwd && pct < 100) msg += `\n🏆 Reward: ${goalRwd}`;
    if (pct >= 100) msg = `🎉 GOAL REACHED! ${goalLbl} — ${goalRwd} 🎉`;

    await sendMsg(msg, { toUsername: user.username });
}
registerCommand('tipgoal', handleTipGoal, 'View tip goal progress');
registerCommand('goal', handleTipGoal, 'View tip goal progress');

// ─── Command: Jackpot ─────────────────────────────────────────────────────────
async function handleJackpot(args, user) {
    const jackpot   = Number($kv.get('spin_jackpot_pool') || 0);
    const lastWin   = $kv.get('spin_last_jackpot_winner');
    const spinCfg   = (() => {
        try { return JSON.parse($kv.get('spin_wheel_config') || '{}'); } catch (_) { return {}; }
    })();
    const threshold = spinCfg.spinThreshold || 100;

    let msg = `💰 JACKPOT POOL: ${jackpot} tokens 💰\nTip ${threshold}+ tokens to spin the wheel and win it!\n`;
    if (lastWin) {
        try {
            const w = typeof lastWin === 'string' ? JSON.parse(lastWin) : lastWin;
            const ago = typeof getTimeAgo === 'function' ? getTimeAgo(w.timestamp) : '';
            msg += `Last won: ${w.tokens} tokens ${ago}`;
        } catch (_) { /* ignore parse error */ }
    } else {
        msg += `No jackpot winner yet — could be YOU! 🏆`;
    }
    await sendMsg(msg, { toUsername: user.username });
}
registerCommand('jackpot', handleJackpot, 'View current jackpot pool');
registerCommand('jp', handleJackpot, 'View current jackpot pool');

// ─── Command: My Stats ────────────────────────────────────────────────────────
async function handleMyStats(args, user) {
    const statsRaw = $kv.get('spin_stats') || '{}';
    let stats;
    try { stats = JSON.parse(statsRaw); } catch (_) { stats = {}; }

    const myStats = (stats.users || {})[user.username];
    const lifetipTokens = Number($kv.get(`lifetime_tips_${user.username}`) || 0);
    const tier = typeof calculateUserTier === 'function' ? calculateUserTier(lifetipTokens) : { name: 'Bronze', emoji: '🥉' };
    const streak = Number($kv.get(`spin_streak_${user.username}`) || 0);

    if (!myStats && lifetipTokens === 0) {
        await sendMsg(`🎰 ${user.username}, you haven't tipped or spun yet! Tip to play the wheel! 🎰`, { toUsername: user.username });
        return;
    }

    const msg = [
        `📊 ${user.username}'s STATS 📊`,
        `${tier.emoji} Tier: ${tier.name} (${lifetipTokens} lifetime tokens)`,
        `🎰 Spins: ${myStats ? myStats.spins : 0}`,
        `💎 Tokens Tipped: ${myStats ? myStats.tipped : 0}`,
        `🎁 Tokens Won: ${myStats ? myStats.won : 0}`,
        `🔥 Current Win Streak: ${streak}`,
        `📈 Net: ${myStats ? (myStats.won - myStats.tipped) : 0} tokens`,
    ].join('\n');
    await sendMsg(msg, { toUsername: user.username });
}
registerCommand('mystats', handleMyStats, 'View your spin stats and tier');
registerCommand('me', handleMyStats, 'View your spin stats and tier');

// ─── Command: Streak ─────────────────────────────────────────────────────────
async function handleStreak(args, user) {
    const targetUser = (args[0] || user.username).toLowerCase();
    const streak     = Number($kv.get(`spin_streak_${targetUser}`) || 0);
    const emoji      = typeof getStreakEmoji === 'function' ? getStreakEmoji(streak) : '🔥';
    const multiplier = typeof calculateStreakMultiplier === 'function' ? calculateStreakMultiplier(streak) : 1.0;

    if (streak === 0) {
        await sendMsg(`🎯 ${targetUser} has no active win streak. Spin to start one!`, { toUsername: user.username });
    } else {
        const bonusStr = multiplier > 1.0 ? ` (×${multiplier} token bonus active!)` : '';
        await sendMsg(`${emoji} ${targetUser}'s win streak: ${streak}${bonusStr}`, { toUsername: user.username });
    }
}
registerCommand('streak', handleStreak, 'View win streak [username]');
registerCommand('mystreak', handleStreak, 'View your win streak');

// ─── Command: Fortune ─────────────────────────────────────────────────────────
async function handleFortune(args, user) {
    const fortune = typeof generateLuckyFortune === 'function'
        ? generateLuckyFortune(user.username)
        : `�� ${user.username}'s Fortune: The stars smile upon you tonight! ✨`;
    await sendMsg(fortune, { toUsername: user.username });
}
registerCommand('fortune', handleFortune, 'Get your lucky fortune reading');
registerCommand('lucky', handleFortune, 'Get your lucky fortune reading');

// ─── Command: VIP / Tier ──────────────────────────────────────────────────────
async function handleVip(args, user) {
    const targetUser     = (args[0] || user.username).toLowerCase();
    const lifetimeTokens = Number($kv.get(`lifetime_tips_${targetUser}`) || 0);
    const tier           = typeof calculateUserTier === 'function'
        ? calculateUserTier(lifetimeTokens)
        : { name: 'Bronze', emoji: '🥉', color: '#CD7F32' };
    const nextTierInfo   = typeof getNextTier === 'function' ? getNextTier(lifetimeTokens) : null;

    let msg = `${tier.emoji} ${targetUser}: ${tier.name} Tier (${lifetimeTokens} lifetime tokens)`;
    if (nextTierInfo) {
        msg += `\nNext tier: ${nextTierInfo.tier.name} — need ${nextTierInfo.tokensNeeded} more tokens!`;
    } else {
        msg += `\n👑 Maximum tier reached! You're a LEGEND!`;
    }
    await sendMsg(msg, { toUsername: user.username });
}
registerCommand('vip', handleVip, 'View VIP tier [username]');
registerCommand('tier', handleVip, 'View VIP tier [username]');

// ─── Command: Leaderboard ────────────────────────────────────────────────────
async function handleTop(args, user) {
    const statsRaw = $kv.get('spin_stats') || '{}';
    let stats;
    try { stats = JSON.parse(statsRaw); } catch (_) { stats = {}; }

    const entries = Object.entries(stats.users || {})
        .map(([u, d]) => ({ username: u, score: d.tipped }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    if (entries.length === 0) {
        await sendMsg('🏆 No spin leaderboard data yet! Be the first!', { toUsername: user.username });
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines  = entries.map((e, i) => `${medals[i] || `${i + 1}.`} ${e.username}: ${e.score} tokens`);
    await sendMsg(`🏆 TOP SPINNERS 🏆\n${lines.join('\n')}`, { toUsername: user.username });
}
registerCommand('top', handleTop, 'View top spinners leaderboard');
registerCommand('leaderboard', handleTop, 'View top spinners leaderboard');

// ─── Command: Spin Stats ─────────────────────────────────────────────────────
async function handleSpinStats(args, user) {
    const msg = typeof formatSpinWheelStats === 'function'
        ? formatSpinWheelStats($kv)
        : '📊 Spin stats not available in this context.';
    await sendMsg(msg, { toUsername: user.username });
}
registerCommand('spinstats', handleSpinStats, 'View global spin wheel statistics');

// ─── Command: Hot Segments ────────────────────────────────────────────────────
async function handleHotSegments(args, user) {
    const msg = typeof getHotSegments === 'function'
        ? getHotSegments($kv, 5)
        : '🔥 Hot segment data not available.';
    await sendMsg(msg, { toUsername: user.username });
}
registerCommand('hot', handleHotSegments, 'View hottest wheel segments');

// ─── Command: Recent Tips ─────────────────────────────────────────────────────
async function handleRecentTips(args, user) {
    const recent = $kv.get('recent_tips_list') || [];
    if (!Array.isArray(recent) || recent.length === 0) {
        await sendMsg('💎 No recent tips yet — be the first!', { toUsername: user.username });
        return;
    }
    const lines = recent.slice(0, 5).map((t, i) => {
        const msg = t.message ? ` "${t.message}"` : '';
        return `${i + 1}. ${t.username}: ${t.tokens} tokens${msg}`;
    });
    await sendMsg(`💎 RECENT TIPS 💎\n${lines.join('\n')}`, { toUsername: user.username });
}
registerCommand('recenttips', handleRecentTips, 'View recent tips');
registerCommand('tips', handleRecentTips, 'View recent tips');

// ─── Command: Spin Wheel Config (admin) ──────────────────────────────────────
async function handleSpinWheelConfig(args, user) {
    if (!isChatAdmin(user)) {
        await sendMsg('❌ Admin only!', { toUsername: user.username });
        return;
    }
    if (args.length === 0) {
        const raw = $kv.get('spin_wheel_config') || '{}';
        await sendMsg(`Current config:\n${raw}`, { toUsername: user.username });
        return;
    }
    try {
        const configStr = args.join(' ');
        JSON.parse(configStr); // validate
        $kv.set('spin_wheel_config', configStr);
        await sendMsg('✅ Spin wheel config updated!', { toUsername: user.username });
        logCmd('info', `${user.username} updated spin wheel config.`);
    } catch (e) {
        await sendMsg('❌ Invalid JSON. Please provide valid config.', { toUsername: user.username });
    }
}
registerCommand('spinconfig', handleSpinWheelConfig, 'Get/set spin wheel config (JSON)', true);

// ─── Command: Set Tip Goal (admin) ───────────────────────────────────────────
async function handleSetGoal(args, user) {
    if (!isChatAdmin(user)) {
        await sendMsg('❌ Admin only!', { toUsername: user.username });
        return;
    }
    if (args.length === 0 || isNaN(args[0])) {
        await sendMsg('Usage: !setgoal [amount] [optional label]', { toUsername: user.username });
        return;
    }
    const amount = parseInt(args[0], 10);
    const label  = args.slice(1).join(' ') || 'Show Goal';
    $kv.set('tip_goal_target_amount', amount);
    $kv.set('tip_goal_current_progress', 0);
    $kv.set('tip_goal_label', label);
    await sendMsg(`✅ Tip goal set: ${amount} tokens for "${label}"!`);
    logCmd('info', `${user.username} set tip goal to ${amount} for "${label}".`);
}
registerCommand('setgoal', handleSetGoal, 'Set tip goal [amount] [label]', true);

// ─── Command: Set Jackpot Seed (admin) ───────────────────────────────────────
async function handleSetJackpot(args, user) {
    if (!isChatAdmin(user)) {
        await sendMsg('❌ Admin only!', { toUsername: user.username });
        return;
    }
    if (args.length === 0 || isNaN(args[0])) {
        await sendMsg('Usage: !setjackpot [amount]', { toUsername: user.username });
        return;
    }
    const amount = parseInt(args[0], 10);
    $kv.set('spin_jackpot_pool', amount);
    await sendMsg(`✅ Jackpot pool set to ${amount} tokens!`);
    logCmd('info', `${user.username} set jackpot to ${amount}.`);
}
registerCommand('setjackpot', handleSetJackpot, 'Set jackpot pool amount [tokens]', true);

// ─── Command: Add Mod ─────────────────────────────────────────────────────────
async function handleAddMod(args, user) {
    if (!isChatAdmin(user)) {
        await sendMsg('❌ Admin only!', { toUsername: user.username });
        return;
    }
    if (!args[0]) {
        await sendMsg('Usage: !addmod [username]', { toUsername: user.username });
        return;
    }
    const target = args[0].toLowerCase();
    const mods   = $kv.get('moderator_usernames') || [];
    if (!mods.includes(target)) {
        mods.push(target);
        $kv.set('moderator_usernames', mods);
    }
    await sendMsg(`✅ ${target} added as app moderator!`, { toUsername: user.username });
}
registerCommand('addmod', handleAddMod, 'Add app moderator [username]', true);

// ─── Command: Spin Wheel Config Threshold (admin) ────────────────────────────
async function handleSetSpinThreshold(args, user) {
    if (!isChatAdmin(user)) {
        await sendMsg('❌ Admin only!', { toUsername: user.username });
        return;
    }
    if (!args[0] || isNaN(args[0])) {
        await sendMsg('Usage: !spinthreshold [tokens]', { toUsername: user.username });
        return;
    }
    const threshold = parseInt(args[0], 10);
    try {
        const raw = $kv.get('spin_wheel_config') || '{}';
        const cfg = JSON.parse(raw);
        cfg.spinThreshold = threshold;
        $kv.set('spin_wheel_config', JSON.stringify(cfg));
        await sendMsg(`✅ Spin threshold set to ${threshold} tokens!`);
    } catch (_) {
        await sendMsg('❌ Could not update spin config.', { toUsername: user.username });
    }
}
registerCommand('spinthreshold', handleSetSpinThreshold, 'Set spin wheel tip threshold', true);

// ─── Main Handler ─────────────────────────────────────────────────────────────
(async () => {
    try {
        const messageBody = $message.body;
        const user        = $user;

        const parsed = parseCmd(messageBody);
        if (!parsed) return; // Not a command

        const { commandName, args } = parsed;
        // Try both prefix variants
        const cmdKey = `!${commandName}`;
        const cmdInfo = COMMAND_HANDLERS[cmdKey] || COMMAND_HANDLERS[`/${commandName}`];

        if (!cmdInfo) {
            // Unknown command — silently ignore to avoid spam
            return;
        }

        if (cmdInfo.adminOnly && !isChatAdmin(user)) {
            await sendMsg('❌ You do not have permission for that command!', { toUsername: user.username });
            return;
        }

        logCmd('info', `${user.username} executed !${commandName} [${args.join(' ')}]`);
        await cmdInfo.handler(args, user);

    } catch (error) {
        console.error("[ChatCmd] Error:", error.message);
        console.error("[ChatCmd] Stack:", error.stack);
    }
})();
