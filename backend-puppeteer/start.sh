#!/bin/bash

echo "🚀 Starting Puppeteer Video Renderer Backend"
echo "============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed. Please install FFmpeg first."
    echo "   Ubuntu/Debian: sudo apt install ffmpeg"
    echo "   macOS: brew install ffmpeg"
    echo "   Windows: Download from https://ffmpeg.org/download.html"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create storage directories if they don't exist
mkdir -p storage/uploads
mkdir -p storage/renders
mkdir -p storage/temp

echo "✅ Prerequisites checked"
echo "🌐 Starting server on port 3002..."
echo ""

# Start the server
npm start
