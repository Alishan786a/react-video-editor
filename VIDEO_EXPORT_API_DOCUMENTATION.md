# Video Export API Documentation

This document outlines the API endpoints required to make the video download/export functionality work in the React Video Editor.

## Overview

The video editor's download functionality requires two main API endpoints:
1. **Start Render Job** - Initiates video rendering process
2. **Check Render Status** - Monitors rendering progress and retrieves download URL

## Required API Endpoints

### 1. Start Video Render Job

**Endpoint:** `POST /api/v1/editor/render`

**Purpose:** Initiates the video rendering process with the project data

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "project-abc123",
  "fps": 30,
  "tracks": [
    {
      "id": "track-1",
      "type": "video",
      "items": [...]
    }
  ],
  "size": {
    "width": 1080,
    "height": 1920
  },
  "trackItemDetailsMap": {
    "item-1": {
      "id": "item-1",
      "type": "video",
      "src": "http://localhost:3000/api/v1/editor/files/videos/sample.mp4",
      "duration": 5000,
      "startTime": 0
    }
  },
  "trackItemIds": ["item-1", "item-2"],
  "transitionsMap": {},
  "trackItemsMap": {
    "track-1": ["item-1", "item-2"]
  },
  "transitionIds": []
}
```

**Success Response (200):**
```json
{
  "success": true,
  "renderId": "render-xyz789",
  "status": "processing",
  "message": "Render job started successfully"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to start render job",
  "message": "Detailed error message"
}
```

### 2. Check Render Status

**Endpoint:** `GET /api/v1/editor/render/status/{renderId}`

**Purpose:** Check the progress of a rendering job and get the download URL when complete

**Path Parameters:**
- `renderId` (string): The render job ID returned from the start render endpoint

**Success Response (200) - In Progress:**
```json
{
  "render": {
    "progress": 45,
    "status": "processing"
  }
}
```

**Success Response (200) - Completed:**
```json
{
  "render": {
    "progress": 100,
    "status": "completed",
    "output": "http://localhost:3000/api/v1/editor/files/renders/render-xyz789.mp4"
  }
}
```

**Success Response (200) - Failed:**
```json
{
  "render": {
    "progress": 0,
    "status": "failed",
    "error": "Rendering failed due to invalid video format"
  }
}
```

**Error Response (404):**
```json
{
  "error": "Render job not found"
}
```

**Error Response (500):**
```json
{
  "error": "Failed to check render status"
}
```

## Status Values

The `status` field in the render status response can have the following values:

- `processing`: Render job is currently in progress
- `completed`: Render job finished successfully, `output` URL is available
- `failed`: Render job failed, `error` message is provided
- `queued`: Render job is waiting in queue (optional)

## Progress Values

The `progress` field indicates completion percentage:
- Range: 0-100
- Type: Integer
- 0: Job just started or failed
- 1-99: Job in progress
- 100: Job completed successfully

## Implementation Notes

### Video Rendering Process
Your backend should implement the following workflow:

1. **Receive render request** with project data
2. **Validate project data** (check required fields, file URLs)
3. **Generate unique render ID** (UUID recommended)
4. **Queue/start rendering job** (using FFmpeg, cloud service, etc.)
5. **Store job status** in database/cache
6. **Return render ID** to client

### Status Checking
- Client polls status endpoint every 2 seconds
- Backend should track job progress in database/cache
- When complete, provide accessible download URL
- Handle job failures gracefully with error messages

### File Storage
- Rendered videos should be accessible via HTTP
- Suggested path: `/api/v1/editor/files/renders/{renderId}.mp4`
- Consider implementing file cleanup after download
- Ensure proper CORS headers for file serving

### Security Considerations
- Validate file URLs in project data
- Implement rate limiting on render endpoints
- Consider authentication if needed
- Sanitize file names and paths

## Example Implementation Flow

1. User clicks "Export" in video editor
2. Frontend calls `POST /api/v1/editor/render` with project data
3. Backend returns `renderId` and starts processing
4. Frontend polls `GET /api/v1/editor/render/status/{renderId}` every 2 seconds
5. When status is "completed", frontend downloads file from `output` URL
6. File is automatically downloaded to user's device

## Testing the Integration

You can test the API integration by:

1. Implementing mock endpoints that return sample responses
2. Using the browser's Network tab to verify API calls
3. Testing with different project data structures
4. Simulating various status responses (processing, completed, failed)

## Required Dependencies

Your backend will likely need:
- Video processing library (FFmpeg, cloud service)
- File storage system (local, S3, etc.)
- Job queue system (Redis, database)
- UUID generation library
- CORS middleware for file serving
