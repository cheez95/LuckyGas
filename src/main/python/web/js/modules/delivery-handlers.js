/**
 * Delivery Handlers Module
 * Contains all delivery-related functions
 * Functions: loadDeliveries, viewDelivery, createDelivery, updateDeliveryStatus, etc.
 */

(function() {
    'use strict';
    
    // Dependencies check
    if (!window.api || !window.showNotification || !window.renderDeliveriesTable) {
        console.error('❌ Delivery Handlers: Required dependencies not loaded');
        return;
    }
    
    // Global variables (from app.js)
    const API_BASE = window.API_BASE || '/api';
    const secureFetch = window.secureFetch || fetch;
    
    // Local references
    let allDeliveries = window.allDeliveries || [];
    let currentDeliveryPage = window.currentDeliveryPage || 1;
    let currentDeliveryTab = window.currentDeliveryTab || 'planned';
    let deliveryFilters = window.deliveryFilters || {
        dateFrom: '',
        dateTo: '',
        status: '',
        driverId: '',
        clientId: '',
        sortBy: '',
        sortOrder: 'asc'
    };
    let isLoadingDeliveries = false;
    let loadingTimeoutId = null; // Track loading timeout globally
    
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
            statusFilter.appendChild(window.SecurityUtils.createOption('', '所有狀態'));
            
            if (tab === 'planned') {
                statusFilter.appendChild(window.SecurityUtils.createOption('pending', '待處理'));
                statusFilter.appendChild(window.SecurityUtils.createOption('assigned', '已指派'));
                statusFilter.appendChild(window.SecurityUtils.createOption('in_progress', '配送中'));
            } else {
                statusFilter.appendChild(window.SecurityUtils.createOption('completed', '已完成'));
                statusFilter.appendChild(window.SecurityUtils.createOption('cancelled', '已取消'));
            }
            
            // Reset the status filter
            statusFilter.value = '';
            deliveryFilters.status = '';
        }
        
        // Reset to first page and reload deliveries with appropriate filter
        currentDeliveryPage = 1;
        loadDeliveries(1);
    }
    
    // Enhanced Deliveries with date range and filters
    async function loadDeliveries(page = 1) {
        // Prevent recursive calls
        if (isLoadingDeliveries) {
            console.warn('⚠️ loadDeliveries called while already loading, skipping...');
            return;
        }
        
        // Clear any existing timeout
        if (loadingTimeoutId) {
            clearTimeout(loadingTimeoutId);
            loadingTimeoutId = null;
        }
        
        isLoadingDeliveries = true;
        console.log('🔄 Loading deliveries started...');
        
        // Set a safety timeout to reset the flag after 30 seconds
        loadingTimeoutId = setTimeout(() => {
            console.error('❌ Loading timeout reached - forcing reset of isLoadingDeliveries flag');
            isLoadingDeliveries = false;
            loadingTimeoutId = null;
            
            // Show timeout error in UI
            const tbody = document.getElementById('deliveries-tbody');
            if (tbody) {
                while (tbody.firstChild) {
                    tbody.removeChild(tbody.firstChild);
                }
                
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 8;
                cell.className = 'px-6 py-4 text-center text-orange-500';
                cell.innerHTML = `
                    <div>
                        <p>載入逾時，請重新整理頁面</p>
                        <button onclick="window.forceReloadDeliveries()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            強制重新載入
                        </button>
                    </div>
                `;
                row.appendChild(cell);
                tbody.appendChild(row);
            }
            
            showNotification('載入逾時，請重新嘗試', 'warning');
        }, 30000); // 30 second timeout
        
        try {
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
            
            // Use api utility with error handling built-in
            const data = await api.get(`/deliveries?${params}`, {
                errorMessage: '載入配送單失敗'
            });
            
            allDeliveries = data.items || [];
            currentDeliveryPage = page;
            
            // Render table
            renderDeliveriesTable(allDeliveries);
            
            // Update pagination
            window.updatePagination('deliveries', data.page, data.total_pages, data.total);
            
            // Update summary statistics
            updateDeliverySummary(data.items);
            
            console.log('✅ Deliveries loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading deliveries:', error);
            console.error('Current tab:', currentDeliveryTab);
            console.error('Loading flag will be reset');
            
            // Error notification already handled by api utility
            // Just show empty state in table
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
                cell.innerHTML = `
                    <div>
                        <p>${error.message || '載入配送單失敗'}</p>
                        <button onclick="window.forceReloadDeliveries()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            重新載入
                        </button>
                    </div>
                `;
                row.appendChild(cell);
                tbody.appendChild(row);
            }
        } finally {
            // Always reset loading flag and clear timeout
            isLoadingDeliveries = false;
            if (loadingTimeoutId) {
                clearTimeout(loadingTimeoutId);
                loadingTimeoutId = null;
            }
            console.log('🔓 isLoadingDeliveries flag reset');
        }
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
            const mainDiv = document.createElement('div');
            mainDiv.className = 'bg-white rounded-lg shadow p-4 mb-6';
            
            // Add heading
            const heading = document.createElement('h3');
            heading.className = 'font-semibold mb-3';
            heading.textContent = '配送摘要';
            mainDiv.appendChild(heading);
            
            // Create grid container
            const gridDiv = document.createElement('div');
            gridDiv.className = 'grid grid-cols-2 md:grid-cols-5 gap-4 text-sm';
            
            // Add total count
            const totalDiv = document.createElement('div');
            const totalLabel = document.createElement('p');
            totalLabel.className = 'text-gray-600';
            totalLabel.textContent = '總筆數';
            totalDiv.appendChild(totalLabel);
            
            const totalValue = document.createElement('p');
            totalValue.className = 'font-bold text-lg';
            totalValue.textContent = String(summary.total);
            totalDiv.appendChild(totalValue);
            gridDiv.appendChild(totalDiv);
            
            // Add total amount
            const amountDiv = document.createElement('div');
            const amountLabel = document.createElement('p');
            amountLabel.className = 'text-gray-600';
            amountLabel.textContent = '總金額';
            amountDiv.appendChild(amountLabel);
            
            const amountValue = document.createElement('p');
            amountValue.className = 'font-bold text-lg';
            amountValue.textContent = '$' + summary.totalAmount.toLocaleString();
            amountDiv.appendChild(amountValue);
            gridDiv.appendChild(amountDiv);
            
            // Add total gas
            const gasDiv = document.createElement('div');
            const gasLabel = document.createElement('p');
            gasLabel.className = 'text-gray-600';
            gasLabel.textContent = '總瓦斯桶數';
            gasDiv.appendChild(gasLabel);
            
            const gasValue = document.createElement('p');
            gasValue.className = 'font-bold text-lg';
            gasValue.textContent = String(summary.totalGas);
            gasDiv.appendChild(gasValue);
            gridDiv.appendChild(gasDiv);
            
            // Add status columns based on current tab
            if (currentDeliveryTab === 'planned') {
                // For planned tab: show pending, assigned, and in_progress
                const pendingDiv = document.createElement('div');
                const pendingLabel = document.createElement('p');
                pendingLabel.className = 'text-gray-600';
                pendingLabel.textContent = '待處理';
                pendingDiv.appendChild(pendingLabel);
                
                const pendingValue = document.createElement('p');
                pendingValue.className = 'font-bold text-yellow-600 text-lg';
                pendingValue.textContent = String(summary.byStatus.pending);
                pendingDiv.appendChild(pendingValue);
                gridDiv.appendChild(pendingDiv);
                
                const assignedDiv = document.createElement('div');
                const assignedLabel = document.createElement('p');
                assignedLabel.className = 'text-gray-600';
                assignedLabel.textContent = '已指派';
                assignedDiv.appendChild(assignedLabel);
                
                const assignedValue = document.createElement('p');
                assignedValue.className = 'font-bold text-blue-600 text-lg';
                assignedValue.textContent = String(summary.byStatus.assigned);
                assignedDiv.appendChild(assignedValue);
                gridDiv.appendChild(assignedDiv);
                
                const inProgressDiv = document.createElement('div');
                const inProgressLabel = document.createElement('p');
                inProgressLabel.className = 'text-gray-600';
                inProgressLabel.textContent = '配送中';
                inProgressDiv.appendChild(inProgressLabel);
                
                const inProgressValue = document.createElement('p');
                inProgressValue.className = 'font-bold text-purple-600 text-lg';
                inProgressValue.textContent = String(summary.byStatus.in_progress);
                inProgressDiv.appendChild(inProgressValue);
                gridDiv.appendChild(inProgressDiv);
            } else {
                // For history tab: show completed and cancelled
                const completedDiv = document.createElement('div');
                const completedLabel = document.createElement('p');
                completedLabel.className = 'text-gray-600';
                completedLabel.textContent = '已完成';
                completedDiv.appendChild(completedLabel);
                
                const completedValue = document.createElement('p');
                completedValue.className = 'font-bold text-green-600 text-lg';
                completedValue.textContent = String(summary.byStatus.completed);
                completedDiv.appendChild(completedValue);
                gridDiv.appendChild(completedDiv);
                
                const cancelledDiv = document.createElement('div');
                const cancelledLabel = document.createElement('p');
                cancelledLabel.className = 'text-gray-600';
                cancelledLabel.textContent = '已取消';
                cancelledDiv.appendChild(cancelledLabel);
                
                const cancelledValue = document.createElement('p');
                cancelledValue.className = 'font-bold text-red-600 text-lg';
                cancelledValue.textContent = String(summary.byStatus.cancelled);
                cancelledDiv.appendChild(cancelledValue);
                gridDiv.appendChild(cancelledDiv);
            }
            
            mainDiv.appendChild(gridDiv);
            summaryContainer.appendChild(mainDiv);
        }
    }
    
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
    
    async function exportDeliveries() {
        const params = new URLSearchParams(deliveryFilters);
        params.append('export', 'csv');
        
        const blob = await api.get(`/deliveries?${params}`, {
            successMessage: '匯出成功',
            errorMessage: '匯出失敗'
        }).catch(() => null);
        
        if (blob && blob instanceof Blob) {
            window.html.downloadBlob(blob, `deliveries_${new Date().toISOString().split('T')[0]}.csv`);
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
                if (clientSelect && window.allClients.length === 0) {
                    // Load clients if not already loaded
                    const data = await api.get('/clients?limit=1000', { 
                        skipNotification: true 
                    }).catch(() => null);
                    
                    if (data) {
                        window.allClients = data.items || [];
                    }
                }
                
                // Populate dropdown
                if (clientSelect) {
                    clientSelect.innerHTML = '<option value="">請選擇客戶</option>';
                    window.allClients.forEach(client => {
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
        
        const modal = window.createEditModal('指派配送單', modalContent);
        
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
                    window.closeModal(modal);
                    loadDeliveries(currentDeliveryPage);
                } else {
                    throw new Error('Assign failed');
                }
            } catch (error) {
                showNotification('指派失敗', 'error');
            }
        });
    }
    
    function loadWeeklyDeliveryChartFromStats(weekTrend) {
        try {
            if (!weekTrend || weekTrend.length === 0) {
                console.warn('No week trend data available');
                return;
            }
            
            const labels = weekTrend.map(day => day.day);
            const totalData = weekTrend.map(day => day.total);
            const completedData = weekTrend.map(day => day.completed);
            
            window.deliveryChart = window.chartUtils.createLineChart({
                canvasId: 'deliveryChart',
                labels: labels,
                datasets: [
                    {
                        label: '總配送數',
                        data: totalData
                    },
                    {
                        label: '已完成',
                        data: completedData
                    }
                ],
                existingChart: window.deliveryChart
            });
        } catch (error) {
            console.error('Error loading delivery chart:', error);
        }
    }
    
    // View delivery details
    async function viewDeliveryDetails(deliveryId) {
        const delivery = await api.get(`/deliveries/${deliveryId}`, {
            errorMessage: '載入配送資料失敗'
        }).catch(() => null);
        
        if (!delivery) return;
            
            const modalContent = `
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-gray-600">配送編號</p>
                        <p class="font-medium">#${delivery.id}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600">狀態</p>
                        <p class="font-medium">
                            <span class="px-2 py-1 text-xs rounded-full ${window.getStatusColor(delivery.status)}">
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
                        <p class="font-medium">${window.formatDate(delivery.scheduled_date)}</p>
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
            
            const fullContent = `
                ${modalContent}
                <div class="mt-6 flex justify-end gap-2">
                    ${delivery.status === 'pending' ? `
                        <button data-action="assignDriver" data-delivery-id="${delivery.id}" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            指派司機
                        </button>
                    ` : ''}
                    <button data-action="updateDeliveryStatus" data-delivery-id="${delivery.id}" data-status="${delivery.status}" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        更新狀態
                    </button>
                    <button data-action="closeModal" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                        關閉
                    </button>
                </div>
            `;
            
            const modal = window.createModal(fullContent, '配送單詳細資料');
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
                <form id="assign-driver-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">選擇司機</label>
                        <select name="driver_id" required class="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500">
                            <option value="">請選擇司機</option>
                            ${driverOptions}
                        </select>
                    </div>
                    <div class="flex justify-end gap-2">
                        <button type="button" data-action="closeModal" class="px-4 py-2 text-gray-600 hover:text-gray-800">
                            取消
                        </button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            確定指派
                        </button>
                    </div>
                </form>
            `;
            
            const modal = window.createModal(modalContent, '指派司機');
            
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
                        window.closeModal(modal);
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
    
    // Note: loadPendingDeliveries is not found in app.js
    async function loadPendingDeliveries(page = 1) {
        // This might be a legacy function or specific implementation
        // For now, redirect to loadDeliveries with pending filter
        deliveryFilters.status = 'pending';
        return loadDeliveries(page);
    }
    
    // Note: showCreateDeliveryModal is not found in app.js
    function showCreateDeliveryModal() {
        // This might be the same as showAddDeliveryModal
        return showAddDeliveryModal();
    }
    
    // Note: createDelivery, updateDelivery, deleteDelivery are not found in app.js
    // These might be handled by form submissions or other mechanisms
    async function createDelivery() {
        console.warn('createDelivery function not implemented in original app.js');
    }
    
    async function updateDelivery(deliveryId) {
        console.warn('updateDelivery function not implemented in original app.js');
    }
    
    async function deleteDelivery(deliveryId) {
        console.warn('deleteDelivery function not implemented in original app.js');
    }
    
    // Force reload deliveries function that bypasses the loading flag
    async function forceReloadDeliveries() {
        console.log('🔄 Force reloading deliveries...');
        
        // Clear any existing timeout
        if (loadingTimeoutId) {
            clearTimeout(loadingTimeoutId);
            loadingTimeoutId = null;
        }
        
        // Force reset the loading flag
        isLoadingDeliveries = false;
        
        // Clear any existing error messages
        const tbody = document.getElementById('deliveries-tbody');
        if (tbody) {
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }
            
            // Show loading state
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 8;
            cell.className = 'px-6 py-4 text-center text-gray-500';
            cell.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> 載入中...';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        
        // Reload deliveries
        await loadDeliveries(currentDeliveryPage);
    }
    
    // Debug function to check loading state
    function getLoadingState() {
        return {
            isLoadingDeliveries,
            hasTimeout: !!loadingTimeoutId,
            currentTab: currentDeliveryTab,
            currentPage: currentDeliveryPage
        };
    }
    
    // Export delivery handlers
    window.deliveryHandlers = {
        loadDeliveries,
        loadPendingDeliveries,
        viewDelivery,
        showCreateDeliveryModal,
        showAddDeliveryModal,
        createDelivery,
        updateDeliveryStatus,
        assignDriver,
        assignDelivery,
        updateDelivery,
        deleteDelivery,
        exportDeliveries,
        switchDeliveryTab,
        updateDeliverySummary,
        calculateDeliveryStats,
        loadWeeklyDeliveryChartFromStats,
        viewDeliveryDetails,
        getStatusText,
        getPaymentMethodText,
        forceReloadDeliveries,
        getLoadingState
    };
    
    // Also export individually for backward compatibility
    window.loadDeliveries = loadDeliveries;
    window.loadPendingDeliveries = loadPendingDeliveries;
    window.viewDelivery = viewDelivery;
    window.showCreateDeliveryModal = showCreateDeliveryModal;
    window.showAddDeliveryModal = showAddDeliveryModal;
    window.createDelivery = createDelivery;
    window.updateDeliveryStatus = updateDeliveryStatus;
    window.assignDriver = assignDriver;
    window.assignDelivery = assignDelivery;
    window.updateDelivery = updateDelivery;
    window.deleteDelivery = deleteDelivery;
    window.exportDeliveries = exportDeliveries;
    window.switchDeliveryTab = switchDeliveryTab;
    window.updateDeliverySummary = updateDeliverySummary;
    window.calculateDeliveryStats = calculateDeliveryStats;
    window.loadWeeklyDeliveryChartFromStats = loadWeeklyDeliveryChartFromStats;
    window.viewDeliveryDetails = viewDeliveryDetails;
    window.getStatusText = getStatusText;
    window.getPaymentMethodText = getPaymentMethodText;
    window.forceReloadDeliveries = forceReloadDeliveries;
    window.getLoadingState = getLoadingState;
    
    // Update global references
    window.currentDeliveryTab = currentDeliveryTab;
    window.currentDeliveryPage = currentDeliveryPage;
    window.deliveryFilters = deliveryFilters;
    window.allDeliveries = allDeliveries;
    
    console.log('✅ Delivery Handlers module loaded');
})();