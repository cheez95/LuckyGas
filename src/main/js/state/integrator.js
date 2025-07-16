/**
 * State Store UI Integration
 * Connects reactive state management to UI components
 */

import { store, storeHelpers } from './store.js';

class UIIntegrator {
    constructor() {
        this.subscriptions = [];
        this.componentRegistry = new Map();
    }

    /**
     * Register a UI component with the state store
     */
    registerComponent(componentId, config) {
        const component = {
            id: componentId,
            element: config.element || document.getElementById(componentId),
            dependencies: config.dependencies || [],
            render: config.render,
            subscriptions: []
        };

        // Subscribe to dependencies
        if (component.dependencies.length > 0) {
            const unsubscribe = store.subscribe(component.dependencies, () => {
                this.updateComponent(component);
            });
            component.subscriptions.push(unsubscribe);
        }

        this.componentRegistry.set(componentId, component);
        
        // Initial render
        this.updateComponent(component);
        
        return component;
    }

    /**
     * Update a component based on state changes
     */
    updateComponent(component) {
        if (component.render && component.element) {
            // Get dependency values
            const deps = {};
            component.dependencies.forEach(dep => {
                deps[dep] = store.get(dep);
            });
            
            // Call render function
            const content = component.render(deps, component.element);
            
            // Update DOM if string returned
            if (typeof content === 'string') {
                component.element.innerHTML = content;
            }
        }
    }

    /**
     * Setup reactive bindings for common UI patterns
     */
    setupCommonBindings() {
        // Navigation menu binding
        this.registerComponent('navigation-menu', {
            dependencies: ['navigation.currentPage'],
            render: (deps) => {
                const currentPage = deps['navigation.currentPage'];
                
                // Update active menu items
                document.querySelectorAll('.nav-item').forEach(item => {
                    const page = item.dataset.page;
                    if (page === currentPage) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });
                
                // Show/hide page sections
                document.querySelectorAll('.page-section').forEach(section => {
                    const page = section.dataset.page;
                    section.style.display = page === currentPage ? 'block' : 'none';
                });
            }
        });

        // Client counter binding
        this.registerComponent('client-counter', {
            element: document.querySelector('.client-count'),
            dependencies: ['clients.all', 'clients.filters'],
            render: (deps) => {
                const clients = deps['clients.all'];
                const filters = deps['clients.filters'];
                
                // Apply filters to get count
                let filtered = clients;
                if (filters.status !== 'all') {
                    filtered = filtered.filter(c => c.status === filters.status);
                }
                
                return `${filtered.length} clients`;
            }
        });

        // Delivery tabs binding
        this.registerComponent('delivery-tabs', {
            dependencies: ['navigation.currentDeliveryTab'],
            render: (deps) => {
                const currentTab = deps['navigation.currentDeliveryTab'];
                
                // Update tab UI
                document.querySelectorAll('.delivery-tab').forEach(tab => {
                    const tabName = tab.dataset.tab;
                    if (tabName === currentTab) {
                        tab.classList.add('active');
                    } else {
                        tab.classList.remove('active');
                    }
                });
            }
        });

        // Loading states
        this.registerComponent('delivery-loading', {
            dependencies: ['deliveries.isLoading'],
            render: (deps) => {
                const isLoading = deps['deliveries.isLoading'];
                const loader = document.querySelector('.delivery-loader');
                const content = document.querySelector('.delivery-content');
                
                if (loader) loader.style.display = isLoading ? 'block' : 'none';
                if (content) content.style.opacity = isLoading ? '0.5' : '1';
            }
        });
    }

    /**
     * Create reactive form bindings
     */
    createFormBinding(formId, statePath) {
        const form = document.getElementById(formId);
        if (!form) return;

        // Get all form inputs
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            const fieldName = input.name;
            if (!fieldName) return;

            const fieldPath = `${statePath}.${fieldName}`;
            
            // Set initial value from state
            const initialValue = store.get(fieldPath);
            if (initialValue !== undefined) {
                input.value = initialValue;
            }

            // Update state on input change
            input.addEventListener('change', (e) => {
                let value = e.target.value;
                
                // Convert to appropriate type
                if (input.type === 'number') {
                    value = parseFloat(value) || 0;
                } else if (input.type === 'checkbox') {
                    value = input.checked;
                }
                
                store.set(fieldPath, value);
            });

            // Subscribe to state changes
            const unsubscribe = store.subscribe(fieldPath, (newValue) => {
                if (input.type === 'checkbox') {
                    input.checked = newValue;
                } else {
                    input.value = newValue;
                }
            });

            this.subscriptions.push(unsubscribe);
        });
    }

    /**
     * Setup table bindings with sorting and filtering
     */
    createTableBinding(tableId, config) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const component = {
            table,
            dataPath: config.dataPath,
            filtersPath: config.filtersPath,
            columns: config.columns,
            rowRenderer: config.rowRenderer
        };

        // Subscribe to data and filter changes
        const dependencies = [component.dataPath];
        if (component.filtersPath) {
            dependencies.push(component.filtersPath);
        }

        const unsubscribe = store.subscribe(dependencies, () => {
            this.renderTable(component);
        });

        this.subscriptions.push(unsubscribe);
        
        // Initial render
        this.renderTable(component);
        
        // Setup sort handlers
        this.setupTableSorting(component);
    }

    /**
     * Render table based on current state
     */
    renderTable(component) {
        const data = store.get(component.dataPath) || [];
        const filters = component.filtersPath ? store.get(component.filtersPath) : null;
        
        let processedData = [...data];
        
        // Apply filters if configured
        if (filters && component.filterFn) {
            processedData = component.filterFn(processedData, filters);
        }
        
        // Apply sorting if configured
        if (filters && filters.sortBy) {
            processedData.sort((a, b) => {
                const aVal = a[filters.sortBy];
                const bVal = b[filters.sortBy];
                const order = filters.sortOrder === 'asc' ? 1 : -1;
                
                if (aVal < bVal) return -order;
                if (aVal > bVal) return order;
                return 0;
            });
        }
        
        // Render rows
        const tbody = component.table.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = processedData
                .map(item => component.rowRenderer(item))
                .join('');
        }
    }

    /**
     * Setup table sorting handlers
     */
    setupTableSorting(component) {
        const headers = component.table.querySelectorAll('th[data-sort]');
        
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            
            header.addEventListener('click', () => {
                const sortBy = header.dataset.sort;
                const filters = store.get(component.filtersPath) || {};
                
                // Toggle sort order if clicking same column
                const sortOrder = filters.sortBy === sortBy && filters.sortOrder === 'asc' 
                    ? 'desc' 
                    : 'asc';
                
                // Update filters in state
                store.set(component.filtersPath, {
                    ...filters,
                    sortBy,
                    sortOrder
                });
            });
        });
    }

    /**
     * Create pagination binding
     */
    createPaginationBinding(paginationId, config) {
        const container = document.getElementById(paginationId);
        if (!container) return;

        const component = {
            container,
            currentPagePath: config.currentPagePath,
            totalItemsPath: config.totalItemsPath,
            itemsPerPage: config.itemsPerPage || 10,
            onPageChange: config.onPageChange
        };

        // Subscribe to pagination state
        const unsubscribe = store.subscribe(
            [component.currentPagePath, component.totalItemsPath],
            () => this.renderPagination(component)
        );

        this.subscriptions.push(unsubscribe);
        
        // Initial render
        this.renderPagination(component);
    }

    /**
     * Render pagination controls
     */
    renderPagination(component) {
        const currentPage = store.get(component.currentPagePath) || 1;
        const totalItems = store.get(component.totalItemsPath) || 0;
        const totalPages = Math.ceil(totalItems / component.itemsPerPage);
        
        let html = '<div class="pagination">';
        
        // Previous button
        html += `<button class="page-btn" data-page="${currentPage - 1}" 
                 ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" 
                     data-page="${i}">${i}</button>`;
        }
        
        // Next button
        html += `<button class="page-btn" data-page="${currentPage + 1}" 
                 ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
        
        html += '</div>';
        
        component.container.innerHTML = html;
        
        // Setup click handlers
        component.container.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                if (page >= 1 && page <= totalPages) {
                    store.set(component.currentPagePath, page);
                    if (component.onPageChange) {
                        component.onPageChange(page);
                    }
                }
            });
        });
    }

    /**
     * Cleanup all subscriptions
     */
    destroy() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
        
        this.componentRegistry.forEach(component => {
            component.subscriptions.forEach(unsubscribe => unsubscribe());
        });
        this.componentRegistry.clear();
    }
}

// Create integrator instance
const integrator = new UIIntegrator();

// Export integrator and convenience functions
export { integrator };

// Convenience function to setup all bindings
export function setupUIBindings() {
    // Setup common bindings
    integrator.setupCommonBindings();
    
    // Setup client table
    integrator.createTableBinding('client-table', {
        dataPath: 'clients.all',
        filtersPath: 'clients.filters',
        columns: ['code', 'name', 'city', 'status'],
        rowRenderer: (client) => `
            <tr>
                <td>${client.code}</td>
                <td>${client.name}</td>
                <td>${client.city}</td>
                <td><span class="status-${client.status}">${client.status}</span></td>
                <td>
                    <button onclick="viewClient('${client.code}')">View</button>
                    <button onclick="editClient('${client.code}')">Edit</button>
                </td>
            </tr>
        `,
        filterFn: (clients, filters) => {
            let filtered = [...clients];
            
            if (filters.search) {
                const search = filters.search.toLowerCase();
                filtered = filtered.filter(c => 
                    c.name.toLowerCase().includes(search) ||
                    c.code.toLowerCase().includes(search)
                );
            }
            
            if (filters.status !== 'all') {
                filtered = filtered.filter(c => c.status === filters.status);
            }
            
            if (filters.city !== 'all') {
                filtered = filtered.filter(c => c.city === filters.city);
            }
            
            return filtered;
        }
    });
    
    // Setup delivery table
    integrator.createTableBinding('delivery-table', {
        dataPath: 'deliveries.all',
        filtersPath: 'deliveries.filters',
        columns: ['date', 'client', 'driver', 'status'],
        rowRenderer: (delivery) => `
            <tr>
                <td>${delivery.date}</td>
                <td>${delivery.client_name}</td>
                <td>${delivery.driver_name}</td>
                <td><span class="status-${delivery.status}">${delivery.status}</span></td>
                <td>
                    <button onclick="viewDelivery(${delivery.id})">View</button>
                    <button onclick="editDelivery(${delivery.id})">Edit</button>
                </td>
            </tr>
        `
    });
    
    // Setup filter forms
    integrator.createFormBinding('client-filter-form', 'clients.filters');
    integrator.createFormBinding('delivery-filter-form', 'deliveries.filters');
    
    // Setup pagination
    integrator.createPaginationBinding('client-pagination', {
        currentPagePath: 'navigation.currentClientPage',
        totalItemsPath: 'clients.all.length',
        itemsPerPage: 20,
        onPageChange: (page) => {
            console.log('Loading page', page);
            // Trigger data load for new page
        }
    });
    
    return integrator;
}

export default integrator;