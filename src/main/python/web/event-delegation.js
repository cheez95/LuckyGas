/**
 * Event Delegation System for LuckyGas
 * Removes inline event handlers for improved security and maintainability
 */

const EventDelegation = {
    /**
     * Initialize event delegation for the entire application
     */
    init() {
        // Delegate table row clicks for viewing deliveries
        this.delegateTableClicks();
        
        // Delegate button clicks with data attributes
        this.delegateButtonClicks();
        
        // Delegate pagination clicks
        this.delegatePaginationClicks();
        
        // Delegate modal close buttons
        this.delegateModalCloseButtons();
        
        // Delegate client tab switching
        this.delegateClientTabs();
        
        // Delegate route planning clicks
        this.delegateRoutePlanningClicks();
    },
    
    /**
     * Delegate table row clicks for viewing items
     */
    delegateTableClicks() {
        document.addEventListener('click', (e) => {
            // Handle delivery row clicks
            const deliveryRow = e.target.closest('tr[data-delivery-id]');
            if (deliveryRow && deliveryRow.dataset.deliveryId) {
                e.preventDefault();
                const deliveryId = parseInt(deliveryRow.dataset.deliveryId);
                if (window.viewDelivery) {
                    window.viewDelivery(deliveryId);
                }
            }
            
            // Handle client row clicks for route planning
            const clientRow = e.target.closest('div[data-client-select]');
            if (clientRow && clientRow.dataset.clientId) {
                e.preventDefault();
                const data = clientRow.dataset;
                if (window.addClientToRoute) {
                    window.addClientToRoute(
                        parseInt(data.clientId),
                        data.clientCode,
                        data.clientName,
                        data.clientAddress
                    );
                }
            }
        });
    },
    
    /**
     * Delegate button clicks using data attributes
     */
    delegateButtonClicks() {
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            e.preventDefault();
            const action = button.dataset.action;
            const data = button.dataset;
            
            switch (action) {
                case 'close-modal':
                    this.handleCloseModal(data.modalId);
                    break;
                    
                case 'view-route':
                    if (window.viewRoute) window.viewRoute(parseInt(data.routeId));
                    break;
                    
                case 'edit-route':
                    if (window.editRoute) window.editRoute(parseInt(data.routeId));
                    break;
                    
                case 'show-route-map':
                    if (window.showRouteMap) window.showRouteMap(parseInt(data.routeId));
                    break;
                    
                case 'assign-driver':
                    if (window.assignDriver) window.assignDriver(parseInt(data.deliveryId));
                    break;
                    
                case 'update-delivery-status':
                    if (window.updateDeliveryStatus) {
                        window.updateDeliveryStatus(parseInt(data.deliveryId), data.currentStatus);
                    }
                    break;
                    
                case 'edit-driver':
                    if (window.editDriver) window.editDriver(parseInt(data.driverId));
                    break;
                    
                case 'edit-vehicle':
                    if (window.editVehicle) window.editVehicle(parseInt(data.vehicleId));
                    break;
                    
                case 'remove-client-from-route':
                    if (window.removeClientFromRoute) {
                        window.removeClientFromRoute(parseInt(data.index));
                    }
                    break;
                    
                case 'view-schedule-details':
                    if (window.viewScheduleDetails) window.viewScheduleDetails(data.date);
                    break;
                    
                case 'apply-schedule':
                    if (window.applySchedule) window.applySchedule(data.date);
                    break;
            }
        });
    },
    
    /**
     * Delegate pagination button clicks
     */
    delegatePaginationClicks() {
        document.addEventListener('click', (e) => {
            const paginationBtn = e.target.closest('button[data-pagination]');
            if (!paginationBtn) return;
            
            e.preventDefault();
            const data = paginationBtn.dataset;
            const section = data.section;
            const page = parseInt(data.page);
            
            // Call appropriate loading function based on section
            switch (section) {
                case 'deliveries':
                    if (window.loadDeliveries) window.loadDeliveries(page);
                    break;
                    
                case 'routes':
                    if (window.loadRoutes) window.loadRoutes(page);
                    break;
                    
                case 'drivers':
                    if (window.loadDrivers) window.loadDrivers(page);
                    break;
                    
                case 'vehicles':
                    if (window.loadVehicles) window.loadVehicles(page);
                    break;
                    
                case 'clients':
                    if (window.loadClients) window.loadClients(page);
                    break;
                    
                case 'client-deliveries':
                    if (window.loadClientDeliveries && data.clientCode) {
                        window.loadClientDeliveries(data.clientCode, page);
                    }
                    break;
            }
        });
    },
    
    /**
     * Delegate modal close button clicks
     */
    delegateModalCloseButtons() {
        document.addEventListener('click', (e) => {
            // Handle close button in modal header
            if (e.target.closest('button[data-modal-close]')) {
                e.preventDefault();
                const modal = e.target.closest('.fixed[id]');
                if (modal) {
                    this.handleCloseModal(modal.id);
                }
            }
        });
    },
    
    /**
     * Delegate client tab switching
     */
    delegateClientTabs() {
        document.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('button[data-client-tab]');
            if (!tabBtn) return;
            
            e.preventDefault();
            const tab = tabBtn.dataset.clientTab;
            if (window.switchClientTab) {
                window.switchClientTab(tab);
            }
        });
    },
    
    /**
     * Delegate route planning related clicks
     */
    delegateRoutePlanningClicks() {
        document.addEventListener('click', (e) => {
            // Handle route planning buttons
            const routePlanBtn = e.target.closest('button[data-route-action]');
            if (routePlanBtn) {
                e.preventDefault();
                const action = routePlanBtn.dataset.routeAction;
                
                switch (action) {
                    case 'show-plan-modal':
                        if (window.showRoutePlanModal) window.showRoutePlanModal();
                        break;
                        
                    case 'add-route':
                        if (window.showAddRouteModal) window.showAddRouteModal();
                        break;
                }
            }
        });
    },
    
    /**
     * Handle closing modals
     */
    handleCloseModal(modalId) {
        if (window.closeModal) {
            if (modalId) {
                window.closeModal(modalId);
            } else {
                // Find the closest modal element
                const modal = event.target.closest('.fixed[id]');
                if (modal) {
                    window.closeModal(modal.id);
                }
            }
        }
    },
    
    /**
     * Utility function to create button HTML without inline handlers
     */
    createButton(text, action, data = {}, className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700') {
        const dataAttrs = Object.entries(data)
            .map(([key, value]) => `data-${key}="${SecurityUtils.escapeHtml(value)}"`)
            .join(' ');
            
        return `<button class="${className}" data-action="${action}" ${dataAttrs}>
            ${SecurityUtils.escapeHtml(text)}
        </button>`;
    },
    
    /**
     * Utility function to create icon button without inline handlers
     */
    createIconButton(icon, title, action, data = {}, className = 'text-blue-600 hover:text-blue-900') {
        const dataAttrs = Object.entries(data)
            .map(([key, value]) => `data-${key}="${SecurityUtils.escapeHtml(value)}"`)
            .join(' ');
            
        return `<button class="${className}" title="${SecurityUtils.escapeHtml(title)}" 
                data-action="${action}" ${dataAttrs}>
            <i class="${icon}"></i>
        </button>`;
    },
    
    /**
     * Enhanced table action buttons without inline handlers
     */
    createActionButtons(buttons) {
        return buttons.map(btn => {
            const dataAttrs = Object.entries(btn.data || {})
                .map(([key, value]) => `data-${key}="${SecurityUtils.escapeHtml(value)}"`)
                .join(' ');
                
            return `<button class="${btn.class}" title="${SecurityUtils.escapeHtml(btn.title)}" 
                    data-action="${btn.action}" ${dataAttrs}>
                <i class="${btn.icon}"></i>
            </button>`;
        }).join('');
    }
};

// Initialize event delegation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => EventDelegation.init());
} else {
    EventDelegation.init();
}

// Export for use in other modules
window.EventDelegation = EventDelegation;