import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { VideoRenderer } from './src/video-renderer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Storage setup with folder organization
const storageDir = path.join(__dirname, 'storage');
const rendersDir = path.join(storageDir, 'renders');
const tempDir = path.join(storageDir, 'temp');

// Create organized upload folders
const uploadFolders = {
  images: path.join(storageDir, 'images'),
  videos: path.join(storageDir, 'videos'),
  audio: path.join(storageDir, 'audio'),
  misc: path.join(storageDir, 'misc')
};

// Ensure all storage directories exist
fs.ensureDirSync(storageDir);
fs.ensureDirSync(rendersDir);
fs.ensureDirSync(tempDir);
Object.values(uploadFolders).forEach(dir => fs.ensureDirSync(dir));

// Helper function to sanitize filename for URL safety
const sanitizeFilename = (filename) => {
  // Replace problematic characters with safe alternatives
  return filename
    .replace(/#/g, '_hash_')           // # causes URL fragment issues
    .replace(/\?/g, '_question_')      // ? causes query parameter issues
    .replace(/&/g, '_and_')            // & causes query parameter issues
    .replace(/\+/g, '_plus_')          // + can be interpreted as space
    .replace(/%/g, '_percent_')        // % causes encoding issues
    .replace(/\s+/g, '_')              // Replace multiple spaces with single underscore
    .replace(/[<>:"|*]/g, '_')         // Replace other problematic characters
    .replace(/_+/g, '_')               // Replace multiple underscores with single
    .replace(/^_|_$/g, '');            // Remove leading/trailing underscores
};

// Helper function to determine file type and folder
const getFileTypeAndFolder = (filename) => {
  const fileExtension = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')) {
    return { folder: 'images', type: 'image' };
  } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileExtension || '')) {
    return { folder: 'videos', type: 'video' };
  } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(fileExtension || '')) {
    return { folder: 'audio', type: 'audio' };
  }
  return { folder: 'misc', type: 'file' };
};

// Configure multer for file uploads with folder organization
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const originalFileName = req.body.originalFileName || file.originalname;
    const { folder } = getFileTypeAndFolder(originalFileName);
    const folderPath = uploadFolders[folder];
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const originalFileName = req.body.originalFileName || file.originalname;
    const sanitizedFileName = sanitizeFilename(originalFileName);
    const timestamp = Math.floor(Date.now() / 1000);
    const uniqueId = uuidv4().replace(/-/g, '').substring(0, 12);
    const fileName = `editor_${timestamp}_${uniqueId}_${sanitizedFileName}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// In-memory job tracking
const renderJobs = new Map();

// Health check endpoints
app.get('/api/v1/editor/render/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'puppeteer-video-renderer',
    timestamp: new Date().toISOString()
  });
});

// Upload service health check endpoint
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

// Presigned URL endpoint
app.post('/api/v1/editor/upload/presigned-url', (req, res) => {
  try {
    const { fileName, fileSize, contentType } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'fileName is required'
      });
    }

    // Determine folder based on file type
    const { folder } = getFileTypeAndFolder(fileName);

    // Generate unique filename with timestamp and ID (sanitized)
    const sanitizedFileName = sanitizeFilename(fileName);
    const timestamp = Math.floor(Date.now() / 1000);
    const uniqueId = uuidv4().replace(/-/g, '').substring(0, 12);
    const uniqueFileName = `editor_${timestamp}_${uniqueId}_${sanitizedFileName}`;

    // Final file URL (publicly accessible) - properly encoded
    const encodedFileName = encodeURIComponent(uniqueFileName);
    const fileUrl = `http://localhost:${PORT}/api/v1/editor/files/${folder}/${encodedFileName}`;

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
    console.error('Presigned URL error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate presigned URL'
    });
  }
});

// Upload file endpoint (supports both POST and PUT)
app.post('/api/v1/editor/upload/file', upload.single('file'), handleFileUpload);
app.put('/api/v1/editor/upload/file', upload.single('file'), handleFileUpload);

function handleFileUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const originalFileName = req.body.originalFileName || req.file.originalname;
    const { folder } = getFileTypeAndFolder(originalFileName);
    const encodedFilename = encodeURIComponent(req.file.filename);
    const fileUrl = `http://localhost:${PORT}/api/v1/editor/files/${folder}/${encodedFilename}`;

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
}

// Enhanced file serving with folder support
app.get('/api/v1/editor/files/:folder/:filename', async (req, res) => {
  try {
    const { folder } = req.params;
    const filename = decodeURIComponent(req.params.filename);
    console.log(`📁 File request: ${folder}/${filename}`);

    // Validate folder
    if (!uploadFolders[folder]) {
      console.error(`❌ Invalid folder: ${folder}`);
      return res.status(404).json({
        success: false,
        error: 'Invalid folder'
      });
    }

    const filePath = path.join(uploadFolders[folder], filename);
    console.log(`📂 File path: ${filePath}`);

    if (!(await fs.pathExists(filePath))) {
      console.error(`❌ File not found: ${filePath}`);
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const stats = await fs.stat(filePath);

    // Set appropriate headers based on file extension
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    const { type } = getFileTypeAndFolder(filename);

    // Set proper MIME types based on file extension
    if (type === 'video') {
      const videoMimeTypes = {
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'webm': 'video/webm'
      };
      res.setHeader('Content-Type', videoMimeTypes[fileExtension] || 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (type === 'audio') {
      const audioMimeTypes = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac'
      };
      res.setHeader('Content-Type', audioMimeTypes[fileExtension] || 'audio/mpeg');
    } else if (type === 'image') {
      const imageMimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml'
      };
      res.setHeader('Content-Type', imageMimeTypes[fileExtension] || 'image/jpeg');
    }

    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Enhanced CORS headers for file serving
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    console.log(`✅ Serving file: ${filename} (${stats.size} bytes, ${res.getHeader('Content-Type')})`);

    // Handle range requests for video/audio streaming
    if (req.headers.range && (type === 'video' || type === 'audio')) {
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      res.setHeader('Content-Length', chunksize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', (error) => {
        console.error(`❌ Stream error (range): ${error.message}`);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Stream error' });
        }
      });
      stream.pipe(res);
    } else {
      // Regular file serving
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (error) => {
        console.error(`❌ Stream error: ${error.message}`);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Stream error' });
        }
      });
      fileStream.pipe(res);
    }

  } catch (error) {
    console.error('File serving error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve file'
    });
  }
});

// Delete file endpoint
app.delete('/api/v1/editor/files/:folder/:filename', async (req, res) => {
  try {
    const { folder } = req.params;
    const filename = decodeURIComponent(req.params.filename);
    console.log(`🗑️ Delete request: ${folder}/${filename}`);

    // Validate folder
    if (!uploadFolders[folder]) {
      console.error(`❌ Invalid folder for deletion: ${folder}`);
      return res.status(404).json({
        success: false,
        error: 'Invalid folder'
      });
    }

    const filePath = path.join(uploadFolders[folder], filename);
    console.log(`📂 Delete file path: ${filePath}`);

    if (!(await fs.pathExists(filePath))) {
      console.error(`❌ File not found for deletion: ${filePath}`);
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Delete the file
    await fs.remove(filePath);
    console.log(`✅ File deleted successfully: ${filename}`);

    res.json({
      success: true,
      message: 'File deleted successfully',
      fileName: filename,
      folder: folder,
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ File deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file'
    });
  }
});

// Serve rendered videos
app.use('/api/v1/editor/renders', express.static(rendersDir));

// Video rendering endpoint
app.post('/api/v1/editor/render', async (req, res) => {
  try {
    console.log('🎬 Puppeteer render request received');
    
    const projectData = req.body;
    const renderId = uuidv4();
    
    // Validate required fields
    if (!projectData.trackItemIds || !projectData.trackItemDetailsMap) {
      return res.status(400).json({
        error: 'Invalid project data',
        message: 'Missing required fields: trackItemIds, trackItemDetailsMap'
      });
    }

    // Initialize job tracking
    renderJobs.set(renderId, {
      id: renderId,
      status: 'processing',
      progress: 0,
      startTime: Date.now(),
      projectData
    });

    // Start rendering process asynchronously
    const renderer = new VideoRenderer();
    renderer.renderVideo(projectData, renderId, renderJobs)
      .then((outputPath) => {
        console.log(`✅ Render ${renderId} completed: ${outputPath}`);
        renderJobs.set(renderId, {
          ...renderJobs.get(renderId),
          status: 'completed',
          progress: 100,
          output: `http://localhost:${PORT}/api/v1/editor/renders/${path.basename(outputPath)}`,
          completedAt: Date.now()
        });
      })
      .catch((error) => {
        console.error(`❌ Render ${renderId} failed:`, error);
        renderJobs.set(renderId, {
          ...renderJobs.get(renderId),
          status: 'failed',
          error: error.message,
          failedAt: Date.now()
        });
      });

    res.json({
      success: true,
      renderId,
      status: 'processing',
      message: 'Puppeteer render job started successfully'
    });

  } catch (error) {
    console.error('Render endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Render status endpoint
app.get('/api/v1/editor/render/status/:renderId', (req, res) => {
  const { renderId } = req.params;
  const job = renderJobs.get(renderId);

  if (!job) {
    return res.status(404).json({
      error: 'Render job not found',
      renderId
    });
  }

  res.json({
    renderId: job.id,
    status: job.status,
    progress: job.progress,
    output: job.output || null,
    error: job.error || null,
    startTime: job.startTime,
    completedAt: job.completedAt || null,
    failedAt: job.failedAt || null
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Puppeteer Video Renderer running on port ${PORT}`);
  console.log(`📁 Storage directory: ${storageDir}`);
  console.log(`🎥 Ready to render videos using React component frame capture!`);
});
