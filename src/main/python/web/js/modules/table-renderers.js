/**
 * Table Renderers Module
 * Contains all table rendering functions for different entities
 * Uses table configurations from window.tableConfigs
 */

(function() {
    'use strict';
    
    // Generic table renderer that uses configuration
    function renderGenericTable(configType, data) {
        // Get configuration for this table type
        const config = window.tableConfigs && window.tableConfigs[configType];
        if (!config) {
            console.error(`Table configuration not found for type: ${configType}`);
            return;
        }
        
        // Get the table container
        const container = document.getElementById(config.containerId);
        if (!container) {
            console.error(`Container not found: ${config.containerId}`);
            return;
        }
        
        // Check if data is empty
        if (!data || data.length === 0) {
            container.innerHTML = `<p class="no-data">${config.emptyMessage || 'No data available'}</p>`;
            return;
        }
        
        // Prepare rows with data and attributes
        const rows = data.map(item => {
            const row = {
                data: item,
                attributes: {}
            };
            
            // Add row attributes if specified in config
            if (config.getRowAttributes && typeof config.getRowAttributes === 'function') {
                Object.assign(row.attributes, config.getRowAttributes(item));
            }
            
            return row;
        });
        
        // Render the table using the utilities function
        if (window.utilities && window.utilities.table) {
            window.utilities.table.render(
                container,
                config.columns,
                rows
            );
        } else {
            console.error('Table utilities not found');
        }
    }
    
    // Delivery table renderers
    function renderDeliveriesTable(deliveries) {
        renderGenericTable('deliveries', deliveries);
    }
    
    function renderPendingDeliveriesTable(deliveries) {
        renderGenericTable('pendingDeliveries', deliveries);
    }
    
    // Client table renderers
    function renderClientsTable(clients) {
        renderGenericTable('clients', clients);
    }
    
    function renderClientDetailsTable(deliveries) {
        renderGenericTable('clientDetails', deliveries);
    }
    
    // Driver table renderer
    function renderDriversTable(drivers) {
        renderGenericTable('drivers', drivers);
    }
    
    // Vehicle table renderer
    function renderVehiclesTable(vehicles) {
        renderGenericTable('vehicles', vehicles);
    }
    
    // Route table renderer
    function renderRoutesTable(routes) {
        renderGenericTable('routes', routes);
    }
    
    // Schedule table renderer
    function renderScheduleTable(schedules) {
        renderGenericTable('schedules', schedules);
    }
    
    /**
     * Update pagination controls for a given section
     * @param {string} section - Section name (e.g., 'deliveries', 'clients')
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {number} totalItems - Total number of items
     */
    function updatePagination(section, currentPage, totalPages, totalItems) {
        const container = document.getElementById(`${section}-pagination`);
        if (!container) return;
        
        container.innerHTML = '';
        
        // Showing info
        const showingElement = document.getElementById(`${section}-showing`);
        const totalElement = document.getElementById(`${section}-total`);
        if (showingElement && totalElement) {
            const startItem = (currentPage - 1) * 10 + 1;
            const endItem = Math.min(currentPage * 10, totalItems);
            showingElement.textContent = totalItems > 0 ? `${startItem}-${endItem}` : '0';
            totalElement.textContent = totalItems;
        }
        
        if (totalPages <= 1) return;
        
        // Helper function to capitalize first letter
        const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
        
        // First and Previous buttons
        if (currentPage > 1) {
            container.innerHTML += `
                <button data-action="load${capitalize(section)}" data-page="1" 
                        class="px-3 py-1 border rounded hover:bg-gray-100 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                        ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-angle-double-left"></i>
                </button>
                <button data-action="load${capitalize(section)}" data-page="${currentPage - 1}" 
                        class="px-3 py-1 border rounded hover:bg-gray-100">
                    <i class="fas fa-angle-left"></i>
                </button>
            `;
        }
        
        // Page numbers with ellipsis
        const pageNumbers = [];
        const delta = 2;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                pageNumbers.push(i);
            }
        }
        
        let lastPage = 0;
        pageNumbers.forEach(page => {
            if (lastPage && page - lastPage > 1) {
                container.innerHTML += `<span class="px-2">...</span>`;
            }
            
            container.innerHTML += `
                <button data-action="load${capitalize(section)}" data-page="${page}" 
                        class="px-3 py-1 border rounded ${page === currentPage ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}">
                    ${page}
                </button>
            `;
            
            lastPage = page;
        });
        
        // Next and Last buttons
        if (currentPage < totalPages) {
            container.innerHTML += `
                <button data-action="load${capitalize(section)}" data-page="${currentPage + 1}" 
                        class="px-3 py-1 border rounded hover:bg-gray-100">
                    <i class="fas fa-angle-right"></i>
                </button>
                <button data-action="load${capitalize(section)}" data-page="${totalPages}" 
                        class="px-3 py-1 border rounded hover:bg-gray-100 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
                        ${currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-angle-double-right"></i>
                </button>
            `;
        }
    }
    
    // Export all table renderers
    window.tableRenderers = {
        renderDeliveriesTable,
        renderPendingDeliveriesTable,
        renderClientsTable,
        renderClientDetailsTable,
        renderDriversTable,
        renderVehiclesTable,
        renderRoutesTable,
        renderScheduleTable,
        // Also export the generic renderer for flexibility
        renderGenericTable,
        // Export updatePagination function
        updatePagination
    };
    
    // Also export individually for backward compatibility
    window.renderDeliveriesTable = renderDeliveriesTable;
    window.renderPendingDeliveriesTable = renderPendingDeliveriesTable;
    window.renderClientsTable = renderClientsTable;
    window.renderClientDetailsTable = renderClientDetailsTable;
    window.renderDriversTable = renderDriversTable;
    window.renderVehiclesTable = renderVehiclesTable;
    window.renderRoutesTable = renderRoutesTable;
    window.renderScheduleTable = renderScheduleTable;
    window.renderGenericTable = renderGenericTable;
    window.updatePagination = updatePagination;
    
    console.log('✅ Table Renderers module loaded');
})();