import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { VideoComposition } from './VideoComposition.jsx';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="VideoEditor"
        component={VideoComposition}
        durationInFrames={150} // 5 seconds at 30fps - will be dynamic
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          // Default props structure matching your video editor
          trackItemIds: [],
          trackItemsMap: {},
          trackItemDetailsMap: {},
          size: { width: 1080, height: 1920 },
          fps: 30,
          duration: 5000, // 5 seconds in ms
          animations: [],
          effects: []
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
