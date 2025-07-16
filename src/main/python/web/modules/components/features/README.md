# Feature Components

This directory contains feature-specific components that extend ReactiveComponent to provide complete functionality for different parts of the application.

## ClientManager Component

A comprehensive client management component with full CRUD operations and reactive data binding.

### Features

- **Reactive Data Binding**: Automatically updates when state changes
- **Two-way Binding**: Form inputs stay synchronized with component data
- **Real-time Search**: Debounced search with immediate filtering
- **Pagination**: Built-in pagination controls
- **Modals**: Add/Edit client modals with validation
- **Status Management**: Toggle client active/inactive status
- **Sorting**: Click column headers to sort
- **Selection**: Multi-select with checkbox support
- **Filtering**: Filter by status and city
- **Responsive**: Mobile-friendly design

### Usage

```javascript
import { ClientManager } from './modules/components/features/ClientManager.js';

// Create and mount the component
const clientManager = new ClientManager({
    element: document.getElementById('clientContainer')
});

// The component will automatically:
// - Load clients from the API
// - Set up reactive bindings to the global state
// - Handle all user interactions
// - Update the UI when data changes
```

### State Integration

The component automatically binds to these state paths:
- `clients.all` - All client data
- `clients.filters` - Active filters (search, status, city)
- `navigation.currentClientPage` - Current pagination page

### API Integration

Uses these API endpoints:
- `GET /api/clients` - List clients with filters
- `POST /api/clients` - Create new client
- `PUT /api/clients/by-code/{code}` - Update client
- `PUT /api/clients/by-code/{code}` - Toggle status

### Customization

You can customize the component by passing options:

```javascript
const clientManager = new ClientManager({
    element: document.getElementById('clientContainer'),
    pageSize: 50, // Number of clients per page
    debounceDelay: 500, // Search debounce delay in ms
    onClientSelect: (client) => {
        console.log('Client selected:', client);
    }
});
```

### Events

The component emits these events:
- `client-added` - When a new client is added
- `client-updated` - When a client is updated
- `client-status-changed` - When client status changes
- `clients-loaded` - When client data is loaded

### Component Structure

```
ClientManager
├── Header (title + add button)
├── Filters
│   ├── Search input (debounced)
│   ├── Status filter dropdown
│   └── City filter dropdown
├── Stats Cards
│   ├── Total clients
│   ├── Active clients
│   ├── Inactive clients
│   └── Cities served
├── Client Table
│   ├── Selection checkboxes
│   ├── Sortable columns
│   ├── Action buttons
│   └── Responsive layout
├── Pagination controls
└── Modals
    ├── Add client modal
    └── Edit client modal
```

### Performance Features

- **Debounced Search**: Prevents excessive API calls
- **Virtual Scrolling**: (Can be added for large datasets)
- **Lazy Loading**: Loads data on demand
- **Optimistic Updates**: UI updates before API confirmation
- **Request Cancellation**: Cancels outdated requests

### Security Features

- **XSS Protection**: All user input is sanitized
- **CSRF Protection**: Uses CSRF tokens for mutations
- **Input Validation**: Client and server-side validation
- **Permission Checks**: (Can be added based on user roles)

## Dashboard Component

A real-time dashboard component with statistics, charts, and activity monitoring.

### Features

- **Real-time Statistics**: Live updates of deliveries, revenue, and client metrics
- **Interactive Charts**: Delivery status distribution, revenue trends, driver performance
- **Auto-refresh**: Configurable automatic data refresh
- **Period Selection**: View data for today, week, month, or year
- **Recent Activities**: Live feed of recent delivery activities
- **Responsive Design**: Adapts to different screen sizes
- **Chart.js Integration**: Beautiful, interactive charts

### Usage

```javascript
import { Dashboard } from './modules/components/features/Dashboard.js';

// Create and mount the dashboard
const dashboard = new Dashboard({
    element: document.getElementById('dashboardContainer')
});

// The component will automatically:
// - Display real-time statistics
// - Render interactive charts
// - Update data periodically
// - Handle period selection
```

### State Integration

The component automatically binds to these state paths:
- `deliveries.all` - All delivery data
- `clients.all` - All client data
- `drivers.all` - All driver data

### Computed Properties

- Total deliveries (filtered by period)
- Pending/completed delivery counts
- Total revenue
- Active clients/drivers
- Recent activities

### Charts

1. **Delivery Status Chart** (Doughnut)
   - Shows distribution of delivery statuses
   - Interactive tooltips with percentages

2. **Revenue Trend Chart** (Line)
   - Displays revenue over time
   - Adapts to selected period (hourly/daily/weekly/monthly)

3. **Driver Performance Chart** (Bar)
   - Top 5 drivers by delivery count
   - Updates based on selected period

### Customization

```javascript
const dashboard = new Dashboard({
    element: document.getElementById('dashboardContainer'),
    refreshInterval: 60000, // Refresh every 60 seconds
    autoRefreshEnabled: true, // Enable auto-refresh by default
    defaultPeriod: 'today' // Default period selection
});
```

### Component Structure

```
Dashboard
├── Header
│   ├── Title
│   ├── Period selector
│   ├── Auto-refresh toggle
│   └── Refresh button
├── Statistics Cards
│   ├── Total deliveries
│   ├── Pending deliveries
│   ├── Total revenue
│   └── Active clients
├── Charts Section
│   ├── Delivery status chart
│   └── Revenue trend chart
└── Bottom Section
    ├── Driver performance chart
    └── Recent activities list
```

## Creating New Feature Components

To create a new feature component:

1. Extend `ReactiveComponent`
2. Define reactive `data` properties
3. Set up `computedState` for global state bindings
4. Add `watch` handlers for reactive updates
5. Implement the `template()` method
6. Add API integration methods
7. Handle lifecycle hooks (`mounted`, `destroy`)

Example template:

```javascript
import { ReactiveComponent } from '../ReactiveComponent.js';

export class MyFeature extends ReactiveComponent {
    constructor(options = {}) {
        super({
            name: 'MyFeature',
            data: {
                // Local reactive data
            },
            computedState: {
                // Global state bindings
            },
            watch: {
                // Property watchers
            },
            subscribeTo: [
                // State paths to subscribe to
            ]
        });
    }
    
    template() {
        return `<!-- Component HTML -->`;
    }
}
```