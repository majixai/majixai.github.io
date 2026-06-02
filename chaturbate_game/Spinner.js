// PASTE THIS ENTIRE BLOCK INTO: Broadcast Overlays -> Your Slot Overlay -> JavaScript

console.log("--- Slot Machine Overlay Script Loading ---");


// Static property for symbols (matches backend)
static SYMBOLS = ["🍒", "🔔", " BAR ", " 7 ", "💎"];
static REEL_COUNT = 3;
static SYMBOL_HEIGHT = 120; // Must match CSS .symbol height
static BASE_SPIN_DURATION = 2000; // Base duration in ms
// How many of each symbol to put in the strip for animation (must be enough for N full cycles + result)
static SYMBOLS_PER_REEL_STRIP = 30; // Increased this for more "spin" visual


// Use an async IIFE to contain the class definition and initialization
// Wrap the async function definition in parentheses and immediately call it
(async () => {

    console.log("IIFE executed. Defining SlotMachineOverlay class...");

    // Define the SlotMachineOverlay class
    class SlotMachineOverlay {


        // Private fields using # syntax
        #reelElements = [];
        #resultDisplay;
        #winDisplay;
        #isSpinning = false;
        #messageCallback = null; // To store the message handler


        // Public constructor
        constructor() {
            console.log("SlotMachineOverlay: Constructor called.");
            // Get DOM references
            this.#resultDisplay = document.getElementById('resultDisplay');
            this.#winDisplay = document.getElementById('winDisplay');
            const reelsContainer = document.getElementById('reelsContainer');

            // Validate essential DOM elements
            if (!this.#resultDisplay || !this.#winDisplay || !reelsContainer) {
                 console.error("SlotMachineOverlay: Required DOM elements not found!");
                 // You might want to throw an error or set a flag to indicate failure
                 // throw new Error("Slot machine overlay cannot initialize: Missing DOM elements.");
                 this.domError = true; // Set a flag to indicate DOM error
                 return; // Stop constructor execution
            }

            // Create and append reel elements
            for (let i = 0; i < SlotMachineOverlay.REEL_COUNT; i++) {
                const reelDiv = document.createElement('div');
                reelDiv.classList.add('reel');

                const symbolsDiv = document.createElement('div');
                symbolsDiv.classList.add('reel-symbols'); // This div contains the spinning symbols
                reelDiv.appendChild(symbolsDiv);

                this.#reelElements.push(symbolsDiv); // Store the inner symbols container for manipulation
                reelsContainer.appendChild(reelDiv);
            }

            // Initial setup
            this.#renderReelSymbols(); // Populate reels with symbols
            this.#clearResults(); // Clear initial display
            // setupMessageListener is called in init() now
             console.log("SlotMachineOverlay: Constructor finished.");
        }

        // Private method to populate reel-symbols divs
        #renderReelSymbols() {
            console.log("SlotMachineOverlay: Rendering reel symbols...");
             if (this.domError) { // Check for DOM error before proceeding
                 console.warn("SlotMachineOverlay: DOM error prevents rendering reel symbols.");
                 return;
             }
            this.#reelElements.forEach(reelElement => {
                reelElement.innerHTML = ''; // Clear existing symbols

                // Create a long strip of symbols for animation
                let symbolStripHTML = '';
                // Repeat symbols multiple times in a pseudo-random order within the strip
                const shuffledSymbols = SlotMachineOverlay.SYMBOLS.slice().sort(() => Math.random() - 0.5);
                const repeatCount = Math.ceil(SlotMachineOverlay.SYMBOLS_PER_REEL_STRIP / shuffledSymbols.length);

                for (let i = 0; i < repeatCount; i++) {
                   shuffledSymbols.forEach(symbol => {
                      // Add class based on symbol content for custom styling
                      const symbolClass = `symbol-${symbol.trim().replace(/\s+/g, '-')}`;
                      symbolStripHTML += `<div class="symbol ${symbolClass}">${symbol}</div>`;
                   });
                }

                 // Append the first few symbols again at the end to ensure we can land near the bottom
                 // without abruptly jumping visually when resetting.
                 for (let i = 0; i < SlotMachineOverlay.REEL_COUNT; i++) { // Add enough symbols to cover the visible reel window + buffer
                     const symbol = SlotMachineOverlay.SYMBOLS[i % SlotMachineOverlay.SYMBOLS.length];
                     const symbolClass = `symbol-${symbol.trim().replace(/\s+/g, '-')}`;
                     symbolStripHTML += `<div class="symbol ${symbolClass}">${symbol}</div>`;
                 }


                reelElement.innerHTML = symbolStripHTML;
                // Reset transform to ensure strips are at the top initially without transition
                 reelElement.style.transition = 'none';
                 reelElement.style.transform = 'translateY(0)';
                 // Force reflow to apply non-transitioned style immediately
                 // Reading a property like offsetHeight forces the browser to calculate layout
                 reelElement.offsetHeight;
            });
             console.log(`SlotMachineOverlay: Reels populated.`);
        }

        // Private method to calculate target position for a symbol
        // Aims to land the top edge of the target symbol at the *center* of the reel window.
        #getTargetPosition(reelIndex, targetSymbol) {
             if (this.domError) return 0; // Return default if DOM error

             const reelElement = this.#reelElements[reelIndex];
             const symbolsInStrip = reelElement.querySelectorAll('.symbol');
             let targetIndex = -1; // Index of the symbol in the strip we want to land on

             // Find the *last* instance of the target symbol in the strip.
             // Landing on an instance closer to the end makes the final stop look better after fast spinning.
             for (let i = symbolsInStrip.length - 1; i >= 0; i--) {
                  if (symbolsInStrip[i].textContent.trim() === targetSymbol.trim()) { // Trim text content for comparison
                       targetIndex = i;
                       console.log(`Reel ${reelIndex + 1}: Target symbol '${targetSymbol}' found at index ${i} (using last instance).`);
                       break;
                   }
             }

            if (targetIndex === -1) {
                 console.warn(`Reel ${reelIndex + 1}: Target symbol '${targetSymbol}' not found in strip! Falling back to a random symbol position.`);
                 // Fallback: Land on a random symbol's position if the target wasn't found
                 targetIndex = Math.floor(Math.random() * symbolsInStrip.length);
                 // Even better fallback: Re-render the strip immediately to guarantee the symbol is there?
                 // Or simply choose a position that *would* show a target symbol if the strip were complete/correct.
                 // Let's use a position that *would* align the first instance of the symbol if the strip was just one cycle.
                 const firstInstanceIndex = SlotMachineOverlay.SYMBOLS.indexOf(targetSymbol);
                 if(firstInstanceIndex !== -1) {
                    targetIndex = firstInstanceIndex;
                    console.warn(`Reel ${reelIndex + 1}: Using index of first instance (${targetIndex}) as fallback.`);
                 } else {
                    console.error(`Reel ${reelIndex + 1}: Target symbol '${targetSymbol}' not found in static SYMBOLS array! This is a config error.`);
                    targetIndex = 0; // Last resort, land at the top
                 }
            }


            // Calculate the Y translation needed to bring the top edge of the symbol at targetIndex
            // into the center of the visible reel window.
            // Visible window is SYMBOL_HEIGHT tall.
            // Symbol at index 'i' has its top edge at i * SYMBOL_HEIGHT relative to the strip's original top.
            // The center of the *visible window* is at SYMBOL_HEIGHT / 2 from the reel's top border.
            // So we need to translate the strip up (negative Y) by (targetIndex * SYMBOL_HEIGHT) + (SYMBOL_HEIGHT / 2).
            const targetY = -(targetIndex * SlotMachineOverlay.SYMBOL_HEIGHT + SlotMachineOverlay.SYMBOL_HEIGHT / 2);

            // Add extra translations to make the spin visually longer.
            // We need to translate DOWN (more negative Y) by full cycles.
            const extraSpins = 3; // Spin at least X extra full cycles
            const fullCycleHeight = SlotMachineOverlay.SYMBOLS.length * SlotMachineOverlay.SYMBOL_HEIGHT;

            // Calculate the starting position before the final easing stop.
            // Start high up (large negative Y) and animate *down* to targetY.
            // Let's start from targetY and add the height of extra spins.
            const startY = targetY - (extraSpins * fullCycleHeight);


            console.log(`Reel ${reelIndex + 1}: Calculated Target Y: ${targetY}px, Start Y: ${startY}px`);

            // Return both start and end positions
            return { startY, targetY };
        }


        // Private async method to animate the spin
        async #spinToOutcome(outcomeArray) {
            if (this.#isSpinning || this.domError) {
                console.log("SlotMachineOverlay: Already spinning or DOM error, ignoring trigger.");
                return;
            }
            this.#isSpinning = true;
            console.log(`SlotMachineOverlay: Starting spin animation to outcome: ${outcomeArray.join(' | ')}`);

            this.#clearResults(); // Hide previous results

            const promises = [];
            this.#reelElements.forEach((reelElement, index) => {
                const targetSymbol = outcomeArray[index];
                 // Get start and end positions
                const { startY, targetY } = this.#getTargetPosition(index, targetSymbol);

                // Add delay and duration variation per reel
                const delay = index * 150; // Stagger start (e.g., 0ms, 150ms, 300ms)
                // Base duration + index delay + randomness
                const duration = SlotMachineOverlay.BASE_SPIN_DURATION + (index * 200) + (Math.random() * 500); // Stagger and randomize duration

                // Reset reel position to the calculated start position instantly
                reelElement.style.transition = 'none';
                reelElement.style.transform = `translateY(${startY}px)`;
                // Force reflow so the browser renders the start position before applying transition
                reelElement.offsetHeight;

                // Use a promise to wait for the transition to finish on this specific reel
                promises.push(new Promise(resolve => {
                    // Set timeout for the *start* delay of this reel
                    setTimeout(() => {
                         console.log(`Reel ${index + 1}: Starting animation (delay ${delay}ms, duration ${duration}ms)`);
                        // Now apply the transition and the target transform to start the animation
                        reelElement.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1.0)`; // Easing for smooth stop
                        reelElement.style.transform = `translateY(${targetY}px)`;

                        // Listen for the end of the transition on this element
                        const handleTransitionEnd = () => {
                            console.log(`Reel ${index + 1} transitionend fired.`);
                             // Remove the listener to avoid duplicates
                             reelElement.removeEventListener('transitionend', handleTransitionEnd);
                             resolve(); // Resolve the promise when animation ends
                        };
                         reelElement.addEventListener('transitionend', handleTransitionEnd);

                         // Fallback timeout in case transitionend doesn't fire (less reliable, but safer)
                         setTimeout(() => {
                             console.warn(`Reel ${index + 1} animation fallback timeout fired after ${duration}ms.`);
                             // Clean up the listener if it hasn't fired already
                             reelElement.removeEventListener('transitionend', handleTransitionEnd);
                             resolve(); // Resolve even if transitionend didn't fire
                         }, duration + 200); // A little longer than the duration
                    }, delay);
                }));
            });

            // Wait for all reel animation promises to complete
            await Promise.all(promises);

            console.log("SlotMachineOverlay: All reel animations finished.");
            this.#isSpinning = false;

            // After animation, ensure the symbols are positioned correctly without transition for the next spin
            this.#reelElements.forEach(reelElement => {
                 const currentTransform = reelElement.style.transform;
                 reelElement.style.transition = 'none'; // Remove transition for instant reset
                 reelElement.style.transform = currentTransform; // Apply the final transform (which should be the targetY)
                 // Force reflow again (good practice before starting a new transition later)
                 reelElement.offsetHeight;
            });

             // The result display is now handled by the calling code after the await
        }

        // Private method to display the spin result
        #displayResult(isWin, prize, user) {
             if (this.domError) return; // Stop if DOM error
            console.log(`SlotMachineOverlay: Displaying result for ${user}: Win=${isWin}, Prize='${prize}'`);
            this.#resultDisplay.textContent = `Result: ${prize}`;
             this.#resultDisplay.classList.add('visible'); // Add class for potential CSS styling

            if (isWin) {
                this.#winDisplay.textContent = `WIN for ${user}!`;
                 this.#winDisplay.classList.add('visible'); // Add class for potential CSS styling
            } else {
                 this.#winDisplay.textContent = ''; // Clear win message
                 this.#winDisplay.classList.remove('visible');
            }

            // Optional: Hide results after a few seconds
            setTimeout(() => {
                 this.#clearResults();
            }, 8000); // Hide results after 8 seconds
        }

        // Private method to clear result displays
        #clearResults() {
             if (this.domError) return; // Stop if DOM error
            this.#resultDisplay.textContent = '';
            this.#resultDisplay.classList.remove('visible');
            this.#winDisplay.textContent = '';
            this.#winDisplay.classList.remove('visible');
        }


        // Public method to set up message listener from backend handler
        setupMessageListener() {
             if (this.domError) {
                 console.warn("SlotMachineOverlay: DOM error prevents setting up message listener.");
                 return;
             }
             console.log("SlotMachineOverlay: Setting up message listener from window...");
             // Remove any existing listener first to prevent duplicates if called multiple times
             if (this.#messageCallback) {
                 console.log("SlotMachineOverlay: Removing existing message listener.");
                 window.removeEventListener('message', this.#messageCallback);
             }

             this.#messageCallback = async (event) => {
                 // IMPORTANT: Check event.origin in production for security!
                 // event.origin should be the origin of the parent window (Chaturbate).
                 // Example check:
                 // if (event.origin !== 'https://www.chaturbate.com' && event.origin !== 'https://chaturbate.com') {
                 //     console.warn("SlotMachineOverlay: Ignoring message from unknown origin:", event.origin);
                 //     return;
                 // }

                 // Messages from backend handlers via $overlay.emit are wrapped in { type: 'overlayMessage', payload: ... }
                 if (event.data && event.data.type === 'overlayMessage') {
                     const message = event.data.payload; // The actual data sent by $overlay.emit
                     console.log('SlotMachineOverlay: Received overlayMessage payload:', message);

                     // Handle the 'slotResult' event from the backend
                     // This event carries the computed outcome, whether it's a win, and the prize.
                     if (message && message.eventName === 'slotResult' && !this.#isSpinning) {
                         console.log(`SlotMachineOverlay: Received slotResult for ${message.user}. Outcome: ${message.outcome}. Spinning reels...`);
                         // Validate outcome format if necessary
                         if (!Array.isArray(message.outcome) || message.outcome.length !== SlotMachineOverlay.REEL_COUNT ||
                             message.outcome.some(symbol => !SlotMachineOverlay.SYMBOLS.includes(symbol))) {
                             console.error("SlotMachineOverlay: Received invalid outcome format:", message.outcome);
                             // Optionally display an error or perform a default spin
                             return;
                         }

                         // Trigger the spin animation using the received outcome
                         await this.#spinToOutcome(message.outcome);

                         // Display the result after the animation finishes
                         this.#displayResult(message.isWin, message.prize, message.user);

                     }
                     // Handle other potential messages here if needed later
                     // e.g., 'updateSymbols', 'resetOverlay' etc.
                     // if (message.eventName === 'someOtherEvent') { ... }
                 } else {
                      // Log unexpected message format
                      // console.log('SlotMachineOverlay: Received unexpected message format:', event.data);
                 }
             };

             window.addEventListener('message', this.#messageCallback);
             console.log("SlotMachineOverlay: Window message listener added.");
        }

        // Public initialization method
        init() {
            console.log("SlotMachineOverlay: Initializing overlay...");
             if (this.domError) {
                 console.error("SlotMachineOverlay: Skipping init due to DOM errors.");
                 return;
             }
            // This method is called after the class is instantiated.
            // The constructor already did most of the setup, but this is good practice.
            // We could add fetching initial state here if needed, but for a real-time overlay,
            // initial state often comes from the first events.
            this.#renderReelSymbols(); // Ensure reels are populated on load
            this.setupMessageListener(); // Ensure listener is active
            console.log("SlotMachineOverlay: Overlay ready.");

             // Add test button listener (Make sure you have a button with id="spinButton" in your HTML)
             const testButton = document.getElementById('spinButton');
             if(testButton) {
                 testButton.addEventListener('click', async () => {
                     console.log("SlotMachineOverlay: Test spin button clicked.");
                     if (this.#isSpinning) {
                        console.log("SlotMachineOverlay: Test spin button clicked, but already spinning.");
                        return; // Do nothing if already spinning
                     }
                      console.log("SlotMachineOverlay: Initiating manual test spin.");
                     // Generate a random outcome for testing
                     const testOutcome = Array(SlotMachineOverlay.REEL_COUNT).fill(null).map(() =>
                        SlotMachineOverlay.SYMBOLS[Math.floor(Math.random() * SlotMachineOverlay.SYMBOLS.length)]
                     );
                     // Simulate a win sometimes for testing
                     const simulateWin = Math.random() < 0.3; // 30% chance to simulate a win
                     let testPrize = "No Win";
                     if (simulateWin) {
                        const winningSymbol = SlotMachineOverlay.SYMBOLS[Math.floor(Math.random() * SlotMachineOverlay.SYMBOLS.length)];
                        testOutcome.fill(winningSymbol); // Make all reels land on the same symbol
                         testPrize = `${winningSymbol.trim()} x${SlotMachineOverlay.REEL_COUNT}`;
                     }

                     await this.#spinToOutcome(testOutcome);
                     this.#displayResult(simulateWin, testPrize, "Tester"); // Display test result
                 });
                  console.log("SlotMachineOverlay: Test spin button listener added.");
             } else {
                  console.warn("SlotMachineOverlay: Test spin button (#spinButton) not found in HTML.");
             }
        }

         // Example of a static method
         static getRandomSymbol() {
             return this.SYMBOLS[Math.floor(Math.random() * this.SYMBOLS.length)];
         }
    }

    // Instantiate and initialize the overlay AFTER class definition
    const slotOverlay = new SlotMachineOverlay();

    // Only call init() if the constructor didn't encounter DOM errors
    if (!slotOverlay.domError) {
        slotOverlay.init();
    } else {
        console.error("SlotMachineOverlay: Initialization failed due to DOM errors.");
    }


    // Example usage of static method (optional)
     console.log("SlotMachineOverlay: Random symbol example:", SlotMachineOverlay.getRandomSymbol());

})(); // End of async IIFE and immediately execute it

console.log("--- Slot Machine Overlay Script Finished Execution Block ---");
