# LuckyGas Component Testing Guide

## Overview

This directory contains the comprehensive testing framework for LuckyGas components. The tests ensure reliability, maintainability, and quality of the component system.

## Test Structure

```
__tests__/
├── utils/                    # Testing utilities and helpers
│   ├── component-helpers.js  # Component mounting and testing utilities
│   ├── dom-helpers.js        # DOM manipulation and testing utilities
│   └── mock-factories.js     # Mock data factories
└── README.md                 # This file

components/__tests__/
├── Component.test.js         # Base Component class tests
├── ReactiveComponent.test.js # ReactiveComponent tests
└── ClientManager.test.js     # ClientManager feature tests
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only component tests
npm run test:components

# Debug tests in Chrome DevTools
npm run test:debug

# Run tests in CI environment
npm run test:ci
```

### Running Specific Tests

```bash
# Run a specific test file
npm test Component.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="should mount"

# Run tests in a specific directory
npm test components/__tests__
```

## Writing Tests

### Basic Component Test Structure

```javascript
import { Component } from '../Component.js';
import { mountComponent } from '../../__tests__/utils/component-helpers.js';

describe('MyComponent', () => {
    let wrapper;
    
    afterEach(async () => {
        if (wrapper) {
            await wrapper.destroy();
        }
    });
    
    test('should render correctly', async () => {
        wrapper = await mountComponent(Component, {
            template: () => '<div>Hello World</div>'
        });
        
        expect(wrapper.text('div')).toBe('Hello World');
    });
});
```

### Testing Reactive Components

```javascript
import { ReactiveComponent } from '../ReactiveComponent.js';
import { mountReactiveComponent } from '../../__tests__/utils/component-helpers.js';

describe('MyReactiveComponent', () => {
    test('should react to store changes', async () => {
        const wrapper = await mountReactiveComponent(ReactiveComponent, {
            template: function() {
                return `<div>${this.getStoreValue('count') || 0}</div>`;
            },
            subscribeTo: ['count']
        });
        
        await wrapper.updateStore('count', 5);
        expect(wrapper.text('div')).toBe('5');
        
        await wrapper.destroy();
    });
});
```

## Test Utilities

### Component Helpers

- **mountComponent(ComponentClass, options)** - Mounts a component for testing
- **mountReactiveComponent(ComponentClass, options)** - Mounts a reactive component
- **createMockComponent(overrides)** - Creates a mock component instance
- **spyOnMethod(component, methodName)** - Creates a spy for component methods
- **waitForUpdate(component, condition, timeout)** - Waits for component updates
- **mockApiResponses(responses)** - Mocks API fetch responses
- **createMockState(initialState)** - Creates a mock state manager

### DOM Helpers

- **waitForElement(selector, timeout)** - Waits for element to appear
- **waitForElementToBeRemoved(selector, timeout)** - Waits for element removal
- **simulateDragAndDrop(source, target)** - Simulates drag and drop
- **simulateFileInput(input, files)** - Simulates file selection
- **triggerCustomEvent(element, eventType, detail)** - Triggers custom events
- **getElementDimensions(element)** - Gets element dimensions

### Mock Factories

- **createMockClient(overrides)** - Creates mock client data
- **createMockDelivery(overrides)** - Creates mock delivery data
- **createMockDriver(overrides)** - Creates mock driver data
- **createMockApiResponse(data, options)** - Creates mock API response
- **createBatch(factory, count, modifier)** - Creates multiple mock objects

## Testing Best Practices

### 1. Test Structure

- Use descriptive test names that explain what is being tested
- Group related tests using `describe` blocks
- Keep tests focused on a single behavior
- Use `beforeEach`/`afterEach` for setup and cleanup

### 2. Component Testing

- Always clean up components after tests using `destroy()`
- Test both happy path and error scenarios
- Test lifecycle hooks (init, mounted, destroyed)
- Test event handling and user interactions
- Test state changes and reactivity

### 3. Async Testing

- Use `async/await` for asynchronous operations
- Use `flushPromises()` to wait for all promises
- Use `waitFor()` utilities for conditional waiting
- Always await component mounting and state changes

### 4. Mocking

- Mock external dependencies (API calls, timers, etc.)
- Use mock factories for consistent test data
- Reset mocks between tests
- Verify mock calls when testing integrations

### 5. Coverage Goals

- Aim for 80%+ code coverage
- Focus on critical paths and edge cases
- Test error handling and recovery
- Don't sacrifice quality for coverage numbers

## Common Testing Patterns

### Testing Events

```javascript
test('should handle click events', async () => {
    const handleClick = jest.fn();
    
    const wrapper = await mountComponent(Component, {
        template: () => '<button class="btn">Click</button>',
        events: {
            'click .btn': handleClick
        }
    });
    
    await wrapper.click('.btn');
    expect(handleClick).toHaveBeenCalled();
});
```

### Testing API Integration

```javascript
test('should load data from API', async () => {
    mockApiResponses({
        '/api/clients': createMockApiResponse([
            createMockClient({ name: 'Test Client' })
        ])
    });
    
    const wrapper = await mountComponent(ClientList, {});
    
    await waitForElement('.client-item');
    expect(wrapper.text('.client-name')).toBe('Test Client');
});
```

### Testing State Management

```javascript
test('should update local state', async () => {
    const wrapper = await mountComponent(Component, {
        template: function() {
            return `<div>${this.localState.count}</div>`;
        },
        state: { count: 0 }
    });
    
    await wrapper.setState({ count: 5 });
    expect(wrapper.text('div')).toBe('5');
});
```

### Testing Computed Properties

```javascript
test('should compute derived values', async () => {
    const wrapper = await mountComponent(Component, {
        state: { firstName: 'John', lastName: 'Doe' },
        computed: {
            fullName() {
                return `${this.localState.firstName} ${this.localState.lastName}`;
            }
        }
    });
    
    expect(wrapper.component.fullName).toBe('John Doe');
});
```

## Debugging Tests

### Using Chrome DevTools

1. Run tests in debug mode: `npm run test:debug`
2. Open Chrome and navigate to `chrome://inspect`
3. Click "Inspect" on the Node process
4. Use breakpoints and debugger statements

### Common Issues

1. **Async timing issues**: Use `waitFor` utilities and `flushPromises()`
2. **Component not cleaning up**: Always call `destroy()` in `afterEach`
3. **Mock not working**: Check mock is set up before component mounts
4. **State not updating**: Ensure using proper reactive patterns

## CI/CD Integration

Tests are automatically run in CI with:
- Coverage reporting
- Parallel execution for speed
- Failure notifications
- Coverage trend tracking

## Contributing

When adding new components:
1. Create corresponding test file in `__tests__`
2. Cover all public methods and behaviors
3. Test error scenarios
4. Update this documentation if needed
5. Ensure tests pass before committing

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)