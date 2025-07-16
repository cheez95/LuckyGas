/**
 * Client-specific Component Implementations
 * Extends base components for client management functionality
 */

import { Modal } from './Modal.js';
import { DataTable } from './DataTable.js';
import { Form } from './Form.js';
import { dom } from '../utils/dom.js';
import { format } from '../utils/format.js';
import { apiClient } from '../api/index.js';

/**
 * Client Modal for Add/Edit operations
 */
export class ClientModal extends Modal {
    constructor(options = {}) {
        super({
            title: options.mode === 'edit' ? 'Edit Client' : 'Add New Client',
            width: 'max-w-2xl',
            ...options
        });
        
        this.mode = options.mode || 'add';
        this.clientData = options.clientData || {};
        this.onSuccess = options.onSuccess || (() => {});
    }

    /**
     * Show the client form modal
     */
    show() {
        const formId = 'client-form-' + Date.now();
        
        this.options.content = `
            <div id="${formId}"></div>
        `;
        
        super.show();
        
        // Initialize form
        this.form = new Form({
            container: `#${formId}`,
            fields: this._getFormFields(),
            values: this.clientData,
            onSubmit: async (data) => {
                await this._handleSubmit(data);
            }
        });
    }

    /**
     * Get form field configuration
     * @private
     */
    _getFormFields() {
        return [
            {
                name: 'name',
                label: 'Client Name',
                type: 'text',
                required: true,
                placeholder: 'Enter client name'
            },
            {
                name: 'code',
                label: 'Client Code',
                type: 'text',
                required: true,
                placeholder: 'Enter unique client code',
                disabled: this.mode === 'edit'
            },
            {
                name: 'phone',
                label: 'Phone Number',
                type: 'tel',
                required: true,
                placeholder: 'Enter phone number',
                validation: {
                    phone: true
                }
            },
            {
                name: 'email',
                label: 'Email Address',
                type: 'email',
                placeholder: 'Enter email address',
                validation: {
                    email: true
                }
            },
            {
                name: 'address',
                label: 'Address',
                type: 'textarea',
                rows: 3,
                required: true,
                placeholder: 'Enter client address'
            },
            {
                name: 'contact_person',
                label: 'Contact Person',
                type: 'text',
                placeholder: 'Enter contact person name'
            },
            {
                name: 'notes',
                label: 'Notes',
                type: 'textarea',
                rows: 2,
                placeholder: 'Additional notes (optional)'
            }
        ];
    }

    /**
     * Handle form submission
     * @private
     */
    async _handleSubmit(data) {
        try {
            if (this.mode === 'edit') {
                await apiClient.put(`/api/clients/${this.clientData.id}`, data);
                this.showSuccess('Client updated successfully');
            } else {
                await apiClient.post('/api/clients', data);
                this.showSuccess('Client added successfully');
            }
            
            setTimeout(() => {
                this.close();
                this.onSuccess();
            }, 1500);
        } catch (error) {
            this.showError(error.message || 'Failed to save client');
            throw error; // Re-throw to keep form in submitting state
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const body = this.element?.querySelector('.modal-body');
        if (body) {
            const alert = document.createElement('div');
            alert.className = 'bg-green-50 text-green-600 p-4 rounded-lg mb-4';
            alert.innerHTML = `
                <strong>Success:</strong> ${dom.escape(message)}
            `;
            body.insertBefore(alert, body.firstChild);
        }
    }
}

/**
 * Client DataTable with custom configuration
 */
export class ClientTable extends DataTable {
    constructor(options = {}) {
        super({
            url: '/api/clients',
            columns: [
                {
                    field: 'selection',
                    label: '',
                    width: '40px',
                    exportable: false
                },
                {
                    field: 'code',
                    label: 'Code',
                    sortable: true
                },
                {
                    field: 'name',
                    label: 'Name',
                    sortable: true,
                    render: (value, row) => {
                        return `<a href="#" class="text-primary hover:underline" data-action="view">${dom.escape(value)}</a>`;
                    }
                },
                {
                    field: 'phone',
                    label: 'Phone',
                    render: (value) => format.phone(value)
                },
                {
                    field: 'email',
                    label: 'Email',
                    render: (value) => value ? `<a href="mailto:${value}" class="text-primary hover:underline">${dom.escape(value)}</a>` : '-'
                },
                {
                    field: 'address',
                    label: 'Address',
                    className: 'max-w-xs truncate'
                },
                {
                    field: 'active',
                    label: 'Status',
                    render: (value) => {
                        const status = value ? 'Active' : 'Inactive';
                        const className = value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
                        return `<span class="px-2 py-1 text-xs font-medium rounded-full ${className}">${status}</span>`;
                    }
                },
                {
                    field: 'actions',
                    label: 'Actions',
                    sortable: false,
                    exportable: false,
                    render: (value, row) => {
                        return `
                            <div class="flex items-center space-x-2">
                                <button class="text-primary hover:text-blue-700" data-action="edit" title="Edit">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                    </svg>
                                </button>
                                <button class="text-red-600 hover:text-red-700" data-action="delete" title="Delete">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        `;
                    }
                }
            ],
            searchable: true,
            selectable: true,
            exportable: true,
            pageSizes: [10, 25, 50, 100],
            filters: [
                {
                    field: 'active',
                    label: 'Status',
                    type: 'select',
                    options: [
                        { value: 'true', label: 'Active' },
                        { value: 'false', label: 'Inactive' }
                    ]
                }
            ],
            ...options
        });
    }
}

/**
 * Client Detail Modal
 */
export class ClientDetailModal extends Modal {
    constructor(options = {}) {
        super({
            title: 'Client Details',
            width: 'max-w-4xl',
            ...options
        });
        
        this.clientId = options.clientId;
        this.clientData = null;
    }

    /**
     * Show client details
     */
    async show() {
        this.showLoading('Loading client details...');
        super.show();
        
        try {
            // Load client data
            const response = await apiClient.get(`/api/clients/${this.clientId}`);
            this.clientData = response.data;
            
            // Load related data
            const [deliveriesResponse, statsResponse] = await Promise.all([
                apiClient.get(`/api/deliveries?client_id=${this.clientId}&limit=5`),
                apiClient.get(`/api/clients/${this.clientId}/stats`)
            ]);
            
            this.options.title = `Client: ${this.clientData.name}`;
            this.options.content = this._renderDetails(
                this.clientData,
                deliveriesResponse.data,
                statsResponse.data
            );
            
            this._updateContent();
        } catch (error) {
            this.showError('Failed to load client details');
        }
    }

    /**
     * Render client details
     * @private
     */
    _renderDetails(client, recentDeliveries, stats) {
        return `
            <div class="space-y-6">
                <!-- Client Information -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <h3 class="text-lg font-semibold mb-3">Contact Information</h3>
                        <dl class="space-y-2">
                            <div class="flex">
                                <dt class="font-medium text-gray-600 w-32">Code:</dt>
                                <dd>${dom.escape(client.code)}</dd>
                            </div>
                            <div class="flex">
                                <dt class="font-medium text-gray-600 w-32">Name:</dt>
                                <dd>${dom.escape(client.name)}</dd>
                            </div>
                            <div class="flex">
                                <dt class="font-medium text-gray-600 w-32">Phone:</dt>
                                <dd>${format.phone(client.phone)}</dd>
                            </div>
                            <div class="flex">
                                <dt class="font-medium text-gray-600 w-32">Email:</dt>
                                <dd>${client.email ? `<a href="mailto:${client.email}" class="text-primary hover:underline">${dom.escape(client.email)}</a>` : '-'}</dd>
                            </div>
                            <div class="flex">
                                <dt class="font-medium text-gray-600 w-32">Address:</dt>
                                <dd>${dom.escape(client.address)}</dd>
                            </div>
                            <div class="flex">
                                <dt class="font-medium text-gray-600 w-32">Contact Person:</dt>
                                <dd>${dom.escape(client.contact_person || '-')}</dd>
                            </div>
                            <div class="flex">
                                <dt class="font-medium text-gray-600 w-32">Status:</dt>
                                <dd>
                                    <span class="px-2 py-1 text-xs font-medium rounded-full ${client.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                                        ${client.active ? 'Active' : 'Inactive'}
                                    </span>
                                </dd>
                            </div>
                        </dl>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold mb-3">Statistics</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <div class="text-2xl font-bold text-blue-700">${stats.total_deliveries || 0}</div>
                                <div class="text-sm text-blue-600">Total Deliveries</div>
                            </div>
                            <div class="bg-green-50 p-4 rounded-lg">
                                <div class="text-2xl font-bold text-green-700">${stats.completed_deliveries || 0}</div>
                                <div class="text-sm text-green-600">Completed</div>
                            </div>
                            <div class="bg-yellow-50 p-4 rounded-lg">
                                <div class="text-2xl font-bold text-yellow-700">${stats.pending_deliveries || 0}</div>
                                <div class="text-sm text-yellow-600">Pending</div>
                            </div>
                            <div class="bg-purple-50 p-4 rounded-lg">
                                <div class="text-2xl font-bold text-purple-700">$${format.number(stats.total_revenue || 0)}</div>
                                <div class="text-sm text-purple-600">Total Revenue</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Recent Deliveries -->
                <div>
                    <h3 class="text-lg font-semibold mb-3">Recent Deliveries</h3>
                    ${recentDeliveries.length > 0 ? `
                        <table class="w-full">
                            <thead>
                                <tr class="bg-gray-50">
                                    <th class="px-4 py-2 text-left">Date</th>
                                    <th class="px-4 py-2 text-left">Product</th>
                                    <th class="px-4 py-2 text-left">Quantity</th>
                                    <th class="px-4 py-2 text-left">Status</th>
                                    <th class="px-4 py-2 text-left">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentDeliveries.map(delivery => `
                                    <tr class="border-b">
                                        <td class="px-4 py-2">${format.date(delivery.delivery_date)}</td>
                                        <td class="px-4 py-2">${dom.escape(delivery.product_type)}</td>
                                        <td class="px-4 py-2">${delivery.quantity} gal</td>
                                        <td class="px-4 py-2">
                                            <span class="px-2 py-1 text-xs font-medium rounded-full ${this._getStatusClass(delivery.status)}">
                                                ${dom.escape(delivery.status)}
                                            </span>
                                        </td>
                                        <td class="px-4 py-2">$${format.number(delivery.total_amount)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-gray-500">No recent deliveries</p>'}
                </div>
                
                <!-- Notes -->
                ${client.notes ? `
                    <div>
                        <h3 class="text-lg font-semibold mb-3">Notes</h3>
                        <p class="text-gray-700">${dom.escape(client.notes)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get status class
     * @private
     */
    _getStatusClass(status) {
        const statusClasses = {
            'completed': 'bg-green-100 text-green-800',
            'pending': 'bg-yellow-100 text-yellow-800',
            'in_progress': 'bg-blue-100 text-blue-800',
            'cancelled': 'bg-red-100 text-red-800'
        };
        return statusClasses[status] || 'bg-gray-100 text-gray-800';
    }
}

export default {
    ClientModal,
    ClientTable,
    ClientDetailModal
};