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
