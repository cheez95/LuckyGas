/**
 * Validation and sanitization utilities will be loaded as separate scripts
 * They should be included in the HTML before app.js
 */

/**
 * Security Utilities for XSS Prevention
 * Inline version to ensure immediate availability
 */
const SecurityUtils = {
    escapeHtml: function(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    },
    
    createTextNode: function(text) {
        return document.createTextNode(String(text || ''));
    },
    
    createElement: function(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'id') {
                element.id = value;
            } else if (key.startsWith('data-')) {
                element.setAttribute(key, value);
            } else if (key === 'onclick' && typeof value === 'function') {
                element.addEventListener('click', value);
            } else if (key === 'title') {
                element.title = value;
            } else {
                element.setAttribute(key, String(value));
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(this.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    },
    
    createOption: function(value, text, selected = false) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = String(text);
        if (selected) option.selected = true;
        return option;
    }
};

/**
 * CSRF Protection Module
 * Inline implementation for immediate availability
 */
const CSRFManager = {
    TOKEN_KEY: window.APP_CONFIG?.STORAGE_KEYS?.CSRF_TOKEN || 'csrf_token',
    TOKEN_HEADER: window.APP_CONFIG?.SECURITY?.CSRF?.TOKEN_HEADER || 'X-CSRF-Token',
    TOKEN_EXPIRY: window.APP_CONFIG?.SECURITY?.CSRF?.TOKEN_EXPIRY || 24 * 60 * 60 * 1000, // 24 hours
    
    _generateSecureToken: function() {
        const tokenLength = window.APP_CONFIG?.SECURITY?.CSRF?.TOKEN_LENGTH || 32;
        const array = new Uint8Array(tokenLength);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },
    
    _getStoredToken: function() {
        try {
            const stored = localStorage.getItem(this.TOKEN_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('Failed to parse CSRF token:', e);
            return null;
        }
    },
    
    _isTokenExpired: function(tokenData) {
        if (!tokenData || !tokenData.createdAt) return true;
        return Date.now() - tokenData.createdAt > this.TOKEN_EXPIRY;
    },
    
    _generateNewToken: function() {
        const token = this._generateSecureToken();
        const tokenData = {
            value: token,
            createdAt: Date.now()
        };
        localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
        return token;
    },
    
    getToken: function() {
        const storedToken = this._getStoredToken();
        if (!storedToken || this._isTokenExpired(storedToken)) {
            return this._generateNewToken();
        }
        return storedToken.value;
    },
    
    getHeaders: function() {
        return {
            [this.TOKEN_HEADER]: this.getToken()
        };
    },
    
    refreshToken: function() {
        return this._generateNewToken();
    }
};

// Initialize CSRF token
CSRFManager.getToken();

/**
 * Secure Fetch Wrapper
 * Automatically adds CSRF protection to API requests
 */
const PROTECTED_METHODS = window.APP_CONSTANTS?.PROTECTED_METHODS || ['POST', 'PUT', 'DELETE', 'PATCH'];

async function secureFetch(url, options = {}) {
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    // Add CSRF token for protected methods
    const method = (config.method || 'GET').toUpperCase();
    if (PROTECTED_METHODS.includes(method)) {
        Object.assign(config.headers, CSRFManager.getHeaders());
    }
    
    try {
        const response = await fetch(url, config);
        
        // Handle CSRF token refresh if needed
        if (response.status === 403 && response.headers.get('X-CSRF-Error') === 'invalid-token') {
            // Refresh token and retry once
            CSRFManager.refreshToken();
            Object.assign(config.headers, CSRFManager.getHeaders());
            return fetch(url, config);
        }
        
        return response;
    } catch (error) {
        console.error('Secure fetch error:', error);
        throw error;
    }
}

// API Base URL
const API_BASE = window.APP_CONFIG?.API?.BASE_URL || 'http://localhost:8000/api';

// State
let currentPage = window.APP_CONSTANTS?.PAGES?.DASHBOARD || 'dashboard';
let currentClientPage = 1;
let currentDeliveryPage = 1;
let currentRoutePage = 1;
let allClients = [];
let allDrivers = [];
let allVehicles = [];
let allDeliveries = [];
let allRoutes = [];
let selectedRouteClients = [];

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

// Delivery tab state - restore from localStorage if available
let currentDeliveryTab = localStorage.getItem(window.APP_CONFIG?.STORAGE_KEYS?.CURRENT_TAB || 'currentDeliveryTab') || window.APP_CONSTANTS?.TABS?.PLANNED || 'planned';
let isLoadingDeliveries = false; // Flag to prevent recursive calls

let routeFilters = {
    dateFrom: '',
    dateTo: '',
    area: '',
    driverId: ''
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set current date in header
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString('zh-TW');
    }
    
    setupNavigation();
    setupDateDefaults();
    
    // Check if there's a hash in the URL
    const initialHash = window.location.hash;
    if (initialHash && initialHash.length > 1) {
        // Navigate to the specified section
        const section = initialHash.substring(1);
        console.log('Navigating to section from URL hash:', section);
        showSection(section);
    } else {
        // Load dashboard as default
        console.log('Loading dashboard as default...');
        showSection('dashboard');
    }
    
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
                    // Update the URL hash
                    window.location.hash = section;
                    showSection(section);
                } else {
                    console.error('Invalid navigation link:', href);
                    showNotification('導航錯誤', 'error');
                }
            });
        });
        
        // Handle browser back/forward buttons
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash;
            if (hash && hash.length > 1) {
                const section = hash.substring(1);
                showSection(section);
            }
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
        const navActiveClasses = window.APP_CONSTANTS?.CSS_CLASSES?.NAV_ACTIVE?.split(' ') || ['text-blue-200', 'font-bold'];
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove(...navActiveClasses);
            if (link.getAttribute('href') === `#${section}`) {
                link.classList.add(...navActiveClasses);
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
                    // Restore tab state when first showing deliveries section
                    const savedTab = localStorage.getItem(window.APP_CONFIG?.STORAGE_KEYS?.CURRENT_TAB || 'currentDeliveryTab');
                    if (savedTab && savedTab !== currentDeliveryTab) {
                        // Update the tab without triggering a reload
                        currentDeliveryTab = savedTab;
                        // Update UI to reflect saved tab
                        const plannedTab = document.getElementById('tab-planned');
                        const historyTab = document.getElementById('tab-history');
                        if (plannedTab && historyTab) {
                            const tabActiveClasses = window.APP_CONSTANTS?.CSS_CLASSES?.TAB_ACTIVE?.split(' ') || ['bg-white', 'text-blue-600', 'shadow'];
                            const tabInactiveClasses = window.APP_CONSTANTS?.CSS_CLASSES?.TAB_INACTIVE?.split(' ') || ['text-gray-600', 'hover:text-gray-800'];
                            if (savedTab === 'planned') {
                                plannedTab.classList.add(...tabActiveClasses);
                                plannedTab.classList.remove(...tabInactiveClasses);
                                historyTab.classList.remove(...tabActiveClasses);
                                historyTab.classList.add(...tabInactiveClasses);
                            } else {
                                historyTab.classList.add(...tabActiveClasses);
                                historyTab.classList.remove(...tabInactiveClasses);
                                plannedTab.classList.remove(...tabActiveClasses);
                                plannedTab.classList.add(...tabInactiveClasses);
                            }
                        }
                    }
                    loadDeliveries();
                    break;
                case 'routes':
                    loadRoutes();
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

// Delivery tab switching
function switchDeliveryTab(tab) {
    currentDeliveryTab = tab;
    
    // Save tab selection to localStorage
    localStorage.setItem(window.APP_CONFIG?.STORAGE_KEYS?.CURRENT_TAB || 'currentDeliveryTab', tab);
    
    // Update tab buttons
    const plannedTab = document.getElementById('tab-planned');
    const historyTab = document.getElementById('tab-history');
    
    const tabActiveClasses = window.APP_CONSTANTS?.CSS_CLASSES?.TAB_ACTIVE?.split(' ') || ['bg-white', 'text-blue-600', 'shadow'];
    const tabInactiveClasses = window.APP_CONSTANTS?.CSS_CLASSES?.TAB_INACTIVE?.split(' ') || ['text-gray-600', 'hover:text-gray-800'];
    
    if (tab === 'planned') {
        plannedTab.classList.add(...tabActiveClasses);
        plannedTab.classList.remove(...tabInactiveClasses);
        historyTab.classList.remove(...tabActiveClasses);
        historyTab.classList.add(...tabInactiveClasses);
    } else {
        historyTab.classList.add(...tabActiveClasses);
        historyTab.classList.remove(...tabInactiveClasses);
        plannedTab.classList.remove(...tabActiveClasses);
        plannedTab.classList.add(...tabInactiveClasses);
    }
    
    // Update status filter dropdown options
    const statusFilter = document.getElementById('delivery-status');
    if (statusFilter) {
        // Clear existing options safely
        while (statusFilter.firstChild) {
            statusFilter.removeChild(statusFilter.firstChild);
        }
        
        // Add default option
        statusFilter.appendChild(SecurityUtils.createOption('', '所有狀態'));
        
        if (tab === 'planned') {
            statusFilter.appendChild(SecurityUtils.createOption('pending', '待處理'));
            statusFilter.appendChild(SecurityUtils.createOption('assigned', '已指派'));
            statusFilter.appendChild(SecurityUtils.createOption('in_progress', '配送中'));
        } else {
            statusFilter.appendChild(SecurityUtils.createOption('completed', '已完成'));
            statusFilter.appendChild(SecurityUtils.createOption('cancelled', '已取消'));
        }
        
        // Reset the status filter
        statusFilter.value = '';
        deliveryFilters.status = '';
    }
    
    // Reset to first page and reload deliveries with appropriate filter
    currentDeliveryPage = 1;
    loadDeliveries(1);
}

// Dashboard with real data
async function loadDashboard() {
    try {
        // Show loading state
        document.getElementById('total-clients').textContent = '載入中...';
        document.getElementById('today-deliveries').textContent = '載入中...';
        document.getElementById('available-drivers').textContent = '載入中...';
        document.getElementById('available-vehicles').textContent = '載入中...';
        
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
        
        // Load charts with data from stats
        loadWeeklyDeliveryChartFromStats(stats.week_trend);
        loadStatusChartFromStats(stats.today_deliveries);
        
        // Load recent activities from stats
        loadRecentActivitiesFromStats(stats.recent_activities);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('載入儀表板失敗', 'error');
        
        // Show error state
        document.getElementById('total-clients').textContent = '-';
        document.getElementById('today-deliveries').textContent = '-';
        document.getElementById('available-drivers').textContent = '-';
        document.getElementById('available-vehicles').textContent = '-';
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
                    borderColor: window.APP_CONSTANTS?.CHART_COLORS?.PRIMARY || 'rgb(59, 130, 246)',
                    backgroundColor: window.APP_CONSTANTS?.CHART_COLORS?.PRIMARY_ALPHA || 'rgba(59, 130, 246, 0.1)',
                    tension: window.APP_CONFIG?.UI?.CHARTS?.LINE_TENSION || 0.1
                }, {
                    label: '已完成',
                    data: completedData,
                    borderColor: window.APP_CONSTANTS?.CHART_COLORS?.SUCCESS || 'rgb(34, 197, 94)',
                    backgroundColor: window.APP_CONSTANTS?.CHART_COLORS?.SUCCESS_ALPHA || 'rgba(34, 197, 94, 0.1)',
                    tension: window.APP_CONFIG?.UI?.CHARTS?.LINE_TENSION || 0.1
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
    if (window.statusChart && typeof window.statusChart.destroy === 'function') {
        window.statusChart.destroy();
    }

    window.statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['已完成', '待配送', '配送中', '已取消'],
            datasets: [{
                data: [completed, pending, inProgress, cancelled],
                backgroundColor: [
                    window.APP_CONSTANTS?.CHART_COLORS?.SUCCESS || 'rgba(34, 197, 94, 0.8)',
                    window.APP_CONSTANTS?.CHART_COLORS?.WARNING || 'rgba(251, 191, 36, 0.8)',
                    window.APP_CONSTANTS?.CHART_COLORS?.INFO || 'rgba(59, 130, 246, 0.8)',
                    window.APP_CONSTANTS?.CHART_COLORS?.DANGER || 'rgba(239, 68, 68, 0.8)'
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
        
        // Clear existing content safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        // Add heading
        const heading = SecurityUtils.createElement('h3', { className: 'text-lg font-semibold mb-4' }, ['最近活動']);
        container.appendChild(heading);
        
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
                
                // Create left side content
                const leftDiv = document.createElement('div');
                const clientNameP = SecurityUtils.createElement('p', { className: 'font-medium' }, 
                    [activity.client_name]);
                const scheduleP = SecurityUtils.createElement('p', { className: 'text-sm text-gray-600' }, 
                    [activity.scheduled_date + ' - ' + activity.driver_name]);
                leftDiv.appendChild(clientNameP);
                leftDiv.appendChild(scheduleP);
                
                // Create right side content
                const rightDiv = document.createElement('div');
                rightDiv.className = 'text-right';
                const statusP = SecurityUtils.createElement('p', 
                    { className: `text-sm ${statusColors[activity.status] || 'text-gray-600'}` }, 
                    [statusText]);
                const updatedP = SecurityUtils.createElement('p', { className: 'text-xs text-gray-500' }, 
                    [activity.updated_at]);
                rightDiv.appendChild(statusP);
                rightDiv.appendChild(updatedP);
                
                item.appendChild(leftDiv);
                item.appendChild(rightDiv);
                list.appendChild(item);
            });
            
            container.appendChild(list);
        } else {
            const noActivityP = SecurityUtils.createElement('p', { className: 'text-gray-500' }, 
                ['暫無最近活動']);
            container.appendChild(noActivityP);
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
            page_size: window.APP_CONFIG?.PAGINATION?.DEFAULT_PAGE_SIZE || 10
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
    // Clear existing content safely
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    
    if (clients.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.className = 'px-6 py-4 text-center text-gray-500';
        cell.textContent = '沒有找到符合條件的客戶';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }
    
    clients.forEach(client => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        
        // Cell 1: Client Code/ID
        const cell1 = document.createElement('td');
        cell1.className = 'px-6 py-4 whitespace-nowrap text-sm';
        const codeDiv = SecurityUtils.createElement('div', { className: 'text-gray-900' }, 
            [client.client_code || client.id]);
        const idDiv = SecurityUtils.createElement('div', { className: 'text-xs text-gray-500' }, 
            ['ID: ' + client.id]);
        cell1.appendChild(codeDiv);
        cell1.appendChild(idDiv);
        row.appendChild(cell1);
        
        // Cell 2: Name and Contact Info
        const cell2 = document.createElement('td');
        cell2.className = 'px-6 py-4 whitespace-nowrap';
        const nameContainer = document.createElement('div');
        
        const nameDiv = SecurityUtils.createElement('div', { className: 'font-medium' }, 
            [client.name || '-']);
        nameContainer.appendChild(nameDiv);
        
        const invoiceDiv = SecurityUtils.createElement('div', { className: 'text-sm text-gray-600' }, 
            [client.invoice_title || '-']);
        nameContainer.appendChild(invoiceDiv);
        
        if (client.contact_person) {
            const contactDiv = SecurityUtils.createElement('div', { className: 'text-xs text-gray-500' }, 
                [client.contact_person]);
            nameContainer.appendChild(contactDiv);
        }
        
        cell2.appendChild(nameContainer);
        row.appendChild(cell2);
        
        // Cell 3: Address
        const cell3 = document.createElement('td');
        cell3.className = 'px-6 py-4 text-sm';
        cell3.textContent = client.address;
        row.appendChild(cell3);
        
        // Cell 4: District
        const cell4 = document.createElement('td');
        cell4.className = 'px-6 py-4 whitespace-nowrap text-sm';
        cell4.textContent = client.district || '-';
        row.appendChild(cell4);
        
        // Cell 5: Orders
        const cell5 = document.createElement('td');
        cell5.className = 'px-6 py-4 whitespace-nowrap text-sm';
        const ordersDiv = SecurityUtils.createElement('div', {}, 
            [(client.total_orders || 0) + ' 筆']);
        cell5.appendChild(ordersDiv);
        
        if (client.last_order_date) {
            const dateDiv = SecurityUtils.createElement('div', { className: 'text-xs text-gray-500' }, 
                [formatDate(client.last_order_date)]);
            cell5.appendChild(dateDiv);
        }
        row.appendChild(cell5);
        
        // Cell 6: Status
        const cell6 = document.createElement('td');
        cell6.className = 'px-6 py-4 whitespace-nowrap';
        const statusSpan = SecurityUtils.createElement('span', 
            { className: `px-2 py-1 text-xs rounded-full ${client.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}` }, 
            [client.is_active ? '啟用' : '停用']);
        cell6.appendChild(statusSpan);
        row.appendChild(cell6);
        
        // Cell 7: Actions
        const cell7 = document.createElement('td');
        cell7.className = 'px-6 py-4 whitespace-nowrap text-sm';
        
        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'text-blue-600 hover:text-blue-900 mr-2';
        viewBtn.title = '檢視';
        viewBtn.onclick = function() { viewClient(client.client_code); };
        viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
        cell7.appendChild(viewBtn);
        
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'text-green-600 hover:text-green-900 mr-2';
        editBtn.title = '編輯';
        editBtn.onclick = function() { editClient(client.client_code); };
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        cell7.appendChild(editBtn);
        
        // Toggle status button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'text-orange-600 hover:text-orange-900';
        toggleBtn.title = client.is_active ? '停用' : '啟用';
        toggleBtn.onclick = function() { toggleClientStatus(client.client_code, client.is_active); };
        toggleBtn.innerHTML = `<i class="fas fa-${client.is_active ? 'pause' : 'play'}"></i>`;
        cell7.appendChild(toggleBtn);
        
        row.appendChild(cell7);
        tbody.appendChild(row);
    });
}

// Enhanced Deliveries with date range and filters
async function loadDeliveries(page = 1) {
    // Prevent recursive calls
    if (isLoadingDeliveries) {
        console.log('Already loading deliveries, skipping...');
        return;
    }
    
    isLoadingDeliveries = true;
    console.log('Loading deliveries for tab:', currentDeliveryTab, 'Page:', page);
    
    try {
        // No need to restore tab state here - it's handled elsewhere
        // This was causing a circular dependency with switchDeliveryTab
        
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            page_size: window.APP_CONFIG?.PAGINATION?.DEFAULT_PAGE_SIZE || 10
        });
        
        // Filter based on current tab
        if (currentDeliveryTab === 'planned') {
            // For planned tab, show pending, assigned, and in_progress deliveries
            params.append('status', 'pending');
            params.append('status', 'assigned');
            params.append('status', 'in_progress');
        } else {
            // For history tab, show completed and cancelled deliveries
            params.append('status', 'completed');
            params.append('status', 'cancelled');
        }
        
        if (deliveryFilters.dateFrom) params.append('scheduled_date_from', deliveryFilters.dateFrom);
        if (deliveryFilters.dateTo) params.append('scheduled_date_to', deliveryFilters.dateTo);
        // Only apply status filter if it's not already filtered by tab
        if (deliveryFilters.status && currentDeliveryTab === 'history') {
            params.set('status', deliveryFilters.status);
        }
        if (deliveryFilters.driverId) params.append('driver_id', deliveryFilters.driverId);
        if (deliveryFilters.clientId) params.append('client_id', deliveryFilters.clientId);
        if (deliveryFilters.sortBy) {
            params.append('order_by', deliveryFilters.sortBy);
            params.append('order_desc', deliveryFilters.sortOrder === 'desc');
        }
        
        const url = `${API_BASE}/deliveries?${params}`;
        console.log('Fetching deliveries from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('API response error:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        allDeliveries = data.items || [];
        currentDeliveryPage = page;
        
        // Render table
        renderDeliveriesTable(allDeliveries);
        
        // Update pagination
        updatePagination('deliveries', data.page, data.total_pages, data.total);
        
        // Update summary statistics
        updateDeliverySummary(data.items);
        
        // Reset loading flag
        isLoadingDeliveries = false;
        
    } catch (error) {
        console.error('Error loading deliveries:', error);
        console.error('Error stack:', error.stack);
        console.error('Current tab:', currentDeliveryTab);
        console.error('API_BASE:', API_BASE);
        
        // Show more specific error message
        let errorMessage = '載入配送單失敗';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = '無法連接到伺服器';
        } else if (error.message.includes('API error')) {
            errorMessage = `伺服器錯誤: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
        
        // Show empty state in table
        const tbody = document.getElementById('deliveries-tbody');
        if (tbody) {
            // Clear existing content safely
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }
            
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 8;
            cell.className = 'px-6 py-4 text-center text-red-500';
            cell.textContent = errorMessage;
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        
        // Reset loading flag even on error
        isLoadingDeliveries = false;
    }
}

function renderDeliveriesTable(deliveries) {
    const tbody = document.getElementById('deliveries-tbody');
    // Clear existing content safely
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    
    if (deliveries.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.className = 'px-6 py-4 text-center text-gray-500';
        cell.textContent = '沒有找到符合條件的配送單';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }
    
    deliveries.forEach(delivery => {
        const statusDisplay = window.APP_CONSTANTS?.STATUS_DISPLAY || {};
        const status = statusDisplay[delivery.status] || { 
            text: delivery.status, 
            class: 'bg-gray-100 text-gray-800' 
        };
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        
        // Cell 1: Order Number
        const cell1 = document.createElement('td');
        cell1.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium';
        cell1.textContent = delivery.order_number || delivery.id;
        row.appendChild(cell1);
        
        // Cell 2: Client Name
        const cell2 = document.createElement('td');
        cell2.className = 'px-6 py-4 whitespace-nowrap text-sm';
        cell2.textContent = delivery.client_name || '-';
        row.appendChild(cell2);
        
        // Cell 3: Delivery Address
        const cell3 = document.createElement('td');
        cell3.className = 'px-6 py-4 text-sm';
        const addressDiv = SecurityUtils.createElement('div', {}, [delivery.delivery_address]);
        const districtDiv = SecurityUtils.createElement('div', { className: 'text-xs text-gray-500' }, 
            [delivery.delivery_district || '']);
        cell3.appendChild(addressDiv);
        cell3.appendChild(districtDiv);
        row.appendChild(cell3);
        
        // Cell 4: Scheduled Date/Time
        const cell4 = document.createElement('td');
        cell4.className = 'px-6 py-4 whitespace-nowrap text-sm';
        const dateDiv = SecurityUtils.createElement('div', {}, [formatDate(delivery.scheduled_date)]);
        const timeDiv = SecurityUtils.createElement('div', { className: 'text-xs text-gray-500' }, 
            [delivery.scheduled_time_slot || '-']);
        cell4.appendChild(dateDiv);
        cell4.appendChild(timeDiv);
        row.appendChild(cell4);
        
        // Cell 5: Quantity/Amount
        const cell5 = document.createElement('td');
        cell5.className = 'px-6 py-4 whitespace-nowrap text-sm';
        cell5.textContent = `${delivery.gas_quantity} 桶 / $${delivery.total_amount}`;
        row.appendChild(cell5);
        
        // Cell 6: Status
        const cell6 = document.createElement('td');
        cell6.className = 'px-6 py-4 whitespace-nowrap';
        const statusSpan = SecurityUtils.createElement('span', 
            { className: `px-2 py-1 text-xs rounded-full ${status.class}` }, 
            [status.text]);
        cell6.appendChild(statusSpan);
        row.appendChild(cell6);
        
        // Cell 7: Driver Name
        const cell7 = document.createElement('td');
        cell7.className = 'px-6 py-4 whitespace-nowrap text-sm';
        cell7.textContent = delivery.driver_name || '-';
        row.appendChild(cell7);
        
        // Cell 8: Actions
        const cell8 = document.createElement('td');
        cell8.className = 'px-6 py-4 whitespace-nowrap text-sm';
        
        // Assign button (only for pending deliveries)
        if (delivery.status === 'pending') {
            const assignBtn = document.createElement('button');
            assignBtn.className = 'text-blue-600 hover:text-blue-900 mr-2';
            assignBtn.title = '指派';
            assignBtn.onclick = function() { assignDelivery(delivery.id); };
            assignBtn.innerHTML = '<i class="fas fa-user-plus"></i>';
            cell8.appendChild(assignBtn);
        }
        
        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'text-green-600 hover:text-green-900 mr-2';
        viewBtn.title = '檢視';
        viewBtn.onclick = function() { viewDelivery(delivery.id); };
        viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
        cell8.appendChild(viewBtn);
        
        // Update status button (not for completed/cancelled)
        if (delivery.status !== 'completed' && delivery.status !== 'cancelled') {
            const updateBtn = document.createElement('button');
            updateBtn.className = 'text-purple-600 hover:text-purple-900';
            updateBtn.title = '更新狀態';
            updateBtn.onclick = function() { updateDeliveryStatus(delivery.id, delivery.status); };
            updateBtn.innerHTML = '<i class="fas fa-sync"></i>';
            cell8.appendChild(updateBtn);
        }
        
        row.appendChild(cell8);
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
    
    // Update summary display based on current tab
    const summaryContainer = document.getElementById('delivery-summary');
    if (summaryContainer) {
        let statusColumns = '';
        
        if (currentDeliveryTab === 'planned') {
            // For planned tab: show pending, assigned, and in_progress
            statusColumns = `
                <div>
                    <p class="text-gray-600">待處理</p>
                    <p class="font-bold text-yellow-600 text-lg">${summary.byStatus.pending}</p>
                </div>
                <div>
                    <p class="text-gray-600">已指派</p>
                    <p class="font-bold text-blue-600 text-lg">${summary.byStatus.assigned}</p>
                </div>
                <div>
                    <p class="text-gray-600">配送中</p>
                    <p class="font-bold text-purple-600 text-lg">${summary.byStatus.in_progress}</p>
                </div>
            `;
        } else {
            // For history tab: show completed and cancelled
            statusColumns = `
                <div>
                    <p class="text-gray-600">已完成</p>
                    <p class="font-bold text-green-600 text-lg">${summary.byStatus.completed}</p>
                </div>
                <div>
                    <p class="text-gray-600">已取消</p>
                    <p class="font-bold text-red-600 text-lg">${summary.byStatus.cancelled}</p>
                </div>
            `;
        }
        
        // Clear existing content safely
        while (summaryContainer.firstChild) {
            summaryContainer.removeChild(summaryContainer.firstChild);
        }
        
        // Create main container
        const mainDiv = SecurityUtils.createElement('div', { className: 'bg-white rounded-lg shadow p-4 mb-6' }, []);
        
        // Add heading
        const heading = SecurityUtils.createElement('h3', { className: 'font-semibold mb-3' }, ['配送摘要']);
        mainDiv.appendChild(heading);
        
        // Create grid container
        const gridDiv = SecurityUtils.createElement('div', { className: 'grid grid-cols-2 md:grid-cols-5 gap-4 text-sm' }, []);
        
        // Add total count
        const totalDiv = document.createElement('div');
        totalDiv.appendChild(SecurityUtils.createElement('p', { className: 'text-gray-600' }, ['總筆數']));
        totalDiv.appendChild(SecurityUtils.createElement('p', { className: 'font-bold text-lg' }, [String(summary.total)]));
        gridDiv.appendChild(totalDiv);
        
        // Add total amount
        const amountDiv = document.createElement('div');
        amountDiv.appendChild(SecurityUtils.createElement('p', { className: 'text-gray-600' }, ['總金額']));
        amountDiv.appendChild(SecurityUtils.createElement('p', { className: 'font-bold text-lg' }, ['$' + summary.totalAmount.toLocaleString()]));
        gridDiv.appendChild(amountDiv);
        
        // Add total gas
        const gasDiv = document.createElement('div');
        gasDiv.appendChild(SecurityUtils.createElement('p', { className: 'text-gray-600' }, ['總瓦斯桶數']));
        gasDiv.appendChild(SecurityUtils.createElement('p', { className: 'font-bold text-lg' }, [String(summary.totalGas)]));
        gridDiv.appendChild(gasDiv);
        
        // Add status columns based on current tab
        if (currentDeliveryTab === 'planned') {
            // For planned tab: show pending, assigned, and in_progress
            const pendingDiv = document.createElement('div');
            pendingDiv.appendChild(SecurityUtils.createElement('p', { className: 'text-gray-600' }, ['待處理']));
            pendingDiv.appendChild(SecurityUtils.createElement('p', { className: 'font-bold text-yellow-600 text-lg' }, [String(summary.byStatus.pending)]));
            gridDiv.appendChild(pendingDiv);
            
            const assignedDiv = document.createElement('div');
            assignedDiv.appendChild(SecurityUtils.createElement('p', { className: 'text-gray-600' }, ['已指派']));
            assignedDiv.appendChild(SecurityUtils.createElement('p', { className: 'font-bold text-blue-600 text-lg' }, [String(summary.byStatus.assigned)]));
            gridDiv.appendChild(assignedDiv);
            
            const inProgressDiv = document.createElement('div');
            inProgressDiv.appendChild(SecurityUtils.createElement('p', { className: 'text-gray-600' }, ['配送中']));
            inProgressDiv.appendChild(SecurityUtils.createElement('p', { className: 'font-bold text-purple-600 text-lg' }, [String(summary.byStatus.in_progress)]));
            gridDiv.appendChild(inProgressDiv);
        } else {
            // For history tab: show completed and cancelled
            const completedDiv = document.createElement('div');
            completedDiv.appendChild(SecurityUtils.createElement('p', { className: 'text-gray-600' }, ['已完成']));
            completedDiv.appendChild(SecurityUtils.createElement('p', { className: 'font-bold text-green-600 text-lg' }, [String(summary.byStatus.completed)]));
            gridDiv.appendChild(completedDiv);
            
            const cancelledDiv = document.createElement('div');
            cancelledDiv.appendChild(SecurityUtils.createElement('p', { className: 'text-gray-600' }, ['已取消']));
            cancelledDiv.appendChild(SecurityUtils.createElement('p', { className: 'font-bold text-red-600 text-lg' }, [String(summary.byStatus.cancelled)]));
            gridDiv.appendChild(cancelledDiv);
        }
        
        mainDiv.appendChild(gridDiv);
        summaryContainer.appendChild(mainDiv);
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

function getStatusBadge(status) {
    const statusConfig = {
        'pending': { 
            text: '待配送', 
            bgColor: 'bg-yellow-100', 
            textColor: 'text-yellow-800' 
        },
        'assigned': { 
            text: '已分配', 
            bgColor: 'bg-blue-100', 
            textColor: 'text-blue-800' 
        },
        'in_progress': { 
            text: '配送中', 
            bgColor: 'bg-indigo-100', 
            textColor: 'text-indigo-800' 
        },
        'completed': { 
            text: '已完成', 
            bgColor: 'bg-green-100', 
            textColor: 'text-green-800' 
        },
        'cancelled': { 
            text: '已取消', 
            bgColor: 'bg-red-100', 
            textColor: 'text-red-800' 
        }
    };
    
    const config = statusConfig[status] || { 
        text: status, 
        bgColor: 'bg-gray-100', 
        textColor: 'text-gray-800' 
    };
    
    return `<span class="px-2 py-1 text-xs rounded-full ${config.bgColor} ${config.textColor}">${config.text}</span>`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showNotification(message, type = 'info') {
    const notificationClasses = {
        'success': window.APP_CONSTANTS?.CSS_CLASSES?.NOTIFICATION_SUCCESS || 'bg-green-600',
        'error': window.APP_CONSTANTS?.CSS_CLASSES?.NOTIFICATION_ERROR || 'bg-red-600',
        'info': window.APP_CONSTANTS?.CSS_CLASSES?.NOTIFICATION_INFO || 'bg-blue-600'
    };
    
    const icons = {
        'success': window.APP_CONSTANTS?.ICONS?.SUCCESS || 'fas fa-check-circle',
        'error': window.APP_CONSTANTS?.ICONS?.ERROR || 'fas fa-exclamation-circle',
        'info': window.APP_CONSTANTS?.ICONS?.INFO || 'fas fa-info-circle'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded shadow-lg text-white z-50 ${notificationClasses[type] || notificationClasses.info}`;
    
    const iconElement = document.createElement('i');
    iconElement.className = `${icons[type] || icons.info} mr-2`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex items-center';
    messageDiv.appendChild(iconElement);
    messageDiv.appendChild(document.createTextNode(message));
    
    notification.appendChild(messageDiv);
    document.body.appendChild(notification);
    
    // Fade in
    const fadeInDelay = window.APP_CONFIG?.UI?.ANIMATION?.FAST || 10;
    setTimeout(() => notification.classList.add('opacity-100'), fadeInDelay);
    
    // Remove after configured duration
    const duration = window.APP_CONFIG?.UI?.NOTIFICATION?.DURATION || 3000;
    const fadeOutDuration = window.APP_CONFIG?.UI?.NOTIFICATION?.FADE_DURATION || 300;
    
    setTimeout(() => {
        notification.classList.add('opacity-0');
        setTimeout(() => notification.remove(), fadeOutDuration);
    }, duration);
}

// Enhanced client functions
async function viewClient(clientCode) {
    try {
        const response = await fetch(`${API_BASE}/clients/by-code/${clientCode}`);
        const client = await response.json();
        
        // Create modal content with tabs
        const modalContent = `
            <div class="client-detail-modal">
                <!-- Tabs -->
                <div class="border-b border-gray-200 mb-4">
                    <nav class="-mb-px flex space-x-8">
                        <button onclick="switchClientTab('info')" id="client-info-tab" 
                                class="client-tab-btn active py-2 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600">
                            客戶資訊
                        </button>
                        <button onclick="switchClientTab('deliveries')" id="client-deliveries-tab" 
                                class="client-tab-btn py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
                            配送紀錄
                        </button>
                    </nav>
                </div>
                
                <!-- Tab Content -->
                <div id="client-info-content" class="client-tab-content">
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
                </div>
                
                <div id="client-deliveries-content" class="client-tab-content hidden">
                    <div id="client-deliveries-loading" class="text-center py-8">
                        <i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
                        <p class="text-gray-500 mt-2">載入配送紀錄中...</p>
                    </div>
                    <div id="client-deliveries-container" class="hidden"></div>
                </div>
            </div>
        `;
        
        showModal('客戶詳細資料', modalContent);
        
        // Store client code for deliveries loading
        window.currentViewingClientCode = clientCode;
        
    } catch (error) {
        showNotification('載入客戶資料失敗', 'error');
    }
}

// Tab switching function
function switchClientTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.client-tab-btn').forEach(btn => {
        btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    const activeTab = document.getElementById(`client-${tab}-tab`);
    activeTab.classList.remove('border-transparent', 'text-gray-500');
    activeTab.classList.add('active', 'border-blue-500', 'text-blue-600');
    
    // Update content
    document.querySelectorAll('.client-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    document.getElementById(`client-${tab}-content`).classList.remove('hidden');
    
    // Load deliveries if switching to deliveries tab
    if (tab === 'deliveries' && window.currentViewingClientCode) {
        loadClientDeliveries(window.currentViewingClientCode);
    }
}

// Make switchClientTab globally accessible
window.switchClientTab = switchClientTab;

// Load client deliveries
async function loadClientDeliveries(clientCode, page = 1) {
    try {
        const loadingDiv = document.getElementById('client-deliveries-loading');
        const containerDiv = document.getElementById('client-deliveries-container');
        
        // Show loading
        loadingDiv.classList.remove('hidden');
        containerDiv.classList.add('hidden');
        
        // Fetch deliveries
        const response = await fetch(`${API_BASE}/clients/by-code/${clientCode}/deliveries?page=${page}&page_size=10`);
        const data = await response.json();
        
        // Hide loading
        loadingDiv.classList.add('hidden');
        containerDiv.classList.remove('hidden');
        
        // Render deliveries
        renderClientDeliveries(data, clientCode);
        
    } catch (error) {
        console.error('Error loading client deliveries:', error);
        document.getElementById('client-deliveries-loading').classList.add('hidden');
        document.getElementById('client-deliveries-container').innerHTML = `
            <div class="text-center py-8 text-red-600">
                <i class="fas fa-exclamation-circle text-3xl mb-2"></i>
                <p>載入配送紀錄失敗</p>
            </div>
        `;
        document.getElementById('client-deliveries-container').classList.remove('hidden');
    }
}

// Render client deliveries
function renderClientDeliveries(data, clientCode) {
    const container = document.getElementById('client-deliveries-container');
    
    if (!data.items || data.items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-box-open text-3xl mb-2"></i>
                <p>尚無配送紀錄</p>
            </div>
        `;
        return;
    }
    
    // Calculate summary statistics
    const stats = calculateDeliveryStats(data.items);
    
    container.innerHTML = `
        <!-- Summary Statistics -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 rounded-lg p-4">
                <p class="text-sm text-blue-600">總配送次數</p>
                <p class="text-2xl font-bold text-blue-800">${stats.totalCount}</p>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
                <p class="text-sm text-green-600">已完成</p>
                <p class="text-2xl font-bold text-green-800">${stats.completed}</p>
            </div>
            <div class="bg-purple-50 rounded-lg p-4">
                <p class="text-sm text-purple-600">總瓦斯量</p>
                <p class="text-2xl font-bold text-purple-800">${stats.totalGas.toFixed(1)} 公斤</p>
            </div>
            <div class="bg-orange-50 rounded-lg p-4">
                <p class="text-sm text-orange-600">總金額</p>
                <p class="text-2xl font-bold text-orange-800">$${stats.totalAmount.toLocaleString()}</p>
            </div>
        </div>
        
        <!-- Deliveries Table -->
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">訂單編號</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配送日期</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">瓦斯量</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">司機</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${data.items.map(delivery => `
                        <tr class="hover:bg-gray-50 cursor-pointer transition-colors" onclick="viewDelivery(${delivery.id})">
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                #${delivery.order_number || delivery.id}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                ${formatDate(delivery.scheduled_date)}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">
                                ${getStatusBadge(delivery.status)}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                ${delivery.total_quantity || 0} kg
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                                $${(delivery.total_amount || 0).toLocaleString()}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                ${delivery.driver_name || '-'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Pagination -->
        ${data.total_pages > 1 ? `
            <div class="flex justify-center mt-4">
                <nav class="flex space-x-2">
                    ${data.page > 1 ? `
                        <button onclick="loadClientDeliveries('${clientCode}', ${data.page - 1})" 
                                class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                    ` : ''}
                    
                    ${Array.from({length: Math.min(5, data.total_pages)}, (_, i) => {
                        const pageNum = i + 1;
                        const isActive = pageNum === data.page;
                        return `
                            <button onclick="loadClientDeliveries('${clientCode}', ${pageNum})" 
                                    class="px-3 py-1 text-sm ${isActive ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'} border rounded hover:bg-gray-50">
                                ${pageNum}
                            </button>
                        `;
                    }).join('')}
                    
                    ${data.page < data.total_pages ? `
                        <button onclick="loadClientDeliveries('${clientCode}', ${data.page + 1})" 
                                class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    ` : ''}
                </nav>
            </div>
        ` : ''}
    `;
}

// Make loadClientDeliveries globally accessible
window.loadClientDeliveries = loadClientDeliveries;

// Calculate delivery statistics
function calculateDeliveryStats(deliveries) {
    return deliveries.reduce((stats, delivery) => {
        stats.totalCount++;
        if (delivery.status === 'completed') stats.completed++;
        stats.totalGas += delivery.total_quantity || 0;
        stats.totalAmount += delivery.total_amount || 0;
        return stats;
    }, {
        totalCount: 0,
        completed: 0,
        totalGas: 0,
        totalAmount: 0
    });
}

async function toggleClientStatus(clientCode, currentStatus) {
    if (!confirm(`確定要${currentStatus ? '停用' : '啟用'}此客戶嗎？`)) return;
    
    try {
        const response = await secureFetch(`${API_BASE}/clients/by-code/${clientCode}`, {
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
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
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
async function editClient(clientCode) {
    try {
        const response = await fetch(`${API_BASE}/clients/by-code/${clientCode}`);
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
            
            // Clear previous errors
            ValidationUtils.clearFormErrors(form);
            
            const formData = new FormData(form);
            
            // Define validation rules (client_code is readonly so not validated)
            const validationRules = {
                name: { required: true, type: 'name', options: { minLength: 2, maxLength: 100 } },
                invoice_title: { required: false, type: 'name', options: { minLength: 2, maxLength: 100 } },
                tax_id: { required: false, type: 'custom', validator: (value) => {
                    if (!value) return { isValid: true, message: '' };
                    if (!/^\d{8}$/.test(value)) {
                        return { isValid: false, message: '統一編號必須是8位數字' };
                    }
                    return { isValid: true, message: '' };
                }},
                contact_person: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } },
                address: { required: true, type: 'address' },
                district: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } }
            };
            
            // Get form data
            const rawData = {};
            for (let [key, value] of formData.entries()) {
                rawData[key] = value;
            }
            
            // Validate form data
            const validationResult = ValidationUtils.validateForm(rawData, validationRules);
            
            if (!validationResult.isValid) {
                ValidationUtils.displayFormErrors(form, validationResult.errors);
                showNotification('請修正表單錯誤', 'error');
                return;
            }
            
            // Sanitize data
            const sanitizationSchema = {
                client_code: { type: 'clientCode' },
                name: { type: 'string', options: { maxLength: 100 } },
                invoice_title: { type: 'string', options: { maxLength: 100 } },
                tax_id: { type: 'string', options: { maxLength: 8 } },
                contact_person: { type: 'string', options: { maxLength: 50 } },
                address: { type: 'string', options: { maxLength: 200 } },
                district: { type: 'string', options: { maxLength: 50 } },
                is_active: { type: 'boolean' }
            };
            
            const updateData = SanitizationUtils.sanitizeFormData(rawData, sanitizationSchema);
            
            try {
                const updateResponse = await secureFetch(`${API_BASE}/clients/by-code/${clientCode}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                
                if (updateResponse.ok) {
                    showNotification('客戶資料已更新', 'success');
                    closeModal(modal);
                    loadClients();
                } else {
                    const error = await updateResponse.json();
                    showNotification(error.detail || '更新失敗', 'error');
                }
            } catch (error) {
                showNotification('更新客戶資料失敗: ' + error.message, 'error');
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
                const updateResponse = await secureFetch(`${API_BASE}/drivers/${driverId}`, {
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
                const updateResponse = await secureFetch(`${API_BASE}/vehicles/${vehicleId}`, {
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
    const modal = document.getElementById('addClientModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    } else {
        console.error('Add client modal not found in DOM');
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
                const response = await secureFetch('/api/clients', {
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
            const response = await secureFetch(`${API_BASE}/deliveries/${deliveryId}`, {
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
            const response = await secureFetch(`${API_BASE}/deliveries/${deliveryId}/assign`, {
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

// Setup form handlers
function setupFormHandlers() {
    // Scheduling form handler
    const schedulingForm = document.getElementById('scheduling-form');
    if (schedulingForm) {
        schedulingForm.addEventListener('submit', handleSchedulingFormSubmit);
    }
    
    // Add client form handler
    const addClientForm = document.getElementById('add-client-form');
    if (addClientForm) {
        addClientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            ValidationUtils.clearFormErrors(addClientForm);
            
            const formData = new FormData(addClientForm);
            
            // Define validation rules
            const validationRules = {
                name: { required: true, type: 'name', options: { minLength: 2, maxLength: 100 } },
                client_code: { required: true, type: 'clientCode' },
                invoice_title: { required: true, type: 'name', options: { minLength: 2, maxLength: 100 } },
                tax_id: { required: false, type: 'custom', validator: (value) => {
                    if (!value) return { isValid: true, message: '' };
                    // Taiwan tax ID is 8 digits
                    if (!/^\d{8}$/.test(value)) {
                        return { isValid: false, message: '統一編號必須是8位數字' };
                    }
                    return { isValid: true, message: '' };
                }},
                contact_person: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } },
                address: { required: true, type: 'address' },
                district: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } }
            };
            
            // Get form data
            const rawData = {
                name: formData.get('name'),
                client_code: formData.get('client_code'),
                invoice_title: formData.get('invoice_title'),
                tax_id: formData.get('tax_id'),
                contact_person: formData.get('contact_person'),
                address: formData.get('address'),
                district: formData.get('district')
            };
            
            // Validate form data
            const validationResult = ValidationUtils.validateForm(rawData, validationRules);
            
            if (!validationResult.isValid) {
                ValidationUtils.displayFormErrors(addClientForm, validationResult.errors);
                showNotification('請修正表單錯誤', 'error');
                return;
            }
            
            // Sanitize data
            const sanitizationSchema = {
                name: { type: 'string', options: { maxLength: 100 } },
                client_code: { type: 'clientCode' },
                invoice_title: { type: 'string', options: { maxLength: 100 } },
                tax_id: { type: 'string', options: { maxLength: 8 } },
                contact_person: { type: 'string', options: { maxLength: 50 } },
                address: { type: 'string', options: { maxLength: 200 } },
                district: { type: 'string', options: { maxLength: 50 } }
            };
            
            const sanitizedData = SanitizationUtils.sanitizeFormData(rawData, sanitizationSchema);
            
            // Add default values
            const clientData = {
                ...sanitizedData,
                is_active: true
            };
            
            try {
                const response = await secureFetch(`${API_BASE}/clients`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(clientData)
                });
                
                if (response.ok) {
                    showNotification('客戶新增成功', 'success');
                    addClientForm.reset();
                    loadClients();
                } else {
                    const error = await response.json();
                    showNotification(error.detail || '新增失敗', 'error');
                }
            } catch (error) {
                showNotification('新增客戶失敗: ' + error.message, 'error');
            }
        });
    }
    
    // Add delivery form handler
    const addDeliveryForm = document.getElementById('add-delivery-form');
    if (addDeliveryForm) {
        addDeliveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            ValidationUtils.clearFormErrors(addDeliveryForm);
            
            const formData = new FormData(addDeliveryForm);
            
            // Define validation rules
            const validationRules = {
                client_id: { required: true, type: 'custom', validator: (value) => {
                    if (!value || value === '') {
                        return { isValid: false, message: '請選擇客戶' };
                    }
                    const num = parseInt(value);
                    if (isNaN(num) || num <= 0) {
                        return { isValid: false, message: '無效的客戶選擇' };
                    }
                    return { isValid: true, message: '' };
                }},
                scheduled_date: { required: true, type: 'date', options: { allowPast: false } },
                scheduled_time_slot: { required: false, type: 'custom', validator: (value) => {
                    const validSlots = ['上午 9:00-12:00', '下午 12:00-15:00', '下午 15:00-18:00', '晚上 18:00-21:00'];
                    if (value && !validSlots.includes(value)) {
                        return { isValid: false, message: '請選擇有效的時段' };
                    }
                    return { isValid: true, message: '' };
                }},
                gas_quantity: { required: true, type: 'quantity', options: { min: 1, max: 100 } },
                delivery_address: { required: true, type: 'address' },
                delivery_district: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } },
                unit_price: { required: true, type: 'amount', options: { min: 0, max: 10000 } },
                delivery_fee: { required: false, type: 'amount', options: { min: 0, max: 1000, allowZero: true } },
                payment_method: { required: true, type: 'custom', validator: (value) => {
                    const validMethods = ['cash', 'transfer', 'monthly_billing'];
                    if (!validMethods.includes(value)) {
                        return { isValid: false, message: '請選擇有效的付款方式' };
                    }
                    return { isValid: true, message: '' };
                }},
                empty_cylinders_to_return: { required: false, type: 'quantity', options: { min: 0, max: 100 } }
            };
            
            // Get form data
            const rawData = {
                client_id: formData.get('client_id'),
                scheduled_date: formData.get('scheduled_date'),
                scheduled_time_slot: formData.get('scheduled_time_slot'),
                gas_quantity: formData.get('gas_quantity'),
                delivery_address: formData.get('delivery_address'),
                delivery_district: formData.get('delivery_district'),
                unit_price: formData.get('unit_price'),
                delivery_fee: formData.get('delivery_fee'),
                payment_method: formData.get('payment_method'),
                empty_cylinders_to_return: formData.get('empty_cylinders_to_return')
            };
            
            // Validate form data
            const validationResult = ValidationUtils.validateForm(rawData, validationRules);
            
            if (!validationResult.isValid) {
                ValidationUtils.displayFormErrors(addDeliveryForm, validationResult.errors);
                showNotification('請修正表單錯誤', 'error');
                return;
            }
            
            // Sanitize data
            const sanitizationSchema = {
                client_id: { type: 'number', options: { type: 'integer', min: 1 } },
                scheduled_date: { type: 'date' },
                scheduled_time_slot: { type: 'string', options: { maxLength: 50 } },
                gas_quantity: { type: 'number', options: { type: 'integer', min: 1, max: 100 } },
                delivery_address: { type: 'string', options: { maxLength: 200 } },
                delivery_district: { type: 'string', options: { maxLength: 50 } },
                unit_price: { type: 'number', options: { type: 'float', min: 0, max: 10000, decimals: 2 } },
                delivery_fee: { type: 'number', options: { type: 'float', min: 0, max: 1000, decimals: 2, defaultValue: 0 } },
                payment_method: { type: 'string', options: { maxLength: 20 }, defaultValue: 'cash' },
                requires_empty_cylinder_return: { type: 'boolean' },
                empty_cylinders_to_return: { type: 'number', options: { type: 'integer', min: 0, max: 100, defaultValue: 0 } },
                notes: { type: 'string', options: { maxLength: 500 } }
            };
            
            // Add checkbox and notes handling
            rawData.requires_empty_cylinder_return = formData.get('requires_empty_cylinder_return') === 'on';
            rawData.notes = formData.get('notes');
            
            const deliveryData = SanitizationUtils.sanitizeFormData(rawData, sanitizationSchema);
            
            try {
                const response = await secureFetch(`${API_BASE}/deliveries`, {
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
                    const error = await response.json();
                    showNotification(error.detail || '新增失敗', 'error');
                }
            } catch (error) {
                showNotification('新增配送單失敗: ' + error.message, 'error');
            }
        });
    }
    
    // Add driver form handler
    const addDriverForm = document.getElementById('add-driver-form');
    if (addDriverForm) {
        addDriverForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Clear previous errors
            ValidationUtils.clearFormErrors(addDriverForm);
            
            const formData = new FormData(addDriverForm);
            
            // Define validation rules
            const validationRules = {
                name: { required: true, type: 'name', options: { minLength: 2, maxLength: 50 } },
                employee_id: { required: true, type: 'custom', validator: (value) => {
                    if (!value || value.trim() === '') {
                        return { isValid: false, message: '員工編號不能為空' };
                    }
                    if (value.length < 3 || value.length > 20) {
                        return { isValid: false, message: '員工編號長度必須在3-20個字符之間' };
                    }
                    if (!/^[A-Z0-9\-]+$/i.test(value)) {
                        return { isValid: false, message: '員工編號只能包含字母、數字和連字符' };
                    }
                    return { isValid: true, message: '' };
                }},
                phone: { required: true, type: 'phone' },
                id_number: { required: true, type: 'custom', validator: (value) => {
                    // Taiwan ID number validation
                    if (!value || value.trim() === '') {
                        return { isValid: false, message: '身分證字號不能為空' };
                    }
                    const idPattern = /^[A-Z][12]\d{8}$/;
                    if (!idPattern.test(value)) {
                        return { isValid: false, message: '請輸入有效的台灣身分證字號' };
                    }
                    // TODO: Add checksum validation for Taiwan ID
                    return { isValid: true, message: '' };
                }},
                address: { required: true, type: 'address' },
                emergency_contact: { required: true, type: 'name', options: { minLength: 2, maxLength: 50 } },
                emergency_phone: { required: true, type: 'phone' },
                license_number: { required: true, type: 'custom', validator: (value) => {
                    if (!value || value.trim() === '') {
                        return { isValid: false, message: '駕照號碼不能為空' };
                    }
                    if (value.length < 5 || value.length > 20) {
                        return { isValid: false, message: '駕照號碼長度無效' };
                    }
                    return { isValid: true, message: '' };
                }},
                license_type: { required: true, type: 'custom', validator: (value) => {
                    const validTypes = ['職業大貨車', '職業小型車', '普通大貨車', '普通小型車'];
                    if (!value || !validTypes.includes(value)) {
                        return { isValid: false, message: '請選擇有效的駕照類型' };
                    }
                    return { isValid: true, message: '' };
                }},
                license_expiry_date: { required: true, type: 'date', options: { allowPast: false } },
                hire_date: { required: true, type: 'date' },
                base_salary: { required: false, type: 'amount', options: { min: 0, max: 999999 } },
                commission_rate: { required: false, type: 'amount', options: { min: 0, max: 100 } }
            };
            
            // Get form data
            const rawData = {};
            for (const field of Object.keys(validationRules)) {
                rawData[field] = formData.get(field);
            }
            
            // Validate form data
            const validationResult = ValidationUtils.validateForm(rawData, validationRules);
            
            if (!validationResult.isValid) {
                ValidationUtils.displayFormErrors(addDriverForm, validationResult.errors);
                showNotification('請修正表單錯誤', 'error');
                return;
            }
            
            // Sanitize data
            const sanitizationSchema = {
                name: { type: 'string', options: { maxLength: 50 } },
                employee_id: { type: 'string', options: { maxLength: 20 } },
                phone: { type: 'phone' },
                id_number: { type: 'string', options: { maxLength: 10 } },
                address: { type: 'string', options: { maxLength: 200 } },
                emergency_contact: { type: 'string', options: { maxLength: 50 } },
                emergency_phone: { type: 'phone' },
                license_number: { type: 'string', options: { maxLength: 20 } },
                license_type: { type: 'string', options: { maxLength: 20 } },
                license_expiry_date: { type: 'date' },
                hire_date: { type: 'date' },
                base_salary: { type: 'number', options: { type: 'float', min: 0, max: 999999, decimals: 2, defaultValue: 0 } },
                commission_rate: { type: 'number', options: { type: 'float', min: 0, max: 100, decimals: 2, defaultValue: 0 } }
            };
            
            const driverData = SanitizationUtils.sanitizeFormData(rawData, sanitizationSchema);
            
            try {
                const response = await secureFetch(`${API_BASE}/drivers`, {
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
            
            // Clear previous errors
            ValidationUtils.clearFormErrors(addVehicleForm);
            
            const formData = new FormData(addVehicleForm);
            
            // Define validation rules
            const validationRules = {
                plate_number: { required: true, type: 'licensePlate' },
                vehicle_type: { required: true, type: 'custom', validator: (value) => {
                    const validTypes = ['truck', 'van', 'motorcycle'];
                    if (!value || !validTypes.includes(value)) {
                        return { isValid: false, message: '請選擇有效的車型' };
                    }
                    return { isValid: true, message: '' };
                }},
                brand: { required: true, type: 'name', options: { minLength: 2, maxLength: 50 } },
                model: { required: true, type: 'name', options: { minLength: 1, maxLength: 50, allowNumbers: true } },
                year: { required: true, type: 'custom', validator: (value) => {
                    const year = parseInt(value);
                    if (isNaN(year)) {
                        return { isValid: false, message: '請輸入有效的年份' };
                    }
                    const currentYear = new Date().getFullYear();
                    if (year < 1990 || year > currentYear + 1) {
                        return { isValid: false, message: `年份必須在1990到${currentYear + 1}之間` };
                    }
                    return { isValid: true, message: '' };
                }},
                fuel_type: { required: true, type: 'custom', validator: (value) => {
                    const validTypes = ['gasoline', 'diesel', 'electric', 'hybrid'];
                    if (!value || !validTypes.includes(value)) {
                        return { isValid: false, message: '請選擇有效的燃料類型' };
                    }
                    return { isValid: true, message: '' };
                }},
                max_load_kg: { required: true, type: 'amount', options: { min: 0, max: 50000 } },
                max_cylinders: { required: true, type: 'quantity', options: { min: 0, max: 1000 } }
            };
            
            // Get form data
            const rawData = {};
            for (const field of Object.keys(validationRules)) {
                rawData[field] = formData.get(field);
            }
            
            // Validate form data
            const validationResult = ValidationUtils.validateForm(rawData, validationRules);
            
            if (!validationResult.isValid) {
                ValidationUtils.displayFormErrors(addVehicleForm, validationResult.errors);
                showNotification('請修正表單錯誤', 'error');
                return;
            }
            
            // Sanitize data
            const sanitizationSchema = {
                plate_number: { type: 'licensePlate' },
                vehicle_type: { type: 'string', options: { maxLength: 20 } },
                brand: { type: 'string', options: { maxLength: 50 } },
                model: { type: 'string', options: { maxLength: 50 } },
                year: { type: 'number', options: { type: 'integer', min: 1990, max: new Date().getFullYear() + 1 } },
                fuel_type: { type: 'string', options: { maxLength: 20 } },
                max_load_kg: { type: 'number', options: { type: 'float', min: 0, max: 50000, decimals: 2 } },
                max_cylinders: { type: 'number', options: { type: 'integer', min: 0, max: 1000 } }
            };
            
            const vehicleData = SanitizationUtils.sanitizeFormData(rawData, sanitizationSchema);
            
            try {
                const response = await secureFetch(`${API_BASE}/vehicles`, {
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

// ========== Route Management Functions ==========

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

// Load drivers for filter dropdown
async function loadDriversForFilter(selectId) {
    try {
        const response = await fetch(`${API_BASE}/drivers?is_active=true`);
        const data = await response.json();
        const drivers = data.items || [];
        
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">所有司機</option>';
            drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver.id;
                option.textContent = `${driver.name} (${driver.employee_id})`;
                select.appendChild(option);
            });
            select.value = currentValue;
        }
    } catch (error) {
        console.error('Error loading drivers for filter:', error);
    }
}

// Load routes
async function loadRoutes(page = 1) {
    try {
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
        
        const response = await fetch(`${API_BASE}/routes?${params}`);
        if (!response.ok) throw new Error('Failed to fetch routes');
        
        const data = await response.json();
        allRoutes = data.items || [];
        currentRoutePage = page;
        
        // Load drivers for filter
        await loadDriversForFilter('route-driver');
        
        displayRoutes(allRoutes);
        updateRoutePagination(data.total, data.page, data.page_size);
        
    } catch (error) {
        console.error('Error loading routes:', error);
        showNotification('載入路線失敗', 'error');
    }
}

// Display routes in table
function displayRoutes(routes) {
    const tbody = document.getElementById('routes-tbody');
    if (!tbody) return;
    
    if (routes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-6 py-4 text-center text-gray-500">
                    沒有找到路線資料
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = routes.map(route => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${formatDate(route.route_date)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${route.route_name}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${route.area}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${route.driver_name || '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                ${route.vehicle_plate || '-'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                ${route.total_clients}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                ${route.total_distance_km.toFixed(1)} km
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${route.is_optimized ? 
                    '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">已優化</span>' :
                    '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">手動</span>'
                }
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewRoute(${route.id})" class="text-blue-600 hover:text-blue-900 mr-2" title="檢視">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="showRouteMap(${route.id})" class="text-green-600 hover:text-green-900 mr-2" title="地圖">
                    <i class="fas fa-map-marked-alt"></i>
                </button>
                <button onclick="editRoute(${route.id})" class="text-yellow-600 hover:text-yellow-900 mr-2" title="編輯">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteRoute(${route.id})" class="text-red-600 hover:text-red-900" title="刪除">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    // Update showing count
    const showingElement = document.getElementById('routes-showing');
    if (showingElement) {
        showingElement.textContent = routes.length;
    }
}

// Update route pagination
function updateRoutePagination(total, currentPage, pageSize) {
    const totalElement = document.getElementById('routes-total');
    if (totalElement) {
        totalElement.textContent = total;
    }
    
    const totalPages = Math.ceil(total / pageSize);
    const paginationContainer = document.getElementById('routes-pagination');
    if (!paginationContainer) return;
    
    let paginationHTML = '';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `
            <button onclick="loadRoutes(${currentPage - 1})" class="px-3 py-1 border rounded hover:bg-gray-100">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHTML += `
                <button class="px-3 py-1 border rounded bg-blue-600 text-white">${i}</button>
            `;
        } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `
                <button onclick="loadRoutes(${i})" class="px-3 py-1 border rounded hover:bg-gray-100">${i}</button>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += `<span class="px-2">...</span>`;
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `
            <button onclick="loadRoutes(${currentPage + 1})" class="px-3 py-1 border rounded hover:bg-gray-100">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }
    
    paginationContainer.innerHTML = paginationHTML;
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

// Handle route planning form submission
document.getElementById('route-plan-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Get selected driver and vehicle IDs
    const driverIds = Array.from(form.querySelectorAll('input[name="driver_ids"]:checked'))
        .map(input => parseInt(input.value));
    const vehicleIds = Array.from(form.querySelectorAll('input[name="vehicle_ids"]:checked'))
        .map(input => parseInt(input.value));
    
    // Build request data
    const requestData = {
        delivery_date: formData.get('delivery_date'),
        area: formData.get('area') || null,
        driver_ids: driverIds.length > 0 ? driverIds : null,
        vehicle_ids: vehicleIds.length > 0 ? vehicleIds : null,
        optimize_by: formData.get('optimize_by'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time'),
        use_traffic: formData.get('use_traffic') === 'on',
        include_break_time: formData.get('include_break_time') === 'on'
    };
    
    // Add optional parameters if provided
    if (formData.get('max_distance_km')) {
        requestData.max_distance_km = parseFloat(formData.get('max_distance_km'));
    }
    if (formData.get('max_duration_minutes')) {
        requestData.max_duration_minutes = parseInt(formData.get('max_duration_minutes'));
    }
    
    try {
        const response = await fetch(`${API_BASE}/routes/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Route planning failed');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(result.message, 'success');
            closeModal('routePlanModal');
            
            // Show optimization results
            showOptimizationResults(result);
            
            // Reload routes
            await loadRoutes(1);
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('Route planning error:', error);
        showNotification(error.message || '路線規劃失敗', 'error');
    }
});

// Show optimization results
function showOptimizationResults(result) {
    let modalContent = `
        <h2 class="text-xl font-bold mb-4">路線規劃結果</h2>
        <div class="mb-4">
            <p class="text-green-600 font-medium">${result.message}</p>
            <p class="text-sm text-gray-600 mt-2">優化耗時: ${result.optimization_time_seconds?.toFixed(2) || 0} 秒</p>
        </div>
    `;
    
    if (result.routes && result.routes.length > 0) {
        modalContent += `
            <h3 class="font-semibold mb-2">生成的路線:</h3>
            <div class="space-y-2 max-h-64 overflow-y-auto">
                ${result.routes.map(route => `
                    <div class="border rounded p-3">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-medium">${route.route_name}</p>
                                <p class="text-sm text-gray-600">
                                    司機: ${route.driver_name} | 車輛: ${route.vehicle_plate}
                                </p>
                                <p class="text-sm text-gray-600">
                                    客戶數: ${route.total_clients} | 距離: ${route.total_distance_km.toFixed(1)} km | 
                                    預估時間: ${Math.floor(route.estimated_duration_minutes / 60)}小時${route.estimated_duration_minutes % 60}分鐘
                                </p>
                            </div>
                            <button onclick="viewRoute(${route.id})" class="text-blue-600 hover:text-blue-800">
                                <i class="fas fa-eye"></i> 檢視
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    if (result.unassigned_clients && result.unassigned_clients.length > 0) {
        modalContent += `
            <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h3 class="font-semibold text-yellow-800 mb-2">未分配的客戶:</h3>
                <div class="text-sm text-yellow-700">
                    ${result.unassigned_clients.map(client => 
                        `${client.client_code} - ${client.name}`
                    ).join(', ')}
                </div>
            </div>
        `;
    }
    
    if (result.warnings && result.warnings.length > 0) {
        modalContent += `
            <div class="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
                <h3 class="font-semibold text-orange-800 mb-2">警告:</h3>
                <ul class="text-sm text-orange-700 list-disc list-inside">
                    ${result.warnings.map(warning => `<li>${warning}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    modalContent += `
        <div class="mt-6 flex justify-end">
            <button onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                確定
            </button>
        </div>
    `;
    
    const modal = createModal(modalContent);
    document.body.appendChild(modal);
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

// Show route map
async function showRouteMap(routeId) {
    try {
        const response = await fetch(`${API_BASE}/routes/${routeId}/map`);
        if (!response.ok) throw new Error('Failed to fetch route map data');
        
        const mapData = await response.json();
        
        // For now, just show the data
        // Display map data in a modal
        const modalContent = `
            <h2 class="text-xl font-bold mb-4">路線地圖</h2>
            <div class="mb-4">
                <p class="text-sm text-gray-600">路線ID: ${mapData.route_id}</p>
                <p class="text-sm text-gray-600">中心座標: ${mapData.center_lat.toFixed(6)}, ${mapData.center_lng.toFixed(6)}</p>
            </div>
            <div class="bg-gray-100 rounded p-4 mb-4">
                <h3 class="font-semibold mb-2">路線點:</h3>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                    ${mapData.markers.map((marker, index) => `
                        <div class="bg-white rounded p-2">
                            <p class="font-medium">${index + 1}. ${marker.title || marker.label}</p>
                            <p class="text-sm text-gray-600">${marker.address || ''}</p>
                            <p class="text-xs text-gray-500">座標: ${marker.lat.toFixed(6)}, ${marker.lng.toFixed(6)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="flex justify-end">
                <button onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                    關閉
                </button>
            </div>
        `;
        
        const modal = createModal(modalContent);
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error showing route map:', error);
        showNotification('載入地圖失敗', 'error');
    }
}

// Edit route
async function editRoute(routeId) {
    try {
        // Fetch route details
        const response = await fetch(`${API_BASE}/routes/${routeId}`);
        if (!response.ok) throw new Error('Failed to fetch route');
        
        const route = await response.json();
        
        // Create edit modal
        const modalContent = `
            <h2 class="text-xl font-bold mb-4">編輯路線</h2>
            <form id="edit-route-form">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">路線名稱</label>
                        <input type="text" name="route_name" value="${route.route_name}" required class="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">路線日期</label>
                        <input type="date" value="${route.route_date}" disabled class="w-full px-3 py-2 border rounded bg-gray-100">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">區域</label>
                        <input type="text" value="${route.area}" disabled class="w-full px-3 py-2 border rounded bg-gray-100">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">司機</label>
                        <select name="driver_id" class="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500">
                            ${allDrivers.map(driver => `
                                <option value="${driver.id}" ${driver.id === route.driver_id ? 'selected' : ''}>
                                    ${driver.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">車輛</label>
                        <select name="vehicle_id" class="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500">
                            ${allVehicles.map(vehicle => `
                                <option value="${vehicle.id}" ${vehicle.id === route.vehicle_id ? 'selected' : ''}>
                                    ${vehicle.plate_number} - ${vehicle.vehicle_type}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">優化狀態</label>
                        <label class="flex items-center">
                            <input type="checkbox" name="is_optimized" ${route.is_optimized ? 'checked' : ''} class="mr-2">
                            <span>已優化</span>
                        </label>
                    </div>
                </div>
                
                <div class="mt-6">
                    <h3 class="font-semibold mb-2">路線點 (${route.route_points?.length || 0} 個客戶)</h3>
                    <div class="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
                        ${route.route_points?.map((point, index) => `
                            <div class="flex justify-between items-center py-2 border-b">
                                <span class="text-sm">${index + 1}. ${point.client_name} - ${point.address}</span>
                                <span class="text-xs text-gray-500">預計到達: ${new Date(point.estimated_arrival).toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'})}</span>
                            </div>
                        `).join('') || '<p class="text-gray-500">無路線點</p>'}
                    </div>
                </div>
                
                <div class="flex justify-end gap-2 mt-6">
                    <button type="button" onclick="closeModal(this.closest('.fixed'))" class="px-4 py-2 border rounded hover:bg-gray-100">
                        取消
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        儲存變更
                    </button>
                </div>
            </form>
        `;
        
        const modal = createModal(modalContent);
        document.body.appendChild(modal);
        
        // Load drivers and vehicles if not already loaded
        if (allDrivers.length === 0) await loadDrivers();
        if (allVehicles.length === 0) await loadVehicles();
        
        // Handle form submission
        const form = modal.querySelector('#edit-route-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const updateData = {
                route_name: formData.get('route_name'),
                driver_id: parseInt(formData.get('driver_id')),
                vehicle_id: parseInt(formData.get('vehicle_id')),
                is_optimized: formData.get('is_optimized') === 'on'
            };
            
            try {
                const updateResponse = await fetch(`${API_BASE}/routes/${routeId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                
                if (!updateResponse.ok) throw new Error('Update failed');
                
                showNotification('路線已更新', 'success');
                closeModal(modal);
                await loadRoutes(currentRoutePage);
                
            } catch (error) {
                showNotification('更新失敗: ' + error.message, 'error');
            }
        });
        
    } catch (error) {
        console.error('Error editing route:', error);
        showNotification('載入路線失敗', 'error');
    }
}

// Delete route
async function deleteRoute(routeId) {
    if (!confirm('確定要刪除這條路線嗎？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/routes/${routeId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Delete failed');
        }
        
        showNotification('路線已刪除', 'success');
        await loadRoutes(currentRoutePage);
        
    } catch (error) {
        console.error('Error deleting route:', error);
        showNotification(error.message || '刪除失敗', 'error');
    }
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

// Load drivers and vehicles for manual route creation
async function loadDriversAndVehiclesForRoute() {
    try {
        // Load drivers
        const driversResponse = await fetch(`${API_BASE}/drivers?is_active=true`);
        const driversData = await driversResponse.json();
        const drivers = driversData.items || [];
        
        const driverSelect = document.querySelector('#add-route-form select[name="driver_id"]');
        if (driverSelect) {
            driverSelect.innerHTML = '<option value="">請選擇司機</option>' + 
                drivers.map(driver => `<option value="${driver.id}">${driver.name}</option>`).join('');
        }
        
        // Load vehicles
        const vehiclesResponse = await fetch(`${API_BASE}/vehicles?is_active=true`);
        const vehiclesData = await vehiclesResponse.json();
        const vehicles = vehiclesData.items || [];
        
        const vehicleSelect = document.querySelector('#add-route-form select[name="vehicle_id"]');
        if (vehicleSelect) {
            vehicleSelect.innerHTML = '<option value="">請選擇車輛</option>' + 
                vehicles.map(vehicle => `<option value="${vehicle.id}">${vehicle.plate_number} - ${vehicle.vehicle_type}</option>`).join('');
        }
        
    } catch (error) {
        console.error('Error loading drivers and vehicles:', error);
        showNotification('載入資源失敗', 'error');
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
                const keyword = e.target.value.toLowerCase();
                const filtered = clients.filter(client => 
                    client.name.toLowerCase().includes(keyword) ||
                    client.client_code.toLowerCase().includes(keyword) ||
                    client.address.toLowerCase().includes(keyword)
                );
                displayAvailableClients(filtered);
            });
        }
        
    } catch (error) {
        console.error('Error loading clients:', error);
        showNotification('載入客戶失敗', 'error');
    }
}

// Display available clients
function displayAvailableClients(clients) {
    const container = document.getElementById('available-clients');
    if (!container) return;
    
    container.innerHTML = clients.map(client => `
        <div class="p-2 hover:bg-gray-50 cursor-pointer border-b" onclick="addClientToRoute(${client.id}, '${client.client_code}', '${client.name}', '${client.address}')">
            <p class="font-medium text-sm">${client.client_code} - ${client.name}</p>
            <p class="text-xs text-gray-600">${client.address}</p>
        </div>
    `).join('') || '<p class="text-gray-500 p-2">沒有可用的客戶</p>';
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
                <button onclick="removeClientFromRoute(${index})" class="text-red-600 hover:text-red-800 ml-2">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('') || '<p class="text-gray-500 p-2">尚未選擇客戶</p>';
    }
    
    if (countElement) {
        countElement.textContent = selectedRouteClients.length;
    }
}

// Remove client from route
function removeClientFromRoute(index) {
    selectedRouteClients.splice(index, 1);
    updateSelectedClientsDisplay();
}

// Handle manual route creation form submission
document.getElementById('add-route-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (selectedRouteClients.length === 0) {
        showNotification('請至少選擇一個客戶', 'warning');
        return;
    }
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Build route points
    const routePoints = selectedRouteClients.map((client, index) => ({
        client_id: client.id,
        sequence: index + 1,
        estimated_arrival: new Date().toISOString(), // This should be calculated properly
        service_time: 15,
        distance_from_previous: 0 // This should be calculated
    }));
    
    const requestData = {
        route_date: formData.get('route_date'),
        route_name: formData.get('route_name'),
        area: formData.get('area'),
        driver_id: parseInt(formData.get('driver_id')),
        vehicle_id: parseInt(formData.get('vehicle_id')),
        route_points: routePoints
    };
    
    try {
        const response = await fetch(`${API_BASE}/routes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Create failed');
        }
        
        showNotification('路線已建立', 'success');
        closeModal('addRouteModal');
        await loadRoutes(1);
        
    } catch (error) {
        console.error('Error creating route:', error);
        showNotification(error.message || '建立失敗', 'error');
    }
});

// Close modal helper function - handles both element and ID
function closeModal(modalOrId) {
    let modal;
    
    // Check if it's an element or an ID
    if (typeof modalOrId === 'string') {
        modal = document.getElementById(modalOrId);
    } else if (modalOrId instanceof HTMLElement) {
        modal = modalOrId;
    } else {
        console.error('Invalid modal parameter:', modalOrId);
        return;
    }
    
    if (modal) {
        // Check if it's a predefined modal with hidden class
        if (modal.id && ['addClientModal', 'addDriverModal', 'addVehicleModal', 'addDeliveryModal', 'routePlanModal', 'addRouteModal'].includes(modal.id)) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        } else {
            // It's a dynamically created modal, remove it from DOM
            modal.remove();
        }
    }
}

// Create modal helper function
function createModal(content) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            ${content}
        </div>
    `;
    return modal;
}

// Make functions available globally for onclick handlers
window.closeModal = closeModal;
window.showRoutePlanModal = showRoutePlanModal;
window.showAddRouteModal = showAddRouteModal;
window.viewRoute = viewRoute;
window.showRouteMap = showRouteMap;
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;
window.filterRoutes = filterRoutes;
window.loadRoutes = loadRoutes;
window.addClientToRoute = addClientToRoute;
window.removeClientFromRoute = removeClientFromRoute;

// Scheduling System Functions
async function showSchedulingModal() {
    const modal = document.getElementById('schedulingModal');
    if (!modal) return;
    
    // Reset form
    document.getElementById('scheduling-form').reset();
    document.getElementById('scheduling-results').classList.add('hidden');
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('schedule-date').value = tomorrow.toISOString().split('T')[0];
    
    // Load available drivers and vehicles
    await loadSchedulingResources();
    
    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

async function loadSchedulingResources() {
    try {
        // Load available drivers
        const driversResponse = await fetch(`${API_BASE}/drivers?is_available=true`);
        const drivers = await driversResponse.json();
        
        const driverSelect = document.querySelector('select[name="driver_ids"]');
        driverSelect.innerHTML = '';
        
        if (drivers.items) {
            drivers.items.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver.id;
                option.textContent = `${driver.name} (${driver.employee_id})`;
                driverSelect.appendChild(option);
            });
        }
        
        // Load available vehicles
        const vehiclesResponse = await fetch(`${API_BASE}/vehicles?is_active=true`);
        const vehicles = await vehiclesResponse.json();
        
        const vehicleSelect = document.querySelector('select[name="vehicle_ids"]');
        vehicleSelect.innerHTML = '';
        
        if (vehicles.items) {
            vehicles.items.forEach(vehicle => {
                const option = document.createElement('option');
                option.value = vehicle.id;
                option.textContent = `${vehicle.plate_number} - ${vehicle.vehicle_type}`;
                vehicleSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load resources:', error);
        showNotification('載入資源失敗', 'error');
    }
}

function toggleDateRangeInputs() {
    const scheduleType = document.getElementById('schedule-type').value;
    const singleDateInput = document.getElementById('single-date-input');
    const dateRangeInputs = document.getElementById('date-range-inputs');
    
    if (scheduleType === 'single') {
        singleDateInput.classList.remove('hidden');
        dateRangeInputs.classList.add('hidden');
        document.getElementById('schedule-date').required = true;
        document.getElementById('start-date').required = false;
        document.getElementById('end-date').required = false;
    } else {
        singleDateInput.classList.add('hidden');
        dateRangeInputs.classList.remove('hidden');
        document.getElementById('schedule-date').required = false;
        document.getElementById('start-date').required = true;
        document.getElementById('end-date').required = true;
    }
}

function updateAlgorithmDescription() {
    const algorithm = document.querySelector('select[name="algorithm"]').value;
    const description = document.getElementById('algorithm-description');
    
    const descriptions = {
        'greedy': '快速找到可行解，適合日常排程',
        'genetic': '透過演化找到最佳解，需要較長計算時間',
        'simulated_annealing': '平衡速度與品質，適合中等規模問題'
    };
    
    description.textContent = descriptions[algorithm] || '';
}

async function previewSchedule() {
    const formData = new FormData(document.getElementById('scheduling-form'));
    const scheduleType = formData.get('schedule_type');
    
    let dates = [];
    if (scheduleType === 'single') {
        dates.push(formData.get('schedule_date'));
    } else {
        const startDate = new Date(formData.get('start_date'));
        const endDate = new Date(formData.get('end_date'));
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d).toISOString().split('T')[0]);
        }
    }
    
    const resultsDiv = document.getElementById('scheduling-results-content');
    resultsDiv.innerHTML = `
        <div class="text-center py-4">
            <i class="fas fa-spinner fa-spin text-2xl text-blue-600"></i>
            <p class="mt-2">正在預覽排程...</p>
        </div>
    `;
    
    document.getElementById('scheduling-results').classList.remove('hidden');
    
    // Show preview information
    setTimeout(() => {
        resultsDiv.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded p-4">
                <h5 class="font-semibold mb-2">預覽資訊</h5>
                <p>將為以下日期生成排程：</p>
                <ul class="list-disc list-inside mt-2">
                    ${dates.map(date => `<li>${formatDate(date)}</li>`).join('')}
                </ul>
                <p class="mt-2">總共 ${dates.length} 天的排程</p>
            </div>
        `;
    }, 1000);
}

// Handle scheduling form submission
async function handleSchedulingFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const scheduleType = formData.get('schedule_type');
    
    // Get selected objectives
    const objectives = [];
    formData.getAll('objectives').forEach(obj => objectives.push(obj));
    
    if (objectives.length === 0) {
        showNotification('請至少選擇一個優化目標', 'error');
        return;
    }
    
    // Get selected resources
    const driverIds = Array.from(document.querySelector('select[name="driver_ids"]').selectedOptions)
        .map(option => parseInt(option.value));
    const vehicleIds = Array.from(document.querySelector('select[name="vehicle_ids"]').selectedOptions)
        .map(option => parseInt(option.value));
    
    // Determine dates to schedule
    let datesToSchedule = [];
    if (scheduleType === 'single') {
        datesToSchedule.push(formData.get('schedule_date'));
    } else {
        const startDate = new Date(formData.get('start_date'));
        const endDate = new Date(formData.get('end_date'));
        
        if (endDate < startDate) {
            showNotification('結束日期必須在開始日期之後', 'error');
            return;
        }
        
        // Limit to 30 days
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 30) {
            showNotification('日期範圍不能超過 30 天', 'error');
            return;
        }
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            datesToSchedule.push(new Date(d).toISOString().split('T')[0]);
        }
    }
    
    // Show progress
    const resultsDiv = document.getElementById('scheduling-results-content');
    resultsDiv.innerHTML = `
        <div class="text-center py-4">
            <i class="fas fa-spinner fa-spin text-2xl text-blue-600"></i>
            <p class="mt-2">正在生成排程...</p>
            <p class="text-sm text-gray-600">這可能需要幾秒鐘時間</p>
        </div>
    `;
    document.getElementById('scheduling-results').classList.remove('hidden');
    
    // Process each date
    const results = [];
    const scheduleDataMap = new Map(); // Store schedule data for apply function
    let successCount = 0;
    let failCount = 0;
    
    for (const scheduleDate of datesToSchedule) {
        try {
            const requestData = {
                schedule_date: scheduleDate,
                algorithm: formData.get('algorithm'),
                optimization_objectives: objectives,
                max_iterations: 1000,
                time_limit_seconds: parseInt(formData.get('time_limit_seconds')),
                allow_overtime: formData.get('allow_overtime') === 'on',
                travel_speed_kmh: parseFloat(formData.get('travel_speed_kmh')),
                max_deliveries_per_route: parseInt(formData.get('max_deliveries_per_route')),
                min_deliveries_per_route: parseInt(formData.get('min_deliveries_per_route'))
            };
            
            // Add optional filters
            if (driverIds.length > 0) {
                requestData.driver_ids = driverIds;
            }
            if (vehicleIds.length > 0) {
                requestData.vehicle_ids = vehicleIds;
            }
            
            const response = await fetch(`${API_BASE}/scheduling/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                successCount++;
                // Store the full result for apply function
                scheduleDataMap.set(scheduleDate, result);
                results.push({
                    date: scheduleDate,
                    success: true,
                    data: result
                });
            } else {
                failCount++;
                results.push({
                    date: scheduleDate,
                    success: false,
                    error: result.detail || result.message || '排程失敗'
                });
            }
        } catch (error) {
            failCount++;
            results.push({
                date: scheduleDate,
                success: false,
                error: error.message
            });
        }
    }
    
    // Store schedule data globally for apply function
    window.schedulingResultsCache = scheduleDataMap;
    
    // Display results
    displaySchedulingResults(results, successCount, failCount);
}

function displaySchedulingResults(results, successCount, failCount) {
    const resultsDiv = document.getElementById('scheduling-results-content');
    
    let html = `
        <div class="mb-4">
            <div class="flex items-center justify-between">
                <h5 class="font-semibold">排程完成</h5>
                <div class="text-sm">
                    <span class="text-green-600">成功: ${successCount}</span>
                    ${failCount > 0 ? `<span class="text-red-600 ml-3">失敗: ${failCount}</span>` : ''}
                </div>
            </div>
        </div>
    `;
    
    // Group results by success/failure
    const successResults = results.filter(r => r.success);
    const failResults = results.filter(r => !r.success);
    
    if (successResults.length > 0) {
        html += `
            <div class="mb-4">
                <h6 class="font-medium mb-2 text-green-700">成功排程</h6>
                <div class="space-y-2">
        `;
        
        successResults.forEach(result => {
            const data = result.data;
            html += `
                <div class="bg-green-50 border border-green-200 rounded p-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-medium">${formatDate(result.date)}</p>
                            <p class="text-sm text-gray-600 mt-1">
                                ${data.scheduled_deliveries}/${data.total_deliveries} 配送已排程 | 
                                ${data.total_routes} 條路線 | 
                                總距離: ${data.total_distance.toFixed(1)} km
                            </p>
                            ${data.conflicts_count > 0 ? `
                                <p class="text-sm text-orange-600 mt-1">
                                    <i class="fas fa-exclamation-triangle mr-1"></i>
                                    ${data.conflicts_count} 個衝突
                                </p>
                            ` : ''}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="viewScheduleDetails('${result.date}')" class="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                                查看詳情
                            </button>
                            <button onclick="applySchedule('${result.date}')" class="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                                套用排程
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    if (failResults.length > 0) {
        html += `
            <div class="mb-4">
                <h6 class="font-medium mb-2 text-red-700">失敗排程</h6>
                <div class="space-y-2">
        `;
        
        failResults.forEach(result => {
            html += `
                <div class="bg-red-50 border border-red-200 rounded p-3">
                    <p class="font-medium">${formatDate(result.date)}</p>
                    <p class="text-sm text-red-600 mt-1">${result.error}</p>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    resultsDiv.innerHTML = html;
}

async function viewScheduleDetails(date) {
    // Get the scheduling result for this date
    try {
        const response = await fetch(`${API_BASE}/scheduling/metrics/${date}`);
        const metrics = await response.json();
        
        let modalContent = `
            <h2 class="text-xl font-bold mb-4">排程詳情 - ${formatDate(date)}</h2>
            <div class="space-y-4">
        `;
        
        if (metrics.metrics) {
            const m = metrics.metrics;
            modalContent += `
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-gray-50 p-3 rounded">
                        <p class="text-sm text-gray-600">總路線數</p>
                        <p class="text-xl font-semibold">${m.total_routes}</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded">
                        <p class="text-sm text-gray-600">總配送數</p>
                        <p class="text-xl font-semibold">${m.total_deliveries}</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded">
                        <p class="text-sm text-gray-600">總距離</p>
                        <p class="text-xl font-semibold">${m.total_distance_km.toFixed(1)} km</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded">
                        <p class="text-sm text-gray-600">司機使用率</p>
                        <p class="text-xl font-semibold">${m.driver_utilization_percent.toFixed(1)}%</p>
                    </div>
                </div>
            `;
            
            // Show driver statistics
            if (m.driver_statistics) {
                modalContent += `
                    <div>
                        <h4 class="font-semibold mb-2">司機工作分配</h4>
                        <div class="space-y-2">
                `;
                
                Object.entries(m.driver_statistics).forEach(([driverId, stats]) => {
                    modalContent += `
                        <div class="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span>司機 #${driverId}</span>
                            <span class="text-sm">
                                ${stats.deliveries} 配送 | 
                                ${stats.distance.toFixed(1)} km | 
                                ${Math.round(stats.duration / 60)} 小時
                            </span>
                        </div>
                    `;
                });
                
                modalContent += `
                        </div>
                    </div>
                `;
            }
        }
        
        // Check for conflicts
        const conflictsResponse = await fetch(`${API_BASE}/scheduling/conflicts/${date}`);
        const conflicts = await conflictsResponse.json();
        
        if (conflicts.conflicts && conflicts.conflicts.length > 0) {
            modalContent += `
                <div>
                    <h4 class="font-semibold mb-2 text-orange-600">
                        <i class="fas fa-exclamation-triangle mr-1"></i>
                        排程衝突 (${conflicts.conflicts.length})
                    </h4>
                    <div class="space-y-2">
            `;
            
            conflicts.conflicts.forEach(conflict => {
                modalContent += `
                    <div class="bg-orange-50 border border-orange-200 rounded p-2">
                        <p class="font-medium text-sm">${conflict.type}</p>
                        <p class="text-sm text-gray-600">${conflict.description}</p>
                    </div>
                `;
            });
            
            modalContent += `
                    </div>
                </div>
            `;
        }
        
        modalContent += `
            </div>
        `;
        
        const modal = createModal('排程詳情', modalContent);
        document.body.appendChild(modal);
        
    } catch (error) {
        showNotification('載入排程詳情失敗', 'error');
    }
}

async function applySchedule(date) {
    if (!confirm(`確定要套用 ${formatDate(date)} 的排程嗎？這將建立實際的配送路線。`)) {
        return;
    }
    
    // Get the cached schedule data
    if (!window.schedulingResultsCache || !window.schedulingResultsCache.has(date)) {
        showNotification('找不到排程資料，請重新生成排程', 'error');
        return;
    }
    
    const scheduleData = window.schedulingResultsCache.get(date);
    
    showNotification('正在套用排程...', 'info');
    
    try {
        // Call the apply endpoint with the route data
        const response = await fetch(`${API_BASE}/scheduling/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                schedule_date: date,
                route_data: scheduleData.routes
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification(`成功套用排程！已建立 ${scheduleData.routes.length} 條路線`, 'success');
            
            // Refresh the routes section if it's visible
            const routesSection = document.getElementById('routes');
            if (routesSection && !routesSection.classList.contains('hidden')) {
                loadRoutes(1);
            }
            
            // Close the scheduling modal
            closeModal('schedulingModal');
        } else {
            showNotification(result.detail || '套用排程失敗', 'error');
        }
    } catch (error) {
        console.error('Apply schedule error:', error);
        showNotification('套用排程失敗', 'error');
    }
}

// Make functions available globally
window.showSchedulingModal = showSchedulingModal;
window.toggleDateRangeInputs = toggleDateRangeInputs;
window.updateAlgorithmDescription = updateAlgorithmDescription;
window.previewSchedule = previewSchedule;
window.viewScheduleDetails = viewScheduleDetails;
window.applySchedule = applySchedule;