// --- Broadcast Start Event Handler ---
// Runs automatically when the broadcaster starts streaming.
// Available: $app, $room, $callback, $kv, $limitcam, $overlay

console.log("--- 'Broadcast Start' Event Handler Executed ---");

try {
    // ── Broadcaster Info ─────────────────────────────────────────────────────
    const broadcasterUsername = $room ? $room.owner : 'the Broadcaster';
    const appName    = $app ? $app.name    : 'This App';
    const appVersion = $app ? $app.version : '';

    console.log(`[Broadcast Start] Broadcaster: ${broadcasterUsername}`);
    console.log(`[Broadcast Start] App: ${appName}${appVersion ? ' v' + appVersion : ''}`);

    // ── Reset Per-Stream Counters ─────────────────────────────────────────────
    if ($kv) {
        $kv.set('totalTipsThisStream', 0);
        $kv.set('streamStartTime', Date.now());
        $kv.set('broadcastFollowerCount', 0);
        $kv.set('followedUsersThisBroadcast', []);
        $kv.set('lastFollowerNotificationCount', 0);
        // Reset tip goal progress for the new stream
        $kv.set('tip_goal_current_progress', 0);
        console.log("[Broadcast Start] Per-stream counters reset.");
    }

    // ── Build Enthusiastic Start Message ─────────────────────────────────────
    const funEmojis = ['✨', '💖', '🔥', '🎉', '💦', '👑', '��', '😈', '😇', '💃', '🌟', '⚡'];
    const pickEmoji = () => funEmojis[Math.floor(Math.random() * funEmojis.length)];

    const spinThreshold = (() => {
        try { return JSON.parse($kv.get('spin_wheel_config') || '{}').spinThreshold || 100; }
        catch (_) { return 100; }
    })();
    const jackpot = Number($kv ? $kv.get('spin_jackpot_pool') : 0) || 0;
    const goalAmt = Number($kv ? $kv.get('tip_goal_target_amount') : 0) || 0;
    const goalLbl = ($kv && $kv.get('tip_goal_label')) || 'Show Goal';

    let startMsg =
        `${pickEmoji()} BROADCAST IS LIVE! ${pickEmoji()} ` +
        `Get ready for a wildly fun time with ${broadcasterUsername}! ${pickEmoji()}\n` +
        `Let's make it hot, exciting, and unforgettable! 🔥💦👑\n` +
        `🎰 Spin Wheel: Tip ${spinThreshold}+ tokens to spin & win prizes!\n` +
        `💰 Jackpot Pool: ${jackpot} tokens up for grabs — can YOU win it?\n`;

    if (goalAmt > 0) {
        startMsg += `🎯 Today's Goal: ${goalAmt} tokens for ${goalLbl}!`;
    }

    // ── Send Public Notice ────────────────────────────────────────────────────
    if ($room && typeof $room.sendNotice === 'function') {
        $room.sendNotice(startMsg);
        console.log("[Broadcast Start] Sent public start notice.");
    } else {
        console.warn("[Broadcast Start] $room.sendNotice not available.");
    }

    // ── Private Welcome to Broadcaster ───────────────────────────────────────
    if ($room && typeof $room.sendNotice === 'function') {
        $room.sendNotice(
            `Welcome to your stream, ${broadcasterUsername}! ${appName} is running.\n` +
            `Type !tipgoal, !jackpot, !top, !fortune in chat for instant info.\n` +
            `Spin wheel active at ${spinThreshold} token tips. Jackpot: ${jackpot} tokens.`,
            { toUsername: broadcasterUsername, color: '#00539B' }
        );
    }

    // ── Emit to Overlay ───────────────────────────────────────────────────────
    if ($overlay) {
        try {
            $overlay.emit('MainOverlay', {
                eventName: 'broadcastIsLive',
                broadcaster: broadcasterUsername,
                jackpot: jackpot,
                goalAmount: goalAmt,
                goalLabel: goalLbl,
            });
            $overlay.emit('Slots', {
                eventName: 'broadcastIsLive',
                broadcaster: broadcasterUsername,
                jackpot: jackpot,
            });
            console.log("[Broadcast Start] Emitted 'broadcastIsLive' to overlays.");
        } catch (overlayErr) {
            console.warn("[Broadcast Start] Overlay emit failed:", overlayErr.message);
        }
    }

    // ── Schedule Tip Goal Reminder (delayed) ──────────────────────────────────
    if ($callback && typeof $callback.create === 'function' && goalAmt > 0) {
        $callback.create('tipGoalUpdate', 300); // First goal update in 5 min
    }

} catch (error) {
    console.error("### ERROR in 'Broadcast Start' handler ###");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    try {
        if ($room && $room.owner && typeof $room.sendNotice === 'function') {
            $room.sendNotice(
                `App Error in Broadcast Start! @${$room.owner} check logs.`,
                { toUsername: $room.owner, color: '#FF0000' }
            );
        }
    } catch (_) { /* ignore */ }
}

console.log("--- 'Broadcast Start' Event Handler Finished ---");
