import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1/editor';

// Test data with image and video
const fullTestData = {
  id: 'full-test',
  fps: 30,
  size: { width: 1080, height: 1920 },
  trackItemIds: ['image-1', 'video-1'],
  trackItemsMap: {
    'image-1': {
      display: { from: 0, to: 3000 },
      trim: {}
    },
    'video-1': {
      display: { from: 2000, to: 5000 },
      trim: {}
    }
  },
  trackItemDetailsMap: {
    'image-1': {
      type: 'image',
      details: {
        type: 'image',
        src: 'https://picsum.photos/800/600',
        width: 800,
        height: 600,
        left: '140px',
        top: '660px',
        opacity: 80,
        blur: 0
      }
    },
    'video-1': {
      type: 'video',
      details: {
        type: 'video',
        src: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        width: 640,
        height: 360,
        left: '220px',
        top: '780px',
        opacity: 90,
        blur: 0
      }
    }
  },
  transitionsMap: {},
  transitionIds: []
};

async function testFullRender() {
  console.log('🧪 Testing full render (image + video)...');
  
  try {
    // Start render job
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullTestData)
    });
    
    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      throw new Error(`Render start failed: ${renderResponse.status} - ${errorText}`);
    }
    
    const renderData = await renderResponse.json();
    console.log('🚀 Full render job started:', renderData.renderId);
    
    // Poll for completion
    const renderId = renderData.renderId;
    let completed = false;
    let attempts = 0;
    const maxAttempts = 36; // 3 minutes max
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`${API_BASE}/render/status/${renderId}`);
      const statusData = await statusResponse.json();
      
      console.log(`📈 Progress: ${statusData.progress}% - ${statusData.currentStep}`);
      
      if (statusData.status === 'completed') {
        console.log('✅ Full render completed!');
        console.log('📥 Download URL:', statusData.output);
        console.log('📊 File size:', statusData.fileSize ? `${Math.round(statusData.fileSize / 1024 / 1024)}MB` : 'Unknown');
        console.log('⏱️ Duration:', statusData.duration ? `${statusData.duration}s` : 'Unknown');
        return statusData;
      } else if (statusData.status === 'failed') {
        console.error('❌ Full render failed:', statusData.error);
        return null;
      }
      
      attempts++;
    }
    
    console.error('⏰ Full render timed out');
    return null;
    
  } catch (error) {
    console.error('❌ Full render test failed:', error.message);
    return null;
  }
}

async function testDownload(downloadUrl) {
  if (!downloadUrl) return false;
  
  console.log('📥 Testing download...');
  
  try {
    const response = await fetch(downloadUrl, { method: 'HEAD' });
    
    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      console.log('✅ Download test passed');
      console.log('📊 File size:', contentLength ? `${Math.round(contentLength / 1024 / 1024)}MB` : 'Unknown');
      return true;
    } else {
      console.error('❌ Download test failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Download test error:', error.message);
    return false;
  }
}

async function runFullTest() {
  console.log('🧪 Starting Full Backend Test (Image + Video)\n');
  
  // Test full render
  const renderResult = await testFullRender();
  console.log('');
  
  if (renderResult && renderResult.output) {
    // Test download
    await testDownload(renderResult.output);
    console.log('');
  }
  
  console.log('🎉 Full test completed!');
  console.log('\n📋 Test Summary:');
  console.log(`${renderResult ? '✅' : '❌'} Full render: ${renderResult ? 'Passed' : 'Failed'}`);
  console.log(`${renderResult?.output ? '✅' : '❌'} Download: ${renderResult?.output ? 'Available' : 'Failed'}`);
  
  if (renderResult) {
    console.log('\n🎬 Video Details:');
    console.log(`📁 File: ${renderResult.output}`);
    console.log(`📊 Size: ${renderResult.fileSize ? Math.round(renderResult.fileSize / 1024 / 1024) + 'MB' : 'Unknown'}`);
    console.log(`⏱️ Duration: ${renderResult.duration || 'Unknown'}s`);
  }
}

// Run the test
runFullTest().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
