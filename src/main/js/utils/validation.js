/**
 * Input Validation Utilities for LuckyGas
 * 
 * This module provides comprehensive validation functions for all form inputs
 * with Taiwan-specific formats and business rules.
 * 
 * @module ValidationUtils
 * @version 1.0.0
 */

const ValidationUtils = {
    /**
     * Regular expressions for Taiwan-specific formats
     */
    patterns: {
        // Taiwan phone numbers: 09XX-XXXXXX or (0X)-XXXX-XXXX or (0X)-XXXXXXX
        taiwanMobile: /^09\d{2}-?\d{6}$/,
        taiwanLandline: /^(\(0[2-9]\)|0[2-9])-?\d{3,4}-?\d{4}$/,
        // Client code: Alphanumeric with optional hyphens (e.g., C001, GAS-2023-001)
        clientCode: /^[A-Z0-9][A-Z0-9\-]*[A-Z0-9]$/i,
        // Order number format
        orderNumber: /^[A-Z]{2,3}-\d{4}-\d{4,6}$/,
        // Taiwan postal code (3-5 digits)
        postalCode: /^\d{3,5}$/,
        // Basic email validation
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        // License plate: Taiwan format (ABC-1234 or 1234-AB)
        licensePlate: /^[A-Z0-9]{2,3}-[A-Z0-9]{3,4}$|^[0-9]{3,4}-[A-Z]{2}$/i,
        // Positive integers for quantities
        positiveInteger: /^[1-9]\d*$/,
        // Decimal numbers for prices/amounts
        decimal: /^\d+(\.\d{1,2})?$/,
        // Date format: YYYY-MM-DD
        dateFormat: /^\d{4}-\d{2}-\d{2}$/,
        // Time format: HH:MM
        timeFormat: /^([01]\d|2[0-3]):([0-5]\d)$/,
        // Safe string: No special characters that could cause SQL injection
        safeString: /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_.,()]+$/
    },

    /**
     * Validate Taiwan phone number (mobile or landline)
     * @param {string} phone - Phone number to validate
     * @returns {Object} Validation result {isValid: boolean, message: string}
     */
    validatePhone(phone) {
        if (!phone || phone.trim() === '') {
            return { isValid: false, message: '電話號碼不能為空' };
        }

        const cleaned = phone.replace(/[\s\-()]/g, '');
        
        if (this.patterns.taiwanMobile.test(phone) || this.patterns.taiwanLandline.test(phone)) {
            return { isValid: true, message: '' };
        }

        if (cleaned.length < 9) {
            return { isValid: false, message: '電話號碼太短' };
        }

        if (cleaned.length > 10) {
            return { isValid: false, message: '電話號碼太長' };
        }

        return { isValid: false, message: '請輸入有效的台灣電話號碼格式' };
    },

    /**
     * Validate client code
     * @param {string} code - Client code to validate
     * @returns {Object} Validation result
     */
    validateClientCode(code) {
        if (!code || code.trim() === '') {
            return { isValid: false, message: '客戶編號不能為空' };
        }

        if (code.length < 3) {
            return { isValid: false, message: '客戶編號至少需要3個字符' };
        }

        if (code.length > 20) {
            return { isValid: false, message: '客戶編號不能超過20個字符' };
        }

        if (!this.patterns.clientCode.test(code)) {
            return { isValid: false, message: '客戶編號格式無效（只允許字母、數字和連字符）' };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate delivery quantity
     * @param {string|number} quantity - Quantity to validate
     * @param {Object} options - Validation options {min: number, max: number}
     * @returns {Object} Validation result
     */
    validateQuantity(quantity, options = {}) {
        const min = options.min || 1;
        const max = options.max || 999999;

        if (!quantity || quantity === '') {
            return { isValid: false, message: '數量不能為空' };
        }

        const num = Number(quantity);

        if (isNaN(num)) {
            return { isValid: false, message: '請輸入有效的數字' };
        }

        if (!this.patterns.positiveInteger.test(quantity.toString())) {
            return { isValid: false, message: '數量必須是正整數' };
        }

        if (num < min) {
            return { isValid: false, message: `數量不能小於 ${min}` };
        }

        if (num > max) {
            return { isValid: false, message: `數量不能大於 ${max}` };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate date
     * @param {string} date - Date string to validate
     * @param {Object} options - Validation options {minDate: string, maxDate: string, allowPast: boolean}
     * @returns {Object} Validation result
     */
    validateDate(date, options = {}) {
        if (!date || date.trim() === '') {
            return { isValid: false, message: '日期不能為空' };
        }

        if (!this.patterns.dateFormat.test(date)) {
            return { isValid: false, message: '日期格式必須為 YYYY-MM-DD' };
        }

        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return { isValid: false, message: '無效的日期' };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (options.allowPast === false && dateObj < today) {
            return { isValid: false, message: '不能選擇過去的日期' };
        }

        if (options.minDate) {
            const minDateObj = new Date(options.minDate);
            if (dateObj < minDateObj) {
                return { isValid: false, message: `日期不能早於 ${options.minDate}` };
            }
        }

        if (options.maxDate) {
            const maxDateObj = new Date(options.maxDate);
            if (dateObj > maxDateObj) {
                return { isValid: false, message: `日期不能晚於 ${options.maxDate}` };
            }
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate time
     * @param {string} time - Time string to validate (HH:MM format)
     * @returns {Object} Validation result
     */
    validateTime(time) {
        if (!time || time.trim() === '') {
            return { isValid: false, message: '時間不能為空' };
        }

        if (!this.patterns.timeFormat.test(time)) {
            return { isValid: false, message: '時間格式必須為 HH:MM' };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate order number
     * @param {string} orderNumber - Order number to validate
     * @returns {Object} Validation result
     */
    validateOrderNumber(orderNumber) {
        if (!orderNumber || orderNumber.trim() === '') {
            return { isValid: false, message: '訂單號碼不能為空' };
        }

        if (!this.patterns.orderNumber.test(orderNumber)) {
            return { isValid: false, message: '訂單號碼格式無效（例：GAS-2024-000001）' };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate name (person or company)
     * @param {string} name - Name to validate
     * @param {Object} options - Validation options {minLength: number, maxLength: number, allowNumbers: boolean}
     * @returns {Object} Validation result
     */
    validateName(name, options = {}) {
        const minLength = options.minLength || 2;
        const maxLength = options.maxLength || 100;
        const allowNumbers = options.allowNumbers || false;

        if (!name || name.trim() === '') {
            return { isValid: false, message: '名稱不能為空' };
        }

        const trimmedName = name.trim();

        if (trimmedName.length < minLength) {
            return { isValid: false, message: `名稱至少需要 ${minLength} 個字符` };
        }

        if (trimmedName.length > maxLength) {
            return { isValid: false, message: `名稱不能超過 ${maxLength} 個字符` };
        }

        // Check for potentially dangerous characters
        if (/<|>|script|javascript|onclick|onerror/i.test(trimmedName)) {
            return { isValid: false, message: '名稱包含不允許的字符' };
        }

        // Allow Chinese characters, letters, spaces, and common punctuation
        const namePattern = allowNumbers 
            ? /^[\u4e00-\u9fa5a-zA-Z0-9\s\-_.,()']+$/
            : /^[\u4e00-\u9fa5a-zA-Z\s\-_.,()']+$/;

        if (!namePattern.test(trimmedName)) {
            return { isValid: false, message: allowNumbers 
                ? '名稱只能包含中文、英文、數字和基本標點符號' 
                : '名稱只能包含中文、英文和基本標點符號' };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate address
     * @param {string} address - Address to validate
     * @returns {Object} Validation result
     */
    validateAddress(address) {
        if (!address || address.trim() === '') {
            return { isValid: false, message: '地址不能為空' };
        }

        const trimmedAddress = address.trim();

        if (trimmedAddress.length < 5) {
            return { isValid: false, message: '地址太短，請輸入完整地址' };
        }

        if (trimmedAddress.length > 200) {
            return { isValid: false, message: '地址太長，不能超過200個字符' };
        }

        // Check for potentially dangerous characters
        if (/<|>|script|javascript|onclick|onerror/i.test(trimmedAddress)) {
            return { isValid: false, message: '地址包含不允許的字符' };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate email
     * @param {string} email - Email to validate
     * @returns {Object} Validation result
     */
    validateEmail(email) {
        if (!email || email.trim() === '') {
            return { isValid: true, message: '' }; // Email is optional
        }

        if (!this.patterns.email.test(email)) {
            return { isValid: false, message: '請輸入有效的電子郵件地址' };
        }

        if (email.length > 100) {
            return { isValid: false, message: '電子郵件地址太長' };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate license plate
     * @param {string} plate - License plate to validate
     * @returns {Object} Validation result
     */
    validateLicensePlate(plate) {
        if (!plate || plate.trim() === '') {
            return { isValid: false, message: '車牌號碼不能為空' };
        }

        const cleaned = plate.trim().toUpperCase();

        if (!this.patterns.licensePlate.test(cleaned)) {
            return { isValid: false, message: '請輸入有效的台灣車牌格式' };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate decimal amount (for prices, costs, etc.)
     * @param {string|number} amount - Amount to validate
     * @param {Object} options - Validation options {min: number, max: number, allowZero: boolean}
     * @returns {Object} Validation result
     */
    validateAmount(amount, options = {}) {
        const min = options.min || 0;
        const max = options.max || 999999999;
        const allowZero = options.allowZero !== false;

        if (!amount && amount !== 0) {
            return { isValid: false, message: '金額不能為空' };
        }

        const num = Number(amount);

        if (isNaN(num)) {
            return { isValid: false, message: '請輸入有效的金額' };
        }

        if (!allowZero && num === 0) {
            return { isValid: false, message: '金額不能為零' };
        }

        if (num < min) {
            return { isValid: false, message: `金額不能小於 ${min}` };
        }

        if (num > max) {
            return { isValid: false, message: `金額不能大於 ${max}` };
        }

        // Check decimal places
        const decimalStr = amount.toString();
        if (decimalStr.includes('.')) {
            const decimals = decimalStr.split('.')[1];
            if (decimals.length > 2) {
                return { isValid: false, message: '金額最多只能有兩位小數' };
            }
        }

        return { isValid: true, message: '' };
    },

    /**
     * Validate form data object
     * @param {Object} data - Form data to validate
     * @param {Object} rules - Validation rules for each field
     * @returns {Object} Result {isValid: boolean, errors: Object}
     */
    validateForm(data, rules) {
        const errors = {};
        let isValid = true;

        for (const field in rules) {
            const value = data[field];
            const fieldRules = rules[field];
            const result = this.validateField(value, fieldRules);

            if (!result.isValid) {
                errors[field] = result.message;
                isValid = false;
            }
        }

        return { isValid, errors };
    },

    /**
     * Validate a single field based on rules
     * @param {*} value - Field value
     * @param {Object} rules - Validation rules
     * @returns {Object} Validation result
     */
    validateField(value, rules) {
        // Required check
        if (rules.required && (!value || value.toString().trim() === '')) {
            return { isValid: false, message: rules.requiredMessage || '此欄位為必填' };
        }

        // Skip other validations if field is empty and not required
        if (!rules.required && (!value || value.toString().trim() === '')) {
            return { isValid: true, message: '' };
        }

        // Type-specific validation
        switch (rules.type) {
            case 'phone':
                return this.validatePhone(value);
            case 'email':
                return this.validateEmail(value);
            case 'clientCode':
                return this.validateClientCode(value);
            case 'quantity':
                return this.validateQuantity(value, rules.options);
            case 'date':
                return this.validateDate(value, rules.options);
            case 'time':
                return this.validateTime(value);
            case 'orderNumber':
                return this.validateOrderNumber(value);
            case 'name':
                return this.validateName(value, rules.options);
            case 'address':
                return this.validateAddress(value);
            case 'licensePlate':
                return this.validateLicensePlate(value);
            case 'amount':
                return this.validateAmount(value, rules.options);
            case 'custom':
                if (rules.validator && typeof rules.validator === 'function') {
                    return rules.validator(value, rules.options);
                }
                break;
        }

        return { isValid: true, message: '' };
    },

    /**
     * Display validation errors on form
     * @param {HTMLFormElement} form - Form element
     * @param {Object} errors - Validation errors object
     */
    displayFormErrors(form, errors) {
        // Clear existing errors
        form.querySelectorAll('.error-message').forEach(el => el.remove());
        form.querySelectorAll('.border-red-500').forEach(el => {
            el.classList.remove('border-red-500');
        });

        // Display new errors
        for (const field in errors) {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('border-red-500');
                
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message text-red-500 text-sm mt-1';
                errorDiv.textContent = errors[field];
                
                input.parentElement.appendChild(errorDiv);
            }
        }
    },

    /**
     * Clear all validation errors from form
     * @param {HTMLFormElement} form - Form element
     */
    clearFormErrors(form) {
        form.querySelectorAll('.error-message').forEach(el => el.remove());
        form.querySelectorAll('.border-red-500').forEach(el => {
            el.classList.remove('border-red-500');
        });
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationUtils;
}