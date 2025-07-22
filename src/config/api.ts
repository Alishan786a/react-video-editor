// API Configuration
// Update these URLs to point to your own backend APIs

// Backend type selection - 'custom', 'remotion', or 'ffmpeg'
const BACKEND_TYPE = import.meta.env.VITE_BACKEND_TYPE || 'custom';

export const API_CONFIG = {
  // Upload API - handles file uploads
  UPLOAD_API_URL: import.meta.env.VITE_UPLOAD_API_URL || 'http://localhost:3000/api/v1/editor',

  // Video Rendering API (supports Custom, Remotion, and FFmpeg backends)
  RENDER_API_URL: BACKEND_TYPE === 'custom'
    ? import.meta.env.VITE_CUSTOM_API_URL || 'http://localhost:3001/api/v1/editor'
    : BACKEND_TYPE === 'remotion'
    ? import.meta.env.VITE_REMOTION_API_URL || 'http://localhost:3001/api/v1/editor/remotion'
    : import.meta.env.VITE_RENDER_API_URL || 'http://localhost:3000/api/v1/editor',

  // Caption Generation API (optional)
  CAPTIONS_API_URL: import.meta.env.VITE_CAPTIONS_API_URL || 'http://localhost:3000/api/v1/editor',

  // Backend type for debugging
  BACKEND_TYPE,
};

// API Endpoints
export const API_ENDPOINTS = {
  // File upload endpoints
  PRESIGNED_URL: `${API_CONFIG.UPLOAD_API_URL}/upload/presigned-url`,
  UPLOAD_FILE: `${API_CONFIG.UPLOAD_API_URL}/upload/file`,
  UPLOAD_HEALTH: `${API_CONFIG.UPLOAD_API_URL}/upload/health`,

  // Video rendering endpoints (optional)
  RENDER: `${API_CONFIG.RENDER_API_URL}/render`,
  RENDER_STATUS: (renderId: string) => `${API_CONFIG.RENDER_API_URL}/render/status/${renderId}`,
  RENDER_HEALTH: `${API_CONFIG.RENDER_API_URL}/render/health`,

  // Caption generation endpoints (optional)
  GENERATE_CAPTIONS: `${API_CONFIG.CAPTIONS_API_URL}/captions/generate`,
  CAPTIONS_STATUS: (jobId: string) => `${API_CONFIG.CAPTIONS_API_URL}/captions/status/${jobId}`,
  CAPTIONS_HEALTH: `${API_CONFIG.CAPTIONS_API_URL}/captions/health`,
};
