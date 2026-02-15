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
