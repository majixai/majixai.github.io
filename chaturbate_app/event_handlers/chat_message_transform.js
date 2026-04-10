// --- Chat Message Transform Event Handler ---
// Filters, enriches, and transforms incoming chat messages before display.

// ─── Config (from $kv) ────────────────────────────────────────────────────────
const naughtyPatternsRaw = $kv.get('naughty_word_patterns') ||
    ['\\b(freak|darn|nipple|boobs|tit|fuck|dildo|pussy|little|girl|ass)\\b', '\\b(idiot|moron)\\b'];
const naughtyPatterns = naughtyPatternsRaw.map(p => new RegExp(p, 'gi'));

const vipUsers               = $kv.get('vip_users')               || [];
const repetitionThresholdMs  = parseInt($kv.get('repetition_threshold_ms') || '5000');
const maxRepetitionCount     = parseInt($kv.get('max_repetition_count')    || '3');

// ─── User-Specific Session Tracking (volatile — resets each execution) ────────
const lastMessagesByUser = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isVipChatUser(username) {
    return vipUsers.includes(username);
}

function isHighTipper(username) {
    const lifetime = Number($kv.get(`lifetime_tips_${username}`) || 0);
    return lifetime >= 500; // Silver tier and above
}

function getUserChatTier(username) {
    if (typeof calculateUserTier === 'function') {
        const lifetime = Number($kv.get(`lifetime_tips_${username}`) || 0);
        return calculateUserTier(lifetime);
    }
    return null;
}

function filterMessage(body) {
    let filtered = body;
    for (const pattern of naughtyPatterns) {
        filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
    }
    return filtered;
}

function isSpamRepetition(username, currentMessage) {
    const now  = Date.now();
    const data = lastMessagesByUser[username] || { lastMessage: '', count: 0, timestamp: 0 };

    if (currentMessage.trim() === data.lastMessage.trim() && (now - data.timestamp) < repetitionThresholdMs) {
        data.count++;
        if (data.count >= maxRepetitionCount) {
            console.log(`[Transform] Spam detected: ${username}`);
            lastMessagesByUser[username] = data;
            return true;
        }
    } else {
        data.lastMessage  = currentMessage;
        data.count        = 1;
        data.timestamp    = now;
    }
    lastMessagesByUser[username] = data;
    return false;
}

/** Amplify lucky keywords with surrounding emojis */
function amplifyLuckyWords(body) {
    const luckyKeywords = [
        { word: /\bjackpot\b/gi, emoji: '💰' },
        { word: /\bwin\b/gi,     emoji: '🏆' },
        { word: /\blucky\b/gi,   emoji: '🍀' },
        { word: /\bspin\b/gi,    emoji: '🎰' },
        { word: /\bhot\b/gi,     emoji: '🔥' },
        { word: /\bamazing\b/gi, emoji: '✨' },
        { word: /\bwow\b/gi,     emoji: '😱' },
        { word: /\bgoal\b/gi,    emoji: '🎯' },
    ];
    let result = body;
    for (const { word, emoji } of luckyKeywords) {
        result = result.replace(word, (match) => `${emoji}${match}${emoji}`);
    }
    return result;
}

/** Build a VIP prefix badge for the user */
function buildVipBadge(username) {
    const tier = getUserChatTier(username);
    if (tier && tier.name !== 'Bronze') {
        return `${tier.emoji}[${tier.name}] `;
    }
    if (isVipChatUser(username)) {
        return `✨[VIP] `;
    }
    return '';
}

// ─── Main Transform ───────────────────────────────────────────────────────────

const senderUsername = $user.username;
let   messageBody    = $message.body;

// 1. Spam / repetition check (mark as spam, halt processing)
if (isSpamRepetition(senderUsername, messageBody)) {
    if (typeof $message.setSpam === 'function') {
        $message.setSpam(true);
    }
    // Early exit — do not modify the message further
    console.log(`[Transform] Message from ${senderUsername} marked as spam.`);
} else {
    // 2. Apply naughty word filter to non-VIP / non-tipper users
    if (!isVipChatUser(senderUsername) && !isHighTipper(senderUsername)) {
        messageBody = filterMessage(messageBody);
    }

    // 3. Amplify lucky keyword words for everyone (fun feature)
    messageBody = amplifyLuckyWords(messageBody);

    // 4. Add VIP / tier badge prefix for qualifying users
    const badge = buildVipBadge(senderUsername);
    if (badge) {
        messageBody = badge + messageBody;
    }

    // 5. Increment chat message counter (for chatterbox achievement)
    const chatCountKey = `chat_count_${senderUsername}`;
    const chatCount    = Number($kv.get(chatCountKey) || 0) + 1;
    $kv.set(chatCountKey, chatCount);

    // Check chatterbox achievement
    if (typeof checkAchievement === 'function' && typeof getAchievementBadge === 'function') {
        const ach = checkAchievement('chatterbox', chatCount);
        if (ach && $room && typeof $room.sendNotice === 'function') {
            $room.sendNotice(getAchievementBadge(ach, senderUsername));
        }
    }

    // 6. Apply the transformed message
    if (typeof $message.setBody === 'function') {
        $message.setBody(messageBody);
    }

    console.log(`[Transform] ${senderUsername}: "${$message.body}" → "${messageBody}"`);
}
