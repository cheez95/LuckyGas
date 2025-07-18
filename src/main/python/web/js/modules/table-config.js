/**
 * Table Configuration Module
 * Centralized table configurations for all entity types
 * Defines columns, rendering, and formatting for each table
 */

(function() {
    'use strict';
    
    // Ensure dependencies are loaded
    if (!window.html || !window.table) {
        console.error('❌ Table Config: Required utilities not loaded');
        return;
    }
    
    // Status configurations for different entities
    const statusConfigs = {
        delivery: {
            pending: { text: '待處理', class: 'bg-yellow-100 text-yellow-800' },
            assigned: { text: '已指派', class: 'bg-blue-100 text-blue-800' },
            in_progress: { text: '配送中', class: 'bg-indigo-100 text-indigo-800' },
            completed: { text: '已完成', class: 'bg-green-100 text-green-800' },
            cancelled: { text: '已取消', class: 'bg-red-100 text-red-800' }
        },
        driver: {
            active: { text: '在職', class: 'bg-green-100 text-green-800' },
            inactive: { text: '離職', class: 'bg-red-100 text-red-800' },
            on_leave: { text: '請假', class: 'bg-yellow-100 text-yellow-800' }
        },
        vehicle: {
            active: { text: '可用', class: 'bg-green-100 text-green-800' },
            maintenance: { text: '維修中', class: 'bg-yellow-100 text-yellow-800' },
            inactive: { text: '停用', class: 'bg-red-100 text-red-800' }
        },
        client: {
            active: { text: '正常', class: 'bg-green-100 text-green-800' },
            inactive: { text: '停用', class: 'bg-red-100 text-red-800' }
        }
    };
    
    // Helper function to format currency
    function formatCurrency(amount) {
        return `$${parseFloat(amount || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }
    
    // Helper function to format date
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-TW');
    }
    
    // Helper function to format datetime
    function formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // Table configurations
    const tableConfigs = {
        // Deliveries table configuration
        deliveries: {
            tbodyId: 'deliveries-tbody',
            emptyMessage: '沒有找到配送單',
            rowAttrs: (item) => ({
                'data-delivery-id': item.id,
                'class': 'hover:bg-gray-50 transition-colors cursor-pointer'
            }),
            columns: [
                {
                    field: 'id',
                    class: 'px-6 py-4 text-sm font-medium',
                    format: (value) => `#${value}`
                },
                {
                    field: 'client.name',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        const code = window.html.escape(item.client?.code || '');
                        const name = window.html.escape(item.client?.name || '-');
                        return `${code} - ${name}`;
                    }
                },
                {
                    field: 'scheduled_date',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        const date = formatDate(item.scheduled_date);
                        const time = item.scheduled_time ? ` ${item.scheduled_time.substr(0, 5)}` : '';
                        return date + time;
                    }
                },
                {
                    field: 'gas_quantity',
                    class: 'px-6 py-4 text-sm text-center',
                    format: (value) => `${value || 0} 桶`
                },
                {
                    field: 'total_amount',
                    class: 'px-6 py-4 text-sm text-right',
                    format: formatCurrency
                },
                {
                    field: 'driver.name',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value || '未指派'
                },
                {
                    field: 'status',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => window.table.statusBadge(item.status, statusConfigs.delivery)
                },
                {
                    field: 'actions',
                    class: 'px-6 py-4 text-sm text-right',
                    render: (item) => {
                        const buttons = [
                            {
                                icon: 'fas fa-eye',
                                title: '查看詳情',
                                class: 'text-blue-600 hover:text-blue-900 mr-2',
                                dataAction: 'viewDelivery',
                                dataAttrs: `data-id="${item.id}"`
                            }
                        ];
                        
                        if (item.status === 'pending') {
                            buttons.push({
                                icon: 'fas fa-user-check',
                                title: '指派司機',
                                class: 'text-green-600 hover:text-green-900',
                                dataAction: 'assignDriver',
                                dataAttrs: `data-delivery-id="${item.id}"`
                            });
                        }
                        
                        return window.table.actionButtons(buttons);
                    }
                }
            ]
        },
        
        // Pending deliveries table (for driver assignment)
        pendingDeliveries: {
            tbodyId: 'pending-deliveries-tbody',
            emptyMessage: '沒有待指派的配送單',
            columns: [
                {
                    field: 'client.name',
                    class: 'px-4 py-2 text-sm',
                    render: (item) => {
                        const code = window.html.escape(item.client?.code || '');
                        const name = window.html.escape(item.client?.name || '-');
                        return `${code} - ${name}`;
                    }
                },
                {
                    field: 'scheduled_date',
                    class: 'px-4 py-2 text-sm',
                    render: (item) => {
                        const date = formatDate(item.scheduled_date);
                        const time = item.scheduled_time ? ` ${item.scheduled_time.substr(0, 5)}` : '';
                        return date + time;
                    }
                },
                {
                    field: 'delivery_address',
                    class: 'px-4 py-2 text-sm',
                    format: (value) => value || '-'
                },
                {
                    field: 'gas_quantity',
                    class: 'px-4 py-2 text-sm text-center',
                    format: (value) => `${value || 0} 桶`
                }
            ]
        },
        
        // Clients table configuration
        clients: {
            tbodyId: 'clients-tbody',
            emptyMessage: '沒有找到客戶資料',
            columns: [
                {
                    field: 'client_code',
                    class: 'px-6 py-4 text-sm font-medium',
                    format: (value) => window.html.escape(value)
                },
                {
                    field: 'name',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        // Use name if available, otherwise use invoice_title or short_name
                        const displayName = item.name || item.invoice_title || item.short_name || '-';
                        return window.html.escape(displayName);
                    }
                },
                {
                    field: 'contact_person',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value || '-'
                },
                {
                    field: 'phone',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value || '-'
                },
                {
                    field: 'address',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => window.html.escape(value)
                },
                {
                    field: 'is_active',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => window.table.statusBadge(
                        item.is_active ? 'active' : 'inactive', 
                        statusConfigs.client
                    )
                },
                {
                    field: 'actions',
                    class: 'px-6 py-4 text-sm text-right',
                    render: (item) => window.table.actionButtons([
                        {
                            icon: 'fas fa-edit',
                            title: '編輯',
                            class: 'text-blue-600 hover:text-blue-900',
                            dataAction: 'editClient',
                            dataAttrs: `data-code="${item.client_code}"`
                        }
                    ])
                }
            ]
        },
        
        // Client details table (deliveries for a specific client)
        clientDeliveries: {
            tbodyId: 'client-deliveries-tbody',
            emptyMessage: '沒有配送記錄',
            columns: [
                {
                    field: 'scheduled_date',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        const date = formatDate(item.scheduled_date);
                        const time = item.scheduled_time ? ` ${item.scheduled_time.substr(0, 5)}` : '';
                        return date + time;
                    }
                },
                {
                    field: 'gas_quantity',
                    class: 'px-6 py-4 text-sm text-center',
                    format: (value) => `${value || 0} 桶`
                },
                {
                    field: 'unit_price',
                    class: 'px-6 py-4 text-sm text-right',
                    format: formatCurrency
                },
                {
                    field: 'total_amount',
                    class: 'px-6 py-4 text-sm text-right',
                    format: formatCurrency
                },
                {
                    field: 'driver.name',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value || '未指派'
                },
                {
                    field: 'status',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => window.table.statusBadge(item.status, statusConfigs.delivery)
                },
                {
                    field: 'created_at',
                    class: 'px-6 py-4 text-sm',
                    format: formatDateTime
                }
            ]
        },
        
        // Drivers table configuration
        drivers: {
            tbodyId: 'drivers-tbody',
            emptyMessage: '沒有找到司機資料',
            columns: [
                {
                    field: 'employee_id',
                    class: 'px-6 py-4 text-sm font-medium',
                    format: (value) => window.html.escape(value)
                },
                {
                    field: 'name',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => window.html.escape(value)
                },
                {
                    field: 'phone',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value || '-'
                },
                {
                    field: 'license_type',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value || '-'
                },
                {
                    field: 'emergency_contact',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        if (item.emergency_contact && item.emergency_phone) {
                            return `${window.html.escape(item.emergency_contact)} (${item.emergency_phone})`;
                        }
                        return '-';
                    }
                },
                {
                    field: 'status',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => window.table.statusBadge(item.status, statusConfigs.driver)
                },
                {
                    field: 'actions',
                    class: 'px-6 py-4 text-sm text-right',
                    render: (item) => window.table.actionButtons([
                        {
                            icon: 'fas fa-edit',
                            title: '編輯',
                            class: 'text-blue-600 hover:text-blue-900',
                            dataAction: 'editDriver',
                            dataAttrs: `data-driver-id="${item.id}"`
                        }
                    ])
                }
            ]
        },
        
        // Vehicles table configuration
        vehicles: {
            tbodyId: 'vehicles-tbody',
            emptyMessage: '沒有找到車輛資料',
            columns: [
                {
                    field: 'license_plate',
                    class: 'px-6 py-4 text-sm font-medium',
                    format: (value) => window.html.escape(value)
                },
                {
                    field: 'vehicle_type',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value || '-'
                },
                {
                    field: 'brand',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        const parts = [];
                        if (item.brand) parts.push(item.brand);
                        if (item.model) parts.push(item.model);
                        if (item.year) parts.push(`(${item.year})`);
                        return parts.join(' ') || '-';
                    }
                },
                {
                    field: 'capacity',
                    class: 'px-6 py-4 text-sm text-center',
                    format: (value) => `${value || 0} 桶`
                },
                {
                    field: 'status',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => window.table.statusBadge(item.status, statusConfigs.vehicle)
                },
                {
                    field: 'last_maintenance',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value ? formatDate(value) : '無記錄'
                },
                {
                    field: 'actions',
                    class: 'px-6 py-4 text-sm text-right',
                    render: (item) => window.table.actionButtons([
                        {
                            icon: 'fas fa-edit',
                            title: '編輯',
                            class: 'text-blue-600 hover:text-blue-900',
                            dataAction: 'editVehicle',
                            dataAttrs: `data-vehicle-id="${item.id}"`
                        }
                    ])
                }
            ]
        },
        
        // Routes table configuration
        routes: {
            tbodyId: 'routes-tbody',
            emptyMessage: '沒有找到路線資料',
            columns: [
                {
                    field: 'name',
                    class: 'px-6 py-4 text-sm font-medium',
                    format: (value) => window.html.escape(value)
                },
                {
                    field: 'description',
                    class: 'px-6 py-4 text-sm',
                    format: (value) => value || '-'
                },
                {
                    field: 'clients',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        const count = item.clients?.length || 0;
                        return `${count} 個客戶`;
                    }
                },
                {
                    field: 'estimated_time',
                    class: 'px-6 py-4 text-sm text-center',
                    format: (value) => value ? `${value} 分鐘` : '-'
                },
                {
                    field: 'is_active',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => window.html.statusBadge(
                        item.is_active,
                        '啟用',
                        '停用',
                        'bg-green-100 text-green-800',
                        'bg-red-100 text-red-800'
                    )
                },
                {
                    field: 'actions',
                    class: 'px-6 py-4 text-sm text-right',
                    render: (item) => window.table.actionButtons([
                        {
                            icon: 'fas fa-eye',
                            title: '查看',
                            class: 'text-gray-600 hover:text-gray-900 mr-2',
                            dataAction: 'viewRoute',
                            dataAttrs: `data-route-id="${item.id}"`
                        },
                        {
                            icon: 'fas fa-edit',
                            title: '編輯',
                            class: 'text-blue-600 hover:text-blue-900 mr-2',
                            dataAction: 'editRoute',
                            dataAttrs: `data-route-id="${item.id}"`
                        },
                        {
                            icon: 'fas fa-trash',
                            title: '刪除',
                            class: 'text-red-600 hover:text-red-900',
                            dataAction: 'deleteRoute',
                            dataAttrs: `data-route-id="${item.id}"`
                        }
                    ])
                }
            ]
        },
        
        // Schedule table configuration
        schedules: {
            tbodyId: 'schedule-tbody',
            emptyMessage: '沒有排程資料',
            columns: [
                {
                    field: 'date',
                    class: 'px-6 py-4 text-sm font-medium',
                    format: formatDate
                },
                {
                    field: 'weekday',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                        const date = new Date(item.date);
                        return `星期${weekdays[date.getDay()]}`;
                    }
                },
                {
                    field: 'deliveries',
                    class: 'px-6 py-4 text-sm text-center',
                    render: (item) => {
                        const count = item.deliveries?.length || 0;
                        return `${count} 筆配送`;
                    }
                },
                {
                    field: 'drivers',
                    class: 'px-6 py-4 text-sm text-center',
                    render: (item) => {
                        const assigned = item.drivers_assigned || 0;
                        const total = item.drivers_total || 0;
                        return `${assigned} / ${total}`;
                    }
                },
                {
                    field: 'status',
                    class: 'px-6 py-4 text-sm',
                    render: (item) => {
                        const allAssigned = item.deliveries?.every(d => d.driver_id) || false;
                        return window.table.statusBadge(
                            allAssigned,
                            '已完成排程',
                            '待排程',
                            'bg-green-100 text-green-800',
                            'bg-yellow-100 text-yellow-800'
                        );
                    }
                },
                {
                    field: 'actions',
                    class: 'px-6 py-4 text-sm text-right',
                    render: (item) => window.table.actionButtons([
                        {
                            icon: 'fas fa-calendar-check',
                            title: '查看詳情',
                            class: 'text-blue-600 hover:text-blue-900 mr-2',
                            dataAction: 'viewScheduleDetails',
                            dataAttrs: `data-date="${item.date}"`
                        },
                        {
                            icon: 'fas fa-magic',
                            title: '套用排程',
                            class: 'text-green-600 hover:text-green-900',
                            dataAction: 'applySchedule',
                            dataAttrs: `data-date="${item.date}"`
                        }
                    ])
                }
            ]
        }
    };
    
    // Export configuration
    window.tableConfigs = tableConfigs;
    
    console.log('✅ Table Config module loaded');
})();