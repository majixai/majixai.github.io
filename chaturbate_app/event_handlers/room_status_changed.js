// --- Room Status Changed Event Handler ---
// Runs whenever the room status changes (public, private, offline, group, ticket).
// Available: $room, $kv, $callback, $overlay

console.log("--- 'Room Status Changed' Event Handler Executed ---");

if (typeof $room === 'undefined' || typeof $kv === 'undefined') {
    console.error("[Room Status] $room or $kv not available. Aborting.");
} else {
    // ── 1. Read old and new status ─────────────────────────────────────────────
    const newStatus  = $room.status || 'unknown_status';
    const prevStatus = $kv.get('currentRoomStatus') || 'unknown_prev_status';

    console.log(`[Room Status] Changed: "${prevStatus}" → "${newStatus}" at ${new Date().toISOString()}`);

    // ── 2. Record timing ──────────────────────────────────────────────────────
    const now          = Date.now();
    const prevEnterTs  = Number($kv.get('statusEnterTime') || now);
    const duration     = now - prevEnterTs;
    const durationStr  = typeof formatDuration === 'function' ? formatDuration(duration) : `${Math.floor(duration / 60000)} min`;

    $kv.set('currentRoomStatus', newStatus);
    $kv.set('statusEnterTime',   now);
    $kv.set('prevRoomStatus',    prevStatus);

    // Track time spent in each status
    if (prevStatus !== 'unknown_prev_status') {
        const timeKey = `status_duration_${prevStatus}`;
        const prev    = Number($kv.get(timeKey) || 0);
        $kv.set(timeKey, prev + duration);
        console.log(`[Room Status] Was in "${prevStatus}" for ${durationStr}.`);
    }

    // ── 3. Status-specific logic ──────────────────────────────────────────────
    if (newStatus !== prevStatus || prevStatus === 'unknown_prev_status') {
        let noticeMsg  = '';
        let noticeColor = '#00539B';

        const goalAmt  = Number($kv.get('tip_goal_target_amount')    || 0);
        const goalPrg  = Number($kv.get('tip_goal_current_progress') || 0);
        const goalLbl  = $kv.get('tip_goal_label') || 'Show Goal';
        const jackpot  = Number($kv.get('spin_jackpot_pool')          || 0);

        switch (newStatus) {
            case 'public':
                noticeMsg   = [
                    `🟢 Room is now PUBLIC — everyone welcome! 🎉`,
                    goalAmt > 0 ? `🎯 Goal: ${goalPrg}/${goalAmt} tokens for ${goalLbl}!` : '',
                    `💰 Jackpot Pool: ${jackpot} tokens — tip to spin & win!`,
                ].filter(Boolean).join('\n');
                noticeColor = '#00C853';
                // Emit overlay update
                if ($overlay) {
                    try { $overlay.emit('MainOverlay', { eventName: 'statusPublic' }); } catch (_) {}
                }
                break;

            case 'private':
                noticeMsg   = [
                    `🔒 Room entered PRIVATE mode! 😉`,
                    `Thanks to everyone who is part of this exclusive show!`,
                    `Public chat will be back soon! 💖`,
                ].join('\n');
                noticeColor = '#E91E63';
                // Store when private started
                $kv.set('privateShowStartTime', now);
                if ($overlay) {
                    try { $overlay.emit('MainOverlay', { eventName: 'statusPrivate' }); } catch (_) {}
                }
                break;

            case 'group':
            case 'ticket':
                noticeMsg   = `👥 Group/Ticket show starting! Get your ticket to join the fun! 🎟️`;
                noticeColor = '#FF9800';
                break;

            case 'offline':
                noticeMsg   = [
                    `🌙 Stream is now OFFLINE. Thank you for an amazing show! 💖`,
                    `Total tips this stream: ${Number($kv.get('totalTipsThisStream') || 0)} tokens!`,
                    `See you next time! Follow to get notified when I go live! ❤️`,
                ].join('\n');
                noticeColor = '#607D8B';

                // Clear per-stream counters on going offline
                $kv.set('totalTipsThisStream', 0);
                $kv.set('broadcastFollowerCount', 0);
                $kv.set('followedUsersThisBroadcast', []);
                $kv.set('tip_goal_current_progress', 0);

                if ($overlay) {
                    try { $overlay.emit('MainOverlay', { eventName: 'statusOffline' }); } catch (_) {}
                }
                break;

            default:
                noticeMsg   = `ℹ️ Room status changed to: ${newStatus}`;
                console.log(`[Room Status] Unhandled status: ${newStatus}`);
                break;
        }

        // ── 4. Send notice ────────────────────────────────────────────────────
        if (noticeMsg && $room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(noticeMsg, { color: noticeColor });
        }

        // ── 5. Private broadcaster notification ───────────────────────────────
        if ($room.owner && typeof $room.sendNotice === 'function' && prevStatus !== 'unknown_prev_status') {
            $room.sendNotice(
                `[Status Change] "${prevStatus}" → "${newStatus}" (was in prev for ${durationStr})`,
                { toUsername: $room.owner, color: '#607D8B' }
            );
        }
    } else {
        console.log(`[Room Status] Status unchanged ("${newStatus}"). No notice sent.`);
    }

    console.log(`[Room Status] Finished processing. Current status: ${newStatus}.`);
}

console.log("--- 'Room Status Changed' Event Handler Finished ---");
