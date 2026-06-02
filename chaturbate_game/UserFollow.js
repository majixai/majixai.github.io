// User Follow Event Handler

// Key for storing the total follower count for the current broadcast
const followerCountKey = 'broadcastFollowerCount';
// Key for storing a set of users who have followed this broadcast
const followedUsersKey = 'followedUsersThisBroadcast';

// Personalized thank you message
const thankYouMessage = `Thank you so much for the follow, ${$user.username}! We really appreciate your support and are happy to have you in the community! Feel free to say hello in chat.`;

// eslint-disable-next-line no-undef
$room.sendNotice(thankYouMessage, { toUsername: $user.username });

// eslint-disable-next-line no-undef
$room.sendNotice(`${$user.username} just clicked the follow button! Welcome!`);

// eslint-disable-next-line no-undef
$kv.incr(followerCountKey, 1);
// eslint-disable-next-line no-undef
const currentFollowerCount = $kv.get(followerCountKey);

// eslint-disable-next-line no-undef
let followedUsers = $kv.get(followedUsersKey, []);
// eslint-disable-next-line no-undef
if (!followedUsers.includes($user.username)) {
 // eslint-disable-next-line no-undef
 followedUsers.push($user.username);
 // eslint-disable-next-line no-undef
 $kv.set(followedUsersKey, followedUsers);
}
const uniqueFollowerCount = followedUsers.length;

// Notify the broadcaster periodically about the follower count
const notificationInterval = 30; // Number of new followers before notifying broadcaster
const lastNotificationCountKey = 'lastFollowerNotificationCount';
// eslint-disable-next-line no-undef
const lastNotificationCount = $kv.get(lastNotificationCountKey, 0);

if (currentFollowerCount - lastNotificationCount >= notificationInterval) {
 // eslint-disable-next-line no-undef
 $room.sendNotice(
  `--- BROADCASTER UPDATE ---\n` +
  `New Followers This Broadcast: ${currentFollowerCount}\n` +
  `Unique Followers This Broadcast: ${uniqueFollowerCount}\n` +
  `Keep up the great work!`, {
   // eslint-disable-next-line no-undef
   toUsername: $room.owner
  }
 );
 // eslint-disable-next-line no-undef
 $kv.set(lastNotificationCountKey, currentFollowerCount);
}

// Emit a "newFollower" event to Broadcast Overlays with detailed information
// eslint-disable-next-line no-undef
$overlay.emit("newFollower", {
 // eslint-disable-next-line no-undef
 username: $user.username,
 // eslint-disable-next-line no-undef
 colorGroup: $user.colorGroup,
 // eslint-disable-next-line no-undef
 isFollower: $user.isFollower, // Should be true here, but good to include
 followerCountThisBroadcast: currentFollowerCount,
 uniqueFollowerCountThisBroadcast: uniqueFollowerCount
});

// Check if this is a first-time follow (we can't reliably know for *sure* without external storage,
// but we can check if they've followed during this broadcast session)
if (followedUsers.length === 1) {
 // eslint-disable-next-line no-undef
 console.log(`First follower of this broadcast: ${$user.username}`);
 // You could potentially trigger other actions for the first follower here
} else {
 // eslint-disable-next-line no-undef
 console.log(`Another follow from: ${$user.username}`);
}

// eslint-disable-next-line no-undef
console.log(`User ${$user.username} followed the room.`);
