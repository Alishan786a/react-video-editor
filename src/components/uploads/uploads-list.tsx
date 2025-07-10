import { ScrollArea } from "@/components/ui/scroll-area";
import { IUpload } from "@/interfaces/editor";
import { UploadItem } from "./upload-item";

interface UploadsListProps {
  uploads: IUpload[];
  onAddToTimeline: (upload: IUpload) => void;
  onRemoveUpload: (uploadId: string) => void;
}

export const UploadsList = ({ uploads, onAddToTimeline, onRemoveUpload }: UploadsListProps) => {
  if (uploads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="mb-2">📁</div>
          <p className="text-sm">No files uploaded yet</p>
          <p className="text-xs">Upload images, videos, or audio files to get started</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {uploads.map((upload) => (
            <UploadItem
              key={upload.id}
              upload={upload}
              onAddToTimeline={() => onAddToTimeline(upload)}
              onRemove={() => onRemoveUpload(upload.id)}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};
