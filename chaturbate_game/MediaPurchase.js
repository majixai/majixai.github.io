// --- Media Purchase Event Handler ---
// Runs when a user purchases media (photos, videos, social media access).

// --- Get Data from Payload ---
const buyerUsername = $user.username; // User who bought the media
const mediaName = $media.name;       // Name of the item purchased
const tokensSpent = $media.tokens;     // Tokens spent on this purchase
const mediaType = $media.type;       // Type ('photo', 'video', 'social_media', etc.)
const roomOwner = $room.owner;       // Broadcaster's username

// --- 1. Public Announcement & 2. Thank You ---
// Combine these into a single, friendly message.
// Adjust the message and emojis to your preference! ✨📸🎬💖

let announcement = `🎉 Big thanks to ${buyerUsername} for purchasing "${mediaName}"`;
if (tokensSpent > 0) {
  announcement += ` for ${tokensSpent} tokens!`;
}
announcement += ` Support Me Hard! ❤️`;

// Send the public notice to the chat
$room.sendNotice(announcement);

// --- 3. Keep Track of Sales Totals using $kv ---

// Define keys for storing totals in the Key-Value store
const totalTokensKey = 'mediaSalesTotalTokens';
const totalCountKey = 'mediaSalesTotalCount';

// Get current totals from $kv, defaulting to 0 if they haven't been set yet
let currentTotalTokens = $kv.get(totalTokensKey) || 0;
let currentTotalCount = $kv.get(totalCountKey) || 0;

// Update the totals with the current purchase details
// Ensure tokensSpent is treated as a number (it should be, but safety first)
currentTotalTokens += Number(tokensSpent) || 0;
currentTotalCount += 1; // Increment the count for each sale

// Save the updated totals back into the $kv store
$kv.set(totalTokensKey, currentTotalTokens);
$kv.set(totalCountKey, currentTotalCount);

// --- Optional: Notify Broadcaster Privately with Updated Totals ---
// This sends a message only the broadcaster can see.
const privateNoticeOptions = { toUsername: roomOwner, color: '#8C1515' }; // Light blue color
const privateMessage = `[Media Sale] User: ${buyerUsername}, Item: ${mediaName}, Tokens: ${tokensSpent}. | Totals: ${currentTotalCount} items, ${currentTotalTokens} tokens.`;
$room.sendNotice(privateMessage, privateNoticeOptions);


// --- 4. Combine with Other Features (Examples) ---

// Example: Trigger a sound alert (if you have a system for this)
// playSoundEffect('media_purchase_alert'); // Placeholder function

// Example: Update an overlay display (if using Web Components/Broadcast Overlays)
// $app.broadcastToOverlay('newMediaSale', {
//   username: buyerUsername,
//   itemName: mediaName,
//   tokens: tokensSpent,
//   totalTokens: currentTotalTokens,
//   totalCount: currentTotalCount
// });

// Example: Check if this purchase meets a specific goal stored in $kv
// const mediaGoalTokens = $kv.get('mediaSaleGoalTokens');
// if (mediaGoalTokens && currentTotalTokens >= mediaGoalTokens) {
//   $room.sendNotice(`✨ Woohoo! We hit the Media Sales Goal of ${mediaGoalTokens} tokens thanks to ${buyerUsername}! ✨`);
//   // Potentially reset the goal or set a new one
//   $kv.set('mediaSaleGoalTokens', null); // Or set next goal value
// }

// Add other custom logic here based on your app's needs.
