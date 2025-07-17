/**
 * State Integration Module for app.js
 * Provides seamless integration with existing codebase
 */

import { store, storeHelpers } from './store.js';
import { migration, startMigration } from './migration.js';

class StateIntegrator {
    constructor() {
        this.isInitialized = false;
        this.subscriptions = [];
        this.reactiveMappings = new Map();
    }

    /**
     * Initialize state integration with existing globals
     */
    initialize(existingGlobals = {}) {
        if (this.isInitialized) {
            return;
        }

        // Collect existing global values
        const globals = {
            currentPage: existingGlobals.currentPage || window.currentPage,
            currentClientPage: existingGlobals.currentClientPage || window.currentClientPage || 1,
            currentDeliveryPage: existingGlobals.currentDeliveryPage || window.currentDeliveryPage || 1,
            currentRoutePage: existingGlobals.currentRoutePage || window.currentRoutePage || 1,
            currentDeliveryTab: existingGlobals.currentDeliveryTab || window.currentDeliveryTab || 'planned',
            allClients: existingGlobals.allClients || window.allClients || [],
            allDrivers: existingGlobals.allDrivers || window.allDrivers || [],
            allVehicles: existingGlobals.allVehicles || window.allVehicles || [],
            allDeliveries: existingGlobals.allDeliveries || window.allDeliveries || [],
            allRoutes: existingGlobals.allRoutes || window.allRoutes || [],
            selectedRouteClients: existingGlobals.selectedRouteClients || window.selectedRouteClients || [],
            clientFilters: existingGlobals.clientFilters || window.clientFilters || {},
            deliveryFilters: existingGlobals.deliveryFilters || window.deliveryFilters || {},
            routeFilters: existingGlobals.routeFilters || window.routeFilters || {},
            isLoadingDeliveries: existingGlobals.isLoadingDeliveries || window.isLoadingDeliveries || false
        };

        // Start migration
        const migrationResult = startMigration(globals);
        
        // Setup reactive updates
        this.setupReactiveUpdates();
        
        // Create global proxies for gradual migration
        this.createGlobalProxies();
        
        this.isInitialized = true;
        
        return migrationResult;
    }

    /**
     * Setup reactive updates for UI elements
     */
    setupReactiveUpdates() {
        // Navigation updates
        this.subscriptions.push(
            store.subscribe('navigation.currentPage', (newPage, oldPage) => {
                if (newPage !== oldPage) {
                    this.updateNavigation(newPage);
                }
            })
        );

        // Client table updates
        this.subscriptions.push(
            store.subscribe(['clients.all', 'clients.filters'], () => {
                if (store.get('navigation.currentPage') === 'clients') {
                    this.updateClientTable();
                }
            })
        );

        // Delivery table updates
        this.subscriptions.push(
            store.subscribe(['deliveries.all', 'deliveries.filters', 'navigation.currentDeliveryTab'], () => {
                if (store.get('navigation.currentPage') === 'deliveries') {
                    this.updateDeliveryTable();
                }
            })
        );

        // Route table updates
        this.subscriptions.push(
            store.subscribe(['routes.all', 'routes.filters'], () => {
                if (store.get('navigation.currentPage') === 'routes') {
                    this.updateRouteTable();
                }
            })
        );

        // Loading state updates
        this.subscriptions.push(
            store.subscribe('deliveries.isLoading', (isLoading) => {
                const loadingElement = document.getElementById('deliveryTableLoading');
                if (loadingElement) {
                    loadingElement.style.display = isLoading ? 'block' : 'none';
                }
            })
        );
    }

    /**
     * Create global variable proxies that use state store
     */
    createGlobalProxies() {
        // Create proxy for each global variable
        const globalMappings = {
            currentPage: 'navigation.currentPage',
            currentClientPage: 'navigation.currentClientPage',
            currentDeliveryPage: 'navigation.currentDeliveryPage',
            currentRoutePage: 'navigation.currentRoutePage',
            currentDeliveryTab: 'navigation.currentDeliveryTab',
            allClients: 'clients.all',
            allDrivers: 'drivers.all',
            allVehicles: 'vehicles.all',
            allDeliveries: 'deliveries.all',
            allRoutes: 'routes.all',
            selectedRouteClients: 'routes.selectedClients',
            clientFilters: 'clients.filters',
            deliveryFilters: 'deliveries.filters',
            routeFilters: 'routes.filters',
            isLoadingDeliveries: 'deliveries.isLoading'
        };

        // Define getters and setters on window object
        Object.entries(globalMappings).forEach(([globalName, statePath]) => {
            Object.defineProperty(window, globalName, {
                get: () => store.get(statePath),
                set: (value) => store.set(statePath, value),
                configurable: true
            });
        });

        // Special handling for window properties
        const windowProps = ['currentViewingClientCode', 'schedulingResultsCache', 'deliveryChart', 'statusChart'];
        windowProps.forEach(prop => {
            const statePath = {
                currentViewingClientCode: 'clients.currentViewingCode',
                schedulingResultsCache: 'scheduling.resultsCache',
                deliveryChart: 'ui.charts.deliveryChart',
                statusChart: 'ui.charts.statusChart'
            }[prop];

            if (statePath) {
                Object.defineProperty(window, prop, {
                    get: () => store.get(statePath),
                    set: (value) => store.set(statePath, value),
                    configurable: true
                });
            }
        });
    }

    /**
     * Update navigation UI based on state
     */
    updateNavigation(page) {
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-page="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Show/hide content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        
        const activeSection = document.getElementById(`${page}-section`);
        if (activeSection) {
            activeSection.style.display = 'block';
        }
    }

    /**
     * Update client table based on state
     */
    updateClientTable() {
        const clients = store.get('clients.all');
        const filters = store.get('clients.filters');
        const currentPage = store.get('navigation.currentClientPage');
        
        // Apply filters
        let filtered = this.applyClientFilters(clients, filters);
        
        // Apply pagination
        const pageSize = 10;
        const start = (currentPage - 1) * pageSize;
        const paginatedClients = filtered.slice(start, start + pageSize);
        
        // Update DOM
        if (typeof window.displayClients === 'function') {
            window.displayClients(paginatedClients, currentPage, Math.ceil(filtered.length / pageSize));
        }
    }

    /**
     * Update delivery table based on state
     */
    updateDeliveryTable() {
        const deliveries = store.get('deliveries.all');
        const filters = store.get('deliveries.filters');
        const currentPage = store.get('navigation.currentDeliveryPage');
        const currentTab = store.get('navigation.currentDeliveryTab');
        
        // Filter by tab
        let tabDeliveries = deliveries;
        if (currentTab && typeof window.filterDeliveriesByTab === 'function') {
            tabDeliveries = window.filterDeliveriesByTab(deliveries, currentTab);
        }
        
        // Apply filters
        let filtered = this.applyDeliveryFilters(tabDeliveries, filters);
        
        // Apply pagination
        const pageSize = 10;
        const start = (currentPage - 1) * pageSize;
        const paginatedDeliveries = filtered.slice(start, start + pageSize);
        
        // Update DOM
        if (typeof window.displayDeliveries === 'function') {
            window.displayDeliveries(paginatedDeliveries, currentPage, Math.ceil(filtered.length / pageSize));
        }
        
        // Update summary
        if (typeof window.updateDeliverySummary === 'function') {
            window.updateDeliverySummary(tabDeliveries);
        }
    }

    /**
     * Update route table based on state
     */
    updateRouteTable() {
        const routes = store.get('routes.all');
        const filters = store.get('routes.filters');
        const currentPage = store.get('navigation.currentRoutePage');
        
        // Apply filters
        let filtered = this.applyRouteFilters(routes, filters);
        
        // Apply pagination
        const pageSize = 10;
        const start = (currentPage - 1) * pageSize;
        const paginatedRoutes = filtered.slice(start, start + pageSize);
        
        // Update DOM
        if (typeof window.displayRoutes === 'function') {
            window.displayRoutes(paginatedRoutes, currentPage, Math.ceil(filtered.length / pageSize));
        }
    }

    /**
     * Apply client filters
     */
    applyClientFilters(clients, filters) {
        let filtered = [...clients];
        
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(client => 
                client.name.toLowerCase().includes(searchLower) ||
                client.code.toLowerCase().includes(searchLower) ||
                (client.address && client.address.toLowerCase().includes(searchLower))
            );
        }
        
        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(client => client.status === filters.status);
        }
        
        if (filters.city && filters.city !== 'all') {
            filtered = filtered.filter(client => client.city === filters.city);
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            const aVal = a[filters.sortBy] || '';
            const bVal = b[filters.sortBy] || '';
            const order = filters.sortOrder === 'asc' ? 1 : -1;
            
            if (aVal < bVal) return -order;
            if (aVal > bVal) return order;
            return 0;
        });
        
        return filtered;
    }

    /**
     * Apply delivery filters
     */
    applyDeliveryFilters(deliveries, filters) {
        let filtered = [...deliveries];
        
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(delivery => 
                delivery.client_name.toLowerCase().includes(searchLower) ||
                delivery.route_name.toLowerCase().includes(searchLower) ||
                (delivery.driver_name && delivery.driver_name.toLowerCase().includes(searchLower))
            );
        }
        
        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(delivery => delivery.status === filters.status);
        }
        
        if (filters.driver && filters.driver !== 'all') {
            filtered = filtered.filter(delivery => delivery.driver_id === filters.driver);
        }
        
        if (filters.date) {
            filtered = filtered.filter(delivery => delivery.date === filters.date);
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            const aVal = a[filters.sortBy] || '';
            const bVal = b[filters.sortBy] || '';
            const order = filters.sortOrder === 'desc' ? -1 : 1;
            
            if (aVal < bVal) return -order;
            if (aVal > bVal) return order;
            return 0;
        });
        
        return filtered;
    }

    /**
     * Apply route filters
     */
    applyRouteFilters(routes, filters) {
        let filtered = [...routes];
        
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(route => 
                route.name.toLowerCase().includes(searchLower) ||
                (route.driver_name && route.driver_name.toLowerCase().includes(searchLower))
            );
        }
        
        if (filters.driver && filters.driver !== 'all') {
            filtered = filtered.filter(route => route.driver_id === filters.driver);
        }
        
        if (filters.date) {
            filtered = filtered.filter(route => route.date === filters.date);
        }
        
        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(route => route.status === filters.status);
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            const aVal = a[filters.sortBy] || '';
            const bVal = b[filters.sortBy] || '';
            const order = filters.sortOrder === 'desc' ? -1 : 1;
            
            if (aVal < bVal) return -order;
            if (aVal > bVal) return order;
            return 0;
        });
        
        return filtered;
    }

    /**
     * Create reactive form bindings
     */
    createFormBinding(formId, statePath) {
        const form = document.getElementById(formId);
        if (!form) return;

        // Bind form inputs to state
        form.querySelectorAll('input, select, textarea').forEach(input => {
            const fieldName = input.name || input.id;
            if (!fieldName) return;

            const fieldPath = `${statePath}.${fieldName}`;
            
            // Set initial value from state
            const stateValue = store.get(fieldPath);
            if (stateValue !== undefined) {
                input.value = stateValue;
            }

            // Update state on input change
            input.addEventListener('change', (e) => {
                const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                store.set(fieldPath, value);
            });

            // Subscribe to state changes
            this.subscriptions.push(
                store.subscribe(fieldPath, (newValue) => {
                    if (input.type === 'checkbox') {
                        input.checked = newValue;
                    } else {
                        input.value = newValue;
                    }
                })
            );
        });
    }

    /**
     * Performance optimization: Batch state updates
     */
    batchUpdate(updates) {
        // Temporarily disable reactive updates
        const originalNotify = store._notifySubscribers;
        store._notifySubscribers = () => {};
        
        // Apply all updates
        Object.entries(updates).forEach(([path, value]) => {
            store.set(path, value, false);
        });
        
        // Re-enable notifications and trigger once
        store._notifySubscribers = originalNotify;
        
        // Notify for all paths
        Object.keys(updates).forEach(path => {
            store._notifySubscribers(path, store.get(path), undefined);
        });
    }

    /**
     * Clean up subscriptions
     */
    destroy() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
        this.isInitialized = false;
    }
}

// Create singleton instance
const stateIntegrator = new StateIntegrator();

// Export integrator and helper functions
export { stateIntegrator };

// Convenience initialization function
export function initializeState(globals = {}) {
    return stateIntegrator.initialize(globals);
}

// Export store access for direct usage
export { store, storeHelpers } from './store.js';

// Export migration utilities
export { migration } from './migration.js';

export default stateIntegrator;