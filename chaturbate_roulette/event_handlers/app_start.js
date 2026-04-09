// --- App Start Event Handler ---
// PASTE INTO: Event Handlers -> App Lifecycle -> App Start

console.log("--- Roulette App Start Event Handler ---");

(async () => {
    try {
        console.log("Roulette App: Initializing...");

        // --- Feature Announcements Configuration ---
        const announcements = [
            "🎰 ROULETTE GAME ACTIVE! Tip the spin cost to try your luck!",
            "💎 Spin the wheel for prizes, tokens, and special rewards!",
            "📊 Type /roulette_stats to see game statistics!",
            "🏆 Type /roulette_top to see the leaderboard!",
            "❓ Type /roulette_help for all available commands!"
        ];

        // Store announcements for callback rotation
        $kv.set('rouletteAnnouncements', JSON.stringify(announcements));
        $kv.set('rouletteAnnouncementIndex', 0);

        // --- Initialize Tracking Data ---
        const existingData = $kv.get('roulette_tracking');
        if (!existingData) {
            console.log("Roulette App: Initializing fresh tracking data...");
            const initialData = {
                totalSpins: 0,
                totalTokensSpent: 0,
                totalTokensAwarded: 0,
                spinHistory: [],
                userStats: {},
                segmentStats: {},
                sessionStartTime: Date.now(),
                lastUpdated: Date.now()
            };
            $kv.set('roulette_tracking', JSON.stringify(initialData));
        }

        // --- Load or Initialize Configuration ---
        const existingConfig = $kv.get('roulette_config');
        if (!existingConfig) {
            console.log("Roulette App: Setting default configuration...");
            // Default config is set by the shared module, but we'll reference it here
            const defaultConfig = {
                segments: [
                    { id: 1, label: "Flash!", prize: "Flash for 10 seconds", color: "#FF6B6B", weight: 1.5, tokens: 0 },
                    { id: 2, label: "Dance!", prize: "Sexy dance", color: "#4ECDC4", weight: 1.2, tokens: 0 },
                    { id: 3, label: "Bonus 50!", prize: "50 bonus tokens", color: "#FFE66D", weight: 0.3, tokens: 50 },
                    { id: 4, label: "Tease", prize: "Tease for 30 seconds", color: "#95E1D3", weight: 1.8, tokens: 0 },
                    { id: 5, label: "Song Request", prize: "Request a song", color: "#F38181", weight: 1.0, tokens: 0 },
                    { id: 6, label: "Try Again!", prize: "Better luck next time!", color: "#AA96DA", weight: 2.0, tokens: 0 },
                    { id: 7, label: "Special Show!", prize: "Special 1-min show", color: "#FCBAD3", weight: 0.5, tokens: 0 },
                    { id: 8, label: "Bonus 25!", prize: "25 bonus tokens", color: "#A8D8EA", weight: 0.6, tokens: 25 },
                    { id: 9, label: "Pose", prize: "Strike a pose", color: "#C9CBA3", weight: 1.4, tokens: 0 },
                    { id: 10, label: "JACKPOT!", prize: "Jackpot - 200 tokens!", color: "#FFD700", weight: 0.1, tokens: 200 }
                ],
                spinCost: 50,
                allowMultipleSpins: true,
                spinCooldown: 5,
                trackingEnabled: true,
                spinDuration: 4000,
                spinRotations: 5
            };
            $kv.set('roulette_config', JSON.stringify(defaultConfig));
        }

        // --- Schedule First Announcement ---
        const announcementDelay = 300; // 5 minutes
        if ($callback && typeof $callback.create === 'function') {
            $callback.create('rouletteAnnounce', announcementDelay);
            console.log(`Roulette App: First announcement scheduled in ${announcementDelay} seconds.`);
        }

        // --- Send Welcome Message ---
        const config = JSON.parse($kv.get('roulette_config'));
        $room.sendNotice(`🎰 ROULETTE GAME IS NOW ACTIVE! 🎰\nTip ${config.spinCost} tokens to spin the wheel!\nType /roulette_help for commands.`);

        console.log("Roulette App: Initialization complete!");

    } catch (error) {
        console.error("### ERROR in Roulette App Start ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
        try {
            if ($room && $room.owner && $room.sendNotice) {
                $room.sendNotice(`🚨 Roulette App Error! @${$room.owner} check logs.`, { 
                    toUsername: $room.owner, 
                    color: '#FF0000' 
                });
            }
        } catch (noticeError) {
            console.error("Failed to send error notice:", noticeError);
        }
    }
})();

// ─── Post-init: Additional setup appended below ───────────────────────────────

(async () => {
    try {
        // ── Jackpot Initialization ────────────────────────────────────────────
        if (!$kv.get('roulette_jackpot_pool')) {
            const jackpotCfg = typeof getDefaultJackpotConfig === 'function'
                ? getDefaultJackpotConfig()
                : { seed: 200 };
            $kv.set('roulette_jackpot_pool', jackpotCfg.seed);
            console.log(`[Roulette App Start] Jackpot pool initialized to ${jackpotCfg.seed} tokens.`);
        }
        $kv.set('roulette_last_jackpot', null);

        // ── Daily Challenge Initialization ────────────────────────────────────
        if (typeof getDailyChallenge === 'function') {
            const cfgRaw    = $kv.get('roulette_config') || '{}';
            const config    = JSON.parse(cfgRaw);
            const challenge = getDailyChallenge($kv, config.segments || []);
            console.log(`[Roulette App Start] Daily challenge: "${challenge.description}"`);
            if ($room && typeof $room.sendNotice === 'function') {
                $room.sendNotice(
                    `🏆 TODAY'S ROULETTE CHALLENGE: ${challenge.description}\n` +
                    `Complete it for ${challenge.reward} bonus tokens! Type !rdaily for details.`,
                    { color: '#FF9800' }
                );
            }
        }

        // ── Hot Segment Tracking Reset ────────────────────────────────────────
        $kv.set('roulette_segment_hits', '{}');

        // ── Announce Jackpot + Commands ───────────────────────────────────────
        const jackpot = Number($kv.get('roulette_jackpot_pool') || 0);
        const cfgRaw2 = $kv.get('roulette_config') || '{}';
        const config2 = JSON.parse(cfgRaw2);
        const spinCost = config2.spinCost || 50;

        if ($room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(
                `🎡 ROULETTE WHEEL IS READY!\n` +
                `💰 Jackpot Pool: ${jackpot} tokens!\n` +
                `🎯 Tip ${spinCost}+ tokens to spin!\n` +
                `Commands: !rjackpot !rstreak !rhot !rfortune !rdaily !rtop !help`
            );
        }

        // ── Schedule Callbacks ────────────────────────────────────────────────
        if ($callback && typeof $callback.create === 'function') {
            $callback.create('rouletteAnnounce',    900);  // 15 min
            $callback.create('rouletteJackpot',    1800);  // 30 min
            $callback.create('rouletteDailyReset', 86400); // 24 hr (daily challenge reset)
            console.log("[Roulette App Start] Scheduled callbacks: rouletteAnnounce, rouletteJackpot, rouletteDailyReset");
        }

    } catch (e) {
        console.error("[Roulette App Start] Post-init error:", e.message);
    }
})();
