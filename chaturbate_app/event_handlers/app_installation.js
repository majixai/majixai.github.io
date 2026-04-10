// --- Code running ONCE on App Installation ---
// Initializes ALL persistent state and schedules startup callbacks.

console.log("--- 'App Installation' Event Handler Executed ---");

// ─── Core State ───────────────────────────────────────────────────────────────
$kv.set('top_tipper_name', '');
$kv.set('top_tip_amount', 0);
$kv.set('recent_tips_list', []);
$kv.set('command_prefix', '!');
$kv.set('allow_viewer_commands', true);
$kv.set('moderator_usernames', []);
$kv.set('show_tip_alert_overlay', true);
$kv.set('overlay_message_color', '#00539B');
$kv.set('app_status_message', 'App is initializing...');

// ─── Moderation / Filter ─────────────────────────────────────────────────────
$kv.set('naughty_word_patterns', [
    '\\b(boobs|cock|dick|suck|fuck|lick|snatch|vagina|teen|freak|darn|shoot)\\b',
    '\\b(idiot|moron|stupid|slut|bitch|asshole)\\b',
]);
$kv.set('vip_users', []);
$kv.set('repetition_threshold_ms', '3000');
$kv.set('max_repetition_count', '2');

// ─── Tip Goal ─────────────────────────────────────────────────────────────────
$kv.set('tip_goal_target_amount', 2000);
$kv.set('tip_goal_current_progress', 0);
$kv.set('tip_goal_label', 'Show Goal');
$kv.set('tip_goal_reward', 'Special show when goal is reached!');

// ─── Jackpot Pool ─────────────────────────────────────────────────────────────
$kv.set('spin_jackpot_pool', 200);
$kv.set('spin_last_jackpot_winner', null);
$kv.set('spin_stats', '{}');

// ─── Follower Tracking ────────────────────────────────────────────────────────
$kv.set('broadcastFollowerCount', 0);
$kv.set('followedUsersThisBroadcast', []);
$kv.set('lastFollowerNotificationCount', 0);

// ─── Fanclub Tracking ─────────────────────────────────────────────────────────
$kv.set('fanclub_member_ids', []);
$kv.set('fanclub_member_count', 0);

// ─── Media Sales Tracking ─────────────────────────────────────────────────────
$kv.set('mediaSalesTotalTokens', 0);
$kv.set('mediaSalesTotalCount', 0);
$kv.set('mediaSaleGoalTokens', 1000);
$kv.set('mediaSaleGoalReward', 'Special content unlocked for all!');

// ─── Announcement Rotation ────────────────────────────────────────────────────
const announcements = [
    "✨ Welcome! Check out my Tip Menu for fun reactions and shows! Use !tipmenu or click the panel! ✨",
    "🎰 SPIN THE WHEEL! Tip to earn a spin and win prizes including the JACKPOT! 💰",
    "💖 Every tip feeds the JACKPOT pool — type !jackpot to see how big it is right now!",
    "📊 Type !tipgoal to see our current show goal progress!",
    "🏆 Type !top to see the top tippers leaderboard!",
    "🔮 Type !fortune for your personal lucky fortune reading!",
    "🔥 Type !streak to see your current win streak!",
    "⭐ Join my Fanclub for exclusive perks and special shows! Check the panel!",
    "Want exclusive content? Follow me on my social media (see bio for links)!",
    "Don't forget to follow the room rules! Keep it positive and respectful. 🙏",
    "💃 Private shows available! DM me or check my bio for rates. 😉",
    "🎁 New followers get a FREE SPIN on the wheel! Follow to spin! ❤️",
];
$kv.set('featureAnnouncements', announcements);
if ($kv.get('announcementIndex') === null) {
    $kv.set('announcementIndex', 0);
}

// ─── Jackpot / Leaderboard Announcement Indices ───────────────────────────────
$kv.set('jackpotAnnouncementIndex', 0);

// ─── Stream Counters (reset each broadcast) ───────────────────────────────────
$kv.set('totalTipsThisStream', 0);
$kv.set('streamStartTime', 0);

// ─── Slot Machine Configuration ───────────────────────────────────────────────
if (typeof getDefaultSpinWheelConfig === 'function') {
    if (!$kv.get('spin_wheel_config')) {
        $kv.set('spin_wheel_config', JSON.stringify(getDefaultSpinWheelConfig()));
    }
} else {
    console.warn("[App Installation] getDefaultSpinWheelConfig not available — using inline default.");
    const defaultSpinConfig = {
        segments: [
            { id: 1, label: "Panties!",      tokens: 25,  weight: 1.0, color: '#FF69B4' },
            { id: 2, label: "Flash!",         tokens: 50,  weight: 1.0, color: '#FF4500' },
            { id: 3, label: "Anal!",          tokens: 200, weight: 0.5, color: '#8B0000' },
            { id: 4, label: "No Reward",      tokens: 0,   weight: 1.5, color: '#555555' },
            { id: 5, label: "Bonus Prize!",   tokens: 75,  weight: 0.8, color: '#FFD700' },
            { id: 6, label: "Another Chance", tokens: 0,   weight: 1.2, color: '#9B59B6' },
            { id: 7, label: "Dance!",         tokens: 0,   weight: 1.3, color: '#1ABC9C' },
            { id: 8, label: "JACKPOT! 🏆",    tokens: 500, weight: 0.1, color: '#FFD700', isJackpot: true },
        ],
        spinThreshold: 100,
        jackpotContribRate: 0.05,
        jackpotSeed: 200,
        cooldownSeconds: 0,
        allowMultipleSpins: true,
        streakBonusEnabled: true,
        achievementsEnabled: true,
    };
    if (!$kv.get('spin_wheel_config')) {
        $kv.set('spin_wheel_config', JSON.stringify(defaultSpinConfig));
    }
}

// ─── Overlay Message Relay Handler ────────────────────────────────────────────
if ($callback && typeof $callback.onOverlayMessage === 'function') {
    $callback.onOverlayMessage((message) => {
        if (message.type === 'request' && message.action === 'get_spin_config') {
            try {
                const raw = $kv.get('spin_wheel_config');
                const config = raw ? JSON.parse(raw) : null;
                if (config) $callback.sendOverlayMessage('update_config', { config });
            } catch (e) { console.error("[App Installation] Overlay config relay error:", e); }
        }
        if (message.type === 'response' && message.action === 'spin_completed') {
            const { username, result } = message.payload;
            if (typeof handleSpinOutcome === 'function') {
                handleSpinOutcome(result, username, $callback, $kv);
            }
        }
    });
}

// ─── Schedule Callbacks ───────────────────────────────────────────────────────
if ($callback && typeof $callback.create === 'function') {
    $callback.create('announceFeature',    900);   // Feature announcement every 15 min
    $callback.create('jackpotReminder',   1800);   // Jackpot reminder every 30 min
    $callback.create('tipGoalUpdate',      600);   // Tip-goal update every 10 min
    $callback.create('leaderboardAnnounce', 3600); // Leaderboard every 1 hr
    console.log("[App Installation] Scheduled all callbacks.");
} else {
    console.warn("[App Installation] $callback.create not available — callbacks skipped.");
}

// ─── Welcome Message to Broadcaster ──────────────────────────────────────────
try {
    const broadcasterName = ($room && $room.broadcaster_name) ? $room.broadcaster_name : 'broadcaster';
    const spinThreshold = (() => {
        try { return JSON.parse($kv.get('spin_wheel_config') || '{}').spinThreshold || 100; }
        catch (_) { return 100; }
    })();
    const welcomeMsg =
        `👋 Hello ${broadcasterName}! App installed successfully! 🎉\n` +
        `• Commands use prefix "!" (e.g. !tipgoal, !jackpot, !top, !fortune)\n` +
        `• Spin wheel activates at ${spinThreshold} tokens per spin\n` +
        `• Tip Goal set to ${$kv.get('tip_goal_target_amount')} tokens\n` +
        `• Jackpot pool seeded at ${$kv.get('spin_jackpot_pool')} tokens\n` +
        `• Edit $kv keys to customize — see handler comments for all keys`;

    if ($room && typeof $room.sendNotice === 'function') {
        $room.sendNotice(welcomeMsg, { toUsername: broadcasterName, color: '#00539B' });
    } else {
        console.log("[App Installation] Welcome message:", welcomeMsg);
    }
} catch (error) {
    console.error("[App Installation] Error sending welcome message:", error);
}

console.log("--- 'App Installation' Event Handler Finished ---");
