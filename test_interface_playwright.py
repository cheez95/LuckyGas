#!/usr/bin/env python3
"""Test the LuckyGas management interface with Playwright"""

import asyncio
from playwright.async_api import async_playwright
import json

async def test_management_interface():
    """Test the LuckyGas management interface with Playwright"""
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # Enable console logging
        page.on("console", lambda msg: print(f"Console {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page error: {err}"))
        
        results = {
            "page_load": False,
            "dashboard_loaded": False,
            "api_calls": [],
            "errors": [],
            "filter_tests": {}
        }
        
        # Monitor network requests
        async def log_request(request):
            if "/api/" in request.url:
                results["api_calls"].append({
                    "url": request.url,
                    "method": request.method,
                    "status": None
                })
        
        async def log_response(response):
            if "/api/" in response.url:
                for req in results["api_calls"]:
                    if req["url"] == response.url and req["status"] is None:
                        req["status"] = response.status
                        if response.status >= 400:
                            try:
                                error_body = await response.text()
                                results["errors"].append({
                                    "url": response.url,
                                    "status": response.status,
                                    "error": error_body
                                })
                            except:
                                pass
                        break
        
        page.on("request", log_request)
        page.on("response", log_response)
        
        try:
            # Navigate to the admin page
            print("📍 Navigating to http://localhost:8000/admin")
            response = await page.goto("http://localhost:8000/admin", wait_until="networkidle")
            results["page_load"] = response.status == 200
            
            if not results["page_load"]:
                print(f"❌ Page failed to load: {response.status}")
                return results
            
            # Wait for initial content
            await page.wait_for_timeout(2000)
            
            # Check if dashboard is visible
            dashboard_visible = await page.is_visible("#dashboard")
            results["dashboard_loaded"] = dashboard_visible
            print(f"📊 Dashboard visible: {dashboard_visible}")
            
            # Check for JavaScript errors
            await page.wait_for_timeout(1000)
            
            # Test 1: Check if statistics are loaded
            print("\n🔍 Testing Dashboard Statistics...")
            total_clients = await page.text_content("#total-clients")
            print(f"Total clients shown: {total_clients}")
            
            # Test 2: Navigate to Clients section
            print("\n👥 Testing Clients Section...")
            await page.click('a[href="#clients"]')
            await page.wait_for_timeout(1000)
            
            clients_visible = await page.is_visible("#clients")
            print(f"Clients section visible: {clients_visible}")
            
            # Test 3: Check if client table has data
            client_rows = await page.query_selector_all("#clients-tbody tr")
            print(f"Client rows found: {len(client_rows)}")
            
            # Test 4: Test client search filter
            print("\n🔍 Testing Client Search Filter...")
            search_input = await page.query_selector("#client-search")
            if search_input:
                await search_input.fill("test")
                await page.wait_for_timeout(1000)  # Wait for debounce
                
                # Check if API call was made
                search_api_calls = [call for call in results["api_calls"] if "keyword=test" in call["url"]]
                results["filter_tests"]["client_search"] = len(search_api_calls) > 0
                print(f"Search filter triggered API: {results['filter_tests']['client_search']}")
            
            # Test 5: Test district filter
            print("\n🏢 Testing District Filter...")
            district_select = await page.query_selector("#client-district")
            if district_select:
                # Get available options
                options = await page.query_selector_all("#client-district option")
                print(f"District options found: {len(options)}")
                
                if len(options) > 1:
                    await district_select.select_option(index=1)
                    await page.wait_for_timeout(500)
                    
                    district_api_calls = [call for call in results["api_calls"] if "district=" in call["url"]]
                    results["filter_tests"]["district_filter"] = len(district_api_calls) > 0
                    print(f"District filter triggered API: {results['filter_tests']['district_filter']}")
            
            # Test 6: Navigate to Deliveries section
            print("\n📦 Testing Deliveries Section...")
            await page.click('a[href="#deliveries"]')
            await page.wait_for_timeout(1000)
            
            deliveries_visible = await page.is_visible("#deliveries")
            print(f"Deliveries section visible: {deliveries_visible}")
            
            # Check for delivery errors
            delivery_errors = [err for err in results["errors"] if "deliveries" in err["url"]]
            if delivery_errors:
                print(f"⚠️ Delivery API errors found: {len(delivery_errors)}")
                for err in delivery_errors[:2]:  # Show first 2 errors
                    print(f"  - {err['url']}: {err['status']}")
            
            # Test 7: Check date filters
            print("\n📅 Testing Date Range Filter...")
            date_from = await page.query_selector("#delivery-date-from")
            date_to = await page.query_selector("#delivery-date-to")
            
            if date_from and date_to:
                from_value = await date_from.get_attribute("value")
                to_value = await date_to.get_attribute("value")
                print(f"Date range: {from_value} to {to_value}")
                
                # Change date and see if it triggers API
                await date_from.fill("2025-07-01")
                await page.wait_for_timeout(500)
                
                date_api_calls = [call for call in results["api_calls"] if "scheduled_date_from=2025-07-01" in call["url"]]
                results["filter_tests"]["date_filter"] = len(date_api_calls) > 0
                print(f"Date filter triggered API: {results['filter_tests']['date_filter']}")
            
            # Test 8: Check for console errors
            print("\n⚠️ Checking for JavaScript errors...")
            # Already captured via console event listener
            
            # Summary
            print("\n" + "="*50)
            print("📊 TEST SUMMARY")
            print("="*50)
            print(f"✅ Page loaded: {results['page_load']}")
            print(f"✅ Dashboard visible: {results['dashboard_loaded']}")
            print(f"📡 Total API calls: {len(results['api_calls'])}")
            print(f"❌ API errors: {len(results['errors'])}")
            print(f"\n🔍 Filter Tests:")
            for test, passed in results["filter_tests"].items():
                print(f"  - {test}: {'✅ Working' if passed else '❌ Not working'}")
            
            if results["errors"]:
                print(f"\n❌ API Errors Details:")
                for err in results["errors"][:5]:  # Show first 5
                    print(f"  - {err['url']}: {err['status']}")
                    if "pending" in err.get("error", ""):
                        print("    💡 Enum error detected - database has lowercase status values")
            
            # Take screenshot
            await page.screenshot(path="management_interface_test.png")
            print("\n📸 Screenshot saved as management_interface_test.png")
            
        except Exception as e:
            print(f"❌ Error during testing: {e}")
            results["errors"].append({"type": "exception", "message": str(e)})
        
        finally:
            await browser.close()
        
        return results

# Run the test
if __name__ == "__main__":
    results = asyncio.run(test_management_interface())
    print("\n🔍 Detailed results:")
    print(json.dumps(results, indent=2))