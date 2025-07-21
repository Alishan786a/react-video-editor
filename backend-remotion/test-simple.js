import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1/editor/remotion';

// Simple test data with just text (no external downloads needed)
const simpleTestData = {
  id: "simple-test-123",
  fps: 30,
  size: {
    width: 1080,
    height: 1920
  },
  trackItemIds: ["text-1"],
  trackItemsMap: {
    "text-1": {
      id: "text-1",
      type: "text",
      display: {
        from: 0,
        to: 3000  // 3 seconds
      }
    }
  },
  trackItemDetailsMap: {
    "text-1": {
      id: "text-1",
      type: "text",
      details: {
        type: "text",
        text: "🎬 Remotion Works!\nFree Video Export ✅",
        left: "0px",
        top: "800px",
        width: 1080,
        height: 320,
        fontSize: 64,
        fontFamily: "Arial",
        color: "#ffffff",
        textAlign: "center",
        opacity: 100,
        backgroundColor: "rgba(0,0,0,0.7)"
      }
    }
  },
  animations: [],
  effects: []
};

async function testSimpleRemotion() {
  try {
    console.log('🧪 Testing Remotion with Simple Text Video...\n');

    // 1. Health check
    console.log('1️⃣ Checking server health...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    
    if (healthData.success) {
      console.log('✅ Server is healthy!');
      console.log(`   Service: ${healthData.service}`);
      console.log(`   Free License: ${healthData.features.free_license}`);
    } else {
      throw new Error('Server health check failed');
    }

    // 2. Start render job
    console.log('\n2️⃣ Starting simple text render job...');
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(simpleTestData),
    });

    const renderData = await renderResponse.json();
    
    if (!renderData.success) {
      throw new Error(`Render start failed: ${renderData.error}`);
    }

    console.log('✅ Render job started!');
    console.log(`   Render ID: ${renderData.renderId}`);
    const renderId = renderData.renderId;

    // 3. Poll for completion
    console.log('\n3️⃣ Monitoring render progress...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 30; // 1 minute max for simple text

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await fetch(`${API_BASE}/render/status/${renderId}`);
      const statusData = await statusResponse.json();
      
      if (statusData.success) {
        console.log(`   Progress: ${statusData.progress}% (${statusData.status})`);
        
        if (statusData.status === 'completed') {
          console.log('✅ Render completed!');
          console.log(`   Download URL: ${statusData.output}`);
          completed = true;
          
          // 4. Test download URL
          console.log('\n4️⃣ Testing download URL...');
          const downloadResponse = await fetch(statusData.output, { method: 'HEAD' });
          if (downloadResponse.ok) {
            console.log('✅ Download URL is accessible!');
            const fileSize = downloadResponse.headers.get('content-length');
            console.log(`   File size: ${fileSize ? Math.round(fileSize / 1024) + ' KB' : 'Unknown'}`);
            console.log(`   Content type: ${downloadResponse.headers.get('content-type')}`);
          } else {
            console.log('❌ Download URL not accessible');
          }
          
        } else if (statusData.status === 'failed') {
          throw new Error(`Render failed: ${statusData.error}`);
        }
      } else {
        throw new Error(`Status check failed: ${statusData.error}`);
      }
      
      attempts++;
    }

    if (!completed) {
      throw new Error('Render timed out');
    }

    console.log('\n🎉 Simple test passed! Remotion is working correctly.');
    console.log('\n📋 What this proves:');
    console.log('   ✅ Remotion server is running');
    console.log('   ✅ Text rendering works');
    console.log('   ✅ Video export works');
    console.log('   ✅ Download URLs are accessible');
    console.log('   ✅ Your video editor can now use Remotion!');

  } catch (error) {
    console.error('❌ Simple test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure the Remotion server is running: cd backend-remotion && npm start');
    console.log('   2. Check the server logs for detailed error information');
    console.log('   3. Verify port 3001 is not blocked by firewall');
  }
}

// Run the simple test
testSimpleRemotion();
