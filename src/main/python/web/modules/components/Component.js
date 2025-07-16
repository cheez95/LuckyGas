/**
 * Base Component Class for LuckyGas
 * Provides reactive component foundation with state integration
 * @module components/Component
 */

import store from '../../src/main/js/state/store.js';
import { dom } from '../utils/index.js';

/**
 * Base Component class providing lifecycle, state management, and event handling
 */
export class Component {
    /**
     * Create a new component instance
     * @param {Object} options - Component configuration
     * @param {string} options.name - Component name for debugging
     * @param {HTMLElement|string} options.container - Container element or selector
     * @param {Object} options.props - Initial component properties
     * @param {Object} options.state - Component local state
     * @param {Array<string>} options.subscribeTo - State paths to subscribe to
     * @param {Object} options.computed - Computed properties definitions
     * @param {Object} options.methods - Component methods
     * @param {Object} options.events - Event handlers mapping
     * @param {Function} options.template - Template function
     * @param {boolean} options.shadow - Use shadow DOM
     */
    constructor(options = {}) {
        // Component metadata
        this.name = options.name || this.constructor.name;
        this.id = `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Component configuration
        this.options = options;
        this.props = { ...options.props };
        this.localState = { ...options.state };
        
        // DOM references
        this.container = null;
        this.element = null;
        this.shadow = options.shadow || false;
        this.shadowRoot = null;
        
        // State management
        this.subscribeTo = options.subscribeTo || [];
        this.subscriptions = [];
        this.computedProperties = {};
        
        // Event handling
        this.events = options.events || {};
        this.eventListeners = new Map();
        this.delegatedEvents = new Set();
        
        // Lifecycle flags
        this.isMounted = false;
        this.isDestroyed = false;
        
        // Methods binding
        this._bindMethods();
        
        // Initialize computed properties
        this._initializeComputed();
        
        // Auto-mount if container provided
        if (options.container) {
            this.mount(options.container);
        }
    }

    /**
     * Initialize the component
     * Can be overridden by subclasses
     */
    async init() {
        // Override in subclasses for initialization logic
    }

    /**
     * Mount the component to the DOM
     * @param {HTMLElement|string} container - Container element or selector
     */
    async mount(container) {
        if (this.isMounted) {
            console.warn(`Component ${this.name} is already mounted`);
            return;
        }

        // Find container element
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;

        if (!this.container) {
            throw new Error(`Container not found for component ${this.name}`);
        }

        // Initialize component
        await this.init();

        // Create component element
        this.element = document.createElement('div');
        this.element.className = `component-${this.name.toLowerCase()}`;
        this.element.setAttribute('data-component-id', this.id);

        // Setup shadow DOM if requested
        if (this.shadow) {
            this.shadowRoot = this.element.attachShadow({ mode: 'open' });
        }

        // Initial render
        this.render();

        // Append to container
        this.container.appendChild(this.element);

        // Setup state subscriptions
        this._setupSubscriptions();

        // Setup event listeners
        this._setupEventListeners();

        // Mark as mounted
        this.isMounted = true;

        // Call mounted lifecycle hook
        await this.mounted();
    }

    /**
     * Component mounted lifecycle hook
     * Can be overridden by subclasses
     */
    async mounted() {
        // Override in subclasses
    }

    /**
     * Render the component
     * Calls template function and updates DOM
     */
    render() {
        if (this.isDestroyed) return;

        try {
            // Get template HTML
            const html = this.template();

            // Update DOM
            const target = this.shadowRoot || this.element;
            if (target) {
                target.innerHTML = html;
            }

            // Re-setup event listeners after render
            if (this.isMounted) {
                this._setupEventListeners();
            }

            // Call updated lifecycle hook
            this.updated();
        } catch (error) {
            console.error(`Error rendering component ${this.name}:`, error);
            this.onError(error);
        }
    }

    /**
     * Template function - must be overridden
     * @returns {string} HTML template
     */
    template() {
        if (this.options.template) {
            return this.options.template.call(this);
        }
        return '<div>Override template() method</div>';
    }

    /**
     * Component updated lifecycle hook
     * Called after each render
     */
    updated() {
        // Override in subclasses
    }

    /**
     * Update component state and re-render
     * @param {Object} updates - State updates
     */
    setState(updates) {
        const oldState = { ...this.localState };
        this.localState = { ...this.localState, ...updates };
        
        // Check if state actually changed
        const hasChanges = Object.keys(updates).some(
            key => oldState[key] !== this.localState[key]
        );

        if (hasChanges) {
            this.render();
        }
    }

    /**
     * Update component props
     * @param {Object} newProps - New props
     */
    setProps(newProps) {
        const oldProps = { ...this.props };
        this.props = { ...this.props, ...newProps };
        
        // Check if props actually changed
        const hasChanges = Object.keys(newProps).some(
            key => oldProps[key] !== this.props[key]
        );

        if (hasChanges) {
            this.render();
        }
    }

    /**
     * Setup state subscriptions
     * @private
     */
    _setupSubscriptions() {
        // Clear existing subscriptions
        this._clearSubscriptions();

        // Subscribe to state paths
        this.subscribeTo.forEach(path => {
            const unsubscribe = store.subscribe(path, (newValue, oldValue) => {
                this.onStateChange(path, newValue, oldValue);
            });
            this.subscriptions.push(unsubscribe);
        });
    }

    /**
     * Handle state change
     * @param {string} path - State path that changed
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    onStateChange(path, newValue, oldValue) {
        // Default behavior is to re-render
        this.render();
    }

    /**
     * Clear all state subscriptions
     * @private
     */
    _clearSubscriptions() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Setup event listeners
     * @private
     */
    _setupEventListeners() {
        // Clear existing listeners
        this._clearEventListeners();

        const target = this.shadowRoot || this.element;
        if (!target) return;

        // Setup event delegation for configured events
        Object.entries(this.events).forEach(([eventKey, handler]) => {
            const [eventName, ...selectorParts] = eventKey.split(' ');
            const selector = selectorParts.join(' ');

            if (selector) {
                // Delegated event
                if (!this.delegatedEvents.has(eventName)) {
                    const delegatedHandler = (event) => {
                        const target = event.target.closest(selector);
                        if (target) {
                            this._callEventHandler(handler, event, target);
                        }
                    };
                    target.addEventListener(eventName, delegatedHandler);
                    this.eventListeners.set(`${eventName}:delegated`, delegatedHandler);
                    this.delegatedEvents.add(eventName);
                }
            } else {
                // Direct event on component element
                const directHandler = (event) => {
                    this._callEventHandler(handler, event, event.target);
                };
                target.addEventListener(eventName, directHandler);
                this.eventListeners.set(`${eventName}:direct`, directHandler);
            }
        });
    }

    /**
     * Call event handler
     * @private
     */
    _callEventHandler(handler, event, target) {
        try {
            if (typeof handler === 'string') {
                // Handler is a method name
                if (typeof this[handler] === 'function') {
                    this[handler].call(this, event, target);
                } else {
                    console.error(`Method ${handler} not found on component ${this.name}`);
                }
            } else if (typeof handler === 'function') {
                // Handler is a function
                handler.call(this, event, target);
            }
        } catch (error) {
            console.error(`Error in event handler for component ${this.name}:`, error);
            this.onError(error);
        }
    }

    /**
     * Clear all event listeners
     * @private
     */
    _clearEventListeners() {
        const target = this.shadowRoot || this.element;
        if (!target) return;

        this.eventListeners.forEach((handler, key) => {
            const [eventName] = key.split(':');
            target.removeEventListener(eventName, handler);
        });
        
        this.eventListeners.clear();
        this.delegatedEvents.clear();
    }

    /**
     * Bind methods to component instance
     * @private
     */
    _bindMethods() {
        if (this.options.methods) {
            Object.entries(this.options.methods).forEach(([name, method]) => {
                this[name] = method.bind(this);
            });
        }
    }

    /**
     * Initialize computed properties
     * @private
     */
    _initializeComputed() {
        if (this.options.computed) {
            Object.entries(this.options.computed).forEach(([name, config]) => {
                if (typeof config === 'function') {
                    // Simple computed function
                    Object.defineProperty(this, name, {
                        get: config.bind(this),
                        enumerable: true,
                        configurable: true
                    });
                } else if (config.get) {
                    // Computed with getter/setter
                    const descriptor = {
                        enumerable: true,
                        configurable: true,
                        get: config.get.bind(this)
                    };
                    if (config.set) {
                        descriptor.set = config.set.bind(this);
                    }
                    Object.defineProperty(this, name, descriptor);
                }
            });
        }
    }

    /**
     * Find element within component
     * @param {string} selector - CSS selector
     * @returns {Element|null}
     */
    $(selector) {
        const target = this.shadowRoot || this.element;
        return target ? target.querySelector(selector) : null;
    }

    /**
     * Find all elements within component
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    $$(selector) {
        const target = this.shadowRoot || this.element;
        return target ? target.querySelectorAll(selector) : [];
    }

    /**
     * Emit custom event
     * @param {string} eventName - Event name
     * @param {*} detail - Event detail data
     * @param {Object} options - Event options
     */
    emit(eventName, detail = null, options = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: options.bubbles !== false,
            composed: options.composed || false,
            cancelable: options.cancelable || false
        });
        
        (this.element || this.container).dispatchEvent(event);
    }

    /**
     * Update component (force re-render)
     */
    update() {
        this.render();
    }

    /**
     * Error handler
     * @param {Error} error - Error that occurred
     */
    onError(error) {
        // Can be overridden by subclasses
        console.error(`Component ${this.name} error:`, error);
    }

    /**
     * Destroy the component
     */
    async destroy() {
        if (this.isDestroyed) return;

        // Call beforeDestroy lifecycle hook
        await this.beforeDestroy();

        // Clear subscriptions
        this._clearSubscriptions();

        // Clear event listeners
        this._clearEventListeners();

        // Remove from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }

        // Clear references
        this.container = null;
        this.element = null;
        this.shadowRoot = null;

        // Mark as destroyed
        this.isDestroyed = true;
        this.isMounted = false;

        // Call destroyed lifecycle hook
        await this.destroyed();
    }

    /**
     * Before destroy lifecycle hook
     */
    async beforeDestroy() {
        // Override in subclasses
    }

    /**
     * Destroyed lifecycle hook
     */
    async destroyed() {
        // Override in subclasses
    }
}

// Export as default
export default Component;