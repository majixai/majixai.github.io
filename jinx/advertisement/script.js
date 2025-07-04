// Jinx AI Advertisement Script

/**
 * @file script.js
 * @description Main JavaScript file for the Jinx AI Advertisement page.
 * Handles SVG animations, interactive examples, and user interaction logic.
 * Follows an OOP approach with classes for different features.
 * Leading underscores (_) denote internal methods/properties not intended for public use outside the class.
 */

// --- Google Analytics Event Tracking Helper ---
/**
 * Sends a custom event to Google Analytics.
 * Checks if gtag function is available before attempting to send.
 * @param {string} action - The type of interaction (e.g., 'click', 'submit').
 * @param {string} category - A category for the event (e.g., 'Button', 'Navigation').
 * @param {string} label - A label for the event (e.g., 'Calculate Projection', 'Contact Form').
 * @param {number} [value] - An optional numeric value for the event.
 */
function trackGAEvent(action, category, label, value) {
  if (typeof gtag === 'function') {
    gtag('event', action, {
      'event_category': category,
      'event_label': label,
      'value': value
      // 'send_to': 'GA_MEASUREMENT_ID' // Optional: if using multiple GA properties with specific routing
    });
    // For debugging: console.log(`GA Event Sent: Action: ${action}, Category: ${category}, Label: ${label}${value !== undefined ? ', Value: ' + value : ''}`);
  } else {
    console.warn(`Google Analytics gtag function not defined. GA Event not tracked: Action: ${action}, Category: ${category}, Label: ${label}${value !== undefined ? ', Value: ' + value : ''}`);
  }
}

// --- Decorator Functions ---
/**
 * A simple method decorator that logs when a method is called and its arguments.
 * This is a functional approach to decorators.
 * @param {Function} originalMethod - The original method to be decorated.
 * @param {string} methodName - The name of the method (for logging purposes).
 * @param {Object} contextObject - The object instance (`this`) the method belongs to.
 * @returns {Function} - The decorated method.
 */
function logMethodCall(originalMethod, methodName, contextObject) {
    return function(...args) {
        console.log(`LOG: Calling method "${methodName}" on ${contextObject.constructor.name} with arguments:`, args);
        // Example GA event: trackGAEvent('call', 'MethodExecution', `${contextObject.constructor.name}.${methodName}`);

        const result = originalMethod.apply(contextObject, args); // Ensure correct 'this'
        console.log(`LOG: Method "${methodName}" finished execution.`);
        return result;
    };
}

// --- Generator Functions ---
/**
 * A generator function that yields a series of investment tips.
 * Loops indefinitely.
 */
function* investmentTipGenerator() {
    const tips = [
        "Tip: Diversify your portfolio to manage risk.",
        "Tip: Invest for the long term; avoid emotional decisions.",
        "Tip: Understand your risk tolerance before investing.",
        "Tip: Regularly review and rebalance your investments.",
        "Tip: Start early and leverage the power of compounding.",
        "Tip: Research thoroughly or trust experts like Jinx AI!"
    ];
    let currentIndex = 0;
    while (true) {
        yield tips[currentIndex];
        currentIndex = (currentIndex + 1) % tips.length;
    }
}


/**
 * Animates the static SVG logo text elements ("Jinx" and "AI").
 * Implements a sequential fade-in effect.
 */
class LogoAnimator {
    constructor() {
        this._jinxText = document.getElementById('logo-text-jinx');
        this._aiText = document.getElementById('logo-text-ai');
        this._animationStartTime = null;
        this._jinxFadeInDuration = 1000; // 1 second for Jinx to fade in
        this._aiFadeInDelay = 500;     // 0.5 second delay after Jinx starts fading in
        this._aiFadeInDuration = 1000;   // 1 second for AI to fade in

        if (!this._jinxText || !this._aiText) {
            console.warn("LogoAnimator: 'Jinx' or 'AI' text elements not found in SVG. Animation disabled.");
            this._isAvailable = false;
        } else {
            this._isAvailable = true;
            // Ensure elements are initially hidden if not set by inline style (belt and suspenders)
            this._jinxText.style.opacity = '0';
            this._aiText.style.opacity = '0';
        }
    }

    /**
     * Starts the fade-in animation sequence for the logo.
     */
    init() {
        if (!this._isAvailable) return;
        
        this._animationStartTime = performance.now();
        requestAnimationFrame((timestamp) => this._animateFadeIn(timestamp));
        console.log("LogoAnimator initialized and animation started.");
    }

    /**
     * Animation loop using requestAnimationFrame.
     * @param {number} timestamp - The current time provided by requestAnimationFrame.
     * @private
     */
    _animateFadeIn(timestamp) {
        const elapsedTime = timestamp - this._animationStartTime;
        let jinxOpacity = 0;
        let aiOpacity = 0;

        // Animate Jinx text
        if (elapsedTime < this._jinxFadeInDuration) {
            jinxOpacity = elapsedTime / this._jinxFadeInDuration;
        } else {
            jinxOpacity = 1;
        }
        this._jinxText.style.opacity = jinxOpacity.toString();

        // Animate AI text (starts after a delay)
        const aiStartTime = this._aiFadeInDelay;
        if (elapsedTime > aiStartTime) {
            const aiElapsedTime = elapsedTime - aiStartTime;
            if (aiElapsedTime < this._aiFadeInDuration) {
                aiOpacity = aiElapsedTime / this._aiFadeInDuration;
            } else {
                aiOpacity = 1;
            }
            this._aiText.style.opacity = aiOpacity.toString();
        }
        
        // Continue animation if not both fully opaque
        if (jinxOpacity < 1 || aiOpacity < 1) {
            requestAnimationFrame((ts) => this._animateFadeIn(ts));
        } else {
            console.log("Logo animation complete.");
            // Optional: Add a subtle pulse or other effect here after fade-in
        }
    }
}


/**
 * Manages the creation and animation of SVG elements.
 * Specifically used here for a simple logo/branding animation.
 * THIS CLASS IS CURRENTLY DISABLED (replaced by LogoAnimator for the static SVG logo).
 */
class SVGAnimator {
    /**
     * @param {string} containerId - The ID of the HTML element to contain the SVG.
     */
    constructor(containerId) {
        this._container = document.getElementById(containerId);
        this._svgNS = "http://www.w3.org/2000/svg";
        this._animationFrameId = null;
        this._bars = [];
        this._startTime = null;
        this._animationDuration = 2000; // 2 seconds for the animation loop

        if (!this._container) {
            console.error(`SVGAnimator: Container not found for ID: ${containerId}`);
            // No return here, allow object creation, but init will fail gracefully.
        }
        console.log(`SVGAnimator initialized for container: ${containerId}`);
    }

    /**
     * Initializes the SVG and creates the bar elements for animation.
     * This is the public method to start the animator's operations.
     */
    init() {
        if (!this._container) {
            console.warn("SVGAnimator: Initialization aborted, container not found.");
            return;
        }
        this._container.innerHTML = ''; // Clear any placeholder content like text or old SVGs.

        const svg = this._createSVGElement();
        this._container.appendChild(svg);
        this._svg = svg; // Store reference to the SVG element

        this._createBars();
        this.startAnimation(); // Automatically start animation after setup.
    }

    /**
     * Creates the main SVG DOM element.
     * @private Internal helper method.
     * @returns {SVGElement} The created SVG element.
     */
    _createSVGElement() {
        const svg = document.createElementNS(this._svgNS, "svg");
        svg.setAttribute("width", "100"); // Intrinsic width for the SVG
        svg.setAttribute("height", "70"); // Intrinsic height for the SVG
        svg.setAttribute("viewBox", "0 0 100 70"); // Coordinate system for drawing
        return svg;
    }

    /**
     * Creates the individual bar <rect> elements for the animation.
     * @private Internal helper method.
     */
    _createBars() {
        const barWidth = 20;
        const spacing = 10;
        const maxHeights = [60, 40, 50]; // Target heights for bars, defining the animation goals
        const colors = ["#FFD700", "#00A8E8", "#007EA7"]; // Styling for the bars

        for (let i = 0; i < 3; i++) {
            const rect = document.createElementNS(this._svgNS, "rect");
            const x = (barWidth + spacing) * i + spacing; // Position bars with spacing
            rect.setAttribute("x", x.toString());
            rect.setAttribute("y", "65"); // Start from bottom (y=70 is max, height grows upwards)
            rect.setAttribute("width", barWidth.toString());
            rect.setAttribute("height", "5"); // Initial small height before animation
            rect.setAttribute("fill", colors[i]);
            rect.setAttribute("rx", "3"); // Rounded corners for aesthetics
            rect.setAttribute("ry", "3");
            this._svg.appendChild(rect);
            // Store bar elements and their animation properties
            this._bars.push({ element: rect, targetHeight: maxHeights[i], initialY: 65, initialHeight: 5 });
        }
    }

    /**
     * The core animation loop, called recursively via requestAnimationFrame.
     * @param {number} timestamp - The current timestamp provided by requestAnimationFrame.
     * @private Internal method.
     */
    _animateBars(timestamp) {
        if (!this._startTime) {
            this._startTime = timestamp; // Initialize startTime on the first frame
        }
        const elapsedTime = timestamp - this._startTime;
        // Calculate progress as a factor from 0 to 1
        const progress = Math.min(elapsedTime / this._animationDuration, 1);

        this._bars.forEach(bar => {
            // Using an ease-out quadratic function for smoother animation: progress * (2 - progress)
            const easeOutProgress = progress * (2 - progress);
            const currentHeight = bar.initialHeight + (bar.targetHeight - bar.initialHeight) * easeOutProgress;
            const currentY = bar.initialY - (currentHeight - bar.initialHeight); // Adjust Y as height grows from bottom

            bar.element.setAttribute("height", currentHeight.toString());
            bar.element.setAttribute("y", currentY.toString());
        });

        if (progress < 1) {
            // Continue animation if not complete
            this._animationFrameId = requestAnimationFrame((ts) => this._animateBars(ts));
        } else {
            // Loop the animation by resetting start time and requesting another frame
            this._startTime = null;
            this._animationFrameId = requestAnimationFrame((ts) => this._animateBars(ts));
        }
    }

    /**
     * Starts the SVG animation.
     * Public method, can be called to (re)start animation if needed.
     */
    startAnimation() {
        if (this._animationFrameId) { // Clear any existing animation frame
            cancelAnimationFrame(this._animationFrameId);
        }
        this._startTime = null; // Reset start time for a fresh animation sequence
        this._animationFrameId = requestAnimationFrame((ts) => this._animateBars(ts));
        console.log("SVG animation started.");
    }

    /**
     * Stops the SVG animation.
     * Public method.
     */
    stopAnimation() {
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
            console.log("SVG animation stopped.");
        }
    }
}

/**
 * Manages the interactive autoinvesting projection demo.
 * Responsibilities:
 * - Accessing DOM elements for the demo.
 * - Setting up event listeners for user interaction (e.g., button clicks).
 * - Performing a simplified investment projection calculation.
 * - Displaying the calculated results to the user.
 * - Basic input validation.
 */
class AutoinvestExamples {
    /**
     * @param {string} sectionId - The ID of the HTML section containing the demo elements.
     *        While sectionId is passed, the class primarily uses specific element IDs.
     */
    constructor(sectionId) {
        // Direct references to interactive elements are crucial
        this._investmentInput = document.getElementById('investmentAmount');
        this._calculateButton = document.getElementById('calculateProjection');
        this._resultDisplay = document.getElementById('projectionResult');
        // The main section element, for context or future use
        this._section = document.getElementById(sectionId);


        if (!this._investmentInput || !this._calculateButton || !this._resultDisplay) {
            console.error("AutoinvestExamples: Critical HTML elements for the demo are missing. Ensure IDs 'investmentAmount', 'calculateProjection', and 'projectionResult' exist and are correct.");
            // Abort initialization if critical elements are missing
            this._isAvailable = false; // Mark as not available
            return;
        }
        this._isAvailable = true;

        if (!this._section){
             console.warn(`AutoinvestExamples: The main section container with ID '${sectionId}' was not found, but core demo elements are present and functional.`);
        }

        // Apply the decorator to calculateProjection
        // Ensure 'this' context is correctly bound for the original method when called through the decorator
        this.calculateProjection = logMethodCall(this.calculateProjection.bind(this), 'calculateProjection', this);

        console.log(`AutoinvestExamples initialized. Ready for user interaction on section: ${sectionId}`);
        this._setupEventListeners();
    }

    /**
     * Sets up the event listener for the 'Calculate Projection' button.
     * @private Internal method, called during construction.
     */
    _setupEventListeners() {
        // Ensure button exists before adding listener
        if (this._calculateButton) {
            this._calculateButton.addEventListener('click', () => {
                const amount = parseFloat(this._investmentInput.value) || 0;
                trackGAEvent('click', 'Button', 'Calculate Projection', amount);
                this._handleProjectionCalculation();
            });
        }
    }

    /**
     * Calculates a hypothetical investment projection based on input parameters.
     * This is a simplified model for demonstration purposes.
     * @param {number} initialAmount - The initial investment amount.
     * @param {number} [annualRate=0.08] - The simulated annual growth rate (default is 8%).
     * @param {number} [years=1] - The number of years for the projection (default is 1 year).
     * @returns {number} The projected future value of the investment.
     * Public for testing purposes, though primarily used internally by _handleProjectionCalculation.
     */
    calculateProjection(initialAmount, annualRate = 0.08, years = 1) {
        const monthlyRate = annualRate / 12; // Convert annual rate to monthly
        const months = years * 12; // Total number of compounding periods
        let futureValue = initialAmount;

        for (let i = 0; i < months; i++) {
            futureValue *= (1 + monthlyRate); // Apply compound interest formula
        }
        return futureValue;
    }

    /**
     * Handles the click event from the 'Calculate Projection' button.
     * It retrieves user input, validates it, triggers the calculation,
     * and updates the DOM to display the results.
     * @private Internal method.
     */
    _handleProjectionCalculation() {
        const amountText = this._investmentInput.value;
        const initialAmount = parseFloat(amountText);

        // Validate the input
        if (isNaN(initialAmount) || initialAmount <= 0) {
            this._resultDisplay.innerHTML = '<p class="w3-text-red">Please enter a valid positive number for the investment amount.</p>';
            this._resultDisplay.style.display = 'block';
            return;
        }

        // Perform calculation using the public method
        const projectedValue = this.calculateProjection(initialAmount); // Using default rate and years
        const profit = projectedValue - initialAmount;

        // Display the results
        this._resultDisplay.innerHTML = `
            <h4>Projection Results:</h4>
            <p>Initial Investment: $${initialAmount.toFixed(2)}</p>
            <p>Projected Value after 1 Year (at ~8% annual rate, compounded monthly): $${projectedValue.toFixed(2)}</p>
            <p>Projected Profit: $${profit.toFixed(2)}</p>
            <p class="w3-small w3-text-grey">Disclaimer: This is a simplified, hypothetical projection for illustrative purposes only. Actual investment returns can vary significantly and are not guaranteed.</p>
        `;
        this._resultDisplay.style.display = 'block'; // Make results visible
    }

    /**
     * Public method intended for loading or refreshing example data.
     * In the current implementation, the main interactive demo is initialized
     * in the constructor. This method can be expanded for other dynamic examples.
     */
    loadExamples() {
        console.log("AutoinvestExamples: 'loadExamples' called. The primary interactive demo is set up at construction. This method is available for additional example loading if needed.");
        // This is a good place for logic that might fetch data for other, non-interactive examples, or update existing ones.
    }
}

/**
 * Manages user interaction features such as forms or potential chat interfaces.
 * Currently serves as a placeholder for future development, with basic initialization logic.
 */
class UserInteraction {
    /**
     * @param {string} formContainerId - The ID of the HTML element that will host interaction components (e.g., a contact form).
     */
    /**
     * @param {string} formContainerId - The ID of the HTML section that contains the contact form.
     */
    constructor(formContainerId) { // Though formContainerId is passed, we'll use specific IDs for form elements
        this._form = document.getElementById('contactForm');
        this._nameInput = document.getElementById('contact-name');
        this._emailInput = document.getElementById('contact-email');
        this._messageInput = document.getElementById('contact-message');
        this._submitButton = document.getElementById('contact-submit');
        this._feedbackDiv = document.getElementById('contact-feedback');

        if (!this._form || !this._nameInput || !this._emailInput || !this._messageInput || !this._submitButton || !this._feedbackDiv) {
            console.warn("UserInteraction: One or more contact form elements (form, name, email, message, submit, feedback) not found. Form functionality will be disabled.");
            this._isFormAvailable = false;
        } else {
            this._isFormAvailable = true;
            console.log("UserInteraction initialized: Contact form elements found.");
        }
    }

    /**
     * Initializes the contact form event listeners.
     * Public method to be called by the App class. Renamed from initForm to initContactForm for clarity.
     */
    initContactForm() {
        if (!this._isFormAvailable) {
            console.log("UserInteraction: Contact form setup skipped as elements are not available.");
            return;
        }
        
        this._form.addEventListener('submit', (event) => this._handleSubmission(event));
        console.log("UserInteraction: Contact form event listener attached.");
    }
    
    /**
     * Validates the contact form data.
     * @param {string} name - The name entered by the user.
     * @param {string} email - The email entered by the user.
     * @param {string} message - The message entered by the user.
     * @returns {string|null} An error message string if validation fails, null otherwise.
     * @private
     */
    _validateForm(name, email, message) {
        if (!name.trim()) {
            return "Name is required.";
        }
        if (!email.trim()) {
            return "Email is required.";
        }
        // Basic email format check (contains '@' and '.')
        if (!email.includes('@') || !email.includes('.')) {
            return "Please enter a valid email address.";
        }
        if (!message.trim()) {
            return "Message is required.";
        }
        return null; // No validation errors
    }

    /**
     * Handles the contact form submission.
     * Performs validation and simulates data submission.
     * @param {Event} event - The form submission event.
     * @private
     */
    async _handleSubmission(event) { // Added async
        event.preventDefault();

        this._submitButton.disabled = true; // Disable button during submission
        this._feedbackDiv.textContent = "Submitting...";
        this._feedbackDiv.className = 'w3-panel w3-margin-top w3-pale-blue w3-border w3-border-blue'; // Submitting style
        this._feedbackDiv.style.display = 'block';

        const name = this._nameInput.value;
        const email = this._emailInput.value;
        const message = this._messageInput.value;

        const validationError = this._validateForm(name, email, message);

        if (validationError) {
            this._feedbackDiv.textContent = validationError;
            this._feedbackDiv.className = 'w3-panel w3-margin-top w3-pale-red w3-border w3-border-red'; // Error styling
            // No need to set display to block as it's already visible or will be set in finally
            this._submitButton.disabled = false; // Re-enable button
            return; // Return early, finally will still execute if this was in try block.
        }

        try {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay

            // Simulate submission success
            console.log("Contact Form Submitted (Simulated Async):");
            console.log("Name:", name);
            console.log("Email:", email);
            console.log("Message:", message);

            trackGAEvent('submit', 'Form', 'Contact Form Submitted Async');

            this._feedbackDiv.textContent = "Thank you for your message! We'll get back to you soon.";
            this._feedbackDiv.className = 'w3-panel w3-margin-top w3-pale-green w3-border w3-border-green'; // Success styling
            this._form.reset();
        } catch (error) {
            // Simulate submission failure (though our current simulation doesn't throw)
            console.error("Simulated submission error:", error);
            this._feedbackDiv.textContent = "Submission failed. Please try again later.";
            this._feedbackDiv.className = 'w3-panel w3-margin-top w3-pale-red w3-border w3-border-red'; // Error styling
        } finally {
            this._feedbackDiv.style.display = 'block'; // Ensure feedback is visible
            this._submitButton.disabled = false; // Re-enable button
        }
    }
}

/**
 * Main application class (Orchestrator/Coordinator).
 * Responsibilities:
 * - Instantiating all major components/modules of the page.
 * - Coordinating the initialization of these components.
 */
class App {
    /**
     * App constructor. It creates instances of all the main feature classes.
     */
    constructor() {
        // Instantiate all primary modules/components, passing necessary configuration (e.g., container IDs)
        this._logoAnimator = new LogoAnimator(); // New animator for the static SVG text logo
        // this._svgAnimator = new SVGAnimator('logo-animation-container'); // SVGAnimator is disabled as a new static SVG logo is used.
        this._autoinvestExamples = new AutoinvestExamples('examples');
        this._userInteraction = new UserInteraction('contact'); // For contact forms or other interactions
        
        // For GA event tracking on navigation and logo
        this._logoContainer = document.getElementById('logo-container');
        this._navLinks = document.querySelectorAll('nav.w3-bar a.w3-bar-item');

        // For Investment Tip Generator
        this._tipGenerator = investmentTipGenerator();
        this._tipDisplayElement = document.getElementById('investmentTipDisplay');

        console.log("Jinx AI App: All components/modules have been instantiated.");
    }

    /**
     * Sets up global event listeners managed by the App class.
     * This includes navigation link clicks and logo clicks for GA tracking.
     * @private
     */
    _setupGlobalEventListeners() {
        // Navigation link clicks
        this._navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                const linkText = event.target.textContent.trim() || 'Unknown Link';
                const linkHref = event.target.getAttribute('href') || 'Unknown Href';
                trackGAEvent('click', 'Navigation', `Navbar Link: ${linkText} (${linkHref})`);
            });
        });

        // SVG Logo click
        if (this._logoContainer) {
            this._logoContainer.addEventListener('click', () => {
                trackGAEvent('click', 'Logo', 'Header SVG Logo Click');
            });
        } else {
            console.warn("App: Logo container not found for GA event tracking.");
        }
    }

    /**
     * Updates the investment tip display with the next tip from the generator.
     * @private
     */
    _updateInvestmentTip() {
        if (!this._tipDisplayElement || !this._tipGenerator) return;

        const nextTipResult = this._tipGenerator.next();
        if (!nextTipResult.done && nextTipResult.value) {
            this._tipDisplayElement.innerHTML = `<p><em>${nextTipResult.value}</em></p>`;
            // Example: trackGAEvent('view', 'DynamicContent', 'InvestmentTipDisplayed', nextTipResult.value);
            // Be careful about PII or very long strings if sending value to GA.
            trackGAEvent('view', 'DynamicContent', 'InvestmentTipDisplayed');
        }
    }

    /**
     * Initializes all parts of the application by calling their respective public init methods.
     * This method should be called once the DOM is fully loaded and ready.
     */
    init() {
        this._setupGlobalEventListeners(); // Setup app-level event listeners for GA tracking etc.

        // Call init methods on each component that requires explicit initialization
        // Check if the instance and its init method exist before calling
        // if (this._svgAnimator && typeof this._svgAnimator.init === 'function') {
        //     this._svgAnimator.init();
        // } else {
        //     console.warn("App: SVGAnimator (bar chart) is disabled or not available.");
        // }

        if (this._logoAnimator && typeof this._logoAnimator.init === 'function') {
            this._logoAnimator.init();
        } else {
            console.warn("App: LogoAnimator not available or 'init' method missing.");
        }

        if (this._autoinvestExamples && typeof this._autoinvestExamples.loadExamples === 'function') {
            // Note: The interactive demo in AutoinvestExamples sets up its own event listeners in its constructor.
            // The loadExamples() method is available for other types of examples or data loading.
            this._autoinvestExamples.loadExamples();
        } else {
            console.error("App: AutoinvestExamples not available or 'loadExamples' method missing.");
        }

        if (this._userInteraction && typeof this._userInteraction.initContactForm === 'function') {
            this._userInteraction.initContactForm();
        } else {
            console.error("App: UserInteraction not available or 'initContactForm' method missing.");
        }

        // Initialize and start investment tip display
        if (this._tipDisplayElement && this._tipGenerator) {
            this._updateInvestmentTip(); // Display the first tip immediately
            setInterval(() => this._updateInvestmentTip(), 7000); // Cycle tips every 7 seconds
            console.log("App: Investment tip generator initialized and interval set.");
        } else {
            console.warn("App: Investment tip display element or generator not found. Tip feature disabled.");
        }
        
        console.log("Jinx AI Advertisement application initialized successfully.");
    }
}

// Entry point: Initialize the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    const app = new App(); // Create the main application object
    app.init(); // Initialize all its components
});
