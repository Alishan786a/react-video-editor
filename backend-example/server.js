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
    // Determine folder based on file type (same logic as presigned URL)
    const originalFileName = req.body.originalFileName || file.originalname;
    const fileExtension = originalFileName.split('.').pop()?.toLowerCase();
    let folder = 'misc';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '')) {
      folder = 'images';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileExtension || '')) {
      folder = 'videos';
    } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(fileExtension || '')) {
      folder = 'audio';
    }
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

      const { size, fps = 30, trackItemIds = [], trackItemDetailsMap = {}, trackItemsMap = {} } = projectData;
      const width = size?.width || 1080;
      const height = size?.height || 1920;

      console.log(`Processing project with ${trackItemIds.length} track items`);
      console.log('Track item details keys:', Object.keys(trackItemDetailsMap));

      // Calculate total duration from track items
      let totalDuration = 5; // Default 5 seconds
      if (trackItemIds.length > 0) {
        const maxEndTime = trackItemIds.reduce((max, itemId) => {
          const trackItem = trackItemsMap[itemId];
          if (trackItem && trackItem.display) {
            const endTime = trackItem.display.to || 5000; // Use 'to' value directly
            return Math.max(max, endTime);
          }
          return max;
        }, 0);
        // Use precise duration calculation - convert ms to seconds with precision
        const preciseDuration = maxEndTime / 1000;
        totalDuration = Math.max(5, preciseDuration); // Minimum 5s, but keep precision
        console.log(`Calculated video duration: ${totalDuration}s (maxEndTime: ${maxEndTime}ms, precise: ${preciseDuration}s)`);
      }

      console.log(`Creating video: ${width}x${height}, ${fps}fps, ${totalDuration}s`);

      // Process track items to get media files and text items
      let mediaItems = [];
      let textItems = [];

      for (const itemId of trackItemIds) {
        const itemDetails = trackItemDetailsMap[itemId];
        const trackItem = trackItemsMap[itemId];

        if (itemDetails && itemDetails.details && trackItem) {
          const details = itemDetails.details;
          const display = trackItem.display || {};
          const itemType = details.type || itemDetails.type || 'unknown';

          // Extract timing from trackItem.display
          const startTime = (display.from || 0) / 1000; // Convert ms to seconds
          const endTime = (display.to || display.from + 5000) / 1000; // Convert ms to seconds
          const duration = endTime - startTime;

          // Extract positioning (handle both string and number formats)
          const top = parseInt(String(details.top || '0').replace('px', '')) || 0;
          const left = parseInt(String(details.left || '0').replace('px', '')) || 0;

          if (itemType === 'text') {
            // Handle text items
            textItems.push({
              id: itemId,
              type: 'text',
              text: details.text || '',
              startTime,
              endTime,
              duration,
              width: details.width || 600,
              height: details.height || 100,
              top,
              left,
              opacity: (details.opacity || 100) / 100,
              fontSize: details.fontSize || 48,
              fontFamily: details.fontFamily || 'Arial',
              color: details.color || '#ffffff',
              backgroundColor: details.backgroundColor || 'transparent',
              textAlign: details.textAlign || 'center',
              fontWeight: details.fontWeight || 'normal',
              fontStyle: details.fontStyle || 'normal',
              textDecoration: details.textDecoration || 'none',
              lineHeight: details.lineHeight || 'normal',
              letterSpacing: details.letterSpacing || 'normal',
              wordSpacing: details.wordSpacing || 'normal',
              textTransform: details.textTransform || 'none',
              textShadow: details.textShadow || 'none',
              borderWidth: details.borderWidth || 0,
              borderColor: details.borderColor || '#000000',
              WebkitTextStrokeWidth: details.WebkitTextStrokeWidth || '0px',
              WebkitTextStrokeColor: details.WebkitTextStrokeColor || '#ffffff'
            });

            console.log(`Parsed text item ${itemId}:`, {
              type: 'text',
              text: details.text?.substring(0, 30) + '...',
              startTime,
              endTime,
              duration,
              position: `${left}, ${top}`,
              size: `${details.width}x${details.height}`,
              fontSize: details.fontSize,
              color: details.color
            });

          } else if (details.src) {
            // Handle media items (images, videos, audio)
            // Handle trim information for audio and video
            let trimStart = 0;
            let trimEnd = null;
            let trimDuration = null;

            if (trackItem.trim && (itemType === 'audio' || itemType === 'video')) {
              trimStart = (trackItem.trim.from || 0) / 1000; // Convert ms to seconds
              trimEnd = (trackItem.trim.to || 0) / 1000; // Convert ms to seconds
              trimDuration = trimEnd - trimStart;
              console.log(`${itemType} trim detected for ${itemId}: ${trimStart}s to ${trimEnd}s (duration: ${trimDuration}s)`);
            }

            mediaItems.push({
              id: itemId,
              type: itemType,
              src: details.src,
              startTime,
              endTime,
              duration,
              trimStart,
              trimEnd,
              trimDuration,
              width: details.width || width,
              height: details.height || height,
              top,
              left,
              opacity: (details.opacity || 100) / 100,
              transform: details.transform || 'none'
            });

            const logData = {
              type: itemType,
              startTime,
              endTime,
              duration,
              position: `${left}, ${top}`,
              size: `${details.width}x${details.height}`,
              src: details.src.substring(0, 50) + '...'
            };

            // Add trim info to log if available
            if (trimStart !== 0 || trimDuration !== null) {
              logData.trim = { start: trimStart, duration: trimDuration, end: trimEnd };
            }

            console.log(`Parsed media item ${itemId}:`, logData);
          }
        }
      }

      console.log(`Found ${mediaItems.length} media items and ${textItems.length} text items to process`);

      if (mediaItems.length === 0 && textItems.length === 0) {
        // Create a simple colored background if no media items or text items
        console.log('No media items or text items found, creating simple background video');
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

      // Sort media items by start time for proper layering
      mediaItems.sort((a, b) => a.startTime - b.startTime);

      if (mediaItems.length > 1) {
        console.log('Multiple media files detected - enabling multi-layer composition');
        console.log('Media timeline:');
        mediaItems.forEach((item, index) => {
          console.log(`  Layer ${index}: ${item.startTime}s-${item.startTime + item.duration}s (${item.type}) at ${item.left},${item.top}`);
        });
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

      if (downloadedFiles.length === 0 && textItems.length === 0) {
        throw new Error('No media files could be downloaded and no text items found');
      }

      console.log(`Successfully downloaded ${downloadedFiles.length} media files`);

      // Create video with downloaded media files and text items
      await createVideoWithMedia(downloadedFiles, textItems, outputPath, width, height, totalDuration, fps, renderId);

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

// Enhanced function to create video with multiple overlapping media files and text items
const createVideoWithMedia = async (mediaFiles, textItems, outputPath, width, height, duration, fps, renderId) => {
  return new Promise(async (resolve, reject) => {
    console.log('Creating video with multiple media files and text items...');
    console.log(`Video specs: ${width}x${height}, ${fps}fps, ${duration}s`);
    console.log(`Media files: ${mediaFiles.length}, Text items: ${textItems.length}`);

    // Log each media file details
    mediaFiles.forEach((file, index) => {
      console.log(`Media ${index}: ${file.type} from ${file.startTime}s to ${file.startTime + file.duration}s`);
      console.log(`  Position: ${file.left}, ${file.top} Size: ${file.width}x${file.height}`);
      console.log(`  Source: ${file.src}`);
    });

    // Handle different combinations of media and text
    if (mediaFiles.length === 0 && textItems.length > 0) {
      // Only text items - create video with text overlays on background
      console.log('Creating text-only video...');
      return createTextOnlyVideo(textItems, outputPath, width, height, duration, fps, renderId)
        .then(resolve)
        .catch(reject);
    }

    if (mediaFiles.length === 1 && textItems.length === 0) {
      // Single media file, no text - use simple approach
      const mediaFile = mediaFiles[0];
      return createSingleMediaVideo(mediaFile, outputPath, width, height, duration, fps, renderId)
        .then(resolve)
        .catch(reject);
    }

    // Multiple media files or combination of media and text - use complex composition
    console.log('Creating multi-layer video with media and text...');

    // Sort by start time (earliest first becomes base layer)
    const sortedFiles = [...mediaFiles].sort((a, b) => a.startTime - b.startTime);

    console.log('Layer composition:');
    sortedFiles.forEach((file, index) => {
      console.log(`  Media Layer ${index}: ${file.type} from ${file.startTime}s to ${file.startTime + file.duration}s`);
      console.log(`    Position: ${file.left}, ${file.top} | Size: ${file.width}x${file.height}`);
      console.log(`    Source: ${file.src.substring(0, 60)}...`);
    });

    textItems.forEach((item, index) => {
      console.log(`  Text Layer ${index}: "${item.text.substring(0, 30)}..." from ${item.startTime}s to ${item.startTime + item.duration}s`);
      console.log(`    Position: ${item.left}, ${item.top} | Size: ${item.width}x${item.height}`);
      console.log(`    Style: ${item.fontSize}px ${item.fontFamily}, ${item.color}`);
    });

    // Create multi-layer video with both media and text
    createMultiLayerVideoWithText(sortedFiles, textItems, outputPath, width, height, duration, fps, renderId)
      .then(resolve)
      .catch((error) => {
        console.error('Multi-layer composition failed:', error);
        console.log('Falling back to simpler approach...');
        // Fallback to single image file if available (skip audio files)
        const imageFile = sortedFiles.find(file => file.type === 'image');
        if (imageFile) {
          console.log('Using single image fallback');
          createSingleMediaVideo(imageFile, outputPath, width, height, duration, fps, renderId)
            .then(resolve)
            .catch(reject);
        } else {
          // Fallback to text-only
          console.log('Using text-only fallback');
          createTextOnlyVideo(textItems, outputPath, width, height, duration, fps, renderId)
            .then(resolve)
            .catch(reject);
        }
      });
  });
};

// Helper function for single media file processing
const createSingleMediaVideo = async (mediaFile, outputPath, width, height, duration, fps, renderId) => {
  return new Promise((resolve, reject) => {
    if (mediaFile.type === 'image') {
      console.log(`Creating video from single image: ${mediaFile.localPath}`);
      console.log(`Image timing: ${mediaFile.startTime}s to ${mediaFile.endTime}s (duration: ${mediaFile.duration}s)`);

      // Check if image has timing constraints
      if (mediaFile.startTime > 0 || mediaFile.endTime < duration) {
        console.log('Applying timing constraints to single image');

        // Use complex filter to apply timing constraints
        const complexFilters = [
          `[0:v]scale=${width}:${height}[img_scaled]`,
          `color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`,
          `[bg][img_scaled]overlay=0:0:enable='between(t,${mediaFile.startTime},${mediaFile.endTime})'[final]`
        ];

        ffmpeg()
          .input(mediaFile.localPath)
          .inputOptions(['-loop 1', `-t ${duration}`])
          .complexFilter(complexFilters)
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .fps(fps)
          .outputOptions([
            '-map', '[final]',
            '-pix_fmt yuv420p',
            '-preset fast',
            '-crf 23'
          ])
          .on('start', (commandLine) => console.log('FFmpeg command with timing:', commandLine))
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
            console.log('Single image video with timing completed');
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('FFmpeg single image with timing error:', err);
            reject(err);
          })
          .run();
      } else {
        // No timing constraints, use simple approach
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
      }

    } else if (mediaFile.type === 'video') {
      console.log(`Processing single video: ${mediaFile.localPath}`);

      let command = ffmpeg().input(mediaFile.localPath);

      // Handle video trim if specified
      if (mediaFile.trimStart !== undefined && mediaFile.trimDuration !== undefined) {
        console.log(`Video trim: extracting ${mediaFile.trimStart}s to ${mediaFile.trimStart + mediaFile.trimDuration}s from original video`);
        command = command.inputOptions([`-ss ${mediaFile.trimStart}`, `-t ${mediaFile.trimDuration}`]);
      }

      // Check if video has timing constraints
      if (mediaFile.startTime > 0 || mediaFile.endTime < duration) {
        console.log('Applying timing constraints to single video');

        // Use complex filter to apply timing constraints
        const complexFilters = [
          `[0:v]scale=${width}:${height}[vid_scaled]`,
          `color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`,
          `[bg][vid_scaled]overlay=0:0:enable='between(t,${mediaFile.startTime},${mediaFile.endTime})'[final]`
        ];

        command
          .complexFilter(complexFilters)
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .fps(fps)
          .outputOptions([
            '-map', '[final]',
            '-pix_fmt yuv420p',
            '-preset fast',
            '-crf 23'
          ]);
      } else {
        // No timing constraints, use simple approach
        command
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .size(`${width}x${height}`)
          .fps(fps)
          .duration(duration)
          .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 23']);
      }

      command
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

// Function to create video with only text items (no media)
const createTextOnlyVideo = async (textItems, outputPath, width, height, duration, fps, renderId) => {
  return new Promise((resolve, reject) => {
    console.log(`Creating text-only video with ${textItems.length} text items...`);

    // Create a black background video
    let command = ffmpeg()
      .input(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}`)
      .inputFormat('lavfi');

    // Build text overlay filters
    let filterComplex = [];
    let currentInput = '[0:v]';

    textItems.forEach((textItem, index) => {
      const outputLabel = index === textItems.length - 1 ? '[final]' : `[text${index}]`;

      // Escape text for FFmpeg
      const escapedText = textItem.text.replace(/'/g, "\\'").replace(/:/g, "\\:");

      // Build enhanced drawtext filter with font file and styling
      let fontFile = '/System/Library/Fonts/Helvetica.ttc'; // Default font

      // Try to use custom font if provided (for now, fallback to system font)
      if (textItem.fontFamily && textItem.fontFamily.includes('Roboto')) {
        // For Roboto, we'll use Helvetica as fallback since it's similar
        fontFile = '/System/Library/Fonts/Helvetica.ttc';
      }

      // Build comprehensive drawtext filter
      let drawTextOptions = [
        `text='${escapedText}'`,
        `fontfile=${fontFile}`,
        `fontsize=${textItem.fontSize}`,
        `fontcolor=${textItem.color}`,
        `x=${textItem.left}`,
        `y=${textItem.top}`,
        `enable='between(t,${textItem.startTime},${textItem.endTime})'`
      ];

      // Add text alignment if specified
      if (textItem.textAlign === 'center') {
        // For center alignment, adjust x position to center the text
        const adjustedX = textItem.left - (textItem.width || 600) / 2;
        drawTextOptions[4] = `x=${adjustedX}`;
      }

      // Add opacity/alpha if specified
      if (textItem.opacity && textItem.opacity < 1) {
        drawTextOptions.push(`alpha=${textItem.opacity}`);
      }

      // Add text stroke (outline) if specified
      if (textItem.WebkitTextStrokeWidth && textItem.WebkitTextStrokeWidth !== '0px') {
        const strokeWidth = parseInt(textItem.WebkitTextStrokeWidth.replace('px', '')) || 0;
        if (strokeWidth > 0) {
          drawTextOptions.push(`borderw=${strokeWidth}`);
          drawTextOptions.push(`bordercolor=${textItem.WebkitTextStrokeColor || '#ffffff'}`);
        }
      }

      // Add text shadow if specified (FFmpeg supports shadowx, shadowy, shadowcolor)
      if (textItem.textShadow && textItem.textShadow !== 'none') {
        // Parse text shadow: "2px 2px 4px rgba(0,0,0,0.5)" or simple values
        drawTextOptions.push(`shadowx=2`);
        drawTextOptions.push(`shadowy=2`);
        drawTextOptions.push(`shadowcolor=black@0.5`);
      }

      // Add box background if backgroundColor is specified
      if (textItem.backgroundColor && textItem.backgroundColor !== 'transparent') {
        drawTextOptions.push(`box=1`);
        drawTextOptions.push(`boxcolor=${textItem.backgroundColor}`);
        drawTextOptions.push(`boxborderw=5`);
      }

      const textFilter = `${currentInput}drawtext=${drawTextOptions.join(':')}${outputLabel}`;

      filterComplex.push(textFilter);
      currentInput = `[text${index}]`;
    });

    if (filterComplex.length > 0) {
      command = command.complexFilter(filterComplex);
      command = command.map('[final]');
    }

    command
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .on('start', (commandLine) => {
        console.log('FFmpeg command for text-only video:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Text-only video progress: ${Math.round(progress.percent || 0)}%`);
        if (renderJobs.has(renderId)) {
          const job = renderJobs.get(renderId);
          job.progress = Math.round(progress.percent || 0);
          renderJobs.set(renderId, job);
        }
      })
      .on('end', () => {
        console.log('Text-only video rendering completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error in text-only video:', err);
        reject(err);
      })
      .run();
  });
};

// Function to create video with both media files and text overlays
const createMultiLayerVideoWithText = async (mediaFiles, textItems, outputPath, width, height, duration, fps, renderId) => {
  return new Promise(async (resolve, reject) => {
    console.log(`Creating multi-layer video with ${mediaFiles.length} media files and ${textItems.length} text items...`);

    try {
      // Create video with media files and integrate text overlays directly
      if (mediaFiles.length > 0) {
        // Use multi-layer video creation with integrated text support
        await createMultiLayerVideoWithTextIntegrated(mediaFiles, textItems, outputPath, width, height, duration, fps, renderId);
        resolve(outputPath);
      } else {
        // No media files, create text-only video
        await createTextOnlyVideo(textItems, outputPath, width, height, duration, fps, renderId);
        resolve(outputPath);
      }
    } catch (error) {
      console.error('Error in createMultiLayerVideoWithText:', error);
      reject(error);
    }
  });
};

// Function to add text overlays to an existing video file
const addTextOverlaysToVideo = async (videoPath, textItems, width, height, duration, renderId) => {
  return new Promise((resolve, reject) => {
    console.log(`Adding ${textItems.length} text overlays to existing video...`);

    // Create a temporary file for the result
    const tempDir = path.join(STORAGE_PATH, 'temp');
    const tempPath = path.join(tempDir, `${renderId}_with_text.mp4`);

    let command = ffmpeg()
      .input(videoPath);

    // Build video filter string for text overlays using outputOptions
    if (textItems.length > 0) {
      let filterString = '';

      textItems.forEach((textItem, index) => {
        // Escape text for FFmpeg
        const escapedText = textItem.text.replace(/'/g, "\\'");

        // Build drawtext filter with proper syntax
        if (index > 0) filterString += ',';
        filterString += `drawtext=text='${escapedText}':fontsize=${textItem.fontSize}:fontcolor=${textItem.color}:x=${textItem.left}:y=${textItem.top}:enable='between(t,${textItem.startTime},${textItem.endTime})'`;
      });

      // Apply video filter using outputOptions for more control
      command = command.outputOptions(['-vf', filterString]);
    }

    command
      .output(tempPath)
      .videoCodec('libx264')
      .audioCodec('copy') // Copy existing audio
      .format('mp4')
      .on('start', (commandLine) => {
        console.log('FFmpeg command for text overlays:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Text overlay progress: ${Math.round(progress.percent || 0)}%`);
        if (renderJobs.has(renderId)) {
          const job = renderJobs.get(renderId);
          job.progress = Math.round(progress.percent || 0);
          renderJobs.set(renderId, job);
        }
      })
      .on('end', () => {
        console.log('Text overlay rendering completed');
        // Replace original with text-overlaid version
        fs.renameSync(tempPath, videoPath);
        resolve(videoPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error in text overlay:', err);
        reject(err);
      })
      .run();
  });
};

// Enhanced multi-layer video creation with audio and text support
const createMultiLayerVideoWithTextIntegrated = async (mediaFiles, textItems, outputPath, width, height, duration, fps, renderId) => {
  console.log(`Creating multi-layer video with ${mediaFiles.length} layers and ${textItems.length} text items...`);

  // Separate media types
  const imageFiles = mediaFiles.filter(file => file.type === 'image');
  const videoFiles = mediaFiles.filter(file => file.type === 'video');
  const audioFiles = mediaFiles.filter(file => file.type === 'audio');

  console.log(`Found ${imageFiles.length} image files, ${videoFiles.length} video files, ${audioFiles.length} audio files, and ${textItems.length} text items`);

  if (imageFiles.length === 0 && videoFiles.length === 0) {
    throw new Error('No image or video files found for composition');
  }

  // Combine image and video files as visual layers
  const visualFiles = [...imageFiles, ...videoFiles];

  if (visualFiles.length === 1 && audioFiles.length === 0 && textItems.length === 0) {
    // Single visual media, no audio, no text - use simple approach
    console.log('Single visual media, no audio, no text - using simple approach');
    return createSingleMediaVideo(visualFiles[0], outputPath, width, height, duration, fps, renderId);
  }

  console.log(`Processing ${imageFiles.length} image layers, ${videoFiles.length} video layers, ${audioFiles.length} audio tracks, and ${textItems.length} text overlays...`);

  // Multi-layer composition with images, videos, audio, and text
  console.log('Multi-layer composition with ALL images, videos, audio, and text:');
  imageFiles.forEach((layer, index) => {
    console.log(`  Image Layer ${index + 1}: ${layer.src} at ${layer.left},${layer.top} (${layer.startTime}s-${layer.endTime}s)`);
  });
  videoFiles.forEach((layer, index) => {
    console.log(`  Video Layer ${index + 1}: ${layer.src} at ${layer.left},${layer.top} (${layer.startTime}s-${layer.endTime}s)`);
  });
  audioFiles.forEach((audio, index) => {
    console.log(`  Audio ${index + 1}: ${audio.src} (${audio.startTime}s-${audio.endTime}s)`);
    if (audio.trimStart !== 0 || audio.trimDuration !== null) {
      console.log(`    Trim: ${audio.trimStart}s to ${audio.trimEnd}s (duration: ${audio.trimDuration}s)`);
    }
  });
  textItems.forEach((text, index) => {
    console.log(`  Text ${index + 1}: "${text.text}" at ${text.left},${text.top} (${text.startTime}s-${text.endTime}s)`);
  });

  return new Promise((resolve, reject) => {
    console.log('Creating dynamic multi-layer composition with audio and text...');
    console.log(`Background: black ${width}x${height}`);
    imageFiles.forEach((layer, index) => {
      console.log(`Layer ${index + 1}: ${layer.width}x${layer.height} at ${layer.left},${layer.top}`);
    });
    audioFiles.forEach((audio, index) => {
      console.log(`Audio ${index + 1}: ${audio.localPath}`);
    });
    textItems.forEach((text, index) => {
      console.log(`Text ${index + 1}: "${text.text}" ${text.fontSize}px at ${text.left},${text.top}`);
    });

    // Build FFmpeg command with all inputs
    let command = ffmpeg();

    // Add image inputs
    imageFiles.forEach((layer) => {
      command = command
        .input(layer.localPath)
        .inputOptions(['-loop 1', `-t ${duration}`]);
    });

    // Add video inputs
    videoFiles.forEach((layer) => {
      command = command
        .input(layer.localPath);
    });

    // Add audio inputs
    audioFiles.forEach((audio) => {
      command = command.input(audio.localPath);
    });

    // Build complex filter for video, audio, and text with proper timing constraints
    const complexFilters = [];

    // Scale all images
    imageFiles.forEach((layer, index) => {
      complexFilters.push(`[${index}:v]scale=${layer.width}:${layer.height}[img${index + 1}]`);
    });

    // Scale all videos (with trim handling if needed)
    videoFiles.forEach((layer, index) => {
      const inputIndex = imageFiles.length + index;
      if (layer.trimStart !== undefined && layer.trimDuration !== undefined) {
        // Apply trim and scale for video
        complexFilters.push(`[${inputIndex}:v]trim=start=${layer.trimStart}:duration=${layer.trimDuration},setpts=PTS-STARTPTS,scale=${layer.width}:${layer.height}[vid${index + 1}]`);
      } else {
        complexFilters.push(`[${inputIndex}:v]scale=${layer.width}:${layer.height}[vid${index + 1}]`);
      }
    });

    // Create background
    complexFilters.push(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`);

    // Build overlay chain - each visual layer (image/video) overlays on the previous result
    let currentLayer = 'bg';
    let layerIndex = 0;

    // Add image layers
    imageFiles.forEach((layer, index) => {
      const left = parseInt(String(layer.left).replace('px', '')) || 0;
      const top = parseInt(String(layer.top).replace('px', '')) || 0;
      const nextLayer = layerIndex === visualFiles.length - 1 ? 'video_final' : `bg_with_layer${layerIndex + 1}`;

      complexFilters.push(
        `[${currentLayer}][img${index + 1}]overlay=${left}:${top}:enable='between(t,${layer.startTime},${layer.endTime})'[${nextLayer}]`
      );

      currentLayer = nextLayer;
      layerIndex++;
    });

    // Add video layers
    videoFiles.forEach((layer, index) => {
      const left = parseInt(String(layer.left).replace('px', '')) || 0;
      const top = parseInt(String(layer.top).replace('px', '')) || 0;
      const nextLayer = layerIndex === visualFiles.length - 1 ? 'video_final' : `bg_with_layer${layerIndex + 1}`;

      complexFilters.push(
        `[${currentLayer}][vid${index + 1}]overlay=${left}:${top}:enable='between(t,${layer.startTime},${layer.endTime})'[${nextLayer}]`
      );

      currentLayer = nextLayer;
      layerIndex++;
    });

    // Add text overlays to the video
    if (textItems.length > 0) {
      let textCurrentLayer = 'video_final';
      textItems.forEach((textItem, index) => {
        const outputLabel = index === textItems.length - 1 ? 'final' : `text${index}`;

        // Escape text for FFmpeg
        const escapedText = textItem.text.replace(/'/g, "\\'");

        // Build enhanced drawtext filter with more styling options
        let fontFile = '/System/Library/Fonts/Helvetica.ttc'; // Default font

        // Try to use custom font if provided (for now, fallback to system font)
        if (textItem.fontFamily && textItem.fontFamily.includes('Roboto')) {
          // For Roboto, we'll use Helvetica as fallback since it's similar
          fontFile = '/System/Library/Fonts/Helvetica.ttc';
        }

        // Build comprehensive drawtext filter
        let drawTextOptions = [
          `text='${escapedText}'`,
          `fontfile=${fontFile}`,
          `fontsize=${textItem.fontSize}`,
          `fontcolor=${textItem.color}`,
          `x=${textItem.left}`,
          `y=${textItem.top}`,
          `enable='between(t,${textItem.startTime},${textItem.endTime})'`
        ];

        // Add text alignment if specified
        if (textItem.textAlign === 'center') {
          // For center alignment, adjust x position to center the text
          const adjustedX = textItem.left - (textItem.width || 600) / 2;
          drawTextOptions[4] = `x=${adjustedX}`;
        }

        // Add opacity/alpha if specified
        if (textItem.opacity && textItem.opacity < 1) {
          drawTextOptions.push(`alpha=${textItem.opacity}`);
        }

        // Add text stroke (outline) if specified
        if (textItem.WebkitTextStrokeWidth && textItem.WebkitTextStrokeWidth !== '0px') {
          const strokeWidth = parseInt(textItem.WebkitTextStrokeWidth.replace('px', '')) || 0;
          if (strokeWidth > 0) {
            drawTextOptions.push(`borderw=${strokeWidth}`);
            drawTextOptions.push(`bordercolor=${textItem.WebkitTextStrokeColor || '#ffffff'}`);
          }
        }

        // Add text shadow if specified (FFmpeg supports shadowx, shadowy, shadowcolor)
        if (textItem.textShadow && textItem.textShadow !== 'none') {
          // Parse text shadow: "2px 2px 4px rgba(0,0,0,0.5)" or simple values
          drawTextOptions.push(`shadowx=2`);
          drawTextOptions.push(`shadowy=2`);
          drawTextOptions.push(`shadowcolor=black@0.5`);
        }

        // Add box background if backgroundColor is specified
        if (textItem.backgroundColor && textItem.backgroundColor !== 'transparent') {
          drawTextOptions.push(`box=1`);
          drawTextOptions.push(`boxcolor=${textItem.backgroundColor}`);
          drawTextOptions.push(`boxborderw=5`);
        }

        const textFilter = `[${textCurrentLayer}]drawtext=${drawTextOptions.join(':')}[${outputLabel}]`;

        complexFilters.push(textFilter);
        textCurrentLayer = outputLabel;
      });
    } else {
      // No text items, rename video_final to final
      complexFilters.push(`[video_final]copy[final]`);
    }

    // Process audio tracks if any
    if (audioFiles.length > 0) {
      console.log(`Processing ${audioFiles.length} audio tracks...`);
      audioFiles.forEach((audioFile, index) => {
        const audioInputIndex = imageFiles.length + videoFiles.length + index; // Audio inputs come after image and video inputs
        console.log(`Audio ${index + 1} timing: ${audioFile.startTime}s to ${audioFile.endTime}s (duration: ${audioFile.duration}s)`);

        if (audioFile.trimStart !== undefined && audioFile.trimDuration !== undefined) {
          console.log(`Audio ${index + 1} trim: extracting ${audioFile.trimStart}s to ${audioFile.trimStart + audioFile.trimDuration}s from original audio`);
          // First trim the audio to extract the desired segment, then position it in timeline
          const audioFilter = `[${audioInputIndex}:a]atrim=start=${audioFile.trimStart}:duration=${audioFile.trimDuration},asetpts=PTS-STARTPTS,adelay=${audioFile.startTime * 1000}|${audioFile.startTime * 1000}[audio${index + 1}_timed]`;
          complexFilters.push(audioFilter);
        } else {
          // No trim info, use original logic
          const audioFilter = `[${audioInputIndex}:a]atrim=start=${audioFile.startTime}:duration=${audioFile.duration},asetpts=PTS-STARTPTS,adelay=${audioFile.startTime * 1000}|${audioFile.startTime * 1000}[audio${index + 1}_timed]`;
          complexFilters.push(audioFilter);
        }
      });

      // Mix multiple audio tracks if needed
      if (audioFiles.length > 1) {
        const audioInputs = audioFiles.map((_, index) => `[audio${index + 1}_timed]`).join('');
        const mixFilter = `${audioInputs}amix=inputs=${audioFiles.length}:duration=longest[audio_mixed]`;
        complexFilters.push(mixFilter);
        console.log(`Mixing ${audioFiles.length} audio tracks together`);
      }
    }

    command = command.complexFilter(complexFilters);

    // Map video and audio outputs
    if (audioFiles.length > 0) {
      if (audioFiles.length === 1) {
        command = command.map('[final]').map('[audio1_timed]');
        console.log('Mapping audio output: [audio1_timed]');
      } else {
        command = command.map('[final]').map('[audio_mixed]');
        console.log('Mapping audio output: [audio_mixed]');
      }
    } else {
      command = command.map('[final]');
      console.log('No audio to map');
    }

    command
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .outputOptions(['-pix_fmt yuv420p', '-preset fast', '-crf 23'])
      .on('start', (commandLine) => {
        console.log('Multi-layer with audio and text FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Multi-layer with audio and text progress: ${Math.round(progress.percent || 0)}%`);
        if (renderJobs.has(renderId)) {
          const job = renderJobs.get(renderId);
          job.progress = Math.round(progress.percent || 0);
          renderJobs.set(renderId, job);
        }
      })
      .on('end', () => {
        console.log('Multi-layer with audio and text composition completed successfully!');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error in multi-layer with text composition:', err);
        reject(err);
      })
      .run();
  });
};

// Enhanced multi-layer video creation with audio support
const createMultiLayerVideo = async (mediaFiles, outputPath, width, height, duration, fps, renderId) => {
  console.log(`Creating multi-layer video with ${mediaFiles.length} layers...`);

  // Separate media types
  const imageFiles = mediaFiles.filter(file => file.type === 'image');
  const videoFiles = mediaFiles.filter(file => file.type === 'video');
  const audioFiles = mediaFiles.filter(file => file.type === 'audio');

  console.log(`Found ${imageFiles.length} image files, ${videoFiles.length} video files, and ${audioFiles.length} audio files`);

  if (imageFiles.length === 0 && videoFiles.length === 0) {
    throw new Error('No image or video files found for composition');
  }

  // Combine image and video files as visual layers
  const visualFiles = [...imageFiles, ...videoFiles];

  if (visualFiles.length === 1 && audioFiles.length === 0) {
    // Single visual media, no audio - use simple approach
    console.log('Single visual media, no audio - using simple approach');
    return createSingleMediaVideo(visualFiles[0], outputPath, width, height, duration, fps, renderId);
  }

  console.log(`Processing ${imageFiles.length} image layers, ${videoFiles.length} video layers, and ${audioFiles.length} audio tracks...`);

  // Handle different scenarios
  if (visualFiles.length === 1 && audioFiles.length === 1) {
    // Single visual media + single audio
    return createVideoWithAudio(visualFiles[0], audioFiles[0], outputPath, width, height, duration, fps, renderId);
  } else if (visualFiles.length === 1 && audioFiles.length > 1) {
    // Single visual media + multiple audio - use multi-layer approach
    console.log(`Single visual media with ${audioFiles.length} audio tracks - using multi-layer composition`);
    // Fall through to multi-layer logic
  } else if (visualFiles.length >= 2 || (visualFiles.length === 1 && audioFiles.length > 1)) {
    // Multiple visual media (with or without audio) - Handle ALL images, videos, and audio tracks
    console.log('Multi-layer composition with ALL images, videos, and audio:');
    imageFiles.forEach((layer, index) => {
      console.log(`  Image Layer ${index + 1}: ${layer.src} at ${layer.left},${layer.top} (${layer.startTime}s-${layer.endTime}s)`);
    });
    videoFiles.forEach((layer, index) => {
      console.log(`  Video Layer ${index + 1}: ${layer.src} at ${layer.left},${layer.top} (${layer.startTime}s-${layer.endTime}s)`);
    });
    audioFiles.forEach((audio, index) => {
      console.log(`  Audio ${index + 1}: ${audio.src} (${audio.startTime}s-${audio.endTime}s)`);
      if (audio.trimStart !== 0 || audio.trimDuration !== null) {
        console.log(`    Trim: ${audio.trimStart}s to ${audio.trimEnd}s (duration: ${audio.trimDuration}s)`);
      }
    });

    return new Promise((resolve, reject) => {
      console.log('Creating dynamic multi-layer composition with audio...');
      console.log(`Background: black ${width}x${height}`);

      // Build FFmpeg command with all visual and audio inputs
      let command = ffmpeg();

      // Add all image inputs
      imageFiles.forEach((layer, index) => {
        command = command
          .input(layer.localPath)
          .inputOptions(['-loop 1', `-t ${duration}`]);

        const left = parseInt(String(layer.left).replace('px', '')) || 0;
        const top = parseInt(String(layer.top).replace('px', '')) || 0;
        console.log(`Image Layer ${index + 1}: ${layer.width}x${layer.height} at ${left},${top}`);
      });

      // Add all video inputs
      videoFiles.forEach((layer, index) => {
        command = command.input(layer.localPath);

        const left = parseInt(String(layer.left).replace('px', '')) || 0;
        const top = parseInt(String(layer.top).replace('px', '')) || 0;
        console.log(`Video Layer ${index + 1}: ${layer.width}x${layer.height} at ${left},${top}`);
      });

      // Add all audio inputs
      audioFiles.forEach((audio, index) => {
        command = command.input(audio.localPath);
        console.log(`Audio ${index + 1}: ${audio.localPath}`);
      });

      // Build complex filter for video and audio with proper timing constraints
      const complexFilters = [];

      // Scale all images
      imageFiles.forEach((layer, index) => {
        complexFilters.push(`[${index}:v]scale=${layer.width}:${layer.height}[img${index + 1}]`);
      });

      // Scale all videos (with trim handling if needed)
      videoFiles.forEach((layer, index) => {
        const inputIndex = imageFiles.length + index;
        if (layer.trimStart !== undefined && layer.trimDuration !== undefined) {
          // Apply trim and scale for video
          complexFilters.push(`[${inputIndex}:v]trim=start=${layer.trimStart}:duration=${layer.trimDuration},setpts=PTS-STARTPTS,scale=${layer.width}:${layer.height}[vid${index + 1}]`);
        } else {
          complexFilters.push(`[${inputIndex}:v]scale=${layer.width}:${layer.height}[vid${index + 1}]`);
        }
      });

      // Create background
      complexFilters.push(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`);

      // Build overlay chain - each visual layer (image/video) overlays on the previous result
      let currentLayer = 'bg';
      let layerIndex = 0;

      // Add image layers
      imageFiles.forEach((layer, index) => {
        const left = parseInt(String(layer.left).replace('px', '')) || 0;
        const top = parseInt(String(layer.top).replace('px', '')) || 0;
        const nextLayer = layerIndex === visualFiles.length - 1 ? 'final' : `bg_with_layer${layerIndex + 1}`;

        complexFilters.push(
          `[${currentLayer}][img${index + 1}]overlay=${left}:${top}:enable='between(t,${layer.startTime},${layer.endTime})'[${nextLayer}]`
        );

        currentLayer = nextLayer;
        layerIndex++;
      });

      // Add video layers
      videoFiles.forEach((layer, index) => {
        const left = parseInt(String(layer.left).replace('px', '')) || 0;
        const top = parseInt(String(layer.top).replace('px', '')) || 0;
        const nextLayer = layerIndex === visualFiles.length - 1 ? 'final' : `bg_with_layer${layerIndex + 1}`;

        complexFilters.push(
          `[${currentLayer}][vid${index + 1}]overlay=${left}:${top}:enable='between(t,${layer.startTime},${layer.endTime})'[${nextLayer}]`
        );

        currentLayer = nextLayer;
        layerIndex++;
      });

      // Add audio timing filters for all audio tracks
      if (audioFiles.length > 0) {
        console.log(`Processing ${audioFiles.length} audio tracks...`);

        audioFiles.forEach((audioFile, index) => {
          console.log(`Audio ${index + 1} timing: ${audioFile.startTime}s to ${audioFile.endTime}s (duration: ${audioFile.duration}s)`);

          // Build audio filter based on whether trim information is available
          const audioInputIndex = imageFiles.length + videoFiles.length + index; // Audio inputs come after all image and video inputs

          if (audioFile.trimStart !== undefined && audioFile.trimDuration !== undefined) {
            console.log(`Audio ${index + 1} trim: extracting ${audioFile.trimStart}s to ${audioFile.trimStart + audioFile.trimDuration}s from original audio`);
            // First trim the audio to extract the desired segment, then position it in timeline
            const audioFilter = `[${audioInputIndex}:a]atrim=start=${audioFile.trimStart}:duration=${audioFile.trimDuration},asetpts=PTS-STARTPTS,adelay=${audioFile.startTime * 1000}|${audioFile.startTime * 1000}[audio${index + 1}_timed]`;
            complexFilters.push(audioFilter);
          } else {
            // No trim info, use original logic
            const audioFilter = `[${audioInputIndex}:a]atrim=start=${audioFile.startTime}:duration=${audioFile.duration},asetpts=PTS-STARTPTS,adelay=${audioFile.startTime * 1000}|${audioFile.startTime * 1000}[audio${index + 1}_timed]`;
            complexFilters.push(audioFilter);
          }
        });

        // Mix all audio tracks together if there are multiple
        if (audioFiles.length > 1) {
          const audioInputs = audioFiles.map((_, index) => `[audio${index + 1}_timed]`).join('');
          const mixFilter = `${audioInputs}amix=inputs=${audioFiles.length}:duration=longest[audio_mixed]`;
          complexFilters.push(mixFilter);
          console.log(`Mixing ${audioFiles.length} audio tracks together`);
        }
      }

      command = command.complexFilter(complexFilters);

      // Map video and audio outputs
      if (audioFiles.length > 0) {
        const audioOutput = audioFiles.length > 1 ? '[audio_mixed]' : '[audio1_timed]';
        command = command
          .outputOptions(['-map', '[final]'])
          .outputOptions(['-map', audioOutput]) // Map mixed or single audio
          .audioCodec('aac');
        console.log(`Mapping audio output: ${audioOutput}`);
      } else {
        command = command
          .outputOptions(['-map', '[final]'])
          .audioCodec('aac'); // Generate silent audio
      }

      command
        .output(outputPath)
        .videoCodec('libx264')
        .format('mp4')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-preset fast',
          '-crf 23'
        ])
        .on('start', (commandLine) => {
          console.log('Multi-layer with audio FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0);
          console.log(`Multi-layer with audio progress: ${percent}%`);

          if (renderJobs.has(renderId)) {
            const job = renderJobs.get(renderId);
            job.progress = percent;
            renderJobs.set(renderId, job);
          }
        })
        .on('end', () => {
          console.log('Multi-layer with audio composition completed successfully!');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Multi-layer with audio FFmpeg error:', err);
          console.error('Error details:', err.message);
          reject(err);
        })
        .run();
    });
  } else {
    throw new Error('Unsupported media combination');
  }
};

// Function to create video with single image and audio
const createVideoWithAudio = async (imageFile, audioFile, outputPath, width, height, duration, fps, renderId) => {
  return new Promise((resolve, reject) => {
    console.log(`Creating video with image and audio...`);
    console.log(`Image: ${imageFile.localPath} (${imageFile.startTime}s-${imageFile.endTime}s)`);
    console.log(`Audio: ${audioFile.localPath} (${audioFile.startTime}s-${audioFile.endTime}s)`);

    // Build complex filter for image and audio timing
    const complexFilters = [
      // Scale image to fit canvas
      `[0:v]scale=${width}:${height}[img_scaled]`
    ];

    // Build audio filter based on whether trim information is available
    if (audioFile.trimStart !== undefined && audioFile.trimDuration !== undefined) {
      console.log(`Audio trim: extracting ${audioFile.trimStart}s to ${audioFile.trimStart + audioFile.trimDuration}s from original audio`);
      // First trim the audio to extract the desired segment, then position it in timeline
      complexFilters.push(`[1:a]atrim=start=${audioFile.trimStart}:duration=${audioFile.trimDuration},asetpts=PTS-STARTPTS,adelay=${audioFile.startTime * 1000}|${audioFile.startTime * 1000}[audio_timed]`);
    } else {
      // No trim info, use original logic
      complexFilters.push(`[1:a]atrim=start=${audioFile.startTime}:duration=${audioFile.duration},asetpts=PTS-STARTPTS,adelay=${audioFile.startTime * 1000}|${audioFile.startTime * 1000}[audio_timed]`);
    }

    ffmpeg()
      .input(imageFile.localPath)
      .inputOptions(['-loop 1', `-t ${duration}`])
      .input(audioFile.localPath)
      .complexFilter(complexFilters)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .fps(fps)
      .outputOptions([
        '-map', '[img_scaled]',
        '-map', '[audio_timed]',
        '-pix_fmt yuv420p',
        '-preset fast',
        '-crf 23'
      ])
      .on('start', (commandLine) => {
        console.log('Image + Audio FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        const percent = Math.round(progress.percent || 0);
        console.log(`Image + Audio progress: ${percent}%`);

        if (renderJobs.has(renderId)) {
          const job = renderJobs.get(renderId);
          job.progress = percent;
          renderJobs.set(renderId, job);
        }
      })
      .on('end', () => {
        console.log('Image + Audio composition completed successfully!');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Image + Audio FFmpeg error:', err);
        console.error('Error details:', err.message);
        reject(err);
      })
      .run();
  });
};

// Enhanced video rendering endpoint with improved payload support
app.post('/api/v1/editor/render', async (req, res) => {
  try {
    // Support both old format (direct project data) and new format (design + options)
    let projectData, options;

    if (req.body.design && req.body.options) {
      // New format from react-video-editor-1
      projectData = req.body.design;
      options = req.body.options;
      console.log('New format detected - design + options structure');
    } else {
      // Old format (direct project data)
      projectData = req.body;
      options = {
        fps: projectData.fps || 30,
        size: projectData.size || { width: 1080, height: 1920 },
        format: 'mp4'
      };
      console.log('Legacy format detected - direct project data');
    }

    const renderId = uuidv4();

    console.log('Enhanced render request received:', {
      renderId,
      projectKeys: Object.keys(projectData),
      options: options,
      trackItemCount: projectData.trackItemIds?.length || 0,
      tracksCount: projectData.tracks?.length || 0
    });

    // Store job in memory with enhanced structure
    renderJobs.set(renderId, {
      id: renderId,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      projectData,
      options,
      format: options.format || 'mp4'
    });

    // Return response compatible with both formats
    res.json({
      success: true,
      renderId: renderId,
      status: 'processing',
      message: 'Render job started successfully',
      video: {
        id: renderId,
        status: 'PENDING',
        progress: 0
      },
      options: options
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

// Enhanced render status endpoint with detailed information
app.get('/api/v1/editor/render/status/:renderId', async (req, res) => {
  try {
    const { renderId } = req.params;

    if (!renderJobs.has(renderId)) {
      return res.status(404).json({
        error: 'Render job not found',
        renderId,
        video: {
          id: renderId,
          status: 'NOT_FOUND',
          progress: 0
        }
      });
    }

    const job = renderJobs.get(renderId);

    // Map internal status to external status
    const statusMap = {
      'processing': 'PENDING',
      'completed': 'COMPLETED',
      'failed': 'FAILED'
    };

    const response = {
      success: true,
      render: {
        renderId: job.id,
        projectId: job.projectData?.id,
        status: job.status,
        progress: job.progress,
        output: job.output,
        createdAt: job.createdAt,
        updatedAt: job.completedAt || job.failedAt || job.createdAt,
        error: job.error,
        format: job.format || 'mp4',
        options: job.options
      },
      // Additional format for compatibility
      video: {
        id: job.id,
        status: statusMap[job.status] || 'UNKNOWN',
        progress: job.progress,
        url: job.output,
        downloadUrl: job.output,
        createdAt: job.createdAt?.toISOString(),
        updatedAt: (job.completedAt || job.failedAt || job.createdAt)?.toISOString(),
        metadata: {
          format: job.format || 'mp4',
          size: job.options?.size,
          fps: job.options?.fps,
          duration: job.projectData?.duration
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error checking render status:', error);
    res.status(500).json({
      error: 'Failed to check render status',
      video: {
        id: renderId,
        status: 'ERROR',
        progress: 0
      }
    });
  }
});

// Alternative API endpoint for compatibility with react-video-editor-1
app.post('/api/render', async (req, res) => {
  try {
    console.log('Alternative render endpoint called');

    // Extract design and options from request body
    const { design, options } = req.body;

    if (!design) {
      return res.status(400).json({
        error: 'Design object is required',
        message: 'Please provide a design object in the request body'
      });
    }

    const renderId = uuidv4();
    const renderOptions = {
      fps: options?.fps || design.fps || 30,
      size: options?.size || design.size || { width: 1080, height: 1920 },
      format: options?.format || 'mp4'
    };

    console.log('Alternative render request:', {
      renderId,
      designKeys: Object.keys(design),
      options: renderOptions,
      trackItemCount: design.trackItemIds?.length || 0
    });

    // Store job in memory
    renderJobs.set(renderId, {
      id: renderId,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
      projectData: design,
      options: renderOptions,
      format: renderOptions.format
    });

    // Return response in react-video-editor-1 format
    res.json({
      success: true,
      video: {
        id: renderId,
        status: 'PENDING',
        progress: 0,
        createdAt: new Date().toISOString()
      },
      renderId: renderId,
      message: 'Render job started successfully'
    });

    // Start rendering in background (same logic as main endpoint)
    try {
      const outputPath = await createVideoFromProject(design, renderId);
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

      console.log(`Alternative render job ${renderId} completed: ${outputUrl}`);
    } catch (error) {
      console.error(`Alternative render job ${renderId} failed:`, error);
      renderJobs.set(renderId, {
        ...renderJobs.get(renderId),
        status: 'failed',
        error: error.message,
        failedAt: new Date()
      });
    }

  } catch (error) {
    console.error('Error in alternative render endpoint:', error);
    res.status(500).json({
      error: 'Failed to start render',
      message: error.message
    });
  }
});

// Alternative status endpoint for compatibility
app.get('/api/render/status/:renderId', async (req, res) => {
  try {
    const { renderId } = req.params;

    if (!renderJobs.has(renderId)) {
      return res.status(404).json({
        error: 'Render job not found',
        video: {
          id: renderId,
          status: 'NOT_FOUND',
          progress: 0
        }
      });
    }

    const job = renderJobs.get(renderId);

    const statusMap = {
      'processing': 'PENDING',
      'completed': 'COMPLETED',
      'failed': 'FAILED'
    };

    res.json({
      success: true,
      video: {
        id: job.id,
        status: statusMap[job.status] || 'UNKNOWN',
        progress: job.progress,
        url: job.output,
        downloadUrl: job.output,
        createdAt: job.createdAt?.toISOString(),
        updatedAt: (job.completedAt || job.failedAt || job.createdAt)?.toISOString(),
        metadata: {
          format: job.format || 'mp4',
          size: job.options?.size,
          fps: job.options?.fps
        }
      }
    });

  } catch (error) {
    console.error('Error checking alternative render status:', error);
    res.status(500).json({
      error: 'Failed to check render status',
      video: {
        id: renderId,
        status: 'ERROR',
        progress: 0
      }
    });
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
