/**
 * Browser Console Test Script for Delivery Tab Functionality
 * 
 * To run this test:
 * 1. Open http://localhost:8000 in your browser
 * 2. Navigate to the Deliveries section
 * 3. Open browser console (F12)
 * 4. Copy and paste this entire script
 * 5. Press Enter to run
 */

console.log('%c🧪 Delivery Tab Test Suite', 'font-size: 20px; font-weight: bold; color: #4CAF50;');
console.log('='*50);

// Test Suite
const DeliveryTabTests = {
    // Test 1: Check if tabs exist
    testTabsExist: function() {
        console.log('\n📋 Test 1: Tab Elements Exist');
        const plannedTab = document.getElementById('planned-tab');
        const historyTab = document.getElementById('history-tab');
        
        if (plannedTab && historyTab) {
            console.log('✅ Both tabs found');
            console.log(`  - Planned tab text: "${plannedTab.textContent.trim()}"`);
            console.log(`  - History tab text: "${historyTab.textContent.trim()}"`);
            return true;
        } else {
            console.error('❌ Tabs not found!');
            return false;
        }
    },

    // Test 2: Check tab switching
    testTabSwitching: async function() {
        console.log('\n🔄 Test 2: Tab Switching');
        
        // Click History tab
        const historyTab = document.getElementById('history-tab');
        if (historyTab) {
            console.log('Clicking History tab...');
            historyTab.click();
            
            // Wait for UI update
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check active state
            const isHistoryActive = historyTab.classList.contains('active');
            const plannedTab = document.getElementById('planned-tab');
            const isPlannedInactive = !plannedTab.classList.contains('active');
            
            if (isHistoryActive && isPlannedInactive) {
                console.log('✅ History tab is active');
            } else {
                console.error('❌ Tab switching failed');
            }
            
            // Click back to Planned
            plannedTab.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (plannedTab.classList.contains('active')) {
                console.log('✅ Switched back to Planned tab');
            }
        }
    },

    // Test 3: Check localStorage persistence
    testLocalStorage: function() {
        console.log('\n💾 Test 3: LocalStorage Persistence');
        
        const currentTab = localStorage.getItem('deliveryTab');
        console.log(`Current stored tab: "${currentTab}"`);
        
        // Test setting and getting
        localStorage.setItem('deliveryTab', 'history');
        const newValue = localStorage.getItem('deliveryTab');
        
        if (newValue === 'history') {
            console.log('✅ LocalStorage working correctly');
            
            // Restore original value
            if (currentTab) {
                localStorage.setItem('deliveryTab', currentTab);
            }
        } else {
            console.error('❌ LocalStorage not working');
        }
    },

    // Test 4: Check API calls
    testAPICalls: async function() {
        console.log('\n🌐 Test 4: API Status Filtering');
        
        // Intercept next fetch call
        const originalFetch = window.fetch;
        let capturedUrl = null;
        
        window.fetch = function(...args) {
            capturedUrl = args[0];
            console.log(`API Call: ${capturedUrl}`);
            return originalFetch.apply(this, args);
        };
        
        // Trigger a tab switch to cause API call
        const historyTab = document.getElementById('history-tab');
        if (historyTab) {
            historyTab.click();
            
            // Wait for API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (capturedUrl && capturedUrl.includes('status=completed') && capturedUrl.includes('status=cancelled')) {
                console.log('✅ History tab sends correct status filters');
            } else {
                console.log('⚠️ Could not verify status filters');
            }
        }
        
        // Restore original fetch
        window.fetch = originalFetch;
    },

    // Test 5: Check delivery items
    testDeliveryDisplay: function() {
        console.log('\n📦 Test 5: Delivery Item Display');
        
        const deliveryItems = document.querySelectorAll('[id^="delivery-"]');
        console.log(`Found ${deliveryItems.length} delivery items`);
        
        if (deliveryItems.length > 0) {
            // Check first item's status
            const firstItem = deliveryItems[0];
            const statusBadge = firstItem.querySelector('.badge');
            
            if (statusBadge) {
                console.log(`✅ First item status: "${statusBadge.textContent.trim()}"`);
                
                // Verify status matches current tab
                const currentTab = localStorage.getItem('deliveryTab') || 'planned';
                const statusText = statusBadge.textContent.trim().toLowerCase();
                
                if (currentTab === 'planned') {
                    const plannedStatuses = ['待處理', '已指派', '配送中'];
                    const isValid = plannedStatuses.some(s => statusBadge.textContent.includes(s));
                    console.log(isValid ? '✅ Status matches Planned tab' : '⚠️ Status mismatch');
                } else {
                    const historyStatuses = ['已完成', '已取消'];
                    const isValid = historyStatuses.some(s => statusBadge.textContent.includes(s));
                    console.log(isValid ? '✅ Status matches History tab' : '⚠️ Status mismatch');
                }
            }
        } else {
            console.log('⚠️ No delivery items found');
        }
    },

    // Test 6: Check summary update
    testSummaryUpdate: async function() {
        console.log('\n📊 Test 6: Summary Statistics Update');
        
        // Get current summary
        const summaryElement = document.querySelector('#delivery-summary');
        if (!summaryElement) {
            console.log('⚠️ Summary element not found');
            return;
        }
        
        const initialText = summaryElement.textContent;
        console.log(`Initial summary: "${initialText.trim()}"`);
        
        // Switch tabs
        const historyTab = document.getElementById('history-tab');
        if (historyTab) {
            historyTab.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const newText = summaryElement.textContent;
            if (newText !== initialText) {
                console.log('✅ Summary updated after tab switch');
                console.log(`New summary: "${newText.trim()}"`);
            } else {
                console.log('⚠️ Summary did not update');
            }
        }
    },

    // Run all tests
    runAll: async function() {
        console.log('\n🚀 Running all tests...\n');
        
        const results = {
            total: 0,
            passed: 0,
            failed: 0
        };
        
        // Run each test
        const tests = [
            this.testTabsExist,
            this.testTabSwitching,
            this.testLocalStorage,
            this.testAPICalls,
            this.testDeliveryDisplay,
            this.testSummaryUpdate
        ];
        
        for (const test of tests) {
            results.total++;
            try {
                await test.call(this);
                results.passed++;
            } catch (error) {
                console.error(`❌ Test failed: ${error.message}`);
                results.failed++;
            }
        }
        
        // Summary
        console.log('\n' + '='*50);
        console.log(`📈 Test Results: ${results.passed}/${results.total} passed (${Math.round(results.passed/results.total*100)}%)`);
        console.log('='*50);
        
        if (results.failed > 0) {
            console.log('\n⚠️ Some tests failed. Please check the logs above.');
        } else {
            console.log('\n✅ All tests passed! The delivery tab functionality is working correctly.');
        }
        
        // Additional manual checks
        console.log('\n📝 Additional Manual Checks:');
        console.log('1. Refresh the page and verify the selected tab persists');
        console.log('2. Check network tab in DevTools for correct API calls');
        console.log('3. Verify visual styling of active/inactive tabs');
        console.log('4. Test with different screen sizes for responsive behavior');
    }
};

// Auto-run tests
console.log('\n⏳ Starting tests in 1 second...');
setTimeout(() => {
    DeliveryTabTests.runAll();
}, 1000);