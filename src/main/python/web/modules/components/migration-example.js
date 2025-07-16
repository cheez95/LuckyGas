/**
 * Component Migration Example
 * Shows how to replace inline code with modular components
 */

import { Modal, DataTable, Form, components } from './index.js';
import { ClientModal, ClientTable } from './ClientComponents.js';

// ============================================
// EXAMPLE 1: Simple Modal Migration
// ============================================

// OLD WAY (inline function)
function showModalOld(title, content) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl">
            <h2>${title}</h2>
            <div>${content}</div>
            <button onclick="this.closest('.fixed').remove()">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// NEW WAY (using Modal component)
function showModalNew(title, content) {
    const modal = new Modal({
        title: title,
        content: content,
        actions: '<button class="btn-close">Close</button>'
    });
    
    modal.show();
    
    // Add close handler
    modal.element.querySelector('.btn-close').addEventListener('click', () => {
        modal.close();
    });
    
    return modal;
}

// ============================================
// EXAMPLE 2: Table with Actions Migration
// ============================================

// OLD WAY (manual table rendering)
function renderTableOld(data, containerId) {
    const container = document.getElementById(containerId);
    const table = document.createElement('table');
    
    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Name</th><th>Email</th><th>Actions</th></tr>';
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.email}</td>
            <td>
                <button onclick="editItem(${item.id})">Edit</button>
                <button onclick="deleteItem(${item.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    container.innerHTML = '';
    container.appendChild(table);
}

// NEW WAY (using DataTable component)
function renderTableNew(data, containerId) {
    const table = new DataTable({
        container: containerId,
        data: data,
        columns: [
            { field: 'name', label: 'Name', sortable: true },
            { field: 'email', label: 'Email', sortable: true },
            {
                field: 'actions',
                label: 'Actions',
                render: (value, row) => `
                    <button data-action="edit">Edit</button>
                    <button data-action="delete">Delete</button>
                `
            }
        ],
        onAction: (action, row) => {
            if (action === 'edit') {
                console.log('Edit item:', row);
            } else if (action === 'delete') {
                console.log('Delete item:', row);
            }
        }
    });
    
    return table;
}

// ============================================
// EXAMPLE 3: Form with Validation Migration
// ============================================

// OLD WAY (manual form handling)
function setupFormOld(formId) {
    const form = document.getElementById(formId);
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Manual validation
        const email = form.email.value;
        if (!email.includes('@')) {
            alert('Invalid email');
            return;
        }
        
        // Collect data
        const data = {
            name: form.name.value,
            email: form.email.value,
            message: form.message.value
        };
        
        // Submit
        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                alert('Success!');
                form.reset();
            } else {
                alert('Error!');
            }
        } catch (error) {
            alert('Network error!');
        }
    });
}

// NEW WAY (using Form component)
function setupFormNew(containerId) {
    const form = new Form({
        container: containerId,
        fields: [
            {
                name: 'name',
                label: 'Name',
                required: true,
                placeholder: 'Enter your name'
            },
            {
                name: 'email',
                label: 'Email',
                type: 'email',
                required: true,
                validation: { email: true },
                placeholder: 'your@email.com'
            },
            {
                name: 'message',
                label: 'Message',
                type: 'textarea',
                rows: 4,
                required: true,
                placeholder: 'Enter your message'
            }
        ],
        onSubmit: async (data) => {
            try {
                const response = await fetch('/api/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    components.alert({
                        title: 'Success',
                        message: 'Form submitted successfully!'
                    });
                    form.reset();
                } else {
                    throw new Error('Server error');
                }
            } catch (error) {
                components.alert({
                    title: 'Error',
                    message: 'Failed to submit form. Please try again.'
                });
            }
        }
    });
    
    return form;
}

// ============================================
// EXAMPLE 4: Complete CRUD Interface Migration
// ============================================

// OLD WAY (multiple scattered functions)
class OldCrudInterface {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.data = [];
        this.init();
    }
    
    init() {
        this.container.innerHTML = `
            <button onclick="crud.showAddModal()">Add Item</button>
            <table id="crud-table">
                <thead>
                    <tr><th>ID</th><th>Name</th><th>Actions</th></tr>
                </thead>
                <tbody id="crud-tbody"></tbody>
            </table>
        `;
        this.loadData();
    }
    
    async loadData() {
        const response = await fetch('/api/items');
        this.data = await response.json();
        this.renderTable();
    }
    
    renderTable() {
        const tbody = document.getElementById('crud-tbody');
        tbody.innerHTML = this.data.map(item => `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>
                    <button onclick="crud.edit(${item.id})">Edit</button>
                    <button onclick="crud.delete(${item.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    }
    
    showAddModal() {
        // Complex modal creation code...
    }
    
    edit(id) {
        // Complex edit logic...
    }
    
    async delete(id) {
        if (confirm('Are you sure?')) {
            await fetch(`/api/items/${id}`, { method: 'DELETE' });
            this.loadData();
        }
    }
}

// NEW WAY (using components)
class NewCrudInterface {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.init();
    }
    
    init() {
        // Create container structure
        this.container.innerHTML = `
            <div class="mb-4">
                <button id="add-btn" class="px-4 py-2 bg-primary text-white rounded">
                    Add Item
                </button>
            </div>
            <div id="table-container"></div>
        `;
        
        // Initialize table
        this.table = new DataTable({
            container: '#table-container',
            url: '/api/items',
            columns: [
                { field: 'id', label: 'ID', sortable: true },
                { field: 'name', label: 'Name', sortable: true },
                {
                    field: 'actions',
                    label: 'Actions',
                    render: () => `
                        <button class="text-primary" data-action="edit">Edit</button>
                        <button class="text-red-600 ml-2" data-action="delete">Delete</button>
                    `
                }
            ],
            onAction: (action, row) => this.handleAction(action, row)
        });
        
        // Add button handler
        document.getElementById('add-btn').addEventListener('click', () => {
            this.showAddModal();
        });
    }
    
    async handleAction(action, row) {
        switch (action) {
            case 'edit':
                this.showEditModal(row);
                break;
                
            case 'delete':
                if (await components.confirm({
                    title: 'Delete Item',
                    message: `Are you sure you want to delete "${row.name}"?`,
                    confirmText: 'Delete',
                    cancelText: 'Cancel'
                })) {
                    await fetch(`/api/items/${row.id}`, { method: 'DELETE' });
                    this.table.refresh();
                }
                break;
        }
    }
    
    showAddModal() {
        const modal = new Modal({
            title: 'Add New Item',
            content: '<div id="add-form"></div>'
        });
        
        modal.show();
        
        // Initialize form inside modal
        const form = new Form({
            container: '#add-form',
            fields: [
                { name: 'name', label: 'Name', required: true }
            ],
            onSubmit: async (data) => {
                await fetch('/api/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                modal.close();
                this.table.refresh();
            }
        });
    }
    
    showEditModal(item) {
        const modal = new Modal({
            title: 'Edit Item',
            content: '<div id="edit-form"></div>'
        });
        
        modal.show();
        
        // Initialize form with existing data
        const form = new Form({
            container: '#edit-form',
            fields: [
                { name: 'name', label: 'Name', required: true }
            ],
            values: item,
            onSubmit: async (data) => {
                await fetch(`/api/items/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                modal.close();
                this.table.refresh();
            }
        });
    }
}

// ============================================
// USAGE EXAMPLES
// ============================================

// Example 1: Simple modal
const infoModal = showModalNew('Information', '<p>This is an info modal using the new component system.</p>');

// Example 2: Data table with server-side data
const usersTable = new DataTable({
    container: '#users-table',
    url: '/api/users',
    searchable: true,
    exportable: true
});

// Example 3: Contact form
const contactForm = setupFormNew('#contact-form-container');

// Example 4: Complete CRUD interface
const crudInterface = new NewCrudInterface('crud-container');

// Export for use in other files
export {
    showModalNew,
    renderTableNew,
    setupFormNew,
    NewCrudInterface
};