import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3002/api/v1/editor';

// Simple test data with just text
const simpleTestData = {
  id: 'simple-test',
  fps: 30,
  size: { width: 1080, height: 1920 },
  trackItemIds: ['text-1'],
  trackItemsMap: {
    'text-1': {
      display: { from: 0, to: 5000 },
      trim: {}
    }
  },
  trackItemDetailsMap: {
    'text-1': {
      type: 'text',
      details: {
        type: 'text',
        text: 'Hello World!',
        fontSize: 48,
        fontFamily: 'Arial',
        color: '#ffffff',
        backgroundColor: 'transparent',
        textAlign: 'center',
        left: '0px',
        top: '400px',
        width: 1080,
        height: 100,
        opacity: 100
      }
    }
  },
  transitionsMap: {},
  transitionIds: []
};

async function testSimpleRender() {
  console.log('🧪 Testing simple text-only render...');
  
  try {
    // Start render job
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simpleTestData)
    });
    
    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      throw new Error(`Render start failed: ${renderResponse.status} - ${errorText}`);
    }
    
    const renderData = await renderResponse.json();
    console.log('🚀 Simple render job started:', renderData.renderId);
    
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
        console.log('✅ Simple render completed!');
        console.log('📥 Download URL:', statusData.output);
        return statusData;
      } else if (statusData.status === 'failed') {
        console.error('❌ Simple render failed:', statusData.error);
        return null;
      }
      
      attempts++;
    }
    
    console.error('⏰ Simple render timed out');
    return null;
    
  } catch (error) {
    console.error('❌ Simple render test failed:', error.message);
    return null;
  }
}

// Run the test
testSimpleRender().then(result => {
  if (result) {
    console.log('🎉 Simple test passed!');
  } else {
    console.log('❌ Simple test failed!');
  }
  process.exit(result ? 0 : 1);
});
