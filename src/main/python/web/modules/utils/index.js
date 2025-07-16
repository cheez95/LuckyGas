/**
 * Utilities Module Index
 * Central export point for all utility functions
 */

// Import all utility modules
import * as dom from './dom.js';
import * as datetime from './datetime.js';
import * as format from './format.js';
import * as data from './data.js';
import * as security from './security.js';

// Re-export all utilities
export * from './dom.js';
export * from './datetime.js';
export * from './format.js';
export * from './data.js';
export * from './security.js';

// Named exports for module access
export { dom, datetime, format, data, security };

// Commonly used utilities - direct access
export const {
    // DOM utilities
    $,
    $$,
    createElement,
    createModal,
    showNotification,
    showLoading,
    debounce,
    throttle,
    
    // Date/time utilities
    formatDate,
    formatDateTime,
    formatTime,
    getRelativeTime,
    
    // Format utilities
    formatCurrency,
    formatPhone,
    formatStatus,
    formatQuantity,
    
    // Data utilities
    sortBy,
    filterBySearch,
    groupBy,
    paginate,
    
    // Security utilities
    escapeHtml,
    sanitizeInput
} = {
    ...dom,
    ...datetime,
    ...format,
    ...data,
    ...security
};

// Legacy compatibility layer
// Maps old function names to new utilities for backward compatibility
export const legacyUtils = {
    // Old SecurityUtils methods
    SecurityUtils: security.SecurityUtils,
    
    // Direct function mappings
    escapeHtml: security.escapeHtml,
    createTextNode: security.createTextNode,
    createElement: dom.createElement,
    createOption: dom.createOption,
    
    // Format functions that were inline
    formatDate: datetime.formatDate,
    formatDateTime: datetime.formatDateTime,
    
    // DOM helpers that were inline
    debounce: dom.debounce,
    showNotification: dom.showNotification,
    
    // Sorting functions
    sortClients: (column, filters) => {
        // Legacy sort adapter
        if (filters.sortBy === column) {
            filters.sortOrder = filters.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            filters.sortBy = column;
            filters.sortOrder = 'asc';
        }
        return filters;
    },
    
    // Modal creation
    createModal: dom.createModal,
    createEditModal: (title, content) => {
        // Legacy modal adapter
        const modalContent = `
            <div class="px-6 py-4 border-b">
                <h3 class="text-lg font-semibold">${security.escapeHtml(title)}</h3>
            </div>
            <div class="p-6">
                ${content}
            </div>
        `;
        return dom.createModal(modalContent);
    }
};

// Utility documentation
export const utilityDocs = {
    dom: {
        description: 'DOM manipulation and UI helpers',
        functions: [
            '$ - Query selector shorthand',
            '$$ - Query selector all shorthand',
            'createElement - Safe element creation',
            'createModal - Modal dialog creation',
            'showNotification - Display notifications',
            'showLoading - Show/hide loading spinner',
            'debounce - Debounce function execution',
            'throttle - Throttle function execution'
        ]
    },
    datetime: {
        description: 'Date and time formatting for Taiwan locale',
        functions: [
            'formatDate - Format date to Taiwan locale',
            'formatDateTime - Format date and time',
            'formatTime - Format time only',
            'getRelativeTime - Get relative time string',
            'formatDuration - Format duration in minutes',
            'daysBetween - Calculate days between dates'
        ]
    },
    format: {
        description: 'Number, currency, and data formatting',
        functions: [
            'formatCurrency - Format TWD currency',
            'formatPhone - Format Taiwan phone numbers',
            'formatStatus - Format status with styling',
            'formatQuantity - Format numbers with units',
            'formatDistance - Format distance in km',
            'formatPercentage - Format percentage values'
        ]
    },
    data: {
        description: 'Array and object manipulation',
        functions: [
            'sortBy - Sort array by property',
            'filterBySearch - Filter by search term',
            'groupBy - Group array by property',
            'paginate - Paginate array data',
            'sumBy - Calculate sum of property',
            'deepClone - Deep clone objects'
        ]
    },
    security: {
        description: 'XSS prevention and security utilities',
        functions: [
            'escapeHtml - Escape HTML entities',
            'sanitizeInput - Sanitize user input',
            'createSafeElement - Create elements safely',
            'isSafeUrl - Validate URL safety'
        ]
    }
};

// Default export - all utilities
export default {
    dom,
    datetime,
    format,
    data,
    security,
    legacy: legacyUtils,
    docs: utilityDocs
};