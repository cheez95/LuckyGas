/**
 * Migration Example - Dashboard
 * Shows how to migrate loadDashboard function to use the new API client
 */

// Import the new API client
import { api, loadingManager } from './index.js';

// BEFORE: Original loadDashboard function
async function loadDashboard_OLD() {
    try {
        // Load dashboard statistics from new endpoint
        const statsRes = await fetch(`${API_BASE}/dashboard/stats`);
        if (!statsRes.ok) {
            throw new Error(`HTTP error! status: ${statsRes.status}`);
        }
        const stats = await statsRes.json();
        
        // Update statistics cards
        document.getElementById('total-clients').textContent = stats.overview?.total_clients || 0;
        document.getElementById('today-deliveries').textContent = stats.today_deliveries?.total || 0;
        document.getElementById('available-drivers').textContent = stats.overview?.available_drivers || 0;
        document.getElementById('available-vehicles').textContent = stats.overview?.available_vehicles || 0;
        
        // Load recent activities from stats
        loadRecentActivitiesFromStats(stats.recent_activities);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('載入儀表板失敗', 'error');
    }
}

// AFTER: Migrated loadDashboard function
async function loadDashboard() {
    const { data: stats, success, error } = await api.dashboard.getStats();
    
    if (success) {
        // Update statistics cards
        document.getElementById('total-clients').textContent = stats.overview?.total_clients || 0;
        document.getElementById('today-deliveries').textContent = stats.today_deliveries?.total || 0;
        document.getElementById('available-drivers').textContent = stats.overview?.available_drivers || 0;
        document.getElementById('available-vehicles').textContent = stats.overview?.available_vehicles || 0;
        
        // Load recent activities from stats
        loadRecentActivitiesFromStats(stats.recent_activities);
    } else {
        console.error('Error loading dashboard:', error);
        showNotification(error.message || '載入儀表板失敗', 'error');
    }
}

// BEFORE: Original loadClients function
async function loadClients_OLD(page = 1) {
    try {
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('page_size', 20);
        
        if (clientFilters.search) params.append('search', clientFilters.search);
        if (clientFilters.district) params.append('district', clientFilters.district);
        if (clientFilters.isActive !== null) params.append('is_active', clientFilters.isActive);
        
        const response = await fetch(`${API_BASE}/clients?${params}`);
        const data = await response.json();
        
        allClients = data.items || [];
        currentClientPage = page;
        
        // Render table
        renderClientsTable(allClients);
        
        // Update pagination
        updatePagination('clients', data.page, data.total_pages, data.total);
        
    } catch (error) {
        console.error('Error loading clients:', error);
        showNotification('載入客戶失敗', 'error');
    }
}

// AFTER: Migrated loadClients function
async function loadClients(page = 1) {
    const { data, success, error } = await api.clients.list({
        page: page,
        page_size: 20,
        search: clientFilters.search,
        district: clientFilters.district,
        is_active: clientFilters.isActive
    });
    
    if (success) {
        allClients = data.items || [];
        currentClientPage = page;
        
        // Render table
        renderClientsTable(allClients);
        
        // Update pagination
        updatePagination('clients', data.page, data.total_pages, data.total);
    } else {
        console.error('Error loading clients:', error);
        showNotification(error.message || '載入客戶失敗', 'error');
    }
}

// BEFORE: Original createDelivery function with parallel fetches
async function createDelivery_OLD(clientCode, deliveryData) {
    try {
        // Load available drivers and vehicles
        const [driversRes, vehiclesRes] = await Promise.all([
            fetch(`${API_BASE}/drivers?is_available=true`),
            fetch(`${API_BASE}/vehicles?is_active=true`)
        ]);
        
        const drivers = await driversRes.json();
        const vehicles = await vehiclesRes.json();
        
        const availableDrivers = drivers.items || [];
        const availableVehicles = vehicles.items || [];
        
        if (availableDrivers.length === 0 || availableVehicles.length === 0) {
            showNotification('沒有可用的司機或車輛', 'error');
            return;
        }
        
        // Create delivery
        const response = await fetch(`${API_BASE}/deliveries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deliveryData)
        });
        
        if (response.ok) {
            showNotification('配送建立成功', 'success');
            loadDeliveries(); // Refresh list
        }
    } catch (error) {
        console.error('Error creating delivery:', error);
        showNotification('建立配送失敗', 'error');
    }
}

// AFTER: Migrated createDelivery function with better error handling
async function createDelivery(clientCode, deliveryData) {
    // Parallel requests with better error handling
    const [driversResult, vehiclesResult] = await Promise.all([
        api.drivers.list({ is_available: true }),
        api.vehicles.list({ is_active: true })
    ]);
    
    if (!driversResult.success || !vehiclesResult.success) {
        showNotification('無法載入司機或車輛資料', 'error');
        return;
    }
    
    const availableDrivers = driversResult.data.items || [];
    const availableVehicles = vehiclesResult.data.items || [];
    
    if (availableDrivers.length === 0 || availableVehicles.length === 0) {
        showNotification('沒有可用的司機或車輛', 'error');
        return;
    }
    
    // Create delivery
    const { success, error } = await api.deliveries.create(deliveryData);
    
    if (success) {
        showNotification('配送建立成功', 'success');
        await loadDeliveries(); // Refresh list
    } else {
        console.error('Error creating delivery:', error);
        showNotification(error.message || '建立配送失敗', 'error');
    }
}

// Example: Loading state management
export function setupLoadingIndicator() {
    // Subscribe to global loading state
    loadingManager.subscribe((state) => {
        const loadingIndicator = document.getElementById('global-loading');
        if (loadingIndicator) {
            if (state.isLoading) {
                loadingIndicator.classList.remove('hidden');
                loadingIndicator.textContent = `Loading: ${state.operation}`;
            } else {
                loadingIndicator.classList.add('hidden');
            }
        }
    });
}

// Example: Export functionality with blob handling
async function exportClients() {
    const { data: blob, success, error } = await api.clients.export({
        // Include current filters
        search: clientFilters.search,
        district: clientFilters.district,
        is_active: clientFilters.isActive
    });
    
    if (success) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showNotification('匯出成功', 'success');
    } else {
        showNotification(error.message || '匯出失敗', 'error');
    }
}

// Example: Form submission with proper error handling
async function handleClientFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const clientData = {
        client_code: formData.get('client_code'),
        name: formData.get('name'),
        district: formData.get('district'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        address: formData.get('address'),
        landmark: formData.get('landmark'),
        floor: formData.get('floor'),
        delivery_notes: formData.get('delivery_notes'),
        is_active: formData.get('is_active') === 'on',
        preferred_delivery_time: formData.get('preferred_delivery_time'),
        delivery_frequency: formData.get('delivery_frequency')
    };
    
    const isEdit = !!clientData.client_code;
    
    const { success, error } = isEdit
        ? await api.clients.update(clientData.client_code, clientData)
        : await api.clients.create(clientData);
    
    if (success) {
        showNotification(isEdit ? '客戶更新成功' : '客戶新增成功', 'success');
        closeModal();
        await loadClients(); // Refresh list
    } else {
        showNotification(error.message || '操作失敗', 'error');
    }
}

// Example: Cache invalidation after update
async function updateDeliveryStatus(deliveryId, newStatus) {
    const { success, error } = await api.deliveries.updateStatus(deliveryId, newStatus);
    
    if (success) {
        // Invalidate related caches
        api.utils.invalidateCache(/deliveries/);
        api.utils.invalidateCache(/dashboard/);
        
        showNotification('狀態更新成功', 'success');
        await loadDeliveries(); // Refresh with fresh data
    } else {
        showNotification(error.message || '狀態更新失敗', 'error');
    }
}