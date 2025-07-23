# Puppeteer Video Renderer Backend

A React Video Editor backend that uses Puppeteer to capture frames from a React component and FFmpeg to generate videos.

## How It Works

1. **React Component Rendering**: Creates an HTML page with a React-like component that renders your video editor payload
2. **Frame Capture**: Uses Puppeteer to launch Chromium, navigate to the React app, and capture frames in a loop
3. **Video Generation**: Uses FFmpeg to combine captured PNG frames with audio to generate the final MP4 video

## Features

- ✅ Frame-by-frame rendering using Puppeteer
- ✅ React component-based video composition
- ✅ Support for images, videos, text, and audio
- ✅ FFmpeg video encoding with audio mixing
- ✅ Progress tracking and status monitoring
- ✅ File upload handling
- ✅ Compatible with existing video editor frontend

## Installation

```bash
cd backend-puppeteer
npm install
```

## Usage

### Start the server
```bash
npm start
```

### Development mode with auto-reload
```bash
npm run dev
```

The server will run on `http://localhost:3002` by default.

## API Endpoints

### Health Check
```
GET /api/v1/editor/render/health
```

### File Upload
```
POST /api/v1/editor/upload/file
```

### Start Video Render
```
POST /api/v1/editor/render
```

### Check Render Status
```
GET /api/v1/editor/render/status/:renderId
```

### Serve Files
```
GET /api/v1/editor/files/:filename
GET /api/v1/editor/renders/:filename
```

## Configuration

Update your frontend API configuration to use this backend:

```javascript
// In src/config/api.ts
const BACKEND_TYPE = 'puppeteer'; // or set VITE_BACKEND_TYPE=puppeteer

export const API_CONFIG = {
  UPLOAD_API_URL: 'http://localhost:3002/api/v1/editor',
  RENDER_API_URL: 'http://localhost:3002/api/v1/editor',
  // ...
};
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│  Puppeteer       │───▶│    FFmpeg       │
│   Video Editor  │    │  Frame Capture   │    │  Video Encoding │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        │                        ▼                        ▼
        │               ┌──────────────────┐    ┌─────────────────┐
        │               │  React Component │    │   Final MP4     │
        │               │  HTML Renderer   │    │     Video       │
        └──────────────▶└──────────────────┘    └─────────────────┘
```

## Requirements

- Node.js 18+
- FFmpeg installed on system
- Chromium (installed automatically by Puppeteer)

## Storage Structure

```
storage/
├── uploads/     # Uploaded media files
├── renders/     # Final rendered videos
└── temp/        # Temporary files during rendering
```

## Troubleshooting

### Puppeteer Issues
- Ensure you have sufficient memory for Chromium
- Check that all required system dependencies are installed
- Try running with `--no-sandbox` flag if in Docker

### FFmpeg Issues
- Verify FFmpeg is installed: `ffmpeg -version`
- Check audio codec compatibility
- Ensure sufficient disk space for temporary files

### Performance Tips
- Adjust frame rate for faster rendering
- Use lower resolution for testing
- Monitor memory usage during long renders
