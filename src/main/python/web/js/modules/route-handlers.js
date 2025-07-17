/**
 * Route Handlers Module
 * Contains all route planning and management functions
 * Functions: loadRoutes, viewRoute, editRoute, showRouteMap, etc.
 */

(function() {
    'use strict';
    
    // Initialize route date filters
    function setupRouteDateDefaults() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        const fromDate = lastWeek.toISOString().split('T')[0];
        const toDate = tomorrow.toISOString().split('T')[0];
        
        const fromInput = document.getElementById('route-date-from');
        const toInput = document.getElementById('route-date-to');
        
        if (fromInput) {
            fromInput.value = fromDate;
            routeFilters.dateFrom = fromDate;
        }
        if (toInput) {
            toInput.value = toDate;
            routeFilters.dateTo = toDate;
        }
    }
    
    // Load routes
    async function loadRoutes(page = 1) {
        // Setup date defaults if not set
        if (!routeFilters.dateFrom || !routeFilters.dateTo) {
            setupRouteDateDefaults();
        }
        
        // Build query parameters
        const params = new URLSearchParams({
            skip: (page - 1) * 10,
            limit: 10
        });
        
        if (routeFilters.dateFrom) params.append('start_date', routeFilters.dateFrom);
        if (routeFilters.dateTo) params.append('end_date', routeFilters.dateTo);
        if (routeFilters.area) params.append('area', routeFilters.area);
        if (routeFilters.driverId) params.append('driver_id', routeFilters.driverId);
        
        const data = await api.get(`/routes?${params}`);
        allRoutes = data.items || [];
        currentRoutePage = page;
        
        // Load drivers for filter
        await loadDriversForFilter('route-driver');
        
        displayRoutes(allRoutes);
        updateRoutePagination(data.total, data.page, data.page_size);
    }
    
    // Filter routes
    async function filterRoutes() {
        // Get filter values
        routeFilters.dateFrom = document.getElementById('route-date-from').value;
        routeFilters.dateTo = document.getElementById('route-date-to').value;
        routeFilters.area = document.getElementById('route-area').value;
        routeFilters.driverId = document.getElementById('route-driver').value;
        
        // Reload routes with filters
        await loadRoutes(1);
    }
    
    // View route details
    async function viewRoute(routeId) {
        try {
            const response = await fetch(`${API_BASE}/routes/${routeId}`);
            if (!response.ok) throw new Error('Failed to fetch route');
            
            const route = await response.json();
            
            const modal = document.getElementById('routeDetailsModal');
            const content = document.getElementById('route-details-content');
            
            if (!modal || !content) return;
            
            content.innerHTML = `
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-600">路線名稱</p>
                            <p class="font-medium">${route.route_name}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">日期</p>
                            <p class="font-medium">${formatDate(route.route_date)}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">區域</p>
                            <p class="font-medium">${route.area}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">狀態</p>
                            <p class="font-medium">${route.is_optimized ? '已優化' : '手動建立'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">司機</p>
                            <p class="font-medium">${route.driver_name || '-'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">車輛</p>
                            <p class="font-medium">${route.vehicle_plate || '-'} ${route.vehicle_type ? `(${route.vehicle_type})` : ''}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">總客戶數</p>
                            <p class="font-medium">${route.total_clients}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">總距離</p>
                            <p class="font-medium">${route.total_distance_km.toFixed(1)} km</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">預估時間</p>
                            <p class="font-medium">${Math.floor(route.estimated_duration_minutes / 60)}小時${route.estimated_duration_minutes % 60}分鐘</p>
                        </div>
                        ${route.optimization_score ? `
                        <div>
                            <p class="text-sm text-gray-600">優化分數</p>
                            <p class="font-medium">${(route.optimization_score * 100).toFixed(0)}%</p>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${route.route_points && route.route_points.length > 0 ? `
                    <div class="border-t pt-4">
                        <h4 class="font-semibold mb-3">路線點詳情</h4>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">順序</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">客戶</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">預計到達</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">服務時間</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">距離</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    ${route.route_points.map(point => `
                                        <tr>
                                            <td class="px-4 py-2 text-sm">${point.sequence}</td>
                                            <td class="px-4 py-2 text-sm">
                                                <div>
                                                    <p class="font-medium">${point.client_name}</p>
                                                    <p class="text-gray-500">${point.client_code}</p>
                                                </div>
                                            </td>
                                            <td class="px-4 py-2 text-sm">${point.address}</td>
                                            <td class="px-4 py-2 text-sm">${new Date(point.estimated_arrival).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td class="px-4 py-2 text-sm">${point.service_time} 分鐘</td>
                                            <td class="px-4 py-2 text-sm">${point.distance_from_previous ? `${point.distance_from_previous.toFixed(1)} km` : '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            
        } catch (error) {
            console.error('Error viewing route:', error);
            showNotification('載入路線詳情失敗', 'error');
        }
    }
    
    // Edit route - placeholder for future implementation
    async function editRoute(routeId) {
        // Complex function to be implemented later
        console.log('Edit route:', routeId);
    }
    
    // Show route map - placeholder for future implementation  
    async function showRouteMap(routeId) {
        // Complex map display function to be implemented later
        console.log('Show route map:', routeId);
    }
    
    // Show route planning modal
    async function showRoutePlanModal() {
        const modal = document.getElementById('routePlanModal');
        if (!modal) return;
        
        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        modal.querySelector('input[name="delivery_date"]').value = tomorrow.toISOString().split('T')[0];
        
        // Load available drivers and vehicles
        await loadAvailableDriversAndVehicles();
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    
    // Show manual route creation modal
    async function showAddRouteModal() {
        const modal = document.getElementById('addRouteModal');
        if (!modal) return;
        
        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        modal.querySelector('input[name="route_date"]').value = tomorrow.toISOString().split('T')[0];
        
        // Load drivers and vehicles
        await loadDriversAndVehiclesForRoute();
        
        // Load available clients
        await loadAvailableClients();
        
        // Reset selected clients
        selectedRouteClients = [];
        updateSelectedClientsDisplay();
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    
    // Add client to route
    function addClientToRoute(clientId, clientCode, clientName, clientAddress) {
        // Check if already selected
        if (selectedRouteClients.find(c => c.id === clientId)) {
            showNotification('客戶已在路線中', 'warning');
            return;
        }
        
        selectedRouteClients.push({
            id: clientId,
            code: clientCode,
            name: clientName,
            address: clientAddress
        });
        
        updateSelectedClientsDisplay();
    }
    
    // Remove client from route
    function removeClientFromRoute(index) {
        selectedRouteClients.splice(index, 1);
        updateSelectedClientsDisplay();
    }
    
    // Update selected clients display
    function updateSelectedClientsDisplay() {
        const container = document.getElementById('selected-clients');
        const countElement = document.getElementById('selected-clients-count');
        
        if (container) {
            container.innerHTML = selectedRouteClients.map((client, index) => `
                <div class="p-2 hover:bg-gray-50 border-b flex justify-between items-center">
                    <div class="flex-1">
                        <p class="font-medium text-sm">${index + 1}. ${client.code} - ${client.name}</p>
                        <p class="text-xs text-gray-600">${client.address}</p>
                    </div>
                    <button onclick="removeClientFromRoute(${index})" 
                            class="text-red-600 hover:text-red-800 p-1">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
        
        if (countElement) {
            countElement.textContent = selectedRouteClients.length;
        }
    }
    
    // Load available clients for route
    async function loadAvailableClients() {
        try {
            const response = await fetch(`${API_BASE}/clients?is_active=true&page_size=100`);
            const data = await response.json();
            const clients = data.items || [];
            
            displayAvailableClients(clients);
            
            // Setup client search
            const searchInput = document.getElementById('route-client-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    const filtered = clients.filter(client => 
                        client.name.toLowerCase().includes(searchTerm) ||
                        client.code.toLowerCase().includes(searchTerm) ||
                        client.address.toLowerCase().includes(searchTerm)
                    );
                    displayAvailableClients(filtered);
                });
            }
        } catch (error) {
            console.error('Error loading clients:', error);
            showNotification('載入客戶資料失敗', 'error');
        }
    }
    
    // Display available clients for selection
    function displayAvailableClients(clients) {
        const container = document.getElementById('available-clients');
        if (!container) return;
        
        container.innerHTML = clients.map(client => `
            <div class="p-2 hover:bg-gray-50 border-b cursor-pointer" 
                 onclick="addClientToRoute('${client.id}', '${client.code}', '${client.name}', '${client.address}')">
                <p class="font-medium text-sm">${client.code} - ${client.name}</p>
                <p class="text-xs text-gray-600">${client.address}</p>
            </div>
        `).join('') || '<p class="p-4 text-gray-500 text-center">沒有可用的客戶</p>';
    }
    
    // Load available drivers and vehicles for route planning
    async function loadAvailableDriversAndVehicles() {
        try {
            // Load drivers
            const driversResponse = await fetch(`${API_BASE}/drivers?is_available=true`);
            const driversData = await driversResponse.json();
            const drivers = driversData.items || [];
            
            const driversContainer = document.getElementById('route-plan-drivers');
            if (driversContainer) {
                driversContainer.innerHTML = drivers.map(driver => `
                    <label class="flex items-center mb-2">
                        <input type="checkbox" name="driver_ids" value="${driver.id}" class="mr-2">
                        <span>${driver.name}</span>
                    </label>
                `).join('') || '<p class="text-gray-500">沒有可用的司機</p>';
            }
            
            // Load vehicles
            const vehiclesResponse = await fetch(`${API_BASE}/vehicles?is_available=true`);
            const vehiclesData = await vehiclesResponse.json();
            const vehicles = vehiclesData.items || [];
            
            const vehiclesContainer = document.getElementById('route-plan-vehicles');
            if (vehiclesContainer) {
                vehiclesContainer.innerHTML = vehicles.map(vehicle => `
                    <label class="flex items-center mb-2">
                        <input type="checkbox" name="vehicle_ids" value="${vehicle.id}" class="mr-2">
                        <span>${vehicle.plate_number} - ${vehicle.vehicle_type}</span>
                    </label>
                `).join('') || '<p class="text-gray-500">沒有可用的車輛</p>';
            }
            
        } catch (error) {
            console.error('Error loading drivers and vehicles:', error);
            showNotification('載入資源失敗', 'error');
        }
    }
    
    // Delete route
    async function deleteRoute(routeId) {
        if (!confirm('確定要刪除這條路線嗎？')) return;
        
        await api.delete(`/routes/${routeId}`);
        await loadRoutes(currentRoutePage);
    }
    
    // Export route handlers
    window.routeHandlers = {
        setupRouteDateDefaults,
        loadRoutes,
        filterRoutes,
        viewRoute,
        editRoute,
        showRouteMap,
        showRoutePlanModal,
        showAddRouteModal,
        addClientToRoute,
        removeClientFromRoute,
        updateSelectedClientsDisplay,
        loadAvailableClients,
        displayAvailableClients,
        loadAvailableDriversAndVehicles,
        deleteRoute
    };
    
    // Also export individually for backward compatibility
    window.setupRouteDateDefaults = setupRouteDateDefaults;
    window.loadRoutes = loadRoutes;
    window.filterRoutes = filterRoutes;
    window.viewRoute = viewRoute;
    window.editRoute = editRoute;
    window.showRouteMap = showRouteMap;
    window.showRoutePlanModal = showRoutePlanModal;
    window.showAddRouteModal = showAddRouteModal;
    window.addClientToRoute = addClientToRoute;
    window.removeClientFromRoute = removeClientFromRoute;
    window.updateSelectedClientsDisplay = updateSelectedClientsDisplay;
    window.loadAvailableClients = loadAvailableClients;
    window.displayAvailableClients = displayAvailableClients;
    window.loadAvailableDriversAndVehicles = loadAvailableDriversAndVehicles;
    window.deleteRoute = deleteRoute;
    
    console.log('✅ Route Handlers module loaded');
})();