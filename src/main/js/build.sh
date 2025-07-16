#!/bin/bash
# Build script for LuckyGas frontend modules

echo "🔨 Building LuckyGas frontend modules..."

# Change to the JS directory
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the build
echo "🏗️ Building with Vite..."
npm run build

# Copy built files to static directory (for Flask integration)
echo "📋 Copying built files to static directory..."
mkdir -p ../../python/web/static/js
cp -r dist/js/* ../../python/web/static/js/

echo "✅ Build complete!"
echo "📍 Built files are in: dist/"
echo "📍 Copied to: ../../python/web/static/js/"