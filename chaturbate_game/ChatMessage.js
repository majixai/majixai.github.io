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

// --- New Command Handlers (Spinwheel Configuration) ---

async function handleSpinWheelConfig(args, user) {
    if (!$room.owner === user.username && !user.isMod) {
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
        await sendMessage(`Usage: ${COMMAND_PREFIXES.join('/')}spinwheel_config [JSON configuration]`, { toUsername: user.username });
        await sendMessage(`Example config: ${JSON.stringify(getDefaultSpinWheelConfig())}`, { toUsername: user.username });
    }
}
registerCommand('spinwheel_config', handleSpinWheelConfig, 'Set the spin wheel configuration (owner/mod only - JSON format).');

async function handleSpinWheelThreshold(args, user) {
    if (!$room.owner === user.username && !user.isMod) {
        await sendMessage('You do not have permission to use this command.', { toUsername: user.username });
        return;
    }
    if (args.length === 1 && !isNaN(args [0])) {
        const newThreshold = parseInt(args [0]);
        const currentConfig = getSpinWheelConfig(// eslint-disable-next-line no-undef
        $kv);
        currentConfig.spinThreshold = newThreshold;
        // eslint-disable-next-line no-undef
        $kv.set('spin_wheel_config', JSON.stringify(currentConfig));
        await sendMessage(`Spin wheel tip threshold set to ${newThreshold} tokens.`, { toUsername: user.username });
        logMessage('info', `${user.username} set spin wheel threshold to ${newThreshold}.`);
    } else {
        await sendMessage(`Usage: ${COMMAND_PREFIXES.join('/')}spinwheel_threshold [amount]`, { toUsername: user.username });
    }
}
registerCommand('spinwheel_threshold', handleSpinWheelThreshold, 'Set the tip threshold for the spin wheel (owner/mod only - number).');

// --- Main Event Handler Logic ---

// eslint-disable-next-line no-unused-vars
async function handleChatMessage(messagePayload) {
 // eslint-disable-next-line no-undef
 const { body: messageBody } = $message;
 // eslint-disable-next-line no-undef
 const user = $user;
 // eslint-disable-next-line no-undef
 const msgtime = new Date();

 // Log all chat messages (can be disabled)
 logMessage('debug', `${user.username}: ${messageBody}`);

 if (COMMAND_PREFIXES.some(prefix => messageBody.startsWith(prefix))) {
  const { commandName, args } = parseArguments(messageBody);
  const handlerInfo = COMMAND_HANDLERS [commandName];

  if (handlerInfo) {
   try {
    // Log command execution
    logMessage('info', `${user.username} executed ${commandName} with args: ${args.join(' ')}`);
    await handlerInfo.handler(args, user);
   } catch (error) {
    logMessage('error', `Error executing ${commandName}: ${error.message}`);
    await sendMessage(`An error occurred while processing that command. Please notify the broadcaster.`, { toUsername: user.username });
   }
  } else {
   await sendMessage(`Unknown command: ${commandName}. Use /help for a list of commands.`, { toUsername: user.username });
  }
  // eslint-disable-next-line no-undef
  pushchatcmd(user.username, messageBody, msgtime); // Still log the command
 } else {
  // eslint-disable-next-line no-undef
  pushchatmsg(user.username, messageBody, msgtime);
  // eslint-disable-next-line no-undef
  pushevent("MSG");
 }
}

// --- Entry Point for the Event Handler ---
handleChatMessage();
