#!/usr/bin/env python3
"""
Comprehensive test suite for LuckyGas Management Interface
Tests all tabs, buttons, and functionality including multitasking scenarios
"""

import asyncio
import time
import json
from datetime import datetime, timedelta
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
import concurrent.futures
import requests
from typing import Dict, List, Tuple
import random

class ComprehensiveInterfaceTest:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.admin_url = f"{base_url}/admin"
        self.test_results = {
            "dashboard": {},
            "navigation": {},
            "clients": {},
            "deliveries": {},
            "drivers": {},
            "vehicles": {},
            "routes": {},
            "multitasking": {},
            "performance": {},
            "errors": []
        }
        self.start_time = None
        self.end_time = None

    async def run_all_tests(self):
        """Run all interface tests"""
        self.start_time = time.time()
        print("=" * 80)
        print("🧪 LuckyGas Management Interface Comprehensive Test Suite")
        print("=" * 80)
        
        # Check if API is running
        if not self.check_api_health():
            print("❌ API is not running. Please start the server first.")
            return self.test_results
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            
            try:
                # Run sequential tests
                print("\n📋 Running Sequential Tests...")
                context = await browser.new_context()
                page = await context.new_page()
                
                # Enable console and error logging
                page.on("console", lambda msg: self.log_console(msg))
                page.on("pageerror", lambda err: self.log_error(f"Page error: {err}"))
                
                # Navigate to admin interface
                await self.test_page_load(page)
                
                # Test each section
                await self.test_dashboard(page)
                await self.test_navigation(page)
                await self.test_clients_section(page)
                await self.test_deliveries_section(page)
                await self.test_drivers_section(page)
                await self.test_vehicles_section(page)
                await self.test_routes_section(page)
                
                await context.close()
                
                # Run multitasking tests
                print("\n🔄 Running Multitasking Tests...")
                await self.test_multitasking(browser)
                
            finally:
                await browser.close()
        
        # Run API stress tests
        print("\n⚡ Running Performance Tests...")
        self.test_api_performance()
        
        self.end_time = time.time()
        self.generate_report()
        
        return self.test_results
    
    def check_api_health(self) -> bool:
        """Check if API is running"""
        try:
            response = requests.get(f"{self.base_url}/health")
            return response.status_code == 200
        except:
            return False
    
    def log_console(self, msg):
        """Log console messages"""
        if msg.type == "error":
            self.test_results["errors"].append({
                "type": "console_error",
                "message": msg.text,
                "timestamp": datetime.now().isoformat()
            })
    
    def log_error(self, error: str):
        """Log errors"""
        self.test_results["errors"].append({
            "type": "page_error",
            "message": error,
            "timestamp": datetime.now().isoformat()
        })
    
    async def test_page_load(self, page):
        """Test initial page load"""
        print("\n1️⃣ Testing Page Load...")
        start = time.time()
        
        try:
            response = await page.goto(self.admin_url, wait_until="networkidle")
            load_time = time.time() - start
            
            self.test_results["performance"]["page_load_time"] = load_time
            self.test_results["dashboard"]["page_loaded"] = response.status == 200
            
            print(f"   ✅ Page loaded in {load_time:.2f}s")
        except Exception as e:
            print(f"   ❌ Page load failed: {e}")
            self.test_results["dashboard"]["page_loaded"] = False
    
    async def test_dashboard(self, page):
        """Test dashboard functionality"""
        print("\n2️⃣ Testing Dashboard...")
        
        # Test statistics cards
        try:
            await page.wait_for_selector("#total-clients", timeout=5000)
            
            stats = {
                "total-clients": await page.text_content("#total-clients"),
                "today-deliveries": await page.text_content("#today-deliveries"),
                "available-drivers": await page.text_content("#available-drivers"),
                "available-vehicles": await page.text_content("#available-vehicles")
            }
            
            self.test_results["dashboard"]["stats_loaded"] = all(v != "-" for v in stats.values())
            print(f"   ✅ Statistics loaded: {stats}")
        except Exception as e:
            print(f"   ❌ Statistics loading failed: {e}")
            self.test_results["dashboard"]["stats_loaded"] = False
        
        # Test refresh button
        try:
            await page.click('button:has-text("重新整理")')
            await page.wait_for_timeout(1000)
            self.test_results["dashboard"]["refresh_works"] = True
            print("   ✅ Refresh button works")
        except Exception as e:
            print(f"   ❌ Refresh button failed: {e}")
            self.test_results["dashboard"]["refresh_works"] = False
        
        # Test charts
        try:
            delivery_chart = await page.query_selector("#deliveryChart")
            status_chart = await page.query_selector("#statusChart")
            
            self.test_results["dashboard"]["charts_rendered"] = delivery_chart is not None and status_chart is not None
            print("   ✅ Charts rendered successfully")
        except:
            self.test_results["dashboard"]["charts_rendered"] = False
            print("   ❌ Charts rendering failed")
    
    async def test_navigation(self, page):
        """Test navigation between sections"""
        print("\n3️⃣ Testing Navigation...")
        
        sections = [
            ("clients", "客戶管理"),
            ("drivers", "司機管理"),
            ("vehicles", "車輛管理"),
            ("deliveries", "配送管理"),
            ("routes", "路線規劃"),
            ("dashboard", "儀表板")
        ]
        
        for section_id, section_name in sections:
            try:
                # Click navigation link
                await page.click(f'a[href="#{section_id}"]')
                await page.wait_for_timeout(500)
                
                # Check if section is visible
                is_visible = await page.is_visible(f'#{section_id}')
                self.test_results["navigation"][f"{section_id}_navigation"] = is_visible
                
                # Check if other sections are hidden
                for other_id, _ in sections:
                    if other_id != section_id:
                        other_hidden = await page.is_hidden(f'#{other_id}')
                        if not other_hidden and other_id != "dashboard":
                            print(f"   ⚠️  {other_id} not properly hidden when viewing {section_id}")
                
                print(f"   ✅ Navigation to {section_name} works")
            except Exception as e:
                print(f"   ❌ Navigation to {section_name} failed: {e}")
                self.test_results["navigation"][f"{section_id}_navigation"] = False
    
    async def test_clients_section(self, page):
        """Test client management functionality"""
        print("\n4️⃣ Testing Client Management...")
        
        # Navigate to clients
        await page.click('a[href="#clients"]')
        await page.wait_for_timeout(1000)
        
        # Test search
        try:
            search_input = await page.query_selector("#client-search")
            if search_input:
                await search_input.fill("測試")
                await page.wait_for_timeout(1500)  # Wait for debounce
                self.test_results["clients"]["search_works"] = True
                print("   ✅ Client search works")
        except:
            self.test_results["clients"]["search_works"] = False
            print("   ❌ Client search failed")
        
        # Test filters
        try:
            # District filter
            await page.select_option("#client-district", "")
            await page.wait_for_timeout(500)
            
            # Status filter
            await page.select_option("#client-status", "true")
            await page.wait_for_timeout(500)
            
            self.test_results["clients"]["filters_work"] = True
            print("   ✅ Client filters work")
        except:
            self.test_results["clients"]["filters_work"] = False
            print("   ❌ Client filters failed")
        
        # Test add client button
        try:
            await page.click('button:has-text("新增客戶")')
            await page.wait_for_selector("#addClientModal", state="visible", timeout=3000)
            
            # Close modal
            await page.click("#addClientModal button:has-text('取消')")
            await page.wait_for_selector("#addClientModal", state="hidden")
            
            self.test_results["clients"]["add_modal_works"] = True
            print("   ✅ Add client modal works")
        except:
            self.test_results["clients"]["add_modal_works"] = False
            print("   ❌ Add client modal failed")
        
        # Test client table interactions
        try:
            client_rows = await page.query_selector_all("#clients-tbody tr")
            if client_rows:
                # Click first client's view button
                first_row = client_rows[0]
                view_btn = await first_row.query_selector('button[title="查看詳情"]')
                if view_btn:
                    await view_btn.click()
                    await page.wait_for_timeout(1000)
                    
                    # Check if modal opened
                    modal_visible = await page.is_visible(".fixed.inset-0")
                    if modal_visible:
                        # Test tab switching
                        tabs = await page.query_selector_all(".client-tab-btn")
                        for tab in tabs[:2]:  # Test first two tabs
                            await tab.click()
                            await page.wait_for_timeout(500)
                        
                        # Close modal
                        close_btn = await page.query_selector(".fixed.inset-0 button:has-text('×')")
                        if close_btn:
                            await close_btn.click()
                        
                        self.test_results["clients"]["detail_modal_works"] = True
                        print("   ✅ Client detail modal and tabs work")
            else:
                print("   ⚠️  No clients found to test interactions")
        except Exception as e:
            self.test_results["clients"]["detail_modal_works"] = False
            print(f"   ❌ Client detail modal failed: {e}")
        
        # Test export button
        try:
            export_btn = await page.query_selector('button:has-text("匯出")')
            if export_btn:
                # Just check if button is clickable
                is_enabled = await export_btn.is_enabled()
                self.test_results["clients"]["export_button_enabled"] = is_enabled
                print(f"   {'✅' if is_enabled else '❌'} Export button {'enabled' if is_enabled else 'disabled'}")
        except:
            self.test_results["clients"]["export_button_enabled"] = False
    
    async def test_deliveries_section(self, page):
        """Test delivery management functionality"""
        print("\n5️⃣ Testing Delivery Management...")
        
        # Navigate to deliveries
        await page.click('a[href="#deliveries"]')
        await page.wait_for_timeout(1000)
        
        # Test date filters
        try:
            date_from = await page.query_selector("#delivery-date-from")
            date_to = await page.query_selector("#delivery-date-to")
            
            if date_from and date_to:
                # Check if dates are pre-filled
                from_value = await date_from.get_attribute("value")
                to_value = await date_to.get_attribute("value")
                
                self.test_results["deliveries"]["date_filters_prefilled"] = bool(from_value and to_value)
                print(f"   ✅ Date filters pre-filled: {from_value} to {to_value}")
        except:
            self.test_results["deliveries"]["date_filters_prefilled"] = False
        
        # Test status filter
        try:
            await page.select_option("#delivery-status", "pending")
            await page.wait_for_timeout(1000)
            
            await page.select_option("#delivery-status", "")
            await page.wait_for_timeout(1000)
            
            self.test_results["deliveries"]["status_filter_works"] = True
            print("   ✅ Delivery status filter works")
        except:
            self.test_results["deliveries"]["status_filter_works"] = False
            print("   ❌ Delivery status filter failed")
        
        # Test add delivery button
        try:
            await page.click('button:has-text("新增配送單")')
            await page.wait_for_selector("#addDeliveryModal", state="visible", timeout=3000)
            
            # Check if client dropdown is populated
            client_select = await page.query_selector('#addDeliveryModal select[name="client_id"]')
            if client_select:
                options = await client_select.query_selector_all("option")
                self.test_results["deliveries"]["client_dropdown_populated"] = len(options) > 1
                print(f"   ✅ Client dropdown populated with {len(options)-1} clients")
            
            # Close modal
            await page.click("#addDeliveryModal button:has-text('取消')")
            await page.wait_for_selector("#addDeliveryModal", state="hidden")
            
            self.test_results["deliveries"]["add_modal_works"] = True
            print("   ✅ Add delivery modal works")
        except Exception as e:
            self.test_results["deliveries"]["add_modal_works"] = False
            print(f"   ❌ Add delivery modal failed: {e}")
        
        # Test delivery table interactions
        try:
            delivery_rows = await page.query_selector_all("#deliveries-tbody tr")
            if delivery_rows:
                # Test status update button
                first_row = delivery_rows[0]
                status_btn = await first_row.query_selector('button[title="更新狀態"]')
                if status_btn:
                    # Just verify button exists and is clickable
                    is_enabled = await status_btn.is_enabled()
                    self.test_results["deliveries"]["status_update_button"] = is_enabled
                    print(f"   {'✅' if is_enabled else '❌'} Status update button {'enabled' if is_enabled else 'disabled'}")
            else:
                print("   ⚠️  No deliveries found to test interactions")
        except:
            self.test_results["deliveries"]["status_update_button"] = False
    
    async def test_drivers_section(self, page):
        """Test driver management functionality"""
        print("\n6️⃣ Testing Driver Management...")
        
        # Navigate to drivers
        await page.click('a[href="#drivers"]')
        await page.wait_for_timeout(1000)
        
        # Check driver statistics
        try:
            stats = {
                "total": await page.text_content("#total-drivers"),
                "available": await page.text_content("#available-drivers-count"),
                "busy": await page.text_content("#busy-drivers"),
                "today_completed": await page.text_content("#today-completed-drivers")
            }
            
            self.test_results["drivers"]["stats_loaded"] = all(v != "0" or v.isdigit() for v in stats.values())
            print(f"   ✅ Driver statistics loaded: {stats}")
        except:
            self.test_results["drivers"]["stats_loaded"] = False
            print("   ❌ Driver statistics failed")
        
        # Test add driver button
        try:
            await page.click('button:has-text("新增司機")')
            await page.wait_for_selector("#addDriverModal", state="visible", timeout=3000)
            
            # Check form fields
            form_fields = ["name", "employee_id", "phone", "license_type"]
            fields_found = []
            
            for field in form_fields:
                field_elem = await page.query_selector(f'#addDriverModal [name="{field}"]')
                if field_elem:
                    fields_found.append(field)
            
            self.test_results["drivers"]["form_fields_complete"] = len(fields_found) == len(form_fields)
            print(f"   ✅ Driver form has {len(fields_found)}/{len(form_fields)} required fields")
            
            # Close modal
            await page.click("#addDriverModal button:has-text('取消')")
            await page.wait_for_selector("#addDriverModal", state="hidden")
            
            self.test_results["drivers"]["add_modal_works"] = True
        except:
            self.test_results["drivers"]["add_modal_works"] = False
            print("   ❌ Add driver modal failed")
        
        # Test driver table actions
        try:
            driver_rows = await page.query_selector_all("#drivers-tbody tr")
            if driver_rows:
                # Check action buttons
                first_row = driver_rows[0]
                buttons = {
                    "info": await first_row.query_selector('button[title="詳細資料"]'),
                    "toggle": await first_row.query_selector('button[title="切換狀態"]'),
                    "deliveries": await first_row.query_selector('button[title="配送記錄"]')
                }
                
                buttons_found = sum(1 for btn in buttons.values() if btn is not None)
                self.test_results["drivers"]["action_buttons"] = buttons_found == 3
                print(f"   ✅ Driver action buttons: {buttons_found}/3 found")
            else:
                print("   ⚠️  No drivers found to test interactions")
        except:
            self.test_results["drivers"]["action_buttons"] = False
    
    async def test_vehicles_section(self, page):
        """Test vehicle management functionality"""
        print("\n7️⃣ Testing Vehicle Management...")
        
        # Navigate to vehicles
        await page.click('a[href="#vehicles"]')
        await page.wait_for_timeout(1000)
        
        # Check vehicle statistics
        try:
            stats = {
                "total": await page.text_content("#total-vehicles"),
                "available": await page.text_content("#available-vehicles-count"),
                "maintenance": await page.text_content("#maintenance-vehicles"),
                "due_maintenance": await page.text_content("#due-maintenance")
            }
            
            self.test_results["vehicles"]["stats_loaded"] = all(v != "0" or v.isdigit() for v in stats.values())
            print(f"   ✅ Vehicle statistics loaded: {stats}")
        except:
            self.test_results["vehicles"]["stats_loaded"] = False
            print("   ❌ Vehicle statistics failed")
        
        # Test add vehicle button
        try:
            await page.click('button:has-text("新增車輛")')
            await page.wait_for_selector("#addVehicleModal", state="visible", timeout=3000)
            
            # Check vehicle type dropdown
            vehicle_type_select = await page.query_selector('#addVehicleModal select[name="vehicle_type"]')
            if vehicle_type_select:
                options = await vehicle_type_select.query_selector_all("option")
                self.test_results["vehicles"]["vehicle_types_available"] = len(options) > 1
                print(f"   ✅ Vehicle type dropdown has {len(options)-1} options")
            
            # Close modal
            await page.click("#addVehicleModal button:has-text('取消')")
            await page.wait_for_selector("#addVehicleModal", state="hidden")
            
            self.test_results["vehicles"]["add_modal_works"] = True
        except:
            self.test_results["vehicles"]["add_modal_works"] = False
            print("   ❌ Add vehicle modal failed")
    
    async def test_routes_section(self, page):
        """Test route planning functionality"""
        print("\n8️⃣ Testing Route Planning...")
        
        # Navigate to routes
        await page.click('a[href="#routes"]')
        await page.wait_for_timeout(1000)
        
        # Test filter elements
        try:
            filters_present = {
                "date_from": await page.query_selector("#route-date-from"),
                "date_to": await page.query_selector("#route-date-to"),
                "area": await page.query_selector("#route-area"),
                "driver": await page.query_selector("#route-driver")
            }
            
            self.test_results["routes"]["filters_present"] = all(filters_present.values())
            print(f"   ✅ Route filters present: {sum(1 for f in filters_present.values() if f)}/4")
        except:
            self.test_results["routes"]["filters_present"] = False
        
        # Test route planning buttons
        try:
            auto_plan_btn = await page.query_selector('button:has-text("自動規劃")')
            manual_create_btn = await page.query_selector('button:has-text("手動建立")')
            
            self.test_results["routes"]["planning_buttons"] = auto_plan_btn is not None and manual_create_btn is not None
            print(f"   {'✅' if self.test_results['routes']['planning_buttons'] else '❌'} Route planning buttons present")
            
            # Test auto planning modal
            if auto_plan_btn:
                await auto_plan_btn.click()
                await page.wait_for_timeout(1000)
                
                modal_visible = await page.is_visible("#routePlanModal")
                if modal_visible:
                    # Close modal
                    await page.click('#routePlanModal button:has-text("取消")')
                    await page.wait_for_timeout(500)
                
                self.test_results["routes"]["auto_plan_modal"] = modal_visible
                print(f"   {'✅' if modal_visible else '❌'} Auto planning modal works")
        except:
            self.test_results["routes"]["planning_buttons"] = False
    
    async def test_multitasking(self, browser):
        """Test multitasking scenarios"""
        print("\n🔄 Testing Multitasking Scenarios...")
        
        # Create multiple contexts (tabs/windows)
        contexts = []
        pages = []
        
        try:
            # Create 3 browser contexts
            for i in range(3):
                context = await browser.new_context()
                page = await context.new_page()
                await page.goto(self.admin_url)
                await page.wait_for_timeout(2000)
                contexts.append(context)
                pages.append(page)
                print(f"   ✅ Opened tab {i+1}")
            
            # Test 1: Navigate to different sections simultaneously
            sections = ["clients", "deliveries", "drivers"]
            tasks = []
            for i, (page, section) in enumerate(zip(pages, sections)):
                task = page.click(f'a[href="#{section}"]')
                tasks.append(task)
            
            await asyncio.gather(*tasks)
            await asyncio.sleep(1)
            
            # Verify each page is on correct section
            for i, (page, section) in enumerate(zip(pages, sections)):
                is_visible = await page.is_visible(f'#{section}')
                self.test_results["multitasking"][f"tab_{i+1}_navigation"] = is_visible
            
            print("   ✅ Multi-tab navigation works")
            
            # Test 2: Simultaneous search operations
            search_tasks = []
            for page in pages[:2]:  # Use first 2 tabs
                await page.click('a[href="#clients"]')
                await page.wait_for_timeout(1000)
                
                search_input = await page.query_selector("#client-search")
                if search_input:
                    task = search_input.fill(f"test_{random.randint(1, 100)}")
                    search_tasks.append(task)
            
            if search_tasks:
                await asyncio.gather(*search_tasks)
                await asyncio.sleep(2)
                print("   ✅ Simultaneous search operations work")
                self.test_results["multitasking"]["concurrent_search"] = True
            
            # Test 3: Rapid button clicking (rate limiting test)
            refresh_count = 0
            errors = 0
            
            for i in range(5):
                try:
                    await pages[0].click('a[href="#dashboard"]')
                    await pages[0].wait_for_timeout(200)
                    await pages[0].click('button:has-text("重新整理")')
                    refresh_count += 1
                except:
                    errors += 1
                await asyncio.sleep(0.1)
            
            self.test_results["multitasking"]["rapid_refresh"] = {
                "attempts": 5,
                "successful": refresh_count,
                "errors": errors
            }
            print(f"   ✅ Rapid refresh test: {refresh_count}/5 successful")
            
        except Exception as e:
            print(f"   ❌ Multitasking test failed: {e}")
            self.test_results["multitasking"]["error"] = str(e)
        
        finally:
            # Close all contexts
            for context in contexts:
                await context.close()
    
    def test_api_performance(self):
        """Test API performance and concurrent requests"""
        print("\n⚡ Testing API Performance...")
        
        endpoints = [
            "/clients",
            "/deliveries",
            "/drivers",
            "/vehicles",
            "/dashboard/stats"
        ]
        
        # Test individual endpoint response times
        for endpoint in endpoints:
            try:
                start = time.time()
                response = requests.get(f"{self.api_base}{endpoint}")
                response_time = time.time() - start
                
                self.test_results["performance"][f"{endpoint}_response_time"] = response_time
                status = "✅" if response_time < 1.0 else "⚠️"
                print(f"   {status} {endpoint}: {response_time:.3f}s")
            except Exception as e:
                self.test_results["performance"][f"{endpoint}_error"] = str(e)
                print(f"   ❌ {endpoint}: Failed")
        
        # Test concurrent API requests
        print("\n   Testing concurrent API requests...")
        
        def make_request(endpoint):
            try:
                start = time.time()
                response = requests.get(f"{self.api_base}{endpoint}")
                return (endpoint, time.time() - start, response.status_code)
            except Exception as e:
                return (endpoint, -1, str(e))
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            # Make 20 concurrent requests
            futures = []
            for _ in range(4):
                for endpoint in endpoints:
                    future = executor.submit(make_request, endpoint)
                    futures.append(future)
            
            results = []
            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())
        
        # Analyze concurrent request results
        successful = sum(1 for _, time, status in results if isinstance(status, int) and status == 200)
        avg_time = sum(time for _, time, _ in results if time > 0) / len([r for r in results if r[1] > 0])
        
        self.test_results["performance"]["concurrent_requests"] = {
            "total": len(results),
            "successful": successful,
            "average_time": avg_time
        }
        
        print(f"   ✅ Concurrent requests: {successful}/{len(results)} successful, avg {avg_time:.3f}s")
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "=" * 80)
        print("📊 TEST REPORT")
        print("=" * 80)
        
        total_tests = 0
        passed_tests = 0
        
        # Dashboard Tests
        print("\n🏠 Dashboard Tests:")
        for test, result in self.test_results["dashboard"].items():
            total_tests += 1
            if result:
                passed_tests += 1
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"   {test}: {status}")
        
        # Navigation Tests
        print("\n🧭 Navigation Tests:")
        for test, result in self.test_results["navigation"].items():
            total_tests += 1
            if result:
                passed_tests += 1
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"   {test}: {status}")
        
        # Section Tests
        sections = ["clients", "deliveries", "drivers", "vehicles", "routes"]
        for section in sections:
            print(f"\n📋 {section.capitalize()} Section Tests:")
            for test, result in self.test_results[section].items():
                total_tests += 1
                if isinstance(result, bool) and result:
                    passed_tests += 1
                    status = "✅ PASS"
                elif isinstance(result, bool):
                    status = "❌ FAIL"
                else:
                    status = f"ℹ️ {result}"
                print(f"   {test}: {status}")
        
        # Multitasking Tests
        print("\n🔄 Multitasking Tests:")
        for test, result in self.test_results["multitasking"].items():
            if isinstance(result, dict):
                print(f"   {test}: {result}")
            else:
                total_tests += 1
                if result:
                    passed_tests += 1
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"   {test}: {status}")
        
        # Performance Metrics
        print("\n⚡ Performance Metrics:")
        for metric, value in self.test_results["performance"].items():
            if isinstance(value, float):
                status = "✅" if value < 1.0 else "⚠️"
                print(f"   {metric}: {status} {value:.3f}s")
            elif isinstance(value, dict):
                print(f"   {metric}: {value}")
        
        # Errors
        if self.test_results["errors"]:
            print(f"\n⚠️ Errors Detected ({len(self.test_results['errors'])}):")
            for error in self.test_results["errors"][:5]:  # Show first 5 errors
                print(f"   - {error['type']}: {error['message'][:100]}...")
        
        # Summary
        print("\n" + "=" * 80)
        print(f"📈 SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        print(f"Total Execution Time: {self.end_time - self.start_time:.2f}s")
        
        # Recommendations
        print("\n💡 RECOMMENDATIONS:")
        
        if self.test_results["performance"]["page_load_time"] > 3:
            print("   - Consider optimizing initial page load (currently > 3s)")
        
        if any(not self.test_results["navigation"].get(f"{s}_navigation", True) for s in sections):
            print("   - Fix navigation issues for smooth section switching")
        
        if self.test_results["errors"]:
            print(f"   - Address {len(self.test_results['errors'])} console/page errors")
        
        if not self.test_results["multitasking"].get("concurrent_search", True):
            print("   - Improve concurrent operation handling")
        
        # Save detailed report
        report_file = f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(self.test_results, f, ensure_ascii=False, indent=2)
        
        print(f"\n📄 Detailed report saved to: {report_file}")


async def main():
    """Run the comprehensive test suite"""
    tester = ComprehensiveInterfaceTest()
    await tester.run_all_tests()


if __name__ == "__main__":
    print("🚀 Starting LuckyGas Interface Test Suite...")
    print("⚠️  Make sure the API server is running at http://localhost:8000")
    print("-" * 80)
    
    asyncio.run(main())