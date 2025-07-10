// Test script to verify upload API is working
// Run with: node test-upload.js

const PRESIGNED_URL_API = 'http://localhost:3000/api/v1/editor/upload/presigned-url';
const HEALTH_API = 'http://localhost:3000/api/v1/editor/upload/health';

async function testHealthAPI() {
  console.log('🏥 Testing Health API...');
  console.log(`📡 Health URL: ${HEALTH_API}`);

  try {
    const response = await fetch(HEALTH_API);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success) {
      console.log('✅ Health Check Passed');
      console.log(`📊 Service: ${data.message}`);
      console.log(`🗂️ Storage: ${data.storage.provider} at ${data.storage.base_path}`);
      console.log(`📏 Max File Size: ${data.limits.max_file_size}`);
      return true;
    } else {
      console.log('❌ Health Check Failed');
      return false;
    }

  } catch (error) {
    console.error('❌ Health API Error:', error.message);
    return false;
  }
}

async function testPresignedUrlAPI() {
  console.log('\n🧪 Testing Presigned URL API...');
  console.log(`📡 API URL: ${PRESIGNED_URL_API}`);

  try {
    const response = await fetch(PRESIGNED_URL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'test-video.mp4'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success) {
      console.log('✅ Presigned URL API Response:', {
        success: data.success ? '✅ True' : '❌ False',
        presigned_url: data.presigned_url ? '✅ Present' : '❌ Missing',
        url: data.url ? '✅ Present' : '❌ Missing',
        id: data.id ? '✅ Present' : '❌ Missing',
        fileName: data.fileName ? '✅ Present' : '❌ Missing',
        folder: data.folder ? '✅ Present' : '❌ Missing',
        uploadMethod: data.uploadMethod ? '✅ Present' : '❌ Missing'
      });

      console.log('🎉 Presigned URL API is working correctly!');
      return true;
    } else {
      console.log('❌ API returned success: false');
      console.log('Error:', data.error);
      return false;
    }

  } catch (error) {
    console.error('❌ Presigned URL API Error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n');

  const healthPassed = await testHealthAPI();
  const presignedPassed = await testPresignedUrlAPI();

  console.log('\n📋 Test Results:');
  console.log(`Health API: ${healthPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Presigned URL API: ${presignedPassed ? '✅ PASS' : '❌ FAIL'}`);

  if (healthPassed && presignedPassed) {
    console.log('\n🎉 All tests passed! Your API is ready to use.');
  } else {
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure backend server is running on port 3000: cd backend-example && npm run dev');
    console.log('2. Check that the server started without errors');
    console.log('3. Verify the API endpoints are accessible');
  }
}

// Run the tests
runTests();
