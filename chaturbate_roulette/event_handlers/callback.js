// --- Callback Event Handler ---
// PASTE INTO: Event Handlers -> Callbacks -> Callback
// Handles scheduled announcements

console.log("--- Roulette Callback Event Handler ---");

const ROULETTE_ANNOUNCEMENT_DELAY = 300; // 5 minutes between announcements

(async () => {
    try {
        // Check if this is our roulette announcement callback
        if ($callback.label === 'rouletteAnnounce') {
            
            // Get announcements and current index
            const announcementsString = $kv.get('rouletteAnnouncements');
            let currentIndex = $kv.get('rouletteAnnouncementIndex') || 0;
            
            if (announcementsString) {
                try {
                    const announcements = JSON.parse(announcementsString);
                    
                    if (announcements && announcements.length > 0) {
                        // Ensure index is valid
                        currentIndex = currentIndex % announcements.length;
                        
                        // Send the announcement
                        $room.sendNotice(announcements[currentIndex], {
                            color: '#FFD700' // Gold color for announcements
                        });
                        
                        // Update index for next time
                        const nextIndex = (currentIndex + 1) % announcements.length;
                        $kv.set('rouletteAnnouncementIndex', nextIndex);
                        
                        console.log(`Roulette: Sent announcement ${currentIndex + 1}/${announcements.length}`);
                    }
                } catch (e) {
                    console.error("Roulette: Error parsing announcements:", e);
                }
            }
            
            // Schedule the next announcement
            if ($callback && typeof $callback.create === 'function') {
                $callback.create('rouletteAnnounce', ROULETTE_ANNOUNCEMENT_DELAY);
                console.log(`Roulette: Next announcement scheduled in ${ROULETTE_ANNOUNCEMENT_DELAY} seconds`);
            }
        }
        
    } catch (error) {
        console.error("### ERROR in Roulette Callback Handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }
})();

// ─── Additional callbacks appended below ─────────────────────────────────────

(async () => {
    try {
        const label = $callback.label;

        // ── Jackpot Reminder ──────────────────────────────────────────────────
        if (label === 'rouletteJackpot') {
            const jackpot  = Number($kv.get('roulette_jackpot_pool') || 0);
            const cfgRaw   = $kv.get('roulette_config') || '{}';
            const config   = JSON.parse(cfgRaw);
            const spinCost = config.spinCost || 50;

            const jackpotMsgs = [
                `💰 ROULETTE JACKPOT: ${jackpot} tokens! Tip ${spinCost}+ to spin & WIN IT! 🎡`,
                `🎡 Can YOU win the ${jackpot}-token JACKPOT? Tip now to spin! 🏆`,
                `🔥 The jackpot grows with every tip! Currently ${jackpot} tokens — YOUR NAME could be next! 💰`,
            ];
            const idx = Number($kv.get('rouletteJackpotMsgIdx') || 0) % jackpotMsgs.length;
            $kv.set('rouletteJackpotMsgIdx', idx + 1);

            if ($room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(jackpotMsgs[idx], { color: '#FFD700' });
            }
            if ($callback && typeof $callback.create === 'function') {
                $callback.create('rouletteJackpot', 1800);
            }
        }

        // ── Daily Challenge Reset ─────────────────────────────────────────────
        else if (label === 'rouletteDailyReset') {
            // Reset daily challenge for new day
            $kv.set('roulette_daily_challenge', null);
            $kv.set('roulette_total_tips_today', 0);
            console.log("[Roulette Callback] Daily challenge and daily tips reset.");

            if ($room && typeof $room.sendNotice === 'function') {
                const newChallenge = typeof getDailyChallenge === 'function'
                    ? getDailyChallenge($kv, [])
                    : null;
                if (newChallenge) {
                    $room.sendNotice(
                        `🏆 NEW DAILY CHALLENGE: ${newChallenge.description}\n` +
                        `Complete it for ${newChallenge.reward} bonus tokens! Type !rdaily for details!`,
                        { color: '#FF9800' }
                    );
                }
            }
            if ($callback && typeof $callback.create === 'function') {
                $callback.create('rouletteDailyReset', 86400);
            }
        }

        // ── Hot Segment Update ────────────────────────────────────────────────
        else if (label === 'rouletteHotUpdate') {
            const hot = typeof getHotRouletteSegments === 'function'
                ? getHotRouletteSegments($kv, 3) : [];

            if (hot.length > 0 && $room && typeof $room.sendNotice === 'function') {
                const hotStr = hot.map((s, i) => `${i + 1}. ${s.label} (${s.count} hits)`).join(', ');
                $room.sendNotice(`🔥 HOT SEGMENTS right now: ${hotStr}! Spin these for luck! 🍀`);
            }
            if ($callback && typeof $callback.create === 'function') {
                $callback.create('rouletteHotUpdate', 1200); // Every 20 min
            }
        }

        // ── Session Summary (periodic) ────────────────────────────────────────
        else if (label === 'rouletteSessionSummary') {
            if ($room && $room.owner && typeof $room.sendNotice === 'function') {
                const summary = typeof formatSessionSummary === 'function'
                    ? formatSessionSummary($kv) : '📊 No summary available.';
                $room.sendNotice(summary, { toUsername: $room.owner, color: '#607D8B' });
            }
            if ($callback && typeof $callback.create === 'function') {
                $callback.create('rouletteSessionSummary', 3600); // Every 1 hr
            }
        }

    } catch (error) {
        console.error("[Roulette Callback+] Error:", error.message);
    }
})();
