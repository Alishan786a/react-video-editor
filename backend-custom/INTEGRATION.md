# Frontend Integration Guide

This guide explains how to integrate the Custom Video Rendering Backend with your React Video Editor frontend.

## 🔄 API Compatibility

The Custom Video Rendering Backend is designed to be a **drop-in replacement** for the Remotion backend, with the same API structure but **no licensing restrictions**.

## 🛠️ Configuration Steps

### 1. Update API Configuration

Edit your `src/config/api.ts` file to use the custom backend:

```typescript
// Backend type selection - 'custom', 'remotion', or 'ffmpeg'
const BACKEND_TYPE = import.meta.env.VITE_BACKEND_TYPE || 'custom';

export const API_CONFIG = {
  // Upload API - handles file uploads
  UPLOAD_API_URL: import.meta.env.VITE_UPLOAD_API_URL || 'http://localhost:3000/api/v1/editor',

  // Video Rendering API (supports Custom, Remotion, and FFmpeg backends)
  RENDER_API_URL: BACKEND_TYPE === 'custom'
    ? import.meta.env.VITE_CUSTOM_API_URL || 'http://localhost:3002/api/v1/editor'
    : BACKEND_TYPE === 'remotion'
    ? import.meta.env.VITE_REMOTION_API_URL || 'http://localhost:3001/api/v1/editor/remotion'
    : import.meta.env.VITE_RENDER_API_URL || 'http://localhost:3000/api/v1/editor',

  // Caption Generation API (optional)
  CAPTIONS_API_URL: import.meta.env.VITE_CAPTIONS_API_URL || 'http://localhost:3000/api/v1/editor',

  // Backend type for debugging
  BACKEND_TYPE,
};
```

### 2. Environment Variables

Create or update your `.env` file with:

```
VITE_BACKEND_TYPE=custom
VITE_CUSTOM_API_URL=http://localhost:3002/api/v1/editor
```

### 3. API Endpoints

The custom backend uses these endpoints:

| Function | Endpoint | Method |
|----------|----------|--------|
| Health Check | `/api/v1/editor/render/health` | GET |
| Start Render | `/api/v1/editor/render` | POST |
| Check Status | `/api/v1/editor/render/status/:renderId` | GET |
| Download Video | `/api/v1/editor/files/renders/:filename` | GET |

### 4. Request Format

The render request format is identical to the Remotion backend:

```javascript
const renderData = {
  trackItemIds: ['item1', 'item2', ...],
  trackItemsMap: {
    'item1': { display: { from: 0, to: 5000 }, ... },
    'item2': { display: { from: 1000, to: 4000 }, ... },
  },
  trackItemDetailsMap: {
    'item1': { 
      type: 'video',
      details: { src: 'http://...', ... }
    },
    'item2': { 
      type: 'text',
      details: { text: 'Hello', ... }
    },
  },
  size: { width: 1080, height: 1920 },
  fps: 30
};
```

### 5. Response Format

The response format is also compatible:

```javascript
// Render start response
{
  "success": true,
  "renderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "Custom video render job started successfully"
}

// Status check response
{
  "success": true,
  "renderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing", // or "completed", "failed"
  "progress": 65,
  "currentStep": "Compositing final video"
}

// Completed status response
{
  "success": true,
  "renderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "output": "http://localhost:3002/api/v1/editor/files/renders/550e8400-e29b-41d4-a716-446655440000.mp4",
  "fileSize": 12345678,
  "duration": 30.5
}
```

## 🧪 Testing Integration

1. Start both the frontend and custom backend:

```bash
# Terminal 1: Start the frontend
cd /path/to/react-video-editor
npm run dev

# Terminal 2: Start the custom backend
cd /path/to/react-video-editor/backend-custom
npm start
```

2. Open the video editor in your browser
3. Create a project with some media
4. Click the download/export button
5. Verify the render process works and produces a downloadable video

## 🔍 Troubleshooting

### CORS Issues

If you encounter CORS errors, update the `.env` file in the backend-custom folder:

```
CORS_ORIGIN=http://localhost:3000
```

### Media File Access

If media files can't be accessed, ensure the backend can reach your frontend's media URLs. You may need to:

1. Use absolute URLs for media files
2. Ensure the backend has network access to the frontend server
3. For local files, consider copying them to a shared location

### Render Failures

If rendering fails:

1. Check the backend console for error messages
2. Verify FFmpeg is installed and working
3. Check file permissions in the storage directories
4. Ensure media files are accessible and valid

## 🚀 Production Deployment

For production:

1. Build the frontend:
```bash
npm run build
```

2. Deploy the backend using Docker:
```bash
cd backend-custom
docker-compose up -d
```

3. Update your production environment variables to point to the deployed backend URL

## 📝 API Documentation

For complete API documentation, see the [README.md](./README.md) file in the backend-custom directory.
