/**
 * API Performance Utilities Module
 * Request optimization, batching, debouncing, and performance monitoring
 */

/**
 * Request Debouncer
 * Prevents excessive API calls by delaying execution
 */
export class RequestDebouncer {
    constructor(defaultDelay = 300) {
        this.defaultDelay = defaultDelay;
        this.timers = new Map();
        this.pending = new Map();
    }

    /**
     * Debounce a request
     */
    debounce(key, fn, delay = this.defaultDelay) {
        // Clear existing timer
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Create promise for this debounced call
        return new Promise((resolve, reject) => {
            // Store resolve/reject for this call
            if (!this.pending.has(key)) {
                this.pending.set(key, []);
            }
            this.pending.get(key).push({ resolve, reject });

            // Set new timer
            const timer = setTimeout(async () => {
                const callbacks = this.pending.get(key) || [];
                this.pending.delete(key);
                this.timers.delete(key);

                try {
                    const result = await fn();
                    callbacks.forEach(cb => cb.resolve(result));
                } catch (error) {
                    callbacks.forEach(cb => cb.reject(error));
                }
            }, delay);

            this.timers.set(key, timer);
        });
    }

    /**
     * Cancel a debounced request
     */
    cancel(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }

        const callbacks = this.pending.get(key) || [];
        callbacks.forEach(cb => cb.reject(new Error('Debounced request cancelled')));
        this.pending.delete(key);
    }

    /**
     * Cancel all debounced requests
     */
    cancelAll() {
        for (const key of this.timers.keys()) {
            this.cancel(key);
        }
    }
}

/**
 * Request Throttler
 * Limits request frequency
 */
export class RequestThrottler {
    constructor(defaultLimit = 1000) {
        this.defaultLimit = defaultLimit;
        this.lastCall = new Map();
        this.queued = new Map();
    }

    /**
     * Throttle a request
     */
    async throttle(key, fn, limit = this.defaultLimit) {
        const now = Date.now();
        const lastCallTime = this.lastCall.get(key) || 0;
        const timeSinceLastCall = now - lastCallTime;

        if (timeSinceLastCall >= limit) {
            // Execute immediately
            this.lastCall.set(key, now);
            return fn();
        }

        // Queue the request
        const delay = limit - timeSinceLastCall;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(async () => {
                this.lastCall.set(key, Date.now());
                this.queued.delete(key);
                
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, delay);

            this.queued.set(key, timer);
        });
    }

    /**
     * Cancel throttled requests
     */
    cancel(key) {
        if (this.queued.has(key)) {
            clearTimeout(this.queued.get(key));
            this.queued.delete(key);
        }
    }
}

/**
 * Request Batcher
 * Combines multiple requests into single batch request
 */
export class RequestBatcher {
    constructor(batchSize = 10, batchDelay = 50) {
        this.batchSize = batchSize;
        this.batchDelay = batchDelay;
        this.batches = new Map();
        this.timers = new Map();
    }

    /**
     * Add request to batch
     */
    batch(batchKey, request) {
        if (!this.batches.has(batchKey)) {
            this.batches.set(batchKey, {
                requests: [],
                processor: null
            });
        }

        const batch = this.batches.get(batchKey);
        
        return new Promise((resolve, reject) => {
            batch.requests.push({
                ...request,
                resolve,
                reject
            });

            // Process batch if size limit reached
            if (batch.requests.length >= this.batchSize) {
                this.processBatch(batchKey);
            } else {
                // Schedule batch processing
                this.scheduleBatch(batchKey);
            }
        });
    }

    /**
     * Schedule batch processing
     */
    scheduleBatch(batchKey) {
        // Clear existing timer
        if (this.timers.has(batchKey)) {
            clearTimeout(this.timers.get(batchKey));
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.processBatch(batchKey);
        }, this.batchDelay);

        this.timers.set(batchKey, timer);
    }

    /**
     * Process a batch
     */
    async processBatch(batchKey) {
        const batch = this.batches.get(batchKey);
        if (!batch || batch.requests.length === 0) return;

        // Clear timer
        if (this.timers.has(batchKey)) {
            clearTimeout(this.timers.get(batchKey));
            this.timers.delete(batchKey);
        }

        // Get requests and clear batch
        const requests = batch.requests;
        batch.requests = [];

        // Process batch with registered processor
        if (batch.processor) {
            try {
                const results = await batch.processor(requests);
                
                // Resolve individual promises
                requests.forEach((req, index) => {
                    if (results[index].error) {
                        req.reject(results[index].error);
                    } else {
                        req.resolve(results[index].data);
                    }
                });
            } catch (error) {
                // Reject all requests on batch error
                requests.forEach(req => req.reject(error));
            }
        }
    }

    /**
     * Register batch processor
     */
    registerProcessor(batchKey, processor) {
        if (!this.batches.has(batchKey)) {
            this.batches.set(batchKey, {
                requests: [],
                processor: null
            });
        }
        
        this.batches.get(batchKey).processor = processor;
    }
}

/**
 * Concurrent Request Limiter
 * Limits number of concurrent requests
 */
export class ConcurrentLimiter {
    constructor(maxConcurrent = 5) {
        this.maxConcurrent = maxConcurrent;
        this.active = 0;
        this.queue = [];
    }

    /**
     * Execute with concurrency limit
     */
    async execute(fn) {
        // If under limit, execute immediately
        if (this.active < this.maxConcurrent) {
            this.active++;
            
            try {
                const result = await fn();
                this.active--;
                this.processQueue();
                return result;
            } catch (error) {
                this.active--;
                this.processQueue();
                throw error;
            }
        }

        // Queue the request
        return new Promise((resolve, reject) => {
            this.queue.push({
                fn,
                resolve,
                reject
            });
        });
    }

    /**
     * Process queued requests
     */
    processQueue() {
        while (this.active < this.maxConcurrent && this.queue.length > 0) {
            const { fn, resolve, reject } = this.queue.shift();
            
            this.execute(fn)
                .then(resolve)
                .catch(reject);
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            active: this.active,
            queued: this.queue.length,
            maxConcurrent: this.maxConcurrent
        };
    }
}

/**
 * Request Prefetcher
 * Intelligently prefetches likely next requests
 */
export class RequestPrefetcher {
    constructor(cache) {
        this.cache = cache;
        this.predictions = new Map();
        this.history = [];
        this.maxHistory = 100;
    }

    /**
     * Track request for pattern learning
     */
    track(endpoint, params) {
        this.history.push({
            endpoint,
            params,
            timestamp: Date.now()
        });

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        // Update predictions
        this.updatePredictions(endpoint);
    }

    /**
     * Update predictions based on patterns
     */
    updatePredictions(currentEndpoint) {
        // Simple pattern: what usually follows this endpoint?
        const following = new Map();
        
        for (let i = 0; i < this.history.length - 1; i++) {
            if (this.history[i].endpoint === currentEndpoint) {
                const next = this.history[i + 1];
                const key = next.endpoint;
                following.set(key, (following.get(key) || 0) + 1);
            }
        }

        // Convert to probabilities
        const total = Array.from(following.values()).reduce((a, b) => a + b, 0);
        const predictions = [];
        
        for (const [endpoint, count] of following) {
            predictions.push({
                endpoint,
                probability: count / total,
                count
            });
        }

        // Sort by probability
        predictions.sort((a, b) => b.probability - a.probability);
        this.predictions.set(currentEndpoint, predictions);
    }

    /**
     * Prefetch likely next requests
     */
    async prefetch(currentEndpoint, fetcher, limit = 3) {
        const predictions = this.predictions.get(currentEndpoint) || [];
        const toPrefetch = predictions.slice(0, limit);

        const prefetchRequests = toPrefetch
            .filter(p => p.probability > 0.3) // Only prefetch if >30% probability
            .map(p => ({
                endpoint: p.endpoint,
                params: {},
                options: {},
                fetcher: () => fetcher(p.endpoint)
            }));

        if (prefetchRequests.length > 0) {
            await this.cache.prefetch(prefetchRequests);
        }
    }

    /**
     * Get predictions for endpoint
     */
    getPredictions(endpoint) {
        return this.predictions.get(endpoint) || [];
    }
}

/**
 * Performance Monitor
 * Tracks API performance metrics
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.thresholds = {
            slow: 1000,      // Requests taking > 1s
            verySlow: 3000,  // Requests taking > 3s
            timeout: 30000   // Request timeout
        };
    }

    /**
     * Start timing a request
     */
    startTiming(requestId) {
        const timing = {
            start: performance.now(),
            marks: new Map()
        };
        
        this.metrics.set(requestId, timing);
        return timing;
    }

    /**
     * Mark a timing point
     */
    mark(requestId, label) {
        const timing = this.metrics.get(requestId);
        if (timing) {
            timing.marks.set(label, performance.now() - timing.start);
        }
    }

    /**
     * End timing and get metrics
     */
    endTiming(requestId, status = 'success') {
        const timing = this.metrics.get(requestId);
        if (!timing) return null;

        const duration = performance.now() - timing.start;
        const metrics = {
            duration,
            status,
            marks: Object.fromEntries(timing.marks),
            performance: this.getPerformanceLevel(duration)
        };

        // Clean up
        this.metrics.delete(requestId);

        // Emit performance event
        this.emitPerformanceEvent(requestId, metrics);

        return metrics;
    }

    /**
     * Get performance level
     */
    getPerformanceLevel(duration) {
        if (duration >= this.thresholds.timeout) return 'timeout';
        if (duration >= this.thresholds.verySlow) return 'very-slow';
        if (duration >= this.thresholds.slow) return 'slow';
        return 'fast';
    }

    /**
     * Get aggregated metrics
     */
    getAggregatedMetrics(endpoint) {
        // In a real implementation, this would aggregate historical data
        return {
            averageDuration: 0,
            p50: 0,
            p95: 0,
            p99: 0,
            errorRate: 0,
            throughput: 0
        };
    }

    /**
     * Emit performance event
     */
    emitPerformanceEvent(requestId, metrics) {
        window.dispatchEvent(new CustomEvent('api-performance', {
            detail: {
                requestId,
                ...metrics,
                timestamp: Date.now()
            }
        }));
    }
}

/**
 * Request Queue
 * Manages request queuing during offline or auth refresh
 */
export class RequestQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxQueueSize = 100;
    }

    /**
     * Add request to queue
     */
    enqueue(request) {
        if (this.queue.length >= this.maxQueueSize) {
            throw new Error('Request queue is full');
        }

        return new Promise((resolve, reject) => {
            this.queue.push({
                ...request,
                resolve,
                reject,
                timestamp: Date.now()
            });
        });
    }

    /**
     * Process queued requests
     */
    async processQueue(processor) {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift();
            
            try {
                const result = await processor(request);
                request.resolve(result);
            } catch (error) {
                request.reject(error);
            }
        }

        this.processing = false;
    }

    /**
     * Clear queue
     */
    clear() {
        const error = new Error('Request queue cleared');
        this.queue.forEach(request => request.reject(error));
        this.queue = [];
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            size: this.queue.length,
            processing: this.processing,
            oldest: this.queue[0]?.timestamp
        };
    }
}

/**
 * Progress Tracker
 * Tracks upload/download progress
 */
export class ProgressTracker {
    constructor() {
        this.trackers = new Map();
    }

    /**
     * Create progress tracker for request
     */
    create(requestId) {
        const tracker = {
            requestId,
            loaded: 0,
            total: 0,
            percentage: 0,
            speed: 0,
            startTime: Date.now(),
            lastUpdate: Date.now()
        };

        this.trackers.set(requestId, tracker);
        return tracker;
    }

    /**
     * Update progress
     */
    update(requestId, loaded, total) {
        const tracker = this.trackers.get(requestId);
        if (!tracker) return;

        const now = Date.now();
        const timeDiff = (now - tracker.lastUpdate) / 1000; // seconds
        const bytesDiff = loaded - tracker.loaded;

        tracker.loaded = loaded;
        tracker.total = total;
        tracker.percentage = total > 0 ? (loaded / total) * 100 : 0;
        tracker.speed = timeDiff > 0 ? bytesDiff / timeDiff : 0; // bytes per second
        tracker.lastUpdate = now;

        // Emit progress event
        this.emitProgressEvent(tracker);

        return tracker;
    }

    /**
     * Complete tracking
     */
    complete(requestId) {
        const tracker = this.trackers.get(requestId);
        if (tracker) {
            tracker.percentage = 100;
            this.emitProgressEvent(tracker);
            this.trackers.delete(requestId);
        }
    }

    /**
     * Emit progress event
     */
    emitProgressEvent(tracker) {
        window.dispatchEvent(new CustomEvent('api-progress', {
            detail: {
                ...tracker,
                timestamp: Date.now()
            }
        }));
    }
}

// Export instances
export const debouncer = new RequestDebouncer();
export const throttler = new RequestThrottler();
export const batcher = new RequestBatcher();
export const limiter = new ConcurrentLimiter();
export const monitor = new PerformanceMonitor();
export const queue = new RequestQueue();
export const progressTracker = new ProgressTracker();

// Export all components
export default {
    RequestDebouncer,
    RequestThrottler,
    RequestBatcher,
    ConcurrentLimiter,
    RequestPrefetcher,
    PerformanceMonitor,
    RequestQueue,
    ProgressTracker,
    debouncer,
    throttler,
    batcher,
    limiter,
    monitor,
    queue,
    progressTracker
};