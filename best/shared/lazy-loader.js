/**
 * @file Shared lazy-loading utility for the Best suite.
 * @description Provides a global LazyImageObserver that swaps data-src → src
 * as images enter the viewport, and a scheduleIdleTask helper that defers
 * non-critical work via requestIdleCallback (with a setTimeout fallback).
 */

'use strict';

/* ─── Transparent 1×1 placeholder ─────────────────────────────────────────── */
const LAZY_PLACEHOLDER =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/* ─── LazyImageObserver ────────────────────────────────────────────────────── */
const LazyImageObserver = (() => {
    /** @type {IntersectionObserver|null} */
    let _observer = null;

    function _getObserver() {
        if (!_observer) {
            _observer = new IntersectionObserver(
                (entries, obs) => {
                    entries.forEach(entry => {
                        if (!entry.isIntersecting) return;
                        const img = entry.target;
                        const src = img.dataset.src;
                        if (src) {
                            img.src = src;
                            img.removeAttribute('data-src');
                        }
                        obs.unobserve(img);
                    });
                },
                {
                    rootMargin: '300px 0px', // load 300 px before entering viewport
                    threshold: 0
                }
            );
        }
        return _observer;
    }

    return {
        /**
         * Begin observing an <img> element that has a data-src attribute.
         * @param {HTMLImageElement} img
         */
        observe(img) {
            if (!img) return;
            _getObserver().observe(img);
        },

        /**
         * Observe every data-src image inside a container element.
         * @param {Element} container
         */
        observeAll(container) {
            if (!container) return;
            container.querySelectorAll('img[data-src]').forEach(img => this.observe(img));
        },

        /** Disconnect and reset (useful on SPA navigation). */
        reset() {
            if (_observer) {
                _observer.disconnect();
                _observer = null;
            }
        }
    };
})();

/* ─── SentinelObserver factory ─────────────────────────────────────────────── */
/**
 * Creates an IntersectionObserver that fires a callback once when a sentinel
 * element (appended to the bottom of a scroll container) becomes visible.
 * The observer automatically disconnects after the first intersection, and
 * the caller is responsible for appending a new sentinel when more items are added.
 *
 * @param {Function} onIntersect  Called with no arguments when the sentinel is visible.
 * @param {Element|null} root     Scroll container (null → viewport).
 * @returns {IntersectionObserver}
 */
function createSentinelObserver(onIntersect, root = null) {
    return new IntersectionObserver(
        (entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                obs.unobserve(entry.target);
                onIntersect();
            });
        },
        { root, rootMargin: '200px 0px', threshold: 0 }
    );
}

/* ─── Background task scheduler ────────────────────────────────────────────── */
/**
 * Schedule a callback to run during browser idle time.
 * Falls back to setTimeout(fn, 0) in environments without requestIdleCallback.
 *
 * @param {Function} fn
 * @param {{ timeout?: number }} [options]
 */
function scheduleIdleTask(fn, options = {}) {
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(fn, { timeout: options.timeout || 2000 });
    } else {
        setTimeout(fn, 0);
    }
}
