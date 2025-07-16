/**
 * ClientManager Component Tests
 * Tests for the ClientManager feature component
 */

import { ClientManager } from '../features/ClientManager.js';
import { mountReactiveComponent, mockApiResponses } from '../../../__tests__/utils/component-helpers.js';
import { waitForElement, waitForElementToBeRemoved } from '../../../__tests__/utils/dom-helpers.js';
import { createMockClient, createBatch, createMockApiResponse } from '../../../__tests__/utils/mock-factories.js';

describe('ClientManager Component', () => {
    let wrapper;
    
    beforeEach(() => {
        // Reset fetch mock
        global.fetch.mockClear();
    });
    
    afterEach(async () => {
        if (wrapper && wrapper.component && !wrapper.component.isDestroyed) {
            await wrapper.destroy();
        }
    });
    
    describe('Initialization', () => {
        test('should initialize with default state', async () => {
            mockApiResponses({
                '/api/clients': createMockApiResponse([])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            expect(wrapper.component.name).toBe('ClientManager');
            expect(wrapper.exists('.client-manager')).toBe(true);
            expect(wrapper.component.clients).toEqual([]);
            expect(wrapper.component.loading).toBe(false);
        });
        
        test('should load clients on mount', async () => {
            const mockClients = createBatch(createMockClient, 3);
            
            mockApiResponses({
                '/api/clients': createMockApiResponse(mockClients)
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/clients'),
                expect.any(Object)
            );
            
            expect(wrapper.findAll('.client-item').length).toBe(3);
        });
        
        test('should handle API errors gracefully', async () => {
            mockApiResponses({
                '/api/clients': {
                    ok: false,
                    status: 500,
                    data: { error: 'Server error' }
                }
            });
            
            console.error = jest.fn();
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await flushPromises();
            
            expect(wrapper.exists('.error-message')).toBe(true);
            expect(wrapper.text('.error-message')).toContain('Failed to load clients');
        });
    });
    
    describe('Client List Display', () => {
        test('should display client information', async () => {
            const mockClient = createMockClient({
                name: 'Test Client',
                phone: '0912345678',
                address: '123 Test St'
            });
            
            mockApiResponses({
                '/api/clients': createMockApiResponse([mockClient])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            const clientItem = wrapper.find('.client-item');
            expect(wrapper.text('.client-name')).toBe('Test Client');
            expect(wrapper.text('.client-phone')).toBe('0912345678');
            expect(wrapper.text('.client-address')).toBe('123 Test St');
        });
        
        test('should show empty state when no clients', async () => {
            mockApiResponses({
                '/api/clients': createMockApiResponse([])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await flushPromises();
            
            expect(wrapper.exists('.empty-state')).toBe(true);
            expect(wrapper.text('.empty-state')).toContain('No clients found');
        });
        
        test('should show loading state', async () => {
            // Delay response to see loading state
            mockApiResponses({
                '/api/clients': new Promise(resolve => 
                    setTimeout(() => resolve(createMockApiResponse([])), 100)
                )
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            expect(wrapper.exists('.loading')).toBe(true);
            
            await waitForElementToBeRemoved('.loading');
            
            expect(wrapper.exists('.loading')).toBe(false);
        });
    });
    
    describe('Client Search', () => {
        test('should filter clients by search term', async () => {
            const mockClients = [
                createMockClient({ name: 'John Doe' }),
                createMockClient({ name: 'Jane Smith' }),
                createMockClient({ name: 'Bob Johnson' })
            ];
            
            mockApiResponses({
                '/api/clients': createMockApiResponse(mockClients)
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            expect(wrapper.findAll('.client-item').length).toBe(3);
            
            // Search for "John"
            const searchInput = wrapper.find('.search-input');
            await wrapper.trigger('.search-input', 'input', { target: { value: 'John' } });
            
            await flushPromises();
            
            const visibleClients = wrapper.findAll('.client-item:not(.hidden)');
            expect(visibleClients.length).toBe(2);
        });
        
        test('should show no results message when search has no matches', async () => {
            const mockClients = [
                createMockClient({ name: 'John Doe' }),
                createMockClient({ name: 'Jane Smith' })
            ];
            
            mockApiResponses({
                '/api/clients': createMockApiResponse(mockClients)
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            await wrapper.trigger('.search-input', 'input', { target: { value: 'xyz' } });
            
            await flushPromises();
            
            expect(wrapper.exists('.no-results')).toBe(true);
            expect(wrapper.text('.no-results')).toContain('No clients match your search');
        });
    });
    
    describe('Client Actions', () => {
        test('should select a client', async () => {
            const mockClient = createMockClient({ id: 'client-123', name: 'Test Client' });
            
            mockApiResponses({
                '/api/clients': createMockApiResponse([mockClient])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            await wrapper.click('.client-item');
            
            expect(wrapper.component.selectedClient).toEqual(mockClient);
            expect(wrapper.hasClass('.client-item', 'selected')).toBe(true);
        });
        
        test('should open edit modal', async () => {
            const mockClient = createMockClient({ name: 'Test Client' });
            
            mockApiResponses({
                '/api/clients': createMockApiResponse([mockClient])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            await wrapper.click('.edit-client');
            
            expect(wrapper.exists('.edit-modal')).toBe(true);
            expect(wrapper.value('.edit-modal input[name="name"]')).toBe('Test Client');
        });
        
        test('should create new client', async () => {
            const newClient = createMockClient({ name: 'New Client' });
            
            mockApiResponses({
                '/api/clients': createMockApiResponse([]),
                '/api/clients/create': createMockApiResponse(newClient)
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await flushPromises();
            
            // Open create modal
            await wrapper.click('.create-client-btn');
            
            expect(wrapper.exists('.create-modal')).toBe(true);
            
            // Fill form
            await wrapper.trigger('input[name="name"]', 'input', { target: { value: 'New Client' } });
            await wrapper.trigger('input[name="phone"]', 'input', { target: { value: '0987654321' } });
            await wrapper.trigger('input[name="address"]', 'input', { target: { value: '456 New St' } });
            
            // Submit
            await wrapper.click('.submit-btn');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/clients/create'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.any(String)
                })
            );
            
            await flushPromises();
            
            expect(wrapper.exists('.create-modal')).toBe(false);
        });
        
        test('should update client', async () => {
            const mockClient = createMockClient({ id: 'client-123', name: 'Old Name' });
            const updatedClient = { ...mockClient, name: 'New Name' };
            
            mockApiResponses({
                '/api/clients': createMockApiResponse([mockClient]),
                '/api/clients/client-123': createMockApiResponse(updatedClient)
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            // Open edit modal
            await wrapper.click('.edit-client');
            
            // Update name
            const nameInput = wrapper.find('input[name="name"]');
            nameInput.value = 'New Name';
            await wrapper.trigger('input[name="name"]', 'input', { target: { value: 'New Name' } });
            
            // Submit
            await wrapper.click('.update-btn');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/clients/client-123'),
                expect.objectContaining({
                    method: 'PUT'
                })
            );
            
            await flushPromises();
            
            expect(wrapper.text('.client-name')).toBe('New Name');
        });
        
        test('should delete client with confirmation', async () => {
            const mockClient = createMockClient({ id: 'client-123' });
            
            mockApiResponses({
                '/api/clients': createMockApiResponse([mockClient]),
                '/api/clients/client-123': createMockApiResponse({ success: true })
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            // Mock confirm dialog
            window.confirm = jest.fn(() => true);
            
            await wrapper.click('.delete-client');
            
            expect(window.confirm).toHaveBeenCalledWith(
                expect.stringContaining('delete this client')
            );
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/clients/client-123'),
                expect.objectContaining({
                    method: 'DELETE'
                })
            );
            
            await flushPromises();
            
            expect(wrapper.findAll('.client-item').length).toBe(0);
        });
    });
    
    describe('Form Validation', () => {
        test('should validate required fields', async () => {
            mockApiResponses({
                '/api/clients': createMockApiResponse([])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await wrapper.click('.create-client-btn');
            
            // Try to submit empty form
            await wrapper.click('.submit-btn');
            
            expect(wrapper.exists('.field-error')).toBe(true);
            expect(wrapper.text('.field-error')).toContain('Name is required');
        });
        
        test('should validate phone number format', async () => {
            mockApiResponses({
                '/api/clients': createMockApiResponse([])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await wrapper.click('.create-client-btn');
            
            // Enter invalid phone
            await wrapper.trigger('input[name="phone"]', 'input', { target: { value: '123' } });
            await wrapper.click('.submit-btn');
            
            expect(wrapper.text('.field-error')).toContain('Invalid phone number');
        });
    });
    
    describe('Sorting and Pagination', () => {
        test('should sort clients by name', async () => {
            const mockClients = [
                createMockClient({ name: 'Charlie' }),
                createMockClient({ name: 'Alice' }),
                createMockClient({ name: 'Bob' })
            ];
            
            mockApiResponses({
                '/api/clients': createMockApiResponse(mockClients)
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            // Click sort by name
            await wrapper.click('.sort-name');
            
            await flushPromises();
            
            const clientNames = wrapper.findAll('.client-name').map(el => el.textContent);
            expect(clientNames).toEqual(['Alice', 'Bob', 'Charlie']);
        });
        
        test('should paginate results', async () => {
            const mockClients = createBatch(createMockClient, 25, (client, i) => ({
                ...client,
                name: `Client ${i + 1}`
            }));
            
            mockApiResponses({
                '/api/clients': createMockApiResponse(mockClients)
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            // Should show first page (10 items)
            expect(wrapper.findAll('.client-item').length).toBe(10);
            
            // Go to next page
            await wrapper.click('.next-page');
            
            await flushPromises();
            
            expect(wrapper.findAll('.client-item').length).toBe(10);
            expect(wrapper.text('.client-item:first-child .client-name')).toBe('Client 11');
        });
    });
    
    describe('Integration with Store', () => {
        test('should update store when client is selected', async () => {
            const mockClient = createMockClient({ id: 'client-123' });
            
            mockApiResponses({
                '/api/clients': createMockApiResponse([mockClient])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await waitForElement('.client-item');
            
            await wrapper.click('.client-item');
            
            expect(wrapper.getStoreValue('clients.selected')).toEqual(mockClient);
        });
        
        test('should react to store changes', async () => {
            mockApiResponses({
                '/api/clients': createMockApiResponse([])
            });
            
            wrapper = await mountReactiveComponent(ClientManager, {});
            
            await flushPromises();
            
            // Update store directly
            const newClient = createMockClient({ name: 'Store Client' });
            await wrapper.updateStore('clients.list', [newClient]);
            
            expect(wrapper.findAll('.client-item').length).toBe(1);
            expect(wrapper.text('.client-name')).toBe('Store Client');
        });
    });
});