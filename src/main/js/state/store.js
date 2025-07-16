/**
 * Modern State Management System for LuckyGas
 * Implements a centralized reactive store with pub/sub pattern
 * Provides localStorage persistence and type safety
 */

class StateStore {
    constructor() {
        // Internal state storage
        this._state = {};
        
        // Subscribers for reactive updates
        this._subscribers = new Map();
        
        // State change history for debugging
        this._history = [];
        this._maxHistorySize = 50;
        
        // Persistence configuration
        this._persistenceConfig = new Map();
        
        // Initialize with default state structure
        this._initializeDefaultState();
    }

    /**
     * Initialize default state structure with type definitions
     */
    _initializeDefaultState() {
        // Define state schema with default values and types
        const stateSchema = {
            // Navigation state
            navigation: {
                currentPage: { default: 'dashboard', type: 'string', persist: true },
                currentClientPage: { default: 1, type: 'number', persist: false },
                currentDeliveryPage: { default: 1, type: 'number', persist: false },
                currentRoutePage: { default: 1, type: 'number', persist: false },
                currentDeliveryTab: { default: 'planned', type: 'string', persist: true }
            },
            
            // Data collections
            clients: {
                all: { default: [], type: 'array', persist: false },
                filters: {
                    default: {
                        search: '',
                        status: 'all',
                        city: 'all',
                        sortBy: 'name',
                        sortOrder: 'asc'
                    },
                    type: 'object',
                    persist: true
                },
                currentViewingCode: { default: null, type: 'string', persist: false }
            },
            
            // Deliveries state
            deliveries: {
                all: { default: [], type: 'array', persist: false },
                filters: {
                    default: {
                        search: '',
                        status: 'all',
                        driver: 'all',
                        date: '',
                        sortBy: 'date',
                        sortOrder: 'desc',
                        tab: 'planned'
                    },
                    type: 'object',
                    persist: true
                },
                isLoading: { default: false, type: 'boolean', persist: false }
            },
            
            // Routes state
            routes: {
                all: { default: [], type: 'array', persist: false },
                selectedClients: { default: [], type: 'array', persist: false },
                filters: {
                    default: {
                        search: '',
                        date: '',
                        driver: 'all',
                        status: 'all',
                        sortBy: 'date',
                        sortOrder: 'desc'
                    },
                    type: 'object',
                    persist: true
                }
            },
            
            // Reference data
            drivers: {
                all: { default: [], type: 'array', persist: false }
            },
            
            vehicles: {
                all: { default: [], type: 'array', persist: false }
            },
            
            // UI state
            ui: {
                modals: {
                    default: {
                        scheduleModal: false,
                        routePlanModal: false,
                        addRouteModal: false
                    },
                    type: 'object',
                    persist: false
                },
                charts: {
                    deliveryChart: { default: null, type: 'object', persist: false },
                    statusChart: { default: null, type: 'object', persist: false }
                }
            },
            
            // Scheduling state
            scheduling: {
                resultsCache: { default: new Map(), type: 'map', persist: false },
                previewData: { default: null, type: 'object', persist: false }
            }
        };
        
        // Initialize state from schema
        this._initializeFromSchema(stateSchema);
        
        // Load persisted state from localStorage
        this._loadPersistedState();
    }

    /**
     * Initialize state from schema definition
     */
    _initializeFromSchema(schema, path = []) {
        Object.entries(schema).forEach(([key, config]) => {
            const currentPath = [...path, key];
            const stateKey = currentPath.join('.');
            
            if (config.default !== undefined) {
                // Leaf node with configuration
                this._setState(stateKey, config.default, false);
                
                // Store persistence configuration
                if (config.persist) {
                    this._persistenceConfig.set(stateKey, true);
                }
            } else {
                // Branch node, recurse
                this._initializeFromSchema(config, currentPath);
            }
        });
    }

    /**
     * Get state value by path
     * @param {string} path - Dot-separated path (e.g., 'clients.filters.search')
     * @returns {*} State value
     */
    get(path) {
        const keys = path.split('.');
        let value = this._state;
        
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
     * Set state value by path
     * @param {string} path - Dot-separated path
     * @param {*} value - New value
     * @param {boolean} notify - Whether to notify subscribers
     */
    set(path, value, notify = true) {
        this._setState(path, value, notify);
    }

    /**
     * Internal state setter with history tracking
     */
    _setState(path, value, notify = true) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        // Navigate to parent object
        let current = this._state;
        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        // Store old value for history
        const oldValue = current[lastKey];
        
        // Set new value
        current[lastKey] = value;
        
        // Add to history
        this._addToHistory({
            path,
            oldValue,
            newValue: value,
            timestamp: Date.now()
        });
        
        // Persist if configured
        if (this._persistenceConfig.get(path)) {
            this._persistToLocalStorage(path, value);
        }
        
        // Notify subscribers
        if (notify) {
            this._notifySubscribers(path, value, oldValue);
        }
    }

    /**
     * Update multiple state values atomically
     * @param {Object} updates - Object with path-value pairs
     */
    update(updates) {
        // Set all values without notifications
        Object.entries(updates).forEach(([path, value]) => {
            this._setState(path, value, false);
        });
        
        // Notify all affected subscribers once
        Object.entries(updates).forEach(([path, value]) => {
            const oldValue = this.get(path);
            this._notifySubscribers(path, value, oldValue);
        });
    }

    /**
     * Subscribe to state changes
     * @param {string|string[]} paths - Path(s) to watch
     * @param {Function} callback - Function to call on changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(paths, callback) {
        const pathArray = Array.isArray(paths) ? paths : [paths];
        const subscriptionId = Symbol('subscription');
        
        pathArray.forEach(path => {
            if (!this._subscribers.has(path)) {
                this._subscribers.set(path, new Map());
            }
            this._subscribers.get(path).set(subscriptionId, callback);
        });
        
        // Return unsubscribe function
        return () => {
            pathArray.forEach(path => {
                const pathSubscribers = this._subscribers.get(path);
                if (pathSubscribers) {
                    pathSubscribers.delete(subscriptionId);
                }
            });
        };
    }

    /**
     * Notify subscribers of state changes
     */
    _notifySubscribers(path, newValue, oldValue) {
        // Notify exact path subscribers
        const exactSubscribers = this._subscribers.get(path);
        if (exactSubscribers) {
            exactSubscribers.forEach(callback => {
                callback(newValue, oldValue, path);
            });
        }
        
        // Notify parent path subscribers (for nested updates)
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentSubscribers = this._subscribers.get(parentPath);
            if (parentSubscribers) {
                parentSubscribers.forEach(callback => {
                    callback(this.get(parentPath), undefined, parentPath);
                });
            }
        }
    }

    /**
     * Add state change to history
     */
    _addToHistory(change) {
        this._history.push(change);
        if (this._history.length > this._maxHistorySize) {
            this._history.shift();
        }
    }

    /**
     * Get state change history
     */
    getHistory() {
        return [...this._history];
    }

    /**
     * Persist value to localStorage
     */
    _persistToLocalStorage(path, value) {
        const key = `luckygas_state_${path}`;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Failed to persist state for ${path}:`, error);
        }
    }

    /**
     * Load persisted state from localStorage
     */
    _loadPersistedState() {
        this._persistenceConfig.forEach((persist, path) => {
            if (persist) {
                const key = `luckygas_state_${path}`;
                try {
                    const stored = localStorage.getItem(key);
                    if (stored !== null) {
                        const value = JSON.parse(stored);
                        this._setState(path, value, false);
                    }
                } catch (error) {
                    console.error(`Failed to load persisted state for ${path}:`, error);
                }
            }
        });
    }

    /**
     * Create a computed property that automatically updates
     * @param {string[]} dependencies - State paths to depend on
     * @param {Function} computeFn - Function to compute the value
     * @returns {Object} Computed property with get() method
     */
    computed(dependencies, computeFn) {
        let cachedValue;
        let isDirty = true;
        
        // Subscribe to all dependencies
        const unsubscribe = this.subscribe(dependencies, () => {
            isDirty = true;
        });
        
        return {
            get: () => {
                if (isDirty) {
                    const depValues = dependencies.map(dep => this.get(dep));
                    cachedValue = computeFn(...depValues);
                    isDirty = false;
                }
                return cachedValue;
            },
            destroy: () => {
                unsubscribe();
            }
        };
    }

    /**
     * Create a derived state that updates when dependencies change
     * @param {string} targetPath - Path to store derived value
     * @param {string[]} dependencies - State paths to depend on
     * @param {Function} deriveFn - Function to derive the value
     */
    derive(targetPath, dependencies, deriveFn) {
        const updateDerived = () => {
            const depValues = dependencies.map(dep => this.get(dep));
            const derivedValue = deriveFn(...depValues);
            this.set(targetPath, derivedValue);
        };
        
        // Initial computation
        updateDerived();
        
        // Subscribe to updates
        return this.subscribe(dependencies, updateDerived);
    }

    /**
     * Debug helper to get entire state tree
     */
    getState() {
        return JSON.parse(JSON.stringify(this._state));
    }

    /**
     * Reset state to defaults
     */
    reset() {
        // Clear localStorage
        this._persistenceConfig.forEach((persist, path) => {
            if (persist) {
                const key = `luckygas_state_${path}`;
                localStorage.removeItem(key);
            }
        });
        
        // Re-initialize
        this._state = {};
        this._history = [];
        this._initializeDefaultState();
    }
}

// Create singleton instance
const store = new StateStore();

// Helper functions for common operations
const storeHelpers = {
    /**
     * Get current page
     */
    getCurrentPage() {
        return store.get('navigation.currentPage');
    },
    
    /**
     * Set current page
     */
    setCurrentPage(page) {
        store.set('navigation.currentPage', page);
    },
    
    /**
     * Get all clients
     */
    getClients() {
        return store.get('clients.all');
    },
    
    /**
     * Set clients
     */
    setClients(clients) {
        store.set('clients.all', clients);
    },
    
    /**
     * Get client filters
     */
    getClientFilters() {
        return store.get('clients.filters');
    },
    
    /**
     * Update client filters
     */
    updateClientFilters(updates) {
        const currentFilters = store.get('clients.filters');
        store.set('clients.filters', { ...currentFilters, ...updates });
    },
    
    /**
     * Get deliveries for current tab
     */
    getDeliveries() {
        return store.get('deliveries.all');
    },
    
    /**
     * Set deliveries
     */
    setDeliveries(deliveries) {
        store.set('deliveries.all', deliveries);
    },
    
    /**
     * Get delivery filters
     */
    getDeliveryFilters() {
        return store.get('deliveries.filters');
    },
    
    /**
     * Update delivery filters
     */
    updateDeliveryFilters(updates) {
        const currentFilters = store.get('deliveries.filters');
        store.set('deliveries.filters', { ...currentFilters, ...updates });
    },
    
    /**
     * Get current delivery tab
     */
    getCurrentDeliveryTab() {
        return store.get('navigation.currentDeliveryTab');
    },
    
    /**
     * Set current delivery tab
     */
    setCurrentDeliveryTab(tab) {
        store.set('navigation.currentDeliveryTab', tab);
    }
};

// Export store and helpers
export { store, storeHelpers };

// Also export as default for convenience
export default store;