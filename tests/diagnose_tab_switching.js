/**
 * Diagnostic script for tab switching issues
 * Run this in browser console to diagnose the problem
 */

console.log('%c🔍 Tab Switching Diagnostic', 'font-size: 18px; font-weight: bold; color: #FF5722;');
console.log('='*50);

// Test 1: Check global variables
console.log('\n1️⃣ Checking global variables...');
console.log('API_BASE:', typeof API_BASE !== 'undefined' ? API_BASE : '❌ NOT DEFINED');
console.log('currentDeliveryTab:', typeof currentDeliveryTab !== 'undefined' ? currentDeliveryTab : '❌ NOT DEFINED');
console.log('localStorage deliveryTab:', localStorage.getItem('currentDeliveryTab'));

// Test 2: Check DOM elements
console.log('\n2️⃣ Checking DOM elements...');
const elements = {
    'tab-planned': document.getElementById('tab-planned'),
    'tab-history': document.getElementById('tab-history'),
    'deliveries-tbody': document.getElementById('deliveries-tbody'),
    'delivery-status': document.getElementById('delivery-status')
};

for (const [id, element] of Object.entries(elements)) {
    console.log(`${id}:`, element ? '✅ Found' : '❌ Not found');
}

// Test 3: Test functions exist
console.log('\n3️⃣ Checking functions...');
const functions = ['loadDeliveries', 'switchDeliveryTab', 'showNotification', 'renderDeliveriesTable'];
for (const func of functions) {
    console.log(`${func}:`, typeof window[func] === 'function' ? '✅ Exists' : '❌ Missing');
}

// Test 4: Simulate tab switch
console.log('\n4️⃣ Testing tab switch (without API call)...');
try {
    // Save original loadDeliveries
    const originalLoad = window.loadDeliveries;
    
    // Replace with mock
    window.loadDeliveries = function(page) {
        console.log('✅ loadDeliveries called with page:', page);
        console.log('   Current tab:', currentDeliveryTab);
    };
    
    // Test switch
    console.log('Switching to history tab...');
    switchDeliveryTab('history');
    
    console.log('Switching to planned tab...');
    switchDeliveryTab('planned');
    
    // Restore original
    window.loadDeliveries = originalLoad;
    
} catch (error) {
    console.error('❌ Error during tab switch test:', error);
}

// Test 5: Direct API call
console.log('\n5️⃣ Testing direct API call...');
const testUrl = `${API_BASE}/deliveries?page=1&page_size=10&status=pending&status=assigned&status=in_progress`;
console.log('Test URL:', testUrl);

fetch(testUrl)
    .then(response => {
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        if (!response.ok) {
            return response.text().then(text => {
                console.error('❌ Error response:', text);
                throw new Error(`HTTP ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ API call successful');
        console.log('Total items:', data.total);
        console.log('Items returned:', data.items?.length || 0);
    })
    .catch(error => {
        console.error('❌ API call failed:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
    });

// Test 6: Check for infinite loops
console.log('\n6️⃣ Checking for potential infinite loops...');
let callCount = 0;
const maxCalls = 10;

// Temporarily monitor function calls
const originalSwitch = window.switchDeliveryTab;
const originalLoadDel = window.loadDeliveries;

window.switchDeliveryTab = function(tab) {
    callCount++;
    console.log(`switchDeliveryTab called (${callCount}):`, tab);
    if (callCount > maxCalls) {
        console.error('❌ Possible infinite loop detected!');
        window.switchDeliveryTab = originalSwitch;
        window.loadDeliveries = originalLoadDel;
        return;
    }
    originalSwitch.call(this, tab);
};

window.loadDeliveries = function(page) {
    callCount++;
    console.log(`loadDeliveries called (${callCount}):`, page);
    if (callCount > maxCalls) {
        console.error('❌ Possible infinite loop detected!');
        window.switchDeliveryTab = originalSwitch;
        window.loadDeliveries = originalLoadDel;
        return;
    }
    originalLoadDel.call(this, page);
};

console.log('\n📋 Manual steps to test:');
console.log('1. Click on "歷史記錄" tab');
console.log('2. Watch console for any errors');
console.log('3. Check Network tab for API calls');
console.log('4. If error persists, check the call count above');

// Reset after 5 seconds
setTimeout(() => {
    window.switchDeliveryTab = originalSwitch;
    window.loadDeliveries = originalLoadDel;
    console.log('\n✅ Function monitoring stopped');
}, 5000);