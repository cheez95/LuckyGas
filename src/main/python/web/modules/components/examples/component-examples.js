/**
 * Component Usage Examples
 * Demonstrates how to use the Component and ReactiveComponent classes
 */

import { Component } from '../Component.js';
import { ReactiveComponent } from '../ReactiveComponent.js';
import store from '../../../src/main/js/state/store.js';

/**
 * Example 1: Basic Component with State Subscription
 * A simple counter that subscribes to global state
 */
class CounterComponent extends Component {
    constructor() {
        super({
            name: 'Counter',
            subscribeTo: ['ui.counter'],
            state: {
                localCount: 0
            },
            events: {
                'click .increment': 'handleIncrement',
                'click .decrement': 'handleDecrement',
                'click .reset': 'handleReset'
            }
        });
    }

    template() {
        const globalCount = store.get('ui.counter') || 0;
        return `
            <div class="counter-widget p-4 bg-white rounded shadow">
                <h3 class="text-lg font-bold mb-2">Counter Component</h3>
                <div class="mb-4">
                    <p>Global Count: <span class="font-bold text-blue-600">${globalCount}</span></p>
                    <p>Local Count: <span class="font-bold text-green-600">${this.localState.localCount}</span></p>
                </div>
                <div class="flex space-x-2">
                    <button class="increment px-3 py-1 bg-blue-500 text-white rounded">+1 Global</button>
                    <button class="decrement px-3 py-1 bg-red-500 text-white rounded">-1 Global</button>
                    <button class="reset px-3 py-1 bg-gray-500 text-white rounded">Reset</button>
                </div>
            </div>
        `;
    }

    handleIncrement() {
        // Update global state
        const current = store.get('ui.counter') || 0;
        store.set('ui.counter', current + 1);
        
        // Update local state
        this.setState({ localCount: this.localState.localCount + 1 });
    }

    handleDecrement() {
        const current = store.get('ui.counter') || 0;
        store.set('ui.counter', current - 1);
    }

    handleReset() {
        store.set('ui.counter', 0);
        this.setState({ localCount: 0 });
    }

    mounted() {
        console.log('Counter component mounted');
    }
}

/**
 * Example 2: Reactive Component with Two-Way Binding
 * A form component with reactive data binding
 */
class UserFormComponent extends ReactiveComponent {
    constructor() {
        super({
            name: 'UserForm',
            data: {
                user: {
                    name: '',
                    email: '',
                    role: 'user',
                    notifications: true
                },
                errors: {}
            },
            watch: {
                'user.email': function(newEmail, oldEmail) {
                    // Validate email on change
                    if (newEmail && !this.isValidEmail(newEmail)) {
                        this.data.errors = { ...this.data.errors, email: 'Invalid email format' };
                    } else {
                        const { email, ...rest } = this.data.errors;
                        this.data.errors = rest;
                    }
                }
            },
            events: {
                'submit form': 'handleSubmit',
                'click .clear': 'handleClear'
            },
            filters: {
                uppercase: (value) => value ? value.toUpperCase() : '',
                titleCase: (value) => value ? value.replace(/\w\S*/g, 
                    txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : ''
            }
        });
    }

    template() {
        return `
            <div class="user-form p-6 bg-white rounded-lg shadow">
                <h3 class="text-xl font-bold mb-4">User Form (Reactive)</h3>
                
                <form class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Name</label>
                        <input type="text" v-model="user.name" 
                               class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2">
                        <p class="text-sm text-gray-600 mt-1">
                            Preview: {{ user.name | titleCase }}
                        </p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Email</label>
                        <input type="email" v-model="user.email" 
                               class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2">
                        ${this.data.errors.email ? 
                            `<p class="text-sm text-red-600 mt-1">${this.data.errors.email}</p>` : ''}
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Role</label>
                        <select v-model="user.role" 
                                class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                        </select>
                    </div>

                    <div>
                        <label class="flex items-center">
                            <input type="checkbox" v-model="user.notifications" class="mr-2">
                            <span class="text-sm">Receive notifications</span>
                        </label>
                    </div>

                    <div class="flex space-x-2 pt-4">
                        <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            Submit
                        </button>
                        <button type="button" class="clear px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                            Clear
                        </button>
                    </div>
                </form>

                <div class="mt-6 p-4 bg-gray-100 rounded">
                    <h4 class="font-bold mb-2">Current Data:</h4>
                    <pre class="text-sm">${JSON.stringify(this.data.user, null, 2)}</pre>
                </div>
            </div>
        `;
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    handleSubmit(event) {
        event.preventDefault();
        console.log('Form submitted:', this.data.user);
        
        // Emit custom event with form data
        this.emit('user-submitted', this.data.user);
        
        // Show notification (using global state)
        store.set('ui.notification', {
            type: 'success',
            message: `User ${this.data.user.name} saved successfully!`
        });
    }

    handleClear() {
        this.data.user = {
            name: '',
            email: '',
            role: 'user',
            notifications: true
        };
        this.data.errors = {};
    }
}

/**
 * Example 3: Computed Properties and State Integration
 * A delivery list component that computes filtered results
 */
class DeliveryListComponent extends ReactiveComponent {
    constructor() {
        super({
            name: 'DeliveryList',
            subscribeTo: ['deliveries.all', 'deliveries.filters'],
            computedState: {
                // Simple state mapping
                allDeliveries: 'deliveries.all',
                
                // Complex computed with dependencies
                filteredDeliveries: {
                    dependencies: ['deliveries.all', 'deliveries.filters'],
                    compute: (deliveries, filters) => {
                        if (!deliveries) return [];
                        
                        return deliveries.filter(delivery => {
                            if (filters.status !== 'all' && delivery.status !== filters.status) {
                                return false;
                            }
                            if (filters.search && !delivery.customerName.toLowerCase()
                                .includes(filters.search.toLowerCase())) {
                                return false;
                            }
                            return true;
                        });
                    }
                }
            },
            data: {
                selectedIds: []
            },
            events: {
                'click .delivery-row': 'handleRowClick',
                'change .select-all': 'handleSelectAll'
            }
        });
    }

    template() {
        const deliveries = this.computedState.filteredDeliveries || [];
        
        return `
            <div class="delivery-list">
                <div class="mb-4 p-4 bg-gray-100 rounded">
                    <h3 class="font-bold">Filtered Deliveries (${deliveries.length})</h3>
                    <p class="text-sm text-gray-600">
                        Selected: ${this.data.selectedIds.length}
                    </p>
                </div>

                <table class="w-full border-collapse">
                    <thead>
                        <tr class="bg-gray-200">
                            <th class="p-2 text-left">
                                <input type="checkbox" class="select-all">
                            </th>
                            <th class="p-2 text-left">Customer</th>
                            <th class="p-2 text-left">Status</th>
                            <th class="p-2 text-left">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${deliveries.map(delivery => `
                            <tr class="delivery-row border-b hover:bg-gray-50 cursor-pointer" 
                                data-id="${delivery.id}">
                                <td class="p-2">
                                    <input type="checkbox" 
                                           ${this.data.selectedIds.includes(delivery.id) ? 'checked' : ''}>
                                </td>
                                <td class="p-2">${delivery.customerName}</td>
                                <td class="p-2">
                                    <span class="px-2 py-1 text-xs rounded 
                                          ${this.getStatusClass(delivery.status)}">
                                        ${delivery.status}
                                    </span>
                                </td>
                                <td class="p-2">${delivery.date}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    getStatusClass(status) {
        const classes = {
            pending: 'bg-yellow-200 text-yellow-800',
            completed: 'bg-green-200 text-green-800',
            cancelled: 'bg-red-200 text-red-800'
        };
        return classes[status] || 'bg-gray-200 text-gray-800';
    }

    handleRowClick(event, target) {
        const row = target.closest('.delivery-row');
        if (!row) return;
        
        const id = parseInt(row.dataset.id);
        const checkbox = row.querySelector('input[type="checkbox"]');
        
        if (event.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
        }
        
        if (checkbox.checked) {
            this.data.selectedIds = [...this.data.selectedIds, id];
        } else {
            this.data.selectedIds = this.data.selectedIds.filter(sid => sid !== id);
        }
    }

    handleSelectAll(event) {
        const deliveries = this.computedState.filteredDeliveries || [];
        
        if (event.target.checked) {
            this.data.selectedIds = deliveries.map(d => d.id);
        } else {
            this.data.selectedIds = [];
        }
    }

    onStateChange(path, newValue, oldValue) {
        // Custom state change handling
        console.log(`State changed: ${path}`, { newValue, oldValue });
        
        // Clear selections when filters change
        if (path === 'deliveries.filters') {
            this.data.selectedIds = [];
        }
        
        // Call parent implementation
        super.onStateChange(path, newValue, oldValue);
    }
}

/**
 * Example 4: Lifecycle Methods and Error Handling
 * A component that demonstrates all lifecycle hooks
 */
class LifecycleComponent extends Component {
    constructor() {
        super({
            name: 'Lifecycle',
            state: {
                phase: 'initialized',
                errorCount: 0
            },
            events: {
                'click .trigger-error': 'triggerError',
                'click .async-operation': 'performAsyncOperation'
            }
        });
    }

    async init() {
        console.log('1. init() - Component initializing');
        this.setState({ phase: 'initializing' });
        
        // Simulate async initialization
        await new Promise(resolve => setTimeout(resolve, 500));
        this.setState({ phase: 'initialized' });
    }

    async mounted() {
        console.log('2. mounted() - Component mounted to DOM');
        this.setState({ phase: 'mounted' });
    }

    updated() {
        console.log('3. updated() - Component re-rendered');
    }

    template() {
        return `
            <div class="lifecycle-demo p-4 bg-white rounded shadow">
                <h3 class="text-lg font-bold mb-2">Lifecycle Demo</h3>
                <p>Current Phase: <span class="font-bold">${this.localState.phase}</span></p>
                <p>Error Count: <span class="font-bold">${this.localState.errorCount}</span></p>
                
                <div class="mt-4 space-x-2">
                    <button class="trigger-error px-3 py-1 bg-red-500 text-white rounded">
                        Trigger Error
                    </button>
                    <button class="async-operation px-3 py-1 bg-blue-500 text-white rounded">
                        Async Operation
                    </button>
                </div>
            </div>
        `;
    }

    triggerError() {
        throw new Error('Intentional error for demonstration');
    }

    async performAsyncOperation() {
        this.setState({ phase: 'async-operation-started' });
        
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.setState({ phase: 'async-operation-completed' });
        } catch (error) {
            this.onError(error);
        }
    }

    onError(error) {
        console.error('4. onError() - Error caught:', error);
        this.setState({ 
            errorCount: this.localState.errorCount + 1,
            phase: 'error'
        });
    }

    async beforeDestroy() {
        console.log('5. beforeDestroy() - Component about to be destroyed');
        this.setState({ phase: 'destroying' });
    }

    async destroyed() {
        console.log('6. destroyed() - Component destroyed and cleaned up');
    }
}

/**
 * Usage Examples
 */

// Example: Mount components to the page
function initializeExamples() {
    // Initialize global state if needed
    store.set('ui.counter', 0);
    store.set('deliveries.all', [
        { id: 1, customerName: 'John Doe', status: 'pending', date: '2025-01-16' },
        { id: 2, customerName: 'Jane Smith', status: 'completed', date: '2025-01-15' },
        { id: 3, customerName: 'Bob Johnson', status: 'pending', date: '2025-01-16' }
    ]);
    store.set('deliveries.filters', { status: 'all', search: '' });

    // Mount components
    const counter = new CounterComponent();
    counter.mount('#counter-container');

    const userForm = new UserFormComponent();
    userForm.mount('#form-container');

    const deliveryList = new DeliveryListComponent();
    deliveryList.mount('#delivery-list-container');

    const lifecycle = new LifecycleComponent();
    lifecycle.mount('#lifecycle-container');

    // Listen for custom events
    document.addEventListener('user-submitted', (event) => {
        console.log('User submitted event received:', event.detail);
    });

    // Example of programmatic component control
    window.demoComponents = {
        counter,
        userForm,
        deliveryList,
        lifecycle
    };
}

// Export examples
export {
    CounterComponent,
    UserFormComponent,
    DeliveryListComponent,
    LifecycleComponent,
    initializeExamples
};