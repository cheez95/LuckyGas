/**
 * Modal Delegation - Handles modal button clicks through event delegation
 * This ensures modal buttons work even if functions aren't loaded yet
 */

(function() {
    'use strict';
    
    // Handle modal button clicks through delegation
    document.addEventListener('click', function(e) {
        // Check if clicked element is a button with onclick containing modal function
        const button = e.target.closest('button');
        if (!button || !button.hasAttribute('onclick')) return;
        
        const onclickAttr = button.getAttribute('onclick');
        
        // Map of onclick patterns to their handler functions
        const modalHandlers = {
            'showAddClientModal()': function() {
                const modal = document.getElementById('addClientModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    const form = modal.querySelector('form');
                    if (form) form.reset();
                } else {
                    console.error('addClientModal not found');
                }
            },
            
            'showAddDriverModal()': function() {
                const modal = document.getElementById('addDriverModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    const form = modal.querySelector('form');
                    if (form) form.reset();
                } else {
                    console.error('addDriverModal not found');
                }
            },
            
            'showAddVehicleModal()': function() {
                const modal = document.getElementById('addVehicleModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    const form = modal.querySelector('form');
                    if (form) form.reset();
                } else {
                    console.error('addVehicleModal not found');
                }
            },
            
            'showAddDeliveryModal()': function() {
                const modal = document.getElementById('addDeliveryModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    const form = modal.querySelector('form');
                    if (form) form.reset();
                } else {
                    console.error('addDeliveryModal not found');
                }
            },
            
            'showAddRouteModal()': function() {
                const modal = document.getElementById('addRouteModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    const form = modal.querySelector('form');
                    if (form) form.reset();
                } else {
                    console.error('addRouteModal not found');
                }
            },
            
            'showRoutePlanModal()': function() {
                const modal = document.getElementById('routePlanModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                } else {
                    console.error('routePlanModal not found');
                }
            }
        };
        
        // Check if this onclick matches any of our modal handlers
        if (modalHandlers[onclickAttr]) {
            e.preventDefault(); // Prevent default onclick behavior
            modalHandlers[onclickAttr](); // Call our handler
            console.log(`✅ Handled ${onclickAttr} through delegation`);
        }
    }, true); // Use capture phase to intercept before onclick executes
    
})();