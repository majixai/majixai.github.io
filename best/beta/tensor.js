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
     * @param {Object}   clickedUser    - Performer object that was clicked (needs .image_url, .username)
     * @param {Object[]} allUsers       - Full array of currently loaded performers
     * @param {Function} onSimilarFound - Callback(username, similarity) invoked for each similar performer
     */
    async analyzeClick(clickedUser, allUsers, onSimilarFound) {
        if (!clickedUser?.image_url || !clickedUser?.username) return;
        if (!Array.isArray(allUsers) || allUsers.length === 0) return;
        if (typeof onSimilarFound !== 'function') return;

        try {
            const model = await this.init();

            const clickedFeatures = await this.#_getImageFeatures(model, clickedUser.image_url);
            if (!clickedFeatures) return;

            const candidates = allUsers.filter(u => u.username !== clickedUser.username && u.image_url);
            const results = [];

            for (const user of candidates) {
                try {
                    const features = await this.#_getImageFeatures(model, user.image_url);
                    if (!features) continue;
                    const similarity = this.#_cosineSimilarity(clickedFeatures, features);
                    if (similarity >= this.#_similarityThreshold) {
                        results.push({ username: user.username, similarity });
                    }
                } catch (_) {
                    // Skip individual image errors silently
                }
            }

            // Sort descending, cap to maxAwards
            results.sort((a, b) => b.similarity - a.similarity);
            const topResults = results.slice(0, this.#_maxAwards);

            for (const { username, similarity } of topResults) {
                const weight = parseFloat((similarity * this.#_decayFactor).toFixed(4));
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
        try {
            const img = await this.#_loadImageElement(imageUrl);
            const tensor = model.infer(img, true); // true = use embedding layer
            const data = await tensor.data();
            tensor.dispose();
            return Array.from(data);
        } catch (_) {
            return null;
        }
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
