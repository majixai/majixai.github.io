// PASTE THIS ENTIRE BLOCK INTO: Broadcast Overlays -> Your Slot Overlay -> JavaScript

console.log("--- Slot Machine Overlay Script Loaded ---");

// Use an async IIFE to contain the class definition and initialization
(async () => {

    // Define the SlotMachineOverlay class
    class SlotMachineOverlay {

        // Static method examples (defined inside class without '=' for properties)
         static getRandomSymbol(symbolsArray) {
             if (!symbolsArray || symbolsArray.length === 0) return '';
             return symbolsArray[Math.floor(Math.random() * symbolsArray.length)];
         }

         static isValidOutcome(outcomeArray, reelCount, symbolsArray) {
             // Check if the outcome array has the correct number of reels and valid symbols
             if (!Array.isArray(outcomeArray) || outcomeArray.length !== reelCount) {
                 console.error("Invalid outcome: incorrect length", outcomeArray, reelCount);
                 return false;
             }
             for (const symbol of outcomeArray) {
                 // Trim symbol from outcome just in case there's leading/trailing space
                 if (!symbolsArray.includes(symbol.trim())) {
                      console.error("Invalid outcome: unknown symbol", symbol, symbolsArray);
                     return false;
                 }
             }
             return true;
         }


        // Instance properties declared in the constructor (ES6 compatible)
        // No need to declare here with '='

        // Public constructor
        constructor() {
            console.log("SlotMachineOverlay: Initializing...");

            // Assign instance properties in the constructor
            this.reelElements = []; // Will be populated AFTER config is received
            this.resultDisplay = document.getElementById('resultDisplay');
            this.winDisplay = document.getElementById('winDisplay');
            this.isSpinning = false;
            this.messageCallback = null; // To store the message handler

            // Config properties received from backend
            this.symbols = []; // Populated by setConfig message
            this.reelCount = 0; // Populated by setConfig message

            // Constants used by instance methods
            this.SYMBOL_HEIGHT = 120; // Must match CSS .symbol height
            this.BASE_SPIN_DURATION = 2000; // Base duration in ms
            this.SYMBOLS_PER_REEL_STRIP = 30; // How many of each symbol to put in the strip for animation


            // ReelsContainer will be used later after config

            if (!this.resultDisplay || !this.winDisplay) {
                 console.error("SlotMachineOverlay: Required DOM elements not found!");
                 // Handle missing elements gracefully, e.g., return or throw
                 return; // Stop initialization if essential elements are missing
            }

            // Reel elements are created AFTER config is received
            // Symbols are rendered AFTER config is received
            this.clearResults("Loading config..."); // Set initial status message
            this.setupMessageListener(); // Set up event listener immediately
             console.log("SlotMachineOverlay: Initialization complete. Awaiting config.");

             // Add test button listener immediately, it will check this.isSpinning
             const testButton = document.getElementById('spinButton');
             if(testButton) {
                 testButton.addEventListener('click', async () => {
                     // Ensure config loaded before allowing test spin
                     if (!this.isSpinning && this.reelCount > 0 && this.symbols.length > 0) {
                         console.log("SlotMachineOverlay: Manual test spin triggered.");
                         // Generate a random outcome for testing
                         const testOutcome = Array(this.reelCount).fill(null).map(() =>
                            SlotMachineOverlay.getRandomSymbol(this.symbols) // Use static helper with received symbols
                         );
                         // Simulate a win sometimes for testing
                         const simulateWin = Math.random() < 0.3; // 30% chance to simulate a win
                         // Basic win simulation for 3 reels
                         if (simulateWin && this.reelCount === 3 && testOutcome.length >= 3) {
                             testOutcome[1] = testOutcome[0];
                             testOutcome[2] = testOutcome[0];
                         } // Add simulation for other reel counts if needed


                         await this.spinToOutcome(testOutcome); // Use this.spinToOutcome
                         // Determine a simple prize for the test win simulation
                         let testPrize = "Test Spin Done.";
                         if (simulateWin && this.reelCount === 3 && testOutcome.length === 3 && testOutcome[0] === testOutcome[1] && testOutcome[1] === testOutcome[2]) { // Check for 3-of-a-kind win
                             // Base win messages on standard symbols, or make prize generation more robust
                             switch (testOutcome[0]) {
                                 case "🍒": testPrize = "TEST WIN! 🍒x3!"; break;
                                 case "🔔": testPrize = "TEST WIN! 🔔x3!"; break;
                                 case " BAR ": testPrize = "TEST WIN! BARx3!"; break;
                                 case "💎": testPrize = "TEST WIN! 💎x3!"; break;
                                 case " 7 ": testPrize = "TEST JACKPOT! 777!"; break;
                                 default: testPrize = `TEST WIN! ${testOutcome[0]} x${this.reelCount}!`; // Use this.reelCount
                             }
                         } else if (simulateWin) {
                             testPrize = "Test Win!"; // Generic win message for non 3-of-a-kind
                         }


                         this.displayResult(simulateWin, testPrize, "Tester"); // Use this.displayResult
                     } else {
                         if(this.isSpinning) console.log("SlotMachineOverlay: Test spin button clicked, but already spinning.");
                         else console.log("SlotMachineOverlay: Test spin button clicked, but config not loaded.");
                     }
                 });
             }
        }

        // Method to create reel elements (called after config)
        createReels() {
             console.log(`SlotMachineOverlay: Creating ${this.reelCount} reels...`); // Use this.reelCount
             const reelsContainer = document.getElementById('reelsContainer');
             if (!reelsContainer) {
                  console.error("SlotMachineOverlay: reelsContainer not found for creation!");
                  return;
             }
             reelsContainer.innerHTML = ''; // Clear any old reels

             this.reelElements = []; // Reset array
            for (let i = 0; i < this.reelCount; i++) { // Use this.reelCount
                const reelDiv = document.createElement('div');
                reelDiv.classList.add('reel');
                // Optional: set individual reel width if needed, but flex handles it
                // reelDiv.style.width = `${calculatedReelWidth}px`;

                const symbolsDiv = document.createElement('div');
                symbolsDiv.classList.add('reel-symbols');
                reelDiv.appendChild(symbolsDiv);

                this.reelElements.push(symbolsDiv); // Store the inner symbols container
                reelsContainer.appendChild(reelDiv);
            }
            console.log("SlotMachineOverlay: Reel elements created.");
        }


        // Method to populate reel-symbols divs
        renderReelSymbols() {
            console.log("SlotMachineOverlay: Rendering reel symbols...");
             if (this.reelElements.length === 0 || this.symbols.length === 0) { // Ensure reels exist and symbols are loaded
                  console.warn("SlotMachineOverlay: Cannot render symbols, reels not created or symbols not loaded.");
                  return;
             }

            this.reelElements.forEach(reelElement => { // Use this.reelElements
                reelElement.innerHTML = ''; // Clear existing symbols

                // Create a long strip of symbols for animation
                let symbolStripHTML = '';
                // Repeat symbols multiple times in a pseudo-random order
                // Use this.symbols for symbols
                const shuffledSymbols = this.symbols.slice().sort(() => Math.random() - 0.5);
                for (let i = 0; i < this.SYMBOLS_PER_REEL_STRIP; i++) { // Use this.SYMBOLS_PER_REEL_STRIP
                     const symbol = shuffledSymbols[i % shuffledSymbols.length]; // Cycle through shuffled symbols
                     // Add class based on symbol content for custom styling
                     const symbolClass = `symbol-${symbol.trim().replace(/\s+/g, '-')}`;
                     symbolStripHTML += `<div class="symbol ${symbolClass}">${symbol}</div>`;
                }
                 // Add the symbols again at the end to ensure we can land on any of them easily
                 for (const symbol of this.symbols) { // Use this.symbols
                     const symbolClass = `symbol-${symbol.trim().replace(/\s+/g, '-')}`;
                     symbolStripHTML += `<div class="symbol ${symbolClass}">${symbol}</div>`;
                 }


                reelElement.innerHTML = symbolStripHTML;
                // Reset transform to ensure strips are at the top initially
                 reelElement.style.transition = 'none';
                 reelElement.style.transform = 'translateY(0)';
                 // Force reflow to apply non-transitioned style
                 reelElement.offsetHeight;
            });
             console.log(`SlotMachineOverlay: Reels populated with ~${this.SYMBOLS_PER_REEL_STRIP + this.symbols.length} symbols each.`); // Use this.SYMBOLS_PER_REEL_STRIP and this.symbols.length
        }

        // Method to calculate target position for a symbol
        getTargetPosition(reelIndex, targetSymbol) {
             const reelElement = this.reelElements[reelIndex]; // Use this.reelElements
             const symbolsInStrip = reelElement.querySelectorAll('.symbol');
             let targetY = 0;
             let found = false;

             // Find *one* instance of the target symbol in the strip
             // It's better to land on an instance near the end for smoother stop animation
             // Iterate backwards from the end of the strip where the guaranteed symbols are
             const trimmedTargetSymbol = targetSymbol.trim(); // Trim target symbol
             for (let i = symbolsInStrip.length - 1; i >= 0; i--) {
                  if (symbolsInStrip[i].textContent.trim() === trimmedTargetSymbol) { // Ensure symbol string matches exactly & trim
                       // Calculate the transformY needed to bring the *top edge* of this symbol into view at the top of the reel window.
                       // The symbol is at index `i` in the strip. Its top is at `i * SYMBOL_HEIGHT`.
                       // We want the transform `translateY(Y)` such that `(i * SYMBOL_HEIGHT) + Y = 0`.
                       // So, `Y = -(i * SYMBOL_HEIGHT)`.
                       targetY = -(i * this.SYMBOL_HEIGHT); // Use this.SYMBOL_HEIGHT
                       found = true;
                       console.log(`Reel ${reelIndex + 1}: Target symbol '${trimmedTargetSymbol}' found at index ${i}. Target Y: ${targetY}px`);
                       break; // Use the last instance found
                   }
             }

            if (!found) {
                 console.warn(`Reel ${reelIndex + 1}: Target symbol '${trimmedTargetSymbol}' not found in strip! Defaulting to top (index 0). This shouldn't happen if symbols match.`);
                 // Fallback to top if symbol not found (indicates a mismatch between backend symbols and overlay symbols)
                 targetY = 0;
            }

            // Add extra rotations to make the spin visual longer
            // We need the animation to scroll down a sufficient distance
            const minSpins = 5; // Minimum number of full cycles the strip scrolls
            const stripHeight = symbolsInStrip.length * this.SYMBOL_HEIGHT; // Total height of the symbols strip // Use this.SYMBOL_HEIGHT

            // To reach the targetY (which is negative) from 0, while spinning downwards,
            // we need to scroll by (minSpins * stripHeight) + abs(targetY).
            // Since targetY is negative, abs(targetY) is just -targetY.
            // The total scroll distance needed is (minSpins * stripHeight) - targetY.
            // The final transformY value will be -(total scroll distance).
            const finalTargetY = -((minSpins * stripHeight) - targetY);

            console.log(`Reel ${reelIndex + 1}: Calculated final target Y (${minSpins} extra spins): ${finalTargetY}px`);


            return finalTargetY;
        }


        // Async method to animate the spin
        async spinToOutcome(outcomeArray) {
            if (this.isSpinning) { // Use this.isSpinning
                console.log("SlotMachineOverlay: Already spinning, ignoring trigger.");
                return;
            }
            // Ensure config is loaded and validate the outcome array structure and symbols before starting
            if (this.reelCount === 0 || this.symbols.length === 0 || !SlotMachineOverlay.isValidOutcome(outcomeArray, this.reelCount, this.symbols)) { // Use static helper with current config
                 console.error("SlotMachineOverlay: Invalid config or outcome array received, cannot spin.", {reelCount: this.reelCount, symbols: this.symbols, outcome: outcomeArray});
                 this.displayResult(false, "Spin Error!", "System"); // Display an error message
                 return;
            }

            this.isSpinning = true; // Use this.isSpinning
            console.log(`SlotMachineOverlay: Starting spin animation to outcome: ${outcomeArray.join(' | ')}`);

            this.clearResults(); // Hide previous results // Use this.clearResults

            const promises = [];
            this.reelElements.forEach((reelElement, index) => { // Use this.reelElements
                const targetSymbol = outcomeArray[index];
                const targetY = this.getTargetPosition(index, targetSymbol); // Use this.getTargetPosition

                // Add delay and duration variation per reel
                const delay = index * 150; // Stagger start
                // Make duration dependent on distance to spin to ensure constant speed feel
                const currentTransformY = parseFloat(reelElement.style.transform.replace('translateY(', '').replace('px)', '')) || 0;
                const distanceToSpin = Math.abs(targetY - currentTransformY);
                // Base speed (pixels per ms) based on SYMBOL_HEIGHT
                const baseSpeed = this.SYMBOL_HEIGHT / 100; // 1 symbol per 100ms (10 symbols/sec) // Use this.SYMBOL_HEIGHT
                const duration = Math.max(this.BASE_SPIN_DURATION, distanceToSpin / baseSpeed); // Ensure minimum duration // Use this.BASE_SPIN_DURATION

                // Set transition properties
                reelElement.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1.0)`; // Easing for smooth stop

                // Use a promise to wait for the transition to finish
                promises.push(new Promise(resolve => {
                    // Set timeout for the start delay
                    setTimeout(() => {
                        // Apply the transform to start the animation
                        reelElement.style.transform = `translateY(${targetY}px)`;

                        // Listen for the end of the transition on this element
                        const handleTransitionEnd = () => {
                             reelElement.removeEventListener('transitionend', handleTransitionEnd);
                            console.log(`Reel ${index + 1} animation finished.`);
                             resolve(); // Resolve the promise when animation ends
                        };
                         reelElement.addEventListener('transitionend', handleTransitionEnd);

                         // Fallback timeout in case transitionend doesn't fire (less reliable)
                         // Use the calculated duration + a buffer
                         setTimeout(() => {
                            console.warn(`Reel ${index + 1} animation timed out.`);
                            resolve(); // Resolve even if transitionend didn't fire
                         }, duration + 200); // A little longer than the duration
                    }, delay);
                }));
            });

            // Wait for all reel animations to complete
            await Promise.all(promises);

            console.log("SlotMachineOverlay: All reel animations finished.");
            this.isSpinning = false; // Use this.isSpinning

            // After animation, ensure the symbols are positioned correctly without transition
            this.reelElements.forEach(reelElement => { // Use this.reelElements
                 const currentTransform = reelElement.style.transform;
                 reelElement.style.transition = 'none';
                 reelElement.style.transform = currentTransform; // Apply the final transform non-transitioned
                 // Force reflow
                 reelElement.offsetHeight;
            });

            // Now the animation is done, display the result
             // The backend sends the isWin and prize with the slotResult event
             // The handleMessage method will call displayResult after spinToOutcome awaits
        }

        // Method to display the spin result
        displayResult(isWin, prize, user) {
            console.log(`SlotMachineOverlay: Displaying result for ${user}: Win=${isWin}, Prize='${prize}'`);
            this.resultDisplay.textContent = `Result: ${prize}`; // Use this.resultDisplay
             this.resultDisplay.classList.add('visible'); // Use this.resultDisplay

            if (isWin) {
                this.winDisplay.textContent = `WIN for ${user}!`; // Use this.winDisplay
                 this.winDisplay.classList.add('visible'); // Use this.winDisplay
            } else {
                 this.winDisplay.textContent = ''; // Clear win message // Use this.winDisplay
                 this.winDisplay.classList.remove('visible'); // Use this.winDisplay
            }

            // Optional: Hide results after a few seconds
            setTimeout(() => {
                 this.clearResults(); // Use this.clearResults
            }, 10000); // Hide results after 10 seconds
        }

        // Method to clear result displays (optionally with a message)
        clearResults(message = '') {
            this.resultDisplay.textContent = message; // Use this.resultDisplay
            if (message) {
                 this.resultDisplay.classList.add('visible');
            } else {
                 this.resultDisplay.classList.remove('visible');
            }
            this.winDisplay.textContent = ''; // Use this.winDisplay
            this.winDisplay.classList.remove('visible'); // Use this.winDisplay
        }


        // Public method to set up message listener
        setupMessageListener() {
             console.log("SlotMachineOverlay: Setting up message listener...");
             // Remove any existing listener first to prevent duplicates if called multiple times
             if (this.messageCallback) { // Use this.messageCallback
                 window.removeEventListener('message', this.messageCallback); // Use this.messageCallback
             }

             this.messageCallback = async (event) => { // Use this.messageCallback
                 // IMPORTANT: Check event.origin in production for security!
                 // For Chaturbate overlays, event.origin should be the parent window's origin.
                 // In this example, we'll skip the origin check for simplicity, but be aware.
                 // if (event.origin !== 'https://www.chaturbate.com' && event.origin !== 'https://chaturbate.com') {
                 //     console.warn("SlotMachineOverlay: Ignoring message from unknown origin:", event.origin);
                 //     return;
                 // }

                 if (event.data && event.data.type === 'overlayMessage') {
                     const message = event.data.payload;
                     console.log('SlotMachineOverlay: Received overlayMessage:', message);

                     // Handle the 'setConfig' event from the backend (App Loaded)
                     if (message.eventName === 'setConfig') {
                          console.log("SlotMachineOverlay: Received config from backend.");
                          // Update internal symbols and reel count
                          this.symbols = Array.isArray(message.payload.symbols) ? message.payload.symbols : [];
                          this.reelCount = typeof message.payload.reelCount === 'number' && message.payload.reelCount >= 2 ? message.payload.reelCount : 0;

                          if (this.reelCount > 0 && this.symbols.length > 0) {
                              console.log(`SlotMachineOverlay: Config set - Reels: ${this.reelCount}, Symbols: ${this.symbols.length}.`);
                              this.createReels(); // Create the DOM elements for reels
                              this.renderReelSymbols(); // Populate the reels
                              this.clearResults("Ready to spin!"); // Update status
                          } else {
                              console.error("SlotMachineOverlay: Invalid config received:", message.payload);
                              this.clearResults("Config Error!");
                          }

                     }
                     // Handle the 'slotResult' event from the backend (Tip Received)
                     else if (message.eventName === 'slotResult') { // Always process result message
                         if (this.isSpinning) { // Use this.isSpinning
                            console.log("SlotMachineOverlay: Received new slotResult but already spinning. Will process after current spin.");
                            // Could queue up spins here if needed, but simpler to just log and ignore
                             return; // Skip if already spinning to avoid visual issues
                         }
                         // Ensure config is loaded before attempting to spin
                         if (this.reelCount === 0 || this.symbols.length === 0) {
                             console.warn("SlotMachineOverlay: Received slotResult but config not loaded yet. Ignoring.");
                             return;
                         }
                         console.log(`SlotMachineOverlay: Received slotResult for ${message.user}. Spinning reels...`);
                         // Trigger the spin animation using the received outcome
                         await this.spinToOutcome(message.outcome); // Use this.spinToOutcome
                         // Display the result after the animation finishes
                         this.displayResult(message.isWin, message.prize, message.user); // Use this.displayResult

                     }
                     // Handle other potential messages here if needed later
                     // e.g., 'updateSymbols', 'resetOverlay' etc.
                 }
             };

             window.addEventListener('message', this.messageCallback); // Use this.messageCallback
             console.log("SlotMachineOverlay: Message listener added.");
        }

        // Public initialization method
        init() {
            console.log("SlotMachineOverlay: Initializing overlay...");
            // The constructor sets up displays and message listener.
            // Reel creation and symbol rendering happen AFTER config is received via setConfig event.
            // The App Loaded handler sends the initial config message.
            console.log("SlotMachineOverlay: Overlay ready. Awaiting config from backend...");
        }
    } // End of SlotMachineOverlay class definition


    // Assign static properties OUTSIDE the class definition (ES6 compatible way)
    // Note: SYMBOLS and REEL_COUNT here are just defaults/fallbacks if needed elsewhere,
    // but the instance uses the config values received via setConfig message.
    // Keep these consistent with the hardcoded values in App Loaded/Tip Received for safety.
    SlotMachineOverlay.SYMBOLS_DEFAULT = ["🍒", "🔔", " BAR ", " 7 ", "💎"]; // Default/Fallback
    SlotMachineOverlay.REEL_COUNT_DEFAULT = 3; // Default/Fallback

    // Static method needs access to a symbols array, pass it in or use default
    SlotMachineOverlay.getRandomSymbol = function(symbolsArray = SlotMachineOverlay.SYMBOLS_DEFAULT) { // Use default if none provided
         if (!symbolsArray || symbolsArray.length === 0) return '';
         return symbolsArray[Math.floor(Math.random() * symbolsArray.length)];
     };

    // Static method isValidOutcome needs access to defaults/fallbacks if instance hasn't loaded config
     SlotMachineOverlay.isValidOutcome = function(outcomeArray, reelCount, symbolsArray) {
         const actualReelCount = reelCount > 0 ? reelCount : SlotMachineOverlay.REEL_COUNT_DEFAULT;
         const actualSymbols = symbolsArray && symbolsArray.length > 0 ? symbolsArray : SlotMachineOverlay.SYMBOLS_DEFAULT;

         // Check if the outcome array has the correct number of reels and valid symbols
         if (!Array.isArray(outcomeArray) || outcomeArray.length !== actualReelCount) {
             console.error("Invalid outcome: incorrect length", outcomeArray, actualReelCount);
             return false;
         }
         for (const symbol of outcomeArray) {
             // Trim symbol from outcome just in case there's leading/trailing space
             if (!actualSymbols.includes(symbol.trim())) {
                  console.error("Invalid outcome: unknown symbol", symbol, actualSymbols);
                 return false;
             }
         }
         return true;
     };


    // Instantiate and initialize the overlay
    const slotOverlay = new SlotMachineOverlay();
    slotOverlay.init();

    // Example usage of static method (optional)
     console.log("SlotMachineOverlay: Random symbol example:", SlotMachineOverlay.getRandomSymbol());


})(); // End of async IIFE
