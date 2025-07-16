/**
 * DOM Testing Helpers
 * Utilities for DOM manipulation and testing
 */

/**
 * Waits for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<HTMLElement>}
 */
export async function waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error(`Element not found: ${selector}`);
}

/**
 * Waits for an element to be removed from the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForElementToBeRemoved(selector, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (!element) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error(`Element still exists: ${selector}`);
}

/**
 * Simulates a drag and drop operation
 * @param {HTMLElement} source - Source element
 * @param {HTMLElement} target - Target element
 */
export function simulateDragAndDrop(source, target) {
    const dataTransfer = new DataTransfer();
    
    // Start drag
    source.dispatchEvent(new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer
    }));
    
    // Enter target
    target.dispatchEvent(new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer
    }));
    
    // Over target
    target.dispatchEvent(new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer
    }));
    
    // Drop on target
    target.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer
    }));
    
    // End drag
    source.dispatchEvent(new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer
    }));
}

/**
 * Gets computed styles for an element
 * @param {HTMLElement} element - Target element
 * @param {string} property - CSS property
 * @returns {string}
 */
export function getComputedStyle(element, property) {
    return window.getComputedStyle(element).getPropertyValue(property);
}

/**
 * Checks if an element is visible in the viewport
 * @param {HTMLElement} element - Target element
 * @returns {boolean}
 */
export function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Simulates a file input change
 * @param {HTMLInputElement} input - File input element
 * @param {File[]} files - Files to simulate
 */
export function simulateFileInput(input, files) {
    const fileList = new DataTransfer();
    files.forEach(file => fileList.items.add(file));
    
    Object.defineProperty(input, 'files', {
        value: fileList.files,
        writable: false
    });
    
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Creates a mock File object
 * @param {string} name - File name
 * @param {string} content - File content
 * @param {string} type - MIME type
 * @returns {File}
 */
export function createMockFile(name, content, type = 'text/plain') {
    const blob = new Blob([content], { type });
    blob.lastModifiedDate = new Date();
    blob.name = name;
    return blob;
}

/**
 * Triggers a custom event on an element
 * @param {HTMLElement} element - Target element
 * @param {string} eventType - Event type
 * @param {Object} detail - Event detail
 */
export function triggerCustomEvent(element, eventType, detail = {}) {
    const event = new CustomEvent(eventType, {
        bubbles: true,
        cancelable: true,
        detail
    });
    
    element.dispatchEvent(event);
}

/**
 * Simulates text selection
 * @param {HTMLElement} element - Target element
 * @param {number} start - Start position
 * @param {number} end - End position
 */
export function simulateTextSelection(element, start, end) {
    if (element.setSelectionRange) {
        element.focus();
        element.setSelectionRange(start, end);
    } else {
        const range = document.createRange();
        const textNode = element.firstChild;
        
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            range.setStart(textNode, start);
            range.setEnd(textNode, end);
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

/**
 * Gets all text content from an element, excluding script and style tags
 * @param {HTMLElement} element - Target element
 * @returns {string}
 */
export function getTextContent(element) {
    const clone = element.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style');
    scripts.forEach(script => script.remove());
    
    return clone.textContent.trim();
}

/**
 * Checks if an element matches a selector
 * @param {HTMLElement} element - Target element
 * @param {string} selector - CSS selector
 * @returns {boolean}
 */
export function matches(element, selector) {
    return element.matches(selector);
}

/**
 * Gets the closest ancestor matching a selector
 * @param {HTMLElement} element - Starting element
 * @param {string} selector - CSS selector
 * @returns {HTMLElement|null}
 */
export function closest(element, selector) {
    return element.closest(selector);
}

/**
 * Creates a DocumentFragment from HTML string
 * @param {string} html - HTML string
 * @returns {DocumentFragment}
 */
export function createFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

/**
 * Observes mutations on an element
 * @param {HTMLElement} element - Target element
 * @param {Function} callback - Callback function
 * @param {Object} options - MutationObserver options
 * @returns {MutationObserver}
 */
export function observeMutations(element, callback, options = {}) {
    const observer = new MutationObserver(callback);
    observer.observe(element, {
        childList: true,
        subtree: true,
        attributes: true,
        ...options
    });
    return observer;
}

/**
 * Waits for a mutation to occur
 * @param {HTMLElement} element - Target element
 * @param {Function} predicate - Predicate function
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<MutationRecord>}
 */
export async function waitForMutation(element, predicate, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error('Timeout waiting for mutation'));
        }, timeout);
        
        const observer = observeMutations(element, (mutations) => {
            const mutation = mutations.find(predicate);
            if (mutation) {
                clearTimeout(timeoutId);
                observer.disconnect();
                resolve(mutation);
            }
        });
    });
}

/**
 * Simulates a scroll event
 * @param {HTMLElement} element - Target element
 * @param {number} scrollTop - Scroll top position
 * @param {number} scrollLeft - Scroll left position
 */
export function simulateScroll(element, scrollTop = 0, scrollLeft = 0) {
    element.scrollTop = scrollTop;
    element.scrollLeft = scrollLeft;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
}

/**
 * Gets element dimensions including margins
 * @param {HTMLElement} element - Target element
 * @returns {Object}
 */
export function getElementDimensions(element) {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    
    return {
        width: rect.width,
        height: rect.height,
        marginTop: parseFloat(styles.marginTop),
        marginRight: parseFloat(styles.marginRight),
        marginBottom: parseFloat(styles.marginBottom),
        marginLeft: parseFloat(styles.marginLeft),
        paddingTop: parseFloat(styles.paddingTop),
        paddingRight: parseFloat(styles.paddingRight),
        paddingBottom: parseFloat(styles.paddingBottom),
        paddingLeft: parseFloat(styles.paddingLeft),
        borderTopWidth: parseFloat(styles.borderTopWidth),
        borderRightWidth: parseFloat(styles.borderRightWidth),
        borderBottomWidth: parseFloat(styles.borderBottomWidth),
        borderLeftWidth: parseFloat(styles.borderLeftWidth),
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
    };
}

export default {
    waitForElement,
    waitForElementToBeRemoved,
    simulateDragAndDrop,
    getComputedStyle,
    isElementInViewport,
    simulateFileInput,
    createMockFile,
    triggerCustomEvent,
    simulateTextSelection,
    getTextContent,
    matches,
    closest,
    createFragment,
    observeMutations,
    waitForMutation,
    simulateScroll,
    getElementDimensions
};