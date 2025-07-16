/**
 * Component Testing Helpers
 * Utilities for testing LuckyGas components
 */

import { Component } from '../../components/Component.js';
import { ReactiveComponent } from '../../components/ReactiveComponent.js';
import store from '../../state/store.js';

/**
 * Creates a test container element
 * @returns {HTMLElement}
 */
export function createTestContainer() {
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    return container;
}

/**
 * Cleans up test container
 */
export function cleanupTestContainer() {
    const container = document.getElementById('test-container');
    if (container) {
        container.remove();
    }
}

/**
 * Mounts a component for testing
 * @param {Component} ComponentClass - Component class to instantiate
 * @param {Object} options - Component options
 * @returns {Promise<Object>} Test wrapper with component and utilities
 */
export async function mountComponent(ComponentClass, options = {}) {
    const container = createTestContainer();
    
    const component = new ComponentClass({
        container,
        ...options
    });
    
    // Wait for component to be fully mounted
    await flushPromises();
    
    return {
        component,
        container,
        element: component.element,
        
        // Query utilities
        find: (selector) => component.$(selector),
        findAll: (selector) => component.$$(selector),
        
        // State utilities
        setState: (updates) => {
            component.setState(updates);
            return flushPromises();
        },
        
        setProps: (props) => {
            component.setProps(props);
            return flushPromises();
        },
        
        // Event utilities
        trigger: async (selector, eventName, eventData = {}) => {
            const element = component.$(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }
            
            const event = new Event(eventName, {
                bubbles: true,
                cancelable: true,
                ...eventData
            });
            
            Object.assign(event, eventData);
            element.dispatchEvent(event);
            await flushPromises();
            
            return event;
        },
        
        click: (selector) => {
            const element = component.$(selector);
            if (!element) {
                throw new Error(`Element not found: ${selector}`);
            }
            element.click();
            return flushPromises();
        },
        
        // Lifecycle utilities
        destroy: async () => {
            await component.destroy();
            cleanupTestContainer();
        },
        
        // Assertion helpers
        exists: (selector) => !!component.$(selector),
        text: (selector) => {
            const element = component.$(selector);
            return element ? element.textContent.trim() : null;
        },
        html: (selector) => {
            const element = component.$(selector);
            return element ? element.innerHTML : null;
        },
        value: (selector) => {
            const element = component.$(selector);
            return element ? element.value : null;
        },
        hasClass: (selector, className) => {
            const element = component.$(selector);
            return element ? element.classList.contains(className) : false;
        },
        getAttribute: (selector, attr) => {
            const element = component.$(selector);
            return element ? element.getAttribute(attr) : null;
        },
        isVisible: (selector) => {
            const element = component.$(selector);
            if (!element) return false;
            
            const style = getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0';
        }
    };
}

/**
 * Creates a mock component for testing
 * @param {Object} overrides - Properties to override
 * @returns {Component}
 */
export function createMockComponent(overrides = {}) {
    return new Component({
        name: 'MockComponent',
        template: () => '<div class="mock-component">Mock Component</div>',
        ...overrides
    });
}

/**
 * Creates a spy for component methods
 * @param {Component} component - Component instance
 * @param {string} methodName - Method name to spy on
 * @returns {jest.SpyInstance}
 */
export function spyOnMethod(component, methodName) {
    const original = component[methodName];
    if (typeof original !== 'function') {
        throw new Error(`Method ${methodName} not found on component`);
    }
    
    return jest.spyOn(component, methodName);
}

/**
 * Waits for component to update
 * @param {Component} component - Component instance
 * @param {Function} condition - Condition to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise}
 */
export async function waitForUpdate(component, condition, timeout = 5000) {
    const startTime = Date.now();
    
    while (!condition(component)) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout waiting for component update');
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

/**
 * Simulates user input
 * @param {HTMLElement} element - Input element
 * @param {string} value - Value to input
 */
export async function typeInElement(element, value) {
    element.focus();
    element.value = value;
    
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    await flushPromises();
}

/**
 * Creates a test harness for reactive components
 * @param {ReactiveComponent} ComponentClass - Reactive component class
 * @param {Object} options - Component options
 * @returns {Promise<Object>} Test harness
 */
export async function mountReactiveComponent(ComponentClass, options = {}) {
    // Reset store state before mounting
    store.setState({});
    
    const wrapper = await mountComponent(ComponentClass, options);
    
    return {
        ...wrapper,
        
        // Store utilities
        updateStore: async (path, value) => {
            store.set(path, value);
            await flushPromises();
        },
        
        getStoreValue: (path) => store.get(path),
        
        resetStore: () => {
            store.setState({});
        }
    };
}

/**
 * Mocks API responses
 * @param {Object} responses - Map of endpoint to response
 */
export function mockApiResponses(responses) {
    global.fetch.mockImplementation((url) => {
        const response = responses[url] || responses[url.split('?')[0]];
        
        if (!response) {
            return Promise.reject(new Error(`No mock for ${url}`));
        }
        
        return Promise.resolve({
            ok: response.ok !== false,
            status: response.status || 200,
            json: () => Promise.resolve(response.data || {}),
            text: () => Promise.resolve(JSON.stringify(response.data || {})),
            headers: new Headers(response.headers || {})
        });
    });
}

/**
 * Creates a mock state for testing
 * @param {Object} initialState - Initial state
 * @returns {Object} Mock state manager
 */
export function createMockState(initialState = {}) {
    let state = { ...initialState };
    const subscribers = new Map();
    
    return {
        get: (path) => {
            const parts = path.split('.');
            let value = state;
            
            for (const part of parts) {
                value = value?.[part];
            }
            
            return value;
        },
        
        set: (path, value) => {
            const parts = path.split('.');
            const lastPart = parts.pop();
            let current = state;
            
            for (const part of parts) {
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
            
            const oldValue = current[lastPart];
            current[lastPart] = value;
            
            // Notify subscribers
            const callbacks = subscribers.get(path) || [];
            callbacks.forEach(cb => cb(value, oldValue));
        },
        
        subscribe: (path, callback) => {
            if (!subscribers.has(path)) {
                subscribers.set(path, []);
            }
            subscribers.get(path).push(callback);
            
            return () => {
                const callbacks = subscribers.get(path);
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            };
        },
        
        getState: () => ({ ...state }),
        
        setState: (newState) => {
            state = { ...newState };
        },
        
        reset: () => {
            state = { ...initialState };
            subscribers.clear();
        }
    };
}

/**
 * Waits for all promises to resolve
 */
export function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * Creates event simulation helpers
 * @param {HTMLElement} element - Target element
 * @returns {Object} Event helpers
 */
export function createEventHelpers(element) {
    return {
        click: () => {
            element.click();
            return flushPromises();
        },
        
        dblclick: () => {
            element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            return flushPromises();
        },
        
        mouseenter: () => {
            element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            return flushPromises();
        },
        
        mouseleave: () => {
            element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            return flushPromises();
        },
        
        focus: () => {
            element.focus();
            return flushPromises();
        },
        
        blur: () => {
            element.blur();
            return flushPromises();
        },
        
        keydown: (key, options = {}) => {
            element.dispatchEvent(new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                ...options
            }));
            return flushPromises();
        },
        
        keyup: (key, options = {}) => {
            element.dispatchEvent(new KeyboardEvent('keyup', {
                key,
                bubbles: true,
                ...options
            }));
            return flushPromises();
        },
        
        input: (value) => {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return flushPromises();
        },
        
        change: (value) => {
            element.value = value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return flushPromises();
        }
    };
}

export default {
    createTestContainer,
    cleanupTestContainer,
    mountComponent,
    mountReactiveComponent,
    createMockComponent,
    spyOnMethod,
    waitForUpdate,
    typeInElement,
    mockApiResponses,
    createMockState,
    flushPromises,
    createEventHelpers
};