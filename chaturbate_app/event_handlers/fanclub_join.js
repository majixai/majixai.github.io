// --- Fanclub Join Event Handler ---
// Runs every time a user subscribes to the broadcaster's fanclub.
// Available: $user, $room, $kv, $callback, $overlay

console.log("--- 'Fanclub Join' Event Handler Executed ---");

(async () => {
    try {
        if (typeof $user === 'undefined') {
            console.error("[Fanclub Join] $user not available. Aborting.");
            return;
        }

        const joiningUsername = $user.username || 'New Member';
        const userId          = $user.id        || joiningUsername;

        console.log(`[Fanclub Join] ${joiningUsername} joined the fanclub!`);

        // ── 1. Update fanclub member list ──────────────────────────────────────
        let fanclubMembers = $kv.get('fanclub_member_ids') || [];
        if (!Array.isArray(fanclubMembers)) fanclubMembers = [];

        const isNew = !fanclubMembers.includes(userId);
        if (isNew) {
            fanclubMembers.push(userId);
            $kv.set('fanclub_member_ids', fanclubMembers);
        }

        const memberCount = fanclubMembers.length;
        $kv.set('fanclub_member_count', memberCount);

        // ── 2. Private thank-you ──────────────────────────────────────────────
        if ($room && typeof $room.sendNotice === 'function') {
            const tier        = typeof calculateUserTier === 'function'
                ? calculateUserTier(Number($kv.get(`lifetime_tips_${joiningUsername}`) || 0))
                : { emoji: '⭐', name: 'Bronze' };
            const privateMsg  =
                `⭐ WELCOME TO THE FANCLUB, ${joiningUsername}! ${tier.emoji}\n` +
                `You now have access to exclusive member-only content and perks! 🎉\n` +
                `As a token of appreciation, you get a FREE SPIN on the wheel! 🎰\n` +
                `Thank you so much for the support — it means the world! 💖`;
            $room.sendNotice(privateMsg, { toUsername: joiningUsername });
        }

        // ── 3. Public celebration ─────────────────────────────────────────────
        const funPhrases = [
            'just became an official VIP!',
            'joined the inner circle! 🌟',
            'unlocked fanclub perks! ⭐',
            'is now part of the exclusive club! 💎',
            'just levelled up to FANCLUB status! 👑',
        ];
        const phrase = funPhrases[Math.floor(Math.random() * funPhrases.length)];
        if ($room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(`⭐ ${joiningUsername} ${phrase} Welcome! ⭐ (Member #${memberCount})`);
        }

        // ── 4. Milestone announcements ────────────────────────────────────────
        const FANCLUB_MILESTONES = [5, 10, 25, 50, 100, 250, 500];
        if (FANCLUB_MILESTONES.includes(memberCount) && $room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(
                `🎊 WE HIT ${memberCount} FANCLUB MEMBERS! 🎊 ` +
                `This community is INCREDIBLE! Thank you all so much! 💖 ` +
                `BONUS SHOW incoming! 🎉🎉🎉`
            );
        }

        // ── 5. Achievement badge ──────────────────────────────────────────────
        if (typeof checkAchievement === 'function' && typeof getAchievementBadge === 'function') {
            const fanclubCountForUser = Number($kv.get(`fanclub_join_count_${joiningUsername}`) || 0) + 1;
            $kv.set(`fanclub_join_count_${joiningUsername}`, fanclubCountForUser);
            const ach = checkAchievement('fanclub_member', fanclubCountForUser);
            if (ach && $room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(getAchievementBadge(ach, joiningUsername));
            }
        }

        // ── 6. Gift free spin ─────────────────────────────────────────────────
        if (typeof getSpinWheelConfig === 'function' && typeof getRandomWeightedSpinResult === 'function') {
            const spinCfg = getSpinWheelConfig($kv);
            const result  = getRandomWeightedSpinResult(spinCfg);
            if ($room && typeof $room.sendNotice === 'function') {
                const wonStr = result.tokens > 0
                    ? `You won ${result.tokens} bonus tokens! 🎉`
                    : result.custom
                        ? `You landed: ${result.custom}!`
                        : `Better luck next time — spins keep coming! 😊`;
                $room.sendNotice(
                    `🎰 FANCLUB WELCOME SPIN for ${joiningUsername}: ${result.label} — ${wonStr}`,
                    { toUsername: joiningUsername }
                );
            }
            if (typeof handleSpinOutcome === 'function') {
                handleSpinOutcome(result, joiningUsername, $callback, $kv, spinCfg);
            }
        }

        // ── 7. Broadcaster private update ─────────────────────────────────────
        if ($room && $room.owner && typeof $room.sendNotice === 'function') {
            $room.sendNotice(
                `[Fanclub] ${joiningUsername} joined! Total members: ${memberCount}`,
                { toUsername: $room.owner, color: '#9B59B6' }
            );
        }

        // ── 8. Emit to overlay ────────────────────────────────────────────────
        if ($overlay) {
            try {
                $overlay.emit('MainOverlay', {
                    eventName:   'fanclubJoin',
                    username:    joiningUsername,
                    memberCount: memberCount,
                });
            } catch (e) { console.warn("[Fanclub Join] Overlay emit failed:", e.message); }
        }

        console.log(`[Fanclub Join] Processing complete for ${joiningUsername}. Total members: ${memberCount}`);

    } catch (error) {
        console.error("### ERROR in 'Fanclub Join' handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }

    console.log("--- 'Fanclub Join' Event Handler Finished ---");
})();
