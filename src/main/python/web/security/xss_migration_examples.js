/**
 * XSS Migration Examples
 * 
 * This file contains before/after code examples showing how to migrate
 * from vulnerable innerHTML usage to secure DOM manipulation using SecurityUtils
 */

// ============================================================================
// EXAMPLE 1: Client Table Rendering (High Priority)
// ============================================================================

// BEFORE (Vulnerable) - Lines 572-599
function renderClientsTable_VULNERABLE(clients) {
    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';
    
    clients.forEach(client => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <div class="text-gray-900">${client.client_code || client.id}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${client.name}</div>
                <div class="text-sm text-gray-500">${client.phone || '-'}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                <div>${client.address || '-'}</div>
                <div class="text-xs text-gray-400">${client.district || ''} ${client.area || ''}</div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// AFTER (Secure)
function renderClientsTable_SECURE(clients) {
    const tbody = document.getElementById('clients-tbody');
    SecurityUtils.renderTemplate(tbody, []); // Clear safely
    
    clients.forEach(client => {
        const row = SecurityUtils.createTableRow([
            {
                className: 'px-6 py-4 whitespace-nowrap text-sm',
                content: SecurityUtils.createElement('div', 
                    { className: 'text-gray-900' }, 
                    [SecurityUtils.escapeHtml(client.client_code || client.id)]
                )
            },
            {
                className: 'px-6 py-4 whitespace-nowrap',
                content: [
                    SecurityUtils.createElement('div', 
                        { className: 'text-sm font-medium text-gray-900' }, 
                        [SecurityUtils.escapeHtml(client.name)]
                    ),
                    SecurityUtils.createElement('div', 
                        { className: 'text-sm text-gray-500' }, 
                        [SecurityUtils.escapeHtml(client.phone || '-')]
                    )
                ]
            },
            {
                className: 'px-6 py-4 text-sm text-gray-500',
                content: [
                    SecurityUtils.createElement('div', {}, 
                        [SecurityUtils.escapeHtml(client.address || '-')]
                    ),
                    SecurityUtils.createElement('div', 
                        { className: 'text-xs text-gray-400' }, 
                        [SecurityUtils.escapeHtml(`${client.district || ''} ${client.area || ''}`)]
                    )
                ]
            }
        ], 'hover:bg-gray-50 transition-colors');
        
        tbody.appendChild(row);
    });
}

// ============================================================================
// EXAMPLE 2: Dropdown Population (Medium Priority)
// ============================================================================

// BEFORE (Vulnerable) - Lines 238-251
function updateStatusFilter_VULNERABLE(tab) {
    const statusFilter = document.getElementById('delivery-status');
    if (statusFilter) {
        statusFilter.innerHTML = '<option value="">所有狀態</option>';
        
        if (tab === 'planned') {
            statusFilter.innerHTML += `
                <option value="pending">待處理</option>
                <option value="assigned">已指派</option>
                <option value="in_progress">進行中</option>
            `;
        } else {
            statusFilter.innerHTML += `
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
            `;
        }
    }
}

// AFTER (Secure)
function updateStatusFilter_SECURE(tab) {
    const statusFilter = document.getElementById('delivery-status');
    if (!statusFilter) return;
    
    const options = [{ value: '', text: '所有狀態' }];
    
    if (tab === 'planned') {
        options.push(
            { value: 'pending', text: '待處理' },
            { value: 'assigned', text: '已指派' },
            { value: 'in_progress', text: '進行中' }
        );
    } else {
        options.push(
            { value: 'completed', text: '已完成' },
            { value: 'cancelled', text: '已取消' }
        );
    }
    
    SecurityUtils.populateSelect(statusFilter, options);
}

// ============================================================================
// EXAMPLE 3: Modal Creation (High Priority)
// ============================================================================

// BEFORE (Vulnerable) - Lines 1699-1726
function showEditClientModal_VULNERABLE(client = null) {
    const isEdit = !!client;
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div class="px-6 py-4 border-b">
                <h3 class="text-lg font-semibold">${isEdit ? '編輯客戶' : '新增客戶'}</h3>
                <button onclick="this.closest('.fixed').remove()" class="absolute top-4 right-4">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form id="client-form" class="p-6">
                <input type="text" name="name" value="${client?.name || ''}" required>
                <input type="text" name="phone" value="${client?.phone || ''}">
                <textarea name="address">${client?.address || ''}</textarea>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

// AFTER (Secure)
function showEditClientModal_SECURE(client = null) {
    const isEdit = !!client;
    const modal = SecurityUtils.createElement('div', {
        className: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'
    });
    
    const modalContent = SecurityUtils.createElement('div', {
        className: 'bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4'
    });
    
    // Header
    const header = SecurityUtils.createElement('div', {
        className: 'px-6 py-4 border-b flex justify-between items-center'
    });
    
    const title = SecurityUtils.createElement('h3', {
        className: 'text-lg font-semibold'
    }, [isEdit ? '編輯客戶' : '新增客戶']);
    
    const closeBtn = SecurityUtils.createElement('button', {
        onclick: function() { modal.remove(); }
    }, [SecurityUtils.createElement('i', { className: 'fas fa-times' })]);
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Form
    const form = SecurityUtils.createElement('form', {
        id: 'client-form',
        className: 'p-6'
    });
    
    // Name input
    const nameInput = SecurityUtils.createElement('input', {
        type: 'text',
        name: 'name',
        value: client?.name || '',
        required: true,
        className: 'w-full p-2 border rounded mb-4'
    });
    
    // Phone input
    const phoneInput = SecurityUtils.createElement('input', {
        type: 'text',
        name: 'phone',
        value: client?.phone || '',
        className: 'w-full p-2 border rounded mb-4'
    });
    
    // Address textarea
    const addressTextarea = SecurityUtils.createElement('textarea', {
        name: 'address',
        className: 'w-full p-2 border rounded mb-4'
    }, [SecurityUtils.escapeHtml(client?.address || '')]);
    
    form.appendChild(nameInput);
    form.appendChild(phoneInput);
    form.appendChild(addressTextarea);
    
    modalContent.appendChild(header);
    modalContent.appendChild(form);
    modal.appendChild(modalContent);
    
    document.body.appendChild(modal);
}

// ============================================================================
// EXAMPLE 4: Notification Display (Low Priority)
// ============================================================================

// BEFORE (Vulnerable) - Lines 1063-1066
function showNotification_VULNERABLE(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white bg-${type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue'}-600`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
            ${message}
        </div>
    `;
    document.body.appendChild(notification);
}

// AFTER (Secure)
function showNotification_SECURE(message, type = 'info') {
    const iconType = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 
                    'info-circle';
    
    const notification = SecurityUtils.createNotification(message, type, iconType);
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => notification.remove(), 3000);
}

// ============================================================================
// EXAMPLE 5: Empty State Messages (Low Priority)
// ============================================================================

// BEFORE (Vulnerable) - Lines 724-727
function renderEmptyDeliveries_VULNERABLE() {
    const tbody = document.getElementById('deliveries-tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="px-6 py-4 text-center text-gray-500">
                暫無配送記錄
            </td>
        </tr>
    `;
}

// AFTER (Secure)
function renderEmptyDeliveries_SECURE() {
    const tbody = document.getElementById('deliveries-tbody');
    SecurityUtils.renderTemplate(tbody, []); // Clear safely
    
    const emptyRow = SecurityUtils.createTableRow([
        {
            colspan: 8,
            className: 'px-6 py-4 text-center text-gray-500',
            text: '暫無配送記錄'
        }
    ]);
    
    tbody.appendChild(emptyRow);
}

// ============================================================================
// EXAMPLE 6: Complex Data Display (High Priority)
// ============================================================================

// BEFORE (Vulnerable) - Lines 1256-1340
function renderClientDeliveries_VULNERABLE(container, data) {
    container.innerHTML = `
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-lg shadow">
                <p class="text-sm text-gray-600">總配送次數</p>
                <p class="text-2xl font-semibold">${data.total}</p>
            </div>
            <div class="bg-white p-4 rounded-lg shadow">
                <p class="text-sm text-gray-600">已完成</p>
                <p class="text-2xl font-semibold text-green-600">${data.completed}</p>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                ${data.items.map(item => `
                    <tr>
                        <td>${item.order_number}</td>
                        <td>${item.client_name}</td>
                        <td>${item.address}</td>
                    </tr>
                `).join('')}
            </table>
        </div>
    `;
}

// AFTER (Secure)
function renderClientDeliveries_SECURE(container, data) {
    // Clear container safely
    SecurityUtils.renderTemplate(container, []);
    
    // Create statistics grid
    const statsGrid = SecurityUtils.createElement('div', {
        className: 'grid grid-cols-4 gap-4 mb-6'
    });
    
    // Total deliveries card
    const totalCard = SecurityUtils.createElement('div', {
        className: 'bg-white p-4 rounded-lg shadow'
    }, [
        SecurityUtils.createElement('p', {
            className: 'text-sm text-gray-600'
        }, ['總配送次數']),
        SecurityUtils.createElement('p', {
            className: 'text-2xl font-semibold'
        }, [SecurityUtils.escapeHtml(data.total)])
    ]);
    
    // Completed deliveries card
    const completedCard = SecurityUtils.createElement('div', {
        className: 'bg-white p-4 rounded-lg shadow'
    }, [
        SecurityUtils.createElement('p', {
            className: 'text-sm text-gray-600'
        }, ['已完成']),
        SecurityUtils.createElement('p', {
            className: 'text-2xl font-semibold text-green-600'
        }, [SecurityUtils.escapeHtml(data.completed)])
    ]);
    
    statsGrid.appendChild(totalCard);
    statsGrid.appendChild(completedCard);
    
    // Create table
    const tableContainer = SecurityUtils.createElement('div', {
        className: 'bg-white rounded-lg shadow overflow-hidden'
    });
    
    const table = SecurityUtils.createElement('table', {
        className: 'min-w-full divide-y divide-gray-200'
    });
    
    const tbody = SecurityUtils.createElement('tbody');
    
    // Add rows
    data.items.forEach(item => {
        const row = SecurityUtils.createTableRow([
            SecurityUtils.escapeHtml(item.order_number),
            SecurityUtils.escapeHtml(item.client_name),
            SecurityUtils.escapeHtml(item.address)
        ]);
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    
    container.appendChild(statsGrid);
    container.appendChild(tableContainer);
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Test the security utilities with XSS payloads
 */
function testXSSPrevention() {
    const xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '\'><script>alert(String.fromCharCode(88,83,83))</script>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<input type="text" value="<script>alert(\'XSS\')</script>">',
    ];
    
    console.log('Testing XSS Prevention...');
    
    xssPayloads.forEach((payload, index) => {
        const escaped = SecurityUtils.escapeHtml(payload);
        const element = SecurityUtils.createElement('div', {}, [payload]);
        
        console.log(`Test ${index + 1}:`);
        console.log('  Original:', payload);
        console.log('  Escaped:', escaped);
        console.log('  Element text:', element.textContent);
        console.log('  Safe:', !element.innerHTML.includes('<script'));
    });
}

// Export examples for reference
const XSSMigrationExamples = {
    renderClientsTable_VULNERABLE,
    renderClientsTable_SECURE,
    updateStatusFilter_VULNERABLE,
    updateStatusFilter_SECURE,
    showEditClientModal_VULNERABLE,
    showEditClientModal_SECURE,
    showNotification_VULNERABLE,
    showNotification_SECURE,
    renderEmptyDeliveries_VULNERABLE,
    renderEmptyDeliveries_SECURE,
    renderClientDeliveries_VULNERABLE,
    renderClientDeliveries_SECURE,
    testXSSPrevention
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = XSSMigrationExamples;
}