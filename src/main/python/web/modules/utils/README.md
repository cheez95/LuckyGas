# Utilities Module Documentation

This module provides a comprehensive set of utility functions for the LuckyGas web application, organized into logical categories for easy discovery and use.

## Module Structure

```
modules/utils/
├── index.js       # Main export file
├── dom.js         # DOM manipulation utilities
├── datetime.js    # Date/time formatting
├── format.js      # Number/text formatting
├── data.js        # Array/object manipulation
├── security.js    # XSS prevention utilities
└── README.md      # This file
```

## Quick Start

### Import Everything
```javascript
import * as utils from './modules/utils/index.js';

// Use utilities
utils.formatDate(new Date());
utils.formatCurrency(1500);
```

### Import Specific Utilities
```javascript
import { 
    formatDate, 
    formatCurrency, 
    showNotification,
    createElement,
    sortBy 
} from './modules/utils/index.js';
```

### Import by Category
```javascript
import { dom, datetime, format } from './modules/utils/index.js';

// Use category utilities
dom.showNotification('Success!', 'success');
datetime.formatDate(new Date());
format.formatCurrency(1000);
```

## Module Categories

### 🎯 DOM Utilities (`dom.js`)

Safe and efficient DOM manipulation helpers.

**Key Functions:**
- `$(selector)` - Query selector shorthand
- `$$(selector)` - Query selector all shorthand  
- `createElement(tag, attrs, children)` - Safe element creation
- `createModal(content, options)` - Modal dialog creation
- `showNotification(message, type)` - Display notifications
- `showLoading(show, message)` - Loading spinner
- `debounce(func, wait)` - Debounce function calls
- `throttle(func, limit)` - Throttle function calls
- `clearChildren(element)` - Remove all child elements
- `scrollTo(target, options)` - Smooth scrolling

### ⏰ DateTime Utilities (`datetime.js`)

Taiwan locale-specific date/time formatting.

**Key Functions:**
- `formatDate(date)` - Format date (2024/01/15)
- `formatDateTime(date)` - Format date & time
- `formatTime(date)` - Format time only (14:30)
- `getRelativeTime(date)` - "3 小時前"
- `formatDuration(minutes)` - "2 小時 30 分鐘"
- `daysBetween(start, end)` - Calculate days
- `addDays(date, days)` - Add/subtract days
- `isToday(date)` - Check if today
- `formatForInput(date)` - Format for HTML input

### 💰 Format Utilities (`format.js`)

Number, currency, and text formatting for Taiwan.

**Key Functions:**
- `formatCurrency(amount)` - Format TWD ($1,500)
- `formatPhone(phone)` - Format phone (0912-345-678)
- `formatAddress(address)` - Format address display
- `formatStatus(status, context)` - Status with styling
- `formatQuantity(value, unit)` - Numbers with units
- `formatDistance(km)` - Distance (15.5 km)
- `formatPercentage(value)` - Percentage (85%)
- `truncate(text, length)` - Truncate with ellipsis

### 📊 Data Utilities (`data.js`)

Array and object manipulation helpers.

**Key Functions:**
- `sortBy(array, property, order)` - Sort objects
- `sortByMultiple(array, configs)` - Multi-field sort
- `filterBySearch(array, term, fields)` - Search filter
- `groupBy(array, property)` - Group by property
- `paginate(array, page, size)` - Pagination
- `sumBy(array, property)` - Sum values
- `unique(array, property)` - Get unique values
- `deepClone(object)` - Deep clone
- `deepMerge(target, ...sources)` - Deep merge

### 🔒 Security Utilities (`security.js`)

XSS prevention and input sanitization.

**Key Functions:**
- `escapeHtml(text)` - Escape HTML entities
- `sanitizeInput(input)` - Remove dangerous content
- `createSafeElement(tag, attrs, children)` - Safe element
- `isSafeUrl(url)` - Validate URL safety
- `setTemplateContent(element, template, data)` - Safe templates

## Common Usage Patterns

### Creating Elements Safely
```javascript
// Instead of innerHTML
const card = createElement('div', { className: 'card' }, [
    createElement('h3', {}, [escapeHtml(title)]),
    createElement('p', {}, [escapeHtml(description)])
]);
```

### Formatting Dates
```javascript
// Taiwan locale formatting
const today = formatDate(new Date());           // "2024/01/15"
const now = formatDateTime(new Date());         // "2024/01/15 14:30"
const relative = getRelativeTime(lastUpdate);   // "3 小時前"
```

### Working with Arrays
```javascript
// Sort and paginate
const sorted = sortBy(clients, 'name', 'asc');
const page = paginate(sorted, 1, 20);

// Search and filter
const results = filterBySearch(clients, 'wang', ['name', 'address']);

// Group by district
const byDistrict = groupBy(clients, 'district');
```

### Notifications
```javascript
// Show notifications
showNotification('保存成功', 'success');
showNotification('請填寫必要欄位', 'error');
showNotification('載入中...', 'info');
```

## Migration from Legacy Code

See `migration-example.js` for detailed before/after examples of migrating from inline utilities to the modular system.

### Quick Migration Tips

1. **Replace SecurityUtils references:**
   ```javascript
   // Old
   SecurityUtils.createElement(...)
   
   // New
   import { createElement } from './modules/utils/index.js';
   createElement(...)
   ```

2. **Replace inline formatting:**
   ```javascript
   // Old
   date.toLocaleDateString('zh-TW')
   
   // New
   formatDate(date)
   ```

3. **Replace manual DOM manipulation:**
   ```javascript
   // Old
   document.getElementById('id')
   
   // New
   $('#id')
   ```

## Benefits

- **📦 Modular**: Import only what you need
- **🔒 Secure**: Built-in XSS prevention
- **🌏 Localized**: Taiwan-specific formatting
- **⚡ Efficient**: Optimized implementations
- **🧪 Testable**: Unit testable functions
- **📝 Documented**: Clear function documentation
- **♻️ Reusable**: Use across all modules

## Future Enhancements

- Chart utilities for data visualization
- Advanced table utilities (sorting, filtering)
- Form validation utilities
- API request utilities
- State management helpers