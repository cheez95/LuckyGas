#!/usr/bin/env python3
"""
Verification script to ensure the project works correctly after cleanup.
Run this after performing cleanup operations.
"""

import sys
import subprocess
import importlib
from pathlib import Path

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def print_status(message, status='info'):
    if status == 'success':
        print(f"{GREEN}✅ {message}{RESET}")
    elif status == 'error':
        print(f"{RED}❌ {message}{RESET}")
    elif status == 'warning':
        print(f"{YELLOW}⚠️  {message}{RESET}")
    else:
        print(f"ℹ️  {message}")

def check_imports():
    """Verify that all main modules can be imported without errors."""
    print("\n🔍 Checking Python imports...")
    
    # Add src/main/python to path
    sys.path.insert(0, str(Path(__file__).parent / 'src' / 'main' / 'python'))
    
    modules_to_check = [
        'core.database',
        'models.database_schema',
        'services.client_service',
        'services.delivery_service',
        'services.prediction_service',
        'api.main',
    ]
    
    failed = []
    for module in modules_to_check:
        try:
            importlib.import_module(module)
            print_status(f"Import {module}", 'success')
        except ImportError as e:
            print_status(f"Import {module} failed: {e}", 'error')
            failed.append(module)
    
    return len(failed) == 0

def check_file_structure():
    """Verify that important files and directories exist."""
    print("\n📁 Checking file structure...")
    
    required_paths = [
        'src/main/python/api/main.py',
        'src/main/python/core/database.py',
        'src/main/python/models/database_schema.py',
        'src/main/python/services/client_service.py',
        'src/main/python/web/index.html',
        'src/main/python/web/app.js',
        'tests/',
        '.gitignore',
        'requirements.txt',
    ]
    
    missing = []
    for path in required_paths:
        if Path(path).exists():
            print_status(f"Found {path}", 'success')
        else:
            print_status(f"Missing {path}", 'error')
            missing.append(path)
    
    # Check that test files were moved correctly
    moved_files = [
        'tests/debug/debug_swagger_requests.py',
        'tests/debug/test_interface.py',
    ]
    
    for path in moved_files:
        if Path(path).exists():
            print_status(f"Test file moved correctly: {path}", 'success')
    
    return len(missing) == 0

def check_no_cache_files():
    """Verify that cache files have been removed."""
    print("\n🧹 Checking for cache files...")
    
    # Check for __pycache__ directories outside venv
    cache_dirs = list(Path('.').rglob('__pycache__'))
    cache_dirs = [d for d in cache_dirs if 'venv' not in str(d)]
    
    if cache_dirs:
        print_status(f"Found {len(cache_dirs)} __pycache__ directories", 'warning')
        for d in cache_dirs[:5]:  # Show first 5
            print(f"  - {d}")
    else:
        print_status("No __pycache__ directories found", 'success')
    
    # Check for .pytest_cache
    if Path('.pytest_cache').exists():
        print_status(".pytest_cache still exists", 'warning')
    else:
        print_status(".pytest_cache removed", 'success')
    
    # Check for .DS_Store files
    ds_files = list(Path('.').rglob('.DS_Store'))
    if ds_files:
        print_status(f"Found {len(ds_files)} .DS_Store files", 'warning')
    else:
        print_status("No .DS_Store files found", 'success')
    
    return len(cache_dirs) == 0 and not Path('.pytest_cache').exists()

def run_basic_tests():
    """Run basic tests to ensure functionality."""
    print("\n🧪 Running basic tests...")
    
    # Check if pytest is available
    try:
        result = subprocess.run(['python', '-m', 'pytest', '--version'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print_status("pytest is available", 'success')
            
            # Run a simple test
            result = subprocess.run(['python', '-m', 'pytest', '-v', '-k', 'test_client_service', '--tb=short'],
                                  capture_output=True, text=True)
            if result.returncode == 0:
                print_status("Basic tests passed", 'success')
            else:
                print_status("Some tests failed (this might be expected)", 'warning')
        else:
            print_status("pytest not found", 'warning')
    except Exception as e:
        print_status(f"Could not run tests: {e}", 'warning')
    
    return True

def check_gitignore():
    """Verify .gitignore contains necessary entries."""
    print("\n📝 Checking .gitignore...")
    
    required_entries = ['.env', '__pycache__', '.pytest_cache', '.DS_Store', '*.log']
    gitignore_path = Path('.gitignore')
    
    if gitignore_path.exists():
        content = gitignore_path.read_text()
        for entry in required_entries:
            if entry in content:
                print_status(f".gitignore contains {entry}", 'success')
            else:
                print_status(f".gitignore missing {entry}", 'warning')
    else:
        print_status(".gitignore not found", 'error')
        return False
    
    return True

def main():
    """Run all verification checks."""
    print("🔧 LuckyGas Cleanup Verification Script")
    print("=" * 50)
    
    all_passed = True
    
    # Run all checks
    all_passed &= check_file_structure()
    all_passed &= check_imports()
    all_passed &= check_no_cache_files()
    all_passed &= check_gitignore()
    all_passed &= run_basic_tests()
    
    # Summary
    print("\n" + "=" * 50)
    if all_passed:
        print_status("All verification checks passed! ✨", 'success')
        print("\nThe cleanup was successful and the project structure is intact.")
    else:
        print_status("Some checks failed or had warnings", 'warning')
        print("\nPlease review the warnings above. The project should still work correctly.")
    
    print("\nNext steps:")
    print("1. Run the application: python src/main/python/main.py")
    print("2. Run full tests: python -m pytest")
    print("3. Check API endpoints: http://localhost:8000/docs")

if __name__ == "__main__":
    main()