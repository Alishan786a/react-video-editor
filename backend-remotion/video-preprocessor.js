import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Video preprocessing utility for Remotion compatibility
export class VideoPreprocessor {
  constructor(tempPath) {
    this.tempPath = tempPath;
  }

  // Check if ffmpeg is available
  async checkFFmpeg() {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('error', () => resolve(false));
      ffmpeg.on('close', (code) => resolve(code === 0));
    });
  }

  // Convert video to Remotion-friendly format
  async preprocessVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-c:v', 'libx264',           // Use H.264 codec
        '-preset', 'fast',           // Fast encoding
        '-crf', '23',                // Good quality
        '-c:a', 'aac',               // AAC audio
        '-movflags', '+faststart',   // Web optimization
        '-pix_fmt', 'yuv420p',       // Compatible pixel format
        '-r', '30',                  // 30 FPS
        '-y',                        // Overwrite output
        outputPath
      ]);

      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
    });
  }

  // Process video file for Remotion compatibility
  async processVideoFile(originalPath, renderId, itemId) {
    try {
      const hasFFmpeg = await this.checkFFmpeg();
      
      if (!hasFFmpeg) {
        console.warn('FFmpeg not available, using original video file');
        return originalPath;
      }

      const ext = path.extname(originalPath);
      const basename = path.basename(originalPath, ext);
      const processedPath = path.join(this.tempPath, `${renderId}_${itemId}_processed_${basename}.mp4`);

      // Check if video is already in a good format
      if (await this.isVideoCompatible(originalPath)) {
        console.log('Video is already compatible, using original');
        return originalPath;
      }

      console.log(`Preprocessing video: ${originalPath} -> ${processedPath}`);
      await this.preprocessVideo(originalPath, processedPath);
      
      console.log('Video preprocessing completed');
      return processedPath;

    } catch (error) {
      console.error('Video preprocessing failed:', error);
      // Fallback to original file
      return originalPath;
    }
  }

  // Check if video is in a compatible format
  async isVideoCompatible(videoPath) {
    return new Promise((resolve) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ]);

      let stdout = '';
      
      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          resolve(false);
          return;
        }

        try {
          const info = JSON.parse(stdout);
          const videoStream = info.streams.find(s => s.codec_type === 'video');
          
          if (!videoStream) {
            resolve(false);
            return;
          }

          // Check if it's H.264 with compatible settings
          const isH264 = videoStream.codec_name === 'h264';
          const isYUV420 = videoStream.pix_fmt === 'yuv420p';
          const hasReasonableFPS = parseFloat(videoStream.r_frame_rate) <= 60;
          
          resolve(isH264 && isYUV420 && hasReasonableFPS);
          
        } catch (error) {
          resolve(false);
        }
      });

      ffprobe.on('error', () => resolve(false));
    });
  }

  // Clean up processed files
  cleanup(renderId) {
    try {
      const files = fs.readdirSync(this.tempPath);
      const processedFiles = files.filter(f => f.startsWith(`${renderId}_`) && f.includes('_processed_'));
      
      processedFiles.forEach(file => {
        const filePath = path.join(this.tempPath, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up processed file: ${file}`);
        } catch (error) {
          console.error(`Failed to clean up ${file}:`, error);
        }
      });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}
