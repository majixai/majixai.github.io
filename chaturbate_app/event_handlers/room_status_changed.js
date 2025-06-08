// --- Room Status Changed Event Handler ---

// This code runs automatically whenever the room's broadcast status changes
// (e.g., Public -> Private, Private -> Offline, Offline -> Public, etc.)

// --- Available Payload Variables (Likely, confirm with docs) ---
// $app:      Information about the app instance.
// $room:     Information about the room, INCLUDING the new status.
// $kv:       Access to the Key-Value store.
// $limitcam: Information about stream limits.
// --- Key Variable for this Event ---
// $room.status: Contains the NEW room status (e.g., 'public', 'private', 'offline', 'group', 'ticket').
//               NOTE: The exact status names ('public', 'private', etc.)
//               might differ slightly on the platform. Check the documentation.

// --- Script Logic ---

// Check for essential payload variables
if (typeof $room === 'undefined' || typeof $kv === 'undefined') {
    console.error("[Room Status Change] $room or $kv object not available. Cannot process status change.");
    // return; // Exit if essential objects are missing
}

// 1. Get the new room status
const newStatus = (typeof $room !== 'undefined' && $room.status) ? $room.status : 'unknown_status';
const previousStatus = (typeof $kv !== 'undefined') ? ($kv.get('currentRoomStatus') || 'unknown_prev_status') : 'unknown_prev_status';

// Log the change for debugging, including previous status if available
console.log(`[Room Status Change] Status changed from '${previousStatus}' to '${newStatus}' at ${new Date().toISOString()}`);


// 2. Store the new status in the Key-Value store for reference elsewhere
if (typeof $kv !== 'undefined') {
    $kv.set('currentRoomStatus', newStatus);
} else {
    // Warning already logged above
}

// 3. Announce the change and potentially take different actions based on the status
let noticeMessage = '';

// Avoid sending notices if the status hasn't actually changed
// (can happen if the event fires spuriously or if status is initially set)
if (newStatus !== previousStatus || previousStatus === 'unknown_prev_status') { // Send if changed or first time
    switch (newStatus) {
      case 'public':
        noticeMessage = '🟢 Room status changed to PUBLIC! Everyone is welcome!';
        // Optional: Reset certain app features relevant only to private/group shows?
        // if (typeof $kv !== 'undefined') { $kv.set('privateShowData', null); }
        break;
      case 'private':
        noticeMessage = '🔒 Room status changed to PRIVATE! Enjoy the exclusive show!';
        // Optional: Announce private show rates or rules?
        // $room.sendNotice("Private show rates: X tokens/min. Rules: Be respectful.", { toColorGroup: 'fanclub' }); // Example
        break;
      case 'group':
        noticeMessage = '👥 Room status changed to GROUP SHOW! Get your ticket to join!';
        // Optional: Announce ticket price or group show goal?
        break;
      case 'ticket': // Many platforms treat Ticket and Group shows similarly or identically
        noticeMessage = '🎟️ Room status changed to TICKET SHOW! Purchase a ticket to watch!';
        // Optional: Announce ticket price?
        break;
      case 'offline':
        noticeMessage = '🌙 Room is now OFFLINE. Thanks for hanging out! See you next time!';
        // Optional: Maybe clear some temporary data from $kv?
        // if (typeof $kv !== 'undefined') { $kv.set('liveStreamSpecificData', null); }
        break;
      case 'unknown_status':
        noticeMessage = '⚠️ Room status is currently UNKNOWN. The app might behave unexpectedly.';
        console.warn("[Room Status Change] Received an unknown status from $room.status.");
        break;
      default:
        // Fallback for any other unexpected status
        noticeMessage = `ℹ️ Room status updated to: ${newStatus}`;
        console.log(`[Room Status Change] Status changed to an unhandled value: ${newStatus}`);
        break;
    }

    // Send the tailored notice to the chat
    if (noticeMessage && typeof $room !== 'undefined' && typeof $room.sendNotice === 'function') {
      $room.sendNotice(noticeMessage);
    } else {
        if (!noticeMessage) {
            // This case should ideally not be hit if newStatus !== previousStatus logic is sound
            console.log("[Room Status Change] No notice message generated for status change (this might be intended if status unchanged).");
        } else {
            console.warn("[Room Status Change] $room.sendNotice method not available. Cannot send status change notice.");
        }
    }
} else {
    console.log(`[Room Status Change] Event triggered, but room status ('${newStatus}') remains unchanged. No notice sent.`);
}

// 4. OPTIONAL: Further logging or actions
console.log(`[Room Status Change] Finished processing status change to ${newStatus}.`);
