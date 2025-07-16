# Component Module Migration Guide

This guide shows how to migrate from inline component code in app.js to the new modular component system.

## Benefits of Migration

1. **Reusability**: Components can be used across different parts of the application
2. **Maintainability**: Centralized component logic makes updates easier
3. **Consistency**: Ensures UI consistency across the application
4. **Testing**: Components can be tested independently
5. **Performance**: Reduced code duplication and better caching

## Migration Examples

### 1. Modal Migration

#### Before (Inline in app.js):
```javascript
// Old modal function
function showModal(title, content, actions = '') {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">${title}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                    <span class="text-2xl">&times;</span>
                </button>
            </div>
            <div>${content}</div>
            ${actions ? `<div class="mt-6 flex justify-end space-x-3">${actions}</div>` : ''}
        </div>
    `;
    document.body.appendChild(modal);
}

// Usage
showModal('Add Client', formHtml, buttonsHtml);
```

#### After (Using Modal component):
```javascript
import { Modal } from './modules/components/Modal.js';

// Create modal instance
const modal = new Modal({
    title: 'Add Client',
    content: formHtml,
    actions: buttonsHtml,
    onSubmit: async (data) => {
        // Handle form submission
        await saveClient(data);
        modal.close();
    }
});

// Show modal
modal.show();
```

### 2. Table Migration

#### Before (Inline rendering):
```javascript
function renderClientsTable(clients) {
    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';
    
    clients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-3">${client.code}</td>
            <td class="px-4 py-3">${client.name}</td>
            <td class="px-4 py-3">${client.phone}</td>
            <td class="px-4 py-3">${client.email || '-'}</td>
            <td class="px-4 py-3">
                <button onclick="editClient(${client.id})">Edit</button>
                <button onclick="deleteClient(${client.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}
```

#### After (Using DataTable component):
```javascript
import { DataTable } from './modules/components/DataTable.js';

// Create table instance
const clientsTable = new DataTable({
    container: '#clients-table-container',
    url: '/api/clients',
    columns: [
        { field: 'code', label: 'Code', sortable: true },
        { field: 'name', label: 'Name', sortable: true },
        { field: 'phone', label: 'Phone' },
        { field: 'email', label: 'Email' },
        {
            field: 'actions',
            label: 'Actions',
            render: (value, row) => `
                <button data-action="edit">Edit</button>
                <button data-action="delete">Delete</button>
            `
        }
    ],
    onAction: async (action, row) => {
        if (action === 'edit') {
            await editClient(row.id);
        } else if (action === 'delete') {
            await deleteClient(row.id);
        }
    }
});
```

### 3. Form Migration

#### Before (Manual form handling):
```javascript
const form = document.getElementById('add-client-form');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Manual validation
    const name = form.name.value;
    if (!name) {
        alert('Name is required');
        return;
    }
    
    // Collect data manually
    const data = {
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value
    };
    
    // Submit
    try {
        await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        alert('Client added successfully');
        form.reset();
    } catch (error) {
        alert('Error: ' + error.message);
    }
});
```

#### After (Using Form component):
```javascript
import { Form } from './modules/components/Form.js';

const clientForm = new Form({
    container: '#client-form-container',
    fields: [
        { name: 'name', label: 'Name', required: true },
        { name: 'email', label: 'Email', type: 'email', validation: { email: true } },
        { name: 'phone', label: 'Phone', validation: { phone: true } }
    ],
    onSubmit: async (data) => {
        const response = await apiClient.post('/api/clients', data);
        components.alert({
            title: 'Success',
            message: 'Client added successfully'
        });
        clientForm.reset();
    }
});
```

### 4. Complete Client Management Migration

#### Before (Multiple inline functions):
```javascript
// Scattered across app.js
function showAddClientModal() { /* ... */ }
function renderClientsTable(clients) { /* ... */ }
function handleClientFormSubmit(e) { /* ... */ }
function editClient(id) { /* ... */ }
function deleteClient(id) { /* ... */ }
function viewClientDetails(id) { /* ... */ }
```

#### After (Using ClientComponents):
```javascript
import { ClientTable, ClientModal, ClientDetailModal } from './modules/components/ClientComponents.js';

// Initialize clients table
const clientsTable = new ClientTable({
    container: '#clients-container',
    onAction: async (action, row) => {
        switch (action) {
            case 'view':
                const detailModal = new ClientDetailModal({ clientId: row.id });
                detailModal.show();
                break;
                
            case 'edit':
                const editModal = new ClientModal({
                    mode: 'edit',
                    clientData: row,
                    onSuccess: () => clientsTable.refresh()
                });
                editModal.show();
                break;
                
            case 'delete':
                if (await components.confirm({
                    title: 'Delete Client',
                    message: `Are you sure you want to delete ${row.name}?`
                })) {
                    await apiClient.delete(`/api/clients/${row.id}`);
                    clientsTable.refresh();
                }
                break;
        }
    }
});

// Add new client button
document.getElementById('add-client-btn').addEventListener('click', () => {
    const modal = new ClientModal({
        mode: 'add',
        onSuccess: () => clientsTable.refresh()
    });
    modal.show();
});
```

## Step-by-Step Migration Process

### Phase 1: Setup
1. Import the component modules at the top of app.js
2. Keep existing code running while migrating piece by piece

```javascript
// Add to top of app.js
import { Modal, DataTable, Form, components } from './modules/components/index.js';
import { ClientTable, ClientModal } from './modules/components/ClientComponents.js';
```

### Phase 2: Migrate Modals
1. Replace `showModal()` calls with `new Modal()`
2. Update event handlers to use modal methods
3. Test each modal conversion

### Phase 3: Migrate Tables
1. Replace table rendering functions with DataTable instances
2. Update pagination and filtering to use DataTable features
3. Convert action handlers to use the `onAction` callback

### Phase 4: Migrate Forms
1. Replace form event listeners with Form components
2. Move validation logic to field configurations
3. Update submission handlers

### Phase 5: Cleanup
1. Remove old inline functions
2. Delete unused HTML templates
3. Update any remaining references

## Common Patterns

### Loading States
```javascript
// Before
document.getElementById('loading').style.display = 'block';
loadData();
document.getElementById('loading').style.display = 'none';

// After
const table = new DataTable({ /* ... */ });
table.showLoading();
await table.loadData();
table.hideLoading();
```

### Error Handling
```javascript
// Before
try {
    // operation
} catch (error) {
    alert('Error: ' + error.message);
}

// After
try {
    // operation
} catch (error) {
    components.alert({
        title: 'Error',
        message: error.message
    });
}
```

### Confirmations
```javascript
// Before
if (confirm('Are you sure?')) {
    // proceed
}

// After
if (await components.confirm({
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?'
})) {
    // proceed
}
```

## Best Practices

1. **Incremental Migration**: Migrate one component at a time
2. **Test Thoroughly**: Test each migrated component before moving to the next
3. **Maintain Compatibility**: Keep the UI and UX consistent during migration
4. **Document Changes**: Update documentation as you migrate
5. **Leverage TypeScript**: Consider adding TypeScript definitions for better IDE support

## Troubleshooting

### Common Issues

1. **Event Handlers Not Working**
   - Ensure you're using the component's event callbacks
   - Check that data attributes are properly set

2. **Styling Issues**
   - The components include their own styles
   - You may need to adjust your CSS for compatibility

3. **Data Loading Problems**
   - Verify API endpoints match the component configuration
   - Check response format matches component expectations

4. **Memory Leaks**
   - Always call `destroy()` on components when removing them
   - Remove event listeners properly

## Next Steps

After migrating to the component system:

1. Create additional specialized components as needed
2. Add unit tests for components
3. Document component APIs
4. Consider creating a component library
5. Optimize bundle size with tree shaking