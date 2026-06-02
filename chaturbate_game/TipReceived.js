// PASTE THIS ENTIRE BLOCK INTO: Event Handlers -> Tip Received Handler

console.log("--- 'Tip Received' Event Handler Executed ---");

// --- Configuration Constants ---
// Key Names for KV Store (Tip Goal)
const progressKey = "tip_goal_current_progress";
const tipGoalKey = "tip_goal_target_amount";

// Slot Machine Configuration (Hardcoded parts - these will be sent to overlay via App Loaded)
const SLOT_SYMBOLS = ["🍒", "🔔", " BAR ", " 7 ", "💎"]; // Available symbols (MUST MATCH App Loaded handler)

// Define Tiers for Instant Spins with Multipliers triggered by exact tip amounts (Hardcoded)
// Format: { tipAmount: multiplierValue }
const SLOT_MULTIPLIER_TIERS = {
    50: 1,   // Tip 50 triggers x1 spin
    100: 2,  // Tip 100 triggers x2 spin
    250: 5,  // Tip 250 triggers x5 spin
    500: 10  // Tip 500 triggers x10 spin
    // Add more tiers as needed
};

// KV Keys for Spin Accumulation (used by !spin command handler - not shown here)
const spinProgressPrefix = "slot_prog_"; // Prefix for user's token progress towards earning a spin
const earnedSpinsPrefix = "slot_spins_"; // Prefix for user's count of earned spins usable with !spin

// KV Keys for Top Tipper (Standard - kept for potential use, though panel focuses on slots)
const topTipTokensKey = 'topTipSingleAmount';
const topTipUserKey = 'topTipSingleUser';

// KV Keys for Slot Panel Data (Match Panel Handler)
const totalSpinsTriggeredKey = 'total_slot_spins_triggered'; // Total spins triggered globally
const latestSpinUserKey      = 'latest_slot_spin_user';  // User who triggered the last instant spin
const latestSpinOutcomeKey   = 'latest_slot_spin_outcome'; // Outcome of the last instant spin (e.g., ['🍒', '🍒', ' BAR '])


// Wrap the entire handler logic in an async IIFE for await usage
(async () => {
    // --- Read Configuration from $settings ---
    // Provide default values if settings are missing or invalid
    const config = {
        slotOverlayName: ($settings && typeof $settings.slotOverlayName === 'string' && $settings.slotOverlayName.trim() !== '') ? $settings.slotOverlayName.trim() : 'Slots', // Default
        slotReelCount: ($settings && typeof $settings.slotReelCount === 'number' && $settings.slotReelCount >= 2 && $settings.slotReelCount <= 5) ? $settings.slotReelCount : 3, // Default, Validate range
        slotBaseSpinCost: ($settings && typeof $settings.slotBaseSpinCost === 'number' && $settings.slotBaseSpinCost >= 1) ? $settings.slotBaseSpinCost : 50 // Default, Validate min
        // SLOT_SYMBOLS is hardcoded here and needs to match App Loaded handler and Overlay JS
    };
    console.log("Tip Received: Using Configuration:", config);
    if (!$settings) {
        console.warn("Tip Received: $settings object not available. Using default configuration.");
    }


    try {
        // --- Accessing Real Data from Payload Variables ---
        const tipTokens = $tip.tokens;
        const tipMessage = $tip.message || '';
        const isAnonymousTip = $tip.isAnon;

        console.log(`Received Tip - Tokens: ${tipTokens}, Anonymous: ${isAnonymousTip}, Message: "${tipMessage}"`);

        // Accessing detailed user information
        const tippingUsername = isAnonymousTip ? 'Anonymous' : ($user ? $user.username : 'Unknown User');
        const userColorGroup = $user ? $user.colorGroup : null;
        const userIsFollower = $user ? $user.isFollower : false;
        const userIsMod = $user ? $user.isMod : false;
        const userIsOwner = $user ? $user.isOwner : false;
        const userLanguage = $user ? $user.language : 'unknown';
        const userRecentTipsStatus = $user ? $user.recentTips : 'none';
        const userInFanclub = $user ? $user.inFanclub : false;
        const userFcAutoRenew = $user ? $user.fcAutoRenew : false;


        // Log tipper details (optional but helpful for debugging)
        if (!isAnonymousTip && $user) {
             console.log(`Tipper Details: Username: ${tippingUsername}, Color: ${userColorGroup}, Mod: ${userIsMod}, Fan: ${userInFanclub}`); // Example log
        } else if (isAnonymousTip) {
            console.log("Tipper is Anonymous.");
        } else {
            console.warn("Could not retrieve user details for non-anonymous tipper.");
        }

        // Accessing app and room info
        const appName = $app ? $app.name : 'Unknown App';
        const appVersion = $app ? $app.version : 'Unknown Version';
        const broadcasterUsername = $room ? $room.owner : 'Unknown Broadcaster';
        console.log(`App Info - Name: ${appName}, Version: ${appVersion}`);
        console.log(`Room Info - Broadcaster: ${broadcasterUsername}`);

        // Accessing Setting Value for the GENERAL PURPOSE OVERLAY (e.g., for goals, general alerts)
        // This is already being read from settings, but keeping the variable name consistent
        let spinnerOverlayName = 'DefaultOverlayName'; // Fallback name
        if ($settings && typeof $settings.spinnerOverlayName === 'string' && $settings.spinnerOverlayName.trim() !== '') {
            spinnerOverlayName = $settings.spinnerOverlayName.trim();
            console.log(`Using General Purpose Overlay Name from settings: ${spinnerOverlayName}`);
        } else {
            console.warn(`Setting 'spinnerOverlayName' not found or empty. Using default: '${spinnerOverlayName}'. Ensure this overlay exists or events targeting it will fail silently.`);
        }


        // --- *** SLOT MACHINE & SPIN LOGIC *** ---
        let directSpinMultiplier = 0; // To track if an instant spin was triggered
        let spinOutcome = null; // Store outcome for later KV/Overlay updates

        if (tipTokens > 0) { // Process tips with tokens, even anonymous ones for slot triggers
            // --- A) Check for INSTANT SPIN Tiers ---
            if (SLOT_MULTIPLIER_TIERS.hasOwnProperty(tipTokens)) {
                directSpinMultiplier = SLOT_MULTIPLIER_TIERS[tipTokens];
                const spinnerName = isAnonymousTip ? 'Anonymous' : tippingUsername;
                console.log(`Tip amount ${tipTokens} matches tier for x${directSpinMultiplier} instant spin for ${spinnerName}.`);

                // --- Perform Instant Slot Spin Logic ---
                spinOutcome = []; // Array to store the symbols for this spin
                // Use config.slotReelCount from settings
                for (let i = 0; i < config.slotReelCount; i++) {
                    spinOutcome.push(SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
                }
                let isWin = false;
                let prize = "Better Luck Next Time!";
                // --- Define Win Conditions ---
                // Basic 3-of-a-kind check for 3 reels
                if (config.slotReelCount === 3 && spinOutcome.length === 3 && spinOutcome[0] === spinOutcome[1] && spinOutcome[1] === spinOutcome[2]) {
                    isWin = true;
                    switch (spinOutcome[0]) {
                        case "🍒": prize = "Small Win! 🍒x3!"; break;
                        case "🔔": prize = "Nice Win! 🔔x3!"; break;
                        case " BAR ": prize = "Big Win! BARx3!"; break;
                        case "💎": prize = "Great Win! 💎x3!"; break;
                        case " 7 ": prize = "JACKPOT! 777!"; break;
                        default: prize = `Winner! ${spinOutcome[0]} x${config.slotReelCount}!`;
                    }
                }
                // Add win conditions for other reel counts if needed (e.g., 2 reels, 4 reels)
                // For example, 2 reels matching:
                // else if (config.slotReelCount === 2 && spinOutcome.length === 2 && spinOutcome[0] === spinOutcome[1]) {
                //    isWin = true; prize = `Match ${spinOutcome[0]} x2!`;
                // }
                // For example, 4 reels matching:
                // else if (config.slotReelCount === 4 && spinOutcome.length === 4 && spinOutcome[0] === spinOutcome[1] && spinOutcome[1] === spinOutcome[2] && spinOutcome[2] === spinOutcome[3]) {
                //     isWin = true; prize = `EPIC WIN! ${spinOutcome[0]} x4!`;
                // }
                // --- End Win Conditions ---

                // --- Store latest spin result for panel and future reference ---
                if ($kv) {
                    try {
                        await $kv.set(latestSpinUserKey, spinnerName);
                        await $kv.set(latestSpinOutcomeKey, spinOutcome); // outcome is the array like ['🍒', '7', '🍒']
                        await $kv.incr(totalSpinsTriggeredKey, 1); // Increment total spins triggered
                        console.log(`Stored latest spin result for panel: ${spinnerName} spun [${spinOutcome.join('|')}]. Incremented total spins.`);
                    } catch(e) {
                        console.error("KV failed to store latest spin result for panel or increment total spins:", e);
                    }
                }


                // Emit the result data SPECIFICALLY to the SLOT_OVERLAY_NAME (read from settings)
                try {
                    if ($overlay && config.slotOverlayName) { // Use config.slotOverlayName
                        $overlay.emit(config.slotOverlayName, "slotResult", { // Event name is "slotResult"
                            user: spinnerName, // Pass the username or 'Anonymous'
                            outcome: spinOutcome, // Pass the generated outcome
                            isWin: isWin,
                            prize: prize,
                            multiplier: directSpinMultiplier // Pass the multiplier determined by the tier
                        });
                        console.log(`Emitted 'slotResult' (x${directSpinMultiplier}) to overlay '${config.slotOverlayName}' for ${spinnerName}.`);
                    } else { console.warn(`Cannot emit 'slotResult': $overlay not available or config.slotOverlayName ('${config.slotOverlayName}') is not set.`); }
                } catch (e) { console.error(`Error emitting 'slotResult' to overlay '${config.slotOverlayName}':`, e); }

                // Announce the instant spin result in chat
                try {
                    if ($room && $room.sendNotice) {
                        let multiplierText = directSpinMultiplier > 1 ? ` (x${directSpinMultiplier})` : '';
                        const chatSpinnerName = isAnonymousTip ? 'An anonymous user' : `@${tippingUsername}`;
                        $room.sendNotice(`🎰 ${chatSpinnerName} spins${multiplierText}! [${spinOutcome.join(' | ')}] Result: ${prize}`);
                    }
                } catch (e) { console.error("Failed to send slot result notice:", e); }

            } // --- End of Instant Spin Logic ---


            // --- B) Spin Accumulation Logic (runs for ALL non-anon tips) ---
            // This happens even if they triggered an instant spin - they also get accumulation progress
             // Anonymous tips do *not* contribute to spin accumulation for a specific user.
             // Use config.slotBaseSpinCost from settings
            if (!isAnonymousTip && tipTokens > 0) {
                if ($kv) {
                    const progressKeyUser = `${spinProgressPrefix}${tippingUsername}`;
                    const earnedSpinsKeyUser = `${earnedSpinsPrefix}${tippingUsername}`;

                    try {
                        // Add current tip tokens to user's progress towards earning a spin
                        const currentProgress = await $kv.get(progressKeyUser, 0);
                        const newProgress = currentProgress + tipTokens;

                        // Use config.slotBaseSpinCost for calculation
                        if (newProgress >= config.slotBaseSpinCost) {
                            // User has earned one or more spins via accumulation
                            const spinsEarned = Math.floor(newProgress / config.slotBaseSpinCost);
                            const remainingProgress = newProgress % config.slotBaseSpinCost;

                            // Increment the count of spins they can use later with !spin
                            const totalEarnedSpins = await $kv.incr(earnedSpinsKeyUser, spinsEarned);

                            // Update their progress towards the *next* spin with the remainder
                            await $kv.set(progressKeyUser, remainingProgress);

                            console.log(`${tippingUsername} earned ${spinsEarned} spin(s) via accumulation. Total available for !spin: ${totalEarnedSpins}. Remaining progress: ${remainingProgress}/${config.slotBaseSpinCost}.`);

                            // Notify user they earned spins and how to use them (requires !spin command handler)
                            try {
                                 if ($room && $room.sendNotice) {
                                     $room.sendNotice(`@${tippingUsername}, you earned ${spinsEarned} spin(s)! You have ${totalEarnedSpins} total. Type !spin to use one.`);
                                 }
                            } catch (e) { console.error("Failed to send earned spin notice:", e); }

                        } else {
                            // Progress increased, but not enough for a full spin yet
                            await $kv.set(progressKeyUser, newProgress);
                            console.log(`${tippingUsername} spin accumulation progress updated: ${newProgress}/${config.slotBaseSpinCost}.`);
                        }
                    } catch (kvError) {
                        console.error(`KV Error during spin accumulation for ${tippingUsername}:`, kvError);
                    }
                } else {
                    console.warn("$kv not available, cannot process spin accumulation.");
                }
            } // --- End Spin Accumulation Logic ---

        } else { // Handle tips with 0 tokens or other edge cases if necessary
             console.log("Received tip with 0 tokens, skipping slot/accumulation logic.");
             // Could add a generic thank you here if not handled below
        }
        // --- *** END SLOT MACHINE & SPIN LOGIC *** ---


        // --- Key-Value Store Operations (Tip Goal, Top Tipper etc - Standard) ---
        // This section now primarily handles Tip Goal and Top Tipper (if needed elsewhere)
        if ($kv) {
            // --- Update Top Tipper (Optional - panel doesn't show this anymore, but good to track) ---
            if (!isAnonymousTip) {
                 const currentTopTipAmount = await $kv.get(topTipTokensKey, 0);
                 if (tipTokens > currentTopTipAmount) {
                     await $kv.set(topTipTokensKey, tipTokens);
                     await $kv.set(topTipUserKey, tippingUsername);
                     // Optional chat notice for new top tip if desired
                     // try { if ($room && $room.sendNotice) $room.sendNotice(`*** 🏆 NEW TOP TIP! ${tippingUsername} takes the lead with ${tipTokens} tokens! 🏆 ***`); } catch(e){console.error("Failed to send top tipper notice:", e);}
                     console.log(`Updated top single tip: ${tippingUsername} with ${tipTokens} tokens.`);
                 }
            }


            // --- Tip Goal Tracking ---
            const tipGoalAmount = await $kv.get(tipGoalKey, 0); // Default goal 0 means disabled
            if (tipGoalAmount > 0) { // Only track if goal is set
                let currentProgressVal = await $kv.get(progressKey, 0);
                const newProgressVal = currentProgressVal + Number(tipTokens);
                console.log(`Tip Goal Status: ${newProgressVal} / ${tipGoalAmount} tokens.`);

                if (newProgressVal >= tipGoalAmount) { // Goal Met!
                    const goalMetNotice = `🎉🎉 GOAL REACHED! 🎉🎉 The goal of ${tipGoalAmount} tokens was hit! Thanks ${tippingUsername}!`;
                    try { if ($room && $room.sendNotice) $room.sendNotice(goalMetNotice); } catch(e){console.error("Failed to send goal met notice:", e);}
                    await $kv.set(progressKey, 0); // Reset progress
                    console.log(`Tip goal met. Progress reset.`);
                    // --- Trigger Goal Met Animation on GENERAL overlay ---
                    try {
                        if ($overlay && spinnerOverlayName) { // Use the general overlay name setting
                            // Event name/payload matches the general overlay's expected format
                            $overlay.emit(spinnerOverlayName, { eventName: 'goalReachedAnimation' });
                            console.log(`Emitted 'goalReachedAnimation' to GENERAL overlay '${spinnerOverlayName}'.`);
                        } else { console.warn(`Cannot emit 'goalReachedAnimation': $overlay or spinnerOverlayName ('${spinnerOverlayName}') not available.`); }
                    } catch (error) { console.error("Error emitting 'goalReachedAnimation' event:", error); }
                    // Optional: Set next goal automatically? await $kv.set(tipGoalKey, tipGoalAmount * 2);
                } else {
                    await $kv.set(progressKey, newProgressVal); // Save updated progress
                }
            } else {
                 console.log("Tip goal tracking is disabled (goal amount <= 0).");
            }

        } else {
            console.warn("$kv object is not available. Cannot perform global KV operations (Tip Goal, Top Tipper, Slot Panel Data).");
        }


        // --- Thank You Messages & User-Specific Logic (Standard) ---
        // This section runs for all tips, regardless of slot activity or if KV is available
        // Only send if the tip didn't trigger an *instant spin* chat notice, to avoid double messages
        if (!isAnonymousTip && directSpinMultiplier === 0 && tipTokens > 0) { // Only send if not anon AND didn't get instant spin notice AND has tokens
            let thankYouMessage = `Thank you, @${tippingUsername}, for the ${tipTokens} token tip!`;
            // Add your standard thank you message customizations here based on user status/tip amount
             if (userIsOwner) { thankYouMessage = `Self-tip acknowledged: ${tipTokens} tokens. Thanks, me! 😉`; }
             else if (userIsMod) { thankYouMessage = `🙏 Mod @${tippingUsername} tipped ${tipTokens} tokens! Thanks!`; }
             else if (userInFanclub) { thankYouMessage = `💖 Fan @${tippingUsername} tipped ${tipTokens} tokens! Thank you!`;}
             else if (tipTokens >= 500) { thankYouMessage = `🔥 Generous ${tipTokens}t tip from @${tippingUsername}! Wow!`; }
             else if (tipTokens >= 100) { thankYouMessage = `✨ Nice ${tipTokens}t tip from @${tippingUsername}! Thanks!`; }
            // ... etc ...
            if (tipMessage) { thankYouMessage += ` (Msg: "${tipMessage}")`; } // Append message if present

            try { if ($room && $room.sendNotice) $room.sendNotice(thankYouMessage); }
            catch (e) { console.warn("$room.sendNotice not available for thank you."); }
        }
         // Anonymous tips that triggered a tier already got a notice above. Anonymous tips without a tier also got a basic notice above.

        // --- React to Specific Tip Amounts/Messages (Targeting GENERAL Overlay) ---
        try {
            if ($overlay && spinnerOverlayName) { // Check if general overlay exists and name is valid
                 // Only send general overlay events if the tip didn't trigger a *slot* overlay event
                 if (directSpinMultiplier === 0) { // If it triggered an instant spin, the slot overlay event is probably sufficient
                    if (!isAnonymousTip && tipTokens > 0) { // Ensure non-anon and has tokens
                        if (tipTokens >= 500 || userRecentTipsStatus === 'tons') {
                           // Emit animation for very large tips or top tippers to the GENERAL overlay
                           $overlay.emit(spinnerOverlayName, { eventName: 'superTipAnimation', payload: { amount: tipTokens, user: tippingUsername } });
                           console.log(`Emitted 'superTipAnimation' to GENERAL overlay '${spinnerOverlayName}'.`);
                        } else if (tipTokens >= 100 && userInFanclub) {
                           // Emit animation for fanclub tips to the GENERAL overlay
                           $overlay.emit(spinnerOverlayName, { eventName: 'fanClubTipAnimation', payload: { amount: tipTokens, user: tippingUsername } });
                           console.log(`Emitted 'fanClubTipAnimation' to GENERAL overlay '${spinnerOverlayName}'.`);
                        }
                    }
                 } else {
                    console.log("Tip triggered instant slot spin, skipping general overlay specific reaction.");
                 }
            }
         } catch (error) { console.error("Error emitting reaction event to GENERAL overlay:", error); }
         // Note: Tip message check ('question') doesn't need an overlay event, handled by notice earlier


        // --- Emit Generic 'newTipReceived' Event to GENERAL Overlay ---
        // This sends detailed tip info that the general overlay might use (e.g., display latest tip total)
        // This is separate from the slot result event and should probably always fire if the general overlay exists and tip has tokens
        if (tipTokens > 0) {
            try {
                let goalStatusPayload = null;
                if ($kv) {
                    try {
                       const currentGoal = await $kv.get(tipGoalKey, 0);
                       if (currentGoal > 0) {
                           goalStatusPayload = { progress: await $kv.get(progressKey, 0), goal: currentGoal };
                       }
                    } catch(e) { console.error("Error getting goal status for generic newTipReceived event:", e); }
                }

                if ($overlay && spinnerOverlayName) {
                    $overlay.emit(spinnerOverlayName, { // Use object format for event data
                      eventName: 'newTipReceived',
                      payload: {
                        tipAmount: tipTokens,
                        tipper: tippingUsername,
                        message: tipMessage,
                        isAnon: isAnonymousTip,
                        // Include minimal user details needed by the general overlay
                        userDetails: isAnonymousTip ? null : {
                            colorGroup: userColorGroup,
                            inFanclub: userInFanclub,
                            isMod: userIsMod,
                            isOwner: userIsOwner,
                            recentTipsStatus: userRecentTipsStatus
                        },
                        goalStatus: goalStatusPayload // Include current goal progress
                      }
                    });
                    console.log(`Emitted generic 'newTipReceived' event to GENERAL overlay '${spinnerOverlayName}'.`);
                } else {
                    console.warn(`Cannot emit generic 'newTipReceived': $overlay or spinnerOverlayName ('${spinnerOverlayName}') not available.`);
                }
            } catch (error) {
                console.error("Error emitting generic 'newTipReceived' event:", error);
            }
        }


    } catch (error) {
        // --- Comprehensive Error Handling ---
        console.error("### FATAL ERROR in 'Tip Received' event handler ###");
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        // Log context (optional but very helpful)
        console.error("Payload Context:", {
            tipTokens: typeof $tip !== 'undefined' && $tip ? $tip.tokens : 'N/A',
            isAnon: typeof $tip !== 'undefined' && $tip ? $tip.isAnon : 'N/A',
            user: typeof $user !== 'undefined' && $user ? $user.username : 'N/A'
            // Add any other relevant variables you want to log here
        });
        try {
            if ($room && $room.owner && $room.sendNotice) {
                 $room.sendNotice(`🚨 App Error in Tip Handler! @${$room.owner} check logs. Error: ${error.message}`, { toUsername: $room.owner, color: '#FF0000' });
             }
        } catch (noticeError) { console.error("Failed trying to send error notice:", noticeError); }
    } finally {
        console.log("--- 'Tip Received' Event Handler Finished ---");
    }
})(); // Immediately invoke the async function















console.log("--- 'Tip Received' Event Handler Executed ---");

// Use an async IIFE for modern syntax and error handling
(async () => {
    try {
        // --- 1. Get Configuration ---
        // Use the shared function to get the current slot machine configuration from $settings
        const config = getSlotConfig($settings);
        
        console.log(`Tip Received: User '${$user.username}' tipped ${$tip.tokens} tokens. Spin threshold is ${config.tipThreshold}.`);

        // --- 2. Check if Tip Meets Threshold ---
        // Only proceed if the tip amount is greater than or equal to the configured threshold
        if ($tip.tokens >= config.tipThreshold) {
            console.log("Tip meets threshold. Generating slot machine outcome...");

            // --- 3. Generate the Spin Result ---
            // Use the shared function to get a random outcome, win status, and prize
            const result = generateSlotOutcome(config);
            console.log("Generated outcome:", result);

            // --- 4. Handle the Outcome ---
            // Use the shared handler to emit the result to the overlay and send a chat message on win
            handleSlotOutcome(result, $user.username, config.overlayName, $room.chat);
            
        } else {
            console.log("Tip amount is below the threshold. No spin triggered.");
        }

    } catch (error) {
        console.error("### FATAL ERROR in 'Tip Received' event handler ###");
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        // Attempt to send an error notice to the broadcaster for debugging
        try {
             if ($room && $room.owner && $room.sendNotice) {
                  $room.sendNotice(`🚨 App Error in Tip Handler! @${$room.owner} check logs. Error: ${error.message}`, { toUsername: $room.owner, color: '#FF0000' });
              }
        } catch (noticeError) { console.error("Failed to send error notice:", noticeError); }
    } finally {
        console.log("--- 'Tip Received' Event Handler Finished ---");
    }
})();
