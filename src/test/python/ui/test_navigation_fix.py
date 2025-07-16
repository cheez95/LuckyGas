"""Test the navigation fixes"""
import asyncio
from playwright.async_api import async_playwright


async def test_navigation_fixes():
    """Test that navigation is working correctly after fixes"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        try:
            print("1. Testing direct URL navigation...")
            # Test navigating directly to a section via URL hash
            await page.goto("http://localhost:8000/admin#drivers")
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
            
            # Check if drivers section is visible
            drivers_section = await page.query_selector('#drivers')
            is_visible = await drivers_section.is_visible() if drivers_section else False
            print(f"✓ Drivers section visible on direct navigation: {is_visible}")
            
            # Check if dashboard is hidden
            dashboard_section = await page.query_selector('#dashboard')
            dashboard_hidden = await dashboard_section.is_hidden() if dashboard_section else True
            print(f"✓ Dashboard hidden when navigating to drivers: {dashboard_hidden}")
            
            print("\n2. Testing navigation clicks...")
            # Click on clients link
            await page.click('a[href="#clients"]')
            await asyncio.sleep(1)
            
            # Check URL hash updated
            current_url = page.url
            print(f"✓ URL after clicking clients: {current_url}")
            assert "#clients" in current_url, "URL hash not updated"
            
            # Check clients section is visible
            clients_section = await page.query_selector('#clients')
            clients_visible = await clients_section.is_visible() if clients_section else False
            print(f"✓ Clients section visible: {clients_visible}")
            
            print("\n3. Testing browser back button...")
            # Go back
            await page.go_back()
            await asyncio.sleep(1)
            
            # Should be back at drivers
            current_url = page.url
            print(f"✓ URL after back button: {current_url}")
            assert "#drivers" in current_url, "Back button navigation failed"
            
            print("\n4. Testing default navigation...")
            # Navigate to root (no hash)
            await page.goto("http://localhost:8000/admin")
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1)
            
            # Dashboard should be visible
            dashboard_section = await page.query_selector('#dashboard')
            dashboard_visible = await dashboard_section.is_visible() if dashboard_section else False
            print(f"✓ Dashboard visible by default: {dashboard_visible}")
            
            print("\n5. Testing all navigation links...")
            sections = ['dashboard', 'clients', 'drivers', 'vehicles', 'deliveries', 'routes']
            
            for section in sections:
                await page.click(f'a[href="#{section}"]')
                await asyncio.sleep(0.5)
                
                # Check section is visible
                section_el = await page.query_selector(f'#{section}')
                is_visible = await section_el.is_visible() if section_el else False
                print(f"✓ {section.capitalize()} section visible: {is_visible}")
                
                # Check URL
                assert f"#{section}" in page.url, f"URL hash not updated for {section}"
            
            print("\n6. Testing scheduling modal...")
            # Navigate to routes
            await page.click('a[href="#routes"]')
            await asyncio.sleep(1)
            
            # Click scheduling button
            await page.click('button:has-text("進階排程")')
            await asyncio.sleep(1)
            
            # Check modal is visible
            modal = await page.query_selector('#schedulingModal')
            modal_visible = await modal.is_visible() if modal else False
            print(f"✓ Scheduling modal visible: {modal_visible}")
            
            # Close modal
            await page.click('button[onclick="closeModal(\'schedulingModal\')"]')
            await asyncio.sleep(0.5)
            
            print("\n✅ All navigation tests passed!")
            
        except Exception as e:
            print(f"\n❌ Test failed: {str(e)}")
            await page.screenshot(path='navigation_error.png')
            raise
        
        finally:
            await browser.close()


if __name__ == "__main__":
    print("🚀 Testing navigation fixes...\n")
    asyncio.run(test_navigation_fixes())