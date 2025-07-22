import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1/editor';

// Your exact payload
const realPayload = {
  "id": "Jdz4ksXrtquqL5d",
  "fps": 30,
  "tracks": [
    {
      "id": "n4nW6WVtEBwJc260V9ecJ",
      "accepts": ["text", "audio", "helper", "video", "image", "caption"],
      "type": "image",
      "items": ["Ir7TNUreSwEjPK2p"],
      "magnetic": false,
      "static": false
    },
    {
      "id": "zfbXSoNhKb5SRfPDMo-mh",
      "accepts": ["text", "audio", "helper", "video", "image", "caption"],
      "type": "image",
      "items": ["grAhO80K9gYWubU"],
      "magnetic": false,
      "static": false
    }
  ],
  "size": { "width": 1080, "height": 1920 },
  "trackItemDetailsMap": {
    "grAhO80K9gYWubU": {
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
    "Ir7TNUreSwEjPK2p": {
      "type": "image",
      "details": {
        "src": "https://ik.imagekit.io/wombo/images/img5.jpg",
        "width": 1920,
        "height": 1280,
        "opacity": 100,
        "transform": "scale(0.5625)",
        "border": "none",
        "borderRadius": 0,
        "boxShadow": { "color": "#000000", "x": 0, "y": 0, "blur": 0 },
        "top": "320px",
        "left": "-420px",
        "borderWidth": 0,
        "borderColor": "#000000",
        "blur": 0,
        "brightness": 100,
        "flipX": false,
        "flipY": false,
        "placement": {
          "x": -420,
          "y": 320,
          "width": 1920,
          "height": 1280,
          "rotation": 0,
          "scaleX": 0.5625,
          "scaleY": 0.5625
        },
        "effect": { "type": "none" },
        "animations": []
      }
    }
  },
  "trackItemIds": ["grAhO80K9gYWubU", "Ir7TNUreSwEjPK2p"],
  "transitionsMap": {},
  "trackItemsMap": {
    "grAhO80K9gYWubU": {
      "id": "grAhO80K9gYWubU",
      "type": "image",
      "name": "image",
      "display": { "from": 0, "to": 5000 },
      "playbackRate": 1,
      "metadata": {},
      "isMain": false,
      "timeFrame": { "start": 0, "end": 5000 },
      "animations": []
    },
    "Ir7TNUreSwEjPK2p": {
      "id": "Ir7TNUreSwEjPK2p",
      "type": "image",
      "name": "image",
      "display": { "from": 0, "to": 5000 },
      "playbackRate": 1,
      "metadata": {},
      "isMain": false,
      "timeFrame": { "start": 0, "end": 5000 },
      "animations": []
    }
  },
  "transitionIds": [],
  "animations": [
    {
      "id": "slideIn_grAhO80K9gYWubU",
      "targetId": "grAhO80K9gYWubU",
      "duration": 1000,
      "type": "slideIn",
      "properties": { "direction": "left", "useClipPath": false, "textType": "none" }
    },
    {
      "id": "breathe_grAhO80K9gYWubU",
      "targetId": "grAhO80K9gYWubU",
      "duration": 5000,
      "type": "breathe"
    },
    {
      "id": "slideIn_Ir7TNUreSwEjPK2p",
      "targetId": "Ir7TNUreSwEjPK2p",
      "duration": 1000,
      "type": "slideIn",
      "properties": { "direction": "left", "useClipPath": false, "textType": "none" }
    },
    {
      "id": "breathe_Ir7TNUreSwEjPK2p",
      "targetId": "Ir7TNUreSwEjPK2p",
      "duration": 5000,
      "type": "breathe"
    }
  ],
  "effects": [{ "type": "none" }],
  "maxTime": 5000,
  "backgroundColor": "#000000"
};

async function testRealPayload() {
  console.log('🔍 TESTING: Your exact payload with 2 images');
  console.log(`📋 trackItemIds: [${realPayload.trackItemIds.join(', ')}]`);
  console.log(`📊 Expected: 2 layers should be processed and overlaid`);
  
  try {
    // Start render job
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(realPayload)
    });
    
    if (!renderResponse.ok) {
      const errorText = await renderResponse.text();
      throw new Error(`Render start failed: ${renderResponse.status} - ${errorText}`);
    }
    
    const renderData = await renderResponse.json();
    console.log('🚀 Real payload render job started:', renderData.renderId);
    
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
        console.log('✅ Real payload render completed!');
        console.log('📥 Download URL:', statusData.output);
        
        // Check server logs for multi-layer composition evidence
        console.log('\n🔍 Check server logs for:');
        console.log('   - "🔍 Organizing 2 items by type"');
        console.log('   - "📋 Item 0: grAhO80K9gYWubU (type: image)"');
        console.log('   - "📋 Item 1: Ir7TNUreSwEjPK2p (type: image)"');
        console.log('   - "🎬 Final layer composition order:"');
        console.log('   - "📹 Multi-layer composition: 2 layers"');
        console.log('   - "pad=1080:1920:0:150:black" (for first image)');
        console.log('   - "pad=1080:1920:0:600:black" (for second image)');
        
        return statusData;
      } else if (statusData.status === 'failed') {
        console.error('❌ Real payload render failed:', statusData.error);
        return null;
      }
      
      attempts++;
    }
    
    console.error('⏰ Real payload render timed out');
    return null;
    
  } catch (error) {
    console.error('❌ Real payload render test failed:', error.message);
    return null;
  }
}

// Run the test
testRealPayload().then(result => {
  if (result) {
    console.log('\n🎉 Real payload test completed - check server logs for multi-layer evidence!');
  } else {
    console.log('\n❌ Real payload test failed!');
  }
  process.exit(result ? 0 : 1);
});
