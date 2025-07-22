import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs-extra';

export class TextRenderer {
  constructor() {
    this.fontCache = new Map();
    this.defaultFonts = {
      'Arial': 'Arial',
      'Helvetica': 'Helvetica',
      'Times New Roman': 'Times',
      'Courier New': 'Courier',
      'Georgia': 'Georgia',
      'Verdana': 'Verdana'
    };
  }

  /**
   * Render text layer as video using FFmpeg drawtext filter
   */
  async renderTextLayer({ text, styling, timing, outputPath, canvasWidth, canvasHeight, duration, frameRate }) {
    try {
      console.log(`📝 Skipping text rendering for now: "${text.substring(0, 30)}..."`);

      // For now, create a transparent video as a placeholder
      // This allows the rest of the system to work while we fix text rendering

      // Create a simple transparent PNG image
      const transparentImagePath = path.join(path.dirname(outputPath), `transparent_${Date.now()}.png`);

      // Create a 1x1 transparent pixel PNG
      const transparentPixelBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0B, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0x60, 0x00, 0x02, 0x00,
        0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      await fs.writeFile(transparentImagePath, transparentPixelBuffer);

      return new Promise((resolve, reject) => {
        // Create a transparent video from the transparent image
        ffmpeg()
          .input(transparentImagePath)
          .loop(duration)
          .inputOptions(['-framerate', frameRate.toString()])
          .videoFilter(`scale=${canvasWidth}:${canvasHeight}`)
          .outputOptions([
            '-c:v libx264',
            '-preset fast',
            '-crf 23',
            '-pix_fmt yuva420p', // Use alpha channel
            `-t ${duration}`
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('🎬 FFmpeg command (transparent placeholder):', commandLine);
          })
          .on('end', async () => {
            // Clean up temp file
            try {
              await fs.remove(transparentImagePath);
            } catch (e) {
              console.warn('⚠️ Failed to clean up temp file:', e.message);
            }
            console.log(`✅ Text layer placeholder rendered: ${path.basename(outputPath)}`);
            resolve();
          })
          .on('error', (error) => {
            console.error('❌ Text rendering error:', error);
            fs.remove(transparentImagePath).catch(() => {}); // Clean up on error
            reject(error);
          })
          .run();
      });

    } catch (error) {
      console.error('❌ Text layer rendering failed:', error);
      throw error;
    }
  }

  /**
   * Parse text styling properties
   */
  parseTextStyling(styling) {
    return {
      fontSize: styling.fontSize || 48,
      fontFamily: this.sanitizeFontFamily(styling.fontFamily || 'Arial'),
      color: this.parseColor(styling.color || '#ffffff'),
      backgroundColor: this.parseBackgroundColor(styling.backgroundColor),
      textAlign: styling.textAlign || 'center',
      fontWeight: styling.fontWeight || 'normal',
      fontStyle: styling.fontStyle || 'normal',
      textDecoration: styling.textDecoration || 'none',
      left: this.parsePixelValue(styling.left || '0'),
      top: this.parsePixelValue(styling.top || '0'),
      width: styling.width || 600,
      height: styling.height || 100,
      opacity: this.parseOpacity(styling.opacity),
      lineHeight: styling.lineHeight || 1.2,
      letterSpacing: styling.letterSpacing || 0,
      textShadow: this.parseTextShadow(styling.textShadow),
      borderWidth: styling.borderWidth || 0,
      borderColor: this.parseColor(styling.borderColor || '#000000')
    };
  }

  /**
   * Build FFmpeg drawtext filter string
   */
  buildDrawtextFilter(text, style, canvasWidth, canvasHeight) {
    const filters = [];

    // Escape text for FFmpeg
    const escapedText = this.escapeTextForFFmpeg(text);

    // Basic text properties
    filters.push(`text='${escapedText}'`);
    filters.push(`fontsize=${style.fontSize}`);
    filters.push(`fontcolor=${style.color}`);
    
    // Font family (use system fonts)
    const fontFile = this.getFontFile(style.fontFamily, style.fontWeight, style.fontStyle);
    if (fontFile) {
      filters.push(`fontfile='${fontFile}'`);
    } else {
      filters.push(`font='${style.fontFamily}'`);
    }

    // Position and size
    const x = this.calculateTextX(style, canvasWidth);
    const y = this.calculateTextY(style, canvasHeight);
    
    filters.push(`x=${x}`);
    filters.push(`y=${y}`);

    // Text box dimensions
    if (style.width && style.height) {
      filters.push(`box=1`);
      filters.push(`boxw=${style.width}`);
      filters.push(`boxh=${style.height}`);
      
      if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        filters.push(`boxcolor=${style.backgroundColor}`);
      } else {
        filters.push(`boxcolor=black@0`); // Transparent background
      }
    }

    // Text alignment within box
    if (style.textAlign === 'center') {
      filters.push(`text_align=center`);
    } else if (style.textAlign === 'right') {
      filters.push(`text_align=right`);
    } else {
      filters.push(`text_align=left`);
    }

    // Text wrapping
    if (style.width) {
      // Calculate approximate character width for wrapping
      const avgCharWidth = style.fontSize * 0.6;
      const maxCharsPerLine = Math.floor(style.width / avgCharWidth);
      
      if (text.length > maxCharsPerLine) {
        const wrappedText = this.wrapText(text, maxCharsPerLine);
        filters[0] = `text='${this.escapeTextForFFmpeg(wrappedText)}'`;
      }
    }

    // Border/outline
    if (style.borderWidth > 0) {
      filters.push(`borderw=${style.borderWidth}`);
      filters.push(`bordercolor=${style.borderColor}`);
    }

    // Text shadow
    if (style.textShadow) {
      filters.push(`shadowx=${style.textShadow.x}`);
      filters.push(`shadowy=${style.textShadow.y}`);
      filters.push(`shadowcolor=${style.textShadow.color}`);
    }

    // Opacity
    if (style.opacity < 1) {
      filters.push(`alpha=${style.opacity}`);
    }

    return `drawtext=${filters.join(':')}`;
  }

  /**
   * Calculate X position based on alignment
   */
  calculateTextX(style, canvasWidth) {
    const left = style.left;
    
    switch (style.textAlign) {
      case 'center':
        return left + (style.width / 2) - 'text_w/2';
      case 'right':
        return left + style.width - 'text_w';
      default: // left
        return left;
    }
  }

  /**
   * Calculate Y position
   */
  calculateTextY(style, canvasHeight) {
    return style.top + (style.height / 2) - 'text_h/2';
  }

  /**
   * Escape text for FFmpeg drawtext filter
   */
  escapeTextForFFmpeg(text) {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

  /**
   * Wrap text to fit within specified width
   */
  wrapText(text, maxCharsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length <= maxCharsPerLine) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is longer than max line length, break it
          lines.push(word.substring(0, maxCharsPerLine));
          currentLine = word.substring(maxCharsPerLine);
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\\n');
  }

  /**
   * Parse color values
   */
  parseColor(color) {
    if (!color) return '#ffffff';
    
    // Handle hex colors
    if (color.startsWith('#')) {
      return color;
    }
    
    // Handle rgb/rgba colors
    if (color.startsWith('rgb')) {
      return this.rgbToHex(color);
    }
    
    // Handle named colors
    const namedColors = {
      'white': '#ffffff',
      'black': '#000000',
      'red': '#ff0000',
      'green': '#00ff00',
      'blue': '#0000ff',
      'yellow': '#ffff00',
      'cyan': '#00ffff',
      'magenta': '#ff00ff'
    };
    
    return namedColors[color.toLowerCase()] || '#ffffff';
  }

  /**
   * Parse background color
   */
  parseBackgroundColor(backgroundColor) {
    if (!backgroundColor || backgroundColor === 'transparent') {
      return 'black@0'; // Transparent
    }
    
    return this.parseColor(backgroundColor);
  }

  /**
   * Parse opacity value
   */
  parseOpacity(opacity) {
    if (opacity === undefined) return 1;
    
    if (opacity <= 1) {
      return opacity;
    } else {
      return opacity / 100; // Convert percentage
    }
  }

  /**
   * Parse text shadow
   */
  parseTextShadow(textShadow) {
    if (!textShadow) return null;
    
    if (typeof textShadow === 'object') {
      return {
        x: textShadow.x || 2,
        y: textShadow.y || 2,
        color: this.parseColor(textShadow.color || '#000000')
      };
    }
    
    // Parse CSS text-shadow string
    const match = textShadow.match(/(\d+)px\s+(\d+)px\s+(\d+)px\s+(.+)/);
    if (match) {
      return {
        x: parseInt(match[1]),
        y: parseInt(match[2]),
        color: this.parseColor(match[4])
      };
    }
    
    return null;
  }

  /**
   * Convert RGB to hex
   */
  rgbToHex(rgb) {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return rgb;
  }

  /**
   * Parse pixel values
   */
  parsePixelValue(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      return parseFloat(value.replace('px', '')) || 0;
    }
    return 0;
  }

  /**
   * Sanitize font family name
   */
  sanitizeFontFamily(fontFamily) {
    // Remove quotes and sanitize
    return fontFamily.replace(/['"]/g, '').trim();
  }

  /**
   * Get font file path (system dependent)
   */
  getFontFile(fontFamily, fontWeight, fontStyle) {
    // This would need to be implemented based on the system
    // For now, return null to use system font names
    return null;
  }

  /**
   * Create text preview using FFmpeg (for debugging)
   */
  async createTextPreview(text, styling, width = 600, height = 100) {
    try {
      console.log(`📝 Text preview: "${text.substring(0, 30)}..."`);
      // For now, just return null - preview functionality can be added later if needed
      return null;
    } catch (error) {
      console.error('❌ Text preview creation failed:', error);
      return null;
    }
  }
}
