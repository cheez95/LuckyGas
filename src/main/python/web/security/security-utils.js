/**
 * Security Utilities for XSS Prevention
 * 
 * This module provides safe methods for DOM manipulation and HTML content handling
 * to prevent Cross-Site Scripting (XSS) vulnerabilities.
 * 
 * @module SecurityUtils
 * @version 1.0.0
 */

const SecurityUtils = {
    /**
     * Escape HTML entities to prevent XSS attacks
     * Converts special characters to HTML entities
     * 
     * @param {*} text - Text to escape (will be converted to string)
     * @returns {string} - Escaped HTML string
     */
    escapeHtml: function(text) {
        if (text === null || text === undefined) return '';
        
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    },
    
    /**
     * Create a safe text node from any input
     * 
     * @param {*} text - Text content (will be converted to string)
     * @returns {Text} - DOM Text node
     */
    createTextNode: function(text) {
        return document.createTextNode(String(text || ''));
    },
    
    /**
     * Safely create an element with attributes and children
     * Prevents XSS by properly escaping content and validating attributes
     * 
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Element attributes (className, data-*, etc.)
     * @param {Array} children - Child elements or text content
     * @returns {HTMLElement} - Created DOM element
     */
    createElement: function(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes safely
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'id') {
                element.id = value;
            } else if (key.startsWith('data-')) {
                element.setAttribute(key, value);
            } else if (key === 'onclick' && typeof value === 'function') {
                element.addEventListener('click', value);
            } else if (key === 'type' && tag.toLowerCase() === 'input') {
                element.type = value;
            } else if (key === 'value' && (tag.toLowerCase() === 'input' || tag.toLowerCase() === 'textarea')) {
                element.value = value;
            } else if (key === 'checked' && tag.toLowerCase() === 'input') {
                element.checked = value;
            } else if (key === 'disabled') {
                element.disabled = value;
            } else if (key === 'href' && tag.toLowerCase() === 'a') {
                // Validate href to prevent javascript: URLs
                const href = String(value);
                if (!href.startsWith('javascript:') && !href.startsWith('data:')) {
                    element.href = href;
                }
            } else {
                // Generic attribute setting with string conversion
                element.setAttribute(key, String(value));
            }
        });
        
        // Add children safely
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(this.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            } else if (child && typeof child === 'object' && child.element) {
                // Support for nested element descriptors
                element.appendChild(child.element);
            }
        });
        
        return element;
    },
    
    /**
     * Safely render content into a container
     * Clears existing content and adds new content safely
     * 
     * @param {HTMLElement} container - Target container element
     * @param {string|Node|Array} template - Content to render
     */
    renderTemplate: function(container, template) {
        if (!container || !(container instanceof HTMLElement)) {
            console.error('Invalid container provided to renderTemplate');
            return;
        }
        
        // Clear container safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        // Add new content
        if (typeof template === 'string') {
            container.appendChild(this.createTextNode(template));
        } else if (template instanceof Node) {
            container.appendChild(template);
        } else if (Array.isArray(template)) {
            template.forEach(node => {
                if (node instanceof Node) {
                    container.appendChild(node);
                } else if (typeof node === 'string') {
                    container.appendChild(this.createTextNode(node));
                }
            });
        }
    },
    
    /**
     * Create a safe option element for select dropdowns
     * 
     * @param {*} value - Option value
     * @param {*} text - Option display text
     * @param {boolean} selected - Whether option is selected
     * @returns {HTMLOptionElement} - Created option element
     */
    createOption: function(value, text, selected = false) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = String(text);
        if (selected) option.selected = true;
        return option;
    },
    
    /**
     * Safely populate a select element with options
     * 
     * @param {HTMLSelectElement} selectElement - Target select element
     * @param {Array} options - Array of {value, text, selected} objects
     * @param {boolean} clearExisting - Whether to clear existing options
     */
    populateSelect: function(selectElement, options, clearExisting = true) {
        if (!selectElement || !(selectElement instanceof HTMLSelectElement)) {
            console.error('Invalid select element provided');
            return;
        }
        
        if (clearExisting) {
            while (selectElement.firstChild) {
                selectElement.removeChild(selectElement.firstChild);
            }
        }
        
        options.forEach(opt => {
            selectElement.appendChild(
                this.createOption(opt.value, opt.text, opt.selected)
            );
        });
    },
    
    /**
     * Create a safe table row with cells
     * 
     * @param {Array} cells - Array of cell contents
     * @param {string} className - Optional CSS class for the row
     * @returns {HTMLTableRowElement} - Created table row
     */
    createTableRow: function(cells, className = '') {
        const tr = document.createElement('tr');
        if (className) tr.className = className;
        
        cells.forEach(cellData => {
            const td = document.createElement('td');
            
            // Handle cell with attributes
            if (typeof cellData === 'object' && cellData !== null && !cellData.nodeType) {
                if (cellData.className) td.className = cellData.className;
                if (cellData.colspan) td.colSpan = cellData.colspan;
                if (cellData.rowspan) td.rowSpan = cellData.rowspan;
                
                // Add cell content
                const content = cellData.content || cellData.text || '';
                if (typeof content === 'string') {
                    td.textContent = content;
                } else if (content instanceof Node) {
                    td.appendChild(content);
                } else if (Array.isArray(content)) {
                    content.forEach(item => {
                        if (typeof item === 'string') {
                            td.appendChild(this.createTextNode(item));
                        } else if (item instanceof Node) {
                            td.appendChild(item);
                        }
                    });
                }
            } else if (typeof cellData === 'string') {
                td.textContent = cellData;
            } else if (cellData instanceof Node) {
                td.appendChild(cellData);
            }
            
            tr.appendChild(td);
        });
        
        return tr;
    },
    
    /**
     * Safely set inner content with HTML structure
     * This should only be used when you need to preserve HTML structure
     * but with properly escaped user content
     * 
     * @param {HTMLElement} element - Target element
     * @param {string} htmlTemplate - HTML template with placeholders
     * @param {Object} data - Data to safely inject into template
     */
    setInnerHTMLSafe: function(element, htmlTemplate, data = {}) {
        // Create a temporary container
        const temp = document.createElement('div');
        temp.innerHTML = htmlTemplate;
        
        // Find all text nodes and replace placeholders
        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent;
                Object.entries(data).forEach(([key, value]) => {
                    const placeholder = `{{${key}}}`;
                    if (text.includes(placeholder)) {
                        text = text.replace(new RegExp(placeholder, 'g'), this.escapeHtml(value));
                    }
                });
                node.textContent = text;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Check attributes for placeholders
                Array.from(node.attributes).forEach(attr => {
                    let value = attr.value;
                    Object.entries(data).forEach(([key, val]) => {
                        const placeholder = `{{${key}}}`;
                        if (value.includes(placeholder)) {
                            value = value.replace(new RegExp(placeholder, 'g'), this.escapeHtml(val));
                        }
                    });
                    attr.value = value;
                });
                
                // Recursively process child nodes
                Array.from(node.childNodes).forEach(child => walk(child));
            }
        };
        
        walk(temp);
        
        // Clear target element and move sanitized content
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        
        while (temp.firstChild) {
            element.appendChild(temp.firstChild);
        }
    },
    
    /**
     * Create a safe link element
     * Prevents javascript: and data: URLs
     * 
     * @param {string} href - Link URL
     * @param {string} text - Link text
     * @param {Object} attributes - Additional attributes
     * @returns {HTMLAnchorElement|HTMLSpanElement} - Safe link element or span if URL is unsafe
     */
    createSafeLink: function(href, text, attributes = {}) {
        const safeHref = String(href || '');
        
        // Check for dangerous protocols
        if (safeHref.startsWith('javascript:') || 
            safeHref.startsWith('data:') || 
            safeHref.startsWith('vbscript:')) {
            // Return a span instead of a link for dangerous URLs
            return this.createElement('span', 
                { ...attributes, className: 'unsafe-link ' + (attributes.className || '') }, 
                [text]
            );
        }
        
        return this.createElement('a', { ...attributes, href: safeHref }, [text]);
    },
    
    /**
     * Sanitize user input for display
     * Removes dangerous characters and scripts
     * 
     * @param {string} input - User input to sanitize
     * @returns {string} - Sanitized input
     */
    sanitizeInput: function(input) {
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
    },
    
    /**
     * Create a notification element safely
     * 
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     * @param {string} icon - Icon class
     * @returns {HTMLElement} - Notification element
     */
    createNotification: function(message, type = 'info', icon = 'info-circle') {
        const bgColor = type === 'success' ? 'bg-green-600' : 
                       type === 'error' ? 'bg-red-600' : 
                       'bg-blue-600';
                       
        const iconClass = `fas fa-${icon} mr-2`;
        
        return this.createElement('div', 
            { className: `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white ${bgColor} max-w-md` },
            [
                this.createElement('div', 
                    { className: 'flex items-center' },
                    [
                        this.createElement('i', { className: iconClass }),
                        this.escapeHtml(message)
                    ]
                )
            ]
        );
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUtils;
}