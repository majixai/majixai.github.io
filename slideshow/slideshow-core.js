// slideshow-core.js
// Shared SlideshowManager — use from any directory via /slideshow/slideshow-core.js

/**
 * SlideshowManager — auto-rotating image slideshow with optional progress bar,
 * slide counter, keyboard navigation, and touch/swipe support.
 *
 * Quick start:
 *   const mgr = new SlideshowManager(imgEl, ['a.jpg', 'b.jpg', 'c.jpg']);
 *   mgr.start();
 *
 * Load from a gzip-compressed .dat file (requires pako):
 *   const mgr = await SlideshowManager.fromDatFile(imgEl, '/data/images.dat');
 *   mgr.start();
 *
 * Load from a JSON array URL:
 *   const mgr = await SlideshowManager.fromJsonUrl(imgEl, '/data/images.json');
 *   mgr.start();
 */
class SlideshowManager {
    /**
     * @param {HTMLImageElement} imgElement  - The <img> element whose src is updated.
     * @param {string[]}         images      - Array of image URLs.
     * @param {Object}           [options]
     * @param {number}           [options.minDelay=2000]      - Minimum ms per slide.
     * @param {number}           [options.maxDelay=6000]      - Maximum ms per slide.
     * @param {HTMLElement}      [options.progressBar]        - Optional progress-bar element.
     * @param {HTMLElement}      [options.counter]            - Optional counter element ("N/M").
     * @param {HTMLElement}      [options.prevBtn]            - Optional previous-button element.
     * @param {HTMLElement}      [options.nextBtn]            - Optional next-button element.
     * @param {HTMLElement}      [options.container]          - Container for keyboard/touch binding.
     * @param {boolean}          [options.keyboard=false]     - Enable keyboard arrow navigation.
     * @param {boolean}          [options.touch=false]        - Enable touch/swipe navigation.
     * @param {boolean}          [options.pauseOnHover=false] - Pause slideshow while hovered.
     */
    constructor(imgElement, images, options = {}) {
        this.imgElement   = imgElement;
        this.images       = images.filter(Boolean);
        this.currentIndex = 0;
        this.timeoutId    = null;
        this.isRunning    = false;

        this.minDelay     = options.minDelay     || 2000;
        this.maxDelay     = options.maxDelay     || 6000;
        this.progressBar  = options.progressBar  || null;
        this.counter      = options.counter      || null;
        this.prevBtn      = options.prevBtn      || null;
        this.nextBtn      = options.nextBtn      || null;
        this.container    = options.container    || null;
        this.keyboard     = !!options.keyboard;
        this.touch        = !!options.touch;
        this.pauseOnHover = !!options.pauseOnHover;

        this._boundKey        = null;
        this._touchStartX     = 0;
        this._boundTouchStart = null;
        this._boundTouchEnd   = null;
        this._boundMouseEnter = null;
        this._boundMouseLeave = null;
        this._boundPrev       = null;
        this._boundNext       = null;

        this._attachControls();
        this._updateCounter();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Start the auto-rotation. No-op if already running or fewer than 2 images. */
    start() {
        if (this.isRunning || this.images.length < 2) return;
        this.isRunning = true;
        this._scheduleNext();
    }

    /** Stop the auto-rotation. */
    stop() {
        this.isRunning = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.progressBar) {
            this.progressBar.style.transition = 'none';
            this.progressBar.style.width = '0%';
        }
    }

    /** Navigate to a specific index (wraps around). */
    goTo(index) {
        const len = this.images.length;
        if (!len) return;
        this.currentIndex = index < 0 ? (index % len) + len : index % len;
        this._showCurrent();
    }

    /** Show the next image. */
    next() {
        if (!this.images.length) return;
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this._showCurrent();
    }

    /** Show the previous image. */
    prev() {
        if (!this.images.length) return;
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this._showCurrent();
    }

    /**
     * Detach all event listeners and clear timers.
     * Call before discarding the manager to avoid memory leaks.
     */
    destroy() {
        this.stop();
        const el = this.container || this.imgElement;
        if (this._boundKey        && el) el.removeEventListener('keydown',    this._boundKey);
        if (this._boundTouchStart && el) el.removeEventListener('touchstart', this._boundTouchStart);
        if (this._boundTouchEnd   && el) el.removeEventListener('touchend',   this._boundTouchEnd);
        if (this._boundMouseEnter && el) el.removeEventListener('mouseenter', this._boundMouseEnter);
        if (this._boundMouseLeave && el) el.removeEventListener('mouseleave', this._boundMouseLeave);
        if (this.prevBtn && this._boundPrev) this.prevBtn.removeEventListener('click', this._boundPrev);
        if (this.nextBtn && this._boundNext) this.nextBtn.removeEventListener('click', this._boundNext);
    }

    // ── Static Factories ─────────────────────────────────────────────────────

    /**
     * Load images from a gzip/zlib-compressed .dat file (JSON array of URLs).
     * Requires pako (https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js).
     *
     * @param {HTMLImageElement} imgElement
     * @param {string}           datUrl     - URL of the .dat file.
     * @param {Object}           [options]  - Same options as constructor.
     * @returns {Promise<SlideshowManager>}
     */
    static async fromDatFile(imgElement, datUrl, options = {}) {
        try {
            const response = await fetch(datUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer       = await response.arrayBuffer();
            const decompressed = pako.inflate(new Uint8Array(buffer), { to: 'string' });
            const urls         = [...new Set(JSON.parse(decompressed).filter(Boolean))];
            return new SlideshowManager(imgElement, urls, options);
        } catch (e) {
            console.warn(`SlideshowManager.fromDatFile: could not load ${datUrl}:`, e.message);
            const fallback = imgElement && imgElement.src ? [imgElement.src] : [];
            return new SlideshowManager(imgElement, fallback, options);
        }
    }

    /**
     * Load images from a plain JSON file containing an array of URL strings
     * (or an object with an `images` array). No compression required.
     *
     * @param {HTMLImageElement} imgElement
     * @param {string}           jsonUrl    - URL of the JSON file.
     * @param {Object}           [options]  - Same options as constructor.
     * @returns {Promise<SlideshowManager>}
     */
    static async fromJsonUrl(imgElement, jsonUrl, options = {}) {
        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const urls = [...new Set(
                (Array.isArray(data) ? data : (data.images || [])).filter(Boolean)
            )];
            return new SlideshowManager(imgElement, urls, options);
        } catch (e) {
            console.warn(`SlideshowManager.fromJsonUrl: could not load ${jsonUrl}:`, e.message);
            const fallback = imgElement && imgElement.src ? [imgElement.src] : [];
            return new SlideshowManager(imgElement, fallback, options);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    _showCurrent() {
        const url = this.images[this.currentIndex];
        if (this.imgElement) {
            this.imgElement.style.opacity = '0.4';
            setTimeout(() => {
                this.imgElement.src           = url;
                this.imgElement.style.opacity = '1';
            }, 250);
        }
        this._updateCounter();
    }

    _updateCounter() {
        if (this.counter && this.images.length) {
            this.counter.textContent = `${this.currentIndex + 1}/${this.images.length}`;
        }
    }

    _scheduleNext() {
        if (!this.isRunning) return;
        const delay = Math.floor(Math.random() * (this.maxDelay - this.minDelay)) + this.minDelay;

        if (this.progressBar) {
            this.progressBar.style.transition = 'none';
            this.progressBar.style.width      = '0%';
            void this.progressBar.offsetWidth; // force reflow
            this.progressBar.style.transition = `width ${delay}ms linear`;
            this.progressBar.style.width      = '100%';
        }

        this.timeoutId = setTimeout(() => {
            this.currentIndex = (this.currentIndex + 1) % this.images.length;
            this._showCurrent();
            this._scheduleNext();
        }, delay);
    }

    _attachControls() {
        const el = this.container || this.imgElement;

        if (this.prevBtn) {
            this._boundPrev = () => { this.stop(); this.prev(); };
            this.prevBtn.addEventListener('click', this._boundPrev);
        }
        if (this.nextBtn) {
            this._boundNext = () => { this.stop(); this.next(); };
            this.nextBtn.addEventListener('click', this._boundNext);
        }

        if (this.keyboard && el) {
            this._boundKey = (e) => {
                if (e.key === 'ArrowLeft')  { this.stop(); this.prev(); }
                if (e.key === 'ArrowRight') { this.stop(); this.next(); }
            };
            el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
            el.addEventListener('keydown', this._boundKey);
        }

        if (this.touch && el) {
            this._boundTouchStart = (e) => {
                this._touchStartX = e.changedTouches[0].clientX;
            };
            this._boundTouchEnd = (e) => {
                const dx = e.changedTouches[0].clientX - this._touchStartX;
                if (Math.abs(dx) > 40) {
                    this.stop();
                    dx < 0 ? this.next() : this.prev();
                }
            };
            el.addEventListener('touchstart', this._boundTouchStart, { passive: true });
            el.addEventListener('touchend',   this._boundTouchEnd,   { passive: true });
        }

        if (this.pauseOnHover && el) {
            this._boundMouseEnter = () => this.stop();
            this._boundMouseLeave = () => this.start();
            el.addEventListener('mouseenter', this._boundMouseEnter);
            el.addEventListener('mouseleave', this._boundMouseLeave);
        }
    }
}
