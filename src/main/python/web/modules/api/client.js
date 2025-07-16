/**
 * Modern API Client Module
 * Provides unified interface for all API calls with automatic retry, 
 * error handling, loading state management, JWT authentication,
 * and performance optimization features
 */

import { CSRFManager } from '../csrf/csrf-manager.js';
import { ErrorFactory, ErrorRecovery, AuthError } from './errors.js';
import { apiCache, CacheInvalidationStrategies } from './cache.js';
import { 
    debouncer, 
    throttler, 
    limiter, 
    monitor, 
    queue as requestQueue,
    progressTracker 
} from './performance.js';

// API Client Configuration
const DEFAULT_CONFIG = {
    baseURL: window.APP_CONFIG?.API_BASE || '/api',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    headers: {
        'Content-Type': 'application/json'
    },
    auth: {
        tokenKey: 'access_token',
        refreshTokenKey: 'refresh_token',
        tokenPrefix: 'Bearer',
        refreshEndpoint: '/auth/refresh',
        loginEndpoint: '/auth/login',
        logoutEndpoint: '/auth/logout'
    },
    cache: {
        enabled: true,
        ttl: 300000 // 5 minutes default
    },
    performance: {
        enableDebounce: true,
        enableThrottle: true,
        maxConcurrent: 5,
        enableMonitoring: true
    }
};

// Request interceptor type definitions
const interceptors = {
    request: [],
    response: [],
    error: []
};

/**
 * Base API Client Class
 * Handles all HTTP requests with advanced features
 */
export class APIClient {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.activeRequests = new Map();
        this.loadingState = new Map();
        this.refreshPromise = null;
        this.authToken = null;
        this.refreshToken = null;
        
        // Initialize auth tokens from storage
        this.loadAuthTokens();
        
        // Initialize performance features
        if (this.config.performance.enableMonitoring) {
            this.setupPerformanceMonitoring();
        }
    }

    /**
     * Load auth tokens from storage
     */
    loadAuthTokens() {
        try {
            this.authToken = localStorage.getItem(this.config.auth.tokenKey);
            this.refreshToken = localStorage.getItem(this.config.auth.refreshTokenKey);
        } catch (error) {
            console.warn('Failed to load auth tokens:', error);
        }
    }

    /**
     * Save auth tokens to storage
     */
    saveAuthTokens(authToken, refreshToken) {
        try {
            if (authToken) {
                localStorage.setItem(this.config.auth.tokenKey, authToken);
                this.authToken = authToken;
            }
            if (refreshToken) {
                localStorage.setItem(this.config.auth.refreshTokenKey, refreshToken);
                this.refreshToken = refreshToken;
            }
        } catch (error) {
            console.error('Failed to save auth tokens:', error);
        }
    }

    /**
     * Clear auth tokens
     */
    clearAuthTokens() {
        try {
            localStorage.removeItem(this.config.auth.tokenKey);
            localStorage.removeItem(this.config.auth.refreshTokenKey);
            this.authToken = null;
            this.refreshToken = null;
        } catch (error) {
            console.warn('Failed to clear auth tokens:', error);
        }
    }

    /**
     * Get auth headers
     */
    getAuthHeaders() {
        if (!this.authToken) return {};
        return {
            'Authorization': `${this.config.auth.tokenPrefix} ${this.authToken}`
        };
    }

    /**
     * Refresh auth token
     */
    async refreshAuthToken() {
        // If already refreshing, return existing promise
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        // No refresh token available
        if (!this.refreshToken) {
            throw new AuthError('No refresh token available', 'TOKEN_REFRESH_FAILED');
        }

        // Create refresh promise
        this.refreshPromise = this.executeTokenRefresh();
        
        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.refreshPromise = null;
        }
    }

    /**
     * Execute token refresh
     */
    async executeTokenRefresh() {
        try {
            const response = await fetch(this.buildURL(this.config.auth.refreshEndpoint), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...CSRFManager.getHeaders()
                },
                body: JSON.stringify({
                    refresh_token: this.refreshToken
                })
            });

            if (!response.ok) {
                throw new AuthError('Token refresh failed', 'TOKEN_REFRESH_FAILED');
            }

            const data = await response.json();
            
            // Save new tokens
            this.saveAuthTokens(data.access_token, data.refresh_token);
            
            // Queue all pending requests
            await requestQueue.processQueue(async (request) => {
                // Update auth headers for queued requests
                request.config.headers = {
                    ...request.config.headers,
                    ...this.getAuthHeaders()
                };
                return this.executeRequest(request);
            });

            return data;
        } catch (error) {
            // Clear tokens on refresh failure
            this.clearAuthTokens();
            
            // Emit auth failure event
            window.dispatchEvent(new CustomEvent('auth-failure', {
                detail: { error, requiresLogin: true }
            }));
            
            throw error;
        }
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor slow requests
        window.addEventListener('api-performance', (event) => {
            const { duration, performance, requestId } = event.detail;
            
            if (performance === 'slow' || performance === 'very-slow') {
                console.warn(`Slow API request detected: ${requestId} took ${duration}ms`);
            }
        });

        // Monitor cache effectiveness
        window.addEventListener('api-cache', (event) => {
            if (event.detail.type === 'hit') {
                console.debug('Cache hit:', event.detail.endpoint);
            }
        });
    }

    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
        interceptors.request.push(interceptor);
        return () => {
            const index = interceptors.request.indexOf(interceptor);
            if (index !== -1) interceptors.request.splice(index, 1);
        };
    }

    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
        interceptors.response.push(interceptor);
        return () => {
            const index = interceptors.response.indexOf(interceptor);
            if (index !== -1) interceptors.response.splice(index, 1);
        };
    }

    /**
     * Add error interceptor
     */
    addErrorInterceptor(interceptor) {
        interceptors.error.push(interceptor);
        return () => {
            const index = interceptors.error.indexOf(interceptor);
            if (index !== -1) interceptors.error.splice(index, 1);
        };
    }

    /**
     * Apply request interceptors
     */
    async applyRequestInterceptors(config) {
        let finalConfig = config;
        for (const interceptor of interceptors.request) {
            finalConfig = await interceptor(finalConfig);
        }
        return finalConfig;
    }

    /**
     * Apply response interceptors
     */
    async applyResponseInterceptors(response) {
        let finalResponse = response;
        for (const interceptor of interceptors.response) {
            finalResponse = await interceptor(finalResponse);
        }
        return finalResponse;
    }

    /**
     * Apply error interceptors
     */
    async applyErrorInterceptors(error) {
        let finalError = error;
        for (const interceptor of interceptors.error) {
            finalError = await interceptor(finalError);
        }
        return finalError;
    }

    /**
     * Execute request with retry logic
     */
    async executeWithRetry(url, config, retries = this.config.retries) {
        try {
            const response = await fetch(url, config);
            
            // Handle auth token refresh
            if (response.status === 401) {
                // Try to refresh token
                try {
                    await this.refreshAuthToken();
                    // Update headers with new token
                    Object.assign(config.headers, this.getAuthHeaders());
                    // Retry the request
                    return fetch(url, config);
                } catch (refreshError) {
                    // Token refresh failed, throw auth error
                    throw new AuthError('Authentication failed', 'TOKEN_EXPIRED');
                }
            }
            
            // Handle CSRF token refresh
            if (response.status === 403 && response.headers.get('X-CSRF-Error') === 'invalid-token') {
                await CSRFManager.refreshToken();
                Object.assign(config.headers, CSRFManager.getHeaders());
                return fetch(url, config);
            }

            // Check if response is ok
            if (!response.ok) {
                // Parse error and check retry strategy
                const errorData = await this.parseErrorResponse(response);
                const error = ErrorFactory.fromResponse(response, errorData);
                const retryStrategy = ErrorRecovery.getRetryStrategy(error);
                
                if (retryStrategy.shouldRetry && retries > 0) {
                    await this.delay(retryStrategy.delay);
                    return this.executeWithRetry(url, config, retries - 1);
                }
                
                // Not retryable, return response as is
                return response;
            }

            return response;
        } catch (error) {
            // Convert network errors
            const apiError = error instanceof Error && !(error.name?.includes('Error')) 
                ? ErrorFactory.fromNetworkError(error) 
                : error;
                
            const retryStrategy = ErrorRecovery.getRetryStrategy(apiError);
            
            if (retryStrategy.shouldRetry && retries > 0) {
                await this.delay(retryStrategy.delay);
                return this.executeWithRetry(url, config, retries - 1);
            }
            
            throw apiError;
        }
    }

    /**
     * Parse error response safely
     */
    async parseErrorResponse(response) {
        try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                return await response.json();
            }
            return { message: await response.text() };
        } catch {
            return { message: response.statusText };
        }
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        return error.name === 'NetworkError' || 
               error.name === 'TimeoutError' ||
               error.message?.includes('fetch');
    }

    /**
     * Delay helper for retry logic
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create abort controller for request cancellation
     */
    createAbortController(requestId) {
        const controller = new AbortController();
        this.activeRequests.set(requestId, controller);
        return controller;
    }

    /**
     * Cancel a specific request
     */
    cancelRequest(requestId) {
        const controller = this.activeRequests.get(requestId);
        if (controller) {
            controller.abort();
            this.activeRequests.delete(requestId);
            this.setLoadingState(requestId, false);
        }
    }

    /**
     * Cancel all active requests
     */
    cancelAllRequests() {
        for (const [requestId, controller] of this.activeRequests) {
            controller.abort();
            this.setLoadingState(requestId, false);
        }
        this.activeRequests.clear();
    }

    /**
     * Set loading state for a request
     */
    setLoadingState(requestId, isLoading) {
        this.loadingState.set(requestId, isLoading);
        // Emit loading state change event
        window.dispatchEvent(new CustomEvent('api-loading-change', {
            detail: { requestId, isLoading }
        }));
    }

    /**
     * Get loading state for a request
     */
    isLoading(requestId) {
        return this.loadingState.get(requestId) || false;
    }

    /**
     * Build full URL
     */
    buildURL(endpoint, params = {}) {
        const url = new URL(`${this.config.baseURL}${endpoint}`, window.location.origin);
        
        // Add query parameters
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });
        
        return url.toString();
    }

    /**
     * Main request method
     */
    async request(endpoint, options = {}) {
        const requestId = options.requestId || `${endpoint}-${Date.now()}`;
        
        // Check cache first
        if (this.config.cache.enabled && options.method === 'GET') {
            const cached = apiCache.get(endpoint, options.params, options);
            if (cached) {
                return cached;
            }
        }
        
        // Apply performance optimizations
        if (this.config.performance.enableDebounce && options.debounce) {
            return debouncer.debounce(
                `${endpoint}-${JSON.stringify(options.params || {})}`,
                () => this._executeRequest(endpoint, options, requestId),
                options.debounce
            );
        }
        
        if (this.config.performance.enableThrottle && options.throttle) {
            return throttler.throttle(
                `${endpoint}-${JSON.stringify(options.params || {})}`,
                () => this._executeRequest(endpoint, options, requestId),
                options.throttle
            );
        }
        
        // Use concurrent limiter
        if (this.config.performance.maxConcurrent) {
            return limiter.execute(() => this._executeRequest(endpoint, options, requestId));
        }
        
        return this._executeRequest(endpoint, options, requestId);
    }

    /**
     * Execute the actual request
     */
    async _executeRequest(endpoint, options = {}, requestId) {
        const controller = this.createAbortController(requestId);
        
        // Start performance monitoring
        if (this.config.performance.enableMonitoring) {
            monitor.startTiming(requestId);
        }
        
        try {
            // Set loading state
            this.setLoadingState(requestId, true);

            // Build configuration
            let config = {
                ...options,
                headers: {
                    ...this.config.headers,
                    ...this.getAuthHeaders(),
                    ...options.headers
                },
                signal: controller.signal
            };

            // Add progress tracking for uploads
            if (options.onUploadProgress && config.body) {
                const tracker = progressTracker.create(requestId);
                // Note: Real progress tracking would require XMLHttpRequest or similar
                // This is a placeholder for the interface
                config.onProgress = (loaded, total) => {
                    progressTracker.update(requestId, loaded, total);
                    options.onUploadProgress({ loaded, total, percentage: (loaded / total) * 100 });
                };
            }

            // Add CSRF headers for protected methods
            const method = (config.method || 'GET').toUpperCase();
            const protectedMethods = window.APP_CONSTANTS?.PROTECTED_METHODS || ['POST', 'PUT', 'DELETE', 'PATCH'];
            
            if (protectedMethods.includes(method)) {
                Object.assign(config.headers, CSRFManager.getHeaders());
            }

            // Apply request interceptors
            config = await this.applyRequestInterceptors(config);

            // Build URL
            const url = this.buildURL(endpoint, options.params);

            // Execute request with retry
            const response = await this.executeWithRetry(url, config);

            // Apply response interceptors
            const interceptedResponse = await this.applyResponseInterceptors(response);

            // Parse response
            const data = await this.parseResponse(interceptedResponse);

            // Clear loading state
            this.setLoadingState(requestId, false);
            this.activeRequests.delete(requestId);

            // End performance monitoring
            if (this.config.performance.enableMonitoring) {
                monitor.endTiming(requestId, 'success');
            }

            // Cache successful GET responses
            if (this.config.cache.enabled && config.method === 'GET') {
                apiCache.set(endpoint, options.params, options, data);
            }

            // Handle cache invalidation for mutations
            const mutationKey = `${config.method} ${endpoint}`;
            const invalidator = CacheInvalidationStrategies.onMutation[mutationKey];
            if (invalidator) {
                invalidator(apiCache, { ...options.params, ...data });
            }

            // Complete progress tracking
            progressTracker.complete(requestId);

            return data;

        } catch (error) {
            // Clear loading state
            this.setLoadingState(requestId, false);
            this.activeRequests.delete(requestId);

            // End performance monitoring
            if (this.config.performance.enableMonitoring) {
                monitor.endTiming(requestId, 'error');
            }

            // Apply error interceptors
            const finalError = await this.applyErrorInterceptors(error);
            
            // Queue request if it's an auth error and we're refreshing
            if (error instanceof AuthError && error.code === 'TOKEN_EXPIRED' && this.refreshPromise) {
                return requestQueue.enqueue({
                    endpoint,
                    options,
                    config,
                    execute: () => this.request(endpoint, options)
                });
            }
            
            // Show user-friendly error message
            this.showError(finalError);
            
            // Complete progress tracking
            progressTracker.complete(requestId);
            
            throw finalError;
        }
    }

    /**
     * Parse response based on content type
     */
    async parseResponse(response) {
        if (!response.ok) {
            const errorData = await this.parseErrorResponse(response);
            throw ErrorFactory.fromResponse(response, errorData);
        }

        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
            return response.json();
        } else if (contentType?.includes('text/')) {
            return response.text();
        } else {
            return response.blob();
        }
    }

    /**
     * Show user-friendly error message
     */
    showError(error) {
        // Don't show abort errors
        if (error.name === 'AbortError' || error.code === 'REQUEST_CANCELLED') {
            return;
        }

        // Get localized message
        const message = error.getLocalizedMessage ? 
            error.getLocalizedMessage('zh-TW') : 
            error.message || '發生錯誤，請稍後再試';

        // Get user action
        const action = ErrorRecovery.getUserAction(error, 'zh-TW');

        // Emit error event
        window.dispatchEvent(new CustomEvent('api-error', {
            detail: { error, message, action }
        }));

        // Show toast notification if available
        if (window.showToast) {
            window.showToast(message, 'error', {
                action: action.label,
                onAction: () => this.handleErrorAction(action.action, error)
            });
        } else {
            console.error('API Error:', message, error);
        }
    }

    /**
     * Handle error action
     */
    handleErrorAction(action, error) {
        switch (action) {
            case 'retry':
                // Retry the failed request
                window.location.reload();
                break;
            case 'login':
                // Redirect to login
                window.location.href = '/login';
                break;
            case 'contact':
                // Show contact information
                window.showToast('請聯絡系統管理員', 'info');
                break;
            case 'check_network':
                // Check network status
                if (!navigator.onLine) {
                    window.showToast('請檢查網路連線', 'warning');
                }
                break;
            case 'go_back':
                // Go back
                window.history.back();
                break;
        }
    }

    /**
     * HTTP method shortcuts
     */
    get(endpoint, params = {}, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'GET',
            params
        });
    }

    post(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    put(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    patch(endpoint, data = {}, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE'
        });
    }

    /**
     * Batch multiple requests
     */
    async batch(requests) {
        const results = await Promise.allSettled(
            requests.map(req => this.request(req.endpoint, req.options))
        );

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return { success: true, data: result.value };
            } else {
                return { success: false, error: result.reason, request: requests[index] };
            }
        });
    }

    /**
     * Upload file with progress
     */
    async upload(endpoint, file, options = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add additional fields
        if (options.data) {
            Object.entries(options.data).forEach(([key, value]) => {
                formData.append(key, value);
            });
        }

        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: formData,
            headers: {
                ...options.headers
                // Don't set Content-Type, let browser set it with boundary
            },
            onUploadProgress: options.onProgress
        });
    }

    /**
     * Login method
     */
    async login(credentials) {
        const response = await this.post(this.config.auth.loginEndpoint, credentials);
        
        if (response.access_token && response.refresh_token) {
            this.saveAuthTokens(response.access_token, response.refresh_token);
        }
        
        return response;
    }

    /**
     * Logout method
     */
    async logout() {
        try {
            await this.post(this.config.auth.logoutEndpoint);
        } finally {
            this.clearAuthTokens();
            apiCache.clearAll();
            window.dispatchEvent(new CustomEvent('auth-logout'));
        }
    }

    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return !!this.authToken;
    }

    /**
     * Set custom auth token
     */
    setAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem(this.config.auth.tokenKey, token);
        }
    }
}

// Create default instance
export const apiClient = new APIClient();

// Export for custom instances
export default APIClient;