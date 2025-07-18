/**
 * Debug script to check modal function availability
 */

// Wait for modules to load
window.addEventListener('modulesLoaded', function() {
    console.log('🔍 Checking modal function availability...');
    
    const modalFunctions = [
        'showAddClientModal',
        'showAddDriverModal',
        'showAddVehicleModal',
        'showAddDeliveryModal',
        'showAddRouteModal',
        'showRoutePlanModal'
    ];
    
    modalFunctions.forEach(funcName => {
        if (window[funcName]) {
            console.log(`✅ ${funcName} is available`);
        } else {
            console.log(`❌ ${funcName} is NOT available`);
        }
    });
    
    // Add click event listeners to debug button clicks
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' && e.target.onclick) {
            console.log('🔘 Button clicked with onclick:', e.target.onclick.toString());
        }
    });
});

// Also check on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded, checking modal functions early...');
    
    setTimeout(() => {
        const modalFunctions = [
            'showAddClientModal',
            'showAddDriverModal',
            'showAddVehicleModal',
            'showAddDeliveryModal',
            'showAddRouteModal',
            'showRoutePlanModal'
        ];
        
        modalFunctions.forEach(funcName => {
            if (window[funcName]) {
                console.log(`✅ [Early check] ${funcName} is available`);
            } else {
                console.log(`❌ [Early check] ${funcName} is NOT available`);
            }
        });
    }, 1000); // Wait a bit for modules to load
});