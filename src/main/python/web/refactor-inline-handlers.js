/**
 * Refactored Table and HTML utilities to remove inline event handlers
 * This file contains the updated versions that should replace the existing ones in app.js
 */

// Enhanced TABLE UTILITY - Without inline handlers
const tableEnhanced = {
    render(tbodyId, data, columns, emptyMessage = '沒有找到資料') {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        
        // Clear existing content safely
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }
        
        // Handle empty state
        if (!data || data.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = columns.length;
            cell.className = 'px-6 py-4 text-center text-gray-500';
            cell.textContent = emptyMessage;
            return;
        }
        
        // Render rows
        data.forEach(item => {
            const row = tbody.insertRow();
            row.className = 'hover:bg-gray-50 transition-colors';
            
            // Add data attributes for row clicks if needed
            if (item.id && columns.some(col => col.clickable)) {
                row.dataset.itemId = item.id;
                row.dataset.itemType = tbodyId.replace('-tbody', '');
                row.classList.add('cursor-pointer');
            }
            
            columns.forEach(col => {
                const cell = row.insertCell();
                cell.className = col.class || 'px-6 py-4 text-sm';
                
                if (col.render) {
                    const content = col.render(item);
                    if (typeof content === 'string') {
                        cell.innerHTML = content;
                    } else if (content instanceof Node) {
                        cell.appendChild(content);
                    }
                } else if (col.key) {
                    cell.textContent = item[col.key] || '';
                }
            });
        });
    },
    
    statusBadge(status, config) {
        const info = config[status] || { text: status, class: 'bg-gray-100 text-gray-800' };
        return `<span class="px-2 py-1 text-xs rounded-full ${info.class}">${SecurityUtils.escapeHtml(info.text)}</span>`;
    },
    
    // New version without inline onclick
    actionButtons(buttons) {
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

// Enhanced HTML TEMPLATE UTILITY - Without inline handlers
const htmlEnhanced = {
    escape(text) {
        return SecurityUtils.escapeHtml(text);
    },
    
    card(title, content, className = 'bg-white rounded-lg shadow-lg') {
        return `
            <div class="${className}">
                <div class="px-6 py-4 border-b">
                    <h3 class="text-lg font-semibold">${this.escape(title)}</h3>
                </div>
                <div class="p-6">${content}</div>
            </div>
        `;
    },
    
    // Enhanced modal without inline onclick
    modal(id, title, content, className = 'max-w-2xl') {
        return `
            <div id="${id}" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
                <div class="relative top-20 mx-auto p-5 border w-full ${className} shadow-lg rounded-md bg-white">
                    <div class="px-6 py-4 border-b flex justify-between items-center">
                        <h3 class="text-lg font-semibold">${this.escape(title)}</h3>
                        <button data-modal-close data-modal-id="${id}" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="p-6">${content}</div>
                </div>
            </div>
        `;
    },
    
    formGroup(label, inputHtml, error = null) {
        return `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">${this.escape(label)}</label>
                ${inputHtml}
                ${error ? `<p class="text-red-500 text-xs mt-1">${this.escape(error)}</p>` : ''}
            </div>
        `;
    },
    
    select(name, options, selectedValue = '', className = 'w-full border rounded px-3 py-2') {
        const optionsHtml = options.map(opt => {
            const value = opt.value !== undefined ? opt.value : opt;
            const text = opt.text !== undefined ? opt.text : opt;
            const selected = value === selectedValue ? 'selected' : '';
            return `<option value="${this.escape(value)}" ${selected}>${this.escape(text)}</option>`;
        }).join('');
        
        return `<select name="${name}" class="${className}">${optionsHtml}</select>`;
    },
    
    input(type, name, value = '', placeholder = '', className = 'w-full border rounded px-3 py-2') {
        return `<input type="${type}" name="${name}" value="${this.escape(value)}" 
                placeholder="${this.escape(placeholder)}" class="${className}">`;
    },
    
    // New button method without inline onclick
    button(text, action = '', data = {}, className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700') {
        const dataAttrs = Object.entries(data)
            .map(([key, value]) => `data-${key}="${this.escape(value)}"`)
            .join(' ');
            
        return `<button class="${className}" ${action ? `data-action="${action}"` : ''} ${dataAttrs}>
            ${this.escape(text)}
        </button>`;
    },
    
    // New icon button method without inline onclick
    iconButton(icon, title, action = '', data = {}, className = 'text-blue-600 hover:text-blue-900') {
        const dataAttrs = Object.entries(data)
            .map(([key, value]) => `data-${key}="${this.escape(value)}"`)
            .join(' ');
            
        return `<button class="${className}" title="${this.escape(title)}" 
                ${action ? `data-action="${action}"` : ''} ${dataAttrs}>
            <i class="${icon}"></i>
        </button>`;
    }
};

// Function to convert old action button format to new format
function convertActionButton(oldButton) {
    const newButton = {
        icon: oldButton.icon,
        title: oldButton.title,
        class: oldButton.class,
        action: '',
        data: {}
    };
    
    // Parse onclick to extract action and data
    if (oldButton.onclick) {
        const match = oldButton.onclick.match(/^(\w+)\((.*)\)$/);
        if (match) {
            const funcName = match[1];
            const args = match[2];
            
            // Map function names to actions
            const actionMap = {
                'viewDelivery': 'view-delivery',
                'editDriver': 'edit-driver',
                'editVehicle': 'edit-vehicle',
                'viewRoute': 'view-route',
                'showRouteMap': 'show-route-map',
                'editRoute': 'edit-route',
                'assignDriver': 'assign-driver',
                'updateDeliveryStatus': 'update-delivery-status',
                'removeClientFromRoute': 'remove-client-from-route',
                'viewScheduleDetails': 'view-schedule-details',
                'applySchedule': 'apply-schedule'
            };
            
            newButton.action = actionMap[funcName] || funcName;
            
            // Parse arguments
            const argValues = args.split(',').map(arg => arg.trim().replace(/['"]/g, ''));
            
            // Map arguments to data attributes based on function
            switch (funcName) {
                case 'viewDelivery':
                case 'editDriver':
                case 'editVehicle':
                case 'viewRoute':
                case 'showRouteMap':
                case 'editRoute':
                case 'assignDriver':
                    newButton.data[funcName.replace(/view|edit|show|assign/, '').toLowerCase() + '-id'] = argValues[0];
                    break;
                    
                case 'updateDeliveryStatus':
                    newButton.data['delivery-id'] = argValues[0];
                    newButton.data['current-status'] = argValues[1];
                    break;
                    
                case 'removeClientFromRoute':
                    newButton.data['index'] = argValues[0];
                    break;
                    
                case 'viewScheduleDetails':
                case 'applySchedule':
                    newButton.data['date'] = argValues[0];
                    break;
            }
        }
    }
    
    return newButton;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        tableEnhanced,
        htmlEnhanced,
        convertActionButton
    };
}