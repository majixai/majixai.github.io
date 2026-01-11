/**
 * @file Data fetching and processing logic for the Best Performers Engine.
 * @description Handles API calls, data decompression, filtering, and ranking.
 */

class DataAPI {
    #_cache;
    #_uniqueUsernames = new Set();
    #_currentOffset = 0;
    #_hasMoreData = true;
    #_allOnlinePerformers = [];

    /**
     * @param {object} cacheManager - Instance of CacheManager
     */
    constructor(cacheManager) {
        if (!cacheManager) {
            throw new Error("DataAPI requires a CacheManager instance.");
        }
        this.#_cache = cacheManager;
    }

    /**
     * Fetch performers from the live API
     * @param {Object} filters - Filter parameters
     * @param {number} offset - Pagination offset
     * @returns {Promise<Object>} { performers, hasMore, nextOffset }
     */
    async fetchOnlinePerformers(filters = {}, offset = 0) {
        const gender = filters.gender || AppConfig.DEFAULT_FILTERS.gender;
        const limit = AppConfig.API_LIMIT;
        const url = AppConfig.buildApiUrl({ gender, limit, offset });

        console.log(`DataAPI: Fetching performers (offset: ${offset}, gender: ${gender})`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`DataAPI: Aborting fetch due to timeout`);
                controller.abort();
            }, AppConfig.API_TIMEOUT);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();
            
            if (data && data.results && Array.isArray(data.results)) {
                // Filter to only include public performers (not in private shows)
                const publicPerformers = data.results.filter(p => 
                    p.current_show === 'public' && p.iframe_embed
                );

                console.log(`DataAPI: Received ${data.results.length} results, ${publicPerformers.length} are public`);
                
                return {
                    performers: publicPerformers,
                    hasMore: data.results.length === limit,
                    nextOffset: offset + data.results.length
                };
            }

            return { performers: [], hasMore: false, nextOffset: offset };
        } catch (error) {
            console.error(`DataAPI: Fetch error:`, error);
            throw error;
        }
    }

    /**
     * Get performers with filtering, sorting, and ranking
     * @param {Object} options - Options for fetching
     * @returns {Promise<Array<Object>>}
     */
    async getPerformers(options = {}) {
        const {
            forceRefresh = false,
            filters = {},
            page = 1,
            perPage = AppConfig.PERFORMERS_PER_PAGE
        } = options;

        // Check cache first
        if (!forceRefresh) {
            const lastFetch = await this.#_cache.getSetting('lastFetch');
            const isCacheStale = !lastFetch || (Date.now() - lastFetch > 60000); // 1 minute cache

            if (!isCacheStale && this.#_allOnlinePerformers.length > 0) {
                console.log("DataAPI: Using cached performers");
                return this.#_applyFiltersAndSort(this.#_allOnlinePerformers, filters, page, perPage);
            }
        }

        // Fetch fresh data
        console.log("DataAPI: Fetching fresh performer data...");
        await this.#_fetchAllPerformers(filters);
        
        return this.#_applyFiltersAndSort(this.#_allOnlinePerformers, filters, page, perPage);
    }

    /**
     * Fetch all performers from API (with pagination)
     * @private
     */
    async #_fetchAllPerformers(filters) {
        this.#_allOnlinePerformers = [];
        this.#_uniqueUsernames.clear();
        let offset = 0;
        let hasMore = true;
        let totalFetched = 0;

        while (hasMore && totalFetched < AppConfig.MAX_API_FETCH_LIMIT) {
            const result = await this.fetchOnlinePerformers(filters, offset);
            
            for (const performer of result.performers) {
                if (!this.#_uniqueUsernames.has(performer.username)) {
                    this.#_uniqueUsernames.add(performer.username);
                    this.#_allOnlinePerformers.push(performer);
                }
            }

            hasMore = result.hasMore;
            offset = result.nextOffset;
            totalFetched += result.performers.length;

            // Stop after getting enough performers for performance
            if (this.#_allOnlinePerformers.length >= 1000) {
                console.log("DataAPI: Stopping fetch, have enough performers");
                break;
            }
        }

        // Save to cache
        await this.#_cache.saveSetting('lastFetch', Date.now());
        console.log(`DataAPI: Fetched ${this.#_allOnlinePerformers.length} unique public performers`);
    }

    /**
     * Apply filters and sorting to performers
     * @private
     */
    async #_applyFiltersAndSort(performers, filters, page, perPage) {
        let filtered = [...performers];

        // Apply age filter
        if (filters.ageMin) {
            filtered = filtered.filter(p => p.age >= filters.ageMin);
        }
        if (filters.ageMax) {
            filtered = filtered.filter(p => p.age <= filters.ageMax);
        }

        // Apply tag filter
        if (filters.tags && filters.tags.length > 0) {
            const filterTags = filters.tags.map(t => t.toLowerCase().trim());
            filtered = filtered.filter(p => {
                if (!p.tags || !Array.isArray(p.tags)) return false;
                const performerTags = p.tags.map(t => t.toLowerCase());
                return filterTags.some(ft => performerTags.includes(ft));
            });
        }

        // Apply search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(p => {
                const username = (p.username || '').toLowerCase();
                const displayName = (p.display_name || '').toLowerCase();
                const tags = (p.tags || []).join(' ').toLowerCase();
                return username.includes(searchLower) || 
                       displayName.includes(searchLower) || 
                       tags.includes(searchLower);
            });
        }

        // Apply new models filter
        if (filters.newOnly) {
            filtered = filtered.filter(p => p.is_new === true);
        }

        // Get ranking context
        const context = await this.#_getRankingContext();

        // Calculate rank scores
        filtered = filtered.map(p => ({
            ...p,
            rankScore: AppConfig.calculateRankScore(p, context)
        }));

        // Apply sorting
        filtered = this.#_sortPerformers(filtered, filters.sortBy);

        // Apply pagination
        const start = (page - 1) * perPage;
        const paged = filtered.slice(start, start + perPage);

        return {
            performers: paged,
            total: filtered.length,
            page,
            perPage,
            hasMore: start + perPage < filtered.length
        };
    }

    /**
     * Sort performers by specified criteria
     * @private
     */
    #_sortPerformers(performers, sortBy = 'viewers_desc') {
        const sorted = [...performers];

        switch (sortBy) {
            case 'viewers_desc':
                sorted.sort((a, b) => (b.num_viewers || 0) - (a.num_viewers || 0));
                break;
            case 'viewers_asc':
                sorted.sort((a, b) => (a.num_viewers || 0) - (b.num_viewers || 0));
                break;
            case 'age_asc':
                sorted.sort((a, b) => (a.age || 99) - (b.age || 99));
                break;
            case 'age_desc':
                sorted.sort((a, b) => (b.age || 0) - (a.age || 0));
                break;
            case 'name_asc':
                sorted.sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username));
                break;
            case 'name_desc':
                sorted.sort((a, b) => (b.display_name || b.username).localeCompare(a.display_name || a.username));
                break;
            case 'new_first':
                sorted.sort((a, b) => {
                    if (a.is_new === b.is_new) return (b.num_viewers || 0) - (a.num_viewers || 0);
                    return a.is_new ? -1 : 1;
                });
                break;
            case 'rank_score':
                sorted.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0));
                break;
            default:
                sorted.sort((a, b) => (b.num_viewers || 0) - (a.num_viewers || 0));
        }

        return sorted;
    }

    /**
     * Get ranking context (favorites, history)
     * @private
     */
    async #_getRankingContext() {
        try {
            const favorites = await this.#_cache.getFavorites();
            const history = await this.#_cache.getHistory();
            
            // Get recently viewed (last 24 hours)
            const recentThreshold = Date.now() - (24 * 60 * 60 * 1000);
            const recentlyViewed = history
                .filter(h => h.timestamp > recentThreshold)
                .map(h => h.username);

            return {
                favorites: new Set(favorites),
                recentlyViewed: new Set(recentlyViewed)
            };
        } catch (error) {
            console.error("DataAPI: Error getting ranking context:", error);
            return { favorites: new Set(), recentlyViewed: new Set() };
        }
    }

    /**
     * Load performers from local .dat files
     * @returns {Promise<Array<Object>>}
     */
    async loadCachedPerformers() {
        const allPerformers = [];
        const seen = new Set();

        for (const file of AppConfig.DAT_FILES) {
            try {
                const response = await fetch(`${AppConfig.DATA_PATH}${file}`);
                if (!response.ok) continue;

                const compressedData = await response.arrayBuffer();
                const decompressedData = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
                const data = JSON.parse(decompressedData);

                const performers = Array.isArray(data) ? data : Object.values(data);
                for (const p of performers) {
                    if (p.username && !seen.has(p.username)) {
                        seen.add(p.username);
                        allPerformers.push(p);
                    }
                }
            } catch (error) {
                console.warn(`DataAPI: Could not load ${file}:`, error.message);
            }
        }

        return allPerformers;
    }

    /**
     * Get the count of all online performers
     * @returns {number}
     */
    getTotalCount() {
        return this.#_allOnlinePerformers.length;
    }

    /**
     * Check if more performers can be loaded
     * @returns {boolean}
     */
    hasMorePerformers() {
        return this.#_hasMoreData;
    }
}