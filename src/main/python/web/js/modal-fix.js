/**
 * Modal Fix - Ensures modal functions are available globally
 * This script waits for all modules to load and then verifies/fixes modal function availability
 */

(function() {
    'use strict';
    
    // Modal function mapping
    const modalFunctions = {
        showAddClientModal: () => {
            const modal = document.getElementById('addClientModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                const form = modal.querySelector('form');
                if (form) form.reset();
                console.log('✅ showAddClientModal executed');
            } else {
                console.error('❌ addClientModal not found');
            }
        },
        
        showAddDriverModal: () => {
            const modal = document.getElementById('addDriverModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                const form = modal.querySelector('form');
                if (form) form.reset();
                console.log('✅ showAddDriverModal executed');
            } else {
                console.error('❌ addDriverModal not found');
            }
        },
        
        showAddVehicleModal: () => {
            const modal = document.getElementById('addVehicleModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                const form = modal.querySelector('form');
                if (form) form.reset();
                console.log('✅ showAddVehicleModal executed');
            } else {
                console.error('❌ addVehicleModal not found');
            }
        },
        
        showAddDeliveryModal: () => {
            const modal = document.getElementById('addDeliveryModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                const form = modal.querySelector('form');
                if (form) form.reset();
                console.log('✅ showAddDeliveryModal executed');
            } else {
                console.error('❌ addDeliveryModal not found');
            }
        },
        
        showAddRouteModal: () => {
            const modal = document.getElementById('addRouteModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                const form = modal.querySelector('form');
                if (form) form.reset();
                console.log('✅ showAddRouteModal executed');
            } else {
                console.error('❌ addRouteModal not found');
            }
        },
        
        showRoutePlanModal: () => {
            const modal = document.getElementById('routePlanModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                console.log('✅ showRoutePlanModal executed');
            } else {
                console.error('❌ routePlanModal not found');
            }
        }
    };
    
    // Function to ensure modal functions are available
    function ensureModalFunctions() {
        Object.keys(modalFunctions).forEach(funcName => {
            if (!window[funcName]) {
                console.warn(`⚠️ ${funcName} not found, adding fallback`);
                window[funcName] = modalFunctions[funcName];
            }
        });
        
        console.log('✅ Modal functions check complete');
    }
    
    // Run checks at multiple points to ensure availability
    
    // 1. When DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureModalFunctions);
    } else {
        ensureModalFunctions();
    }
    
    // 2. When modules are loaded
    window.addEventListener('modulesLoaded', ensureModalFunctions);
    
    // 3. After a short delay (fallback)
    setTimeout(ensureModalFunctions, 1000);
    
    // 4. Also check when any button is clicked
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' && e.target.onclick) {
            const onclickStr = e.target.onclick.toString();
            const match = onclickStr.match(/show\w+Modal/);
            if (match) {
                const funcName = match[0];
                if (!window[funcName] && modalFunctions[funcName]) {
                    console.warn(`⚠️ ${funcName} not available at click time, adding now`);
                    window[funcName] = modalFunctions[funcName];
                }
            }
        }
    });
    
})();