/**
 * Cache Manager (JavaScript version)
 * Handles request caching with TTL and invalidation
 */

export class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get cached data if valid
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry
   */
  set(key, data, ttl) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern) {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern) 
      : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clean expired entries
   */
  cleanup() {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Generate cache key from URL and params
   */
  static generateKey(url, params) {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key];
        }
        return acc;
      }, {});

    return `${url}?${JSON.stringify(sortedParams)}`;
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Auto cleanup every 10 minutes
setInterval(() => {
  cache.cleanup();
}, 10 * 60 * 1000);