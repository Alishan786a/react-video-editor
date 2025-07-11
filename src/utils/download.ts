// Alternative download method for direct URL access
export const downloadDirect = (url: string, filename: string) => {
  console.log('Using direct download method for URL:', url);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename}.mp4`);
  link.setAttribute("target", "_blank");

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log('Direct download initiated');
};

export const download = async (url: string, filename: string) => {
  try {
    console.log('Starting download from URL:', url);

    // First, try to check if the URL is accessible
    const headResponse = await fetch(url, { method: 'HEAD' });
    console.log('HEAD response status:', headResponse.status);
    console.log('HEAD response headers:', Object.fromEntries(headResponse.headers.entries()));

    if (!headResponse.ok) {
      console.log('HEAD request failed, trying direct download method');
      downloadDirect(url, filename);
      return;
    }

    // Fetch the file with proper headers
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'video/mp4,video/*,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if the response is actually a video file
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    console.log('Response headers:', {
      'content-type': contentType,
      'content-length': contentLength,
      'content-disposition': response.headers.get('content-disposition')
    });

    if (!contentType || (!contentType.includes('video/') && !contentType.includes('application/octet-stream'))) {
      console.warn('Warning: Content-Type is not a video format:', contentType);

      // If it's not a video content type, it might be an error response
      const text = await response.text();
      console.log('Response text (first 500 chars):', text.substring(0, 500));

      if (text.includes('error') || text.includes('Error') || text.startsWith('{')) {
        throw new Error('Server returned an error instead of video file');
      }
    }

    // Get the blob with proper type
    const blob = await response.blob();
    console.log('Blob details:', {
      size: blob.size,
      type: blob.type,
      sizeInMB: (blob.size / (1024 * 1024)).toFixed(2)
    });

    if (blob.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    // If file is suspiciously small, inspect the content
    if (blob.size < 1000) {
      console.warn(`⚠️ File is very small (${blob.size} bytes) - inspecting content...`);
      const text = await blob.text();
      console.log('📄 ACTUAL CONTENT RECEIVED:');
      console.log('=====================================');
      console.log(text);
      console.log('=====================================');

      // Check if it's a mock/placeholder file
      if (text.includes('Mock rendered video file') || text.includes('placeholder file for testing')) {
        console.log('🔍 This is a mock/placeholder file from your backend');
        console.log('⚠️ Your backend is creating text files instead of MP4 videos');
        console.log('💡 To fix: Update your backend to create actual MP4 files or copy a test MP4');

        // For testing purposes, allow download of the placeholder file as .txt
        const textBlob = new Blob([text], { type: 'text/plain' });
        const downloadUrl = window.URL.createObjectURL(textBlob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", `${filename}_placeholder.txt`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
        }, 100);

        alert('Downloaded placeholder file as .txt\n\nTo fix: Your backend needs to create actual MP4 files instead of text files.');
        return;
      }

      // Try to parse as JSON to see if it's an error response
      try {
        const json = JSON.parse(text);
        console.log('🔍 Content is JSON:', json);
        throw new Error(`Backend returned error instead of video: ${JSON.stringify(json)}`);
      } catch (parseError) {
        if (parseError.message.includes('Backend returned error')) {
          throw parseError;
        }
        console.log('🔍 Content is not JSON, might be HTML or plain text error');
        throw new Error(`Backend returned non-video content (${blob.size} bytes): ${text.substring(0, 200)}...`);
      }
    }

    // Create a new blob with explicit video type if needed
    const videoBlob = blob.type.includes('video/') ? blob : new Blob([blob], { type: 'video/mp4' });

    // Create download link
    const downloadUrl = window.URL.createObjectURL(videoBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", `${filename}.mp4`);

    // Ensure the link is added to DOM for some browsers
    document.body.appendChild(link);
    link.click();

    // Clean up
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(downloadUrl);
    }, 100);

    console.log('Download initiated successfully');

  } catch (error) {
    console.error("Download error:", error);
    console.log('Falling back to direct download method');

    // Fallback to direct download
    try {
      downloadDirect(url, filename);
    } catch (fallbackError) {
      console.error("Fallback download also failed:", fallbackError);
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};
