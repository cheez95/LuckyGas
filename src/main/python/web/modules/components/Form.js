/**
 * Form Component Module
 * Provides reusable form functionality with validation and submission handling
 */

import { dom } from '../utils/dom.js';
import { security } from '../utils/security.js';

export class Form {
    constructor(options = {}) {
        this.options = {
            container: null,
            fields: [],
            values: {},
            validation: {},
            submitButton: true,
            submitText: 'Submit',
            cancelButton: false,
            cancelText: 'Cancel',
            resetButton: false,
            resetText: 'Reset',
            layout: 'vertical', // vertical, horizontal, grid
            columns: 1,
            className: '',
            ...options
        };
        
        this.state = {
            values: { ...this.options.values },
            errors: {},
            touched: {},
            submitting: false,
            pristine: true
        };
        
        this.callbacks = {
            onSubmit: options.onSubmit || null,
            onCancel: options.onCancel || null,
            onChange: options.onChange || null,
            onValidate: options.onValidate || null
        };
        
        this.validators = {
            required: (value) => !value ? 'This field is required' : null,
            email: (value) => value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'Invalid email address' : null,
            phone: (value) => value && !/^[\d\s\-\+\(\)]+$/.test(value) ? 'Invalid phone number' : null,
            number: (value) => value && isNaN(value) ? 'Must be a number' : null,
            min: (min) => (value) => value && parseFloat(value) < min ? `Must be at least ${min}` : null,
            max: (max) => (value) => value && parseFloat(value) > max ? `Must be at most ${max}` : null,
            minLength: (min) => (value) => value && value.length < min ? `Must be at least ${min} characters` : null,
            maxLength: (max) => (value) => value && value.length > max ? `Must be at most ${max} characters` : null,
            pattern: (pattern) => (value) => value && !pattern.test(value) ? 'Invalid format' : null
        };
        
        this.init();
    }

    /**
     * Initialize the form
     */
    init() {
        if (!this.options.container) {
            throw new Error('Form container is required');
        }
        
        this.container = typeof this.options.container === 'string' 
            ? document.querySelector(this.options.container)
            : this.options.container;
            
        if (!this.container) {
            throw new Error('Form container not found');
        }
        
        this.render();
    }

    /**
     * Render the form
     */
    render() {
        const formClass = [
            'form-component',
            this.options.className,
            `form-${this.options.layout}`
        ].filter(Boolean).join(' ');
        
        const gridClass = this.options.layout === 'grid' 
            ? `grid grid-cols-${this.options.columns} gap-4`
            : '';
        
        this.container.innerHTML = `
            <form class="${formClass}" novalidate>
                <div class="form-fields ${gridClass}">
                    ${this._renderFields()}
                </div>
                ${this._renderActions()}
            </form>
        `;
        
        this.form = this.container.querySelector('form');
        this._attachEventListeners();
    }

    /**
     * Render form fields
     * @private
     */
    _renderFields() {
        return this.options.fields.map(field => {
            const value = this.state.values[field.name] || field.defaultValue || '';
            const error = this.state.errors[field.name];
            const hasError = error && this.state.touched[field.name];
            
            const fieldClass = [
                'form-field',
                field.className,
                hasError ? 'has-error' : '',
                field.required ? 'required' : ''
            ].filter(Boolean).join(' ');
            
            return `
                <div class="${fieldClass}" data-field="${field.name}">
                    ${this._renderField(field, value, hasError, error)}
                </div>
            `;
        }).join('');
    }

    /**
     * Render individual field
     * @private
     */
    _renderField(field, value, hasError, error) {
        const labelClass = this.options.layout === 'horizontal' 
            ? 'block text-sm font-medium text-gray-700 sm:mt-px sm:pt-2' 
            : 'block text-sm font-medium text-gray-700 mb-1';
            
        const inputClass = [
            'form-input',
            'block w-full rounded-md shadow-sm',
            hasError 
                ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' 
                : 'border-gray-300 focus:ring-primary focus:border-primary',
            field.inputClass
        ].filter(Boolean).join(' ');
        
        let fieldHtml = '';
        
        // Label
        if (field.label) {
            fieldHtml += `
                <label for="${field.name}" class="${labelClass}">
                    ${dom.escape(field.label)}
                    ${field.required ? '<span class="text-red-500">*</span>' : ''}
                </label>
            `;
        }
        
        // Input wrapper for horizontal layout
        if (this.options.layout === 'horizontal') {
            fieldHtml += '<div class="mt-1 sm:mt-0 sm:col-span-2">';
        }
        
        // Field input
        switch (field.type) {
            case 'select':
                fieldHtml += `
                    <select name="${field.name}" 
                            id="${field.name}" 
                            class="${inputClass}"
                            ${field.required ? 'required' : ''}
                            ${field.disabled ? 'disabled' : ''}>
                        ${field.placeholder ? `<option value="">${dom.escape(field.placeholder)}</option>` : ''}
                        ${field.options.map(opt => {
                            const optValue = typeof opt === 'object' ? opt.value : opt;
                            const optLabel = typeof opt === 'object' ? opt.label : opt;
                            return `<option value="${dom.escape(optValue)}" ${value == optValue ? 'selected' : ''}>
                                ${dom.escape(optLabel)}
                            </option>`;
                        }).join('')}
                    </select>
                `;
                break;
                
            case 'textarea':
                fieldHtml += `
                    <textarea name="${field.name}"
                              id="${field.name}"
                              class="${inputClass}"
                              rows="${field.rows || 3}"
                              placeholder="${field.placeholder || ''}"
                              ${field.required ? 'required' : ''}
                              ${field.disabled ? 'disabled' : ''}>${dom.escape(value)}</textarea>
                `;
                break;
                
            case 'checkbox':
                fieldHtml += `
                    <div class="flex items-center">
                        <input type="checkbox"
                               name="${field.name}"
                               id="${field.name}"
                               class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                               ${value ? 'checked' : ''}
                               ${field.disabled ? 'disabled' : ''}>
                        ${field.label ? `<label for="${field.name}" class="ml-2 block text-sm text-gray-900">
                            ${dom.escape(field.label)}
                        </label>` : ''}
                    </div>
                `;
                break;
                
            case 'radio':
                fieldHtml += `
                    <div class="space-y-2">
                        ${field.options.map((opt, index) => {
                            const optValue = typeof opt === 'object' ? opt.value : opt;
                            const optLabel = typeof opt === 'object' ? opt.label : opt;
                            const optId = `${field.name}_${index}`;
                            return `
                                <div class="flex items-center">
                                    <input type="radio"
                                           name="${field.name}"
                                           id="${optId}"
                                           value="${dom.escape(optValue)}"
                                           class="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                           ${value == optValue ? 'checked' : ''}
                                           ${field.disabled ? 'disabled' : ''}>
                                    <label for="${optId}" class="ml-2 block text-sm text-gray-900">
                                        ${dom.escape(optLabel)}
                                    </label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                break;
                
            case 'file':
                fieldHtml += `
                    <input type="file"
                           name="${field.name}"
                           id="${field.name}"
                           class="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-700"
                           ${field.accept ? `accept="${field.accept}"` : ''}
                           ${field.multiple ? 'multiple' : ''}
                           ${field.disabled ? 'disabled' : ''}>
                `;
                break;
                
            default:
                fieldHtml += `
                    <input type="${field.type || 'text'}"
                           name="${field.name}"
                           id="${field.name}"
                           class="${inputClass}"
                           value="${dom.escape(value)}"
                           placeholder="${field.placeholder || ''}"
                           ${field.required ? 'required' : ''}
                           ${field.disabled ? 'disabled' : ''}
                           ${field.readonly ? 'readonly' : ''}
                           ${field.min !== undefined ? `min="${field.min}"` : ''}
                           ${field.max !== undefined ? `max="${field.max}"` : ''}
                           ${field.step !== undefined ? `step="${field.step}"` : ''}>
                `;
        }
        
        // Help text
        if (field.help && !hasError) {
            fieldHtml += `<p class="mt-1 text-sm text-gray-500">${dom.escape(field.help)}</p>`;
        }
        
        // Error message
        if (hasError) {
            fieldHtml += `<p class="mt-1 text-sm text-red-600">${dom.escape(error)}</p>`;
        }
        
        // Close wrapper for horizontal layout
        if (this.options.layout === 'horizontal') {
            fieldHtml += '</div>';
        }
        
        return fieldHtml;
    }

    /**
     * Render form actions
     * @private
     */
    _renderActions() {
        const buttons = [];
        
        if (this.options.submitButton) {
            buttons.push(`
                <button type="submit" 
                        class="btn-submit inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        ${this.state.submitting ? 'disabled' : ''}>
                    ${this.state.submitting ? 'Submitting...' : this.options.submitText}
                </button>
            `);
        }
        
        if (this.options.cancelButton) {
            buttons.push(`
                <button type="button" 
                        class="btn-cancel inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                    ${this.options.cancelText}
                </button>
            `);
        }
        
        if (this.options.resetButton) {
            buttons.push(`
                <button type="reset" 
                        class="btn-reset inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                    ${this.options.resetText}
                </button>
            `);
        }
        
        if (buttons.length === 0) return '';
        
        return `
            <div class="form-actions mt-6 flex items-center justify-end space-x-3">
                ${buttons.join('')}
            </div>
        `;
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEventListeners() {
        // Form submission
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit();
        });
        
        // Field changes
        this.form.addEventListener('input', (e) => {
            if (e.target.matches('input, textarea, select')) {
                this.handleFieldChange(e.target);
            }
        });
        
        // Field blur (for touched state)
        this.form.addEventListener('blur', (e) => {
            if (e.target.matches('input, textarea, select')) {
                this.handleFieldBlur(e.target);
            }
        }, true);
        
        // Cancel button
        const cancelBtn = this.form.querySelector('.btn-cancel');
        if (cancelBtn && this.callbacks.onCancel) {
            cancelBtn.addEventListener('click', () => {
                this.callbacks.onCancel();
            });
        }
        
        // Reset button
        this.form.addEventListener('reset', () => {
            this.reset();
        });
    }

    /**
     * Handle field change
     */
    handleFieldChange(element) {
        const field = this.options.fields.find(f => f.name === element.name);
        if (!field) return;
        
        let value = element.value;
        
        // Handle special input types
        if (element.type === 'checkbox') {
            value = element.checked;
        } else if (element.type === 'number') {
            value = element.value ? parseFloat(element.value) : '';
        }
        
        // Update state
        this.state.values[field.name] = value;
        this.state.pristine = false;
        
        // Validate field
        this.validateField(field.name);
        
        // Call onChange callback
        if (this.callbacks.onChange) {
            this.callbacks.onChange(field.name, value, this.state.values);
        }
    }

    /**
     * Handle field blur
     */
    handleFieldBlur(element) {
        this.state.touched[element.name] = true;
        this.validateField(element.name);
        this.updateFieldError(element.name);
    }

    /**
     * Validate single field
     */
    validateField(fieldName) {
        const field = this.options.fields.find(f => f.name === fieldName);
        if (!field) return;
        
        const value = this.state.values[fieldName];
        const errors = [];
        
        // Built-in validations
        if (field.required && this.validators.required(value)) {
            errors.push(this.validators.required(value));
        }
        
        if (value && field.validation) {
            Object.entries(field.validation).forEach(([rule, param]) => {
                if (this.validators[rule]) {
                    const validator = typeof this.validators[rule] === 'function' 
                        ? this.validators[rule](param) 
                        : this.validators[rule];
                    const error = validator(value);
                    if (error) errors.push(error);
                }
            });
        }
        
        // Custom validation
        if (field.validate) {
            const error = field.validate(value, this.state.values);
            if (error) errors.push(error);
        }
        
        // Update errors
        if (errors.length > 0) {
            this.state.errors[fieldName] = errors[0];
        } else {
            delete this.state.errors[fieldName];
        }
        
        return errors.length === 0;
    }

    /**
     * Validate all fields
     */
    validate() {
        let isValid = true;
        
        this.options.fields.forEach(field => {
            if (!this.validateField(field.name)) {
                isValid = false;
            }
            this.state.touched[field.name] = true;
        });
        
        // Custom form validation
        if (this.callbacks.onValidate) {
            const customErrors = this.callbacks.onValidate(this.state.values);
            if (customErrors) {
                Object.assign(this.state.errors, customErrors);
                isValid = false;
            }
        }
        
        this.render();
        return isValid;
    }

    /**
     * Update field error display
     */
    updateFieldError(fieldName) {
        const fieldContainer = this.form.querySelector(`[data-field="${fieldName}"]`);
        if (!fieldContainer) return;
        
        const error = this.state.errors[fieldName];
        const hasError = error && this.state.touched[fieldName];
        
        fieldContainer.classList.toggle('has-error', hasError);
        
        // Update error message
        let errorElement = fieldContainer.querySelector('.field-error');
        if (hasError) {
            if (!errorElement) {
                errorElement = document.createElement('p');
                errorElement.className = 'field-error mt-1 text-sm text-red-600';
                fieldContainer.appendChild(errorElement);
            }
            errorElement.textContent = error;
        } else if (errorElement) {
            errorElement.remove();
        }
    }

    /**
     * Handle form submission
     */
    async handleSubmit() {
        if (!this.callbacks.onSubmit) return;
        
        // Validate form
        if (!this.validate()) {
            return;
        }
        
        // Set submitting state
        this.setSubmitting(true);
        
        try {
            const data = this.getValues();
            await this.callbacks.onSubmit(data, this);
        } catch (error) {
            console.error('Form submission error:', error);
            this.showError(error.message || 'Submission failed');
        } finally {
            this.setSubmitting(false);
        }
    }

    /**
     * Get form values
     */
    getValues() {
        return { ...this.state.values };
    }

    /**
     * Set form values
     */
    setValues(values) {
        this.state.values = { ...this.state.values, ...values };
        this.render();
    }

    /**
     * Set field value
     */
    setFieldValue(fieldName, value) {
        this.state.values[fieldName] = value;
        this.validateField(fieldName);
        this.render();
    }

    /**
     * Set submitting state
     */
    setSubmitting(submitting) {
        this.state.submitting = submitting;
        const submitBtn = this.form.querySelector('.btn-submit');
        if (submitBtn) {
            submitBtn.disabled = submitting;
            submitBtn.textContent = submitting ? 'Submitting...' : this.options.submitText;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // You can customize this to show errors in a specific way
        alert(message);
    }

    /**
     * Reset form
     */
    reset() {
        this.state = {
            values: { ...this.options.values },
            errors: {},
            touched: {},
            submitting: false,
            pristine: true
        };
        this.render();
    }

    /**
     * Destroy the form
     */
    destroy() {
        this.container.innerHTML = '';
    }
}

// Add CSS for form styles
const style = document.createElement('style');
style.textContent = `
    .form-field.has-error input,
    .form-field.has-error textarea,
    .form-field.has-error select {
        border-color: #ef4444;
    }
    
    .form-field.required label::after {
        content: ' *';
        color: #ef4444;
    }
    
    .form-horizontal .form-field {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 1rem;
        align-items: start;
    }
`;
document.head.appendChild(style);

export default Form;