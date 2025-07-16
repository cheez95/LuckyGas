/**
 * Security Utilities for XSS Prevention
 * 
 * This module provides safe methods for DOM manipulation and HTML content handling
 * to prevent Cross-Site Scripting (XSS) vulnerabilities.
 * 
 * @module SecurityUtils
 * @version 1.0.0
 */

/**
 * Escape HTML entities to prevent XSS attacks
 * Converts special characters to HTML entities
 * 
 * @param {*} text - Text to escape (will be converted to string)
 * @returns {string} - Escaped HTML string
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Create a safe text node from any input
 * 
 * @param {*} text - Text content (will be converted to string)
 * @returns {Text} - DOM Text node
 */
export function createTextNode(text) {
    return document.createTextNode(String(text || ''));
}

/**
 * Sanitize user input for display
 * Removes dangerous characters and scripts
 * 
 * @param {string} input - User input to sanitize
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
    if (!input) return '';
    
    // Convert to string and trim
    let sanitized = String(input).trim();
    
    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');
    
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript\s*:/gi, '');
    
    return sanitized;
}

/**
 * Check if URL is safe (no javascript: or data: protocols)
 * 
 * @param {string} url - URL to check
 * @returns {boolean} - True if URL is safe
 */
export function isSafeUrl(url) {
    if (!url) return true;
    
    const safeUrl = String(url).toLowerCase().trim();
    return !safeUrl.startsWith('javascript:') && 
           !safeUrl.startsWith('data:') && 
           !safeUrl.startsWith('vbscript:');
}

/**
 * Validate and sanitize HTML attributes
 * 
 * @param {string} name - Attribute name
 * @param {*} value - Attribute value
 * @returns {Object|null} - {name, value} if valid, null if dangerous
 */
export function sanitizeAttribute(name, value) {
    const lowerName = String(name).toLowerCase();
    
    // Block event handlers
    if (lowerName.startsWith('on')) {
        return null;
    }
    
    // Special handling for href and src
    if ((lowerName === 'href' || lowerName === 'src') && !isSafeUrl(value)) {
        return null;
    }
    
    return { name, value: String(value) };
}

/**
 * Create a safe element with validated attributes
 * 
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Element attributes
 * @param {Array} children - Child elements or text
 * @returns {HTMLElement} - Safe DOM element
 */
export function createSafeElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    // Set attributes safely
    Object.entries(attributes).forEach(([key, value]) => {
        const sanitized = sanitizeAttribute(key, value);
        if (sanitized) {
            if (key === 'className') {
                element.className = sanitized.value;
            } else if (key in element) {
                try {
                    element[key] = sanitized.value;
                } catch (e) {
                    element.setAttribute(sanitized.name, sanitized.value);
                }
            } else {
                element.setAttribute(sanitized.name, sanitized.value);
            }
        }
    });
    
    // Add children safely
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });
    
    return element;
}

/**
 * Safely set content with HTML structure using template literals
 * 
 * @param {HTMLElement} element - Target element
 * @param {string} template - Template with {{placeholders}}
 * @param {Object} data - Data to inject
 */
export function setTemplateContent(element, template, data = {}) {
    if (!element || !(element instanceof HTMLElement)) return;
    
    // Create temporary container
    const temp = document.createElement('div');
    temp.innerHTML = template;
    
    // Walk through nodes and replace placeholders
    const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            let text = node.textContent;
            Object.entries(data).forEach(([key, value]) => {
                const placeholder = new RegExp(`{{${key}}}`, 'g');
                text = text.replace(placeholder, escapeHtml(value));
            });
            node.textContent = text;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Check attributes
            Array.from(node.attributes).forEach(attr => {
                let value = attr.value;
                Object.entries(data).forEach(([key, val]) => {
                    const placeholder = new RegExp(`{{${key}}}`, 'g');
                    value = value.replace(placeholder, escapeHtml(val));
                });
                attr.value = value;
            });
            
            // Process children
            Array.from(node.childNodes).forEach(walk);
        }
    };
    
    walk(temp);
    
    // Clear and append sanitized content
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
    
    while (temp.firstChild) {
        element.appendChild(temp.firstChild);
    }
}

// Backward compatibility - export as object
export const SecurityUtils = {
    escapeHtml,
    createTextNode,
    sanitizeInput,
    isSafeUrl,
    sanitizeAttribute,
    createSafeElement,
    setTemplateContent,
    
    // Legacy method names for compatibility
    createElement: createSafeElement,
    setInnerHTMLSafe: setTemplateContent
};

// Default export
export default SecurityUtils;