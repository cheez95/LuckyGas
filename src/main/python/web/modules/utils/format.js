/**
 * Formatting Utilities
 * Number, currency, phone, and other formatting helpers for Taiwan locale
 */

/**
 * Format number as TWD currency
 * @param {number} amount - Amount to format
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatCurrency(amount, options = {}) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '$0';
    }
    
    const {
        showSymbol = true,
        decimals = 0,
        locale = 'zh-TW'
    } = options;
    
    const formatted = amount.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    
    return showSymbol ? `$${formatted}` : formatted;
}

/**
 * Format phone number for Taiwan
 * @param {string} phone - Phone number
 * @param {boolean} includeDashes - Include dashes in formatting
 * @returns {string}
 */
export function formatPhone(phone, includeDashes = true) {
    if (!phone) return '-';
    
    // Remove all non-digits
    const cleaned = String(phone).replace(/\D/g, '');
    
    // Taiwan mobile (09XX-XXX-XXX)
    if (cleaned.match(/^09\d{8}$/)) {
        if (includeDashes) {
            return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }
        return cleaned;
    }
    
    // Taiwan landline with area code (0X-XXXX-XXXX or 0XX-XXX-XXXX)
    if (cleaned.match(/^0[2-8]\d{7,8}$/)) {
        if (includeDashes) {
            if (cleaned.length === 9) {
                // 2-digit area code
                return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
            } else {
                // 3-digit area code
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            }
        }
        return cleaned;
    }
    
    // Return original if not a recognized format
    return phone;
}

/**
 * Format address (ensure proper display)
 * @param {string} address - Address string
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatAddress(address, options = {}) {
    if (!address) return '-';
    
    const {
        maxLength = 0,
        showDistrict = true,
        district = ''
    } = options;
    
    let formatted = String(address).trim();
    
    // Add district if provided and not already in address
    if (showDistrict && district && !formatted.includes(district)) {
        formatted = `${district} ${formatted}`;
    }
    
    // Truncate if needed
    if (maxLength > 0 && formatted.length > maxLength) {
        formatted = formatted.substring(0, maxLength - 3) + '...';
    }
    
    return formatted;
}

/**
 * Format status for display
 * @param {string} status - Status code
 * @param {string} context - Context (delivery, client, etc.)
 * @returns {Object} - {text: string, class: string, icon: string}
 */
export function formatStatus(status, context = 'delivery') {
    const statusMaps = {
        delivery: {
            pending: { text: '待處理', class: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock' },
            assigned: { text: '已指派', class: 'bg-blue-100 text-blue-800', icon: 'fa-user-check' },
            in_progress: { text: '配送中', class: 'bg-purple-100 text-purple-800', icon: 'fa-truck' },
            completed: { text: '已完成', class: 'bg-green-100 text-green-800', icon: 'fa-check-circle' },
            cancelled: { text: '已取消', class: 'bg-red-100 text-red-800', icon: 'fa-times-circle' }
        },
        client: {
            active: { text: '啟用', class: 'bg-green-100 text-green-800', icon: 'fa-check' },
            inactive: { text: '停用', class: 'bg-red-100 text-red-800', icon: 'fa-pause' }
        },
        route: {
            planned: { text: '已規劃', class: 'bg-blue-100 text-blue-800', icon: 'fa-route' },
            in_progress: { text: '執行中', class: 'bg-purple-100 text-purple-800', icon: 'fa-shipping-fast' },
            completed: { text: '已完成', class: 'bg-green-100 text-green-800', icon: 'fa-check-double' }
        }
    };
    
    const map = statusMaps[context] || statusMaps.delivery;
    const statusInfo = map[status] || map[status.toLowerCase()];
    
    return statusInfo || {
        text: status,
        class: 'bg-gray-100 text-gray-800',
        icon: 'fa-question'
    };
}

/**
 * Format number with units
 * @param {number} value - Value to format
 * @param {string} unit - Unit to append
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatQuantity(value, unit = '', options = {}) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    
    const {
        decimals = 0,
        locale = 'zh-TW',
        spaceBeforeUnit = true
    } = options;
    
    const formatted = value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    
    if (!unit) return formatted;
    
    return spaceBeforeUnit ? `${formatted} ${unit}` : `${formatted}${unit}`;
}

/**
 * Format distance in kilometers
 * @param {number} km - Distance in kilometers
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatDistance(km, options = {}) {
    const { decimals = 1 } = options;
    return formatQuantity(km, 'km', { decimals });
}

/**
 * Format weight (gas quantity)
 * @param {number} kg - Weight in kilograms
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatWeight(kg, options = {}) {
    const { decimals = 1, unit = '公斤' } = options;
    return formatQuantity(kg, unit, { decimals });
}

/**
 * Format percentage
 * @param {number} value - Value (0-100 or 0-1)
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatPercentage(value, options = {}) {
    if (value === null || value === undefined || isNaN(value)) {
        return '-';
    }
    
    const {
        decimals = 0,
        isDecimal = false, // true if value is 0-1, false if 0-100
        showSymbol = true
    } = options;
    
    const percentage = isDecimal ? value * 100 : value;
    const formatted = percentage.toFixed(decimals);
    
    return showSymbol ? `${formatted}%` : formatted;
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, index);
    
    return `${size.toFixed(2)} ${units[index]}`;
}

/**
 * Format order number
 * @param {string|number} orderNumber - Order number
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatOrderNumber(orderNumber, options = {}) {
    if (!orderNumber) return '-';
    
    const {
        prefix = '',
        padLength = 0,
        padChar = '0'
    } = options;
    
    let formatted = String(orderNumber);
    
    // Pad if needed
    if (padLength > 0 && formatted.length < padLength) {
        formatted = formatted.padStart(padLength, padChar);
    }
    
    // Add prefix
    if (prefix) {
        formatted = `${prefix}${formatted}`;
    }
    
    return formatted;
}

/**
 * Format boolean value
 * @param {boolean} value - Boolean value
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatBoolean(value, options = {}) {
    const {
        trueText = '是',
        falseText = '否',
        nullText = '-'
    } = options;
    
    if (value === null || value === undefined) return nullText;
    return value ? trueText : falseText;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {Object} options - Truncation options
 * @returns {string}
 */
export function truncate(text, maxLength, options = {}) {
    if (!text) return '';
    
    const {
        suffix = '...',
        breakWords = false
    } = options;
    
    if (text.length <= maxLength) return text;
    
    let truncated = text.substring(0, maxLength - suffix.length);
    
    // Break at word boundary if requested
    if (!breakWords) {
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 0) {
            truncated = truncated.substring(0, lastSpace);
        }
    }
    
    return truncated + suffix;
}

/**
 * Format array as readable list
 * @param {Array} items - Array of items
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatList(items, options = {}) {
    if (!Array.isArray(items) || items.length === 0) return '-';
    
    const {
        separator = '、',
        maxItems = 0,
        moreText = '等'
    } = options;
    
    let displayItems = items;
    let hasMore = false;
    
    if (maxItems > 0 && items.length > maxItems) {
        displayItems = items.slice(0, maxItems);
        hasMore = true;
    }
    
    let formatted = displayItems.join(separator);
    
    if (hasMore) {
        const remaining = items.length - maxItems;
        formatted += `${separator}${moreText} ${remaining} 項`;
    }
    
    return formatted;
}

// Default export
export default {
    formatCurrency,
    formatPhone,
    formatAddress,
    formatStatus,
    formatQuantity,
    formatDistance,
    formatWeight,
    formatPercentage,
    formatFileSize,
    formatOrderNumber,
    formatBoolean,
    truncate,
    formatList
};