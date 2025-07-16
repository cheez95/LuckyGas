/**
 * API Module Entry Point (JavaScript version)
 * Exports the configured API client and utilities
 */

import { ApiClient } from './client.js';
import { LuckyGasAPI } from './endpoints.js';
import { 
  authInterceptor, 
  loggingInterceptor, 
  errorInterceptor,
  contentTypeInterceptor,
  timingInterceptor
} from './interceptors.js';
import { loadingManager } from './loading.js';
import { cache } from './cache.js';

// Create and configure the API client
const apiClient = new ApiClient({
  baseURL: window.API_BASE || 'http://localhost:8000/api',
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: true,
    retryOnStatus: [408, 429, 500, 502, 503, 504]
  },
  cache: {
    enabled: true,
    ttl: 60000 // 1 minute default
  },
  interceptors: {
    request: [
      contentTypeInterceptor,
      authInterceptor,
      loggingInterceptor
    ],
    response: [
      errorInterceptor,
      timingInterceptor
    ]
  }
});

// Create API instance
const api = new LuckyGasAPI(apiClient);

// Export everything needed
export { api, apiClient, loadingManager, cache };

// Export all interceptors for custom use
export * from './interceptors.js';

// Global error handlers
window.addEventListener('auth:unauthorized', () => {
  // Handle unauthorized - redirect to login
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
});

window.addEventListener('api:servererror', (event) => {
  // Show notification for server errors
  const showNotification = window.showNotification;
  if (showNotification) {
    showNotification('伺服器錯誤，請稍後再試', 'error');
  }
});

window.addEventListener('api:ratelimited', (event) => {
  // Handle rate limiting
  const retryAfter = event.detail.retryAfter;
  const showNotification = window.showNotification;
  if (showNotification) {
    showNotification(`請求過於頻繁，請 ${retryAfter} 秒後再試`, 'warning');
  }
});

// Make API available globally for migration
window.luckyGasAPI = api;
window.apiLoadingManager = loadingManager;