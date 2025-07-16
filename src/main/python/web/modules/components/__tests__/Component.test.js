/**
 * Component Base Class Tests
 * Tests for the core Component functionality
 */

import { Component } from '../Component.js';
import { mountComponent, createMockComponent, spyOnMethod, waitForUpdate } from '../../../__tests__/utils/component-helpers.js';
import { waitForElement, triggerCustomEvent } from '../../../__tests__/utils/dom-helpers.js';

describe('Component Base Class', () => {
    let container;
    
    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    
    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });
    
    describe('Constructor', () => {
        test('should initialize with default options', () => {
            const component = new Component();
            
            expect(component.name).toBe('Component');
            expect(component.id).toMatch(/Component-\d+-[a-z0-9]+/);
            expect(component.props).toEqual({});
            expect(component.localState).toEqual({});
            expect(component.isMounted).toBe(false);
            expect(component.isDestroyed).toBe(false);
        });
        
        test('should accept custom options', () => {
            const options = {
                name: 'TestComponent',
                props: { foo: 'bar' },
                state: { count: 0 },
                shadow: true
            };
            
            const component = new Component(options);
            
            expect(component.name).toBe('TestComponent');
            expect(component.props).toEqual({ foo: 'bar' });
            expect(component.localState).toEqual({ count: 0 });
            expect(component.shadow).toBe(true);
        });
        
        test('should auto-mount if container provided', async () => {
            const component = new Component({
                container,
                template: () => '<div>Auto mounted</div>'
            });
            
            await flushPromises();
            
            expect(component.isMounted).toBe(true);
            expect(container.innerHTML).toContain('Auto mounted');
        });
    });
    
    describe('Mounting', () => {
        test('should mount to DOM', async () => {
            const component = new Component({
                name: 'TestMount',
                template: () => '<div class="test-content">Mounted</div>'
            });
            
            await component.mount(container);
            
            expect(component.isMounted).toBe(true);
            expect(component.container).toBe(container);
            expect(component.element).toBeTruthy();
            expect(component.element.className).toBe('component-testmount');
            expect(container.querySelector('.test-content')).toBeTruthy();
        });
        
        test('should handle mounting with selector', async () => {
            container.id = 'test-container';
            
            const component = new Component({
                template: () => '<div>Selector mount</div>'
            });
            
            await component.mount('#test-container');
            
            expect(component.isMounted).toBe(true);
            expect(component.container).toBe(container);
        });
        
        test('should throw error if container not found', async () => {
            const component = new Component();
            
            await expect(component.mount('#non-existent')).rejects.toThrow('Container not found');
        });
        
        test('should prevent double mounting', async () => {
            const component = new Component({
                template: () => '<div>Content</div>'
            });
            
            await component.mount(container);
            const firstElement = component.element;
            
            console.warn = jest.fn();
            await component.mount(container);
            
            expect(console.warn).toHaveBeenCalledWith('Component Component is already mounted');
            expect(component.element).toBe(firstElement);
        });
        
        test('should setup shadow DOM when requested', async () => {
            const component = new Component({
                shadow: true,
                template: () => '<div>Shadow content</div>'
            });
            
            await component.mount(container);
            
            expect(component.shadowRoot).toBeTruthy();
            expect(component.shadowRoot.innerHTML).toContain('Shadow content');
        });
    });
    
    describe('Lifecycle Hooks', () => {
        test('should call init during mount', async () => {
            const init = jest.fn();
            
            const component = new Component({
                template: () => '<div>Test</div>'
            });
            component.init = init;
            
            await component.mount(container);
            
            expect(init).toHaveBeenCalled();
        });
        
        test('should call mounted after mount', async () => {
            const mounted = jest.fn();
            
            const component = new Component({
                template: () => '<div>Test</div>'
            });
            component.mounted = mounted;
            
            await component.mount(container);
            
            expect(mounted).toHaveBeenCalled();
            expect(component.isMounted).toBe(true);
        });
        
        test('should call updated after render', async () => {
            const updated = jest.fn();
            
            const component = new Component({
                template: () => '<div>Test</div>'
            });
            component.updated = updated;
            
            await component.mount(container);
            
            expect(updated).toHaveBeenCalled();
        });
        
        test('should call beforeDestroy and destroyed', async () => {
            const beforeDestroy = jest.fn();
            const destroyed = jest.fn();
            
            const component = new Component({
                template: () => '<div>Test</div>'
            });
            component.beforeDestroy = beforeDestroy;
            component.destroyed = destroyed;
            
            await component.mount(container);
            await component.destroy();
            
            expect(beforeDestroy).toHaveBeenCalled();
            expect(destroyed).toHaveBeenCalled();
            expect(component.isDestroyed).toBe(true);
        });
    });
    
    describe('Rendering', () => {
        test('should render template', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return `<div class="content">Count: ${this.localState.count}</div>`;
                },
                state: { count: 42 }
            });
            
            expect(wrapper.text('.content')).toBe('Count: 42');
            
            await wrapper.destroy();
        });
        
        test('should handle template errors', async () => {
            const onError = jest.fn();
            console.error = jest.fn();
            
            const component = new Component({
                template: () => {
                    throw new Error('Template error');
                }
            });
            component.onError = onError;
            
            await component.mount(container);
            
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
            expect(console.error).toHaveBeenCalled();
        });
        
        test('should not render when destroyed', async () => {
            const component = new Component({
                template: () => '<div>Test</div>'
            });
            
            await component.mount(container);
            await component.destroy();
            
            const updated = jest.fn();
            component.updated = updated;
            component.render();
            
            expect(updated).not.toHaveBeenCalled();
        });
    });
    
    describe('State Management', () => {
        test('should update local state and re-render', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return `<div class="count">${this.localState.count}</div>`;
                },
                state: { count: 0 }
            });
            
            expect(wrapper.text('.count')).toBe('0');
            
            await wrapper.setState({ count: 5 });
            expect(wrapper.text('.count')).toBe('5');
            
            await wrapper.destroy();
        });
        
        test('should not re-render if state unchanged', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return '<div>Test</div>';
                },
                state: { value: 'test' }
            });
            
            const renderSpy = spyOnMethod(wrapper.component, 'render');
            
            await wrapper.setState({ value: 'test' });
            
            expect(renderSpy).not.toHaveBeenCalled();
            
            await wrapper.destroy();
        });
    });
    
    describe('Props Management', () => {
        test('should update props and re-render', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return `<div class="title">${this.props.title}</div>`;
                },
                props: { title: 'Initial' }
            });
            
            expect(wrapper.text('.title')).toBe('Initial');
            
            await wrapper.setProps({ title: 'Updated' });
            expect(wrapper.text('.title')).toBe('Updated');
            
            await wrapper.destroy();
        });
        
        test('should not re-render if props unchanged', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return '<div>Test</div>';
                },
                props: { value: 'test' }
            });
            
            const renderSpy = spyOnMethod(wrapper.component, 'render');
            
            await wrapper.setProps({ value: 'test' });
            
            expect(renderSpy).not.toHaveBeenCalled();
            
            await wrapper.destroy();
        });
    });
    
    describe('Event Handling', () => {
        test('should handle direct events', async () => {
            const handleClick = jest.fn();
            
            const wrapper = await mountComponent(Component, {
                template: () => '<button class="btn">Click me</button>',
                events: {
                    'click': handleClick
                }
            });
            
            await wrapper.click('.btn');
            
            expect(handleClick).toHaveBeenCalled();
            
            await wrapper.destroy();
        });
        
        test('should handle delegated events', async () => {
            const handleClick = jest.fn();
            
            const wrapper = await mountComponent(Component, {
                template: () => `
                    <div>
                        <button class="btn">Button 1</button>
                        <button class="btn">Button 2</button>
                    </div>
                `,
                events: {
                    'click .btn': handleClick
                }
            });
            
            const buttons = wrapper.findAll('.btn');
            buttons[0].click();
            buttons[1].click();
            
            expect(handleClick).toHaveBeenCalledTimes(2);
            
            await wrapper.destroy();
        });
        
        test('should call method by name', async () => {
            const wrapper = await mountComponent(Component, {
                template: () => '<button class="btn">Click</button>',
                events: {
                    'click .btn': 'handleClick'
                },
                methods: {
                    handleClick: jest.fn()
                }
            });
            
            await wrapper.click('.btn');
            
            expect(wrapper.component.handleClick).toHaveBeenCalled();
            
            await wrapper.destroy();
        });
        
        test('should handle event errors', async () => {
            const onError = jest.fn();
            console.error = jest.fn();
            
            const wrapper = await mountComponent(Component, {
                template: () => '<button class="btn">Click</button>',
                events: {
                    'click .btn': () => {
                        throw new Error('Event error');
                    }
                }
            });
            
            wrapper.component.onError = onError;
            
            await wrapper.click('.btn');
            
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
            expect(console.error).toHaveBeenCalled();
            
            await wrapper.destroy();
        });
    });
    
    describe('Computed Properties', () => {
        test('should define computed properties', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return `<div class="full">${this.fullName}</div>`;
                },
                state: {
                    firstName: 'John',
                    lastName: 'Doe'
                },
                computed: {
                    fullName() {
                        return `${this.localState.firstName} ${this.localState.lastName}`;
                    }
                }
            });
            
            expect(wrapper.text('.full')).toBe('John Doe');
            
            await wrapper.setState({ firstName: 'Jane' });
            expect(wrapper.text('.full')).toBe('Jane Doe');
            
            await wrapper.destroy();
        });
        
        test('should support getter/setter computed properties', async () => {
            const wrapper = await mountComponent(Component, {
                state: { value: 10 },
                computed: {
                    doubled: {
                        get() {
                            return this.localState.value * 2;
                        },
                        set(val) {
                            this.localState.value = val / 2;
                        }
                    }
                }
            });
            
            expect(wrapper.component.doubled).toBe(20);
            
            wrapper.component.doubled = 30;
            expect(wrapper.component.localState.value).toBe(15);
            
            await wrapper.destroy();
        });
    });
    
    describe('DOM Utilities', () => {
        test('should find single element with $', async () => {
            const wrapper = await mountComponent(Component, {
                template: () => '<div><span class="target">Found</span></div>'
            });
            
            const element = wrapper.component.$('.target');
            expect(element).toBeTruthy();
            expect(element.textContent).toBe('Found');
            
            await wrapper.destroy();
        });
        
        test('should find multiple elements with $$', async () => {
            const wrapper = await mountComponent(Component, {
                template: () => `
                    <div>
                        <span class="item">1</span>
                        <span class="item">2</span>
                        <span class="item">3</span>
                    </div>
                `
            });
            
            const elements = wrapper.component.$$('.item');
            expect(elements).toHaveLength(3);
            
            await wrapper.destroy();
        });
    });
    
    describe('Custom Events', () => {
        test('should emit custom events', async () => {
            const handler = jest.fn();
            
            const wrapper = await mountComponent(Component, {
                template: () => '<div>Test</div>'
            });
            
            wrapper.element.addEventListener('custom-event', handler);
            
            wrapper.component.emit('custom-event', { data: 'test' });
            
            expect(handler).toHaveBeenCalled();
            expect(handler.mock.calls[0][0].detail).toEqual({ data: 'test' });
            
            await wrapper.destroy();
        });
        
        test('should support event options', async () => {
            const wrapper = await mountComponent(Component, {
                template: () => '<div>Test</div>'
            });
            
            const event = new Promise(resolve => {
                wrapper.element.addEventListener('test', resolve);
            });
            
            wrapper.component.emit('test', null, {
                bubbles: false,
                cancelable: true
            });
            
            const e = await event;
            expect(e.bubbles).toBe(false);
            expect(e.cancelable).toBe(true);
            
            await wrapper.destroy();
        });
    });
    
    describe('Destruction', () => {
        test('should clean up on destroy', async () => {
            const wrapper = await mountComponent(Component, {
                template: () => '<div>Test</div>'
            });
            
            const element = wrapper.element;
            
            await wrapper.destroy();
            
            expect(wrapper.component.isDestroyed).toBe(true);
            expect(wrapper.component.isMounted).toBe(false);
            expect(wrapper.component.element).toBeNull();
            expect(element.parentNode).toBeNull();
        });
        
        test('should handle multiple destroy calls', async () => {
            const wrapper = await mountComponent(Component, {
                template: () => '<div>Test</div>'
            });
            
            await wrapper.destroy();
            
            // Should not throw on second destroy
            await expect(wrapper.component.destroy()).resolves.toBeUndefined();
        });
    });
});