# LuckyGas Project Index

## 📚 Table of Contents

### 🎯 Quick Links
- [Project Overview](#project-overview)
- [API Documentation](#api-documentation)
- [Architecture Guide](#architecture-guide)
- [Development Guide](#development-guide)
- [Deployment Guide](#deployment-guide)
- [Configuration Reference](#configuration-reference)
- [Database Schema](#database-schema)
- [Cloud Services](#cloud-services)

---

## 🎯 Project Overview

**LuckyGas (幸福氣配送管理系統)** is a comprehensive gas delivery management system designed for the Taiwanese market.

### Key Features
- 🚚 Intelligent route optimization with Google OR-Tools
- 📊 Predictive analytics for gas usage and delivery timing
- 📱 Real-time delivery tracking with customer notifications
- 🗺️ Multi-provider mapping integration (Google Maps, MapBox, OpenRouteService)
- 📈 Comprehensive dashboard with business insights
- 🔧 Fleet and driver management
- 📝 Excel import/export for data migration

### Technology Stack
- **Backend**: Python 3.9+ with FastAPI
- **Database**: SQLAlchemy ORM (SQLite/PostgreSQL)
- **Frontend**: Vanilla JavaScript with Bootstrap
- **Infrastructure**: Docker, Nginx, Redis
- **Testing**: Pytest with Playwright

---

## 📖 API Documentation

### API Overview
- **Base URL**: `http://localhost:8000/api`
- **Documentation**: `/docs` (Swagger), `/redoc` (ReDoc)
- **Version**: 1.0.0

### API Endpoints by Category

#### 1. Client Management (`/api/clients`)
- `GET /api/clients` - List clients with pagination and filters
- `GET /api/clients/{client_id}` - Get client details
- `GET /api/clients/by-code/{client_code}` - Get client by code
- `POST /api/clients` - Create new client
- `PUT /api/clients/{client_id}` - Update client
- `DELETE /api/clients/{client_id}` - Soft delete client
- `GET /api/clients/districts/list` - List all districts

#### 2. Delivery Management (`/api/deliveries`)
- `GET /api/deliveries` - List deliveries with filters
- `GET /api/deliveries/{delivery_id}` - Get delivery details
- `POST /api/deliveries` - Create delivery order
- `PUT /api/deliveries/{delivery_id}` - Update delivery
- `DELETE /api/deliveries/{delivery_id}` - Cancel delivery
- `POST /api/deliveries/{delivery_id}/assign` - Assign driver/vehicle
- `GET /api/deliveries/today/summary` - Today's statistics

#### 3. Driver Management (`/api/drivers`)
- `GET /api/drivers` - List drivers with filters
- `GET /api/drivers/{driver_id}` - Get driver details
- `POST /api/drivers` - Create driver profile
- `PUT /api/drivers/{driver_id}` - Update driver
- `DELETE /api/drivers/{driver_id}` - Soft delete driver
- `GET /api/drivers/available/list` - Available drivers by date
- `POST /api/drivers/{driver_id}/toggle-availability` - Toggle status
- `GET /api/drivers/{driver_id}/deliveries` - Driver history

#### 4. Vehicle Management (`/api/vehicles`)
- `GET /api/vehicles` - List vehicles with filters
- `GET /api/vehicles/{vehicle_id}` - Get vehicle details
- `POST /api/vehicles` - Register vehicle
- `PUT /api/vehicles/{vehicle_id}` - Update vehicle
- `DELETE /api/vehicles/{vehicle_id}` - Soft delete vehicle
- `GET /api/vehicles/available/list` - Available vehicles by date
- `POST /api/vehicles/{vehicle_id}/assign-driver` - Assign driver
- `GET /api/vehicles/maintenance/due` - Maintenance schedule

#### 5. Route Optimization (`/api/routes`)
- `POST /api/routes/plan` - Generate optimized routes
- `GET /api/routes` - List saved routes
- `GET /api/routes/{route_id}` - Get route details
- `GET /api/routes/{route_id}/map` - Get map visualization
- `POST /api/routes` - Create route manually
- `PUT /api/routes/{route_id}` - Update route
- `DELETE /api/routes/{route_id}` - Delete route

#### 6. Dashboard (`/api/dashboard`)
- `GET /api/dashboard/stats` - Comprehensive statistics
- `GET /api/dashboard/districts` - District analytics

[Full API Reference →](./API_REFERENCE.md)

---

## 🏗️ Architecture Guide

### Project Structure
```
LuckyGas/
├── src/main/python/         # Core application
│   ├── api/                # FastAPI endpoints
│   │   ├── routers/       # Route handlers
│   │   ├── schemas/       # Pydantic models
│   │   └── utils/         # API utilities
│   ├── services/          # Business logic
│   ├── models/            # Database models
│   ├── config/            # Configuration
│   ├── integrations/      # External services
│   └── web/               # Frontend files
├── tests/                  # Test suites
├── scripts/               # Deployment scripts
├── nginx/                 # Web server config
└── docs/                  # Documentation
```

### Design Patterns
- **Layered Architecture**: API → Service → Data layers
- **Repository Pattern**: Data access abstraction
- **Dependency Injection**: FastAPI dependency system
- **DTO Pattern**: Pydantic schemas for data transfer

### Key Components

#### Core Services
1. **Route Optimization Service** (`route_optimization_service.py`)
   - Modified nearest-neighbor algorithm
   - Area-based grouping
   - Traffic pattern consideration
   - Vehicle type restrictions

2. **Prediction Service** (`prediction_service.py`)
   - Historical data analysis
   - Seasonal adjustments
   - Priority scoring
   - Depletion date calculation

3. **Delivery Tracking Service** (`delivery_tracking_service.py`)
   - Real-time GPS tracking
   - Customer notifications
   - Proof of delivery
   - ETA calculations

4. **Cloud Services** (New)
   - `cloud_route_service.py` - Google OR-Tools integration
   - `cloud_scheduling_service.py` - Advanced scheduling
   - Integration with multiple mapping providers

---

## 💻 Development Guide

### Getting Started
```bash
# Clone repository
git clone [repository-url]
cd LuckyGas

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
python -m src.main.python.utils.data_importer

# Run development server
uvicorn src.main.python.api.main:app --reload
```

### Development Workflow
1. **Always read CLAUDE.md first** - Essential rules
2. Use proper module structure under `src/main/python/`
3. Search before creating new files
4. Extend existing functionality
5. Commit after each completed task
6. Push to GitHub for backup

### Testing
```bash
# Run all tests
pytest

# Run specific test types
pytest -m unit
pytest -m integration
pytest -m e2e

# Run with coverage
pytest --cov=src.main.python
```

### Code Standards
- Python 3.9+ type hints
- Black formatting
- Flake8 linting
- Comprehensive docstrings
- Error handling with proper logging

---

## 🚀 Deployment Guide

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Deployment
```bash
# Use production deployment script
./scripts/deploy-production.sh

# Monitor health
./scripts/health_check.sh

# Setup SSL
./nginx/setup-ssl.sh
```

### System Requirements
- Ubuntu 20.04+ or compatible Linux
- Docker 20.10+
- Docker Compose 1.29+
- 2GB+ RAM
- 10GB+ disk space

[Docker Deployment →](./DOCKER_DEPLOYMENT.md) | [Production Deployment →](./PRODUCTION_DEPLOYMENT.md)

---

## ⚙️ Configuration Reference

### Environment Variables
```bash
# Application
APP_ENV=development|production
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///./luckygas.db

# Cloud Services
GOOGLE_MAPS_API_KEY=your-api-key
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
SENDGRID_API_KEY=your-key

# Optional Services
MAPBOX_API_KEY=your-key
OPENROUTESERVICE_API_KEY=your-key
HERE_API_KEY=your-key
TOMTOM_API_KEY=your-key
```

### Feature Flags
- `ENABLE_REAL_TIME_TRACKING`: Real-time GPS tracking
- `ENABLE_TRAFFIC_DATA`: Traffic integration
- `ENABLE_SMS_NOTIFICATIONS`: SMS alerts
- `ENABLE_EMAIL_NOTIFICATIONS`: Email alerts

---

## 📊 Database Schema

### Core Tables
1. **clients** - Customer information
   - Client details, addresses, contact info
   - Cylinder inventory (50kg, 20kg, 16kg, etc.)
   - Business hours and preferences
   - GPS coordinates

2. **deliveries** - Delivery orders
   - Scheduling and time windows
   - Status tracking
   - Cylinder quantities
   - Proof of delivery

3. **drivers** - Driver profiles
   - Personal information
   - License details
   - Availability status
   - Experience data

4. **vehicles** - Fleet management
   - Vehicle specifications
   - Capacity by cylinder type
   - Maintenance records
   - Assignment tracking

5. **routes** - Optimized routes
   - Route planning data
   - Driver/vehicle assignments
   - Optimization scores
   - Waypoint details

6. **delivery_predictions** - AI predictions
   - Usage patterns
   - Depletion dates
   - Confidence scores

---

## ☁️ Cloud Services

### Integrated Services

#### Mapping & Navigation
- **Google Maps Platform**
  - Geocoding API
  - Directions API
  - Distance Matrix API
  - Places API
- **MapBox** - Alternative routing
- **OpenRouteService** - Vehicle routing
- **HERE Maps** - Traffic data (optional)
- **TomTom** - Alternative provider (optional)

#### Communication
- **Twilio**
  - SMS notifications
  - WhatsApp integration
- **SendGrid**
  - Email notifications
  - Invoice delivery

#### Infrastructure
- **Docker Hub** - Container registry
- **Let's Encrypt** - SSL certificates
- **Redis** - Caching and sessions

---

## 📱 Frontend Application

### Technologies
- Vanilla JavaScript (ES6+)
- Bootstrap 5 CSS framework
- Font Awesome icons
- Chart.js for analytics

### Key Features
- Responsive design
- Real-time updates
- Interactive maps
- Data tables with search/filter
- Excel import/export

### Pages
1. **Dashboard** - Overview and statistics
2. **Clients** - Customer management
3. **Deliveries** - Order management
4. **Routes** - Route planning
5. **Drivers** - Driver management
6. **Vehicles** - Fleet management

---

## 🔧 Utilities & Tools

### Data Management
- **Excel Importer** (`data_importer.py`)
  - Import client data from Excel
  - Validate and clean data
  - Generate initial predictions

- **Excel Analyzer** (`excel_analyzer.py`)
  - Analyze Excel structure
  - Extract column mappings
  - Validate data formats

### Scripts
- `backup.sh` - Database backup
- `restore.sh` - Database restore
- `monitor.sh` - System monitoring
- `update.sh` - Application updates
- `health_check.sh` - Health checks

---

## 📝 Additional Documentation

### Available Guides
- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Docker Deployment](./DOCKER_DEPLOYMENT.md) - Docker-specific deployment
- [Production Deployment](./PRODUCTION_DEPLOYMENT.md) - Comprehensive production guide
- [Swagger Usage Guide](./SWAGGER_USAGE_GUIDE.md) - How to use the Swagger UI

### External Resources
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://www.sqlalchemy.org/)
- [Google OR-Tools](https://developers.google.com/optimization)
- [Docker Documentation](https://docs.docker.com/)

---

## 🤝 Contributing

### Development Process
1. Read CLAUDE.md for essential rules
2. Create feature branch
3. Follow code standards
4. Write tests for new features
5. Update documentation
6. Submit pull request

### Code Review Checklist
- [ ] Follows project structure
- [ ] No duplicate implementations
- [ ] Proper error handling
- [ ] Tests included
- [ ] Documentation updated
- [ ] No hardcoded values

---

## 📞 Support & Contact

### Getting Help
- Check documentation first
- Review existing issues
- Contact development team

### Reporting Issues
- Use GitHub issue tracker
- Include reproduction steps
- Provide error logs
- Specify environment details

---

*Last Updated: 2025-07-15*
*Version: 1.0.0*