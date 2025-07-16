/**
 * Application Configuration System
 * Centralizes all environment-specific configurations
 */

// Environment detection
const ENV = (() => {
    // Check multiple sources for environment
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // Environment detection rules
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
    } else if (hostname.includes('staging') || hostname.includes('test')) {
        return 'staging';
    } else if (port === '3000' || port === '8080') {
        // Common development ports
        return 'development';
    }
    // Default to production for safety
    return 'production';
})();

// Configuration object
const CONFIG = {
    // Current environment
    ENV: ENV,
    
    // API Configuration
    API: {
        // Base URLs per environment
        BASE_URL: {
            development: 'http://localhost:8000/api',
            staging: 'https://staging-api.luckygas.com/api',
            production: 'https://api.luckygas.com/api'
        }[ENV] || 'http://localhost:8000/api',
        
        // API Timeouts
        TIMEOUT: {
            DEFAULT: 30000,      // 30 seconds
            UPLOAD: 120000,      // 2 minutes
            DOWNLOAD: 60000      // 1 minute
        },
        
        // Retry configuration
        RETRY: {
            ATTEMPTS: 3,
            DELAY: 1000,         // 1 second
            BACKOFF_MULTIPLIER: 2
        }
    },
    
    // Authentication & Security
    SECURITY: {
        // CSRF Token configuration
        CSRF: {
            TOKEN_HEADER: 'X-CSRF-Token',
            TOKEN_EXPIRY: 24 * 60 * 60 * 1000,  // 24 hours
            TOKEN_LENGTH: 32,
            REFRESH_THRESHOLD: 60 * 60 * 1000   // Refresh if less than 1 hour left
        },
        
        // Session configuration
        SESSION: {
            TIMEOUT: 30 * 60 * 1000,            // 30 minutes
            WARNING_TIME: 5 * 60 * 1000         // Warn 5 minutes before timeout
        }
    },
    
    // Pagination settings
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 10,
        MAX_PAGE_SIZE: 100,
        PAGE_SIZE_OPTIONS: [10, 25, 50, 100]
    },
    
    // UI Configuration
    UI: {
        // Notification settings
        NOTIFICATION: {
            DURATION: 3000,      // 3 seconds
            FADE_DURATION: 300   // 300ms
        },
        
        // Animation durations
        ANIMATION: {
            FAST: 100,
            NORMAL: 300,
            SLOW: 500
        },
        
        // Chart configuration
        CHARTS: {
            ANIMATION_DURATION: 750,
            LINE_TENSION: 0.1,
            DEFAULT_FONT_SIZE: 12,
            LEGEND_PADDING: 10
        },
        
        // Debounce settings
        DEBOUNCE: {
            SEARCH: 500,         // 500ms for search
            INPUT: 300,          // 300ms for general input
            RESIZE: 100          // 100ms for window resize
        }
    },
    
    // Feature flags
    FEATURES: {
        ENABLE_ADVANCED_SEARCH: true,
        ENABLE_EXPORT: true,
        ENABLE_NOTIFICATIONS: true,
        ENABLE_REAL_TIME_UPDATES: ENV !== 'development',
        ENABLE_DEBUG_MODE: ENV === 'development'
    },
    
    // Storage keys
    STORAGE_KEYS: {
        CSRF_TOKEN: 'csrf_token',
        USER_PREFERENCES: 'user_preferences',
        CURRENT_TAB: 'currentDeliveryTab',
        LOCALE: 'locale',
        THEME: 'theme'
    },
    
    // Date/Time formats
    DATETIME: {
        DATE_FORMAT: 'YYYY-MM-DD',
        TIME_FORMAT: 'HH:mm',
        DATETIME_FORMAT: 'YYYY-MM-DD HH:mm',
        LOCALE: 'zh-TW'
    },
    
    // Error messages
    ERRORS: {
        NETWORK: '網路連接錯誤，請稍後再試',
        UNAUTHORIZED: '請重新登入',
        FORBIDDEN: '您沒有權限執行此操作',
        NOT_FOUND: '找不到請求的資源',
        SERVER_ERROR: '伺服器錯誤，請稍後再試',
        VALIDATION: '請檢查輸入的資料',
        TIMEOUT: '請求超時，請稍後再試'
    },
    
    // Success messages
    MESSAGES: {
        SAVE_SUCCESS: '保存成功',
        DELETE_SUCCESS: '刪除成功',
        UPDATE_SUCCESS: '更新成功',
        ASSIGN_SUCCESS: '指派成功',
        EXPORT_SUCCESS: '匯出成功'
    }
};

// Helper function to get nested config values safely
CONFIG.get = function(path, defaultValue = null) {
    return path.split('.').reduce((obj, key) => {
        return obj && obj[key] !== undefined ? obj[key] : defaultValue;
    }, this);
};

// Helper function to check if feature is enabled
CONFIG.isFeatureEnabled = function(featureName) {
    return this.FEATURES[featureName] === true;
};

// Helper function to get environment-specific value
CONFIG.getEnvValue = function(values) {
    return values[this.ENV] || values.production || values.default;
};

// Freeze configuration to prevent modifications
if (Object.freeze) {
    Object.freeze(CONFIG);
}

// Export configuration
window.APP_CONFIG = CONFIG;

// For module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}