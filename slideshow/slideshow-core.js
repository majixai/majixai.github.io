// slideshow-core.js — v2
// Shared SlideshowManager — use from any directory via /slideshow/slideshow-core.js

/**
 * SlideshowManager v2 — auto-rotating image slideshow with transitions,
 * captions, dot indicators, callbacks, loop control, autoResume, preloading,
 * progress bar, slide counter, keyboard navigation, and touch/swipe support.
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
     *
     * ── Timing ─────────────────────────────────────────────────────────────────
     * @param {number}      [options.minDelay=2000]          Minimum ms per slide.
     * @param {number}      [options.maxDelay=6000]          Maximum ms per slide.
     * @param {number}      [options.fixedDelay=0]           Fixed ms per slide (overrides min/max when > 0).
     * @param {number}      [options.autoResumeDelay=0]      Resume auto-rotation N ms after a manual
     *                                                       navigation (0 = never resume automatically).
     * @param {boolean}     [options.loop=true]              Loop back to start at the end.
     *
     * ── Transition ─────────────────────────────────────────────────────────────
     * @param {string}      [options.transition='fade']      'fade' | 'slide' | 'zoom' | 'none'
     * @param {number}      [options.transitionDuration=300] Transition animation duration in ms.
     *
     * ── Controls ───────────────────────────────────────────────────────────────
     * @param {HTMLElement} [options.progressBar]            Optional progress-bar element.
     * @param {HTMLElement} [options.counter]                Optional counter element ("N/M").
     * @param {HTMLElement} [options.prevBtn]                Optional previous-button element.
     * @param {HTMLElement} [options.nextBtn]                Optional next-button element.
     * @param {HTMLElement} [options.container]              Container for keyboard/touch binding.
     * @param {boolean}     [options.keyboard=false]         Enable ← / → key navigation.
     * @param {boolean}     [options.touch=false]            Enable touch/swipe navigation.
     * @param {boolean}     [options.pauseOnHover=false]     Pause slideshow while hovered.
     *
     * ── Captions & alt text ────────────────────────────────────────────────────
     * @param {string[]}    [options.captions=[]]            Caption strings aligned with images[].
     * @param {HTMLElement} [options.captionEl]              Element to inject caption text into.
     * @param {string[]}    [options.alts=[]]                Alt text strings aligned with images[].
     *
     * ── Dot indicators ─────────────────────────────────────────────────────────
     * @param {HTMLElement} [options.dotsContainer]          Container; dot buttons are auto-generated.
     *
     * ── Preloading ─────────────────────────────────────────────────────────────
     * @param {boolean}     [options.preload=true]           Preload the next image in background.
     *
     * ── Callbacks ──────────────────────────────────────────────────────────────
     * @param {Function}    [options.onChange]               (index, url, caption) — called on slide change.
     * @param {Function}    [options.onStart]                () — called when auto-rotation starts.
     * @param {Function}    [options.onStop]                 () — called when auto-rotation stops.
     */
    constructor(imgElement, images, options = {}) {
        this.imgElement   = imgElement;
        this.images       = images.filter(Boolean);
        this.currentIndex = 0;
        this.timeoutId    = null;
        this.isRunning    = false;
        this._paused      = false;
        this._resumeTimerId = null;

        // Timing
        this.minDelay        = options.minDelay        || 2000;
        this.maxDelay        = options.maxDelay        || 6000;
        this.fixedDelay      = options.fixedDelay      || 0;
        this.autoResumeDelay = options.autoResumeDelay || 0;
        this.loop            = options.loop !== false;

        // Transition
        this.transition         = options.transition || 'fade';
        this.transitionDuration = options.transitionDuration != null ? options.transitionDuration : 300;

        // Controls
        this.progressBar  = options.progressBar  || null;
        this.counter      = options.counter      || null;
        this.prevBtn      = options.prevBtn      || null;
        this.nextBtn      = options.nextBtn      || null;
        this.container    = options.container    || null;
        this.keyboard     = !!options.keyboard;
        this.touch        = !!options.touch;
        this.pauseOnHover = !!options.pauseOnHover;

        // Captions & alts
        this.captions  = Array.isArray(options.captions) ? options.captions.slice() : [];
        this.captionEl = options.captionEl || null;
        this.alts      = Array.isArray(options.alts) ? options.alts.slice() : [];

        // Dots
        this.dotsContainer = options.dotsContainer || null;
        this._dots         = [];
        this._dotHandlers  = [];

        // Preloading
        this.preload = options.preload !== false;

        // Callbacks
        this.onChange = typeof options.onChange === 'function' ? options.onChange : null;
        this.onStart  = typeof options.onStart  === 'function' ? options.onStart  : null;
        this.onStop   = typeof options.onStop   === 'function' ? options.onStop   : null;

        // Bound listeners (for cleanup)
        this._boundKey        = null;
        this._touchStartX     = 0;
        this._touchStartY     = 0;
        this._boundTouchStart = null;
        this._boundTouchEnd   = null;
        this._boundMouseEnter = null;
        this._boundMouseLeave = null;
        this._boundPrev       = null;
        this._boundNext       = null;

        this._buildDots();
        this._attachControls();
        this._updateUI();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Start the auto-rotation. No-op if already running or fewer than 2 images. */
    start() {
        if (this.isRunning || this.images.length < 2) return;
        this._paused   = false;
        this.isRunning = true;
        if (this.onStart) this.onStart();
        this._scheduleNext();
    }

    /** Stop the auto-rotation. */
    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this._paused   = false;
        clearTimeout(this._resumeTimerId);
        this._resumeTimerId = null;
        if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
        this._resetProgressBar();
        if (this.onStop) this.onStop();
    }

    /**
     * Navigate to a specific index.
     * @param {number} index  Wraps around unless loop is false.
     */
    goTo(index) {
        const len = this.images.length;
        if (!len) return;
        const prev = this.currentIndex;
        let   idx  = this.loop
            ? (index < 0 ? (index % len) + len : index % len)
            : Math.max(0, Math.min(len - 1, index));
        this.currentIndex = idx;
        this._showCurrent(idx >= prev ? 'next' : 'prev');
    }

    /** Show the next image. */
    next() {
        const len = this.images.length;
        if (!len) return;
        if (!this.loop && this.currentIndex >= len - 1) return;
        this.currentIndex = (this.currentIndex + 1) % len;
        this._showCurrent('next');
    }

    /** Show the previous image. */
    prev() {
        const len = this.images.length;
        if (!len) return;
        if (!this.loop && this.currentIndex <= 0) return;
        this.currentIndex = (this.currentIndex - 1 + len) % len;
        this._showCurrent('prev');
    }

    /**
     * Append one or more images to the slideshow.
     * @param {string|string[]} urls       Image URL or array of URLs.
     * @param {string[]}        [captions] Captions aligned with urls.
     * @param {string[]}        [alts]     Alt texts aligned with urls.
     */
    addImages(urls, captions, alts) {
        const arr = Array.isArray(urls) ? urls : [urls];
        arr.forEach((url, i) => {
            if (!url) return;
            this.images.push(url);
            this.captions.push((captions && captions[i]) || '');
            this.alts.push((alts && alts[i]) || '');
        });
        this._buildDots();
        this._updateUI();
    }

    /**
     * Replace the entire image list and reset to slide 0.
     * @param {string[]} urls
     * @param {string[]} [captions]
     * @param {string[]} [alts]
     */
    setImages(urls, captions, alts) {
        const wasRunning = this.isRunning;
        this.stop();
        this.images   = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
        this.captions = captions ? captions.slice() : [];
        this.alts     = alts     ? alts.slice()     : [];
        this.currentIndex = 0;
        this._buildDots();
        this._showCurrent('next');
        if (wasRunning) this.start();
    }

    /**
     * Remove the image at the given index.
     * @param {number} index
     */
    removeImage(index) {
        if (index < 0 || index >= this.images.length) return;
        this.images.splice(index, 1);
        this.captions.splice(index, 1);
        this.alts.splice(index, 1);
        if (this.currentIndex >= this.images.length) {
            this.currentIndex = Math.max(0, this.images.length - 1);
        }
        this._buildDots();
        this._showCurrent('next');
    }

    /**
     * Returns a snapshot of the current state.
     * @returns {{ index: number, total: number, url: string, caption: string, alt: string, isRunning: boolean }}
     */
    getState() {
        return {
            index:     this.currentIndex,
            total:     this.images.length,
            url:       this.images[this.currentIndex] || '',
            caption:   this.captions[this.currentIndex] || '',
            alt:       this.alts[this.currentIndex] || '',
            isRunning: this.isRunning,
        };
    }

    /**
     * Detach all event listeners and clear timers.
     * Call before discarding the manager to avoid memory leaks.
     */
    destroy() {
        this.stop();
        clearTimeout(this._resumeTimerId);
        const el = this.container || this.imgElement;
        if (this._boundKey        && el) el.removeEventListener('keydown',    this._boundKey);
        if (this._boundTouchStart && el) el.removeEventListener('touchstart', this._boundTouchStart);
        if (this._boundTouchEnd   && el) el.removeEventListener('touchend',   this._boundTouchEnd);
        if (this._boundMouseEnter && el) el.removeEventListener('mouseenter', this._boundMouseEnter);
        if (this._boundMouseLeave && el) el.removeEventListener('mouseleave', this._boundMouseLeave);
        if (this.prevBtn && this._boundPrev) this.prevBtn.removeEventListener('click', this._boundPrev);
        if (this.nextBtn && this._boundNext) this.nextBtn.removeEventListener('click', this._boundNext);
        this._dots.forEach((d, i) => d.removeEventListener('click', this._dotHandlers[i]));
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
     * Load images from a plain JSON file containing an array of URL strings,
     * or an object with `images`, optional `captions`, and optional `alts` arrays.
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
            const data     = await response.json();
            const urls     = [...new Set(
                (Array.isArray(data) ? data : (data.images || [])).filter(Boolean)
            )];
            const captions = (!Array.isArray(data) && data.captions) ? data.captions : [];
            const alts     = (!Array.isArray(data) && data.alts)     ? data.alts     : [];
            return new SlideshowManager(imgElement, urls, { captions, alts, ...options });
        } catch (e) {
            console.warn(`SlideshowManager.fromJsonUrl: could not load ${jsonUrl}:`, e.message);
            const fallback = imgElement && imgElement.src ? [imgElement.src] : [];
            return new SlideshowManager(imgElement, fallback, options);
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    _showCurrent(direction) {
        if (!this.images.length) return;
        direction = direction || 'next';
        const url     = this.images[this.currentIndex];
        const caption = this.captions[this.currentIndex] || '';
        const alt     = this.alts[this.currentIndex]     || '';

        if (this.imgElement) this._applyTransition(url, alt, direction);
        this._updateUI();
        this._preloadNext();
        if (this.onChange) this.onChange(this.currentIndex, url, caption);
    }

    _applyTransition(url, alt, direction) {
        const img = this.imgElement;
        const dur = this.transitionDuration;

        if (this.transition === 'none') {
            img.src = url;
            if (alt) img.alt = alt;
            return;
        }

        if (this.transition === 'zoom') {
            img.style.transition = 'none';
            img.style.transform  = 'scale(1)';
            img.style.opacity    = '1';
            void img.offsetWidth;
            img.style.transition = `opacity ${dur}ms ease, transform ${dur}ms ease`;
            img.style.opacity    = '0';
            img.style.transform  = 'scale(1.07)';
            setTimeout(() => {
                img.src = url;
                if (alt) img.alt = alt;
                img.style.opacity   = '1';
                img.style.transform = 'scale(1)';
            }, dur);
            return;
        }

        if (this.transition === 'slide') {
            // Exit direction: next → slide out to the left; prev → slide out to the right
            const exitTo   = direction === 'prev' ?  '100%' : '-100%';
            const enterFrom = direction === 'prev' ? '-100%' :  '100%';
            img.style.transition = 'none';
            img.style.transform  = 'translateX(0)';
            img.style.opacity    = '1';
            void img.offsetWidth;
            img.style.transition = `transform ${dur}ms ease, opacity ${dur}ms ease`;
            img.style.transform  = `translateX(${exitTo})`;
            img.style.opacity    = '0';
            setTimeout(() => {
                img.style.transition = 'none';
                img.src = url;
                if (alt) img.alt = alt;
                img.style.transform  = `translateX(${enterFrom})`;
                img.style.opacity    = '0';
                void img.offsetWidth;
                img.style.transition = `transform ${dur}ms ease, opacity ${dur}ms ease`;
                img.style.transform  = 'translateX(0)';
                img.style.opacity    = '1';
            }, dur);
            return;
        }

        // default: fade
        img.style.transition = `opacity ${dur}ms ease`;
        img.style.opacity    = '0';
        setTimeout(() => {
            img.src = url;
            if (alt) img.alt = alt;
            img.style.opacity = '1';
        }, dur);
    }

    _updateUI() {
        if (this.counter && this.images.length) {
            this.counter.textContent = `${this.currentIndex + 1}/${this.images.length}`;
        }
        const caption = this.captions[this.currentIndex] || '';
        if (this.captionEl) {
            this.captionEl.textContent   = caption;
            this.captionEl.style.display = caption ? '' : 'none';
        }
        this._updateDots();
    }

    _buildDots() {
        if (!this.dotsContainer) return;
        this._dots.forEach((d, i) => d.removeEventListener('click', this._dotHandlers[i]));
        this.dotsContainer.innerHTML = '';
        this._dots        = [];
        this._dotHandlers = [];
        this.images.forEach((_, i) => {
            const btn = document.createElement('button');
            btn.type      = 'button';
            btn.className = 'slide-dot' + (i === this.currentIndex ? ' active' : '');
            btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
            const handler = () => {
                const wasRunning = this.isRunning;
                if (wasRunning) this._stopSilent();
                this.currentIndex = i;
                this._showCurrent('next');
                this._scheduleResume(wasRunning);
            };
            this._dotHandlers.push(handler);
            btn.addEventListener('click', handler);
            this.dotsContainer.appendChild(btn);
            this._dots.push(btn);
        });
    }

    _updateDots() {
        this._dots.forEach((d, i) => d.classList.toggle('active', i === this.currentIndex));
    }

    _resetProgressBar() {
        if (this.progressBar) {
            this.progressBar.style.transition = 'none';
            this.progressBar.style.width      = '0%';
        }
    }

    /** Internal stop that skips the onStop callback (used by pauseOnHover). */
    _stopSilent() {
        this.isRunning = false;
        if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
        this._resetProgressBar();
    }

    _scheduleNext() {
        if (!this.isRunning) return;
        const delay = this.fixedDelay > 0
            ? this.fixedDelay
            : Math.floor(Math.random() * (this.maxDelay - this.minDelay)) + this.minDelay;

        if (this.progressBar) {
            this._resetProgressBar();
            void this.progressBar.offsetWidth;
            this.progressBar.style.transition = `width ${delay}ms linear`;
            this.progressBar.style.width      = '100%';
        }

        this.timeoutId = setTimeout(() => {
            if (!this.loop && this.currentIndex >= this.images.length - 1) {
                this.stop();
                return;
            }
            this.currentIndex = (this.currentIndex + 1) % this.images.length;
            this._showCurrent('next');
            this._scheduleNext();
        }, delay);
    }

    _scheduleResume(shouldResume) {
        if (!shouldResume || !this.autoResumeDelay) return;
        clearTimeout(this._resumeTimerId);
        this._resumeTimerId = setTimeout(() => this.start(), this.autoResumeDelay);
    }

    _preloadNext() {
        if (!this.preload || this.images.length < 2) return;
        const preloader = new Image();
        preloader.src   = this.images[(this.currentIndex + 1) % this.images.length];
    }

    _attachControls() {
        const el = this.container || this.imgElement;

        if (this.prevBtn) {
            this._boundPrev = () => {
                const wasRunning = this.isRunning;
                if (wasRunning) this._stopSilent();
                this.prev();
                this._scheduleResume(wasRunning);
            };
            this.prevBtn.addEventListener('click', this._boundPrev);
        }
        if (this.nextBtn) {
            this._boundNext = () => {
                const wasRunning = this.isRunning;
                if (wasRunning) this._stopSilent();
                this.next();
                this._scheduleResume(wasRunning);
            };
            this.nextBtn.addEventListener('click', this._boundNext);
        }

        if (this.keyboard && el) {
            this._boundKey = (e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                const wasRunning = this.isRunning;
                if (wasRunning) this._stopSilent();
                e.key === 'ArrowLeft' ? this.prev() : this.next();
                this._scheduleResume(wasRunning);
            };
            el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
            el.addEventListener('keydown', this._boundKey);
        }

        if (this.touch && el) {
            this._boundTouchStart = (e) => {
                this._touchStartX = e.changedTouches[0].clientX;
                this._touchStartY = e.changedTouches[0].clientY;
            };
            this._boundTouchEnd = (e) => {
                const dx = e.changedTouches[0].clientX - this._touchStartX;
                const dy = e.changedTouches[0].clientY - this._touchStartY;
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
                    const wasRunning = this.isRunning;
                    if (wasRunning) this._stopSilent();
                    dx < 0 ? this.next() : this.prev();
                    this._scheduleResume(wasRunning);
                }
            };
            el.addEventListener('touchstart', this._boundTouchStart, { passive: true });
            el.addEventListener('touchend',   this._boundTouchEnd,   { passive: true });
        }

        if (this.pauseOnHover && el) {
            // Use silent pause/resume so onStop/onStart are not triggered by hover
            this._boundMouseEnter = () => {
                if (!this.isRunning) return;
                this._paused = true;
                this._stopSilent();
            };
            this._boundMouseLeave = () => {
                if (!this._paused) return;
                this._paused   = false;
                this.isRunning = true;
                this._scheduleNext();
            };
            el.addEventListener('mouseenter', this._boundMouseEnter);
            el.addEventListener('mouseleave', this._boundMouseLeave);
        }
    }
}
