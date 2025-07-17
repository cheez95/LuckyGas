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
    
    /**
     * Show notification message
     * @param {string} message - The message to display
     * @param {string} type - The notification type (success, error, info)
     */
    function showNotification(message, type = 'info') {
        const notificationClasses = {
            'success': window.APP_CONSTANTS?.CSS_CLASSES?.NOTIFICATION_SUCCESS || 'bg-green-600',
            'error': window.APP_CONSTANTS?.CSS_CLASSES?.NOTIFICATION_ERROR || 'bg-red-600',
            'info': window.APP_CONSTANTS?.CSS_CLASSES?.NOTIFICATION_INFO || 'bg-blue-600'
        };
        
        const icons = {
            'success': window.APP_CONSTANTS?.ICONS?.SUCCESS || 'fas fa-check-circle',
            'error': window.APP_CONSTANTS?.ICONS?.ERROR || 'fas fa-exclamation-circle',
            'info': window.APP_CONSTANTS?.ICONS?.INFO || 'fas fa-info-circle'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded shadow-lg text-white z-50 ${notificationClasses[type] || notificationClasses.info}`;
        
        const iconElement = document.createElement('i');
        iconElement.className = `${icons[type] || icons.info} mr-2`;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex items-center';
        messageDiv.appendChild(iconElement);
        messageDiv.appendChild(document.createTextNode(message));
        
        notification.appendChild(messageDiv);
        document.body.appendChild(notification);
        
        // Fade in
        const fadeInDelay = window.APP_CONFIG?.UI?.ANIMATION?.FAST || 10;
        setTimeout(() => notification.classList.add('opacity-100'), fadeInDelay);
        
        // Remove after configured duration
        const duration = window.APP_CONFIG?.UI?.NOTIFICATION?.DURATION || 3000;
        const fadeOutDuration = window.APP_CONFIG?.UI?.NOTIFICATION?.FADE_DURATION || 300;
        
        setTimeout(() => {
            notification.classList.add('opacity-0');
            setTimeout(() => notification.remove(), fadeOutDuration);
        }, duration);
    }
    
    // Export to global scope
    window.showModal = showModal;
    window.createModal = createModal;
    window.createEditModal = createEditModal;
    window.closeModal = closeModal;
    window.ModalManager = ModalManager;
    
    console.log('✅ UI Components module loaded');
})();