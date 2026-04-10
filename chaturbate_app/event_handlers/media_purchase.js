// --- Media Purchase Event Handler ---
// Runs when a user purchases photos, videos, or social media access.
// Available: $user, $media, $room, $kv, $overlay, $callback

console.log("--- 'Media Purchase' Event Handler Executed ---");

(async () => {
    try {
        if (typeof $media === 'undefined' || typeof $user === 'undefined') {
            console.error("[Media Purchase] $media or $user not available. Aborting.");
            return;
        }

        // ── Read payload ──────────────────────────────────────────────────────
        const buyerUsername = $user.username    || 'Anonymous';
        const mediaName     = $media.name       || 'Media Item';
        const tokensSpent   = Number($media.tokens) || 0;
        const mediaType     = $media.type       || 'media';
        const roomOwner     = ($room && $room.owner) || '';

        console.log(`[Media Purchase] ${buyerUsername} purchased "${mediaName}" (${tokensSpent} tokens, type: ${mediaType})`);

        // ── 1. Update sales totals ────────────────────────────────────────────
        const prevTotalTokens  = Number($kv.get('mediaSalesTotalTokens') || 0);
        const prevTotalCount   = Number($kv.get('mediaSalesTotalCount')   || 0);
        const newTotalTokens   = prevTotalTokens + tokensSpent;
        const newTotalCount    = prevTotalCount  + 1;

        $kv.set('mediaSalesTotalTokens', newTotalTokens);
        $kv.set('mediaSalesTotalCount',  newTotalCount);

        // Per-user media purchase count
        const userMediaKey   = `media_purchases_${buyerUsername}`;
        const userMediaCount = Number($kv.get(userMediaKey) || 0) + 1;
        $kv.set(userMediaKey, userMediaCount);

        // ── 2. Public announcement ────────────────────────────────────────────
        const mediaEmoji = mediaType === 'video' ? '🎬' : mediaType === 'social_media' ? '📱' : '📸';
        let announcement = `${mediaEmoji} Big thanks to ${buyerUsername} for purchasing "${mediaName}"`;
        if (tokensSpent > 0) announcement += ` for ${tokensSpent} tokens!`;
        announcement += ` You're amazing! ❤️`;

        if ($room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(announcement);
        }

        // ── 3. Private thank-you to buyer ─────────────────────────────────────
        if ($room && typeof $room.sendNotice === 'function') {
            const tier       = typeof calculateUserTier === 'function'
                ? calculateUserTier(Number($kv.get(`lifetime_tips_${buyerUsername}`) || 0))
                : { emoji: '💖' };
            const thankMsg   =
                `${tier.emoji} Thank you for purchasing "${mediaName}", ${buyerUsername}! ` +
                `Enjoy the content! 😘 You've bought ${userMediaCount} item${userMediaCount > 1 ? 's' : ''} total!`;
            $room.sendNotice(thankMsg, { toUsername: buyerUsername });
        }

        // ── 4. Media sales goal check ─────────────────────────────────────────
        const salesGoal    = Number($kv.get('mediaSaleGoalTokens') || 0);
        const salesReward  = $kv.get('mediaSaleGoalReward') || '';

        if (salesGoal > 0 && $room && typeof $room.sendNotice === 'function') {
            const milestone = typeof checkTipGoalMilestone === 'function'
                ? checkTipGoalMilestone(prevTotalTokens, newTotalTokens, salesGoal)
                : null;
            if (milestone) {
                $room.sendNotice(`📸 MEDIA SALES MILESTONE! ${milestone}`);
            }
            // Goal completed
            if (prevTotalTokens < salesGoal && newTotalTokens >= salesGoal) {
                $room.sendNotice(
                    `🎉🎬 MEDIA SALES GOAL REACHED! ${salesGoal} tokens in sales! ` +
                    `${salesReward} — THANK YOU EVERYONE! 🎉`
                );
                $kv.set('mediaSaleGoalTokens', 0); // Reset goal
            }
        }

        // ── 5. Count-based milestones ─────────────────────────────────────────
        const COUNT_MILESTONES = [5, 10, 25, 50, 100];
        if (COUNT_MILESTONES.includes(newTotalCount) && $room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(
                `🎊 ${newTotalCount} MEDIA SALES MILESTONE! You all are incredible! ` +
                `Keep supporting! 💖 Special bonus coming for the next buyer!`
            );
        }

        // ── 6. Achievement for buyer ──────────────────────────────────────────
        if (typeof checkAchievement === 'function' && typeof getAchievementBadge === 'function') {
            const ach = checkAchievement('media_buyer', userMediaCount);
            if (ach && $room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(getAchievementBadge(ach, buyerUsername));
            }
        }

        // ── 7. Jackpot contribution ───────────────────────────────────────────
        if (tokensSpent > 0 && typeof calculateJackpotContribution === 'function') {
            const contrib   = calculateJackpotContribution(tokensSpent, 0.03); // 3% of media purchase
            const curJackpot = Number($kv.get('spin_jackpot_pool') || 0);
            $kv.set('spin_jackpot_pool', curJackpot + contrib);
            console.log(`[Media Purchase] Added ${contrib} tokens to jackpot pool.`);
        }

        // ── 8. Private broadcaster summary ────────────────────────────────────
        if (roomOwner && $room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(
                `[Media Sale] ${buyerUsername} → "${mediaName}" (${tokensSpent} tokens)\n` +
                `Totals: ${newTotalCount} sales | ${newTotalTokens} tokens`,
                { toUsername: roomOwner, color: '#8C1515' }
            );
        }

        // ── 9. Emit to overlay ────────────────────────────────────────────────
        if ($overlay) {
            try {
                $overlay.emit('MainOverlay', {
                    eventName:    'mediaPurchase',
                    username:     buyerUsername,
                    itemName:     mediaName,
                    tokens:       tokensSpent,
                    totalTokens:  newTotalTokens,
                    totalCount:   newTotalCount,
                });
            } catch (e) { console.warn("[Media Purchase] Overlay emit failed:", e.message); }
        }

        console.log(`[Media Purchase] Finished. Totals: ${newTotalCount} sales / ${newTotalTokens} tokens.`);

    } catch (error) {
        console.error("### ERROR in 'Media Purchase' handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }

    console.log("--- 'Media Purchase' Event Handler Finished ---");
})();
