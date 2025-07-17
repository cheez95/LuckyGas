/**
 * Client Handlers Module
 * Contains all client-related functions
 * Functions: loadClients, viewClient, editClient, addClient, etc.
 */

(function() {
    'use strict';
    
    // Import dependencies from global scope
    const { api, html, SecurityUtils, ValidationUtils, SanitizationUtils } = window;
    const { renderClientsTable, renderClientDeliveries, updatePagination } = window.tableRenderers;
    const { showModal, closeModal, createEditModal } = window.uiComponents;
    const { validationRules, showNotification, formatDate } = window;
    
    // Client management functions
    async function loadClients(page = 1) {
        // Build query parameters
        const params = new URLSearchParams({
            page: page,
            page_size: window.APP_CONFIG?.PAGINATION?.DEFAULT_PAGE_SIZE || 10
        });
        
        if (window.clientFilters.keyword) params.append('keyword', window.clientFilters.keyword);
        if (window.clientFilters.district) params.append('district', window.clientFilters.district);
        if (window.clientFilters.isActive !== '') params.append('is_active', window.clientFilters.isActive);
        if (window.clientFilters.sortBy) {
            params.append('order_by', window.clientFilters.sortBy);
            params.append('order_desc', window.clientFilters.sortOrder === 'desc');
        }
        
        const data = await api.get(`/clients?${params}`);
        
        window.allClients = data.items || [];
        window.currentClientPage = page;
        
        // Render table
        renderClientsTable(window.allClients);
        
        // Update pagination
        updatePagination('clients', data.page, data.total_pages, data.total);
    }
    
    async function viewClient(clientCode) {
        const client = await api.get(`/clients/by-code/${clientCode}`, {
            errorMessage: '載入客戶資料失敗'
        }).catch(() => null);
        
        if (!client) return;
            
            // Create modal content with tabs
            const modalContent = `
                <div class="client-detail-modal">
                    <!-- Tabs -->
                    <div class="border-b border-gray-200 mb-4">
                        <nav class="-mb-px flex space-x-8">
                            <button data-action="switchClientTab" data-tab="info" id="client-info-tab" 
                                    class="client-tab-btn active py-2 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600">
                                客戶資訊
                            </button>
                            <button data-action="switchClientTab" data-tab="deliveries" id="client-deliveries-tab" 
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
    }
    
    async function editClient(clientCode) {
        const client = await api.get(`/clients/by-code/${clientCode}`, {
            errorMessage: '載入客戶資料失敗'
        }).catch(() => null);
        
        if (!client) return;
            
            // Create a modal dialog for editing
            const modal = createEditModal('編輯客戶', `
                <form id="edit-client-form">
                    <div class="grid grid-cols-2 gap-4">
                        ${html.formField('客戶編號', 'client_code', 'text', client.client_code || '', { readonly: true, containerClass: 'div' })}
                        ${html.formField('客戶名稱', 'name', 'text', client.name || '', { required: true, containerClass: 'div' })}
                        ${html.formField('發票抬頭', 'invoice_title', 'text', client.invoice_title || '', { containerClass: 'div' })}
                        ${html.formField('聯絡人', 'contact_person', 'text', client.contact_person || '', { containerClass: 'div' })}
                        ${html.formField('地址', 'address', 'text', client.address, { required: true, containerClass: 'col-span-2' })}
                        ${html.formField('區域', 'district', 'text', client.district || '', { containerClass: 'div' })}
                        ${html.formField('狀態', 'is_active', 'select', client.is_active ? 'true' : 'false', {
                            containerClass: 'div',
                            selectOptions: [
                                { value: 'true', text: '啟用' },
                                { value: 'false', text: '停用' }
                            ]
                        })}
                    </div>
                </form>
            `);
            
            modal.querySelector('#confirm-btn').addEventListener('click', async () => {
                const form = modal.querySelector('#edit-client-form');
                
                // Clear previous errors
                ValidationUtils.clearFormErrors(form);
                
                const formData = new FormData(form);
                
                // Get form data
                const rawData = {};
                for (let [key, value] of formData.entries()) {
                    rawData[key] = value;
                }
                
                // Validate form data using global validation rules
                const validationResult = ValidationUtils.validateForm(rawData, validationRules.client);
                
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
                
                const result = await api.put(`/clients/by-code/${clientCode}`, updateData, {
                    successMessage: '客戶資料已更新'
                });
                if (result !== null) {
                    closeModal(modal);
                    loadClients();
                }
            });
    }
    
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
            console.error('Add client modal not found');
            showNotification('客戶模態視窗未找到', 'error');
        }
    }
    
    async function addClient() {
        // Note: The actual adding is handled by the form.setup handler in setupFormHandlers
        // This function is kept for backward compatibility
        const form = document.getElementById('add-client-form');
        if (form) {
            // Trigger form submission
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
        }
    }
    
    async function updateClient(clientCode) {
        // This is an alias for editClient for backward compatibility
        // The actual update happens within editClient
        return editClient(clientCode);
    }
    
    async function deleteClient(clientId) {
        if (!confirm('確定要刪除此客戶嗎？\n\n⚠️ 警告：此操作無法復原！')) return;
        
        await api.delete(`/clients/${clientId}`);
        await loadClients(window.currentClientPage);
    }
    
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
    
    // Load client deliveries
    async function loadClientDeliveries(clientCode, page = 1) {
        const loadingDiv = document.getElementById('client-deliveries-loading');
        const containerDiv = document.getElementById('client-deliveries-container');
        
        // Show loading
        if (loadingDiv) loadingDiv.classList.remove('hidden');
        if (containerDiv) containerDiv.classList.add('hidden');
        
        // Fetch deliveries
        const data = await api.get(`/clients/by-code/${clientCode}/deliveries?page=${page}&page_size=10`, {
            skipNotification: true
        }).catch(() => null);
        
        // Hide loading
        if (loadingDiv) loadingDiv.classList.add('hidden');
        if (containerDiv) containerDiv.classList.remove('hidden');
        
        if (!data) {
            if (containerDiv) {
                containerDiv.innerHTML = `
                    <div class="text-center py-8 text-red-600">
                        <i class="fas fa-exclamation-circle text-3xl mb-2"></i>
                        <p>載入配送紀錄失敗</p>
                    </div>
                `;
            }
            return;
        }
        
        // Render deliveries if successful
        renderClientDeliveries(data, clientCode);
    }
    
    // Helper function for toggling client status
    async function toggleClientStatus(clientCode, currentStatus) {
        if (!confirm(`確定要${currentStatus ? '停用' : '啟用'}此客戶嗎？`)) return;
        
        await api.put(`/clients/by-code/${clientCode}`, { is_active: !currentStatus });
        await loadClients(window.currentClientPage);
    }
    
    // Export client handlers
    window.clientHandlers = {
        loadClients,
        viewClient,
        editClient,
        showAddClientModal,
        addClient,
        updateClient,
        deleteClient,
        switchClientTab,
        loadClientDeliveries,
        toggleClientStatus
    };
    
    // Also export individually for backward compatibility
    window.loadClients = loadClients;
    window.viewClient = viewClient;
    window.editClient = editClient;
    window.showAddClientModal = showAddClientModal;
    window.addClient = addClient;
    window.updateClient = updateClient;
    window.deleteClient = deleteClient;
    window.switchClientTab = switchClientTab;
    window.loadClientDeliveries = loadClientDeliveries;
    window.toggleClientStatus = toggleClientStatus;
    
    console.log('✅ Client Handlers module loaded');
})();