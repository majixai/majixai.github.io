/**
 * @fileoverview The core game engine for Dice Golf.
 */
class Game {
    // Bitwise flags for game status
    static STATUS_READY = 1 << 0;    // 1
    static STATUS_PLAYING = 1 << 1;  // 2
    static STATUS_HOLE_END = 1 << 2; // 4
    static STATUS_GAME_END = 1 << 3; // 8

    // Private members
    #state;
    #holes;
    #players;
    #currentPlayerIndex;
    #currentHoleIndex;
    #dbHelper;
    #uiManager;

    constructor(players, holes, uiManager, dbHelper) {
        this.#players = players;
        this.#holes = holes;
        this.#uiManager = uiManager;
        this.#dbHelper = dbHelper;
        this.#currentPlayerIndex = 0;
        this.#currentHoleIndex = 0;
        this.#state = {
            status: Game.STATUS_READY,
            distanceRemaining: 0,
            strokeCount: 0,
        };
        this.#uiManager.on('onRoll', this.#handleRoll.bind(this));
        this.#uiManager.on('onReset', this.startNewGame.bind(this));
    }

    /**
     * Initializes the game.
     */
    async init() {
        // In a real app, you might load saved state from IndexedDB here.
        this.startNewGame();
    }

    /**
     * Starts a new game.
     */
    startNewGame() {
        this.#players.forEach(p => p.scores = new Array(this.#holes.length).fill(0));
        this.#currentPlayerIndex = 0;
        this.#currentHoleIndex = 0;
        this.#state.status = Game.STATUS_READY;
        this.#uiManager.createScoreboard(this.#holes);
        this.#startHole();
    }

    /**
     * Sets up the start of a new hole.
     * @private
     */
    #startHole() {
        const currentHole = this.#holes[this.#currentHoleIndex];
        this.#state.distanceRemaining = currentHole.distance;
        this.#state.strokeCount = 0;
        this.#state.status = Game.STATUS_PLAYING;
        this.#uiManager.updateScoreboard(this.#players[this.#currentPlayerIndex]);
        this.#updateUI();
    }

    /**
     * Handles the dice roll event from the UI.
     * @private
     */
    async #handleRoll() {
        if (!(this.#state.status & Game.STATUS_PLAYING)) return;

        const dice1 = this.#rollDice();
        const dice2 = this.#rollDice();
        this.#uiManager.animateDice(dice1, dice2);

        this.#state.strokeCount++;

        // Calculate distance. If doubles are rolled, the shot is more powerful.
        let distanceCovered = (dice1 + dice2) * 10;
        if (dice1 === dice2) {
            distanceCovered *= 2;
        }

        this.#state.distanceRemaining -= distanceCovered;

        if (this.#state.distanceRemaining <= 0) {
            this.#state.status = Game.STATUS_HOLE_END;
            this.#endHole();
        }

        this.#updateUI();
    }

    /**
     * Finalizes a hole, records the score, and moves to the next.
     * @private
     */
    #endHole() {
        const currentPlayer = this.#players[this.#currentPlayerIndex];
        currentPlayer.scores[this.#currentHoleIndex] = this.#state.strokeCount;
        this.#uiManager.updateScoreboard(currentPlayer);

        // Save progress
        this.#dbHelper.put({ id: 'lastGameState', player: currentPlayer });

        if (this.#currentHoleIndex >= this.#holes.length - 1) {
            this.#state.status = Game.STATUS_GAME_END;
            // In a full game, show a final scoreboard
            alert("Congratulations! You've finished the course.");
        } else {
            this.#currentHoleIndex++;
            this.#startHole();
        }
    }

    /**
     * Rolls a single 6-sided die.
     * @returns {number}
     * @private
     */
    #rollDice() {
        return Math.floor(Math.random() * 6) + 1;
    }

    /**
     * Pushes the current game state to the UI.
     * @private
     */
    #updateUI() {
        const currentHole = this.#holes[this.#currentHoleIndex];
        const currentPlayer = this.#players[this.#currentPlayerIndex];
        this.#uiManager.updateInfo({
            playerName: currentPlayer.name,
            holeNumber: currentHole.hole,
            par: currentHole.par,
            strokes: this.#state.strokeCount,
            distance: Math.max(0, this.#state.distanceRemaining),
        });
    }
}
class Player {
    constructor(name) {
        this.name = name;
        this.scores = [];
    }
}
