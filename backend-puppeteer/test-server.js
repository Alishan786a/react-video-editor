import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1/editor';

// Test payload matching your actual video editor structure
const testPayload = {
  id: 'test-project-123',
  fps: 30,
  size: {
    width: 1080,
    height: 1920
  },
  trackItemIds: ['text-1', 'image-1'],
  trackItemsMap: {
    'text-1': {
      display: { from: 0, to: 3000 },
      trim: {}
    },
    'image-1': {
      display: { from: 0, to: 3000 },
      trim: {}
    }
  },
  trackItemDetailsMap: {
    'text-1': {
      type: 'text',
      details: {
        text: 'Hello Puppeteer!',
        fontSize: 48,
        color: '#ffffff',
        fontFamily: 'Arial',
        fontWeight: 'bold',
        width: 400,
        height: 100,
        left: '100px',
        top: '200px',
        opacity: 100
      }
    },
    'image-1': {
      type: 'image',
      details: {
        src: 'https://via.placeholder.com/400x300/ff0000/ffffff?text=Test+Image',
        width: 400,
        height: 300,
        left: '200px',
        top: '500px',
        opacity: 100,
        transform: 'scale(1)',
        blur: 0,
        brightness: 100
      }
    }
  },
  trackItemsMap: {
    'track-1': ['text-1', 'image-1']
  },
  tracks: [
    {
      id: 'track-1',
      type: 'video'
    }
  ]
};

async function testHealthCheck() {
  console.log('🏥 Testing health check...');
  try {
    const response = await fetch(`${API_BASE}/render/health`);
    const data = await response.json();
    console.log('✅ Health check passed:', data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testRender() {
  console.log('🎬 Testing video render...');
  try {
    // Start render
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    if (!renderResponse.ok) {
      throw new Error(`Render request failed: ${renderResponse.status}`);
    }

    const renderData = await renderResponse.json();
    console.log('✅ Render started:', renderData);

    const renderId = renderData.renderId;

    // Poll for status
    console.log('⏳ Polling for render status...');
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await fetch(`${API_BASE}/render/status/${renderId}`);
      const statusData = await statusResponse.json();

      console.log(`📊 Status: ${statusData.status} (${statusData.progress}%) - ${statusData.message || ''}`);

      if (statusData.status === 'completed') {
        console.log('✅ Render completed!');
        console.log('📹 Video URL:', statusData.output);
        return true;
      } else if (statusData.status === 'failed') {
        console.error('❌ Render failed:', statusData.error);
        return false;
      }

      attempts++;
    }

    console.error('❌ Render timed out');
    return false;

  } catch (error) {
    console.error('❌ Render test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Starting Puppeteer Backend Tests\n');

  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('❌ Health check failed, skipping render test');
    return;
  }

  console.log('');
  const renderOk = await testRender();

  console.log('\n📋 Test Results:');
  console.log(`   Health Check: ${healthOk ? '✅' : '❌'}`);
  console.log(`   Video Render: ${renderOk ? '✅' : '❌'}`);

  if (healthOk && renderOk) {
    console.log('\n🎉 All tests passed! Puppeteer backend is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
}

// Run tests
runTests().catch(console.error);
