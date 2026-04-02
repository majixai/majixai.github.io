// slideshow-manager.js
// Enhanced SlideshowManager that actually updates DOM img elements

class SlideshowManager {
    /**
     * @param {HTMLImageElement} imgElement - The <img> element to update
     * @param {string[]} images - Array of image URLs
     * @param {Object} [options]
     * @param {number} [options.minDelay=2000] - Minimum ms per slide
     * @param {number} [options.maxDelay=6000] - Maximum ms per slide
     * @param {HTMLElement} [options.progressBar] - Optional progress bar element
     * @param {HTMLElement} [options.counter] - Optional counter element (shows "N/M")
     */
    constructor(imgElement, images, options = {}) {
        this.imgElement = imgElement;
        this.images = images.filter(Boolean);
        this.currentIndex = 0;
        this.timeoutId = null;
        this.isRunning = false;
        this.minDelay = options.minDelay || 2000;
        this.maxDelay = options.maxDelay || 6000;
        this.progressBar = options.progressBar || null;
        this.counter = options.counter || null;
    }

    /** Start the slideshow */
    start() {
        if (this.isRunning || this.images.length < 2) return;
        this.isRunning = true;
        this._scheduleNext();
    }

    /** Stop the slideshow */
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

    /** Go to a specific index */
    goTo(index) {
        const len = this.images.length;
        this.currentIndex = index < 0 ? (index % len) + len : index % len;
        this._showCurrent();
    }

    /** Next image */
    next() {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this._showCurrent();
    }

    /** Previous image */
    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this._showCurrent();
    }

    _showCurrent() {
        const url = this.images[this.currentIndex];
        if (this.imgElement) {
            this.imgElement.style.opacity = '0.4';
            setTimeout(() => {
                this.imgElement.src = url;
                this.imgElement.style.opacity = '1';
            }, 250);
        }
        if (this.counter) {
            this.counter.textContent = `${this.currentIndex + 1}/${this.images.length}`;
        }
    }

    _scheduleNext() {
        if (!this.isRunning) return;
        const delay = Math.floor(Math.random() * (this.maxDelay - this.minDelay)) + this.minDelay;

        if (this.progressBar) {
            this.progressBar.style.transition = 'none';
            this.progressBar.style.width = '0%';
            void this.progressBar.offsetWidth;
            this.progressBar.style.transition = `width ${delay}ms linear`;
            this.progressBar.style.width = '100%';
        }

        this.timeoutId = setTimeout(() => {
            this.currentIndex = (this.currentIndex + 1) % this.images.length;
            this._showCurrent();
            this._scheduleNext();
        }, delay);
    }

    /**
     * Static factory: load images from a .dat file (newline-separated URLs).
     * @param {HTMLImageElement} imgElement
     * @param {string} datUrl - URL of the .dat file
     * @param {Object} [options]
     * @returns {Promise<SlideshowManager>}
     */
    static async fromDatFile(imgElement, datUrl, options = {}) {
        try {
            const response = await fetch(datUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            const urls = [...new Set(
                text.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'))
            )];
            return new SlideshowManager(imgElement, urls, options);
        } catch (e) {
            console.warn(`SlideshowManager: Could not load ${datUrl}:`, e.message);
            return new SlideshowManager(imgElement, imgElement.src ? [imgElement.src] : [], options);
        }
    }
}
