/**
 * Migration Example: Updating app.js to use modular utilities
 * 
 * This file shows before/after examples of migrating from inline utilities
 * to the new modular utility system.
 */

// ========================================
// IMPORT STATEMENTS
// ========================================

// OLD: SecurityUtils was global
// const SecurityUtils = window.SecurityUtils;

// NEW: Import what you need
import { 
    $, $$, createElement, showNotification, debounce,
    formatDate, formatDateTime, formatCurrency, formatPhone,
    sortBy, filterBySearch, paginate,
    escapeHtml, sanitizeInput
} from './modules/utils/index.js';

// Or import entire modules
import { dom, datetime, format, data, security } from './modules/utils/index.js';

// ========================================
// DOM MANIPULATION
// ========================================

// OLD: Direct DOM manipulation
function renderClientsTable(clients) {
    const tbody = document.getElementById('clients-tbody');
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
    // ...
}

// NEW: Using DOM utilities
function renderClientsTable(clients) {
    const tbody = $('#clients-tbody');
    dom.clearChildren(tbody);
    // ...
}

// ========================================
// ELEMENT CREATION
// ========================================

// OLD: Verbose element creation
const cell = document.createElement('td');
cell.className = 'px-6 py-4 text-sm';
cell.textContent = client.address;
row.appendChild(cell);

// NEW: Concise element creation
const cell = createElement('td', 
    { className: 'px-6 py-4 text-sm' }, 
    [client.address]
);
row.appendChild(cell);

// ========================================
// DATE FORMATTING
// ========================================

// OLD: Inline date formatting
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW');
}

// NEW: Import and use directly
// Already imported at top: formatDate, formatDateTime

// ========================================
// NOTIFICATIONS
// ========================================

// OLD: Custom notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded shadow-lg text-white z-50 ${notificationClasses[type]}`;
    // ... more code
}

// NEW: Use the utility
showNotification('操作成功', 'success');
showNotification('發生錯誤', 'error');

// ========================================
// DEBOUNCING
// ========================================

// OLD: Inline debounce implementation
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// NEW: Import and use
const searchHandler = debounce((e) => {
    clientFilters.keyword = e.target.value;
    loadClients(1);
}, 500);

// ========================================
// DATA OPERATIONS
// ========================================

// OLD: Manual sorting
clients.sort((a, b) => {
    if (sortOrder === 'asc') {
        return a[sortBy] > b[sortBy] ? 1 : -1;
    } else {
        return a[sortBy] < b[sortBy] ? 1 : -1;
    }
});

// NEW: Using data utilities
const sortedClients = sortBy(clients, sortBy, sortOrder);

// ========================================
// FORMATTING
// ========================================

// OLD: Inline currency formatting
cell.textContent = `$${delivery.total_amount.toLocaleString()}`;

// NEW: Using format utilities
cell.textContent = formatCurrency(delivery.total_amount);

// ========================================
// STATUS FORMATTING
// ========================================

// OLD: Manual status formatting
const statusMap = {
    'pending': { text: '待處理', class: 'bg-yellow-100 text-yellow-800' },
    'completed': { text: '已完成', class: 'bg-green-100 text-green-800' }
};
const status = statusMap[delivery.status];

// NEW: Using format utilities
const status = formatStatus(delivery.status, 'delivery');

// ========================================
// MODAL CREATION
// ========================================

// OLD: Inline modal creation
function createModal(content) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `<div class="bg-white rounded-lg p-8">${content}</div>`;
    // ...
}

// NEW: Using modal utility
const modal = dom.createModal(content, {
    closeOnBackdrop: true,
    closeOnEscape: true
});
document.body.appendChild(modal);

// ========================================
// COMPLETE FUNCTION MIGRATION EXAMPLE
// ========================================

// OLD: Original renderDeliverySummary function
function renderDeliverySummaryOld(summary) {
    const container = document.getElementById('delivery-summary');
    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
                <p class="text-gray-600">總筆數</p>
                <p class="font-bold text-lg">${summary.total}</p>
            </div>
            <!-- more HTML -->
        </div>
    `;
}

// NEW: Using utilities for safer, cleaner code
function renderDeliverySummaryNew(summary) {
    const container = $('#delivery-summary');
    dom.clearChildren(container);
    
    const grid = createElement('div', { 
        className: 'grid grid-cols-2 md:grid-cols-5 gap-4' 
    });
    
    // Add total count
    grid.appendChild(createSummaryCard('總筆數', summary.total));
    
    // Add total amount
    grid.appendChild(createSummaryCard('總金額', formatCurrency(summary.totalAmount)));
    
    // Add total gas
    grid.appendChild(createSummaryCard('總瓦斯桶數', formatQuantity(summary.totalGas, '桶')));
    
    container.appendChild(grid);
}

function createSummaryCard(label, value) {
    return createElement('div', {}, [
        createElement('p', { className: 'text-gray-600' }, [label]),
        createElement('p', { className: 'font-bold text-lg' }, [String(value)])
    ]);
}

// ========================================
// BACKWARD COMPATIBILITY
// ========================================

// If you need to maintain backward compatibility temporarily:
window.SecurityUtils = security.SecurityUtils;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.debounce = debounce;

// ========================================
// BENEFITS OF MIGRATION
// ========================================

/*
1. Code Reduction: ~30-40% less code in app.js
2. Reusability: Utilities can be used across all modules
3. Maintainability: Single source of truth for each utility
4. Type Safety: Better IDE support with module imports
5. Testing: Utilities can be unit tested independently
6. Performance: Tree-shaking removes unused utilities
7. Security: Centralized XSS prevention
*/