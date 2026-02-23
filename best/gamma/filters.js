/**
 * FilterEngine provides static methods for filtering user data
 * based on tags, age, viewer count, and new-user status.
 */
class FilterEngine {
    /**
     * Filter users by the given criteria. All active filters are combined with AND logic.
     * @param {Object[]} users - Array of user objects (raw API shape with tags, age, num_viewers, is_new).
     * @param {{ tags: string[], ages: number[], minViewers: number|null, isNew: boolean|null }} criteria
     * @returns {Object[]} Filtered array of users.
     */
    static apply(users, criteria) {
        if (!Array.isArray(users)) return [];
        if (!criteria) return users;

        return users.filter(user => {
            if (!FilterEngine.#matchesTags(user, criteria.tags)) return false;
            if (!FilterEngine.#matchesAge(user, criteria.ages)) return false;
            if (!FilterEngine.#matchesMinViewers(user, criteria.minViewers)) return false;
            if (!FilterEngine.#matchesIsNew(user, criteria.isNew)) return false;
            return true;
        });
    }

    /**
     * Return a human-readable summary of active filters.
     * @param {{ tags: string[], ages: number[], minViewers: number|null, isNew: boolean|null }} criteria
     * @returns {string} Summary string, e.g. "Tags: foo, bar | Age: 21-30 | Min viewers: 50 | New only"
     */
    static getActiveFilterSummary(criteria) {
        if (!criteria) return 'No filters active';

        const parts = [];

        if (Array.isArray(criteria.tags) && criteria.tags.length > 0) {
            parts.push(`Tags: ${criteria.tags.join(', ')}`);
        }

        if (Array.isArray(criteria.ages) && criteria.ages.length > 0) {
            parts.push(`Age: ${[...criteria.ages].sort((a, b) => a - b).join(', ')}`);
        }

        if (criteria.minViewers != null) {
            parts.push(`Min viewers: ${criteria.minViewers}`);
        }

        if (criteria.isNew != null) {
            parts.push(criteria.isNew ? 'New only' : 'Not new only');
        }

        return parts.length > 0 ? parts.join(' | ') : 'No filters active';
    }

    // --- Private helpers ---

    /**
     * Check if a user has any of the required tags (OR logic, case-insensitive).
     * @param {Object} user
     * @param {string[]|undefined} tags
     * @returns {boolean}
     */
    static #matchesTags(user, tags) {
        if (!Array.isArray(tags) || tags.length === 0) return true;
        const userTags = (Array.isArray(user.tags) ? user.tags : [])
            .map(t => typeof t === 'string' ? t.toLowerCase() : '');
        return tags.some(tag => userTags.includes(tag.toLowerCase()));
    }

    /**
     * Check if a user's age is one of the specified ages, or falls within the
     * range when exactly two ages define a min/max boundary.
     * @param {Object} user
     * @param {number[]|undefined} ages
     * @returns {boolean}
     */
    static #matchesAge(user, ages) {
        if (!Array.isArray(ages) || ages.length === 0) return true;
        if (user.age == null || typeof user.age !== 'number') return false;
        return ages.includes(user.age);
    }

    /**
     * Check if a user meets the minimum viewer count.
     * Reads num_viewers (raw API) or numViewers (view-model).
     * @param {Object} user
     * @param {number|null|undefined} minViewers
     * @returns {boolean}
     */
    static #matchesMinViewers(user, minViewers) {
        if (minViewers == null) return true;
        const viewers = user.num_viewers ?? user.numViewers ?? 0;
        return viewers >= minViewers;
    }

    /**
     * Check if a user matches the "is new" filter.
     * Reads is_new (raw API) or isNew (view-model).
     * @param {Object} user
     * @param {boolean|null|undefined} isNew
     * @returns {boolean}
     */
    static #matchesIsNew(user, isNew) {
        if (isNew == null) return true;
        const userIsNew = user.is_new ?? user.isNew;
        return userIsNew === isNew;
    }
}
