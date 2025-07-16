#!/usr/bin/env python3
"""Simple test to check server status"""

import urllib.request
import json

def test_server():
    print("Testing LuckyGas Server...")
    
    # Test endpoints
    endpoints = [
        ("Root", "http://0.0.0.0:8000/"),
        ("Admin", "http://0.0.0.0:8000/admin"),
        ("API Docs", "http://0.0.0.0:8000/docs"),
        ("Dashboard Stats", "http://0.0.0.0:8000/api/dashboard/stats"),
        ("Clients", "http://0.0.0.0:8000/api/clients"),
    ]
    
    for name, url in endpoints:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                status = response.getcode()
                print(f"✅ {name}: {status} OK")
        except Exception as e:
            print(f"❌ {name}: {type(e).__name__}: {e}")

if __name__ == "__main__":
    test_server()