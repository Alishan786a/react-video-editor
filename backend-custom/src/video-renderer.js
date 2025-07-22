import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CoordinateConverter } from './coordinate-converter.js';
import { EffectsProcessor } from './effects-processor.js';
import { TextRenderer } from './text-renderer.js';
import { AudioMixer } from './audio-mixer.js';

const execAsync = promisify(exec);

export class VideoRenderer {
  constructor() {
    this.coordinateConverter = new CoordinateConverter();
    this.effectsProcessor = new EffectsProcessor();
    this.textRenderer = new TextRenderer();
    this.audioMixer = new AudioMixer();
  }

  async checkFFmpegAvailability() {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch (error) {
      console.error('❌ FFmpeg not available:', error.message);
      return false;
    }
  }

  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  async renderVideo({ projectData, processedMedia, outputPath, tempPath, onProgress }) {
    try {
      const { trackItemIds, trackItemsMap, trackItemDetailsMap, size, fps } = projectData;
      const canvasWidth = size?.width || 1080;
      const canvasHeight = size?.height || 1920;
      const frameRate = fps || 30;

      // Calculate total duration
      const duration = this.calculateDuration(trackItemsMap, trackItemIds);
      console.log(`🎬 Video specs: ${canvasWidth}x${canvasHeight}, ${frameRate}fps, ${duration}s`);

      onProgress?.(10, 'Preparing video layers');

      // Separate items by type
      console.log(`🔍 DEBUG: trackItemIds = [${trackItemIds.join(', ')}]`);
      console.log(`🔍 DEBUG: trackItemsMap keys = [${Object.keys(trackItemsMap).join(', ')}]`);
      console.log(`🔍 DEBUG: trackItemDetailsMap keys = [${Object.keys(trackItemDetailsMap).join(', ')}]`);

      const layers = this.organizeLayersByType(trackItemIds, trackItemsMap, trackItemDetailsMap);
      
      onProgress?.(20, 'Processing video layers');

      // Create video layers
      const videoLayers = await this.createVideoLayers(
        layers.videos, 
        processedMedia, 
        tempPath, 
        canvasWidth, 
        canvasHeight, 
        duration,
        frameRate
      );

      onProgress?.(40, 'Processing image layers');

      // Create image layers
      const imageLayers = await this.createImageLayers(
        layers.images, 
        processedMedia, 
        tempPath, 
        canvasWidth, 
        canvasHeight, 
        duration,
        frameRate
      );

      onProgress?.(60, 'Skipping text layers for now');

      // Skip text layers for now to focus on image/video rendering
      const textLayers = [];
      console.log('📝 Skipping text layers temporarily');

      onProgress?.(70, 'Processing audio tracks');

      // Process audio
      const audioTrack = await this.audioMixer.createAudioTrack(
        layers.audios, 
        processedMedia, 
        tempPath, 
        duration
      );

      onProgress?.(80, 'Compositing final video');

      // Combine all layers
      await this.compositeVideo({
        videoLayers,
        imageLayers,
        textLayers,
        audioTrack,
        outputPath,
        canvasWidth,
        canvasHeight,
        duration,
        frameRate,
        onProgress: (progress) => onProgress?.(80 + (progress * 0.2), 'Finalizing video')
      });

      onProgress?.(100, 'Video rendering completed');

    } catch (error) {
      console.error('❌ Video rendering error:', error);
      throw error;
    }
  }

  calculateDuration(trackItemsMap, trackItemIds) {
    let maxEndTime = 5; // Default 5 seconds
    
    trackItemIds.forEach(itemId => {
      const item = trackItemsMap[itemId];
      if (item?.display?.to) {
        maxEndTime = Math.max(maxEndTime, item.display.to / 1000);
      }
    });
    
    return Math.max(5, maxEndTime);
  }

  organizeLayersByType(trackItemIds, trackItemsMap, trackItemDetailsMap) {
    const layers = {
      videos: [],
      images: [],
      texts: [],
      audios: []
    };

    console.log(`🔍 Organizing ${trackItemIds.length} items by type`);

    trackItemIds.forEach((itemId, index) => {
      const item = trackItemsMap[itemId];
      const details = trackItemDetailsMap[itemId];

      if (!item || !details) {
        console.warn(`⚠️ Missing data for item ${itemId}`);
        return;
      }

      const itemType = details.details?.type || details.type;
      const layerData = {
        itemId,
        item,
        details,
        originalIndex: index // Keep track of original order like Remotion
      };

      console.log(`📋 Item ${index}: ${itemId} (type: ${itemType})`);

      switch (itemType) {
        case 'video':
          layers.videos.push(layerData);
          break;
        case 'image':
          layers.images.push(layerData);
          break;
        case 'text':
          layers.texts.push(layerData);
          break;
        case 'audio':
          layers.audios.push(layerData);
          break;
        default:
          console.warn(`⚠️ Unknown item type: ${itemType} for item ${itemId}`);
      }
    });

    console.log(`📊 Layer summary: ${layers.videos.length} videos, ${layers.images.length} images, ${layers.texts.length} texts, ${layers.audios.length} audios`);
    return layers;
  }

  async createVideoLayers(videoLayers, processedMedia, tempPath, canvasWidth, canvasHeight, duration, frameRate) {
    const processedLayers = [];

    for (let index = 0; index < videoLayers.length; index++) {
      const layer = videoLayers[index];
      const { itemId, item, details } = layer;
      const mediaFile = processedMedia.find(m => m.itemId === itemId);

      if (!mediaFile) continue;

      const outputFile = path.join(tempPath, `video_layer_${itemId}.mp4`);

      // Convert coordinates and apply effects
      const coords = this.coordinateConverter.convertToRenderCoords(
        details.details, canvasWidth, canvasHeight
      );

      const effects = this.effectsProcessor.buildVideoEffects(details.details, item);

      await this.processVideoLayer({
        inputPath: mediaFile.localPath,
        outputPath: outputFile,
        coords,
        effects,
        timing: item.display || {},
        trim: item.trim || {},
        canvasWidth,
        canvasHeight,
        duration,
        frameRate
      });

      processedLayers.push({
        path: outputFile,
        zIndex: layer.originalIndex, // Use original index from trackItemIds for proper z-ordering
        timing: item.display || {},
        coords: coords, // Store coordinates for overlay positioning
        itemId: itemId,
        type: 'video'
      });
    }

    return processedLayers;
  }

  async createImageLayers(imageLayers, processedMedia, tempPath, canvasWidth, canvasHeight, duration, frameRate) {
    const processedLayers = [];

    for (let index = 0; index < imageLayers.length; index++) {
      const layer = imageLayers[index];
      const { itemId, item, details } = layer;
      const mediaFile = processedMedia.find(m => m.itemId === itemId);

      if (!mediaFile) continue;

      const outputFile = path.join(tempPath, `image_layer_${itemId}.mp4`);

      // Convert coordinates and apply effects
      const coords = this.coordinateConverter.convertToRenderCoords(
        details.details, canvasWidth, canvasHeight
      );

      const effects = this.effectsProcessor.buildImageEffects(details.details, item);

      await this.processImageLayer({
        inputPath: mediaFile.localPath,
        outputPath: outputFile,
        coords,
        effects,
        timing: item.display || {},
        canvasWidth,
        canvasHeight,
        duration,
        frameRate
      });

      processedLayers.push({
        path: outputFile,
        zIndex: layer.originalIndex, // Use original index from trackItemIds for proper z-ordering
        timing: item.display || {},
        coords: coords, // Store coordinates for overlay positioning
        itemId: itemId,
        type: 'image'
      });
    }

    return processedLayers;
  }

  async createTextLayers(textLayers, tempPath, canvasWidth, canvasHeight, duration, frameRate) {
    const processedLayers = [];

    for (let index = 0; index < textLayers.length; index++) {
      const layer = textLayers[index];
      const { itemId, item, details } = layer;
      const outputFile = path.join(tempPath, `text_layer_${itemId}.mp4`);

      await this.textRenderer.renderTextLayer({
        text: details.details.text || '',
        styling: details.details,
        timing: item.display || {},
        outputPath: outputFile,
        canvasWidth,
        canvasHeight,
        duration,
        frameRate
      });

      processedLayers.push({
        path: outputFile,
        zIndex: layer.originalIndex, // Use original index from trackItemIds for proper z-ordering
        timing: item.display || {},
        coords: { left: 0, top: 0, width: canvasWidth, height: canvasHeight }, // Text layers are full canvas
        itemId: itemId,
        type: 'text'
      });
    }

    return processedLayers;
  }

  async processVideoLayer({ inputPath, outputPath, coords, effects, timing, trim, canvasWidth, canvasHeight, duration, frameRate }) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Apply trimming if specified
      if (trim.from !== undefined) {
        command = command.seekInput(trim.from / 1000);
      }
      if (trim.to !== undefined) {
        const trimDuration = (trim.to - (trim.from || 0)) / 1000;
        command = command.duration(trimDuration);
      }

      // Build filter chain for positioning and effects
      const filters = [];

      // Scale and position - ensure even dimensions for H.264 compatibility
      const evenWidth = coords.width % 2 === 0 ? coords.width : coords.width + 1;
      const evenHeight = coords.height % 2 === 0 ? coords.height : coords.height + 1;

      console.log(`🎯 Scaling: ${coords.width}x${coords.height} -> ${evenWidth}x${evenHeight} (even)`);
      filters.push(`scale=${evenWidth}:${evenHeight}`);

      // Add effects
      if (effects.opacity < 1) {
        filters.push(`format=yuva420p,colorchannelmixer=aa=${effects.opacity}`);
      }

      if (effects.blur > 0) {
        filters.push(`gblur=sigma=${effects.blur}`);
      }

      // Don't add padding here - we'll position during final overlay
      // Store coordinates for later use in composition

      command
        .videoFilter(filters)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          `-t ${duration}`,
          `-r ${frameRate}`
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🎬 Video processing command:', commandLine);
        })
        .on('end', () => {
          console.log(`✅ Video layer processed: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Video processing error:', error);
          reject(error);
        })
        .run();
    });
  }

  async processImageLayer({ inputPath, outputPath, coords, effects, timing, canvasWidth, canvasHeight, duration, frameRate }) {
    return new Promise((resolve, reject) => {
      // Simplified approach: just convert image to video with proper scaling and positioning
      const filters = [];

      // Scale to fit coordinates - ensure even dimensions for H.264 compatibility
      const evenWidth = coords.width % 2 === 0 ? coords.width : coords.width + 1;
      const evenHeight = coords.height % 2 === 0 ? coords.height : coords.height + 1;

      console.log(`🎯 Image scaling: ${coords.width}x${coords.height} -> ${evenWidth}x${evenHeight} (even)`);
      filters.push(`scale=${evenWidth}:${evenHeight}`);

      // Add effects
      if (effects.opacity < 1) {
        filters.push(`format=rgba,colorchannelmixer=aa=${effects.opacity}`);
      }

      if (effects.blur > 0) {
        filters.push(`gblur=sigma=${effects.blur}`);
      }

      // Create video from image using input loop instead of filter
      ffmpeg(inputPath)
        .inputOptions([
          '-loop 1',
          `-t ${duration}`,
          `-r ${frameRate}`
        ])
        .videoFilter(filters)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🎬 Image processing command:', commandLine);
        })
        .on('end', () => {
          console.log(`✅ Image layer processed: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Image processing error:', error);
          reject(error);
        })
        .run();
    });
  }

  async compositeVideo({ videoLayers, imageLayers, textLayers, audioTrack, outputPath, canvasWidth, canvasHeight, duration, frameRate, onProgress }) {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure output directory exists
        await fs.ensureDir(path.dirname(outputPath));
        console.log(`📁 Output directory ensured: ${path.dirname(outputPath)}`);
      } catch (error) {
        console.error('❌ Failed to create output directory:', error);
        reject(error);
        return;
      }

      // Combine all layers and sort by original trackItemIds order (like Remotion)
      const allLayers = [...videoLayers, ...imageLayers, ...textLayers]
        .sort((a, b) => a.zIndex - b.zIndex);

      console.log(`🎬 Final layer composition order:`);
      allLayers.forEach((layer, index) => {
        console.log(`   ${index}: ${layer.itemId} (${layer.type}) - z-index: ${layer.zIndex}`);
      });

      if (allLayers.length === 0) {
        // Create blank video if no layers - use a simple black image approach
        const blackImagePath = path.join(path.dirname(outputPath), `black_${Date.now()}.png`);

        // Create a 1x1 black pixel PNG
        const blackPixelBuffer = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
          0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
          0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0x60, 0x00, 0x00, 0x00,
          0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
          0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ]);

        require('fs-extra').writeFileSync(blackImagePath, blackPixelBuffer);

        ffmpeg(blackImagePath)
          .loop(duration)
          .inputOptions(['-framerate', frameRate.toString()])
          .videoFilter(`scale=${canvasWidth}:${canvasHeight}`)
          .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', `-t ${duration}`])
          .output(outputPath)
          .on('end', () => {
            require('fs-extra').removeSync(blackImagePath);
            resolve();
          })
          .on('error', (error) => {
            require('fs-extra').removeSync(blackImagePath);
            reject(error);
          })
          .run();
        return;
      }

      if (allLayers.length === 1) {
        // Single layer - just copy it
        console.log('📹 Single layer composition');
        ffmpeg(allLayers[0].path)
          .outputOptions([
            '-c:v libx264',
            '-preset medium',
            '-crf 20',
            '-pix_fmt yuv420p',
            '-movflags +faststart'
          ])
          .output(outputPath)
          .on('progress', (progress) => {
            onProgress?.(progress.percent || 0);
          })
          .on('start', (commandLine) => {
            console.log('🎬 Single layer command:', commandLine);
          })
          .on('end', () => {
            console.log('✅ Single layer composition completed');
            resolve();
          })
          .on('error', (error) => {
            console.error('❌ Single layer composition error:', error);
            reject(error);
          })
          .run();
      } else {
        // Multiple layers - create background and overlay each layer with proper positioning
        console.log(`📹 Multi-layer composition: ${allLayers.length} layers`);

        // Validate all layer files exist
        for (const layer of allLayers) {
          if (!await fs.pathExists(layer.path)) {
            throw new Error(`Layer file not found: ${layer.path}`);
          }
          console.log(`✅ Layer file exists: ${path.basename(layer.path)} (${(await fs.stat(layer.path)).size} bytes)`);
        }

        let command = ffmpeg();

        // No need for separate background - use first layer as background

        // Use the first layer as background instead of creating a separate background
        command = command.input(allLayers[0].path);

        // Add remaining layer inputs (skip first layer since it's already added as background)
        for (let i = 1; i < allLayers.length; i++) {
          const layer = allLayers[i];
          console.log(`📥 Adding layer ${i + 1}: ${path.basename(layer.path)} (${layer.type}) at (${layer.coords?.left || 0}, ${layer.coords?.top || 0})`);
          command = command.input(layer.path);
        }

        // Add audio if available
        if (audioTrack) {
          command = command.input(audioTrack);
        }

        // Build complex filter for overlaying layers with proper positioning
        const filterParts = [];

        // Start with first layer padded to canvas size
        const firstLayer = allLayers[0];
        const firstX = firstLayer.coords?.left || 0;
        const firstY = firstLayer.coords?.top || 0;
        console.log(`🎯 First layer background: pad to ${canvasWidth}x${canvasHeight} at (${firstX}, ${firstY})`);
        filterParts.push(`[0:v]pad=${canvasWidth}:${canvasHeight}:${firstX}:${firstY}:black[bg]`);

        let currentOutput = '[bg]';

        // Overlay each subsequent layer on top with proper positioning
        for (let i = 1; i < allLayers.length; i++) {
          const layer = allLayers[i];
          const inputIndex = i; // Direct index since first layer is input 0
          const nextOutput = i === allLayers.length - 1 ? '[final]' : `[tmp${i}]`;

          const x = layer.coords?.left || 0;
          const y = layer.coords?.top || 0;

          console.log(`🎯 Overlaying layer ${i + 1} at position (${x}, ${y}) - input[${inputIndex}:v] -> ${nextOutput}`);
          filterParts.push(`${currentOutput}[${inputIndex}:v]overlay=${x}:${y}:shortest=1${nextOutput}`);
          currentOutput = `[tmp${i}]`;
        }

        console.log('🔧 Multi-layer positioning filter:', filterParts.join(';'));
        console.log('🔧 Filter parts breakdown:');
        filterParts.forEach((part, index) => {
          console.log(`   ${index + 1}: ${part}`);
        });

        command = command.complexFilter(filterParts, ['final']);

        command
          .outputOptions([
            '-c:v libx264',
            '-preset medium',
            '-crf 20',
            '-pix_fmt yuv420p',
            '-movflags +faststart',
            `-t ${duration}`
          ]);

        if (audioTrack) {
          command = command.outputOptions(['-c:a aac', '-b:a 128k']);
        }

        command
          .output(outputPath)
          .on('progress', (progress) => {
            onProgress?.(progress.percent || 0);
          })
          .on('start', (commandLine) => {
            console.log('🎬 Multi-layer positioning command:', commandLine);
          })
          .on('stderr', (stderrLine) => {
            console.log('🔍 FFmpeg stderr:', stderrLine);
          })
          .on('end', () => {
            console.log('✅ Multi-layer composition completed');
            resolve();
          })
          .on('error', (error) => {
            console.error('❌ Multi-layer composition error:', error);
            reject(error);
          })
          .run();
      }
    });
  }
}
