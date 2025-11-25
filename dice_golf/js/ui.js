/**
 * @fileoverview Manages all UI interactions and DOM updates.
 */
class UIManager {
    #elements;
    #callbacks;

    constructor() {
        this.#elements = {
            playerName: document.getElementById('player-name'),
            holeNumber: document.getElementById('hole-number'),
            parValue: document.getElementById('par-value'),
            strokeCount: document.getElementById('stroke-count'),
            distanceRemaining: document.getElementById('distance-remaining'),
            dice1: document.getElementById('dice1'),
            dice2: document.getElementById('dice2'),
            rollButton: document.getElementById('roll-button'),
            resetButton: document.getElementById('reset-button'),
            scoreboardTable: document.querySelector('#scoreboard table'),
        };
        this.#callbacks = {
            onRoll: null,
            onReset: null,
        };

        this.#elements.rollButton.addEventListener('click', () => this.#callbacks.onRoll?.());
        this.#elements.resetButton.addEventListener('click', () => this.#callbacks.onReset?.());
    }

    /**
     * Registers callbacks for UI events.
     * @param {string} eventName The name of the event ('onRoll', 'onReset').
     * @param {Function} callback The function to call.
     */
    on(eventName, callback) {
        if (eventName in this.#callbacks) {
            this.#callbacks[eventName] = callback;
        }
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
        this.#elements.rollButton.disabled = true;
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

            this.#elements.rollButton.disabled = false;
        }, 500); // Match the CSS animation duration
    }
}
