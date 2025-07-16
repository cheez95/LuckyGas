/**
 * ReactiveComponent Tests
 * Tests for reactive component functionality with state management
 */

import { ReactiveComponent } from '../ReactiveComponent.js';
import { mountReactiveComponent, createMockState } from '../../../__tests__/utils/component-helpers.js';
import store from '../../state/store.js';

describe('ReactiveComponent', () => {
    let originalStore;
    
    beforeEach(() => {
        // Save original store state
        originalStore = store.getState();
        store.setState({});
    });
    
    afterEach(() => {
        // Restore original store state
        store.setState(originalStore);
    });
    
    describe('Constructor', () => {
        test('should extend Component class', () => {
            const component = new ReactiveComponent();
            expect(component).toBeInstanceOf(ReactiveComponent);
            expect(component.name).toBe('ReactiveComponent');
        });
        
        test('should initialize with reactive options', () => {
            const component = new ReactiveComponent({
                name: 'TestReactive',
                reactive: true,
                computedFromStore: {
                    userCount: 'users.count'
                }
            });
            
            expect(component.reactive).toBe(true);
            expect(component.computedFromStore).toEqual({
                userCount: 'users.count'
            });
        });
    });
    
    describe('Store Integration', () => {
        test('should subscribe to store paths', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    return `<div class="count">${this.getStoreValue('counter') || 0}</div>`;
                },
                subscribeTo: ['counter']
            });
            
            expect(wrapper.text('.count')).toBe('0');
            
            await wrapper.updateStore('counter', 5);
            expect(wrapper.text('.count')).toBe('5');
            
            await wrapper.destroy();
        });
        
        test('should handle multiple store subscriptions', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    return `
                        <div class="user">${this.getStoreValue('user.name') || 'Guest'}</div>
                        <div class="theme">${this.getStoreValue('ui.theme') || 'light'}</div>
                    `;
                },
                subscribeTo: ['user.name', 'ui.theme']
            });
            
            expect(wrapper.text('.user')).toBe('Guest');
            expect(wrapper.text('.theme')).toBe('light');
            
            await wrapper.updateStore('user.name', 'John');
            expect(wrapper.text('.user')).toBe('John');
            
            await wrapper.updateStore('ui.theme', 'dark');
            expect(wrapper.text('.theme')).toBe('dark');
            
            await wrapper.destroy();
        });
        
        test('should unsubscribe on destroy', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: () => '<div>Test</div>',
                subscribeTo: ['test.value']
            });
            
            const subscriptions = wrapper.component.subscriptions;
            expect(subscriptions.length).toBeGreaterThan(0);
            
            await wrapper.destroy();
            
            // Verify subscriptions are cleared
            expect(wrapper.component.subscriptions.length).toBe(0);
        });
    });
    
    describe('Computed Properties from Store', () => {
        test('should create computed properties from store paths', async () => {
            await store.set('users.list', [1, 2, 3]);
            
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    return `<div class="count">${this.userCount}</div>`;
                },
                computedFromStore: {
                    userCount: (state) => state.users?.list?.length || 0
                }
            });
            
            expect(wrapper.text('.count')).toBe('3');
            
            await wrapper.updateStore('users.list', [1, 2, 3, 4, 5]);
            expect(wrapper.text('.count')).toBe('5');
            
            await wrapper.destroy();
        });
        
        test('should handle complex computed properties', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    return `<div class="summary">${this.summary}</div>`;
                },
                computedFromStore: {
                    summary: (state) => {
                        const users = state.users?.count || 0;
                        const tasks = state.tasks?.count || 0;
                        return `Users: ${users}, Tasks: ${tasks}`;
                    }
                }
            });
            
            expect(wrapper.text('.summary')).toBe('Users: 0, Tasks: 0');
            
            await wrapper.updateStore('users.count', 5);
            await wrapper.updateStore('tasks.count', 10);
            
            expect(wrapper.text('.summary')).toBe('Users: 5, Tasks: 10');
            
            await wrapper.destroy();
        });
    });
    
    describe('Store Methods', () => {
        test('should get store values', async () => {
            await store.set('app.version', '1.0.0');
            
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: () => '<div>Test</div>'
            });
            
            expect(wrapper.component.getStoreValue('app.version')).toBe('1.0.0');
            expect(wrapper.component.getStoreValue('non.existent')).toBeUndefined();
            
            await wrapper.destroy();
        });
        
        test('should set store values', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: () => '<div>Test</div>'
            });
            
            wrapper.component.setStoreValue('app.name', 'TestApp');
            expect(store.get('app.name')).toBe('TestApp');
            
            await wrapper.destroy();
        });
        
        test('should dispatch store actions', async () => {
            // Mock store dispatch
            store.dispatch = jest.fn();
            
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: () => '<div>Test</div>'
            });
            
            wrapper.component.dispatch('updateUser', { id: 1, name: 'John' });
            
            expect(store.dispatch).toHaveBeenCalledWith('updateUser', { id: 1, name: 'John' });
            
            await wrapper.destroy();
        });
    });
    
    describe('Reactive Features', () => {
        test('should auto-subscribe to used store paths', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                reactive: true,
                template: function() {
                    // Access store values in template
                    const user = this.getStoreValue('currentUser') || {};
                    const theme = this.getStoreValue('theme') || 'light';
                    
                    return `
                        <div class="user">${user.name || 'Guest'}</div>
                        <div class="theme">${theme}</div>
                    `;
                }
            });
            
            expect(wrapper.text('.user')).toBe('Guest');
            expect(wrapper.text('.theme')).toBe('light');
            
            // Component should react to these changes
            await wrapper.updateStore('currentUser', { name: 'Alice' });
            expect(wrapper.text('.user')).toBe('Alice');
            
            await wrapper.updateStore('theme', 'dark');
            expect(wrapper.text('.theme')).toBe('dark');
            
            await wrapper.destroy();
        });
        
        test('should handle nested reactive updates', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    const items = this.getStoreValue('items') || [];
                    return `
                        <ul>
                            ${items.map(item => `<li>${item.name}: ${item.count}</li>`).join('')}
                        </ul>
                    `;
                },
                subscribeTo: ['items']
            });
            
            expect(wrapper.findAll('li').length).toBe(0);
            
            await wrapper.updateStore('items', [
                { name: 'Item 1', count: 5 },
                { name: 'Item 2', count: 10 }
            ]);
            
            const items = wrapper.findAll('li');
            expect(items.length).toBe(2);
            expect(items[0].textContent).toBe('Item 1: 5');
            expect(items[1].textContent).toBe('Item 2: 10');
            
            await wrapper.destroy();
        });
    });
    
    describe('Performance', () => {
        test('should batch multiple store updates', async () => {
            const renderSpy = jest.fn();
            
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    renderSpy();
                    return '<div>Test</div>';
                },
                subscribeTo: ['value1', 'value2', 'value3']
            });
            
            renderSpy.mockClear();
            
            // Batch updates
            store.setState({
                value1: 'a',
                value2: 'b',
                value3: 'c'
            });
            
            await flushPromises();
            
            // Should only render once for batched updates
            expect(renderSpy).toHaveBeenCalledTimes(1);
            
            await wrapper.destroy();
        });
        
        test('should not re-render for unsubscribed paths', async () => {
            const renderSpy = jest.fn();
            
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    renderSpy();
                    return `<div>${this.getStoreValue('subscribed') || 'default'}</div>`;
                },
                subscribeTo: ['subscribed']
            });
            
            renderSpy.mockClear();
            
            // Update unsubscribed path
            await wrapper.updateStore('unsubscribed', 'value');
            
            expect(renderSpy).not.toHaveBeenCalled();
            
            // Update subscribed path
            await wrapper.updateStore('subscribed', 'new value');
            
            expect(renderSpy).toHaveBeenCalledTimes(1);
            
            await wrapper.destroy();
        });
    });
    
    describe('Error Handling', () => {
        test('should handle store access errors gracefully', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    try {
                        // Attempt to access undefined nested property
                        const value = this.getStoreValue('deep.nested.undefined.path');
                        return `<div>${value || 'Safe'}</div>`;
                    } catch (e) {
                        return '<div>Error</div>';
                    }
                }
            });
            
            expect(wrapper.text('div')).toBe('Safe');
            
            await wrapper.destroy();
        });
        
        test('should handle compute errors', async () => {
            console.error = jest.fn();
            
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    return `<div>${this.errorComputed || 'Fallback'}</div>`;
                },
                computedFromStore: {
                    errorComputed: () => {
                        throw new Error('Compute error');
                    }
                }
            });
            
            expect(wrapper.text('div')).toBe('Fallback');
            
            await wrapper.destroy();
        });
    });
    
    describe('Integration with Component Features', () => {
        test('should work with lifecycle hooks', async () => {
            const mounted = jest.fn();
            const updated = jest.fn();
            
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    return `<div>${this.getStoreValue('value') || 'initial'}</div>`;
                },
                subscribeTo: ['value'],
                mounted,
                updated
            });
            
            expect(mounted).toHaveBeenCalled();
            updated.mockClear();
            
            await wrapper.updateStore('value', 'changed');
            
            expect(updated).toHaveBeenCalled();
            
            await wrapper.destroy();
        });
        
        test('should work with event handlers', async () => {
            const wrapper = await mountReactiveComponent(ReactiveComponent, {
                template: function() {
                    const count = this.getStoreValue('count') || 0;
                    return `
                        <div>
                            <span class="count">${count}</span>
                            <button class="increment">+</button>
                        </div>
                    `;
                },
                subscribeTo: ['count'],
                events: {
                    'click .increment': function() {
                        const current = this.getStoreValue('count') || 0;
                        this.setStoreValue('count', current + 1);
                    }
                }
            });
            
            expect(wrapper.text('.count')).toBe('0');
            
            await wrapper.click('.increment');
            expect(wrapper.text('.count')).toBe('1');
            
            await wrapper.click('.increment');
            expect(wrapper.text('.count')).toBe('2');
            
            await wrapper.destroy();
        });
    });
});