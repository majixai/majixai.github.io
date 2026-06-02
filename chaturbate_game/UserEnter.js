// This code should be placed in the "User Enter" event handler slot
// in the Chaturbate Developer Portal (v0.73.0).
// The platform will automatically execute this code whenever a user enters the room.
// Payload variables available here include: $app, $callback, $kv, $limitcam, $room, $user

console.log("--- 'User Enter' Event Handler Executed ---");

// --- Accessing Real Data from Payload Variables ---

try {
  // Accessing detailed user information for the entering user
  const enteringUser = $user;

  // Accessing various $user attributes safely
  const username = enteringUser ? enteringUser.username : 'Unknown User';
  const userColorGroup = enteringUser ? enteringUser.colorGroup : 'N/A';
  const userGender = enteringUser ? enteringUser.gender : 'N/A';
  const userSubgender = enteringUser ? enteringUser.subgender : 'N/A';
  const userHasDarkmode = enteringUser ? enteringUser.hasDarkmode : false;
  const userHasTokens = enteringUser ? enteringUser.hasTokens : false;
  const userInFanclub = enteringUser ? enteringUser.inFanclub : false;
  const userFcAutoRenew = enteringUser ? enteringUser.fcAutoRenew : false;
  const userInPrivateShow = enteringUser ? enteringUser.inPrivateShow : false;
  const userIsFollower = enteringUser ? enteringUser.isFollower : false;
  const userIsMod = enteringUser ? enteringUser.isMod : false;
  const userIsOwner = enteringUser ? enteringUser.isOwner : false;
  const userIsSilenced = enteringUser ? enteringUser.isSilenced : false;
  const userIsSpying = enteringUser ? enteringUser.isSpying : false;
  const userLanguage = enteringUser ? enteringUser.language : 'unknown';
  const userRecentTipsStatus = enteringUser ? enteringUser.recentTips : 'none';


  console.log(`User Entered: ${username}`);
  console.log(`  Details: Color Group: ${userColorGroup}, Gender: ${userGender}${userGender === 't' && userSubgender !== 'N/A' ? ` (${userSubgender})` : ''}, Fanclub: ${userInFanclub}, Follower: ${userIsFollower}, Mod: ${userIsMod}, Recent Tips: ${userRecentTipsStatus}`);


  // Accessing room information safely
  const broadcasterUsername = $room ? $room.owner : 'Unknown Broadcaster';
  const roomFollowerCount = $room ? $room.followerCount : 'N/A';

  console.log(`Room Info - Broadcaster: ${broadcasterUsername}, Follower Count: ${roomFollowerCount}`);

  // Accessing app information safely (if needed in this handler)
  const appName = $app ? $app.name : 'Unknown App';
  const appVersion = $app ? $app.version : 'Unknown Version';
   console.log(`App Info - Name: ${appName}, Version: ${appVersion}`);


  // --- Adding More Interactivity and Customized Welcome Messages ---
  // Use the variables accessed above to customize the message.

  let welcomeMessage = `Welcome, ${username}!`;

  if (userIsOwner) {
    welcomeMessage = `Welcome back, Broadcaster ${username}! Room has ${roomFollowerCount} followers.`;
    // Optional: Trigger a special overlay animation for the broadcaster entering
    // try {
    //     if ($overlay) {
    //         $overlay.emit('YourOverlayName', { eventName: 'broadcasterEnter' });
    //         console.log("Emitted 'broadcasterEnter' to overlay.");
    //     }
    // } catch (error) {
    //      console.error("Error emitting 'broadcasterEnter' event:", error);
    // }
  } else if (userIsMod) {
    welcomeMessage = `:modonduty_cb Moderator ${username} is on duty!`;
    // Optional: Use a specific color group for the notice if $room and sendNotice are available
    // try {
    //     if ($room && $room.sendNotice) {
    //         $room.sendNotice(welcomeMessage, { toColorGroup: 'red' });
    //         console.log("Sent mod welcome notice with color group.");
    //     }
    // } catch (error) {
    //     console.error("Error sending mod welcome notice with color group:", error);
    // }
  } else if (userInFanclub) {
    welcomeMessage = `Welcome back, Fan Club member ${username}!`;
     if (userFcAutoRenew) {
         welcomeMessage += " Thanks for your continued support!";
     }
  } else if (userIsFollower) {
    welcomeMessage = `Welcome, follower ${username}! Glad to see you again.`;
  } else if (userRecentTipsStatus === 'tons') {
      welcomeMessage = `Welcome, top tipper ${username}! Your support is amazing!`;
  } else if (userHasTokens) {
      welcomeMessage = `Welcome, ${username}! Tokens ready to go!`;
  } else {
      welcomeMessage += " New here? Feel free to say hi!";
  }

  // Send the customized welcome message to the entering user (as a private notice)
  // Ensure $room and sendNotice are available before sending
  try {
      if ($room && $room.sendNotice) {
          $room.sendNotice(welcomeMessage, { toUsername: username });
          console.log(`Sent private welcome notice to ${username}.`);
      } else {
          console.warn("$room object or sendNotice method not available to send private notice.");
      }
  } catch (error) {
       console.error("Error sending private welcome notice:", error);
  }


  // Example: Send a public notice for certain user types
  // Ensure $room and sendNotice are available before sending
  try {
      if ($room && $room.sendNotice) {
          if (userIsMod || userRecentTipsStatus === 'tons' || userIsOwner) { // Also announce owner entering
               $room.sendNotice(`Hi, ${username} Check us out at https\:\/\/majixai.github.io\/best\/ view mutiple users at once.`); // Public announcement
               console.log(`Sent public entry announcement for ${username}.`);
          }
      } else {
          console.warn("$room object or sendNotice method not available to send public notice.");
      }
  } catch (error) {
       console.error("Error sending public entry announcement:", error);
  }


  // Example: Log user details based on specific attributes
  if (userHasDarkmode) {
      console.log(`${username} is using dark mode.`);
  }
  if (userGender === 't') {
      console.log(`${username} identifies as trans (${userSubgender}).`);
  }
   if (userLanguage !== 'en' && userLanguage !== 'unknown') {
      console.log(`${username}'s preferred language is ${userLanguage}.`);
      // You could potentially welcome them in their language if you have translations
   }

  // Example: Interact with $kv based on user entry (e.g., track unique visitors)
  // try {
  //     if ($kv) {
  //         const uniqueVisitors = $kv.get('uniqueVisitors', {});
  //         if (!uniqueVisitors[username]) {
  //             uniqueVisitors[username] = Date.now(); // Store entry timestamp
  //             $kv.set('uniqueVisitors', uniqueVisitors);
  //             console.log(`Tracked ${username} as a new unique visitor.`);
  //         } else {
  //             console.log(`${username} has visited before.`);
  //         }
  //     } else {
  //          console.warn("$kv object is not available for tracking unique visitors.");
  //     }
  // } catch (error) {
  //     console.error("Error tracking unique visitor in $kv:", error);
  // }


  // --- Add any other logic you need when a user enters ---
  // Using only the available payload variables.


} catch (error) {
  // --- Basic Error Handling for the handler ---
  console.error("An unexpected error occurred in the 'User Enter' event handler:", error);
  console.error("Error details:", {
    message: error.message,
    stack: error.stack,
    // Attempt to log available payload data safely using the original $user variable
    user: {
        // Use $user directly here, applying the typeof check
        username: typeof $user !== 'undefined' ? $user.username : 'N/A',
        colorGroup: typeof $user !== 'undefined' ? $user.colorGroup : 'N/A',
        recentTips: typeof $user !== 'undefined' ? $user.recentTips : 'N/A'
    },
    room: {
        // Use $room directly here
        owner: typeof $room !== 'undefined' ? $room.owner : 'N/A'
    },
     app: {
         // Use $app directly here
         name: typeof $app !== 'undefined' ? $app.name : 'N/A',
         version: typeof $app !== 'undefined' ? $app.version : 'N/A'
     }
  });

   // Optional: Send a notice to the broadcaster if a critical error occurs
    // try {
    //     // Attempt to get broadcaster username safely
    //     const ownerUsername = typeof $room !== 'undefined' ? $room.owner : 'broadcaster (unknown)';
    //      // Ensure $room is available before sending notice
    //      if (typeof $room !== 'undefined' && $room.sendNotice) {
    //         $room.sendNotice(`App Error: An issue occurred in the user enter handler. Details logged.`, { toUsername: ownerUsername });
    //     } else {
    //         console.error("Could not send error notice, $room or sendNotice not available in catch block.");
    //     }
    // } catch (noticeError) {
    //     console.error("Failed to send error notice in catch block:", noticeError);
    // }
}


console.log("--- 'User Enter' Event Handler Finished ---");
