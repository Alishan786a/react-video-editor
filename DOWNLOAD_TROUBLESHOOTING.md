# Video Download Troubleshooting Guide

## Issue: Downloaded video files are corrupted or unplayable

This guide helps diagnose and fix issues with video file downloads in the React Video Editor.

## Quick Diagnosis Steps

### 1. Check Browser Console
Open browser DevTools (F12) and look for:
- Download-related error messages
- Network request failures
- CORS errors
- File size information

### 2. Use Debug Utility
The app now includes a debug utility. In the download popup, click the "Debug" button to run diagnostics.

Or manually test in browser console:
```javascript
// Test a specific URL
debugDownload('http://localhost:3000/api/v1/editor/files/renders/your-file.mp4');
```

### 3. Check Network Tab
In DevTools Network tab, look for:
- The render status API calls
- The final download request
- Response headers and status codes
- File size in the response

## Common Issues and Solutions

### Issue 1: File is Empty (0 bytes)
**Symptoms:** Downloaded file exists but is 0 bytes
**Causes:**
- Backend is returning empty response
- Render process failed but status shows "completed"
- File path is incorrect

**Solutions:**
1. Check backend logs for render process errors
2. Verify the output URL in the render status response
3. Test the output URL directly in browser
4. Ensure backend is actually creating video files

### Issue 2: File Downloads but Won't Play
**Symptoms:** File downloads with size but media players can't open it
**Causes:**
- File is not actually a video (might be error HTML/JSON)
- Incorrect MIME type
- Corrupted video encoding
- Incomplete file transfer

**Solutions:**
1. Check file signature using debug utility
2. Verify Content-Type header is `video/mp4`
3. Test backend video generation process
4. Check if file is complete (compare sizes)

### Issue 3: CORS Errors
**Symptoms:** Console shows CORS-related errors
**Causes:**
- Backend not configured for CORS
- Missing Access-Control headers

**Solutions:**
1. Add CORS headers to backend:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

2. For file serving endpoints, ensure proper headers:
```javascript
res.setHeader('Content-Type', 'video/mp4');
res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
```

### Issue 4: Network Request Fails
**Symptoms:** Download doesn't start, network errors in console
**Causes:**
- Backend server not running
- Incorrect API endpoint URLs
- Network connectivity issues

**Solutions:**
1. Verify backend server is running on correct port
2. Check API endpoint URLs in `src/config/api.ts`
3. Test endpoints manually with curl or Postman

## Backend Requirements

Your backend must properly handle these scenarios:

### 1. Render Status Endpoint
```javascript
app.get('/api/v1/editor/render/status/:renderId', (req, res) => {
  // Must return proper structure:
  res.json({
    render: {
      progress: 100,
      status: 'completed',
      output: 'http://localhost:3000/api/v1/editor/files/renders/video.mp4'
    }
  });
});
```

### 2. File Serving Endpoint
```javascript
app.get('/api/v1/editor/files/renders/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'renders', req.params.filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Set proper headers
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', 'attachment; filename="' + req.params.filename + '"');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send file
  res.sendFile(filePath);
});
```

## Testing Your Backend

### 1. Test Render Status
```bash
curl http://localhost:3000/api/v1/editor/render/status/test-id
```

### 2. Test File Download
```bash
curl -I http://localhost:3000/api/v1/editor/files/renders/test.mp4
```

### 3. Test File Content
```bash
curl -o test-download.mp4 http://localhost:3000/api/v1/editor/files/renders/test.mp4
```

## Debug Information to Collect

When reporting issues, include:

1. **Browser Console Output** (all errors and logs)
2. **Network Tab Screenshots** (showing failed requests)
3. **Backend Logs** (server-side errors)
4. **File Information** (size, type, can it be opened manually)
5. **API Response Examples** (render status, file serving responses)

## Advanced Debugging

### Check File Signature
```javascript
// In browser console after download fails
const file = new File([blob], 'test.mp4');
const reader = new FileReader();
reader.onload = function(e) {
  const arr = new Uint8Array(e.target.result.slice(0, 12));
  const signature = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log('File signature:', signature);
};
reader.readAsArrayBuffer(file);
```

### Test Direct Download
```javascript
// Test if direct link works
window.open('http://localhost:3000/api/v1/editor/files/renders/your-file.mp4');
```

## Next Steps

1. **Run the debug utility** to identify the specific issue
2. **Check backend implementation** against the requirements above
3. **Test each component separately** (render status, file serving)
4. **Verify file generation process** in your backend
5. **Check browser compatibility** (try different browsers)

If issues persist, the problem is likely in your backend's video generation or file serving implementation.
