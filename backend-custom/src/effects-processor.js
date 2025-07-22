export class EffectsProcessor {
  constructor() {
    this.supportedEffects = [
      'opacity', 'blur', 'brightness', 'contrast', 'saturation',
      'flipX', 'flipY', 'rotation', 'scale', 'boxShadow'
    ];
  }

  /**
   * Build FFmpeg effects for video layers
   */
  buildVideoEffects(details, item) {
    const effects = {
      opacity: this.extractOpacity(details),
      blur: this.extractBlur(details),
      brightness: this.extractBrightness(details),
      contrast: this.extractContrast(details),
      saturation: this.extractSaturation(details),
      flipX: details.flipX || false,
      flipY: details.flipY || false,
      rotation: this.extractRotation(details),
      volume: this.extractVolume(details),
      filters: []
    };

    // Build FFmpeg filter chain
    effects.filters = this.buildFilterChain(effects, 'video');
    
    console.log(`🎨 Video effects for item:`, effects);
    return effects;
  }

  /**
   * Build FFmpeg effects for image layers
   */
  buildImageEffects(details, item) {
    const effects = {
      opacity: this.extractOpacity(details),
      blur: this.extractBlur(details),
      brightness: this.extractBrightness(details),
      contrast: this.extractContrast(details),
      saturation: this.extractSaturation(details),
      flipX: details.flipX || false,
      flipY: details.flipY || false,
      rotation: this.extractRotation(details),
      filters: []
    };

    // Build FFmpeg filter chain
    effects.filters = this.buildFilterChain(effects, 'image');
    
    console.log(`🖼️ Image effects for item:`, effects);
    return effects;
  }

  /**
   * Extract opacity value (0-1)
   */
  extractOpacity(details) {
    let opacity = 1;

    if (details.opacity !== undefined) {
      if (details.opacity <= 1) {
        opacity = details.opacity;
      } else {
        opacity = details.opacity / 100; // Convert percentage to decimal
      }
    }

    return Math.max(0, Math.min(1, opacity));
  }

  /**
   * Extract blur value in pixels
   */
  extractBlur(details) {
    return Math.max(0, details.blur || 0);
  }

  /**
   * Extract brightness value (0-2, where 1 is normal)
   */
  extractBrightness(details) {
    let brightness = 1;

    if (details.brightness !== undefined) {
      if (details.brightness <= 2) {
        brightness = details.brightness;
      } else {
        brightness = details.brightness / 100; // Convert percentage
      }
    }

    return Math.max(0, Math.min(2, brightness));
  }

  /**
   * Extract contrast value (0-2, where 1 is normal)
   */
  extractContrast(details) {
    let contrast = 1;

    if (details.contrast !== undefined) {
      if (details.contrast <= 2) {
        contrast = details.contrast;
      } else {
        contrast = details.contrast / 100; // Convert percentage
      }
    }

    return Math.max(0, Math.min(2, contrast));
  }

  /**
   * Extract saturation value (0-2, where 1 is normal)
   */
  extractSaturation(details) {
    let saturation = 1;

    if (details.saturation !== undefined) {
      if (details.saturation <= 2) {
        saturation = details.saturation;
      } else {
        saturation = details.saturation / 100; // Convert percentage
      }
    }

    return Math.max(0, Math.min(2, saturation));
  }

  /**
   * Extract rotation value in degrees
   */
  extractRotation(details) {
    let rotation = 0;

    if (details.rotation !== undefined) {
      rotation = details.rotation;
    } else if (details.transform) {
      const rotateMatch = details.transform.match(/rotate\(([^)]+)deg\)/);
      if (rotateMatch) {
        rotation = parseFloat(rotateMatch[1]) || 0;
      }
    }

    return rotation;
  }

  /**
   * Extract volume value (0-1)
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

    return Math.max(0, Math.min(1, volume));
  }

  /**
   * Build FFmpeg filter chain based on effects
   */
  buildFilterChain(effects, mediaType) {
    const filters = [];

    // Apply flip transformations first
    if (effects.flipX && effects.flipY) {
      filters.push('hflip,vflip');
    } else if (effects.flipX) {
      filters.push('hflip');
    } else if (effects.flipY) {
      filters.push('vflip');
    }

    // Apply rotation
    if (effects.rotation && effects.rotation !== 0) {
      const radians = (effects.rotation * Math.PI) / 180;
      filters.push(`rotate=${radians}:fillcolor=black@0`);
    }

    // Apply color adjustments
    const colorAdjustments = [];
    
    if (effects.brightness !== 1) {
      colorAdjustments.push(`brightness=${effects.brightness - 1}`);
    }
    
    if (effects.contrast !== 1) {
      colorAdjustments.push(`contrast=${effects.contrast}`);
    }
    
    if (effects.saturation !== 1) {
      colorAdjustments.push(`saturation=${effects.saturation}`);
    }

    if (colorAdjustments.length > 0) {
      filters.push(`eq=${colorAdjustments.join(':')}`);
    }

    // Apply blur
    if (effects.blur > 0) {
      filters.push(`gblur=sigma=${effects.blur}`);
    }

    // Apply opacity (alpha channel)
    if (effects.opacity < 1) {
      if (mediaType === 'video') {
        filters.push(`format=yuva420p,colorchannelmixer=aa=${effects.opacity}`);
      } else {
        filters.push(`format=rgba,colorchannelmixer=aa=${effects.opacity}`);
      }
    }

    return filters;
  }

  /**
   * Build box shadow effect (requires overlay composition)
   */
  buildBoxShadowEffect(details) {
    if (!details.boxShadow) return null;

    const shadow = details.boxShadow;
    
    return {
      enabled: true,
      color: shadow.color || '#000000',
      offsetX: shadow.x || 0,
      offsetY: shadow.y || 0,
      blur: shadow.blur || 0,
      opacity: shadow.opacity || 0.5
    };
  }

  /**
   * Apply animation effects based on timing
   */
  buildAnimationEffects(details, item, currentTime, fps) {
    const effects = [];
    
    if (!details.animations || !Array.isArray(details.animations)) {
      return effects;
    }

    const timing = item.display || {};
    const startTime = (timing.from || 0) / 1000;
    const endTime = (timing.to || 5000) / 1000;
    const duration = endTime - startTime;

    details.animations.forEach(animation => {
      switch (animation.type) {
        case 'fadeIn':
          if (currentTime <= startTime + (animation.duration / 1000)) {
            const progress = Math.max(0, (currentTime - startTime) / (animation.duration / 1000));
            effects.push({
              type: 'opacity',
              value: progress,
              filter: `colorchannelmixer=aa=${progress}`
            });
          }
          break;

        case 'fadeOut':
          const fadeOutStart = endTime - (animation.duration / 1000);
          if (currentTime >= fadeOutStart) {
            const progress = 1 - ((currentTime - fadeOutStart) / (animation.duration / 1000));
            effects.push({
              type: 'opacity',
              value: Math.max(0, progress),
              filter: `colorchannelmixer=aa=${Math.max(0, progress)}`
            });
          }
          break;

        case 'slideIn':
          if (currentTime <= startTime + (animation.duration / 1000)) {
            const progress = (currentTime - startTime) / (animation.duration / 1000);
            const direction = animation.direction || 'left';
            effects.push({
              type: 'position',
              direction,
              progress: this.easeInOut(progress)
            });
          }
          break;

        case 'zoom':
          if (currentTime <= startTime + (animation.duration / 1000)) {
            const progress = (currentTime - startTime) / (animation.duration / 1000);
            const scale = animation.from + (animation.to - animation.from) * this.easeInOut(progress);
            effects.push({
              type: 'scale',
              value: scale,
              filter: `scale=iw*${scale}:ih*${scale}`
            });
          }
          break;
      }
    });

    return effects;
  }

  /**
   * Easing function for smooth animations
   */
  easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Combine multiple filter chains
   */
  combineFilters(filterChains) {
    const combined = [];
    
    filterChains.forEach(chain => {
      if (Array.isArray(chain)) {
        combined.push(...chain);
      } else if (typeof chain === 'string' && chain.length > 0) {
        combined.push(chain);
      }
    });

    return combined.filter(filter => filter && filter.length > 0);
  }

  /**
   * Validate effect values
   */
  validateEffects(effects) {
    const warnings = [];

    if (effects.opacity < 0 || effects.opacity > 1) {
      warnings.push(`Opacity ${effects.opacity} is out of range [0,1]`);
    }

    if (effects.blur < 0) {
      warnings.push(`Blur ${effects.blur} cannot be negative`);
    }

    if (effects.brightness < 0 || effects.brightness > 2) {
      warnings.push(`Brightness ${effects.brightness} is out of range [0,2]`);
    }

    if (warnings.length > 0) {
      console.warn('⚠️ Effect validation warnings:', warnings);
    }

    return {
      isValid: warnings.length === 0,
      warnings
    };
  }

  /**
   * Get effect description for debugging
   */
  getEffectDescription(effects) {
    const descriptions = [];

    if (effects.opacity < 1) {
      descriptions.push(`${Math.round(effects.opacity * 100)}% opacity`);
    }

    if (effects.blur > 0) {
      descriptions.push(`${effects.blur}px blur`);
    }

    if (effects.brightness !== 1) {
      descriptions.push(`${Math.round(effects.brightness * 100)}% brightness`);
    }

    if (effects.flipX || effects.flipY) {
      const flips = [];
      if (effects.flipX) flips.push('horizontal');
      if (effects.flipY) flips.push('vertical');
      descriptions.push(`flipped ${flips.join(' & ')}`);
    }

    if (effects.rotation !== 0) {
      descriptions.push(`${effects.rotation}° rotation`);
    }

    return descriptions.length > 0 ? descriptions.join(', ') : 'no effects';
  }
}
