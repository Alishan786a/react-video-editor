const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
require('dotenv').config();

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for render jobs
const renderJobs = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Configure local storage
const STORAGE_PATH = path.join(__dirname, 'storage', 'editor');

// Ensure storage directories exist
const ensureDirectories = () => {
  const folders = ['images', 'videos', 'audio', 'misc'];
  folders.forEach(folder => {
    const folderPath = path.join(STORAGE_PATH, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  });
};

ensureDirectories();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || 'misc';
    const folderPath = path.join(STORAGE_PATH, folder);
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const originalFileName = req.body.originalFileName || file.originalname;
    const timestamp = Math.floor(Date.now() / 1000);
    const uniqueId = uuidv4().replace(/-/g, '').substring(0, 12);
    const fileName = `editor_${timestamp}_${uniqueId}_${originalFileName}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Health check endpoint
app.get('/api/v1/editor/upload/health', (req, res) => {
  res.json({
    success: true,
    message: 'Editor upload service is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      presigned_url: 'POST /api/v1/editor/upload/presigned-url',
      upload_file: 'PUT /api/v1/editor/upload/file',
      serve_files: 'GET /api/v1/editor/files/{folder}/{filename}',
      health: 'GET /api/v1/editor/upload/health'
    },
    supported_types: {
      images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      videos: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
      audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac']
    },
    storage: {
      provider: 'Local Server',
      base_path: '/storage/editor/'
    },
    limits: {
      max_file_size: '100MB'
    }
  });
});

// Generate presigned URL for file upload
app.post('/api/v1/editor/upload/presigned-url', async (req, res) => {
  try {
    const { fileName } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'fileName is required'
      });
    }

    // Validate file type
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    const supportedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac'];

    if (!supportedTypes.includes(fileExtension || '')) {
      return res.status(400).json({
        success: false,
        error: `File type .${fileExtension} is not supported. Allowed types: ${supportedTypes.join(', ')}`
      });
    }

    // Determine folder based on file type
    let folder = 'misc';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')) {
      folder = 'images';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileExtension || '')) {
      folder = 'videos';
    } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(fileExtension || '')) {
      folder = 'audio';
    }

    // Generate unique filename with timestamp and ID
    const timestamp = Math.floor(Date.now() / 1000);
    const uniqueId = uuidv4().replace(/-/g, '').substring(0, 12);
    const uniqueFileName = `editor_${timestamp}_${uniqueId}_${fileName}`;

    // Final file URL (publicly accessible)
    const fileUrl = `http://localhost:${PORT}/api/v1/editor/files/${folder}/${uniqueFileName}`;

    res.json({
      success: true,
      presigned_url: `http://localhost:${PORT}/api/v1/editor/upload/file`,
      url: fileUrl,
      id: uniqueId,
      fileName: uniqueFileName,
      originalFileName: fileName,
      folder: folder,
      uploadMethod: 'PUT',
      uploadHeaders: {
        'Content-Type': 'multipart/form-data'
      }
    });

  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL'
    });
  }
});

// Upload file endpoint
app.put('/api/v1/editor/upload/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const originalFileName = req.body.originalFileName || req.file.originalname;

    // Determine folder based on file type
    const fileExtension = originalFileName.split('.').pop()?.toLowerCase();
    let folder = 'misc';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')) {
      folder = 'images';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileExtension || '')) {
      folder = 'videos';
    } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(fileExtension || '')) {
      folder = 'audio';
    }

    const fileUrl = `http://localhost:${PORT}/api/v1/editor/files/${folder}/${req.file.filename}`;

    res.json({
      success: true,
      fileName: req.file.filename,
      originalFileName: originalFileName,
      url: fileUrl,
      size: req.file.size,
      folder: folder,
      contentType: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file'
    });
  }
});

// Serve files endpoint
app.get('/api/v1/editor/files/:folder/:filename', (req, res) => {
  try {
    const { folder, filename } = req.params;
    const filePath = path.join(STORAGE_PATH, folder, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Set appropriate headers
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Send file
    res.sendFile(filePath);

  } catch (error) {
    console.error('File serving error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve file'
    });
  }
});

// Video rendering helper functions
const createVideoFromProject = async (projectData, renderId) => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(STORAGE_PATH, 'renders', `${renderId}.mp4`);

    // Ensure renders directory exists
    const rendersDir = path.join(STORAGE_PATH, 'renders');
    if (!fs.existsSync(rendersDir)) {
      fs.mkdirSync(rendersDir, { recursive: true });
    }

    // Create a simple video based on project data
    // For now, we'll create a basic video with the specified dimensions and duration
    const { size, fps = 30 } = projectData;
    const width = size?.width || 1080;
    const height = size?.height || 1920;

    // Calculate duration from tracks (simplified)
    let duration = 10; // Default 10 seconds
    if (projectData.tracks && projectData.tracks.length > 0) {
      // Find the longest track duration
      const maxDuration = projectData.tracks.reduce((max, track) => {
        if (track.trackItems && track.trackItems.length > 0) {
          const trackDuration = track.trackItems.reduce((sum, item) => {
            return sum + (item.duration || 5);
          }, 0);
          return Math.max(max, trackDuration);
        }
        return max;
      }, 0);
      duration = maxDuration > 0 ? Math.ceil(maxDuration / 1000) : 10; // Convert ms to seconds
    }

    console.log(`Creating video: ${width}x${height}, ${fps}fps, ${duration}s`);

    // Create a basic video with FFmpeg
    ffmpeg()
      .input(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}`)
      .inputFormat('lavfi')
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Rendering progress: ${Math.round(progress.percent || 0)}%`);
        // Update job progress
        if (renderJobs.has(renderId)) {
          const job = renderJobs.get(renderId);
          job.progress = Math.round(progress.percent || 0);
          renderJobs.set(renderId, job);
        }
      })
      .on('end', () => {
        console.log('Video rendering completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(err);
      })
      .run();
  });
};

// Video rendering endpoint
app.post('/api/v1/editor/render', async (req, res) => {
  try {
    const projectData = req.body;
    const renderId = uuidv4();

    console.log('Render request received:', { renderId, projectKeys: Object.keys(projectData) });

    // Store job in memory
    renderJobs.set(renderId, {
      id: renderId,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      projectData
    });

    res.json({
      success: true,
      renderId: renderId,
      status: 'processing',
      message: 'Render job started successfully'
    });

    // Start rendering in background
    try {
      const outputPath = await createVideoFromProject(projectData, renderId);
      const outputUrl = `http://localhost:${PORT}/api/v1/editor/files/renders/${renderId}.mp4`;

      // Update job status
      renderJobs.set(renderId, {
        ...renderJobs.get(renderId),
        status: 'completed',
        progress: 100,
        output: outputUrl,
        outputPath,
        completedAt: new Date()
      });

      console.log(`Render job ${renderId} completed: ${outputUrl}`);
    } catch (error) {
      console.error(`Render job ${renderId} failed:`, error);
      renderJobs.set(renderId, {
        ...renderJobs.get(renderId),
        status: 'failed',
        error: error.message,
        failedAt: new Date()
      });
    }

  } catch (error) {
    console.error('Error starting render:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start render'
    });
  }
});

// Check render status endpoint
app.get('/api/v1/editor/render/status/:renderId', async (req, res) => {
  try {
    const { renderId } = req.params;

    if (!renderJobs.has(renderId)) {
      return res.status(404).json({
        error: 'Render job not found',
        renderId
      });
    }

    const job = renderJobs.get(renderId);

    res.json({
      render: {
        renderId: job.id,
        projectId: job.projectData?.id,
        status: job.status,
        progress: job.progress,
        output: job.output,
        createdAt: job.createdAt,
        updatedAt: job.completedAt || job.failedAt || job.createdAt,
        error: job.error
      }
    });

  } catch (error) {
    console.error('Error checking render status:', error);
    res.status(500).json({ error: 'Failed to check render status' });
  }
});

// Render health check endpoint
app.get('/api/v1/editor/render/health', (req, res) => {
  res.json({
    success: true,
    message: 'Render service is healthy',
    timestamp: new Date().toISOString(),
    active_jobs: Array.from(renderJobs.values()).filter(job => job.status === 'processing').length,
    total_jobs: renderJobs.size,
    supported_formats: ['mp4'],
    max_resolution: '4K (3840x2160)',
    max_duration: '10 minutes'
  });
});

// Optional: Caption generation endpoint (placeholder)
app.post('/api/captions/generate', async (req, res) => {
  try {
    const { url, projectId } = req.body;
    const jobId = uuidv4();
    
    // TODO: Implement caption generation
    // This could involve:
    // 1. Downloading the video from the URL
    // 2. Extracting audio
    // 3. Using speech-to-text service (AWS Transcribe, Google Speech-to-Text, etc.)
    // 4. Processing and formatting captions
    
    console.log('Caption generation request:', { jobId, url, projectId });
    
    res.json({
      jobId: jobId,
      status: 'processing'
    });
    
  } catch (error) {
    console.error('Error starting caption generation:', error);
    res.status(500).json({ error: 'Failed to start caption generation' });
  }
});

// Optional: Check caption generation status (placeholder)
app.get('/api/captions/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // TODO: Implement caption status checking
    
    res.json({
      status: 'completed',
      captions: [
        {
          start: 0,
          end: 2000,
          text: 'Sample caption text'
        }
      ]
    });
    
  } catch (error) {
    console.error('Error checking caption status:', error);
    res.status(500).json({ error: 'Failed to check caption status' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Video Editor API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
