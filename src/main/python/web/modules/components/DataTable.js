/**
 * DataTable Component Module
 * Advanced table with pagination, filtering, and server-side data management
 */

import { Table } from './Table.js';
import { dom } from '../utils/dom.js';
import { format } from '../utils/format.js';

export class DataTable extends Table {
    constructor(options = {}) {
        // Extend table options with DataTable specific options
        super({
            ...options,
            data: [] // Will be managed internally
        });
        
        this.dataOptions = {
            url: options.url || null,
            method: options.method || 'GET',
            headers: options.headers || {},
            params: options.params || {},
            pageSize: options.pageSize || 10,
            pageSizes: options.pageSizes || [10, 25, 50, 100],
            serverSide: options.serverSide !== false,
            totalCount: 0,
            filters: options.filters || [],
            searchable: options.searchable !== false,
            searchDelay: options.searchDelay || 300,
            exportable: options.exportable || false,
            ...options
        };
        
        this.state = {
            ...this.state,
            currentPage: 1,
            pageSize: this.dataOptions.pageSize,
            totalPages: 0,
            searchQuery: '',
            filters: {},
            loading: false
        };
        
        this.callbacks = {
            ...this.callbacks,
            onDataLoad: options.onDataLoad || null,
            onExport: options.onExport || null
        };
        
        this.searchTimeout = null;
        
        this._initDataTable();
    }

    /**
     * Initialize DataTable specific features
     * @private
     */
    _initDataTable() {
        // Create wrapper structure
        this._createWrapper();
        
        // Load initial data
        this.loadData();
    }

    /**
     * Create DataTable wrapper with controls
     * @private
     */
    _createWrapper() {
        const wrapper = document.createElement('div');
        wrapper.className = 'datatable-wrapper';
        
        // Insert wrapper
        this.container.parentNode.insertBefore(wrapper, this.container);
        wrapper.appendChild(this.container);
        
        // Create controls container
        const controls = document.createElement('div');
        controls.className = 'datatable-controls';
        wrapper.insertBefore(controls, this.container);
        
        // Create footer container
        const footer = document.createElement('div');
        footer.className = 'datatable-footer';
        wrapper.appendChild(footer);
        
        // Render controls and footer
        this._renderControls();
        this._renderFooter();
    }

    /**
     * Render table controls (search, filters, export)
     * @private
     */
    _renderControls() {
        const controls = this.container.parentNode.querySelector('.datatable-controls');
        
        controls.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div class="flex flex-wrap items-center gap-4">
                    ${this.dataOptions.searchable ? `
                        <div class="search-box">
                            <input type="text" 
                                   class="datatable-search px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                   placeholder="Search..."
                                   value="${dom.escape(this.state.searchQuery)}">
                        </div>
                    ` : ''}
                    ${this._renderFilters()}
                </div>
                <div class="flex items-center gap-2">
                    ${this.dataOptions.exportable ? `
                        <button class="btn-export px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                            Export
                        </button>
                    ` : ''}
                    <select class="page-size-select px-3 py-2 border border-gray-300 rounded-md">
                        ${this.dataOptions.pageSizes.map(size => `
                            <option value="${size}" ${size === this.state.pageSize ? 'selected' : ''}>
                                ${size} per page
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
        
        this._attachControlListeners();
    }

    /**
     * Render filter controls
     * @private
     */
    _renderFilters() {
        if (!this.dataOptions.filters || this.dataOptions.filters.length === 0) {
            return '';
        }
        
        return this.dataOptions.filters.map(filter => {
            switch (filter.type) {
                case 'select':
                    return `
                        <select class="filter-control px-3 py-2 border border-gray-300 rounded-md"
                                data-filter="${filter.field}">
                            <option value="">${filter.placeholder || `All ${filter.label}`}</option>
                            ${filter.options.map(opt => {
                                const value = typeof opt === 'object' ? opt.value : opt;
                                const label = typeof opt === 'object' ? opt.label : opt;
                                return `<option value="${dom.escape(value)}">${dom.escape(label)}</option>`;
                            }).join('')}
                        </select>
                    `;
                    
                case 'date':
                    return `
                        <input type="date" 
                               class="filter-control px-3 py-2 border border-gray-300 rounded-md"
                               data-filter="${filter.field}"
                               placeholder="${filter.placeholder || filter.label}">
                    `;
                    
                case 'daterange':
                    return `
                        <div class="flex items-center gap-2">
                            <input type="date" 
                                   class="filter-control px-3 py-2 border border-gray-300 rounded-md"
                                   data-filter="${filter.field}_from"
                                   placeholder="${filter.label} from">
                            <span class="text-gray-500">to</span>
                            <input type="date" 
                                   class="filter-control px-3 py-2 border border-gray-300 rounded-md"
                                   data-filter="${filter.field}_to"
                                   placeholder="${filter.label} to">
                        </div>
                    `;
                    
                default:
                    return '';
            }
        }).join('');
    }

    /**
     * Render table footer with pagination
     * @private
     */
    _renderFooter() {
        const footer = this.container.parentNode.querySelector('.datatable-footer');
        
        const start = (this.state.currentPage - 1) * this.state.pageSize + 1;
        const end = Math.min(this.state.currentPage * this.state.pageSize, this.dataOptions.totalCount);
        
        footer.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-4 mt-4">
                <div class="text-sm text-gray-700">
                    Showing <span class="font-medium">${start}</span> to 
                    <span class="font-medium">${end}</span> of 
                    <span class="font-medium">${this.dataOptions.totalCount}</span> results
                </div>
                <div class="pagination flex items-center gap-2">
                    ${this._renderPagination()}
                </div>
            </div>
        `;
        
        this._attachPaginationListeners();
    }

    /**
     * Render pagination controls
     * @private
     */
    _renderPagination() {
        const pages = [];
        const totalPages = this.state.totalPages;
        const currentPage = this.state.currentPage;
        
        // Previous button
        pages.push(`
            <button class="page-btn px-3 py-1 border rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}"
                    data-page="${currentPage - 1}"
                    ${currentPage === 1 ? 'disabled' : ''}>
                Previous
            </button>
        `);
        
        // Page numbers
        const maxVisible = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            pages.push(`
                <button class="page-btn px-3 py-1 border rounded hover:bg-gray-100" data-page="1">1</button>
            `);
            if (startPage > 2) {
                pages.push(`<span class="px-2">...</span>`);
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push(`
                <button class="page-btn px-3 py-1 border rounded ${i === currentPage ? 'bg-primary text-white' : 'hover:bg-gray-100'}"
                        data-page="${i}">
                    ${i}
                </button>
            `);
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pages.push(`<span class="px-2">...</span>`);
            }
            pages.push(`
                <button class="page-btn px-3 py-1 border rounded hover:bg-gray-100" data-page="${totalPages}">${totalPages}</button>
            `);
        }
        
        // Next button
        pages.push(`
            <button class="page-btn px-3 py-1 border rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}"
                    data-page="${currentPage + 1}"
                    ${currentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        `);
        
        return pages.join('');
    }

    /**
     * Attach control event listeners
     * @private
     */
    _attachControlListeners() {
        const controls = this.container.parentNode.querySelector('.datatable-controls');
        
        // Search input
        const searchInput = controls.querySelector('.datatable-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.search(e.target.value);
                }, this.dataOptions.searchDelay);
            });
        }
        
        // Filters
        controls.querySelectorAll('.filter-control').forEach(filter => {
            filter.addEventListener('change', (e) => {
                const field = e.target.dataset.filter;
                this.setFilter(field, e.target.value);
            });
        });
        
        // Page size
        const pageSizeSelect = controls.querySelector('.page-size-select');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.setPageSize(parseInt(e.target.value));
            });
        }
        
        // Export button
        const exportBtn = controls.querySelector('.btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.export();
            });
        }
    }

    /**
     * Attach pagination event listeners
     * @private
     */
    _attachPaginationListeners() {
        const footer = this.container.parentNode.querySelector('.datatable-footer');
        
        footer.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                this.goToPage(page);
            });
        });
    }

    /**
     * Load data from server or local source
     */
    async loadData() {
        if (!this.dataOptions.serverSide) {
            // Local data mode
            this._processLocalData();
            return;
        }
        
        this.showLoading();
        
        try {
            const params = {
                ...this.dataOptions.params,
                page: this.state.currentPage,
                limit: this.state.pageSize,
                search: this.state.searchQuery,
                ...this.state.filters
            };
            
            // Clean empty params
            Object.keys(params).forEach(key => {
                if (params[key] === '' || params[key] === null || params[key] === undefined) {
                    delete params[key];
                }
            });
            
            const response = await fetch(this.dataOptions.url + '?' + new URLSearchParams(params), {
                method: this.dataOptions.method,
                headers: this.dataOptions.headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update data and state
            this.options.data = data.data || data.items || data.results || data;
            this.dataOptions.totalCount = data.total || data.totalCount || data.count || this.options.data.length;
            this.state.totalPages = Math.ceil(this.dataOptions.totalCount / this.state.pageSize);
            
            // Re-render table and footer
            this.render();
            this._renderFooter();
            
            if (this.callbacks.onDataLoad) {
                this.callbacks.onDataLoad(data);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            this.options.data = [];
            this.render();
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Process local data with filtering and pagination
     * @private
     */
    _processLocalData() {
        let filteredData = [...this.dataOptions.localData || []];
        
        // Apply search
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            filteredData = filteredData.filter(row => {
                return Object.values(row).some(value => 
                    String(value).toLowerCase().includes(query)
                );
            });
        }
        
        // Apply filters
        Object.entries(this.state.filters).forEach(([field, value]) => {
            if (value) {
                filteredData = filteredData.filter(row => row[field] === value);
            }
        });
        
        // Update total count
        this.dataOptions.totalCount = filteredData.length;
        this.state.totalPages = Math.ceil(this.dataOptions.totalCount / this.state.pageSize);
        
        // Apply pagination
        const start = (this.state.currentPage - 1) * this.state.pageSize;
        const end = start + this.state.pageSize;
        this.options.data = filteredData.slice(start, end);
        
        // Re-render
        this.render();
        this._renderFooter();
    }

    /**
     * Search data
     */
    search(query) {
        this.state.searchQuery = query;
        this.state.currentPage = 1; // Reset to first page
        this.loadData();
    }

    /**
     * Set filter value
     */
    setFilter(field, value) {
        if (value) {
            this.state.filters[field] = value;
        } else {
            delete this.state.filters[field];
        }
        this.state.currentPage = 1; // Reset to first page
        this.loadData();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.state.filters = {};
        this.state.searchQuery = '';
        this.state.currentPage = 1;
        
        // Update UI
        const controls = this.container.parentNode.querySelector('.datatable-controls');
        controls.querySelectorAll('.filter-control').forEach(filter => {
            filter.value = '';
        });
        const searchInput = controls.querySelector('.datatable-search');
        if (searchInput) searchInput.value = '';
        
        this.loadData();
    }

    /**
     * Go to specific page
     */
    goToPage(page) {
        if (page < 1 || page > this.state.totalPages) return;
        this.state.currentPage = page;
        this.loadData();
    }

    /**
     * Set page size
     */
    setPageSize(size) {
        this.state.pageSize = size;
        this.state.currentPage = 1; // Reset to first page
        this.loadData();
    }

    /**
     * Refresh data
     */
    refresh() {
        this.loadData();
    }

    /**
     * Export data
     */
    async export() {
        if (this.callbacks.onExport) {
            await this.callbacks.onExport(this.options.data);
            return;
        }
        
        // Default CSV export
        const headers = this.options.columns
            .filter(col => col.field !== 'selection' && col.exportable !== false)
            .map(col => col.label);
            
        const rows = this.options.data.map(row => {
            return this.options.columns
                .filter(col => col.field !== 'selection' && col.exportable !== false)
                .map(col => {
                    const value = this._getCellValue(row, col);
                    return typeof value === 'string' && value.includes(',') 
                        ? `"${value}"` 
                        : value;
                });
        });
        
        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${format.date(new Date(), 'YYYY-MM-DD_HH-mm-ss')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Override sort to work with server-side data
     */
    sort(field) {
        super.sort(field);
        
        if (this.dataOptions.serverSide) {
            // Add sort params and reload
            this.dataOptions.params.sort = field;
            this.dataOptions.params.order = this.state.sortDirection;
            this.loadData();
        }
    }
}

// Add CSS for DataTable styles
const style = document.createElement('style');
style.textContent = `
    .datatable-wrapper {
        position: relative;
    }
    
    .datatable-controls {
        margin-bottom: 1rem;
    }
    
    .datatable-footer {
        margin-top: 1rem;
    }
    
    .pagination {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .page-btn {
        min-width: 2.5rem;
        text-align: center;
    }
`;
document.head.appendChild(style);

export default DataTable;