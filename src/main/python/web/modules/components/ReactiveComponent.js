/**
 * Reactive Component Class for LuckyGas
 * Extends base Component with advanced reactive features
 * @module components/ReactiveComponent
 */

import { Component } from './Component.js';
import store from '../../src/main/js/state/store.js';
import { dom } from '../utils/index.js';

/**
 * ReactiveComponent - Enhanced component with two-way binding and reactive features
 */
export class ReactiveComponent extends Component {
    /**
     * Create a reactive component
     * @param {Object} options - Component configuration
     * @param {Object} options.data - Reactive data object
     * @param {Object} options.computedState - Computed properties from global state
     * @param {Object} options.watch - Properties to watch for changes
     * @param {Object} options.filters - Template filters
     * @param {boolean} options.enableInterpolation - Enable template interpolation
     */
    constructor(options = {}) {
        super(options);
        
        // Reactive data setup
        this.data = this._makeReactive(options.data || {});
        
        // Computed state properties
        this.computedState = {};
        this._setupComputedState(options.computedState || {});
        
        // Watchers
        this.watchers = new Map();
        this._setupWatchers(options.watch || {});
        
        // Template filters
        this.filters = options.filters || {};
        
        // Interpolation settings
        this.enableInterpolation = options.enableInterpolation !== false;
        this.interpolationRegex = /\{\{(.+?)\}\}/g;
        
        // Two-way binding tracking
        this.boundElements = new WeakMap();
        
        // Reactive update queue
        this.updateQueue = new Set();
        this.updateScheduled = false;
    }

    /**
     * Make data object reactive
     * @private
     */
    _makeReactive(data) {
        const reactiveData = {};
        const component = this;

        Object.keys(data).forEach(key => {
            let value = data[key];
            
            // Handle nested objects
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                value = this._makeReactive(value);
            }

            Object.defineProperty(reactiveData, key, {
                get() {
                    return value;
                },
                set(newValue) {
                    const oldValue = value;
                    
                    // Handle nested objects
                    if (newValue && typeof newValue === 'object' && !Array.isArray(newValue)) {
                        newValue = component._makeReactive(newValue);
                    }
                    
                    value = newValue;
                    
                    // Trigger watchers
                    component._triggerWatchers(key, newValue, oldValue);
                    
                    // Queue update
                    component._queueUpdate();
                },
                enumerable: true,
                configurable: true
            });
        });

        return reactiveData;
    }

    /**
     * Setup computed properties from global state
     * @private
     */
    _setupComputedState(computedState) {
        Object.entries(computedState).forEach(([name, config]) => {
            if (typeof config === 'string') {
                // Simple state path
                Object.defineProperty(this.computedState, name, {
                    get: () => store.get(config),
                    enumerable: true,
                    configurable: true
                });
                
                // Subscribe to changes
                this.subscribeTo.push(config);
            } else if (typeof config === 'object') {
                // Complex computed with dependencies
                const { dependencies, compute } = config;
                
                Object.defineProperty(this.computedState, name, {
                    get: () => {
                        const values = dependencies.map(dep => store.get(dep));
                        return compute(...values);
                    },
                    enumerable: true,
                    configurable: true
                });
                
                // Subscribe to all dependencies
                dependencies.forEach(dep => this.subscribeTo.push(dep));
            }
        });
    }

    /**
     * Setup watchers
     * @private
     */
    _setupWatchers(watchers) {
        Object.entries(watchers).forEach(([path, handler]) => {
            this.watch(path, handler);
        });
    }

    /**
     * Watch a property for changes
     * @param {string} path - Property path to watch
     * @param {Function} handler - Handler function
     * @param {Object} options - Watcher options
     */
    watch(path, handler, options = {}) {
        const { immediate = false, deep = false } = options;
        
        if (!this.watchers.has(path)) {
            this.watchers.set(path, []);
        }
        
        const watcherConfig = { handler, deep };
        this.watchers.get(path).push(watcherConfig);
        
        // Call immediately if requested
        if (immediate) {
            const value = this._getValueByPath(path);
            handler.call(this, value, undefined);
        }
        
        // Return unwatch function
        return () => {
            const watchers = this.watchers.get(path);
            const index = watchers.indexOf(watcherConfig);
            if (index > -1) {
                watchers.splice(index, 1);
            }
        };
    }

    /**
     * Trigger watchers for a property
     * @private
     */
    _triggerWatchers(path, newValue, oldValue) {
        // Direct watchers
        if (this.watchers.has(path)) {
            this.watchers.get(path).forEach(({ handler }) => {
                handler.call(this, newValue, oldValue);
            });
        }
        
        // Check for parent path watchers (for nested properties)
        this.watchers.forEach((watchersList, watchPath) => {
            if (path.startsWith(watchPath + '.')) {
                watchersList.forEach(({ handler }) => {
                    const newParentValue = this._getValueByPath(watchPath);
                    handler.call(this, newParentValue, undefined);
                });
            }
        });
    }

    /**
     * Get value by dot-notation path
     * @private
     */
    _getValueByPath(path) {
        const keys = path.split('.');
        let value = this.data;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    /**
     * Queue component update
     * @private
     */
    _queueUpdate() {
        if (!this.updateScheduled) {
            this.updateScheduled = true;
            requestAnimationFrame(() => {
                this.render();
                this.updateScheduled = false;
            });
        }
    }

    /**
     * Override render to handle interpolation
     */
    render() {
        if (this.isDestroyed) return;

        try {
            // Get template HTML
            let html = this.template();

            // Apply interpolation if enabled
            if (this.enableInterpolation) {
                html = this._interpolate(html);
            }

            // Update DOM
            const target = this.shadowRoot || this.element;
            if (target) {
                target.innerHTML = html;
            }

            // Setup two-way bindings
            this._setupBindings();

            // Re-setup event listeners after render
            if (this.isMounted) {
                this._setupEventListeners();
            }

            // Call updated lifecycle hook
            this.updated();
        } catch (error) {
            console.error(`Error rendering reactive component ${this.name}:`, error);
            this.onError(error);
        }
    }

    /**
     * Interpolate template with data
     * @private
     */
    _interpolate(template) {
        return template.replace(this.interpolationRegex, (match, expression) => {
            try {
                // Parse expression
                const trimmed = expression.trim();
                
                // Check for filters
                const parts = trimmed.split('|').map(p => p.trim());
                let value = this._evaluateExpression(parts[0]);
                
                // Apply filters
                for (let i = 1; i < parts.length; i++) {
                    const filterName = parts[i];
                    if (this.filters[filterName]) {
                        value = this.filters[filterName](value);
                    }
                }
                
                // Escape HTML by default
                return dom.escapeHtml(String(value));
            } catch (error) {
                console.error(`Interpolation error: ${expression}`, error);
                return '';
            }
        });
    }

    /**
     * Evaluate template expression
     * @private
     */
    _evaluateExpression(expression) {
        // Create a function that has access to component data
        const func = new Function(
            'data', 'state', 'props', 'computedState',
            `with (data) { with (state) { with (props) { with (computedState) { 
                return ${expression}; 
            }}}}` 
        );
        
        return func.call(
            this,
            this.data,
            this.localState,
            this.props,
            this.computedState
        );
    }

    /**
     * Setup two-way bindings
     * @private
     */
    _setupBindings() {
        const target = this.shadowRoot || this.element;
        if (!target) return;

        // Find all elements with v-model attribute
        const boundElements = target.querySelectorAll('[v-model]');
        
        boundElements.forEach(element => {
            const bindingPath = element.getAttribute('v-model');
            
            // Set initial value
            const value = this._getValueByPath(bindingPath);
            if (element.type === 'checkbox') {
                element.checked = !!value;
            } else if (element.type === 'radio') {
                element.checked = element.value === value;
            } else {
                element.value = value || '';
            }
            
            // Remove existing listener if any
            const existingHandler = this.boundElements.get(element);
            if (existingHandler) {
                element.removeEventListener('input', existingHandler);
                element.removeEventListener('change', existingHandler);
            }
            
            // Create update handler
            const updateHandler = (event) => {
                let newValue;
                
                if (element.type === 'checkbox') {
                    newValue = element.checked;
                } else if (element.type === 'number') {
                    newValue = parseFloat(element.value) || 0;
                } else {
                    newValue = element.value;
                }
                
                // Update data
                this._setValueByPath(bindingPath, newValue);
            };
            
            // Add event listener
            const eventType = element.type === 'checkbox' || element.type === 'radio' ? 'change' : 'input';
            element.addEventListener(eventType, updateHandler);
            
            // Store handler for cleanup
            this.boundElements.set(element, updateHandler);
        });
    }

    /**
     * Set value by dot-notation path
     * @private
     */
    _setValueByPath(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.data;
        
        for (const key of keys) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }
        
        target[lastKey] = value;
    }

    /**
     * Helper method to create computed property
     * @param {Function} computeFn - Compute function
     * @param {Array<string>} dependencies - Reactive dependencies
     */
    computed(computeFn, dependencies = []) {
        let cachedValue;
        let isDirty = true;
        
        // Watch all dependencies
        dependencies.forEach(dep => {
            this.watch(dep, () => {
                isDirty = true;
            });
        });
        
        return {
            get value() {
                if (isDirty) {
                    cachedValue = computeFn();
                    isDirty = false;
                }
                return cachedValue;
            }
        };
    }

    /**
     * Override destroy to clean up bindings
     */
    async destroy() {
        // Clear bound elements
        this.boundElements = new WeakMap();
        
        // Clear watchers
        this.watchers.clear();
        
        // Call parent destroy
        await super.destroy();
    }
}

// Export as default
export default ReactiveComponent;