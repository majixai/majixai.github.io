// --- onChatMessage (Combined) ---

const COMMAND_PREFIXES = ['/', '!'];
const COMMAND_HANDLERS = {}; // Object to store command handlers

// --- Helper Functions (Ensure these are also in your Shared Code or defined here) ---

async function sendMessage(message, options = {}) {
 // eslint-disable-next-line no-undef
 await $room.sendNotice(message, options);
}

function logMessage(level, message) {
 // Simple logging (can be enhanced)
 console.log(`TMThelp - ${level.toUpperCase()}: ${message}`);
}

function parseArguments(commandBody) {
 const parts = commandBody.split(' ');
 const commandName = parts.shift().toLowerCase();
 const args = parts;
 return { commandName, args };
}

// --- Command Handler Registration ---

function registerCommand(name, handler, description = '') {
 COMMAND_HANDLERS[`/${name.toLowerCase()}`] = { handler, description };
 COMMAND_HANDLERS[`!${name.toLowerCase()}`] = { handler, description }; // Allow '!' prefix as well
}

// --- Command Handlers (Original Commands) ---

async function handleReadMenu(args, user) {
 // eslint-disable-next-line no-undef
 await readmenu(args.join(' '), user.username);
 logMessage('info', `${user.username} executed /readmenu`);
}
registerCommand('readmenu', handleReadMenu, 'Read a menu.');

// ... (rest of your original command handlers: handleShowMenu, handleClearMenu, handleClearTasks, handleShowMsg, handleShowCmd, handleShowTip, handleShowTask, handleStopTask, handleStartTask, handleTasks, handleShowBoth, handleTMThelp, handleHelp) ...
// NOTE: The actual definitions for readmenu, pushchatcmd, pushchatmsg, pushevent,
// getDefaultSpinWheelConfig, getSpinWheelConfig are assumed to be available in the
// global scope or via a "Shared Code" mechanism in the Chaturbate app environment.

// --- New Command Handlers (Spinwheel Configuration) ---

async function handleSpinWheelConfig(args, user) {
    // eslint-disable-next-line no-undef
    if ($room.owner !== user.username && !user.is_mod) { // Corrected: $room.owner, user.is_mod
        await sendMessage('You do not have permission to use this command.', { toUsername: user.username });
        return;
    }
    if (args.length > 0) {
        const configString = args.join(' ');
        try {
            JSON.parse(configString); // Basic validation
            // eslint-disable-next-line no-undef
            $kv.set('spin_wheel_config', configString);
            await sendMessage('Spin wheel configuration updated successfully!', { toUsername: user.username });
            logMessage('info', `${user.username} updated spin wheel config.`);
        } catch (e) {
            await sendMessage('Error parsing spin wheel configuration. Please use valid JSON.', { toUsername: user.username });
            console.error("Error parsing spin wheel config from chat:", e);
        }
    } else {
        // Assuming getDefaultSpinWheelConfig is available
        const exampleConfig = typeof getDefaultSpinWheelConfig === 'function' ? JSON.stringify(getDefaultSpinWheelConfig()) : '{"segments": [...], "spinThreshold": 100}';
        await sendMessage(`Usage: ${COMMAND_PREFIXES[0]}spinwheel_config [JSON configuration]`, { toUsername: user.username });
        await sendMessage(`Example config: ${exampleConfig}`, { toUsername: user.username });
    }
}
registerCommand('spinwheel_config', handleSpinWheelConfig, 'Set the spin wheel configuration (owner/mod only - JSON format).');

async function handleSpinWheelThreshold(args, user) {
    // eslint-disable-next-line no-undef
    if ($room.owner !== user.username && !user.is_mod) { // Corrected: $room.owner, user.is_mod
        await sendMessage('You do not have permission to use this command.', { toUsername: user.username });
        return;
    }
    if (args.length === 1 && !isNaN(args[0])) {
        const newThreshold = parseInt(args[0]);
        // Assuming getSpinWheelConfig is available
        // eslint-disable-next-line no-undef
        const currentConfig = typeof getSpinWheelConfig === 'function' ? getSpinWheelConfig($kv) : { spinThreshold: 100, segments: [] };
        currentConfig.spinThreshold = newThreshold;
        // eslint-disable-next-line no-undef
        $kv.set('spin_wheel_config', JSON.stringify(currentConfig));
        await sendMessage(`Spin wheel tip threshold set to ${newThreshold} tokens.`, { toUsername: user.username });
        logMessage('info', `${user.username} set spin wheel threshold to ${newThreshold}.`);
    } else {
        await sendMessage(`Usage: ${COMMAND_PREFIXES[0]}spinwheel_threshold [amount]`, { toUsername: user.username });
    }
}
registerCommand('spinwheel_threshold', handleSpinWheelThreshold, 'Set the tip threshold for the spin wheel (owner/mod only - number).');

// --- Main Event Handler Logic ---

// eslint-disable-next-line no-unused-vars
async function handleChatMessage(messagePayload) {
 // eslint-disable-next-line no-undef
 const { body: messageBody } = $message; // Assuming $message is the payload
 // eslint-disable-next-line no-undef
 const user = $user; // Assuming $user is available in the payload
 // eslint-disable-next-line no-undef
 const msgtime = new Date(); // Standard Date object

 // Log all chat messages (can be disabled)
 logMessage('debug', `${user.username}: ${messageBody}`);

 // Check if message starts with any of the defined command prefixes
 const matchedPrefix = COMMAND_PREFIXES.find(prefix => messageBody.startsWith(prefix));

 if (matchedPrefix) {
  const commandBodyWithPrefix = messageBody.substring(matchedPrefix.length); // Remove prefix
  const { commandName, args } = parseArguments(commandBodyWithPrefix); // commandName will be without prefix here
  const fullCommandName = matchedPrefix + commandName; // Re-add prefix for lookup
  const handlerInfo = COMMAND_HANDLERS[fullCommandName.toLowerCase()]; // Ensure lookup is case-insensitive

  if (handlerInfo) {
   try {
    // Log command execution
    logMessage('info', `${user.username} executed ${fullCommandName} with args: ${args.join(' ')}`);
    await handlerInfo.handler(args, user);
   } catch (error) {
    logMessage('error', `Error executing ${fullCommandName}: ${error.message}`);
    await sendMessage(`An error occurred while processing that command. Please notify the broadcaster. Error: ${error.message}`, { toUsername: user.username });
   }
  } else {
   await sendMessage(`Unknown command: ${fullCommandName}. Use ${COMMAND_PREFIXES[0]}help for a list of commands.`, { toUsername: user.username });
  }
  // Assuming pushchatcmd is available
  // eslint-disable-next-line no-undef
  if (typeof pushchatcmd === 'function') pushchatcmd(user.username, messageBody, msgtime);
 } else {
  // Assuming pushchatmsg and pushevent are available
  // eslint-disable-next-line no-undef
  if (typeof pushchatmsg === 'function') pushchatmsg(user.username, messageBody, msgtime);
  // eslint-disable-next-line no-undef
  if (typeof pushevent === 'function') pushevent("MSG");
 }
}

// --- Entry Point for the Event Handler ---
// The Chaturbate environment will call handleChatMessage with the $message and $user payload.
// For local testing, you might mock these.
// handleChatMessage(); // Removed direct call, CB platform invokes it.
