# Video Editor API Documentation

This document provides complete API specifications for the React Video Editor backend integration.

## Base URL
```
http://localhost:3000/api/v1/editor
```

## Authentication
No authentication required for editor APIs.

---

## 📁 File Upload APIs

### 1. Generate Upload URL
**Endpoint:** `POST /api/v1/editor/upload/presigned-url`

**Request Body:**
```json
{
  "fileName": "my-video.mp4"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "presigned_url": "http://localhost:3000/api/v1/editor/upload/file",
  "url": "http://localhost:3000/api/v1/editor/files/videos/editor_1640995200_abc123_my-video.mp4",
  "id": "abc123def456",
  "fileName": "editor_1640995200_abc123_my-video.mp4",
  "originalFileName": "my-video.mp4",
  "folder": "videos",
  "uploadMethod": "PUT",
  "uploadHeaders": {
    "Content-Type": "multipart/form-data"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": "File type .xyz is not supported. Allowed types: jpg, jpeg, png, gif, webp, svg, mp4, mov, avi, mkv, webm, mp3, wav, ogg, m4a, aac"
}
```

---

### 2. Upload File
**Endpoint:** `PUT /api/v1/editor/upload/file`

**Request:** Multipart form data
- `file`: Binary file data
- `originalFileName`: (Optional) Original filename

**Response (Success - 200):**
```json
{
  "success": true,
  "fileName": "editor_1640995200_abc123_my-video.mp4",
  "originalFileName": "my-video.mp4",
  "url": "http://localhost:3000/api/v1/editor/files/videos/editor_1640995200_abc123_my-video.mp4",
  "size": 1048576,
  "folder": "videos",
  "contentType": "video/mp4",
  "uploadedAt": "2023-01-01T12:00:00.000Z"
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": "File size exceeds 100MB limit"
}
```

---

### 3. Serve Files
**Endpoint:** `GET /api/v1/editor/files/{folder}/{filename}`

**Parameters:**
- `folder`: images | videos | audio | misc
- `filename`: Generated filename from upload

**Response:** Binary file data with appropriate headers
- `Content-Type`: Proper MIME type
- `Content-Length`: File size
- `Cache-Control`: public, max-age=86400

**Error Response (404):**
```json
{
  "success": false,
  "error": "File not found"
}
```

---

### 4. Upload Health Check
**Endpoint:** `GET /api/v1/editor/upload/health`

**Response (200):**
```json
{
  "success": true,
  "message": "Editor upload service is healthy",
  "timestamp": "2023-01-01T12:00:00.000Z",
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

---

## 🎬 Video Rendering APIs (Optional)

### 5. Start Render Job
**Endpoint:** `POST /api/v1/editor/render`

**Request Body:**
```json
{
  "id": "project-123",
  "fps": 30,
  "tracks": [],
  "size": {
    "width": 1080,
    "height": 1920
  },
  "trackItemDetailsMap": {},
  "trackItemIds": [],
  "transitionsMap": {},
  "trackItemsMap": {},
  "transitionIds": []
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "renderId": "render-abc123",
  "status": "processing",
  "message": "Render job started successfully"
}
```

---

### 6. Get Render Status
**Endpoint:** `GET /api/v1/editor/render/status/{renderId}`

**Response (Success - 200):**
```json
{
  "render": {
    "renderId": "render-abc123",
    "projectId": "project-123",
    "status": "completed",
    "progress": 100,
    "output": "http://localhost:3000/api/v1/editor/files/videos/rendered_abc123.mp4",
    "createdAt": "2023-01-01T12:00:00.000Z",
    "updatedAt": "2023-01-01T12:05:00.000Z"
  }
}
```

**Status Values:**
- `processing`: Render in progress
- `completed`: Render finished successfully
- `failed`: Render failed (includes error message)

---

### 7. Render Health Check
**Endpoint:** `GET /api/v1/editor/render/health`

**Response (200):**
```json
{
  "success": true,
  "message": "Render service is healthy",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "active_jobs": 3,
  "supported_formats": ["mp4"],
  "max_resolution": "4K (3840x2160)",
  "max_duration": "10 minutes"
}
```

---

## 🎤 Caption Generation APIs (Optional)

### 8. Generate Captions
**Endpoint:** `POST /api/v1/editor/captions/generate`

**Request Body:**
```json
{
  "url": "http://localhost:3000/api/v1/editor/files/videos/editor_1640995200_abc123_my-video.mp4",
  "projectId": "project-123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "jobId": "caption-abc123",
  "status": "processing",
  "message": "Caption generation job started successfully"
}
```

---

### 9. Get Caption Status
**Endpoint:** `GET /api/v1/editor/captions/status/{jobId}`

**Response (Success - 200):**
```json
{
  "jobId": "caption-abc123",
  "projectId": "project-123",
  "status": "completed",
  "progress": 100,
  "captions": [
    {
      "start": 0,
      "end": 2000,
      "text": "Hello and welcome to this video"
    },
    {
      "start": 2000,
      "end": 4500,
      "text": "Today we're going to learn about video editing"
    }
  ],
  "createdAt": "2023-01-01T12:00:00.000Z",
  "updatedAt": "2023-01-01T12:05:00.000Z"
}
```

**Caption Object:**
- `start`: Start time in milliseconds
- `end`: End time in milliseconds
- `text`: Caption text content

---

### 10. Caption Health Check
**Endpoint:** `GET /api/v1/editor/captions/health`

**Response (200):**
```json
{
  "success": true,
  "message": "Caption generation service is healthy",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "active_jobs": 2,
  "supported_languages": ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh"],
  "supported_formats": ["mp4", "mov", "avi", "mkv", "webm"],
  "max_duration": "30 minutes"
}
```

---

## 📋 File Upload Workflow

### Recommended Upload Flow:

1. **Get Upload URL:**
   ```javascript
   POST /api/v1/editor/upload/presigned-url
   Body: { "fileName": "video.mp4" }
   ```

2. **Upload File:**
   ```javascript
   PUT /api/v1/editor/upload/file
   FormData: { file: binaryData, originalFileName: "video.mp4" }
   ```

3. **Access File:**
   ```javascript
   GET /api/v1/editor/files/videos/editor_timestamp_id_video.mp4
   ```

---

## 🚨 Error Handling

All APIs return consistent error format:
```json
{
  "success": false,
  "error": "Error message description",
  "details": "Additional technical details (optional)"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (invalid data)
- `404`: Not Found
- `500`: Internal Server Error

---

## 📝 Notes

- **File Size Limit:** 100MB maximum
- **Supported File Types:** Images (jpg, png, gif, webp, svg), Videos (mp4, mov, avi, mkv, webm), Audio (mp3, wav, ogg, m4a, aac)
- **Storage:** Local server storage in `/storage/editor/` folders
- **File Naming:** Automatic unique naming with timestamp and random ID
- **CORS:** Enabled for cross-origin requests
- **Caching:** 24-hour cache for served files
