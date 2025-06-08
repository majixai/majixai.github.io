// --- Chat Message Transform Event Handler (Advanced) ---

// --- Configuration (Loaded from $kv) ---
const naughtyWordPatternsRaw = $kv.get('naughty_word_patterns') || ['\\b(freak|darn|nipple|boobs|tit|fuck|dildo|pussy|little|girl|ass)\\b', '\\b(idiot|moron)\\b'];
const naughtyWordPatterns = naughtyWordPatternsRaw.map(pattern => new RegExp(pattern, 'gi')); // 'gi' for global and case-insensitive

const vipUsers = $kv.get('vip_users') || []; // Array of usernames who get special treatment
const repetitionThresholdMs = parseInt($kv.get('repetition_threshold_ms') || '5000'); // Time in milliseconds
const maxRepetitionCount = parseInt($kv.get('max_repetition_count') || '3');

// --- User-Specific Tracking (Volatile, resets each event handler execution) ---
// This is NOT for persistent storage, just for tracking within this transform cycle.
// CB App environment might not persist this across separate message events if each transform is a new execution scope.
// For true cross-message state, $kv would be needed, but that's too slow for this type of check.
// This will only catch repetitions if the same user sends messages handled by the *same instance* of this script.
// In many FaaS/serverless environments, this means it's only effective for very rapid succession of messages.
let lastMessagesByUser = {}; // { username: { lastMessage: '...', count: 0, timestamp: Date.now() } }

// --- Helper Functions ---

function isVIP(username) {
    return vipUsers.includes(username);
}

function filterMessage(messageBody) {
    let filteredBody = messageBody;
    naughtyWordPatterns.forEach(pattern => {
        filteredBody = filteredBody.replace(pattern, (match) => {
            // Replace with asterisks, keeping the length (more subtle than '****')
            return '*'.repeat(match.length);
            // Or a more context-aware replacement: '[Filtered]'
        });
    });
    return filteredBody;
}

function handleRepetition(username, currentMessage) {
    const now = Date.now();
    // Ensure $user is available before accessing username
    const userKey = username || 'unknown_user';
    const userData = lastMessagesByUser.hasOwnProperty(userKey) ? lastMessagesByUser[userKey] : { lastMessage: '', count: 0, timestamp: 0 };

    if (currentMessage.trim() === userData.lastMessage.trim() && (now - userData.timestamp) < repetitionThresholdMs) {
        userData.count++;
        if (userData.count >= maxRepetitionCount) {
            console.log(`Chat Transform: Repetitive message detected from ${userKey}. Marking as spam.`);
            return true; // Mark as spam
        }
    } else {
        userData.lastMessage = currentMessage;
        userData.count = 1;
        userData.timestamp = now;
    }
    lastMessagesByUser[userKey] = userData;
    return false; // Not spam (yet)
}

// --- Main Transformation Logic ---

// Ensure $user and $message are available (standard in CB transform handlers)
if (typeof $user !== 'undefined' && typeof $message !== 'undefined') {
    const senderUsername = $user.username;
    let originalBody = $message.body; // Keep original for logging
    let transformedBody = originalBody;

    // --- Repetition Prevention ---
    // Note: Effectiveness of lastMessagesByUser depends on execution environment persistence.
    if (handleRepetition(senderUsername, transformedBody)) {
        $message.setSpam(true);
        // Optionally, clear the message body or set a generic spam message if setSpam(true) doesn't hide it
        // transformedBody = "[Message flagged as spam]";
    } else { // Only apply other transforms if not marked as spam
        // --- VIP User Handling ---
        if (isVIP(senderUsername)) {
            // Example: Add a VIP badge to their messages
            transformedBody = `✨ [VIP] ${transformedBody} ✨`;
        } else {
            // --- Apply Filtering for Non-VIP Users ---
            transformedBody = filterMessage(transformedBody);
        }
    }

    // --- Set the Transformed Message Body ---
    // Only set if it actually changed or if it was marked as spam (to potentially clear it)
    if (transformedBody !== originalBody || $message.isSpam()) {
        $message.setBody(transformedBody);
    }

    // --- Optional: Log the transformation ---
    console.log(`Chat Transform: User ${senderUsername} - Spam: ${$message.isSpam()} - Original: "${originalBody}" - Transformed: "${transformedBody}"`);

} else {
    console.error("Chat Transform: $user or $message object not available. Transformation skipped.");
}
