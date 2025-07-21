# Remotion Integration Guide

This guide shows you how to integrate the new Remotion video export server with your existing React Video Editor.

## 🎯 Why Remotion?

- **100% FREE** for individuals and companies up to 3 people
- **Professional Quality** video rendering
- **Better Performance** than FFmpeg
- **React-based** - easier to maintain and debug
- **Full Feature Support** - all your editor features work

## 🚀 Quick Setup

### 1. Install and Start Remotion Server

```bash
cd backend-remotion
npm install
npm start
```

Server runs on `http://localhost:3001`

### 2. Update Frontend API Configuration

In your frontend, find where you define API endpoints (likely in `src/config` or similar):

**Before (FFmpeg):**
```javascript
const API_ENDPOINTS = {
  RENDER: 'http://localhost:3000/api/v1/editor/render',
  RENDER_STATUS: 'http://localhost:3000/api/v1/editor/render/status'
};
```

**After (Remotion):**
```javascript
const API_ENDPOINTS = {
  RENDER: 'http://localhost:3001/api/v1/editor/remotion/render',
  RENDER_STATUS: 'http://localhost:3001/api/v1/editor/remotion/render/status'
};
```

### 3. Test the Integration

Your existing frontend code should work without any changes! The Remotion server uses the same API format as your FFmpeg backend.

## 🔧 Configuration Options

### Frontend Configuration

If you want to make the backend configurable, update your config:

```javascript
// src/config/api.js
const BACKEND_TYPE = process.env.REACT_APP_BACKEND_TYPE || 'remotion'; // or 'ffmpeg'

const API_ENDPOINTS = {
  RENDER: BACKEND_TYPE === 'remotion' 
    ? 'http://localhost:3001/api/v1/editor/remotion/render'
    : 'http://localhost:3000/api/v1/editor/render',
  
  RENDER_STATUS: BACKEND_TYPE === 'remotion'
    ? 'http://localhost:3001/api/v1/editor/remotion/render/status'
    : 'http://localhost:3000/api/v1/editor/render/status'
};
```

### Environment Variables

Create `.env` in your frontend root:

```bash
# Use 'remotion' or 'ffmpeg'
REACT_APP_BACKEND_TYPE=remotion
REACT_APP_REMOTION_API_URL=http://localhost:3001/api/v1/editor/remotion
```

## 🧪 Testing

### 1. Test Remotion Server

```bash
cd backend-remotion
node test-server.js
```

### 2. Test Frontend Integration

1. Start both servers:
   ```bash
   # Terminal 1: Remotion server
   cd backend-remotion
   npm start

   # Terminal 2: Your existing server (for file uploads)
   cd backend-example  
   npm start

   # Terminal 3: Frontend
   npm run dev
   ```

2. Create a simple video in your editor
3. Click Export
4. Verify it uses the Remotion server

## 📊 Comparison: FFmpeg vs Remotion

| Feature | FFmpeg Backend | Remotion Backend |
|---------|----------------|------------------|
| **License** | Free | Free (up to 3 people) |
| **Setup** | Complex | Simple |
| **Performance** | Good | Excellent |
| **Quality** | Good | Professional |
| **Debugging** | Difficult | Easy (React DevTools) |
| **Maintenance** | High | Low |
| **Feature Support** | Limited | Full React ecosystem |
| **Error Handling** | Basic | Detailed |

## 🔄 Migration Strategy

### Option 1: Complete Switch (Recommended)
- Update API endpoints to use Remotion
- Keep FFmpeg backend as backup
- Test thoroughly with your video projects

### Option 2: Gradual Migration
- Add backend selection in your UI
- Let users choose between FFmpeg and Remotion
- Gradually phase out FFmpeg

### Option 3: A/B Testing
- Randomly assign users to different backends
- Compare performance and quality
- Make data-driven decision

## 🛠 Advanced Configuration

### Custom Video Settings

Update `backend-remotion/.env`:

```bash
# Video Quality (lower = better quality, larger file)
REMOTION_CRF=18

# Performance
REMOTION_CONCURRENCY=4

# Resolution Support
DEFAULT_WIDTH=1920
DEFAULT_HEIGHT=1080
```

### Custom Compositions

You can extend the Remotion composition in `backend-remotion/src/VideoComposition.jsx` to add:

- Custom animations
- Advanced effects
- Brand overlays
- Watermarks
- Transitions

## 🚨 Troubleshooting

### Common Issues

1. **"Render job not found"**
   - Check if Remotion server is running
   - Verify API endpoints are correct

2. **"Failed to download media files"**
   - Ensure your existing file server is running
   - Check file URLs are accessible

3. **"Composition not found"**
   - Verify Remotion project structure
   - Check console logs for bundling errors

4. **Slow rendering**
   - Increase `REMOTION_CONCURRENCY`
   - Check available system resources

### Debug Mode

Enable detailed logging:

```bash
# In backend-remotion/.env
REMOTION_LOG_LEVEL=verbose
```

## 🎉 Benefits You'll See

1. **Faster Rendering**: Remotion's optimized pipeline
2. **Better Quality**: Professional video encoding
3. **Easier Debugging**: React-based error messages
4. **More Features**: Access to entire React ecosystem
5. **Future-Proof**: Active development and community

## 📞 Support

- Check server health: `http://localhost:3001/api/v1/editor/remotion/health`
- Run test script: `node backend-remotion/test-server.js`
- Monitor console logs for detailed information
- Use Remotion Studio for composition debugging: `npm run remotion:studio`

## 🎯 Next Steps

1. **Install** the Remotion server
2. **Test** with the provided test script
3. **Update** your frontend API endpoints
4. **Verify** video export works
5. **Enjoy** faster, higher-quality video rendering!

The integration is designed to be seamless - your existing frontend code should work without any modifications!
