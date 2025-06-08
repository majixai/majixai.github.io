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
