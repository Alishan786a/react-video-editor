import { X, Play, Music, Pause } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { IUpload } from "@/interfaces/editor";
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

// Helper function to get file icon
const getFileIcon = (filename: string) => {
  const fileType = getFileType(filename);
  switch (fileType) {
    case 'video':
      return <Play size={16} />;
    case 'image':
      return <Music size={16} />;
    case 'audio':
      return <Music size={16} />;
    default:
      return <Music size={16} />;
  }
};

interface UploadItemProps {
  upload: IUpload;
  onAddToTimeline: () => void;
  onRemove: () => void;
}

// Helper function to extract file path from URL for deletion
const getFilePathFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // Extract path after /api/v1/editor/files/
    const pathMatch = urlObj.pathname.match(/\/api\/v1\/editor\/files\/(.+)/);
    return pathMatch ? pathMatch[1] : '';
  } catch {
    // If URL parsing fails, try to extract from the end of the URL
    const parts = url.split('/');
    const folderIndex = parts.findIndex(part => part === 'files');
    if (folderIndex !== -1 && folderIndex < parts.length - 1) {
      return parts.slice(folderIndex + 1).join('/');
    }
    return '';
  }
};

export const UploadItem = ({ upload, onAddToTimeline, onRemove }: UploadItemProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [showAudioPreview, setShowAudioPreview] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
      setPreviewUrl(upload.previewData);
    } else if (isImage || isVideo || isAudio) {
      setIsLoading(true);
      setPreviewUrl(upload.url);
    } else {
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
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
        });
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

  const handleRemoveFile = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isDeleting) return; // Prevent multiple delete requests

    setIsDeleting(true);

    try {
      // Extract file path from URL
      const filePath = getFilePathFromUrl(upload.url);

      if (!filePath) {
        throw new Error('Could not extract file path from URL');
      }

      // Make DELETE request to server
      const response = await fetch(`${API_CONFIG.UPLOAD_API_URL}/files/${filePath}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Call the onRemove callback to update the UI
        onRemove();
      } else {
        throw new Error(result.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete file. Please try again.';
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
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
      document.body.style.overflow = 'hidden';
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
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
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
                    className="absolute inset-0 flex items-center justify-center rounded-sm transition-colors opacity-100"
                    title="Play audio"
                  >
                    <Play size={20} className="text-white" onClick={toggleAudioPreview}/>
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
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* {isVideo && previewUrl && (
            <button
              onClick={toggleVideoPreview}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 transition-colors shadow-lg"
              title="Preview video"
            >
              <Play size={12} />
            </button>
          )}
          {isAudio && (
            <button
              onClick={toggleAudioPreview}
              className="bg-green-500 hover:bg-green-600 text-white rounded-full p-1 transition-colors shadow-lg"
              title="Preview audio"
            >
              <Music size={12} />
            </button>
          )} */}
          <button
            onClick={handleRemoveFile}
            disabled={isDeleting}
            className={`${
              isDeleting
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600'
            } text-white rounded-full p-1 transition-colors shadow-lg`}
            title={isDeleting ? "Deleting..." : "Remove file"}
          >
            {isDeleting ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <X size={12} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
