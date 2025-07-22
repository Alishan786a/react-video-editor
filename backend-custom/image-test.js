import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1/editor';

// Simple test data with just an image
const imageTestData = {
  id: 'image-test',
  fps: 30,
  size: { width: 1080, height: 1920 },
  trackItemIds: ['image-1'],
  trackItemsMap: {
    'image-1': {
      display: { from: 0, to: 5000 },
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
        opacity: 100,
        blur: 0
      }
    }
  },
  transitionsMap: {},
  transitionIds: []
};

async function testImageRender() {
  console.log('🧪 Testing image-only render...');
  
  try {
    // Start render job
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageTestData)
    });
    
    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      throw new Error(`Render start failed: ${renderResponse.status} - ${errorText}`);
    }
    
    const renderData = await renderResponse.json();
    console.log('🚀 Image render job started:', renderData.renderId);
    
    // Poll for completion
    const renderId = renderData.renderId;
    let completed = false;
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes max
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`${API_BASE}/render/status/${renderId}`);
      const statusData = await statusResponse.json();
      
      console.log(`📈 Progress: ${statusData.progress}% - ${statusData.currentStep}`);
      
      if (statusData.status === 'completed') {
        console.log('✅ Image render completed!');
        console.log('📥 Download URL:', statusData.output);
        return statusData;
      } else if (statusData.status === 'failed') {
        console.error('❌ Image render failed:', statusData.error);
        return null;
      }
      
      attempts++;
    }
    
    console.error('⏰ Image render timed out');
    return null;
    
  } catch (error) {
    console.error('❌ Image render test failed:', error.message);
    return null;
  }
}

// Run the test
testImageRender().then(result => {
  if (result) {
    console.log('🎉 Image test passed!');
  } else {
    console.log('❌ Image test failed!');
  }
  process.exit(result ? 0 : 1);
});
