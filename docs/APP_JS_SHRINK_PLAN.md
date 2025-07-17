# app.js Code Shrinking Plan

**Date**: July 17, 2025  
**Current Size**: ~4,700 lines  
**Target Size**: ~1,500-2,000 lines (68% reduction)  
**Approach**: Extract utilities while maintaining single-file simplicity

## Executive Summary

Analysis reveals **2,380-3,190 lines** of reducible code through pattern consolidation:

| Area | Potential Savings | Reduction |
|------|------------------|-----------|
| API Patterns | 490-500 lines | 10% |
| Table Rendering | 400-600 lines | 12% |
| Error Handling | 800-1,200 lines | 25% |
| HTML Templates | 600-800 lines | 17% |
| Validation | 90 lines | 2% |
| **Total** | **2,380-3,190 lines** | **50-68%** |

## Implementation Strategy

### Phase 1: Create Utility Module (At Top of app.js)

```javascript
// ============================================
// UTILITY FUNCTIONS - Reducing 3,000+ lines
// ============================================

// 1. API Utility (Saves ~500 lines)
const api = {
    async request(endpoint, options = {}) {
        const {
            method = 'GET',
            body = null,
            headers = {},
            skipNotification = false,
            successMessage = null,
            errorMessage = null
        } = options;

        try {
            const config = {
                method,
                headers: { 'Content-Type': 'application/json', ...headers }
            };

            if (body && method !== 'GET') {
                config.body = JSON.stringify(body);
            }

            const response = await secureFetch(`${API_BASE}${endpoint}`, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (successMessage && !skipNotification) {
                showNotification(successMessage, 'success');
            }
            
            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            if (!skipNotification) {
                showNotification(errorMessage || '操作失敗', 'error');
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

// 2. Table Utility (Saves ~600 lines)
const table = {
    render(tbodyId, data, columns, emptyMessage = '沒有找到資料') {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        
        // Clear existing
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${columns.length}" class="px-6 py-4 text-center text-gray-500">
                        ${emptyMessage}
                    </td>
                </tr>
            `;
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
                    cell.innerHTML = col.render(item);
                } else if (col.field) {
                    cell.textContent = this.getValue(item, col.field);
                }
            });
        });
    },
    
    getValue(obj, path) {
        return path.split('.').reduce((acc, part) => acc?.[part], obj) || '-';
    },
    
    statusBadge(status, config) {
        const info = config[status] || { text: status, class: 'bg-gray-100' };
        return `<span class="px-2 py-1 text-xs rounded-full ${info.class}">${info.text}</span>`;
    }
};

// 3. HTML Template Utility (Saves ~800 lines)
const html = {
    escape(text) {
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    },
    
    button(text, className = '', onclick = '') {
        return `<button class="${className}" ${onclick ? `onclick="${onclick}"` : ''}>${text}</button>`;
    },
    
    iconButton(icon, title, className = '', onclick = '') {
        return `<button class="${className}" title="${title}" ${onclick ? `onclick="${onclick}"` : ''}>
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
                        <button onclick="closeModal('${id}')" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="p-6">${content}</div>
                </div>
            </div>
        `;
    },
    
    formGroup(label, input, error = '') {
        return `
            <div class="mb-4">
                <label class="block text-sm font-medium mb-1">${label}</label>
                ${input}
                ${error ? `<p class="text-red-500 text-xs mt-1">${error}</p>` : ''}
            </div>
        `;
    }
};

// 4. Validation Rules (Saves ~90 lines)
const validationRules = {
    client: {
        name: { required: true, type: 'name', options: { minLength: 2, maxLength: 50 } },
        phone: { required: true, type: 'phone' },
        address: { required: true, type: 'address' },
        tax_id: { required: false, type: 'taiwanTaxId' }
    },
    
    driver: {
        name: { required: true, type: 'name', options: { minLength: 2, maxLength: 50 } },
        phone: { required: true, type: 'phone' },
        id_number: { required: true, type: 'custom', validator: validateTaiwanId },
        license_number: { required: true, type: 'custom', validator: validateLicense }
    },
    
    delivery: {
        client_code: { required: true, type: 'custom', validator: (v) => v ? {isValid: true} : {isValid: false, message: '請選擇客戶'} },
        delivery_date: { required: true, type: 'date' },
        quantity: { required: true, type: 'positiveInteger' }
    }
};

// Custom validators
function validateTaiwanId(value) {
    // Taiwan ID validation logic (already implemented)
    // ... (25 lines of validation code)
}

function validateLicense(value) {
    if (!value || value.trim() === '') {
        return { isValid: false, message: '駕照號碼不能為空' };
    }
    if (value.length < 5 || value.length > 20) {
        return { isValid: false, message: '駕照號碼長度無效' };
    }
    return { isValid: true, message: '' };
}
```

### Phase 2: Refactor Existing Code

#### Before (Typical Pattern):
```javascript
// Loading clients (15 lines)
async function loadClients(page = 1) {
    try {
        const params = new URLSearchParams({...});
        const response = await fetch(`${API_BASE}/clients?${params}`);
        const data = await response.json();
        
        allClients = data.clients || [];
        currentClientPage = data.page || 1;
        
        renderClientsTable(allClients);
        renderClientsPagination(data.total_pages || 1);
    } catch (error) {
        console.error('Error loading clients:', error);
        showNotification('載入客戶資料失敗', 'error');
    }
}

// Rendering table (30+ lines)
function renderClientsTable(clients) {
    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';
    
    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">沒有找到客戶資料</td></tr>';
        return;
    }
    
    clients.forEach(client => {
        const row = tbody.insertRow();
        // ... many lines of cell creation
    });
}
```

#### After (Consolidated):
```javascript
// Loading clients (5 lines)
async function loadClients(page = 1) {
    const params = new URLSearchParams({...});
    const data = await api.get(`/clients?${params}`, { errorMessage: '載入客戶資料失敗' });
    
    allClients = data.clients || [];
    currentClientPage = data.page || 1;
    
    renderClientsTable(allClients);
    renderClientsPagination(data.total_pages || 1);
}

// Rendering table (10 lines)
function renderClientsTable(clients) {
    table.render('clients-tbody', clients, [
        {
            field: 'name',
            render: (c) => `<div class="font-medium">${c.name}</div>
                           <div class="text-sm text-gray-600">${c.invoice_title || '-'}</div>`
        },
        { field: 'address' },
        { field: 'phone' },
        { 
            field: 'is_active',
            render: (c) => table.statusBadge(c.is_active ? 'active' : 'inactive', STATUS_CONFIG)
        },
        {
            render: (c) => `
                ${html.iconButton('fas fa-eye', '檢視', 'text-blue-600 hover:text-blue-900 mr-2', `viewClient('${c.client_code}')`)}
                ${html.iconButton('fas fa-edit', '編輯', 'text-green-600 hover:text-green-900', `editClient('${c.client_code}')`)}
            `
        }
    ], '沒有找到客戶資料');
}
```

### Phase 3: Progressive Refactoring

1. **Week 1**: Implement utilities at top of file
2. **Week 2**: Refactor API calls (fastest wins)
3. **Week 3**: Consolidate table rendering
4. **Week 4**: Standardize error handling
5. **Week 5**: Template consolidation
6. **Week 6**: Final cleanup and testing

## Expected Results

### Before vs After Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines of Code | 4,700 | 1,500-2,000 | 68% reduction |
| API Call Patterns | 70+ unique | 1 utility | 98% consolidation |
| Table Renders | 10+ unique | 1 utility | 90% consolidation |
| Try-Catch Blocks | 56 | ~10 | 82% reduction |
| innerHTML Patterns | 38 | ~5 templates | 87% consolidation |

### Code Quality Improvements

1. **Consistency**: Single pattern for each operation type
2. **Maintainability**: Changes in one place affect all uses
3. **Security**: Centralized XSS prevention
4. **Readability**: Business logic clear, not buried in boilerplate
5. **Testability**: Utilities can be unit tested
6. **Performance**: Potential for optimization in utilities

## Risk Mitigation

1. **Incremental Changes**: Refactor section by section
2. **Testing**: Test each change thoroughly
3. **Rollback Plan**: Git commits after each phase
4. **Compatibility**: Keep same function signatures
5. **Documentation**: Comment utility functions well

## Conclusion

This plan can reduce app.js from 4,700 to under 2,000 lines while:
- Improving code quality
- Maintaining all functionality
- Staying in single file (per apparent preference)
- Making future changes easier
- Reducing bugs through consistency

The key is creating powerful, reusable utilities that handle the repetitive patterns, allowing the business logic to shine through clearly.