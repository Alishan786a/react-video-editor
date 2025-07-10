import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { createUploadsDetails } from "@/utils/upload";
import { IUpload } from "@/interfaces/editor";

interface UploadFormProps {
  onUploadSuccess: (upload: IUpload) => void;
}

export const UploadForm = ({ onUploadSuccess }: UploadFormProps) => {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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
        previewData: (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/'))
          ? URL.createObjectURL(file)
          : undefined,
      };

      // Call success callback
      onUploadSuccess(upload);

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

  const handleUploadClick = () => {
    inputFileRef.current?.click();
  };

  return (
    <>
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
                onClick={handleUploadClick}
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
                onClick={handleUploadClick}
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
    </>
  );
};
