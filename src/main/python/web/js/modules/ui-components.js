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
    
    // ModalManager class for centralized modal management
    class ModalManager {
        static modals = new Map();
        static zIndex = 1000;
        
        /**
         * Show a new modal
         * @param {string} title - Modal title
         * @param {string} content - Modal content HTML
         * @param {Object} options - Optional configuration
         * @param {string} options.modalId - Custom modal ID
         * @param {string} options.actions - Custom action buttons HTML
         * @param {number} options.autoClose - Auto close after N milliseconds
         * @returns {string} modalId - The modal's ID
         */
        static show(title, content, options = {}) {
            const modalId = options.modalId || `modal-${Date.now()}`;
            const actions = options.actions || window.html.button('關閉', 'px-4 py-2 bg-gray-200 rounded hover:bg-gray-300', 'ModalManager.close', `data-modal-id="${modalId}"`);
            
            const fullContent = `
                <div class="mb-4">
                    ${content}
                </div>
                ${window.html.modalFooter(modalId, actions, '', '', false)}
            `;
            
            const modalHtml = window.html.modal(title, fullContent, modalId);
            const modalElement = document.createElement('div');
            modalElement.innerHTML = modalHtml;
            const modal = modalElement.firstElementChild;
            
            // Set z-index
            modal.style.zIndex = this.zIndex++;
            
            // Add to DOM and track
            document.body.appendChild(modal);
            this.modals.set(modalId, modal);
            
            // Handle auto-close if specified
            if (options.autoClose && options.autoClose > 0) {
                setTimeout(() => {
                    this.close(modalId);
                }, options.autoClose);
            }
            
            return modalId;
        }
        
        /**
         * Close a specific modal
         * @param {string} modalId - The modal's ID
         */
        static close(modalId) {
            const modal = this.modals.get(modalId);
            if (modal) {
                modal.remove();
                this.modals.delete(modalId);
            }
        }
        
        /**
         * Close all active modals
         */
        static closeAll() {
            for (const [modalId, modal] of this.modals) {
                modal.remove();
            }
            this.modals.clear();
        }
        
        /**
         * Update the content of an existing modal
         * @param {string} modalId - The modal's ID
         * @param {string} content - New content HTML
         */
        static update(modalId, content) {
            const modal = this.modals.get(modalId);
            if (modal) {
                const contentElement = modal.querySelector('.modal-body') || modal.querySelector('.p-6');
                if (contentElement) {
                    contentElement.innerHTML = `
                        <div class="mb-4">
                            ${content}
                        </div>
                    `;
                }
            }
        }
        
        /**
         * Check if a modal is open
         * @param {string} modalId - The modal's ID
         * @returns {boolean} True if the modal is open
         */
        static isOpen(modalId) {
            return this.modals.has(modalId);
        }
    }
    
    // Export to global scope
    window.showModal = showModal;
    window.createModal = createModal;
    window.createEditModal = createEditModal;
    window.closeModal = closeModal;
    window.ModalManager = ModalManager;
    
    console.log('✅ UI Components module loaded');
})();