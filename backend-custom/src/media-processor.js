import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

export class MediaProcessor {
  constructor() {
    this.downloadedFiles = new Map();
  }

  async processProjectMedia(projectData, renderId, tempPath, onProgress) {
    try {
      const { trackItemIds, trackItemDetailsMap } = projectData;
      const downloadPromises = [];
      const processedMedia = [];

      console.log(`📥 Processing ${trackItemIds.length} media items`);

      // Collect all media files that need downloading
      trackItemIds.forEach((itemId, index) => {
        const itemDetails = trackItemDetailsMap[itemId];
        
        if (itemDetails?.details?.src) {
          const src = itemDetails.details.src;
          const itemType = itemDetails.details.type || itemDetails.type;
          
          // Skip text items as they don't need file downloads
          if (itemType === 'text') return;

          const filename = this.generateUniqueFilename(renderId, itemId, src);
          
          downloadPromises.push(
            this.downloadMediaFile(src, path.join(tempPath, filename))
              .then(localPath => {
                onProgress?.((index + 1) / trackItemIds.length * 100);
                return {
                  itemId,
                  originalSrc: src,
                  localPath,
                  type: itemType
                };
              })
              .catch(error => {
                console.error(`❌ Failed to download ${src}:`, error.message);
                return null;
              })
          );
        }
      });

      // Wait for all downloads to complete
      const results = await Promise.all(downloadPromises);
      
      // Filter out failed downloads
      results.forEach(result => {
        if (result) {
          processedMedia.push(result);
        }
      });

      console.log(`✅ Successfully processed ${processedMedia.length} media files`);
      return processedMedia;

    } catch (error) {
      console.error('❌ Media processing error:', error);
      throw error;
    }
  }

  async downloadMediaFile(url, outputPath) {
    try {
      // Check if it's already downloaded
      if (this.downloadedFiles.has(url)) {
        const existingPath = this.downloadedFiles.get(url);
        if (await fs.pathExists(existingPath)) {
          console.log(`📋 Using cached file: ${path.basename(existingPath)}`);
          return existingPath;
        }
      }

      console.log(`📥 Downloading: ${path.basename(url)}`);

      // Handle local files from existing backend
      if (url.startsWith('http://localhost:3000/api/v1/editor/files/')) {
        return await this.downloadFromLocalBackend(url, outputPath);
      }

      // Handle external URLs
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Custom-Video-Renderer/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath));

      // Stream the file to disk
      const fileStream = fs.createWriteStream(outputPath);
      
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });

      // Verify file was downloaded
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      // Cache the download
      this.downloadedFiles.set(url, outputPath);
      
      console.log(`✅ Downloaded: ${path.basename(outputPath)} (${this.formatFileSize(stats.size)})`);
      return outputPath;

    } catch (error) {
      console.error(`❌ Download failed for ${url}:`, error.message);
      
      // Clean up partial download
      try {
        if (await fs.pathExists(outputPath)) {
          await fs.remove(outputPath);
        }
      } catch (cleanupError) {
        console.error('❌ Cleanup error:', cleanupError.message);
      }
      
      throw error;
    }
  }

  async downloadFromLocalBackend(url, outputPath) {
    try {
      // Extract the local file path from the URL
      const urlParts = url.split('/files/');
      if (urlParts.length > 1) {
        // Try multiple possible local paths
        const possiblePaths = [
          path.join(process.cwd(), '..', 'backend-example', 'storage', 'editor', urlParts[1]),
          path.join(process.cwd(), 'backend-example', 'storage', 'editor', urlParts[1]),
          path.join(process.cwd(), '..', 'storage', 'editor', urlParts[1]),
          path.join(process.cwd(), 'storage', 'editor', urlParts[1])
        ];

        for (const localPath of possiblePaths) {
          if (await fs.pathExists(localPath)) {
            console.log(`📋 Copying local file: ${path.basename(localPath)}`);
            await fs.copy(localPath, outputPath);
            return outputPath;
          }
        }
      }

      // Fallback to HTTP download
      console.log(`🌐 Local file not found, downloading via HTTP: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await fs.ensureDir(path.dirname(outputPath));
      const fileStream = fs.createWriteStream(outputPath);
      
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });

      return outputPath;

    } catch (error) {
      console.error(`❌ Local backend download failed: ${error.message}`);
      throw error;
    }
  }

  generateUniqueFilename(renderId, itemId, originalUrl) {
    const extension = path.extname(originalUrl) || '.tmp';
    const baseName = path.basename(originalUrl, extension) || 'media';
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    return `${renderId}_${itemId}_${sanitizedBaseName}_${Date.now()}${extension}`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async cleanupTempFiles(renderId, tempPath) {
    try {
      console.log(`🧹 Cleaning up temp files for render ${renderId}`);
      
      const files = await fs.readdir(tempPath);
      const renderFiles = files.filter(file => file.startsWith(renderId));
      
      for (const file of renderFiles) {
        const filePath = path.join(tempPath, file);
        try {
          await fs.remove(filePath);
          console.log(`🗑️ Removed: ${file}`);
        } catch (error) {
          console.error(`❌ Failed to remove ${file}:`, error.message);
        }
      }

      // Clear download cache for this render
      for (const [url, cachedPath] of this.downloadedFiles.entries()) {
        if (cachedPath.includes(renderId)) {
          this.downloadedFiles.delete(url);
        }
      }

      console.log(`✅ Cleanup completed for render ${renderId}`);

    } catch (error) {
      console.error(`❌ Cleanup error for render ${renderId}:`, error.message);
    }
  }

  async validateMediaFile(filePath, expectedType) {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.size === 0) {
        throw new Error('File is empty');
      }

      // Basic file type validation based on extension
      const extension = path.extname(filePath).toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
      const audioExtensions = ['.mp3', '.wav', '.ogg', '.aac', '.m4a'];

      switch (expectedType) {
        case 'image':
          if (!imageExtensions.includes(extension)) {
            console.warn(`⚠️ Unexpected image extension: ${extension}`);
          }
          break;
        case 'video':
          if (!videoExtensions.includes(extension)) {
            console.warn(`⚠️ Unexpected video extension: ${extension}`);
          }
          break;
        case 'audio':
          if (!audioExtensions.includes(extension)) {
            console.warn(`⚠️ Unexpected audio extension: ${extension}`);
          }
          break;
      }

      return true;

    } catch (error) {
      console.error(`❌ Media validation failed for ${filePath}:`, error.message);
      return false;
    }
  }

  async getMediaInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const extension = path.extname(filePath).toLowerCase();
      
      return {
        path: filePath,
        size: stats.size,
        extension,
        type: this.getMediaTypeFromExtension(extension),
        exists: true
      };

    } catch (error) {
      return {
        path: filePath,
        exists: false,
        error: error.message
      };
    }
  }

  getMediaTypeFromExtension(extension) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.aac', '.m4a'];

    if (imageExtensions.includes(extension)) return 'image';
    if (videoExtensions.includes(extension)) return 'video';
    if (audioExtensions.includes(extension)) return 'audio';
    
    return 'unknown';
  }
}
