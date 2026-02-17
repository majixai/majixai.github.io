/**
 * @file Shape overlay engine for iframes and images.
 * @description Provides configurable shape overlays with GPU/ML/TensorFlow-driven
 * dynamic generation. Supports toggling per performer mode (none, single, many).
 */

class ShapeEngine {
    /** @type {'none'|'single'|'many'} */
    #_performerMode = 'many';
    #_shapesEnabled = false;
    #_mlShapesEnabled = false;
    #_complexity = 3;
    #_activeOverlays = new Map();
    #_mlModel = null;
    #_mlModelPromise = null;
    #_animationFrames = new Map();

    // Available shape types with increasing complexity
    static SHAPE_TYPES = Object.freeze([
        'circle', 'rectangle', 'triangle', 'diamond',
        'hexagon', 'star', 'cross', 'ring',
        'wave', 'spiral'
    ]);

    static PERFORMER_MODES = Object.freeze(['none', 'single', 'many']);

    static DEFAULT_CONFIG = Object.freeze({
        shapesEnabled: false,
        mlShapesEnabled: false,
        performerMode: 'many',
        complexity: 3,
        maxShapesPerOverlay: 20,
        shapeOpacity: 0.35,
        animateShapes: true,
        colorPalette: ['#ff6b35', '#00539B', '#28a745', '#dc3545', '#ffc107', '#9c27b0', '#00bcd4']
    });

    /**
     * @param {Object} config
     */
    constructor(config = {}) {
        const merged = { ...ShapeEngine.DEFAULT_CONFIG, ...config };
        this.#_shapesEnabled = merged.shapesEnabled;
        this.#_mlShapesEnabled = merged.mlShapesEnabled;
        this.#_performerMode = merged.performerMode;
        this.#_complexity = merged.complexity;
        this._maxShapes = merged.maxShapesPerOverlay;
        this._opacity = merged.shapeOpacity;
        this._animate = merged.animateShapes;
        this._colors = merged.colorPalette;
    }

    // ==================== Public API ====================

    /** @returns {boolean} */
    get shapesEnabled() { return this.#_shapesEnabled; }
    set shapesEnabled(val) {
        this.#_shapesEnabled = Boolean(val);
        if (!this.#_shapesEnabled) this.removeAllOverlays();
    }

    /** @returns {boolean} */
    get mlShapesEnabled() { return this.#_mlShapesEnabled; }
    set mlShapesEnabled(val) { this.#_mlShapesEnabled = Boolean(val); }

    /** @returns {'none'|'single'|'many'} */
    get performerMode() { return this.#_performerMode; }
    set performerMode(mode) {
        if (ShapeEngine.PERFORMER_MODES.includes(mode)) {
            this.#_performerMode = mode;
        }
    }

    /** @returns {number} */
    get complexity() { return this.#_complexity; }
    set complexity(val) {
        const parsed = parseInt(val);
        this.#_complexity = Math.max(1, Math.min(10, Number.isFinite(parsed) ? parsed : 3));
    }

    /**
     * Get current configuration for persistence
     * @returns {Object}
     */
    getConfig() {
        return {
            shapesEnabled: this.#_shapesEnabled,
            mlShapesEnabled: this.#_mlShapesEnabled,
            performerMode: this.#_performerMode,
            complexity: this.#_complexity
        };
    }

    /**
     * Initialize the ML model for tensor-based shape generation.
     * Reuses the already-loaded TensorFlow.js and MobileNet.
     * @param {Object} mlModel - Pre-loaded MobileNet model reference
     */
    setMLModel(mlModel) {
        this.#_mlModel = mlModel;
    }

    /**
     * Apply shape overlay to an element (iframe wrapper or image container).
     * @param {HTMLElement} targetEl - The element to overlay shapes on
     * @param {string} key - Unique key for tracking (e.g., slot number or username)
     * @param {Object} [mlPrediction] - Optional ML prediction data to drive shapes
     */
    applyOverlay(targetEl, key, mlPrediction = null) {
        if (!this.#_shapesEnabled || !targetEl) return;

        // Remove existing overlay for this key
        this.removeOverlay(key);

        const canvas = document.createElement('canvas');
        canvas.className = 'shape-overlay-canvas';
        canvas.dataset.shapeKey = key;
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '5';

        // Set canvas resolution to match element
        const rect = targetEl.getBoundingClientRect();
        canvas.width = Math.max(rect.width, 200);
        canvas.height = Math.max(rect.height, 150);

        // Ensure parent has positioning context
        const computedPos = window.getComputedStyle(targetEl).position;
        if (computedPos === 'static') {
            targetEl.style.position = 'relative';
        }

        targetEl.appendChild(canvas);
        this.#_activeOverlays.set(key, { canvas, targetEl });

        // Generate shapes
        const shapes = this.#_mlShapesEnabled && mlPrediction
            ? this.#_generateMLShapes(mlPrediction, canvas.width, canvas.height)
            : this.#_generateRandomShapes(canvas.width, canvas.height);

        this.#_drawShapes(canvas, shapes);

        // Animate if enabled
        if (this._animate) {
            this.#_startAnimation(key, canvas, shapes);
        }
    }

    /**
     * Remove overlay for a specific key
     * @param {string} key
     */
    removeOverlay(key) {
        const overlay = this.#_activeOverlays.get(key);
        if (overlay) {
            // Cancel animation
            const animId = this.#_animationFrames.get(key);
            if (animId) {
                cancelAnimationFrame(animId);
                this.#_animationFrames.delete(key);
            }
            overlay.canvas.remove();
            this.#_activeOverlays.delete(key);
        }
    }

    /**
     * Remove all overlays
     */
    removeAllOverlays() {
        for (const key of this.#_activeOverlays.keys()) {
            this.removeOverlay(key);
        }
    }

    /**
     * Apply overlays to all visible iframe wrappers
     * @param {HTMLElement} iframeGrid - The iframe grid container
     * @param {Map} viewerSlots - Map of username to slot number
     * @param {Function} [getPrediction] - Optional async function to get ML prediction for a username
     */
    async applyToIframes(iframeGrid, viewerSlots, getPrediction = null) {
        if (!this.#_shapesEnabled || !iframeGrid) return;

        const wrappers = iframeGrid.querySelectorAll('.iframe-wrapper:not(.hidden)');
        let appliedCount = 0;

        for (const wrapper of wrappers) {
            const slot = parseInt(wrapper.dataset.slot);

            // Check performer mode limits
            if (this.#_performerMode === 'none') break;
            if (this.#_performerMode === 'single' && appliedCount >= 1) break;

            let prediction = null;
            if (this.#_mlShapesEnabled && getPrediction) {
                const username = this.#_getUsernameForSlot(slot, viewerSlots);
                if (username) {
                    prediction = await getPrediction(username);
                }
            }

            this.applyOverlay(wrapper, `iframe-${slot}`, prediction);
            appliedCount++;
        }
    }

    /**
     * Apply overlays to performer card images
     * @param {HTMLElement} gridContainer - The performer grid container
     * @param {Function} [getPrediction] - Optional async function to get ML prediction for a username
     */
    async applyToImages(gridContainer, getPrediction = null) {
        if (!this.#_shapesEnabled || !gridContainer) return;

        const cards = gridContainer.querySelectorAll('.performer-card');
        let appliedCount = 0;

        for (const card of cards) {
            if (this.#_performerMode === 'none') break;
            if (this.#_performerMode === 'single' && appliedCount >= 1) break;

            const imageContainer = card.querySelector('.card-image-container');
            if (!imageContainer) continue;

            const username = card.dataset.username;
            let prediction = null;
            if (this.#_mlShapesEnabled && getPrediction && username) {
                prediction = await getPrediction(username);
            }

            this.applyOverlay(imageContainer, `img-${username}`, prediction);
            appliedCount++;
        }
    }

    // ==================== Private Methods ====================

    /**
     * Get username for a slot from viewerSlots map
     * @private
     */
    #_getUsernameForSlot(slot, viewerSlots) {
        for (const [username, slotNum] of viewerSlots) {
            if (slotNum === slot) return username;
        }
        return null;
    }

    /**
     * Generate shapes based on ML prediction data.
     * Uses prediction confidence to determine shape type, count, and color distribution.
     * @private
     */
    #_generateMLShapes(prediction, width, height) {
        const shapes = [];
        const numShapes = Math.min(
            this._maxShapes,
            Math.max(2, Math.floor(this.#_complexity * 1.5))
        );

        // Map prediction confidence to shape properties
        const confidence = prediction?.confidence || 50;
        const predictionCount = prediction?.predictions?.length || 1;
        const totalShapeTypes = ShapeEngine.SHAPE_TYPES.length;
        // Prime-derived multiplier for deterministic pseudo-random seed distribution
        const SEED_SPREAD_FACTOR = 7.3;

        for (let i = 0; i < numShapes; i++) {
            // Distribute shape types across the confidence spectrum:
            // Higher confidence biases toward later (more complex) shape types
            const confidenceRatio = confidence / 100;
            const progressRatio = (i + 1) / numShapes;
            const shapeIndex = Math.floor(confidenceRatio * totalShapeTypes * progressRatio) % totalShapeTypes;
            const type = ShapeEngine.SHAPE_TYPES[Math.min(shapeIndex, this.#_complexity - 1)] || 'circle';

            // Use prediction data to seed position and size deterministically
            const seed = (confidence * (i + 1) * SEED_SPREAD_FACTOR) % 100;
            const size = 10 + (seed / 100) * (30 * (this.#_complexity / 5));
            const colorIdx = (i + predictionCount) % this._colors.length;

            shapes.push({
                type,
                x: (seed * width / 100 + i * width / numShapes) % width,
                y: (seed * height / 100 + i * height / numShapes) % height,
                size,
                color: this._colors[colorIdx],
                opacity: this._opacity * (0.5 + (confidence / 200)),
                rotation: (seed * 3.6) % 360,
                phase: i * (Math.PI * 2 / numShapes)
            });
        }

        return shapes;
    }

    /**
     * Generate random shapes based on complexity setting
     * @private
     */
    #_generateRandomShapes(width, height) {
        const shapes = [];
        const numShapes = Math.min(
            this._maxShapes,
            Math.max(1, this.#_complexity * 2)
        );

        for (let i = 0; i < numShapes; i++) {
            const typeIdx = Math.floor(Math.random() * Math.min(this.#_complexity, ShapeEngine.SHAPE_TYPES.length));
            const type = ShapeEngine.SHAPE_TYPES[typeIdx];

            shapes.push({
                type,
                x: Math.random() * width,
                y: Math.random() * height,
                size: 10 + Math.random() * (25 * (this.#_complexity / 5)),
                color: this._colors[Math.floor(Math.random() * this._colors.length)],
                opacity: this._opacity * (0.3 + Math.random() * 0.7),
                rotation: Math.random() * 360,
                phase: i * (Math.PI * 2 / numShapes)
            });
        }

        return shapes;
    }

    /**
     * Draw shapes on a canvas
     * @private
     */
    #_drawShapes(canvas, shapes, timeOffset = 0) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const shape of shapes) {
            ctx.save();
            ctx.globalAlpha = shape.opacity;

            // Slight animation offset
            const dx = this._animate ? Math.sin(timeOffset * 0.001 + shape.phase) * 3 : 0;
            const dy = this._animate ? Math.cos(timeOffset * 0.0012 + shape.phase) * 2 : 0;

            ctx.translate(shape.x + dx, shape.y + dy);
            ctx.rotate((shape.rotation + (this._animate ? timeOffset * 0.01 : 0)) * Math.PI / 180);
            ctx.fillStyle = shape.color;
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = 2;

            this.#_drawShape(ctx, shape.type, shape.size);

            ctx.restore();
        }
    }

    /**
     * Draw a single shape type on the canvas context
     * @private
     */
    #_drawShape(ctx, type, size) {
        switch (type) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'rectangle':
                ctx.fillRect(-size / 2, -size / 2, size, size * 0.7);
                break;

            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(0, -size / 2);
                ctx.lineTo(-size / 2, size / 2);
                ctx.lineTo(size / 2, size / 2);
                ctx.closePath();
                ctx.fill();
                break;

            case 'diamond':
                ctx.beginPath();
                ctx.moveTo(0, -size / 2);
                ctx.lineTo(size / 2, 0);
                ctx.lineTo(0, size / 2);
                ctx.lineTo(-size / 2, 0);
                ctx.closePath();
                ctx.fill();
                break;

            case 'hexagon':
                this.#_drawPolygon(ctx, 6, size / 2);
                break;

            case 'star':
                this.#_drawStar(ctx, 5, size / 2, size / 4);
                break;

            case 'cross':
                ctx.fillRect(-size / 6, -size / 2, size / 3, size);
                ctx.fillRect(-size / 2, -size / 6, size, size / 3);
                break;

            case 'ring':
                ctx.beginPath();
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, size / 3, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'wave':
                ctx.beginPath();
                for (let i = -size; i <= size; i++) {
                    const waveY = Math.sin(i * 0.15) * (size / 4);
                    if (i === -size) ctx.moveTo(i, waveY);
                    else ctx.lineTo(i, waveY);
                }
                ctx.stroke();
                break;

            case 'spiral':
                ctx.beginPath();
                for (let angle = 0; angle < Math.PI * 4; angle += 0.1) {
                    const r = (angle / (Math.PI * 4)) * (size / 2);
                    const sx = Math.cos(angle) * r;
                    const sy = Math.sin(angle) * r;
                    if (angle === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.stroke();
                break;

            default:
                ctx.beginPath();
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.fill();
        }
    }

    /**
     * Draw a regular polygon
     * @private
     */
    #_drawPolygon(ctx, sides, radius) {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Draw a star shape
     * @private
     */
    #_drawStar(ctx, points, outerRadius, innerRadius) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI / points) - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Start animation loop for an overlay
     * @private
     */
    #_startAnimation(key, canvas, shapes) {
        const startTime = performance.now();

        const animate = (timestamp) => {
            if (!this.#_activeOverlays.has(key)) return;
            const elapsed = timestamp - startTime;
            this.#_drawShapes(canvas, shapes, elapsed);
            this.#_animationFrames.set(key, requestAnimationFrame(animate));
        };

        this.#_animationFrames.set(key, requestAnimationFrame(animate));
    }
}
