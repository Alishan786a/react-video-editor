# Puppeteer Video Renderer - Quick Setup Guide

I've created a new Puppeteer-based video rendering backend that captures frames from a React component and generates videos using FFmpeg. Here's how to set it up and use it:

## 🎯 What This Does

The new backend follows your exact requirements:
1. **React Component Rendering**: Creates an HTML page that renders your video editor payload
2. **Frame Capture**: Uses Puppeteer to launch Chromium and capture frames with `window.setFrame(frameTime)`
3. **Video Generation**: Uses FFmpeg to combine PNG frames with audio into MP4

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend-puppeteer
npm install  # This will take a few minutes (downloads Chromium)
```

### 2. Start the Backend
```bash
./start.sh
# or
npm start
```
The server runs on `http://localhost:3002`

### 3. Configure Frontend
Update your frontend to use the new backend:

**Option A: Environment Variable**
```bash
# In your frontend root directory
echo "VITE_BACKEND_TYPE=puppeteer" >> .env
```

**Option B: Direct Configuration**
```javascript
// In src/config/api.ts
const BACKEND_TYPE = 'puppeteer';
```

### 4. Test It
```bash
cd backend-puppeteer
npm run test
```

## 📁 Project Structure

```
backend-puppeteer/
├── server.js              # Main Express server
├── src/
│   └── video-renderer.js  # Core Puppeteer + FFmpeg logic
├── storage/
│   ├── uploads/           # Uploaded media files
│   ├── renders/           # Final MP4 videos
│   └── temp/              # Temporary frames during rendering
├── package.json
├── start.sh              # Startup script
├── test-server.js        # Test script
├── README.md             # Detailed documentation
└── INTEGRATION.md        # Frontend integration guide
```

## 🔧 How It Works

### Frame Capture Process
```
Your Video Editor Payload
         ↓
React HTML Component (generated dynamically)
         ↓
Puppeteer Browser (Chromium)
         ↓
Frame Loop: for each frame { setFrame(time); screenshot(); }
         ↓
PNG Frames (stored temporarily)
         ↓
FFmpeg (combines frames + audio)
         ↓
Final MP4 Video
```

### API Compatibility
The backend is 100% compatible with your existing frontend:
- Same API endpoints (`/api/v1/editor/render`)
- Same payload structure
- Same progress tracking
- Same download workflow

## ✅ Features Supported

- **Media Types**: Images, videos, text, audio
- **Transformations**: Position, scale, rotation, opacity
- **Timing**: Display start/end times
- **Text Styling**: Font, size, color, alignment
- **Audio Mixing**: Multiple audio tracks
- **Progress Tracking**: Real-time render progress

## 🎛️ Configuration

### Video Quality
```javascript
// In your project payload
{
  fps: 30,           // Higher = smoother, slower render
  size: {
    width: 1080,     // Video dimensions
    height: 1920
  }
}
```

### Performance Tuning
```env
# In backend-puppeteer/.env
FFMPEG_PRESET=fast      # ultrafast, fast, medium, slow
FFMPEG_CRF=23          # 0-51, lower = better quality
PUPPETEER_HEADLESS=true # Set to false for debugging
```

## 🧪 Testing

The backend includes a comprehensive test that:
1. Checks health endpoint
2. Starts a video render with test data
3. Monitors progress
4. Verifies completion

```bash
cd backend-puppeteer
npm run test
```

## 🔄 Switching Between Backends

You can easily switch between different backends:

```javascript
// Use Puppeteer backend
VITE_BACKEND_TYPE=puppeteer

// Use your existing custom backend
VITE_BACKEND_TYPE=custom

// Use Remotion backend
VITE_BACKEND_TYPE=remotion
```

## 📊 Performance Comparison

| Backend Type | Render Speed | Quality | Setup Complexity |
|-------------|-------------|---------|------------------|
| Puppeteer   | Medium      | High    | Low              |
| FFmpeg      | Fast        | Medium  | Medium           |
| Remotion    | Slow        | Highest | High             |

## 🛠️ Troubleshooting

### Common Issues

1. **"Browser not found"**: Puppeteer is still downloading Chromium
2. **"FFmpeg not found"**: Install FFmpeg on your system
3. **Slow rendering**: Reduce FPS or video dimensions
4. **Memory issues**: Close other applications or add more RAM

### Debug Mode
```bash
NODE_ENV=development npm start
```

## 🎉 Ready to Use!

Your Puppeteer video renderer is now ready! It will:
- ✅ Capture frames exactly as you specified
- ✅ Work with your existing frontend
- ✅ Generate high-quality videos
- ✅ Provide real-time progress updates
- ✅ Handle all your current video editor features

The backend is running on port 3002 and ready to receive render requests from your frontend.
