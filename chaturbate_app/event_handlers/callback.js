// --- Callback Event Handler ---
// Handles ALL scheduled callbacks: announcements, jackpot reminders,
// tip-goal updates, leaderboard announcements, and streak expiry checks.

console.log("--- 'Callback' Event Handler Executed ---");

// ─── Delay constants (seconds) — must match values in app_installation.js ─────
const ANNOUNCEMENT_DELAY     = 900;   // 15 min
const JACKPOT_REMINDER_DELAY = 1800;  // 30 min
const TIP_GOAL_UPDATE_DELAY  = 600;   // 10 min
const LEADERBOARD_DELAY      = 3600;  // 1 hr

(async () => {
    try {
        const label = $callback.label;
        console.log(`[Callback] Label: "${label}"`);

        // ── Feature Announcement ──────────────────────────────────────────────
        if (label === 'announceFeature') {
            const announcements = $kv.get('featureAnnouncements') || [];
            let idx = Number($kv.get('announcementIndex') || 0);

            if (announcements.length > 0) {
                idx = idx % announcements.length;
                if ($room && typeof $room.sendNotice === 'function') {
                    $room.sendNotice(announcements[idx], { color: '#00539B' });
                }
                $kv.set('announcementIndex', (idx + 1) % announcements.length);
                console.log(`[Callback] Sent announcement ${idx + 1}/${announcements.length}.`);
            }

            if ($callback && typeof $callback.create === 'function') {
                $callback.create('announceFeature', ANNOUNCEMENT_DELAY);
            }
        }

        // ── Jackpot Reminder ──────────────────────────────────────────────────
        else if (label === 'jackpotReminder') {
            const jackpot = Number($kv.get('spin_jackpot_pool') || 0);
            const spinCfg = (() => {
                try { return JSON.parse($kv.get('spin_wheel_config') || '{}'); } catch (_) { return {}; }
            })();
            const threshold = spinCfg.spinThreshold || 100;

            const jackpotMsgs = [
                `💰 JACKPOT ALERT! The jackpot pool is at ${jackpot} tokens — tip ${threshold}+ tokens to spin and WIN IT ALL! 🏆`,
                `🎰 Can YOU hit the JACKPOT? Pool is now ${jackpot} tokens! Tip ${threshold} to spin! 🎰`,
                `🔥 The jackpot is growing! Currently ${jackpot} tokens up for grabs — will YOU be the next winner? 💰`,
            ];
            const msgIdx  = Number($kv.get('jackpotAnnouncementIndex') || 0) % jackpotMsgs.length;
            $kv.set('jackpotAnnouncementIndex', msgIdx + 1);

            if ($room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(jackpotMsgs[msgIdx], { color: '#FFD700' });
            }

            if ($callback && typeof $callback.create === 'function') {
                $callback.create('jackpotReminder', JACKPOT_REMINDER_DELAY);
            }
        }

        // ── Tip Goal Update ───────────────────────────────────────────────────
        else if (label === 'tipGoalUpdate') {
            const goalAmount = Number($kv.get('tip_goal_target_amount') || 0);
            const goalPrg    = Number($kv.get('tip_goal_current_progress') || 0);
            const goalLabel  = $kv.get('tip_goal_label') || 'Show Goal';
            const goalReward = $kv.get('tip_goal_reward') || '';

            if (goalAmount > 0 && $room && typeof $room.sendNotice === 'function') {
                const pct = Math.min(100, Math.floor((goalPrg / goalAmount) * 100));
                const bar = typeof generateProgressBar === 'function'
                    ? generateProgressBar(goalPrg, goalAmount, 15) : `${pct}%`;
                let msg = `🎯 ${goalLabel}: ${goalPrg} / ${goalAmount} tokens\n${bar}`;
                if (pct < 100 && goalReward) msg += `\nReward: ${goalReward}`;
                if (pct >= 100) msg = `🎉 GOAL REACHED! ${goalLabel} complete! ${goalReward} 🎉`;
                $room.sendNotice(msg, { color: pct >= 100 ? '#00FF00' : '#00539B' });
            }

            if ($callback && typeof $callback.create === 'function') {
                $callback.create('tipGoalUpdate', TIP_GOAL_UPDATE_DELAY);
            }
        }

        // ── Leaderboard Announce ──────────────────────────────────────────────
        else if (label === 'leaderboardAnnounce') {
            const statsRaw = $kv.get('spin_stats') || '{}';
            let stats;
            try { stats = JSON.parse(statsRaw); } catch (_) { stats = {}; }

            const users = Object.entries(stats.users || {})
                .map(([u, d]) => ({ username: u, score: d.tipped }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            if (users.length > 0 && $room && typeof $room.sendNotice === 'function') {
                const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
                const lines  = users.map((e, i) => `${medals[i]} ${e.username}: ${e.score} tokens`);
                $room.sendNotice(
                    `🏆 TOP 5 SPINNERS 🏆\n${lines.join('\n')}\nTip to claim the #1 spot!`,
                    { color: '#FFD700' }
                );
            }

            // Also check top tipper
            const topName   = $kv.get('top_tipper_name') || '';
            const topAmount = Number($kv.get('top_tip_amount') || 0);
            if (topName && topAmount > 0 && $room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(
                    `👑 Current top tipper: ${topName} with ${topAmount} tokens! Can you beat that? 💪`,
                    { color: '#FFD700' }
                );
            }

            if ($callback && typeof $callback.create === 'function') {
                $callback.create('leaderboardAnnounce', LEADERBOARD_DELAY);
            }
        }

        // ── Streak Expiry Check ───────────────────────────────────────────────
        else if (label === 'streakExpiryCheck') {
            // Streaks expire if no new spin within 2 hours of last session
            // (This callback is not auto-scheduled but can be triggered manually)
            console.log("[Callback] streakExpiryCheck — streaks are session-persistent, no action needed.");
        }

        else {
            console.log(`[Callback] Unhandled callback label: "${label}"`);
        }

    } catch (error) {
        console.error("### ERROR in 'Callback' handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }

    console.log("--- 'Callback' Event Handler Finished ---");
})();
