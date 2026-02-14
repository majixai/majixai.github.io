// --- Callback Event Handler ---
// PASTE INTO: Event Handlers -> Callbacks -> Callback
// Handles scheduled announcements

console.log("--- Roulette Callback Event Handler ---");

const ROULETTE_ANNOUNCEMENT_DELAY = 300; // 5 minutes between announcements

(async () => {
    try {
        // Check if this is our roulette announcement callback
        if ($callback.label === 'rouletteAnnounce') {
            
            // Get announcements and current index
            const announcementsString = $kv.get('rouletteAnnouncements');
            let currentIndex = $kv.get('rouletteAnnouncementIndex') || 0;
            
            if (announcementsString) {
                try {
                    const announcements = JSON.parse(announcementsString);
                    
                    if (announcements && announcements.length > 0) {
                        // Ensure index is valid
                        currentIndex = currentIndex % announcements.length;
                        
                        // Send the announcement
                        $room.sendNotice(announcements[currentIndex], {
                            color: '#FFD700' // Gold color for announcements
                        });
                        
                        // Update index for next time
                        const nextIndex = (currentIndex + 1) % announcements.length;
                        $kv.set('rouletteAnnouncementIndex', nextIndex);
                        
                        console.log(`Roulette: Sent announcement ${currentIndex + 1}/${announcements.length}`);
                    }
                } catch (e) {
                    console.error("Roulette: Error parsing announcements:", e);
                }
            }
            
            // Schedule the next announcement
            if ($callback && typeof $callback.create === 'function') {
                $callback.create('rouletteAnnounce', ROULETTE_ANNOUNCEMENT_DELAY);
                console.log(`Roulette: Next announcement scheduled in ${ROULETTE_ANNOUNCEMENT_DELAY} seconds`);
            }
        }
        
    } catch (error) {
        console.error("### ERROR in Roulette Callback Handler ###");
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }
})();
