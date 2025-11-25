/**
 * @fileoverview The core game engine for the strategic Dice Golf game.
 */

// --- Club Definitions ---
const CLUBS = {
    Driver: { name: 'Driver', baseDistance: 100, accuracy: 60 },
    Wood:   { name: 'Wood',   baseDistance: 80,  accuracy: 70 },
    Iron:   { name: 'Iron',   baseDistance: 50,  accuracy: 85 },
    Putter: { name: 'Putter', baseDistance: 15,  accuracy: 100 }
};

// --- Terrain Modifiers ---
const TERRAIN_MODIFIERS = {
    fairway: { distance: 1.0, accuracy: 1.0 },
    rough:   { distance: 0.7, accuracy: 0.8 },
    sand:    { distance: 0.5, accuracy: 0.6 },
    green:   { distance: 1.0, accuracy: 1.0 } // Only for putting
};

class Game {
    // Bitwise flags for game status
    static STATUS_READY = 1 << 0;    // 1
    static STATUS_PLAYING = 1 << 1;  // 2
    static STATUS_HOLE_END = 1 << 2; // 4
    static STATUS_GAME_END = 1 << 3; // 8

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
            distanceFromHole: 0,
            currentTerrain: 'fairway',
            strokeCount: 0,
            selectedClub: CLUBS.Driver,
        };
        this.#uiManager.on('onShot', this.#executeShot.bind(this));
        this.#uiManager.on('onReset', this.startNewGame.bind(this));
        this.#uiManager.on('onClubSelected', this.#selectClub.bind(this));
    }

    async init() {
        this.startNewGame();
    }

    startNewGame() {
        this.#players.forEach(p => p.scores = new Array(this.#holes.length).fill(0));
        this.#currentPlayerIndex = 0;
        this.#currentHoleIndex = 0;
        this.#state.status = Game.STATUS_READY;
        this.#uiManager.createScoreboard(this.#holes);
        this.#startHole();
    }

    #startHole() {
        const currentHole = this.#holes[this.#currentHoleIndex];
        this.#state.distanceFromHole = currentHole.layout.reduce((sum, seg) => sum + seg.distance, 0);
        this.#state.strokeCount = 0;
        this.#state.status = Game.STATUS_PLAYING;
        this.#updatePlayerTerrain();
        this.#selectClub(CLUBS.Driver.name); // Default to Driver
        this.#uiManager.updateScoreboard(this.#players[this.#currentPlayerIndex]);
        this.#updateUI();
    }

    #selectClub(clubName) {
        this.#state.selectedClub = CLUBS[clubName];
        this.#uiManager.selectClub(clubName);
    }

    #executeShot(shotSliderValue) {
        if (!(this.#state.status & Game.STATUS_PLAYING)) return;

        const dice1 = this.#rollDice();
        const dice2 = this.#rollDice();
        this.#uiManager.animateDice(dice1, dice2);
        this.#state.strokeCount++;

        const club = this.#state.selectedClub;
        const terrainMod = TERRAIN_MODIFIERS[this.#state.currentTerrain];

        let distanceCovered;

        // Putting mechanic
        if (this.#state.currentTerrain === 'green') {
            // Dice roll determines success, slider gives a bonus.
            const distanceToPin = this.#state.distanceFromHole;
            const requiredRoll = Math.ceil(distanceToPin / 2);
            if ((dice1 + dice2) >= requiredRoll) {
                distanceCovered = distanceToPin; // Success!
            } else {
                distanceCovered = Math.max(0, distanceToPin - (dice1 + dice2)); // Came up short
            }
        } else {
            // Full shot mechanic
            const powerRatio = (dice1 + dice2) / 12; // 2-12 -> ~0.17 to 1.0
            const accuracyRatio = shotSliderValue / 100; // 0-100 -> 0.0 to 1.0
            const clubAccuracyFactor = club.accuracy / 100;
            const finalAccuracy = (accuracyRatio * clubAccuracyFactor * terrainMod.accuracy);

            distanceCovered = club.baseDistance * powerRatio * finalAccuracy * terrainMod.distance;
        }

        this.#state.distanceFromHole -= distanceCovered;
        this.#updatePlayerTerrain();

        if (this.#state.distanceFromHole <= 0) {
            this.#state.status = Game.STATUS_HOLE_END;
            this.#endHole();
        }

        this.#updateUI();
    }

    #updatePlayerTerrain() {
        const currentHole = this.#holes[this.#currentHoleIndex];
        let distanceTraveled = 0;
        const totalHoleDistance = currentHole.layout.reduce((sum, seg) => sum + seg.distance, 0);
        const playerDistance = totalHoleDistance - this.#state.distanceFromHole;

        for (const segment of currentHole.layout) {
            distanceTraveled += segment.distance;
            if (playerDistance <= distanceTraveled) {
                this.#state.currentTerrain = segment.terrain;
                return;
            }
        }
        this.#state.currentTerrain = currentHole.layout[currentHole.layout.length - 1].terrain;
    }

    #endHole() {
        const currentPlayer = this.#players[this.#currentPlayerIndex];
        // Add a 1-stroke penalty if landing in a hazard.
        const penalty = (this.#state.currentTerrain === 'sand') ? 1 : 0;
        currentPlayer.scores[this.#currentHoleIndex] = this.#state.strokeCount + penalty;
        this.#uiManager.updateScoreboard(currentPlayer);
        this.#dbHelper.put({ id: 'lastGameState', player: currentPlayer });

        if (this.#currentHoleIndex >= this.#holes.length - 1) {
            this.#state.status = Game.STATUS_GAME_END;
            alert("Congratulations! You've finished the course.");
        } else {
            this.#currentHoleIndex++;
            this.#startHole();
        }
    }

    #rollDice() {
        return Math.floor(Math.random() * 6) + 1;
    }

    #updateUI() {
        const currentHole = this.#holes[this.#currentHoleIndex];
        const currentPlayer = this.#players[this.#currentPlayerIndex];
        this.#uiManager.updateInfo({
            playerName: currentPlayer.name,
            holeNumber: currentHole.hole,
            par: currentHole.par,
            strokes: this.#state.strokeCount,
            distance: Math.max(0, this.#state.distanceFromHole).toFixed(0),
            terrain: this.#state.currentTerrain,
        });
    }
}
class Player {
    constructor(name) {
        this.name = name;
        this.scores = [];
    }
}