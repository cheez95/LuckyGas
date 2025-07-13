// API Base URL
const API_BASE = 'http://localhost:8000/api';

// State
let currentPage = 'dashboard';
let currentClientPage = 1;
let currentDeliveryPage = 1;
let allClients = [];
let allDrivers = [];
let allVehicles = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    loadDashboard();
    setupFormHandlers();
});

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.target.getAttribute('href').substring(1);
            showSection(section);
        });
    });
}

function showSection(section) {
    // Hide all sections
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    
    // Show selected section
    const sectionElement = document.getElementById(section);
    if (sectionElement) {
        sectionElement.classList.remove('hidden');
        currentPage = section;
        
        // Load section data
        switch(section) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'clients':
                loadClients();
                break;
            case 'drivers':
                loadDrivers();
                break;
            case 'vehicles':
                loadVehicles();
                break;
            case 'deliveries':
                loadDeliveries();
                break;
        }
    }
}

// Dashboard
async function loadDashboard() {
    try {
        // Load statistics
        const [clientsRes, deliveriesRes, driversRes, vehiclesRes] = await Promise.all([
            fetch(`${API_BASE}/clients`),
            fetch(`${API_BASE}/deliveries/today/summary`),
            fetch(`${API_BASE}/drivers`),
            fetch(`${API_BASE}/vehicles`)
        ]);

        const clients = await clientsRes.json();
        const todaySummary = await deliveriesRes.json();
        const drivers = await driversRes.json();
        const vehicles = await vehiclesRes.json();

        // Update statistics
        document.getElementById('total-clients').textContent = clients.total || 0;
        document.getElementById('today-deliveries').textContent = todaySummary.total_deliveries || 0;
        document.getElementById('available-drivers').textContent = drivers.items?.filter(d => d.is_available).length || 0;
        document.getElementById('available-vehicles').textContent = vehicles.items?.filter(v => v.is_active).length || 0;

        // Load charts
        loadDeliveryChart();
        loadStatusChart(todaySummary);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('載入儀表板失敗', 'error');
    }
}

function loadDeliveryChart() {
    const ctx = document.getElementById('deliveryChart').getContext('2d');
    
    // Sample data for weekly deliveries
    const dates = [];
    const counts = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }));
        counts.push(Math.floor(Math.random() * 50) + 10);
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: '配送數量',
                data: counts,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function loadStatusChart(summary) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    const statusData = summary.status_summary || {
        pending: 0,
        assigned: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0
    };

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['待處理', '已指派', '配送中', '已完成', '已取消'],
            datasets: [{
                data: [
                    statusData.pending || 0,
                    statusData.assigned || 0,
                    statusData.in_progress || 0,
                    statusData.completed || 0,
                    statusData.cancelled || 0
                ],
                backgroundColor: [
                    'rgb(251, 191, 36)',
                    'rgb(59, 130, 246)',
                    'rgb(34, 197, 94)',
                    'rgb(16, 185, 129)',
                    'rgb(239, 68, 68)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Clients
async function loadClients(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/clients?page=${page}&page_size=10`);
        const data = await response.json();
        
        allClients = data.items || [];
        
        // Load districts
        const districtsRes = await fetch(`${API_BASE}/clients/districts/list`);
        const districts = await districtsRes.json();
        
        const districtSelect = document.getElementById('client-district');
        districtSelect.innerHTML = '<option value="">所有區域</option>';
        districts.forEach(district => {
            districtSelect.innerHTML += `<option value="${district}">${district}</option>`;
        });
        
        // Render table
        const tbody = document.getElementById('clients-tbody');
        tbody.innerHTML = '';
        
        allClients.forEach(client => {
            const row = `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${client.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${client.name || client.invoice_title || '-'}</td>
                    <td class="px-6 py-4 text-sm">${client.address}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${client.district || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs rounded-full ${client.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${client.is_active ? '啟用' : '停用'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button onclick="editClient(${client.id})" class="text-blue-600 hover:text-blue-900 mr-2">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteClient(${client.id})" class="text-red-600 hover:text-red-900">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
        
        // Update pagination
        document.getElementById('clients-showing').textContent = data.items?.length || 0;
        document.getElementById('clients-total').textContent = data.total || 0;
        
        updatePagination('clients', data.page, data.total_pages);
    } catch (error) {
        console.error('Error loading clients:', error);
        showNotification('載入客戶資料失敗', 'error');
    }
}

// Drivers
async function loadDrivers() {
    try {
        const response = await fetch(`${API_BASE}/drivers`);
        const data = await response.json();
        
        allDrivers = data.items || [];
        
        // Render table
        const tbody = document.getElementById('drivers-tbody');
        tbody.innerHTML = '';
        
        allDrivers.forEach(driver => {
            const row = `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${driver.employee_id}</td>
                    <td class="px-6 py-4 whitespace-nowrap">${driver.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${driver.phone}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${driver.license_type}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs rounded-full ${driver.is_available ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${driver.is_available ? '可用' : '忙碌'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${driver.deliveries_today || 0}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button onclick="toggleDriverAvailability(${driver.id})" class="text-blue-600 hover:text-blue-900 mr-2">
                            <i class="fas fa-${driver.is_available ? 'pause' : 'play'}"></i>
                        </button>
                        <button onclick="viewDriverDeliveries(${driver.id})" class="text-green-600 hover:text-green-900">
                            <i class="fas fa-list"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
        
        // Update delivery driver select
        const driverSelect = document.getElementById('delivery-driver');
        driverSelect.innerHTML = '<option value="">所有司機</option>';
        allDrivers.forEach(driver => {
            driverSelect.innerHTML += `<option value="${driver.id}">${driver.name}</option>`;
        });
    } catch (error) {
        console.error('Error loading drivers:', error);
        showNotification('載入司機資料失敗', 'error');
    }
}

// Vehicles
async function loadVehicles() {
    try {
        const response = await fetch(`${API_BASE}/vehicles`);
        const data = await response.json();
        
        allVehicles = data.items || [];
        
        // Render table
        const tbody = document.getElementById('vehicles-tbody');
        tbody.innerHTML = '';
        
        allVehicles.forEach(vehicle => {
            const vehicleTypeMap = {
                'truck': '貨車',
                'van': '廂型車',
                'motorcycle': '機車'
            };
            
            const row = `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${vehicle.plate_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${vehicleTypeMap[vehicle.vehicle_type] || vehicle.vehicle_type}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${vehicle.brand} ${vehicle.model}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${vehicle.max_load_kg} kg</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs rounded-full ${vehicle.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${vehicle.is_active ? '可用' : '維修中'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${formatDate(vehicle.next_maintenance_date)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button onclick="editVehicle(${vehicle.id})" class="text-blue-600 hover:text-blue-900 mr-2">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="toggleVehicleStatus(${vehicle.id})" class="text-orange-600 hover:text-orange-900">
                            <i class="fas fa-tools"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error('Error loading vehicles:', error);
        showNotification('載入車輛資料失敗', 'error');
    }
}

// Deliveries
async function loadDeliveries(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/deliveries?page=${page}&page_size=10`);
        const data = await response.json();
        
        // Render table
        const tbody = document.getElementById('deliveries-tbody');
        tbody.innerHTML = '';
        
        const deliveries = data.items || [];
        deliveries.forEach(delivery => {
            const statusMap = {
                'pending': { text: '待處理', class: 'bg-yellow-100 text-yellow-800' },
                'assigned': { text: '已指派', class: 'bg-blue-100 text-blue-800' },
                'in_progress': { text: '配送中', class: 'bg-purple-100 text-purple-800' },
                'completed': { text: '已完成', class: 'bg-green-100 text-green-800' },
                'cancelled': { text: '已取消', class: 'bg-red-100 text-red-800' }
            };
            
            const status = statusMap[delivery.status] || { text: delivery.status, class: 'bg-gray-100 text-gray-800' };
            
            const row = `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${delivery.order_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${delivery.client_name || '-'}</td>
                    <td class="px-6 py-4 text-sm">${delivery.delivery_address}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${formatDate(delivery.scheduled_date)}<br>${delivery.scheduled_time_slot || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs rounded-full ${status.class}">
                            ${status.text}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${delivery.driver_name || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        ${delivery.status === 'pending' ? `
                            <button onclick="assignDelivery(${delivery.id})" class="text-blue-600 hover:text-blue-900 mr-2">
                                <i class="fas fa-user-plus"></i>
                            </button>
                        ` : ''}
                        <button onclick="viewDelivery(${delivery.id})" class="text-green-600 hover:text-green-900">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error('Error loading deliveries:', error);
        showNotification('載入配送單失敗', 'error');
    }
}

// Form Handlers
function setupFormHandlers() {
    // Add Client Form
    document.getElementById('addClientForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            address: formData.get('address'),
            contact_person: formData.get('contact_person') || null,
            tax_id: formData.get('tax_id') || null,
            is_corporate: formData.get('is_corporate') ? true : false
        };
        
        try {
            const response = await fetch(`${API_BASE}/clients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                showNotification('客戶新增成功', 'success');
                closeModal('addClientModal');
                e.target.reset();
                loadClients();
            } else {
                const error = await response.json();
                showNotification(`新增失敗: ${error.detail}`, 'error');
            }
        } catch (error) {
            showNotification('新增失敗', 'error');
        }
    });
    
    // Add Driver Form
    document.getElementById('addDriverForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        data.base_salary = parseInt(data.base_salary);
        data.commission_rate = parseInt(data.commission_rate);
        
        try {
            const response = await fetch(`${API_BASE}/drivers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                showNotification('司機新增成功', 'success');
                closeModal('addDriverModal');
                e.target.reset();
                loadDrivers();
            } else {
                const error = await response.json();
                showNotification(`新增失敗: ${error.detail}`, 'error');
            }
        } catch (error) {
            showNotification('新增失敗', 'error');
        }
    });
    
    // Add Vehicle Form
    document.getElementById('addVehicleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        data.year = parseInt(data.year);
        data.max_load_kg = parseInt(data.max_load_kg);
        data.max_cylinders = parseInt(data.max_cylinders);
        data.purchase_price = parseInt(data.purchase_price);
        
        try {
            const response = await fetch(`${API_BASE}/vehicles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                showNotification('車輛新增成功', 'success');
                closeModal('addVehicleModal');
                e.target.reset();
                loadVehicles();
            } else {
                const error = await response.json();
                showNotification(`新增失敗: ${error.detail}`, 'error');
            }
        } catch (error) {
            showNotification('新增失敗', 'error');
        }
    });
    
    // Add Delivery Form
    document.getElementById('addDeliveryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            client_id: parseInt(formData.get('client_id')),
            scheduled_date: formData.get('scheduled_date'),
            scheduled_time_slot: formData.get('scheduled_time_slot') || null,
            gas_quantity: parseInt(formData.get('gas_quantity')),
            unit_price: parseInt(formData.get('unit_price')),
            delivery_fee: parseInt(formData.get('delivery_fee') || 0),
            delivery_address: formData.get('delivery_address'),
            delivery_district: formData.get('delivery_district') || null,
            payment_method: formData.get('payment_method'),
            notes: formData.get('notes') || null,
            requires_empty_cylinder_return: formData.get('requires_empty_cylinder_return') ? true : false,
            empty_cylinders_to_return: parseInt(formData.get('empty_cylinders_to_return') || 0)
        };
        
        try {
            const response = await fetch(`${API_BASE}/deliveries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                showNotification('配送單新增成功', 'success');
                closeModal('addDeliveryModal');
                e.target.reset();
                loadDeliveries();
            } else {
                const error = await response.json();
                showNotification(`新增失敗: ${error.detail}`, 'error');
            }
        } catch (error) {
            showNotification('新增失敗', 'error');
        }
    });
}

// Modal Functions
function showAddClientModal() {
    document.getElementById('addClientModal').style.display = 'flex';
}

function showAddDriverModal() {
    document.getElementById('addDriverModal').style.display = 'flex';
}

function showAddVehicleModal() {
    document.getElementById('addVehicleModal').style.display = 'flex';
}

async function showAddDeliveryModal() {
    // Load clients for select
    const clientSelect = document.querySelector('#addDeliveryForm select[name="client_id"]');
    clientSelect.innerHTML = '<option value="">請選擇客戶</option>';
    
    try {
        const response = await fetch(`${API_BASE}/clients?page_size=100`);
        const data = await response.json();
        
        data.items.forEach(client => {
            clientSelect.innerHTML += `<option value="${client.id}">${client.name || client.invoice_title} - ${client.address}</option>`;
        });
    } catch (error) {
        console.error('Error loading clients:', error);
    }
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.querySelector('#addDeliveryForm input[name="scheduled_date"]').value = tomorrow.toISOString().split('T')[0];
    
    document.getElementById('addDeliveryModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Utility Functions
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW');
}

function updatePagination(section, currentPage, totalPages) {
    const container = document.getElementById(`${section}-pagination`);
    if (!container) return;
    
    container.innerHTML = '';
    
    // Previous button
    if (currentPage > 1) {
        container.innerHTML += `
            <button onclick="load${capitalize(section)}(${currentPage - 1})" 
                    class="px-3 py-1 border rounded hover:bg-gray-100">
                上一頁
            </button>
        `;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            container.innerHTML += `
                <button class="px-3 py-1 border rounded bg-blue-600 text-white">
                    ${i}
                </button>
            `;
        } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            container.innerHTML += `
                <button onclick="load${capitalize(section)}(${i})" 
                        class="px-3 py-1 border rounded hover:bg-gray-100">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            container.innerHTML += `<span class="px-2">...</span>`;
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        container.innerHTML += `
            <button onclick="load${capitalize(section)}(${currentPage + 1})" 
                    class="px-3 py-1 border rounded hover:bg-gray-100">
                下一頁
            </button>
        `;
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded shadow-lg text-white ${
        type === 'success' ? 'bg-green-600' : 
        type === 'error' ? 'bg-red-600' : 
        'bg-blue-600'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Additional Functions
async function toggleDriverAvailability(driverId) {
    try {
        const response = await fetch(`${API_BASE}/drivers/${driverId}/toggle-availability`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            showNotification('司機狀態已更新', 'success');
            loadDrivers();
        }
    } catch (error) {
        showNotification('更新失敗', 'error');
    }
}

async function viewDriverDeliveries(driverId) {
    try {
        const response = await fetch(`${API_BASE}/drivers/${driverId}/deliveries`);
        const deliveries = await response.json();
        
        // Show deliveries in a modal or navigate to deliveries page with filter
        showNotification(`司機有 ${deliveries.length} 筆配送記錄`, 'info');
    } catch (error) {
        showNotification('查詢失敗', 'error');
    }
}

function searchClients() {
    const keyword = document.getElementById('client-search').value;
    const district = document.getElementById('client-district').value;
    
    // Filter clients
    loadClients(1); // For now, just reload
}

function searchDeliveries() {
    const date = document.getElementById('delivery-date').value;
    const status = document.getElementById('delivery-status').value;
    const driverId = document.getElementById('delivery-driver').value;
    
    // Filter deliveries
    loadDeliveries(1); // For now, just reload
}

async function assignDelivery(deliveryId) {
    // In a real app, show a modal to select driver and vehicle
    const driverId = prompt('請輸入司機ID:');
    const vehicleId = prompt('請輸入車輛ID:');
    
    if (driverId && vehicleId) {
        try {
            const response = await fetch(`${API_BASE}/deliveries/${deliveryId}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    driver_id: parseInt(driverId),
                    vehicle_id: parseInt(vehicleId)
                })
            });
            
            if (response.ok) {
                showNotification('配送單已指派', 'success');
                loadDeliveries();
            } else {
                showNotification('指派失敗', 'error');
            }
        } catch (error) {
            showNotification('指派失敗', 'error');
        }
    }
}

function viewDelivery(deliveryId) {
    // In a real app, show delivery details in a modal
    showNotification(`查看配送單 #${deliveryId}`, 'info');
}

// Placeholder functions
function editClient(id) {
    showNotification('編輯功能開發中', 'info');
}

function deleteClient(id) {
    if (confirm('確定要刪除此客戶嗎？')) {
        showNotification('刪除功能開發中', 'info');
    }
}

function editVehicle(id) {
    showNotification('編輯功能開發中', 'info');
}

function toggleVehicleStatus(id) {
    showNotification('維修狀態切換功能開發中', 'info');
}