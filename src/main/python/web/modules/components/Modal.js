/**
 * Modal Component Module
 * Provides reusable modal dialog functionality
 */

import { dom } from '../utils/dom.js';

export class Modal {
    constructor(options = {}) {
        this.options = {
            title: '',
            content: '',
            actions: '',
            closeOnEscape: true,
            closeOnOverlay: true,
            className: '',
            width: 'max-w-2xl',
            ...options
        };
        
        this.isOpen = false;
        this.element = null;
        this.callbacks = {
            onOpen: options.onOpen || (() => {}),
            onClose: options.onClose || (() => {}),
            onSubmit: options.onSubmit || null
        };
        
        this._boundHandleEscape = this._handleEscape.bind(this);
        this._boundHandleOverlayClick = this._handleOverlayClick.bind(this);
    }

    /**
     * Create modal HTML structure
     * @private
     */
    _createModalElement() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="modal-container bg-white p-6 rounded-lg shadow-xl ${this.options.width} w-full max-h-[90vh] overflow-y-auto relative ${this.options.className}">
                <div class="modal-header flex justify-between items-center mb-4">
                    <h2 class="modal-title text-xl font-bold">${dom.escape(this.options.title)}</h2>
                    <button class="modal-close text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div class="modal-body">
                    ${this.options.content}
                </div>
                ${this.options.actions ? `
                    <div class="modal-actions mt-6 flex justify-end space-x-3">
                        ${this.options.actions}
                    </div>
                ` : ''}
            </div>
        `;
        
        // Add event listeners
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.close());
        
        // Form submission handling
        const form = modal.querySelector('form');
        if (form && this.callbacks.onSubmit) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                
                try {
                    await this.callbacks.onSubmit(data, form);
                } catch (error) {
                    console.error('Form submission error:', error);
                }
            });
        }
        
        return modal;
    }

    /**
     * Show the modal
     * @param {Object} options - Optional override options
     */
    show(options = {}) {
        // Update options if provided
        Object.assign(this.options, options);
        
        // Create modal if not exists
        if (!this.element) {
            this.element = this._createModalElement();
            document.body.appendChild(this.element);
        } else {
            // Update content if changed
            this._updateContent();
        }
        
        // Show modal with animation
        this.element.style.display = 'flex';
        requestAnimationFrame(() => {
            this.element.classList.add('modal-open');
        });
        
        this.isOpen = true;
        
        // Add event listeners
        if (this.options.closeOnEscape) {
            document.addEventListener('keydown', this._boundHandleEscape);
        }
        if (this.options.closeOnOverlay) {
            this.element.addEventListener('click', this._boundHandleOverlayClick);
        }
        
        // Focus first input
        const firstInput = this.element.querySelector('input:not([type="hidden"]), textarea, select');
        if (firstInput) {
            firstInput.focus();
        }
        
        this.callbacks.onOpen();
    }

    /**
     * Close the modal
     */
    close() {
        if (!this.isOpen) return;
        
        this.element.classList.remove('modal-open');
        
        setTimeout(() => {
            this.element.style.display = 'none';
            this.isOpen = false;
            
            // Remove event listeners
            document.removeEventListener('keydown', this._boundHandleEscape);
            this.element.removeEventListener('click', this._boundHandleOverlayClick);
            
            this.callbacks.onClose();
        }, 200); // Match CSS transition duration
    }

    /**
     * Update modal content
     * @private
     */
    _updateContent() {
        const title = this.element.querySelector('.modal-title');
        const body = this.element.querySelector('.modal-body');
        const actions = this.element.querySelector('.modal-actions');
        
        if (title) title.textContent = this.options.title;
        if (body) body.innerHTML = this.options.content;
        if (actions) {
            if (this.options.actions) {
                actions.innerHTML = this.options.actions;
                actions.style.display = '';
            } else {
                actions.style.display = 'none';
            }
        }
    }

    /**
     * Handle escape key press
     * @private
     */
    _handleEscape(e) {
        if (e.key === 'Escape') {
            this.close();
        }
    }

    /**
     * Handle overlay click
     * @private
     */
    _handleOverlayClick(e) {
        if (e.target === this.element) {
            this.close();
        }
    }

    /**
     * Show loading state
     */
    showLoading(message = 'Loading...') {
        const body = this.element?.querySelector('.modal-body');
        if (body) {
            body.innerHTML = `
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                    <span>${dom.escape(message)}</span>
                </div>
            `;
        }
    }

    /**
     * Show error state
     */
    showError(message) {
        const body = this.element?.querySelector('.modal-body');
        if (body) {
            body.innerHTML = `
                <div class="bg-red-50 text-red-600 p-4 rounded-lg">
                    <strong>Error:</strong> ${dom.escape(message)}
                </div>
            `;
        }
    }

    /**
     * Destroy the modal
     */
    destroy() {
        this.close();
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }

    /**
     * Static method to show confirmation dialog
     */
    static confirm(options) {
        return new Promise((resolve) => {
            const modal = new Modal({
                title: options.title || 'Confirm',
                content: options.message || 'Are you sure?',
                actions: `
                    <button type="button" class="btn-cancel px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                        ${options.cancelText || 'Cancel'}
                    </button>
                    <button type="button" class="btn-confirm px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                        ${options.confirmText || 'Confirm'}
                    </button>
                `,
                closeOnEscape: false,
                closeOnOverlay: false,
                ...options
            });
            
            modal.show();
            
            const cancelBtn = modal.element.querySelector('.btn-cancel');
            const confirmBtn = modal.element.querySelector('.btn-confirm');
            
            cancelBtn.addEventListener('click', () => {
                modal.destroy();
                resolve(false);
            });
            
            confirmBtn.addEventListener('click', () => {
                modal.destroy();
                resolve(true);
            });
        });
    }

    /**
     * Static method to show alert dialog
     */
    static alert(options) {
        const modal = new Modal({
            title: options.title || 'Alert',
            content: options.message || '',
            actions: `
                <button type="button" class="btn-ok px-4 py-2 bg-primary text-white rounded hover:bg-blue-700">
                    ${options.okText || 'OK'}
                </button>
            `,
            ...options
        });
        
        modal.show();
        
        const okBtn = modal.element.querySelector('.btn-ok');
        okBtn.addEventListener('click', () => modal.destroy());
        
        return modal;
    }
}

// Add CSS for modal animations
const style = document.createElement('style');
style.textContent = `
    .modal-open {
        animation: modalFadeIn 0.2s ease-out;
    }
    
    .modal-open .modal-container {
        animation: modalSlideIn 0.2s ease-out;
    }
    
    @keyframes modalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes modalSlideIn {
        from {
            transform: translateY(-20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

export default Modal;