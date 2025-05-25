/**
 * Creates and returns a DOM element for a single user.
 * Includes image, details, badges, and event listeners.
 * @param {Object} user - The user data object.
 * @param {'online' | 'previous'} listType - Indicates which list the element is for (affects styling/buttons).
 * @returns {HTMLElement} The created user div element.
 */
function createUserElement(user, listType) {
    const userElement = document.createElement("div");
    // Add classes for styling based on list type
    userElement.className = `user-info w3-card w3-margin-bottom ${listType}-list-item`; // Example using W3.CSS card style
    userElement.dataset.username = user.username; // Store username for potential later use

    // Determine content using template literal for readability
    const tagsDisplay = (user.tags && Array.isArray(user.tags) && user.tags.length > 0)
                        ? user.tags.join(', ')
                        : 'N/A';
    const ageDisplay = (user.age && typeof user.age === 'number') ? user.age : 'N/A';
    const newBadge = user.is_new ? '<span class="badge new-badge w3-tag w3-small w3-red w3-round">New</span>' : '';
    const birthdayBanner = isBirthday(user.birthday) ? `<p class="birthday w3-text-amber w3-center">🎂 Happy Birthday! 🎂</p>` : '';
    const removeButton = listType === 'previous' ? '<button class="remove-user-btn w3-button w3-tiny w3-red w3-hover-dark-grey w3-circle" title="Remove from history">×</button>' : '';

    userElement.innerHTML = `
        <div class="user-image-container">
            <img src="${user.image_url}" alt="${user.username} thumbnail" loading="lazy" class="w3-image">
            ${removeButton} <!-- Position remove button relative to container -->
        </div>
        <div class="user-details w3-container w3-padding-small">
            <p class="username w3-large">${user.username} ${newBadge}</p>
            <p><small>Age: ${ageDisplay} | Viewers: ${user.num_viewers || 'N/A'}</small></p> <!-- Example: Added viewers -->
            <p class="tags"><small>Tags: ${tagsDisplay}</small></p>
            ${birthdayBanner}
        </div>
    `;

    // --- Add Event Listeners ---

    // Add click listener to the main element (excluding the remove button) to load iframe
    userElement.addEventListener("click", function(event) {
         // Prevent triggering if the remove button itself was clicked
         if (event.target.closest('.remove-user-btn')) {
             return;
         }
         event.preventDefault(); // Prevent potential default behaviors
         handleUserClick(user); // Use the full user object passed in
    });

    // Add listener specifically for the remove button if it exists
    const removeBtn = userElement.querySelector('.remove-user-btn');
    if (removeBtn) {
        removeBtn.addEventListener("click", async function(event) {
            event.stopPropagation(); // VERY IMPORTANT: Prevent click from bubbling up to the userElement listener
            console.log(`User clicked remove for: ${user.username}`);
            showOnlineLoadingIndicator("Removing from history..."); // Provide feedback
            await removeFromPreviousUsers(user.username);
            await displayPreviousUsers(); // Refresh the display after removal (needs await)
            hideOnlineLoadingIndicator();
        });
    }

    return userElement;
}


// --- UI Loading and Error/Status Display Helpers ---

function showOnlineLoadingIndicator(message = 'Loading...') {
    // console.log(`UI: SHOW ONLINE LOADING: ${message}`);
    if (onlineLoadingIndicator) {
        onlineLoadingIndicator.textContent = message;
        onlineLoadingIndicator.style.display = 'block'; // Or 'inline', 'flex' etc.
        // Optionally disable user interactions while loading
    }
     // Clear the list area while loading to avoid confusion
     if (onlineUsersDiv) onlineUsersDiv.innerHTML = '';
}

function hideOnlineLoadingIndicator() {
    // console.log("UI: HIDE ONLINE LOADING");
    if (onlineLoadingIndicator) {
        onlineLoadingIndicator.style.display = 'none';
        // Re-enable interactions if disabled
    }
}

function showOnlineErrorDisplay(message) {
    console.error(`UI: SHOW ONLINE ERROR: ${message}`);
    if (onlineErrorDisplay) {
        onlineErrorDisplay.textContent = `Error: ${message}`;
        onlineErrorDisplay.style.display = 'block'; // Or 'inline', 'flex' etc.
        onlineErrorDisplay.className = 'error-message'; // Add class for styling
    }
    // Also hide loading indicator if an error occurs
    hideOnlineLoadingIndicator();
}

 function clearOnlineErrorDisplay() {
    //   console.log("UI: CLEAR ONLINE ERROR DISPLAY");
      if (onlineErrorDisplay) {
        onlineErrorDisplay.style.display = 'none';
        onlineErrorDisplay.textContent = '';
        onlineErrorDisplay.className = ''; // Remove styling class
    }
 }

 // --- Reporting Status Display Helpers ---
 function showReportLoading(message = 'Processing...') {
     // console.log(`UI: SHOW REPORT LOADING: ${message}`);
     if (reportLoadingIndicator) {
         reportLoadingIndicator.textContent = message;
         reportLoadingIndicator.style.display = 'block'; // Or 'inline', 'flex'
     }
     if (sendReportButton) sendReportButton.disabled = true; // Disable button while loading
     clearReportStatus(); // Clear previous status messages
 }

 function hideReportLoading() {
    //   console.log("UI: HIDE REPORT LOADING");
     if (reportLoadingIndicator) {
         reportLoadingIndicator.style.display = 'none';
     }
      if (sendReportButton) sendReportButton.disabled = false; // Re-enable button
 }

 /**
  * Displays a status message related to the reporting action.
  * @param {string} message - The message to display.
  * @param {'success' | 'error' | 'warning' | 'info'} [type='info'] - Type for CSS styling.
  */
 function showReportStatus(message, type = 'info') {
     console.log(`UI: SHOW REPORT STATUS (${type}): ${message}`);
     if (reportStatusDisplay) {
         reportStatusDisplay.textContent = message;
         reportStatusDisplay.className = `report-status ${type}`; // Base class + type class for styling
         reportStatusDisplay.style.display = 'block'; // Or 'inline', 'flex'

         // Automatically clear non-error messages after a delay
         if (type !== 'error') {
             setTimeout(clearReportStatus, 6000); // e.g., clear after 6 seconds
         }
     }
     // Ensure loading is hidden when status is shown
     hideReportLoading();
 }

  function clearReportStatus() {
    //    console.log("UI: CLEAR REPORT STATUS");
      if (reportStatusDisplay) {
        reportStatusDisplay.style.display = 'none';
        reportStatusDisplay.textContent = '';
        reportStatusDisplay.className = 'report-status'; // Reset classes
    }
  }
