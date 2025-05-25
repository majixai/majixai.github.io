/**
 * Fetches online user data from the API using pagination.
 * Updates `allOnlineUsersData`, then calls functions to populate filters and display users.
 */
async function fetchData() {
    console.log("Executing fetchData: Starting online user data fetch...");
    showOnlineLoadingIndicator("Loading online users...");
    clearOnlineErrorDisplay(); // Clear previous errors

    let fetchedUsers = []; // Use a temporary array for this fetch cycle
    let offset = 0;
    let continueFetching = true;
    let totalFetchedCount = 0;

    while (continueFetching && totalFetchedCount < maxApiFetchLimit) {
        const apiUrl = `${apiUrlBase}&limit=${apiLimit}&offset=${offset}`;
         console.log(`fetchData: Fetching page (limit ${apiLimit}, offset ${offset}). URL: ${apiUrl}`);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                 console.warn(`fetchData: Aborting fetch for offset ${offset} due to timeout (${apiFetchTimeout}ms).`);
                 controller.abort();
                 }, apiFetchTimeout);

            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId); // Clear the timeout if fetch completes/fails normally

            console.log(`fetchData: Response status for offset ${offset}: ${response.status}`);

            if (!response.ok) {
                 const errorBody = await response.text().catch(() => `Status: ${response.statusText}`);
                 console.error(`fetchData: HTTP error fetching offset ${offset}. Status: ${response.status}, Body: ${errorBody}`);
                 // Decide if a single page failure should stop the whole process
                 // For now, we'll stop fetching on error.
                 throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();
             // console.log("fetchData: Successfully parsed JSON response for offset", offset);

             // Validate the received data structure
             if (data && data.results && Array.isArray(data.results)) {
                 console.log(`fetchData: Received ${data.results.length} results in batch from offset ${offset}.`);
                  if (data.results.length > 0) {
                     // Log a sample user object to verify properties occasionally
                     // if (offset === 0) console.log("fetchData: Sample user object:", data.results[0]);
                     fetchedUsers = fetchedUsers.concat(data.results);
                     totalFetchedCount = fetchedUsers.length;
                     showOnlineLoadingIndicator(`Fetched ${totalFetchedCount} users...`);

                     if (data.results.length < apiLimit) {
                         console.log("fetchData: Last page reached (results < limit). Stopping fetch.");
                         continueFetching = false; // This was the last page
                     } else {
                         offset += apiLimit; // Prepare for the next page
                         // continueFetching remains true
                     }
                 } else {
                     console.log("fetchData: Received 0 results in batch from offset ${offset}. Stopping fetch.");
                     continueFetching = false; // No more results on this page, stop.
                 }
             } else {
                 console.warn("fetchData: Response JSON does not contain a valid 'results' array from offset ${offset}:", data);
                 continueFetching = false; // Invalid data structure, stop.
             }
             // console.log(`fetchData: Loop check: continueFetching=${continueFetching}, offset=${offset}, totalFetchedCount=${totalFetchedCount}`);

        } catch (error) {
            console.error(`fetchData: Error during fetch for offset ${offset}:`, error);
             if (error.name === 'AbortError') {
                 showOnlineErrorDisplay(`Failed to fetch data (timeout). Check network or API status.`);
             } else {
                showOnlineErrorDisplay(`Failed to fetch data: ${error.message}. Check console.`);
             }
             // Optional: Display error directly in the list area
             // if (onlineUsersDiv) onlineUsersDiv.innerHTML = '<p class="text-danger w3-center">Error fetching data. See console.</p>';
            continueFetching = false; // Stop fetching loop on any error
        }
    } // End while loop

    if (totalFetchedCount >= maxApiFetchLimit) {
        console.warn(`fetchData: Fetch stopped after reaching safety limit (${maxApiFetchLimit} users).`);
        showOnlineErrorDisplay(`Load stopped at ${maxApiFetchLimit} users. Data might be incomplete.`);
    }

    console.log(`fetchData: Fetch cycle finished. Total users fetched in this cycle: ${totalFetchedCount}`);

    // --- Post-fetch actions ---
    // Replace the old data with the newly fetched data
    allOnlineUsersData = fetchedUsers;
    lastFilteredUsers = []; // Reset filtered list until filters are applied

    if (allOnlineUsersData.length > 0) {
         console.log("fetchData: Populating filters and displaying users...");
         populateFilters(allOnlineUsersData); // Populate filters based on the *new* full dataset
         applyFiltersAndDisplay(); // Apply current filters and display the new online users
         await displayPreviousUsers(); // Refresh previous users display (needs await as it might load)
    } else {
         console.log("fetchData: No online users data fetched in this cycle. Clearing online display.");
          if (onlineUsersDiv) onlineUsersDiv.innerHTML = '<p class="text-muted w3-center">No online users found or failed to fetch.</p>';
          populateFilters([]); // Clear filters or show default state
          applyFiltersAndDisplay(); // Ensure display reflects empty state
          await displayPreviousUsers(); // Still try to display previous users (they might be offline now)
    }

    hideOnlineLoadingIndicator();
    console.log("fetchData execution finished.");
}
