import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3005/api/v1/editor';

// Your actual payload structure from the frontend with audio
const realPayload = {
  "id": "test-real-payload-with-audio",
  "fps": 30,
  "size": { "width": 1080, "height": 1920 },
  "trackItemIds": ["image-1", "text-1", "audio-1"],
  "trackItemsMap": {
    "image-1": {
      "id": "image-1",
      "type": "image",
      "name": "image",
      "display": { "from": 0, "to": 5000 },
      "playbackRate": 1,
      "metadata": {},
      "isMain": false,
      "timeFrame": { "start": 0, "end": 5000 },
      "animations": []
    },
    "text-1": {
      "id": "text-1",
      "type": "text",
      "name": "text",
      "display": { "from": 1000, "to": 4000 },
      "playbackRate": 1,
      "metadata": {},
      "isMain": false,
      "timeFrame": { "start": 1000, "end": 4000 },
      "animations": []
    },
    "audio-1": {
      "id": "audio-1",
      "type": "audio",
      "name": "audio",
      "display": { "from": 1000, "to": 4000 },
      "trim": { "from": 500, "to": 3500 },
      "playbackRate": 1,
      "metadata": {},
      "isMain": false,
      "timeFrame": { "start": 0, "end": 5000 },
      "animations": []
    }
  },
  "trackItemDetailsMap": {
    "image-1": {
      "type": "image",
      "details": {
        "src": "https://ik.imagekit.io/wombo/images/img4.jpg",
        "width": 1280,
        "height": 1920,
        "opacity": 100,
        "transform": "scale(0.84375)",
        "border": "none",
        "borderRadius": 0,
        "boxShadow": { "color": "#000000", "x": 0, "y": 0, "blur": 0 },
        "top": "0px",
        "left": "-100px",
        "borderWidth": 0,
        "borderColor": "#000000",
        "blur": 0,
        "brightness": 100,
        "flipX": false,
        "flipY": false,
        "placement": {
          "x": -100,
          "y": 0,
          "width": 1280,
          "height": 1920,
          "rotation": 0,
          "scaleX": 0.84375,
          "scaleY": 0.84375
        },
        "effect": { "type": "none" },
        "animations": []
      }
    },
    "text-1": {
      "type": "text",
      "details": {
        "text": "Hello from Puppeteer!",
        "fontSize": 64,
        "fontFamily": "Arial",
        "color": "#ffffff",
        "fontWeight": "bold",
        "textAlign": "center",
        "width": 800,
        "height": 200,
        "left": "140px",
        "top": "860px",
        "opacity": 100,
        "blur": 0,
        "brightness": 100,
        "boxShadow": { "color": "#000000", "x": 2, "y": 2, "blur": 4 },
        "animations": []
      }
    },
    "audio-1": {
      "type": "audio",
      "details": {
        "src": "https://ik.imagekit.io/snapmotion/timer-voice.mp3",
        "volume": 0.8,
        "fadeIn": 0.1,
        "fadeOut": 0.1
      }
    }
  },
  "transitionsMap": {},
  "transitionIds": [],
  "tracks": [
    {
      "id": "track-1",
      "accepts": ["text", "audio", "helper", "video", "image", "caption"],
      "type": "image",
      "items": ["image-1", "text-1", "audio-1"],
      "magnetic": false,
      "static": false
    }
  ]
};

async function testRealPayload() {
  console.log('🔍 Testing Puppeteer backend with real payload structure');
  console.log(`📋 Items: ${realPayload.trackItemIds.join(', ')}`);
  console.log(`📊 Expected: Image background + text overlay + trimmed audio`);
  
  try {
    // Health check first
    console.log('\n🏥 Checking backend health...');
    const healthResponse = await fetch(`${API_BASE}/render/health`);
    if (!healthResponse.ok) {
      throw new Error('Backend health check failed');
    }
    console.log('✅ Backend is healthy');

    // Start render
    console.log('\n🎬 Starting render...');
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realPayload)
    });

    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      throw new Error(`Render failed: ${renderResponse.status} - ${errorText}`);
    }

    const renderData = await renderResponse.json();
    console.log('✅ Render started:', renderData.renderId);

    // Poll for completion
    console.log('\n⏳ Monitoring progress...');
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`${API_BASE}/render/status/${renderData.renderId}`);
      const statusData = await statusResponse.json();

      console.log(`📊 ${statusData.status} (${statusData.progress}%) - ${statusData.message || ''}`);

      if (statusData.status === 'completed') {
        console.log('\n🎉 Render completed successfully!');
        console.log(`📹 Video URL: ${statusData.output}`);
        console.log('\n✨ The video should show:');
        console.log('   - Background image (scaled and positioned)');
        console.log('   - Text overlay appearing from 1s to 4s');
        console.log('   - Audio track: trimmed from 0.5s to 3.5s, playing from 1s to 4s');
        console.log('   - Total duration: 5 seconds');
        return true;
      } else if (statusData.status === 'failed') {
        console.error('\n❌ Render failed:', statusData.error);
        return false;
      }

      attempts++;
    }

    console.error('\n⏰ Render timed out');
    return false;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testRealPayload().then(success => {
  if (success) {
    console.log('\n🎊 Real payload test passed! Your Puppeteer backend is working correctly.');
    console.log('💡 You can now use VITE_BACKEND_TYPE=puppeteer in your frontend.');
  } else {
    console.log('\n💥 Real payload test failed. Check the logs above for details.');
  }
  process.exit(success ? 0 : 1);
});
