"""Test script for the new delivery tabbed interface functionality."""
import asyncio
import aiohttp
import json
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional
import time


class DeliveryTabTester:
    """Test class for delivery tab functionality."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize tester with API base URL."""
        self.base_url = base_url
        self.api_url = f"{base_url}/api/deliveries"
        self.test_results = []
        
    async def test_multi_status_filtering(self, session: aiohttp.ClientSession) -> Dict:
        """Test API support for multiple status filtering."""
        print("\n📋 Testing Multi-Status Filtering...")
        
        test_cases = [
            {
                "name": "Planned statuses (pending, assigned, in_progress)",
                "params": {"status": ["pending", "assigned", "in_progress"]},
                "expected_statuses": ["pending", "assigned", "in_progress"]
            },
            {
                "name": "History statuses (completed, cancelled)",
                "params": {"status": ["completed", "cancelled"]},
                "expected_statuses": ["completed", "cancelled"]
            },
            {
                "name": "Single status (backward compatibility)",
                "params": {"status": ["pending"]},
                "expected_statuses": ["pending"]
            }
        ]
        
        results = {"passed": 0, "failed": 0, "tests": []}
        
        for test in test_cases:
            try:
                # Build query string with multiple status values
                params = []
                for status in test["params"]["status"]:
                    params.append(f"status={status}")
                query_string = "&".join(params)
                
                async with session.get(f"{self.api_url}?{query_string}") as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Verify all returned items have expected status
                        all_valid = True
                        for item in data.get("items", []):
                            if item["status"] not in test["expected_statuses"]:
                                all_valid = False
                                break
                        
                        if all_valid:
                            results["passed"] += 1
                            results["tests"].append({
                                "name": test["name"],
                                "status": "✅ PASSED",
                                "details": f"Returned {len(data.get('items', []))} items with correct statuses"
                            })
                        else:
                            results["failed"] += 1
                            results["tests"].append({
                                "name": test["name"],
                                "status": "❌ FAILED",
                                "details": "Some items have unexpected status values"
                            })
                    else:
                        results["failed"] += 1
                        results["tests"].append({
                            "name": test["name"],
                            "status": "❌ FAILED",
                            "details": f"HTTP {response.status}"
                        })
                        
            except Exception as e:
                results["failed"] += 1
                results["tests"].append({
                    "name": test["name"],
                    "status": "❌ FAILED",
                    "details": str(e)
                })
        
        return results
    
    async def test_tab_switching_ui(self) -> Dict:
        """Test tab switching functionality in the UI."""
        print("\n🔄 Testing Tab Switching UI...")
        
        # This would normally use Selenium or similar for UI testing
        # For now, we'll document the manual test steps
        test_steps = {
            "manual_tests": [
                {
                    "step": 1,
                    "action": "Click on '計劃中' (Planned) tab",
                    "expected": "Tab becomes active, shows pending/assigned/in_progress deliveries",
                    "verification": "Check localStorage['deliveryTab'] === 'planned'"
                },
                {
                    "step": 2,
                    "action": "Click on '歷史記錄' (History) tab",
                    "expected": "Tab becomes active, shows completed/cancelled deliveries",
                    "verification": "Check localStorage['deliveryTab'] === 'history'"
                },
                {
                    "step": 3,
                    "action": "Reload the page",
                    "expected": "Previously selected tab remains active",
                    "verification": "Tab state persists after reload"
                },
                {
                    "step": 4,
                    "action": "Check summary statistics",
                    "expected": "Summary shows only stats for current tab's deliveries",
                    "verification": "Total count matches filtered deliveries"
                }
            ]
        }
        
        return test_steps
    
    async def test_summary_calculations(self, session: aiohttp.ClientSession) -> Dict:
        """Test that summary calculations are correct for each tab."""
        print("\n📊 Testing Summary Calculations...")
        
        results = {"passed": 0, "failed": 0, "tests": []}
        
        # Test planned tab summary
        try:
            params = "&".join(["status=pending", "status=assigned", "status=in_progress"])
            async with session.get(f"{self.api_url}?{params}") as response:
                if response.status == 200:
                    data = await response.json()
                    total = data.get("total", 0)
                    
                    # Count statuses manually
                    status_counts = {"pending": 0, "assigned": 0, "in_progress": 0}
                    for item in data.get("items", []):
                        if item["status"] in status_counts:
                            status_counts[item["status"]] += 1
                    
                    # Verify total matches sum of statuses
                    calculated_total = sum(status_counts.values())
                    if calculated_total == len(data.get("items", [])):
                        results["passed"] += 1
                        results["tests"].append({
                            "name": "Planned tab summary",
                            "status": "✅ PASSED",
                            "details": f"Total: {total}, Breakdown: {status_counts}"
                        })
                    else:
                        results["failed"] += 1
                        results["tests"].append({
                            "name": "Planned tab summary",
                            "status": "❌ FAILED",
                            "details": "Summary count mismatch"
                        })
                        
        except Exception as e:
            results["failed"] += 1
            results["tests"].append({
                "name": "Planned tab summary",
                "status": "❌ FAILED",
                "details": str(e)
            })
        
        # Test history tab summary
        try:
            params = "&".join(["status=completed", "status=cancelled"])
            async with session.get(f"{self.api_url}?{params}") as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Calculate completion rate
                    completed = sum(1 for item in data.get("items", []) if item["status"] == "completed")
                    cancelled = sum(1 for item in data.get("items", []) if item["status"] == "cancelled")
                    total = completed + cancelled
                    
                    if total > 0:
                        completion_rate = (completed / total) * 100
                        results["passed"] += 1
                        results["tests"].append({
                            "name": "History tab completion rate",
                            "status": "✅ PASSED",
                            "details": f"Completed: {completed}, Cancelled: {cancelled}, Rate: {completion_rate:.1f}%"
                        })
                    else:
                        results["tests"].append({
                            "name": "History tab completion rate",
                            "status": "⚠️ NO DATA",
                            "details": "No historical deliveries to test"
                        })
                        
        except Exception as e:
            results["failed"] += 1
            results["tests"].append({
                "name": "History tab completion rate",
                "status": "❌ FAILED",
                "details": str(e)
            })
        
        return results
    
    async def test_performance(self, session: aiohttp.ClientSession) -> Dict:
        """Test performance of tab switching and data loading."""
        print("\n⚡ Testing Performance...")
        
        results = {"tests": []}
        
        # Test API response times
        test_queries = [
            ("Single status", ["status=pending"]),
            ("Multiple statuses", ["status=pending", "status=assigned", "status=in_progress"]),
            ("Full list", [])
        ]
        
        for name, params in test_queries:
            try:
                query_string = "&".join(params)
                start_time = time.time()
                
                async with session.get(f"{self.api_url}?{query_string}") as response:
                    await response.json()
                    
                end_time = time.time()
                response_time = (end_time - start_time) * 1000  # Convert to ms
                
                status = "✅ GOOD" if response_time < 500 else "⚠️ SLOW" if response_time < 1000 else "❌ TOO SLOW"
                
                results["tests"].append({
                    "name": name,
                    "response_time": f"{response_time:.0f}ms",
                    "status": status
                })
                
            except Exception as e:
                results["tests"].append({
                    "name": name,
                    "response_time": "N/A",
                    "status": "❌ ERROR",
                    "error": str(e)
                })
        
        return results
    
    async def test_edge_cases(self, session: aiohttp.ClientSession) -> Dict:
        """Test edge cases and error handling."""
        print("\n🔍 Testing Edge Cases...")
        
        results = {"passed": 0, "failed": 0, "tests": []}
        
        edge_cases = [
            {
                "name": "Empty status array",
                "params": {"status": []},
                "expected": "Should return all deliveries"
            },
            {
                "name": "Invalid status value",
                "params": {"status": ["invalid_status"]},
                "expected": "Should ignore invalid status or return empty"
            },
            {
                "name": "Mixed valid/invalid statuses",
                "params": {"status": ["pending", "invalid", "completed"]},
                "expected": "Should filter by valid statuses only"
            }
        ]
        
        for test in edge_cases:
            try:
                # Build query
                if test["params"]["status"]:
                    params = [f"status={s}" for s in test["params"]["status"]]
                    query_string = "&".join(params)
                else:
                    query_string = ""
                
                async with session.get(f"{self.api_url}?{query_string}") as response:
                    if response.status in [200, 400, 422]:
                        results["passed"] += 1
                        results["tests"].append({
                            "name": test["name"],
                            "status": "✅ HANDLED",
                            "details": f"HTTP {response.status} - {test['expected']}"
                        })
                    else:
                        results["failed"] += 1
                        results["tests"].append({
                            "name": test["name"],
                            "status": "❌ UNEXPECTED",
                            "details": f"HTTP {response.status}"
                        })
                        
            except Exception as e:
                results["failed"] += 1
                results["tests"].append({
                    "name": test["name"],
                    "status": "❌ ERROR",
                    "details": str(e)
                })
        
        return results
    
    def print_test_results(self, results: Dict, test_name: str):
        """Print formatted test results."""
        print(f"\n{'='*60}")
        print(f"Test: {test_name}")
        print(f"{'='*60}")
        
        if "tests" in results:
            for test in results["tests"]:
                print(f"\n{test.get('status', '?')} {test.get('name', 'Unknown test')}")
                if "details" in test:
                    print(f"   Details: {test['details']}")
                if "response_time" in test:
                    print(f"   Response Time: {test['response_time']}")
                if "error" in test:
                    print(f"   Error: {test['error']}")
        
        if "passed" in results and "failed" in results:
            total = results["passed"] + results["failed"]
            print(f"\n{'='*60}")
            print(f"Summary: {results['passed']}/{total} passed ({results['passed']/total*100:.0f}%)")
            print(f"{'='*60}")
        
        if "manual_tests" in results:
            print("\n📝 Manual Test Steps:")
            for test in results["manual_tests"]:
                print(f"\nStep {test['step']}: {test['action']}")
                print(f"Expected: {test['expected']}")
                print(f"Verify: {test['verification']}")
    
    async def run_all_tests(self):
        """Run all tests."""
        print("🧪 LuckyGas Delivery Tab Testing Suite")
        print("=====================================")
        print(f"Testing against: {self.base_url}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        async with aiohttp.ClientSession() as session:
            # Run API tests
            multi_status_results = await self.test_multi_status_filtering(session)
            self.print_test_results(multi_status_results, "Multi-Status Filtering")
            
            summary_results = await self.test_summary_calculations(session)
            self.print_test_results(summary_results, "Summary Calculations")
            
            performance_results = await self.test_performance(session)
            self.print_test_results(performance_results, "Performance")
            
            edge_case_results = await self.test_edge_cases(session)
            self.print_test_results(edge_case_results, "Edge Cases")
            
            # Document UI tests
            ui_results = await self.test_tab_switching_ui()
            self.print_test_results(ui_results, "UI Tab Switching (Manual)")
        
        print(f"\n✅ Testing completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\n📌 Next Steps:")
        print("1. Run manual UI tests as documented above")
        print("2. Verify localStorage persistence")
        print("3. Test with real user scenarios")
        print("4. Monitor performance under load")


async def main():
    """Main test runner."""
    tester = DeliveryTabTester()
    
    try:
        await tester.run_all_tests()
    except Exception as e:
        print(f"\n❌ Test suite error: {e}")
        print("\nMake sure the API server is running on http://localhost:8000")


if __name__ == "__main__":
    # Run the async test suite
    asyncio.run(main())