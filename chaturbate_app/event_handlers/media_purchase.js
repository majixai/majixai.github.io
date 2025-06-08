// --- Media Purchase Event Handler ---
// Runs when a user purchases media (photos, videos, social media access).

// --- Get Data from Payload ---
// Add checks for $user, $media, $room availability
const buyerUsername = (typeof $user !== 'undefined' && $user.username) ? $user.username : 'Someone';
const mediaName = (typeof $media !== 'undefined' && $media.name) ? $media.name : 'some awesome media';
const tokensSpent = (typeof $media !== 'undefined' && $media.tokens) ? $media.tokens : 0;
const mediaType = (typeof $media !== 'undefined' && $media.type) ? $media.type : 'unknown'; // Type ('photo', 'video', 'social_media', etc.)
const roomOwner = (typeof $room !== 'undefined' && $room.owner) ? $room.owner : null;

// Log essential details
console.log(`[Media Purchase] User: ${buyerUsername}, Item: "${mediaName}", Type: ${mediaType}, Tokens: ${tokensSpent}`);

// --- 1. Public Announcement & 2. Thank You ---
// Combine these into a single, friendly message.
// Adjust the message and emojis to your preference! ✨📸🎬💖

let announcement = `🎉 Big thanks to ${buyerUsername} for purchasing "${mediaName}"`;
if (tokensSpent > 0) {
  announcement += ` for ${tokensSpent} tokens!`;
}
announcement += ` Support Me Hard! ❤️`;

// Send the public notice to the chat
if (typeof $room !== 'undefined' && typeof $room.sendNotice === 'function') {
    $room.sendNotice(announcement);
} else {
    console.warn("[Media Purchase] $room.sendNotice is not available. Cannot send public announcement.");
}

// --- 3. Keep Track of Sales Totals using $kv ---
if (typeof $kv !== 'undefined') {
    // Define keys for storing totals in the Key-Value store
    const totalTokensKey = 'mediaSalesTotalTokens';
    const totalCountKey = 'mediaSalesTotalCount';

    // Get current totals from $kv, defaulting to 0 if they haven't been set yet
    let currentTotalTokens = $kv.get(totalTokensKey) || 0;
    let currentTotalCount = $kv.get(totalCountKey) || 0;

    // Update the totals with the current purchase details
    // Ensure tokensSpent is treated as a number
    currentTotalTokens += Number(tokensSpent) || 0;
    currentTotalCount += 1; // Increment the count for each sale

    // Save the updated totals back into the $kv store
    $kv.set(totalTokensKey, currentTotalTokens);
    $kv.set(totalCountKey, currentTotalCount);

    console.log(`[Media Purchase] Updated KV totals: ${currentTotalCount} items, ${currentTotalTokens} tokens.`);

    // --- Optional: Notify Broadcaster Privately with Updated Totals ---
    // This sends a message only the broadcaster can see.
    if (roomOwner && typeof $room !== 'undefined' && typeof $room.sendNotice === 'function') {
        const privateNoticeOptions = { toUsername: roomOwner, color: '#8C1515' }; // Example color
        const privateMessage = `[Media Sale] User: ${buyerUsername}, Item: "${mediaName}", Tokens: ${tokensSpent}. | Totals: ${currentTotalCount} items, ${currentTotalTokens} tokens.`;
        $room.sendNotice(privateMessage, privateNoticeOptions);
    } else {
        if (!roomOwner) console.warn("[Media Purchase] Room owner username not found. Cannot send private total summary.");
        // Warning for $room.sendNotice already covered above
    }

} else {
    console.warn("[Media Purchase] $kv service not available. Cannot update sales totals.");
}


// --- 4. Combine with Other Features (Examples) ---

// Example: Trigger a sound alert (if you have a system for this)
// if (typeof playSoundEffect === 'function') { // Check if function exists
//   playSoundEffect('media_purchase_alert'); // Placeholder function
// }

// Example: Update an overlay display (if using Web Components/Broadcast Overlays)
// if (typeof $app !== 'undefined' && typeof $app.broadcastToOverlay === 'function') {
//   $app.broadcastToOverlay('newMediaSale', {
//     username: buyerUsername,
//     itemName: mediaName,
//     tokens: tokensSpent,
//     totalTokens: $kv ? $kv.get('mediaSalesTotalTokens') : 'N/A', // Safely get latest totals
//     totalCount: $kv ? $kv.get('mediaSalesTotalCount') : 'N/A'
//   });
// }

// Example: Check if this purchase meets a specific goal stored in $kv
// if (typeof $kv !== 'undefined' && typeof $room !== 'undefined' && typeof $room.sendNotice === 'function') {
//   const mediaGoalTokens = $kv.get('mediaSaleGoalTokens');
//   const currentTotalTokensFromKV = $kv.get('mediaSalesTotalTokens') || 0; // Fetch fresh value
//   if (mediaGoalTokens && currentTotalTokensFromKV >= mediaGoalTokens) {
//     $room.sendNotice(`✨ Woohoo! We hit the Media Sales Goal of ${mediaGoalTokens} tokens thanks to ${buyerUsername}! ✨`);
//     // Potentially reset the goal or set a new one
//     $kv.set('mediaSaleGoalTokens', null); // Or set next goal value
//     console.log(`[Media Purchase] Media sales goal of ${mediaGoalTokens} tokens achieved!`);
//   }
// }

// Add other custom logic here based on your app's needs.
console.log(`[Media Purchase] Finished processing media purchase for ${buyerUsername}.`);
