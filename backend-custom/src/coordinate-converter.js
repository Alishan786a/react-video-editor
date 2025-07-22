export class CoordinateConverter {
  constructor() {
    // Default canvas dimensions
    this.defaultCanvasWidth = 1080;
    this.defaultCanvasHeight = 1920;
  }

  /**
   * Convert editor coordinates to render coordinates
   * Handles the center-based coordinate system used by the frontend editor
   */
  convertToRenderCoords(details, canvasWidth = this.defaultCanvasWidth, canvasHeight = this.defaultCanvasHeight) {
    try {
      // Extract position values (remove 'px' suffix if present)
      const editorLeft = this.parsePixelValue(details.left || '0');
      const editorTop = this.parsePixelValue(details.top || '0');
      
      // Extract dimensions
      const originalWidth = details.width || canvasWidth;
      const originalHeight = details.height || canvasHeight;
      
      // Extract scale information
      const scale = this.extractScale(details);
      
      // Calculate scaled dimensions
      const scaledWidth = Math.round(originalWidth * scale.x);
      const scaledHeight = Math.round(originalHeight * scale.y);
      
      // Convert editor coordinates to render coordinates
      const renderCoords = this.editorToRenderCoordinates(
        editorLeft,
        editorTop,
        originalWidth,
        originalHeight,
        scale,
        canvasWidth,
        canvasHeight
      );

      const result = {
        left: Math.max(0, renderCoords.left),
        top: Math.max(0, renderCoords.top),
        width: scaledWidth,
        height: scaledHeight,
        scale: scale,
        originalWidth,
        originalHeight
      };

      console.log(`🎯 Coordinate conversion:`, {
        editor: { left: editorLeft, top: editorTop },
        render: { left: result.left, top: result.top },
        dimensions: { width: result.width, height: result.height },
        scale: scale
      });

      return result;

    } catch (error) {
      console.error('❌ Coordinate conversion error:', error);
      
      // Return safe defaults
      return {
        left: 0,
        top: 0,
        width: canvasWidth,
        height: canvasHeight,
        scale: { x: 1, y: 1 },
        originalWidth: canvasWidth,
        originalHeight: canvasHeight
      };
    }
  }

  /**
   * Parse pixel values, handling both string and number inputs
   */
  parsePixelValue(value) {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      // Remove 'px' suffix and parse as float
      const numValue = parseFloat(value.replace('px', ''));
      return isNaN(numValue) ? 0 : numValue;
    }
    
    return 0;
  }

  /**
   * Extract scale information from various sources
   */
  extractScale(details) {
    let scaleX = 1;
    let scaleY = 1;

    // Check placement object (Archive format)
    if (details.placement) {
      scaleX = details.placement.scaleX || 1;
      scaleY = details.placement.scaleY || 1;
    }
    
    // Check transform string
    else if (details.transform) {
      const scaleMatch = details.transform.match(/scale\(([^)]+)\)/);
      if (scaleMatch) {
        const scaleValues = scaleMatch[1].split(',').map(v => parseFloat(v.trim()));
        scaleX = scaleValues[0] || 1;
        scaleY = scaleValues[1] || scaleValues[0] || 1;
      }
    }
    
    // Check individual scale properties
    else {
      scaleX = details.scaleX || 1;
      scaleY = details.scaleY || 1;
    }

    return { x: scaleX, y: scaleY };
  }

  /**
   * Core coordinate transformation logic
   * Converts from editor's center-based system to render coordinates
   */
  editorToRenderCoordinates(editorLeft, editorTop, originalWidth, originalHeight, scale, canvasWidth, canvasHeight) {
    // Calculate scaled dimensions
    const scaledWidth = originalWidth * scale.x;
    const scaledHeight = originalHeight * scale.y;

    // Calculate center-based offsets
    const leftCenterOffset = (canvasWidth - scaledWidth) / 2;
    const topCenterOffset = (canvasHeight - scaledHeight) / 2;
    
    // Calculate base offsets for coordinate system alignment
    const baseLeftOffset = (originalWidth - canvasWidth) / 2;
    const baseTopOffset = (originalHeight - canvasHeight) / 2;

    // Apply the transformation
    const renderLeft = editorLeft + leftCenterOffset + baseLeftOffset;
    const renderTop = editorTop + topCenterOffset + baseTopOffset;

    return {
      left: Math.round(renderLeft),
      top: Math.round(renderTop)
    };
  }

  /**
   * Convert timing from milliseconds to seconds for FFmpeg
   */
  convertTiming(timing) {
    return {
      start: (timing.from || 0) / 1000,
      end: (timing.to || 5000) / 1000,
      duration: ((timing.to || 5000) - (timing.from || 0)) / 1000
    };
  }

  /**
   * Calculate aspect ratio and fitting
   */
  calculateAspectRatio(width, height) {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    
    return {
      ratio: width / height,
      simplified: `${width / divisor}:${height / divisor}`,
      isLandscape: width > height,
      isPortrait: height > width,
      isSquare: width === height
    };
  }

  /**
   * Calculate optimal positioning for different fit modes
   */
  calculateFitMode(sourceWidth, sourceHeight, targetWidth, targetHeight, mode = 'contain') {
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = targetWidth / targetHeight;

    let width, height, left, top;

    switch (mode) {
      case 'cover':
        if (sourceRatio > targetRatio) {
          // Source is wider, fit to height
          height = targetHeight;
          width = Math.round(height * sourceRatio);
          left = Math.round((targetWidth - width) / 2);
          top = 0;
        } else {
          // Source is taller, fit to width
          width = targetWidth;
          height = Math.round(width / sourceRatio);
          left = 0;
          top = Math.round((targetHeight - height) / 2);
        }
        break;

      case 'fill':
        width = targetWidth;
        height = targetHeight;
        left = 0;
        top = 0;
        break;

      case 'contain':
      default:
        if (sourceRatio > targetRatio) {
          // Source is wider, fit to width
          width = targetWidth;
          height = Math.round(width / sourceRatio);
          left = 0;
          top = Math.round((targetHeight - height) / 2);
        } else {
          // Source is taller, fit to height
          height = targetHeight;
          width = Math.round(height * sourceRatio);
          left = Math.round((targetWidth - width) / 2);
          top = 0;
        }
        break;
    }

    return { width, height, left, top };
  }

  /**
   * Validate coordinates are within canvas bounds
   */
  validateCoordinates(coords, canvasWidth, canvasHeight) {
    const warnings = [];
    
    if (coords.left < 0) {
      warnings.push(`Left position ${coords.left} is negative`);
    }
    
    if (coords.top < 0) {
      warnings.push(`Top position ${coords.top} is negative`);
    }
    
    if (coords.left + coords.width > canvasWidth) {
      warnings.push(`Element extends beyond canvas width (${coords.left + coords.width} > ${canvasWidth})`);
    }
    
    if (coords.top + coords.height > canvasHeight) {
      warnings.push(`Element extends beyond canvas height (${coords.top + coords.height} > ${canvasHeight})`);
    }

    if (warnings.length > 0) {
      console.warn('⚠️ Coordinate validation warnings:', warnings);
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  }

  /**
   * Debug coordinate conversion
   */
  debugConversion(editorCoords, renderCoords, canvasSize) {
    console.log('🔍 Coordinate Conversion Debug:', {
      input: {
        editor: editorCoords,
        canvas: canvasSize
      },
      output: renderCoords,
      transformation: {
        deltaX: renderCoords.left - editorCoords.left,
        deltaY: renderCoords.top - editorCoords.top,
        scaleApplied: renderCoords.scale
      }
    });
  }
}
