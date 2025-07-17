/**
 * Example: Refactoring the Deliveries Table to Remove Inline Handlers
 * This shows the before and after for the loadDeliveries function
 */

// BEFORE: With inline onclick handlers
function loadDeliveries_OLD(page = 1) {
    const columns = [
        {
            class: 'px-6 py-4 whitespace-nowrap text-sm',
            render: d => {
                const buttons = [
                    { 
                        icon: 'fas fa-eye', 
                        title: '檢視', 
                        class: 'text-blue-600 hover:text-blue-900 mr-2', 
                        onclick: `viewDelivery(${d.id})` 
                    }
                ];
                
                if (d.status === 'pending') {
                    buttons.push({ 
                        icon: 'fas fa-user-plus', 
                        title: '指派司機', 
                        class: 'text-green-600 hover:text-green-900 mr-2', 
                        onclick: `assignDriver(${d.id})` 
                    });
                }
                
                if (d.status !== 'completed' && d.status !== 'cancelled') {
                    buttons.push({
                        icon: 'fas fa-sync',
                        title: '更新狀態',
                        class: 'text-purple-600 hover:text-purple-900',
                        onclick: `updateDeliveryStatus(${d.id}, '${d.status}')`
                    });
                }
                
                return table.actionButtons(buttons);
            }
        }
    ];
    
    // Table rows with inline onclick
    const tableHtml = `
        ${data.items.map(delivery => `
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="viewDelivery(${delivery.id})">
                <td>${delivery.order_number}</td>
            </tr>
        `).join('')}
    `;
}

// AFTER: Using event delegation with data attributes
function loadDeliveries_NEW(page = 1) {
    const columns = [
        {
            class: 'px-6 py-4 whitespace-nowrap text-sm',
            render: d => {
                const buttons = [
                    { 
                        icon: 'fas fa-eye', 
                        title: '檢視', 
                        class: 'text-blue-600 hover:text-blue-900 mr-2', 
                        action: 'view-delivery',
                        data: { 'delivery-id': d.id }
                    }
                ];
                
                if (d.status === 'pending') {
                    buttons.push({ 
                        icon: 'fas fa-user-plus', 
                        title: '指派司機', 
                        class: 'text-green-600 hover:text-green-900 mr-2', 
                        action: 'assign-driver',
                        data: { 'delivery-id': d.id }
                    });
                }
                
                if (d.status !== 'completed' && d.status !== 'cancelled') {
                    buttons.push({
                        icon: 'fas fa-sync',
                        title: '更新狀態',
                        class: 'text-purple-600 hover:text-purple-900',
                        action: 'update-delivery-status',
                        data: { 
                            'delivery-id': d.id,
                            'current-status': d.status
                        }
                    });
                }
                
                return tableEnhanced.actionButtons(buttons);
            }
        }
    ];
    
    // Table rows with data attributes
    const tableHtml = `
        ${data.items.map(delivery => `
            <tr class="hover:bg-gray-50 cursor-pointer" data-delivery-id="${delivery.id}">
                <td>${delivery.order_number}</td>
            </tr>
        `).join('')}
    `;
}

// Pagination example - BEFORE
function renderPagination_OLD(currentPage, totalPages, section) {
    return `
        <button onclick="loadDeliveries(${currentPage - 1})">Previous</button>
        <button onclick="loadDeliveries(${currentPage + 1})">Next</button>
    `;
}

// Pagination example - AFTER
function renderPagination_NEW(currentPage, totalPages, section) {
    return `
        <button data-pagination data-section="deliveries" data-page="${currentPage - 1}">Previous</button>
        <button data-pagination data-section="deliveries" data-page="${currentPage + 1}">Next</button>
    `;
}

// Modal example - BEFORE
function showDeliveryModal_OLD(delivery) {
    return html.modal('delivery-modal', 'Delivery Details', `
        <div>${delivery.details}</div>
        <button onclick="closeModal('delivery-modal')">Close</button>
    `);
}

// Modal example - AFTER
function showDeliveryModal_NEW(delivery) {
    return htmlEnhanced.modal('delivery-modal', 'Delivery Details', `
        <div>${delivery.details}</div>
        ${htmlEnhanced.button('Close', 'close-modal', { 'modal-id': 'delivery-modal' })}
    `);
}

// Complete conversion guide for common patterns
const conversionPatterns = {
    // View actions
    "onclick=\"viewDelivery(123)\"": 'data-action="view-delivery" data-delivery-id="123"',
    "onclick=\"viewRoute(456)\"": 'data-action="view-route" data-route-id="456"',
    
    // Edit actions
    "onclick=\"editDriver(789)\"": 'data-action="edit-driver" data-driver-id="789"',
    "onclick=\"editVehicle(101)\"": 'data-action="edit-vehicle" data-vehicle-id="101"',
    
    // Status updates
    "onclick=\"updateDeliveryStatus(123, 'pending')\"": 'data-action="update-delivery-status" data-delivery-id="123" data-current-status="pending"',
    
    // Pagination
    "onclick=\"loadDeliveries(2)\"": 'data-pagination data-section="deliveries" data-page="2"',
    "onclick=\"loadRoutes(3)\"": 'data-pagination data-section="routes" data-page="3"',
    
    // Modal operations
    "onclick=\"closeModal('modal-id')\"": 'data-action="close-modal" data-modal-id="modal-id"',
    "onclick=\"closeModal(this.closest('.fixed'))\"": 'data-modal-close',
    
    // Tab switching
    "onclick=\"switchClientTab('info')\"": 'data-client-tab="info"',
    "onclick=\"switchClientTab('deliveries')\"": 'data-client-tab="deliveries"'
};