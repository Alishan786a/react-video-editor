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

// Helper function to download media files from URLs
const downloadMediaFile = async (url, filename) => {
  const tempDir = path.join(STORAGE_PATH, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, filename);

  try {
    // Check if it's a local file first
    if (url.startsWith('http://localhost:3000/api/v1/editor/files/')) {
      // Extract the local file path
      const urlParts = url.split('/files/');
      if (urlParts.length > 1) {
        const localPath = path.join(STORAGE_PATH, urlParts[1]);
        if (fs.existsSync(localPath)) {
          // Copy local file to temp directory
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

// Enhanced video rendering function
const createVideoFromProject = async (projectData, renderId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const outputPath = path.join(STORAGE_PATH, 'renders', `${renderId}.mp4`);

      // Ensure directories exist
      const rendersDir = path.join(STORAGE_PATH, 'renders');
      const tempDir = path.join(STORAGE_PATH, 'temp');
      if (!fs.existsSync(rendersDir)) {
        fs.mkdirSync(rendersDir, { recursive: true });
      }
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const { size, fps = 30, trackItemIds = [], trackItemDetailsMap = {} } = projectData;
      const width = size?.width || 1080;
      const height = size?.height || 1920;

      console.log(`Processing project with ${trackItemIds.length} track items`);
      console.log('Track item details keys:', Object.keys(trackItemDetailsMap));

      // Calculate total duration from track items
      let totalDuration = 5; // Default 5 seconds
      if (trackItemIds.length > 0) {
        const maxEndTime = trackItemIds.reduce((max, itemId) => {
          const itemDetails = trackItemDetailsMap[itemId];
          if (itemDetails && itemDetails.details) {
            const startTime = itemDetails.details.display?.from || 0;
            const duration = itemDetails.details.display?.duration || 5000;
            return Math.max(max, startTime + duration);
          }
          return max;
        }, 0);
        totalDuration = Math.max(5, Math.ceil(maxEndTime / 1000)); // Convert ms to seconds, minimum 5s
      }

      console.log(`Creating video: ${width}x${height}, ${fps}fps, ${totalDuration}s`);

      // Process track items to get media files
      const mediaItems = [];
      for (const itemId of trackItemIds) {
        const itemDetails = trackItemDetailsMap[itemId];
        if (itemDetails && itemDetails.details) {
          const details = itemDetails.details;
          const display = details.display || {};

          if (details.src) {
            const startTime = (display.from || 0) / 1000; // Convert ms to seconds
            const duration = (display.duration || 5000) / 1000; // Convert ms to seconds

            mediaItems.push({
              id: itemId,
              type: details.type || 'image',
              src: details.src,
              startTime,
              duration,
              width: details.width || width,
              height: details.height || height,
              top: details.top || 0,
              left: details.left || 0,
              opacity: (details.opacity || 100) / 100
            });
          }
        }
      }

      console.log(`Found ${mediaItems.length} media items to process`);

      if (mediaItems.length === 0) {
        // Create a simple colored background if no media items
        console.log('No media items found, creating simple background video');
        ffmpeg()
          .input(`color=black:size=${width}x${height}:duration=${totalDuration}:rate=${fps}`)
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
        return;
      }

      // Download all media files first
      console.log('Downloading media files...');
      const downloadedFiles = [];
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        try {
          const filename = `${renderId}_${item.id}_${i}.${item.src.split('.').pop()}`;
          const localPath = await downloadMediaFile(item.src, filename);
          downloadedFiles.push({
            ...item,
            localPath
          });
          console.log(`Downloaded: ${item.src} -> ${localPath}`);
        } catch (error) {
          console.error(`Failed to download ${item.src}:`, error);
          // Continue with other files
        }
      }

      if (downloadedFiles.length === 0) {
        throw new Error('No media files could be downloaded');
      }

      console.log(`Successfully downloaded ${downloadedFiles.length} media files`);

      // Create video with downloaded media files
      await createVideoWithMedia(downloadedFiles, outputPath, width, height, totalDuration, fps, renderId);

      // Clean up temp files
      downloadedFiles.forEach(file => {
        try {
          if (fs.existsSync(file.localPath)) {
            fs.unlinkSync(file.localPath);
          }
        } catch (error) {
          console.error(`Error cleaning up ${file.localPath}:`, error);
        }
      });

      resolve(outputPath);

    } catch (error) {
      console.error('Error in createVideoFromProject:', error);
      reject(error);
    }
  });
};

// Enhanced function to create video with multiple overlapping media files
const createVideoWithMedia = async (mediaFiles, outputPath, width, height, duration, fps, renderId) => {
  return new Promise((resolve, reject) => {
    console.log('Creating video with multiple media files...');
    console.log(`Video specs: ${width}x${height}, ${fps}fps, ${duration}s`);
    console.log(`Media files: ${mediaFiles.length}`);

    // Log each media file details
    mediaFiles.forEach((file, index) => {
      console.log(`Media ${index}: ${file.type} from ${file.startTime}s to ${file.startTime + file.duration}s`);
      console.log(`  Position: ${file.left}, ${file.top} Size: ${file.width}x${file.height}`);
      console.log(`  Source: ${file.src}`);
    });

    if (mediaFiles.length === 1) {
      // Single media file - use simple approach
      const mediaFile = mediaFiles[0];
      return createSingleMediaVideo(mediaFile, outputPath, width, height, duration, fps, renderId)
        .then(resolve)
        .catch(reject);
    }

    // Multiple media files - use complex overlay approach
    console.log('Creating complex video with overlays...');

    // Start with a black background
    let command = ffmpeg()
      .input(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}`)
      .inputFormat('lavfi');

    // Add all media files as inputs
    mediaFiles.forEach((file, index) => {
      console.log(`Adding input ${index + 1}: ${file.localPath}`);
      command = command.input(file.localPath);
    });

    // Build filter complex for overlaying media
    let filterParts = [];
    let currentOutput = '0:v'; // Start with black background

    mediaFiles.forEach((file, index) => {
      const inputIndex = index + 1; // +1 because 0 is the background
      const outputLabel = `overlay${index}`;

      // Parse position values (remove 'px' if present)
      const left = parseInt(String(file.left).replace('px', '')) || 0;
      const top = parseInt(String(file.top).replace('px', '')) || 0;

      if (file.type === 'image') {
        // For images: loop, scale, and overlay with timing
        const scaleAndLoop = `[${inputIndex}:v]loop=loop=-1:size=1:start=0,scale=${file.width}:${file.height}[scaled${index}]`;
        const overlay = `[${currentOutput}][scaled${index}]overlay=${left}:${top}:enable='between(t,${file.startTime},${file.startTime + file.duration})'[${outputLabel}]`;

        filterParts.push(scaleAndLoop);
        filterParts.push(overlay);
        currentOutput = outputLabel;

      } else if (file.type === 'video') {
        // For videos: scale and overlay with timing
        const scale = `[${inputIndex}:v]scale=${file.width}:${file.height}[scaled${index}]`;
        const overlay = `[${currentOutput}][scaled${index}]overlay=${left}:${top}:enable='between(t,${file.startTime},${file.startTime + file.duration})'[${outputLabel}]`;

        filterParts.push(scale);
        filterParts.push(overlay);
        currentOutput = outputLabel;
      }
    });

    // Join all filter parts
    const filterComplex = filterParts.join(';');
    console.log('Filter complex:', filterComplex);

    // Apply the complex filter
    command = command
      .complexFilter(filterComplex)
      .outputOptions(['-map', `[${currentOutput}]`])
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .outputOptions([
        '-pix_fmt yuv420p',
        '-preset fast',
        '-crf 23'
      ])
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        const percent = Math.round(progress.percent || 0);
        console.log(`Rendering progress: ${percent}%`);

        // Update job progress
        if (renderJobs.has(renderId)) {
          const job = renderJobs.get(renderId);
          job.progress = percent;
          renderJobs.set(renderId, job);
        }
      })
      .on('end', () => {
        console.log('Multi-layer video composition completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg multi-layer composition error:', err);
        reject(err);
      })
      .run();
  });
};

// Helper function for single media file processing
const createSingleMediaVideo = async (mediaFile, outputPath, width, height, duration, fps, renderId) => {
  return new Promise((resolve, reject) => {
    if (mediaFile.type === 'image') {
      console.log(`Creating video from single image: ${mediaFile.localPath}`);

      ffmpeg()
        .input(mediaFile.localPath)
        .inputOptions(['-loop 1', `-t ${duration}`])
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .size(`${width}x${height}`)
        .fps(fps)
        .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 23', '-shortest'])
        .on('start', (commandLine) => console.log('FFmpeg command:', commandLine))
        .on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0);
          console.log(`Rendering progress: ${percent}%`);
          if (renderJobs.has(renderId)) {
            const job = renderJobs.get(renderId);
            job.progress = percent;
            renderJobs.set(renderId, job);
          }
        })
        .on('end', () => {
          console.log('Single image video completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('FFmpeg single image error:', err);
          reject(err);
        })
        .run();

    } else if (mediaFile.type === 'video') {
      console.log(`Processing single video: ${mediaFile.localPath}`);

      ffmpeg()
        .input(mediaFile.localPath)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .size(`${width}x${height}`)
        .fps(fps)
        .duration(duration)
        .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 23'])
        .on('start', (commandLine) => console.log('FFmpeg command:', commandLine))
        .on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0);
          console.log(`Rendering progress: ${percent}%`);
          if (renderJobs.has(renderId)) {
            const job = renderJobs.get(renderId);
            job.progress = percent;
            renderJobs.set(renderId, job);
          }
        })
        .on('end', () => {
          console.log('Single video processing completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('FFmpeg single video error:', err);
          reject(err);
        })
        .run();
    } else {
      reject(new Error(`Unsupported media type: ${mediaFile.type}`));
    }
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
