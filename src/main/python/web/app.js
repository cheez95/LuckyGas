// API Base URL
const API_BASE = 'http://localhost:8000/api';

// State
let currentPage = 'dashboard';
let currentClientPage = 1;
let currentDeliveryPage = 1;
let allClients = [];
let allDrivers = [];
let allVehicles = [];
let allDeliveries = [];

// Filters and sorting
let clientFilters = {
    keyword: '',
    district: '',
    isActive: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
};

let deliveryFilters = {
    dateFrom: '',
    dateTo: '',
    status: '',
    driverId: '',
    clientId: '',
    sortBy: 'scheduled_date',
    sortOrder: 'desc'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupDateDefaults();
    loadDashboard();
    setupFormHandlers();
    setupFilterHandlers();
});

// Setup date defaults
function setupDateDefaults() {
    // Set default date range for deliveries (last 7 days to tomorrow)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    document.getElementById('delivery-date-from').value = lastWeek.toISOString().split('T')[0];
    document.getElementById('delivery-date-to').value = tomorrow.toISOString().split('T')[0];
}

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
        
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('text-blue-200', 'font-bold');
            if (link.getAttribute('href') === `#${section}`) {
                link.classList.add('text-blue-200', 'font-bold');
            }
        });
        
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

// Dashboard with real data
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

        // Update statistics cards
        document.getElementById('total-clients').textContent = clients.total || 0;
        document.getElementById('today-deliveries').textContent = todaySummary.total_deliveries || 0;
        document.getElementById('available-drivers').textContent = drivers.items?.filter(d => d.is_available).length || 0;
        document.getElementById('available-vehicles').textContent = vehicles.items?.filter(v => v.is_active).length || 0;

        // Load weekly deliveries for chart
        await loadWeeklyDeliveryChart();
        loadStatusChart(todaySummary);
        
        // Load recent activities
        await loadRecentActivities();
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('載入儀表板失敗', 'error');
    }
}

async function loadWeeklyDeliveryChart() {
    const ctx = document.getElementById('deliveryChart').getContext('2d');
    
    // Get last 7 days of deliveries
    const dates = [];
    const counts = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        try {
            const response = await fetch(`${API_BASE}/deliveries?scheduled_date_from=${dateStr}&scheduled_date_to=${dateStr}`);
            const data = await response.json();
            
            dates.push(date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }));
            counts.push(data.total || 0);
        } catch (error) {
            dates.push(date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }));
            counts.push(0);
        }
    }

    // Destroy existing chart if it exists
    if (window.deliveryChart) {
        window.deliveryChart.destroy();
    }

    window.deliveryChart = new Chart(ctx, {
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
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
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

    // Destroy existing chart if it exists
    if (window.statusChart) {
        window.statusChart.destroy();
    }

    window.statusChart = new Chart(ctx, {
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
                    'rgb(147, 51, 234)',
                    'rgb(34, 197, 94)',
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

async function loadRecentActivities() {
    try {
        // Get recent deliveries
        const response = await fetch(`${API_BASE}/deliveries?page_size=5&order_by=created_at&order_desc=true`);
        const data = await response.json();
        
        const container = document.getElementById('recent-activities');
        if (!container) return;
        
        container.innerHTML = '<h3 class="text-lg font-semibold mb-4">最近活動</h3>';
        
        if (data.items && data.items.length > 0) {
            const list = document.createElement('div');
            list.className = 'space-y-2';
            
            data.items.forEach(delivery => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-3 bg-gray-50 rounded';
                
                const statusColors = {
                    'pending': 'text-yellow-600',
                    'assigned': 'text-blue-600',
                    'in_progress': 'text-purple-600',
                    'completed': 'text-green-600',
                    'cancelled': 'text-red-600'
                };
                
                item.innerHTML = `
                    <div>
                        <p class="font-medium">${delivery.order_number}</p>
                        <p class="text-sm text-gray-600">${delivery.client_name || '未知客戶'}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm ${statusColors[delivery.status] || 'text-gray-600'}">${delivery.status_display || delivery.status}</p>
                        <p class="text-xs text-gray-500">${formatDateTime(delivery.created_at)}</p>
                    </div>
                `;
                
                list.appendChild(item);
            });
            
            container.appendChild(list);
        } else {
            container.innerHTML += '<p class="text-gray-500">暫無最近活動</p>';
        }
    } catch (error) {
        console.error('Error loading recent activities:', error);
    }
}

// Enhanced Clients with search and filters
async function loadClients(page = 1) {
    try {
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            page_size: 10
        });
        
        if (clientFilters.keyword) params.append('keyword', clientFilters.keyword);
        if (clientFilters.district) params.append('district', clientFilters.district);
        if (clientFilters.isActive !== '') params.append('is_active', clientFilters.isActive);
        if (clientFilters.sortBy) {
            params.append('order_by', clientFilters.sortBy);
            params.append('order_desc', clientFilters.sortOrder === 'desc');
        }
        
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
        showNotification('載入客戶資料失敗', 'error');
    }
}

function renderClientsTable(clients) {
    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';
    
    if (clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                    沒有找到符合條件的客戶
                </td>
            </tr>
        `;
        return;
    }
    
    clients.forEach(client => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm">${client.id}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div>
                    <div class="font-medium">${client.name || client.invoice_title || '-'}</div>
                    ${client.contact_person ? `<div class="text-sm text-gray-500">${client.contact_person}</div>` : ''}
                </div>
            </td>
            <td class="px-6 py-4 text-sm">${client.address}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">${client.district || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <div>${client.total_orders || 0} 筆</div>
                ${client.last_order_date ? `<div class="text-xs text-gray-500">${formatDate(client.last_order_date)}</div>` : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${client.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${client.is_active ? '啟用' : '停用'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <button onclick="viewClient(${client.id})" class="text-blue-600 hover:text-blue-900 mr-2" title="檢視">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="editClient(${client.id})" class="text-green-600 hover:text-green-900 mr-2" title="編輯">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="toggleClientStatus(${client.id}, ${client.is_active})" class="text-orange-600 hover:text-orange-900" title="${client.is_active ? '停用' : '啟用'}">
                    <i class="fas fa-${client.is_active ? 'pause' : 'play'}"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Enhanced Deliveries with date range and filters
async function loadDeliveries(page = 1) {
    try {
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            page_size: 10
        });
        
        if (deliveryFilters.dateFrom) params.append('scheduled_date_from', deliveryFilters.dateFrom);
        if (deliveryFilters.dateTo) params.append('scheduled_date_to', deliveryFilters.dateTo);
        if (deliveryFilters.status) params.append('status', deliveryFilters.status);
        if (deliveryFilters.driverId) params.append('driver_id', deliveryFilters.driverId);
        if (deliveryFilters.clientId) params.append('client_id', deliveryFilters.clientId);
        if (deliveryFilters.sortBy) {
            params.append('order_by', deliveryFilters.sortBy);
            params.append('order_desc', deliveryFilters.sortOrder === 'desc');
        }
        
        const response = await fetch(`${API_BASE}/deliveries?${params}`);
        const data = await response.json();
        
        allDeliveries = data.items || [];
        currentDeliveryPage = page;
        
        // Render table
        renderDeliveriesTable(allDeliveries);
        
        // Update pagination
        updatePagination('deliveries', data.page, data.total_pages, data.total);
        
        // Update summary statistics
        updateDeliverySummary(data.items);
        
    } catch (error) {
        console.error('Error loading deliveries:', error);
        showNotification('載入配送單失敗', 'error');
    }
}

function renderDeliveriesTable(deliveries) {
    const tbody = document.getElementById('deliveries-tbody');
    tbody.innerHTML = '';
    
    if (deliveries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-4 text-center text-gray-500">
                    沒有找到符合條件的配送單
                </td>
            </tr>
        `;
        return;
    }
    
    deliveries.forEach(delivery => {
        const statusMap = {
            'pending': { text: '待處理', class: 'bg-yellow-100 text-yellow-800' },
            'assigned': { text: '已指派', class: 'bg-blue-100 text-blue-800' },
            'in_progress': { text: '配送中', class: 'bg-purple-100 text-purple-800' },
            'completed': { text: '已完成', class: 'bg-green-100 text-green-800' },
            'cancelled': { text: '已取消', class: 'bg-red-100 text-red-800' }
        };
        
        const status = statusMap[delivery.status] || { text: delivery.status, class: 'bg-gray-100 text-gray-800' };
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${delivery.order_number}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">${delivery.client_name || '-'}</td>
            <td class="px-6 py-4 text-sm">
                <div>${delivery.delivery_address}</div>
                <div class="text-xs text-gray-500">${delivery.delivery_district || ''}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <div>${formatDate(delivery.scheduled_date)}</div>
                <div class="text-xs text-gray-500">${delivery.scheduled_time_slot || '-'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${delivery.gas_quantity} 桶 / $${delivery.total_amount}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${status.class}">
                    ${status.text}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">${delivery.driver_name || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${delivery.status === 'pending' ? `
                    <button onclick="assignDelivery(${delivery.id})" class="text-blue-600 hover:text-blue-900 mr-2" title="指派">
                        <i class="fas fa-user-plus"></i>
                    </button>
                ` : ''}
                <button onclick="viewDelivery(${delivery.id})" class="text-green-600 hover:text-green-900 mr-2" title="檢視">
                    <i class="fas fa-eye"></i>
                </button>
                ${delivery.status !== 'completed' && delivery.status !== 'cancelled' ? `
                    <button onclick="updateDeliveryStatus(${delivery.id}, '${delivery.status}')" class="text-purple-600 hover:text-purple-900" title="更新狀態">
                        <i class="fas fa-sync"></i>
                    </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateDeliverySummary(deliveries) {
    const summary = {
        total: deliveries.length,
        totalAmount: 0,
        totalGas: 0,
        byStatus: {
            pending: 0,
            assigned: 0,
            in_progress: 0,
            completed: 0,
            cancelled: 0
        }
    };
    
    deliveries.forEach(delivery => {
        summary.totalAmount += parseFloat(delivery.total_amount || 0);
        summary.totalGas += parseInt(delivery.gas_quantity || 0);
        if (delivery.status in summary.byStatus) {
            summary.byStatus[delivery.status]++;
        }
    });
    
    // Update summary display
    const summaryContainer = document.getElementById('delivery-summary');
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow p-4 mb-6">
                <h3 class="font-semibold mb-3">配送摘要</h3>
                <div class="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                        <p class="text-gray-600">總筆數</p>
                        <p class="font-bold text-lg">${summary.total}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">總金額</p>
                        <p class="font-bold text-lg">$${summary.totalAmount.toLocaleString()}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">總瓦斯桶數</p>
                        <p class="font-bold text-lg">${summary.totalGas}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">待處理</p>
                        <p class="font-bold text-yellow-600">${summary.byStatus.pending}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">配送中</p>
                        <p class="font-bold text-purple-600">${summary.byStatus.in_progress}</p>
                    </div>
                    <div>
                        <p class="text-gray-600">已完成</p>
                        <p class="font-bold text-green-600">${summary.byStatus.completed}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

// Enhanced pagination with better UI
function updatePagination(section, currentPage, totalPages, totalItems) {
    const container = document.getElementById(`${section}-pagination`);
    if (!container) return;
    
    container.innerHTML = '';
    
    // Showing info
    const showingElement = document.getElementById(`${section}-showing`);
    const totalElement = document.getElementById(`${section}-total`);
    if (showingElement && totalElement) {
        const startItem = (currentPage - 1) * 10 + 1;
        const endItem = Math.min(currentPage * 10, totalItems);
        showingElement.textContent = totalItems > 0 ? `${startItem}-${endItem}` : '0';
        totalElement.textContent = totalItems;
    }
    
    if (totalPages <= 1) return;
    
    // First and Previous buttons
    if (currentPage > 1) {
        container.innerHTML += `
            <button onclick="load${capitalize(section)}(1)" 
                    class="px-3 py-1 border rounded hover:bg-gray-100 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-angle-double-left"></i>
            </button>
            <button onclick="load${capitalize(section)}(${currentPage - 1})" 
                    class="px-3 py-1 border rounded hover:bg-gray-100">
                <i class="fas fa-angle-left"></i>
            </button>
        `;
    }
    
    // Page numbers with ellipsis
    const pageNumbers = [];
    const delta = 2;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
            pageNumbers.push(i);
        }
    }
    
    let lastPage = 0;
    pageNumbers.forEach(page => {
        if (lastPage && page - lastPage > 1) {
            container.innerHTML += `<span class="px-2">...</span>`;
        }
        
        container.innerHTML += `
            <button onclick="load${capitalize(section)}(${page})" 
                    class="px-3 py-1 border rounded ${page === currentPage ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}">
                ${page}
            </button>
        `;
        
        lastPage = page;
    });
    
    // Next and Last buttons
    if (currentPage < totalPages) {
        container.innerHTML += `
            <button onclick="load${capitalize(section)}(${currentPage + 1})" 
                    class="px-3 py-1 border rounded hover:bg-gray-100">
                <i class="fas fa-angle-right"></i>
            </button>
            <button onclick="load${capitalize(section)}(${totalPages})" 
                    class="px-3 py-1 border rounded hover:bg-gray-100 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-angle-double-right"></i>
            </button>
        `;
    }
}

// Setup filter handlers
function setupFilterHandlers() {
    // Client filters
    document.getElementById('client-search')?.addEventListener('input', debounce((e) => {
        clientFilters.keyword = e.target.value;
        loadClients(1);
    }, 500));
    
    document.getElementById('client-district')?.addEventListener('change', (e) => {
        clientFilters.district = e.target.value;
        loadClients(1);
    });
    
    document.getElementById('client-status')?.addEventListener('change', (e) => {
        clientFilters.isActive = e.target.value;
        loadClients(1);
    });
    
    // Delivery filters
    document.getElementById('delivery-date-from')?.addEventListener('change', (e) => {
        deliveryFilters.dateFrom = e.target.value;
        loadDeliveries(1);
    });
    
    document.getElementById('delivery-date-to')?.addEventListener('change', (e) => {
        deliveryFilters.dateTo = e.target.value;
        loadDeliveries(1);
    });
    
    document.getElementById('delivery-status')?.addEventListener('change', (e) => {
        deliveryFilters.status = e.target.value;
        loadDeliveries(1);
    });
    
    document.getElementById('delivery-driver')?.addEventListener('change', (e) => {
        deliveryFilters.driverId = e.target.value;
        loadDeliveries(1);
    });
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded shadow-lg text-white z-50 ${
        type === 'success' ? 'bg-green-600' : 
        type === 'error' ? 'bg-red-600' : 
        'bg-blue-600'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => notification.classList.add('opacity-100'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('opacity-0');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Enhanced client functions
async function viewClient(clientId) {
    try {
        const response = await fetch(`${API_BASE}/clients/${clientId}`);
        const client = await response.json();
        
        // Create modal content
        const modalContent = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">客戶名稱</p>
                    <p class="font-medium">${client.name || client.invoice_title || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">客戶編號</p>
                    <p class="font-medium">#${client.id}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">聯絡人</p>
                    <p class="font-medium">${client.contact_person || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">統一編號</p>
                    <p class="font-medium">${client.tax_id || '-'}</p>
                </div>
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">地址</p>
                    <p class="font-medium">${client.address}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">區域</p>
                    <p class="font-medium">${client.district || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">狀態</p>
                    <p class="font-medium">
                        <span class="px-2 py-1 text-xs rounded-full ${client.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${client.is_active ? '啟用' : '停用'}
                        </span>
                    </p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">總訂單數</p>
                    <p class="font-medium">${client.total_orders || 0} 筆</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">最後訂單日期</p>
                    <p class="font-medium">${client.last_order_date ? formatDate(client.last_order_date) : '-'}</p>
                </div>
                ${client.notes ? `
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">備註</p>
                    <p class="font-medium">${client.notes}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        showModal('客戶詳細資料', modalContent);
    } catch (error) {
        showNotification('載入客戶資料失敗', 'error');
    }
}

async function toggleClientStatus(clientId, currentStatus) {
    if (!confirm(`確定要${currentStatus ? '停用' : '啟用'}此客戶嗎？`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/clients/${clientId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !currentStatus })
        });
        
        if (response.ok) {
            showNotification(`客戶已${!currentStatus ? '啟用' : '停用'}`, 'success');
            loadClients(currentClientPage);
        } else {
            throw new Error('Update failed');
        }
    } catch (error) {
        showNotification('更新失敗', 'error');
    }
}

// Modal function
function showModal(title, content, actions = '') {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">${title}</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="mb-4">
                ${content}
            </div>
            <div class="flex justify-end gap-2">
                ${actions || '<button onclick="this.closest(\'.fixed\').remove()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">關閉</button>'}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Export functions for reports
async function exportClients() {
    try {
        const params = new URLSearchParams(clientFilters);
        params.append('export', 'csv');
        
        const response = await fetch(`${API_BASE}/clients?${params}`);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        showNotification('匯出成功', 'success');
    } catch (error) {
        showNotification('匯出失敗', 'error');
    }
}

async function exportDeliveries() {
    try {
        const params = new URLSearchParams(deliveryFilters);
        params.append('export', 'csv');
        
        const response = await fetch(`${API_BASE}/deliveries?${params}`);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deliveries_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        showNotification('匯出成功', 'success');
    } catch (error) {
        showNotification('匯出失敗', 'error');
    }
}

// Quick stats refresh
async function refreshStats() {
    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
    
    await loadDashboard();
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync"></i>';
    showNotification('統計資料已更新', 'success');
}

// Initialize the rest of the functions from the original file...
// (Include all the remaining functions from the original app.js)