/**
 * API Error Classes Module
 * Custom error classes for better error handling and localization
 */

/**
 * Base API Error class
 */
export class APIError extends Error {
    constructor(message, code, status, details = {}) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.status = status;
        this.details = details;
        this.timestamp = new Date().toISOString();
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Get localized error message
     */
    getLocalizedMessage(locale = 'zh-TW') {
        const messages = this.constructor.messages || {};
        return messages[locale]?.[this.code] || messages['zh-TW']?.[this.code] || this.message;
    }

    /**
     * Convert to plain object for serialization
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            status: this.status,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends APIError {
    constructor(message = 'Network error occurred', details = {}) {
        super(message, 'NETWORK_ERROR', 0, details);
        this.name = 'NetworkError';
    }

    static messages = {
        'zh-TW': {
            'NETWORK_ERROR': '網路連線失敗，請檢查網路連線',
            'CONNECTION_TIMEOUT': '連線逾時，請稍後再試',
            'NO_INTERNET': '無網路連線，請檢查網路設定'
        },
        'en': {
            'NETWORK_ERROR': 'Network connection failed',
            'CONNECTION_TIMEOUT': 'Connection timeout',
            'NO_INTERNET': 'No internet connection'
        }
    };
}

/**
 * Authentication errors
 */
export class AuthError extends APIError {
    constructor(message = 'Authentication failed', code = 'AUTH_ERROR', details = {}) {
        super(message, code, 401, details);
        this.name = 'AuthError';
    }

    static messages = {
        'zh-TW': {
            'AUTH_ERROR': '認證失敗，請重新登入',
            'TOKEN_EXPIRED': '登入已過期，請重新登入',
            'TOKEN_INVALID': '無效的認證資訊',
            'TOKEN_REFRESH_FAILED': '無法更新認證，請重新登入',
            'UNAUTHORIZED': '您沒有權限執行此操作'
        },
        'en': {
            'AUTH_ERROR': 'Authentication failed',
            'TOKEN_EXPIRED': 'Session expired, please login again',
            'TOKEN_INVALID': 'Invalid authentication token',
            'TOKEN_REFRESH_FAILED': 'Failed to refresh token',
            'UNAUTHORIZED': 'Unauthorized access'
        }
    };
}

/**
 * Validation errors
 */
export class ValidationError extends APIError {
    constructor(message = 'Validation failed', details = {}) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
        this.fields = details.fields || {};
    }

    static messages = {
        'zh-TW': {
            'VALIDATION_ERROR': '資料驗證失敗',
            'REQUIRED_FIELD': '此欄位為必填',
            'INVALID_FORMAT': '格式不正確',
            'INVALID_EMAIL': '請輸入有效的電子郵件',
            'INVALID_PHONE': '請輸入有效的電話號碼',
            'VALUE_TOO_LONG': '輸入內容過長',
            'VALUE_TOO_SHORT': '輸入內容過短',
            'DUPLICATE_VALUE': '此值已存在'
        },
        'en': {
            'VALIDATION_ERROR': 'Validation failed',
            'REQUIRED_FIELD': 'This field is required',
            'INVALID_FORMAT': 'Invalid format',
            'INVALID_EMAIL': 'Please enter a valid email',
            'INVALID_PHONE': 'Please enter a valid phone number',
            'VALUE_TOO_LONG': 'Value is too long',
            'VALUE_TOO_SHORT': 'Value is too short',
            'DUPLICATE_VALUE': 'This value already exists'
        }
    };

    /**
     * Get field-specific error messages
     */
    getFieldErrors(locale = 'zh-TW') {
        const messages = {};
        for (const [field, error] of Object.entries(this.fields)) {
            messages[field] = this.constructor.messages[locale]?.[error] || error;
        }
        return messages;
    }
}

/**
 * Server errors
 */
export class ServerError extends APIError {
    constructor(message = 'Server error occurred', code = 'SERVER_ERROR', status = 500, details = {}) {
        super(message, code, status, details);
        this.name = 'ServerError';
    }

    static messages = {
        'zh-TW': {
            'SERVER_ERROR': '伺服器錯誤，請稍後再試',
            'INTERNAL_ERROR': '內部錯誤，請聯絡系統管理員',
            'SERVICE_UNAVAILABLE': '服務暫時無法使用',
            'DATABASE_ERROR': '資料庫錯誤',
            'MAINTENANCE_MODE': '系統維護中，請稍後再試'
        },
        'en': {
            'SERVER_ERROR': 'Server error occurred',
            'INTERNAL_ERROR': 'Internal server error',
            'SERVICE_UNAVAILABLE': 'Service temporarily unavailable',
            'DATABASE_ERROR': 'Database error',
            'MAINTENANCE_MODE': 'System under maintenance'
        }
    };
}

/**
 * Resource not found errors
 */
export class NotFoundError extends APIError {
    constructor(resource = 'Resource', details = {}) {
        super(`${resource} not found`, 'NOT_FOUND', 404, details);
        this.name = 'NotFoundError';
        this.resource = resource;
    }

    static messages = {
        'zh-TW': {
            'NOT_FOUND': '找不到請求的資源',
            'CLIENT_NOT_FOUND': '找不到客戶資料',
            'DELIVERY_NOT_FOUND': '找不到配送資料',
            'DRIVER_NOT_FOUND': '找不到司機資料',
            'VEHICLE_NOT_FOUND': '找不到車輛資料',
            'ROUTE_NOT_FOUND': '找不到路線資料'
        },
        'en': {
            'NOT_FOUND': 'Resource not found',
            'CLIENT_NOT_FOUND': 'Client not found',
            'DELIVERY_NOT_FOUND': 'Delivery not found',
            'DRIVER_NOT_FOUND': 'Driver not found',
            'VEHICLE_NOT_FOUND': 'Vehicle not found',
            'ROUTE_NOT_FOUND': 'Route not found'
        }
    };
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends APIError {
    constructor(retryAfter = 60, details = {}) {
        super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, details);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }

    static messages = {
        'zh-TW': {
            'RATE_LIMIT_EXCEEDED': '請求過於頻繁，請稍後再試'
        },
        'en': {
            'RATE_LIMIT_EXCEEDED': 'Too many requests, please try again later'
        }
    };
}

/**
 * Request timeout errors
 */
export class TimeoutError extends APIError {
    constructor(timeout = 30000, details = {}) {
        super('Request timeout', 'REQUEST_TIMEOUT', 408, details);
        this.name = 'TimeoutError';
        this.timeout = timeout;
    }

    static messages = {
        'zh-TW': {
            'REQUEST_TIMEOUT': '請求逾時，請稍後再試'
        },
        'en': {
            'REQUEST_TIMEOUT': 'Request timeout, please try again'
        }
    };
}

/**
 * Permission errors
 */
export class PermissionError extends APIError {
    constructor(action = 'perform this action', details = {}) {
        super(`Permission denied to ${action}`, 'PERMISSION_DENIED', 403, details);
        this.name = 'PermissionError';
        this.action = action;
    }

    static messages = {
        'zh-TW': {
            'PERMISSION_DENIED': '您沒有權限執行此操作',
            'INSUFFICIENT_PERMISSIONS': '權限不足',
            'ACCESS_DENIED': '存取被拒絕'
        },
        'en': {
            'PERMISSION_DENIED': 'Permission denied',
            'INSUFFICIENT_PERMISSIONS': 'Insufficient permissions',
            'ACCESS_DENIED': 'Access denied'
        }
    };
}

/**
 * Business logic errors
 */
export class BusinessError extends APIError {
    constructor(message, code, details = {}) {
        super(message, code, 422, details);
        this.name = 'BusinessError';
    }

    static messages = {
        'zh-TW': {
            'INVALID_OPERATION': '無效的操作',
            'INSUFFICIENT_BALANCE': '餘額不足',
            'DUPLICATE_ENTRY': '資料重複',
            'INVALID_STATE': '狀態不正確',
            'DEPENDENCY_ERROR': '相依性錯誤',
            'QUOTA_EXCEEDED': '超過配額限制'
        },
        'en': {
            'INVALID_OPERATION': 'Invalid operation',
            'INSUFFICIENT_BALANCE': 'Insufficient balance',
            'DUPLICATE_ENTRY': 'Duplicate entry',
            'INVALID_STATE': 'Invalid state',
            'DEPENDENCY_ERROR': 'Dependency error',
            'QUOTA_EXCEEDED': 'Quota exceeded'
        }
    };
}

/**
 * Error factory to create appropriate error instances
 */
export class ErrorFactory {
    /**
     * Create error from API response
     */
    static fromResponse(response, data) {
        const status = response.status;
        const errorData = data || {};
        
        // Extract error details
        const message = errorData.message || errorData.error || response.statusText;
        const code = errorData.code || errorData.error_code || 'UNKNOWN_ERROR';
        const details = errorData.details || errorData.data || {};

        // Create appropriate error based on status code
        switch (status) {
            case 400:
                return new ValidationError(message, details);
            case 401:
                return new AuthError(message, code, details);
            case 403:
                return new PermissionError(message, details);
            case 404:
                return new NotFoundError(details.resource || 'Resource', details);
            case 408:
                return new TimeoutError(details.timeout, details);
            case 422:
                return new BusinessError(message, code, details);
            case 429:
                return new RateLimitError(details.retry_after, details);
            case 500:
            case 502:
            case 503:
            case 504:
                return new ServerError(message, code, status, details);
            default:
                if (status >= 400 && status < 500) {
                    return new APIError(message, code, status, details);
                } else if (status >= 500) {
                    return new ServerError(message, code, status, details);
                }
                return new APIError(message, code, status, details);
        }
    }

    /**
     * Create error from network failure
     */
    static fromNetworkError(error) {
        if (error.name === 'AbortError') {
            return new APIError('Request cancelled', 'REQUEST_CANCELLED', 0);
        }
        
        if (!navigator.onLine) {
            return new NetworkError('No internet connection', { code: 'NO_INTERNET' });
        }
        
        if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
            return new TimeoutError();
        }
        
        return new NetworkError(error.message, { originalError: error.name });
    }
}

/**
 * Error recovery strategies
 */
export const ErrorRecovery = {
    /**
     * Determine if error is recoverable
     */
    isRecoverable(error) {
        // Network errors are usually recoverable
        if (error instanceof NetworkError || error instanceof TimeoutError) {
            return true;
        }
        
        // Server errors might be recoverable
        if (error instanceof ServerError && error.status >= 500) {
            return true;
        }
        
        // Auth errors might be recoverable with token refresh
        if (error instanceof AuthError && error.code === 'TOKEN_EXPIRED') {
            return true;
        }
        
        return false;
    },

    /**
     * Get retry strategy for error
     */
    getRetryStrategy(error) {
        if (error instanceof RateLimitError) {
            return {
                shouldRetry: true,
                delay: error.retryAfter * 1000,
                maxRetries: 1
            };
        }
        
        if (error instanceof NetworkError || error instanceof TimeoutError) {
            return {
                shouldRetry: true,
                delay: 1000,
                maxRetries: 3,
                backoff: true
            };
        }
        
        if (error instanceof ServerError && error.status >= 500) {
            return {
                shouldRetry: true,
                delay: 2000,
                maxRetries: 2,
                backoff: true
            };
        }
        
        if (error instanceof AuthError && error.code === 'TOKEN_EXPIRED') {
            return {
                shouldRetry: true,
                delay: 0,
                maxRetries: 1,
                requiresTokenRefresh: true
            };
        }
        
        return {
            shouldRetry: false
        };
    },

    /**
     * Get user action for error
     */
    getUserAction(error, locale = 'zh-TW') {
        const actions = {
            'zh-TW': {
                retry: '重試',
                login: '重新登入',
                contact: '聯絡管理員',
                check_network: '檢查網路連線',
                go_back: '返回'
            },
            'en': {
                retry: 'Retry',
                login: 'Login again',
                contact: 'Contact support',
                check_network: 'Check network',
                go_back: 'Go back'
            }
        };
        
        const t = actions[locale] || actions['zh-TW'];
        
        if (error instanceof NetworkError) {
            return { action: 'check_network', label: t.check_network };
        }
        
        if (error instanceof AuthError) {
            return { action: 'login', label: t.login };
        }
        
        if (error instanceof ServerError && error.status >= 500) {
            return { action: 'contact', label: t.contact };
        }
        
        if (this.isRecoverable(error)) {
            return { action: 'retry', label: t.retry };
        }
        
        return { action: 'go_back', label: t.go_back };
    }
};

// Export all error classes
export default {
    APIError,
    NetworkError,
    AuthError,
    ValidationError,
    ServerError,
    NotFoundError,
    RateLimitError,
    TimeoutError,
    PermissionError,
    BusinessError,
    ErrorFactory,
    ErrorRecovery
};