/**
 * CSRF Token Management Module
 * Handles CSRF token generation, storage, and retrieval
 */

class CSRFManager {
    constructor() {
        this.TOKEN_KEY = 'csrf_token';
        this.TOKEN_HEADER = 'X-CSRF-Token';
        this.TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
        this._initializeToken();
    }

    /**
     * Initialize or retrieve existing CSRF token
     */
    _initializeToken() {
        const storedToken = this._getStoredToken();
        if (!storedToken || this._isTokenExpired(storedToken)) {
            this._generateNewToken();
        }
    }

    /**
     * Generate a new CSRF token
     */
    _generateNewToken() {
        const token = this._generateSecureToken();
        const tokenData = {
            value: token,
            createdAt: Date.now()
        };
        localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
        return token;
    }

    /**
     * Generate a cryptographically secure token
     */
    _generateSecureToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Get stored token data
     */
    _getStoredToken() {
        try {
            const stored = localStorage.getItem(this.TOKEN_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('Failed to parse CSRF token:', e);
            return null;
        }
    }

    /**
     * Check if token is expired
     */
    _isTokenExpired(tokenData) {
        if (!tokenData || !tokenData.createdAt) return true;
        return Date.now() - tokenData.createdAt > this.TOKEN_EXPIRY;
    }

    /**
     * Get current CSRF token
     */
    getToken() {
        const storedToken = this._getStoredToken();
        if (!storedToken || this._isTokenExpired(storedToken)) {
            return this._generateNewToken();
        }
        return storedToken.value;
    }

    /**
     * Get CSRF header object for requests
     */
    getHeaders() {
        return {
            [this.TOKEN_HEADER]: this.getToken()
        };
    }

    /**
     * Refresh CSRF token
     */
    refreshToken() {
        return this._generateNewToken();
    }

    /**
     * Clear CSRF token
     */
    clearToken() {
        localStorage.removeItem(this.TOKEN_KEY);
    }

    /**
     * Validate CSRF token format
     */
    isValidToken(token) {
        return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
    }
}

// Export singleton instance
const csrfManager = new CSRFManager();

// Also export class for testing
export { CSRFManager, csrfManager as default };