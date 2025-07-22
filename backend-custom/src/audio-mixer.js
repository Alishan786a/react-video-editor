import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs-extra';

export class AudioMixer {
  constructor() {
    this.tempAudioFiles = [];
  }

  /**
   * Create mixed audio track from multiple audio sources
   */
  async createAudioTrack(audioLayers, processedMedia, tempPath, duration) {
    try {
      if (!audioLayers || audioLayers.length === 0) {
        console.log('📢 No audio layers found, skipping audio for now');
        return null; // Skip audio completely for now
      }

      console.log(`🎵 Processing ${audioLayers.length} audio layers`);

      // Process each audio layer
      const processedAudioLayers = [];

      for (const layer of audioLayers) {
        const processedLayer = await this.processAudioLayer(layer, processedMedia, tempPath, duration);
        if (processedLayer) {
          processedAudioLayers.push(processedLayer);
        }
      }

      if (processedAudioLayers.length === 0) {
        console.log('📢 No valid audio layers, skipping audio');
        return null; // Skip audio completely for now
      }

      if (processedAudioLayers.length === 1) {
        console.log('🎵 Single audio layer, using directly');
        return processedAudioLayers[0].path;
      }

      // Mix multiple audio layers
      console.log(`🎛️ Mixing ${processedAudioLayers.length} audio layers`);
      return await this.mixAudioLayers(processedAudioLayers, tempPath, duration);

    } catch (error) {
      console.error('❌ Audio track creation failed:', error);
      // Return null to skip audio
      return null;
    }
  }

  /**
   * Process individual audio layer
   */
  async processAudioLayer(layer, processedMedia, tempPath, duration) {
    try {
      const { itemId, item, details } = layer;
      const mediaFile = processedMedia.find(m => m.itemId === itemId);
      
      if (!mediaFile) {
        console.warn(`⚠️ Audio media file not found for item ${itemId}`);
        return null;
      }

      const outputPath = path.join(tempPath, `audio_layer_${itemId}.wav`);
      
      // Extract audio properties
      const volume = this.extractVolume(details.details);
      const timing = item.display || {};
      const trim = item.trim || {};
      
      const startTime = (timing.from || 0) / 1000;
      const endTime = (timing.to || duration * 1000) / 1000;
      const layerDuration = endTime - startTime;

      console.log(`🎵 Processing audio layer ${itemId}: volume=${volume}, duration=${layerDuration}s`);

      await this.processAudioFile({
        inputPath: mediaFile.localPath,
        outputPath,
        volume,
        startTime,
        duration: layerDuration,
        trim,
        totalDuration: duration
      });

      this.tempAudioFiles.push(outputPath);

      return {
        path: outputPath,
        volume,
        startTime,
        duration: layerDuration,
        itemId
      };

    } catch (error) {
      console.error(`❌ Audio layer processing failed for ${layer.itemId}:`, error);
      return null;
    }
  }

  /**
   * Process audio file with effects and timing
   */
  async processAudioFile({ inputPath, outputPath, volume, startTime, duration, trim, totalDuration }) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Apply trimming if specified
      if (trim.from !== undefined) {
        command = command.seekInput(trim.from / 1000);
      }
      
      if (trim.to !== undefined) {
        const trimDuration = (trim.to - (trim.from || 0)) / 1000;
        command = command.duration(Math.min(trimDuration, duration));
      } else {
        command = command.duration(duration);
      }

      // Build audio filter chain
      const filters = [];
      
      // Volume adjustment
      if (volume !== 1) {
        filters.push(`volume=${volume}`);
      }

      // Fade in/out effects (optional)
      if (duration > 1) {
        filters.push(`afade=t=in:ss=0:d=0.1`); // 0.1s fade in
        filters.push(`afade=t=out:st=${duration - 0.1}:d=0.1`); // 0.1s fade out
      }

      // Apply filters if any
      if (filters.length > 0) {
        command = command.audioFilters(filters);
      }

      command
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(44100)
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`🎬 Audio processing: ${path.basename(inputPath)}`);
        })
        .on('end', () => {
          console.log(`✅ Audio processed: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`❌ Audio processing error: ${error.message}`);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Mix multiple audio layers into single track
   */
  async mixAudioLayers(audioLayers, tempPath, duration) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(tempPath, `mixed_audio_${Date.now()}.wav`);
      
      let command = ffmpeg();

      // Add all audio inputs
      audioLayers.forEach(layer => {
        command = command.input(layer.path);
      });

      // Create silent base track for proper timing
      command = command.input(`anullsrc=channel_layout=stereo:sample_rate=44100`)
        .inputFormat('lavfi')
        .inputOptions([`-t ${duration}`]);

      // Build complex filter for mixing
      const filterParts = [];
      const inputCount = audioLayers.length + 1; // +1 for silent base

      // Mix all audio inputs with the silent base
      const inputs = audioLayers.map((_, index) => `[${index}:a]`).join('');
      const silentInput = `[${audioLayers.length}:a]`;
      
      filterParts.push(`${inputs}${silentInput}amix=inputs=${inputCount}:duration=longest:dropout_transition=2[mixed]`);

      command
        .complexFilter(filterParts, ['mixed'])
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(44100)
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🎛️ Mixing audio layers...');
        })
        .on('end', () => {
          console.log(`✅ Audio mixed: ${path.basename(outputPath)}`);
          this.tempAudioFiles.push(outputPath);
          resolve(outputPath);
        })
        .on('error', (error) => {
          console.error('❌ Audio mixing error:', error);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Create silent audio track
   */
  async createSilentTrack(tempPath, duration) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(tempPath, `silent_audio_${Date.now()}.wav`);

      // Create a simple silent audio file using a different approach
      // Generate silence using FFmpeg's built-in silence generator
      ffmpeg()
        .input('anullsrc=channel_layout=stereo:sample_rate=44100')
        .inputOptions(['-f', 'lavfi', `-t`, duration.toString()])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Silent track created: ${duration}s`);
          this.tempAudioFiles.push(outputPath);
          resolve(outputPath);
        })
        .on('error', (error) => {
          console.error('❌ Silent track creation failed, skipping audio:', error.message);
          // Return null to indicate no audio track
          resolve(null);
        })
        .run();
    });
  }

  /**
   * Extract volume from audio details
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
   * Get audio file duration
   */
  async getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  /**
   * Normalize audio levels
   */
  async normalizeAudio(inputPath, outputPath, targetLevel = -23) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          `loudnorm=I=${targetLevel}:TP=-2:LRA=7`
        ])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  /**
   * Apply audio effects
   */
  buildAudioEffects(details) {
    const effects = [];

    // Volume
    const volume = this.extractVolume(details);
    if (volume !== 1) {
      effects.push(`volume=${volume}`);
    }

    // Bass boost
    if (details.bassBoost) {
      effects.push(`bass=g=${details.bassBoost}`);
    }

    // Treble boost
    if (details.trebleBoost) {
      effects.push(`treble=g=${details.trebleBoost}`);
    }

    // Echo effect
    if (details.echo) {
      effects.push(`aecho=0.8:0.9:1000:0.3`);
    }

    // Reverb effect
    if (details.reverb) {
      effects.push(`afreqshift=shift=0.1`);
    }

    return effects;
  }

  /**
   * Clean up temporary audio files
   */
  async cleanup() {
    try {
      for (const filePath of this.tempAudioFiles) {
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          console.log(`🗑️ Removed temp audio: ${path.basename(filePath)}`);
        }
      }
      this.tempAudioFiles = [];
    } catch (error) {
      console.error('❌ Audio cleanup error:', error);
    }
  }

  /**
   * Validate audio file
   */
  async validateAudioFile(filePath) {
    try {
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      
      if (!audioStream) {
        throw new Error('No audio stream found');
      }

      return {
        isValid: true,
        duration: metadata.format.duration,
        sampleRate: audioStream.sample_rate,
        channels: audioStream.channels,
        codec: audioStream.codec_name
      };

    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }
}
