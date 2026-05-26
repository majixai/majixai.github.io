/**
 * TensorSimilarityEngine
 *
 * Uses TensorFlow.js + MobileNet to find performers that are visually similar
 * to one the user clicked, then awards them background tensor similarity points.
 * The model is loaded lazily on first use to avoid blocking page startup.
 *
 * Dependencies (loaded via CDN in index.html):
 *   - @tensorflow/tfjs
 *   - @tensorflow-models/mobilenet
 */
class TensorSimilarityEngine {
    /** @type {Object|null} Loaded MobileNet model */
    #_model = null;
    /** @type {Promise|null} In-flight model load promise (prevents duplicate loads) */
    #_modelPromise = null;
    /** Minimum cosine similarity to qualify as "similar" (0–1) */
    #_similarityThreshold = 0.5;
    /** Max number of similar performers to award per click */
    #_maxAwards = 10;
    /** Decay factor applied to similarity score before awarding points */
    #_decayFactor = 0.95;
    /** Decimal precision for computed award weights */
    #_weightPrecision = 4;
    /** Cached embeddings by image URL to avoid repeated inference */
    #_featureCache = new Map();
    /** Max cached image embeddings */
    #_maxFeatureCache = 600;
    /** Concurrent performer comparisons per click analysis */
    #_candidateConcurrency = 6;
    /** Concurrent candidate images scored per performer */
    #_imageConcurrency = 3;

    /**
     * Initialise (or return cached) MobileNet v2 model.
     * Safe to call multiple times — subsequent calls return the cached promise.
     * @returns {Promise<Object>} Loaded MobileNet model
     */
    async init() {
        if (this.#_model) return this.#_model;
        if (this.#_modelPromise) return this.#_modelPromise;

        if (typeof window.mobilenet === 'undefined') {
            throw new Error('MobileNet CDN not loaded. Ensure @tensorflow-models/mobilenet is in the page.');
        }

        this.#_modelPromise = window.mobilenet.load({ version: 2, alpha: 1.0 }).then(model => {
            this.#_model = model;
            console.log('TensorSimilarityEngine: MobileNet v2 loaded');
            return model;
        });

        return this.#_modelPromise;
    }

    /**
     * Analyse a click event in the background.
     * Extracts the MobileNet embedding for the clicked performer, then compares
     * it against all supplied performers. Those exceeding the similarity threshold
     * are passed to `onSimilarFound` so the caller can award them points.
     *
     * This method is fire-and-forget — intentionally not awaited by the caller.
     *
     * @param {Object}   clickedUser      - Performer object that was clicked (needs .username)
     * @param {Object[]} allUsers         - Full array of currently loaded performers
     * @param {Function} onSimilarFound   - Callback(username, similarity) invoked for each similar performer
     * @param {string}   clickedImageUrl  - Optional currently displayed slideshow image URL
     */
    async analyzeClick(clickedUser, allUsers, onSimilarFound, clickedImageUrl = null) {
        if (!clickedUser?.username) return;
        if (!Array.isArray(allUsers) || allUsers.length === 0) return;
        if (typeof onSimilarFound !== 'function') return;

        try {
            const model = await this.init();

            const clickedSource = clickedImageUrl || clickedUser.image_url;
            if (!clickedSource) return;

            const clickedFeatures = await this.#_getImageFeatures(model, clickedSource);
            if (!clickedFeatures) return;

            const candidates = allUsers.filter(u => u.username !== clickedUser.username && u.image_url);
            const results = (await this.#_runConcurrent(candidates, this.#_candidateConcurrency, async (user) => {
                try {
                    const urls = this.#_buildCandidateImageUrls(user);
                    let bestSimilarity = 0;

                    await this.#_runConcurrent(urls, this.#_imageConcurrency, async (url) => {
                        const features = await this.#_getImageFeatures(model, url);
                        if (!features) return;
                        const similarity = this.#_cosineSimilarity(clickedFeatures, features);
                        if (similarity > bestSimilarity) bestSimilarity = similarity;
                    });

                    if (bestSimilarity >= this.#_similarityThreshold) {
                        return { username: user.username, similarity: bestSimilarity };
                    }
                    return null;
                } catch (_) {
                    // Skip individual image errors silently
                    return null;
                }
            })).filter(Boolean);

            // Sort descending, cap to maxAwards
            results.sort((a, b) => b.similarity - a.similarity);
            const topResults = results.slice(0, this.#_maxAwards);

            for (const { username, similarity } of topResults) {
                const weight = parseFloat((similarity * this.#_decayFactor).toFixed(this.#_weightPrecision));
                if (weight > 0) {
                    onSimilarFound(username, weight);
                }
            }

            if (topResults.length > 0) {
                console.log(`TensorSimilarityEngine: awarded background points to ${topResults.length} performer(s) similar to ${clickedUser.username}`);
            }
        } catch (error) {
            console.warn('TensorSimilarityEngine.analyzeClick error:', error);
        }
    }

    /**
     * Extract a 1024-dim MobileNet embedding for an image URL.
     * @private
     * @param {Object} model    - Loaded MobileNet model
     * @param {string} imageUrl - URL of the image to analyse
     * @returns {Promise<number[]|null>} Feature vector or null on failure
     */
    async #_getImageFeatures(model, imageUrl) {
        if (this.#_featureCache.has(imageUrl)) {
            const cached = this.#_featureCache.get(imageUrl);
            this.#_featureCache.delete(imageUrl);
            this.#_featureCache.set(imageUrl, cached);
            return cached;
        }
        try {
            const img = await this.#_loadImageElement(imageUrl);
            const tensor = model.infer(img, true); // true = use embedding layer
            const data = await tensor.data();
            tensor.dispose();
            const features = Array.from(data);
            this.#_rememberFeatures(imageUrl, features);
            return features;
        } catch (_) {
            return null;
        }
    }

    /**
     * Build candidate image URLs for similarity matching, capped for performance.
     * @private
     * @param {Object} user
     * @returns {string[]}
     */
    #_buildCandidateImageUrls(user) {
        const seen = new Set();
        const urls = [];

        const addUrl = (url) => {
            if (typeof url !== 'string') return;
            const trimmed = url.trim();
            if (!trimmed || seen.has(trimmed)) return;
            seen.add(trimmed);
            urls.push(trimmed);
        };

        addUrl(user?.image_url);
        if (Array.isArray(user?.image_history)) {
            user.image_history.slice(0, 6).forEach(addUrl);
        }

        return urls.slice(0, 6);
    }

    /**
     * Maintain a small LRU cache of feature vectors.
     * @private
     * @param {string} imageUrl
     * @param {number[]} features
     */
    #_rememberFeatures(imageUrl, features) {
        if (!imageUrl || !features) return;
        if (this.#_featureCache.size >= this.#_maxFeatureCache) {
            const oldestKey = this.#_featureCache.keys().next().value;
            this.#_featureCache.delete(oldestKey);
        }
        this.#_featureCache.set(imageUrl, features);
    }

    /**
     * Concurrent runner with bounded worker count.
     * @private
     * @template T,R
     * @param {T[]} items
     * @param {number} limit
     * @param {(item:T, index:number)=>Promise<R>|R} worker
     * @returns {Promise<R[]>}
     */
    async #_runConcurrent(items, limit, worker) {
        if (!Array.isArray(items) || items.length === 0) return [];
        const concurrency = Math.max(1, Math.min(limit || 1, items.length));
        const results = new Array(items.length);
        let nextIndex = 0;

        const runners = Array.from({ length: concurrency }, async () => {
            while (nextIndex < items.length) {
                const idx = nextIndex++;
                results[idx] = await worker(items[idx], idx);
                if (idx % 5 === 0) {
                    await this.#_yieldToMainThread();
                }
            }
        });

        await Promise.all(runners);
        return results;
    }

    /**
     * Yield control so long-running analysis remains responsive.
     * @private
     * @returns {Promise<void>}
     */
    async #_yieldToMainThread() {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * Load an image URL into an HTMLImageElement, respecting CORS.
     * @private
     * @param {string} url
     * @returns {Promise<HTMLImageElement>}
     */
    #_loadImageElement(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }

    /**
     * Cosine similarity between two equal-length vectors.
     * @private
     * @param {number[]} vec1
     * @param {number[]} vec2
     * @returns {number} Similarity in [0, 1]
     */
    #_cosineSimilarity(vec1, vec2) {
        let dot = 0, norm1 = 0, norm2 = 0;
        for (let i = 0; i < vec1.length; i++) {
            dot   += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
        return denom === 0 ? 0 : dot / denom;
    }
}
