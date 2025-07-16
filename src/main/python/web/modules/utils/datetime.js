/**
 * Date and Time Utilities
 * Taiwan locale-specific date/time formatting and calculations
 */

/**
 * Format date to Taiwan locale
 * @param {string|Date} dateString - Date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatDate(dateString, options = {}) {
    if (!dateString) return '-';
    
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return '-';
        
        const defaultOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };
        
        return date.toLocaleDateString('zh-TW', { ...defaultOptions, ...options });
    } catch (error) {
        console.error('Date formatting error:', error);
        return '-';
    }
}

/**
 * Format date and time to Taiwan locale
 * @param {string|Date} dateString - Date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatDateTime(dateString, options = {}) {
    if (!dateString) return '-';
    
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return '-';
        
        const defaultOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return date.toLocaleString('zh-TW', { ...defaultOptions, ...options });
    } catch (error) {
        console.error('DateTime formatting error:', error);
        return '-';
    }
}

/**
 * Format time only
 * @param {string|Date} dateString - Date string or Date object
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatTime(dateString, options = {}) {
    if (!dateString) return '-';
    
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return '-';
        
        const defaultOptions = {
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return date.toLocaleTimeString('zh-TW', { ...defaultOptions, ...options });
    } catch (error) {
        console.error('Time formatting error:', error);
        return '-';
    }
}

/**
 * Get relative time string (e.g., "3 小時前")
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string}
 */
export function getRelativeTime(dateString) {
    if (!dateString) return '-';
    
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return '-';
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return '剛剛';
        if (diffMins < 60) return `${diffMins} 分鐘前`;
        if (diffHours < 24) return `${diffHours} 小時前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} 週前`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} 個月前`;
        
        return formatDate(date);
    } catch (error) {
        console.error('Relative time error:', error);
        return '-';
    }
}

/**
 * Format duration in minutes to human readable
 * @param {number} minutes - Duration in minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
    if (!minutes || minutes < 0) return '-';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins} 分鐘`;
    if (mins === 0) return `${hours} 小時`;
    return `${hours} 小時 ${mins} 分鐘`;
}

/**
 * Calculate days between two dates
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number}
 */
export function daysBetween(startDate, endDate) {
    try {
        const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
        const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        
        const diffMs = Math.abs(end - start);
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch (error) {
        console.error('Days calculation error:', error);
        return 0;
    }
}

/**
 * Add days to date
 * @param {string|Date} dateString - Base date
 * @param {number} days - Days to add (can be negative)
 * @returns {Date}
 */
export function addDays(dateString, days) {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);
        if (isNaN(date.getTime())) return new Date();
        
        date.setDate(date.getDate() + days);
        return date;
    } catch (error) {
        console.error('Add days error:', error);
        return new Date();
    }
}

/**
 * Get start of day
 * @param {string|Date} dateString - Date
 * @returns {Date}
 */
export function startOfDay(dateString) {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);
        if (isNaN(date.getTime())) return new Date();
        
        date.setHours(0, 0, 0, 0);
        return date;
    } catch (error) {
        console.error('Start of day error:', error);
        return new Date();
    }
}

/**
 * Get end of day
 * @param {string|Date} dateString - Date
 * @returns {Date}
 */
export function endOfDay(dateString) {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);
        if (isNaN(date.getTime())) return new Date();
        
        date.setHours(23, 59, 59, 999);
        return date;
    } catch (error) {
        console.error('End of day error:', error);
        return new Date();
    }
}

/**
 * Get week range for a date
 * @param {string|Date} dateString - Date
 * @returns {Object} - {start: Date, end: Date}
 */
export function getWeekRange(dateString) {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);
        if (isNaN(date.getTime())) return { start: new Date(), end: new Date() };
        
        const day = date.getDay();
        const diff = date.getDate() - day;
        
        const start = new Date(date);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        
        return { start, end };
    } catch (error) {
        console.error('Week range error:', error);
        return { start: new Date(), end: new Date() };
    }
}

/**
 * Get month range for a date
 * @param {string|Date} dateString - Date
 * @returns {Object} - {start: Date, end: Date}
 */
export function getMonthRange(dateString) {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);
        if (isNaN(date.getTime())) return { start: new Date(), end: new Date() };
        
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        
        return { start, end };
    } catch (error) {
        console.error('Month range error:', error);
        return { start: new Date(), end: new Date() };
    }
}

/**
 * Parse time slot string (e.g., "09:00-12:00")
 * @param {string} timeSlot - Time slot string
 * @returns {Object} - {start: string, end: string}
 */
export function parseTimeSlot(timeSlot) {
    if (!timeSlot || typeof timeSlot !== 'string') {
        return { start: null, end: null };
    }
    
    const parts = timeSlot.split('-');
    if (parts.length !== 2) {
        return { start: null, end: null };
    }
    
    return {
        start: parts[0].trim(),
        end: parts[1].trim()
    };
}

/**
 * Check if date is today
 * @param {string|Date} dateString - Date to check
 * @returns {boolean}
 */
export function isToday(dateString) {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return false;
        
        const today = new Date();
        return date.toDateString() === today.toDateString();
    } catch (error) {
        console.error('Is today check error:', error);
        return false;
    }
}

/**
 * Check if date is in the past
 * @param {string|Date} dateString - Date to check
 * @returns {boolean}
 */
export function isPast(dateString) {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return false;
        
        return date < new Date();
    } catch (error) {
        console.error('Is past check error:', error);
        return false;
    }
}

/**
 * Check if date is in the future
 * @param {string|Date} dateString - Date to check
 * @returns {boolean}
 */
export function isFuture(dateString) {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return false;
        
        return date > new Date();
    } catch (error) {
        console.error('Is future check error:', error);
        return false;
    }
}

/**
 * Format date for HTML input
 * @param {string|Date} dateString - Date
 * @returns {string} - YYYY-MM-DD format
 */
export function formatForInput(dateString) {
    if (!dateString) return '';
    
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Format for input error:', error);
        return '';
    }
}

// Default export
export default {
    formatDate,
    formatDateTime,
    formatTime,
    getRelativeTime,
    formatDuration,
    daysBetween,
    addDays,
    startOfDay,
    endOfDay,
    getWeekRange,
    getMonthRange,
    parseTimeSlot,
    isToday,
    isPast,
    isFuture,
    formatForInput
};