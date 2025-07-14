import useDataState from "@/store/use-data-state";
import { IUpload } from "@/interfaces/editor";
import { ADD_VIDEO, ADD_IMAGE, ADD_AUDIO, dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";
import { UploadForm, UploadsList } from "@/components/uploads";
import { useEffect } from "react";

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

  // Load existing uploads on component mount
  useEffect(() => {
    const loadUploads = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/editor/upload/files');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUploads(data.files);
          }
        }
      } catch (error) {
        console.error('Failed to load uploads:', error);
      }
    };

    loadUploads();
  }, [setUploads]);

  const handleAddToTimeline = (upload: IUpload) => {
    const fileType = getFileType(upload.originalName);

    if (fileType === 'video') {
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
    } else if (fileType === 'image') {
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