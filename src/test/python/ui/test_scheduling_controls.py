"""Test the scheduling controls UI with Playwright"""
import asyncio
from playwright.async_api import async_playwright
from datetime import datetime, timedelta
import time


async def test_scheduling_controls():
    """Test the advanced scheduling controls in the admin interface"""
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        try:
            print("1. Navigating to admin interface...")
            await page.goto("http://localhost:8000/admin")
            await page.wait_for_load_state("networkidle")
            
            # Navigate to routes section
            print("2. Navigating to routes section...")
            await page.click('a[href="#routes"]')
            await page.wait_for_selector('#routes', state='visible')
            
            # Click on advanced scheduling button
            print("3. Opening scheduling modal...")
            await page.click('button:has-text("進階排程")')
            await page.wait_for_selector('#schedulingModal', state='visible')
            
            # Test single date scheduling
            print("4. Testing single date scheduling...")
            
            # Set schedule date to tomorrow
            tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
            await page.fill('#schedule-date', tomorrow)
            
            # Select algorithm
            await page.select_option('select[name="algorithm"]', 'greedy')
            
            # Select optimization objectives
            await page.check('input[value="minimize_distance"]')
            await page.check('input[value="balance_workload"]')
            
            # Set constraints
            await page.fill('input[name="max_deliveries_per_route"]', '25')
            await page.fill('input[name="travel_speed_kmh"]', '35')
            
            # Preview schedule
            print("5. Previewing schedule...")
            await page.click('button:has-text("預覽排程")')
            await page.wait_for_selector('#scheduling-results', state='visible')
            await asyncio.sleep(2)  # Wait for preview to complete
            
            # Generate schedule
            print("6. Generating schedule...")
            await page.click('button:has-text("生成排程")')
            
            # Wait for results
            await page.wait_for_selector('.bg-green-50', timeout=30000)
            print("✓ Schedule generated successfully!")
            
            # Test date range scheduling
            print("7. Testing date range scheduling...")
            await page.select_option('#schedule-type', 'range')
            await page.wait_for_selector('#date-range-inputs', state='visible')
            
            # Set date range
            start_date = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
            end_date = (datetime.now() + timedelta(days=4)).strftime('%Y-%m-%d')
            await page.fill('#start-date', start_date)
            await page.fill('#end-date', end_date)
            
            # Select different algorithm
            await page.select_option('select[name="algorithm"]', 'genetic')
            
            # Allow overtime
            await page.check('input[name="allow_overtime"]')
            
            # Preview range schedule
            print("8. Previewing date range schedule...")
            await page.click('button:has-text("預覽排程")')
            await asyncio.sleep(2)
            
            # Generate range schedule
            print("9. Generating date range schedule...")
            await page.click('button:has-text("生成排程")')
            
            # Wait for multiple results
            await page.wait_for_selector('.bg-green-50', timeout=30000)
            print("✓ Date range schedule generated successfully!")
            
            # Test schedule details view
            print("10. Testing schedule details view...")
            detail_buttons = await page.query_selector_all('button:has-text("查看詳情")')
            if detail_buttons:
                await detail_buttons[0].click()
                await page.wait_for_selector('h2:has-text("排程詳情")', state='visible')
                print("✓ Schedule details displayed successfully!")
                
                # Close the details modal
                await page.keyboard.press('Escape')
                await asyncio.sleep(1)
            
            # Test conflict detection
            print("11. Checking for conflicts...")
            conflicts = await page.query_selector('.text-orange-600:has-text("衝突")')
            if conflicts:
                print("⚠ Conflicts detected in schedule")
            else:
                print("✓ No conflicts detected")
            
            # Take screenshot
            print("12. Taking screenshot...")
            await page.screenshot(path='scheduling_controls_test.png', full_page=True)
            print("✓ Screenshot saved as scheduling_controls_test.png")
            
            print("\n✅ All scheduling control tests passed!")
            
        except Exception as e:
            print(f"\n❌ Test failed: {str(e)}")
            await page.screenshot(path='scheduling_error.png')
            raise
        
        finally:
            await browser.close()


async def test_algorithm_comparison():
    """Test comparing different scheduling algorithms"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        try:
            print("\n=== Testing Algorithm Comparison ===")
            
            # Navigate to scheduling modal
            await page.goto("http://localhost:8000/admin")
            await page.wait_for_load_state("networkidle")
            await page.click('a[href="#routes"]')
            await page.wait_for_selector('#routes', state='visible')
            await page.click('button:has-text("進階排程")')
            await page.wait_for_selector('#schedulingModal', state='visible')
            
            # Test date
            test_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
            
            algorithms = ['greedy', 'genetic', 'simulated_annealing']
            results = {}
            
            for algorithm in algorithms:
                print(f"\nTesting {algorithm} algorithm...")
                
                # Reset form
                await page.fill('#schedule-date', test_date)
                await page.select_option('select[name="algorithm"]', algorithm)
                
                # Set appropriate time limit
                time_limit = '10' if algorithm == 'greedy' else '30'
                await page.fill('input[name="time_limit_seconds"]', time_limit)
                
                # Generate schedule
                start_time = time.time()
                await page.click('button:has-text("生成排程")')
                
                # Wait for result
                await page.wait_for_selector('.bg-green-50', timeout=60000)
                elapsed = time.time() - start_time
                
                print(f"✓ {algorithm} completed in {elapsed:.2f} seconds")
                results[algorithm] = elapsed
            
            print("\n=== Algorithm Performance Summary ===")
            for algo, time_taken in results.items():
                print(f"{algo}: {time_taken:.2f}s")
            
        finally:
            await browser.close()


if __name__ == "__main__":
    print("🚀 Starting scheduling controls UI tests...\n")
    
    # Run the main test
    asyncio.run(test_scheduling_controls())
    
    # Run algorithm comparison test
    asyncio.run(test_algorithm_comparison())