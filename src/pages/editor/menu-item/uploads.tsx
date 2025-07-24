import useDataState from "@/store/use-data-state";
import { IUpload } from "@/interfaces/editor";
import { ADD_VIDEO, ADD_IMAGE, ADD_AUDIO, dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";
import { UploadForm, UploadsList } from "@/components/uploads";
import { useEffect } from "react";
import { API_CONFIG } from "@/config/api";

// Helper function to determine file type
const getFileType = (filename: string): 'video' | 'image' | 'audio' => {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', '3gp'].includes(extension || '')) {
    return 'video';
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(extension || '')) {
    return 'image';
  } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma', 'opus'].includes(extension || '')) {
    return 'audio';
  } else {
    return 'audio';
  }
};

export const Uploads = () => {
  const { uploads, addUpload, removeUpload, setUploads } = useDataState();

  // Add global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🚨 Unhandled promise rejection in uploads:', event.reason);
      console.error('🚨 This might be related to video loading in state manager');
      // Prevent the error from being thrown to the console
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Load existing uploads on component mount
  useEffect(() => {
    const loadUploads = async () => {
      try {
        // Check if upload service is available
        const healthResponse = await fetch(`${API_CONFIG.UPLOAD_API_URL}/upload/health`);
        if (healthResponse.ok) {
          console.log('Upload service is available');
          // Note: The backend doesn't have a file listing endpoint yet
          // Uploads will be populated as users upload files
        }
      } catch (error) {
        console.error('Upload service not available:', error);
        // This is not a critical error, uploads can still work
      }
    };

    loadUploads();
  }, [setUploads]);

  const handleAddToTimeline = (upload: IUpload) => {
    try {
      console.log('🎬 Adding to timeline:', upload.originalName, upload.url);
      const fileType = getFileType(upload.originalName);
      console.log('📁 File type detected:', fileType);

      // Test if the URL is accessible before adding to timeline
      const testUrl = async () => {
        try {
          const response = await fetch(upload.url, { method: 'HEAD' });
          console.log('🔍 URL accessibility test:', response.ok ? 'PASS' : 'FAIL', response.status);
          return response.ok;
        } catch (error) {
          console.error('🔍 URL accessibility test FAILED:', error);
          return false;
        }
      };

      if (fileType === 'video') {
        console.log('🎥 Dispatching ADD_VIDEO event');
        console.log('🔗 Video URL:', upload.url);

        // Test URL accessibility first
        testUrl().then(isAccessible => {
          if (!isAccessible) {
            console.error('❌ Video URL is not accessible:', upload.url);
            alert('Error: Video file is not accessible. Please try uploading again.');
            return;
          }
          console.log('✅ Video URL is accessible, proceeding with dispatch');
        });

        // Add a small delay to ensure the video URL is fully accessible
        setTimeout(() => {
          console.log('🎬 Dispatching ADD_VIDEO with delay...');
          dispatch(ADD_VIDEO, {
            payload: {
              id: generateId(),
              details: {
                src: upload.url
              },
              metadata: {
                resourceId: upload.url
              }
            },
            options: {
              resourceId: "main"
            }
          });
          console.log('🎬 ADD_VIDEO dispatch completed');
        }, 100);
      } else if (fileType === 'image') {
        console.log('🖼️ Dispatching ADD_IMAGE event');
        dispatch(ADD_IMAGE, {
          payload: {
            id: generateId(),
            details: {
              src: upload.url
            }
          },
          options: {
            trackId: "main"
          }
        });
      } else if (fileType === 'audio') {
        console.log('🎵 Dispatching ADD_AUDIO event');
        dispatch(ADD_AUDIO, {
          payload: {
            id: generateId(),
            details: {
              src: upload.url
            }
          },
          options: {
            trackId: "main"
          }
        });
      }
      console.log('✅ Successfully dispatched event for:', fileType);
    } catch (error) {
      console.error('❌ Error adding to timeline:', error);
      console.error('Upload data:', upload);
      alert(`Error adding ${upload.originalName} to timeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUploadSuccess = (upload: IUpload) => {
    addUpload(upload);
  };

  const handleRemoveUpload = (uploadId: string) => {
    removeUpload(uploadId);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="text-sm flex-none text-text-primary font-medium h-12 flex items-center px-4">
        Uploads
      </div>

      <UploadForm onUploadSuccess={handleUploadSuccess} />

      <UploadsList
        uploads={uploads}
        onAddToTimeline={handleAddToTimeline}
        onRemoveUpload={handleRemoveUpload}
      />
    </div>
  );
};