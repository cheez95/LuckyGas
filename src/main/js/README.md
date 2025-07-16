# LuckyGas Frontend Modules

This directory contains the modular ES6 frontend application for LuckyGas.

## Structure

```
src/main/js/
├── core/               # Core functionality
│   ├── api/           # API client modules
│   ├── csrf-manager.js # CSRF protection
│   └── secure-fetch.js # Secure fetch wrapper
├── utils/             # Utility functions
│   ├── validation.js  # Input validation
│   ├── sanitization.js # Data sanitization
│   └── security-utils.js # Security utilities
├── state/             # State management
│   ├── store.js       # Central state store
│   └── integrator.js  # State integration
├── config/            # Configuration
│   └── constants.js   # Application constants
├── components/        # UI components (future)
├── dist/             # Build output
├── index.js          # Main entry point
├── package.json      # Node.js configuration
└── vite.config.js    # Vite build configuration
```

## Development

### Prerequisites
- Node.js 16+ and npm

### Setup
```bash
cd src/main/js
npm install
```

### Development Server
```bash
npm run dev
# Opens at http://localhost:3000
```

### Build for Production
```bash
npm run build
# Or use the build script:
./build.sh
```

### Integration with Flask

The build process creates bundled JavaScript files that can be served by Flask:

1. Build files are output to `dist/`
2. The build script copies them to `../python/web/static/js/`
3. Update `index.html` to load the bundled module:

```html
<!-- Replace individual script tags with: -->
<script type="module" src="/static/js/main.[hash].js"></script>

<!-- For legacy browser support: -->
<script nomodule src="/static/js/main-legacy.[hash].js"></script>
```

## Module System

### ES6 Modules
All new code uses ES6 modules with proper imports/exports.

### Global Access
For backward compatibility, a global `LuckyGas` object is exposed:

```javascript
// Access modules globally
LuckyGas.api.client
LuckyGas.utils.validation
LuckyGas.state.store
```

### Importing Modules
```javascript
// ES6 imports
import { ValidationUtils } from './utils/validation.js';
import store from './state/store.js';

// Or import everything
import LuckyGas from './index.js';
```

## Build Configuration

### Vite Features
- ES6 module bundling
- Legacy browser support
- Source maps for debugging
- Minification for production
- Proxy configuration for API calls

### Browser Support
- Modern browsers (ES2015+)
- Legacy browsers via polyfills
- IE11 not supported

## Security Features

1. **CSRF Protection**: Automatic token management
2. **Input Validation**: Comprehensive validation utilities
3. **XSS Prevention**: Sanitization utilities
4. **Secure Fetch**: Wrapped fetch with security headers

## Next Steps

1. Migrate remaining app.js functionality to modules
2. Create reusable UI components
3. Implement proper TypeScript support
4. Add comprehensive testing
5. Set up CI/CD pipeline