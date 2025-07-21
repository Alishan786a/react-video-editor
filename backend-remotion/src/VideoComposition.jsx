import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Img,
  OffthreadVideo,
  Audio,
  interpolate,
  spring,
  staticFile
} from 'remotion';

// Helper function to convert editor coordinates to Remotion coordinates
const convertEditorToRemotionCoords = (editorLeft, editorTop, details, originalWidth, originalHeight, canvasWidth = 1080, canvasHeight = 1920) => {
  // Extract scale information
  let scale = 1;
  if (details.placement && details.placement.scaleX) {
    scale = details.placement.scaleX;
  } else if (details.transform && details.transform.includes('scale')) {
    const scaleMatch = details.transform.match(/scale\(([^)]+)\)/);
    if (scaleMatch) {
      const scaleValues = scaleMatch[1].split(',').map(v => parseFloat(v.trim()));
      scale = scaleValues[0] || 1;
    }
  }

  // Calculate scaled dimensions
  const scaledWidth = originalWidth * scale;
  const scaledHeight = originalHeight * scale;

  // Convert editor coordinates to Remotion coordinates
  const leftCenterOffset = (canvasWidth - scaledWidth) / 2;
  const topCenterOffset = (canvasHeight - scaledHeight) / 2;
  const baseLeftOffset = (originalWidth - canvasWidth) / 2;
  const baseTopOffset = (originalHeight - canvasHeight) / 2;

  const renderLeft = editorLeft + leftCenterOffset + baseLeftOffset;
  const renderTop = editorTop + topCenterOffset + baseTopOffset;

  return {
    left: Math.round(renderLeft),
    top: Math.round(renderTop),
    width: Math.round(scaledWidth),
    height: Math.round(scaledHeight),
    scale: scale
  };
};

// Component for rendering images
const ImageLayer = ({ item, itemDetails, fps }) => {
  const frame = useCurrentFrame();
  const { width: canvasWidth, height: canvasHeight } = useVideoConfig();
  
  const details = itemDetails.details;
  const display = item.display || {};
  
  const startFrame = Math.round((display.from || 0) / 1000 * fps);
  const endFrame = Math.round((display.to || display.from + 5000) / 1000 * fps);
  const durationInFrames = endFrame - startFrame;

  // Convert coordinates
  const editorLeft = parseFloat(String(details.left || '0').replace('px', '')) || 0;
  const editorTop = parseFloat(String(details.top || '0').replace('px', '')) || 0;
  
  const coords = convertEditorToRemotionCoords(
    editorLeft,
    editorTop,
    details,
    details.width || canvasWidth,
    details.height || canvasHeight,
    canvasWidth,
    canvasHeight
  );

  // Apply effects and animations
  let opacity = (details.opacity || 100) / 100;
  let transform = '';

  // Handle animations
  if (details.animations && details.animations.length > 0) {
    details.animations.forEach(animation => {
      if (animation.type === 'fadeIn') {
        const fadeProgress = interpolate(
          frame - startFrame,
          [0, animation.duration / 1000 * fps],
          [0, 1],
          { extrapolateRight: 'clamp' }
        );
        opacity *= fadeProgress;
      } else if (animation.type === 'fadeOut') {
        const fadeOutStart = durationInFrames - (animation.duration / 1000 * fps);
        const fadeProgress = interpolate(
          frame - startFrame,
          [fadeOutStart, durationInFrames],
          [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        opacity *= fadeProgress;
      }
    });
  }

  // Handle transforms
  if (details.flipX) transform += ' scaleX(-1)';
  if (details.flipY) transform += ' scaleY(-1)';

  const style = {
    position: 'absolute',
    left: coords.left,
    top: coords.top,
    width: coords.width,
    height: coords.height,
    opacity,
    transform: transform.trim() || undefined,
    filter: details.blur ? `blur(${details.blur}px)` : undefined,
  };

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <Img src={details.src} style={style} />
    </Sequence>
  );
};

// Component for rendering videos
const VideoLayer = ({ item, itemDetails, fps }) => {
  const frame = useCurrentFrame();
  const { width: canvasWidth, height: canvasHeight } = useVideoConfig();
  
  const details = itemDetails.details;
  const display = item.display || {};
  const trim = item.trim || {};
  
  const startFrame = Math.round((display.from || 0) / 1000 * fps);
  const endFrame = Math.round((display.to || display.from + 5000) / 1000 * fps);
  const durationInFrames = endFrame - startFrame;

  // Convert coordinates
  const editorLeft = parseFloat(String(details.left || '0').replace('px', '')) || 0;
  const editorTop = parseFloat(String(details.top || '0').replace('px', '')) || 0;
  
  const coords = convertEditorToRemotionCoords(
    editorLeft,
    editorTop,
    details,
    details.width || canvasWidth,
    details.height || canvasHeight,
    canvasWidth,
    canvasHeight
  );

  let opacity = (details.opacity || 100) / 100;
  let transform = '';

  // Handle transforms
  if (details.flipX) transform += ' scaleX(-1)';
  if (details.flipY) transform += ' scaleY(-1)';

  const style = {
    position: 'absolute',
    left: coords.left,
    top: coords.top,
    width: coords.width,
    height: coords.height,
    opacity,
    transform: transform.trim() || undefined,
    filter: details.blur ? `blur(${details.blur}px)` : undefined,
  };

  const videoProps = {
    src: details.src,
    style,
    volume: (details.volume || 100) / 100,
    muted: (details.volume || 100) === 0, // Mute if volume is 0
  };

  // Handle video trimming
  if (trim.from !== undefined) {
    videoProps.startFrom = Math.round(trim.from / 1000 * fps);
  }
  if (trim.to !== undefined) {
    videoProps.endAt = Math.round(trim.to / 1000 * fps);
  }

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <OffthreadVideo {...videoProps} />
    </Sequence>
  );
};

// Component for rendering audio
const AudioLayer = ({ item, itemDetails, fps }) => {
  const details = itemDetails.details;
  const display = item.display || {};
  const trim = item.trim || {};
  
  const startFrame = Math.round((display.from || 0) / 1000 * fps);
  const endFrame = Math.round((display.to || display.from + 5000) / 1000 * fps);
  const durationInFrames = endFrame - startFrame;

  const audioProps = {
    src: details.src,
    volume: (details.volume || 100) / 100,
  };

  // Handle audio trimming
  if (trim.from !== undefined) {
    audioProps.startFrom = Math.round(trim.from / 1000 * fps);
  }
  if (trim.to !== undefined) {
    audioProps.endAt = Math.round(trim.to / 1000 * fps);
  }

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <Audio {...audioProps} />
    </Sequence>
  );
};

// Component for rendering text
const TextLayer = ({ item, itemDetails, fps }) => {
  const frame = useCurrentFrame();
  const { width: canvasWidth, height: canvasHeight } = useVideoConfig();
  
  const details = itemDetails.details;
  const display = item.display || {};
  
  const startFrame = Math.round((display.from || 0) / 1000 * fps);
  const endFrame = Math.round((display.to || display.from + 5000) / 1000 * fps);
  const durationInFrames = endFrame - startFrame;

  // Convert coordinates for text
  const editorLeft = parseFloat(String(details.left || '0').replace('px', '')) || 0;
  const editorTop = parseFloat(String(details.top || '0').replace('px', '')) || 0;
  
  const textWidth = details.width || 600;
  const textHeight = details.height || 100;
  
  const coords = convertEditorToRemotionCoords(
    editorLeft,
    editorTop,
    details,
    textWidth,
    textHeight,
    canvasWidth,
    canvasHeight
  );

  let opacity = (details.opacity || 100) / 100;

  const textStyle = {
    position: 'absolute',
    left: coords.left,
    top: coords.top,
    width: coords.width,
    height: coords.height,
    opacity,
    fontSize: details.fontSize || 48,
    fontFamily: details.fontFamily || 'Arial',
    color: details.color || '#ffffff',
    backgroundColor: details.backgroundColor === 'transparent' ? 'transparent' : details.backgroundColor,
    textAlign: details.textAlign || 'center',
    fontWeight: details.fontWeight || 'normal',
    fontStyle: details.fontStyle || 'normal',
    textDecoration: details.textDecoration || 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: details.textAlign === 'left' ? 'flex-start' : details.textAlign === 'right' ? 'flex-end' : 'center',
    overflow: 'hidden',
    wordWrap: 'break-word',
  };

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <div style={textStyle}>
        {details.text || ''}
      </div>
    </Sequence>
  );
};

// Main composition component
export const VideoComposition = ({
  trackItemIds = [],
  trackItemsMap = {},
  trackItemDetailsMap = {},
  size = { width: 1080, height: 1920 },
  fps = 30,
  duration = 5000,
  animations = [],
  effects = []
}) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {trackItemIds.map((itemId) => {
        const item = trackItemsMap[itemId];
        const itemDetails = trackItemDetailsMap[itemId];
        
        if (!item || !itemDetails || !itemDetails.details) {
          return null;
        }

        const itemType = itemDetails.details.type || itemDetails.type || 'unknown';

        switch (itemType) {
          case 'image':
            return <ImageLayer key={itemId} item={item} itemDetails={itemDetails} fps={fps} />;
          case 'video':
            return <VideoLayer key={itemId} item={item} itemDetails={itemDetails} fps={fps} />;
          case 'audio':
            return <AudioLayer key={itemId} item={item} itemDetails={itemDetails} fps={fps} />;
          case 'text':
            return <TextLayer key={itemId} item={item} itemDetails={itemDetails} fps={fps} />;
          default:
            console.warn(`Unknown item type: ${itemType}`);
            return null;
        }
      })}
    </AbsoluteFill>
  );
};
