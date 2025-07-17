/**
 * Input Sanitization Utilities for LuckyGas
 * 
 * This module provides comprehensive sanitization functions to prevent
 * SQL injection, XSS attacks, and ensure data integrity.
 * 
 * @module SanitizationUtils
 * @version 1.0.0
 */

const SanitizationUtils = {
    /**
     * Sanitize string input to prevent SQL injection and XSS
     * @param {*} input - Input to sanitize
     * @param {Object} options - Sanitization options
     * @returns {string} Sanitized string
     */
    sanitizeString(input, options = {}) {
        if (input === null || input === undefined) {
            return '';
        }

        let sanitized = String(input);

        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');

        // Trim whitespace
        if (options.trim !== false) {
            sanitized = sanitized.trim();
        }

        // Remove or escape dangerous characters based on context
        if (options.context === 'sql') {
            // For SQL context, escape single quotes
            sanitized = sanitized.replace(/'/g, "''");
        } else if (options.context === 'html') {
            // For HTML context, escape HTML entities
            sanitized = this.escapeHtml(sanitized);
        } else {
            // Default: remove script tags and event handlers
            sanitized = this.removeScriptTags(sanitized);
            sanitized = this.removeEventHandlers(sanitized);
        }

        // Apply length limit if specified
        if (options.maxLength && sanitized.length > options.maxLength) {
            sanitized = sanitized.substring(0, options.maxLength);
        }

        // Remove multiple spaces if specified
        if (options.normalizeSpaces) {
            sanitized = sanitized.replace(/\s+/g, ' ');
        }

        return sanitized;
    },

    /**
     * Sanitize numeric input
     * @param {*} input - Input to sanitize
     * @param {Object} options - Options {type: 'integer'|'float', min: number, max: number}
     * @returns {number|null} Sanitized number or null if invalid
     */
    sanitizeNumber(input, options = {}) {
        if (input === null || input === undefined || input === '') {
            return options.defaultValue !== undefined ? options.defaultValue : null;
        }

        // Convert to number
        let num = Number(input);

        // Check if valid number
        if (isNaN(num)) {
            return options.defaultValue !== undefined ? options.defaultValue : null;
        }

        // Apply type constraints
        if (options.type === 'integer') {
            num = Math.floor(num);
        }

        // Apply min/max constraints
        if (options.min !== undefined && num < options.min) {
            num = options.min;
        }
        if (options.max !== undefined && num > options.max) {
            num = options.max;
        }

        // Round to specified decimal places for floats
        if (options.type === 'float' && options.decimals !== undefined) {
            num = Math.round(num * Math.pow(10, options.decimals)) / Math.pow(10, options.decimals);
        }

        return num;
    },

    /**
     * Sanitize phone number (Taiwan format)
     * @param {string} phone - Phone number to sanitize
     * @returns {string} Sanitized phone number
     */
    sanitizePhone(phone) {
        if (!phone) return '';

        // Remove all non-digit characters except hyphens and parentheses
        let sanitized = phone.replace(/[^\d\-()]/g, '');

        // Standardize format
        sanitized = sanitized.replace(/[\s]/g, ''); // Remove spaces
        
        // Handle mobile numbers (09XX-XXXXXX)
        if (sanitized.startsWith('09')) {
            const digits = sanitized.replace(/\D/g, '');
            if (digits.length === 10) {
                return `${digits.substring(0, 4)}-${digits.substring(4)}`;
            }
        }

        // Handle landline numbers
        if (sanitized.startsWith('0') || sanitized.startsWith('(0')) {
            const digits = sanitized.replace(/\D/g, '');
            if (digits.length >= 9) {
                const areaCode = digits.substring(0, 2);
                const remaining = digits.substring(2);
                if (remaining.length === 7) {
                    return `(${areaCode})-${remaining.substring(0, 3)}-${remaining.substring(3)}`;
                } else if (remaining.length === 8) {
                    return `(${areaCode})-${remaining.substring(0, 4)}-${remaining.substring(4)}`;
                }
            }
        }

        return sanitized;
    },

    /**
     * Sanitize email address
     * @param {string} email - Email to sanitize
     * @returns {string} Sanitized email
     */
    sanitizeEmail(email) {
        if (!email) return '';

        // Convert to lowercase and trim
        let sanitized = email.toLowerCase().trim();

        // Remove any whitespace
        sanitized = sanitized.replace(/\s/g, '');

        // Basic validation - if not valid email format, return empty
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitized)) {
            return '';
        }

        return sanitized;
    },

    /**
     * Sanitize date input
     * @param {string} date - Date string to sanitize
     * @param {string} format - Expected format (default: 'YYYY-MM-DD')
     * @returns {string} Sanitized date string or empty string if invalid
     */
    sanitizeDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';

        // Remove any non-date characters
        let sanitized = date.replace(/[^\d\-\/]/g, '');

        // Try to parse and reformat
        const dateObj = new Date(sanitized);
        if (isNaN(dateObj.getTime())) {
            return '';
        }

        // Format according to specified format
        if (format === 'YYYY-MM-DD') {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        return sanitized;
    },

    /**
     * Sanitize time input
     * @param {string} time - Time string to sanitize
     * @returns {string} Sanitized time string in HH:MM format
     */
    sanitizeTime(time) {
        if (!time) return '';

        // Remove all non-digit and non-colon characters
        let sanitized = time.replace(/[^\d:]/g, '');

        // Try to parse HH:MM format
        const match = sanitized.match(/^(\d{1,2}):(\d{1,2})/);
        if (match) {
            let hours = parseInt(match[1], 10);
            let minutes = parseInt(match[2], 10);

            // Validate ranges
            hours = Math.min(23, Math.max(0, hours));
            minutes = Math.min(59, Math.max(0, minutes));

            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        return '';
    },

    /**
     * Sanitize client code
     * @param {string} code - Client code to sanitize
     * @returns {string} Sanitized client code
     */
    sanitizeClientCode(code) {
        if (!code) return '';

        // Convert to uppercase and trim
        let sanitized = code.toUpperCase().trim();

        // Allow only alphanumeric and hyphens
        sanitized = sanitized.replace(/[^A-Z0-9\-]/g, '');

        // Remove consecutive hyphens
        sanitized = sanitized.replace(/\-+/g, '-');

        // Remove leading/trailing hyphens
        sanitized = sanitized.replace(/^\-+|\-+$/g, '');

        // Limit length
        if (sanitized.length > 20) {
            sanitized = sanitized.substring(0, 20);
        }

        return sanitized;
    },

    /**
     * Sanitize license plate
     * @param {string} plate - License plate to sanitize
     * @returns {string} Sanitized license plate
     */
    sanitizeLicensePlate(plate) {
        if (!plate) return '';

        // Convert to uppercase and trim
        let sanitized = plate.toUpperCase().trim();

        // Allow only alphanumeric and hyphens
        sanitized = sanitized.replace(/[^A-Z0-9\-]/g, '');

        // Limit length
        if (sanitized.length > 10) {
            sanitized = sanitized.substring(0, 10);
        }

        return sanitized;
    },

    /**
     * Escape HTML entities
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Remove script tags and their content
     * @param {string} text - Text to clean
     * @returns {string} Cleaned text
     */
    removeScriptTags(text) {
        return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    },

    /**
     * Remove event handlers from text
     * @param {string} text - Text to clean
     * @returns {string} Cleaned text
     */
    removeEventHandlers(text) {
        // Remove on* event handlers
        text = text.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
        text = text.replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');
        
        // Remove javascript: protocol
        text = text.replace(/javascript\s*:/gi, '');
        
        return text;
    },

    /**
     * Sanitize form data object
     * @param {Object} data - Form data to sanitize
     * @param {Object} schema - Sanitization schema for each field
     * @returns {Object} Sanitized data
     */
    sanitizeFormData(data, schema) {
        const sanitized = {};

        for (const field in schema) {
            if (data.hasOwnProperty(field)) {
                const value = data[field];
                const rules = schema[field];

                switch (rules.type) {
                    case 'string':
                        sanitized[field] = this.sanitizeString(value, rules.options);
                        break;
                    case 'number':
                        sanitized[field] = this.sanitizeNumber(value, rules.options);
                        break;
                    case 'phone':
                        sanitized[field] = this.sanitizePhone(value);
                        break;
                    case 'email':
                        sanitized[field] = this.sanitizeEmail(value);
                        break;
                    case 'date':
                        sanitized[field] = this.sanitizeDate(value, rules.format);
                        break;
                    case 'time':
                        sanitized[field] = this.sanitizeTime(value);
                        break;
                    case 'clientCode':
                        sanitized[field] = this.sanitizeClientCode(value);
                        break;
                    case 'licensePlate':
                        sanitized[field] = this.sanitizeLicensePlate(value);
                        break;
                    case 'boolean':
                        sanitized[field] = value === true || value === 'true' || value === '1';
                        break;
                    default:
                        // Default to string sanitization
                        sanitized[field] = this.sanitizeString(value);
                }
            } else if (rules.defaultValue !== undefined) {
                sanitized[field] = rules.defaultValue;
            }
        }

        return sanitized;
    },

    /**
     * Sanitize URL parameters
     * @param {string} param - URL parameter to sanitize
     * @returns {string} Sanitized parameter
     */
    sanitizeUrlParam(param) {
        if (!param) return '';

        // URL encode the parameter
        return encodeURIComponent(param);
    },

    /**
     * Sanitize JSON data
     * @param {*} data - Data to sanitize for JSON
     * @returns {*} Sanitized data safe for JSON serialization
     */
    sanitizeForJson(data) {
        if (data === null || data === undefined) {
            return null;
        }

        if (typeof data === 'string') {
            // Remove control characters that can break JSON
            return data.replace(/[\x00-\x1F\x7F]/g, '');
        }

        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeForJson(item));
        }

        if (typeof data === 'object') {
            const sanitized = {};
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    // Sanitize both key and value
                    const sanitizedKey = this.sanitizeString(key, { maxLength: 100 });
                    sanitized[sanitizedKey] = this.sanitizeForJson(data[key]);
                }
            }
            return sanitized;
        }

        return data;
    },

    /**
     * Create a sanitized copy of FormData
     * @param {FormData} formData - FormData to sanitize
     * @param {Object} schema - Sanitization schema
     * @returns {Object} Sanitized form data as plain object
     */
    sanitizeFormDataObject(formData, schema) {
        const data = {};
        
        // Convert FormData to object
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }

        // Apply sanitization schema
        return this.sanitizeFormData(data, schema);
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SanitizationUtils;
}