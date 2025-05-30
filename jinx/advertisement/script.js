// Jinx AI Advertisement Script

/**
 * @file script.js
 * @description Main JavaScript file for the Jinx AI Advertisement page.
 * Handles SVG animations, interactive examples, and user interaction logic.
 * Follows an OOP approach with classes for different features.
 * Leading underscores (_) denote internal methods/properties not intended for public use outside the class.
 */

/**
 * Manages the creation and animation of SVG elements.
 * Specifically used here for a simple logo/branding animation.
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
            return;
        }
        if (!this._section){
             console.warn(`AutoinvestExamples: The main section container with ID '${sectionId}' was not found, but core demo elements are present and functional.`);
        }

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
            this._calculateButton.addEventListener('click', () => this._handleProjectionCalculation());
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
    constructor(formContainerId) {
        this._formContainer = document.getElementById(formContainerId);
        if (!this._formContainer) {
            console.warn(`UserInteraction: Container with ID '${formContainerId}' not found. UI elements for this module will not be initialized.`);
        }
        console.log(`UserInteraction initialized for container (if found): ${formContainerId}`);
    }

    /**
     * Initializes the form or other interaction elements within the container.
     * Public method to be called by the main App class.
     */
    initForm() {
        if (this._formContainer) {
            // Example of what could be done:
            // this._formContainer.innerHTML = '<h3>Contact Us</h3><form id="contactForm"><input type="email" placeholder="Enter your email"><button type="submit">Subscribe</button></form>';
            // this._setupFormListener();
            console.log("UserInteraction: 'initForm' called. Container is available. No specific form is implemented in this version.");
        } else {
            console.log("UserInteraction: 'initForm' called, but no container element is set. No form will be displayed.");
        }
    }

    /**
     * Example of setting up a form listener.
     * @private
     */
    _setupFormListener() {
        const form = this._formContainer.querySelector('#contactForm'); // Assuming a form with this ID is added in initForm
        if (form) {
            form.addEventListener('submit', (event) => this._handleSubmission(event));
        }
    }

    /**
     * Handles form submissions or other user interactions.
     * Placeholder for actual submission logic (e.g., AJAX request).
     * @param {Event} [event] - Optional event object, typically from a form submission.
     * @private Internal method, called by event listeners.
     */
    _handleSubmission(event) {
        if (event) {
            event.preventDefault(); // Prevent default form submission behavior
        }
        console.log("UserInteraction: '_handleSubmission' called. Form submission logic would go here.");
        // Example: const email = this._formContainer.querySelector('input[type="email"]').value; console.log("Email for submission:", email);
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
        this._svgAnimator = new SVGAnimator('logo-animation-container');
        this._autoinvestExamples = new AutoinvestExamples('examples');
        this._userInteraction = new UserInteraction('contact'); // For contact forms or other interactions

        console.log("Jinx AI App: All components/modules have been instantiated.");
    }

    /**
     * Initializes all parts of the application by calling their respective public init methods.
     * This method should be called once the DOM is fully loaded and ready.
     */
    init() {
        // Call init methods on each component that requires explicit initialization
        // Check if the instance and its init method exist before calling
        if (this._svgAnimator && typeof this._svgAnimator.init === 'function') {
            this._svgAnimator.init();
        } else {
            console.error("App: SVGAnimator not available or 'init' method missing.");
        }

        if (this._autoinvestExamples && typeof this._autoinvestExamples.loadExamples === 'function') {
            // Note: The interactive demo in AutoinvestExamples sets up its own event listeners in its constructor.
            // The loadExamples() method is available for other types of examples or data loading.
            this._autoinvestExamples.loadExamples();
        } else {
            console.error("App: AutoinvestExamples not available or 'loadExamples' method missing.");
        }

        if (this._userInteraction && typeof this._userInteraction.initForm === 'function') {
            this._userInteraction.initForm();
        } else {
            console.error("App: UserInteraction not available or 'initForm' method missing.");
        }
        
        console.log("Jinx AI Advertisement application initialized successfully.");
    }
}

// Entry point: Initialize the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    const app = new App(); // Create the main application object
    app.init(); // Initialize all its components
});
