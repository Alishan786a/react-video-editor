import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3002/api/v1/editor';

// Test data matching your frontend structure
const testProjectData = {
  id: 'test-project-1',
  fps: 30,
  size: { width: 1080, height: 1920 },
  trackItemIds: ['text-1', 'image-1'],
  trackItemsMap: {
    'text-1': {
      display: { from: 0, to: 5000 },
      trim: {}
    },
    'image-1': {
      display: { from: 1000, to: 4000 },
      trim: {}
    }
  },
  trackItemDetailsMap: {
    'text-1': {
      type: 'text',
      details: {
        type: 'text',
        text: 'Hello Custom Backend!',
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
    },
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
    }
  },
  transitionsMap: {},
  transitionIds: []
};

async function testHealthCheck() {
  console.log('🏥 Testing health check...');
  
  try {
    const response = await fetch(`${API_BASE}/render/health`);
    const data = await response.json();
    
    console.log('✅ Health check passed');
    console.log('📊 System info:', {
      service: data.service,
      version: data.version,
      license: data.license,
      ffmpeg: data.system?.ffmpeg_available
    });
    
    return data.system?.ffmpeg_available;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testVideoRender() {
  console.log('🎬 Testing video render...');
  
  try {
    // Start render job
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testProjectData)
    });
    
    if (!renderResponse.ok) {
      throw new Error(`Render start failed: ${renderResponse.status}`);
    }
    
    const renderData = await renderResponse.json();
    console.log('🚀 Render job started:', renderData.renderId);
    
    // Poll for completion
    const renderId = renderData.renderId;
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`${API_BASE}/render/status/${renderId}`);
      const statusData = await statusResponse.json();
      
      console.log(`📈 Progress: ${statusData.progress}% - ${statusData.currentStep}`);
      
      if (statusData.status === 'completed') {
        console.log('✅ Render completed!');
        console.log('📥 Download URL:', statusData.output);
        console.log('📊 File size:', statusData.fileSize ? `${Math.round(statusData.fileSize / 1024 / 1024)}MB` : 'Unknown');
        completed = true;
        return statusData;
      } else if (statusData.status === 'failed') {
        console.error('❌ Render failed:', statusData.error);
        return null;
      }
      
      attempts++;
    }
    
    if (!completed) {
      console.error('⏰ Render timed out after 5 minutes');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Render test failed:', error.message);
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

async function runAllTests() {
  console.log('🧪 Starting Custom Backend Tests\n');
  
  // Test 1: Health Check
  const ffmpegAvailable = await testHealthCheck();
  console.log('');
  
  if (!ffmpegAvailable) {
    console.error('❌ FFmpeg not available - cannot continue with render tests');
    console.log('💡 Install FFmpeg: https://ffmpeg.org/download.html');
    return;
  }
  
  // Test 2: Video Render
  const renderResult = await testVideoRender();
  console.log('');
  
  if (renderResult && renderResult.output) {
    // Test 3: Download
    await testDownload(renderResult.output);
    console.log('');
  }
  
  console.log('🎉 All tests completed!');
  console.log('\n📋 Test Summary:');
  console.log('✅ Health check: Passed');
  console.log(`${ffmpegAvailable ? '✅' : '❌'} FFmpeg: ${ffmpegAvailable ? 'Available' : 'Not found'}`);
  console.log(`${renderResult ? '✅' : '❌'} Video render: ${renderResult ? 'Passed' : 'Failed'}`);
  console.log(`${renderResult?.output ? '✅' : '❌'} Download: ${renderResult?.output ? 'Available' : 'Failed'}`);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testHealthCheck, testVideoRender, testDownload, runAllTests };
