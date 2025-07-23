import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VideoRenderer {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initializeBrowser() {
    if (!this.browser) {
      console.log('🌐 Launching Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  async createPage() {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();
    
    // Set viewport to match video dimensions
    await page.setViewport({
      width: 1080,
      height: 1920,
      deviceScaleFactor: 1
    });

    return page;
  }

  async renderVideo(projectData, renderId, renderJobs) {
    let page = null;
    
    try {
      console.log(`🎬 Starting Puppeteer render for ${renderId}`);
      
      // Update progress
      this.updateProgress(renderJobs, renderId, 10, 'Initializing browser...');
      
      page = await this.createPage();
      
      // Create React app HTML
      const htmlContent = this.generateReactHTML(projectData);
      const htmlPath = path.join(__dirname, '..', 'storage', 'temp', `${renderId}.html`);
      await fs.writeFile(htmlPath, htmlContent);
      
      // Navigate to the HTML file
      await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
      
      // Wait for React to initialize
      await page.waitForFunction(() => window.videoEditorReady === true, { timeout: 10000 });
      
      this.updateProgress(renderJobs, renderId, 20, 'React app loaded, starting frame capture...');
      
      // Calculate video parameters
      const fps = projectData.fps || 30;
      const duration = this.calculateDuration(projectData);
      const totalFrames = Math.ceil((duration / 1000) * fps);
      
      console.log(`📊 Video parameters: ${duration}ms duration, ${fps}fps, ${totalFrames} frames`);
      
      // Create frames directory
      const framesDir = path.join(__dirname, '..', 'storage', 'temp', `frames_${renderId}`);
      await fs.ensureDir(framesDir);
      
      // Capture frames
      for (let frame = 0; frame < totalFrames; frame++) {
        const timeMs = (frame / fps) * 1000;
        
        // Set current frame time
        await page.evaluate((time) => {
          if (window.setFrame) {
            window.setFrame(time);
          }
        }, timeMs);
        
        // Wait a bit for rendering
        await page.waitForTimeout(100);
        
        // Capture screenshot
        const framePath = path.join(framesDir, `${frame.toString().padStart(6, '0')}.png`);
        await page.screenshot({
          path: framePath,
          type: 'png',
          clip: {
            x: 0,
            y: 0,
            width: projectData.size?.width || 1080,
            height: projectData.size?.height || 1920
          }
        });
        
        // Update progress
        const progress = 20 + Math.floor((frame / totalFrames) * 60);
        this.updateProgress(renderJobs, renderId, progress, `Capturing frame ${frame + 1}/${totalFrames}`);
      }
      
      this.updateProgress(renderJobs, renderId, 80, 'Frames captured, generating video...');
      
      // Generate video with FFmpeg
      const outputPath = await this.generateVideoWithFFmpeg(
        framesDir, 
        projectData, 
        renderId, 
        fps, 
        renderJobs
      );
      
      // Cleanup
      await fs.remove(framesDir);
      await fs.remove(htmlPath);
      
      return outputPath;
      
    } catch (error) {
      console.error(`❌ Render error for ${renderId}:`, error);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  generateReactHTML(projectData) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Editor Renderer</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            overflow: hidden;
        }
        #video-canvas {
            width: ${projectData.size?.width || 1080}px;
            height: ${projectData.size?.height || 1920}px;
            position: relative;
            background: #000;
        }
        .video-item {
            position: absolute;
            overflow: hidden;
        }
        .video-item video,
        .video-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .text-item {
            position: absolute;
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
    </style>
</head>
<body>
    <div id="video-canvas"></div>
    
    <script>
        let currentTime = 0;
        const projectData = ${JSON.stringify(projectData)};
        
        window.videoEditorReady = false;
        
        function setFrame(timeMs) {
            currentTime = timeMs;
            renderFrame();
        }
        
        function renderFrame() {
            const canvas = document.getElementById('video-canvas');
            canvas.innerHTML = '';

            // Render each track item
            projectData.trackItemIds.forEach(itemId => {
                const itemDetails = projectData.trackItemDetailsMap[itemId];
                const trackItem = projectData.trackItemsMap[itemId];

                if (!itemDetails || !trackItem) return;

                // Check if item should be visible at current time
                const startTime = trackItem.display?.from || 0;
                const endTime = trackItem.display?.to || 5000;

                if (currentTime >= startTime && currentTime <= endTime) {
                    // Combine the data structures to match your frontend
                    const combinedItem = {
                        ...itemDetails,
                        display: trackItem.display,
                        trim: trackItem.trim
                    };
                    renderItem(combinedItem, canvas);
                }
            });
        }
        
        function renderItem(item, canvas) {
            const element = document.createElement('div');
            element.className = item.type === 'text' ? 'text-item' : 'video-item';

            // Use the correct data structure - your frontend uses 'details' not 'fabricObject'
            const details = item.details || {};

            // Parse positioning - your frontend uses string values like "100px", "-100px"
            const left = parseFloat(details.left) || 0;
            const top = parseFloat(details.top) || 0;
            const width = details.width || 100;
            const height = details.height || 100;

            // Apply positioning and styling to match your frontend
            element.style.position = 'absolute';
            element.style.left = left + 'px';
            element.style.top = top + 'px';
            element.style.width = width + 'px';
            element.style.height = height + 'px';

            // Apply opacity (your frontend uses 0-100, convert to 0-1)
            if (details.opacity !== undefined) {
                element.style.opacity = details.opacity / 100;
            }

            // Apply transform (your frontend uses transform strings like "scale(0.84375)")
            if (details.transform) {
                element.style.transform = details.transform;
            }

            // Apply effects
            let filters = [];
            if (details.blur) filters.push(\`blur(\${details.blur}px)\`);
            if (details.brightness !== undefined && details.brightness !== 100) {
                filters.push(\`brightness(\${details.brightness}%)\`);
            }
            if (filters.length > 0) {
                element.style.filter = filters.join(' ');
            }

            // Handle different item types
            if (item.type === 'text') {
                element.textContent = details.text || 'Sample Text';
                element.style.fontSize = (details.fontSize || 24) + 'px';
                element.style.color = details.color || '#ffffff';
                element.style.fontFamily = details.fontFamily || 'Arial';
                element.style.fontWeight = details.fontWeight || 'normal';
                element.style.display = 'flex';
                element.style.alignItems = 'center';
                element.style.justifyContent = 'center';
                element.style.textAlign = 'center';
            } else if (item.type === 'image') {
                const mediaElement = document.createElement('img');
                mediaElement.src = details.src;
                mediaElement.style.width = '100%';
                mediaElement.style.height = '100%';
                mediaElement.style.objectFit = 'cover';
                element.appendChild(mediaElement);
            } else if (item.type === 'video') {
                const mediaElement = document.createElement('video');
                mediaElement.src = details.src;
                mediaElement.style.width = '100%';
                mediaElement.style.height = '100%';
                mediaElement.style.objectFit = 'cover';
                mediaElement.muted = true;

                // Set video time based on current frame time and trim settings
                const videoTime = (currentTime - (item.display?.from || 0)) / 1000;
                const trimStart = (item.trim?.from || 0) / 1000;
                mediaElement.currentTime = trimStart + videoTime;

                element.appendChild(mediaElement);
            }

            canvas.appendChild(element);
        }
        
        // Initialize
        window.setFrame = setFrame;
        renderFrame();
        window.videoEditorReady = true;
        
        console.log('Video editor renderer ready');
    </script>
</body>
</html>`;
  }

  calculateDuration(projectData) {
    let maxDuration = 5000; // Default 5 seconds
    
    projectData.trackItemIds.forEach(itemId => {
      const item = projectData.trackItemDetailsMap[itemId];
      if (item && item.display && item.display.to) {
        maxDuration = Math.max(maxDuration, item.display.to);
      }
    });
    
    return maxDuration;
  }

  async generateVideoWithFFmpeg(framesDir, projectData, renderId, fps, renderJobs) {
    return new Promise(async (resolve, reject) => {
      try {
        const outputPath = path.join(__dirname, '..', 'storage', 'renders', `${renderId}.mp4`);

        // Calculate video duration
        const duration = this.calculateDuration(projectData);
        const videoDurationSeconds = duration / 1000;

        console.log(`🎬 Starting FFmpeg with ${videoDurationSeconds}s duration`);

        // Create FFmpeg command for video
        let command = ffmpeg()
          .input(path.join(framesDir, '%06d.png'))
          .inputFPS(fps)
          .videoCodec('libx264')
          .outputOptions([
            '-pix_fmt yuv420p',
            '-preset fast',
            '-crf 23'
          ])
          .fps(fps);

        // Process audio tracks
        const audioItems = projectData.trackItemIds
          .map(id => {
            const itemDetails = projectData.trackItemDetailsMap[id];
            const trackItem = projectData.trackItemsMap[id];
            return itemDetails && trackItem && itemDetails.type === 'audio' ? {
              details: itemDetails.details,
              display: trackItem.display,
              trim: trackItem.trim || {}
            } : null;
          })
          .filter(item => item !== null);

        console.log(`🎵 Found ${audioItems.length} audio track(s)`);

        if (audioItems.length > 0) {
          // Process audio using the exact same approach as backend-custom
          const audioItem = audioItems[0];
          const audioSrc = audioItem.details.src;

          if (audioSrc) {
            console.log(`🎵 Adding audio: ${audioSrc}`);

            // Use fluent-ffmpeg's built-in methods like backend-custom does
            command = command.input(audioSrc);

            // Extract audio properties like backend-custom
            const volume = this.extractVolume(audioItem.details);
            const timing = audioItem.display || {};
            const trim = audioItem.trim || {};

            const startTime = (timing.from || 0) / 1000;
            const endTime = (timing.to || duration) / 1000;
            const layerDuration = endTime - startTime;

            console.log(`🎵 Audio properties: volume=${volume}, startTime=${startTime}s, duration=${layerDuration}s`);
            console.log(`🎵 Trim settings: from=${trim.from || 0}ms, to=${trim.to || 'end'}`);

            // Apply trimming using seekInput and duration like backend-custom
            if (trim.from !== undefined) {
              command = command.seekInput(trim.from / 1000);
            }

            if (trim.to !== undefined) {
              const trimDuration = (trim.to - (trim.from || 0)) / 1000;
              command = command.inputOptions([`-t`, trimDuration.toString()]);
            }

            // Build audio filter chain for volume and delay
            const filters = [];

            // Volume adjustment
            if (volume !== 1) {
              filters.push(`volume=${volume}`);
            }

            // Apply delay for display timing (if audio should start later)
            if (startTime > 0) {
              filters.push(`adelay=${Math.floor(startTime * 1000)}|${Math.floor(startTime * 1000)}`);
            }

            // Apply filters if any
            if (filters.length > 0) {
              command = command.audioFilters(filters);
            }

            // Set audio codec and quality
            command = command
              .audioCodec('aac')
              .audioBitrate('128k')
              .audioChannels(2)
              .audioFrequency(44100);
          }
        } else {
          console.log('🔇 No audio tracks found, creating video without audio');
        }

        // Set video duration to match calculated duration
        command = command.duration(videoDurationSeconds);

        command
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('🎬 FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            const percent = Math.min(80 + Math.floor((progress.percent || 0) * 0.2), 99);
            this.updateProgress(renderJobs, renderId, percent, `Encoding video: ${Math.floor(progress.percent || 0)}%`);
          })
          .on('end', () => {
            console.log('✅ FFmpeg completed successfully');
            resolve(outputPath);
          })
          .on('error', (error) => {
            console.error('❌ FFmpeg error:', error);
            reject(error);
          })
          .run();

      } catch (error) {
        console.error('❌ Audio processing setup error:', error);
        reject(error);
      }
    });
  }

  /**
   * Extract volume from audio details (like backend-custom)
   */
  extractVolume(details) {
    let volume = 1;

    if (details.volume !== undefined) {
      if (details.volume <= 1) {
        volume = details.volume;
      } else {
        volume = details.volume / 100; // Convert percentage
      }
    }

    return Math.max(0, Math.min(2, volume)); // Clamp between 0 and 2
  }

  updateProgress(renderJobs, renderId, progress, message) {
    const job = renderJobs.get(renderId);
    if (job) {
      renderJobs.set(renderId, {
        ...job,
        progress,
        message
      });
    }
    console.log(`📊 ${renderId}: ${progress}% - ${message}`);
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
