/**
 * @fileoverview Manages all UI interactions and DOM updates for the strategic golf game.
 */
class UIManager {
    #elements;
    #callbacks;
    #shotState;

    constructor() {
        this.#elements = {
            playerName: document.getElementById('player-name'),
            holeNumber: document.getElementById('hole-number'),
            parValue: document.getElementById('par-value'),
            strokeCount: document.getElementById('stroke-count'),
            distanceRemaining: document.getElementById('distance-remaining'),
            currentTerrain: document.getElementById('current-terrain'),
            dice1: document.getElementById('dice1'),
            dice2: document.getElementById('dice2'),
            resetButton: document.getElementById('reset-button'),
            scoreboardTable: document.querySelector('#scoreboard table'),
            clubSelector: document.getElementById('club-selector'),
            shotMechanic: document.getElementById('shot-mechanic'),
            shotSliderBar: document.getElementById('shot-slider-bar'),
        };
        this.#callbacks = {
            onShot: null,
            onReset: null,
            onClubSelected: null,
        };
        this.#shotState = {
            isCharging: false,
            sliderValue: 0,
            animationFrameId: null,
        };

        this.#addEventListeners();
    }

    /**
     * Adds all necessary event listeners for UI interaction.
     * @private
     */
    #addEventListeners() {
        this.#elements.resetButton.addEventListener('click', () => this.#callbacks.onReset?.());

        this.#elements.clubSelector.addEventListener('click', (e) => {
            if (e.target.classList.contains('club-btn')) {
                this.#callbacks.onClubSelected?.(e.target.dataset.club);
            }
        });

        // Shot mechanic listeners
        const shotArea = this.#elements.shotMechanic;
        shotArea.addEventListener('mousedown', this.#startShot.bind(this));
        shotArea.addEventListener('touchstart', (e) => { e.preventDefault(); this.#startShot(); });

        // Listen on the document for robust UX (user can release mouse anywhere)
        document.addEventListener('mouseup', this.#endShot.bind(this));
        document.addEventListener('touchend', this.#endShot.bind(this));

        // Also listen on the element itself for better compatibility with some test runners
        shotArea.addEventListener('mouseup', this.#endShot.bind(this));
        shotArea.addEventListener('touchend', this.#endShot.bind(this));
    }

    /**
     * Registers callbacks for UI events.
     * @param {string} eventName The name of the event ('onShot', 'onReset', 'onClubSelected').
     * @param {Function} callback The function to call.
     */
    on(eventName, callback) {
        if (eventName in this.#callbacks) {
            this.#callbacks[eventName] = callback;
        }
    }

    /**
     * Starts the shot charging mechanic.
     * @private
     */
    #startShot() {
        if (this.#shotState.isCharging) return;
        this.#shotState.isCharging = true;
        this.#shotState.animationFrameId = requestAnimationFrame(this.#updateSlider.bind(this));
    }

    /**
     * The animation loop for the oscillating shot slider.
     * @param {number} timestamp The current time.
     * @private
     */
    #updateSlider(timestamp) {
        // Oscillate between 0 and 100 over ~2 seconds
        const period = 2000;
        const phase = (timestamp % period) / period;
        this.#shotState.sliderValue = Math.round(Math.abs(Math.sin(phase * 2 * Math.PI)) * 100);
        this.#elements.shotSliderBar.style.width = `${this.#shotState.sliderValue}%`;

        if (this.#shotState.isCharging) {
            this.#shotState.animationFrameId = requestAnimationFrame(this.#updateSlider.bind(this));
        }
    }

    /**
     * Ends the shot charging and triggers the onShot callback.
     * @private
     */
    #endShot() {
        if (!this.#shotState.isCharging) return;
        this.#shotState.isCharging = false;
        cancelAnimationFrame(this.#shotState.animationFrameId);
        this.#callbacks.onShot?.(this.#shotState.sliderValue);
    }

    /**
     * Updates the player and hole information display.
     * @param {Object} state The current game state.
     */
    updateInfo(state) {
        this.#elements.playerName.textContent = state.playerName;
        this.#elements.holeNumber.textContent = state.holeNumber;
        this.#elements.parValue.textContent = state.par;
        this.#elements.strokeCount.textContent = state.strokes;
        this.#elements.distanceRemaining.textContent = state.distance;
        this.#elements.currentTerrain.textContent = state.terrain;
        this.#elements.currentTerrain.className = `w3-tag w3-round terrain-${state.terrain}`;
    }

    /**
     * Highlights the currently selected club.
     * @param {string} clubName The name of the club to select.
     */
    selectClub(clubName) {
        this.#elements.clubSelector.querySelectorAll('.club-btn').forEach(btn => {
            btn.classList.remove('w3-theme');
            if (btn.dataset.club === clubName) {
                btn.classList.add('w3-theme');
            }
        });
    }

    /**
     * Generates the scoreboard headers based on the hole data.
     * @param {Array<Object>} holes The course hole data.
     */
    createScoreboard(holes) {
        const headerRow = this.#elements.scoreboardTable.querySelector('thead tr');
        headerRow.innerHTML = '<th>Hole</th>'; // Clear existing
        holes.forEach(hole => {
            const th = document.createElement('th');
            th.textContent = hole.hole;
            headerRow.appendChild(th);
        });
    }

    /**
     * Renders the player's scores on the scoreboard.
     * @param {Player} player The player whose scores to render.
     */
    updateScoreboard(player) {
        const scoreRow = this.#elements.scoreboardTable.querySelector('tbody tr');
        scoreRow.innerHTML = '<td>Score</td>'; // Clear existing
        player.scores.forEach(score => {
            const td = document.createElement('td');
            td.textContent = score || '-';
            scoreRow.appendChild(td);
        });
    }

    /**
     * Renders an SVG dice with a specific value.
     * @param {SVGElement} svgElement The SVG element to render into.
     * @param {number} value The dice value (1-6).
     */
    #renderDice(svgElement, value) {
        const dotPositions = {
            1: [[50, 50]],
            2: [[30, 30], [70, 70]],
            3: [[30, 30], [50, 50], [70, 70]],
            4: [[30, 30], [30, 70], [70, 30], [70, 70]],
            5: [[30, 30], [30, 70], [50, 50], [70, 30], [70, 70]],
            6: [[30, 30], [30, 50], [30, 70], [70, 30], [70, 50], [70, 70]],
        };

        svgElement.innerHTML = `<rect x="0" y="0" width="100" height="100" rx="10" fill="#fff" stroke="#000" stroke-width="2"/>`;
        dotPositions[value].forEach(([cx, cy]) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', 8);
            circle.setAttribute('fill', '#000');
            svgElement.appendChild(circle);
        });
    }

    /**
     * Animates and displays the dice roll.
     * @param {number} value1 The value of the first die.
     * @param {number} value2 The value of the second die.
     */
    animateDice(value1, value2) {
        const dice1El = this.#elements.dice1;
        const dice2El = this.#elements.dice2;

        dice1El.classList.add('dice-rolling');
        dice2El.classList.add('dice-rolling');

        // Let the CSS animation run
        setTimeout(() => {
            dice1El.classList.remove('dice-rolling');
            dice2El.classList.remove('dice-rolling');

            this.#renderDice(dice1El, value1);
            this.#renderDice(dice2El, value2);
        }, 500); // Match the CSS animation duration
    }
}