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
