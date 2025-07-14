const { chromium } = require('playwright');

(async () => {
  console.log('Starting LuckyGas Interface Tests...');
  console.log('==================================');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 1. Test page loading
    console.log('\n1. Testing page load...');
    await page.goto('http://localhost:8000/admin');
    await page.waitForLoadState('networkidle');
    console.log('   ✓ Page loaded successfully');
    
    // Take initial screenshot
    await page.screenshot({ path: 'test_1_initial_load.png', fullPage: true });
    console.log('   ✓ Screenshot saved: test_1_initial_load.png');
    
    // 2. Test navigation tabs
    console.log('\n2. Testing navigation tabs...');
    
    // Test Drivers tab
    await page.click('button:has-text("司機管理")');
    await page.waitForTimeout(500);
    const driversVisible = await page.isVisible('#drivers');
    console.log(`   ✓ Drivers tab: ${driversVisible ? 'Working' : 'Failed'}`);
    
    // Test Vehicles tab
    await page.click('button:has-text("車輛管理")');
    await page.waitForTimeout(500);
    const vehiclesVisible = await page.isVisible('#vehicles');
    console.log(`   ✓ Vehicles tab: ${vehiclesVisible ? 'Working' : 'Failed'}`);
    
    // Test Deliveries tab
    await page.click('button:has-text("配送管理")');
    await page.waitForTimeout(500);
    const deliveriesVisible = await page.isVisible('#deliveries');
    console.log(`   ✓ Deliveries tab: ${deliveriesVisible ? 'Working' : 'Failed'}`);
    
    // Back to Clients tab
    await page.click('button:has-text("客戶管理")');
    await page.waitForTimeout(500);
    
    // 3. Test Add Client Modal
    console.log('\n3. Testing Add Client modal...');
    await page.click('button:has-text("新增客戶")');
    await page.waitForTimeout(500);
    
    // Check if modal is visible
    const clientModalVisible = await page.isVisible('div:has-text("新增客戶").first');
    console.log(`   ✓ Modal opened: ${clientModalVisible ? 'Yes' : 'No'}`);
    
    // Fill form
    await page.fill('input[placeholder="輸入客戶名稱"]', 'Test Client ' + Date.now());
    await page.fill('input[placeholder="輸入地址"]', '123 Test Street');
    await page.fill('input[placeholder="輸入電話號碼"]', '0912345678');
    await page.fill('input[placeholder="輸入聯絡人姓名"]', 'Test Contact');
    await page.fill('input[placeholder="輸入瓦斯用量"]', '50');
    await page.fill('input[placeholder="輸入鋼瓶數量"]', '2');
    
    await page.screenshot({ path: 'test_2_client_modal.png' });
    console.log('   ✓ Form filled');
    
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // 4. Test Add Driver Modal
    console.log('\n4. Testing Add Driver modal...');
    await page.click('button:has-text("司機管理")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("新增司機")');
    await page.waitForTimeout(500);
    
    const driverModalVisible = await page.isVisible('div:has-text("新增司機").first');
    console.log(`   ✓ Modal opened: ${driverModalVisible ? 'Yes' : 'No'}`);
    
    await page.screenshot({ path: 'test_3_driver_modal.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // 5. Test Add Vehicle Modal
    console.log('\n5. Testing Add Vehicle modal...');
    await page.click('button:has-text("車輛管理")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("新增車輛")');
    await page.waitForTimeout(500);
    
    const vehicleModalVisible = await page.isVisible('div:has-text("新增車輛").first');
    console.log(`   ✓ Modal opened: ${vehicleModalVisible ? 'Yes' : 'No'}`);
    
    await page.screenshot({ path: 'test_4_vehicle_modal.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // 6. Test Add Delivery Modal
    console.log('\n6. Testing Add Delivery modal...');
    await page.click('button:has-text("配送管理")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("新增配送")');
    await page.waitForTimeout(500);
    
    const deliveryModalVisible = await page.isVisible('div:has-text("新增配送").first');
    console.log(`   ✓ Modal opened: ${deliveryModalVisible ? 'Yes' : 'No'}`);
    
    await page.screenshot({ path: 'test_5_delivery_modal.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // 7. Test Charts
    console.log('\n7. Testing charts visibility...');
    // Check if any canvas elements exist (charts)
    const chartsExist = await page.locator('canvas').count();
    console.log(`   ✓ Charts found: ${chartsExist}`);
    
    // Take final full page screenshot
    await page.screenshot({ path: 'test_6_final_state.png', fullPage: true });
    
    console.log('\n==================================');
    console.log('All tests completed!');
    console.log('Check the screenshot files for visual confirmation.');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'test_error.png', fullPage: true });
  } finally {
    // Keep browser open for manual inspection
    console.log('\nBrowser will remain open for manual inspection.');
    console.log('Press Ctrl+C to close.');
    
    // Wait indefinitely
    await new Promise(() => {});
  }
})();