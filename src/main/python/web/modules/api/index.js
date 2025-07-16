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
    
    // Call appropriate API method
    if (method === 'get') {
        return apiClient.get(endpoint);
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

// Helper to show migration examples
export function showMigrationExample() {
    console.log(`
=== API Migration Examples ===

Before (old fetch):
    const response = await fetch(\`\${API_BASE}/clients?page=1&search=test\`);
    const data = await response.json();

After (new API client):
    const data = await api.clients.list({ page: 1, search: 'test' });

Before (with error handling):
    try {
        const response = await fetch(\`\${API_BASE}/clients\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
    } catch (error) {
        showToast('Error creating client', 'error');
    }

After (automatic error handling):
    const data = await api.clients.create(clientData);
    // Errors are automatically handled and shown to user

Before (with CSRF):
    const response = await secureFetch(\`\${API_BASE}/deliveries/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' })
    });

After (CSRF automatic):
    await api.deliveries.updateStatus(id, 'DELIVERED');

=== Benefits ===
✅ Automatic CSRF protection
✅ Automatic retry on failure
✅ Unified error handling
✅ Loading state management
✅ Request cancellation
✅ Type-safe endpoints
✅ Cleaner, more readable code
    `);
}