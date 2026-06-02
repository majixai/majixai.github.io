// This code should be placed in the "Tip Dialog Open" event handler slot.
// It runs when a user opens the tipping dialog.
// Payload variables available here include: $app, $callback, $kv, $limitcam, $room, $user

console.log("--- 'Tip Dialog Open' Event Handler Executed ---");
console.log("User '" + $user.username + "' opened the tip dialog.");


// Define the custom tip options to display in the dialog.
// Example: Setting up options for users to vote with their tips.
const options = [
  'Option A: Vote 1',
  'Option B: Vote 2',
  'Option C: Vote 3',
].map(option => ({ // Map each string to an object with a 'label' property
  label: option
}));

// Create the main tip options configuration object.
const tipOptions = {
  label: 'Choose your vote:', // The main label above the options
  options: options, // The array of individual option objects
};

// Call $room.setTipOptions to update the tip dialog with the custom options.
// This requires the "Tip options" app permission.
$room.setTipOptions(tipOptions);

console.log("--- Tip options set for the dialog ---");

// Add any other logic you need when the tip dialog is opened,
// using only the available payload variables ($app, $callback, $kv, $limitcam, $room, $user).
