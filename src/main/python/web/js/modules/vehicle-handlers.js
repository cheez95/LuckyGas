/**
 * Vehicle Handlers Module
 * Contains all vehicle-related functions
 * Functions: loadVehicles, editVehicle, addVehicle, updateVehicle, deleteVehicle
 */

(function() {
    'use strict';
    
    // Vehicle management functions will be moved from app.js
    async function loadVehicles(page = 1) {
        // Will be moved from app.js
    }
    
    function editVehicle(vehicleId) {
        // Will be moved from app.js
    }
    
    function showAddVehicleModal() {
        // Will be moved from app.js
    }
    
    async function addVehicle() {
        // Will be moved from app.js
    }
    
    async function updateVehicle(vehicleId) {
        // Will be moved from app.js
    }
    
    async function deleteVehicle(vehicleId) {
        // Will be moved from app.js
    }
    
    // Export vehicle handlers
    window.vehicleHandlers = {
        loadVehicles,
        editVehicle,
        showAddVehicleModal,
        addVehicle,
        updateVehicle,
        deleteVehicle
    };
    
    // Also export individually for backward compatibility
    window.loadVehicles = loadVehicles;
    window.editVehicle = editVehicle;
    window.showAddVehicleModal = showAddVehicleModal;
    window.addVehicle = addVehicle;
    window.updateVehicle = updateVehicle;
    window.deleteVehicle = deleteVehicle;
    
    console.log('✅ Vehicle Handlers module loaded');
})();