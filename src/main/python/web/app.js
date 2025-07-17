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

// ============================================
// UTILITY FUNCTIONS - MOVED TO MODULES
// ============================================
// All utilities have been extracted to js/modules/utilities.js
// This includes:
// - api (API request handling)
// - table (Table rendering utilities)
// - html (HTML generation utilities)
// - validateTaiwanId (Taiwan ID validation)
// - validationRules (Form validation rules)
// - eventDelegation (Event delegation system)
// These are loaded by the module loader and available globally

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
    // Initialize event delegation
    eventDelegation.init();
    
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
        showSection(section);
    } else {
        // Load dashboard as default
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
                    window.loadDeliveries();
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

// Delivery tab switching - moved to delivery-handlers.js module

// Dashboard with real data
async function loadDashboard() {
    // Initialize chart references
    if (!window.deliveryChart) window.deliveryChart = null;
    if (!window.statusChart) window.statusChart = null;
    
    // Show loading state
    ['total-clients', 'today-deliveries', 'available-drivers', 'available-vehicles'].forEach(id => {
        document.getElementById(id).textContent = '載入中...';
    });
    
    const stats = await api.get('/dashboard/stats', {
        errorMessage: '載入儀表板失敗',
        skipNotification: false
    }).catch(() => {
        // Show error state on failure
        ['total-clients', 'today-deliveries', 'available-drivers', 'available-vehicles'].forEach(id => {
            document.getElementById(id).textContent = '-';
        });
        return null;
    });
    
    if (!stats) return;
    
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
}

// loadWeeklyDeliveryChartFromStats - moved to delivery-handlers.js module

function loadStatusChartFromStats(todayDeliveries) {
    try {
        const completed = todayDeliveries?.completed || 0;
        const pending = todayDeliveries?.pending || 0;
        const inProgress = todayDeliveries?.in_progress || 0;
        const cancelled = todayDeliveries?.cancelled || 0;

        window.statusChart = chartUtils.createDoughnutChart({
            canvasId: 'statusChart',
            labels: ['已完成', '待配送', '配送中', '已取消'],
            data: [completed, pending, inProgress, cancelled],
            backgroundColor: chartUtils.getStatusChartColors(),
            existingChart: window.statusChart
        });
    } catch (error) {
        console.error('Error loading status chart:', error);
    }
}

async function loadRecentActivities() {
    // Get recent deliveries
    const data = await api.get('/deliveries?page_size=5&order_by=created_at&order_desc=true', {
        skipNotification: true
    }).catch(() => null);
    
    const container = document.getElementById('recent-activities');
    if (!container) return;
    
    container.innerHTML = '<h3 class="text-lg font-semibold mb-4">最近活動</h3>';
    
    if (data && data.items && data.items.length > 0) {
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

// Client management functions moved to client-handlers.js module

// Table rendering functions moved to table-renderers.js

// Enhanced Deliveries with date range and filters - moved to delivery-handlers.js module

// renderDeliveriesTable moved to table-renderers.js

// updateDeliverySummary - moved to delivery-handlers.js module

// updatePagination moved to table-renderers.js

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
        window.loadDeliveries(1);
    });
    
    document.getElementById('delivery-date-to')?.addEventListener('change', (e) => {
        deliveryFilters.dateTo = e.target.value;
        window.loadDeliveries(1);
    });
    
    document.getElementById('delivery-status')?.addEventListener('change', (e) => {
        deliveryFilters.status = e.target.value;
        window.loadDeliveries(1);
    });
    
    document.getElementById('delivery-driver')?.addEventListener('change', (e) => {
        deliveryFilters.driverId = e.target.value;
        window.loadDeliveries(1);
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

// viewClient function moved to client-handlers.js module

// switchClientTab and loadClientDeliveries functions moved to client-handlers.js module

// Calculate delivery statistics
// calculateDeliveryStats - moved to delivery-handlers.js module

// toggleClientStatus and deleteClient functions moved to client-handlers.js module

// Modal functions moved to ui-components.js module

// exportClients - moved to report-handlers.js module

// exportDeliveries - moved to delivery-handlers.js module

// Quick stats refresh
async function refreshStats(event) {
    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i>';
    
    await loadDashboard();
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync"></i>';
    showNotification('統計資料已更新', 'success');
}

// editClient function moved to client-handlers.js module

// editDriver - moved to driver-handlers.js module

// editVehicle - moved to vehicle-handlers.js module

// createEditModal moved to ui-components.js module

// Simple closeModal removed - using enhanced version at line 4333

// Modal display functions removed - replaced by newer implementation

// showAddDeliveryModal - moved to delivery-handlers.js module

// setupAddClientFormHandler removed - replaced by setupFormHandlers

// Sorting functions removed - never used in the application

// Additional utility functions
// updateDeliveryStatus and getStatusText - moved to delivery-handlers.js module

// assignDelivery - moved to delivery-handlers.js module

// Form handler utility
const form = {
    setup(formId, endpoint, options = {}) {
        const formElement = document.getElementById(formId);
        if (!formElement) {
            console.error(`Form with id '${formId}' not found`);
            return;
        }
        
        formElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(formElement);
            const rawData = {};
            for (let [key, value] of formData.entries()) {
                rawData[key] = value;
            }
            
            // Validate if rules provided
            if (options.validationRules) {
                const validationResult = ValidationUtils.validateForm(rawData, options.validationRules);
                if (!validationResult.isValid) {
                    ValidationUtils.displayFormErrors(formElement, validationResult.errors);
                    showNotification('請修正表單錯誤', 'error');
                    return;
                }
            }
            
            // Transform data if transformer provided
            const data = options.transform ? options.transform(rawData) : rawData;
            
            // Make API call
            try {
                const method = options.method || 'POST';
                const result = await api[method.toLowerCase()](endpoint, data, {
                    successMessage: options.successMessage
                });
                
                if (result && options.onSuccess) {
                    options.onSuccess(result);
                }
            } catch (error) {
                console.error('Form submission error:', error);
                showNotification(options.errorMessage || '操作失敗', 'error');
            }
        });
    }
};

// Setup form handlers
function setupFormHandlers() {
    // Scheduling form handler
    const schedulingForm = document.getElementById('scheduling-form');
    if (schedulingForm) {
        schedulingForm.addEventListener('submit', handleSchedulingFormSubmit);
    }
    
    // Add client form handler
    form.setup('add-client-form', '/clients', {
        method: 'POST',
        validationRules: validationRules.client,
        transform: data => ({ ...data, is_active: true }),
        successMessage: '客戶新增成功',
        onSuccess: () => {
            document.getElementById('add-client-form').reset();
            loadClients();
        }
    });
    
    // Add delivery form handler
    form.setup('add-delivery-form', '/deliveries', {
        method: 'POST',
        validationRules: validationRules.delivery,
        transform: data => ({
            ...data,
            requires_empty_cylinder_return: data.requires_empty_cylinder_return === 'on'
        }),
        successMessage: '配送單新增成功',
        onSuccess: () => {
            closeModal(document.getElementById('addDeliveryModal'));
            document.getElementById('add-delivery-form').reset();
            loadDeliveries();
        }
    });
    
    // Add driver form handler
    form.setup('add-driver-form', '/drivers', {
        method: 'POST',
        validationRules: validationRules.driver,
        successMessage: '司機新增成功',
        onSuccess: () => {
            closeModal(document.getElementById('addDriverModal'));
            document.getElementById('add-driver-form').reset();
            loadDrivers();
        }
    });
    
    // Add vehicle form handler
    form.setup('add-vehicle-form', '/vehicles', {
        method: 'POST',
        validationRules: validationRules.vehicle,
        successMessage: '車輛新增成功',
        onSuccess: () => {
            closeModal(document.getElementById('addVehicleModal'));
            document.getElementById('add-vehicle-form').reset();
            loadVehicles();
        }
    });
}

// loadDrivers - moved to driver-handlers.js module

// renderDriversTable moved to table-renderers.js

// loadVehicles - moved to vehicle-handlers.js module

// renderVehiclesTable moved to table-renderers.js

// Toggle driver status
async function toggleDriverStatus(driverId, currentStatus) {
    if (!confirm(`確定要${currentStatus ? '停用' : '啟用'}此司機嗎？`)) return;
    
    await api.put(`/drivers/${driverId}`, { is_active: !currentStatus });
    await loadDrivers();
}

// deleteDriver - moved to driver-handlers.js module

// toggleVehicleStatus - moved to vehicle-handlers.js module

// deleteVehicle - moved to vehicle-handlers.js module

// updateDriverOptions - moved to driver-handlers.js module

// View driver details
async function viewDriverDetails(driverId) {
    const driver = await api.get(`/drivers/${driverId}`, {
        errorMessage: '載入司機資料失敗'
    }).catch(() => null);
    
    if (!driver) return;
        
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
                        ${html.statusBadge(driver.is_available, '可用', '不可用', 'bg-green-100 text-green-800', 'bg-gray-100 text-gray-800')}
                    </p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">配送統計</p>
                    <p class="font-medium">${driver.delivery_count || 0} 筆配送</p>
                </div>
            </div>
        `;
        
        const fullContent = `
            ${modalContent}
            <div class="mt-6 flex justify-end">
                <button data-action="closeModal" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    關閉
                </button>
            </div>
        `;
        
        createModal(fullContent, '司機詳細資料');
}

// Toggle driver availability
async function toggleDriverAvailability(driverId) {
    // Get current driver data
    const driver = await api.get(`/drivers/${driverId}`, {
        skipNotification: true
    }).catch(() => null);
    
    if (!driver) {
        showNotification('無法載入司機資料', 'error');
        return;
    }
    
    const newAvailability = !driver.is_available;
    
    if (!confirm(`確定要${newAvailability ? '啟用' : '停用'}此司機嗎？`)) return;
    
    const result = await api.put(`/drivers/${driverId}`, { 
        is_available: newAvailability 
    }, {
        successMessage: `司機已${newAvailability ? '啟用' : '停用'}`,
        errorMessage: '更新失敗'
    }).catch(() => null);
    
    if (result !== null) {
        loadDrivers();
    }
}

// View driver deliveries
async function viewDriverDeliveries(driverId) {
    const data = await api.get(`/deliveries?driver_id=${driverId}&limit=50`, {
        errorMessage: '載入配送記錄失敗'
    }).catch(() => null);
    
    if (!data) return;
    
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
        
        const fullContent = `
            ${tableContent}
            <div class="mt-6 flex justify-end">
                <button data-action="closeModal" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    關閉
                </button>
            </div>
        `;
        
        createModal(fullContent, '司機配送記錄');
}

// View vehicle details
async function viewVehicleDetails(vehicleId) {
    const vehicle = await api.get(`/vehicles/${vehicleId}`, {
        errorMessage: '載入車輛資料失敗'
    }).catch(() => null);
    
    if (!vehicle) return;
        
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
        
        const fullContent = `
            ${modalContent}
            <div class="mt-6 flex justify-end">
                <button data-action="closeModal" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                    關閉
                </button>
            </div>
        `;
        
        createModal(fullContent, '車輛詳細資料');
}

// viewDeliveryDetails - moved to delivery-handlers.js module

// assignDriver, getPaymentMethodText, viewDelivery - moved to delivery-handlers.js module

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

// loadDriversForFilter - moved to driver-handlers.js module

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

// displayRoutes moved to table-renderers.js

// updateRoutePagination moved to table-renderers.js

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
        const driversData = await api.get('/drivers?is_available=true', {
            skipNotification: true
        }).catch(() => ({ items: [] }));
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
        const vehiclesData = await api.get('/vehicles?is_available=true', {
            skipNotification: true
        }).catch(() => ({ items: [] }));
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
        const result = await api.post('/routes/plan', requestData, {
            successMessage: result => result.message,
            errorMessage: error => error.detail || 'Route planning failed'
        });
        
        if (result.success) {
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
                            <button data-action="viewRoute" data-route-id="${route.id}" class="text-blue-600 hover:text-blue-800">
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
            <button data-action="closeModal" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                確定
            </button>
        </div>
    `;
    
    const modal = createModal(modalContent, '路線規劃結果');
    document.body.appendChild(modal);
}

// View route details
async function viewRoute(routeId) {
    try {
        const route = await api.get(`/routes/${routeId}`, {
            errorMessage: '載入路線詳情失敗'
        });
        
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
        const mapData = await api.get(`/routes/${routeId}/map`, {
            errorMessage: '載入地圖失敗'
        });
        
        // For now, just show the data
        // Display map data in a modal
        const modalContent = `
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
                <button data-action="closeModal" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                    關閉
                </button>
            </div>
        `;
        
        const modal = createModal(modalContent, '路線地圖');
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
        const route = await api.get(`/routes/${routeId}`, {
            errorMessage: '載入路線失敗'
        });
        
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
                    <button type="button" data-action="closeModal" class="px-4 py-2 border rounded hover:bg-gray-100">
                        取消
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        儲存變更
                    </button>
                </div>
            </form>
        `;
        
        const modal = createModal(modalContent, '編輯路線');
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
                await api.put(`/routes/${routeId}`, updateData, {
                    successMessage: '路線已更新',
                    errorMessage: '更新失敗'
                });
                
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
    
    await api.delete(`/routes/${routeId}`);
    await loadRoutes(currentRoutePage);
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

// loadDriversAndVehiclesForRoute - moved to driver-handlers.js module

// Load available clients for route
async function loadAvailableClients() {
    try {
        const data = await api.get('/clients?is_active=true&page_size=100', {
            errorMessage: '載入客戶失敗'
        });
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
        <div class="p-2 hover:bg-gray-50 cursor-pointer border-b" data-client-select="true" data-client-id="${client.id}" data-client-code="${client.client_code}" data-client-name="${client.name}" data-client-address="${client.address}">
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
                <button data-action="removeClientFromRoute" data-index="${index}" class="text-red-600 hover:text-red-800 ml-2">
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
        await api.post('/routes', requestData, {
            successMessage: '路線已建立',
            errorMessage: error => error.detail || '建立失敗'
        });
        
        closeModal('addRouteModal');
        await loadRoutes(1);
        
    } catch (error) {
        console.error('Error creating route:', error);
        showNotification(error.message || '建立失敗', 'error');
    }
});

// closeModal moved to ui-components.js module

// createModal moved to ui-components.js module

// Make functions available globally for onclick handlers
// window.closeModal moved to ui-components.js module
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
        const drivers = await api.get('/drivers?is_available=true', {
            errorMessage: '載入資源失敗'
        }).catch(() => ({ items: [] }));
        
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
        const vehicles = await api.get('/vehicles?is_active=true', {
            errorMessage: '載入資源失敗'
        }).catch(() => ({ items: [] }));
        
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
            
            const result = await api.post('/scheduling/generate', requestData, {
                skipNotification: true
            }).catch(error => {
                return { success: false, detail: error.message || '排程失敗' };
            });
            
            if (result.success) {
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

// displaySchedulingResults moved to table-renderers.js

async function viewScheduleDetails(date) {
    // Get the scheduling result for this date
    try {
        const metrics = await api.get(`/scheduling/metrics/${date}`, {
            skipNotification: true
        }).catch(() => ({ metrics: null }));
        
        let modalContent = `
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
        const conflicts = await api.get(`/scheduling/conflicts/${date}`, {
            skipNotification: true
        }).catch(() => ({ conflicts: [] }));
        
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
        
        const modal = createModal(modalContent, `排程詳情 - ${formatDate(date)}`);
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
        const result = await api.post('/scheduling/apply', {
            schedule_date: date,
            route_data: scheduleData.routes
        }, {
            successMessage: `成功套用排程！已建立 ${scheduleData.routes.length} 條路線`,
            errorMessage: error => error.detail || '套用排程失敗'
        });
        
        if (result && result.success) {
            // Refresh the routes section if it's visible
            const routesSection = document.getElementById('routes');
            if (routesSection && !routesSection.classList.contains('hidden')) {
                loadRoutes(1);
            }
            
            // Close the scheduling modal
            closeModal('schedulingModal');
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

// Delete functions
// deleteClient window assignment removed - now handled in client-handlers.js module
window.deleteDriver = deleteDriver;
window.deleteVehicle = deleteVehicle;