import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { VideoRenderer } from './src/video-renderer.js';
import { MediaProcessor } from './src/media-processor.js';
import { ProgressTracker } from './src/progress-tracker.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const videoRenderer = new VideoRenderer();
const mediaProcessor = new MediaProcessor();
const progressTracker = new ProgressTracker();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure directories exist
const STORAGE_PATH = path.join(__dirname, 'storage');
const RENDERS_PATH = path.join(STORAGE_PATH, 'renders');
const TEMP_PATH = path.join(STORAGE_PATH, 'temp');
const ASSETS_PATH = path.join(STORAGE_PATH, 'assets');

const ensureDirectories = async () => {
  const dirs = [STORAGE_PATH, RENDERS_PATH, TEMP_PATH, ASSETS_PATH];
  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }
};

await ensureDirectories();

// Health check endpoint
app.get('/api/v1/editor/render/health', async (req, res) => {
  res.json({
    success: true,
    message: 'Custom Video Rendering Service is healthy',
    timestamp: new Date().toISOString(),
    service: 'Custom FFmpeg Renderer',
    version: '1.0.0',
    license: 'MIT - Free for Commercial Use',
    endpoints: {
      render: 'POST /api/v1/editor/render',
      status: 'GET /api/v1/editor/render/status/:renderId',
      download: 'GET /api/v1/editor/files/renders/:filename',
      health: 'GET /api/v1/editor/render/health'
    },
    features: {
      commercial_license: 'FREE',
      ffmpeg_rendering: true,
      supported_formats: ['mp4', 'webm', 'mov', 'avi'],
      max_resolution: '8K',
      effects_support: true,
      animations_support: true,
      text_rendering: true,
      audio_mixing: true,
      multi_layer_composition: true
    },
    system: {
      ffmpeg_available: await videoRenderer.checkFFmpegAvailability(),
      temp_storage: TEMP_PATH,
      render_storage: RENDERS_PATH
    }
  });
});

// Start render job endpoint
app.post('/api/v1/editor/render', async (req, res) => {
  try {
    const projectData = req.body;
    const renderId = uuidv4();
    
    console.log('🎬 Starting Custom Video Render Job:', renderId);
    console.log('📊 Project data keys:', Object.keys(projectData));
    
    // Validate required data
    if (!projectData.trackItemIds || !projectData.trackItemsMap || !projectData.trackItemDetailsMap) {
      return res.status(400).json({
        success: false,
        error: 'Missing required project data: trackItemIds, trackItemsMap, or trackItemDetailsMap'
      });
    }

    // Initialize progress tracking
    progressTracker.initializeJob(renderId, {
      status: 'processing',
      progress: 0,
      startTime: Date.now(),
      projectData
    });

    // Start rendering process asynchronously
    renderVideoCustom(renderId, projectData).catch(error => {
      console.error('❌ Render error:', error);
      progressTracker.updateJob(renderId, {
        status: 'failed',
        error: error.message
      });
    });

    res.json({
      success: true,
      renderId,
      status: 'processing',
      message: 'Custom video render job started successfully',
      estimatedTime: '30-120 seconds'
    });

  } catch (error) {
    console.error('❌ Error starting render job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start render job'
    });
  }
});

// Check render status endpoint
app.get('/api/v1/editor/render/status/:renderId', (req, res) => {
  const { renderId } = req.params;
  const job = progressTracker.getJob(renderId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Render job not found'
    });
  }

  const response = {
    success: true,
    renderId,
    status: job.status,
    progress: job.progress,
    startTime: job.startTime,
    currentStep: job.currentStep || 'Initializing'
  };

  if (job.status === 'completed' && job.outputPath) {
    const filename = path.basename(job.outputPath);
    response.output = `http://localhost:${PORT}/api/v1/editor/files/renders/${filename}`;
    response.fileSize = job.fileSize;
    response.duration = job.duration;
  }

  if (job.status === 'failed' && job.error) {
    response.error = job.error;
  }

  res.json(response);
});

// Serve rendered files
app.get('/api/v1/editor/files/renders/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(RENDERS_PATH, filename);

    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const stats = await fs.stat(filePath);
    
    // Set appropriate headers for video download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle range requests for video streaming
    if (req.headers.range) {
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      res.setHeader('Content-Length', chunksize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Regular file serving
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }

  } catch (error) {
    console.error('❌ File serving error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve file'
    });
  }
});

// Main rendering function
const renderVideoCustom = async (renderId, projectData) => {
  try {
    console.log(`🚀 Starting Custom Render for ${renderId}`);
    
    progressTracker.updateJob(renderId, { 
      progress: 5, 
      currentStep: 'Preparing media files' 
    });

    // Step 1: Process and download media files
    const processedMedia = await mediaProcessor.processProjectMedia(
      projectData, 
      renderId, 
      TEMP_PATH,
      (progress) => progressTracker.updateJob(renderId, { 
        progress: 5 + (progress * 0.2), 
        currentStep: 'Downloading media files' 
      })
    );

    progressTracker.updateJob(renderId, { 
      progress: 25, 
      currentStep: 'Initializing video composition' 
    });

    // Step 2: Render video with FFmpeg
    const outputPath = path.join(RENDERS_PATH, `${renderId}.mp4`);
    
    await videoRenderer.renderVideo({
      projectData,
      processedMedia,
      outputPath,
      tempPath: TEMP_PATH,
      onProgress: (progress, step) => {
        const totalProgress = 25 + (progress * 0.75);
        progressTracker.updateJob(renderId, { 
          progress: Math.round(totalProgress),
          currentStep: step || 'Rendering video'
        });
      }
    });

    // Step 3: Get file info and complete
    const stats = await fs.stat(outputPath);
    const duration = await videoRenderer.getVideoDuration(outputPath);

    progressTracker.updateJob(renderId, {
      status: 'completed',
      progress: 100,
      outputPath,
      fileSize: stats.size,
      duration,
      completedAt: Date.now(),
      currentStep: 'Completed'
    });

    // Cleanup temp files
    await mediaProcessor.cleanupTempFiles(renderId, TEMP_PATH);

    console.log(`✅ Custom render completed: ${outputPath}`);

  } catch (error) {
    console.error('❌ Custom render error:', error);
    progressTracker.updateJob(renderId, {
      status: 'failed',
      error: error.message,
      currentStep: 'Failed'
    });
    
    // Cleanup on error
    await mediaProcessor.cleanupTempFiles(renderId, TEMP_PATH);
    throw error;
  }
};

app.listen(PORT, () => {
  console.log(`🎬 Custom Video Rendering Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/v1/editor/render/health`);
  console.log(`🎥 Render endpoint: http://localhost:${PORT}/api/v1/editor/render`);
  console.log(`✅ 100% FREE for Commercial Use - No License Required!`);
  console.log(`🔧 Using FFmpeg for professional video rendering`);
});
