/**
 * Module Loader for LuckyGas
 * Loads all modularized components in the correct order
 * Ensures dependencies are satisfied before loading
 */

(function() {
    'use strict';
    
    // Module loading order (dependencies first)
    const moduleLoadOrder = [
        'utilities.js',           // Core utilities (api, table, html, form)
        'ui-components.js',       // UI component factories
        'table-config.js',        // Table configurations
        'table-renderers.js',     // Table rendering functions
        'modal-handlers.js',      // Modal management
        'client-handlers.js',     // Client-related handlers
        'delivery-handlers.js',   // Delivery-related handlers
        'driver-handlers.js',     // Driver management
        'vehicle-handlers.js',    // Vehicle management
        'route-handlers.js',      // Route planning
        'schedule-handlers.js',   // Schedule management
        'report-handlers.js'      // Report generation
    ];
    
    // Module registry to track loaded modules
    window.LuckyGasModules = window.LuckyGasModules || {};
    
    /**
     * Load a single module
     */
    function loadModule(moduleName) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `js/modules/${moduleName}`;
            script.type = 'text/javascript';
            script.async = false;
            
            script.onload = () => {
                console.log(`✅ Loaded module: ${moduleName}`);
                window.LuckyGasModules[moduleName] = true;
                resolve();
            };
            
            script.onerror = () => {
                console.error(`❌ Failed to load module: ${moduleName}`);
                reject(new Error(`Failed to load ${moduleName}`));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Load all modules in sequence
     */
    async function loadAllModules() {
        console.log('🚀 Starting module loader...');
        
        for (const moduleName of moduleLoadOrder) {
            try {
                await loadModule(moduleName);
            } catch (error) {
                console.error(`Module loading failed at ${moduleName}:`, error);
                // Continue loading other modules even if one fails
                // This allows partial functionality
            }
        }
        
        console.log('✅ Module loading complete');
        
        // Trigger custom event when all modules are loaded
        window.dispatchEvent(new CustomEvent('modulesLoaded', {
            detail: { modules: window.LuckyGasModules }
        }));
    }
    
    /**
     * Initialize module loader
     */
    function init() {
        // Load modules when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadAllModules);
        } else {
            loadAllModules();
        }
    }
    
    // Auto-initialize
    init();
    
    // Export for manual control if needed
    window.ModuleLoader = {
        loadModule,
        loadAllModules,
        moduleLoadOrder,
        modules: window.LuckyGasModules
    };
})();