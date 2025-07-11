// Debug utility to test video download functionality
export const debugDownload = async (url: string) => {
  console.log('=== DOWNLOAD DEBUG START ===');
  console.log('Testing URL:', url);
  
  try {
    // Test 1: Check if URL is accessible
    console.log('\n1. Testing URL accessibility...');
    const headResponse = await fetch(url, { method: 'HEAD' });
    console.log('HEAD Status:', headResponse.status);
    console.log('HEAD Headers:', Object.fromEntries(headResponse.headers.entries()));
    
    if (!headResponse.ok) {
      console.error('❌ URL is not accessible');
      return false;
    }
    console.log('✅ URL is accessible');
    
    // Test 2: Check content type and size
    console.log('\n2. Checking content details...');
    const contentType = headResponse.headers.get('content-type');
    const contentLength = headResponse.headers.get('content-length');
    
    console.log('Content-Type:', contentType);
    console.log('Content-Length:', contentLength);
    
    if (!contentType?.includes('video/') && !contentType?.includes('application/octet-stream')) {
      console.warn('⚠️ Content-Type is not a video format');
    } else {
      console.log('✅ Content-Type looks good');
    }
    
    if (contentLength && parseInt(contentLength) === 0) {
      console.error('❌ Content-Length is 0');
      return false;
    }
    console.log('✅ Content-Length looks good');
    
    // Test 3: Try to fetch a small portion
    console.log('\n3. Testing partial content fetch...');
    const partialResponse = await fetch(url, {
      headers: {
        'Range': 'bytes=0-1023' // First 1KB
      }
    });
    
    console.log('Partial fetch status:', partialResponse.status);
    
    if (partialResponse.ok || partialResponse.status === 206) {
      const partialBlob = await partialResponse.blob();
      console.log('Partial blob size:', partialBlob.size);
      console.log('✅ Partial fetch successful');
    } else {
      console.log('⚠️ Partial fetch not supported, but that\'s okay');
    }
    
    // Test 4: Full fetch test (first few MB only for testing)
    console.log('\n4. Testing full fetch...');
    const fullResponse = await fetch(url);

    if (!fullResponse.ok) {
      console.error('❌ Full fetch failed:', fullResponse.status);
      return false;
    }

    const fullBlob = await fullResponse.blob();
    console.log('Full blob details:');
    console.log('- Size:', fullBlob.size, 'bytes');
    console.log('- Size (MB):', (fullBlob.size / (1024 * 1024)).toFixed(2));
    console.log('- Type:', fullBlob.type);

    // If file is suspiciously small (like 227 bytes), it's likely an error response
    if (fullBlob.size < 1000) {
      console.warn('⚠️ File is very small (' + fullBlob.size + ' bytes) - likely an error response');

      // Convert to text to see what the actual content is
      const text = await fullBlob.text();
      console.log('📄 ACTUAL FILE CONTENT:');
      console.log('=====================================');
      console.log(text);
      console.log('=====================================');

      // Check if it's JSON error
      try {
        const json = JSON.parse(text);
        console.log('🔍 Parsed as JSON:', json);
      } catch (e) {
        console.log('🔍 Not valid JSON, raw text shown above');
      }

      return false;
    }

    if (fullBlob.size === 0) {
      console.error('❌ Downloaded blob is empty');
      return false;
    }
    console.log('✅ Full fetch successful');
    
    // Test 5: Check if it's actually video data
    console.log('\n5. Checking file signature...');
    const arrayBuffer = await fullBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer.slice(0, 12));
    const signature = Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('File signature (first 12 bytes):', signature);
    
    // Common video file signatures
    const videoSignatures = {
      'mp4': ['00 00 00', 'ftyp'],
      'webm': ['1a 45 df a3'],
      'avi': ['52 49 46 46']
    };
    
    let isVideoFile = false;
    for (const [format, sigs] of Object.entries(videoSignatures)) {
      for (const sig of sigs) {
        if (signature.toLowerCase().includes(sig.replace(/\s/g, ''))) {
          console.log(`✅ Detected ${format.toUpperCase()} file format`);
          isVideoFile = true;
          break;
        }
      }
    }
    
    if (!isVideoFile) {
      console.warn('⚠️ File signature doesn\'t match common video formats');
      console.log('This might be why the file appears corrupted');
    }
    
    console.log('\n=== DOWNLOAD DEBUG END ===');
    return true;
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    console.log('\n=== DOWNLOAD DEBUG END ===');
    return false;
  }
};

// Add this to window for easy testing in browser console
if (typeof window !== 'undefined') {
  (window as any).debugDownload = debugDownload;
}
