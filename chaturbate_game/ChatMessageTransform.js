// --- Chat Message Transform Event Handler (Advanced) ---

// --- Configuration (Loaded from $kv) ---
const naughtyWordPatternsRaw = $kv.get('naughty_word_patterns') || ['\\b(freak|darn|nipple|boobs|tit|fuck|dildo|pussy|little|girl|ass)\\b', '\\b(idiot|moron)\\b'];
const naughtyWordPatterns = naughtyWordPatternsRaw.map(pattern => new RegExp(pattern, 'gi')); // 'gi' for global and case-insensitive

const vipUsers = $kv.get('vip_users') || []; // Array of usernames who get special treatment
const repetitionThresholdMs = parseInt($kv.get('repetition_threshold_ms') || '5000'); // Time in milliseconds
const maxRepetitionCount = parseInt($kv.get('max_repetition_count') || '3');

// --- User-Specific Tracking (Volatile, resets each event handler execution) ---
// This is NOT for persistent storage, just for tracking within this transform cycle.
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
    const userData = lastMessagesByUser.hasOwnProperty(username) ? lastMessagesByUser[`${username}`] : { lastMessage: '', count: 0, timestamp: 0 };

    if (currentMessage.trim() === userData.lastMessage.trim() && (now - userData.timestamp) < repetitionThresholdMs) {
        userData.count++;
        if (userData.count >= maxRepetitionCount) {
            console.log(`Chat Transform: Repetitive message detected from ${username}. Marking as spam.`);
            return true; // Mark as spam
        }
    } else {
        userData.lastMessage = currentMessage;
        userData.count = 1;
        userData.timestamp = now;
    }
    lastMessagesByUser[`${username}`] = userData;
    return false; // Not spam (yet)
}

// --- Main Transformation Logic ---

const senderUsername = $user.username;
let messageBody = $message.body;

// --- Repetition Prevention ---
if (handleRepetition(senderUsername, messageBody)) {
    $message.setSpam(true);
    // Stop further processing for this message
}

// --- VIP User Handling ---
if (isVIP(senderUsername)) {
    // Example: Add a VIP badge to their messages (could be stylized in CSS if your platform supports it)
    messageBody = `✨ [VIP] ${messageBody} ✨`;
} else {
    // --- Apply Filtering for Non-VIP Users ---
    messageBody = filterMessage(messageBody);
}

// --- Set the Transformed Message Body ---
$message.setBody(messageBody);

// --- Optional: Log the transformation ---
console.log(`Chat Transform: User ${senderUsername} - Original: "${$message.body}" - Transformed: "${messageBody}"`);
