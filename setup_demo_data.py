#!/usr/bin/env python3
"""Setup demo data for testing enhanced management interface"""

import os
import sys
from datetime import datetime, timedelta
import random

# Add the src/main/python directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src/main/python'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database_schema import Base, Client, Driver, Vehicle, Delivery, DeliveryStatus, PaymentMethod

# Database setup
DATABASE_URL = "sqlite:///./local.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def setup_database():
    """Create all tables"""
    print("🔧 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")

def create_demo_clients(session):
    """Create demo clients"""
    print("\n👥 Creating demo clients...")
    
    districts = ['臺東市', '關山鎮', '成功鎮', '池上鄉', '東河鄉', '長濱鄉', '太麻里鄉']
    client_names = [
        '王小明餐廳', '李家小吃店', '張氏企業', '陳家麵店', '林記商行',
        '黃媽媽廚房', '劉家飯館', '蔡氏集團', '許記食堂', '謝家餐廳',
        '鄭氏商店', '吳家小館', '趙記麵攤', '周家餐廳', '馬氏企業'
    ]
    
    clients = []
    for i in range(50):
        client = Client(
            client_code=f"C{1000 + i}",
            name=f"{client_names[i % len(client_names)]}{i+1}",
            invoice_title=f"{client_names[i % len(client_names)]}{i+1}",
            short_name=f"客戶{i+1}",
            address=f"臺東縣{districts[i % len(districts)]}中正路{random.randint(1, 999)}號",
            district=districts[i % len(districts)],
            area="東區" if i % 2 == 0 else "西區",
            tax_id=f"{random.randint(10000000, 99999999)}" if i % 3 == 0 else None,
            contact_person=f"聯絡人{i+1}",
            is_corporate=i % 3 == 0,
            is_active=i < 45,  # 5 inactive clients
            notes=f"備註：這是第{i+1}個客戶" if i % 5 == 0 else None,
            created_at=datetime.now() - timedelta(days=random.randint(1, 365)),
            updated_at=datetime.now()
        )
        clients.append(client)
    
    session.add_all(clients)
    session.commit()
    print(f"✅ Created {len(clients)} demo clients")
    return clients

def create_demo_drivers(session):
    """Create demo drivers"""
    print("\n🚗 Creating demo drivers...")
    
    driver_names = ['張師傅', '李師傅', '王師傅', '陳師傅', '林師傅', '黃師傅', '劉師傅', '蔡師傅']
    
    drivers = []
    for i in range(8):
        driver = Driver(
            employee_id=f"D{2024001 + i}",
            name=driver_names[i],
            phone=f"0912{random.randint(100000, 999999)}",
            license_type="職業大貨車" if i < 4 else "職業小型車",
            is_available=i < 6,  # 2 unavailable drivers
            is_active=True,
            experience_years=random.randint(1, 10),
            base_salary=35000 + (i * 1000),
            commission_rate=5,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        drivers.append(driver)
    
    session.add_all(drivers)
    session.commit()
    print(f"✅ Created {len(drivers)} demo drivers")
    return drivers

def create_demo_vehicles(session):
    """Create demo vehicles"""
    print("\n🚚 Creating demo vehicles...")
    
    vehicle_types = [
        ('truck', '貨車', ['Hino', 'Isuzu', 'Mitsubishi Fuso']),
        ('van', '廂型車', ['Toyota', 'Nissan', 'Ford']),
        ('motorcycle', '機車', ['Yamaha', 'SYM', 'Kymco'])
    ]
    
    vehicles = []
    for i in range(10):
        vtype_idx = i % 3
        vtype, vtype_name, brands = vehicle_types[vtype_idx]
        
        vehicle = Vehicle(
            plate_number=f"TT-{random.randint(1000, 9999)}",
            vehicle_type=vtype,
            brand=brands[i % len(brands)],
            model=f"Model-{2020 + (i % 4)}",
            year=2020 + (i % 4),
            max_load_kg=3500 if vtype == 'truck' else (1500 if vtype == 'van' else 150),
            max_cylinders=50 if vtype == 'truck' else (20 if vtype == 'van' else 5),
            purchase_date=datetime.now() - timedelta(days=random.randint(180, 1080)),
            purchase_price=random.randint(500000, 2000000) if vtype != 'motorcycle' else random.randint(50000, 150000),
            is_active=i < 8,  # 2 inactive vehicles
            next_maintenance_date=datetime.now() + timedelta(days=random.randint(30, 180)),
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        vehicles.append(vehicle)
    
    session.add_all(vehicles)
    session.commit()
    print(f"✅ Created {len(vehicles)} demo vehicles")
    return vehicles

def create_demo_deliveries(session, clients, drivers, vehicles):
    """Create demo deliveries"""
    print("\n📦 Creating demo deliveries...")
    
    statuses = [
        DeliveryStatus.PENDING,
        DeliveryStatus.ASSIGNED,
        DeliveryStatus.IN_PROGRESS,
        DeliveryStatus.COMPLETED,
        DeliveryStatus.CANCELLED
    ]
    
    deliveries = []
    
    # Create deliveries for the past 30 days and future 7 days
    for day_offset in range(-30, 8):
        delivery_date = datetime.now() + timedelta(days=day_offset)
        num_deliveries = random.randint(5, 15)
        
        for i in range(num_deliveries):
            client = random.choice(clients[:45])  # Only active clients
            
            # Determine status based on date
            if day_offset < -1:
                # Past deliveries are mostly completed
                status = random.choice([DeliveryStatus.COMPLETED] * 8 + [DeliveryStatus.CANCELLED] * 2)
            elif day_offset == -1:
                # Yesterday's deliveries
                status = random.choice([DeliveryStatus.COMPLETED, DeliveryStatus.IN_PROGRESS])
            elif day_offset == 0:
                # Today's deliveries
                status = random.choice([DeliveryStatus.IN_PROGRESS, DeliveryStatus.ASSIGNED, DeliveryStatus.PENDING])
            else:
                # Future deliveries
                status = random.choice([DeliveryStatus.PENDING, DeliveryStatus.ASSIGNED])
            
            # Assign driver and vehicle for non-pending deliveries
            driver = None
            vehicle = None
            if status != DeliveryStatus.PENDING:
                driver = random.choice([d for d in drivers if d.is_available])
                vehicle = random.choice([v for v in vehicles if v.is_active])
            
            # Random gas quantities
            cylinders = {
                '50kg': random.randint(0, 2),
                '20kg': random.randint(0, 3),
                '16kg': random.randint(0, 2),
                '10kg': random.randint(0, 1),
                '4kg': random.randint(0, 1)
            }
            
            total_cylinders = sum(cylinders.values())
            if total_cylinders == 0:
                cylinders['20kg'] = 1  # At least one cylinder
                total_cylinders = 1
            
            delivery = Delivery(
                order_number=f"D{delivery_date.strftime('%Y%m%d')}{i+1:03d}",
                client_id=client.id,
                driver_id=driver.id if driver else None,
                vehicle_id=vehicle.id if vehicle else None,
                status=status.value,
                scheduled_date=delivery_date.date(),
                scheduled_time_start=f"{random.randint(8, 16):02d}:00",
                scheduled_time_end=f"{random.randint(9, 17):02d}:00",
                actual_delivery_time=delivery_date if status == DeliveryStatus.COMPLETED else None,
                
                # Delivered quantities
                delivered_50kg=cylinders['50kg'],
                delivered_20kg=cylinders['20kg'],
                delivered_16kg=cylinders['16kg'],
                delivered_10kg=cylinders['10kg'],
                delivered_4kg=cylinders['4kg'],
                
                # Returned quantities (some completed deliveries have returns)
                returned_50kg=random.randint(0, cylinders['50kg']) if status == DeliveryStatus.COMPLETED and random.random() > 0.5 else 0,
                returned_20kg=random.randint(0, cylinders['20kg']) if status == DeliveryStatus.COMPLETED and random.random() > 0.5 else 0,
                returned_16kg=0,
                returned_10kg=0,
                returned_4kg=0,
                
                delivery_address=client.address,
                delivery_district=client.district,
                notes=f"配送備註 {i+1}" if random.random() > 0.7 else None,
                
                created_at=datetime.now() - timedelta(days=max(0, -day_offset)),
                updated_at=datetime.now()
            )
            deliveries.append(delivery)
    
    session.add_all(deliveries)
    session.commit()
    print(f"✅ Created {len(deliveries)} demo deliveries")
    return deliveries

def main():
    """Setup demo data"""
    print("🚀 Setting up LuckyGas Demo Data")
    print("=" * 50)
    
    # Create database
    setup_database()
    
    # Create session
    session = SessionLocal()
    
    try:
        # Create demo data
        clients = create_demo_clients(session)
        drivers = create_demo_drivers(session)
        vehicles = create_demo_vehicles(session)
        deliveries = create_demo_deliveries(session, clients, drivers, vehicles)
        
        print("\n" + "=" * 50)
        print("✅ Demo data setup complete!")
        print(f"\nSummary:")
        print(f"  - Clients: {len(clients)} (45 active, 5 inactive)")
        print(f"  - Drivers: {len(drivers)} (6 available, 2 unavailable)")
        print(f"  - Vehicles: {len(vehicles)} (8 active, 2 inactive)")
        print(f"  - Deliveries: {len(deliveries)} (past 30 days + next 7 days)")
        
        print("\n🌐 Access the management interface at: http://localhost:8000/admin")
        print("📊 API documentation at: http://localhost:8000/docs")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    main()