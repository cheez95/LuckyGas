/**
 * Core Utilities Module
 * Contains: api, table, html, form utilities, validation, and event delegation
 * Extracted from app.js lines 168-698
 */

(function() {
    'use strict';
    
    // API Base URL
    const API_BASE = window.APP_CONFIG?.API?.BASE_URL || 'http://localhost:8000/api';
    
    // API UTILITY - Consolidates 70+ fetch patterns
    const api = {
        async request(endpoint, options = {}) {
            const {
                method = 'GET',
                body = null,
                headers = {},
                skipNotification = false,
                successMessage = null,
                errorMessage = null,
                skipAuth = false
            } = options;

            try {
                const config = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    }
                };

                if (body && method !== 'GET') {
                    config.body = JSON.stringify(body);
                }

                // Use secureFetch for non-GET requests
                const fetchFn = skipAuth || method === 'GET' ? fetch : window.secureFetch;
                const response = await fetchFn(`${API_BASE}${endpoint}`, config);
                
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
                }

                // Handle empty responses
                const contentLength = response.headers.get('content-length');
                if (contentLength === '0' || response.status === 204) {
                    if (successMessage && !skipNotification) {
                        window.showNotification(successMessage, 'success');
                    }
                    return null;
                }

                // Handle different response types
                const contentType = response.headers.get('content-type');
                let data;
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else if (contentType && contentType.includes('text/')) {
                    data = await response.text();
                } else {
                    data = await response.blob();
                }
                
                if (successMessage && !skipNotification) {
                    window.showNotification(successMessage, 'success');
                }
                
                return data;
            } catch (error) {
                console.error(`API Error (${endpoint}):`, error);
                if (!skipNotification) {
                    window.showNotification(errorMessage || error.message || '操作失敗', 'error');
                }
                throw error;
            }
        },

        get(endpoint, options = {}) {
            return this.request(endpoint, { ...options, method: 'GET' });
        },

        post(endpoint, body, options = {}) {
            return this.request(endpoint, { ...options, method: 'POST', body });
        },

        put(endpoint, body, options = {}) {
            return this.request(endpoint, { ...options, method: 'PUT', body });
        },

        delete(endpoint, options = {}) {
            return this.request(endpoint, { ...options, method: 'DELETE' });
        }
    };

    // TABLE UTILITY - Consolidates table rendering
    const table = {
        render(tbodyId, data, columns, emptyMessage = '沒有找到資料') {
            const tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            
            // Clear existing content safely
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }
            
            // Handle empty state
            if (!data || data.length === 0) {
                const row = tbody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = columns.length;
                cell.className = 'px-6 py-4 text-center text-gray-500';
                cell.textContent = emptyMessage;
                return;
            }
            
            // Render rows
            data.forEach(item => {
                const row = tbody.insertRow();
                row.className = 'hover:bg-gray-50 transition-colors';
                
                columns.forEach(col => {
                    const cell = row.insertCell();
                    cell.className = col.class || 'px-6 py-4 text-sm';
                    
                    if (col.render) {
                        const content = col.render(item);
                        if (typeof content === 'string') {
                            cell.innerHTML = content;
                        } else if (content instanceof HTMLElement) {
                            cell.appendChild(content);
                        }
                    } else if (col.field) {
                        const value = this.getValue(item, col.field);
                        if (col.format) {
                            cell.textContent = col.format(value);
                        } else {
                            cell.textContent = value;
                        }
                    }
                });
            });
        },
        
        getValue(obj, path) {
            return path.split('.').reduce((acc, part) => acc?.[part], obj) || '-';
        },
        
        statusBadge(status, config) {
            const info = config[status] || { text: status, class: 'bg-gray-100 text-gray-800' };
            return `<span class="px-2 py-1 text-xs rounded-full ${info.class}">${window.SecurityUtils.escapeHtml(info.text)}</span>`;
        },
        
        actionButtons(buttons) {
            return buttons.map(btn => 
                `<button class="${btn.class}" title="${btn.title}" ${btn.dataAction ? `data-action="${btn.dataAction}"` : ''} ${btn.dataAttrs || ''}>
                    <i class="${btn.icon}"></i>
                </button>`
            ).join('');
        }
    };

    // HTML TEMPLATE UTILITY - Safe HTML generation
    const html = {
        escape(text) {
            return window.SecurityUtils.escapeHtml(text);
        },
        
        button(text, className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700', dataAction = '', dataAttrs = '') {
            return `<button class="${className}" ${dataAction ? `data-action="${dataAction}"` : ''} ${dataAttrs}>${this.escape(text)}</button>`;
        },
        
        iconButton(icon, title, className = 'text-blue-600 hover:text-blue-900', dataAction = '', dataAttrs = '') {
            return `<button class="${className}" title="${this.escape(title)}" ${dataAction ? `data-action="${dataAction}"` : ''} ${dataAttrs}>
                <i class="${icon}"></i>
            </button>`;
        },
        
        modal(title, content, modalId = null) {
            const id = modalId || `modal-${Date.now()}`;
            return `
                <div id="${id}" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
                        <div class="px-6 py-4 border-b flex justify-between items-center">
                            <h3 class="text-lg font-semibold">${this.escape(title)}</h3>
                            <button data-action="closeModal" data-modal-id="${id}" class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="p-6">${content}</div>
                    </div>
                </div>
            `;
        },
        
        formGroup(label, inputHtml, error = '', required = false) {
            return `
                <div class="mb-4">
                    <label class="block text-sm font-medium mb-1">
                        ${this.escape(label)}${required ? ' <span class="text-red-500">*</span>' : ''}
                    </label>
                    ${inputHtml}
                    ${error ? `<p class="text-red-500 text-xs mt-1">${this.escape(error)}</p>` : ''}
                </div>
            `;
        },
        
        select(name, options, selectedValue = '', className = 'w-full border rounded px-3 py-2') {
            const optionsHtml = options.map(opt => {
                const value = opt.value !== undefined ? opt.value : opt;
                const text = opt.text !== undefined ? opt.text : opt;
                const selected = value === selectedValue ? 'selected' : '';
                return `<option value="${this.escape(value)}" ${selected}>${this.escape(text)}</option>`;
            }).join('');
            
            return `<select name="${name}" class="${className}">${optionsHtml}</select>`;
        },
        
        input(type, name, value = '', placeholder = '', className = 'w-full border rounded px-3 py-2', extraAttrs = '') {
            return `<input type="${type}" name="${name}" value="${this.escape(value)}" 
                    placeholder="${this.escape(placeholder)}" class="${className}" ${extraAttrs}>`;
        },
        
        formField(label, name, type = 'text', value = '', options = {}) {
            const {
                required = false,
                placeholder = '',
                readonly = false,
                className = 'w-full px-3 py-2 border rounded-md',
                labelClass = 'block text-sm font-medium text-gray-700 mb-1',
                containerClass = '',
                selectOptions = [],
                error = ''
            } = options;
            
            let inputHtml = '';
            if (type === 'select') {
                inputHtml = this.select(name, selectOptions, value, className + (readonly ? ' bg-gray-100' : ''));
            } else {
                const attrs = `${required ? 'required' : ''} ${readonly ? 'readonly' : ''}`;
                inputHtml = this.input(type, name, value, placeholder, className + (readonly ? ' bg-gray-100' : ''), attrs);
            }
            
            return `
                <div class="${containerClass}">
                    <label class="${labelClass}">${this.escape(label)}</label>
                    ${inputHtml}
                    ${error ? `<p class="text-red-500 text-xs mt-1">${this.escape(error)}</p>` : ''}
                </div>
            `;
        },
        
        statusBadge(isActive, activeText = '啟用', inactiveText = '停用', activeClass = 'bg-green-100 text-green-800', inactiveClass = 'bg-red-100 text-red-800') {
            return `<span class="px-2 py-1 text-xs rounded-full ${isActive ? activeClass : inactiveClass}">${isActive ? activeText : inactiveText}</span>`;
        },
        
        modalFooter(modalId, actions = null, cancelText = '取消', confirmText = '確認', showBorder = true) {
            const borderClass = showBorder ? 'pt-4 border-t' : '';
            return `
                <div class="${borderClass} flex justify-end ${showBorder ? 'space-x-2' : 'gap-2'}">
                    ${actions || `
                        <button data-action="closeModal" data-modal-id="${modalId}" class="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                            ${this.escape(cancelText)}
                        </button>
                        <button id="confirm-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            ${this.escape(confirmText)}
                        </button>
                    `}
                </div>
            `;
        },
        
        gridContainer(content, cols = 2, gap = 4, className = '') {
            return `<div class="grid grid-cols-${cols} gap-${gap} ${className}">${content}</div>`;
        },
        
        downloadBlob(blob, filename) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    };
    
    // Taiwan ID validation function
    function validateTaiwanId(id) {
        if (!id || typeof id !== 'string') {
            return { isValid: false, message: '身分證字號不能為空' };
        }
        
        // Check format: 1 letter + 9 digits
        if (!/^[A-Z][0-9]{9}$/.test(id)) {
            return { isValid: false, message: '身分證字號格式錯誤 (應為1個大寫字母+9個數字)' };
        }
        
        // Taiwan ID checksum validation
        const letterMapping = {
            'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17,
            'I': 34, 'J': 18, 'K': 19, 'L': 20, 'M': 21, 'N': 22, 'O': 35, 'P': 23,
            'Q': 24, 'R': 25, 'S': 26, 'T': 27, 'U': 28, 'V': 29, 'W': 32, 'X': 30,
            'Y': 31, 'Z': 33
        };
        
        const letter = id[0];
        const letterNum = letterMapping[letter];
        
        // Calculate checksum
        let sum = Math.floor(letterNum / 10) + (letterNum % 10) * 9;
        
        for (let i = 1; i < 9; i++) {
            sum += parseInt(id[i]) * (9 - i);
        }
        
        sum += parseInt(id[9]);
        
        if (sum % 10 !== 0) {
            return { isValid: false, message: '身分證字號檢查碼錯誤' };
        }
        
        return { isValid: true, message: '' };
    }
    
    // Global validation rules for all forms
    const validationRules = {
        // Client validation rules
        client: {
            name: { required: true, type: 'name', options: { minLength: 2, maxLength: 100 } },
            invoice_title: { required: false, type: 'name', options: { minLength: 2, maxLength: 100 } },
            tax_id: { 
                required: false, 
                type: 'custom', 
                validator: (value) => {
                    if (!value) return { isValid: true, message: '' };
                    if (!/^\d{8}$/.test(value)) {
                        return { isValid: false, message: '統一編號必須是8位數字' };
                    }
                    return { isValid: true, message: '' };
                }
            },
            contact_person: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } },
            phone: { required: false, type: 'phone' },
            email: { required: false, type: 'email' },
            address: { required: true, type: 'address' },
            district: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } }
        },
        
        // Driver validation rules
        driver: {
            name: { required: true, type: 'name', options: { minLength: 2, maxLength: 50 } },
            employee_id: { required: true, type: 'clientCode' }, // Reusing clientCode validation for employee ID
            phone: { required: true, type: 'phone' },
            id_number: { 
                required: true, 
                type: 'custom',
                validator: validateTaiwanId
            },
            address: { required: true, type: 'address' },
            emergency_contact: { required: true, type: 'name', options: { minLength: 2, maxLength: 50 } },
            emergency_phone: { required: true, type: 'phone' },
            license_number: { required: true, type: 'name', options: { minLength: 5, maxLength: 20 } },
            license_type: { required: true, type: 'name' }
        },
        
        // Vehicle validation rules
        vehicle: {
            license_plate: { required: true, type: 'licensePlate' },
            vehicle_type: { required: true, type: 'name' },
            brand: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } },
            model: { required: false, type: 'name', options: { minLength: 2, maxLength: 50 } },
            year: { 
                required: false, 
                type: 'custom',
                validator: (value) => {
                    if (!value) return { isValid: true, message: '' };
                    const year = parseInt(value);
                    const currentYear = new Date().getFullYear();
                    if (isNaN(year) || year < 1900 || year > currentYear + 1) {
                        return { isValid: false, message: '請輸入有效的年份' };
                    }
                    return { isValid: true, message: '' };
                }
            },
            capacity: { required: true, type: 'quantity', options: { min: 1, max: 1000 } }
        },
        
        // Delivery validation rules
        delivery: {
            client_id: { required: true, type: 'quantity' },
            scheduled_date: { required: true, type: 'date', options: { allowPast: false } },
            scheduled_time: { required: false, type: 'time' },
            quantity: { required: true, type: 'quantity', options: { min: 1, max: 999 } },
            unit_price: { required: true, type: 'amount', options: { min: 0, max: 99999 } },
            delivery_address: { required: false, type: 'address' },
            notes: { required: false, type: 'name', options: { maxLength: 500 } }
        },
        
        // Route validation rules
        route: {
            route_name: { required: true, type: 'name', options: { minLength: 2, maxLength: 100 } },
            driver_id: { required: true, type: 'quantity' },
            vehicle_id: { required: true, type: 'quantity' },
            client_ids: { 
                required: true, 
                type: 'custom',
                validator: (value) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) {
                        return { isValid: false, message: '請至少選擇一個客戶' };
                    }
                    return { isValid: true, message: '' };
                }
            }
        },
        
        // Schedule validation rules
        schedule: {
            schedule_type: { required: true, type: 'name' },
            schedule_date: { 
                required: false, // Conditional based on schedule_type
                type: 'date',
                options: { allowPast: false }
            },
            start_date: {
                required: false, // Conditional based on schedule_type
                type: 'date',
                options: { allowPast: false }
            },
            end_date: {
                required: false, // Conditional based on schedule_type
                type: 'date',
                options: { allowPast: false }
            },
            objectives: {
                required: true,
                type: 'custom',
                validator: (value) => {
                    if (!value || (Array.isArray(value) && value.length === 0)) {
                        return { isValid: false, message: '請至少選擇一個排程目標' };
                    }
                    return { isValid: true, message: '' };
                }
            }
        }
    };
    
    // Event Delegation System
    const eventDelegation = {
        init() {
            document.addEventListener('click', this.handleClick.bind(this));
        },
        
        handleClick(e) {
            // Handle buttons with data-action
            const actionButton = e.target.closest('[data-action]');
            if (actionButton) {
                e.preventDefault();
                const action = actionButton.dataset.action;
                const data = actionButton.dataset;
                
                // Route to appropriate handler
                switch (action) {
                    // Modal operations
                    case 'closeModal':
                        if (window.closeModal) {
                            const modal = actionButton.closest('.fixed[id]');
                            if (modal) window.closeModal(modal.id);
                            else if (data.modalId) window.closeModal(data.modalId);
                        }
                        break;
                        
                    // Client operations
                    case 'editClient':
                        if (window.editClient && data.code) window.editClient(data.code);
                        break;
                    case 'switchClientTab':
                        if (window.switchClientTab && data.tab) window.switchClientTab(data.tab);
                        break;
                    case 'addClientToRoute':
                        if (window.addClientToRoute) {
                            window.addClientToRoute(
                                parseInt(data.clientId),
                                data.clientCode,
                                data.clientName,
                                data.clientAddress
                            );
                        }
                        break;
                    case 'removeClientFromRoute':
                        if (window.removeClientFromRoute && data.index) {
                            window.removeClientFromRoute(parseInt(data.index));
                        }
                        break;
                        
                    // Delivery operations
                    case 'viewDelivery':
                        if (window.viewDelivery && data.id) window.viewDelivery(parseInt(data.id));
                        break;
                    case 'assignDriver':
                        if (window.assignDriver && data.deliveryId) {
                            window.assignDriver(parseInt(data.deliveryId));
                        }
                        break;
                    case 'updateDeliveryStatus':
                        if (window.updateDeliveryStatus && data.deliveryId && data.status) {
                            window.updateDeliveryStatus(parseInt(data.deliveryId), data.status);
                        }
                        break;
                        
                    // Route operations
                    case 'viewRoute':
                        if (window.viewRoute && data.routeId) window.viewRoute(parseInt(data.routeId));
                        break;
                    case 'editRoute':
                        if (window.editRoute && data.routeId) window.editRoute(parseInt(data.routeId));
                        break;
                    case 'deleteRoute':
                        if (window.deleteRoute && data.routeId) window.deleteRoute(parseInt(data.routeId));
                        break;
                        
                    // Driver/Vehicle operations
                    case 'editDriver':
                        if (window.editDriver && data.driverId) window.editDriver(parseInt(data.driverId));
                        break;
                    case 'editVehicle':
                        if (window.editVehicle && data.vehicleId) window.editVehicle(parseInt(data.vehicleId));
                        break;
                        
                    // Schedule operations
                    case 'viewScheduleDetails':
                        if (window.viewScheduleDetails && data.date) window.viewScheduleDetails(data.date);
                        break;
                    case 'applySchedule':
                        if (window.applySchedule && data.date) window.applySchedule(data.date);
                        break;
                        
                    // Pagination operations
                    case 'loadDeliveries':
                        if (window.loadDeliveries && data.page) window.loadDeliveries(parseInt(data.page));
                        break;
                    case 'loadClients':
                        if (window.loadClients && data.page) window.loadClients(parseInt(data.page));
                        break;
                    case 'loadClientDeliveries':
                        if (window.loadClientDeliveries && data.clientCode && data.page) {
                            window.loadClientDeliveries(data.clientCode, parseInt(data.page));
                        }
                        break;
                    case 'loadRoutes':
                        if (window.loadRoutes && data.page) window.loadRoutes(parseInt(data.page));
                        break;
                    case 'loadDrivers':
                        if (window.loadDrivers && data.page) window.loadDrivers(parseInt(data.page));
                        break;
                    case 'loadVehicles':
                        if (window.loadVehicles && data.page) window.loadVehicles(parseInt(data.page));
                        break;
                }
            }
            
            // Handle table row clicks
            const deliveryRow = e.target.closest('tr[data-delivery-id]');
            if (deliveryRow && !e.target.closest('button')) {
                e.preventDefault();
                const deliveryId = parseInt(deliveryRow.dataset.deliveryId);
                if (window.viewDelivery) window.viewDelivery(deliveryId);
            }
            
            // Handle client selection for routes
            const clientRow = e.target.closest('div[data-client-select]');
            if (clientRow && !e.target.closest('button')) {
                e.preventDefault();
                const data = clientRow.dataset;
                if (window.addClientToRoute) {
                    window.addClientToRoute(
                        parseInt(data.clientId),
                        data.clientCode,
                        data.clientName,
                        data.clientAddress
                    );
                }
            }
        }
    };
    
    // Export to global scope
    window.api = api;
    window.table = table;
    window.html = html;
    window.validateTaiwanId = validateTaiwanId;
    window.validationRules = validationRules;
    window.eventDelegation = eventDelegation;
    
    // Also export API_BASE for backward compatibility
    window.API_BASE = API_BASE;
    
    console.log('✅ Utilities module loaded');
})();