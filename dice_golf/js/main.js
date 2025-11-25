/**
 * @fileoverview Main entry point for the Dice Golf application.
 * Initializes all modules and starts the game.
 */

(async function() {
    'use strict';

    // --- IIFE (Immediately Invoked Function Expression) to keep scope private ---

    /**
     * The main initialization function.
     */
    async function main() {
        console.log("Initializing Dice Golf Engine...");

        const DATA_URL = 'data/holes.json'; // Path to the uncompressed hole data

        try {
            // 1. Fetch data
            const holeData = await DataService.getHoleData(DATA_URL);
            if (!holeData || holeData.length === 0) {
                throw new Error("Course data could not be loaded.");
            }

            // 2. Initialize players
            // For now, we'll use a single player. This could be expanded.
            const players = [new Player('Player 1')];

            // 3. Initialize helpers and UI manager
            const dbHelper = new DBHelper();
            const uiManager = new UIManager();

            // 4. Create and initialize the game engine
            const game = new Game(players, holeData, uiManager, dbHelper);
            await game.init();

            console.log("Game is ready. Good luck!");

        } catch (error) {
            console.error("A critical error occurred during initialization:", error);
            // You could display a user-friendly error message on the page here
            document.body.innerHTML = `<div class="w3-panel w3-red w3-center"><p>Failed to load the game. Please try again later.</p></div>`;
        }
    }

    // --- App Initialization ---

    /**
     * A simple hook to ensure the DOM is ready before we start.
     * This is a lightweight alternative to a full framework's lifecycle methods.
     */
    function onDocumentReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    onDocumentReady(main);

})();
