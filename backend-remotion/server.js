import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory storage for render jobs
const renderJobs = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure directories exist
const STORAGE_PATH = path.join(__dirname, 'storage');
const RENDERS_PATH = path.join(STORAGE_PATH, 'renders');
const TEMP_PATH = path.join(STORAGE_PATH, 'temp');

const ensureDirectories = () => {
  [STORAGE_PATH, RENDERS_PATH, TEMP_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirectories();

// Health check endpoint
app.get('/api/v1/editor/remotion/health', (req, res) => {
  res.json({
    success: true,
    message: 'Remotion video export service is healthy',
    timestamp: new Date().toISOString(),
    service: 'Remotion CLI Renderer',
    version: '1.0.0',
    endpoints: {
      render: 'POST /api/v1/editor/remotion/render',
      status: 'GET /api/v1/editor/remotion/render/status/:renderId',
      download: 'GET /api/v1/editor/remotion/files/renders/:filename',
      health: 'GET /api/v1/editor/remotion/health'
    },
    features: {
      free_license: true,
      cli_rendering: true,
      supported_formats: ['mp4', 'webm', 'gif'],
      max_resolution: '4K',
      effects_support: true,
      animations_support: true
    }
  });
});

// Helper function to calculate video duration from track items
const calculateDuration = (trackItemsMap, trackItemIds) => {
  let maxEndTime = 5000; // Default 5 seconds
  
  trackItemIds.forEach(itemId => {
    const item = trackItemsMap[itemId];
    if (item && item.display && item.display.to) {
      maxEndTime = Math.max(maxEndTime, item.display.to);
    }
  });
  
  return Math.max(5000, maxEndTime); // Minimum 5 seconds
};

// Helper function to download media files
const downloadMediaFile = async (url, filename) => {
  const filePath = path.join(TEMP_PATH, filename);
  
  try {
    // Check if it's a local file first
    if (url.startsWith('http://localhost:3000/api/v1/editor/files/')) {
      // Extract the local file path from the existing server
      const urlParts = url.split('/files/');
      if (urlParts.length > 1) {
        const localPath = path.join(__dirname, '..', 'backend-example', 'storage', 'editor', urlParts[1]);
        if (fs.existsSync(localPath)) {
          fs.copyFileSync(localPath, filePath);
          return filePath;
        }
      }
    }

    // Download from external URL
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status}`);
    }

    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error(`Error downloading ${url}:`, error);
    throw error;
  }
};

// Start render job endpoint
app.post('/api/v1/editor/remotion/render', async (req, res) => {
  try {
    const projectData = req.body;
    const renderId = uuidv4();
    
    console.log('Starting Remotion render job:', renderId);
    console.log('Project data keys:', Object.keys(projectData));
    
    // Validate required data
    if (!projectData.trackItemIds || !projectData.trackItemsMap || !projectData.trackItemDetailsMap) {
      return res.status(400).json({
        success: false,
        error: 'Missing required project data: trackItemIds, trackItemsMap, or trackItemDetailsMap'
      });
    }

    // Store job info
    renderJobs.set(renderId, {
      status: 'processing',
      progress: 0,
      startTime: Date.now(),
      projectData
    });

    // Start rendering process asynchronously
    renderVideoWithRemotion(renderId, projectData).catch(error => {
      console.error('Render error:', error);
      renderJobs.set(renderId, {
        ...renderJobs.get(renderId),
        status: 'failed',
        error: error.message
      });
    });

    res.json({
      success: true,
      renderId,
      status: 'processing',
      message: 'Remotion render job started successfully'
    });

  } catch (error) {
    console.error('Error starting render job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start render job'
    });
  }
});

// Check render status endpoint
app.get('/api/v1/editor/remotion/render/status/:renderId', (req, res) => {
  const { renderId } = req.params;
  const job = renderJobs.get(renderId);

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
    startTime: job.startTime
  };

  if (job.status === 'completed' && job.outputPath) {
    const filename = path.basename(job.outputPath);
    response.output = `http://localhost:${PORT}/api/v1/editor/remotion/files/renders/${filename}`;
  }

  if (job.status === 'failed' && job.error) {
    response.error = job.error;
  }

  res.json(response);
});

// Serve rendered files
app.get('/api/v1/editor/remotion/files/renders/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(RENDERS_PATH, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Set appropriate headers for video download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('File serving error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve file'
    });
  }
});

// Handle CORS preflight for temp files
app.options('/temp/:filename', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range, Content-Length');
  res.status(200).end();
});

// Serve temporary files for Remotion rendering
app.get('/temp/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(TEMP_PATH, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Temporary file not found'
      });
    }

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.ogg') contentType = 'audio/ogg';

    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for Remotion
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Range, Content-Length');

    // Handle range requests for video files (important for video streaming)
    if (contentType.startsWith('video/') && req.headers.range) {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunksize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Regular file serving
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Accept-Ranges', 'bytes');

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }

  } catch (error) {
    console.error('Temp file serving error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve temporary file'
    });
  }
});

// Main rendering function using Remotion CLI
const renderVideoWithRemotion = async (renderId, projectData) => {
  try {
    console.log(`Starting Remotion render for ${renderId}`);
    
    // Update job status
    const job = renderJobs.get(renderId);
    renderJobs.set(renderId, { ...job, progress: 10 });

    // Calculate duration and prepare composition props
    const duration = calculateDuration(projectData.trackItemsMap, projectData.trackItemIds);
    const fps = projectData.fps || 30;
    const size = projectData.size || { width: 1080, height: 1920 };
    
    console.log(`Video specs: ${size.width}x${size.height}, ${fps}fps, ${duration}ms`);

    // Download all media files first
    console.log('Downloading media files...');
    const downloadPromises = [];
    
    projectData.trackItemIds.forEach(itemId => {
      const itemDetails = projectData.trackItemDetailsMap[itemId];
      if (itemDetails && itemDetails.details && itemDetails.details.src) {
        const src = itemDetails.details.src;
        const filename = `${renderId}_${itemId}_${path.basename(src)}`;
        downloadPromises.push(
          downloadMediaFile(src, filename).then(localPath => ({
            itemId,
            originalSrc: src,
            localPath
          }))
        );
      }
    });

    const downloadedFiles = await Promise.all(downloadPromises);
    console.log(`Downloaded ${downloadedFiles.length} media files`);

    // Update progress
    renderJobs.set(renderId, { ...job, progress: 30 });

    // Update project data with HTTP URLs for downloaded files
    const updatedProjectData = { ...projectData };
    downloadedFiles.forEach(({ itemId, localPath }) => {
      if (updatedProjectData.trackItemDetailsMap[itemId]) {
        // Convert to HTTP URL that Remotion can access
        const filename = path.basename(localPath);
        updatedProjectData.trackItemDetailsMap[itemId].details.src = `http://localhost:${PORT}/temp/${filename}`;
      }
    });

    // Bundle the Remotion project
    console.log('Bundling Remotion project...');
    const bundleLocation = await bundle({
      entryPoint: path.join(__dirname, 'src', 'Root.jsx'),
      webpackOverride: (config) => config,
    });

    renderJobs.set(renderId, { ...job, progress: 50 });

    // Get composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'VideoEditor',
      inputProps: updatedProjectData,
    });

    if (!composition) {
      throw new Error('Could not find VideoEditor composition');
    }

    // Update composition with dynamic values
    const finalComposition = {
      ...composition,
      durationInFrames: Math.round((duration / 1000) * fps),
      fps,
      width: size.width,
      height: size.height,
    };

    renderJobs.set(renderId, { ...job, progress: 60 });

    // Render the video
    console.log('Rendering video with Remotion...');
    const outputPath = path.join(RENDERS_PATH, `${renderId}.mp4`);
    
    await renderMedia({
      composition: finalComposition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: updatedProjectData,
      timeoutInMilliseconds: 60000, // 60 seconds timeout
      chromiumOptions: {
        disableWebSecurity: true, // Allow cross-origin requests
      },
      onProgress: ({ progress }) => {
        const totalProgress = 60 + (progress * 40); // 60-100%
        renderJobs.set(renderId, {
          ...renderJobs.get(renderId),
          progress: Math.round(totalProgress)
        });
        console.log(`Render progress: ${Math.round(totalProgress)}%`);
      },
    });

    // Clean up temp files
    downloadedFiles.forEach(({ localPath }) => {
      try {
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (error) {
        console.error(`Error cleaning up ${localPath}:`, error);
      }
    });

    // Update job as completed
    renderJobs.set(renderId, {
      ...renderJobs.get(renderId),
      status: 'completed',
      progress: 100,
      outputPath,
      completedAt: Date.now()
    });

    console.log(`Remotion render completed: ${outputPath}`);

  } catch (error) {
    console.error('Remotion render error:', error);
    renderJobs.set(renderId, {
      ...renderJobs.get(renderId),
      status: 'failed',
      error: error.message
    });
    throw error;
  }
};

app.listen(PORT, () => {
  console.log(`🎬 Remotion Video Export Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/v1/editor/remotion/health`);
  console.log(`🎥 Render endpoint: http://localhost:${PORT}/api/v1/editor/remotion/render`);
  console.log(`✅ Remotion CLI rendering enabled - FREE for individuals and companies up to 3 people!`);
});
