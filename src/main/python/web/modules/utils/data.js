/**
 * Data Manipulation Utilities
 * Array, object, and data transformation helpers
 */

/**
 * Sort array of objects by property
 * @param {Array} array - Array to sort
 * @param {string} property - Property to sort by
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array}
 */
export function sortBy(array, property, order = 'asc') {
    if (!Array.isArray(array) || array.length === 0) return array;
    
    const sorted = [...array].sort((a, b) => {
        let aVal = getNestedProperty(a, property);
        let bVal = getNestedProperty(b, property);
        
        // Handle null/undefined
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        // Compare values
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
    });
    
    return sorted;
}

/**
 * Sort by multiple properties
 * @param {Array} array - Array to sort
 * @param {Array} sortConfigs - Array of {property, order} objects
 * @returns {Array}
 */
export function sortByMultiple(array, sortConfigs) {
    if (!Array.isArray(array) || array.length === 0) return array;
    if (!Array.isArray(sortConfigs) || sortConfigs.length === 0) return array;
    
    return [...array].sort((a, b) => {
        for (const config of sortConfigs) {
            const { property, order = 'asc' } = config;
            
            let aVal = getNestedProperty(a, property);
            let bVal = getNestedProperty(b, property);
            
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';
            
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = String(bVal).toLowerCase();
            }
            
            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
        }
        return 0;
    });
}

/**
 * Filter array by search term
 * @param {Array} array - Array to filter
 * @param {string} searchTerm - Search term
 * @param {Array} searchFields - Fields to search in
 * @returns {Array}
 */
export function filterBySearch(array, searchTerm, searchFields) {
    if (!Array.isArray(array) || !searchTerm) return array;
    
    const term = searchTerm.toLowerCase();
    
    return array.filter(item => {
        return searchFields.some(field => {
            const value = getNestedProperty(item, field);
            if (!value) return false;
            return String(value).toLowerCase().includes(term);
        });
    });
}

/**
 * Group array by property
 * @param {Array} array - Array to group
 * @param {string} property - Property to group by
 * @returns {Object}
 */
export function groupBy(array, property) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((groups, item) => {
        const key = getNestedProperty(item, property) || 'undefined';
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
}

/**
 * Get unique values from array
 * @param {Array} array - Array to process
 * @param {string} property - Optional property to get unique values from
 * @returns {Array}
 */
export function unique(array, property = null) {
    if (!Array.isArray(array)) return [];
    
    if (property) {
        const values = array.map(item => getNestedProperty(item, property));
        return [...new Set(values)].filter(v => v !== null && v !== undefined);
    }
    
    return [...new Set(array)];
}

/**
 * Paginate array
 * @param {Array} array - Array to paginate
 * @param {number} page - Current page (1-based)
 * @param {number} pageSize - Items per page
 * @returns {Object} - {items, totalPages, currentPage, totalItems}
 */
export function paginate(array, page = 1, pageSize = 10) {
    if (!Array.isArray(array)) {
        return {
            items: [],
            totalPages: 0,
            currentPage: 1,
            totalItems: 0
        };
    }
    
    const totalItems = array.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    return {
        items: array.slice(startIndex, endIndex),
        totalPages,
        currentPage,
        totalItems,
        startIndex: startIndex + 1,
        endIndex: Math.min(endIndex, totalItems)
    };
}

/**
 * Calculate sum of property values
 * @param {Array} array - Array of objects
 * @param {string} property - Property to sum
 * @returns {number}
 */
export function sumBy(array, property) {
    if (!Array.isArray(array)) return 0;
    
    return array.reduce((sum, item) => {
        const value = getNestedProperty(item, property);
        return sum + (parseFloat(value) || 0);
    }, 0);
}

/**
 * Calculate average of property values
 * @param {Array} array - Array of objects
 * @param {string} property - Property to average
 * @returns {number}
 */
export function avgBy(array, property) {
    if (!Array.isArray(array) || array.length === 0) return 0;
    
    const sum = sumBy(array, property);
    return sum / array.length;
}

/**
 * Find min value in array
 * @param {Array} array - Array of objects
 * @param {string} property - Property to compare
 * @returns {*}
 */
export function minBy(array, property) {
    if (!Array.isArray(array) || array.length === 0) return null;
    
    return array.reduce((min, item) => {
        const value = getNestedProperty(item, property);
        const minValue = getNestedProperty(min, property);
        return value < minValue ? item : min;
    });
}

/**
 * Find max value in array
 * @param {Array} array - Array of objects
 * @param {string} property - Property to compare
 * @returns {*}
 */
export function maxBy(array, property) {
    if (!Array.isArray(array) || array.length === 0) return null;
    
    return array.reduce((max, item) => {
        const value = getNestedProperty(item, property);
        const maxValue = getNestedProperty(max, property);
        return value > maxValue ? item : max;
    });
}

/**
 * Count occurrences by property
 * @param {Array} array - Array to process
 * @param {string} property - Property to count
 * @returns {Object}
 */
export function countBy(array, property) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((counts, item) => {
        const key = getNestedProperty(item, property) || 'undefined';
        counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {});
}

/**
 * Get nested property value
 * @param {Object} obj - Object to get value from
 * @param {string} path - Property path (e.g., 'user.name')
 * @returns {*}
 */
export function getNestedProperty(obj, path) {
    if (!obj || !path) return null;
    
    return path.split('.').reduce((current, prop) => {
        return current && current[prop] !== undefined ? current[prop] : null;
    }, obj);
}

/**
 * Set nested property value
 * @param {Object} obj - Object to set value in
 * @param {string} path - Property path
 * @param {*} value - Value to set
 * @returns {Object}
 */
export function setNestedProperty(obj, path, value) {
    if (!obj || !path) return obj;
    
    const parts = path.split('.');
    const last = parts.pop();
    
    let current = obj;
    for (const part of parts) {
        if (!current[part]) {
            current[part] = {};
        }
        current = current[part];
    }
    
    current[last] = value;
    return obj;
}

/**
 * Deep clone object/array
 * @param {*} obj - Object to clone
 * @returns {*}
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Object) {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
}

/**
 * Merge objects deeply
 * @param {Object} target - Target object
 * @param {...Object} sources - Source objects
 * @returns {Object}
 */
export function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    
    const source = sources.shift();
    
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    
    return deepMerge(target, ...sources);
}

/**
 * Check if value is a plain object
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isObject(value) {
    return value && typeof value === 'object' && value.constructor === Object;
}

/**
 * Pick properties from object
 * @param {Object} obj - Source object
 * @param {Array} properties - Properties to pick
 * @returns {Object}
 */
export function pick(obj, properties) {
    if (!obj || !Array.isArray(properties)) return {};
    
    return properties.reduce((picked, prop) => {
        if (prop in obj) {
            picked[prop] = obj[prop];
        }
        return picked;
    }, {});
}

/**
 * Omit properties from object
 * @param {Object} obj - Source object
 * @param {Array} properties - Properties to omit
 * @returns {Object}
 */
export function omit(obj, properties) {
    if (!obj) return {};
    if (!Array.isArray(properties)) return { ...obj };
    
    const result = { ...obj };
    properties.forEach(prop => delete result[prop]);
    return result;
}

/**
 * Transform array to lookup object
 * @param {Array} array - Array to transform
 * @param {string} keyProperty - Property to use as key
 * @param {string} valueProperty - Optional property to use as value
 * @returns {Object}
 */
export function toLookup(array, keyProperty, valueProperty = null) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((lookup, item) => {
        const key = getNestedProperty(item, keyProperty);
        if (key !== null && key !== undefined) {
            lookup[key] = valueProperty ? getNestedProperty(item, valueProperty) : item;
        }
        return lookup;
    }, {});
}

/**
 * Flatten nested array
 * @param {Array} array - Array to flatten
 * @param {number} depth - Depth to flatten (Infinity for full flatten)
 * @returns {Array}
 */
export function flatten(array, depth = 1) {
    if (!Array.isArray(array)) return [];
    
    return depth > 0
        ? array.reduce((flat, item) => 
            flat.concat(Array.isArray(item) ? flatten(item, depth - 1) : item), [])
        : array.slice();
}

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array}
 */
export function chunk(array, size) {
    if (!Array.isArray(array) || size < 1) return [];
    
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Default export
export default {
    // Sorting
    sortBy,
    sortByMultiple,
    
    // Filtering
    filterBySearch,
    
    // Grouping
    groupBy,
    unique,
    
    // Pagination
    paginate,
    
    // Calculations
    sumBy,
    avgBy,
    minBy,
    maxBy,
    countBy,
    
    // Object utilities
    getNestedProperty,
    setNestedProperty,
    deepClone,
    deepMerge,
    pick,
    omit,
    
    // Array utilities
    toLookup,
    flatten,
    chunk
};