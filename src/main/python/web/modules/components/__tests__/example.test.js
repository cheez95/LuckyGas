/**
 * Example Test File
 * Demonstrates basic testing patterns for LuckyGas components
 */

import { Component } from '../Component.js';
import { mountComponent } from '../../../__tests__/utils/component-helpers.js';

describe('Example Component Tests', () => {
    describe('Simple Component', () => {
        test('should render hello world', async () => {
            const wrapper = await mountComponent(Component, {
                template: () => '<div class="greeting">Hello World</div>'
            });
            
            expect(wrapper.exists('.greeting')).toBe(true);
            expect(wrapper.text('.greeting')).toBe('Hello World');
            
            await wrapper.destroy();
        });
        
        test('should handle state changes', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return `
                        <div>
                            <span class="count">${this.localState.count}</span>
                            <button class="increment">+</button>
                        </div>
                    `;
                },
                state: { count: 0 },
                events: {
                    'click .increment': function() {
                        this.setState({ count: this.localState.count + 1 });
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
    
    describe('Component with Props', () => {
        test('should accept and render props', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return `
                        <div class="user-card">
                            <h3>${this.props.name}</h3>
                            <p>${this.props.email}</p>
                        </div>
                    `;
                },
                props: {
                    name: 'John Doe',
                    email: 'john@example.com'
                }
            });
            
            expect(wrapper.text('h3')).toBe('John Doe');
            expect(wrapper.text('p')).toBe('john@example.com');
            
            await wrapper.destroy();
        });
    });
    
    describe('Async Operations', () => {
        test('should handle async data loading', async () => {
            const wrapper = await mountComponent(Component, {
                template: function() {
                    return `
                        <div>
                            ${this.localState.loading ? '<p class="loading">Loading...</p>' : ''}
                            ${this.localState.data ? `<p class="data">${this.localState.data}</p>` : ''}
                        </div>
                    `;
                },
                state: {
                    loading: false,
                    data: null
                },
                methods: {
                    async loadData() {
                        this.setState({ loading: true });
                        
                        // Simulate API call
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        this.setState({
                            loading: false,
                            data: 'Loaded data'
                        });
                    }
                },
                async mounted() {
                    await this.loadData();
                }
            });
            
            // Initially loading
            expect(wrapper.exists('.loading')).toBe(true);
            
            // Wait for data to load
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(wrapper.exists('.loading')).toBe(false);
            expect(wrapper.text('.data')).toBe('Loaded data');
            
            await wrapper.destroy();
        });
    });
});