import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3005/api/v1/editor';

// Simple test with a known working audio file
const simpleAudioPayload = {
  "id": "test-audio-simple",
  "fps": 30,
  "size": { "width": 1080, "height": 1920 },
  "trackItemIds": ["text-1", "audio-1"],
  "trackItemsMap": {
    "text-1": {
      "id": "text-1",
      "type": "text",
      "name": "text",
      "display": { "from": 0, "to": 3000 },
      "playbackRate": 1,
      "metadata": {},
      "isMain": false,
      "timeFrame": { "start": 0, "end": 3000 },
      "animations": []
    },
    "audio-1": {
      "id": "audio-1",
      "type": "audio",
      "name": "audio",
      "display": { "from": 0, "to": 3000 },
      "trim": { "from": 0, "to": 3000 },
      "playbackRate": 1,
      "metadata": {},
      "isMain": false,
      "timeFrame": { "start": 0, "end": 3000 },
      "animations": []
    }
  },
  "trackItemDetailsMap": {
    "text-1": {
      "type": "text",
      "details": {
        "text": "Audio Test",
        "fontSize": 64,
        "fontFamily": "Arial",
        "color": "#ffffff",
        "fontWeight": "bold",
        "textAlign": "center",
        "width": 800,
        "height": 200,
        "left": "140px",
        "top": "860px",
        "opacity": 100
      }
    },
    "audio-1": {
      "type": "audio",
      "details": {
        "src": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
        "volume": 1.0
      }
    }
  },
  "transitionsMap": {},
  "transitionIds": [],
  "tracks": [
    {
      "id": "track-1",
      "accepts": ["text", "audio", "helper", "video", "image", "caption"],
      "type": "audio",
      "items": ["text-1", "audio-1"],
      "magnetic": false,
      "static": false
    }
  ]
};

async function testSimpleAudio() {
  console.log('🔊 Testing simple audio with Puppeteer backend');
  console.log('📋 Using a simple WAV file for testing');
  
  try {
    // Health check
    console.log('\n🏥 Checking backend health...');
    const healthResponse = await fetch(`${API_BASE}/render/health`);
    if (!healthResponse.ok) {
      throw new Error('Backend health check failed');
    }
    console.log('✅ Backend is healthy');

    // Start render
    console.log('\n🎬 Starting simple audio render...');
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simpleAudioPayload)
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
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(`${API_BASE}/render/status/${renderData.renderId}`);
      const statusData = await statusResponse.json();

      console.log(`📊 ${statusData.status} (${statusData.progress}%) - ${statusData.message || ''}`);

      if (statusData.status === 'completed') {
        console.log('\n🎉 Simple audio render completed!');
        console.log(`📹 Video URL: ${statusData.output}`);
        console.log('\n🔊 Test this video to check if audio is working:');
        console.log(`   - Download: ${statusData.output}`);
        console.log('   - Play in a media player to verify audio');
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
testSimpleAudio().then(success => {
  if (success) {
    console.log('\n🎊 Simple audio test completed!');
    console.log('💡 Download the video and check if you can hear the audio.');
    console.log('🔧 If no audio, the issue might be with the audio source URL or browser playback.');
  } else {
    console.log('\n💥 Simple audio test failed.');
  }
  process.exit(success ? 0 : 1);
});
