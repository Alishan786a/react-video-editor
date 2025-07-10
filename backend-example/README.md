# Video Editor Backend API

A simple Node.js/Express backend for the React Video Editor application.

## Features

- ✅ File upload with local storage
- ✅ Automatic file organization (images, videos, audio folders)
- ✅ File serving with proper headers
- ✅ Health check endpoint
- 🔄 Video rendering endpoints (placeholder)
- 🔄 Caption generation endpoints (placeholder)
- ✅ CORS enabled for frontend integration
- ✅ Error handling and validation

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your AWS credentials and S3 bucket name
   ```

3. **Storage Setup**:
   - Files are stored locally in `./storage/editor/` directory
   - Directories are created automatically on server start
   - No additional configuration needed

4. **Start the server**:
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Test the API**:
   ```bash
   # Health check
   curl http://localhost:3000/api/v1/editor/upload/health

   # Test upload endpoint
   curl -X POST http://localhost:3000/api/v1/editor/upload/presigned-url \
     -H "Content-Type: application/json" \
     -d '{"fileName": "test-video.mp4"}'

   # Or use the test script
   node ../test-upload.js
   ```

## Local Storage Structure

Files are automatically organized in the following structure:

```
backend-example/
└── storage/
    └── editor/
        ├── images/     # JPG, PNG, GIF, WebP, SVG files
        ├── videos/     # MP4, MOV, AVI, MKV, WebM files
        ├── audio/      # MP3, WAV, OGG, M4A, AAC files
        └── misc/       # Other file types
```

Files are served at: `http://localhost:3000/api/v1/editor/files/{folder}/{filename}`

## API Endpoints

### File Upload
- `GET /api/v1/editor/upload/health` - Health check
- `POST /api/v1/editor/upload/presigned-url` - Get upload details
- `PUT /api/v1/editor/upload/file` - Upload file
- `GET /api/v1/editor/files/{folder}/{filename}` - Serve files

### Video Rendering (Optional)
- `POST /api/v1/editor/render` - Start video rendering
- `GET /api/v1/editor/render/status/:renderId` - Check render status

### Caption Generation (Optional)
- `POST /api/v1/editor/captions/generate` - Generate captions from video
- `GET /api/v1/editor/captions/status/:jobId` - Check caption generation status

## Deployment

### Using PM2 (recommended for production)
```bash
npm install -g pm2
pm2 start server.js --name "video-editor-api"
pm2 startup
pm2 save
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Alternative Storage Options

The current implementation uses local file storage. For production, consider:

- **AWS S3** - Modify upload logic to use S3 SDK
- **Google Cloud Storage** - Use Google Cloud Storage SDK
- **Cloudinary** - Use Cloudinary upload API
- **DigitalOcean Spaces** - Compatible with S3 SDK
- **Azure Blob Storage** - Use Azure Storage SDK

Update the upload logic in `server.js` accordingly. The current local storage is perfect for development and testing.

## Security Considerations

- Use environment variables for sensitive data
- Implement rate limiting
- Add authentication if needed
- Validate file types and sizes
- Use HTTPS in production
- Secure file serving endpoints
- Consider virus scanning for uploaded files

## Troubleshooting

1. **CORS errors**: Check CORS configuration in server.js
2. **Upload fails**: Check file permissions and storage directory
3. **Files not accessible**: Verify storage directory exists and is readable
4. **Port conflicts**: Make sure port 3000 is available
