import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadIcon, X, Play, Music, Image as ImageIcon } from "lucide-react";
import { useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import useDataState from "@/store/use-data-state";
import { createUploadsDetails } from "@/utils/upload";
import { IUpload } from "@/interfaces/editor";
import { ADD_VIDEO, ADD_IMAGE, ADD_AUDIO, dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";

export const Uploads = () => {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { uploads, addUpload, removeUpload } = useDataState();

  const onInputFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // File size validation (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      alert('File size must be less than 100MB');
      return;
    }

    // File type validation
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm|mp3|wav|ogg|m4a|aac|jpg|jpeg|png|gif|webp|svg)$/i)) {
      alert('Unsupported file type. Please upload images, videos, or audio files.');
      return;
    }

    setIsUploading(true);
    try {
      // Get presigned URL and upload details
      const uploadDetails = await createUploadsDetails(file.name);

      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('originalFileName', file.name);

      // Upload file using the documented API format
      const uploadResponse = await fetch(uploadDetails.uploadUrl, {
        method: uploadDetails.uploadMethod,
        body: formData,
        // Don't set Content-Type header - let browser set it for FormData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Create upload object
      const upload: IUpload = {
        id: uploadDetails.id,
        name: uploadResult.fileName || uploadDetails.name,
        originalName: uploadResult.originalFileName || file.name,
        fileId: uploadDetails.id,
        previewUrl: uploadResult.url || uploadDetails.url,
        url: uploadResult.url || uploadDetails.url,
        previewData: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };

      // Add to uploads store
      addUpload(upload);

      // Reset file input
      if (inputFileRef.current) {
        inputFileRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      alert(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

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
        options: {}
      });
    }
  };

  const getFileType = (filename: string): 'video' | 'image' | 'audio' => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension || '')) {
      return 'video';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return 'image';
    } else {
      return 'audio';
    }
  };

  const getFileIcon = (filename: string) => {
    const fileType = getFileType(filename);
    switch (fileType) {
      case 'video':
        return <Play size={16} />;
      case 'image':
        return <ImageIcon size={16} />;
      case 'audio':
        return <Music size={16} />;
      default:
        return <ImageIcon size={16} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="text-sm flex-none text-text-primary font-medium h-12  flex items-center px-4">
        Your media
      </div>
      <input
        onChange={onInputFileChange}
        ref={inputFileRef}
        type="file"
        className="hidden"
        accept="image/*,audio/*,video/*"
        disabled={isUploading}
      />
      <div className="px-4 py-2">
        <div>
          <Tabs defaultValue="projects" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="projects">Project</TabsTrigger>
              <TabsTrigger value="workspace">Workspace</TabsTrigger>
            </TabsList>
            <TabsContent value="projects">
              <Button
                onClick={() => {
                  inputFileRef.current?.click();
                }}
                className="flex gap-2 w-full"
                variant="secondary"
                disabled={isUploading}
              >
                <UploadIcon size={16} />
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </TabsContent>
            <TabsContent value="workspace">
              <Button
                onClick={() => {
                  inputFileRef.current?.click();
                }}
                className="flex gap-2 w-full"
                variant="secondary"
                disabled={isUploading}
              >
                <UploadIcon size={16} />
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <ScrollArea>
        <div className="px-4 masonry-sm">
          {uploads.map((upload) => (
            <UploadItem
              key={upload.id}
              upload={upload}
              onAddToTimeline={() => handleAddToTimeline(upload)}
              onRemove={() => removeUpload(upload.id)}
              getFileIcon={getFileIcon}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

const UploadItem = ({
  upload,
  onAddToTimeline,
  onRemove,
  getFileIcon
}: {
  upload: IUpload;
  onAddToTimeline: () => void;
  onRemove: () => void;
  getFileIcon: (filename: string) => React.ReactNode;
}) => {
  const isImage = upload.originalName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

  return (
    <div className="relative group mb-2 bg-background border rounded-md overflow-hidden cursor-pointer hover:bg-secondary/50 max-w-[120px]"> 
      <div onClick={onAddToTimeline} className="p-2">
        {isImage && upload.previewData ? (
          <img
            src={upload.previewData}
            alt={upload.originalName}
            className="w-full h-24 object-cover rounded-sm mb-2"
          />
        ) : (
          <div className="w-full h-24 bg-secondary/30 rounded-sm mb-2 flex items-center justify-center">
            {getFileIcon(upload.originalName)}
          </div>
        )}
        <div className="text-xs text-text-primary truncate">
          {upload.originalName}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
      >
        <X size={12} />
      </button>
    </div>
  );
};
