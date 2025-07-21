import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1/editor/remotion';

// Test data that matches your video editor structure
const testProjectData = {
  id: "test-project-123",
  fps: 30,
  size: {
    width: 1080,
    height: 1920
  },
  trackItemIds: ["text-1", "image-1"],
  trackItemsMap: {
    "text-1": {
      id: "text-1",
      type: "text",
      display: {
        from: 0,
        to: 3000  // 3 seconds
      }
    },
    "image-1": {
      id: "image-1", 
      type: "image",
      display: {
        from: 1000,  // Start at 1 second
        to: 5000     // End at 5 seconds
      }
    }
  },
  trackItemDetailsMap: {
    "text-1": {
      id: "text-1",
      type: "text",
      details: {
        type: "text",
        text: "Hello Remotion!",
        left: "0px",
        top: "400px",
        width: 1080,
        height: 200,
        fontSize: 72,
        fontFamily: "Arial",
        color: "#ffffff",
        textAlign: "center",
        opacity: 100
      }
    },
    "image-1": {
      id: "image-1",
      type: "image",
      details: {
        type: "image",
        src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY2YjZiIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI0OCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkhlbGxvIFJlbW90aW9uITwvdGV4dD4KICA8L3N2Zz4=",
        left: "140px",
        top: "660px",
        width: 800,
        height: 600,
        opacity: 100
      }
    }
  },
  animations: [],
  effects: []
};

async function testRemotion() {
  try {
    console.log('🧪 Testing Remotion Video Export Server...\n');

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
    console.log('\n2️⃣ Starting render job...');
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testProjectData),
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
    const maxAttempts = 60; // 2 minutes max

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
            console.log(`   File size: ${downloadResponse.headers.get('content-length')} bytes`);
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

    console.log('\n🎉 All tests passed! Remotion server is working correctly.');
    console.log('\n📋 Integration Instructions:');
    console.log('   1. Update your frontend API endpoint to: http://localhost:3001/api/v1/editor/remotion/render');
    console.log('   2. Update status endpoint to: http://localhost:3001/api/v1/editor/remotion/render/status/{renderId}');
    console.log('   3. Your existing frontend code should work without any other changes!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure the Remotion server is running: npm start');
    console.log('   2. Check the server logs for detailed error information');
    console.log('   3. Verify all dependencies are installed: npm install');
  }
}

// Run the test
testRemotion();
