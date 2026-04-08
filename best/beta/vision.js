/**
 * VisionScorer
 *
 * GPU-accelerated image feature scoring using TensorFlow.js + MobileNet.
 * Classifies performer card images against a domain-specific feature taxonomy
 * (lingerie, couple, toy, etc.) by mapping MobileNet's ImageNet-1000 predictions
 * to custom categories via pattern matching.
 *
 * Results are cached by image URL to avoid redundant GPU inference.
 * Background periodic analysis keeps cards up-to-date as they enter the DOM.
 *
 * Dependencies (loaded via CDN in index.html):
 *   - @tensorflow/tfjs
 *   - @tensorflow-models/mobilenet
 *
 * Usage:
 *   window.visionScorer = new VisionScorer();
 *   window.visionScorer.init().catch(() => {});
 */
class VisionScorer {
    /** @type {Object|null} Loaded MobileNet model */
    #_model = null;
    /** @type {Promise|null} In-flight model load promise */
    #_modelPromise = null;
    /** @type {Map<string, Object>} imageUrl → scoring result cache */
    #_cache = new Map();
    /** @type {number|null} setInterval handle for background analysis */
    #_analysisTimer = null;
    /** @type {boolean} True once MobileNet has successfully loaded */
    #_isActive = false;
    /** Background analysis interval in ms */
    #_analysisInterval = 30_000;
    /** Max cache entries (LRU eviction when exceeded) */
    #_maxCache = 400;

    /**
     * Domain feature map: each entry matches label fragments from MobileNet's
     * ImageNet-1000 classes to a custom category and applies a confidence boost.
     * Entries are checked in order; the first match wins.
     */
    static #FEATURE_MAP = Object.freeze([
        { pattern: /brassiere|bra\b|corset/i,            category: 'lingerie',  boost: 1.00 },
        { pattern: /bikini|maillot|swimsuit/i,            category: 'lingerie',  boost: 0.85 },
        { pattern: /negligee|nightgown|chemise/i,         category: 'lingerie',  boost: 0.95 },
        { pattern: /miniskirt/i,                          category: 'lingerie',  boost: 0.80 },
        { pattern: /strapless/i,                          category: 'lingerie',  boost: 0.90 },
        { pattern: /trench\s*coat|overcoat/i,             category: 'lingerie',  boost: 0.40 },
        { pattern: /bust|cleavage/i,                      category: 'bigbs',     boost: 1.00 },
        { pattern: /two\s*person|couple|bridegroom/i,     category: 'couple',    boost: 0.85 },
        { pattern: /paddle|drumstick|sex.toy/i,           category: 'toy',       boost: 0.90 },
        { pattern: /spotlight|microphone|stage/i,         category: 'solo',      boost: 0.55 },
        { pattern: /\bgroup\b|crowd|team/i,               category: 'group',     boost: 0.70 },
    ]);

    /** Whether MobileNet has loaded and scoring is available. */
    get isActive() { return this.#_isActive; }

    /**
     * Load MobileNet v2 lazily. Safe to call multiple times.
     * @returns {Promise<Object|null>} Loaded model or null on failure.
     */
    async init() {
        if (this.#_model) return this.#_model;
        if (this.#_modelPromise) return this.#_modelPromise;

        if (typeof window.mobilenet === 'undefined') {
            console.warn('VisionScorer: MobileNet CDN not loaded.');
            return null;
        }

        this.#_modelPromise = window.mobilenet
            .load({ version: 2, alpha: 1.0 })
            .then(model => {
                this.#_model = model;
                this.#_isActive = true;
                console.log('VisionScorer: MobileNet v2 ready.');
                return model;
            })
            .catch(err => {
                console.warn('VisionScorer: model load failed:', err);
                this.#_modelPromise = null;
                return null;
            });

        return this.#_modelPromise;
    }

    /**
     * Return the cached feature score for an image URL, or 0 if not scored yet.
     * @param {string} imageUrl
     * @returns {number}
     */
    getCachedFeatureScore(imageUrl) {
        return this.#_cache.get(imageUrl)?.featureScore ?? 0;
    }

    /**
     * Return the full cached result for an image URL, or null.
     * @param {string} imageUrl
     * @returns {Object|null}
     */
    getCachedResult(imageUrl) {
        return this.#_cache.get(imageUrl) ?? null;
    }

    /**
     * Score an image by URL using MobileNet classification.
     * Results are cached; subsequent calls for the same URL are instant.
     *
     * @param {string} imageUrl
     * @returns {Promise<{label:string, confidence:number, featureScore:number, category:string, rawPredictions:Array}|null>}
     */
    async scoreImage(imageUrl) {
        if (!imageUrl) return null;
        if (this.#_cache.has(imageUrl)) return this.#_cache.get(imageUrl);

        const model = await this.init();
        if (!model) return null;

        try {
            const img = await this.#_loadImage(imageUrl);
            const predictions = await model.classify(img, 5);

            let bestMatch = null;
            let bestScore = 0;

            for (const pred of predictions) {
                const label = pred.className.toLowerCase();
                for (const entry of VisionScorer.#FEATURE_MAP) {
                    if (entry.pattern.test(label)) {
                        const score = pred.probability * entry.boost;
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = {
                                label:          pred.className,
                                confidence:     Math.round(pred.probability * 100),
                                featureScore:   parseFloat(score.toFixed(4)),
                                category:       entry.category,
                                rawPredictions: predictions,
                            };
                        }
                        break; // one category per prediction
                    }
                }
            }

            // Fallback: use top prediction with a reduced generic score
            if (!bestMatch && predictions.length > 0) {
                const top = predictions[0];
                bestMatch = {
                    label:          top.className,
                    confidence:     Math.round(top.probability * 100),
                    featureScore:   parseFloat((top.probability * 0.25).toFixed(4)),
                    category:       'other',
                    rawPredictions: predictions,
                };
            }

            if (bestMatch) {
                this.#_evictIfNeeded();
                this.#_cache.set(imageUrl, bestMatch);
            }

            return bestMatch;
        } catch (_) {
            return null;
        }
    }

    /**
     * Start periodic background analysis of visible performer cards.
     * Scores each card's current image, updates the `.card-vision` label,
     * and stores the featureScore on the card's dataset for sort integration.
     *
     * @param {Function} getCardElements - Returns an array/NodeList of .user-info card elements.
     * @param {number}   [interval]      - Override the default 30 s interval.
     */
    startBackgroundAnalysis(getCardElements, interval = this.#_analysisInterval) {
        this.stopBackgroundAnalysis();
        const analyse = async () => {
            if (!this.#_isActive) return;
            const cards = typeof getCardElements === 'function' ? getCardElements() : [];
            for (const card of cards) {
                const imgEl = card.querySelector('img.slide-img');
                if (!imgEl) continue;
                const src = imgEl.dataset.src || imgEl.src;
                if (!src || src.startsWith('data:')) continue; // skip placeholder
                try {
                    const result = await this.scoreImage(src);
                    if (!result) continue;
                    card.dataset.featureScore = result.featureScore;
                    const visionEl = card.querySelector('.card-vision');
                    if (visionEl) {
                        visionEl.textContent = `🔍 ${result.label} ${result.confidence}%`;
                        visionEl.style.display = '';
                    }
                } catch (_) { /* skip individual failures */ }
            }
        };
        // Run once immediately, then on interval
        scheduleIdleTask(analyse, { timeout: 5000 });
        this.#_analysisTimer = setInterval(() => scheduleIdleTask(analyse, { timeout: 5000 }), interval);
    }

    /** Stop background periodic analysis. */
    stopBackgroundAnalysis() {
        if (this.#_analysisTimer !== null) {
            clearInterval(this.#_analysisTimer);
            this.#_analysisTimer = null;
        }
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

    /**
     * Load an image URL into an HTMLImageElement, respecting CORS.
     * @private
     * @param {string} url
     * @returns {Promise<HTMLImageElement>}
     */
    #_loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`VisionScorer: failed to load ${url}`));
            img.src = url;
        });
    }

    /**
     * Evict the oldest entry when the cache exceeds #_maxCache.
     * @private
     */
    #_evictIfNeeded() {
        if (this.#_cache.size >= this.#_maxCache) {
            const firstKey = this.#_cache.keys().next().value;
            this.#_cache.delete(firstKey);
        }
    }
}
