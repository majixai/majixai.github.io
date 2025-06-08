// --- Code running ONCE on App Installation ---
// This section initializes the app's state and settings.
// It PREPARES the app for future user interactions that will
// be handled by other event handlers (like chat, tip handlers).

// --- Initialize Persistent Storage ($kv) related to Interactions ---

// Initialize variables that will track tipping activity
$kv.set('top_tipper_name', '');     // Will be updated by the 'onTip' handler
$kv.set('top_tip_amount', 0);       // Will be updated by the 'onTip' handler
$kv.set('recent_tips_list', []);   // Initialize a list for recent tips (e.g., last 5)

// Initialize variables related to chat commands or moderation
$kv.set('command_prefix', '!');    // Set a default prefix for chat commands (e.g., !status)
$kv.set('allow_viewer_commands', true); // Default setting for viewer commands
$kv.set('moderator_usernames', []); // Initialize a list of moderator usernames

// Initialize settings that might affect overlay or component interactions
$kv.set('show_tip_alert_overlay', true); // Default setting for showing tip alerts
$kv.set('overlay_message_color', '#00539B'); // Default color for overlay text

// Store data that might be displayed to users later
$kv.set('app_status_message', 'App is initializing...'); // Default status message

// --- Example in App Start ---
$kv.set('naughty_word_patterns', ['\\b(boobs|cock|dick|suck|fuck|lick|snatch|vagina|teen|freak|darn|shoot)\\b', '\\b(idiot|moron|stupid|slut|bitch|asshole)\\b']);
$kv.set('vip_users', ['broadcaster_username', 'trusted_viewer_username']);
$kv.set('repetition_threshold_ms', '3000'); // 3 seconds
$kv.set('max_repetition_count', '2');

// --- Send a Welcome Message to the Broadcaster ---
// This is a one-time interaction initiated by the app itself.
try {
    const broadcasterName = $room && $room.broadcaster_name ? $room.broadcaster_name : 'broadcaster';
    if ($callback && typeof $callback.chat === 'function') {
        $callback.chat('Hello ' + broadcasterName + '! App installed. Use the chat prefix \"' + $kv.get('command_prefix') + '\" for commands.');
    } else if ($callback && typeof $callback.sendMessage === 'function') {
         $callback.sendMessage('chat', 'Hello ' + broadcasterName + '! App installed.');
    } else {
         console.log('App Start: Could not send welcome chat message.');
    }
} catch (error) {
    console.error("App Start: Error sending welcome message:", error);
}

// --- Other Setup ---
// Any other initial logic not directly tied to $kv or chat, but needed for setup.
// For example, setting up initial flags or complex data structures.

// --- Recap ---
// This code sets up the initial 'state' or configuration.
// The actual 'user interaction' (reading chat, processing tips, handling clicks)
// will be implemented in other Event Handlers and client-side scripts
// (Overlays, Web Components) which will *read* and *update* the $kv variables
// initialized here.

// --- App Start ---

// ... other initializations ...

// Initialize default spin wheel configuration if not already set
// NOTE: getDefaultSpinWheelConfig() needs to be defined or imported if this code is run directly.
// Assuming it's available in the execution context (e.g. from a shared script).
if (typeof getDefaultSpinWheelConfig === 'function') {
    if (!$kv.get('spin_wheel_config')) {
        $kv.set('spin_wheel_config', JSON.stringify(getDefaultSpinWheelConfig()));
    }
} else {
    console.warn("App Installation: getDefaultSpinWheelConfig is not defined. Spin wheel config might not be initialized.");
}


// --- Example in App Start or a dedicated event handler for overlay messages ---
// NOTE: getSpinWheelConfig() and handleSpinOutcome() also need to be defined or imported.
if (typeof getSpinWheelConfig === 'function' && typeof handleSpinOutcome === 'function') {
    if ($callback && typeof $callback.onOverlayMessage === 'function') {
        $callback.onOverlayMessage((message) => {
            if (message.type === 'request' && message.action === 'get_spin_config') {
                const config = getSpinWheelConfig($kv);
                $callback.sendOverlayMessage('update_config', { config: config });
            }
            if (message.type === 'response' && message.action === 'spin_completed') {
                const { username, result } = message.payload;
                handleSpinOutcome(result, username, $callback, $kv);
                // Optionally reset has_spun here if needed
                $kv.delete(`has_spun_${username}`);
            }
        });
    }
} else {
    console.warn("App Installation: Spin wheel overlay message handling functions (getSpinWheelConfig or handleSpinOutcome) are not defined.");
}


// --- App Start Event Handler ---

// Configuration: Set the delay between announcements in seconds
const announcementDelay = 900; // 900 seconds = 15 minutes. ADJUST AS NEEDED.

// Configuration: Define your list of announcements
const announcements = [
  "✨ Welcome! Check out my Tip Menu for fun reactions and shows! Use /tipmenu command or click the panel! ✨",
  "Want exclusive content or behind-the-scenes? Follow me on [Your Fansly/Patreon Link]!",
  "Let's hit our goal! Check the progress bar - every tip helps unlock something special! ❤️",
  "Curious about Private Shows? DM me or check my bio for rates and info! 😉",
  "Don't forget to follow the room rules! Keep it positive and respectful. 🙏",
  // Add more announcements here!
];

// --- Initialization ---

// Store the list of announcements in the Key-Value store ($kv)
// This makes it accessible in the Callback handler without redefining it.
$kv.set('featureAnnouncements', announcements);

// Initialize the index for which announcement to show next.
// We store this in $kv to remember state between callbacks.
if ($kv.get('announcementIndex') === null) {
  $kv.set('announcementIndex', 0);
}

// Schedule the *first* announcement callback
if ($callback && typeof $callback.create === 'function') {
    $callback.create('announceFeature', announcementDelay);
} else {
    console.warn("App Installation: $callback.create is not available. Cannot schedule announcements.");
}


// Optional: Send a notice that the announcement app has started
if ($room && typeof $room.sendNotice === 'function') {
    $room.sendNotice('Announcement App Activated! Reminders about the Tip Menu & features will appear periodically.');
} else {
    console.warn("App Installation: $room.sendNotice is not available. Cannot send activation notice.");
}
