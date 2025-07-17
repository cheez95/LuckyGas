/**
 * Client Manager Component
 * Reactive client management interface with full CRUD operations
 * @module components/features/ClientManager
 */

import { ReactiveComponent } from '../ReactiveComponent.js';
import { Modal } from '../Modal.js';
import { Table } from '../Table.js';
import { api } from '../../api/endpoints.js';
import store from '../../../state/store.js';
import { dom, format, security } from '../../utils/index.js';

/**
 * ClientManager - Comprehensive client management component
 */
export class ClientManager extends ReactiveComponent {
    constructor(options = {}) {
        super({
            ...options,
            name: 'ClientManager',
            
            // Reactive data
            data: {
                searchTerm: '',
                statusFilter: 'all',
                cityFilter: 'all',
                selectedClients: new Set(),
                isLoading: false,
                editingClient: null,
                showAddModal: false,
                showEditModal: false,
                debounceTimer: null
            },
            
            // Computed properties from global state
            computedState: {
                clients: 'clients.all',
                filters: 'clients.filters',
                currentPage: 'navigation.currentClientPage',
                
                // Complex computed properties
                filteredClients: {
                    dependencies: ['clients.all', 'clients.filters'],
                    compute: (clients, filters) => {
                        if (!clients) return [];
                        
                        return clients.filter(client => {
                            // Search filter
                            if (filters.search) {
                                const searchLower = filters.search.toLowerCase();
                                const matchesSearch = 
                                    client.name?.toLowerCase().includes(searchLower) ||
                                    client.code?.toLowerCase().includes(searchLower) ||
                                    client.contact_phone?.includes(filters.search) ||
                                    client.address?.toLowerCase().includes(searchLower);
                                if (!matchesSearch) return false;
                            }
                            
                            // Status filter
                            if (filters.status !== 'all') {
                                const isActive = filters.status === 'active';
                                if (client.is_active !== isActive) return false;
                            }
                            
                            // City filter
                            if (filters.city !== 'all' && client.city !== filters.city) {
                                return false;
                            }
                            
                            return true;
                        });
                    }
                },
                
                uniqueCities: {
                    dependencies: ['clients.all'],
                    compute: (clients) => {
                        if (!clients) return [];
                        const cities = new Set(clients.map(c => c.city).filter(Boolean));
                        return Array.from(cities).sort();
                    }
                }
            },
            
            // Watchers
            watch: {
                'data.searchTerm': function(newVal) {
                    this.debouncedSearch(newVal);
                },
                'data.statusFilter': function(newVal) {
                    store.updateClientFilters({ status: newVal });
                },
                'data.cityFilter': function(newVal) {
                    store.updateClientFilters({ city: newVal });
                }
            },
            
            // Template filters
            filters: {
                formatPhone: (phone) => format.formatPhone(phone),
                formatStatus: (isActive) => isActive ? 
                    '<span class="text-green-600">Active</span>' : 
                    '<span class="text-red-600">Inactive</span>'
            },
            
            // Subscribe to state changes
            subscribeTo: ['clients.all', 'clients.filters', 'navigation.currentClientPage']
        });
        
        // Component instances
        this.clientTable = null;
        this.addModal = null;
        this.editModal = null;
        
        // Bind methods
        this.loadClients = this.loadClients.bind(this);
        this.handleAddClient = this.handleAddClient.bind(this);
        this.handleEditClient = this.handleEditClient.bind(this);
        this.handleToggleStatus = this.handleToggleStatus.bind(this);
        this.debouncedSearch = this.createDebounce(this.performSearch.bind(this), 300);
    }
    
    /**
     * Component mounted lifecycle
     */
    async mounted() {
        super.mounted();
        
        // Initialize filters from state
        const filters = store.get('clients.filters');
        this.data.searchTerm = filters.search || '';
        this.data.statusFilter = filters.status || 'all';
        this.data.cityFilter = filters.city || 'all';
        
        // Load initial data
        await this.loadClients();
        
        // Setup table
        this.setupTable();
        
        // Setup modals
        this.setupModals();
    }
    
    /**
     * Load clients from API
     */
    async loadClients() {
        try {
            this.data.isLoading = true;
            
            const response = await api.clients.list({
                page: this.computedState.currentPage,
                page_size: 20,
                search: this.computedState.filters.search,
                is_active: this.computedState.filters.status === 'all' ? undefined : 
                    this.computedState.filters.status === 'active',
                order_by: this.computedState.filters.sortBy || 'name',
                order_desc: this.computedState.filters.sortOrder === 'desc'
            });
            
            // Update store
            store.set('clients.all', response.items || []);
            
        } catch (error) {
            console.error('Failed to load clients:', error);
            this.showError('Failed to load clients');
        } finally {
            this.data.isLoading = false;
        }
    }
    
    /**
     * Setup client table
     */
    setupTable() {
        const tableContainer = this.element.querySelector('#clientTableContainer');
        if (!tableContainer) return;
        
        this.clientTable = new Table({
            container: tableContainer,
            columns: [
                {
                    field: 'selection',
                    label: '',
                    className: 'w-10'
                },
                {
                    field: 'code',
                    label: 'Code',
                    sortable: true,
                    className: 'font-medium'
                },
                {
                    field: 'name',
                    label: 'Name',
                    sortable: true
                },
                {
                    field: 'address',
                    label: 'Address',
                    sortable: true
                },
                {
                    field: 'city',
                    label: 'City',
                    sortable: true
                },
                {
                    field: 'contact_phone',
                    label: 'Phone',
                    render: (value) => format.formatPhone(value)
                },
                {
                    field: 'delivery_fee',
                    label: 'Delivery Fee',
                    sortable: true,
                    render: (value) => `$${format.formatNumber(value)}`
                },
                {
                    field: 'is_active',
                    label: 'Status',
                    sortable: true,
                    render: (value) => value ? 
                        '<span class="text-green-600">Active</span>' : 
                        '<span class="text-red-600">Inactive</span>'
                },
                {
                    field: 'actions',
                    label: 'Actions',
                    render: (_, client) => `
                        <div class="flex space-x-2">
                            <button class="text-blue-600 hover:text-blue-800" 
                                data-action="edit" title="Edit">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                            <button class="text-gray-600 hover:text-gray-800" 
                                data-action="toggle-status" title="Toggle Status">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                            </button>
                        </div>
                    `
                }
            ],
            data: this.computedState.filteredClients,
            selectable: true,
            sortable: true,
            hover: true,
            striped: true,
            emptyMessage: 'No clients found',
            loading: this.data.isLoading,
            
            // Callbacks
            onSort: (field, direction) => {
                store.updateClientFilters({ 
                    sortBy: field, 
                    sortOrder: direction 
                });
                this.loadClients();
            },
            onSelect: (selectedRows) => {
                this.data.selectedClients = new Set(selectedRows.map(r => r.code));
            },
            onAction: (action, client) => {
                if (action === 'edit') {
                    this.showEditModal(client);
                } else if (action === 'toggle-status') {
                    this.handleToggleStatus(client);
                }
            },
            onRowClick: (client) => {
                this.showClientDetails(client);
            }
        });
    }
    
    /**
     * Setup modals
     */
    setupModals() {
        // Add client modal
        this.addModal = new Modal({
            title: 'Add New Client',
            width: 'max-w-2xl',
            onSubmit: this.handleAddClient
        });
        
        // Edit client modal
        this.editModal = new Modal({
            title: 'Edit Client',
            width: 'max-w-2xl',
            onSubmit: this.handleEditClient
        });
    }
    
    /**
     * Show add client modal
     */
    showAddModal() {
        this.data.showAddModal = true;
        this.addModal.show({
            content: this.renderClientForm()
        });
    }
    
    /**
     * Show edit client modal
     */
    showEditModal(client) {
        this.data.editingClient = client;
        this.data.showEditModal = true;
        this.editModal.show({
            title: `Edit Client - ${client.name}`,
            content: this.renderClientForm(client)
        });
    }
    
    /**
     * Render client form
     */
    renderClientForm(client = null) {
        const isEdit = !!client;
        
        return `
            <form id="clientForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Client Code <span class="text-red-500">*</span>
                        </label>
                        <input type="text" name="code" 
                            value="${client?.code || ''}" 
                            ${isEdit ? 'readonly' : ''}
                            class="w-full px-3 py-2 border rounded-lg ${isEdit ? 'bg-gray-100' : ''}"
                            required maxlength="20" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Name <span class="text-red-500">*</span>
                        </label>
                        <input type="text" name="name" 
                            value="${client?.name || ''}" 
                            class="w-full px-3 py-2 border rounded-lg"
                            required maxlength="100" />
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Address
                    </label>
                    <input type="text" name="address" 
                        value="${client?.address || ''}" 
                        class="w-full px-3 py-2 border rounded-lg"
                        maxlength="200" />
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            City
                        </label>
                        <input type="text" name="city" 
                            value="${client?.city || ''}" 
                            class="w-full px-3 py-2 border rounded-lg"
                            maxlength="50" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                        </label>
                        <input type="tel" name="contact_phone" 
                            value="${client?.contact_phone || ''}" 
                            class="w-full px-3 py-2 border rounded-lg"
                            placeholder="(XXX) XXX-XXXX" />
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Delivery Fee
                        </label>
                        <input type="number" name="delivery_fee" 
                            value="${client?.delivery_fee || '0'}" 
                            class="w-full px-3 py-2 border rounded-lg"
                            min="0" step="0.01" />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Status
                        </label>
                        <select name="is_active" class="w-full px-3 py-2 border rounded-lg">
                            <option value="true" ${client?.is_active !== false ? 'selected' : ''}>
                                Active
                            </option>
                            <option value="false" ${client?.is_active === false ? 'selected' : ''}>
                                Inactive
                            </option>
                        </select>
                    </div>
                </div>
                
                <div class="flex justify-end space-x-3 pt-4">
                    <button type="button" 
                        onclick="this.closest('.modal-container').querySelector('.modal-close').click()"
                        class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                        Cancel
                    </button>
                    <button type="submit" 
                        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        ${isEdit ? 'Update' : 'Add'} Client
                    </button>
                </div>
            </form>
        `;
    }
    
    /**
     * Handle add client form submission
     */
    async handleAddClient(formData) {
        try {
            this.addModal.showLoading('Adding client...');
            
            // Convert form data
            const clientData = {
                ...formData,
                is_active: formData.is_active === 'true',
                delivery_fee: parseFloat(formData.delivery_fee) || 0
            };
            
            await api.clients.create(clientData);
            
            this.addModal.close();
            this.showSuccess('Client added successfully');
            await this.loadClients();
            
        } catch (error) {
            console.error('Failed to add client:', error);
            this.addModal.showError(error.message || 'Failed to add client');
        }
    }
    
    /**
     * Handle edit client form submission
     */
    async handleEditClient(formData) {
        try {
            this.editModal.showLoading('Updating client...');
            
            const clientCode = this.data.editingClient.code;
            
            // Convert form data
            const updateData = {
                ...formData,
                is_active: formData.is_active === 'true',
                delivery_fee: parseFloat(formData.delivery_fee) || 0
            };
            
            // Remove readonly fields
            delete updateData.code;
            
            await api.clients.updateByCode(clientCode, updateData);
            
            this.editModal.close();
            this.showSuccess('Client updated successfully');
            await this.loadClients();
            
        } catch (error) {
            console.error('Failed to update client:', error);
            this.editModal.showError(error.message || 'Failed to update client');
        }
    }
    
    /**
     * Handle toggle client status
     */
    async handleToggleStatus(client) {
        const newStatus = !client.is_active;
        const action = newStatus ? 'activate' : 'deactivate';
        
        const confirmed = await Modal.confirm({
            title: 'Confirm Status Change',
            message: `Are you sure you want to ${action} client "${client.name}"?`,
            confirmText: 'Yes, ' + action,
            cancelText: 'Cancel'
        });
        
        if (!confirmed) return;
        
        try {
            await api.clients.toggleStatus(client.code, newStatus);
            this.showSuccess(`Client ${action}d successfully`);
            await this.loadClients();
        } catch (error) {
            console.error('Failed to toggle client status:', error);
            this.showError('Failed to update client status');
        }
    }
    
    /**
     * Show client details
     */
    showClientDetails(client) {
        store.set('clients.currentViewingCode', client.code);
        // Could navigate to a details view or show a modal
    }
    
    /**
     * Perform search with debouncing
     */
    performSearch(searchTerm) {
        store.updateClientFilters({ search: searchTerm });
        this.loadClients();
    }
    
    /**
     * Create debounced function
     */
    createDebounce(func, delay) {
        return (value) => {
            if (this.data.debounceTimer) {
                clearTimeout(this.data.debounceTimer);
            }
            this.data.debounceTimer = setTimeout(() => {
                func(value);
            }, delay);
        };
    }
    
    /**
     * Show success message
     */
    showSuccess(message) {
        // Could use a toast notification system
        // Success: message
    }
    
    /**
     * Show error message
     */
    showError(message) {
        // Could use a toast notification system
        console.error('Error:', message);
    }
    
    /**
     * Handle state updates
     */
    stateChanged(path, newValue, oldValue) {
        super.stateChanged(path, newValue, oldValue);
        
        // Update table when clients change
        if (path === 'clients.all' || path === 'clients.filters') {
            if (this.clientTable) {
                this.clientTable.setData(this.computedState.filteredClients);
            }
        }
    }
    
    /**
     * Component template
     */
    template() {
        return `
            <div class="client-manager">
                <!-- Header -->
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">Client Management</h2>
                    <button onclick="this.getRootComponent().showAddModal()" 
                        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Add New Client
                    </button>
                </div>
                
                <!-- Filters -->
                <div class="bg-white p-4 rounded-lg shadow mb-6">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <!-- Search -->
                        <div class="md:col-span-2">
                            <input type="text" 
                                v-model="data.searchTerm"
                                placeholder="Search by name, code, phone, or address..."
                                class="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        
                        <!-- Status Filter -->
                        <div>
                            <select v-model="data.statusFilter" 
                                class="w-full px-3 py-2 border rounded-lg">
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        
                        <!-- City Filter -->
                        <div>
                            <select v-model="data.cityFilter" 
                                class="w-full px-3 py-2 border rounded-lg">
                                <option value="all">All Cities</option>
                                {{ computedState.uniqueCities.map(city => 
                                    '<option value="' + city + '">' + city + '</option>'
                                ).join('') }}
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- Client Stats -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-white p-4 rounded-lg shadow">
                        <div class="text-sm text-gray-600">Total Clients</div>
                        <div class="text-2xl font-bold">{{ computedState.clients.length }}</div>
                    </div>
                    <div class="bg-white p-4 rounded-lg shadow">
                        <div class="text-sm text-gray-600">Active Clients</div>
                        <div class="text-2xl font-bold text-green-600">
                            {{ computedState.clients.filter(c => c.is_active).length }}
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded-lg shadow">
                        <div class="text-sm text-gray-600">Inactive Clients</div>
                        <div class="text-2xl font-bold text-red-600">
                            {{ computedState.clients.filter(c => !c.is_active).length }}
                        </div>
                    </div>
                    <div class="bg-white p-4 rounded-lg shadow">
                        <div class="text-sm text-gray-600">Cities Served</div>
                        <div class="text-2xl font-bold">{{ computedState.uniqueCities.length }}</div>
                    </div>
                </div>
                
                <!-- Client Table -->
                <div class="bg-white rounded-lg shadow">
                    <div id="clientTableContainer"></div>
                </div>
                
                <!-- Pagination -->
                <div class="flex justify-between items-center mt-4">
                    <div class="text-sm text-gray-600">
                        Showing {{ computedState.filteredClients.length }} clients
                    </div>
                    <div class="flex space-x-2">
                        <!-- Pagination controls would go here -->
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Clean up on destroy
     */
    async destroy() {
        if (this.clientTable) {
            this.clientTable.destroy();
        }
        if (this.addModal) {
            this.addModal.destroy();
        }
        if (this.editModal) {
            this.editModal.destroy();
        }
        
        await super.destroy();
    }
}

// Export for use
export default ClientManager;