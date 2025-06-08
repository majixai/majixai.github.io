// --- Callback Event Handler ---

// Configuration: Set the delay between announcements in seconds
// IMPORTANT: This MUST match the delay used in the App Start handler
// or the timing will be inconsistent.
const announcementDelay = 300; // 900 seconds = 15 minutes. ADJUST AS NEEDED.

// --- Logic ---

// Check if this callback is the one we scheduled for announcements
if ($callback.label === 'announceFeature') {

  // Retrieve the list of announcements and the current index from $kv
  const announcements = $kv.get('featureAnnouncements');
  let currentIndex = $kv.get('announcementIndex');

  // Basic check to ensure things were initialized correctly
  if (announcements && announcements.length > 0 && typeof currentIndex === 'number') {

    // Make sure the index is valid (in case the list size changed)
    currentIndex = currentIndex % announcements.length;

    // Send the current announcement to the room
    $room.sendNotice(announcements[currentIndex]);

    // Calculate the index for the *next* announcement
    const nextIndex = (currentIndex + 1) % announcements.length;

    // Store the next index back into $kv
    $kv.set('announcementIndex', nextIndex);

  } else {
    // Optional: Log an error if something is wrong (e.g., announcements list is empty/missing)
    // $room.sendNotice('Error: Could not retrieve announcement data.');
    // You might want to handle this more gracefully depending on your needs.
    console.warn("Callback 'announceFeature': Could not retrieve announcement data from $kv or data is invalid.");
  }

  // Schedule the *next* announcement callback, continuing the cycle
  if ($callback && typeof $callback.create === 'function') {
    $callback.create('announceFeature', announcementDelay);
  } else {
    console.error("Callback 'announceFeature': $callback.create is not available. Cannot reschedule announcement.");
  }
}

// Add other 'if' blocks here if you use callbacks for different features
// e.g., if ($callback.label === 'anotherFeature') { ... }
