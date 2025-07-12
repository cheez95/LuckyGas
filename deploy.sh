#!/bin/bash

# Production deployment script for LuckyGas API

echo "🚀 Starting LuckyGas API production deployment..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker installation
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose installation
if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Parse command line arguments
ACTION=${1:-"up"}

case $ACTION in
    "build")
        echo "📦 Building Docker image..."
        docker build -t luckygas-api:latest .
        echo "✅ Build completed!"
        ;;
    
    "up")
        echo "🔄 Starting services with docker-compose..."
        docker-compose up -d
        echo "✅ Services started!"
        echo "📊 Checking service status..."
        sleep 5
        docker-compose ps
        echo ""
        echo "🌐 API is available at: http://localhost:8000"
        echo "📖 API documentation: http://localhost:8000/docs"
        ;;
    
    "down")
        echo "⏹️  Stopping services..."
        docker-compose down
        echo "✅ Services stopped!"
        ;;
    
    "restart")
        echo "🔄 Restarting services..."
        docker-compose restart
        echo "✅ Services restarted!"
        ;;
    
    "logs")
        echo "📜 Showing logs (press Ctrl+C to exit)..."
        docker-compose logs -f
        ;;
    
    "status")
        echo "📊 Service status:"
        docker-compose ps
        echo ""
        echo "🏥 Health check:"
        curl -s http://localhost:8000/health | python3 -m json.tool || echo "❌ Health check failed"
        ;;
    
    "shell")
        echo "🐚 Opening shell in API container..."
        docker-compose exec api /bin/bash
        ;;
    
    *)
        echo "Usage: $0 [build|up|down|restart|logs|status|shell]"
        echo ""
        echo "Commands:"
        echo "  build   - Build Docker image"
        echo "  up      - Start all services (default)"
        echo "  down    - Stop all services"
        echo "  restart - Restart all services"
        echo "  logs    - Show service logs"
        echo "  status  - Show service status and health"
        echo "  shell   - Open shell in API container"
        exit 1
        ;;
esac