// --- Broadcast Panel Update Event Handler ---
// Called periodically to refresh the broadcaster panel with live stats.

console.log("--- 'Broadcast Panel Update' Event Handler Executed ---");

const PANEL_TEMPLATE_NAME = '3_rows_of_labels';

(async () => {
    try {
        if (!$kv) {
            console.error("[Panel Update] $kv not available.");
            return;
        }
        if (!$room || typeof $room.setPanelTemplate !== 'function') {
            console.error("[Panel Update] $room.setPanelTemplate not available.");
            return;
        }

        // ── Read all KV data ─────────────────────────────────────────────────
        const goalProgress = Number(await $kv.get('tip_goal_current_progress') || 0);
        const goalTarget   = Number(await $kv.get('tip_goal_target_amount')    || 0);
        const goalLabel    = (await $kv.get('tip_goal_label')) || 'Tip Goal';

        const jackpot      = Number(await $kv.get('spin_jackpot_pool')         || 0);
        const topTipper    = (await $kv.get('top_tipper_name')) || 'Nobody yet';
        const topAmount    = Number(await $kv.get('top_tip_amount')            || 0);
        const streamTotal  = Number(await $kv.get('totalTipsThisStream')       || 0);

        const statsRaw     = await $kv.get('spin_stats') || '{}';
        let spinStats;
        try { spinStats = JSON.parse(statsRaw); } catch (_) { spinStats = {}; }
        const totalSpins   = spinStats.totalSpins || 0;

        const followers    = Number(await $kv.get('broadcastFollowerCount')    || 0);

        // ── Format rows ───────────────────────────────────────────────────────
        let goalDisplay;
        if (goalTarget > 0) {
            const pct     = Math.min(100, Math.floor((goalProgress / goalTarget) * 100));
            goalDisplay   = `${goalProgress} / ${goalTarget} (${pct}%)`;
        } else {
            goalDisplay   = 'Goal Not Set';
        }

        const row1 = { label: `${goalLabel}:`,      value: goalDisplay                     };
        const row2 = { label: '💰 Jackpot:',         value: `${jackpot} tokens`              };
        const row3 = { label: '🎰 Spins Today:',     value: `${totalSpins} | Tips: ${streamTotal}` };

        // ── Set the panel template ────────────────────────────────────────────
        $room.setPanelTemplate({
            template:   PANEL_TEMPLATE_NAME,
            row1_label: row1.label, row1_value: row1.value,
            row2_label: row2.label, row2_value: row2.value,
            row3_label: row3.label, row3_value: row3.value,
        });

        console.log(`[Panel Update] Updated — Goal: ${goalDisplay} | Jackpot: ${jackpot} | Spins: ${totalSpins}`);

        // ── Private extended summary to broadcaster ───────────────────────────
        if ($room.owner && typeof $room.sendNotice === 'function') {
            const extSummary =
                `📊 Panel Updated — ${new Date().toLocaleTimeString()}\n` +
                `🎯 ${goalLabel}: ${goalDisplay}\n` +
                `💰 Jackpot: ${jackpot} tokens\n` +
                `👑 Top Tipper: ${topTipper} (${topAmount} tokens)\n` +
                `🎰 Total Spins: ${totalSpins}\n` +
                `❤️ New Followers: ${followers}`;
            // Only send privately; do NOT flood chat — throttle externally
        }

    } catch (error) {
        console.error("### ERROR in 'Broadcast Panel Update' handler ###");
        console.error("Error:", error.message);
        try {
            if ($room && typeof $room.setPanelTemplate === 'function') {
                const msg = (error.message || 'Error').substring(0, 20);
                $room.setPanelTemplate({
                    template: '3_rows_of_labels',
                    row1_label: 'Panel Error:', row1_value: msg,
                    row2_label: 'Check logs', row2_value: '',
                    row3_label: '', row3_value: '',
                });
            }
        } catch (_) { /* ignore */ }
    } finally {
        console.log("--- 'Broadcast Panel Update' Event Handler Finished ---");
    }
})();
