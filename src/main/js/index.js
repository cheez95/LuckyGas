/**
 * LuckyGas Frontend Application Entry Point
 * 
 * This is the main entry point that imports and initializes all modules
 * and provides a global API for backward compatibility.
 */

// Import core modules
import csrfManager from './core/csrf-manager.js';
import { secureFetch } from './core/secure-fetch.js';

// Import API modules
import { ApiClient } from './core/api/client.js';
import { LuckyGasAPI } from './core/api/endpoints.js';
import { cache } from './core/api/cache.js';
import * as interceptors from './core/api/interceptors.js';
import { loadingManager } from './core/api/loading.js';

// Import utility modules
import ValidationUtils from './utils/validation.js';
import SanitizationUtils from './utils/sanitization.js';
import SecurityUtils from './utils/security-utils.js';

// Import state management
import { store } from './state/store.js';
import { integrator } from './state/integrator.js';

// Import configuration
import constants from './config/constants.js';

// Initialize modules on DOM ready
function initializeApp() {
    // Initialize CSRF protection
    csrfManager.initialize();
    
    // Initialize API client
    const apiClient = new ApiClient({
        baseURL: constants.API_CONFIG.BASE_URL,
        timeout: constants.API_CONFIG.TIMEOUT,
        interceptors: {
            request: [
                interceptors.authInterceptor,
                interceptors.csrfInterceptor,
                interceptors.contentTypeInterceptor
            ],
            response: [
                interceptors.errorInterceptor,
                interceptors.timingInterceptor
            ]
        }
    });
    
    // Create API instance
    const api = new LuckyGasAPI(apiClient);
    
    // Initialize state bindings
    integrator.setupCommonBindings();
    
    // Return initialized modules
    return {
        api,
        apiClient,
        csrf: csrfManager,
        store,
        integrator,
        cache,
        loadingManager
    };
}

// Create global LuckyGas object for backward compatibility
const LuckyGas = {
    // Core modules
    csrf: csrfManager,
    secureFetch,
    
    // API modules
    api: {
        client: ApiClient,
        LuckyGasAPI,
        cache,
        interceptors,
        loadingManager
    },
    
    // Utility modules
    utils: {
        validation: ValidationUtils,
        sanitization: SanitizationUtils,
        security: SecurityUtils
    },
    
    // State management
    state: {
        store,
        integrator
    },
    
    // Configuration
    config: constants,
    
    // Application initialization
    init: initializeApp,
    
    // Version information
    version: '2.0.0',
    
    // Feature detection
    features: {
        es6Modules: true,
        asyncAwait: true,
        fetch: typeof fetch !== 'undefined',
        localStorage: typeof localStorage !== 'undefined',
        sessionStorage: typeof sessionStorage !== 'undefined'
    }
};

// Auto-initialize on DOM ready if not in module context
if (typeof window !== 'undefined') {
    // Export to window for global access
    window.LuckyGas = LuckyGas;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            LuckyGas.init();
        });
    } else {
        // DOM is already ready
        LuckyGas.init();
    }
}

// Export modules for ES6 imports
export {
    // Core modules
    csrfManager,
    secureFetch,
    
    // API modules
    ApiClient,
    endpoints,
    cache,
    interceptors,
    loading,
    
    // Utility modules
    ValidationUtils,
    SanitizationUtils,
    SecurityUtils,
    
    // State management
    store,
    stateIntegrator,
    
    // Configuration
    constants
};

// Export default for convenience
export default LuckyGas;