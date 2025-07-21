#!/bin/bash

# Setup script for Remotion Video Export Server
# This script helps you set up the Remotion backend for your React Video Editor

echo "🎬 Setting up Remotion Video Export Server..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo ""

# Navigate to backend-remotion directory
if [ ! -d "backend-remotion" ]; then
    echo "❌ backend-remotion directory not found. Please run this script from the project root."
    exit 1
fi

echo "📁 Entering backend-remotion directory..."
cd backend-remotion

# Install dependencies
echo "📦 Installing Remotion dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies. Please check the error messages above."
    exit 1
fi

echo "✅ Dependencies installed successfully!"
echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created from .env.example"
else
    echo "📝 .env file already exists"
fi

# Create storage directories
echo "📁 Creating storage directories..."
mkdir -p storage/renders
mkdir -p storage/temp
echo "✅ Storage directories created"
echo ""

# Test the server
echo "🧪 Testing Remotion server..."
echo "Starting server in background..."

# Start server in background
npm start &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Test health endpoint
echo "🔍 Testing health endpoint..."
if curl -s http://localhost:3001/api/v1/editor/remotion/health > /dev/null; then
    echo "✅ Remotion server is running and healthy!"
    
    # Run the test script
    echo ""
    echo "🧪 Running comprehensive test..."
    node test-server.js
    
else
    echo "❌ Server health check failed. Please check the server logs."
fi

# Stop the background server
echo ""
echo "🛑 Stopping test server..."
kill $SERVER_PID 2>/dev/null

echo ""
echo "🎉 Remotion setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start the Remotion server: cd backend-remotion && npm start"
echo "2. Start your existing file server: cd backend-example && npm start"
echo "3. Start your frontend: npm run dev"
echo "4. Your video editor will now use Remotion for high-quality, free video export!"
echo ""
echo "🔧 Configuration:"
echo "- Remotion server runs on: http://localhost:3001"
echo "- Your existing server runs on: http://localhost:3000"
echo "- Frontend automatically uses Remotion backend"
echo ""
echo "📚 Documentation:"
echo "- Read REMOTION_INTEGRATION_GUIDE.md for detailed integration info"
echo "- Check backend-remotion/README.md for server-specific documentation"
echo ""
echo "🆓 License: Remotion is FREE for individuals and companies up to 3 people!"
