/**
 * API Cache Module
 * Intelligent caching system with TTL, LRU eviction, and selective caching
 */

/**
 * LRU Cache implementation
 */
class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.accessOrder = new Map();
        this.accessCounter = 0;
    }

    /**
     * Get item from cache
     */
    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }

        const item = this.cache.get(key);
        
        // Check if item has expired
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.delete(key);
            return null;
        }

        // Update access order
        this.accessOrder.set(key, ++this.accessCounter);
        
        return item.value;
    }

    /**
     * Set item in cache
     */
    set(key, value, ttl = null) {
        // If cache is full, evict least recently used item
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }

        const item = {
            value,
            expiresAt: ttl ? Date.now() + ttl : null,
            size: this.estimateSize(value)
        };

        this.cache.set(key, item);
        this.accessOrder.set(key, ++this.accessCounter);
    }

    /**
     * Delete item from cache
     */
    delete(key) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.accessOrder.clear();
        this.accessCounter = 0;
    }

    /**
     * Evict least recently used item
     */
    evictLRU() {
        let lruKey = null;
        let lruAccess = Infinity;

        for (const [key, access] of this.accessOrder) {
            if (access < lruAccess) {
                lruAccess = access;
                lruKey = key;
            }
        }

        if (lruKey) {
            this.delete(lruKey);
        }
    }

    /**
     * Estimate size of value in bytes
     */
    estimateSize(value) {
        const str = JSON.stringify(value);
        return str.length * 2; // Approximate bytes (UTF-16)
    }

    /**
     * Get cache statistics
     */
    getStats() {
        let totalSize = 0;
        let expiredCount = 0;
        const now = Date.now();

        for (const [key, item] of this.cache) {
            totalSize += item.size || 0;
            if (item.expiresAt && now > item.expiresAt) {
                expiredCount++;
            }
        }

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            totalSize,
            expiredCount,
            hitRate: this.calculateHitRate()
        };
    }

    /**
     * Calculate cache hit rate
     */
    calculateHitRate() {
        // This would need to track hits/misses in a real implementation
        return 0;
    }
}

/**
 * Cache key generator
 */
class CacheKeyGenerator {
    /**
     * Generate cache key from request config
     */
    static generate(endpoint, params = {}, options = {}) {
        const sortedParams = this.sortObject(params);
        const keyParts = [
            endpoint,
            JSON.stringify(sortedParams),
            options.method || 'GET'
        ];

        return keyParts.join(':');
    }

    /**
     * Sort object keys for consistent key generation
     */
    static sortObject(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = obj[key];
        });
        
        return sorted;
    }
}

/**
 * Cache configuration
 */
const CacheConfig = {
    // Default TTL for different endpoint patterns
    ttlPatterns: [
        { pattern: /\/dashboard\/stats/, ttl: 60000 }, // 1 minute
        { pattern: /\/clients$/, ttl: 300000 }, // 5 minutes
        { pattern: /\/clients\/.*\/deliveries/, ttl: 120000 }, // 2 minutes
        { pattern: /\/deliveries$/, ttl: 60000 }, // 1 minute
        { pattern: /\/drivers$/, ttl: 300000 }, // 5 minutes
        { pattern: /\/vehicles$/, ttl: 600000 }, // 10 minutes
        { pattern: /\/routes/, ttl: 300000 }, // 5 minutes
        { pattern: /\/scheduling\/metrics/, ttl: 180000 }, // 3 minutes
    ],

    // Endpoints that should not be cached
    noCachePatterns: [
        /\/csrf\/token/,
        /\/auth\//,
        /\/deliveries\/.*\/assign/,
        /POST|PUT|DELETE|PATCH/i
    ],

    // Cache only successful responses
    cacheableStatuses: [200, 201, 203, 206],

    // Maximum cache size per cache type
    maxCacheSize: {
        api: 100,
        prefetch: 50,
        offline: 200
    }
};

/**
 * Main API Cache Manager
 */
export class APICacheManager {
    constructor(config = {}) {
        this.config = { ...CacheConfig, ...config };
        this.caches = {
            api: new LRUCache(this.config.maxCacheSize.api),
            prefetch: new LRUCache(this.config.maxCacheSize.prefetch),
            offline: new LRUCache(this.config.maxCacheSize.offline)
        };
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0,
            evictions: 0
        };
    }

    /**
     * Get cached response
     */
    get(endpoint, params = {}, options = {}) {
        if (!this.shouldCache(endpoint, options)) {
            return null;
        }

        const key = CacheKeyGenerator.generate(endpoint, params, options);
        const cached = this.caches.api.get(key);

        if (cached) {
            this.stats.hits++;
            this.emitCacheEvent('hit', { endpoint, key });
            return cached;
        }

        this.stats.misses++;
        this.emitCacheEvent('miss', { endpoint, key });
        return null;
    }

    /**
     * Cache response
     */
    set(endpoint, params = {}, options = {}, response, ttl = null) {
        if (!this.shouldCache(endpoint, options)) {
            return;
        }

        const key = CacheKeyGenerator.generate(endpoint, params, options);
        const cacheTTL = ttl || this.getTTL(endpoint);

        this.caches.api.set(key, response, cacheTTL);
        this.stats.writes++;
        this.emitCacheEvent('write', { endpoint, key, ttl: cacheTTL });
    }

    /**
     * Invalidate cache
     */
    invalidate(pattern) {
        let invalidatedCount = 0;

        for (const [key] of this.caches.api.cache) {
            if (pattern instanceof RegExp && pattern.test(key)) {
                this.caches.api.delete(key);
                invalidatedCount++;
            } else if (typeof pattern === 'string' && key.includes(pattern)) {
                this.caches.api.delete(key);
                invalidatedCount++;
            }
        }

        this.emitCacheEvent('invalidate', { pattern: pattern.toString(), count: invalidatedCount });
        return invalidatedCount;
    }

    /**
     * Invalidate cache by entity
     */
    invalidateEntity(entityType, entityId = null) {
        const patterns = {
            client: entityId ? `/clients.*${entityId}` : '/clients',
            delivery: entityId ? `/deliveries.*${entityId}` : '/deliveries',
            driver: entityId ? `/drivers.*${entityId}` : '/drivers',
            vehicle: entityId ? `/vehicles.*${entityId}` : '/vehicles',
            route: entityId ? `/routes.*${entityId}` : '/routes'
        };

        const pattern = patterns[entityType];
        if (pattern) {
            return this.invalidate(new RegExp(pattern));
        }

        return 0;
    }

    /**
     * Prefetch and cache
     */
    async prefetch(requests) {
        const promises = requests.map(async ({ endpoint, params, options, fetcher }) => {
            const key = CacheKeyGenerator.generate(endpoint, params, options);
            
            // Check if already cached
            if (this.caches.prefetch.get(key)) {
                return;
            }

            try {
                const response = await fetcher();
                const ttl = this.getTTL(endpoint);
                this.caches.prefetch.set(key, response, ttl);
                this.emitCacheEvent('prefetch', { endpoint, key });
            } catch (error) {
                console.error('Prefetch failed:', endpoint, error);
            }
        });

        await Promise.all(promises);
    }

    /**
     * Save for offline use
     */
    saveForOffline(endpoint, params, options, response) {
        const key = CacheKeyGenerator.generate(endpoint, params, options);
        // Offline cache has longer TTL
        const ttl = this.getTTL(endpoint) * 10;
        this.caches.offline.set(key, response, ttl);
        this.emitCacheEvent('offline-save', { endpoint, key });
    }

    /**
     * Get from offline cache
     */
    getOffline(endpoint, params, options) {
        const key = CacheKeyGenerator.generate(endpoint, params, options);
        return this.caches.offline.get(key);
    }

    /**
     * Check if request should be cached
     */
    shouldCache(endpoint, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        
        // Don't cache non-GET requests by default
        if (method !== 'GET' && !options.forceCache) {
            return false;
        }

        // Check no-cache patterns
        for (const pattern of this.config.noCachePatterns) {
            if (pattern.test(endpoint) || pattern.test(method)) {
                return false;
            }
        }

        // Check if caching is explicitly disabled
        if (options.cache === false) {
            return false;
        }

        return true;
    }

    /**
     * Get TTL for endpoint
     */
    getTTL(endpoint) {
        for (const { pattern, ttl } of this.config.ttlPatterns) {
            if (pattern.test(endpoint)) {
                return ttl;
            }
        }
        
        // Default TTL: 5 minutes
        return 300000;
    }

    /**
     * Clear all caches
     */
    clearAll() {
        Object.values(this.caches).forEach(cache => cache.clear());
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0,
            evictions: 0
        };
        this.emitCacheEvent('clear-all', {});
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const cacheStats = {};
        for (const [name, cache] of Object.entries(this.caches)) {
            cacheStats[name] = cache.getStats();
        }

        return {
            ...this.stats,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
            caches: cacheStats
        };
    }

    /**
     * Emit cache event
     */
    emitCacheEvent(type, data) {
        window.dispatchEvent(new CustomEvent('api-cache', {
            detail: { type, ...data, timestamp: Date.now() }
        }));
    }

    /**
     * Smart cache warming
     */
    async warmCache(endpoints, fetcher) {
        const warmupRequests = endpoints.map(endpoint => ({
            endpoint: endpoint.path,
            params: endpoint.params || {},
            options: endpoint.options || {},
            fetcher: () => fetcher(endpoint.path, endpoint.params, endpoint.options)
        }));

        await this.prefetch(warmupRequests);
    }
}

/**
 * Cache invalidation strategies
 */
export const CacheInvalidationStrategies = {
    /**
     * Invalidate related caches after mutation
     */
    onMutation: {
        // Client mutations
        'POST /clients': (cache) => {
            cache.invalidate('/clients');
            cache.invalidate('/dashboard/stats');
        },
        'PUT /clients': (cache, { clientCode }) => {
            cache.invalidate(`/clients.*${clientCode}`);
            cache.invalidate('/dashboard/stats');
        },
        
        // Delivery mutations
        'POST /deliveries': (cache) => {
            cache.invalidate('/deliveries');
            cache.invalidate('/dashboard/stats');
            cache.invalidate('/scheduling');
        },
        'PUT /deliveries': (cache, { deliveryId }) => {
            cache.invalidate(`/deliveries.*${deliveryId}`);
            cache.invalidate('/dashboard/stats');
        },
        
        // Driver mutations
        'PUT /drivers': (cache, { driverId }) => {
            cache.invalidate(`/drivers.*${driverId}`);
            cache.invalidate('/scheduling');
        },
        
        // Vehicle mutations
        'PUT /vehicles': (cache, { vehicleId }) => {
            cache.invalidate(`/vehicles.*${vehicleId}`);
            cache.invalidate('/scheduling');
        }
    },

    /**
     * Time-based invalidation
     */
    scheduleInvalidation(cache) {
        // Invalidate dashboard stats every 5 minutes
        setInterval(() => {
            cache.invalidate('/dashboard/stats');
        }, 300000);

        // Invalidate delivery list every 2 minutes
        setInterval(() => {
            cache.invalidate('/deliveries');
        }, 120000);
    }
};

// Create singleton instance
export const apiCache = new APICacheManager();

// Export all components
export default {
    APICacheManager,
    LRUCache,
    CacheKeyGenerator,
    CacheConfig,
    CacheInvalidationStrategies,
    apiCache
};