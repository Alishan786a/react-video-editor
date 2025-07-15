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

// Helper function to create box shadow effect
const createBoxShadowFilter = (layer, inputLabel, outputLabel) => {
  if (!layer.boxShadow || (layer.boxShadow.x === 0 && layer.boxShadow.y === 0)) {
    return null;
  }

  const shadow = layer.boxShadow;
  const shadowColor = shadow.color || '#000000';
  const offsetX = shadow.x || 0;
  const offsetY = shadow.y || 0;
  const blurRadius = shadow.blur || 0;

  console.log(`Creating box shadow: offset(${offsetX}, ${offsetY}), blur=${blurRadius}, color=${shadowColor}`);

  // Create shadow effect using multiple filters
  let shadowFilters = [];

  // 1. Create a colored background for shadow
  shadowFilters.push(`[${inputLabel}]split[main][shadow_base]`);

  // 2. Create shadow by making the video black and applying blur
  let shadowFilter = `[shadow_base]format=rgba,geq=r=0:g=0:b=0:a=alpha(X,Y)`;

  // 3. Apply blur if specified
  if (blurRadius > 0) {
    shadowFilter += `,gblur=sigma=${blurRadius}`;
  }

  // 4. Offset the shadow
  shadowFilter += `,pad=iw+${Math.abs(offsetX)}:ih+${Math.abs(offsetY)}:${Math.max(0, -offsetX)}:${Math.max(0, -offsetY)}:color=transparent[shadow]`;
  shadowFilters.push(shadowFilter);

  // 5. Pad the main video to match shadow dimensions
  const mainFilter = `[main]pad=iw+${Math.abs(offsetX)}:ih+${Math.abs(offsetY)}:${Math.max(0, offsetX)}:${Math.max(0, offsetY)}:color=transparent[main_padded]`;
  shadowFilters.push(mainFilter);

  // 6. Composite shadow and main video
  shadowFilters.push(`[shadow][main_padded]overlay[${outputLabel}]`);

  return shadowFilters;
};

// Helper function to build video styling filters
const buildVideoStyleFilters = (layer) => {
  let filters = [];

  console.log(`Applying video styling for layer:`, {
    opacity: layer.opacity,
    blur: layer.blur,
    brightness: layer.brightness,
    flipX: layer.flipX,
    flipY: layer.flipY,
    transform: layer.transform,
    boxShadow: layer.boxShadow,
    borderRadius: layer.borderRadius,
    borderWidth: layer.borderWidth,
    borderColor: layer.borderColor
  });

  // Apply flip transformations first
  if (layer.flipY) {
    filters.push('vflip');
    console.log('Applied vertical flip');
  }
  if (layer.flipX) {
    filters.push('hflip');
    console.log('Applied horizontal flip');
  }

  // Apply blur effect
  if (layer.blur && layer.blur > 0) {
    filters.push(`gblur=sigma=${layer.blur}`);
    console.log(`Applied blur: sigma=${layer.blur}`);
  }

  // Apply brightness and contrast adjustments using eq filter
  if (layer.brightness && layer.brightness !== 100) {
    // Convert percentage to FFmpeg brightness range
    // FFmpeg brightness: -1.0 (black) to 1.0 (white), 0 = normal
    // 100% = 0, 200% = 1.0, 0% = -1.0
    const brightnessValue = (layer.brightness - 100) / 100;

    // Also apply slight contrast adjustment for better visual effect
    const contrastValue = Math.max(0.5, Math.min(2.0, layer.brightness / 100));

    // Use single eq filter for both brightness and contrast
    filters.push(`eq=brightness=${brightnessValue.toFixed(2)}:contrast=${contrastValue.toFixed(2)}`);
    console.log(`Applied brightness: ${brightnessValue.toFixed(2)}, contrast: ${contrastValue.toFixed(2)} (from ${layer.brightness}%)`);
  }

  // Apply border radius (rounded corners) using crop and pad
  if (layer.borderRadius && layer.borderRadius > 0) {
    // FFmpeg doesn't have direct border-radius, but we can simulate with masks
    // For now, we'll log it as it requires complex mask generation
    console.log(`Border radius detected: ${layer.borderRadius}px (complex implementation needed)`);
  }

  // Apply border (outline) effect
  if (layer.borderWidth && layer.borderWidth > 0) {
    // Use drawbox filter to create border effect
    const borderColor = layer.borderColor || '#000000';

    // Create border using drawbox (this creates an outline effect)
    filters.push(`drawbox=x=0:y=0:w=iw:h=ih:color=${borderColor}:t=${layer.borderWidth}`);
    console.log(`Applied border: ${layer.borderWidth}px ${borderColor}`);
  }

  // Apply opacity/alpha - this needs to be done carefully for video overlay
  if (layer.opacity && layer.opacity !== 100) {
    const alphaValue = layer.opacity / 100; // Convert percentage to decimal
    // Use format=rgba to ensure alpha channel, then adjust alpha using colorchannelmixer
    // The aa parameter controls the alpha channel multiplier
    filters.push(`format=rgba,colorchannelmixer=aa=${alphaValue.toFixed(2)}`);
    console.log(`Applied opacity: ${alphaValue.toFixed(2)} (from ${layer.opacity}%)`);
  }

  // Handle transform scaling (extract scale values from transform string)
  if (layer.transform && layer.transform.includes('scale')) {
    const scaleMatch = layer.transform.match(/scale\(([^)]+)\)/);
    if (scaleMatch) {
      const scaleValues = scaleMatch[1].split(',').map(v => parseFloat(v.trim()));
      if (scaleValues.length >= 2) {
        const scaleX = scaleValues[0];
        const scaleY = scaleValues[1];
        // We'll handle scaling in the main scale filter, but log it here
        console.log(`Transform scale detected: ${scaleX}, ${scaleY}`);
      }
    }
  }

  // Join filters with commas if any exist
  const filterString = filters.length > 0 ? filters.join(',') + ',' : '';
  console.log(`Generated video filter chain: ${filterString}`);
  return filterString;
};

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

      for (let trackIndex = 0; trackIndex < trackItemIds.length; trackIndex++) {
        const itemId = trackItemIds[trackIndex];
        const itemDetails = trackItemDetailsMap[itemId];
        const trackItem = trackItemsMap[itemId];

        console.log(`Processing trackItemIds[${trackIndex}]: ${itemId} (trackIndex will be ${trackIndex})`);

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

          console.log(`Item ${itemId}: type=${itemType}, trackIndex=${trackIndex}, position=(${left},${top}), timing=${startTime}s-${endTime}s`);

          if (itemType === 'text') {
            // Handle text items
            textItems.push({
              id: itemId,
              type: 'text',
              trackIndex, // Preserve original order for z-index
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
              trackIndex, // Preserve original order for z-index
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
              opacity: details.opacity || 100, // Keep as percentage for easier processing
              transform: details.transform || 'none',
              blur: details.blur || 0,
              brightness: details.brightness || 100,
              flipX: details.flipX || false,
              flipY: details.flipY || false,
              boxShadow: details.boxShadow || null,
              borderRadius: details.borderRadius || 0,
              borderWidth: details.borderWidth || 0,
              borderColor: details.borderColor || '#000000',
              volume: details.volume !== undefined ? details.volume : 100 // Video volume control
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

      // IMPORTANT: Preserve trackItemIds order for correct z-index layering
      // The first item in trackItemIds should be at the bottom (lowest z-index)
      // The last item in trackItemIds should be at the top (highest z-index)
      // DO NOT sort by startTime as it breaks the intended layer ordering
      console.log('Preserving trackItemIds order for correct z-index layering');
      console.log('Layer order (bottom to top):', trackItemIds);

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

    // IMPORTANT: Sort by trackIndex to preserve trackItemIds order for correct z-index layering
    // First item in trackItemIds = bottom layer (lowest z-index)
    // Last item in trackItemIds = top layer (highest z-index)
    const sortedFiles = [...mediaFiles].sort((a, b) => a.trackIndex - b.trackIndex);

    // Sort text items by trackIndex as well for consistent layering
    const sortedTextItems = [...textItems].sort((a, b) => a.trackIndex - b.trackIndex);

    console.log('Layer composition (correct z-index order):');
    sortedFiles.forEach((file, index) => {
      console.log(`  Media Layer ${index} (trackIndex: ${file.trackIndex}): ${file.type} from ${file.startTime}s to ${file.startTime + file.duration}s`);
      console.log(`    Position: ${file.left}, ${file.top} | Size: ${file.width}x${file.height}`);
      console.log(`    Source: ${file.src.substring(0, 60)}...`);
    });

    sortedTextItems.forEach((item, index) => {
      console.log(`  Text Layer ${index} (trackIndex: ${item.trackIndex}): "${item.text.substring(0, 30)}..." from ${item.startTime}s to ${item.startTime + item.duration}s`);
      console.log(`    Position: ${item.left}, ${item.top} | Size: ${item.width}x${item.height}`);
      console.log(`    Style: ${item.fontSize}px ${item.fontFamily}, ${item.color}`);
    });

    // Create multi-layer video with both media and text (both sorted by trackIndex)
    createMultiLayerVideoWithText(sortedFiles, sortedTextItems, outputPath, width, height, duration, fps, renderId)
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

      // Check if image has timing constraints or positioning
      const left = parseInt(String(mediaFile.left).replace('px', '')) || 0;
      const top = parseInt(String(mediaFile.top).replace('px', '')) || 0;
      const hasPositioning = left !== 0 || top !== 0;
      const hasTimingConstraints = mediaFile.startTime > 0 || mediaFile.endTime < duration;

      if (hasTimingConstraints || hasPositioning) {
        console.log('Applying timing constraints and/or positioning to single image');
        console.log(`Image positioning: left=${left}, top=${top}`);

        // Use complex filter to apply timing constraints, positioning, and styling
        let imageFilter = `[0:v]`;

        // Apply image styling effects (opacity, blur, brightness, etc.)
        imageFilter += buildVideoStyleFilters(mediaFile);

        // Scale the image
        imageFilter += `scale=${width}:${height}[img_styled]`;

        const complexFilters = [
          imageFilter,
          `color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`,
          hasTimingConstraints
            ? `[bg][img_styled]overlay=${left}:${top}:enable='between(t,${mediaFile.startTime},${mediaFile.endTime})'[final]`
            : `[bg][img_styled]overlay=${left}:${top}[final]`
        ];

        console.log(`Single image styling applied: opacity=${mediaFile.opacity}%, blur=${mediaFile.blur}, brightness=${mediaFile.brightness}%`);

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

      // Check if video has timing constraints or styling effects
      const hasTimingConstraints = mediaFile.startTime > 0 || mediaFile.endTime < duration;
      const hasStyleEffects = mediaFile.flipX || mediaFile.flipY || (mediaFile.blur && mediaFile.blur > 0) ||
                             (mediaFile.brightness && mediaFile.brightness !== 100) ||
                             (mediaFile.opacity && mediaFile.opacity !== 100);

      if (hasTimingConstraints || hasStyleEffects) {
        console.log('Applying timing constraints and/or styling effects to single video');

        // Build filter chain with styling effects
        let videoFilter = '[0:v]';
        videoFilter += buildVideoStyleFilters(mediaFile);

        // Calculate final dimensions with transform scaling (same as multi-layer)
        let finalWidth = width;
        let finalHeight = height;

        // Extract scale from transform if present
        if (mediaFile.transform && mediaFile.transform.includes('scale')) {
          const scaleMatch = mediaFile.transform.match(/scale\(([^)]+)\)/);
          if (scaleMatch) {
            const scaleValues = scaleMatch[1].split(',').map(v => parseFloat(v.trim()));
            if (scaleValues.length >= 2) {
              finalWidth = Math.round(width * scaleValues[0]);
              finalHeight = Math.round(height * scaleValues[1]);
              console.log(`Applied transform scaling: ${width}x${height} -> ${finalWidth}x${finalHeight}`);
            } else if (scaleValues.length === 1) {
              // Single scale value applies to both dimensions
              finalWidth = Math.round(width * scaleValues[0]);
              finalHeight = Math.round(height * scaleValues[0]);
              console.log(`Applied uniform transform scaling: ${width}x${height} -> ${finalWidth}x${finalHeight}`);
            }
          }
        }

        // Ensure dimensions are even numbers and have minimum size for FFmpeg compatibility
        finalWidth = Math.max(2, Math.round(finalWidth / 2) * 2);
        finalHeight = Math.max(2, Math.round(finalHeight / 2) * 2);
        console.log(`Final dimensions (FFmpeg compatible): ${finalWidth}x${finalHeight}`);

        // For now, skip box shadow in single video processing to avoid FFmpeg complexity
        // TODO: Implement simplified box shadow for single video processing
        videoFilter += `scale=${finalWidth}:${finalHeight}[vid_styled]`;
        const complexFilters = [videoFilter];

        if (mediaFile.boxShadow && (mediaFile.boxShadow.x !== 0 || mediaFile.boxShadow.y !== 0)) {
          console.log(`Box shadow detected but skipped in single video processing: offset(${mediaFile.boxShadow.x}, ${mediaFile.boxShadow.y}), blur=${mediaFile.boxShadow.blur}`);
        }

        if (hasTimingConstraints) {
          // Extract positioning from mediaFile
          const left = parseInt(String(mediaFile.left).replace('px', '')) || 0;
          const top = parseInt(String(mediaFile.top).replace('px', '')) || 0;

          complexFilters.push(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`);
          complexFilters.push(`[bg][vid_styled]overlay=${left}:${top}:enable='between(t,${mediaFile.startTime},${mediaFile.endTime})'[final]`);
          console.log(`Applied video positioning: left=${left}, top=${top}`);
        } else {
          // Even without timing constraints, we might need positioning
          const left = parseInt(String(mediaFile.left).replace('px', '')) || 0;
          const top = parseInt(String(mediaFile.top).replace('px', '')) || 0;

          if (left !== 0 || top !== 0) {
            // Need positioning, create background and overlay
            complexFilters.push(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`);
            complexFilters.push(`[bg][vid_styled]overlay=${left}:${top}[final]`);
            console.log(`Applied video positioning (no timing): left=${left}, top=${top}`);
          } else {
            // No positioning needed
            complexFilters.push(`[vid_styled]copy[final]`);
          }
        }

        // Handle video audio volume if specified
        let audioMap = [];
        let useProcessedAudio = false;

        if (mediaFile.volume !== undefined && mediaFile.volume !== 100) {
          if (mediaFile.volume === 0) {
            // Mute audio completely - no audio mapping
            audioMap = [];
            useProcessedAudio = false;
            console.log(`Applied video volume: muted (from ${mediaFile.volume}%)`);
          } else {
            const volumeLevel = mediaFile.volume / 100; // Convert percentage to decimal
            complexFilters.push(`[0:a]volume=${volumeLevel.toFixed(2)}[audio_out]`);
            audioMap = ['-map', '[audio_out]'];
            useProcessedAudio = true;
            console.log(`Applied video volume: ${volumeLevel.toFixed(2)} (from ${mediaFile.volume}%)`);
          }
        } else {
          // No volume setting specified or volume is 100%, preserve original video audio
          audioMap = ['-map', '0:a?']; // Map original audio if present, ignore if not
          useProcessedAudio = false;
          console.log(`Preserving original video audio (no volume control or volume=100%)`);
        }

        command
          .complexFilter(complexFilters)
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .format('mp4')
          .fps(fps);

        // Add video mapping
        command = command.outputOptions(['-map', '[final]']);

        // Add audio mapping based on volume control
        if (useProcessedAudio) {
          // Volume control was applied, use the processed audio
          command = command.outputOptions(audioMap);
          console.log('Using processed audio with volume control');
        } else if (audioMap.length > 0) {
          // Preserve original audio
          command = command.outputOptions(audioMap);
          console.log('Preserving original video audio (no volume control applied)');
        } else {
          // Audio is muted (volume = 0)
          console.log('Audio muted - no audio mapping');
        }

        command = command.outputOptions([
          '-pix_fmt yuv420p',
          '-preset fast',
          '-crf 23'
        ]);
      } else {
        // No timing constraints or styling, use simple approach
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

    // Add video inputs with proper duration handling
    videoFiles.forEach((layer) => {
      command = command
        .input(layer.localPath);

      // Log video input details for debugging
      console.log(`Video input: ${layer.localPath}`);
      console.log(`  Duration: ${layer.duration}s, Start: ${layer.startTime}s, End: ${layer.endTime}s`);
      if (layer.trimStart !== undefined && layer.trimDuration !== undefined) {
        console.log(`  Trim: ${layer.trimStart}s to ${layer.trimStart + layer.trimDuration}s`);
      }
    });

    // Add audio inputs
    audioFiles.forEach((audio) => {
      command = command.input(audio.localPath);
    });

    // Build complex filter for video, audio, and text with proper timing constraints
    const complexFilters = [];

    // Scale all images and apply styling effects
    imageFiles.forEach((layer, index) => {
      let filterChain = `[${index}:v]`;

      // Apply image styling effects (similar to video styling)
      filterChain += buildVideoStyleFilters(layer);

      // Scale the image
      filterChain += `scale=${layer.width}:${layer.height}[img${index + 1}]`;
      complexFilters.push(filterChain);

      console.log(`Image ${index + 1} styling applied: opacity=${layer.opacity}%, blur=${layer.blur}, brightness=${layer.brightness}%`);
    });

    // Scale all videos (with trim handling and styling effects)
    videoFiles.forEach((layer, index) => {
      const inputIndex = imageFiles.length + index;
      let filterChain = `[${inputIndex}:v]`;

      // Apply trim if needed
      if (layer.trimStart !== undefined && layer.trimDuration !== undefined) {
        // IMPORTANT: Handle video trimming and looping for display duration
        console.log(`  Video ${index+1}: Trimming from ${layer.trimStart}s for ${layer.trimDuration}s duration`);
        console.log(`  Video ${index+1}: Display duration is ${layer.duration}s`);

        // If display duration is longer than trim duration, we need to loop the trimmed video
        if (layer.duration > layer.trimDuration) {
          console.log(`  Video ${index+1}: Display duration (${layer.duration}s) > trim duration (${layer.trimDuration}s), enabling loop`);
          // Trim the video and then loop it to fill the display duration
          filterChain += `trim=start=${layer.trimStart}:duration=${layer.trimDuration},setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0,`;
        } else {
          // Display duration matches or is shorter than trim duration
          filterChain += `trim=start=${layer.trimStart}:duration=${layer.trimDuration},setpts=PTS-STARTPTS,`;
        }
      }

      // Apply video styling effects (except box shadow)
      filterChain += buildVideoStyleFilters(layer);

      // Calculate final dimensions with transform scaling
      let finalWidth = layer.width;
      let finalHeight = layer.height;

      // Extract scale from transform if present
      if (layer.transform && layer.transform.includes('scale')) {
        const scaleMatch = layer.transform.match(/scale\(([^)]+)\)/);
        if (scaleMatch) {
          const scaleValues = scaleMatch[1].split(',').map(v => parseFloat(v.trim()));
          if (scaleValues.length >= 2) {
            finalWidth = Math.round(layer.width * scaleValues[0]);
            finalHeight = Math.round(layer.height * scaleValues[1]);
            console.log(`Applied transform scaling: ${layer.width}x${layer.height} -> ${finalWidth}x${finalHeight}`);
          } else if (scaleValues.length === 1) {
            // Single scale value applies to both dimensions
            finalWidth = Math.round(layer.width * scaleValues[0]);
            finalHeight = Math.round(layer.height * scaleValues[0]);
            console.log(`Applied uniform transform scaling: ${layer.width}x${layer.height} -> ${finalWidth}x${finalHeight}`);
          }
        }
      }

      // Scale first, then handle box shadow if present
      if (layer.boxShadow && (layer.boxShadow.x !== 0 || layer.boxShadow.y !== 0)) {
        // Scale first, then apply box shadow
        filterChain += `scale=${finalWidth}:${finalHeight}[vid${index + 1}_scaled]`;
        complexFilters.push(filterChain);

        // Create box shadow effect
        const shadowFilters = createBoxShadowFilter(layer, `vid${index + 1}_scaled`, `vid${index + 1}`);
        if (shadowFilters) {
          shadowFilters.forEach(filter => complexFilters.push(filter));
        } else {
          // No shadow, just copy the scaled video
          complexFilters.push(`[vid${index + 1}_scaled]copy[vid${index + 1}]`);
        }
      } else {
        // No box shadow, just scale
        filterChain += `scale=${finalWidth}:${finalHeight}[vid${index + 1}]`;
        complexFilters.push(filterChain);
      }
    });

    // Create background
    complexFilters.push(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`);

    // Build overlay chain - IMPORTANT: Process ALL visual layers in trackIndex order
    // This ensures correct z-index layering where last item in trackItemIds appears on top
    let currentLayer = 'bg';

    // Combine and sort ALL visual files by trackIndex to maintain correct layer order
    const allVisualLayers = [...imageFiles, ...videoFiles].sort((a, b) => a.trackIndex - b.trackIndex);

    console.log('Building overlay chain in correct trackIndex order:');
    console.log('Expected layer order (bottom to top): trackIndex 0, 1, 2...');
    allVisualLayers.forEach((layer, index) => {
      console.log(`  Overlay Layer ${index} (trackIndex: ${layer.trackIndex}, id: ${layer.id}): ${layer.type} at ${layer.left},${layer.top}`);
      console.log(`    Z-index position: ${layer.trackIndex === 0 ? 'BOTTOM' : layer.trackIndex === allVisualLayers.length - 1 ? 'TOP' : 'MIDDLE'}`);
    });

    allVisualLayers.forEach((layer, index) => {
      const left = parseInt(String(layer.left).replace('px', '')) || 0;
      const top = parseInt(String(layer.top).replace('px', '')) || 0;
      const nextLayer = index === allVisualLayers.length - 1 ? 'video_final' : `bg_with_layer${index + 1}`;

      // Determine the correct input label based on layer type
      let inputLabel;
      if (layer.type === 'image') {
        const imgIndex = imageFiles.findIndex(img => img.id === layer.id) + 1;
        inputLabel = `img${imgIndex}`;
      } else if (layer.type === 'video') {
        const vidIndex = videoFiles.findIndex(vid => vid.id === layer.id) + 1;
        inputLabel = `vid${vidIndex}`;
      }

      // For videos, use display timing for overlay (not trim duration)
      // The trim is applied to the video input, but overlay timing should match display timing
      let overlayTiming;
      if (layer.type === 'video') {
        // IMPORTANT: Always use display timing for video overlays, regardless of trim
        // The trim is handled in the video filter chain, but overlay timing controls when the video appears
        overlayTiming = `enable='between(t,${layer.startTime},${layer.endTime})'`;
        console.log(`  Video overlay timing: ${layer.startTime}s to ${layer.endTime}s (display duration: ${layer.duration}s)`);
        if (layer.trimDuration !== undefined && layer.trimDuration !== null) {
          console.log(`    Video trim applied separately: ${layer.trimStart}s to ${layer.trimStart + layer.trimDuration}s (trimmed duration: ${layer.trimDuration}s)`);
        }
      } else {
        // Use display timing for images and other media
        overlayTiming = `enable='between(t,${layer.startTime},${layer.endTime})'`;
        console.log(`  Media overlay timing: ${layer.startTime}s to ${layer.endTime}s`);
      }

      complexFilters.push(
        `[${currentLayer}][${inputLabel}]overlay=${left}:${top}:${overlayTiming}[${nextLayer}]`
      );

      currentLayer = nextLayer;
      console.log(`  Applied overlay: [${currentLayer}][${inputLabel}] at ${left}:${top}`);
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

    // Process audio tracks (including video audio and external audio files)
    let allAudioSources = [];
    let audioTrackIndex = 1;

    // Add video audio sources (include video audio unless explicitly muted)
    // Note: We'll add error handling for videos without audio streams
    videoFiles.forEach((videoFile, index) => {
      const videoInputIndex = imageFiles.length + index;

      // Include video audio unless explicitly muted (volume = 0)
      if (videoFile.volume === undefined || videoFile.volume > 0) {
        const volumeLevel = videoFile.volume !== undefined ? videoFile.volume / 100 : 1.0; // Default to full volume if not specified

        allAudioSources.push({
          ...videoFile,
          type: 'video_audio',
          inputIndex: videoInputIndex,
          audioIndex: audioTrackIndex,
          volumeLevel: volumeLevel,
          hasAudioStream: true // We'll assume true and handle errors gracefully
        });

        console.log(`Including video audio ${audioTrackIndex}: volume=${volumeLevel.toFixed(2)} (${videoFile.volume || 100}%)`);
        audioTrackIndex++;
      } else {
        console.log(`Excluding video audio ${index + 1}: muted (volume=0)`);
      }
    });

    // Add external audio files
    audioFiles.forEach((audioFile, index) => {
      allAudioSources.push({
        ...audioFile,
        type: 'external_audio',
        inputIndex: imageFiles.length + videoFiles.length + index,
        audioIndex: audioTrackIndex
      });

      console.log(`Including external audio ${audioTrackIndex}: ${audioFile.src}`);
      audioTrackIndex++;
    });

    if (allAudioSources.length > 0) {
      console.log(`Processing ${allAudioSources.length} total audio sources (${allAudioSources.filter(a => a.type === 'video_audio').length} video audio + ${audioFiles.length} external audio)...`);

      allAudioSources.forEach((audioSource) => {
        if (audioSource.type === 'video_audio') {
          // Handle video audio with volume control
          const inputIndex = audioSource.inputIndex;
          const audioIndex = audioSource.audioIndex;

          let audioFilter = `[${inputIndex}:a]`;

          // Apply volume if not default
          if (audioSource.volumeLevel !== 1.0) {
            audioFilter += `volume=${audioSource.volumeLevel.toFixed(2)},`;
          }

          // Apply timing constraints
          audioFilter += `atrim=start=${audioSource.startTime}:duration=${audioSource.duration},asetpts=PTS-STARTPTS,adelay=${audioSource.startTime * 1000}|${audioSource.startTime * 1000}[audio${audioIndex}_timed]`;

          complexFilters.push(audioFilter);
          console.log(`Video audio ${audioIndex} filter: ${audioFilter}`);
        } else {
          // Handle external audio files
          const inputIndex = audioSource.inputIndex;
          const audioIndex = audioSource.audioIndex;

          console.log(`External audio ${audioIndex} timing: ${audioSource.startTime}s to ${audioSource.endTime}s (duration: ${audioSource.duration}s)`);

          if (audioSource.trimStart !== undefined && audioSource.trimDuration !== undefined) {
            console.log(`External audio ${audioIndex} trim: extracting ${audioSource.trimStart}s to ${audioSource.trimStart + audioSource.trimDuration}s from original audio`);
            const audioFilter = `[${inputIndex}:a]atrim=start=${audioSource.trimStart}:duration=${audioSource.trimDuration},asetpts=PTS-STARTPTS,adelay=${audioSource.startTime * 1000}|${audioSource.startTime * 1000}[audio${audioIndex}_timed]`;
            complexFilters.push(audioFilter);
          } else {
            const audioFilter = `[${inputIndex}:a]atrim=start=${audioSource.startTime}:duration=${audioSource.duration},asetpts=PTS-STARTPTS,adelay=${audioSource.startTime * 1000}|${audioSource.startTime * 1000}[audio${audioIndex}_timed]`;
            complexFilters.push(audioFilter);
          }
        }
      });

      // Mix multiple audio tracks if needed
      if (allAudioSources.length > 1) {
        const audioInputs = allAudioSources.map((_, index) => `[audio${index + 1}_timed]`).join('');
        const mixFilter = `${audioInputs}amix=inputs=${allAudioSources.length}:duration=longest[audio_mixed]`;
        complexFilters.push(mixFilter);
        console.log(`Mixing ${allAudioSources.length} audio tracks together`);
      }
    }

    command = command.complexFilter(complexFilters);

    // Map video and audio outputs
    if (allAudioSources.length > 0) {
      if (allAudioSources.length === 1) {
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

        // Check if the error is related to missing audio streams
        if (err.message && err.message.includes('matches no streams') && err.message.includes(':a')) {
          console.log('Audio stream error detected - retrying without video audio...');

          // Retry without video audio streams
          createMultiLayerVideoWithoutAudio(imageFiles, videoFiles, textItems, outputPath, width, height, duration, fps, renderId)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      })
      .run();
  });
};

// Fallback multi-layer video creation without audio (for videos without audio streams)
const createMultiLayerVideoWithoutAudio = async (imageFiles, videoFiles, textItems, outputPath, width, height, duration, fps, renderId) => {
  return new Promise((resolve, reject) => {
    console.log('Creating multi-layer video WITHOUT audio (fallback mode)...');

    // Build FFmpeg command with all inputs (no audio processing)
    let command = ffmpeg();

    // Add image inputs
    imageFiles.forEach((layer) => {
      command = command
        .input(layer.localPath)
        .inputOptions(['-loop 1', `-t ${duration}`]);
    });

    // Add video inputs
    videoFiles.forEach((layer) => {
      command = command.input(layer.localPath);
    });

    // Build complex filter for video and text only (no audio)
    const complexFilters = [];

    // Scale all images and apply styling effects
    imageFiles.forEach((layer, index) => {
      let filterChain = `[${index}:v]`;

      // Apply image styling effects (similar to video styling)
      filterChain += buildVideoStyleFilters(layer);

      // Scale the image
      filterChain += `scale=${layer.width}:${layer.height}[img${index + 1}]`;
      complexFilters.push(filterChain);

      console.log(`Image ${index + 1} styling applied (fallback): opacity=${layer.opacity}%, blur=${layer.blur}, brightness=${layer.brightness}%`);
    });

    // Scale all videos (with trim handling and styling effects)
    videoFiles.forEach((layer, index) => {
      const inputIndex = imageFiles.length + index;
      let filterChain = `[${inputIndex}:v]`;

      // Apply trim if needed
      if (layer.trimStart !== undefined && layer.trimDuration !== undefined) {
        // IMPORTANT: Handle video trimming and looping for display duration (fallback)
        console.log(`  Video ${index+1} (fallback): Trimming from ${layer.trimStart}s for ${layer.trimDuration}s duration`);
        console.log(`  Video ${index+1} (fallback): Display duration is ${layer.duration}s`);

        // If display duration is longer than trim duration, we need to loop the trimmed video
        if (layer.duration > layer.trimDuration) {
          console.log(`  Video ${index+1} (fallback): Display duration (${layer.duration}s) > trim duration (${layer.trimDuration}s), enabling loop`);
          // Trim the video and then loop it to fill the display duration
          filterChain += `trim=start=${layer.trimStart}:duration=${layer.trimDuration},setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0,`;
        } else {
          // Display duration matches or is shorter than trim duration
          filterChain += `trim=start=${layer.trimStart}:duration=${layer.trimDuration},setpts=PTS-STARTPTS,`;
        }
      }

      // Apply video styling effects
      filterChain += buildVideoStyleFilters(layer);

      // Calculate final dimensions with transform scaling
      let finalWidth = layer.width;
      let finalHeight = layer.height;

      // Extract scale from transform if present
      if (layer.transform && layer.transform.includes('scale')) {
        const scaleMatch = layer.transform.match(/scale\(([^)]+)\)/);
        if (scaleMatch) {
          const scaleValues = scaleMatch[1].split(',').map(v => parseFloat(v.trim()));
          if (scaleValues.length >= 2) {
            finalWidth = Math.round(layer.width * scaleValues[0]);
            finalHeight = Math.round(layer.height * scaleValues[1]);
          } else if (scaleValues.length === 1) {
            finalWidth = Math.round(layer.width * scaleValues[0]);
            finalHeight = Math.round(layer.height * scaleValues[0]);
          }
        }
      }

      // Scale the video
      filterChain += `scale=${finalWidth}:${finalHeight}[vid${index + 1}]`;
      complexFilters.push(filterChain);
    });

    // Create background
    complexFilters.push(`color=black:size=${width}x${height}:duration=${duration}:rate=${fps}[bg]`);

    // Build overlay chain - IMPORTANT: Process ALL visual layers in trackIndex order
    // This ensures correct z-index layering where last item in trackItemIds appears on top
    let currentLayer = 'bg';

    // Combine and sort ALL visual files by trackIndex to maintain correct layer order
    const allVisualLayers = [...imageFiles, ...videoFiles].sort((a, b) => a.trackIndex - b.trackIndex);

    console.log('Building overlay chain in correct trackIndex order (fallback mode):');
    allVisualLayers.forEach((layer, index) => {
      console.log(`  Layer ${index} (trackIndex: ${layer.trackIndex}): ${layer.type} at ${layer.left},${layer.top}`);
    });

    allVisualLayers.forEach((layer, index) => {
      const left = parseInt(String(layer.left).replace('px', '')) || 0;
      const top = parseInt(String(layer.top).replace('px', '')) || 0;
      const nextLayer = index === allVisualLayers.length - 1 ? 'video_final' : `bg_with_layer${index + 1}`;

      // Determine the correct input label based on layer type
      let inputLabel;
      if (layer.type === 'image') {
        const imgIndex = imageFiles.findIndex(img => img.id === layer.id) + 1;
        inputLabel = `img${imgIndex}`;
      } else if (layer.type === 'video') {
        const vidIndex = videoFiles.findIndex(vid => vid.id === layer.id) + 1;
        inputLabel = `vid${vidIndex}`;
      }

      // For videos, use display timing for overlay (not trim duration)
      // The trim is applied to the video input, but overlay timing should match display timing
      let overlayTiming;
      if (layer.type === 'video') {
        // IMPORTANT: Always use display timing for video overlays, regardless of trim
        // The trim is handled in the video filter chain, but overlay timing controls when the video appears
        overlayTiming = `enable='between(t,${layer.startTime},${layer.endTime})'`;
        console.log(`  Video overlay timing (fallback): ${layer.startTime}s to ${layer.endTime}s (display duration: ${layer.duration}s)`);
        if (layer.trimDuration !== undefined && layer.trimDuration !== null) {
          console.log(`    Video trim applied separately (fallback): ${layer.trimStart}s to ${layer.trimStart + layer.trimDuration}s (trimmed duration: ${layer.trimDuration}s)`);
        }
      } else {
        // Use display timing for images and other media
        overlayTiming = `enable='between(t,${layer.startTime},${layer.endTime})'`;
        console.log(`  Media overlay timing (fallback): ${layer.startTime}s to ${layer.endTime}s`);
      }

      complexFilters.push(
        `[${currentLayer}][${inputLabel}]overlay=${left}:${top}:${overlayTiming}[${nextLayer}]`
      );

      currentLayer = nextLayer;
      console.log(`  Applied overlay (fallback): [${currentLayer}][${inputLabel}] at ${left}:${top}`);
    });

    // Add text overlays if any
    if (textItems.length > 0) {
      let textCurrentLayer = 'video_final';
      textItems.forEach((textItem, index) => {
        const outputLabel = index === textItems.length - 1 ? 'final' : `text${index}`;

        const drawTextOptions = [
          `text='${textItem.text.replace(/'/g, "\\'")}'`,
          `fontfile=/System/Library/Fonts/Arial.ttf`,
          `fontsize=${textItem.fontSize}`,
          `fontcolor=${textItem.color}`,
          `x=${textItem.left}`,
          `y=${textItem.top}`,
          `enable='between(t,${textItem.startTime},${textItem.endTime})'`
        ];

        const textFilter = `[${textCurrentLayer}]drawtext=${drawTextOptions.join(':')}[${outputLabel}]`;
        complexFilters.push(textFilter);
        textCurrentLayer = outputLabel;
      });
    } else {
      complexFilters.push(`[video_final]copy[final]`);
    }

    command
      .complexFilter(complexFilters)
      .output(outputPath)
      .videoCodec('libx264')
      .format('mp4')
      .outputOptions(['-map [final]', '-pix_fmt yuv420p', '-preset fast', '-crf 23'])
      .on('start', (commandLine) => {
        console.log('Multi-layer WITHOUT audio FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Multi-layer without audio progress: ${Math.round(progress.percent || 0)}%`);
        if (renderJobs.has(renderId)) {
          const job = renderJobs.get(renderId);
          job.progress = Math.round(progress.percent || 0);
          renderJobs.set(renderId, job);
        }
      })
      .on('end', () => {
        console.log('Multi-layer without audio composition completed successfully!');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error in multi-layer without audio composition:', err);
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

      // Scale all videos (with trim handling and styling effects)
      videoFiles.forEach((layer, index) => {
        const inputIndex = imageFiles.length + index;
        let filterChain = `[${inputIndex}:v]`;

        // Apply trim if needed
        if (layer.trimStart !== undefined && layer.trimDuration !== undefined) {
          filterChain += `trim=start=${layer.trimStart}:duration=${layer.trimDuration},setpts=PTS-STARTPTS,`;
        }

        // Apply video styling effects
        filterChain += buildVideoStyleFilters(layer);

        // Calculate final dimensions with transform scaling
        let finalWidth = layer.width;
        let finalHeight = layer.height;

        // Extract scale from transform if present
        if (layer.transform && layer.transform.includes('scale')) {
          const scaleMatch = layer.transform.match(/scale\(([^)]+)\)/);
          if (scaleMatch) {
            const scaleValues = scaleMatch[1].split(',').map(v => parseFloat(v.trim()));
            if (scaleValues.length >= 2) {
              finalWidth = Math.round(layer.width * scaleValues[0]);
              finalHeight = Math.round(layer.height * scaleValues[1]);
              console.log(`Applied transform scaling: ${layer.width}x${layer.height} -> ${finalWidth}x${finalHeight}`);
            } else if (scaleValues.length === 1) {
              // Single scale value applies to both dimensions
              finalWidth = Math.round(layer.width * scaleValues[0]);
              finalHeight = Math.round(layer.height * scaleValues[0]);
              console.log(`Applied uniform transform scaling: ${layer.width}x${layer.height} -> ${finalWidth}x${finalHeight}`);
            }
          }
        }

        // Final scale
        filterChain += `scale=${finalWidth}:${finalHeight}[vid${index + 1}]`;

        complexFilters.push(filterChain);
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
