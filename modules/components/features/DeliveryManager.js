/**
 * DeliveryManager Component
 * Manages delivery operations with tabbed interface
 * @module components/features/DeliveryManager
 */

import { ReactiveComponent } from '../core/ReactiveComponent.js';
import { state } from '../../state/StateManager.js';
import { api } from '../../api/ApiClient.js';
import { icons } from '../../utils/icons.js';
import { exportToExcel } from '../../utils/excelExport.js';
import { formatDate, formatTime, formatCurrency } from '../../utils/formatters.js';
import { showToast } from '../../utils/toast.js';

/**
 * DeliveryManager Component
 * @extends ReactiveComponent
 */
export class DeliveryManager extends ReactiveComponent {
    constructor() {
        super();
        this.tabs = ['planned', 'history'];
        this.currentTab = state.getState().navigation.currentDeliveryTab || 'planned';
        this.selectedDeliveries = new Set();
        this.deliveryForm = {
            id: null,
            client_id: null,
            driver_id: null,
            scheduled_date: '',
            scheduled_time: '',
            status: 'pending',
            priority: 'normal',
            notes: '',
            cylinders: []
        };
    }

    /**
     * Render the component
     * @returns {string} HTML template
     */
    render() {
        const { deliveries = [], clients = [], drivers = [] } = state.getState().data;
        const { deliveryFilters = {} } = state.getState().filters;
        const { isLoading } = state.getState().ui;

        const filteredDeliveries = this.filterDeliveries(deliveries);
        const stats = this.calculateStats(filteredDeliveries);

        return `
            <div class="delivery-manager">
                <!-- Header Section -->
                <div class="component-header">
                    <div class="header-content">
                        <h2 class="component-title">
                            ${icons.truck}
                            <span>Delivery Management</span>
                        </h2>
                        <div class="header-actions">
                            <button class="btn btn-secondary" data-action="export">
                                ${icons.download}
                                <span>Export</span>
                            </button>
                            <button class="btn btn-secondary" data-action="print">
                                ${icons.print}
                                <span>Print</span>
                            </button>
                            <button class="btn btn-primary" data-action="new-delivery">
                                ${icons.plus}
                                <span>New Delivery</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Tab Navigation -->
                <div class="tab-navigation">
                    ${this.tabs.map(tab => `
                        <button class="tab-button ${this.currentTab === tab ? 'active' : ''}" 
                                data-tab="${tab}">
                            ${tab === 'planned' ? icons.clock : icons.archive}
                            <span>${this.getTabLabel(tab)}</span>
                            <span class="tab-badge">${this.getTabCount(filteredDeliveries, tab)}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Filters Section -->
                <div class="filters-section">
                    <div class="filter-row">
                        <!-- Date Range Filter -->
                        <div class="filter-group">
                            <label>Date Range</label>
                            <div class="date-range-picker">
                                <input type="date" 
                                       id="filter-start-date" 
                                       value="${deliveryFilters.startDate || ''}"
                                       class="form-control">
                                <span class="date-separator">to</span>
                                <input type="date" 
                                       id="filter-end-date" 
                                       value="${deliveryFilters.endDate || ''}"
                                       class="form-control">
                            </div>
                        </div>

                        <!-- Client Filter -->
                        <div class="filter-group">
                            <label>Client</label>
                            <select id="filter-client" class="form-control">
                                <option value="">All Clients</option>
                                ${clients.map(client => `
                                    <option value="${client.id}" 
                                            ${deliveryFilters.clientId === client.id ? 'selected' : ''}>
                                        ${client.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Status Filter -->
                        <div class="filter-group">
                            <label>Status</label>
                            <select id="filter-status" class="form-control">
                                <option value="">All Status</option>
                                ${this.getStatusOptions().map(status => `
                                    <option value="${status.value}" 
                                            ${deliveryFilters.status === status.value ? 'selected' : ''}>
                                        ${status.label}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Search Filter -->
                        <div class="filter-group">
                            <label>Search</label>
                            <div class="search-input">
                                ${icons.search}
                                <input type="text" 
                                       id="filter-search" 
                                       placeholder="Search deliveries..."
                                       value="${deliveryFilters.search || ''}"
                                       class="form-control">
                            </div>
                        </div>

                        <!-- Clear Filters -->
                        <div class="filter-group filter-actions">
                            <button class="btn btn-link" data-action="clear-filters">
                                ${icons.x}
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Statistics Bar -->
                <div class="stats-bar">
                    <div class="stat-item">
                        <span class="stat-label">Total</span>
                        <span class="stat-value">${stats.total}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Pending</span>
                        <span class="stat-value text-warning">${stats.pending}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">In Progress</span>
                        <span class="stat-value text-info">${stats.inProgress}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Completed</span>
                        <span class="stat-value text-success">${stats.completed}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Cancelled</span>
                        <span class="stat-value text-danger">${stats.cancelled}</span>
                    </div>
                </div>

                <!-- Bulk Actions -->
                ${this.selectedDeliveries.size > 0 ? `
                    <div class="bulk-actions">
                        <div class="bulk-info">
                            ${icons.checkSquare}
                            <span>${this.selectedDeliveries.size} selected</span>
                        </div>
                        <div class="bulk-buttons">
                            <button class="btn btn-sm btn-outline" data-action="bulk-assign">
                                ${icons.user}
                                Assign Driver
                            </button>
                            <button class="btn btn-sm btn-outline" data-action="bulk-status">
                                ${icons.edit}
                                Update Status
                            </button>
                            <button class="btn btn-sm btn-outline-danger" data-action="bulk-cancel">
                                ${icons.x}
                                Cancel Selected
                            </button>
                        </div>
                    </div>
                ` : ''}

                <!-- Content Area -->
                <div class="content-area">
                    ${isLoading ? this.renderLoading() : this.renderDeliveryList(filteredDeliveries, drivers)}
                </div>

                <!-- Modals -->
                ${this.renderDeliveryModal(clients, drivers)}
                ${this.renderBulkAssignModal(drivers)}
                ${this.renderBulkStatusModal()}
            </div>
        `;
    }

    /**
     * Filter deliveries based on current tab and filters
     */
    filterDeliveries(deliveries) {
        const { deliveryFilters = {} } = state.getState().filters;
        
        return deliveries.filter(delivery => {
            // Tab filter
            if (this.currentTab === 'planned' && 
                ['completed', 'cancelled'].includes(delivery.status)) {
                return false;
            }
            if (this.currentTab === 'history' && 
                !['completed', 'cancelled'].includes(delivery.status)) {
                return false;
            }

            // Date range filter
            if (deliveryFilters.startDate && delivery.scheduled_date < deliveryFilters.startDate) {
                return false;
            }
            if (deliveryFilters.endDate && delivery.scheduled_date > deliveryFilters.endDate) {
                return false;
            }

            // Client filter
            if (deliveryFilters.clientId && delivery.client_id !== parseInt(deliveryFilters.clientId)) {
                return false;
            }

            // Status filter
            if (deliveryFilters.status && delivery.status !== deliveryFilters.status) {
                return false;
            }

            // Search filter
            if (deliveryFilters.search) {
                const searchTerm = deliveryFilters.search.toLowerCase();
                const client = state.getState().data.clients.find(c => c.id === delivery.client_id);
                const searchableText = `
                    ${client?.name || ''}
                    ${client?.phone || ''}
                    ${delivery.notes || ''}
                `.toLowerCase();
                
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Render delivery list
     */
    renderDeliveryList(deliveries, drivers) {
        if (deliveries.length === 0) {
            return this.renderEmptyState();
        }

        const { clients = [] } = state.getState().data;

        return `
            <div class="delivery-list">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="checkbox-column">
                                <input type="checkbox" 
                                       id="select-all" 
                                       ${this.selectedDeliveries.size === deliveries.length ? 'checked' : ''}>
                            </th>
                            <th>Date/Time</th>
                            <th>Client</th>
                            <th>Driver</th>
                            <th>Items</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${deliveries.map(delivery => {
                            const client = clients.find(c => c.id === delivery.client_id);
                            const driver = drivers.find(d => d.id === delivery.driver_id);
                            const isSelected = this.selectedDeliveries.has(delivery.id);

                            return `
                                <tr class="delivery-row ${isSelected ? 'selected' : ''}" 
                                    data-delivery-id="${delivery.id}">
                                    <td class="checkbox-column">
                                        <input type="checkbox" 
                                               data-delivery-id="${delivery.id}"
                                               ${isSelected ? 'checked' : ''}>
                                    </td>
                                    <td>
                                        <div class="date-time">
                                            <div>${formatDate(delivery.scheduled_date)}</div>
                                            <div class="text-muted">${delivery.scheduled_time || 'Not set'}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="client-info">
                                            <div class="client-name">${client?.name || 'Unknown'}</div>
                                            <div class="text-muted">${client?.phone || ''}</div>
                                        </div>
                                    </td>
                                    <td>
                                        ${driver ? `
                                            <div class="driver-info">
                                                ${icons.user}
                                                <span>${driver.name}</span>
                                            </div>
                                        ` : `
                                            <span class="text-muted">Unassigned</span>
                                        `}
                                    </td>
                                    <td>
                                        <div class="items-count">
                                            ${icons.package}
                                            <span>${delivery.cylinders?.length || 0} cylinders</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="priority-badge priority-${delivery.priority || 'normal'}">
                                            ${this.getPriorityLabel(delivery.priority)}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="status-badge status-${delivery.status}">
                                            ${this.getStatusIcon(delivery.status)}
                                            ${this.getStatusLabel(delivery.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn btn-sm btn-icon" 
                                                    data-action="view-delivery" 
                                                    data-delivery-id="${delivery.id}"
                                                    title="View Details">
                                                ${icons.eye}
                                            </button>
                                            <button class="btn btn-sm btn-icon" 
                                                    data-action="edit-delivery" 
                                                    data-delivery-id="${delivery.id}"
                                                    title="Edit">
                                                ${icons.edit}
                                            </button>
                                            <button class="btn btn-sm btn-icon" 
                                                    data-action="print-delivery" 
                                                    data-delivery-id="${delivery.id}"
                                                    title="Print">
                                                ${icons.print}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render delivery modal
     */
    renderDeliveryModal(clients, drivers) {
        const isEdit = !!this.deliveryForm.id;
        const title = isEdit ? 'Edit Delivery' : 'New Delivery';

        return `
            <div class="modal" id="delivery-modal" style="display: none;">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="btn-close" data-action="close-modal">
                            ${icons.x}
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="delivery-form">
                            <div class="form-row">
                                <!-- Client Selection -->
                                <div class="form-group">
                                    <label for="delivery-client">Client *</label>
                                    <select id="delivery-client" class="form-control" required>
                                        <option value="">Select Client</option>
                                        ${clients.map(client => `
                                            <option value="${client.id}" 
                                                    ${this.deliveryForm.client_id === client.id ? 'selected' : ''}>
                                                ${client.name} - ${client.phone}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>

                                <!-- Driver Assignment -->
                                <div class="form-group">
                                    <label for="delivery-driver">Driver</label>
                                    <select id="delivery-driver" class="form-control">
                                        <option value="">Unassigned</option>
                                        ${drivers.map(driver => `
                                            <option value="${driver.id}" 
                                                    ${this.deliveryForm.driver_id === driver.id ? 'selected' : ''}>
                                                ${driver.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="form-row">
                                <!-- Scheduled Date -->
                                <div class="form-group">
                                    <label for="delivery-date">Scheduled Date *</label>
                                    <input type="date" 
                                           id="delivery-date" 
                                           value="${this.deliveryForm.scheduled_date}"
                                           min="${new Date().toISOString().split('T')[0]}"
                                           class="form-control" 
                                           required>
                                </div>

                                <!-- Scheduled Time -->
                                <div class="form-group">
                                    <label for="delivery-time">Scheduled Time</label>
                                    <input type="time" 
                                           id="delivery-time" 
                                           value="${this.deliveryForm.scheduled_time}"
                                           class="form-control">
                                </div>
                            </div>

                            <div class="form-row">
                                <!-- Priority -->
                                <div class="form-group">
                                    <label for="delivery-priority">Priority</label>
                                    <select id="delivery-priority" class="form-control">
                                        <option value="low" ${this.deliveryForm.priority === 'low' ? 'selected' : ''}>
                                            Low
                                        </option>
                                        <option value="normal" ${this.deliveryForm.priority === 'normal' ? 'selected' : ''}>
                                            Normal
                                        </option>
                                        <option value="high" ${this.deliveryForm.priority === 'high' ? 'selected' : ''}>
                                            High
                                        </option>
                                        <option value="urgent" ${this.deliveryForm.priority === 'urgent' ? 'selected' : ''}>
                                            Urgent
                                        </option>
                                    </select>
                                </div>

                                <!-- Status -->
                                <div class="form-group">
                                    <label for="delivery-status">Status</label>
                                    <select id="delivery-status" class="form-control">
                                        ${this.getStatusOptions().map(status => `
                                            <option value="${status.value}" 
                                                    ${this.deliveryForm.status === status.value ? 'selected' : ''}>
                                                ${status.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>

                            <!-- Cylinder Selection -->
                            <div class="form-group">
                                <label>Cylinders</label>
                                <div class="cylinder-selection">
                                    ${this.renderCylinderSelection()}
                                </div>
                            </div>

                            <!-- Notes -->
                            <div class="form-group">
                                <label for="delivery-notes">Notes</label>
                                <textarea id="delivery-notes" 
                                          rows="3" 
                                          class="form-control"
                                          placeholder="Special instructions, delivery notes, etc.">${this.deliveryForm.notes || ''}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-action="close-modal">Cancel</button>
                        <button class="btn btn-primary" data-action="save-delivery">
                            ${isEdit ? 'Update' : 'Create'} Delivery
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render cylinder selection
     */
    renderCylinderSelection() {
        const { cylinders = [] } = state.getState().data;
        const availableCylinders = cylinders.filter(c => c.status === 'available');

        return `
            <div class="cylinder-grid">
                ${availableCylinders.map(cylinder => {
                    const isSelected = this.deliveryForm.cylinders.includes(cylinder.id);
                    return `
                        <label class="cylinder-item ${isSelected ? 'selected' : ''}">
                            <input type="checkbox" 
                                   value="${cylinder.id}"
                                   ${isSelected ? 'checked' : ''}>
                            <div class="cylinder-info">
                                <div class="cylinder-type">${cylinder.type}</div>
                                <div class="cylinder-size">${cylinder.size}kg</div>
                            </div>
                        </label>
                    `;
                }).join('')}
            </div>
            <div class="cylinder-summary">
                Selected: ${this.deliveryForm.cylinders.length} cylinders
            </div>
        `;
    }

    /**
     * Render bulk assign modal
     */
    renderBulkAssignModal(drivers) {
        return `
            <div class="modal" id="bulk-assign-modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Assign Driver to ${this.selectedDeliveries.size} Deliveries</h3>
                        <button class="btn-close" data-action="close-modal">
                            ${icons.x}
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="bulk-driver">Select Driver</label>
                            <select id="bulk-driver" class="form-control">
                                <option value="">Choose driver...</option>
                                ${drivers.map(driver => `
                                    <option value="${driver.id}">${driver.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-action="close-modal">Cancel</button>
                        <button class="btn btn-primary" data-action="confirm-bulk-assign">
                            Assign Driver
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render bulk status update modal
     */
    renderBulkStatusModal() {
        return `
            <div class="modal" id="bulk-status-modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Update Status for ${this.selectedDeliveries.size} Deliveries</h3>
                        <button class="btn-close" data-action="close-modal">
                            ${icons.x}
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="bulk-status">New Status</label>
                            <select id="bulk-status" class="form-control">
                                <option value="">Choose status...</option>
                                ${this.getStatusOptions().map(status => `
                                    <option value="${status.value}">${status.label}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="alert alert-warning">
                            ${icons.alertTriangle}
                            <p>This will update the status of all selected deliveries. This action cannot be undone.</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-action="close-modal">Cancel</button>
                        <button class="btn btn-primary" data-action="confirm-bulk-status">
                            Update Status
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                ${icons.truck}
                <h3>No Deliveries Found</h3>
                <p>No deliveries match your current filters.</p>
                <button class="btn btn-primary" data-action="new-delivery">
                    ${icons.plus}
                    Schedule New Delivery
                </button>
            </div>
        `;
    }

    /**
     * Render loading state
     */
    renderLoading() {
        return `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading deliveries...</p>
            </div>
        `;
    }

    /**
     * Calculate statistics
     */
    calculateStats(deliveries) {
        return {
            total: deliveries.length,
            pending: deliveries.filter(d => d.status === 'pending').length,
            inProgress: deliveries.filter(d => d.status === 'in_progress').length,
            completed: deliveries.filter(d => d.status === 'completed').length,
            cancelled: deliveries.filter(d => d.status === 'cancelled').length
        };
    }

    /**
     * Get tab label
     */
    getTabLabel(tab) {
        return tab === 'planned' ? 'Planned Deliveries' : 'Delivery History';
    }

    /**
     * Get tab count
     */
    getTabCount(deliveries, tab) {
        if (tab === 'planned') {
            return deliveries.filter(d => !['completed', 'cancelled'].includes(d.status)).length;
        } else {
            return deliveries.filter(d => ['completed', 'cancelled'].includes(d.status)).length;
        }
    }

    /**
     * Get status options
     */
    getStatusOptions() {
        return [
            { value: 'pending', label: 'Pending' },
            { value: 'assigned', label: 'Assigned' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' }
        ];
    }

    /**
     * Get status icon
     */
    getStatusIcon(status) {
        const iconMap = {
            pending: icons.clock,
            assigned: icons.user,
            in_progress: icons.truck,
            completed: icons.checkCircle,
            cancelled: icons.xCircle
        };
        return iconMap[status] || icons.circle;
    }

    /**
     * Get status label
     */
    getStatusLabel(status) {
        const option = this.getStatusOptions().find(opt => opt.value === status);
        return option ? option.label : status;
    }

    /**
     * Get priority label
     */
    getPriorityLabel(priority) {
        const labels = {
            low: 'Low',
            normal: 'Normal',
            high: 'High',
            urgent: 'Urgent'
        };
        return labels[priority] || 'Normal';
    }

    /**
     * Handle component events
     */
    handleEvent(event) {
        const action = event.target.dataset.action;
        const deliveryId = event.target.dataset.deliveryId;

        switch (action) {
            case 'new-delivery':
                this.showNewDeliveryModal();
                break;
            case 'edit-delivery':
                this.showEditDeliveryModal(parseInt(deliveryId));
                break;
            case 'view-delivery':
                this.viewDeliveryDetails(parseInt(deliveryId));
                break;
            case 'save-delivery':
                this.saveDelivery();
                break;
            case 'print-delivery':
                this.printDelivery(parseInt(deliveryId));
                break;
            case 'export':
                this.exportDeliveries();
                break;
            case 'print':
                this.printDeliveries();
                break;
            case 'bulk-assign':
                this.showBulkAssignModal();
                break;
            case 'bulk-status':
                this.showBulkStatusModal();
                break;
            case 'bulk-cancel':
                this.bulkCancelDeliveries();
                break;
            case 'confirm-bulk-assign':
                this.confirmBulkAssign();
                break;
            case 'confirm-bulk-status':
                this.confirmBulkStatus();
                break;
            case 'clear-filters':
                this.clearFilters();
                break;
            case 'close-modal':
                this.closeModals();
                break;
        }

        // Tab switching
        if (event.target.dataset.tab) {
            this.switchTab(event.target.dataset.tab);
        }

        // Checkbox handling
        if (event.target.type === 'checkbox') {
            if (event.target.id === 'select-all') {
                this.toggleSelectAll(event.target.checked);
            } else if (event.target.dataset.deliveryId) {
                this.toggleDeliverySelection(parseInt(event.target.dataset.deliveryId), event.target.checked);
            }
        }

        // Filter changes
        if (event.target.id && event.target.id.startsWith('filter-')) {
            this.updateFilters();
        }

        // Cylinder selection
        if (event.target.closest('.cylinder-item')) {
            this.toggleCylinderSelection(event.target.value, event.target.checked);
        }
    }

    /**
     * Setup component
     */
    setup() {
        // Restore tab from localStorage
        const savedTab = localStorage.getItem('deliveryManagerTab');
        if (savedTab && this.tabs.includes(savedTab)) {
            this.currentTab = savedTab;
            state.dispatch('navigation/setDeliveryTab', savedTab);
        }

        // Subscribe to state changes
        this.subscriptions.push(
            state.subscribe('data.deliveries', () => this.update()),
            state.subscribe('filters.deliveryFilters', () => this.update()),
            state.subscribe('ui.isLoading', () => this.update())
        );

        // Load initial data
        this.loadDeliveries();
    }

    /**
     * Load deliveries from API
     */
    async loadDeliveries() {
        try {
            state.dispatch('ui/setLoading', true);
            const deliveries = await api.deliveries.getAll();
            state.dispatch('data/setDeliveries', deliveries);
        } catch (error) {
            console.error('Failed to load deliveries:', error);
            showToast('Failed to load deliveries', 'error');
        } finally {
            state.dispatch('ui/setLoading', false);
        }
    }

    /**
     * Switch tab
     */
    switchTab(tab) {
        this.currentTab = tab;
        localStorage.setItem('deliveryManagerTab', tab);
        state.dispatch('navigation/setDeliveryTab', tab);
        this.selectedDeliveries.clear();
        this.update();
    }

    /**
     * Update filters
     */
    updateFilters() {
        const filters = {
            startDate: document.getElementById('filter-start-date').value,
            endDate: document.getElementById('filter-end-date').value,
            clientId: document.getElementById('filter-client').value,
            status: document.getElementById('filter-status').value,
            search: document.getElementById('filter-search').value
        };
        
        state.dispatch('filters/setDeliveryFilters', filters);
    }

    /**
     * Clear filters
     */
    clearFilters() {
        state.dispatch('filters/setDeliveryFilters', {});
        this.update();
    }

    /**
     * Toggle select all
     */
    toggleSelectAll(checked) {
        const { deliveries = [] } = state.getState().data;
        const filteredDeliveries = this.filterDeliveries(deliveries);

        if (checked) {
            filteredDeliveries.forEach(delivery => {
                this.selectedDeliveries.add(delivery.id);
            });
        } else {
            this.selectedDeliveries.clear();
        }
        
        this.update();
    }

    /**
     * Toggle delivery selection
     */
    toggleDeliverySelection(deliveryId, checked) {
        if (checked) {
            this.selectedDeliveries.add(deliveryId);
        } else {
            this.selectedDeliveries.delete(deliveryId);
        }
        
        this.update();
    }

    /**
     * Toggle cylinder selection
     */
    toggleCylinderSelection(cylinderId, checked) {
        const id = parseInt(cylinderId);
        if (checked && !this.deliveryForm.cylinders.includes(id)) {
            this.deliveryForm.cylinders.push(id);
        } else if (!checked) {
            this.deliveryForm.cylinders = this.deliveryForm.cylinders.filter(c => c !== id);
        }
        
        // Re-render cylinder selection
        const container = document.querySelector('.cylinder-selection');
        if (container) {
            container.innerHTML = this.renderCylinderSelection();
        }
    }

    /**
     * Show new delivery modal
     */
    showNewDeliveryModal() {
        this.deliveryForm = {
            id: null,
            client_id: null,
            driver_id: null,
            scheduled_date: new Date().toISOString().split('T')[0],
            scheduled_time: '',
            status: 'pending',
            priority: 'normal',
            notes: '',
            cylinders: []
        };
        
        document.getElementById('delivery-modal').style.display = 'block';
    }

    /**
     * Show edit delivery modal
     */
    showEditDeliveryModal(deliveryId) {
        const delivery = state.getState().data.deliveries.find(d => d.id === deliveryId);
        if (!delivery) return;

        this.deliveryForm = {
            id: delivery.id,
            client_id: delivery.client_id,
            driver_id: delivery.driver_id,
            scheduled_date: delivery.scheduled_date,
            scheduled_time: delivery.scheduled_time || '',
            status: delivery.status,
            priority: delivery.priority || 'normal',
            notes: delivery.notes || '',
            cylinders: delivery.cylinders || []
        };
        
        document.getElementById('delivery-modal').style.display = 'block';
    }

    /**
     * Save delivery
     */
    async saveDelivery() {
        const form = document.getElementById('delivery-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const deliveryData = {
            client_id: parseInt(document.getElementById('delivery-client').value),
            driver_id: document.getElementById('delivery-driver').value ? 
                      parseInt(document.getElementById('delivery-driver').value) : null,
            scheduled_date: document.getElementById('delivery-date').value,
            scheduled_time: document.getElementById('delivery-time').value || null,
            status: document.getElementById('delivery-status').value,
            priority: document.getElementById('delivery-priority').value,
            notes: document.getElementById('delivery-notes').value,
            cylinders: this.deliveryForm.cylinders
        };

        try {
            state.dispatch('ui/setLoading', true);
            
            if (this.deliveryForm.id) {
                await api.deliveries.update(this.deliveryForm.id, deliveryData);
                showToast('Delivery updated successfully', 'success');
            } else {
                await api.deliveries.create(deliveryData);
                showToast('Delivery created successfully', 'success');
            }
            
            await this.loadDeliveries();
            this.closeModals();
        } catch (error) {
            console.error('Failed to save delivery:', error);
            showToast('Failed to save delivery', 'error');
        } finally {
            state.dispatch('ui/setLoading', false);
        }
    }

    /**
     * View delivery details
     */
    viewDeliveryDetails(deliveryId) {
        // This could open a detailed view modal or navigate to a detail page
        console.log('View delivery details:', deliveryId);
        // For now, we'll just show the edit modal in read-only mode
        this.showEditDeliveryModal(deliveryId);
    }

    /**
     * Print single delivery
     */
    printDelivery(deliveryId) {
        const delivery = state.getState().data.deliveries.find(d => d.id === deliveryId);
        if (!delivery) return;

        // Create print window with delivery details
        const printWindow = window.open('', '_blank');
        printWindow.document.write(this.generateDeliveryPrintHTML(delivery));
        printWindow.document.close();
        printWindow.print();
    }

    /**
     * Generate delivery print HTML
     */
    generateDeliveryPrintHTML(delivery) {
        const { clients = [], drivers = [] } = state.getState().data;
        const client = clients.find(c => c.id === delivery.client_id);
        const driver = drivers.find(d => d.id === delivery.driver_id);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Delivery #${delivery.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .info-section { border: 1px solid #ddd; padding: 15px; }
                    .info-section h3 { margin-top: 0; }
                    .items-table { width: 100%; border-collapse: collapse; }
                    .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .items-table th { background-color: #f5f5f5; }
                    .signature-section { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
                    .signature-line { border-bottom: 1px solid #000; margin-top: 50px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Delivery Order</h1>
                    <p>Order #${delivery.id} - ${formatDate(delivery.scheduled_date)}</p>
                </div>
                
                <div class="info-grid">
                    <div class="info-section">
                        <h3>Client Information</h3>
                        <p><strong>Name:</strong> ${client?.name || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${client?.phone || 'N/A'}</p>
                        <p><strong>Address:</strong> ${client?.address || 'N/A'}</p>
                    </div>
                    
                    <div class="info-section">
                        <h3>Delivery Information</h3>
                        <p><strong>Date:</strong> ${formatDate(delivery.scheduled_date)}</p>
                        <p><strong>Time:</strong> ${delivery.scheduled_time || 'Not specified'}</p>
                        <p><strong>Driver:</strong> ${driver?.name || 'Unassigned'}</p>
                        <p><strong>Status:</strong> ${this.getStatusLabel(delivery.status)}</p>
                    </div>
                </div>
                
                <h3>Items</h3>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Type</th>
                            <th>Size</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${delivery.cylinders?.map(cylinderId => {
                            const cylinder = state.getState().data.cylinders?.find(c => c.id === cylinderId);
                            return `
                                <tr>
                                    <td>Cylinder #${cylinderId}</td>
                                    <td>${cylinder?.type || 'N/A'}</td>
                                    <td>${cylinder?.size || 'N/A'}kg</td>
                                    <td>1</td>
                                </tr>
                            `;
                        }).join('') || '<tr><td colspan="4">No items</td></tr>'}
                    </tbody>
                </table>
                
                ${delivery.notes ? `
                    <div style="margin-top: 30px;">
                        <h3>Notes</h3>
                        <p>${delivery.notes}</p>
                    </div>
                ` : ''}
                
                <div class="signature-section">
                    <div>
                        <p>Driver Signature:</p>
                        <div class="signature-line"></div>
                    </div>
                    <div>
                        <p>Client Signature:</p>
                        <div class="signature-line"></div>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Export deliveries
     */
    async exportDeliveries() {
        const { deliveries = [], clients = [], drivers = [] } = state.getState().data;
        const filteredDeliveries = this.filterDeliveries(deliveries);

        const exportData = filteredDeliveries.map(delivery => {
            const client = clients.find(c => c.id === delivery.client_id);
            const driver = drivers.find(d => d.id === delivery.driver_id);

            return {
                'ID': delivery.id,
                'Date': formatDate(delivery.scheduled_date),
                'Time': delivery.scheduled_time || 'Not set',
                'Client': client?.name || 'Unknown',
                'Phone': client?.phone || '',
                'Driver': driver?.name || 'Unassigned',
                'Items': delivery.cylinders?.length || 0,
                'Priority': this.getPriorityLabel(delivery.priority),
                'Status': this.getStatusLabel(delivery.status),
                'Notes': delivery.notes || ''
            };
        });

        try {
            await exportToExcel(exportData, `deliveries_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('Deliveries exported successfully', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showToast('Failed to export deliveries', 'error');
        }
    }

    /**
     * Print all deliveries
     */
    printDeliveries() {
        window.print();
    }

    /**
     * Show bulk assign modal
     */
    showBulkAssignModal() {
        if (this.selectedDeliveries.size === 0) {
            showToast('Please select deliveries first', 'warning');
            return;
        }
        
        document.getElementById('bulk-assign-modal').style.display = 'block';
    }

    /**
     * Show bulk status modal
     */
    showBulkStatusModal() {
        if (this.selectedDeliveries.size === 0) {
            showToast('Please select deliveries first', 'warning');
            return;
        }
        
        document.getElementById('bulk-status-modal').style.display = 'block';
    }

    /**
     * Confirm bulk assign
     */
    async confirmBulkAssign() {
        const driverId = document.getElementById('bulk-driver').value;
        if (!driverId) {
            showToast('Please select a driver', 'warning');
            return;
        }

        try {
            state.dispatch('ui/setLoading', true);
            
            const promises = Array.from(this.selectedDeliveries).map(deliveryId => 
                api.deliveries.update(deliveryId, { driver_id: parseInt(driverId) })
            );
            
            await Promise.all(promises);
            showToast(`Assigned driver to ${this.selectedDeliveries.size} deliveries`, 'success');
            
            this.selectedDeliveries.clear();
            await this.loadDeliveries();
            this.closeModals();
        } catch (error) {
            console.error('Bulk assign failed:', error);
            showToast('Failed to assign driver', 'error');
        } finally {
            state.dispatch('ui/setLoading', false);
        }
    }

    /**
     * Confirm bulk status update
     */
    async confirmBulkStatus() {
        const status = document.getElementById('bulk-status').value;
        if (!status) {
            showToast('Please select a status', 'warning');
            return;
        }

        try {
            state.dispatch('ui/setLoading', true);
            
            const promises = Array.from(this.selectedDeliveries).map(deliveryId => 
                api.deliveries.update(deliveryId, { status })
            );
            
            await Promise.all(promises);
            showToast(`Updated status for ${this.selectedDeliveries.size} deliveries`, 'success');
            
            this.selectedDeliveries.clear();
            await this.loadDeliveries();
            this.closeModals();
        } catch (error) {
            console.error('Bulk status update failed:', error);
            showToast('Failed to update status', 'error');
        } finally {
            state.dispatch('ui/setLoading', false);
        }
    }

    /**
     * Bulk cancel deliveries
     */
    async bulkCancelDeliveries() {
        if (this.selectedDeliveries.size === 0) {
            showToast('Please select deliveries first', 'warning');
            return;
        }

        const confirm = window.confirm(`Are you sure you want to cancel ${this.selectedDeliveries.size} deliveries?`);
        if (!confirm) return;

        try {
            state.dispatch('ui/setLoading', true);
            
            const promises = Array.from(this.selectedDeliveries).map(deliveryId => 
                api.deliveries.update(deliveryId, { status: 'cancelled' })
            );
            
            await Promise.all(promises);
            showToast(`Cancelled ${this.selectedDeliveries.size} deliveries`, 'success');
            
            this.selectedDeliveries.clear();
            await this.loadDeliveries();
        } catch (error) {
            console.error('Bulk cancel failed:', error);
            showToast('Failed to cancel deliveries', 'error');
        } finally {
            state.dispatch('ui/setLoading', false);
        }
    }

    /**
     * Close all modals
     */
    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    /**
     * Cleanup
     */
    cleanup() {
        super.cleanup();
        this.selectedDeliveries.clear();
    }
}

// Export component
export default DeliveryManager;