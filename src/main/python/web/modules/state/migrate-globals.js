/**
 * Gradual Migration Script for Global Variables
 * This module provides functions to migrate global variables to state store
 */

import { store, storeHelpers } from './store.js';

// Migration functions for each major function in app.js

/**
 * Migrate loadClients function to use state store
 */
export async function loadClients(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/clients/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // OLD: allClients = data.clients || [];
        // NEW: Use state store
        store.set('clients.all', data.clients || []);
        
        if (data.drivers) {
            // OLD: allDrivers = data.drivers;
            // NEW: Use state store
            store.set('drivers.all', data.drivers);
        }
        
        if (data.vehicles) {
            // OLD: allVehicles = data.vehicles;
            // NEW: Use state store
            store.set('vehicles.all', data.vehicles);
        }
        
        // OLD: displayClients(allClients, page);
        // NEW: Get from state
        const clients = store.get('clients.all');
        displayClients(clients, page);
        
        return clients;
    } catch (error) {
        console.error('Error loading clients:', error);
        showErrorMessage('Failed to load clients. Please try again later.');
        return [];
    }
}

/**
 * Migrate filterClients function to use state store
 */
export function filterClients() {
    // OLD: Direct access to globals
    // const searchTerm = document.getElementById('clientSearch').value.toLowerCase();
    // const statusFilter = document.getElementById('clientStatusFilter').value;
    // const cityFilter = document.getElementById('clientCityFilter').value;
    
    // NEW: Update state first
    const searchTerm = document.getElementById('clientSearch').value.toLowerCase();
    const statusFilter = document.getElementById('clientStatusFilter').value;
    const cityFilter = document.getElementById('clientCityFilter').value;
    
    // Update filters in state
    store.update({
        'clients.filters.search': searchTerm,
        'clients.filters.status': statusFilter,
        'clients.filters.city': cityFilter
    });
    
    // Get data from state
    const clients = store.get('clients.all');
    const filters = store.get('clients.filters');
    
    let filteredClients = clients.filter(client => {
        const matchesSearch = !filters.search || 
            client.name.toLowerCase().includes(filters.search) ||
            client.code.toLowerCase().includes(filters.search) ||
            (client.address && client.address.toLowerCase().includes(filters.search));
        
        const matchesStatus = filters.status === 'all' || client.status === filters.status;
        const matchesCity = filters.city === 'all' || client.city === filters.city;
        
        return matchesSearch && matchesStatus && matchesCity;
    });
    
    // Apply sorting from state
    const sortBy = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'asc';
    
    filteredClients.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];
        
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        if (sortOrder === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
    });
    
    // OLD: currentClientPage = 1;
    // NEW: Use state store
    store.set('navigation.currentClientPage', 1);
    
    displayClients(filteredClients, 1);
}

/**
 * Migrate navigateTo function to use state store
 */
export function navigateTo(page) {
    // OLD: currentPage = page;
    // NEW: Use state store
    store.set('navigation.currentPage', page);
    
    // Update UI
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[onclick="navigateTo('${page}')"]`)?.classList.add('active');
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    const targetSection = document.getElementById(`${page}-section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Load content based on page
    const currentPageValue = store.get('navigation.currentPage');
    switch (currentPageValue) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'clients':
            loadClients();
            break;
        case 'deliveries':
            loadDeliveries();
            break;
        case 'routes':
            loadRoutes();
            break;
    }
}

/**
 * Migrate switchDeliveryTab function to use state store
 */
export function switchDeliveryTab(tab) {
    // OLD: currentDeliveryTab = tab;
    // NEW: Use state store
    store.set('navigation.currentDeliveryTab', tab);
    
    // Update localStorage
    localStorage.setItem(window.APP_CONFIG?.STORAGE_KEYS?.CURRENT_TAB || 'currentDeliveryTab', tab);
    
    // Update tab UI
    document.querySelectorAll('.delivery-tabs button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.delivery-tabs button[onclick="switchDeliveryTab('${tab}')"]`)?.classList.add('active');
    
    // Reset page to 1
    // OLD: currentDeliveryPage = 1;
    // NEW: Use state store
    store.set('navigation.currentDeliveryPage', 1);
    
    // Reload deliveries for the selected tab
    loadDeliveries(1);
}

/**
 * Migrate loadDeliveries function to use state store
 */
export async function loadDeliveries(page = 1) {
    // OLD: if (isLoadingDeliveries) return;
    // NEW: Check state store
    if (store.get('deliveries.isLoading')) return;
    
    // OLD: isLoadingDeliveries = true;
    // NEW: Use state store
    store.set('deliveries.isLoading', true);
    
    try {
        // Get current tab from state
        const currentTab = store.get('navigation.currentDeliveryTab');
        
        const params = new URLSearchParams({
            page: page,
            page_size: 10,
            tab: currentTab
        });
        
        const response = await fetch(`${API_BASE}/deliveries/?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // OLD: allDeliveries = data.deliveries || [];
        // NEW: Use state store
        store.set('deliveries.all', data.deliveries || []);
        
        // Update pagination info in state if needed
        store.set('navigation.currentDeliveryPage', page);
        
        // Display deliveries from state
        const deliveries = store.get('deliveries.all');
        displayDeliveries(deliveries, page, data.pages || 1);
        
        if (typeof updateDeliverySummary === 'function') {
            updateDeliverySummary(deliveries);
        }
        
    } catch (error) {
        console.error('Error loading deliveries:', error);
        showErrorMessage('Failed to load deliveries. Please try again later.');
    } finally {
        // OLD: isLoadingDeliveries = false;
        // NEW: Use state store
        store.set('deliveries.isLoading', false);
    }
}

/**
 * Migrate updateClientFilters to use state store
 */
export function updateClientFilters(filterType, value) {
    // Update specific filter in state
    const filterPath = `clients.filters.${filterType}`;
    store.set(filterPath, value);
    
    // If it's a sort operation, also update sort order
    if (filterType === 'sortBy') {
        const currentOrder = store.get('clients.filters.sortOrder');
        // Toggle order if same column clicked
        if (value === store.get('clients.filters.sortBy')) {
            store.set('clients.filters.sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
        }
    }
    
    // Apply filters
    filterClients();
}

/**
 * Migrate addClientToRoute to use state store
 */
export function addClientToRoute(clientCode) {
    // Get current selected clients from state
    const selectedClients = store.get('routes.selectedClients') || [];
    
    // Check if already selected
    if (selectedClients.find(c => c.code === clientCode)) {
        return;
    }
    
    // Find client in state
    const allClients = store.get('clients.all');
    const client = allClients.find(c => c.code === clientCode);
    
    if (client) {
        // OLD: selectedRouteClients.push(client);
        // NEW: Update state store
        const newSelected = [...selectedClients, client];
        store.set('routes.selectedClients', newSelected);
        
        // Update UI
        updateSelectedClientsDisplay();
        updateAvailableClientsDisplay();
    }
}

/**
 * Migrate removeClientFromRoute to use state store
 */
export function removeClientFromRoute(clientCode) {
    // Get current selected clients from state
    const selectedClients = store.get('routes.selectedClients') || [];
    
    // OLD: selectedRouteClients = selectedRouteClients.filter(c => c.code !== clientCode);
    // NEW: Update state store
    const newSelected = selectedClients.filter(c => c.code !== clientCode);
    store.set('routes.selectedClients', newSelected);
    
    // Update UI
    updateSelectedClientsDisplay();
    updateAvailableClientsDisplay();
}

/**
 * Migrate modal state management
 */
export function showModal(modalId) {
    // Update modal state in store
    const modalPath = `ui.modals.${modalId}`;
    store.set(modalPath, true);
    
    // Show modal in DOM
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

export function closeModal(modalId) {
    // Update modal state in store
    const modalPath = `ui.modals.${modalId}`;
    store.set(modalPath, false);
    
    // Hide modal in DOM
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Export all migrated functions as a module
 */
export const migratedFunctions = {
    loadClients,
    filterClients,
    navigateTo,
    switchDeliveryTab,
    loadDeliveries,
    updateClientFilters,
    addClientToRoute,
    removeClientFromRoute,
    showModal,
    closeModal
};

/**
 * Helper to replace global function references in app.js
 */
export function installMigratedFunctions() {
    // Replace window functions with migrated versions
    Object.entries(migratedFunctions).forEach(([name, func]) => {
        window[name] = func;
    });
    
    console.log('Migrated functions installed successfully');
}

export default migratedFunctions;