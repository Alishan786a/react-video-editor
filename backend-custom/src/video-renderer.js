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

    trackItemIds.forEach(itemId => {
      const item = trackItemsMap[itemId];
      const details = trackItemDetailsMap[itemId];
      
      if (!item || !details) return;

      const itemType = details.details?.type || details.type;
      const layerData = { itemId, item, details };

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
      }
    });

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
        zIndex: index,
        timing: item.display || {}
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
        zIndex: index + 100, // Offset to avoid conflicts with video layers
        timing: item.display || {}
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
        zIndex: index + 200, // Offset to avoid conflicts with other layers
        timing: item.display || {}
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

      // Build filter complex for positioning and effects
      const filters = [];
      
      // Scale and position
      filters.push(`scale=${coords.width}:${coords.height}`);
      
      // Add effects
      if (effects.opacity < 1) {
        filters.push(`format=yuva420p,colorchannelmixer=aa=${effects.opacity}`);
      }
      
      if (effects.blur > 0) {
        filters.push(`gblur=sigma=${effects.blur}`);
      }

      // Overlay on canvas
      const filterComplex = [
        `color=black:size=${canvasWidth}x${canvasHeight}:duration=${duration}:rate=${frameRate}[bg]`,
        `[0:v]${filters.join(',')}[scaled]`,
        `[bg][scaled]overlay=${coords.left}:${coords.top}:enable='between(t,${timing.from/1000 || 0},${timing.to/1000 || duration})'`
      ].join(';');

      command
        .complexFilter(filterComplex)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  async processImageLayer({ inputPath, outputPath, coords, effects, timing, canvasWidth, canvasHeight, duration, frameRate }) {
    return new Promise((resolve, reject) => {
      // Simplified approach: just convert image to video with proper scaling and positioning
      const filters = [];

      // Scale to fit coordinates
      filters.push(`scale=${coords.width}:${coords.height}`);

      // Add effects
      if (effects.opacity < 1) {
        filters.push(`format=rgba,colorchannelmixer=aa=${effects.opacity}`);
      }

      if (effects.blur > 0) {
        filters.push(`gblur=sigma=${effects.blur}`);
      }

      // Create video from image with loop
      ffmpeg(inputPath)
        .videoFilter([
          ...filters,
          `loop=loop=-1:size=1:start=0`,
          `pad=${canvasWidth}:${canvasHeight}:${coords.left}:${coords.top}:black`
        ])
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
    return new Promise((resolve, reject) => {
      const allLayers = [...videoLayers, ...imageLayers, ...textLayers]
        .sort((a, b) => a.zIndex - b.zIndex);

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

      let command = ffmpeg();
      
      // Add all layer inputs
      allLayers.forEach(layer => {
        command = command.input(layer.path);
      });

      // Add audio if available
      if (audioTrack) {
        command = command.input(audioTrack);
      }

      // Build complex filter for layering
      const filterParts = [];
      let currentOutput = '[0:v]';

      for (let i = 1; i < allLayers.length; i++) {
        const nextOutput = i === allLayers.length - 1 ? '' : `[tmp${i}]`;
        filterParts.push(`${currentOutput}[${i}:v]overlay${nextOutput}`);
        currentOutput = `[tmp${i}]`;
      }

      if (filterParts.length > 0) {
        command = command.complexFilter(filterParts.join(';'));
      }

      command
        .outputOptions([
          '-c:v libx264',
          '-preset medium',
          '-crf 20',
          '-pix_fmt yuv420p',
          '-movflags +faststart'
        ]);

      if (audioTrack) {
        command = command.outputOptions(['-c:a aac', '-b:a 128k']);
      }

      command
        .output(outputPath)
        .on('progress', (progress) => {
          onProgress?.(progress.percent || 0);
        })
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }
}
