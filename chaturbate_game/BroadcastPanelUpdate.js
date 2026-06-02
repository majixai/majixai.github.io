// PASTE THIS ENTIRE BLOCK INTO: Event Handlers -> Broadcast Panel Update Handler

console.log("--- 'Broadcast Panel Update' Event Handler Executed ---");

 // --- Configuration Constants ---
 // MUST MATCH the keys used in the 'Tip Received' Handler
 const progressKey = "tip_goal_current_progress"; // Standard Tip Goal progress
 const tipGoalKey = "tip_goal_target_amount";   // Standard Tip Goal amount

 // Slot-specific KV Keys (MUST MATCH the keys used in the 'Tip Received' Handler)
 const totalSpinsTriggeredKey = 'total_slot_spins_triggered'; // Total spins triggered globally
 const latestSpinUserKey      = 'latest_slot_spin_user';  // User who triggered the last instant spin
 const latestSpinOutcomeKey   = 'latest_slot_spin_outcome'; // Outcome of the last instant spin (e.g., ['🍒', '🍒', ' BAR '])


 // Choose the panel template to use (hardcoded as 3_rows_of_labels works well with this data)
 const PANEL_TEMPLATE_NAME = '3_rows_of_labels';

// Wrap the entire handler logic in an async IIFE for await usage
(async () => {

    try {
        // Check for necessary components
        if (!$kv) {
            console.error("Cannot update panel: $kv service is not available.");
            // Optionally set a fallback panel template indicating the issue
             if ($room && typeof $room.setPanelTemplate === 'function') {
                  $room.setPanelTemplate({ template: '3_rows_of_labels', row1_label: 'Error:', row1_value: 'KV N/A', row2_label: '', row2_value: '', row3_label: '', row3_value: '' });
             }
            return; // Exit early if no KV store
        }
         if (!$room || typeof $room.setPanelTemplate !== 'function') {
             console.error("Cannot update panel: $room.setPanelTemplate is not available.");
            // No fallback panel possible if $room is missing or doesn't have the function
             return; // Exit early if panel function is missing
         }

        // --- Retrieve all required data from KV Store ---
        console.log("Retrieving panel data from KV store...");

        // Standard Tip Goal
        const currentGoalProgress = await $kv.get(progressKey, 0);
        const currentGoalAmount   = await $kv.get(tipGoalKey, 0);

        // Slot Data
        const totalSpinsTriggered = await $kv.get(totalSpinsTriggeredKey, 0);
        // Get latest spin data - handle cases where keys might not exist yet (e.g., first run)
        const latestSpinUser      = await $kv.get(latestSpinUserKey, 'Nobody');
        const latestSpinOutcome   = await $kv.get(latestSpinOutcomeKey, ['-', '-', '-']); // Default outcome as array

        console.log(`KV Data: Goal=${currentGoalProgress}/${currentGoalAmount}, Total Spins=${totalSpinsTriggered}, Last Spin=${Array.isArray(latestSpinOutcome) ? latestSpinOutcome.join('|') : 'N/A'}(${latestSpinUser})`);

        // --- Format Data for Display ---
        const goalProgressDisplay = currentGoalAmount > 0 ? `${currentGoalProgress} / ${currentGoalAmount}` : 'Goal Not Set';
        const totalSpinsDisplay   = `${totalSpinsTriggered}`;
        // Ensure latestSpinOutcome is treated as an array before joining
        const lastSpinOutcomeDisplay = Array.isArray(latestSpinOutcome) ? latestSpinOutcome.join(' | ') : '---';
        const lastSpinDisplay     = `${lastSpinOutcomeDisplay} by ${latestSpinUser}`;


        // --- Construct Panel Options ---
         const panelOptions = {
           template: PANEL_TEMPLATE_NAME,
           row1_label: 'Tip Goal:',     // Keep standard tip goal
           row1_value: goalProgressDisplay,
           row2_label: 'Total Spins:',  // Slot-specific data
           row2_value: totalSpinsDisplay,
           row3_label: 'Last Spin:',    // Slot-specific data
           row3_value: lastSpinDisplay,
         };

        // --- Set the Panel ---
        $room.setPanelTemplate(panelOptions);
        console.log(`Broadcast panel updated successfully using template '${PANEL_TEMPLATE_NAME}'.`);


    } catch (error) {
        // --- Comprehensive Error Handling ---
        console.error("### FATAL ERROR in 'Broadcast Panel Update' event handler ###");
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
         // Attempt to set an error panel if possible
         try {
             if ($room && typeof $room.setPanelTemplate === 'function') {
                 // Trim error message for panel display
                 const errorMessage = error.message || 'Unknown Error';
                 const displayMessage = errorMessage.length > 20 ? errorMessage.substring(0, 17) + '...' : errorMessage;
                  $room.setPanelTemplate({ template: '3_rows_of_labels', row1_label: 'Panel Error:', row1_value: displayMessage, row2_label: 'Check logs', row2_value: '', row3_label: '', row3_value: '' });
             }
         } catch (panelError) {
             console.error("Failed trying to set error panel:", panelError);
         }

         try {
            if ($room && $room.owner && $room.sendNotice) {
                 $room.sendNotice(`🚨 App Error in Panel Handler! @${$room.owner} check logs. Error: ${error.message}`, { toUsername: $room.owner, color: '#FF0000' });
             }
        } catch (noticeError) { console.error("Failed trying to send error notice:", noticeError); }
    } finally {
        console.log("--- 'Broadcast Panel Update' Event Handler Finished ---");
    }

})(); // Immediately invoke the async function
