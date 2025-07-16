/**
 * CSRF Protection Manager
 * Handles CSRF token management and automatic refresh
 */

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_META_NAME = 'csrf-token';

export class CSRFManager {
    static token = null;
    static refreshPromise = null;

    /**
     * Initialize CSRF manager
     */
    static initialize() {
        // Try to get token from meta tag first
        const metaToken = document.querySelector(`meta[name="${CSRF_META_NAME}"]`)?.content;
        if (metaToken) {
            this.token = metaToken;
            return;
        }

        // Try to get from session storage
        const storedToken = sessionStorage.getItem(CSRF_TOKEN_KEY);
        if (storedToken) {
            this.token = storedToken;
            return;
        }

        // If no token found, refresh it
        this.refreshToken();
    }

    /**
     * Get CSRF headers for requests
     */
    static getHeaders() {
        if (!this.token) {
            console.warn('CSRF token not available');
            return {};
        }

        return {
            [CSRF_HEADER_NAME]: this.token
        };
    }

    /**
     * Get current CSRF token
     */
    static getToken() {
        return this.token;
    }

    /**
     * Set CSRF token
     */
    static setToken(token) {
        this.token = token;
        if (token) {
            sessionStorage.setItem(CSRF_TOKEN_KEY, token);
            
            // Update meta tag if exists
            const metaTag = document.querySelector(`meta[name="${CSRF_META_NAME}"]`);
            if (metaTag) {
                metaTag.content = token;
            }
        } else {
            sessionStorage.removeItem(CSRF_TOKEN_KEY);
        }
    }

    /**
     * Refresh CSRF token from server
     */
    static async refreshToken() {
        // Prevent multiple simultaneous refresh requests
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = (async () => {
            try {
                const response = await fetch('/api/csrf/token', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to refresh CSRF token: ${response.status}`);
                }

                const data = await response.json();
                this.setToken(data.token);
                
                return data.token;
            } catch (error) {
                console.error('Failed to refresh CSRF token:', error);
                throw error;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    /**
     * Clear CSRF token
     */
    static clear() {
        this.token = null;
        sessionStorage.removeItem(CSRF_TOKEN_KEY);
    }

    /**
     * Check if request needs CSRF protection
     */
    static needsProtection(method) {
        const protectedMethods = window.APP_CONSTANTS?.PROTECTED_METHODS || 
                               ['POST', 'PUT', 'DELETE', 'PATCH'];
        return protectedMethods.includes(method.toUpperCase());
    }
}

// Initialize on load
if (typeof window !== 'undefined') {
    CSRFManager.initialize();
}

export default CSRFManager;