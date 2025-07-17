/**
 * UI Components Module
 * Contains: Modal creation, form field generation, status badges, etc.
 * Functions: showModal, createModal, createEditModal, closeModal, and UI helpers
 */

(function() {
    'use strict';
    
    // Modal function - refactored to use html.modal utility
    function showModal(title, content, actions = '') {
        const modalId = `modal-${Date.now()}`;
        const fullContent = `
            <div class="mb-4">
                ${content}
            </div>
            ${window.html.modalFooter(modalId, actions || window.html.button('關閉', 'px-4 py-2 bg-gray-200 rounded hover:bg-gray-300', 'closeModal', `data-modal-id="${modalId}"`), '', '', false)}
        `;
        
        const modalHtml = window.html.modal(title, fullContent, modalId);
        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHtml;
        document.body.appendChild(modalElement.firstElementChild);
    }
    
    // Create modal helper function - refactored to use html.modal utility
    function createModal(content, title = '') {
        const modalId = `modal-${Date.now()}`;
        // Extract title from content if it contains an h2
        let modalTitle = title;
        let modalContent = content;
        
        const titleMatch = content.match(/<h2[^>]*>(.*?)<\/h2>/);
        if (titleMatch && !title) {
            modalTitle = titleMatch[1];
            modalContent = content.replace(/<h2[^>]*>.*?<\/h2>/, '');
        }
        
        const modalHtml = window.html.modal(modalTitle, modalContent, modalId);
        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHtml;
        return modalElement.firstElementChild;
    }
    
    // Helper function to create edit modal
    function createEditModal(title, content) {
        const modalId = `modal-${Date.now()}`;
        const fullContent = `
            <div class="py-4">
                ${content}
            </div>
            ${window.html.modalFooter(modalId)}
        `;
        
        const modalHtml = window.html.modal(title, fullContent, modalId);
        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHtml;
        const modal = modalElement.firstElementChild;
        
        document.body.appendChild(modal);
        return modal;
    }
    
    // Close modal helper function - handles both element and ID
    function closeModal(modalOrId) {
        let modal;
        
        // Check if it's an element or an ID
        if (typeof modalOrId === 'string') {
            modal = document.getElementById(modalOrId);
        } else if (modalOrId instanceof HTMLElement) {
            modal = modalOrId;
        } else {
            console.error('Invalid modal parameter:', modalOrId);
            return;
        }
        
        if (modal) {
            // Check if it's a predefined modal with hidden class
            if (modal.id && ['addClientModal', 'addDriverModal', 'addVehicleModal', 'addDeliveryModal', 'routePlanModal', 'addRouteModal'].includes(modal.id)) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            } else {
                // It's a dynamically created modal, remove it from DOM
                modal.remove();
            }
        }
    }
    
    // Export to global scope
    window.showModal = showModal;
    window.createModal = createModal;
    window.createEditModal = createEditModal;
    window.closeModal = closeModal;
    
    console.log('✅ UI Components module loaded');
})();