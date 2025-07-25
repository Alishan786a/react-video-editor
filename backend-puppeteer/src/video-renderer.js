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

      this.updateProgress(renderJobs, renderId, 20, 'React app loaded, preloading videos...');

      // Preload all videos to prevent black screen at start
      await page.evaluate(async () => {
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length > 0) {
          console.log(`Preloading ${videos.length} video(s)...`);

          // Wait for all videos to load enough data
          await Promise.all(videos.map(video => {
            return new Promise(resolve => {
              if (video.readyState >= 3) { // HAVE_FUTURE_DATA
                console.log('Video already loaded');
                resolve();
                return;
              }

              const onCanPlay = () => {
                console.log('Video can play');
                video.removeEventListener('canplay', onCanPlay);
                video.removeEventListener('loadeddata', onLoadedData);
                resolve();
              };

              const onLoadedData = () => {
                if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                  console.log('Video data loaded');
                  video.removeEventListener('canplay', onCanPlay);
                  video.removeEventListener('loadeddata', onLoadedData);
                  resolve();
                }
              };

              video.addEventListener('canplay', onCanPlay);
              video.addEventListener('loadeddata', onLoadedData);

              // Force load if not already loading
              if (video.readyState === 0) {
                console.log('Force loading video');
                video.load();
              }

              // Timeout fallback
              setTimeout(() => {
                console.log('Video preload timeout');
                video.removeEventListener('canplay', onCanPlay);
                video.removeEventListener('loadeddata', onLoadedData);
                resolve();
              }, 5000);
            });
          }));

          console.log('All videos preloaded successfully');

          // Ensure all videos start at time 0
          videos.forEach(video => {
            video.currentTime = 0;
          });

          console.log('All videos reset to start time');
        }
      });

      this.updateProgress(renderJobs, renderId, 20, 'Videos preloaded, starting frame capture...');

      // Calculate video parameters
      const fps = projectData.fps || 30;
      const duration = this.calculateDuration(projectData);
      const totalFrames = Math.ceil((duration / 1000) * fps);
      
      console.log(`📊 Video parameters: ${duration}ms duration, ${fps}fps, ${totalFrames} frames`);
      
      // Create frames directory
      const framesDir = path.join(__dirname, '..', 'storage', 'temp', `frames_${renderId}`);
      await fs.ensureDir(framesDir);
      
      // Capture frames with optimized timing for smooth video
      for (let frame = 0; frame < totalFrames; frame++) {
        // Use precise frame timing for smooth playback
        const timeMs = Math.round((frame / fps) * 1000 * 100) / 100; // Round to 2 decimal places

        // Set current frame time with improved synchronization
        await page.evaluate((time) => {
          if (window.setFrame) {
            window.setFrame(time);
          }

          // Enhanced frame synchronization for smoother video
          return new Promise(resolve => {
            // Wait for multiple animation frames to ensure stability
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                  // Force layout recalculation
                  document.body.offsetHeight;
                  resolve();
                });
              });
            });
          });
        }, timeMs);

        // For the first frame, give extra time to ensure video is properly loaded
        if (frame === 0) {
          await page.waitForTimeout(200); // Extra wait for first frame
        } else {
          await page.waitForTimeout(50); // Normal wait for other frames
        }

        // Optimized waiting for smoother video rendering
        await page.waitForTimeout(50); // Reduced from 200ms to 50ms

        // Wait for media elements to be ready and videos to seek properly
        await page.evaluate(() => {
          return Promise.all([
            // Wait for images to load
            ...Array.from(document.querySelectorAll('img')).map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 500);
              });
            }),
            // Wait for videos to be ready and properly seeked
            ...Array.from(document.querySelectorAll('video')).map(video => {
              return new Promise(resolve => {
                const targetTime = parseFloat(video.dataset.targetTime || '0');

                // Check if video is ready and at the correct time
                const isReady = video.readyState >= 2; // HAVE_CURRENT_DATA
                const isAtCorrectTime = Math.abs(video.currentTime - targetTime) < 0.1;

                if (isReady && isAtCorrectTime) {
                  resolve();
                  return;
                }

                // Wait for video to seek to correct time
                const onSeeked = () => {
                  video.removeEventListener('seeked', onSeeked);
                  video.removeEventListener('loadeddata', onLoadedData);
                  resolve();
                };

                const onLoadedData = () => {
                  if (video.readyState >= 2) {
                    video.removeEventListener('seeked', onSeeked);
                    video.removeEventListener('loadeddata', onLoadedData);
                    resolve();
                  }
                };

                video.addEventListener('seeked', onSeeked);
                video.addEventListener('loadeddata', onLoadedData);

                // Force seek if needed
                if (Math.abs(video.currentTime - targetTime) > 0.1) {
                  video.currentTime = targetTime;
                }

                // Timeout fallback
                setTimeout(() => {
                  video.removeEventListener('seeked', onSeeked);
                  video.removeEventListener('loadeddata', onLoadedData);
                  resolve();
                }, 1000);
              });
            })
          ]);
        });

        // Minimal additional wait for final rendering
        await page.waitForTimeout(25); // Reduced from 100ms to 25ms

        // Capture screenshot with optimized settings for smooth video
        const framePath = path.join(framesDir, `${frame.toString().padStart(6, '0')}.png`);
        await page.screenshot({
          path: framePath,
          type: 'png',
          // Note: PNG doesn't support quality setting, it's lossless by default
          clip: {
            x: 0,
            y: 0,
            width: projectData.size?.width || 1080,
            height: projectData.size?.height || 1920
          },
          omitBackground: false,
          optimizeForSpeed: false, // Prioritize quality over speed
          captureBeyondViewport: false // Ensure consistent framing
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
            /* Prevent text selection and improve rendering */
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            /* Improve rendering performance */
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        #video-canvas {
            width: ${projectData.size?.width || 1080}px;
            height: ${projectData.size?.height || 1920}px;
            position: relative;
            background: #000;
            /* Prevent layout shifts and improve performance */
            contain: layout style paint;
            will-change: contents;
            /* Prevent blinking by ensuring smooth transitions */
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
        }
        .video-item {
            position: absolute;
            overflow: hidden;
            /* Improve performance and prevent blinking */
            will-change: transform, opacity;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            /* Ensure smooth transitions */
            transition: opacity 0.1s ease-out;
            /* Ensure no default border radius */
            border-radius: 0px;
        }
        .video-item video,
        .video-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            /* Prevent image/video flickering */
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            /* Smooth scaling and rendering */
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
            /* Ensure no default border radius */
            border-radius: 0px;
        }
        .text-item {
            position: absolute;
            color: white;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            /* Prevent text rendering issues and blinking */
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
            will-change: transform, opacity;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            /* Ensure smooth transitions */
            transition: opacity 0.1s ease-out;
        }

        /* Font loading CSS */
        ${this.generateFontCSS(projectData)}
    </style>
</head>
<body>
    <div id="video-canvas"></div>
    
    <script>
        let currentTime = 0;
        const projectData = ${JSON.stringify(projectData)};

        window.videoEditorReady = false;

        // Font parsing function for browser context
        function parseFontName(postScriptName) {
            if (!postScriptName) {
                return { family: 'Arial', weight: 'normal', style: 'normal' };
            }

            // Split by last dash to separate family from style
            const lastDashIndex = postScriptName.lastIndexOf('-');
            if (lastDashIndex === -1) {
                return { family: postScriptName, weight: 'normal', style: 'normal' };
            }

            const family = postScriptName.substring(0, lastDashIndex);
            const styleString = postScriptName.substring(lastDashIndex + 1).toLowerCase();

            // Determine if italic
            const isItalic = styleString.includes('italic');
            const style = isItalic ? 'italic' : 'normal';

            // Determine weight
            let weight = 'normal';
            if (styleString.includes('thin')) weight = '100';
            else if (styleString.includes('extralight') || styleString.includes('ultralight')) weight = '200';
            else if (styleString.includes('light')) weight = '300';
            else if (styleString.includes('regular') || styleString.includes('normal')) weight = '400';
            else if (styleString.includes('medium')) weight = '500';
            else if (styleString.includes('semibold') || styleString.includes('demibold')) weight = '600';
            else if (styleString.includes('bold')) weight = '700';
            else if (styleString.includes('extrabold') || styleString.includes('ultrabold')) weight = '800';
            else if (styleString.includes('black') || styleString.includes('heavy')) weight = '900';

            return { family, weight, style };
        }
        
        function setFrame(timeMs) {
            currentTime = timeMs;
            renderFrame();
        }
        
        function renderFrame() {
            const canvas = document.getElementById('video-canvas');

            // Instead of clearing and re-rendering everything, update existing elements
            // This prevents blinking by maintaining DOM stability
            const existingElements = new Map();
            Array.from(canvas.children).forEach(el => {
                if (el.dataset.itemId) {
                    existingElements.set(el.dataset.itemId, el);
                }
            });

            const activeItems = new Set();

            // Render each track item
            projectData.trackItemIds.forEach(itemId => {
                const itemDetails = projectData.trackItemDetailsMap[itemId];
                const trackItem = projectData.trackItemsMap[itemId];

                if (!itemDetails || !trackItem) return;

                // Check if item should be visible at current time
                const startTime = trackItem.display?.from || 0;
                const endTime = trackItem.display?.to || 5000;

                if (currentTime >= startTime && currentTime <= endTime) {
                    activeItems.add(itemId);

                    // Combine the data structures to match your frontend
                    const combinedItem = {
                        ...itemDetails,
                        display: trackItem.display,
                        trim: trackItem.trim
                    };

                    // Update existing element or create new one
                    if (existingElements.has(itemId)) {
                        updateItem(combinedItem, existingElements.get(itemId));
                    } else {
                        const newElement = createItem(combinedItem, itemId);
                        canvas.appendChild(newElement);
                    }
                }
            });

            // Hide items that should not be visible (instead of removing them)
            existingElements.forEach((element, itemId) => {
                if (!activeItems.has(itemId)) {
                    element.style.display = 'none';
                } else {
                    element.style.display = element.dataset.originalDisplay || 'block';
                }
            });
        }
        
        function createItem(item, itemId) {
            const element = document.createElement('div');
            element.className = item.type === 'text' ? 'text-item' : 'video-item';
            element.dataset.itemId = itemId;
            element.dataset.itemType = item.type;

            // Store original display value
            element.dataset.originalDisplay = item.type === 'text' ? 'flex' : 'block';

            updateItem(item, element);
            return element;
        }

        function updateItem(item, element) {
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

            // Apply transform (including rotation from nested details.details.transform)
            // Frontend stores rotation in details.details.transform and scale in details.transform
            let finalTransform = '';

            // Extract rotation from nested transform if it exists
            let rotationPart = '';
            if (details.details && details.details.transform) {
                // Extract only the rotation part from nested transform
                const rotateMatch = details.details.transform.match(/rotate\([^)]+\)/);
                if (rotateMatch) {
                    rotationPart = rotateMatch[0];
                }
            }

            // Use main transform (usually scale) as the base
            if (details.transform) {
                finalTransform = details.transform;
            }

            // Add rotation if found
            if (rotationPart) {
                if (finalTransform) {
                    finalTransform += ' ' + rotationPart;
                } else {
                    finalTransform = rotationPart;
                }
            }

            // Apply the combined transform
            if (finalTransform) {
                element.style.transform = finalTransform;
                console.log('🔄 Applied transform to ' + item.id + ': ' + finalTransform);
            }

            // Apply border radius using the exact same formula as frontend
            // Frontend formula: Math.min(width, height) * (borderRadius / 100) + 'px'
            if (details.borderRadius !== undefined) {
                const borderRadiusValue = details.borderRadius || 0;
                const borderRadiusPx = Math.min(width, height) * (borderRadiusValue / 100);
                element.style.borderRadius = borderRadiusPx + 'px';
            }

            // Apply outline and shadow using the exact same formula as frontend
            // Frontend combines outline and shadow into a single box-shadow property
            // BUT: For text elements, these should be handled as text effects, not container effects
            if (item.type !== 'text') {
                const boxShadowParts = [];

                // Add outline (border) as box-shadow: "0 0 0 [borderWidth]px [borderColor]"
                if (details.borderWidth && details.borderWidth > 0) {
                    const borderWidth = details.borderWidth;
                    const borderColor = details.borderColor || '#000000';
                    boxShadowParts.push('0 0 0 ' + borderWidth + 'px ' + borderColor);
                }

                // Add shadow: "[x]px [y]px [blur]px [color]"
                if (details.boxShadow && (details.boxShadow.x !== 0 || details.boxShadow.y !== 0 || details.boxShadow.blur !== 0)) {
                    const shadow = details.boxShadow;
                    const x = shadow.x || 0;
                    const y = shadow.y || 0;
                    const blur = shadow.blur || 0;
                    const color = shadow.color || '#000000';
                    boxShadowParts.push(x + 'px ' + y + 'px ' + blur + 'px ' + color);
                }

                // Apply combined box-shadow
                if (boxShadowParts.length > 0) {
                    element.style.boxShadow = boxShadowParts.join(', ');
                } else {
                    element.style.boxShadow = 'none';
                }
            }

            // Apply background properties
            if (details.backgroundColor) {
                element.style.backgroundColor = details.backgroundColor;
            }
            if (details.background) {
                element.style.background = details.background;
            }

            // Apply effects
            let filters = [];
            if (details.blur) filters.push(\`blur(\${details.blur}px)\`);
            if (details.brightness !== undefined && details.brightness !== 100) {
                filters.push(\`brightness(\${details.brightness}%)\`);
            }
            if (details.contrast !== undefined && details.contrast !== 100) {
                filters.push(\`contrast(\${details.contrast}%)\`);
            }
            if (details.saturate !== undefined && details.saturate !== 100) {
                filters.push(\`saturate(\${details.saturate}%)\`);
            }
            if (details.hueRotate !== undefined && details.hueRotate !== 0) {
                filters.push(\`hue-rotate(\${details.hueRotate}deg)\`);
            }
            if (details.sepia !== undefined && details.sepia !== 0) {
                filters.push(\`sepia(\${details.sepia}%)\`);
            }
            if (details.grayscale !== undefined && details.grayscale !== 0) {
                filters.push(\`grayscale(\${details.grayscale}%)\`);
            }
            if (filters.length > 0) {
                element.style.filter = filters.join(' ');
            }

            // Handle different item types
            if (item.type === 'text') {
                element.textContent = details.text || 'Sample Text';
                element.style.fontSize = (details.fontSize || 24) + 'px';
                element.style.color = details.color || '#ffffff';

                // Parse font family from postScriptName and apply correct font properties
                if (details.fontFamily) {
                    const { family, weight, style } = parseFontName(details.fontFamily);
                    element.style.fontFamily = "'" + family + "', Arial, sans-serif";
                    element.style.fontWeight = weight;
                    element.style.fontStyle = style;
                    console.log('🔤 Applied font: ' + family + ' (weight: ' + weight + ', style: ' + style + ') from ' + details.fontFamily);
                } else {
                    element.style.fontFamily = 'Arial, sans-serif';
                    element.style.fontWeight = details.fontWeight || 'normal';
                    element.style.fontStyle = details.fontStyle || 'normal';
                }

                element.style.display = 'flex';
                element.style.alignItems = 'center';
                element.style.justifyContent = 'center';
                element.style.textAlign = details.textAlign || 'center';

                // Additional text styling properties
                if (details.textDecoration) {
                    element.style.textDecoration = details.textDecoration;
                }
                if (details.lineHeight !== undefined) {
                    element.style.lineHeight = typeof details.lineHeight === 'number'
                        ? details.lineHeight
                        : details.lineHeight;
                }
                if (details.letterSpacing !== undefined) {
                    element.style.letterSpacing = typeof details.letterSpacing === 'number'
                        ? details.letterSpacing + 'px'
                        : details.letterSpacing;
                }
                if (details.wordSpacing !== undefined) {
                    element.style.wordSpacing = typeof details.wordSpacing === 'number'
                        ? details.wordSpacing + 'px'
                        : details.wordSpacing;
                }

                // Text transform (uppercase, lowercase, capitalize, etc.)
                if (details.textTransform) {
                    element.style.textTransform = details.textTransform;
                }

                // Text stroke (border for text) - Create smooth stroke using circular text-shadow pattern
                if (details.borderWidth && details.borderWidth > 0) {
                    const originalStrokeWidth = details.borderWidth;
                    const strokeColor = details.borderColor || '#000000';

                    // Adjust stroke width to match WebkitTextStroke appearance
                    // text-shadow typically appears ~60% thicker than WebkitTextStroke
                    const adjustedStrokeWidth = originalStrokeWidth * 0.6;

                    // Create smooth circular stroke using many text-shadow positions
                    const shadows = [];
                    const steps = Math.max(8, originalStrokeWidth * 4); // More steps for smoother stroke

                    for (let i = 0; i < steps; i++) {
                        const angle = (i * 2 * Math.PI) / steps;
                        const x = Math.cos(angle) * adjustedStrokeWidth;
                        const y = Math.sin(angle) * adjustedStrokeWidth;
                        shadows.push(x.toFixed(2) + 'px ' + y.toFixed(2) + 'px 0px ' + strokeColor);
                    }

                    element.style.textShadow = shadows.join(', ');
                    console.log('🔲 Applied smooth stroke: ' + originalStrokeWidth + 'px -> ' + adjustedStrokeWidth.toFixed(2) + 'px (' + steps + ' shadows)');

                    // Ensure text color is properly set and visible
                    element.style.color = details.color || '#ffffff';

                } else if (details.WebkitTextStrokeWidth && details.WebkitTextStrokeWidth !== '0px') {
                    // Fallback: Convert WebkitTextStroke to smooth circular text-shadow
                    const originalStrokeWidth = parseFloat(details.WebkitTextStrokeWidth);
                    const strokeColor = details.WebkitTextStrokeColor || '#000000';

                    if (originalStrokeWidth > 0) {
                        // Adjust stroke width to match WebkitTextStroke appearance
                        const adjustedStrokeWidth = originalStrokeWidth * 0.6;

                        const shadows = [];
                        const steps = Math.max(8, originalStrokeWidth * 4); // More steps for smoother stroke

                        for (let i = 0; i < steps; i++) {
                            const angle = (i * 2 * Math.PI) / steps;
                            const x = Math.cos(angle) * adjustedStrokeWidth;
                            const y = Math.sin(angle) * adjustedStrokeWidth;
                            shadows.push(x.toFixed(2) + 'px ' + y.toFixed(2) + 'px 0px ' + strokeColor);
                        }

                        element.style.textShadow = shadows.join(', ');
                        console.log('🔲 Applied fallback smooth stroke: ' + originalStrokeWidth + 'px -> ' + adjustedStrokeWidth.toFixed(2) + 'px (' + steps + ' shadows)');
                    }

                    element.style.color = details.color || '#ffffff';
                }

                // For text elements, boxShadow should be applied as textShadow
                // But only if we haven't already applied stroke shadows
                if (!element.style.textShadow) {
                    if (details.boxShadow && (details.boxShadow.x !== 0 || details.boxShadow.y !== 0 || details.boxShadow.blur !== 0)) {
                        const shadow = details.boxShadow;
                        const x = shadow.x || 0;
                        const y = shadow.y || 0;
                        const blur = shadow.blur || 0;
                        const color = shadow.color || '#000000';
                        element.style.textShadow = x + 'px ' + y + 'px ' + blur + 'px ' + color;
                    } else if (details.textShadow) {
                        element.style.textShadow = details.textShadow;
                    }
                } else if (details.boxShadow && (details.boxShadow.x !== 0 || details.boxShadow.y !== 0 || details.boxShadow.blur !== 0)) {
                    // If we already have stroke shadows, add the drop shadow to them
                    const shadow = details.boxShadow;
                    const x = shadow.x || 0;
                    const y = shadow.y || 0;
                    const blur = shadow.blur || 0;
                    const color = shadow.color || '#000000';
                    element.style.textShadow += ', ' + x + 'px ' + y + 'px ' + blur + 'px ' + color;
                }

                // Text alignment within the container
                if (details.justifyContent) {
                    element.style.justifyContent = details.justifyContent;
                }
                if (details.alignItems) {
                    element.style.alignItems = details.alignItems;
                }

                // Override box-shadow for text elements (should not have container shadows)
                element.style.boxShadow = 'none';
            } else if (item.type === 'image') {
                // Create wrapper structure like frontend: outer element (shadow) + inner wrapper (flip) + image
                let innerWrapper = element.querySelector('.flip-wrapper');
                if (!innerWrapper) {
                    innerWrapper = document.createElement('div');
                    innerWrapper.className = 'flip-wrapper';
                    innerWrapper.style.width = width + 'px';
                    innerWrapper.style.height = height + 'px';
                    innerWrapper.style.position = 'relative';
                    innerWrapper.style.overflow = 'hidden';
                    innerWrapper.style.pointerEvents = 'none';
                    element.appendChild(innerWrapper);
                }

                // Apply flip transforms to inner wrapper (frontend uses scale property)
                const scaleX = details.flipX ? '-1' : '1';
                const scaleY = details.flipY ? '-1' : '1';
                innerWrapper.style.scale = scaleX + ' ' + scaleY;

                // Only create image element if it doesn't exist
                let mediaElement = innerWrapper.querySelector('img');
                if (!mediaElement) {
                    mediaElement = document.createElement('img');
                    mediaElement.style.width = '100%';
                    mediaElement.style.height = '100%';
                    mediaElement.style.objectFit = 'cover';
                    mediaElement.style.position = 'absolute';
                    mediaElement.style.top = '0';
                    mediaElement.style.left = '0';
                    innerWrapper.appendChild(mediaElement);
                }

                // Update src only if changed to prevent reloading
                if (mediaElement.src !== details.src) {
                    mediaElement.src = details.src;
                }

                // Apply object fit if specified
                if (details.objectFit) {
                    mediaElement.style.objectFit = details.objectFit;
                }

            } else if (item.type === 'video') {
                // Create wrapper structure like frontend: outer element (shadow) + inner wrapper (flip) + video
                let innerWrapper = element.querySelector('.flip-wrapper');
                if (!innerWrapper) {
                    innerWrapper = document.createElement('div');
                    innerWrapper.className = 'flip-wrapper';
                    innerWrapper.style.width = width + 'px';
                    innerWrapper.style.height = height + 'px';
                    innerWrapper.style.position = 'relative';
                    innerWrapper.style.overflow = 'hidden';
                    innerWrapper.style.pointerEvents = 'none';
                    element.appendChild(innerWrapper);
                }

                // Apply flip transforms to inner wrapper (frontend uses scale property)
                const scaleX = details.flipX ? '-1' : '1';
                const scaleY = details.flipY ? '-1' : '1';
                innerWrapper.style.scale = scaleX + ' ' + scaleY;

                // Only create video element if it doesn't exist
                let mediaElement = innerWrapper.querySelector('video');
                if (!mediaElement) {
                    mediaElement = document.createElement('video');
                    mediaElement.style.width = '100%';
                    mediaElement.style.height = '100%';
                    mediaElement.style.objectFit = 'cover';
                    mediaElement.style.position = 'absolute';
                    mediaElement.style.top = '0';
                    mediaElement.style.left = '0';
                    mediaElement.muted = true;
                    mediaElement.preload = 'metadata'; // Preload metadata for seeking
                    mediaElement.playsInline = true; // Ensure inline playback
                    mediaElement.crossOrigin = 'anonymous'; // Handle CORS if needed
                    innerWrapper.appendChild(mediaElement);
                }

                // Update src only if changed and ensure video loads
                if (mediaElement.src !== details.src) {
                    mediaElement.src = details.src;
                    // Force load the video and reset to start
                    mediaElement.load();
                    mediaElement.currentTime = 0;
                }

                // Apply object fit if specified
                if (details.objectFit) {
                    mediaElement.style.objectFit = details.objectFit;
                }

                // Set video time based on current frame time and trim settings
                const videoTime = (currentTime - (item.display?.from || 0)) / 1000;
                const trimStart = (item.trim?.from || 0) / 1000;
                const targetTime = Math.max(0, trimStart + videoTime);

                // Always update video time for proper frame display
                mediaElement.currentTime = targetTime;

                // Store the target time for verification
                mediaElement.dataset.targetTime = targetTime.toString();
            }
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
    // First, check if maxTime is explicitly provided in the payload
    if (projectData.maxTime && projectData.maxTime > 0) {
      console.log(`📏 Using explicit maxTime from payload: ${projectData.maxTime}ms`);
      return projectData.maxTime;
    }

    // Otherwise, calculate from track items
    let maxDuration = 5000; // Default 5 seconds

    projectData.trackItemIds.forEach(itemId => {
      // Look in trackItemsMap for display timing, not trackItemDetailsMap
      const item = projectData.trackItemsMap[itemId];
      if (item && item.display && item.display.to) {
        maxDuration = Math.max(maxDuration, item.display.to);
        console.log(`📏 Item ${itemId} duration: ${item.display.to}ms`);
      }
    });

    console.log(`📏 Calculated total duration: ${maxDuration}ms`);
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

        // Create FFmpeg command for video with optimized settings for smoothness
        let command = ffmpeg()
          .input(path.join(framesDir, '%06d.png'))
          .inputFPS(fps)
          .videoCodec('libx264')
          .outputOptions([
            '-pix_fmt yuv420p',
            '-preset medium', // Better quality than 'fast'
            '-crf 18', // Higher quality (lower CRF = better quality)
            '-movflags +faststart', // Optimize for web playback
            '-profile:v high', // H.264 high profile for better compression
            '-level 4.0', // H.264 level for compatibility
            '-bf 2', // B-frames for better compression
            '-g ' + (fps * 2), // GOP size (keyframe interval)
            '-keyint_min ' + fps, // Minimum keyframe interval
            '-sc_threshold 0', // Disable scene change detection
            '-force_key_frames expr:gte(t,n_forced*2)', // Force keyframes every 2 seconds
            '-vsync cfr', // Constant frame rate for smooth playback
            '-r ' + fps, // Explicit output frame rate
            '-fflags +genpts', // Generate presentation timestamps
            '-avoid_negative_ts make_zero' // Handle timestamp issues
          ])
          .fps(fps);

        // Process both audio tracks AND video tracks with audio
        const audioItems = projectData.trackItemIds
          .map(id => {
            const itemDetails = projectData.trackItemDetailsMap[id];
            const trackItem = projectData.trackItemsMap[id];
            return itemDetails && trackItem && itemDetails.type === 'audio' ? {
              details: itemDetails.details,
              display: trackItem.display,
              trim: trackItem.trim || {},
              type: 'audio'
            } : null;
          })
          .filter(item => item !== null);

        // Also extract audio from video items
        const videoItemsWithAudio = projectData.trackItemIds
          .map(id => {
            const itemDetails = projectData.trackItemDetailsMap[id];
            const trackItem = projectData.trackItemsMap[id];
            return itemDetails && trackItem && itemDetails.type === 'video' ? {
              details: itemDetails.details,
              display: trackItem.display,
              trim: trackItem.trim || {},
              type: 'video'
            } : null;
          })
          .filter(item => item !== null);

        console.log(`🎵 Found ${audioItems.length} audio track(s) and ${videoItemsWithAudio.length} video(s) with potential audio`);

        // Handle audio from both audio tracks and video files
        const allAudioSources = [...audioItems, ...videoItemsWithAudio];

        if (allAudioSources.length > 0) {
          console.log(`🎵 Processing ${allAudioSources.length} audio source(s)...`);

          // For now, handle the simple case of one audio source (most common)
          const firstAudioSource = allAudioSources[0];
          const audioSrc = firstAudioSource.details.src;

          if (audioSrc) {
            console.log(`🎵 Adding ${firstAudioSource.type} audio: ${audioSrc}`);

            // Add the audio input
            command = command.input(audioSrc);

            // Extract audio properties
            const volume = this.extractVolume(firstAudioSource.details);
            const timing = firstAudioSource.display || {};
            const trim = firstAudioSource.trim || {};

            const startTime = (timing.from || 0) / 1000;
            const endTime = (timing.to || duration) / 1000;

            console.log(`🎵 ${firstAudioSource.type} properties: volume=${volume}, startTime=${startTime}s`);
            console.log(`🎵 Trim settings: from=${trim.from || 0}ms, to=${trim.to || 'end'}`);

            // Apply audio processing
            const audioFilters = [];

            // Apply trimming if needed
            if (trim.from !== undefined) {
              const trimStart = trim.from / 1000;
              command = command.seekInput(trimStart);
              console.log(`🎵 Seeking audio to ${trimStart}s`);
            }

            // Apply volume if not default
            if (volume !== 1) {
              audioFilters.push(`volume=${volume}`);
              console.log(`🎵 Applying volume: ${volume}`);
            }

            // Apply delay for display timing
            if (startTime > 0) {
              const delayMs = Math.floor(startTime * 1000);
              audioFilters.push(`adelay=${delayMs}|${delayMs}`);
              console.log(`🎵 Applying delay: ${delayMs}ms`);
            }

            // Apply audio filters if any
            if (audioFilters.length > 0) {
              command = command.audioFilters(audioFilters);
            }

            // Set audio codec and quality
            command = command
              .audioCodec('aac')
              .audioBitrate('128k')
              .audioChannels(2)
              .audioFrequency(44100);

            console.log('🎵 Audio processing configured successfully');
          }

          // TODO: Handle multiple audio sources with mixing in the future
          if (allAudioSources.length > 1) {
            console.log('⚠️ Multiple audio sources detected, only using the first one for now');
          }

        } else {
          console.log('🔇 No audio sources found, creating video without audio');
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

  /**
   * Generate CSS for loading custom fonts
   */
  generateFontCSS(projectData) {
    const { trackItemDetailsMap, trackItemIds } = projectData;
    let fontCSS = '';
    const loadedFonts = new Set(); // Prevent duplicate font loading

    trackItemIds.forEach(itemId => {
      const item = trackItemDetailsMap[itemId];
      if (!item || item.type !== 'text') return;

      const details = item.details;
      if (details.fontUrl && details.fontFamily) {
        const fontKey = `${details.fontFamily}-${details.fontUrl}`;
        if (!loadedFonts.has(fontKey)) {
          loadedFonts.add(fontKey);

          // Parse postScriptName to get family and weight
          const { family, weight, style } = this.parseFontName(details.fontFamily);

          fontCSS += `
        @font-face {
            font-family: '${family}';
            font-weight: ${weight};
            font-style: ${style};
            src: url('${details.fontUrl}') format('truetype');
            font-display: block;
        }`;
        }
      }
    });

    return fontCSS;
  }

  /**
   * Parse postScriptName to extract font family, weight, and style
   * Examples: "Roboto-Bold" -> {family: "Roboto", weight: "bold", style: "normal"}
   *          "Roboto-BoldItalic" -> {family: "Roboto", weight: "bold", style: "italic"}
   */
  parseFontName(postScriptName) {
    if (!postScriptName) {
      return { family: 'Arial', weight: 'normal', style: 'normal' };
    }

    // Split by last dash to separate family from style
    const lastDashIndex = postScriptName.lastIndexOf('-');
    if (lastDashIndex === -1) {
      return { family: postScriptName, weight: 'normal', style: 'normal' };
    }

    const family = postScriptName.substring(0, lastDashIndex);
    const styleString = postScriptName.substring(lastDashIndex + 1).toLowerCase();

    // Determine if italic
    const isItalic = styleString.includes('italic');
    const style = isItalic ? 'italic' : 'normal';

    // Determine weight
    let weight = 'normal';
    if (styleString.includes('thin')) weight = '100';
    else if (styleString.includes('extralight') || styleString.includes('ultralight')) weight = '200';
    else if (styleString.includes('light')) weight = '300';
    else if (styleString.includes('regular') || styleString.includes('normal')) weight = '400';
    else if (styleString.includes('medium')) weight = '500';
    else if (styleString.includes('semibold') || styleString.includes('demibold')) weight = '600';
    else if (styleString.includes('bold')) weight = '700';
    else if (styleString.includes('extrabold') || styleString.includes('ultrabold')) weight = '800';
    else if (styleString.includes('black') || styleString.includes('heavy')) weight = '900';

    return { family, weight, style };
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
