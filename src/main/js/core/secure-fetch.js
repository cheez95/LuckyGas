/**
 * Secure Fetch Wrapper
 * Automatically adds CSRF protection to all API requests
 */

import csrfManager from './csrf-manager.js';

/**
 * Methods that require CSRF protection
 */
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Default fetch configuration
 */
const DEFAULT_CONFIG = {
    credentials: 'same-origin',
    headers: {
        'Content-Type': 'application/json'
    }
};

/**
 * Secure fetch wrapper with CSRF protection
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
export async function secureFetch(url, options = {}) {
    // Merge with default config
    const config = {
        ...DEFAULT_CONFIG,
        ...options,
        headers: {
            ...DEFAULT_CONFIG.headers,
            ...options.headers
        }
    };

    // Add CSRF token for protected methods
    const method = (config.method || 'GET').toUpperCase();
    if (PROTECTED_METHODS.includes(method)) {
        Object.assign(config.headers, csrfManager.getHeaders());
    }

    try {
        const response = await fetch(url, config);

        // Handle CSRF token refresh if needed
        if (response.status === 403 && response.headers.get('X-CSRF-Error') === 'invalid-token') {
            // Refresh token and retry once
            csrfManager.refreshToken();
            Object.assign(config.headers, csrfManager.getHeaders());
            return fetch(url, config);
        }

        return response;
    } catch (error) {
        console.error('Secure fetch error:', error);
        throw error;
    }
}

/**
 * Helper functions for common HTTP methods
 */
export const secureApi = {
    /**
     * GET request
     */
    get: (url, options = {}) => {
        return secureFetch(url, {
            ...options,
            method: 'GET'
        });
    },

    /**
     * POST request with CSRF protection
     */
    post: (url, data, options = {}) => {
        return secureFetch(url, {
            ...options,
            method: 'POST',
            body: typeof data === 'string' ? data : JSON.stringify(data)
        });
    },

    /**
     * PUT request with CSRF protection
     */
    put: (url, data, options = {}) => {
        return secureFetch(url, {
            ...options,
            method: 'PUT',
            body: typeof data === 'string' ? data : JSON.stringify(data)
        });
    },

    /**
     * DELETE request with CSRF protection
     */
    delete: (url, options = {}) => {
        return secureFetch(url, {
            ...options,
            method: 'DELETE'
        });
    },

    /**
     * PATCH request with CSRF protection
     */
    patch: (url, data, options = {}) => {
        return secureFetch(url, {
            ...options,
            method: 'PATCH',
            body: typeof data === 'string' ? data : JSON.stringify(data)
        });
    }
};

// Export both the main function and the helper object
export default secureFetch;