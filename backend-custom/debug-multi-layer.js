import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1/editor';

// Test data with 2 images to debug multi-layer composition
const debugTestData = {
  id: 'debug-multi-layer',
  fps: 30,
  size: { width: 1080, height: 1920 },
  trackItemIds: ['image-1', 'image-2'], // 2 items in specific order
  trackItemsMap: {
    'image-1': {
      display: { from: 0, to: 5000 },
      trim: {}
    },
    'image-2': {
      display: { from: 0, to: 5000 },
      trim: {}
    }
  },
  trackItemDetailsMap: {
    'image-1': {
      type: 'image',
      details: {
        type: 'image',
        src: 'https://picsum.photos/400/300',
        width: 400,
        height: 300,
        left: '100px',
        top: '200px',
        opacity: 100,
        blur: 0
      }
    },
    'image-2': {
      type: 'image',
      details: {
        type: 'image',
        src: 'https://picsum.photos/300/400',
        width: 300,
        height: 400,
        left: '500px',
        top: '600px',
        opacity: 80,
        blur: 0
      }
    }
  },
  transitionsMap: {},
  transitionIds: []
};

async function debugMultiLayer() {
  console.log('🔍 DEBUG: Testing multi-layer composition...');
  console.log(`📋 trackItemIds: [${debugTestData.trackItemIds.join(', ')}]`);
  console.log(`📊 Expected: 2 layers should be processed and overlaid`);
  
  try {
    // Start render job
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(debugTestData)
    });
    
    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      throw new Error(`Render start failed: ${renderResponse.status} - ${errorText}`);
    }
    
    const renderData = await renderResponse.json();
    console.log('🚀 Debug render job started:', renderData.renderId);
    
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
        console.log('✅ Debug render completed!');
        console.log('📥 Download URL:', statusData.output);
        
        // Check server logs for multi-layer composition evidence
        console.log('\n🔍 Check server logs for:');
        console.log('   - "🔍 Organizing 2 items by type"');
        console.log('   - "📋 Item 0: image-1 (type: image)"');
        console.log('   - "📋 Item 1: image-2 (type: image)"');
        console.log('   - "🎬 Final layer composition order:"');
        console.log('   - "📹 Multi-layer composition: 2 layers"');
        console.log('   - "📥 Adding layer 1: ... (z-index: 1)"');
        
        return statusData;
      } else if (statusData.status === 'failed') {
        console.error('❌ Debug render failed:', statusData.error);
        return null;
      }
      
      attempts++;
    }
    
    console.error('⏰ Debug render timed out');
    return null;
    
  } catch (error) {
    console.error('❌ Debug render test failed:', error.message);
    return null;
  }
}

// Run the debug test
debugMultiLayer().then(result => {
  if (result) {
    console.log('\n🎉 Debug test completed - check server logs for multi-layer evidence!');
  } else {
    console.log('\n❌ Debug test failed!');
  }
  process.exit(result ? 0 : 1);
});
