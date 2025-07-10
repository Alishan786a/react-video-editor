import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadIcon, X, Play, Music, Image as ImageIcon, Pause } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import useDataState from "@/store/use-data-state";
import { createUploadsDetails } from "@/utils/upload";
import { IUpload } from "@/interfaces/editor";
import { ADD_VIDEO, ADD_IMAGE, ADD_AUDIO, dispatch } from "@designcombo/events";
import { generateId } from "@designcombo/timeline";

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
    // Default to audio for unknown extensions, but this could be changed
    return 'audio';
  }
};

// Helper function to get file icon
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
        previewData: (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/'))
          ? URL.createObjectURL(file)
          : undefined,
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
        <div className="px-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {uploads.map((upload) => (
              <UploadItem
                key={upload.id}
                upload={upload}
                onAddToTimeline={() => handleAddToTimeline(upload)}
                onRemove={() => removeUpload(upload.id)}
              />
            ))}
          </div>
          {uploads.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files uploaded yet</p>
              <p className="text-xs">Click Upload to add media files</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const UploadItem = ({
  upload,
  onAddToTimeline,
  onRemove
}: {
  upload: IUpload;
  onAddToTimeline: () => void;
  onRemove: () => void;
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [showAudioPreview, setShowAudioPreview] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const thumbnailVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const thumbnailAudioRef = useRef<HTMLAudioElement>(null);

  const fileType = getFileType(upload.originalName);
  const isImage = fileType === 'image';
  const isVideo = fileType === 'video';
  const isAudio = fileType === 'audio';

  // Generate preview for images, videos, and audio
  useEffect(() => {
    if (upload.previewData) {
      // Use the blob URL created during upload for immediate preview
      setPreviewUrl(upload.previewData);
    } else if (isImage || isVideo || isAudio) {
      // For images, videos, and audio, use the uploaded file URL as preview
      setIsLoading(true);
      setPreviewUrl(upload.url);
    } else {
      // For other files, no preview
      setPreviewUrl(null);
    }
  }, [upload, isImage, isVideo, isAudio]);

  const handleMediaLoad = () => {
    setIsLoading(false);
  };

  const handleMediaError = () => {
    setIsLoading(false);
    setPreviewUrl(null);
  };

  const handleVideoLoadedMetadata = () => {
    if (thumbnailVideoRef.current) {
      setVideoDuration(thumbnailVideoRef.current.duration);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (thumbnailAudioRef.current) {
      setAudioDuration(thumbnailAudioRef.current.duration);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsAudioPlaying(false);
    setAudioCurrentTime(0);
  };

  const toggleAudioPlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isAudioPlaying) {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      } else {
        audioRef.current.play();
        setIsAudioPlaying(true);
      }
    }
  };

  const toggleAudioPreview = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowAudioPreview(!showAudioPreview);
    if (isAudioPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  const toggleVideoPreview = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowVideoPreview(!showVideoPreview);
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Handle keyboard events for preview modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showVideoPreview && e.key === 'Escape') {
        toggleVideoPreview();
      }
      if (showAudioPreview && e.key === 'Escape') {
        toggleAudioPreview();
      }
    };

    if (showVideoPreview || showAudioPreview) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showVideoPreview, showAudioPreview]);

  return (
    <div className="relative group bg-background border rounded-md overflow-hidden transition-colors">
      {/* Video Preview Modal */}
      {showVideoPreview && isVideo && previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={toggleVideoPreview}>
          <div className="relative max-w-4xl max-h-[80vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <video
              ref={videoRef}
              src={previewUrl}
              className="w-full h-full rounded-lg"
              controls
              autoPlay
              onEnded={handleVideoEnded}
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
            />
            <button
              onClick={toggleVideoPreview}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Audio Preview Modal */}
      {showAudioPreview && isAudio && (previewUrl || upload.url) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={toggleAudioPreview}>
          <div className="relative bg-background rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="mb-4">
                <Music size={48} className="mx-auto text-primary mb-2" />
                <h3 className="text-lg font-medium text-text-primary">{upload.originalName}</h3>
              </div>

              <audio
                ref={audioRef}
                src={previewUrl || upload.url}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
                onLoadedMetadata={handleAudioLoadedMetadata}
                className="hidden"
              />

              <div className="space-y-4">
                {/* Progress Bar */}
                {audioDuration && (
                  <div className="space-y-2">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-100"
                        style={{ width: `${(audioCurrentTime / audioDuration) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatDuration(audioCurrentTime)}</span>
                      <span>{formatDuration(audioDuration)}</span>
                    </div>
                  </div>
                )}

                {/* Play/Pause Button */}
                <button
                  onClick={toggleAudioPlayback}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-3 transition-colors"
                >
                  {isAudioPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>
              </div>
            </div>

            <button
              onClick={toggleAudioPreview}
              className="absolute top-2 right-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-full p-1 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Upload Item */}
      <div
        className="cursor-pointer hover:bg-secondary/50 transition-colors"
        title={`${upload.originalName} - Click to add to timeline`}
      >
        <div onClick={onAddToTimeline} className="p-2">
          <div className="w-full h-20 bg-secondary/30 rounded-sm mb-2 flex items-center justify-center relative overflow-hidden">
            {previewUrl ? (
              <>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {isVideo ? (
                  <div className="relative w-full h-full">
                    <video
                      ref={thumbnailVideoRef}
                      src={previewUrl}
                      className="w-full h-full object-cover"
                      muted
                      onLoadedData={handleMediaLoad}
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onError={handleMediaError}
                      style={{ display: isLoading ? 'none' : 'block' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20"   >
                      <div className="flex flex-col items-center gap-1">
                        <Play size={20} className="text-white drop-shadow-lg" onClick={toggleVideoPreview}/>
                     
                      </div>
                    </div>
                    {videoDuration && (
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                        {formatDuration(videoDuration)}
                      </div>
                    )}
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt={upload.originalName}
                    className="w-full h-full object-cover"
                    onLoad={handleMediaLoad}
                    onError={handleMediaError}
                    style={{ display: isLoading ? 'none' : 'block' }}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground relative">
                {getFileIcon(upload.originalName)}
                <span className="text-xs mt-1 capitalize">{fileType}</span>
                {isAudio && audioDuration && (
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(audioDuration)}
                  </span>
                )}
                {/* Audio play button overlay */}
                {isAudio && (
                  <div
                    
                    className="absolute inset-0 flex items-center justify-center   rounded-sm transition-colors opacity-0 group-hover:opacity-100"
                    title="Play audio"
                  >
                    <Play size={20} className="text-white " onClick={toggleAudioPreview}/>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hidden audio element for metadata loading */}
          {isAudio && (previewUrl || upload.url) && (
            <audio
              ref={thumbnailAudioRef}
              src={previewUrl || upload.url}
              onLoadedMetadata={handleAudioLoadedMetadata}
              className="hidden"
            />
          )}

          <div className="text-xs text-text-primary truncate" title={upload.originalName}>
            {upload.originalName}
          </div>
          <div className="text-xs text-muted-foreground truncate capitalize">
            {fileType}
          </div>
        </div>

        {/* Action Buttons */}
      
      </div>
    </div>
  );
};
