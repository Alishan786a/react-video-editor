// Quick test utility to check what your backend is actually returning
export const quickTestDownload = async (url?: string) => {
  // Use a default test URL if none provided
  const testUrl = url || 'http://localhost:3000/api/v1/editor/files/renders/test.mp4';
  
  console.log('🔍 QUICK TEST: Checking what backend returns...');
  console.log('Testing URL:', testUrl);
  
  try {
    const response = await fetch(testUrl);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const blob = await response.blob();
    console.log('Response size:', blob.size, 'bytes');
    
    if (blob.size < 1000) {
      const text = await blob.text();
      console.log('🚨 SMALL FILE CONTENT (likely error):');
      console.log('=====================================');
      console.log(text);
      console.log('=====================================');
      
      // Check if it's a 404 or error page
      if (text.includes('Cannot GET') || text.includes('404') || text.includes('Not Found')) {
        console.log('❌ This is a 404 error - the file path doesn\'t exist on your backend');
      } else if (text.includes('error') || text.includes('Error')) {
        console.log('❌ This is an error response from your backend');
      } else if (text.includes('<html>') || text.includes('<!DOCTYPE')) {
        console.log('❌ This is an HTML page, not a video file');
      }
    } else {
      console.log('✅ File size looks reasonable for a video');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
};

// Add to window for easy access
if (typeof window !== 'undefined') {
  (window as any).quickTestDownload = quickTestDownload;
  
  // Auto-run a test when this file loads (you can remove this later)
  console.log('🔧 Quick test utility loaded. Run quickTestDownload() in console to test your backend.');
}
