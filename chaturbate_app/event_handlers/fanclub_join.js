// --- Code running every time a user joins the fanclub ---

// Get key information from the payload
// Ensure $user is available (standard for this event handler)
const joiningUsername = typeof $user !== 'undefined' ? $user.username : 'UnknownUser';
const userId = typeof $user !== 'undefined' ? $user.id : null; // The user's unique ID

if (typeof $user === 'undefined') {
    console.error("[FANCLUB] Event handler triggered, but $user object is not available. Cannot process join.");
    // Potentially exit or return if $user is critical
    // return;
}

console.log(`[FANCLUB] User ${joiningUsername} (${userId || 'No ID'}) joined the fanclub.`);

// --- Example 1 (from documentation): Thank the user directly ---
// $room.sendNotice sends a private, non-chat notification directly to the user.
if (typeof $room !== 'undefined' && typeof $room.sendNotice === 'function') {
    if (userId) { // Only send if we have a user to send to
        $room.sendNotice(`Hello ${joiningUsername}! Thank you so much for joining my fanclub. You now have access to exclusive perks!`, { toUsername: joiningUsername });
    } else {
        console.warn("[FANCLUB] Cannot send thank you notice: joiningUsername is missing.");
    }
} else {
    console.warn("[FANCLUB] App: $room.sendNotice method not available to thank user.");
}


// --- Example 2: Update persistent storage ($kv) ---
// Add the user's ID or username to a list of fanclub members
if (typeof $kv !== 'undefined' && userId) { // Ensure $kv and userId are available
    let fanclubMembers = $kv.get('fanclub_member_ids') || []; // Initialize as empty array if not exists

    // Check if the user ID is already in the list (shouldn't happen if event triggers correctly, but good practice)
    if (!fanclubMembers.includes(userId)) {
        fanclubMembers.push(userId);
        $kv.set('fanclub_member_ids', fanclubMembers);
        console.log(`[FANCLUB] Updated fanclub member list in KV. Total members tracked: ${fanclubMembers.length}`);
    } else {
        console.log(`[FANCLUB] User ${joiningUsername} (${userId}) already in tracked fanclub members list.`);
    }
} else {
    if (typeof $kv === 'undefined') console.warn("[FANCLUB] $kv service not available. Cannot update fanclub member list.");
    if (!userId) console.warn("[FANCLUB] User ID is missing. Cannot update fanclub member list.");
}

// --- Example 3: Trigger an update for an overlay (if applicable) ---
// Assuming you have an overlay that displays info, you might signal it to update
// The exact method depends on your overlay implementation and $callback methods.
// For example, you might use $callback to send a message to the overlay JS.
// if (typeof $callback !== 'undefined' && typeof $callback.sendOverlayMessage === 'function') {
//     const currentFanClubSize = ($kv.get('fanclub_member_ids') || []).length;
//     $callback.sendOverlayMessage('fanclub_count_update', { count: currentFanClubSize });
//     console.log("[FANCLUB] Sent fanclub_count_update to overlay.");
// }


// --- Example 4: Send a public chat announcement (Optional, use sparingly) ---
// Check $callback API for the correct method (e.g., chat, sendMessage)
// if (typeof $callback !== 'undefined' && typeof $callback.chat === 'function') {
//     // $callback.chat(`🥳 Welcome ${joiningUsername} to the Fanclub!`);
//     // console.log("[FANCLUB] Sent public welcome message to chat.");
// }

// --- Using the $fanclub variable (if it contains useful data) ---
// You could potentially check fanclub tiers here if your broadcaster uses them.
// if (typeof $fanclub !== 'undefined' && $fanclub.tier_level === 'premium') {
//     // Do something special for premium fanclub members
//     console.log(`[FANCLUB] ${joiningUsername} joined the premium fanclub tier!`);
// }

console.log(`[FANCLUB] Finished processing fanclub join for ${joiningUsername}.`);
