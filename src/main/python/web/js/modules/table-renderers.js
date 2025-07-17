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
        renderGenericTable
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
    
    console.log('✅ Table Renderers module loaded');
})();