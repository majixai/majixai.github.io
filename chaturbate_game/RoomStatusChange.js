// --- Room Status Changed Event Handler ---

// This code runs automatically whenever the room's broadcast status changes
// (e.g., Public -> Private, Private -> Offline, Offline -> Public, etc.)

// --- Available Payload Variables (Likely, confirm with docs) ---
// $app:      Information about the app instance.
// $room:     Information about the room, INCLUDING the new status.
// $kv:       Access to the Key-Value store.
// $limitcam: Information about stream limits.
// --- Key Variable for this Event ---
// $room.status: Contains the NEW room status (e.g., 'public', 'private', 'offline', 'group', 'ticket').
//               NOTE: The exact status names ('public', 'private', etc.)
//               might differ slightly on the platform. Check the documentation.

// --- Script Logic ---

// 1. Get the new room status
const newStatus = $room.status; // Assuming the status is in $room.status

// 2. Store the new status in the Key-Value store for reference elsewhere
$kv.set('currentRoomStatus', newStatus);

// 3. Announce the change and potentially take different actions based on the status
let noticeMessage = '';

switch (newStatus) {
  case 'public':
    noticeMessage = '🟢 Room status changed to PUBLIC! Everyone is welcome!';
    // Optional: Reset certain app features relevant only to private/group shows?
    break;
  case 'private':
    noticeMessage = '🔒 Room status changed to PRIVATE! Enjoy the exclusive show!';
    // Optional: Announce private show rates or rules?
    break;
  case 'group':
    noticeMessage = '👥 Room status changed to GROUP SHOW! Get your ticket to join!';
    // Optional: Announce ticket price or group show goal?
    break;
  case 'ticket': // Many platforms treat Ticket and Group shows similarly or identically
    noticeMessage = '🎟️ Room status changed to TICKET SHOW! Purchase a ticket to watch!';
    // Optional: Announce ticket price?
    break;
  case 'offline':
    noticeMessage = '🌙 Room is now OFFLINE. Thanks for hanging out!';
    // Optional: Maybe clear some temporary data from $kv?
    break;
  default:
    // Fallback for any unexpected status or if $room.status isn't populated
    noticeMessage = `Room status changed to: ${newStatus || 'Unknown'}`;
    break;
}

// Send the tailored notice to the chat
if (noticeMessage) {
  $room.sendNotice(noticeMessage);
}

// 4. OPTIONAL: Log the change for debugging
// console.log(`Room status changed to ${newStatus} at ${new Date().toLocaleTimeString()}`);
