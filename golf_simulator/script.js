(function() {
    // IIFE for private scope

    // --- JSDoc "Interfaces" ---
    /**
     * @typedef {Object} IBall
     * @property {HTMLElement} element
     * @property {number} radius
     * @property {number} x
     * @property {number} y
     * @property {number} vx
     * @property {number} vy
     * @property {function(): void} update
     * @property {function(): boolean} isMoving
     * @property {function(): void} reset
     */

    /**
     * @typedef {Object} IGame
     * @property {IBall} ball
     * @property {function(number, number): void} swing
     * @property {function(): void} stop
     */

    // --- DOM Elements ---
    const video = document.getElementById('video');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const golfCourseSVG = document.getElementById('golf-course');
    const ballSVG = document.getElementById('ball');
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('high-score');


    // --- DBHelper Class for IndexedDB ---
    class DBHelper {
        constructor(dbName, storeName, version = 1) {
            this.dbName = dbName;
            this.storeName = storeName;
            this.version = version;
            this.db = null;
        }

        open() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.version);
                request.onerror = (event) => reject("Error opening DB: " + event.target.errorCode);
                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    resolve(this.db);
                };
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    }
                };
            });
        }

        async put(item) {
            if (!this.db) await this.open();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put(item);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject("Error putting item: " + event.target.errorCode);
            });
        }

        async getAll() {
            if (!this.db) await this.open();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject("Error getting all items: " + event.target.errorCode);
            });
        }
    }


    // --- Motion Detection Globals ---
    let motionDetectionLoopId;
    let lastImageData;
    const canvas = document.createElement('canvas');
    const canvasContext = canvas.getContext('2d', { willReadFrequently: true });

    // --- Classes ---

    class Ball {
        static FRICTION = 0.98; // Static property

        constructor(element) {
            this.element = element;
            this.radius = parseFloat(element.getAttribute('r'));
            this.x = parseFloat(element.getAttribute('cx'));
            this.y = parseFloat(element.getAttribute('cy'));
            this.vx = 0;
            this.vy = 0;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= Ball.FRICTION;
            this.vy *= Ball.FRICTION;

            this.element.setAttribute('cx', this.x);
            this.element.setAttribute('cy', this.y);
        }

        isMoving() {
            return Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1;
        }

        reset() {
            this.x = parseFloat(this.element.dataset.startX) || 100;
            this.y = parseFloat(this.element.dataset.startY) || 200;
            this.vx = 0;
            this.vy = 0;
            this.update();
        }
    }

    class Game {
        // Bitwise flags for game status
        static STATUS_READY = 1 << 0; // 1
        static STATUS_SWINGING = 1 << 1; // 2

        #status; // Private field
        #animationFrameId;

        constructor(ball, dbHelper, options = {}) {
            /** @type {IBall} */
            this.ball = ball;
            this.dbHelper = dbHelper;
            this.options = Object.assign({
                swingPowerMultiplier: 0.1,
                maxSwingPower: 20
            }, options); // Object Mapping

            this.#status = Game.STATUS_READY;
            this.#animationFrameId = null;
            this.score = 0;
            this.highScore = 0;
        }

        async loadGame() {
            try {
                const scores = await this.dbHelper.getAll();
                if (scores.length > 0) {
                    this.highScore = scores.reduce((max, s) => Math.max(max, s.score), 0);
                }
                console.log(`High score loaded: ${this.highScore}`);
                this.updateScoreUI();
            } catch (error) {
                console.error("Could not load high score:", error);
            }
        }

        updateScoreUI() {
            scoreEl.textContent = this.score;
            highScoreEl.textContent = this.highScore;
        }


        swing(power, angle) {
            if (this.#status & Game.STATUS_SWINGING) return;
            this.#status = Game.STATUS_SWINGING;

            this.score++;
            this.updateScoreUI();

            console.log(`Swinging with power ${power} and angle ${angle}`);
            const swingPower = Math.min(power * this.options.swingPowerMultiplier, this.options.maxSwingPower);

            this.ball.vx = Math.cos(angle) * swingPower;
            this.ball.vy = Math.sin(angle) * swingPower;
            this.animate();
        }

        * _gameStateMachine() {
            while (true) {
                if (this.ball.isMoving()) {
                    yield 'MOVING';
                    this.ball.update();
                } else {
                    yield 'STOPPED';
                    this.#status = Game.STATUS_READY;
                    this.#animationFrameId = null;
                    return; // End the generator
                }
            }
        }

        animate() {
            const stateMachine = this._gameStateMachine();

            const loop = () => {
                const state = stateMachine.next().value;
                if (state === 'MOVING') {
                    this.#animationFrameId = requestAnimationFrame(loop);
                } else {
                    console.log("Ball stopped.");
                }
            };
            loop();
        }

        async stop() {
            if (this.#animationFrameId) {
                cancelAnimationFrame(this.#animationFrameId);
            }
            this.ball.reset();
            this.#status = Game.STATUS_READY;

            if (this.score > 0) {
                await this.dbHelper.put({ score: this.score, date: new Date() });
                console.log("Game score saved.");
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                }
            }
            this.score = 0;
            this.updateScoreUI();
        }
    }

    // --- Initial Setup ---
    ballSVG.dataset.startX = ballSVG.getAttribute('cx');
    ballSVG.dataset.startY = ballSVG.getAttribute('cy');

    const dbHelper = new DBHelper('GolfSimulatorDB', 'scores');
    const ball = new Ball(ballSVG);
    const game = new Game(ball, dbHelper, { swingPowerMultiplier: 0.05 });


    // --- Motion Detection ---
    function setupCanvas() {
        if (video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }
    }

    function detectMotion(onMotion) {
        if (video.readyState < video.HAVE_METADATA || video.videoWidth === 0) return;
        if (canvas.width === 0) setupCanvas();

        canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        const currentImageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);

        if (lastImageData) {
            let motionAmount = 0;
            const data = currentImageData.data;
            const lastData = lastImageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const diff = Math.abs(data[i] - lastData[i]) + Math.abs(data[i + 1] - lastData[i + 1]) + Math.abs(data[i + 2] - lastData[i + 2]);
                if (diff > 50) motionAmount++;
            }

            const motionThreshold = (canvas.width * canvas.height) / 1000;
            if (motionAmount > motionThreshold) {
                onMotion(motionAmount);
            }
        }
        lastImageData = currentImageData;
    }

    function motionDetectionLoop() {
        detectMotion((motionAmount) => {
            console.log(`Motion detected! Amount: ${motionAmount}`);
            const power = motionAmount;
            const angle = (Math.random() - 0.5) * 0.5; // Random angle for now
            game.swing(power, angle);
        });
        motionDetectionLoopId = requestAnimationFrame(motionDetectionLoop);
    }

    // --- Main Functions ---
    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
        } catch (err) {
            console.error("Error accessing camera: ", err);
        }
    }

    async function startGame() {
        console.log("Starting game...");
        await game.loadGame();
        initCamera();
        motionDetectionLoop();
    }

    function stopGame() {
        console.log("Stopping game...");
        if (motionDetectionLoopId) {
            cancelAnimationFrame(motionDetectionLoopId);
        }
        game.stop(); // game.stop is now async, but we don't need to wait for it here
        let stream = video.srcObject;
        if (stream) {
            let tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }
        video.srcObject = null;
        lastImageData = null;
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', startGame);
    stopButton.addEventListener('click', stopGame);
    video.addEventListener('loadedmetadata', setupCanvas);

})();
