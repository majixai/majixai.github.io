// --- App Loaded Event Handler ---
// Runs every time a viewer loads the broadcaster's room page.
// Used to push current app configuration to all overlays.

console.log("--- 'App Loaded' Event Handler Executed ---");

// Default slot machine constants (fallback if settings unavailable)
const SLOT_SYMBOLS_DEFAULT  = ["🍒", "🔔", " BAR ", " 7 ", "💎"];
const SLOT_REEL_COUNT_DEFAULT = 3;

(async () => {
    try {
        console.log("[App Loaded] Pushing config to overlays...");

        // ── Read $settings ────────────────────────────────────────────────────
        const slotOverlayName = ($settings && $settings.slotOverlayName)
            ? String($settings.slotOverlayName).trim()
            : 'Slots';

        const slotReelCount = (
            $settings &&
            typeof $settings.slotReelCount === 'number' &&
            $settings.slotReelCount >= 2 &&
            $settings.slotReelCount <= 5
        ) ? $settings.slotReelCount : SLOT_REEL_COUNT_DEFAULT;

        if (!$settings) {
            console.warn("[App Loaded] $settings not available — using defaults.");
        }

        // ── Read live KV state ────────────────────────────────────────────────
        const jackpot    = Number($kv.get('spin_jackpot_pool')          || 0);
        const goalAmt    = Number($kv.get('tip_goal_target_amount')      || 0);
        const goalPrg    = Number($kv.get('tip_goal_current_progress')   || 0);
        const goalLbl    = $kv.get('tip_goal_label')   || 'Show Goal';
        const topTipper  = $kv.get('top_tipper_name')  || '';
        const topAmount  = Number($kv.get('top_tip_amount')             || 0);
        const followers  = Number($kv.get('broadcastFollowerCount')     || 0);

        const spinCfgRaw = $kv.get('spin_wheel_config') || '{}';
        let spinCfg;
        try { spinCfg = JSON.parse(spinCfgRaw); } catch (_) { spinCfg = {}; }
        const spinThreshold = spinCfg.spinThreshold || 100;

        // ── Get spin wheel leaderboard ─────────────────────────────────────────
        const leaderboard = typeof getSpinLeaderboard === 'function'
            ? getSpinLeaderboard($kv, 5)
            : [];

        // ── Emit to Slot Overlay ──────────────────────────────────────────────
        if ($overlay) {
            // 1. Slot machine config
            $overlay.emit(slotOverlayName, {
                eventName: 'setConfig',
                payload: {
                    symbols:    SLOT_SYMBOLS_DEFAULT,
                    reelCount:  slotReelCount,
                },
            });
            console.log(`[App Loaded] Emitted 'setConfig' to "${slotOverlayName}".`);

            // 2. Live state update
            $overlay.emit(slotOverlayName, {
                eventName: 'liveState',
                payload: {
                    jackpot:       jackpot,
                    goalAmount:    goalAmt,
                    goalProgress:  goalPrg,
                    goalLabel:     goalLbl,
                    spinThreshold: spinThreshold,
                    topTipper:     topTipper,
                    topTipAmount:  topAmount,
                    leaderboard:   leaderboard,
                    followers:     followers,
                },
            });
            console.log(`[App Loaded] Emitted 'liveState' to "${slotOverlayName}". Jackpot: ${jackpot}`);

            // 3. Main overlay state
            $overlay.emit('MainOverlay', {
                eventName: 'appLoaded',
                jackpot:   jackpot,
                goalAmount: goalAmt,
                goalLabel:  goalLbl,
                leaderboard: leaderboard,
            });
            console.log(`[App Loaded] Emitted 'appLoaded' to "MainOverlay".`);

            // 4. Roulette overlay config (if roulette app is also active)
            const rouletteCfgRaw = $kv.get('roulette_config');
            if (rouletteCfgRaw) {
                try {
                    const rouletteCfg = JSON.parse(rouletteCfgRaw);
                    $overlay.emit('Roulette', {
                        eventName: 'setConfig',
                        payload: { segments: rouletteCfg.segments || [] },
                    });
                    console.log(`[App Loaded] Emitted 'setConfig' to "Roulette" overlay.`);
                } catch (e) {
                    console.warn("[App Loaded] Failed to parse roulette config for overlay:", e.message);
                }
            }
        } else {
            console.warn("[App Loaded] $overlay not available — skipping overlay emissions.");
        }

    } catch (error) {
        console.error("### FATAL ERROR in 'App Loaded' handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
        try {
            if ($room && $room.owner && typeof $room.sendNotice === 'function') {
                $room.sendNotice(
                    `🚨 App Error in App Loaded! @${$room.owner} check logs. Error: ${error.message}`,
                    { toUsername: $room.owner, color: '#FF0000' }
                );
            }
        } catch (_) { /* ignore */ }
    } finally {
        console.log("--- 'App Loaded' Event Handler Finished ---");
    }
})();
