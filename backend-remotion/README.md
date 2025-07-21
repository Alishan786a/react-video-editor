# Remotion Video Export Server

A free, high-performance video export server for the React Video Editor using Remotion CLI rendering.

## 🎯 Features

- **100% Free**: Uses Remotion's free license (perfect for individuals and companies up to 3 people)
- **High Quality**: Professional video rendering with H.264 codec
- **Full Feature Support**: Images, videos, audio, text, animations, and effects
- **Fast Rendering**: Leverages Remotion's optimized rendering pipeline
- **Easy Integration**: Drop-in replacement for FFmpeg backend

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend-remotion
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3001`

### 3. Health Check

Visit `http://localhost:3001/api/v1/editor/remotion/health` to verify the server is running.

## 📡 API Endpoints

### Start Render Job
```
POST /api/v1/editor/remotion/render
```

Send your video editor project data to start rendering.

### Check Render Status
```
GET /api/v1/editor/remotion/render/status/:renderId
```

Monitor rendering progress and get download URL when complete.

### Download Video
```
GET /api/v1/editor/remotion/files/renders/:filename
```

Download the rendered video file.

## 🔧 Configuration

Copy `.env.example` to `.env` and customize settings:

```bash
cp .env.example .env
```

## 🎬 How It Works

1. **Receives** video editor project data via API
2. **Downloads** all media files locally for processing
3. **Bundles** Remotion composition with your project data
4. **Renders** video using Remotion CLI (completely free!)
5. **Serves** the final MP4 file for download

## 🆓 Remotion License

This server uses Remotion's **FREE license** which allows:
- ✅ Unlimited video exports
- ✅ Commercial use
- ✅ Self-hosted rendering
- ✅ All video qualities and formats

Perfect for individuals and companies up to 3 people!

## 🔄 Integration with Frontend

Update your frontend API endpoint to use the Remotion server:

```javascript
// Change from:
const API_ENDPOINTS = {
  RENDER: 'http://localhost:3000/api/v1/editor/render'
};

// To:
const API_ENDPOINTS = {
  RENDER: 'http://localhost:3001/api/v1/editor/remotion/render'
};
```

## 🛠 Development

### Run in Development Mode
```bash
npm run dev
```

### Test Remotion Studio (Optional)
```bash
npm run remotion:studio
```

This opens Remotion Studio where you can preview and test compositions.

## 📁 Project Structure

```
backend-remotion/
├── src/
│   ├── Root.jsx              # Remotion root component
│   └── VideoComposition.jsx  # Main video composition
├── storage/
│   ├── renders/              # Rendered video files
│   └── temp/                 # Temporary media files
├── server.js                 # Express server
├── remotion.config.js        # Remotion configuration
└── package.json
```

## 🎨 Supported Features

- ✅ **Images**: PNG, JPG, WebP with positioning and effects
- ✅ **Videos**: MP4, WebM with trimming and volume control
- ✅ **Audio**: MP3, WAV with trimming and volume control
- ✅ **Text**: Full typography support with animations
- ✅ **Animations**: Fade in/out, slide effects, and more
- ✅ **Effects**: Blur, brightness, flip, opacity
- ✅ **Positioning**: Accurate coordinate conversion from editor
- ✅ **Timing**: Precise frame-based timing control

## 🚀 Performance Tips

1. **Concurrent Renders**: Adjust `REMOTION_CONCURRENCY` in `.env`
2. **Video Quality**: Modify `REMOTION_CRF` (lower = higher quality)
3. **Cleanup**: Enable `CLEANUP_TEMP_FILES` to save disk space
4. **Caching**: Keep `CACHE_BUNDLES=true` for faster subsequent renders

## 🆚 vs FFmpeg Backend

| Feature | FFmpeg Backend | Remotion Backend |
|---------|----------------|------------------|
| License | Free | Free (up to 3 people) |
| Performance | Good | Excellent |
| Quality | Good | Professional |
| Maintenance | Complex | Simple |
| Features | Limited | Full React ecosystem |
| Debugging | Difficult | Easy with React DevTools |

## 🤝 Contributing

This server is designed to work seamlessly with your existing React Video Editor. No changes needed to your frontend code - just update the API endpoint!

## 📞 Support

- Check the health endpoint for server status
- Monitor console logs for detailed rendering information
- Use Remotion Studio for composition debugging
