#!/usr/bin/env python3
"""
Script to clean up test clients created after a specific ID
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import from api modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import and_, or_
from models.database_schema import Client, Delivery
from core.database import DatabaseManager

# Initialize database manager
db_manager = DatabaseManager()
db_manager.initialize()
SessionLocal = db_manager.SessionLocal

def identify_test_clients(session, after_id="1967935"):
    """Identify test clients created after the specified ID"""
    print(f"\n🔍 Searching for test clients created after ID: {after_id}")
    
    # Query for clients that:
    # 1. Have client_code that starts with 'C' followed by 8 characters (test pattern)
    # 2. Have names containing 'Test Client' or '重複測試' or '幸福瓦斯行（總店）'
    # Note: The user mentioned 7 test clients after ID 1967935
    test_clients = session.query(Client).filter(
        or_(
            Client.name.like('%Test Client%'),
            Client.name == '重複測試',
            and_(
                Client.name == '幸福瓦斯行（總店）',
                Client.client_code.like('C%'),
                Client.client_code.notlike('1%')  # Exclude old format IDs
            )
        )
    ).all()
    
    # Filter to only include recent test clients
    # Since we can't directly compare string IDs, we'll look for specific patterns
    recent_test_clients = []
    
    # Debug: show all found clients
    print(f"\nFound {len(test_clients)} potential test clients:")
    for client in test_clients:
        print(f"  - ID: {client.id}, Code: {client.client_code}, Name: {client.name}")
    
    # Based on the user's request: "delete the 7 test clients created after 1967935"
    # We'll filter to include:
    # 1. Test Client entries
    # 2. 重複測試 entries
    # 3. 幸福瓦斯行（總店） entries with C-prefixed codes (likely test data)
    for client in test_clients:
        # Check if it's a test client based on name and code pattern
        if (client.name.startswith('Test Client') or 
            client.name == '重複測試' or
            (client.name == '幸福瓦斯行（總店）' and client.client_code.startswith('C'))):
            # Check if it's a recent test client (has 'C' prefix code)
            if client.client_code.startswith('C') and len(client.client_code) == 9:
                recent_test_clients.append(client)
    
    return recent_test_clients

def delete_test_clients(session, clients, dry_run=True):
    """Delete the specified test clients"""
    if dry_run:
        print("\n🔍 DRY RUN - No changes will be made")
    
    print(f"\n📋 Found {len(clients)} test clients to delete:")
    
    for idx, client in enumerate(clients, 1):
        print(f"{idx}. ID: {client.id}, Code: {client.client_code}, Name: {client.name}")
        
        # Check for related deliveries
        delivery_count = session.query(Delivery).filter(
            Delivery.client_id == client.id
        ).count()
        
        if delivery_count > 0:
            print(f"   ⚠️  Has {delivery_count} related deliveries")
    
    if not dry_run and clients:
        confirm = input("\n⚠️  Are you sure you want to delete these clients? (yes/no): ")
        if confirm.lower() == 'yes':
            deleted_count = 0
            for client in clients:
                try:
                    # Delete related deliveries first
                    session.query(Delivery).filter(
                        Delivery.client_id == client.id
                    ).delete()
                    
                    # Delete the client
                    session.delete(client)
                    deleted_count += 1
                    print(f"✅ Deleted client: {client.client_code} - {client.name}")
                except Exception as e:
                    print(f"❌ Error deleting client {client.client_code}: {e}")
                    session.rollback()
                    continue
            
            try:
                session.commit()
                print(f"\n✅ Successfully deleted {deleted_count} test clients")
            except Exception as e:
                session.rollback()
                print(f"❌ Error committing changes: {e}")
        else:
            print("❌ Deletion cancelled")
    
    return len(clients)

def main():
    """Main function"""
    print("🧹 Test Client Cleanup Script")
    print("=" * 50)
    
    # Parse command line arguments
    dry_run = '--execute' not in sys.argv
    
    # Create database session
    session = SessionLocal()
    
    try:
        # Identify test clients
        test_clients = identify_test_clients(session)
        
        # Limit to 7 most recent test clients as requested
        if len(test_clients) > 7:
            test_clients = test_clients[-7:]  # Get the last 7 clients
        
        if test_clients:
            # Delete test clients
            deleted_count = delete_test_clients(session, test_clients, dry_run)
            
            if dry_run and deleted_count > 0:
                print("\n💡 To execute the deletion, run:")
                print(f"   python {sys.argv[0]} --execute")
        else:
            print("\n✅ No test clients found to delete")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    main()