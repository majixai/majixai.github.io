// --- Tip Received Event Handler ---
// PASTE INTO: Event Handlers -> Tips -> Tip Received
// This is the main handler that processes tips and triggers spins

console.log("--- Roulette Tip Received Event Handler ---");

(async () => {
    try {
        const username = $tip.from_user.username;
        const tipAmount = $tip.tokens;
        const tipMessage = $tip.message || '';

        console.log(`Roulette: ${username} tipped ${tipAmount} tokens. Message: "${tipMessage}"`);

        // --- Load Configuration ---
        const configString = $kv.get('roulette_config');
        if (!configString) {
            console.error("Roulette: Configuration not found!");
            return;
        }
        const config = JSON.parse(configString);

        // --- Check if tip meets spin cost ---
        if (tipAmount < config.spinCost) {
            // Tip doesn't qualify for a spin, but acknowledge it
            console.log(`Roulette: Tip of ${tipAmount} is below spin cost of ${config.spinCost}`);
            return;
        }

        // --- Calculate number of spins earned ---
        const spinsEarned = config.allowMultipleSpins 
            ? Math.floor(tipAmount / config.spinCost)
            : 1;

        console.log(`Roulette: ${username} earned ${spinsEarned} spin(s)!`);

        // --- Check cooldown ---
        if (config.spinCooldown > 0) {
            const lastSpinTime = $kv.get(`roulette_last_spin_${username}`);
            if (lastSpinTime) {
                const elapsed = (Date.now() - parseInt(lastSpinTime, 10)) / 1000;
                if (elapsed < config.spinCooldown) {
                    const remaining = Math.ceil(config.spinCooldown - elapsed);
                    $room.sendNotice(`⏳ ${username}, please wait ${remaining} seconds before spinning again!`, {
                        toUsername: username,
                        color: '#FFA500'
                    });
                    return;
                }
            }
        }

        // --- Process spin(s) ---
        const results = [];
        
        for (let i = 0; i < spinsEarned; i++) {
            // Weighted random selection
            const totalWeight = config.segments.reduce((sum, seg) => sum + (seg.weight || 1), 0);
            let randomValue = Math.random() * totalWeight;
            let weightSum = 0;
            let result = config.segments[0];

            for (const segment of config.segments) {
                weightSum += (segment.weight || 1);
                if (randomValue < weightSum) {
                    result = segment;
                    break;
                }
            }

            results.push(result);
        }

        // --- Update tracking data ---
        if (config.trackingEnabled) {
            const trackingString = $kv.get('roulette_tracking');
            const tracking = trackingString ? JSON.parse(trackingString) : {
                totalSpins: 0,
                totalTokensSpent: 0,
                totalTokensAwarded: 0,
                spinHistory: [],
                userStats: {},
                segmentStats: {},
                sessionStartTime: Date.now(),
                lastUpdated: Date.now()
            };

            // Update totals
            tracking.totalSpins += results.length;
            tracking.totalTokensSpent += tipAmount;

            const totalWon = results.reduce((sum, r) => sum + (r.tokens || 0), 0);
            tracking.totalTokensAwarded += totalWon;

            // Update user stats
            if (!tracking.userStats[username]) {
                tracking.userStats[username] = {
                    totalSpins: 0,
                    totalTipped: 0,
                    totalWon: 0,
                    lastSpin: null,
                    wins: []
                };
            }
            tracking.userStats[username].totalSpins += results.length;
            tracking.userStats[username].totalTipped += tipAmount;
            tracking.userStats[username].totalWon += totalWon;
            tracking.userStats[username].lastSpin = Date.now();

            // Add to history
            for (const result of results) {
                const spinRecord = {
                    username: username,
                    tipAmount: config.spinCost,
                    result: result.label,
                    tokens: result.tokens || 0,
                    timestamp: Date.now()
                };
                tracking.spinHistory.unshift(spinRecord);

                // Update segment stats
                const segId = result.id || result.label;
                if (!tracking.segmentStats[segId]) {
                    tracking.segmentStats[segId] = { label: result.label, hits: 0, totalAwarded: 0 };
                }
                tracking.segmentStats[segId].hits++;
                tracking.segmentStats[segId].totalAwarded += (result.tokens || 0);

                // Track wins
                if (result.tokens > 0) {
                    tracking.userStats[username].wins.push({
                        prize: result.label,
                        tokens: result.tokens,
                        timestamp: Date.now()
                    });
                }
            }

            // Keep only last 100 spins in history
            if (tracking.spinHistory.length > 100) {
                tracking.spinHistory = tracking.spinHistory.slice(0, 100);
            }

            tracking.lastUpdated = Date.now();
            $kv.set('roulette_tracking', JSON.stringify(tracking));
        }

        // --- Set cooldown timestamp ---
        $kv.set(`roulette_last_spin_${username}`, Date.now().toString());

        // --- Emit to overlay for animation ---
        if ($overlay) {
            const segmentIndex = config.segments.findIndex(s => s.id === results[0].id);
            const segmentAngle = 360 / config.segments.length;
            const targetAngle = (segmentIndex * segmentAngle) + (segmentAngle / 2);
            const spinAngle = (config.spinRotations * 360) + (360 - targetAngle) + ((Math.random() - 0.5) * segmentAngle * 0.7);

            $overlay.emit('Roulette', {
                eventName: 'spin',
                payload: {
                    username: username,
                    results: results.map((r, idx) => ({
                        segmentId: r.id,
                        label: r.label,
                        prize: r.prize,
                        tokens: r.tokens || 0,
                        color: r.color,
                        spinIndex: idx
                    })),
                    animation: {
                        angle: spinAngle,
                        duration: config.spinDuration
                    },
                    spinsEarned: spinsEarned
                }
            });
        }

        // --- Announce results in chat ---
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const spinNum = spinsEarned > 1 ? ` (Spin ${i + 1}/${spinsEarned})` : '';
            
            let message = '';
            if (result.tokens > 0) {
                message = `🎉💰 ${username}${spinNum} spun the wheel and won ${result.label}! +${result.tokens} tokens! 🎊`;
            } else if (result.prize && result.label !== 'Try Again!') {
                message = `🎰✨ ${username}${spinNum} landed on ${result.label}! Prize: ${result.prize}! 🌟`;
            } else {
                message = `🎰 ${username}${spinNum} spun and got: ${result.label}. Better luck next time!`;
            }

            // Slight delay between multiple spin announcements
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            $room.sendNotice(message, { color: result.color || '#00ff00' });
        }

        // Log completion
        console.log(`Roulette: Completed ${spinsEarned} spin(s) for ${username}`);

    } catch (error) {
        console.error("### ERROR in Roulette Tip Handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
        try {
            if ($room && $room.owner && $room.sendNotice) {
                $room.sendNotice(`🚨 Roulette Error! @${$room.owner} check logs.`, {
                    toUsername: $room.owner,
                    color: '#FF0000'
                });
            }
        } catch (noticeError) {
            console.error("Failed to send error notice:", noticeError);
        }
    }
})();

// ─── Enhanced tip processing appended below ───────────────────────────────────

(async () => {
    try {
        if (typeof $tip === 'undefined') return;

        const username  = $tip.from_user ? $tip.from_user.username : ($tip.from_username || 'Anonymous');
        const tipAmount = Number($tip.tokens) || 0;

        const cfgRaw    = $kv.get('roulette_config') || '{}';
        const config    = JSON.parse(cfgRaw);

        // ── Jackpot Contribution ──────────────────────────────────────────────
        if (typeof addToRouletteJackpot === 'function') {
            const newJackpot = addToRouletteJackpot(tipAmount, $kv, config);
            console.log(`[Roulette Tip+] Jackpot now: ${newJackpot}`);
        }

        // ── Combo Multiplier ──────────────────────────────────────────────────
        if (typeof calculateComboMultiplier === 'function') {
            const { multiplier, comboCount } = calculateComboMultiplier(username, tipAmount, $kv, 60000);
            if (comboCount >= 2 && multiplier > 1.0 && $room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(
                    `⚡ ${username} is on a TIP COMBO! ×${multiplier} bonus active (${comboCount} tips in a row)! 🔥`,
                    { color: '#FF9800' }
                );
            }
        }

        // ── VIP Tier Check ────────────────────────────────────────────────────
        if (typeof getRouletteVipTier === 'function') {
            const lifetimeTokens    = Number($kv.get(`lifetime_tips_${username}`) || 0) + tipAmount;
            $kv.set(`lifetime_tips_${username}`, lifetimeTokens);

            const tier     = getRouletteVipTier(lifetimeTokens);
            const prevLife = lifetimeTokens - tipAmount;
            const prevTier = getRouletteVipTier(prevLife);
            if (tier.name !== prevTier.name && $room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(
                    `${tier.emoji} ${username} reached ${tier.name} VIP tier! ` +
                    `${tier.spinsBonus > 0 ? `You now earn +${tier.spinsBonus} bonus spin(s) per tip! ` : ''}` +
                    `And a ×${tier.multiplier} token multiplier! Congrats! 🎉`,
                    { color: '#FFD700' }
                );
            }
        }

        // ── Daily Challenge Progress ──────────────────────────────────────────
        if (typeof updateDailyChallenge === 'function') {
            const cfgData = getTrackingData ? getTrackingData($kv) : null;
            const spinCount = cfgData ? cfgData.totalSpins : 0;

            // Update spin_count challenge
            const spinResult = updateDailyChallenge('spin_count', spinCount, $kv);
            // Update total_tips challenge
            const totalTipped = Number($kv.get('roulette_total_tips_today') || 0) + tipAmount;
            $kv.set('roulette_total_tips_today', totalTipped);
            const tipsResult = updateDailyChallenge('total_tips', totalTipped, $kv);

            // Announce completion
            if ((spinResult.justCompleted || tipsResult.justCompleted) && $room && typeof $room.sendNotice === 'function') {
                const challenge = typeof getDailyChallenge === 'function' ? getDailyChallenge($kv, []) : null;
                if (challenge) {
                    $room.sendNotice(
                        `🎊 DAILY CHALLENGE COMPLETED! 🎊\n` +
                        `"${challenge.description}" — DONE!\n` +
                        `${challenge.reward} bonus tokens awarded! Amazing job! 🏆`
                    );
                }
            }
        }

        // ── Jackpot Segment Handler ───────────────────────────────────────────
        // Check if the spin outcome (already handled above) was a jackpot segment
        // The base handler sends jackpot announcements, but we add extra flair here
        // by emitting to overlay
        const jackpot = typeof getRouletteJackpot === 'function'
            ? getRouletteJackpot($kv, config)
            : Number($kv.get('roulette_jackpot_pool') || 0);

        if ($overlay) {
            try {
                $overlay.emit('Roulette', {
                    eventName:   'jackpotUpdate',
                    jackpot:     jackpot,
                    username:    username,
                    tipAmount:   tipAmount,
                });
            } catch (e) { console.warn("[Roulette Tip+] Overlay emit failed:", e.message); }
        }

    } catch (error) {
        console.error("[Roulette Tip+] Error:", error.message);
    }
})();
