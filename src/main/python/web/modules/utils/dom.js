/**
 * DOM Manipulation Utilities
 * Safe and efficient DOM manipulation helpers
 */

import { escapeHtml, sanitizeInput } from './security.js';

/**
 * Safe element creation with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {Array} children - Child elements or text nodes
 * @returns {HTMLElement}
 */
export function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
        } else if (key in element) {
            element[key] = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Add children
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });
    
    return element;
}

/**
 * Create an option element
 * @param {string|number} value - Option value
 * @param {string} text - Option text
 * @param {boolean} selected - Whether option is selected
 * @returns {HTMLOptionElement}
 */
export function createOption(value, text, selected = false) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = String(text);
    if (selected) option.selected = true;
    return option;
}

/**
 * Safe query selector with null checks
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Safe query selector all
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {NodeList}
 */
export function $$(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * Add classes to element
 * @param {Element} element - Target element
 * @param {...string} classes - Classes to add
 */
export function addClass(element, ...classes) {
    if (element && element.classList) {
        element.classList.add(...classes);
    }
}

/**
 * Remove classes from element
 * @param {Element} element - Target element
 * @param {...string} classes - Classes to remove
 */
export function removeClass(element, ...classes) {
    if (element && element.classList) {
        element.classList.remove(...classes);
    }
}

/**
 * Toggle classes on element
 * @param {Element} element - Target element
 * @param {string} className - Class to toggle
 * @param {boolean} force - Force add/remove
 */
export function toggleClass(element, className, force) {
    if (element && element.classList) {
        element.classList.toggle(className, force);
    }
}

/**
 * Check if element has class
 * @param {Element} element - Target element
 * @param {string} className - Class to check
 * @returns {boolean}
 */
export function hasClass(element, className) {
    return element && element.classList && element.classList.contains(className);
}

/**
 * Clear all children from element
 * @param {Element} element - Target element
 */
export function clearChildren(element) {
    if (!element) return;
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Set multiple attributes at once
 * @param {Element} element - Target element
 * @param {Object} attributes - Attributes to set
 */
export function setAttributes(element, attributes) {
    if (!element) return;
    Object.entries(attributes).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            element.setAttribute(key, value);
        }
    });
}

/**
 * Create modal container
 * @param {string} content - Modal content HTML
 * @param {Object} options - Modal options
 * @returns {HTMLElement}
 */
export function createModal(content, options = {}) {
    const {
        className = '',
        closeOnBackdrop = true,
        closeOnEscape = true
    } = options;
    
    const modal = createElement('div', {
        className: `fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 ${className}`
    });
    
    const modalContent = createElement('div', {
        className: 'bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4'
    });
    
    modalContent.innerHTML = content;
    modal.appendChild(modalContent);
    
    // Close on backdrop click
    if (closeOnBackdrop) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    // Close on escape key
    if (closeOnEscape) {
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    return modal;
}

/**
 * Show notification message
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {number} duration - Auto-hide duration in ms
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const notificationClasses = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const notification = createElement('div', {
        className: `fixed top-4 right-4 px-6 py-3 rounded shadow-lg text-white z-50 ${notificationClasses[type] || notificationClasses.info}`
    });
    
    const iconElement = createElement('i', { className: `${icons[type] || icons.info} mr-2` });
    const messageDiv = createElement('div', { className: 'flex items-center' }, [
        iconElement,
        message
    ]);
    
    notification.appendChild(messageDiv);
    document.body.appendChild(notification);
    
    // Auto-hide
    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function}
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Show/hide loading spinner
 * @param {boolean} show - Show or hide spinner
 * @param {string} message - Optional loading message
 */
export function showLoading(show, message = '載入中...') {
    let spinner = $('#global-spinner');
    
    if (show) {
        if (!spinner) {
            spinner = createElement('div', {
                id: 'global-spinner',
                className: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'
            });
            
            const content = createElement('div', {
                className: 'bg-white rounded-lg p-6 flex items-center'
            }, [
                createElement('i', { className: 'fas fa-spinner fa-spin text-3xl text-blue-500 mr-4' }),
                createElement('span', { className: 'text-lg' }, [message])
            ]);
            
            spinner.appendChild(content);
            document.body.appendChild(spinner);
        }
    } else {
        if (spinner) {
            spinner.remove();
        }
    }
}

/**
 * Animate element with CSS classes
 * @param {Element} element - Target element
 * @param {string} animationClass - Animation class to apply
 * @param {number} duration - Animation duration in ms
 * @returns {Promise}
 */
export function animate(element, animationClass, duration = 300) {
    return new Promise((resolve) => {
        if (!element) {
            resolve();
            return;
        }
        
        addClass(element, animationClass);
        setTimeout(() => {
            removeClass(element, animationClass);
            resolve();
        }, duration);
    });
}

/**
 * Get element's offset position
 * @param {Element} element - Target element
 * @returns {Object} - {top, left, bottom, right}
 */
export function getOffset(element) {
    if (!element) return { top: 0, left: 0, bottom: 0, right: 0 };
    
    const rect = element.getBoundingClientRect();
    return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        bottom: rect.bottom + window.scrollY,
        right: rect.right + window.scrollX
    };
}

/**
 * Scroll to element smoothly
 * @param {Element|string} target - Element or selector
 * @param {Object} options - Scroll options
 */
export function scrollTo(target, options = {}) {
    const element = typeof target === 'string' ? $(target) : target;
    if (!element) return;
    
    const { offset = 0, behavior = 'smooth' } = options;
    const top = getOffset(element).top - offset;
    
    window.scrollTo({
        top,
        behavior
    });
}

// Re-export commonly used utilities from SecurityUtils
export { escapeHtml, sanitizeInput } from './security.js';

// Default export object with all utilities
export default {
    // Element creation
    createElement,
    createOption,
    createModal,
    
    // Query helpers
    $,
    $$,
    
    // Class manipulation
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    
    // DOM manipulation
    clearChildren,
    setAttributes,
    
    // UI helpers
    showNotification,
    showLoading,
    animate,
    scrollTo,
    
    // Utility functions
    debounce,
    throttle,
    getOffset,
    
    // Re-exported from SecurityUtils
    escapeHtml,
    sanitizeInput
};