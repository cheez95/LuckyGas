/**
 * Components Module Entry Point
 * Exports all reusable UI components
 */

// Base Components
export { Modal } from './Modal.js';
export { Table } from './Table.js';
export { Form } from './Form.js';
export { DataTable } from './DataTable.js';

// Client Components
export { ClientModal, ClientTable, ClientDetailModal } from './ClientComponents.js';

// Component Factory Functions
export const createModal = (options) => new Modal(options);
export const createTable = (options) => new Table(options);
export const createForm = (options) => new Form(options);
export const createDataTable = (options) => new DataTable(options);

// Utility functions
export const components = {
    /**
     * Show a confirmation dialog
     * @param {Object} options - Dialog options
     * @returns {Promise<boolean>} - True if confirmed, false otherwise
     */
    confirm: (options) => Modal.confirm(options),
    
    /**
     * Show an alert dialog
     * @param {Object} options - Dialog options
     * @returns {Modal} - The alert modal instance
     */
    alert: (options) => Modal.alert(options),
    
    /**
     * Create a simple loading modal
     * @param {string} message - Loading message
     * @returns {Modal} - The loading modal instance
     */
    showLoading: (message = 'Loading...') => {
        const modal = new Modal({
            content: `
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                    <span>${message}</span>
                </div>
            `,
            closeOnEscape: false,
            closeOnOverlay: false
        });
        modal.show();
        return modal;
    },
    
    /**
     * Create a table from simple data
     * @param {Object} config - Table configuration
     * @returns {Table} - The table instance
     */
    createSimpleTable: (config) => {
        const { container, data, columns } = config;
        
        // Auto-generate columns if not provided
        const tableColumns = columns || (data.length > 0 
            ? Object.keys(data[0]).map(key => ({
                field: key,
                label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
            }))
            : []);
        
        return new Table({
            container,
            columns: tableColumns,
            data,
            ...config
        });
    },
    
    /**
     * Create a form from field definitions
     * @param {Object} config - Form configuration
     * @returns {Form} - The form instance
     */
    createQuickForm: (config) => {
        const { fields, onSubmit, ...options } = config;
        
        // Convert simple field definitions to full config
        const formFields = fields.map(field => {
            if (typeof field === 'string') {
                return {
                    name: field,
                    label: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
                    type: 'text'
                };
            }
            return field;
        });
        
        return new Form({
            fields: formFields,
            onSubmit,
            ...options
        });
    }
};

// Usage Examples
export const examples = {
    // Modal Examples
    modalBasic: () => {
        const modal = new Modal({
            title: 'Basic Modal',
            content: '<p>This is a basic modal example.</p>',
            actions: `
                <button type="button" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        onclick="this.closest('.modal-container').parentElement.click()">
                    Close
                </button>
            `
        });
        modal.show();
    },
    
    modalWithForm: () => {
        const modal = new Modal({
            title: 'Modal with Form',
            content: `
                <form>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" name="name" class="w-full px-3 py-2 border rounded-md" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" name="email" class="w-full px-3 py-2 border rounded-md" required>
                    </div>
                </form>
            `,
            actions: `
                <button type="button" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                    Cancel
                </button>
                <button type="submit" class="px-4 py-2 bg-primary text-white rounded hover:bg-blue-700">
                    Submit
                </button>
            `,
            onSubmit: async (data) => {
                console.log('Form submitted:', data);
                modal.close();
            }
        });
        modal.show();
    },
    
    // Table Examples
    tableBasic: (container) => {
        const table = new Table({
            container,
            columns: [
                { field: 'id', label: 'ID' },
                { field: 'name', label: 'Name' },
                { field: 'email', label: 'Email' },
                { 
                    field: 'status', 
                    label: 'Status',
                    render: (value) => {
                        const color = value === 'active' ? 'green' : 'gray';
                        return `<span class="px-2 py-1 text-xs rounded-full bg-${color}-100 text-${color}-800">${value}</span>`;
                    }
                }
            ],
            data: [
                { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' }
            ]
        });
        return table;
    },
    
    // Form Examples
    formBasic: (container) => {
        const form = new Form({
            container,
            fields: [
                { name: 'name', label: 'Name', required: true },
                { name: 'email', label: 'Email', type: 'email', required: true },
                { 
                    name: 'role', 
                    label: 'Role', 
                    type: 'select',
                    options: ['Admin', 'User', 'Guest']
                },
                { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
            ],
            onSubmit: async (data) => {
                console.log('Form submitted:', data);
                components.alert({
                    title: 'Success',
                    message: 'Form submitted successfully!'
                });
            }
        });
        return form;
    },
    
    // DataTable Example
    dataTableExample: (container) => {
        const dataTable = new DataTable({
            container,
            url: '/api/users',
            columns: [
                { field: 'selection', label: '' },
                { field: 'id', label: 'ID', sortable: true },
                { field: 'name', label: 'Name', sortable: true },
                { field: 'email', label: 'Email' },
                { field: 'created_at', label: 'Created', sortable: true },
                {
                    field: 'actions',
                    label: 'Actions',
                    render: (value, row) => `
                        <button class="text-primary hover:underline" data-action="edit">Edit</button>
                        <button class="text-red-600 hover:underline ml-2" data-action="delete">Delete</button>
                    `
                }
            ],
            selectable: true,
            searchable: true,
            filters: [
                {
                    field: 'status',
                    label: 'Status',
                    type: 'select',
                    options: ['Active', 'Inactive', 'Pending']
                }
            ],
            onAction: (action, row) => {
                console.log(`Action ${action} on row:`, row);
            }
        });
        return dataTable;
    }
};

// Default export
export default {
    Modal,
    Table,
    Form,
    DataTable,
    ClientModal,
    ClientTable,
    ClientDetailModal,
    components,
    examples
};