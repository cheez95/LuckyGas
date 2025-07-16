/**
 * Application Constants
 * 
 * This module defines all application-wide constants used throughout the frontend.
 * Organized by feature/domain for better maintainability.
 */

// API Configuration
export const API_CONFIG = {
    BASE_URL: window.location.origin,
    ENDPOINTS: {
        // Authentication
        LOGIN: '/login',
        LOGOUT: '/logout',
        CSRF_TOKEN: '/api/csrf-token',
        
        // Clients
        CLIENTS: '/api/clients',
        CLIENT_DETAIL: (id) => `/api/clients/${id}`,
        
        // Deliveries
        DELIVERIES: '/api/deliveries',
        DELIVERY_DETAIL: (id) => `/api/deliveries/${id}`,
        DELIVERY_STATUS: (id) => `/api/deliveries/${id}/status`,
        
        // Drivers
        DRIVERS: '/api/drivers',
        DRIVER_DETAIL: (id) => `/api/drivers/${id}`,
        
        // Vehicles
        VEHICLES: '/api/vehicles',
        VEHICLE_DETAIL: (id) => `/api/vehicles/${id}`,
        
        // Reports
        REPORTS: '/api/reports',
        ANALYTICS: '/api/analytics'
    },
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000 // 1 second
};

// UI Configuration
export const UI_CONFIG = {
    ITEMS_PER_PAGE: 20,
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 300,
    NOTIFICATION_DURATION: 5000,
    DATE_FORMAT: 'YYYY-MM-DD',
    TIME_FORMAT: 'HH:mm',
    DATETIME_FORMAT: 'YYYY-MM-DD HH:mm'
};

// Validation Rules
export const VALIDATION_RULES = {
    CLIENT_CODE: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 20,
        PATTERN: /^[A-Z0-9][A-Z0-9\-]*[A-Z0-9]$/i
    },
    PHONE: {
        PATTERN: /^09\d{2}-?\d{6}$|^(\(0[2-9]\)|0[2-9])-?\d{3,4}-?\d{4}$/
    },
    LICENSE_PLATE: {
        PATTERN: /^[A-Z0-9]{2,3}-[A-Z0-9]{3,4}$|^[0-9]{3,4}-[A-Z]{2}$/i
    },
    GAS_QUANTITY: {
        MIN: 1,
        MAX: 100
    },
    AMOUNT: {
        MIN: 0,
        MAX: 999999
    }
};

// Status Enums
export const STATUS = {
    DELIVERY: {
        SCHEDULED: 'scheduled',
        IN_TRANSIT: 'in_transit',
        DELIVERED: 'delivered',
        FAILED: 'failed',
        CANCELLED: 'cancelled'
    },
    VEHICLE: {
        AVAILABLE: 'available',
        IN_USE: 'in_use',
        MAINTENANCE: 'maintenance',
        RETIRED: 'retired'
    },
    DRIVER: {
        AVAILABLE: 'available',
        ON_DUTY: 'on_duty',
        OFF_DUTY: 'off_duty',
        ON_LEAVE: 'on_leave'
    }
};

// Business Rules
export const BUSINESS_RULES = {
    WORKING_HOURS: {
        START: '08:00',
        END: '18:00'
    },
    TIME_SLOTS: [
        { value: 'morning', label: '上午 (08:00-12:00)', start: '08:00', end: '12:00' },
        { value: 'afternoon', label: '下午 (13:00-18:00)', start: '13:00', end: '18:00' },
        { value: 'anytime', label: '全天', start: '08:00', end: '18:00' }
    ],
    PAYMENT_METHODS: [
        { value: 'cash', label: '現金' },
        { value: 'monthly', label: '月結' }
    ],
    VEHICLE_TYPES: [
        { value: 'truck', label: '貨車' },
        { value: 'van', label: '廂型車' },
        { value: 'motorcycle', label: '機車' }
    ],
    FUEL_TYPES: [
        { value: 'gasoline', label: '汽油' },
        { value: 'diesel', label: '柴油' },
        { value: 'electric', label: '電動' }
    ]
};

// Error Messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: '網路連線失敗，請檢查您的網路連線',
    SERVER_ERROR: '伺服器錯誤，請稍後再試',
    VALIDATION_ERROR: '輸入資料有誤，請檢查後重試',
    AUTH_ERROR: '認證失敗，請重新登入',
    NOT_FOUND: '找不到請求的資源',
    PERMISSION_DENIED: '您沒有權限執行此操作',
    SESSION_EXPIRED: '登入已過期，請重新登入',
    GENERIC_ERROR: '發生錯誤，請稍後再試'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    CREATED: '新增成功',
    UPDATED: '更新成功',
    DELETED: '刪除成功',
    SAVED: '儲存成功',
    SENT: '發送成功'
};

// Feature Flags
export const FEATURE_FLAGS = {
    ENABLE_REAL_TIME_TRACKING: false,
    ENABLE_PUSH_NOTIFICATIONS: false,
    ENABLE_OFFLINE_MODE: false,
    ENABLE_ADVANCED_ANALYTICS: true,
    ENABLE_BATCH_OPERATIONS: true
};

// Export all constants as a single object for backward compatibility
export default {
    API_CONFIG,
    UI_CONFIG,
    VALIDATION_RULES,
    STATUS,
    BUSINESS_RULES,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    FEATURE_FLAGS
};