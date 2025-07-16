/**
 * Modern API Client Module
 * Provides unified interface for all API calls with automatic retry, 
 * error handling, and loading state management
 */

import { CSRFManager } from '../csrf/csrf-manager.js';

// API Client Configuration
const DEFAULT_CONFIG = {
    baseURL: window.APP_CONFIG?.API_BASE || '/api',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    headers: {
        'Content-Type': 'application/json'
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
            
            // Handle CSRF token refresh
            if (response.status === 403 && response.headers.get('X-CSRF-Error') === 'invalid-token') {
                await CSRFManager.refreshToken();
                Object.assign(config.headers, CSRFManager.getHeaders());
                return fetch(url, config);
            }

            // Check if response is ok
            if (!response.ok && retries > 0) {
                // Retry on 5xx errors
                if (response.status >= 500) {
                    await this.delay(this.config.retryDelay);
                    return this.executeWithRetry(url, config, retries - 1);
                }
            }

            return response;
        } catch (error) {
            if (retries > 0 && this.isRetryableError(error)) {
                await this.delay(this.config.retryDelay);
                return this.executeWithRetry(url, config, retries - 1);
            }
            throw error;
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
        const controller = this.createAbortController(requestId);
        
        try {
            // Set loading state
            this.setLoadingState(requestId, true);

            // Build configuration
            let config = {
                ...options,
                headers: {
                    ...this.config.headers,
                    ...options.headers
                },
                signal: controller.signal
            };

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

            return data;

        } catch (error) {
            // Clear loading state
            this.setLoadingState(requestId, false);
            this.activeRequests.delete(requestId);

            // Apply error interceptors
            const finalError = await this.applyErrorInterceptors(error);
            
            // Show user-friendly error message
            this.showError(finalError);
            
            throw finalError;
        }
    }

    /**
     * Parse response based on content type
     */
    async parseResponse(response) {
        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.response = response;
            error.status = response.status;
            
            try {
                error.data = await response.json();
            } catch {
                error.data = await response.text();
            }
            
            throw error;
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
        let message = '發生錯誤，請稍後再試';
        
        if (error.status === 400) {
            message = error.data?.error || '請求無效，請檢查輸入資料';
        } else if (error.status === 401) {
            message = '請重新登入';
        } else if (error.status === 403) {
            message = '您沒有權限執行此操作';
        } else if (error.status === 404) {
            message = '找不到請求的資源';
        } else if (error.status >= 500) {
            message = '伺服器錯誤，請稍後再試';
        } else if (error.name === 'AbortError') {
            message = '請求已取消';
            return; // Don't show abort errors
        } else if (error.name === 'NetworkError' || !navigator.onLine) {
            message = '網路連線失敗，請檢查網路連線';
        }

        // Emit error event
        window.dispatchEvent(new CustomEvent('api-error', {
            detail: { error, message }
        }));

        // Show toast notification if available
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            console.error('API Error:', message, error);
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
}

// Create default instance
export const apiClient = new APIClient();

// Export for custom instances
export default APIClient;