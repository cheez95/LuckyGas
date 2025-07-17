/**
 * Migration utility for transitioning from global variables to state store
 * Provides compatibility layer and gradual migration support
 */

import { store, storeHelpers } from './store.js';

class StateMigration {
    constructor() {
        this.migrationMap = new Map();
        this.setupMigrationMap();
    }

    /**
     * Setup mapping from old global variables to new state paths
     */
    setupMigrationMap() {
        // Navigation globals
        this.migrationMap.set('currentPage', 'navigation.currentPage');
        this.migrationMap.set('currentClientPage', 'navigation.currentClientPage');
        this.migrationMap.set('currentDeliveryPage', 'navigation.currentDeliveryPage');
        this.migrationMap.set('currentRoutePage', 'navigation.currentRoutePage');
        this.migrationMap.set('currentDeliveryTab', 'navigation.currentDeliveryTab');
        
        // Data collections
        this.migrationMap.set('allClients', 'clients.all');
        this.migrationMap.set('allDrivers', 'drivers.all');
        this.migrationMap.set('allVehicles', 'vehicles.all');
        this.migrationMap.set('allDeliveries', 'deliveries.all');
        this.migrationMap.set('allRoutes', 'routes.all');
        this.migrationMap.set('selectedRouteClients', 'routes.selectedClients');
        
        // Filters
        this.migrationMap.set('clientFilters', 'clients.filters');
        this.migrationMap.set('deliveryFilters', 'deliveries.filters');
        this.migrationMap.set('routeFilters', 'routes.filters');
        
        // UI state
        this.migrationMap.set('isLoadingDeliveries', 'deliveries.isLoading');
        
        // Window properties
        this.migrationMap.set('window.currentViewingClientCode', 'clients.currentViewingCode');
        this.migrationMap.set('window.schedulingResultsCache', 'scheduling.resultsCache');
        this.migrationMap.set('window.deliveryChart', 'ui.charts.deliveryChart');
        this.migrationMap.set('window.statusChart', 'ui.charts.statusChart');
    }

    /**
     * Create proxy objects that intercept global variable access
     * and redirect to state store
     */
    createCompatibilityLayer() {
        const compatibility = {};
        
        // Create getters and setters for each mapped variable
        this.migrationMap.forEach((statePath, globalName) => {
            if (globalName.startsWith('window.')) {
                // Handle window properties
                const propName = globalName.replace('window.', '');
                Object.defineProperty(window, propName, {
                    get: () => store.get(statePath),
                    set: (value) => store.set(statePath, value),
                    configurable: true
                });
            } else {
                // Create compatibility object for regular globals
                Object.defineProperty(compatibility, globalName, {
                    get: () => store.get(statePath),
                    set: (value) => store.set(statePath, value),
                    configurable: true
                });
            }
        });
        
        return compatibility;
    }

    /**
     * Migrate existing global values to state store
     */
    migrateExistingValues(globals) {
        const migrated = [];
        
        this.migrationMap.forEach((statePath, globalName) => {
            if (globalName in globals && globals[globalName] !== undefined) {
                store.set(statePath, globals[globalName]);
                migrated.push({
                    from: globalName,
                    to: statePath,
                    value: globals[globalName]
                });
            }
        });
        
        return migrated;
    }

    /**
     * Generate migration code snippets for gradual replacement
     */
    generateMigrationSnippets() {
        const snippets = {};
        
        // Basic variable access
        snippets.basicAccess = `
// OLD: Direct global access
let clients = allClients;
allClients = newClients;

// NEW: State store access
let clients = store.get('clients.all');
store.set('clients.all', newClients);

// OR using helpers
let clients = storeHelpers.getClients();
storeHelpers.setClients(newClients);
`;

        // Filter updates
        snippets.filterUpdate = `
// OLD: Direct filter modification
clientFilters.search = searchTerm;
clientFilters.status = 'active';

// NEW: Atomic filter update
store.update({
    'clients.filters.search': searchTerm,
    'clients.filters.status': 'active'
});

// OR using helper
storeHelpers.updateClientFilters({
    search: searchTerm,
    status: 'active'
});
`;

        // Reactive updates
        snippets.reactiveUpdates = `
// OLD: Manual DOM updates after state change
allClients = newClients;
updateClientTable();
updateClientCount();

// NEW: Subscribe to state changes
store.subscribe('clients.all', (newClients, oldClients) => {
    updateClientTable();
    updateClientCount();
});

// Then just update state
store.set('clients.all', newClients);
`;

        // Computed values
        snippets.computedValues = `
// OLD: Manual calculation
function getActiveClients() {
    return allClients.filter(c => c.status === 'active');
}

// NEW: Computed property
const activeClients = store.computed(
    ['clients.all'],
    (clients) => clients.filter(c => c.status === 'active')
);

// Use it
const active = activeClients.get();
`;

        return snippets;
    }

    /**
     * Create wrapper functions that use state store internally
     * but maintain the same API as existing functions
     */
    createFunctionWrappers() {
        return {
            // Wrapper for loadClients
            loadClients: async function() {
                try {
                    const response = await fetch(`${API_BASE}/clients/`);
                    const data = await response.json();
                    
                    // Use state store instead of global
                    store.set('clients.all', data.clients || []);
                    
                    // Update any dependent UI
                    return data.clients;
                } catch (error) {
                    console.error('Error loading clients:', error);
                    return [];
                }
            },

            // Wrapper for filterClients
            filterClients: function() {
                const clients = store.get('clients.all');
                const filters = store.get('clients.filters');
                
                let filtered = [...clients];
                
                // Apply filters
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase();
                    filtered = filtered.filter(client => 
                        client.name.toLowerCase().includes(searchLower) ||
                        client.code.toLowerCase().includes(searchLower)
                    );
                }
                
                if (filters.status !== 'all') {
                    filtered = filtered.filter(client => 
                        client.status === filters.status
                    );
                }
                
                if (filters.city !== 'all') {
                    filtered = filtered.filter(client => 
                        client.city === filters.city
                    );
                }
                
                // Apply sorting
                filtered.sort((a, b) => {
                    const aVal = a[filters.sortBy];
                    const bVal = b[filters.sortBy];
                    const order = filters.sortOrder === 'asc' ? 1 : -1;
                    
                    if (aVal < bVal) return -order;
                    if (aVal > bVal) return order;
                    return 0;
                });
                
                return filtered;
            },

            // Wrapper for navigation
            navigateTo: function(page) {
                store.set('navigation.currentPage', page);
                
                // Subscribe to page changes for UI updates
                // This would replace direct DOM manipulation
            }
        };
    }

    /**
     * Generate a migration report showing what needs to be changed
     */
    generateMigrationReport(sourceCode) {
        const report = {
            globalVariables: [],
            functionReferences: [],
            recommendations: []
        };

        // Find all global variable references
        this.migrationMap.forEach((statePath, globalName) => {
            const regex = new RegExp(`\\b${globalName}\\b`, 'g');
            const matches = sourceCode.match(regex);
            if (matches) {
                report.globalVariables.push({
                    variable: globalName,
                    occurrences: matches.length,
                    newPath: statePath
                });
            }
        });

        // Add recommendations
        report.recommendations = [
            'Phase 1: Add state store alongside globals',
            'Phase 2: Create compatibility layer for gradual migration',
            'Phase 3: Update functions one by one to use state store',
            'Phase 4: Add subscriptions for reactive updates',
            'Phase 5: Remove compatibility layer and globals'
        ];

        return report;
    }
}

// Create migration instance
const migration = new StateMigration();

// Export migration utilities
export { migration };

// Convenience function to start migration
export function startMigration(existingGlobals = {}) {
    // Step 1: Migrate existing values
    const migrated = migration.migrateExistingValues(existingGlobals);
    
    // Step 2: Create compatibility layer
    const compatibility = migration.createCompatibilityLayer();
    
    // Step 3: Return wrapped functions
    const wrappers = migration.createFunctionWrappers();
    
    return {
        compatibility,
        wrappers,
        migrated,
        snippets: migration.generateMigrationSnippets()
    };
}

// Export default
export default migration;