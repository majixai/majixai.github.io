// --- Code running every time a user joins the fanclub ---

// Get key information from the payload
const joiningUsername = $user.username;
const userId = $user.id; // The user's unique ID

console.log(`[FANCLUB] User ${joiningUsername} (${userId}) joined the fanclub.`);

// --- Example 1 (from documentation): Thank the user directly ---
// $room.sendNotice sends a private, non-chat notification directly to the user.
if ($room && typeof $room.sendNotice === 'function') {
    $room.sendNotice(`Hello ${joiningUsername}! Thank you so much for joining my fanclub. You now have access to exclusive perks!`, { toUsername: joiningUsername });
} else {
    console.warn("App: $room.sendNotice method not available to thank user.");
}


// --- Example 2: Update persistent storage ($kv) ---
// Add the user's ID or username to a list of fanclub members
let fanclubMembers = $kv.get('fanclub_member_ids') || []; // Initialize as empty array if not exists

// Check if the user ID is already in the list (shouldn't happen if event triggers correctly, but good practice)
if (!fanclubMembers.includes(userId)) {
    fanclubMembers.push(userId);
    $kv.set('fanclub_member_ids', fanclubMembers);
    console.log(`Updated fanclub member list in KV. Total members tracked: ${fanclubMembers.length}`);
} else {
    console.log(`User ${joiningUsername} (${userId}) already in tracked fanclub members list.`);
}

// --- Example 3: Trigger an update for an overlay (if applicable) ---
// Assuming you have an overlay that displays info, you might signal it to update
// The exact method depends on your overlay implementation and $callback methods.
// For example, you might use $callback to send a message to the overlay JS.
// if ($callback && typeof $callback.sendOverlayMessage === 'function') {
//     $callback.sendOverlayMessage('fanclub_count_update', { count: fanclubMembers.length });
// }


// --- Example 4: Send a public chat announcement (Optional, use sparingly) ---
// Check $callback API for the correct method (e.g., chat, sendMessage)
if ($callback && typeof $callback.chat === 'function') {
    // $callback.chat(`🥳 Welcome ${joiningUsername} to the Fanclub!`);
}

// --- Using the $fanclub variable (if it contains useful data) ---
// You could potentially check fanclub tiers here if your broadcaster uses them.
// if ($fanclub && $fanclub.tier_level === 'premium') {
//     // Do something special for premium fanclub members
//     console.log(`${joiningUsername} joined the premium fanclub tier!`);
// }
