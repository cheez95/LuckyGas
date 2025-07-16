/**
 * Migration Example for app.js
 * Shows how to integrate the new API client into the existing app.js structure
 */

// STEP 1: Add this to the top of app.js after the existing code
// Since app.js doesn't use ES6 modules, we'll load the API client differently

// Option A: If converting to ES6 modules (recommended)
// Add type="module" to the script tag in HTML and then:
/*
import { api, initializeAPI } from './modules/api/index.js';

// Initialize at the start
initializeAPI({
    baseURL: window.APP_CONFIG?.API_BASE || '/api',
    debug: window.APP_CONFIG?.DEBUG || false
});
*/

// Option B: If keeping current structure, load modules as separate scripts in HTML:
/*
<script src="modules/csrf/csrf-manager.js"></script>
<script src="modules/api/client.js"></script>
<script src="modules/api/endpoints.js"></script>
<script src="modules/api/index.js"></script>
*/

// STEP 2: Replace specific fetch calls

// Example 1: Dashboard Stats (line ~443)
// BEFORE:
async function loadDashboardOld() {
    const statsRes = await fetch(`${API_BASE}/dashboard/stats`);
    if (!statsRes.ok) {
        throw new Error(`HTTP error! status: ${statsRes.status}`);
    }
    const stats = await statsRes.json();
}

// AFTER:
async function loadDashboardNew() {
    const stats = await api.dashboard.getStats();
}

// Example 2: Load Clients (line ~725)
// BEFORE:
async function loadClientsOld() {
    const params = new URLSearchParams({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm,
        order_by: sortBy,
        order_desc: sortDesc
    });
    
    const response = await fetch(`${API_BASE}/clients?${params}`);
    const data = await response.json();
    
    allClients = data.items || [];
}

// AFTER:
async function loadClientsNew() {
    const data = await api.clients.list({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm,
        order_by: sortBy,
        order_desc: sortDesc
    });
    
    allClients = data.items || [];
}

// Example 3: Create Client (line ~2473)
// BEFORE:
async function createClientOld() {
    try {
        const response = await secureFetch(`${API_BASE}/clients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            showToast(error.error || '新增客戶失敗', 'error');
            return;
        }
        
        const newClient = await response.json();
        showToast('客戶新增成功', 'success');
    } catch (error) {
        console.error('Error creating client:', error);
        showToast('新增客戶失敗', 'error');
    }
}

// AFTER:
async function createClientNew() {
    try {
        const newClient = await api.clients.create(clientData);
        showToast('客戶新增成功', 'success');
    } catch (error) {
        // Error is shown automatically, but you can add custom handling
    }
}

// Example 4: Update Delivery Status (line ~2299)
// BEFORE:
async function updateDeliveryStatusOld(deliveryId, nextStatus) {
    try {
        const response = await secureFetch(`${API_BASE}/deliveries/${deliveryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: nextStatus.toUpperCase() })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update delivery status');
        }
    } catch (error) {
        console.error('Error updating delivery:', error);
        showNotification('更新失敗', 'error');
    }
}

// AFTER:
async function updateDeliveryStatusNew(deliveryId, nextStatus) {
    await api.deliveries.updateStatus(deliveryId, nextStatus);
    // Success/error notifications are handled automatically
}

// Example 5: Complex Parallel Requests (line ~2331)
// BEFORE:
async function loadModalDataOld() {
    const [driversResponse, vehiclesResponse] = await Promise.all([
        fetch(`${API_BASE}/drivers?is_available=true`),
        fetch(`${API_BASE}/vehicles?is_active=true`)
    ]);
    
    if (!driversResponse.ok || !vehiclesResponse.ok) {
        throw new Error('Failed to load data');
    }
    
    const driversData = await driversResponse.json();
    const vehiclesData = await vehiclesResponse.json();
}

// AFTER:
async function loadModalDataNew() {
    const [driversData, vehiclesData] = await Promise.all([
        api.drivers.getAvailable(),
        api.vehicles.getActive()
    ]);
}

// STEP 3: Update the actual functions in app.js

// For loadDashboard function (around line 437)
function migrateLoadDashboard() {
    // Find this function:
    /*
    async function loadDashboard() {
        try {
            // ... existing code
            const statsRes = await fetch(`${API_BASE}/dashboard/stats`);
            // ...
        }
    }
    */
    
    // Replace the fetch call with:
    // const stats = await api.dashboard.getStats();
}

// For loadClients function (around line 721)
function migrateLoadClients() {
    // Find the fetch call and replace with:
    // const data = await api.clients.list({ ...params });
}

// For recent deliveries (around line 593)
function migrateRecentDeliveries() {
    // Replace:
    // const response = await fetch(`${API_BASE}/deliveries?page_size=5&order_by=created_at&order_desc=true`);
    
    // With:
    // const data = await api.deliveries.getRecent(5);
}

// STEP 4: Gradual Migration Strategy

/*
1. Start by adding the API modules to your HTML
2. Test one function at a time
3. Keep both old and new versions during testing
4. Once confirmed working, remove the old version
5. Migrate similar patterns together
6. Update error handling last (it's automatic with new API)
*/

// STEP 5: Testing the Migration

function testMigration() {
    // Test dashboard stats
    console.log('Testing dashboard stats...');
    api.dashboard.getStats()
        .then(stats => console.log('✅ Dashboard stats:', stats))
        .catch(error => console.error('❌ Dashboard stats error:', error));
    
    // Test client list
    console.log('Testing client list...');
    api.clients.list({ page: 1, page_size: 10 })
        .then(data => console.log('✅ Clients:', data))
        .catch(error => console.error('❌ Clients error:', error));
    
    // Test recent deliveries
    console.log('Testing recent deliveries...');
    api.deliveries.getRecent(5)
        .then(data => console.log('✅ Deliveries:', data))
        .catch(error => console.error('❌ Deliveries error:', error));
}

// Run tests in console:
// testMigration()

// BENEFITS AFTER MIGRATION:
// 1. 50-70% less code
// 2. Automatic error handling
// 3. Automatic CSRF protection
// 4. Automatic retry on failure
// 5. Cleaner, more readable code
// 6. Easier to maintain and update