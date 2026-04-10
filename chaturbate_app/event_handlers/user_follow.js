// --- User Follow Event Handler ---
// Runs every time a viewer follows the broadcaster's room.
// Available payload: $user, $room, $kv, $overlay, $callback

console.log("--- 'User Follow' Event Handler Executed ---");

(async () => {
    try {
        // ── Guard ─────────────────────────────────────────────────────────────
        if (typeof $user === 'undefined') {
            console.error("[User Follow] $user not available. Aborting.");
            return;
        }

        const followingUsername = $user.username || 'New Fan';
        const userId            = $user.id        || null;

        console.log(`[User Follow] ${followingUsername} (id: ${userId || 'N/A'}) just followed!`);

        // ── 1. Broadcast Follower Count ───────────────────────────────────────
        const followerCountKey    = 'broadcastFollowerCount';
        const followedUsersKey    = 'followedUsersThisBroadcast';

        const currentCount = Number($kv.get(followerCountKey) || 0) + 1;
        $kv.set(followerCountKey, currentCount);

        // Unique follower list (deduplicated by user ID)
        let followedUsers = $kv.get(followedUsersKey) || [];
        if (!Array.isArray(followedUsers)) followedUsers = [];
        const alreadyTracked = followedUsers.includes(userId || followingUsername);
        if (!alreadyTracked) {
            followedUsers.push(userId || followingUsername);
            $kv.set(followedUsersKey, followedUsers);
        }
        const uniqueCount = followedUsers.length;

        // ── 2. Private Thank-You to the New Follower ──────────────────────────
        if ($room && typeof $room.sendNotice === 'function') {
            const tierInfo = typeof calculateUserTier === 'function'
                ? calculateUserTier(Number($kv.get(`lifetime_tips_${followingUsername}`) || 0))
                : { emoji: '❤️', name: '' };

            const thankMsg =
                `Hello ${followingUsername}! ${tierInfo.emoji} ` +
                `Thank you SO MUCH for the follow! 💖 You're officially part of the community now! ` +
                `Feel free to say hi in chat, check out the Tip Menu for fun reactions, ` +
                `and don't miss the SPIN WHEEL — tip to play! 🎰`;
            $room.sendNotice(thankMsg, { toUsername: followingUsername });
        }

        // ── 3. Public Announcement ────────────────────────────────────────────
        const funPhrases = [
            `gets VIP access to the best room online`,
            `just made this party bigger`,
            `is officially part of the fam`,
            `joined the hype train 🚂`,
            `levelled up their life by following`,
            `is now one of us — welcome! 😈`,
        ];
        const phrase = funPhrases[Math.floor(Math.random() * funPhrases.length)];

        if ($room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(`❤️ ${followingUsername} ${phrase}! Total followers today: ${uniqueCount} 🎉`);
        }

        // ── 4. First-Follower Celebration ─────────────────────────────────────
        if (uniqueCount === 1) {
            console.log(`[User Follow] First follower of this broadcast: ${followingUsername}`);
            if ($room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(`🏆 ${followingUsername} is the FIRST FOLLOWER of today's stream! 🏆 Special thanks! 🥇`);
            }
        }

        // ── 5. Milestone Announcements ────────────────────────────────────────
        const FOLLOW_MILESTONES = [5, 10, 25, 50, 100, 250, 500];
        if (FOLLOW_MILESTONES.includes(uniqueCount) && $room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(
                `🎊 WOW! ${uniqueCount} unique followers during this broadcast! ` +
                `You all are AMAZING! Let's celebrate! 🥳💃🎉`
            );
        }

        // ── 6. Achievement Badge ──────────────────────────────────────────────
        if (typeof checkAchievement === 'function' && typeof getAchievementBadge === 'function') {
            const followCount = Number($kv.get(`follow_count_${followingUsername}`) || 0) + 1;
            $kv.set(`follow_count_${followingUsername}`, followCount);

            const ach = checkAchievement('first_follow', followCount);
            if (ach && $room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(getAchievementBadge(ach, followingUsername));
            }
        }

        // ── 7. Periodic Broadcaster Notification ─────────────────────────────
        const notificationInterval    = 20; // Every N new followers
        const lastNotifCountKey        = 'lastFollowerNotificationCount';
        const lastNotifCount           = Number($kv.get(lastNotifCountKey) || 0);

        if ((currentCount - lastNotifCount) >= notificationInterval) {
            if ($room && $room.owner && typeof $room.sendNotice === 'function') {
                $room.sendNotice(
                    `--- 🔔 BROADCASTER UPDATE ---\n` +
                    `New Followers This Broadcast: ${currentCount}\n` +
                    `Unique Followers: ${uniqueCount}\n` +
                    `Keep the energy up! 💪`,
                    { toUsername: $room.owner, color: '#00539B' }
                );
            }
            $kv.set(lastNotifCountKey, currentCount);
        }

        // ── 8. Emit to Overlay ────────────────────────────────────────────────
        if ($overlay) {
            try {
                $overlay.emit('MainOverlay', {
                    eventName: 'newFollower',
                    username:  followingUsername,
                    followerCountThisBroadcast: currentCount,
                    uniqueFollowerCount: uniqueCount,
                });
                console.log("[User Follow] Emitted 'newFollower' to overlay.");
            } catch (overlayErr) {
                console.warn("[User Follow] Overlay emit failed:", overlayErr.message);
            }
        }

        // ── 9. Gift Spin to New Follower ──────────────────────────────────────
        // Grant 1 free spin to celebrate the follow (if spin wheel is configured)
        if (typeof getSpinWheelConfig === 'function' && typeof getRandomWeightedSpinResult === 'function') {
            const spinCfg = getSpinWheelConfig($kv);
            // Only gift on first follow this session
            const giftKey = `follow_spin_gifted_${followingUsername}`;
            if (!$kv.get(giftKey)) {
                $kv.set(giftKey, true);
                const result = getRandomWeightedSpinResult(spinCfg);
                if ($room && typeof $room.sendNotice === 'function') {
                    $room.sendNotice(
                        `🎁 WELCOME GIFT: ${followingUsername} gets a FREE spin for following! ` +
                        `Result: ${result.label} ${result.tokens > 0 ? `(+${result.tokens} tokens!) 🎉` : '— better luck next time!'}`
                    );
                }
                if (typeof handleSpinOutcome === 'function') {
                    handleSpinOutcome(result, followingUsername, $callback, $kv, spinCfg);
                }
            }
        }

        console.log(`[User Follow] Finished processing follow from ${followingUsername}.`);

    } catch (error) {
        console.error("### FATAL ERROR in 'User Follow' handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }

    console.log("--- 'User Follow' Event Handler Finished ---");
})();
