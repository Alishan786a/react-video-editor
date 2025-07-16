import { IDesign } from "@designcombo/types";

// Archive-inspired data structures
export interface EnhancedPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface EnhancedTimeFrame {
  start: number;
  end: number;
}

export interface VideoEffect {
  type: "none" | "blackAndWhite" | "sepia" | "invert" | "saturate";
}

export interface Animation {
  id: string;
  targetId: string;
  duration: number;
  type: "fadeIn" | "fadeOut" | "slideIn" | "slideOut" | "breathe";
  properties?: {
    direction?: "left" | "right" | "top" | "bottom";
    useClipPath?: boolean;
    textType?: "none" | "character";
  };
}

export interface EnhancedTrackItemDetails {
  type: string;
  details: {
    src?: string;
    width?: number;
    height?: number;
    opacity?: number;
    transform?: string;
    border?: string;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    boxShadow?: {
      color: string;
      x: number;
      y: number;
      blur: number;
    };
    top?: string;
    left?: string;
    blur?: number;
    brightness?: number;
    flipX?: boolean;
    flipY?: boolean;
    volume?: number;
    text?: string;
    fontSize?: number;
    fontWeight?: number;
    fontFamily?: string;
    color?: string;
    // Archive-inspired enhancements
    placement?: EnhancedPlacement;
    timeFrame?: EnhancedTimeFrame;
    effect?: VideoEffect;
    animations?: Animation[];
  };
}

export interface EnhancedTrackItem {
  id: string;
  type: string;
  name: string;
  display: {
    from: number;
    to: number;
  };
  trim?: {
    from: number;
    to: number;
  };
  playbackRate: number;
  metadata: any;
  isMain: boolean;
  // Archive-inspired enhancements
  placement?: EnhancedPlacement;
  timeFrame?: EnhancedTimeFrame;
  effect?: VideoEffect;
  animations?: Animation[];
}

export interface EnhancedDesign extends IDesign {
  // Archive-inspired additions
  animations?: Animation[];
  effects?: VideoEffect[];
  maxTime?: number;
  backgroundColor?: string;
  trackItemDetailsMap: Record<string, EnhancedTrackItemDetails>;
  trackItemsMap: Record<string, EnhancedTrackItem>;
}

/**
 * Converts current trackItemDetailsMap to enhanced format with Archive features
 */
export function enhanceTrackItemDetails(
  trackItemDetailsMap: Record<string, any>
): Record<string, EnhancedTrackItemDetails> {
  const enhanced: Record<string, EnhancedTrackItemDetails> = {};

  Object.entries(trackItemDetailsMap).forEach(([id, item]) => {
    const details = item.details || {};
    
    // Convert positioning from CSS strings to numbers
    const placement: EnhancedPlacement = {
      x: parseFloat(details.left?.replace('px', '') || '0'),
      y: parseFloat(details.top?.replace('px', '') || '0'),
      width: details.width || 1080,
      height: details.height || 1920,
      rotation: 0, // Default rotation
      scaleX: extractScaleFromTransform(details.transform, 'x'),
      scaleY: extractScaleFromTransform(details.transform, 'y')
    };

    // Extract effect information
    const effect: VideoEffect = {
      type: determineEffectType(details)
    };

    enhanced[id] = {
      ...item,
      details: {
        ...details,
        placement,
        effect,
        animations: [] // Will be populated by extractAnimations
      }
    };
  });

  return enhanced;
}

/**
 * Converts current trackItemsMap to enhanced format with Archive features
 */
export function enhanceTrackItemsMap(
  trackItemsMap: Record<string, any>
): Record<string, EnhancedTrackItem> {
  const enhanced: Record<string, EnhancedTrackItem> = {};

  Object.entries(trackItemsMap).forEach(([id, item]) => {
    // Convert display timing to Archive's timeFrame format
    const timeFrame: EnhancedTimeFrame = {
      start: item.display?.from || 0,
      end: item.display?.to || 5000
    };

    enhanced[id] = {
      ...item,
      timeFrame,
      animations: [] // Will be populated by extractAnimations
    };
  });

  return enhanced;
}

/**
 * Extracts animations from track items with Archive-inspired animation detection
 */
export function extractAnimations(
  trackItemsMap: Record<string, any>,
  trackItemDetailsMap: Record<string, any>
): Animation[] {
  const animations: Animation[] = [];

  Object.entries(trackItemsMap).forEach(([id, item]) => {
    const details = trackItemDetailsMap[id]?.details;
    const timeFrame = {
      start: item.display?.from || 0,
      end: item.display?.to || 5000
    };

    // Create fade in animation for items that start after 0
    if (timeFrame.start > 0) {
      animations.push({
        id: `fadeIn_${id}`,
        targetId: id,
        duration: Math.min(500, timeFrame.end - timeFrame.start), // 0.5s or item duration
        type: "fadeIn"
      });
    }

    // Create fade out animation for items that end before the total duration
    const totalDuration = Math.max(...Object.values(trackItemsMap).map((item: any) => item.display?.to || 5000));
    if (timeFrame.end < totalDuration) {
      animations.push({
        id: `fadeOut_${id}`,
        targetId: id,
        duration: Math.min(500, timeFrame.end - timeFrame.start), // 0.5s or item duration
        type: "fadeOut"
      });
    }

    // Add slide animation based on positioning
    if (details?.left && parseFloat(details.left.replace('px', '')) < -50) {
      animations.push({
        id: `slideIn_${id}`,
        targetId: id,
        duration: 1000, // 1 second slide
        type: "slideIn",
        properties: {
          direction: "left",
          useClipPath: false,
          textType: item.type === "text" ? "character" : "none"
        }
      });
    }

    // Add breathe animation for items with long duration (> 3 seconds)
    const itemDuration = timeFrame.end - timeFrame.start;
    if (itemDuration > 3000 && item.type !== "audio") {
      animations.push({
        id: `breathe_${id}`,
        targetId: id,
        duration: itemDuration, // Full duration
        type: "breathe"
      });
    }

    // Add opacity-based fade if opacity is less than 100%
    if (details?.opacity !== undefined && details.opacity < 100) {
      animations.push({
        id: `opacityFade_${id}`,
        targetId: id,
        duration: Math.min(1000, itemDuration), // 1s or item duration
        type: "fadeIn"
      });
    }
  });

  return animations;
}

/**
 * Extracts effects from track item details
 */
export function extractEffects(
  trackItemDetailsMap: Record<string, any>
): VideoEffect[] {
  const effects: VideoEffect[] = [];
  const uniqueEffects = new Set<string>();

  Object.values(trackItemDetailsMap).forEach((item: any) => {
    const effectType = determineEffectType(item.details || {});
    if (!uniqueEffects.has(effectType)) {
      uniqueEffects.add(effectType);
      effects.push({ type: effectType as any });
    }
  });

  return effects;
}

/**
 * Helper function to extract scale from CSS transform string
 */
function extractScaleFromTransform(transform: string | undefined, axis: 'x' | 'y'): number {
  if (!transform) return 1;

  // Handle scale(value) format
  const scaleMatch = transform.match(/scale\(([^)]+)\)/);
  if (scaleMatch) {
    const values = scaleMatch[1].split(',').map(v => parseFloat(v.trim()));
    if (values.length === 1) {
      return values[0]; // Uniform scaling
    } else if (values.length === 2) {
      return axis === 'x' ? values[0] : values[1];
    }
  }

  // Handle scaleX() or scaleY() format
  const axisScaleMatch = transform.match(new RegExp(`scale${axis.toUpperCase()}\\(([^)]+)\\)`));
  if (axisScaleMatch) {
    return parseFloat(axisScaleMatch[1]);
  }

  return 1; // Default scale
}

/**
 * Helper function to determine effect type from details
 */
function determineEffectType(details: any): "none" | "blackAndWhite" | "sepia" | "invert" | "saturate" {
  // Check if effect is explicitly specified (from Archive-style data)
  if (details.effect && details.effect.type) {
    return details.effect.type;
  }

  // Infer effect from other properties
  if (details.brightness && details.brightness < 30) {
    return "blackAndWhite";
  }

  if (details.brightness && details.brightness > 150) {
    return "saturate";
  }

  // Check for sepia-like effects (warm tones)
  if (details.color && (details.color.includes('#8B4513') || details.color.includes('sepia'))) {
    return "sepia";
  }

  // Default to no effect
  return "none";
}

/**
 * Main function to enhance the entire design object
 */
export function enhanceDesignForExport(design: IDesign): EnhancedDesign {
  const enhancedTrackItemDetails = enhanceTrackItemDetails(design.trackItemDetailsMap);
  const enhancedTrackItemsMap = enhanceTrackItemsMap(design.trackItemsMap);
  const animations = extractAnimations(design.trackItemsMap, design.trackItemDetailsMap);
  const effects = extractEffects(design.trackItemDetailsMap);

  return {
    ...design,
    trackItemDetailsMap: enhancedTrackItemDetails,
    trackItemsMap: enhancedTrackItemsMap,
    animations,
    effects,
    maxTime: calculateMaxTime(design.trackItemsMap),
    backgroundColor: "#000000" // Default background
  };
}

/**
 * Calculate maximum time from track items
 */
function calculateMaxTime(trackItemsMap: Record<string, any>): number {
  let maxTime = 5000; // Default 5 seconds

  Object.values(trackItemsMap).forEach((item: any) => {
    if (item.display?.to) {
      maxTime = Math.max(maxTime, item.display.to);
    }
  });

  return maxTime;
}
