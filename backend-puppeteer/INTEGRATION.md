# Frontend Integration Guide

This guide explains how to connect the Puppeteer Video Renderer backend to your React Video Editor frontend.

## Quick Setup

### 1. Install Dependencies
```bash
cd backend-puppeteer
npm install
```

### 2. Start the Backend
```bash
./start.sh
# or
npm start
```

The backend will run on `http://localhost:3002`

### 3. Configure Frontend

Update your frontend environment variables or API configuration:

#### Option A: Environment Variables
Create or update `.env` in your frontend root:
```env
VITE_BACKEND_TYPE=puppeteer
VITE_PUPPETEER_API_URL=http://localhost:3002/api/v1/editor
```

#### Option B: Direct Configuration
Update `src/config/api.ts`:
```javascript
const BACKEND_TYPE = 'puppeteer';

export const API_CONFIG = {
  UPLOAD_API_URL: 'http://localhost:3002/api/v1/editor',
  RENDER_API_URL: 'http://localhost:3002/api/v1/editor',
  // ...
};
```

### 4. Test the Integration
```bash
# In backend-puppeteer directory
npm run test
```

## How It Works

### 1. Frame Capture Process
```
Frontend Payload → React HTML → Puppeteer → Frame PNGs → FFmpeg → MP4
```

1. **Payload Processing**: Backend receives your video editor project data
2. **HTML Generation**: Creates an HTML page with React-like component rendering
3. **Browser Launch**: Puppeteer launches Chromium and navigates to the HTML
4. **Frame Loop**: For each frame (based on FPS), calls `window.setFrame(timeMs)` and captures screenshot
5. **Video Encoding**: FFmpeg combines all PNG frames with audio into final MP4

### 2. Supported Features

✅ **Media Types**
- Images (PNG, JPG, GIF)
- Videos (MP4, WebM, MOV)
- Text with styling
- Audio tracks

✅ **Transformations**
- Position (left, top)
- Scale (scaleX, scaleY)
- Rotation (angle)
- Opacity
- Timing (display.from, display.to)

✅ **Text Styling**
- Font family, size, color
- Text alignment
- Custom positioning

### 3. API Compatibility

The backend is fully compatible with your existing frontend API calls:

```javascript
// This works exactly the same
const response = await fetch('/api/v1/editor/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(projectData)
});
```

## Configuration Options

### Video Quality
```javascript
// In your project data
{
  fps: 30,           // Frames per second (higher = smoother, slower render)
  size: {
    width: 1080,     // Video width
    height: 1920     // Video height
  }
}
```

### Performance Tuning

#### For Faster Rendering:
- Lower FPS (24 instead of 30)
- Smaller dimensions (720p instead of 1080p)
- Shorter video duration

#### For Better Quality:
- Higher FPS (60)
- Larger dimensions (4K)
- Higher FFmpeg quality settings

### Environment Variables
```env
# Server port
PORT=3002

# Puppeteer settings
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox

# Video settings
DEFAULT_FPS=30
DEFAULT_WIDTH=1080
DEFAULT_HEIGHT=1920

# FFmpeg settings
FFMPEG_PRESET=fast    # ultrafast, fast, medium, slow
FFMPEG_CRF=23         # 0-51, lower = better quality
```

## Troubleshooting

### Common Issues

#### 1. "Browser not found" Error
```bash
# Install Chromium dependencies (Ubuntu/Debian)
sudo apt-get install -y gconf-service libasound2-dev libatk1.0-dev libc6-dev libcairo2-dev libcups2-dev libdbus-1-dev libexpat1-dev libfontconfig1-dev libgcc1 libgconf-2-4 libgdk-pixbuf2.0-dev libglib2.0-dev libgtk-3-dev libnspr4-dev libpango-1.0-dev libpangocairo-1.0-dev libstdc++6 libx11-dev libx11-xcb-dev libxcb1-dev libxcomposite-dev libxcursor-dev libxdamage-dev libxext-dev libxfixes-dev libxi-dev libxrandr-dev libxrender-dev libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

#### 2. FFmpeg Not Found
```bash
# Install FFmpeg
# Ubuntu/Debian:
sudo apt install ffmpeg

# macOS:
brew install ffmpeg

# Windows:
# Download from https://ffmpeg.org/download.html
```

#### 3. Memory Issues
- Reduce video dimensions
- Lower FPS
- Add more RAM to your system
- Use `--max-old-space-size=4096` Node.js flag

#### 4. Slow Rendering
- Use `FFMPEG_PRESET=ultrafast`
- Reduce video quality with higher CRF value
- Lower FPS
- Smaller dimensions

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
DEBUG=puppeteer:*
```

### Performance Monitoring

The backend provides detailed progress updates:
```javascript
// Status response includes:
{
  progress: 45,                    // 0-100%
  message: "Capturing frame 15/30", // Current operation
  status: "processing"             // processing, completed, failed
}
```

## Production Deployment

### Docker Support
```dockerfile
FROM node:18-alpine

# Install Chromium dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ffmpeg

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
EXPOSE 3002
CMD ["npm", "start"]
```

### Scaling Considerations
- Use a queue system (Redis/Bull) for multiple concurrent renders
- Implement render job cleanup
- Monitor disk space for temporary files
- Consider using a dedicated render server

## Next Steps

1. **Test the integration** with your existing video editor
2. **Customize the React renderer** in `src/video-renderer.js` for your specific needs
3. **Optimize performance** based on your video requirements
4. **Deploy to production** with proper scaling and monitoring

For questions or issues, check the logs and ensure all dependencies are properly installed.
