/**
 * API Module Main Export
 * Unified interface for all API operations
 */

import APIClient, { apiClient } from './client.js';
import api from './endpoints.js';
import { CSRFManager } from '../csrf/csrf-manager.js';

// Initialize API client with config
export function initializeAPI(config = {}) {
    // Set base URL from config or environment
    if (config.baseURL) {
        apiClient.config.baseURL = config.baseURL;
    }

    // Initialize CSRF protection
    CSRFManager.initialize();

    // Add default request interceptor for logging in development
    if (config.debug || window.APP_CONFIG?.DEBUG) {
        apiClient.addRequestInterceptor((config) => {
            console.log(`[API Request] ${config.method || 'GET'} ${config.url}`, config);
            return config;
        });

        apiClient.addResponseInterceptor((response) => {
            console.log(`[API Response] ${response.url}`, response);
            return response;
        });

        apiClient.addErrorInterceptor((error) => {
            console.error(`[API Error]`, error);
            return error;
        });
    }

    // Add loading state tracking interceptor
    apiClient.addRequestInterceptor((config) => {
        // Show global loading indicator
        if (window.showGlobalLoading) {
            window.showGlobalLoading(true);
        }
        return config;
    });

    apiClient.addResponseInterceptor((response) => {
        // Hide global loading indicator
        if (window.showGlobalLoading) {
            window.showGlobalLoading(false);
        }
        return response;
    });

    apiClient.addErrorInterceptor((error) => {
        // Hide global loading indicator on error
        if (window.showGlobalLoading) {
            window.showGlobalLoading(false);
        }
        return error;
    });

    return apiClient;
}

// Export everything needed
export { APIClient, apiClient, api, CSRFManager };

// Export individual endpoint groups for convenience
export { 
    dashboard,
    clients,
    deliveries,
    drivers,
    vehicles,
    routes,
    scheduling,
    csrf
} from './endpoints.js';

// Default export is the api object
export default api;

/**
 * Migration Helper Functions
 * Helps transition from old fetch calls to new API client
 */

// Helper to migrate simple fetch calls
export function migrateSimpleFetch(url, options = {}) {
    console.warn(`[Migration] Converting fetch('${url}') to new API client`);
    
    // Extract endpoint from URL
    const endpoint = url.replace(window.APP_CONFIG?.API_BASE || '/api', '');
    
    // Determine method
    const method = (options.method || 'GET').toLowerCase();
    
    // Extract query params from URL
    const urlObj = new URL(url, window.location.origin);
    const params = Object.fromEntries(urlObj.searchParams);
    
    // Call appropriate API method
    if (method === 'get') {
        return apiClient.get(endpoint.split('?')[0], params);
    } else if (method === 'post') {
        const data = options.body ? JSON.parse(options.body) : {};
        return apiClient.post(endpoint, data);
    } else if (method === 'put') {
        const data = options.body ? JSON.parse(options.body) : {};
        return apiClient.put(endpoint, data);
    } else if (method === 'delete') {
        return apiClient.delete(endpoint);
    }
}

// Helper to setup auth
export function setupAuth(token, refreshToken) {
    if (token) {
        apiClient.setAuthToken(token);
    }
    if (refreshToken) {
        apiClient.saveAuthTokens(token, refreshToken);
    }
}

// Helper to handle errors
export function handleAPIError(error) {
    // Check if it's already an API error
    if (error instanceof errors.APIError) {
        return error;
    }
    
    // Convert fetch errors to API errors
    if (error.response) {
        return ErrorFactory.fromResponse(error.response, error.data);
    }
    
    // Network errors
    return ErrorFactory.fromNetworkError(error);
}

// Helper to show migration examples
export function showMigrationExample() {
    console.log(`
=== Enhanced API Migration Guide ===

1. BASIC USAGE
==============

Before (old fetch):
    const response = await fetch(\`\${API_BASE}/clients?page=1&search=test\`);
    const data = await response.json();

After (new API client):
    const data = await api.clients.list({ page: 1, search: 'test' });

2. ERROR HANDLING
=================

Before (manual error handling):
    try {
        const response = await fetch(\`\${API_BASE}/clients\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
            } else if (response.status === 400) {
                const error = await response.json();
                showToast(error.message, 'error');
            } else {
                throw new Error('Failed');
            }
        }
        const data = await response.json();
    } catch (error) {
        showToast('Error creating client', 'error');
    }

After (automatic error handling with recovery):
    try {
        const data = await api.clients.create(clientData);
    } catch (error) {
        // Error is automatically shown to user with localized message
        // You can still handle specific errors if needed:
        if (error instanceof ValidationError) {
            console.log('Validation errors:', error.getFieldErrors());
        }
    }

3. AUTHENTICATION
=================

Before (manual auth):
    const token = localStorage.getItem('access_token');
    const response = await fetch(\`\${API_BASE}/protected\`, {
        headers: {
            'Authorization': \`Bearer \${token}\`,
            'Content-Type': 'application/json'
        }
    });
    if (response.status === 401) {
        // Manual token refresh logic...
    }

After (automatic auth with token refresh):
    // Login
    await apiClient.login({ username, password });
    
    // All requests automatically include auth headers
    const data = await api.protected.get();
    // Token refresh happens automatically on 401

4. PERFORMANCE OPTIMIZATION
===========================

Caching:
    // Responses are automatically cached
    await api.clients.list(); // Network request
    await api.clients.list(); // Cache hit!
    
    // Manual cache control
    apiCache.invalidate('/clients'); // Clear client cache
    apiCache.clearAll(); // Clear all cache

Debouncing (search as you type):
    // Old way: manual debouncing
    let timeoutId;
    function search(term) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fetch(\`\${API_BASE}/search?q=\${term}\`);
        }, 300);
    }
    
    // New way: built-in debouncing
    function search(term) {
        return api.search.query({ q: term }, { debounce: 300 });
    }

Throttling (prevent spam):
    // Limit requests to once per second
    await api.actions.save(data, { throttle: 1000 });

Concurrent requests:
    // Old way: Promise.all with no limit
    await Promise.all(ids.map(id => fetch(\`\${API_BASE}/items/\${id}\`)));
    
    // New way: automatic concurrency limiting
    await apiClient.batch(
        ids.map(id => ({ endpoint: \`/items/\${id}\`, options: {} }))
    );

5. FILE UPLOADS
===============

Before:
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(\`\${API_BASE}/upload\`, {
        method: 'POST',
        body: formData
    });

After (with progress tracking):
    await apiClient.upload('/upload', file, {
        onProgress: ({ percentage }) => {
            console.log(\`Upload progress: \${percentage}%\`);
        }
    });

6. REQUEST CANCELLATION
=======================

Before:
    const controller = new AbortController();
    fetch(url, { signal: controller.signal });
    // Later: controller.abort();

After:
    const requestId = 'my-request';
    api.data.get({}, { requestId });
    // Later: apiClient.cancelRequest(requestId);
    // Or cancel all: apiClient.cancelAllRequests();

7. CUSTOM ERROR HANDLING
========================

// Global error handler
apiClient.addErrorInterceptor((error) => {
    if (error instanceof NetworkError) {
        // Show offline indicator
    }
    return error;
});

// Request-specific error handling
try {
    await api.risky.operation();
} catch (error) {
    const recovery = ErrorRecovery.getRetryStrategy(error);
    if (recovery.shouldRetry) {
        // Implement custom retry logic
    }
}

8. LOADING STATES
=================

// Global loading indicator
window.addEventListener('api-loading-change', (event) => {
    const { requestId, isLoading } = event.detail;
    updateLoadingUI(isLoading);
});

// Check specific request loading
const isLoading = apiClient.isLoading('my-request');

=== NEW FEATURES ===
✅ JWT Authentication with auto-refresh
✅ Smart caching with TTL and LRU eviction
✅ Request debouncing and throttling
✅ Concurrent request limiting
✅ Upload/download progress tracking
✅ Intelligent error recovery
✅ Localized error messages (Chinese)
✅ Performance monitoring
✅ Request queuing during auth refresh
✅ Batch request support
✅ Offline support with cache fallback
    `);
}

// Export migration guide as markdown
export const MIGRATION_GUIDE = `
# API Client Migration Guide

## Quick Start

1. Replace all \`fetch()\` calls with API client methods
2. Remove manual error handling - it's automatic now
3. Remove auth header management - it's automatic
4. Leverage new performance features

## Authentication Setup

\`\`\`javascript
// Initialize on app start
import { initializeAPI, apiClient } from './modules/api';

initializeAPI({
    baseURL: '/api',
    auth: {
        loginRedirect: '/login'
    }
});

// Login
const { access_token, refresh_token } = await apiClient.login({
    username: 'user',
    password: 'pass'
});

// Logout
await apiClient.logout();
\`\`\`

## Error Handling Patterns

\`\`\`javascript
import { ValidationError, NetworkError } from './modules/api';

try {
    await api.clients.create(data);
} catch (error) {
    if (error instanceof ValidationError) {
        // Show field-specific errors
        const fieldErrors = error.getFieldErrors('zh-TW');
    } else if (error instanceof NetworkError) {
        // Handle offline state
    }
    // All errors are automatically shown to user
}
\`\`\`

## Performance Optimization

\`\`\`javascript
// Debounce search requests
function handleSearch(term) {
    return api.search.query({ q: term }, { debounce: 300 });
}

// Throttle save operations  
function handleSave(data) {
    return api.data.save(data, { throttle: 1000 });
}

// Cache management
import { apiCache } from './modules/api';

// Invalidate specific endpoints
apiCache.invalidate('/clients');

// Invalidate by entity
apiCache.invalidateEntity('client', clientId);

// Warm cache on app load
apiCache.warmCache([
    { path: '/dashboard/stats' },
    { path: '/clients', params: { page: 1 } }
], apiClient.get.bind(apiClient));
\`\`\`

## Migration Checklist

- [ ] Replace fetch() with api.endpoint.method()
- [ ] Remove manual auth headers
- [ ] Remove manual CSRF handling
- [ ] Update error handling to use error classes
- [ ] Add debouncing to search inputs
- [ ] Add throttling to frequent actions
- [ ] Implement progress tracking for uploads
- [ ] Setup global error/loading handlers
- [ ] Configure cache strategies
- [ ] Test auth token refresh flow
`;

// Auto-initialize on import if config is available
if (window.APP_CONFIG?.API_BASE) {
    initializeAPI({
        baseURL: window.APP_CONFIG.API_BASE,
        debug: window.APP_CONFIG.DEBUG
    });
}