/**
 * Client Handlers Module
 * Contains all client-related functions
 * Functions: loadClients, viewClient, editClient, addClient, etc.
 */

(function() {
    'use strict';
    
    // Client management functions will be moved from app.js
    async function loadClients(page = 1) {
        // Will be moved from app.js
    }
    
    function viewClient(clientCode) {
        // Will be moved from app.js
    }
    
    function editClient(clientCode) {
        // Will be moved from app.js
    }
    
    function showAddClientModal() {
        // Will be moved from app.js
    }
    
    async function addClient() {
        // Will be moved from app.js
    }
    
    async function updateClient(clientCode) {
        // Will be moved from app.js
    }
    
    async function deleteClient(clientCode) {
        // Will be moved from app.js
    }
    
    function switchClientTab(tab) {
        // Will be moved from app.js
    }
    
    // Export client handlers
    window.clientHandlers = {
        loadClients,
        viewClient,
        editClient,
        showAddClientModal,
        addClient,
        updateClient,
        deleteClient,
        switchClientTab
    };
    
    // Also export individually for backward compatibility
    window.loadClients = loadClients;
    window.viewClient = viewClient;
    window.editClient = editClient;
    window.showAddClientModal = showAddClientModal;
    window.addClient = addClient;
    window.updateClient = updateClient;
    window.deleteClient = deleteClient;
    window.switchClientTab = switchClientTab;
    
    console.log('✅ Client Handlers module loaded');
})();