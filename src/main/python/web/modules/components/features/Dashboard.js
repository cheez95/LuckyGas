/**
 * Dashboard Component
 * Real-time dashboard with statistics, charts, and activities
 * @module components/features/Dashboard
 */

import { ReactiveComponent } from '../ReactiveComponent.js';
import store from '../../../src/main/js/state/store.js';
import { dom, format, datetime } from '../../utils/index.js';

/**
 * Dashboard - Main dashboard component with real-time updates
 */
export class Dashboard extends ReactiveComponent {
    constructor(options = {}) {
        super({
            ...options,
            name: 'Dashboard',
            
            // Reactive data
            data: {
                period: 'today', // today, week, month, year
                autoRefreshEnabled: true,
                refreshInterval: 30000, // 30 seconds
                refreshTimer: null,
                charts: {
                    delivery: null,
                    revenue: null,
                    driver: null
                },
                isLoading: false,
                lastUpdateTime: new Date()
            },
            
            // Computed properties from global state
            computedState: {
                deliveries: 'deliveries.all',
                clients: 'clients.all',
                drivers: 'drivers.all',
                
                // Statistics computed properties
                totalDeliveries: {
                    dependencies: ['deliveries.all'],
                    compute: (deliveries) => {
                        if (!deliveries) return 0;
                        return this._filterByPeriod(deliveries).length;
                    }
                },
                
                pendingDeliveries: {
                    dependencies: ['deliveries.all'],
                    compute: (deliveries) => {
                        if (!deliveries) return 0;
                        return this._filterByPeriod(deliveries)
                            .filter(d => d.status === 'pending').length;
                    }
                },
                
                completedDeliveries: {
                    dependencies: ['deliveries.all'],
                    compute: (deliveries) => {
                        if (!deliveries) return 0;
                        return this._filterByPeriod(deliveries)
                            .filter(d => d.status === 'completed').length;
                    }
                },
                
                totalRevenue: {
                    dependencies: ['deliveries.all'],
                    compute: (deliveries) => {
                        if (!deliveries) return 0;
                        return this._filterByPeriod(deliveries)
                            .filter(d => d.status === 'completed')
                            .reduce((sum, d) => sum + (d.totalAmount || 0), 0);
                    }
                },
                
                activeClients: {
                    dependencies: ['clients.all'],
                    compute: (clients) => {
                        if (!clients) return 0;
                        return clients.filter(c => c.isActive).length;
                    }
                },
                
                activeDrivers: {
                    dependencies: ['drivers.all'],
                    compute: (drivers) => {
                        if (!drivers) return 0;
                        return drivers.filter(d => d.status === 'active').length;
                    }
                },
                
                recentActivities: {
                    dependencies: ['deliveries.all'],
                    compute: (deliveries) => {
                        if (!deliveries) return [];
                        return deliveries
                            .slice()
                            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                            .slice(0, 10);
                    }
                }
            },
            
            // Watchers
            watch: {
                'data.period': function(newPeriod) {
                    this._updateCharts();
                },
                'computedState.deliveries': function() {
                    if (this.isMounted) {
                        this._updateCharts();
                    }
                }
            },
            
            // Methods
            methods: {
                handlePeriodChange: this.handlePeriodChange.bind(this),
                toggleAutoRefresh: this.toggleAutoRefresh.bind(this),
                refreshDashboard: this.refreshDashboard.bind(this),
                viewDeliveryDetails: this.viewDeliveryDetails.bind(this)
            },
            
            // Event handlers
            events: {
                'change select.period-selector': 'handlePeriodChange',
                'click .refresh-btn': 'refreshDashboard',
                'change .auto-refresh-toggle': 'toggleAutoRefresh',
                'click .activity-item': 'viewDeliveryDetails'
            }
        });
    }
    
    /**
     * Component mounted - initialize charts
     */
    async mounted() {
        await this._initializeCharts();
        this._startAutoRefresh();
    }
    
    /**
     * Template
     */
    template() {
        return `
            <div class="dashboard-container p-6">
                <!-- Header -->
                <div class="dashboard-header mb-6">
                    <div class="flex justify-between items-center">
                        <h1 class="text-2xl font-bold text-gray-800">
                            <i class="fas fa-tachometer-alt mr-2"></i>儀表板
                        </h1>
                        
                        <div class="flex items-center gap-4">
                            <!-- Period Selector -->
                            <select class="period-selector px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="today" ${this.data.period === 'today' ? 'selected' : ''}>今日</option>
                                <option value="week" ${this.data.period === 'week' ? 'selected' : ''}>本週</option>
                                <option value="month" ${this.data.period === 'month' ? 'selected' : ''}>本月</option>
                                <option value="year" ${this.data.period === 'year' ? 'selected' : ''}>本年</option>
                            </select>
                            
                            <!-- Auto Refresh Toggle -->
                            <label class="flex items-center cursor-pointer">
                                <input type="checkbox" class="auto-refresh-toggle mr-2" 
                                    ${this.data.autoRefreshEnabled ? 'checked' : ''}>
                                <span class="text-sm text-gray-600">自動更新</span>
                            </label>
                            
                            <!-- Refresh Button -->
                            <button class="refresh-btn px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                                <i class="fas fa-sync-alt ${this.data.isLoading ? 'animate-spin' : ''}"></i>
                                刷新
                            </button>
                            
                            <!-- Last Update Time -->
                            <span class="text-sm text-gray-500">
                                更新時間: ${datetime.formatTime(this.data.lastUpdateTime)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- Statistics Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <!-- Total Deliveries -->
                    <div class="stat-card bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-500 text-sm">總配送單</p>
                                <p class="text-2xl font-bold text-gray-800 mt-1">
                                    ${format.formatNumber(this.computedState.totalDeliveries)}
                                </p>
                                <p class="text-xs text-gray-400 mt-1">
                                    ${this._getPeriodLabel()}
                                </p>
                            </div>
                            <div class="text-blue-500 text-3xl">
                                <i class="fas fa-truck"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Pending Deliveries -->
                    <div class="stat-card bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-500 text-sm">待配送</p>
                                <p class="text-2xl font-bold text-orange-600 mt-1">
                                    ${format.formatNumber(this.computedState.pendingDeliveries)}
                                </p>
                                <p class="text-xs text-gray-400 mt-1">
                                    佔比 ${this._getPercentage(this.computedState.pendingDeliveries, this.computedState.totalDeliveries)}%
                                </p>
                            </div>
                            <div class="text-orange-500 text-3xl">
                                <i class="fas fa-clock"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Total Revenue -->
                    <div class="stat-card bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-500 text-sm">總營收</p>
                                <p class="text-2xl font-bold text-green-600 mt-1">
                                    ${format.formatCurrency(this.computedState.totalRevenue)}
                                </p>
                                <p class="text-xs text-gray-400 mt-1">
                                    ${this._getPeriodLabel()}
                                </p>
                            </div>
                            <div class="text-green-500 text-3xl">
                                <i class="fas fa-dollar-sign"></i>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Active Clients -->
                    <div class="stat-card bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-gray-500 text-sm">活躍客戶</p>
                                <p class="text-2xl font-bold text-purple-600 mt-1">
                                    ${format.formatNumber(this.computedState.activeClients)}
                                </p>
                                <p class="text-xs text-gray-400 mt-1">
                                    總計 ${format.formatNumber(this.computedState.clients?.length || 0)} 位
                                </p>
                            </div>
                            <div class="text-purple-500 text-3xl">
                                <i class="fas fa-users"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Charts Section -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <!-- Delivery Status Chart -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">
                            <i class="fas fa-chart-pie mr-2"></i>配送狀態分布
                        </h3>
                        <div class="chart-container" style="position: relative; height: 300px;">
                            <canvas id="delivery-status-chart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Revenue Trend Chart -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">
                            <i class="fas fa-chart-line mr-2"></i>營收趨勢
                        </h3>
                        <div class="chart-container" style="position: relative; height: 300px;">
                            <canvas id="revenue-trend-chart"></canvas>
                        </div>
                    </div>
                </div>
                
                <!-- Bottom Section -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Driver Performance -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">
                            <i class="fas fa-user-tie mr-2"></i>司機績效
                        </h3>
                        <div class="chart-container" style="position: relative; height: 250px;">
                            <canvas id="driver-performance-chart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Recent Activities -->
                    <div class="bg-white rounded-lg shadow-sm p-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">
                            <i class="fas fa-history mr-2"></i>最近活動
                        </h3>
                        <div class="activities-list space-y-3 max-h-64 overflow-y-auto">
                            ${this._renderActivities()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render recent activities
     */
    _renderActivities() {
        const activities = this.computedState.recentActivities;
        
        if (!activities || activities.length === 0) {
            return '<p class="text-gray-500 text-center py-4">暫無最近活動</p>';
        }
        
        return activities.map(activity => {
            const statusIcon = this._getStatusIcon(activity.status);
            const statusColor = this._getStatusColor(activity.status);
            
            return `
                <div class="activity-item flex items-center p-3 hover:bg-gray-50 rounded cursor-pointer transition-colors" 
                     data-delivery-id="${activity.id}">
                    <div class="activity-icon mr-3 text-${statusColor}">
                        <i class="${statusIcon}"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm font-medium text-gray-800">
                            ${activity.clientName || '未知客戶'}
                        </p>
                        <p class="text-xs text-gray-500">
                            ${format.formatStatus(activity.status)} - ${datetime.getRelativeTime(activity.updatedAt)}
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-medium text-gray-700">
                            ${format.formatCurrency(activity.totalAmount || 0)}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Initialize charts
     */
    async _initializeCharts() {
        // Destroy existing charts
        this._destroyCharts();
        
        // Initialize new charts
        await this._initDeliveryStatusChart();
        await this._initRevenueTrendChart();
        await this._initDriverPerformanceChart();
    }
    
    /**
     * Initialize delivery status pie chart
     */
    async _initDeliveryStatusChart() {
        const canvas = this.$('#delivery-status-chart');
        if (!canvas) return;
        
        const deliveries = this._filterByPeriod(this.computedState.deliveries || []);
        const statusCounts = this._groupByStatus(deliveries);
        
        this.data.charts.delivery = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['待配送', '配送中', '已完成', '已取消'],
                datasets: [{
                    data: [
                        statusCounts.pending || 0,
                        statusCounts.delivering || 0,
                        statusCounts.completed || 0,
                        statusCounts.cancelled || 0
                    ],
                    backgroundColor: [
                        '#F59E0B',
                        '#3B82F6',
                        '#10B981',
                        '#EF4444'
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
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Initialize revenue trend line chart
     */
    async _initRevenueTrendChart() {
        const canvas = this.$('#revenue-trend-chart');
        if (!canvas) return;
        
        const trendData = this._getRevenueTrendData();
        
        this.data.charts.revenue = new Chart(canvas, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [{
                    label: '營收',
                    data: trendData.values,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '營收: ' + format.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return format.formatCurrency(value, true);
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Initialize driver performance bar chart
     */
    async _initDriverPerformanceChart() {
        const canvas = this.$('#driver-performance-chart');
        if (!canvas) return;
        
        const performanceData = this._getDriverPerformanceData();
        
        this.data.charts.driver = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: performanceData.labels,
                datasets: [{
                    label: '配送數量',
                    data: performanceData.values,
                    backgroundColor: '#3B82F6',
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
    
    /**
     * Update all charts
     */
    _updateCharts() {
        if (!this.isMounted) return;
        
        // Update delivery status chart
        if (this.data.charts.delivery) {
            const deliveries = this._filterByPeriod(this.computedState.deliveries || []);
            const statusCounts = this._groupByStatus(deliveries);
            
            this.data.charts.delivery.data.datasets[0].data = [
                statusCounts.pending || 0,
                statusCounts.delivering || 0,
                statusCounts.completed || 0,
                statusCounts.cancelled || 0
            ];
            this.data.charts.delivery.update();
        }
        
        // Update revenue trend chart
        if (this.data.charts.revenue) {
            const trendData = this._getRevenueTrendData();
            this.data.charts.revenue.data.labels = trendData.labels;
            this.data.charts.revenue.data.datasets[0].data = trendData.values;
            this.data.charts.revenue.update();
        }
        
        // Update driver performance chart
        if (this.data.charts.driver) {
            const performanceData = this._getDriverPerformanceData();
            this.data.charts.driver.data.labels = performanceData.labels;
            this.data.charts.driver.data.datasets[0].data = performanceData.values;
            this.data.charts.driver.update();
        }
    }
    
    /**
     * Filter deliveries by selected period
     */
    _filterByPeriod(deliveries) {
        if (!deliveries) return [];
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return deliveries.filter(delivery => {
            const deliveryDate = new Date(delivery.date);
            
            switch (this.data.period) {
                case 'today':
                    return deliveryDate >= today;
                    
                case 'week':
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    return deliveryDate >= weekStart;
                    
                case 'month':
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    return deliveryDate >= monthStart;
                    
                case 'year':
                    const yearStart = new Date(now.getFullYear(), 0, 1);
                    return deliveryDate >= yearStart;
                    
                default:
                    return true;
            }
        });
    }
    
    /**
     * Group deliveries by status
     */
    _groupByStatus(deliveries) {
        return deliveries.reduce((acc, delivery) => {
            acc[delivery.status] = (acc[delivery.status] || 0) + 1;
            return acc;
        }, {});
    }
    
    /**
     * Get revenue trend data
     */
    _getRevenueTrendData() {
        const deliveries = this._filterByPeriod(this.computedState.deliveries || []);
        const labels = [];
        const values = [];
        
        if (this.data.period === 'today') {
            // Hourly data
            for (let hour = 0; hour < 24; hour++) {
                labels.push(`${hour}:00`);
                const hourRevenue = deliveries
                    .filter(d => {
                        const date = new Date(d.completedAt || d.date);
                        return date.getHours() === hour && d.status === 'completed';
                    })
                    .reduce((sum, d) => sum + (d.totalAmount || 0), 0);
                values.push(hourRevenue);
            }
        } else if (this.data.period === 'week') {
            // Daily data
            const days = ['日', '一', '二', '三', '四', '五', '六'];
            for (let i = 0; i < 7; i++) {
                labels.push(`週${days[i]}`);
                const dayRevenue = deliveries
                    .filter(d => {
                        const date = new Date(d.date);
                        return date.getDay() === i && d.status === 'completed';
                    })
                    .reduce((sum, d) => sum + (d.totalAmount || 0), 0);
                values.push(dayRevenue);
            }
        } else if (this.data.period === 'month') {
            // Weekly data
            for (let week = 1; week <= 4; week++) {
                labels.push(`第${week}週`);
                const weekRevenue = deliveries
                    .filter(d => {
                        const date = new Date(d.date);
                        const weekNum = Math.ceil(date.getDate() / 7);
                        return weekNum === week && d.status === 'completed';
                    })
                    .reduce((sum, d) => sum + (d.totalAmount || 0), 0);
                values.push(weekRevenue);
            }
        } else {
            // Monthly data
            const months = ['一月', '二月', '三月', '四月', '五月', '六月', 
                           '七月', '八月', '九月', '十月', '十一月', '十二月'];
            for (let month = 0; month < 12; month++) {
                labels.push(months[month]);
                const monthRevenue = deliveries
                    .filter(d => {
                        const date = new Date(d.date);
                        return date.getMonth() === month && d.status === 'completed';
                    })
                    .reduce((sum, d) => sum + (d.totalAmount || 0), 0);
                values.push(monthRevenue);
            }
        }
        
        return { labels, values };
    }
    
    /**
     * Get driver performance data
     */
    _getDriverPerformanceData() {
        const deliveries = this._filterByPeriod(this.computedState.deliveries || []);
        const drivers = this.computedState.drivers || [];
        
        const performanceMap = deliveries.reduce((acc, delivery) => {
            if (delivery.driverId) {
                acc[delivery.driverId] = (acc[delivery.driverId] || 0) + 1;
            }
            return acc;
        }, {});
        
        const sortedDrivers = Object.entries(performanceMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const labels = sortedDrivers.map(([driverId]) => {
            const driver = drivers.find(d => d.id === driverId);
            return driver ? driver.name : '未知司機';
        });
        
        const values = sortedDrivers.map(([, count]) => count);
        
        return { labels, values };
    }
    
    /**
     * Get period label
     */
    _getPeriodLabel() {
        const labels = {
            today: '今日',
            week: '本週',
            month: '本月',
            year: '本年'
        };
        return labels[this.data.period] || '';
    }
    
    /**
     * Get percentage
     */
    _getPercentage(value, total) {
        if (!total) return 0;
        return Math.round((value / total) * 100);
    }
    
    /**
     * Get status icon
     */
    _getStatusIcon(status) {
        const icons = {
            pending: 'fas fa-clock',
            delivering: 'fas fa-truck',
            completed: 'fas fa-check-circle',
            cancelled: 'fas fa-times-circle'
        };
        return icons[status] || 'fas fa-question-circle';
    }
    
    /**
     * Get status color
     */
    _getStatusColor(status) {
        const colors = {
            pending: 'orange-500',
            delivering: 'blue-500',
            completed: 'green-500',
            cancelled: 'red-500'
        };
        return colors[status] || 'gray-500';
    }
    
    /**
     * Handle period change
     */
    handlePeriodChange(event) {
        this.data.period = event.target.value;
    }
    
    /**
     * Toggle auto refresh
     */
    toggleAutoRefresh(event) {
        this.data.autoRefreshEnabled = event.target.checked;
        
        if (this.data.autoRefreshEnabled) {
            this._startAutoRefresh();
        } else {
            this._stopAutoRefresh();
        }
    }
    
    /**
     * Start auto refresh
     */
    _startAutoRefresh() {
        if (!this.data.autoRefreshEnabled) return;
        
        this._stopAutoRefresh();
        
        this.data.refreshTimer = setInterval(() => {
            this.refreshDashboard();
        }, this.data.refreshInterval);
    }
    
    /**
     * Stop auto refresh
     */
    _stopAutoRefresh() {
        if (this.data.refreshTimer) {
            clearInterval(this.data.refreshTimer);
            this.data.refreshTimer = null;
        }
    }
    
    /**
     * Refresh dashboard data
     */
    async refreshDashboard() {
        if (this.data.isLoading) return;
        
        this.data.isLoading = true;
        this.render();
        
        try {
            // Simulate API calls to refresh data
            // In real implementation, this would call API endpoints
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update last update time
            this.data.lastUpdateTime = new Date();
            
            // Update charts
            this._updateCharts();
            
            dom.showNotification('儀表板已更新', 'success');
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
            dom.showNotification('更新失敗', 'error');
        } finally {
            this.data.isLoading = false;
            this.render();
        }
    }
    
    /**
     * View delivery details
     */
    viewDeliveryDetails(event) {
        const deliveryId = event.currentTarget.dataset.deliveryId;
        if (deliveryId) {
            // Navigate to delivery details
            store.set('navigation.currentPage', 'deliveries');
            store.set('deliveries.selectedId', deliveryId);
        }
    }
    
    /**
     * Destroy charts
     */
    _destroyCharts() {
        Object.values(this.data.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        
        this.data.charts = {
            delivery: null,
            revenue: null,
            driver: null
        };
    }
    
    /**
     * Component destroy
     */
    async destroy() {
        this._stopAutoRefresh();
        this._destroyCharts();
        await super.destroy();
    }
}

// Export as default
export default Dashboard;