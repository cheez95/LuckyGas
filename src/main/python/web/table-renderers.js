/**
 * Table Rendering Module
 * Handles all table rendering functions for the LuckyGas application
 */

(function(window) {
    'use strict';

    // Import dependencies from global scope
    const { api, html, table, utils, SecurityUtils } = window;
    const { formatDate, capitalize, showNotification } = utils || {};
    const APP_CONSTANTS = window.APP_CONSTANTS || {};
    const APP_CONFIG = window.APP_CONFIG || {};
    const statusDisplay = APP_CONSTANTS?.STATUS_DISPLAY || {};

    /**
     * Render clients table
     * @param {Array} clients - Array of client objects to display
     */
    function renderClientsTable(clients) {
        const columns = [
            {
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: client => `<div class="text-gray-900">${client.client_code || client.id}</div>
                                 <div class="text-xs text-gray-500">ID: ${client.id}</div>`
            },
            {
                class: 'px-6 py-4 whitespace-nowrap',
                render: client => `<div class="font-medium">${client.name || '-'}</div>
                                 <div class="text-sm text-gray-600">${client.invoice_title || '-'}</div>
                                 ${client.contact_person ? `<div class="text-xs text-gray-500">${client.contact_person}</div>` : ''}`
            },
            { field: 'address', class: 'px-6 py-4 text-sm' },
            { field: 'district', class: 'px-6 py-4 whitespace-nowrap text-sm', format: v => v || '-' },
            {
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: client => `<div>${client.total_orders || 0} 筆</div>
                                 ${client.last_order_date ? `<div class="text-xs text-gray-500">${formatDate(client.last_order_date)}</div>` : ''}`
            },
            {
                class: 'px-6 py-4 whitespace-nowrap',
                render: client => `<span class="px-2 py-1 text-xs rounded-full ${client.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${client.is_active ? '啟用' : '停用'}</span>`
            },
            {
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: client => table.actions([
                    { icon: 'eye', color: 'blue', title: '檢視', onClick: () => viewClient(client.client_code) },
                    { icon: 'edit', color: 'green', title: '編輯', onClick: () => editClient(client.client_code) },
                    { icon: client.is_active ? 'pause' : 'play', color: 'orange', title: client.is_active ? '停用' : '啟用', onClick: () => toggleClientStatus(client.client_code, client.is_active) }
                ])
            }
        ];
        
        table.render('clients-tbody', clients, columns, '沒有找到符合條件的客戶');
    }

    /**
     * Render deliveries table
     * @param {Array} deliveries - Array of delivery objects to display
     */
    function renderDeliveriesTable(deliveries) {
        const columns = [
            {
                // Order Number
                class: 'px-6 py-4 whitespace-nowrap text-sm font-medium',
                render: d => d.order_number || d.id
            },
            {
                // Client Name
                field: 'client_name',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Delivery Address
                class: 'px-6 py-4 text-sm',
                render: d => `<div>${SecurityUtils.escapeHtml(d.delivery_address)}</div>
                             <div class="text-xs text-gray-500">${SecurityUtils.escapeHtml(d.delivery_district || '')}</div>`
            },
            {
                // Scheduled Date/Time
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: d => `<div>${formatDate(d.scheduled_date)}</div>
                             <div class="text-xs text-gray-500">${d.scheduled_time_slot || '-'}</div>`
            },
            {
                // Quantity/Amount
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: d => `${d.gas_quantity} 桶 / $${d.total_amount}`
            },
            {
                // Status
                class: 'px-6 py-4 whitespace-nowrap',
                render: d => {
                    const status = statusDisplay[d.status] || { 
                        text: d.status, 
                        class: 'bg-gray-100 text-gray-800' 
                    };
                    return table.statusBadge(d.status, statusDisplay);
                }
            },
            {
                // Driver Name
                field: 'driver_name',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Actions
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: d => {
                    const buttons = [];
                    
                    if (d.status === 'pending') {
                        buttons.push({
                            icon: 'fas fa-user-plus',
                            title: '指派',
                            class: 'text-blue-600 hover:text-blue-900 mr-2',
                            onclick: `assignDelivery(${d.id})`
                        });
                    }
                    
                    buttons.push({
                        icon: 'fas fa-eye',
                        title: '檢視',
                        class: 'text-green-600 hover:text-green-900 mr-2',
                        onclick: `viewDelivery(${d.id})`
                    });
                    
                    if (d.status !== 'completed' && d.status !== 'cancelled') {
                        buttons.push({
                            icon: 'fas fa-sync',
                            title: '更新狀態',
                            class: 'text-purple-600 hover:text-purple-900',
                            onclick: `updateDeliveryStatus(${d.id}, '${d.status}')`
                        });
                    }
                    
                    return table.actionButtons(buttons);
                }
            }
        ];
        
        table.render('deliveries-tbody', deliveries, columns, '沒有找到符合條件的配送單');
    }

    /**
     * Render drivers table
     * @param {Array} drivers - Array of driver objects to display
     */
    function renderDriversTable(drivers) {
        const columns = [
            {
                // ID
                field: 'id',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Name
                field: 'name',
                class: 'px-6 py-4 whitespace-nowrap font-medium'
            },
            {
                // Phone
                field: 'phone',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Employee ID
                field: 'employee_id',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Status
                class: 'px-6 py-4 whitespace-nowrap',
                render: d => table.statusBadge(d.is_active ? 'active' : 'inactive', {
                    active: { text: '在職', class: 'bg-green-100 text-green-800' },
                    inactive: { text: '離職', class: 'bg-red-100 text-red-800' }
                })
            },
            {
                // Actions
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: d => table.actionButtons([
                    { 
                        icon: 'fas fa-edit', 
                        title: '編輯', 
                        class: 'text-blue-600 hover:text-blue-900 mr-2', 
                        onclick: `editDriver(${d.id})` 
                    },
                    { 
                        icon: `fas fa-${d.is_active ? 'pause' : 'play'}`, 
                        title: d.is_active ? '停用' : '啟用', 
                        class: 'text-orange-600 hover:text-orange-900', 
                        onclick: `toggleDriverStatus(${d.id}, ${d.is_active})` 
                    }
                ])
            }
        ];
        
        table.render('drivers-tbody', drivers, columns, '沒有司機資料');
    }

    /**
     * Render vehicles table
     * @param {Array} vehicles - Array of vehicle objects to display
     */
    function renderVehiclesTable(vehicles) {
        const columns = [
            {
                // ID
                field: 'id',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Plate Number
                field: 'plate_number',
                class: 'px-6 py-4 whitespace-nowrap font-medium'
            },
            {
                // Vehicle Type
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: v => v.vehicle_type === 1 ? '汽車' : '機車'
            },
            {
                // Last Maintenance
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: v => v.last_maintenance ? formatDate(v.last_maintenance) : '-'
            },
            {
                // Status
                class: 'px-6 py-4 whitespace-nowrap',
                render: v => table.statusBadge(v.is_active ? 'active' : 'inactive', {
                    active: { text: '可用', class: 'bg-green-100 text-green-800' },
                    inactive: { text: '停用', class: 'bg-red-100 text-red-800' }
                })
            },
            {
                // Actions
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: v => table.actionButtons([
                    { 
                        icon: 'fas fa-edit', 
                        title: '編輯', 
                        class: 'text-blue-600 hover:text-blue-900 mr-2', 
                        onclick: `editVehicle(${v.id})` 
                    },
                    { 
                        icon: `fas fa-${v.is_active ? 'pause' : 'play'}`, 
                        title: v.is_active ? '停用' : '啟用', 
                        class: 'text-orange-600 hover:text-orange-900', 
                        onclick: `toggleVehicleStatus(${v.id}, ${v.is_active})` 
                    }
                ])
            }
        ];
        
        table.render('vehicles-tbody', vehicles, columns, '沒有車輛資料');
    }

    /**
     * Display routes in table
     * @param {Array} routes - Array of route objects to display
     */
    function displayRoutes(routes) {
        const columns = [
            {
                // Date
                class: 'px-6 py-4 whitespace-nowrap text-sm',
                render: r => formatDate(r.route_date)
            },
            {
                // Route Name
                class: 'px-6 py-4 whitespace-nowrap',
                render: r => `<div class="text-sm font-medium text-gray-900">${r.route_name}</div>`
            },
            {
                // Area
                field: 'area',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Driver
                field: 'driver_name',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Vehicle
                field: 'vehicle_plate',
                class: 'px-6 py-4 whitespace-nowrap text-sm'
            },
            {
                // Total Clients
                field: 'total_clients',
                class: 'px-6 py-4 whitespace-nowrap text-sm text-center'
            },
            {
                // Distance
                class: 'px-6 py-4 whitespace-nowrap text-sm text-center',
                render: r => `${r.total_distance_km.toFixed(1)} km`
            },
            {
                // Status
                class: 'px-6 py-4 whitespace-nowrap',
                render: r => table.statusBadge(r.is_optimized ? 'optimized' : 'manual', {
                    optimized: { text: '已優化', class: 'bg-green-100 text-green-800' },
                    manual: { text: '手動', class: 'bg-gray-100 text-gray-800' }
                })
            },
            {
                // Actions
                class: 'px-6 py-4 whitespace-nowrap text-sm font-medium',
                render: r => table.actionButtons([
                    { icon: 'fas fa-eye', title: '檢視', class: 'text-blue-600 hover:text-blue-900 mr-2', 
                      onclick: `viewRoute(${r.id})` },
                    { icon: 'fas fa-map-marked-alt', title: '地圖', class: 'text-green-600 hover:text-green-900 mr-2', 
                      onclick: `showRouteMap(${r.id})` },
                    { icon: 'fas fa-edit', title: '編輯', class: 'text-yellow-600 hover:text-yellow-900 mr-2', 
                      onclick: `editRoute(${r.id})` },
                    { icon: 'fas fa-trash', title: '刪除', class: 'text-red-600 hover:text-red-900', 
                      onclick: `deleteRoute(${r.id})` }
                ])
            }
        ];
        
        table.render('routes-tbody', routes, columns, '沒有找到路線資料');
        
        // Update showing count
        const showingElement = document.getElementById('routes-showing');
        if (showingElement) {
            showingElement.textContent = routes.length;
        }
    }

    /**
     * Update route pagination
     * @param {number} total - Total number of routes
     * @param {number} currentPage - Current page number
     * @param {number} pageSize - Number of items per page
     */
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
                <button data-action="loadRoutes" data-page="${currentPage - 1}" class="px-3 py-1 border rounded hover:bg-gray-100">
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
                    <button data-action="loadRoutes" data-page="${i}" class="px-3 py-1 border rounded hover:bg-gray-100">
                        ${i}
                    </button>
                `;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                paginationHTML += '<span class="px-2">...</span>';
            }
        }
        
        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `
                <button data-action="loadRoutes" data-page="${currentPage + 1}" class="px-3 py-1 border rounded hover:bg-gray-100">
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }
        
        paginationContainer.innerHTML = paginationHTML;
    }

    /**
     * Render client deliveries
     * @param {Object} data - Delivery data with items and pagination info
     * @param {string} clientCode - Client code for the deliveries
     */
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
                            <tr class="hover:bg-gray-50 cursor-pointer transition-colors" data-delivery-id="${delivery.id}">
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
                            <button data-action="loadClientDeliveries" data-client-code="${clientCode}" data-page="${data.page - 1}" 
                                    class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                        ` : ''}
                        
                        ${Array.from({length: Math.min(5, data.total_pages)}, (_, i) => {
                            const pageNum = i + 1;
                            const isActive = pageNum === data.page;
                            return `
                                <button data-action="loadClientDeliveries" data-client-code="${clientCode}" data-page="${pageNum}" 
                                        class="px-3 py-1 text-sm ${isActive ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'} border rounded hover:bg-gray-50">
                                    ${pageNum}
                                </button>
                            `;
                        }).join('')}
                        
                        ${data.page < data.total_pages ? `
                            <button data-action="loadClientDeliveries" data-client-code="${clientCode}" data-page="${data.page + 1}" 
                                    class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        ` : ''}
                    </nav>
                </div>
            ` : ''}
        `;
        
        // Add click handlers to delivery rows
        document.querySelectorAll('[data-delivery-id]').forEach(row => {
            row.addEventListener('click', function() {
                viewDelivery(this.dataset.deliveryId);
            });
        });
    }

    /**
     * Enhanced pagination with better UI
     * @param {string} section - Section identifier (clients, deliveries, etc.)
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {number} totalItems - Total number of items
     */
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
                <button data-action="load${capitalize(section)}" data-page="1" 
                        class="px-3 py-1 border rounded hover:bg-gray-100 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                        ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-angle-double-left"></i>
                </button>
                <button data-action="load${capitalize(section)}" data-page="${currentPage - 1}" 
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
                <button data-action="load${capitalize(section)}" data-page="${page}" 
                        class="px-3 py-1 border rounded ${page === currentPage ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}">
                    ${page}
                </button>
            `;
            
            lastPage = page;
        });
        
        // Next and Last buttons
        if (currentPage < totalPages) {
            container.innerHTML += `
                <button data-action="load${capitalize(section)}" data-page="${currentPage + 1}" 
                        class="px-3 py-1 border rounded hover:bg-gray-100">
                    <i class="fas fa-angle-right"></i>
                </button>
                <button data-action="load${capitalize(section)}" data-page="${totalPages}" 
                        class="px-3 py-1 border rounded hover:bg-gray-100 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}"
                        ${currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-angle-double-right"></i>
                </button>
            `;
        }
    }

    /**
     * Display scheduling results
     * @param {Array} results - Array of scheduling results
     * @param {number} successCount - Number of successful schedules
     * @param {number} failCount - Number of failed schedules
     */
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
                                <button data-action="viewScheduleDetails" data-date="${result.date}" class="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                                    查看詳情
                                </button>
                                <button data-action="applySchedule" data-date="${result.date}" class="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
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

    // Helper functions needed by table renderers
    function calculateDeliveryStats(deliveries) {
        return {
            totalCount: deliveries.length,
            completed: deliveries.filter(d => d.status === 'completed').length,
            totalGas: deliveries.reduce((sum, d) => sum + (d.total_quantity || 0), 0),
            totalAmount: deliveries.reduce((sum, d) => sum + (d.total_amount || 0), 0)
        };
    }

    function getStatusBadge(status) {
        const display = statusDisplay[status] || { text: status, class: 'bg-gray-100 text-gray-800' };
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${display.class}">
                    ${display.text}
                </span>`;
    }

    // Expose all functions
    const tableRenderers = {
        renderClientsTable,
        renderDeliveriesTable,
        renderDriversTable,
        renderVehiclesTable,
        displayRoutes,
        updateRoutePagination,
        renderClientDeliveries,
        updatePagination,
        displaySchedulingResults
    };

    // Export to window
    window.tableRenderers = tableRenderers;

    // Also export individual functions for backward compatibility
    Object.keys(tableRenderers).forEach(key => {
        window[key] = tableRenderers[key];
    });

})(window);