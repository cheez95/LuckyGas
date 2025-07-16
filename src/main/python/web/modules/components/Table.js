/**
 * Table Component Module
 * Provides reusable table functionality with sorting, selection, and actions
 */

import { dom } from '../utils/dom.js';

export class Table {
    constructor(options = {}) {
        this.options = {
            container: null,
            columns: [],
            data: [],
            rowKey: 'id',
            sortable: true,
            selectable: false,
            emptyMessage: 'No data available',
            loading: false,
            className: '',
            striped: true,
            hover: true,
            compact: false,
            ...options
        };
        
        this.state = {
            sortColumn: null,
            sortDirection: 'asc',
            selectedRows: new Set(),
            currentPage: 1,
            pageSize: 10
        };
        
        this.callbacks = {
            onSort: options.onSort || null,
            onSelect: options.onSelect || null,
            onRowClick: options.onRowClick || null,
            onAction: options.onAction || null
        };
        
        this.init();
    }

    /**
     * Initialize the table
     */
    init() {
        if (!this.options.container) {
            throw new Error('Table container is required');
        }
        
        this.container = typeof this.options.container === 'string' 
            ? document.querySelector(this.options.container)
            : this.options.container;
            
        if (!this.container) {
            throw new Error('Table container not found');
        }
        
        this.render();
    }

    /**
     * Render the complete table
     */
    render() {
        const tableClass = [
            'w-full',
            this.options.striped ? 'table-striped' : '',
            this.options.hover ? 'table-hover' : '',
            this.options.compact ? 'table-compact' : '',
            this.options.className
        ].filter(Boolean).join(' ');
        
        this.container.innerHTML = `
            <div class="table-wrapper relative">
                ${this.options.loading ? this._renderLoading() : ''}
                <table class="${tableClass}">
                    <thead>
                        ${this._renderHeader()}
                    </thead>
                    <tbody>
                        ${this._renderBody()}
                    </tbody>
                </table>
            </div>
        `;
        
        this._attachEventListeners();
    }

    /**
     * Render table header
     * @private
     */
    _renderHeader() {
        const headerCells = this.options.columns.map(column => {
            const isSortable = this.options.sortable && column.sortable !== false;
            const isSorted = this.state.sortColumn === column.field;
            const sortClass = isSorted 
                ? `sorted sorted-${this.state.sortDirection}`
                : '';
            
            return `
                <th class="px-4 py-3 text-left font-medium text-gray-700 ${column.className || ''} ${sortClass}"
                    ${isSortable ? `data-sortable="true" data-field="${column.field}"` : ''}>
                    <div class="flex items-center space-x-1">
                        ${this.options.selectable && column.field === 'selection' ? `
                            <input type="checkbox" class="select-all-checkbox" />
                        ` : `
                            <span>${dom.escape(column.label)}</span>
                            ${isSortable ? `
                                <span class="sort-icon text-gray-400">
                                    ${isSorted && this.state.sortDirection === 'asc' ? '↑' : ''}
                                    ${isSorted && this.state.sortDirection === 'desc' ? '↓' : ''}
                                    ${!isSorted ? '↕' : ''}
                                </span>
                            ` : ''}
                        `}
                    </div>
                </th>
            `;
        }).join('');
        
        return `<tr>${headerCells}</tr>`;
    }

    /**
     * Render table body
     * @private
     */
    _renderBody() {
        if (this.options.data.length === 0) {
            return this._renderEmptyState();
        }
        
        return this.options.data.map((row, index) => {
            const rowKey = row[this.options.rowKey];
            const isSelected = this.state.selectedRows.has(rowKey);
            
            const cells = this.options.columns.map(column => {
                if (column.field === 'selection') {
                    return `
                        <td class="px-4 py-3">
                            <input type="checkbox" 
                                class="row-checkbox" 
                                data-row-key="${rowKey}"
                                ${isSelected ? 'checked' : ''} />
                        </td>
                    `;
                }
                
                const value = this._getCellValue(row, column);
                const rendered = column.render 
                    ? column.render(value, row, index)
                    : dom.escape(value?.toString() || '');
                
                return `
                    <td class="px-4 py-3 ${column.className || ''}"
                        ${column.onClick ? 'data-clickable="true"' : ''}>
                        ${rendered}
                    </td>
                `;
            }).join('');
            
            return `
                <tr class="${isSelected ? 'selected' : ''}" 
                    data-row-key="${rowKey}"
                    data-row-index="${index}">
                    ${cells}
                </tr>
            `;
        }).join('');
    }

    /**
     * Render empty state
     * @private
     */
    _renderEmptyState() {
        const colspan = this.options.columns.length;
        return `
            <tr>
                <td colspan="${colspan}" class="text-center py-8 text-gray-500">
                    ${this.options.emptyMessage}
                </td>
            </tr>
        `;
    }

    /**
     * Render loading state
     * @private
     */
    _renderLoading() {
        return `
            <div class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div class="flex items-center space-x-2">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span>Loading...</span>
                </div>
            </div>
        `;
    }

    /**
     * Get cell value from row data
     * @private
     */
    _getCellValue(row, column) {
        if (column.getValue) {
            return column.getValue(row);
        }
        
        // Support nested fields with dot notation
        const fields = column.field.split('.');
        let value = row;
        
        for (const field of fields) {
            value = value?.[field];
        }
        
        return value;
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEventListeners() {
        // Sort handlers
        if (this.options.sortable) {
            this.container.querySelectorAll('th[data-sortable="true"]').forEach(th => {
                th.style.cursor = 'pointer';
                th.addEventListener('click', (e) => {
                    const field = th.dataset.field;
                    this.sort(field);
                });
            });
        }
        
        // Selection handlers
        if (this.options.selectable) {
            // Select all checkbox
            const selectAll = this.container.querySelector('.select-all-checkbox');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    this.selectAll(e.target.checked);
                });
            }
            
            // Row checkboxes
            this.container.querySelectorAll('.row-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const rowKey = e.target.dataset.rowKey;
                    this.toggleSelection(rowKey, e.target.checked);
                });
            });
        }
        
        // Row click handler
        if (this.callbacks.onRowClick) {
            this.container.querySelectorAll('tbody tr').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    // Don't trigger on checkbox or button clicks
                    if (e.target.matches('input, button, a')) return;
                    
                    const rowIndex = parseInt(tr.dataset.rowIndex);
                    const row = this.options.data[rowIndex];
                    this.callbacks.onRowClick(row, rowIndex, e);
                });
            });
        }
        
        // Action handlers
        this.container.querySelectorAll('[data-action]').forEach(element => {
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.currentTarget.dataset.action;
                const tr = e.currentTarget.closest('tr');
                const rowIndex = parseInt(tr.dataset.rowIndex);
                const row = this.options.data[rowIndex];
                
                if (this.callbacks.onAction) {
                    this.callbacks.onAction(action, row, rowIndex);
                }
            });
        });
    }

    /**
     * Sort table by column
     */
    sort(field) {
        if (this.state.sortColumn === field) {
            // Toggle direction
            this.state.sortDirection = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column
            this.state.sortColumn = field;
            this.state.sortDirection = 'asc';
        }
        
        if (this.callbacks.onSort) {
            // External sorting
            this.callbacks.onSort(field, this.state.sortDirection);
        } else {
            // Internal sorting
            this._sortData();
            this.render();
        }
    }

    /**
     * Sort data internally
     * @private
     */
    _sortData() {
        const column = this.options.columns.find(col => col.field === this.state.sortColumn);
        if (!column) return;
        
        this.options.data.sort((a, b) => {
            const aVal = this._getCellValue(a, column);
            const bVal = this._getCellValue(b, column);
            
            let result = 0;
            if (aVal === null || aVal === undefined) result = 1;
            else if (bVal === null || bVal === undefined) result = -1;
            else if (typeof aVal === 'number' && typeof bVal === 'number') {
                result = aVal - bVal;
            } else {
                result = String(aVal).localeCompare(String(bVal));
            }
            
            return this.state.sortDirection === 'asc' ? result : -result;
        });
    }

    /**
     * Toggle row selection
     */
    toggleSelection(rowKey, selected) {
        if (selected) {
            this.state.selectedRows.add(rowKey);
        } else {
            this.state.selectedRows.delete(rowKey);
        }
        
        // Update row visual state
        const tr = this.container.querySelector(`tr[data-row-key="${rowKey}"]`);
        if (tr) {
            tr.classList.toggle('selected', selected);
        }
        
        // Update select all checkbox
        this._updateSelectAllState();
        
        if (this.callbacks.onSelect) {
            const selectedData = this.getSelectedRows();
            this.callbacks.onSelect(selectedData);
        }
    }

    /**
     * Select or deselect all rows
     */
    selectAll(selected) {
        if (selected) {
            this.options.data.forEach(row => {
                const rowKey = row[this.options.rowKey];
                this.state.selectedRows.add(rowKey);
            });
        } else {
            this.state.selectedRows.clear();
        }
        
        // Update all checkboxes
        this.container.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.checked = selected;
        });
        
        // Update row visual states
        this.container.querySelectorAll('tbody tr').forEach(tr => {
            tr.classList.toggle('selected', selected);
        });
        
        if (this.callbacks.onSelect) {
            const selectedData = this.getSelectedRows();
            this.callbacks.onSelect(selectedData);
        }
    }

    /**
     * Update select all checkbox state
     * @private
     */
    _updateSelectAllState() {
        const selectAll = this.container.querySelector('.select-all-checkbox');
        if (!selectAll) return;
        
        const totalRows = this.options.data.length;
        const selectedCount = this.state.selectedRows.size;
        
        selectAll.checked = selectedCount === totalRows && totalRows > 0;
        selectAll.indeterminate = selectedCount > 0 && selectedCount < totalRows;
    }

    /**
     * Get selected row data
     */
    getSelectedRows() {
        return this.options.data.filter(row => {
            const rowKey = row[this.options.rowKey];
            return this.state.selectedRows.has(rowKey);
        });
    }

    /**
     * Update table data
     */
    setData(data) {
        this.options.data = data;
        this.state.selectedRows.clear();
        this.render();
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.options.loading = true;
        this.render();
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.options.loading = false;
        this.render();
    }

    /**
     * Refresh the table
     */
    refresh() {
        this.render();
    }

    /**
     * Destroy the table
     */
    destroy() {
        this.container.innerHTML = '';
    }
}

// Add CSS for table styles
const style = document.createElement('style');
style.textContent = `
    .table-striped tbody tr:nth-child(even) {
        background-color: #f9fafb;
    }
    
    .table-hover tbody tr:hover {
        background-color: #f3f4f6;
    }
    
    .table-compact td, .table-compact th {
        padding: 0.5rem 1rem;
    }
    
    tbody tr.selected {
        background-color: #dbeafe !important;
    }
    
    th.sorted {
        background-color: #f9fafb;
    }
    
    .sort-icon {
        font-size: 0.75rem;
        user-select: none;
    }
    
    [data-clickable="true"] {
        cursor: pointer;
    }
`;
document.head.appendChild(style);

export default Table;