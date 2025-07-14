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
    
    const fromDate = lastWeek.toISOString().split('T')[0];
    const toDate = tomorrow.toISOString().split('T')[0];
    
    // Set the input values
    const fromInput = document.getElementById('delivery-date-from');
    const toInput = document.getElementById('delivery-date-to');
    
    if (fromInput) {
        fromInput.value = fromDate;
        deliveryFilters.dateFrom = fromDate;
    }
    
    if (toInput) {
        toInput.value = toDate;
        deliveryFilters.dateTo = toDate;
    }
}

// Navigation
function setupNavigation() {
    try {
        const navLinks = document.querySelectorAll('.nav-link');
        if (navLinks.length === 0) {
            console.warn('No navigation links found');
            return;
        }
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const section = href.substring(1);
                    showSection(section);
                } else {
                    console.error('Invalid navigation link:', href);
                    showNotification('導航錯誤', 'error');
                }
            });
        });
    } catch (error) {
        console.error('Error setting up navigation:', error);
        showNotification('導航系統初始化失敗', 'error');
    }
}

function showSection(section) {
    try {
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
    } else {
        console.error('Section not found:', section);
        showNotification(`找不到頁面: ${section}`, 'error');
    }
    } catch (error) {
        console.error('Error showing section:', error);
        showNotification('頁面切換失敗', 'error');
    }
}

// Dashboard with real data
async function loadDashboard() {
    try {
        // Load dashboard statistics from new endpoint
        const statsRes = await fetch(`${API_BASE}/dashboard/stats`);
        const stats = await statsRes.json();
        
        // Update statistics cards
        document.getElementById('total-clients').textContent = stats.overview?.total_clients || 0;
        document.getElementById('today-deliveries').textContent = stats.today_deliveries?.total || 0;
        document.getElementById('available-drivers').textContent = stats.overview?.available_drivers || 0;
        document.getElementById('available-vehicles').textContent = stats.overview?.available_vehicles || 0;
        
        // Load charts with data from stats
        loadWeeklyDeliveryChartFromStats(stats.week_trend);
        loadStatusChartFromStats(stats.today_deliveries);
        
        // Load recent activities from stats
        loadRecentActivitiesFromStats(stats.recent_activities);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('載入儀表板失敗', 'error');
    }
}

function loadWeeklyDeliveryChartFromStats(weekTrend) {
    try {
        const canvas = document.getElementById('deliveryChart');
        if (!canvas) {
            console.error('Delivery chart canvas not found');
            return;
        }
        
        if (!weekTrend || weekTrend.length === 0) {
            console.warn('No week trend data available');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const labels = weekTrend.map(day => day.day);
        const totalData = weekTrend.map(day => day.total);
        const completedData = weekTrend.map(day => day.completed);
        
        // Destroy existing chart if it exists
        if (window.deliveryChart && typeof window.deliveryChart.destroy === 'function') {
            window.deliveryChart.destroy();
        }
        
        window.deliveryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '總配送數',
                    data: totalData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1
                }, {
                    label: '已完成',
                    data: completedData,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true
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
    } catch (error) {
        console.error('Error loading delivery chart:', error);
    }
}

function loadStatusChartFromStats(todayDeliveries) {
    try {
        const canvas = document.getElementById('statusChart');
        if (!canvas) {
            console.error('Status chart canvas not found');
            return;
        }
        const ctx = canvas.getContext('2d');
    
    const completed = todayDeliveries?.completed || 0;
    const pending = todayDeliveries?.pending || 0;
    const inProgress = todayDeliveries?.in_progress || 0;
    const cancelled = todayDeliveries?.cancelled || 0;

    // Destroy existing chart if it exists
    if (window.statusChart) {
        window.statusChart.destroy();
    }

    window.statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['已完成', '待配送', '配送中', '已取消'],
            datasets: [{
                data: [completed, pending, inProgress, cancelled],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
    } catch (error) {
        console.error('Error loading status chart:', error);
    }
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

function loadRecentActivitiesFromStats(recentActivities) {
    try {
        const container = document.getElementById('recent-activities');
        if (!container) return;
        
        container.innerHTML = '<h3 class="text-lg font-semibold mb-4">最近活動</h3>';
        
        if (recentActivities && recentActivities.length > 0) {
            const list = document.createElement('div');
            list.className = 'space-y-2';
            
            recentActivities.forEach(activity => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-3 bg-gray-50 rounded';
                
                const statusColors = {
                    'PENDING': 'text-yellow-600',
                    'ASSIGNED': 'text-blue-600',
                    'IN_PROGRESS': 'text-purple-600',
                    'COMPLETED': 'text-green-600',
                    'CANCELLED': 'text-red-600'
                };
                
                const statusText = getStatusText(activity.status);
                
                item.innerHTML = `
                    <div>
                        <p class="font-medium">${activity.client_name}</p>
                        <p class="text-sm text-gray-600">${activity.scheduled_date} - ${activity.driver_name}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm ${statusColors[activity.status] || 'text-gray-600'}">${statusText}</p>
                        <p class="text-xs text-gray-500">${activity.updated_at}</p>
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
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <div class="text-gray-900">${client.client_code || client.id}</div>
                <div class="text-xs text-gray-500">ID: ${client.id}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div>
                    <div class="font-medium">${client.name || '-'}</div>
                    <div class="text-sm text-gray-600">${client.invoice_title || '-'}</div>
                    ${client.contact_person ? `<div class="text-xs text-gray-500">${client.contact_person}</div>` : ''}
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

// Edit functions for CRUD operations
async function editClient(clientId) {
    try {
        const response = await fetch(`${API_BASE}/clients/${clientId}`);
        const client = await response.json();
        
        // Create a modal dialog for editing
        const modal = createEditModal('編輯客戶', `
            <form id="edit-client-form">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">客戶編號</label>
                        <input type="text" name="client_code" value="${client.client_code || ''}" class="w-full px-3 py-2 border rounded-md bg-gray-100" readonly>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">客戶名稱</label>
                        <input type="text" name="name" value="${client.name || ''}" class="w-full px-3 py-2 border rounded-md" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">發票抬頭</label>
                        <input type="text" name="invoice_title" value="${client.invoice_title || ''}" class="w-full px-3 py-2 border rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">聯絡人</label>
                        <input type="text" name="contact_person" value="${client.contact_person || ''}" class="w-full px-3 py-2 border rounded-md">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-1">地址</label>
                        <input type="text" name="address" value="${client.address}" class="w-full px-3 py-2 border rounded-md" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">區域</label>
                        <input type="text" name="district" value="${client.district || ''}" class="w-full px-3 py-2 border rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                        <select name="is_active" class="w-full px-3 py-2 border rounded-md">
                            <option value="true" ${client.is_active ? 'selected' : ''}>啟用</option>
                            <option value="false" ${!client.is_active ? 'selected' : ''}>停用</option>
                        </select>
                    </div>
                </div>
            </form>
        `);
        
        modal.querySelector('#confirm-btn').addEventListener('click', async () => {
            const form = modal.querySelector('#edit-client-form');
            const formData = new FormData(form);
            const updateData = {};
            
            for (let [key, value] of formData.entries()) {
                if (key === 'is_active') {
                    updateData[key] = value === 'true';
                } else {
                    updateData[key] = value;
                }
            }
            
            try {
                const updateResponse = await fetch(`${API_BASE}/clients/${clientId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                
                if (updateResponse.ok) {
                    showNotification('客戶資料已更新', 'success');
                    closeModal(modal);
                    loadClients();
                } else {
                    throw new Error('更新失敗');
                }
            } catch (error) {
                showNotification('更新客戶資料失敗', 'error');
            }
        });
        
    } catch (error) {
        console.error('Error editing client:', error);
        showNotification('載入客戶資料失敗', 'error');
    }
}

async function editDriver(driverId) {
    try {
        const response = await fetch(`${API_BASE}/drivers/${driverId}`);
        const driver = await response.json();
        
        const modal = createEditModal('編輯司機', `
            <form id="edit-driver-form">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                        <input type="text" name="name" value="${driver.name}" class="w-full px-3 py-2 border rounded-md" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">電話</label>
                        <input type="text" name="phone" value="${driver.phone || ''}" class="w-full px-3 py-2 border rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">員工編號</label>
                        <input type="text" name="employee_id" value="${driver.employee_id || ''}" class="w-full px-3 py-2 border rounded-md">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                        <select name="is_active" class="w-full px-3 py-2 border rounded-md">
                            <option value="true" ${driver.is_active ? 'selected' : ''}>在職</option>
                            <option value="false" ${!driver.is_active ? 'selected' : ''}>離職</option>
                        </select>
                    </div>
                </div>
            </form>
        `);
        
        modal.querySelector('#confirm-btn').addEventListener('click', async () => {
            const form = modal.querySelector('#edit-driver-form');
            const formData = new FormData(form);
            const updateData = {};
            
            for (let [key, value] of formData.entries()) {
                if (key === 'is_active') {
                    updateData[key] = value === 'true';
                } else {
                    updateData[key] = value;
                }
            }
            
            try {
                const updateResponse = await fetch(`${API_BASE}/drivers/${driverId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                
                if (updateResponse.ok) {
                    showNotification('司機資料已更新', 'success');
                    closeModal(modal);
                    loadDrivers();
                } else {
                    throw new Error('更新失敗');
                }
            } catch (error) {
                showNotification('更新司機資料失敗', 'error');
            }
        });
        
    } catch (error) {
        console.error('Error editing driver:', error);
        showNotification('載入司機資料失敗', 'error');
    }
}

async function editVehicle(vehicleId) {
    try {
        const response = await fetch(`${API_BASE}/vehicles/${vehicleId}`);
        const vehicle = await response.json();
        
        const modal = createEditModal('編輯車輛', `
            <form id="edit-vehicle-form">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">車牌號碼</label>
                        <input type="text" name="plate_number" value="${vehicle.plate_number}" class="w-full px-3 py-2 border rounded-md" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">車輛類型</label>
                        <select name="vehicle_type" class="w-full px-3 py-2 border rounded-md">
                            <option value="1" ${vehicle.vehicle_type === 1 ? 'selected' : ''}>汽車</option>
                            <option value="2" ${vehicle.vehicle_type === 2 ? 'selected' : ''}>機車</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                        <select name="is_active" class="w-full px-3 py-2 border rounded-md">
                            <option value="true" ${vehicle.is_active ? 'selected' : ''}>可用</option>
                            <option value="false" ${!vehicle.is_active ? 'selected' : ''}>停用</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">上次保養日期</label>
                        <input type="date" name="last_maintenance" value="${vehicle.last_maintenance || ''}" class="w-full px-3 py-2 border rounded-md">
                    </div>
                </div>
            </form>
        `);
        
        modal.querySelector('#confirm-btn').addEventListener('click', async () => {
            const form = modal.querySelector('#edit-vehicle-form');
            const formData = new FormData(form);
            const updateData = {};
            
            for (let [key, value] of formData.entries()) {
                if (key === 'is_active') {
                    updateData[key] = value === 'true';
                } else if (key === 'vehicle_type') {
                    updateData[key] = parseInt(value);
                } else {
                    updateData[key] = value;
                }
            }
            
            try {
                const updateResponse = await fetch(`${API_BASE}/vehicles/${vehicleId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                
                if (updateResponse.ok) {
                    showNotification('車輛資料已更新', 'success');
                    closeModal(modal);
                    loadVehicles();
                } else {
                    throw new Error('更新失敗');
                }
            } catch (error) {
                showNotification('更新車輛資料失敗', 'error');
            }
        });
        
    } catch (error) {
        console.error('Error editing vehicle:', error);
        showNotification('載入車輛資料失敗', 'error');
    }
}

// Helper function to create edit modal
function createEditModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div class="px-6 py-4 border-b">
                <h3 class="text-lg font-semibold">${title}</h3>
            </div>
            <div class="px-6 py-4">
                ${content}
            </div>
            <div class="px-6 py-4 border-t flex justify-end space-x-2">
                <button onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    取消
                </button>
                <button id="confirm-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    確認
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
}

function closeModal(modal) {
    if (modal) {
        modal.remove();
    }
}

// Modal display functions
function showAddClientModal() {
    let modal = document.getElementById('addClientModal');
    if (!modal) {
        // Create modal dynamically if it doesn't exist
        modal = createModal(`
            <div class="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h2 class="text-xl font-bold mb-4">新增客戶</h2>
                <form id="add-client-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">客戶編號</label>
                        <input type="text" name="client_code" required class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">客戶名稱</label>
                        <input type="text" name="name" required class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">發票抬頭</label>
                        <input type="text" name="invoice_title" required class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">地址</label>
                        <input type="text" name="address" required class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">電話</label>
                        <input type="tel" name="phone" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">聯絡人</label>
                        <input type="text" name="contact_person" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">付款方式</label>
                        <select name="payment_method" class="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500">
                            <option value="CASH">現金</option>
                            <option value="MONTHLY">月結</option>
                            <option value="TRANSFER">轉帳</option>
                        </select>
                    </div>
                    <div class="flex justify-end space-x-2 pt-4">
                        <button type="button" onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                            取消
                        </button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            新增
                        </button>
                    </div>
                </form>
            </div>
        `);
        modal.id = 'addClientModal';
        // Re-setup form handler for the new form
        setupAddClientFormHandler();
    } else {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }
}

function showAddDriverModal() {
    const modal = document.getElementById('addDriverModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    } else {
        console.error('Add driver modal not found');
    }
}

function showAddVehicleModal() {
    const modal = document.getElementById('addVehicleModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    } else {
        console.error('Add vehicle modal not found');
    }
}

async function showAddDeliveryModal() {
    const modal = document.getElementById('addDeliveryModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            
            // Populate client dropdown
            const clientSelect = form.querySelector('select[name="client_id"]');
            if (clientSelect && allClients.length === 0) {
                // Load clients if not already loaded
                try {
                    const response = await fetch(`${API_BASE}/clients?limit=1000`);
                    if (response.ok) {
                        const data = await response.json();
                        allClients = data.items || [];
                    }
                } catch (error) {
                    console.error('Error loading clients:', error);
                }
            }
            
            // Populate dropdown
            if (clientSelect) {
                clientSelect.innerHTML = '<option value="">請選擇客戶</option>';
                allClients.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client.id;
                    option.textContent = `${client.client_code} - ${client.name || client.invoice_title}`;
                    clientSelect.appendChild(option);
                });
            }
            
            // Set today as default date
            const dateInput = form.querySelector('input[name="scheduled_date"]');
            if (dateInput) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
        }
    } else {
        console.error('Add delivery modal not found');
        showNotification('配送單模態視窗未找到', 'error');
    }
}

// Helper function to setup add client form handler
function setupAddClientFormHandler() {
    const form = document.getElementById('add-client-form');
    if (form && !form.dataset.handlerAttached) {
        form.dataset.handlerAttached = 'true';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                const response = await fetch('/api/clients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    showNotification('客戶新增成功', 'success');
                    closeModal(document.getElementById('addClientModal'));
                    loadClients(1);
                } else {
                    const error = await response.json();
                    showNotification(error.detail || '新增失敗', 'error');
                }
            } catch (error) {
                showNotification('新增失敗: ' + error.message, 'error');
            }
        });
    }
}

// Sorting functions
function sortClients(column) {
    if (clientFilters.sortBy === column) {
        clientFilters.sortOrder = clientFilters.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        clientFilters.sortBy = column;
        clientFilters.sortOrder = 'asc';
    }
    loadClients(1);
}

function sortDeliveries(value) {
    if (value) {
        const [column, order] = value.split('-');
        deliveryFilters.sortBy = column;
        deliveryFilters.sortOrder = order;
        loadDeliveries(1);
    }
}

// Additional utility functions
async function updateDeliveryStatus(deliveryId, currentStatus) {
    const statusFlow = {
        'pending': 'assigned',
        'assigned': 'in_progress',
        'in_progress': 'completed'
    };
    
    const nextStatus = statusFlow[currentStatus];
    if (!nextStatus) {
        showNotification('此配送單已完成或取消', 'info');
        return;
    }
    
    if (confirm(`確定要將狀態更新為「${getStatusText(nextStatus)}」嗎？`)) {
        try {
            const response = await fetch(`${API_BASE}/deliveries/${deliveryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus.toUpperCase() })
            });
            
            if (response.ok) {
                showNotification('配送狀態已更新', 'success');
                loadDeliveries(currentDeliveryPage);
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            showNotification('更新失敗', 'error');
        }
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待處理',
        'assigned': '已指派',
        'in_progress': '配送中',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status.toLowerCase()] || status;
}

// Assign delivery to driver
async function assignDelivery(deliveryId) {
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
    
    const modalContent = `
        <form id="assign-delivery-form">
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">選擇司機</label>
                    <select name="driver_id" class="w-full px-3 py-2 border rounded-md" required>
                        <option value="">請選擇司機</option>
                        ${availableDrivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">選擇車輛</label>
                    <select name="vehicle_id" class="w-full px-3 py-2 border rounded-md" required>
                        <option value="">請選擇車輛</option>
                        ${availableVehicles.map(v => `<option value="${v.id}">${v.plate_number} - ${v.vehicle_type}</option>`).join('')}
                    </select>
                </div>
            </div>
        </form>
    `;
    
    const modal = createEditModal('指派配送單', modalContent);
    
    modal.querySelector('#confirm-btn').addEventListener('click', async () => {
        const form = modal.querySelector('#assign-delivery-form');
        const formData = new FormData(form);
        
        try {
            const response = await fetch(`${API_BASE}/deliveries/${deliveryId}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    driver_id: parseInt(formData.get('driver_id')),
                    vehicle_id: parseInt(formData.get('vehicle_id'))
                })
            });
            
            if (response.ok) {
                showNotification('配送單已指派', 'success');
                closeModal(modal);
                loadDeliveries(currentDeliveryPage);
            } else {
                throw new Error('Assign failed');
            }
        } catch (error) {
            showNotification('指派失敗', 'error');
        }
    });
}

// View delivery details
async function viewDelivery(deliveryId) {
    try {
        const response = await fetch(`${API_BASE}/deliveries/${deliveryId}`);
        const delivery = await response.json();
        
        const modalContent = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">配送單號</p>
                    <p class="font-medium">${delivery.order_number}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">狀態</p>
                    <p class="font-medium">${getStatusText(delivery.status)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">客戶名稱</p>
                    <p class="font-medium">${delivery.client_name || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">配送日期</p>
                    <p class="font-medium">${formatDate(delivery.scheduled_date)}</p>
                </div>
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">配送地址</p>
                    <p class="font-medium">${delivery.delivery_address}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">瓦斯數量</p>
                    <p class="font-medium">${delivery.gas_quantity} 桶</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">總金額</p>
                    <p class="font-medium">NT$ ${delivery.total_amount}</p>
                </div>
                ${delivery.driver_name ? `
                <div>
                    <p class="text-sm text-gray-600">司機</p>
                    <p class="font-medium">${delivery.driver_name}</p>
                </div>
                ` : ''}
                ${delivery.vehicle_plate ? `
                <div>
                    <p class="text-sm text-gray-600">車輛</p>
                    <p class="font-medium">${delivery.vehicle_plate}</p>
                </div>
                ` : ''}
                ${delivery.notes ? `
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">備註</p>
                    <p class="font-medium">${delivery.notes}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        showModal('配送單詳細資料', modalContent);
    } catch (error) {
        showNotification('載入配送單資料失敗', 'error');
    }
}

// Setup form handlers
function setupFormHandlers() {
    // Add client form handler
    const addClientForm = document.getElementById('add-client-form');
    if (addClientForm) {
        addClientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addClientForm);
            const clientData = {
                name: formData.get('name'),
                invoice_title: formData.get('invoice_title'),
                tax_id: formData.get('tax_id'),
                contact_person: formData.get('contact_person'),
                address: formData.get('address'),
                district: formData.get('district'),
                is_active: true
            };
            
            try {
                const response = await fetch(`${API_BASE}/clients`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(clientData)
                });
                
                if (response.ok) {
                    showNotification('客戶新增成功', 'success');
                    addClientForm.reset();
                    loadClients();
                } else {
                    throw new Error('新增失敗');
                }
            } catch (error) {
                showNotification('新增客戶失敗', 'error');
            }
        });
    }
    
    // Add delivery form handler
    const addDeliveryForm = document.getElementById('add-delivery-form');
    if (addDeliveryForm) {
        addDeliveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addDeliveryForm);
            const deliveryData = {
                client_id: parseInt(formData.get('client_id')),
                scheduled_date: formData.get('scheduled_date'),
                scheduled_time_slot: formData.get('scheduled_time_slot'),
                gas_quantity: parseInt(formData.get('gas_quantity')),
                delivery_address: formData.get('delivery_address'),
                delivery_district: formData.get('delivery_district'),
                unit_price: parseFloat(formData.get('unit_price') || 650),
                delivery_fee: parseFloat(formData.get('delivery_fee') || 0),
                payment_method: formData.get('payment_method') || 'cash',
                requires_empty_cylinder_return: formData.get('requires_empty_cylinder_return') === 'on',
                empty_cylinders_to_return: parseInt(formData.get('empty_cylinders_to_return') || 0),
                notes: formData.get('notes')
            };
            
            try {
                const response = await fetch(`${API_BASE}/deliveries`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(deliveryData)
                });
                
                if (response.ok) {
                    showNotification('配送單新增成功', 'success');
                    closeModal(document.getElementById('addDeliveryModal'));
                    addDeliveryForm.reset();
                    loadDeliveries();
                } else {
                    throw new Error('新增失敗');
                }
            } catch (error) {
                showNotification('新增配送單失敗', 'error');
            }
        });
    }
    
    // Add driver form handler
    const addDriverForm = document.getElementById('add-driver-form');
    if (addDriverForm) {
        addDriverForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addDriverForm);
            const driverData = {
                name: formData.get('name'),
                employee_id: formData.get('employee_id'),
                phone: formData.get('phone'),
                id_number: formData.get('id_number'),
                address: formData.get('address'),
                emergency_contact: formData.get('emergency_contact'),
                emergency_phone: formData.get('emergency_phone'),
                license_number: formData.get('license_number'),
                license_type: formData.get('license_type'),
                license_expiry_date: formData.get('license_expiry_date'),
                hire_date: formData.get('hire_date'),
                base_salary: parseFloat(formData.get('base_salary') || 0),
                commission_rate: parseFloat(formData.get('commission_rate') || 0)
            };
            
            try {
                const response = await fetch(`${API_BASE}/drivers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(driverData)
                });
                
                if (response.ok) {
                    showNotification('司機新增成功', 'success');
                    closeModal(document.getElementById('addDriverModal'));
                    addDriverForm.reset();
                    loadDrivers();
                } else {
                    const error = await response.json();
                    showNotification(error.detail || '新增失敗', 'error');
                }
            } catch (error) {
                showNotification('新增司機失敗: ' + error.message, 'error');
            }
        });
    }
    
    // Add vehicle form handler
    const addVehicleForm = document.getElementById('add-vehicle-form');
    if (addVehicleForm) {
        addVehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addVehicleForm);
            const vehicleData = {
                plate_number: formData.get('plate_number'),
                vehicle_type: formData.get('vehicle_type'),
                brand: formData.get('brand'),
                model: formData.get('model'),
                year: parseInt(formData.get('year')),
                fuel_type: formData.get('fuel_type'),
                max_load_kg: parseFloat(formData.get('max_load_kg') || 0),
                max_cylinders: parseInt(formData.get('max_cylinders') || 0)
            };
            
            try {
                const response = await fetch(`${API_BASE}/vehicles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(vehicleData)
                });
                
                if (response.ok) {
                    showNotification('車輛新增成功', 'success');
                    closeModal(document.getElementById('addVehicleModal'));
                    addVehicleForm.reset();
                    loadVehicles();
                } else {
                    const error = await response.json();
                    showNotification(error.detail || '新增失敗', 'error');
                }
            } catch (error) {
                showNotification('新增車輛失敗: ' + error.message, 'error');
            }
        });
    }
}

// Load drivers
async function loadDrivers() {
    try {
        const response = await fetch(`${API_BASE}/drivers`);
        const data = await response.json();
        
        allDrivers = data.items || [];
        
        const tbody = document.getElementById('drivers-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            
            if (allDrivers.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                            沒有司機資料
                        </td>
                    </tr>
                `;
                return;
            }
            
            allDrivers.forEach(driver => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition-colors';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${driver.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap font-medium">${driver.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${driver.phone || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${driver.employee_id || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs rounded-full ${driver.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${driver.is_active ? '在職' : '離職'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button onclick="editDriver(${driver.id})" class="text-blue-600 hover:text-blue-900 mr-2" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="toggleDriverStatus(${driver.id}, ${driver.is_active})" class="text-orange-600 hover:text-orange-900" title="${driver.is_active ? '停用' : '啟用'}">
                            <i class="fas fa-${driver.is_active ? 'pause' : 'play'}"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
        
        // Update driver select options in forms
        updateDriverOptions();
        
    } catch (error) {
        console.error('Error loading drivers:', error);
        showNotification('載入司機資料失敗', 'error');
    }
}

// Load vehicles
async function loadVehicles() {
    try {
        const response = await fetch(`${API_BASE}/vehicles`);
        const data = await response.json();
        
        allVehicles = data.items || [];
        
        const tbody = document.getElementById('vehicles-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            
            if (allVehicles.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                            沒有車輛資料
                        </td>
                    </tr>
                `;
                return;
            }
            
            allVehicles.forEach(vehicle => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition-colors';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${vehicle.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap font-medium">${vehicle.plate_number}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${vehicle.vehicle_type === 1 ? '汽車' : '機車'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${vehicle.last_maintenance ? formatDate(vehicle.last_maintenance) : '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs rounded-full ${vehicle.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${vehicle.is_active ? '可用' : '停用'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button onclick="editVehicle(${vehicle.id})" class="text-blue-600 hover:text-blue-900 mr-2" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="toggleVehicleStatus(${vehicle.id}, ${vehicle.is_active})" class="text-orange-600 hover:text-orange-900" title="${vehicle.is_active ? '停用' : '啟用'}">
                            <i class="fas fa-${vehicle.is_active ? 'pause' : 'play'}"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
        
    } catch (error) {
        console.error('Error loading vehicles:', error);
        showNotification('載入車輛資料失敗', 'error');
    }
}

// Toggle driver status
async function toggleDriverStatus(driverId, currentStatus) {
    if (!confirm(`確定要${currentStatus ? '停用' : '啟用'}此司機嗎？`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/drivers/${driverId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !currentStatus })
        });
        
        if (response.ok) {
            showNotification(`司機已${!currentStatus ? '啟用' : '停用'}`, 'success');
            loadDrivers();
        } else {
            throw new Error('Update failed');
        }
    } catch (error) {
        showNotification('更新失敗', 'error');
    }
}

// Toggle vehicle status
async function toggleVehicleStatus(vehicleId, currentStatus) {
    if (!confirm(`確定要${currentStatus ? '停用' : '啟用'}此車輛嗎？`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/vehicles/${vehicleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !currentStatus })
        });
        
        if (response.ok) {
            showNotification(`車輛已${!currentStatus ? '啟用' : '停用'}`, 'success');
            loadVehicles();
        } else {
            throw new Error('Update failed');
        }
    } catch (error) {
        showNotification('更新失敗', 'error');
    }
}

// Update driver options in select elements
function updateDriverOptions() {
    const driverSelects = document.querySelectorAll('select[name="driver_id"], #delivery-driver');
    driverSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">全部司機</option>';
        allDrivers.filter(d => d.is_active).forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.id;
            option.textContent = driver.name;
            select.appendChild(option);
        });
        select.value = currentValue;
    });
}

// View driver details
async function viewDriverDetails(driverId) {
    try {
        const response = await fetch(`${API_BASE}/drivers/${driverId}`);
        if (!response.ok) throw new Error('Failed to fetch driver details');
        
        const driver = await response.json();
        
        const modalContent = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">司機姓名</p>
                    <p class="font-medium">${driver.name}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">員工編號</p>
                    <p class="font-medium">${driver.employee_id || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">電話</p>
                    <p class="font-medium">${driver.phone || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">身分證字號</p>
                    <p class="font-medium">${driver.id_number || '-'}</p>
                </div>
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">地址</p>
                    <p class="font-medium">${driver.address || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">緊急聯絡人</p>
                    <p class="font-medium">${driver.emergency_contact || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">緊急聯絡電話</p>
                    <p class="font-medium">${driver.emergency_phone || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">駕照號碼</p>
                    <p class="font-medium">${driver.license_number || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">駕照類型</p>
                    <p class="font-medium">${driver.license_type || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">駕照到期日</p>
                    <p class="font-medium">${driver.license_expiry_date ? formatDate(driver.license_expiry_date) : '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">入職日期</p>
                    <p class="font-medium">${driver.hire_date ? formatDate(driver.hire_date) : '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">狀態</p>
                    <p class="font-medium">
                        <span class="px-2 py-1 text-xs rounded-full ${driver.is_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                            ${driver.is_available ? '可用' : '不可用'}
                        </span>
                    </p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">配送統計</p>
                    <p class="font-medium">${driver.delivery_count || 0} 筆配送</p>
                </div>
            </div>
        `;
        
        const modal = createModal(`
            <h2 class="text-xl font-bold mb-4">司機詳細資料</h2>
            ${modalContent}
            <div class="mt-6 flex justify-end">
                <button onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    關閉
                </button>
            </div>
        `);
    } catch (error) {
        showNotification('無法載入司機資料', 'error');
    }
}

// Toggle driver availability
async function toggleDriverAvailability(driverId) {
    try {
        // Get current driver data
        const response = await fetch(`${API_BASE}/drivers/${driverId}`);
        if (!response.ok) throw new Error('Failed to fetch driver');
        
        const driver = await response.json();
        const newAvailability = !driver.is_available;
        
        if (!confirm(`確定要${newAvailability ? '啟用' : '停用'}此司機嗎？`)) return;
        
        const updateResponse = await fetch(`${API_BASE}/drivers/${driverId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_available: newAvailability })
        });
        
        if (updateResponse.ok) {
            showNotification(`司機已${newAvailability ? '啟用' : '停用'}`, 'success');
            loadDrivers();
        } else {
            throw new Error('Update failed');
        }
    } catch (error) {
        showNotification('更新失敗: ' + error.message, 'error');
    }
}

// View driver deliveries
async function viewDriverDeliveries(driverId) {
    try {
        const response = await fetch(`${API_BASE}/deliveries?driver_id=${driverId}&limit=50`);
        if (!response.ok) throw new Error('Failed to fetch deliveries');
        
        const data = await response.json();
        const deliveries = data.items || [];
        
        let tableContent = '';
        if (deliveries.length === 0) {
            tableContent = '<p class="text-center text-gray-500 py-4">此司機沒有配送記錄</p>';
        } else {
            tableContent = `
                <div class="overflow-x-auto">
                    <table class="min-w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">客戶</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">地址</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">狀態</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${deliveries.map(delivery => `
                                <tr>
                                    <td class="px-4 py-2 text-sm">${formatDate(delivery.scheduled_date)}</td>
                                    <td class="px-4 py-2 text-sm">${delivery.client_name || '-'}</td>
                                    <td class="px-4 py-2 text-sm">${delivery.delivery_address || '-'}</td>
                                    <td class="px-4 py-2 text-sm">
                                        <span class="px-2 py-1 text-xs rounded-full ${getStatusColor(delivery.status)}">
                                            ${getStatusText(delivery.status)}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        const modal = createModal(`
            <h2 class="text-xl font-bold mb-4">司機配送記錄</h2>
            ${tableContent}
            <div class="mt-6 flex justify-end">
                <button onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    關閉
                </button>
            </div>
        `);
    } catch (error) {
        showNotification('無法載入配送記錄', 'error');
    }
}

// View vehicle details
async function viewVehicleDetails(vehicleId) {
    try {
        const response = await fetch(`${API_BASE}/vehicles/${vehicleId}`);
        if (!response.ok) throw new Error('Failed to fetch vehicle details');
        
        const vehicle = await response.json();
        
        const modalContent = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">車牌號碼</p>
                    <p class="font-medium">${vehicle.plate_number}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">車型</p>
                    <p class="font-medium">${vehicle.vehicle_type || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">品牌</p>
                    <p class="font-medium">${vehicle.brand || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">型號</p>
                    <p class="font-medium">${vehicle.model || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">年份</p>
                    <p class="font-medium">${vehicle.year || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">燃料類型</p>
                    <p class="font-medium">${vehicle.fuel_type || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">最大載重</p>
                    <p class="font-medium">${vehicle.max_load_kg || 0} 公斤</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">最大瓦斯桶數</p>
                    <p class="font-medium">${vehicle.max_cylinders || 0} 桶</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">狀態</p>
                    <p class="font-medium">
                        <span class="px-2 py-1 text-xs rounded-full ${vehicle.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${vehicle.is_active ? '啟用' : '停用'}
                        </span>
                    </p>
                </div>
                ${vehicle.maintenance_status ? `
                <div>
                    <p class="text-sm text-gray-600">維修狀態</p>
                    <p class="font-medium">
                        <span class="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                            維修中
                        </span>
                    </p>
                </div>
                ` : ''}
            </div>
        `;
        
        const modal = createModal(`
            <h2 class="text-xl font-bold mb-4">車輛詳細資料</h2>
            ${modalContent}
            <div class="mt-6 flex justify-end">
                <button onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    關閉
                </button>
            </div>
        `);
    } catch (error) {
        showNotification('無法載入車輛資料', 'error');
    }
}

// View delivery details
async function viewDeliveryDetails(deliveryId) {
    try {
        const response = await fetch(`${API_BASE}/deliveries/${deliveryId}`);
        if (!response.ok) throw new Error('Failed to fetch delivery details');
        
        const delivery = await response.json();
        
        const modalContent = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">配送編號</p>
                    <p class="font-medium">#${delivery.id}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">狀態</p>
                    <p class="font-medium">
                        <span class="px-2 py-1 text-xs rounded-full ${getStatusColor(delivery.status)}">
                            ${getStatusText(delivery.status)}
                        </span>
                    </p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">客戶</p>
                    <p class="font-medium">${delivery.client_name || '-'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">司機</p>
                    <p class="font-medium">${delivery.driver_name || '未指派'}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">預定日期</p>
                    <p class="font-medium">${formatDate(delivery.scheduled_date)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">預定時段</p>
                    <p class="font-medium">${delivery.scheduled_time_slot || '-'}</p>
                </div>
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">配送地址</p>
                    <p class="font-medium">${delivery.delivery_address}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">瓦斯數量</p>
                    <p class="font-medium">${delivery.gas_quantity} 桶</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">總金額</p>
                    <p class="font-medium">NT$ ${delivery.total_amount || 0}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">付款方式</p>
                    <p class="font-medium">${getPaymentMethodText(delivery.payment_method)}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">需要回收空桶</p>
                    <p class="font-medium">${delivery.requires_empty_cylinder_return ? '是' : '否'}</p>
                </div>
                ${delivery.notes ? `
                <div class="col-span-2">
                    <p class="text-sm text-gray-600">備註</p>
                    <p class="font-medium">${delivery.notes}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        const modal = createModal(`
            <h2 class="text-xl font-bold mb-4">配送單詳細資料</h2>
            ${modalContent}
            <div class="mt-6 flex justify-end gap-2">
                ${delivery.status === 'pending' ? `
                    <button onclick="assignDriver(${delivery.id})" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        指派司機
                    </button>
                ` : ''}
                <button onclick="updateDeliveryStatus(${delivery.id}, '${delivery.status}')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    更新狀態
                </button>
                <button onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    關閉
                </button>
            </div>
        `);
    } catch (error) {
        showNotification('無法載入配送單資料', 'error');
    }
}

// Assign driver to delivery
async function assignDriver(deliveryId) {
    try {
        // Get available drivers
        const driversResponse = await fetch(`${API_BASE}/drivers?is_available=true`);
        if (!driversResponse.ok) throw new Error('Failed to fetch drivers');
        
        const driversData = await driversResponse.json();
        const availableDrivers = driversData.items || [];
        
        if (availableDrivers.length === 0) {
            showNotification('沒有可用的司機', 'warning');
            return;
        }
        
        const driverOptions = availableDrivers.map(driver => 
            `<option value="${driver.id}">${driver.name}</option>`
        ).join('');
        
        const modalContent = `
            <h2 class="text-xl font-bold mb-4">指派司機</h2>
            <form id="assign-driver-form">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">選擇司機</label>
                    <select name="driver_id" required class="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500">
                        <option value="">請選擇司機</option>
                        ${driverOptions}
                    </select>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 text-gray-600 hover:text-gray-800">
                        取消
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        確定指派
                    </button>
                </div>
            </form>
        `;
        
        const modal = createModal(modalContent);
        
        // Add form handler
        const form = modal.querySelector('#assign-driver-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const driverId = form.driver_id.value;
            
            try {
                const response = await fetch(`${API_BASE}/deliveries/${deliveryId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        driver_id: parseInt(driverId),
                        status: 'assigned'
                    })
                });
                
                if (response.ok) {
                    showNotification('司機指派成功', 'success');
                    closeModal(modal);
                    loadDeliveries();
                } else {
                    throw new Error('Assignment failed');
                }
            } catch (error) {
                showNotification('指派失敗: ' + error.message, 'error');
            }
        });
    } catch (error) {
        showNotification('無法載入司機列表', 'error');
    }
}

// Helper function to get payment method text
function getPaymentMethodText(method) {
    const methods = {
        'cash': '現金',
        'transfer': '轉帳',
        'monthly_billing': '月結'
    };
    return methods[method] || method;
}

// Alias functions to match HTML calls
function viewDelivery(deliveryId) {
    return viewDeliveryDetails(deliveryId);
}

function assignDelivery(deliveryId) {
    return assignDriver(deliveryId);
}