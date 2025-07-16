/**
 * Common API Interceptors (JavaScript version)
 * Reusable interceptors for authentication, logging, error handling
 */

/**
 * Authentication interceptor - adds auth token to requests
 */
export const authInterceptor = (config) => {
  // Get token from localStorage or session
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return config;
};

/**
 * Logging interceptor - logs all requests
 */
export const loggingInterceptor = (config) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] API Request:`, {
    method: config.method || 'GET',
    url: config.params ? `${config.params}` : 'No URL',
    headers: config.headers,
    body: config.body
  });
  
  return config;
};

/**
 * Error response interceptor - handles common error cases
 */
export const errorInterceptor = async (response) => {
  if (!response.ok) {
    // Log error details
    console.error(`API Error: ${response.status} ${response.statusText}`, {
      url: response.url,
      status: response.status,
      statusText: response.statusText
    });

    // Handle specific status codes
    switch (response.status) {
      case 401:
        // Unauthorized - clear auth and redirect
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        
        // Dispatch custom event for app to handle
        window.dispatchEvent(new CustomEvent('auth:unauthorized', {
          detail: { response }
        }));
        break;

      case 403:
        // Forbidden
        window.dispatchEvent(new CustomEvent('auth:forbidden', {
          detail: { response }
        }));
        break;

      case 404:
        // Not found
        window.dispatchEvent(new CustomEvent('api:notfound', {
          detail: { response }
        }));
        break;

      case 429:
        // Rate limited
        const retryAfter = response.headers.get('Retry-After');
        window.dispatchEvent(new CustomEvent('api:ratelimited', {
          detail: { response, retryAfter }
        }));
        break;

      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors
        window.dispatchEvent(new CustomEvent('api:servererror', {
          detail: { response }
        }));
        break;
    }
  }

  return response;
};

/**
 * CSRF interceptor - adds CSRF token to state-changing requests
 */
export const csrfInterceptor = (config) => {
  const csrfMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (config.method && csrfMethods.includes(config.method.toUpperCase())) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    if (csrfToken && config.headers) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  
  return config;
};

/**
 * Timestamp interceptor - adds timestamp to requests
 */
export const timestampInterceptor = (config) => {
  if (!config.params) {
    config.params = {};
  }
  
  // Add timestamp to prevent caching issues
  config.params._t = Date.now();
  
  return config;
};

/**
 * Response timing interceptor - measures response time
 */
export const timingInterceptor = async (response) => {
  const timing = performance.getEntriesByName(response.url).pop();
  
  if (timing) {
    const duration = timing.responseEnd - timing.requestStart;
    console.log(`[API Timing] ${response.url}: ${duration.toFixed(2)}ms`);
    
    // Add timing to response for monitoring
    response.__timing = duration;
  }
  
  return response;
};

/**
 * Retry after interceptor - handles Retry-After headers
 */
export const retryAfterInterceptor = async (response) => {
  if (response.status === 429 || response.status === 503) {
    const retryAfter = response.headers.get('Retry-After');
    
    if (retryAfter) {
      // Parse retry after (can be seconds or HTTP date)
      const retryDelay = isNaN(Number(retryAfter)) 
        ? new Date(retryAfter).getTime() - Date.now()
        : Number(retryAfter) * 1000;
      
      // Store for retry logic
      response.__retryAfter = retryDelay;
    }
  }
  
  return response;
};

/**
 * Content type interceptor - ensures proper content type
 */
export const contentTypeInterceptor = (config) => {
  // Only set content-type if body exists and not already set
  if (config.body && config.headers && !config.headers['Content-Type']) {
    if (config.body instanceof FormData) {
      // Let browser set content-type for FormData
      delete config.headers['Content-Type'];
    } else if (typeof config.body === 'string') {
      // Assume JSON if string
      try {
        JSON.parse(config.body);
        config.headers['Content-Type'] = 'application/json';
      } catch {
        // Not JSON, set as text
        config.headers['Content-Type'] = 'text/plain';
      }
    }
  }
  
  return config;
};

/**
 * Create custom interceptor
 */
export function createInterceptor(fn) {
  return fn;
}