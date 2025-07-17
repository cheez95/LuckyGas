#!/usr/bin/env python3
"""
Simple script to verify the Playwright test fixes for dynamic content visibility
"""

import subprocess
import sys

def run_specific_tests():
    """Run the specific tests that were fixed"""
    print("🧪 Running specific Playwright tests to verify fixes...")
    print("-" * 50)
    
    # Run the specific tests that were having issues
    test_commands = [
        # Test admin dashboard functionality
        ["python", "-m", "pytest", "tests/test_webpages_playwright.py::TestLuckyGasWebpages::test_admin_dashboard_functionality", "-v", "-s"],
        
        # Test form validation
        ["python", "-m", "pytest", "tests/test_webpages_playwright.py::TestLuckyGasWebpages::test_form_validation", "-v", "-s"]
    ]
    
    results = []
    
    for i, cmd in enumerate(test_commands, 1):
        print(f"\n📋 Running Test {i}/{len(test_commands)}...")
        print(f"Command: {' '.join(cmd)}")
        print("-" * 30)
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            # Check if test passed
            if result.returncode == 0:
                print("✅ Test PASSED")
                results.append("PASSED")
            else:
                print("❌ Test FAILED")
                results.append("FAILED")
                
            # Show output
            if result.stdout:
                print("\nOutput:")
                print(result.stdout)
            if result.stderr:
                print("\nErrors:")
                print(result.stderr)
                
        except Exception as e:
            print(f"❌ Error running test: {str(e)}")
            results.append("ERROR")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Total tests run: {len(results)}")
    print(f"Passed: {results.count('PASSED')}")
    print(f"Failed: {results.count('FAILED')}")
    print(f"Errors: {results.count('ERROR')}")
    
    # Detailed results
    test_names = [
        "Admin Dashboard Functionality",
        "Form Validation"
    ]
    
    print("\nDetailed Results:")
    for name, result in zip(test_names, results):
        status_icon = "✅" if result == "PASSED" else "❌"
        print(f"{status_icon} {name}: {result}")
    
    print("\n🔍 Key Improvements Made:")
    print("1. Added wait_for_element_and_click() helper for robust element interaction")
    print("2. Added wait_for_tab_content() helper for tab navigation")
    print("3. Fixed search input detection by ensuring correct tab is active first")
    print("4. Fixed form validation by navigating to correct tab before clicking add button")
    print("5. Added multiple selector strategies for better element detection")
    print("6. Improved error handling and logging")
    
    return all(r == "PASSED" for r in results)

if __name__ == "__main__":
    print("🚀 Verifying Playwright Test Fixes")
    print("This will run the specific tests that were having dynamic content visibility issues")
    print()
    
    # Ensure the server is running
    print("⚠️  Make sure the FastAPI server is running on http://localhost:5000")
    print("If not, run: python server.py")
    input("\nPress Enter to continue...")
    
    # Run the tests
    success = run_specific_tests()
    
    if success:
        print("\n✅ All tests passed! The fixes are working correctly.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Please check the output above for details.")
        sys.exit(1)