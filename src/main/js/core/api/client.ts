/**
 * Unified API Client
 * Modern, testable API layer with interceptors, caching, and retry logic
 */

import type {
  ApiConfig,
  ApiResponse,
  RequestOptions,
  RequestInterceptor,
  ResponseInterceptor,
  RetryOptions
} from './types';
import { cache, CacheManager } from './cache';
import { loadingManager, withLoading } from './loading';

export class ApiClient {
  private config: ApiConfig;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: ApiConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      retry: {
        attempts: 3,
        delay: 1000,
        backoff: true,
        retryOnStatus: [408, 429, 500, 502, 503, 504]
      },
      ...config
    };

    // Setup interceptors
    if (config.interceptors?.request) {
      this.requestInterceptors = config.interceptors.request;
    }
    if (config.interceptors?.response) {
      this.responseInterceptors = config.interceptors.response;
    }
  }

  /**
   * Make a request with full features
   */
  async request<T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url, options.params);
    const cacheKey = CacheManager.generateKey(fullUrl, options.params);
    
    // Check cache first
    if (options.cache?.enabled && !options.cache?.invalidate) {
      const cachedData = cache.get<T>(cacheKey);
      if (cachedData !== null) {
        return { data: cachedData, success: true };
      }
    }

    // Invalidate cache if requested
    if (options.cache?.invalidate) {
      cache.invalidate(cacheKey);
    }

    // Setup abort controller
    const abortController = new AbortController();
    const requestId = `${url}-${Date.now()}`;
    this.abortControllers.set(requestId, abortController);

    // Merge options
    const requestOptions: RequestOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
        ...options.headers
      },
      signal: options.signal || abortController.signal
    };

    // Apply request interceptors
    let finalOptions = requestOptions;
    for (const interceptor of this.requestInterceptors) {
      finalOptions = await interceptor(finalOptions);
    }

    // Setup timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, options.timeout || this.config.timeout || 30000);

    try {
      // Make request with retry logic
      const response = await this.executeWithRetry(
        fullUrl,
        finalOptions,
        options.retry || this.config.retry
      );

      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      // Apply response interceptors
      let finalResponse = response;
      for (const interceptor of this.responseInterceptors) {
        finalResponse = await interceptor(finalResponse);
      }

      // Parse response
      const data = await this.parseResponse<T>(finalResponse);

      // Cache successful responses
      if (options.cache?.enabled && finalResponse.ok) {
        cache.set(cacheKey, data, options.cache.ttl);
      }

      return {
        data,
        success: finalResponse.ok,
        message: finalResponse.ok ? undefined : 'Request failed'
      };

    } catch (error) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: {
              code: 'REQUEST_ABORTED',
              message: 'Request was aborted',
              status: 0
            }
          };
        }

        return {
          success: false,
          error: {
            code: 'REQUEST_ERROR',
            message: error.message,
            status: 0
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
          status: 0
        }
      };
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(
    url: string,
    options: RequestOptions,
    retryOptions?: RetryOptions
  ): Promise<Response> {
    const maxAttempts = retryOptions?.attempts || 1;
    const delay = retryOptions?.delay || 1000;
    const backoff = retryOptions?.backoff !== false;
    const retryOnStatus = retryOptions?.retryOnStatus || [];

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, options);

        // Check if we should retry based on status
        if (
          !response.ok &&
          retryOnStatus.includes(response.status) &&
          attempt < maxAttempts
        ) {
          await this.delay(delay * (backoff ? attempt : 1));
          continue;
        }

        return response;

      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          await this.delay(delay * (backoff ? attempt : 1));
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    }

    if (contentType?.includes('text/')) {
      return response.text() as any;
    }

    if (contentType?.includes('blob') || contentType?.includes('octet-stream')) {
      return response.blob() as any;
    }

    // Default to JSON parsing
    try {
      return response.json();
    } catch {
      return response.text() as any;
    }
  }

  /**
   * Build full URL with base URL
   */
  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = path.startsWith('http') 
      ? path 
      : `${this.config.baseURL}${path}`;

    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return `${url}?${searchParams.toString()}`;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convenience methods
   */
  async get<T = any>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return withLoading(`GET ${url}`, () =>
      this.request<T>(url, { ...options, method: 'GET' })
    );
  }

  async post<T = any>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return withLoading(`POST ${url}`, () =>
      this.request<T>(url, {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined
      })
    );
  }

  async put<T = any>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return withLoading(`PUT ${url}`, () =>
      this.request<T>(url, {
        ...options,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined
      })
    );
  }

  async delete<T = any>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return withLoading(`DELETE ${url}`, () =>
      this.request<T>(url, { ...options, method: 'DELETE' })
    );
  }

  async patch<T = any>(url: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return withLoading(`PATCH ${url}`, () =>
      this.request<T>(url, {
        ...options,
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined
      })
    );
  }

  /**
   * Cancel a request
   */
  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Clear all interceptors
   */
  clearInterceptors(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }
}