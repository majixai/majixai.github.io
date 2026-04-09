// --- Tip Received Event Handler ---
// Runs every time a viewer tips the broadcaster.
// Available payload: $tip, $user, $room, $kv, $overlay, $callback, $settings

console.log("--- 'Tip Received' Event Handler Executed ---");

(async () => {
    try {
        // ── Guard: ensure essential objects are present ───────────────────────
        if (typeof $tip === 'undefined' || typeof $kv === 'undefined') {
            console.error("[Tip Received] $tip or $kv not available. Aborting.");
            return;
        }

        const username  = $tip.from_username || ($tip.from_user && $tip.from_user.username) || 'Anonymous';
        const tipAmount = Number($tip.tokens) || 0;
        const tipMsg    = ($tip.message || '').trim();

        console.log(`[Tip Received] ${username} tipped ${tipAmount} tokens. Message: "${tipMsg}"`);

        // ── 1. Update running totals ──────────────────────────────────────────
        const prevStreamTotal  = Number($kv.get('totalTipsThisStream') || 0);
        const prevLifetimeUser = Number($kv.get(`lifetime_tips_${username}`) || 0);
        const prevTipCount     = Number($kv.get(`tip_count_${username}`) || 0);

        const newStreamTotal   = prevStreamTotal + tipAmount;
        const newLifetimeUser  = prevLifetimeUser + tipAmount;
        const newTipCount      = prevTipCount + 1;

        $kv.set('totalTipsThisStream', newStreamTotal);
        $kv.set(`lifetime_tips_${username}`, newLifetimeUser);
        $kv.set(`tip_count_${username}`, newTipCount);

        // Update recent-tips list (last 10)
        const recentRaw  = $kv.get('recent_tips_list') || [];
        const recentList = Array.isArray(recentRaw) ? recentRaw : [];
        recentList.unshift({ username, tokens: tipAmount, message: tipMsg, ts: Date.now() });
        if (recentList.length > 10) recentList.length = 10;
        $kv.set('recent_tips_list', recentList);

        // ── 2. Update top tipper ──────────────────────────────────────────────
        const topAmount = Number($kv.get('top_tip_amount') || 0);
        if (tipAmount > topAmount) {
            $kv.set('top_tip_amount', tipAmount);
            $kv.set('top_tipper_name', username);
            if ($room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(`👑 NEW TOP TIP! ${username} is now the #1 tipper with ${tipAmount} tokens! 👑`);
            }
        }

        // ── 3. Tip Goal Progress ──────────────────────────────────────────────
        const tipGoal     = Number($kv.get('tip_goal_target_amount') || 0);
        const prevGoalPrg = Number($kv.get('tip_goal_current_progress') || 0);
        const newGoalPrg  = prevGoalPrg + tipAmount;
        $kv.set('tip_goal_current_progress', newGoalPrg);

        if (tipGoal > 0 && $room && typeof $room.sendNotice === 'function') {
            const milestone = checkTipGoalMilestone(prevGoalPrg, newGoalPrg, tipGoal);
            if (milestone) $room.sendNotice(milestone);
        }

        // ── 4. Jackpot Pool Contribution ─────────────────────────────────────
        const spinCfg  = typeof getSpinWheelConfig === 'function' ? getSpinWheelConfig($kv) : null;
        const newJackpot = spinCfg ? addToJackpot(tipAmount, $kv, spinCfg) : Number($kv.get('spin_jackpot_pool') || 0);
        console.log(`[Tip Received] Jackpot pool now: ${newJackpot}`);

        // ── 5. VIP Tier Check ─────────────────────────────────────────────────
        const tier     = calculateUserTier(newLifetimeUser);
        const prevTier = calculateUserTier(prevLifetimeUser);
        if (tier.name !== prevTier.name && $room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(
                `${tier.emoji} ${username} just reached ${tier.name} status! Congrats! ${tier.emoji}`,
                { color: tier.color }
            );
        }

        // ── 6. Achievement Checks ─────────────────────────────────────────────
        if (spinCfg.achievementsEnabled !== false && $room && typeof $room.sendNotice === 'function') {
            const ach1 = checkAchievement('first_tip', newTipCount);
            const ach2 = checkAchievement('ten_tips', newTipCount);
            const ach3 = checkAchievement('big_spender', newLifetimeUser);
            const ach4 = checkAchievement('whale', newLifetimeUser);

            for (const ach of [ach1, ach2, ach3, ach4]) {
                if (ach) $room.sendNotice(getAchievementBadge(ach, username));
            }
        }

        // ── 7. Public Thank-You ───────────────────────────────────────────────
        const tier2     = calculateUserTier(newLifetimeUser);
        let thankMsg = `💖 THANK YOU ${username} ${tier2.emoji} for the ${tipAmount} token tip!`;
        if (tipMsg) thankMsg += ` "${tipMsg}"`;
        thankMsg += ' 💖';

        if ($room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(thankMsg, { color: tier2.color || '#FF69B4' });
        }

        // ── 8. Spin Wheel Trigger ─────────────────────────────────────────────
        const spinsEarned = grantSpinOpportunity(username, tipAmount, $kv, spinCfg);

        if (spinsEarned > 0) {
            if ($room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(
                    `🎰 ${username} earned ${pluralize(spinsEarned, 'spin')} on the wheel! Let's go! 🎰`
                );
            }

            for (let spinIdx = 0; spinIdx < spinsEarned; spinIdx++) {
                const result    = getRandomWeightedSpinResult(spinCfg);
                const isWin     = (result.tokens || 0) > 0 || result.isJackpot;
                const { streak, multiplier } = updateSpinStreak(username, isWin, $kv);

                // Apply streak bonus to token prizes
                let tokensWon = result.tokens || 0;
                if (isWin && multiplier > 1.0 && !result.isJackpot) {
                    tokensWon = Math.floor(tokensWon * multiplier);
                    console.log(`[Tip Received] Streak ×${multiplier} applied. Tokens: ${result.tokens} → ${tokensWon}`);
                }

                // Handle outcome (chat announcement)
                const adjustedResult = { ...result, tokens: tokensWon };
                handleSpinOutcome(adjustedResult, username, $callback, $kv, spinCfg);

                // Record stats
                recordSpinStat(username, Math.floor(tipAmount / spinsEarned), adjustedResult, $kv);

                // Announce streak milestone
                announceStreak(username, streak, $callback);

                // Emit to overlay
                if ($overlay) {
                    $overlay.emit('Slots', {
                        eventName: 'slotResult',
                        outcome:   [result.label],
                        isWin:     isWin,
                        prize:     result.label + (tokensWon > 0 ? ` (+${tokensWon})` : ''),
                        user:      username,
                        streak:    streak,
                        jackpot:   newJackpot,
                    });
                }

                // Small delay between multiple spins
                if (spinIdx < spinsEarned - 1) {
                    await new Promise(r => setTimeout(r, 600));
                }
            }
        }

        // ── 9. Private Broadcaster Summary ───────────────────────────────────
        if ($room && $room.owner && typeof $room.sendNotice === 'function') {
            const summaryMsg = [
                `[Tip Summary] ${username} — ${tipAmount} tokens`,
                `Stream Total: ${formatNumber(newStreamTotal)} | Goal: ${tipGoal > 0 ? `${formatNumber(newGoalPrg)}/${formatNumber(tipGoal)}` : 'Not Set'}`,
                `Jackpot Pool: ${formatNumber(newJackpot)} | ${tier2.emoji} ${tier2.name}`,
            ].join('\n');
            $room.sendNotice(summaryMsg, { toUsername: $room.owner, color: APP_TEAL });
        }

        console.log(`[Tip Received] Finished processing tip from ${username}.`);

    } catch (error) {
        console.error("### FATAL ERROR in 'Tip Received' handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
        try {
            if ($room && $room.owner && typeof $room.sendNotice === 'function') {
                $room.sendNotice(
                    `🚨 Tip Handler Error! @${$room.owner} check logs. Error: ${error.message}`,
                    { toUsername: $room.owner, color: '#FF0000' }
                );
            }
        } catch (_) { /* ignore secondary errors */ }
    }

    console.log("--- 'Tip Received' Event Handler Finished ---");
})();
