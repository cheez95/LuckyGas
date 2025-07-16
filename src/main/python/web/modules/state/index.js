/**
 * State Management Module Index
 * Central export point for all state management functionality
 */

// Core state store and helpers
export { store, storeHelpers } from './store.js';

// Migration utilities
export { migration, startMigration } from './migration.js';

// Integration with app.js
export { stateIntegrator, initializeState } from './integration.js';

// Default export is the store for convenience
import store from './store.js';
export default store;

/**
 * Quick start guide:
 * 
 * 1. Initialize state management in app.js:
 *    import { initializeState } from './modules/state/index.js';
 *    initializeState();
 * 
 * 2. Use state instead of globals:
 *    // OLD: let clients = allClients;
 *    // NEW: let clients = store.get('clients.all');
 * 
 * 3. Update state:
 *    // OLD: allClients = newClients;
 *    // NEW: store.set('clients.all', newClients);
 * 
 * 4. Subscribe to changes:
 *    store.subscribe('clients.all', (newClients) => {
 *        updateClientTable();
 *    });
 * 
 * 5. Batch updates:
 *    store.update({
 *        'clients.all': newClients,
 *        'clients.filters.search': searchTerm
 *    });
 */

// Computed properties factory
export function createComputedProperties() {
    return {
        // Active clients count
        activeClientsCount: store.computed(
            ['clients.all'],
            (clients) => clients.filter(c => c.status === 'active').length
        ),
        
        // Filtered clients (respects all filters)
        filteredClients: store.computed(
            ['clients.all', 'clients.filters'],
            (clients, filters) => {
                let filtered = [...clients];
                
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase();
                    filtered = filtered.filter(client => 
                        client.name.toLowerCase().includes(searchLower) ||
                        client.code.toLowerCase().includes(searchLower)
                    );
                }
                
                if (filters.status !== 'all') {
                    filtered = filtered.filter(client => client.status === filters.status);
                }
                
                if (filters.city !== 'all') {
                    filtered = filtered.filter(client => client.city === filters.city);
                }
                
                return filtered;
            }
        ),
        
        // Today's deliveries count
        todaysDeliveryCount: store.computed(
            ['deliveries.all'],
            (deliveries) => {
                const today = new Date().toISOString().split('T')[0];
                return deliveries.filter(d => d.date === today).length;
            }
        ),
        
        // Delivery status breakdown
        deliveryStatusBreakdown: store.computed(
            ['deliveries.all'],
            (deliveries) => {
                const breakdown = {
                    pending: 0,
                    in_progress: 0,
                    completed: 0,
                    cancelled: 0
                };
                
                deliveries.forEach(delivery => {
                    if (breakdown.hasOwnProperty(delivery.status)) {
                        breakdown[delivery.status]++;
                    }
                });
                
                return breakdown;
            }
        )
    };
}

// Performance monitoring utilities
export const performanceMonitor = {
    startTransaction(name) {
        const start = performance.now();
        return {
            end() {
                const duration = performance.now() - start;
                console.debug(`[State] ${name} took ${duration.toFixed(2)}ms`);
                return duration;
            }
        };
    },
    
    measureStateUpdate(path, updateFn) {
        const transaction = this.startTransaction(`Update ${path}`);
        const result = updateFn();
        transaction.end();
        return result;
    }
};

// Debug utilities
export const stateDebug = {
    // Log current state tree
    logState() {
        console.group('Current State Tree');
        console.log(store.getState());
        console.groupEnd();
    },
    
    // Log state history
    logHistory() {
        console.group('State History');
        store.getHistory().forEach((change, index) => {
            console.log(`${index}: ${change.path} changed at ${new Date(change.timestamp).toLocaleTimeString()}`);
            console.log('  Old:', change.oldValue);
            console.log('  New:', change.newValue);
        });
        console.groupEnd();
    },
    
    // Watch specific paths with detailed logging
    watch(paths) {
        const pathArray = Array.isArray(paths) ? paths : [paths];
        console.log(`Watching state paths: ${pathArray.join(', ')}`);
        
        return store.subscribe(pathArray, (newValue, oldValue, path) => {
            console.group(`State Change: ${path}`);
            console.log('Old Value:', oldValue);
            console.log('New Value:', newValue);
            console.trace('Call Stack');
            console.groupEnd();
        });
    }
};

// Export utility to check if state is initialized
export function isStateInitialized() {
    return stateIntegrator.isInitialized;
}

// Export convenience methods for common operations
export const stateOperations = {
    // Navigation
    navigateTo(page) {
        store.set('navigation.currentPage', page);
    },
    
    // Clients
    async loadClients() {
        try {
            const response = await fetch(`${window.API_BASE || ''}/clients/`);
            const data = await response.json();
            store.set('clients.all', data.clients || []);
            return data.clients;
        } catch (error) {
            console.error('Error loading clients:', error);
            return [];
        }
    },
    
    updateClientFilters(filters) {
        store.update({
            'clients.filters.search': filters.search || '',
            'clients.filters.status': filters.status || 'all',
            'clients.filters.city': filters.city || 'all',
            'clients.filters.sortBy': filters.sortBy || 'name',
            'clients.filters.sortOrder': filters.sortOrder || 'asc'
        });
    },
    
    // Deliveries
    setDeliveryTab(tab) {
        store.set('navigation.currentDeliveryTab', tab);
    },
    
    setDeliveryLoading(isLoading) {
        store.set('deliveries.isLoading', isLoading);
    },
    
    // Batch operations
    resetFilters(section) {
        const filterPaths = {
            clients: 'clients.filters',
            deliveries: 'deliveries.filters',
            routes: 'routes.filters'
        };
        
        const defaultFilters = {
            search: '',
            status: 'all',
            city: 'all',
            driver: 'all',
            date: '',
            sortBy: section === 'deliveries' ? 'date' : 'name',
            sortOrder: section === 'deliveries' ? 'desc' : 'asc'
        };
        
        if (filterPaths[section]) {
            store.set(filterPaths[section], defaultFilters);
        }
    }
};