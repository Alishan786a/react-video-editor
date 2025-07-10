# React Video Editor - API Requirements

This document outlines the backend API endpoints required for the React Video Editor application.

## Overview

The React Video Editor currently uses external APIs that need to be replaced with your own backend services. This document provides the specifications for each required API endpoint.

## Required API Endpoints

### 1. File Upload API

**Purpose**: Handle file uploads for images, videos, and audio files

#### Get Presigned URL
**Endpoint**: `POST /api/v1/editor/upload/presigned-url`

**Request Body**:
```json
{
  "fileName": "test-video.mp4"
}
```

**Response**:
```json
{
  "success": true,
  "presigned_url": "http://localhost:3000/api/v1/editor/upload/file",
  "url": "http://localhost:3000/api/v1/editor/files/videos/editor_1234567890_abc123def456_test-video.mp4",
  "id": "abc123def456",
  "fileName": "editor_1234567890_abc123def456_test-video.mp4",
  "originalFileName": "test-video.mp4",
  "folder": "videos",
  "uploadMethod": "PUT",
  "uploadHeaders": {
    "Content-Type": "multipart/form-data"
  }
}
```

#### Upload File
**Endpoint**: `PUT /api/v1/editor/upload/file`

**Request**: Multipart form data with:
- `file`: The actual file
- `originalFileName`: Original filename

**Response**:
```json
{
  "success": true,
  "fileName": "editor_1234567890_abc123def456_test-video.mp4",
  "originalFileName": "test-video.mp4",
  "url": "http://localhost:3000/api/v1/editor/files/videos/editor_1234567890_abc123def456_test-video.mp4",
  "size": 1048576,
  "folder": "videos",
  "contentType": "video/mp4",
  "uploadedAt": "2024-01-01T12:00:00.000Z"
}
```

#### Serve Files
**Endpoint**: `GET /api/v1/editor/files/{folder}/{filename}`

**Response**: The actual file content with appropriate headers

#### Health Check
**Endpoint**: `GET /api/v1/editor/upload/health`

**Response**:
```json
{
  "success": true,
  "message": "Editor upload service is healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "endpoints": {
    "presigned_url": "POST /api/v1/editor/upload/presigned-url",
    "upload_file": "PUT /api/v1/editor/upload/file",
    "serve_files": "GET /api/v1/editor/files/{folder}/{filename}",
    "health": "GET /api/v1/editor/upload/health"
  },
  "supported_types": {
    "images": ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    "videos": ["mp4", "mov", "avi", "mkv", "webm"],
    "audio": ["mp3", "wav", "ogg", "m4a", "aac"]
  },
  "storage": {
    "provider": "Local Server",
    "base_path": "/storage/editor/"
  },
  "limits": {
    "max_file_size": "100MB"
  }
}
```

**Implementation Notes**:
- Files are automatically organized into folders: `images/`, `videos/`, `audio/`, `misc/`
- Unique filenames are generated with timestamp and UUID
- Support file types: images (jpg, png, gif, webp, svg), videos (mp4, mov, avi, mkv, webm), audio (mp3, wav, ogg, m4a, aac)
- File size limit: 100MB max
- Local storage implementation provided (can be adapted for cloud storage)

### 2. Video Rendering API (Optional)

**Purpose**: Render video projects to downloadable MP4 files

**Endpoint**: `POST /api/render`

**Request Body**:
```json
{
  "id": "project-id",
  "fps": 30,
  "tracks": [...],
  "size": {
    "width": 1080,
    "height": 1920
  },
  "trackItemDetailsMap": {...},
  "trackItemIds": [...],
  "transitionsMap": {...},
  "trackItemsMap": {...},
  "transitionIds": [...]
}
```

**Response**:
```json
{
  "renderId": "render-job-id",
  "status": "processing"
}
```

**Status Check Endpoint**: `GET /api/render/status/{renderId}`

**Response**:
```json
{
  "render": {
    "progress": 75,
    "status": "processing",
    "output": "https://your-storage.com/rendered-video.mp4"
  }
}
```

**Implementation Notes**:
- This is optional - the app can work without video rendering
- When progress reaches 100, include the `output` URL
- Consider using background job processing (Redis, Bull, etc.)

### 3. Caption Generation API (Optional)

**Purpose**: Generate captions/subtitles from video audio

**Endpoint**: `POST /api/captions/generate`

**Request Body**:
```json
{
  "url": "https://your-storage.com/video.mp4",
  "projectId": "project-id"
}
```

**Response**:
```json
{
  "jobId": "caption-job-id",
  "status": "processing"
}
```

**Status Check**: `GET /api/captions/status/{jobId}`

**Response**:
```json
{
  "status": "completed",
  "captions": [
    {
      "start": 0,
      "end": 2000,
      "text": "Hello world"
    }
  ]
}
```

## Storage Requirements

### File Storage
- **Purpose**: Store uploaded media files (images, videos, audio)
- **Requirements**:
  - Public read access for uploaded files
  - CORS enabled for direct uploads
  - CDN recommended for better performance
  - Suggested services: AWS S3, Google Cloud Storage, Cloudinary

### Database (Optional)
- **Purpose**: Store project data, user uploads metadata
- **Tables needed**:
  - `uploads` (id, filename, url, file_type, size, created_at)
  - `projects` (id, name, data, created_at, updated_at)
  - `render_jobs` (id, project_id, status, progress, output_url, created_at)

## Environment Variables

Create a `.env` file in your project root:

```env
# API Base URLs
VITE_UPLOAD_API_URL=http://localhost:3000/api/v1/editor
VITE_RENDER_API_URL=http://localhost:3000/api/v1/editor
VITE_CAPTIONS_API_URL=http://localhost:3000/api/v1/editor

# Storage Configuration
STORAGE_BUCKET=your-storage-bucket
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
```

## Quick Start Backend Examples

### Node.js/Express Example

```javascript
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');

const app = express();
const s3 = new AWS.S3();

// Generate presigned URL
app.post('/api/upload/presigned-url', async (req, res) => {
  const { fileName } = req.body;
  
  const params = {
    Bucket: process.env.STORAGE_BUCKET,
    Key: fileName,
    Expires: 3600,
    ContentType: 'application/octet-stream'
  };
  
  try {
    const presignedUrl = await s3.getSignedUrlPromise('putObject', params);
    const fileUrl = `https://${process.env.STORAGE_BUCKET}.s3.amazonaws.com/${fileName}`;
    
    res.json({
      presigned_url: presignedUrl,
      url: fileUrl,
      id: fileName.split('.')[0],
      fileName: fileName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Python/FastAPI Example

```python
import boto3
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
s3_client = boto3.client('s3')

class UploadRequest(BaseModel):
    fileName: str

@app.post("/api/upload/presigned-url")
async def create_presigned_url(request: UploadRequest):
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': 'your-bucket', 'Key': request.fileName},
            ExpiresIn=3600
        )
        
        return {
            "presigned_url": presigned_url,
            "url": f"https://your-bucket.s3.amazonaws.com/{request.fileName}",
            "id": request.fileName.split('.')[0],
            "fileName": request.fileName
        }
    except Exception as e:
        return {"error": str(e)}
```

## Security Considerations

1. **File Upload Security**:
   - Validate file types and sizes
   - Scan uploaded files for malware
   - Use presigned URLs with expiration
   - Implement rate limiting

2. **CORS Configuration**:
   - Allow your frontend domain
   - Restrict methods to necessary ones (GET, POST, PUT)

3. **API Security**:
   - Implement API key authentication if needed
   - Use HTTPS in production
   - Validate all input data

## Testing Your API

Use the provided test files in the `test-files/` directory to test your upload API:

```bash
# Test upload endpoint
curl -X POST http://localhost:3000/api/v1/editor/upload/presigned-url \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test-video.mp4"}'
```

## Next Steps

1. Choose your preferred backend technology (Node.js, Python, PHP, etc.)
2. Set up file storage (AWS S3, Google Cloud Storage, etc.)
3. Implement the upload API endpoint
4. Update the frontend configuration
5. Test file uploads
6. Optionally implement video rendering and caption generation

For questions or issues, please refer to the main README.md file.
