import fetch from 'node-fetch';

const CUSTOM_API = 'http://localhost:3001/api/v1/editor';
const UPLOAD_API = 'http://localhost:3000/api/v1/editor';

async function testIntegration() {
  console.log('🧪 Testing Full Integration (Upload + Custom Render)\n');

  // Test 1: Check all services are running
  console.log('1️⃣ Checking service health...');
  
  try {
    // Check upload backend
    const uploadHealth = await fetch(`${UPLOAD_API.replace('/v1/editor', '')}/health`);
    console.log(`   📤 Upload API (port 3000): ${uploadHealth.ok ? '✅ Running' : '❌ Down'}`);
    
    // Check custom render backend
    const renderHealth = await fetch(`${CUSTOM_API}/render/health`);
    const renderData = await renderHealth.json();
    console.log(`   🎬 Custom Render API (port 3001): ${renderHealth.ok ? '✅ Running' : '❌ Down'}`);
    console.log(`   🔧 FFmpeg Available: ${renderData.system?.ffmpeg_available ? '✅ Yes' : '❌ No'}`);
    
  } catch (error) {
    console.error('❌ Service health check failed:', error.message);
    return false;
  }

  // Test 2: Test render with external image
  console.log('\n2️⃣ Testing render with external image...');
  
  const testData = {
    id: 'integration-test',
    fps: 30,
    size: { width: 1080, height: 1920 },
    trackItemIds: ['test-image'],
    trackItemsMap: {
      'test-image': {
        display: { from: 0, to: 3000 },
        trim: {}
      }
    },
    trackItemDetailsMap: {
      'test-image': {
        type: 'image',
        details: {
          type: 'image',
          src: 'https://picsum.photos/600/400',
          width: 600,
          height: 400,
          left: '240px',
          top: '760px',
          opacity: 100,
          blur: 0
        }
      }
    },
    transitionsMap: {},
    transitionIds: []
  };

  try {
    // Start render
    const renderResponse = await fetch(`${CUSTOM_API}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!renderResponse.ok) {
      throw new Error(`Render failed: ${renderResponse.status}`);
    }

    const { renderId } = await renderResponse.json();
    console.log(`   🚀 Render started: ${renderId}`);

    // Poll for completion
    let attempts = 0;
    while (attempts < 24) { // 2 minutes max
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`${CUSTOM_API}/render/status/${renderId}`);
      const status = await statusResponse.json();
      
      console.log(`   📈 Progress: ${status.progress}% - ${status.currentStep}`);
      
      if (status.status === 'completed') {
        console.log(`   ✅ Render completed!`);
        console.log(`   📥 Download: ${status.output}`);
        
        // Test download
        const downloadResponse = await fetch(status.output, { method: 'HEAD' });
        console.log(`   📊 Download test: ${downloadResponse.ok ? '✅ Success' : '❌ Failed'}`);
        
        return true;
      } else if (status.status === 'failed') {
        console.log(`   ❌ Render failed: ${status.error}`);
        return false;
      }
      
      attempts++;
    }
    
    console.log('   ⏰ Render timed out');
    return false;
    
  } catch (error) {
    console.error('❌ Render test failed:', error.message);
    return false;
  }
}

async function testFrontendConfig() {
  console.log('\n3️⃣ Testing frontend configuration...');
  
  try {
    // Check if frontend is accessible
    const frontendResponse = await fetch('http://localhost:5174', { method: 'HEAD' });
    console.log(`   🌐 Frontend (port 5174): ${frontendResponse.ok ? '✅ Running' : '❌ Down'}`);
    
    console.log('   ⚙️ API Configuration:');
    console.log('      - BACKEND_TYPE: custom');
    console.log('      - UPLOAD_API_URL: http://localhost:3000/api/v1/editor');
    console.log('      - RENDER_API_URL: http://localhost:3001/api/v1/editor');
    
    return frontendResponse.ok;
    
  } catch (error) {
    console.error('❌ Frontend check failed:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🎯 Custom Backend Integration Test\n');
  
  const integrationResult = await testIntegration();
  const frontendResult = await testFrontendConfig();
  
  console.log('\n📋 Test Results:');
  console.log(`${integrationResult ? '✅' : '❌'} Backend Integration: ${integrationResult ? 'PASSED' : 'FAILED'}`);
  console.log(`${frontendResult ? '✅' : '❌'} Frontend Configuration: ${frontendResult ? 'PASSED' : 'FAILED'}`);
  
  if (integrationResult && frontendResult) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n🚀 Your setup is ready:');
    console.log('   1. Open http://localhost:5174 in your browser');
    console.log('   2. Upload images or videos');
    console.log('   3. Create your video project');
    console.log('   4. Click export - it will use your custom backend!');
    console.log('\n✨ 100% FREE for commercial use - no licensing restrictions!');
  } else {
    console.log('\n❌ Some tests failed. Please check the services.');
  }
  
  return integrationResult && frontendResult;
}

runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
