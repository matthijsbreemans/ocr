#!/bin/bash

echo "🚀 Starting OCR API Service..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

# Start services
echo "🐳 Building and starting Docker containers..."
docker-compose up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "✅ OCR API Service is running!"
    echo ""
    echo "📍 API: http://localhost:3040"
    echo "📊 Database: postgresql://ocruser:ocrpassword@localhost:5432/ocrdb"
    echo ""
    echo "📖 Open test-client.html in your browser to test the API"
    echo ""
    echo "📝 Useful commands:"
    echo "  - View logs: docker-compose logs -f"
    echo "  - Stop services: docker-compose down"
    echo "  - View worker logs: docker-compose logs -f worker"
    echo "  - View API logs: docker-compose logs -f api"
else
    echo "❌ Failed to start services. Check logs with: docker-compose logs"
    exit 1
fi
