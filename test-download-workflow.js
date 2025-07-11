#!/usr/bin/env node

/**
 * Test script to verify the complete video download workflow
 * This simulates what the frontend does when exporting a video
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/v1/editor';

// Your latest exact payload structure with audio + 2 overlapping images
const sampleProjectData = {
  id: 'Mw4nobp7BqKHuE4',
  fps: 30,
  tracks: [
    {
      id: 'x3i-fVMBw9RS2BF4uDN_m',
      accepts: ['text', 'audio', 'helper', 'video', 'image', 'caption'],
      type: 'audio',
      items: ['wxb2ETdQrz1Hol2'],
      magnetic: false,
      static: false
    },
    {
      id: 'tpq0DO_7jClQNajyW4djh',
      accepts: ['text', 'audio', 'helper', 'video', 'image', 'caption'],
      type: 'image',
      items: ['l1iS5ZeTi6rHBmC'],
      magnetic: false,
      static: false
    },
    {
      id: 'DZAGQmvxsgixlR_pXzdvK',
      accepts: ['text', 'audio', 'helper', 'video', 'image', 'caption'],
      type: 'image',
      items: ['HsJJosOuUv1uKkyx'],
      magnetic: false,
      static: false
    }
  ],
  size: {
    width: 1080,
    height: 1920
  },
  trackItemDetailsMap: {
    'HsJJosOuUv1uKkyx': {
      type: 'image',
      details: {
        src: 'https://ik.imagekit.io/wombo/images/img4.jpg',
        width: 1280,
        height: 1920,
        opacity: 100,
        transform: 'scale(0.84375)',
        border: 'none',
        borderRadius: 0,
        boxShadow: {
          color: '#000000',
          x: 0,
          y: 0,
          blur: 0
        },
        top: '0px',
        left: '-100px',
        borderWidth: 0,
        borderColor: '#000000',
        blur: 0,
        brightness: 100,
        flipX: false,
        flipY: false
      }
    },
    'l1iS5ZeTi6rHBmC': {
      type: 'image',
      details: {
        src: 'https://ik.imagekit.io/wombo/images/img1.jpg',
        width: 1280,
        height: 853,
        opacity: 100,
        transform: 'scale(0.84375)',
        border: 'none',
        borderRadius: 0,
        boxShadow: {
          color: '#000000',
          x: 0,
          y: 0,
          blur: 0
        },
        top: '533.5px',
        left: '-100px',
        borderWidth: 0,
        borderColor: '#000000',
        blur: 0,
        brightness: 100,
        flipX: false,
        flipY: false
      }
    },
    'wxb2ETdQrz1Hol2': {
      type: 'audio',
      details: {
        src: 'https://ik.imagekit.io/snapmotion/timer-voice.mp3',
        duration: 50503.401,
        volume: 100
      }
    }
  },
  trackItemIds: ['HsJJosOuUv1uKkyx', 'l1iS5ZeTi6rHBmC', 'wxb2ETdQrz1Hol2'],
  transitionsMap: {},
  trackItemsMap: {
    'HsJJosOuUv1uKkyx': {
      id: 'HsJJosOuUv1uKkyx',
      type: 'image',
      name: 'image',
      display: {
        from: 0,
        to: 5000
      },
      playbackRate: 1,
      metadata: {},
      isMain: false
    },
    'l1iS5ZeTi6rHBmC': {
      id: 'l1iS5ZeTi6rHBmC',
      type: 'image',
      name: 'image',
      display: {
        from: 851.0638297872341,
        to: 5851.063829787234
      },
      playbackRate: 1,
      metadata: {},
      isMain: false
    },
    'wxb2ETdQrz1Hol2': {
      id: 'wxb2ETdQrz1Hol2',
      name: '',
      type: 'audio',
      display: {
        from: 0,
        to: 6489.361702127659
      },
      trim: {
        from: 44014.03929787231,
        to: 50503.401
      },
      playbackRate: 1,
      metadata: {},
      isMain: false
    }
  },
  transitionIds: []
};

async function testCompleteWorkflow() {
  console.log('🚀 Starting complete video download workflow test...\n');

  try {
    // Step 1: Check if backend is healthy
    console.log('1. Checking backend health...');
    const healthResponse = await fetch(`${API_BASE}/render/health`);
    const healthData = await healthResponse.json();
    
    if (!healthData.success) {
      throw new Error('Backend health check failed');
    }
    
    console.log('✅ Backend is healthy');
    console.log(`   Active jobs: ${healthData.active_jobs}`);
    console.log(`   Total jobs: ${healthData.total_jobs}\n`);

    // Step 2: Start render job
    console.log('2. Starting render job...');
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleProjectData),
    });

    if (!renderResponse.ok) {
      throw new Error(`Render request failed: ${renderResponse.status}`);
    }

    const renderData = await renderResponse.json();
    
    if (!renderData.success || !renderData.renderId) {
      throw new Error('Render job failed to start');
    }

    console.log('✅ Render job started successfully');
    console.log(`   Render ID: ${renderData.renderId}\n`);

    // Step 3: Poll render status
    console.log('3. Polling render status...');
    const renderId = renderData.renderId;
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts = 1 minute max wait
    
    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${API_BASE}/render/status/${renderId}`);
      
      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      const { status, progress, output } = statusData.render;

      console.log(`   Status: ${status}, Progress: ${progress}%`);

      if (status === 'completed' && output) {
        console.log('✅ Render completed successfully');
        console.log(`   Output URL: ${output}\n`);
        
        // Step 4: Test file download
        console.log('4. Testing file download...');
        const downloadResponse = await fetch(output, { method: 'HEAD' });
        
        if (!downloadResponse.ok) {
          throw new Error(`Download test failed: ${downloadResponse.status}`);
        }

        const contentType = downloadResponse.headers.get('content-type');
        const contentLength = downloadResponse.headers.get('content-length');
        
        console.log('✅ File is downloadable');
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Content-Length: ${contentLength} bytes`);
        console.log(`   Size: ${(parseInt(contentLength) / 1024).toFixed(2)} KB\n`);

        console.log('🎉 Complete workflow test PASSED!');
        console.log('\nYou can now test the frontend by:');
        console.log('1. Opening http://localhost:5174 in your browser');
        console.log('2. Clicking the download button (arrow down icon)');
        console.log('3. Clicking "Export" to start the render');
        console.log('4. Waiting for the progress to complete');
        console.log('5. The video should automatically download');
        
        return true;
      } else if (status === 'failed') {
        throw new Error(`Render failed: ${statusData.render.error}`);
      }

      // Wait 2 seconds before next check (same as frontend)
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Render timed out after 1 minute');

  } catch (error) {
    console.error('❌ Workflow test FAILED:', error.message);
    return false;
  }
}

// Run the test
testCompleteWorkflow().then(success => {
  process.exit(success ? 0 : 1);
});
