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

// Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'storage', 'uploads');
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Ensure storage directories exist
const storageDir = path.join(__dirname, 'storage');
const uploadsDir = path.join(storageDir, 'uploads');
const rendersDir = path.join(storageDir, 'renders');
const tempDir = path.join(storageDir, 'temp');

fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(rendersDir);
fs.ensureDirSync(tempDir);

// In-memory job tracking
const renderJobs = new Map();

// Health check endpoint
app.get('/api/v1/editor/render/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'puppeteer-video-renderer',
    timestamp: new Date().toISOString()
  });
});

// File upload endpoint
app.post('/api/v1/editor/upload/file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `http://localhost:${PORT}/api/v1/editor/files/${req.file.filename}`;
    
    res.json({
      success: true,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      url: fileUrl,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve uploaded files
app.use('/api/v1/editor/files', express.static(uploadsDir));

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
