// relevance-scorer.js
(function () {
    class RelevanceScorer {
        constructor(options) {
            this.options = Object.assign({
                weights: {
                    viewers: 0.5,
                    clicks: 0.25,
                    freshness: 0.1,
                    tagMatch: 0.1,
                    gpuFeature: 0.05
                },
                getClickCount: () => 0,
                getGpuFeatureScore: () => 0
            }, options || {});
            this._lastScores = new Map();
        }

        rankUsers(users, context) {
            const list = Array.isArray(users) ? users.slice() : [];
            const ctx = Object.assign({ selectedTags: [] }, context || {});
            const maxViewers = Math.max(1, ...list.map(u => Number(u?.num_viewers || 0)));
            const maxClicks = Math.max(1, ...list.map(u => Number(this.options.getClickCount(u) || 0)));
            const normalizedTags = (ctx.selectedTags || []).map(t => String(t || '').toLowerCase()).filter(Boolean);
            const backendBonus = this.#getGpuBackendBonus();

            list.forEach((user) => {
                const viewers = Number(user?.num_viewers || 0);
                const clicks = Number(this.options.getClickCount(user) || 0);
                const gpuFeature = Number(this.options.getGpuFeatureScore(user) || 0);
                const freshness = user?.is_new ? 1 : 0;
                const userTags = (Array.isArray(user?.tags) ? user.tags : []).map(t => String(t || '').toLowerCase());
                const tagMatches = normalizedTags.length
                    ? normalizedTags.filter(t => userTags.includes(t)).length / normalizedTags.length
                    : 0;

                const score =
                    (viewers / maxViewers) * this.options.weights.viewers +
                    (clicks / maxClicks) * this.options.weights.clicks +
                    freshness * this.options.weights.freshness +
                    tagMatches * this.options.weights.tagMatch +
                    (gpuFeature / 100) * this.options.weights.gpuFeature +
                    backendBonus;

                const rounded = Number(score.toFixed(4));
                user.relevanceScore = rounded;
                user.gpuScore = Number(gpuFeature.toFixed(2));
                this._lastScores.set(user.username, rounded);
            });

            return list.sort((a, b) => {
                const aScore = this._lastScores.get(a.username) || 0;
                const bScore = this._lastScores.get(b.username) || 0;
                if (bScore !== aScore) return bScore - aScore;
                return (Number(b.num_viewers || 0) - Number(a.num_viewers || 0));
            });
        }

        getScore(username) {
            return this._lastScores.get(username) || 0;
        }

        #getGpuBackendBonus() {
            if (!window.tf || typeof window.tf.getBackend !== 'function') return 0;
            const backend = window.tf.getBackend();
            if (backend === 'webgpu') return 0.03;
            if (backend === 'webgl') return 0.02;
            return 0;
        }
    }

    window.RelevanceScorer = RelevanceScorer;
})();
