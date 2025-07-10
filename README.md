# React Video Editor

A modern, web-based video editor built with React, TypeScript, and Remotion. Create and edit videos directly in your browser with a timeline-based interface.

## ✨ Features

- 🎬 Timeline-based video editing
- 📁 File upload and media management (✅ **FIXED** - Upload functionality now works!)
- 🎵 Audio track support
- 🖼️ Image and video layers
- ✂️ Cut, trim, and split functionality
- 🎨 Text overlays and captions
- 📱 Responsive design
- ⚡ Real-time preview
- 🚫 **No authentication required** - start editing immediately

## 🛠️ Tech Stack

**Frontend:** React 18, TypeScript, Vite, TailwindCSS, Radix UI, DesignCombo, Zustand, Remotion

**Backend:** Node.js/Express (example provided), AWS S3 for file storage

## 🚀 Quick Start

### Frontend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Pablituuu/react-video-editor.git
   cd react-video-editor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API endpoints** (Required for file uploads):
   ```bash
   cp .env.example .env
   # Edit .env with your backend API URLs
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**: Navigate to `http://localhost:5175`

### Backend Setup (Required for File Uploads)

The upload functionality requires a backend API. We've provided a complete example:

1. **Navigate to backend example**:
   ```bash
   cd backend-example
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your AWS S3 credentials
   ```

4. **Start the backend**:
   ```bash
   npm run dev
   ```

The backend will run on `http://localhost:3000`

## 📋 API Requirements

For detailed API specifications, see [API_REQUIREMENTS.md](API_REQUIREMENTS.md)

**Required Endpoints:**
- `POST /api/upload/presigned-url` - File upload (✅ **IMPLEMENTED**)
- `POST /api/render` - Video rendering (Optional)
- `POST /api/captions/generate` - Caption generation (Optional)

## 🔧 What's Fixed

### File Upload Issue ✅ RESOLVED
- **Problem**: Upload button did nothing when files were selected
- **Solution**: Implemented complete upload functionality with:
  - File validation (size, type)
  - Cloud storage integration
  - Progress indicators
  - Error handling
  - File preview and management

### Authentication Removed ✅ COMPLETED
- Removed all signup/login components
- No authentication required
- Direct access to video editor

## 📁 Project Structure

```
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/editor/        # Video editor interface
│   ├── store/              # State management (Zustand)
│   ├── utils/              # Utility functions
│   ├── config/             # API configuration
│   └── interfaces/         # TypeScript type definitions
├── backend-example/         # Example Node.js backend
├── API_REQUIREMENTS.md      # Backend API specifications
└── .env.example            # Environment variables template
```

## 🎯 Usage

1. **Upload Media**: Click the upload button to add videos, images, or audio files
2. **Timeline Editing**: Click uploaded files to add them to the timeline
3. **Trim & Cut**: Select clips and use the timeline tools
4. **Add Text**: Use the text tool to add captions and titles
5. **Preview**: Use the play button to preview your video
6. **Export**: Click the download button to render your final video

## 🔒 Security & Storage

- Uses presigned URLs for secure file uploads
- Supports AWS S3, Google Cloud Storage, and other providers
- File type and size validation
- CORS configuration included

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)

## 👨‍💻 Authors

- [@Pablituuu](https://www.github.com/Pablituuu) - Original Creator
- Enhanced with file upload functionality and backend integration

## 🌐 Demo

https://react-video-editor-mu.vercel.app/

![Video Editor Interface](image/image.png)
