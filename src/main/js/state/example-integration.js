/**
 * Example integration showing how to use the new state management
 * in the existing app.js without breaking functionality
 */

import { store, storeHelpers } from './store.js';
import { startMigration } from './migration.js';
import { setupUIBindings } from './integrator.js';

// Example: Initialize state management alongside existing globals
export function initializeStateManagement() {
    console.log('Initializing modern state management...');
    
    // Step 1: Migrate existing global values to state store
    const migrationResult = startMigration({
        currentPage: window.currentPage || 'dashboard',
        currentClientPage: window.currentClientPage || 1,
        currentDeliveryPage: window.currentDeliveryPage || 1,
        currentRoutePage: window.currentRoutePage || 1,
        allClients: window.allClients || [],
        allDrivers: window.allDrivers || [],
        allVehicles: window.allVehicles || [],
        allDeliveries: window.allDeliveries || [],
        allRoutes: window.allRoutes || [],
        selectedRouteClients: window.selectedRouteClients || [],
        clientFilters: window.clientFilters || {
            search: '',
            status: 'all',
            city: 'all',
            sortBy: 'name',
            sortOrder: 'asc'
        },
        deliveryFilters: window.deliveryFilters || {
            search: '',
            status: 'all',
            driver: 'all',
            date: '',
            sortBy: 'date',
            sortOrder: 'desc'
        },
        isLoadingDeliveries: window.isLoadingDeliveries || false
    });
    
    console.log('Migration completed:', migrationResult.migrated);
    
    // Step 2: Setup UI bindings for reactive updates
    setupUIBindings();
    
    // Step 3: Override existing functions to use state store
    overrideGlobalFunctions();
    
    // Step 4: Setup development helpers
    if (window.location.hostname === 'localhost') {
        setupDevTools();
    }
}

// Override existing global functions to use state store
function overrideGlobalFunctions() {
    // Override loadClients
    const originalLoadClients = window.loadClients;
    window.loadClients = async function() {
        try {
            const response = await fetch(`${API_BASE}/clients/`);
            const data = await response.json();
            
            // Update state store instead of global
            store.set('clients.all', data.clients || []);
            
            // Also update global for compatibility
            window.allClients = data.clients || [];
            
            return data.clients;
        } catch (error) {
            console.error('Error loading clients:', error);
            return [];
        }
    };
    
    // Override filterClients
    window.filterClients = function() {
        const clients = store.get('clients.all');
        const filters = store.get('clients.filters');
        
        let filtered = [...clients];
        
        // Apply search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(client => 
                client.name.toLowerCase().includes(searchLower) ||
                client.code.toLowerCase().includes(searchLower) ||
                client.address.toLowerCase().includes(searchLower)
            );
        }
        
        // Apply status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter(client => client.status === filters.status);
        }
        
        // Apply city filter
        if (filters.city !== 'all') {
            filtered = filtered.filter(client => client.city === filters.city);
        }
        
        return filtered;
    };
    
    // Override updateClientFilters
    window.updateClientFilters = function(filterType, value) {
        // Update state store
        store.set(`clients.filters.${filterType}`, value);
        
        // Reset to page 1 when filters change
        store.set('navigation.currentClientPage', 1);
        
        // Also update global for compatibility
        window.clientFilters[filterType] = value;
        window.currentClientPage = 1;
    };
    
    // Override navigateTo
    const originalNavigateTo = window.navigateTo;
    window.navigateTo = function(page) {
        // Update state store
        store.set('navigation.currentPage', page);
        
        // Also update global
        window.currentPage = page;
        
        // Call original if it exists
        if (originalNavigateTo) {
            originalNavigateTo(page);
        }
    };
}

// Setup development tools for debugging
function setupDevTools() {
    // Add state inspector to window
    window.__luckyGasState = {
        store: store,
        
        // Get current state
        getState: () => store.getState(),
        
        // Get specific value
        get: (path) => store.get(path),
        
        // Set value (for debugging)
        set: (path, value) => store.set(path, value),
        
        // View history
        getHistory: () => store.getHistory(),
        
        // Reset state
        reset: () => {
            if (confirm('Reset all state to defaults?')) {
                store.reset();
                location.reload();
            }
        },
        
        // Subscribe to changes (for debugging)
        watch: (path) => {
            return store.subscribe(path, (newVal, oldVal, path) => {
                console.log(`[State Change] ${path}:`, oldVal, '→', newVal);
            });
        }
    };
    
    console.log('State DevTools available at window.__luckyGasState');
    console.log('Example: __luckyGasState.get("clients.all")');
    console.log('Example: __luckyGasState.watch("navigation.currentPage")');
}

// Example: Reactive component using state
export function createReactiveClientCounter() {
    const counterElement = document.querySelector('.client-stats-count');
    if (!counterElement) return;
    
    // Create computed property for active client count
    const activeCount = store.computed(
        ['clients.all'],
        (clients) => clients.filter(c => c.status === 'active').length
    );
    
    // Update counter whenever clients change
    store.subscribe('clients.all', () => {
        const total = store.get('clients.all').length;
        const active = activeCount.get();
        
        counterElement.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Clients:</span>
                <span class="stat-value">${total}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Active:</span>
                <span class="stat-value">${active}</span>
            </div>
        `;
    });
}

// Example: Form binding for client filters
export function bindClientFilterForm() {
    const searchInput = document.querySelector('#client-search');
    const statusSelect = document.querySelector('#client-status-filter');
    const citySelect = document.querySelector('#client-city-filter');
    
    if (searchInput) {
        // Set initial value from state
        searchInput.value = store.get('clients.filters.search') || '';
        
        // Update state on input
        searchInput.addEventListener('input', (e) => {
            store.set('clients.filters.search', e.target.value);
        });
        
        // Subscribe to state changes
        store.subscribe('clients.filters.search', (value) => {
            searchInput.value = value;
        });
    }
    
    if (statusSelect) {
        statusSelect.value = store.get('clients.filters.status') || 'all';
        
        statusSelect.addEventListener('change', (e) => {
            store.set('clients.filters.status', e.target.value);
        });
        
        store.subscribe('clients.filters.status', (value) => {
            statusSelect.value = value;
        });
    }
    
    if (citySelect) {
        citySelect.value = store.get('clients.filters.city') || 'all';
        
        citySelect.addEventListener('change', (e) => {
            store.set('clients.filters.city', e.target.value);
        });
        
        store.subscribe('clients.filters.city', (value) => {
            citySelect.value = value;
        });
    }
}

// Example: Delivery tab state management
export function setupDeliveryTabs() {
    // Subscribe to tab changes
    store.subscribe('navigation.currentDeliveryTab', (tab, oldTab) => {
        console.log(`Delivery tab changed: ${oldTab} → ${tab}`);
        
        // Update UI
        document.querySelectorAll('.delivery-tab').forEach(tabEl => {
            tabEl.classList.toggle('active', tabEl.dataset.tab === tab);
        });
        
        // Load deliveries for new tab
        loadDeliveriesForTab(tab);
    });
    
    // Setup tab click handlers
    document.querySelectorAll('.delivery-tab').forEach(tabEl => {
        tabEl.addEventListener('click', () => {
            const tab = tabEl.dataset.tab;
            store.set('navigation.currentDeliveryTab', tab);
        });
    });
}

// Helper function to demonstrate loading with state
async function loadDeliveriesForTab(tab) {
    // Set loading state
    store.set('deliveries.isLoading', true);
    
    try {
        // Update filters for tab
        store.update({
            'deliveries.filters.tab': tab,
            'navigation.currentDeliveryPage': 1
        });
        
        // Fetch data
        const response = await fetch(`${API_BASE}/deliveries/?tab=${tab}`);
        const data = await response.json();
        
        // Update state
        store.set('deliveries.all', data.deliveries || []);
    } catch (error) {
        console.error('Error loading deliveries:', error);
    } finally {
        // Clear loading state
        store.set('deliveries.isLoading', false);
    }
}

// Export for use in app.js
export default {
    initializeStateManagement,
    createReactiveClientCounter,
    bindClientFilterForm,
    setupDeliveryTabs
};