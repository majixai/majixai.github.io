// --- Code executed BEFORE every event handler ---
// Define reusable functions and constants here.

// Define constants (e.g., for colors)
const APP_BLUE = '#00539B';
const APP_GREEN = '#00ff00';
const APP_RED = '#ff0000';
const APP_DEFAULT_PREFIX = '!'; // Define a default command prefix

// Define a reusable function (e.g., to check if a user is a mod/broadcaster)
// This function would be CALLED from within an event handler that has access to $user
function canUserUseAdminCommand(user, kv) {
    // Assuming $user object is passed from handler and $kv is accessible
    if (!user) return false;
    if (user.is_broadcaster) return true;
    // Assuming you store mods in $kv (set in App Start or config)
    const modUsernames = kv.get('moderator_usernames') || [];
    if (user.username && modUsernames.includes(user.username)) {
         return true;
    }
    // Assuming is_mod property is available on $user (check docs)
    // if (user.is_mod) return true; // Alternative check if platform provides this

    return false; // Default: not authorized
}


// Define another reusable function (e.g., to find a chat command)
// This function would be CALLED from within the onChatMessage handler
// and passed the message text and the desired prefix (potentially from $kv)
function extractCommand(messageText, prefix) {
    if (!messageText || !prefix || !messageText.startsWith(prefix)) {
        return null; // Not a command
    }
    // Remove prefix and split into command and arguments
    const parts = messageText.substring(prefix.length).trim().split(' ');
    const command = parts[0].toLowerCase(); // Get the command name (lowercase)
    const args = parts.slice(1); // Get the rest as arguments
    return {
        command: command,
        args: args
    };
}

// The example function provided: getCommandIndex (useful for legacy shortcodes or multi-part messages)
// This is slightly different, looking for '/' anywhere, not just at the start
function getCommandIndex(message){
    for(let i = 0; i < message.length; i++){
        if(message[i].charAt(0)=='/'){ // Note: This checks for '/' at the start of *each word* if message is an array of words
            return i;
        }
    }
    return -1;
}
// Note on getCommandIndex: If message is a single string, this likely needs adjustment
// e.g., message.indexOf('/') to find the first slash in the string.
// Assuming message in the example might imply a pre-split array of words.

// --- End of Shared Code ---

// --- Shared Code ---

function getSpinWheelConfig(kv) {
    // Load spin wheel configuration from $kv, default if not set
    const configString = kv.get('spin_wheel_config');
    if (configString) {
        try {
            return JSON.parse(configString);
        } catch (e) {
            console.error("Error parsing spin wheel config from $kv:", e);
            return getDefaultSpinWheelConfig();
        }
    }
    return getDefaultSpinWheelConfig();
}

function getDefaultSpinWheelConfig() {
    return {
        segments: [
            { label: "Panties!", tokens: 25, weight: 1 },
            { label: "Flash!", tokens: 50, weight: 1 },
            { label: "Anal!", tokens: 200, weight: 0.5 },
            { label: "No Reward", tokens: 0, weight: 1.5 },
            { label: "Bonus Prize!", custom: "Special Animation", weight: 0.8 },
            { label: "Another Chance", tokens: 0, weight: 1.2 },
        ],
        spinThreshold: 100,
    };
}

function getRandomWeightedSpinResult(config) {
    const segments = config.segments;
    let totalWeight = segments.reduce((sum, segment) => sum + (segment.weight || 1), 0);
    let randomNumber = Math.random() * totalWeight;
    let weightSum = 0;

    for (const segment of segments) {
        weightSum += (segment.weight || 1);
        if (randomNumber <= weightSum) {
            return segment;
        }
    }
    // Fallback in case of calculation error
    return segments [Math.floor(Math.random() * segments.length)];
}

function grantSpinOpportunity(username, tipAmount, kv) {
    const hasSpunThisSession = kv.get(`has_spun_${username}`);
    const spinThreshold = parseInt(getSpinWheelConfig(kv).spinThreshold || '100');

    if (!hasSpunThisSession && tipAmount >= spinThreshold) {
        kv.set(`has_spun_${username}`, true);
        return true;
    }
    return false;
}

function handleSpinOutcome(result, username, callback, kv) {
    if (result.tokens > 0) {
        if (callback && typeof callback.chat === 'function') {
            callback.chat(`🎉 ${username} spun the wheel and won ${result.tokens} bonus tokens! 🎉`);
            // Implement actual token awarding if the platform allows
            console.log(`Awarded ${result.tokens} bonus tokens to ${username}`);
        }
    } else if (result.custom) {
        if (callback && typeof callback.chat === 'function') {
            callback.chat(`🎉 ${username} landed on "${result.label}"! Time for a ${result.custom}! 🎉`);
            // Trigger the custom action on the frontend
        }
    } else {
        if (callback && typeof callback.chat === 'function') {
            callback.chat(`${username} spun the wheel and landed on "${result.label}". Better luck next time!`);
        }
    }
    // Consider when to reset the spin opportunity (e.g., next session)
    // kv.delete(`has_spun_${username}`); // Removed here, might be handled differently
}

// PASTE THIS ENTIRE BLOCK INTO: Event Handlers -> App Lifecycle -> App Loaded

console.log("--- 'App Loaded' Event Handler Executed ---");

// --- Configuration Constants ---
// Must match the constants used in Tip Received handler for symbols
const SLOT_SYMBOLS_DEFAULT = ["🍒", "🔔", " BAR ", " 7 ", "💎"]; // Default symbols
const SLOT_REEL_COUNT_DEFAULT = 3; // Default reel count

// Use an async IIFE
(async () => {
    try {
        console.log("App Loaded: Checking settings and emitting config to overlay...");

        // --- Read Configuration from $settings ---
        // Provide default values if settings are missing or invalid
        const config = {
            slotOverlayName: ($settings && typeof $settings.slotOverlayName === 'string' && $settings.slotOverlayName.trim() !== '') ? $settings.slotOverlayName.trim() : 'Slots', // Default
            // Corrected typo here: slotReeelCount -> slotReelCount
            slotReelCount: ($settings && typeof $settings.slotReelCount === 'number' && $settings.slotReelCount >= 2 && $settings.slotReelCount <= 5) ? $settings.slotReelCount : SLOT_REEL_COUNT_DEFAULT, // Default, Validate range
            slotSymbols: SLOT_SYMBOLS_DEFAULT // Symbols are hardcoded in Tip Received handler, not configurable via settings JSON
        };
        console.log("App Loaded: Using Configuration:", config);
         if (!$settings) {
             console.warn("App Loaded: $settings object not available. Using default configuration.");
         } else if (typeof $settings.slotReelCount !== 'number' || $settings.slotReelCount < 2 || $settings.slotReelCount > 5) {
             console.warn(`App Loaded: Setting 'slotReelCount' invalid (${$settings.slotReelCount}). Using default: ${SLOT_REEL_COUNT_DEFAULT}.`);
         }


        // Emit configuration to the Slot Overlay
        if ($overlay && config.slotOverlayName) {
             $overlay.emit(config.slotOverlayName, {
                 eventName: 'setConfig', // New event name
                 payload: {
                     symbols: config.slotSymbols, // Pass the symbols
                     reelCount: config.slotReelCount // Pass the reel count
                 }
             });
             console.log(`App Loaded: Emitted 'setConfig' to overlay '${config.slotOverlayName}' with Reel Count ${config.slotReelCount} and ${config.slotSymbols.length} symbols.`);
        } else {
             console.warn(`App Loaded: Cannot emit 'setConfig': $overlay not available or config.slotOverlayName ('${config.slotOverlayName}') is not set.`);
        }

    } catch (error) {
        console.error("### FATAL ERROR in 'App Loaded' event handler ###");
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        try {
             if ($room && $room.owner && $room.sendNotice) {
                  $room.sendNotice(`🚨 App Error in App Loaded Handler! @${$room.owner} check logs. Error: ${error.message}`, { toUsername: $room.owner, color: '#FF0000' });
              }
        } catch (noticeError) { console.error("Failed trying to send error notice:", noticeError); }
    } finally {
        console.log("--- 'App Loaded' Event Handler Finished ---");
    }
})();

// --- SLOT MACHINE LOGIC (NEW) ---

function getSlotConfig(settings) {
    // Define hardcoded defaults that must match the App Loaded handler
    const SLOT_SYMBOLS_DEFAULT = ["🍒", "🔔", " BAR ", " 7 ", "💎"];
    const SLOT_REEL_COUNT_DEFAULT = 3;

    // Read configuration from $settings, providing default values if missing or invalid.
    const config = {
        overlayName: (settings && typeof settings.slotOverlayName === 'string' && settings.slotOverlayName.trim() !== '') 
            ? settings.slotOverlayName.trim() 
            : 'Slots',
        reelCount: (settings && typeof settings.slotReelCount === 'number' && settings.slotReelCount >= 2 && settings.slotReelCount <= 5) 
            ? settings.slotReelCount 
            : SLOT_REEL_COUNT_DEFAULT,
        symbols: SLOT_SYMBOLS_DEFAULT, // Symbols are not configurable via settings to ensure consistency
        tipThreshold: (settings && typeof settings.slotTipThreshold === 'number' && settings.slotTipThreshold > 0)
            ? settings.slotTipThreshold
            : 50 // Default tip amount to trigger a spin
    };
    return config;
}

function generateSlotOutcome(config) {
    // Generate a random outcome based on the configuration
    const outcome = [];
    for (let i = 0; i < config.reelCount; i++) {
        const randomIndex = Math.floor(Math.random() * config.symbols.length);
        outcome.push(config.symbols[randomIndex]);
    }

    // Determine if the result is a win and calculate the prize
    const isWin = outcome.every(symbol => symbol === outcome[0]);
    let prize = "No Win";
    if (isWin) {
        prize = `${outcome[0]} x${config.reelCount}!`;
        // You could add more complex prize logic here based on the winning symbol
    }

    return {
        outcome: outcome,
        isWin: isWin,
        prize: prize
    };
}

function handleSlotOutcome(result, username, overlayName, chatCallback) {
    // Emit the result to the correct broadcast overlay
    if ($overlay && overlayName) {
        $overlay.emit(overlayName, {
            eventName: 'slotResult',
            ...result, // Includes outcome, isWin, prize
            user: username
        });
        console.log(`Emitted 'slotResult' to overlay '${overlayName}' for user ${username}.`);
    }

    // Optionally send a chat message announcing the win
    if (result.isWin && chatCallback && typeof chatCallback === 'function') {
        chatCallback(`🎉 Congrats ${username}! You won the slot spin with ${result.prize}! 🎉`);
    }
}


// --- SPIN WHEEL LOGIC (EXISTING) ---

function getSpinWheelConfig(kv) {
    // Load spin wheel configuration from $kv, default if not set
    const configString = kv.get('spin_wheel_config');
    if (configString) {
        try {
            return JSON.parse(configString);
        } catch (e) {
            console.error("Error parsing spin wheel config from $kv:", e);
            return getDefaultSpinWheelConfig();
        }
    }
    return getDefaultSpinWheelConfig();
}

function getDefaultSpinWheelConfig() {
    return {
        segments: [
            { label: "Panties!", tokens: 25, weight: 1 },
            { label: "Flash!", tokens: 50, weight: 1 },
            { label: "Anal!", tokens: 200, weight: 0.5 },
            { label: "No Reward", tokens: 0, weight: 1.5 },
            { label: "Bonus Prize!", custom: "Special Animation", weight: 0.8 },
            { label: "Another Chance", tokens: 0, weight: 1.2 },
        ],
        spinThreshold: 100,
    };
}

function getRandomWeightedSpinResult(config) {
    const segments = config.segments;
    let totalWeight = segments.reduce((sum, segment) => sum + (segment.weight || 1), 0);
    let randomNumber = Math.random() * totalWeight;
    let weightSum = 0;

    for (const segment of segments) {
        weightSum += (segment.weight || 1);
        if (randomNumber <= weightSum) {
            return segment;
        }
    }
    // Fallback in case of calculation error
    return segments [Math.floor(Math.random() * segments.length)];
}

function grantSpinOpportunity(username, tipAmount, kv) {
    const hasSpunThisSession = kv.get(`has_spun_${username}`);
    const spinThreshold = parseInt(getSpinWheelConfig(kv).spinThreshold || '100');

    if (!hasSpunThisSession && tipAmount >= spinThreshold) {
        kv.set(`has_spun_${username}`, true);
        return true;
    }
    return false;
}

function handleSpinOutcome(result, username, callback, kv) {
    if (result.tokens > 0) {
        if (callback && typeof callback.chat === 'function') {
            callback.chat(`🎉 ${username} spun the wheel and won ${result.tokens} bonus tokens! 🎉`);
            // Implement actual token awarding if the platform allows
            console.log(`Awarded ${result.tokens} bonus tokens to ${username}`);
        }
    } else if (result.custom) {
        if (callback && typeof callback.chat === 'function') {
            callback.chat(`🎉 ${username} landed on "${result.label}"! Time for a ${result.custom}! 🎉`);
            // Trigger the custom action on the frontend
        }
    } else {
        if (callback && typeof callback.chat === 'function') {
            callback.chat(`${username} spun the wheel and landed on "${result.label}". Better luck next time!`);
        }
    }
    // Consider when to reset the spin opportunity (e.g., next session)
    // kv.delete(`has_spun_${username}`); // Removed here, might be handled differently
}
