/**
 * Application Constants
 * Immutable values used throughout the application
 */

// Status definitions
const DELIVERY_STATUS = {
    PENDING: 'pending',
    ASSIGNED: 'assigned',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// Status display mapping
const STATUS_DISPLAY = {
    [DELIVERY_STATUS.PENDING]: {
        text: '待處理',
        class: 'bg-yellow-100 text-yellow-800',
        icon: 'fa-clock',
        color: 'text-yellow-600'
    },
    [DELIVERY_STATUS.ASSIGNED]: {
        text: '已指派',
        class: 'bg-blue-100 text-blue-800',
        icon: 'fa-user-check',
        color: 'text-blue-600'
    },
    [DELIVERY_STATUS.IN_PROGRESS]: {
        text: '配送中',
        class: 'bg-purple-100 text-purple-800',
        icon: 'fa-truck',
        color: 'text-purple-600'
    },
    [DELIVERY_STATUS.COMPLETED]: {
        text: '已完成',
        class: 'bg-green-100 text-green-800',
        icon: 'fa-check-circle',
        color: 'text-green-600'
    },
    [DELIVERY_STATUS.CANCELLED]: {
        text: '已取消',
        class: 'bg-red-100 text-red-800',
        icon: 'fa-times-circle',
        color: 'text-red-600'
    }
};

// HTTP Methods
const HTTP_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
    PATCH: 'PATCH'
};

// Protected HTTP methods that require CSRF token
const PROTECTED_METHODS = [
    HTTP_METHODS.POST,
    HTTP_METHODS.PUT,
    HTTP_METHODS.DELETE,
    HTTP_METHODS.PATCH
];

// Page/Section identifiers
const PAGES = {
    DASHBOARD: 'dashboard',
    CLIENTS: 'clients',
    DELIVERIES: 'deliveries',
    ROUTES: 'routes',
    DRIVERS: 'drivers'
};

// Tab identifiers
const TABS = {
    PLANNED: 'planned',
    HISTORY: 'history',
    INFO: 'info',
    DELIVERIES: 'deliveries'
};

// Chart colors
const CHART_COLORS = {
    PRIMARY: 'rgb(59, 130, 246)',         // Blue
    PRIMARY_ALPHA: 'rgba(59, 130, 246, 0.1)',
    SUCCESS: 'rgb(34, 197, 94)',          // Green
    SUCCESS_ALPHA: 'rgba(34, 197, 94, 0.1)',
    WARNING: 'rgba(251, 191, 36, 0.8)',   // Yellow
    DANGER: 'rgba(239, 68, 68, 0.8)',     // Red
    INFO: 'rgba(59, 130, 246, 0.8)',      // Blue
    PURPLE: 'rgba(139, 92, 246, 0.8)'     // Purple
};

// Table column counts
const TABLE_COLUMNS = {
    CLIENTS: 7,
    DELIVERIES: 8,
    ROUTES: 6
};

// CSS Classes (commonly used)
const CSS_CLASSES = {
    // Navigation
    NAV_ACTIVE: 'text-blue-200 font-bold',
    NAV_INACTIVE: 'text-gray-600 hover:text-gray-800',
    
    // Tabs
    TAB_ACTIVE: 'bg-white text-blue-600 shadow',
    TAB_INACTIVE: 'text-gray-600 hover:text-gray-800',
    
    // Buttons
    BTN_PRIMARY: 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700',
    BTN_SECONDARY: 'bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300',
    BTN_DANGER: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700',
    BTN_SUCCESS: 'bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700',
    
    // Table
    TABLE_ROW: 'hover:bg-gray-50 transition-colors',
    TABLE_CELL: 'px-6 py-4 whitespace-nowrap text-sm',
    
    // Status badges
    BADGE_ACTIVE: 'px-2 py-1 text-xs rounded-full bg-green-100 text-green-800',
    BADGE_INACTIVE: 'px-2 py-1 text-xs rounded-full bg-red-100 text-red-800',
    
    // Notifications
    NOTIFICATION_SUCCESS: 'bg-green-600',
    NOTIFICATION_ERROR: 'bg-red-600',
    NOTIFICATION_INFO: 'bg-blue-600'
};

// Icon classes
const ICONS = {
    // Actions
    VIEW: 'fas fa-eye',
    EDIT: 'fas fa-edit',
    DELETE: 'fas fa-trash',
    ASSIGN: 'fas fa-user-plus',
    UPDATE: 'fas fa-sync',
    
    // Navigation
    PREV: 'fas fa-angle-left',
    NEXT: 'fas fa-angle-right',
    FIRST: 'fas fa-angle-double-left',
    LAST: 'fas fa-angle-double-right',
    
    // Status
    SUCCESS: 'fas fa-check-circle',
    ERROR: 'fas fa-exclamation-circle',
    WARNING: 'fas fa-exclamation-triangle',
    INFO: 'fas fa-info-circle',
    
    // General
    SEARCH: 'fas fa-search',
    FILTER: 'fas fa-filter',
    EXPORT: 'fas fa-download',
    REFRESH: 'fas fa-sync-alt'
};

// Notification types
const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    INFO: 'info',
    WARNING: 'warning'
};

// Sort directions
const SORT_DIRECTIONS = {
    ASC: 'asc',
    DESC: 'desc'
};

// Date range presets
const DATE_PRESETS = {
    TODAY: 'today',
    YESTERDAY: 'yesterday',
    LAST_7_DAYS: 'last_7_days',
    LAST_30_DAYS: 'last_30_days',
    THIS_MONTH: 'this_month',
    LAST_MONTH: 'last_month'
};

// Export all constants
const CONSTANTS = {
    DELIVERY_STATUS,
    STATUS_DISPLAY,
    HTTP_METHODS,
    PROTECTED_METHODS,
    PAGES,
    TABS,
    CHART_COLORS,
    TABLE_COLUMNS,
    CSS_CLASSES,
    ICONS,
    NOTIFICATION_TYPES,
    SORT_DIRECTIONS,
    DATE_PRESETS
};

// Freeze constants to prevent modifications
if (Object.freeze) {
    Object.freeze(CONSTANTS);
    Object.freeze(DELIVERY_STATUS);
    Object.freeze(STATUS_DISPLAY);
    Object.freeze(HTTP_METHODS);
    Object.freeze(PROTECTED_METHODS);
    Object.freeze(PAGES);
    Object.freeze(TABS);
    Object.freeze(CHART_COLORS);
    Object.freeze(TABLE_COLUMNS);
    Object.freeze(CSS_CLASSES);
    Object.freeze(ICONS);
    Object.freeze(NOTIFICATION_TYPES);
    Object.freeze(SORT_DIRECTIONS);
    Object.freeze(DATE_PRESETS);
}

// Export for use in other files
window.APP_CONSTANTS = CONSTANTS;

// For module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
}