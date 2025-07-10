import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HISTORY_UNDO, HISTORY_REDO, dispatch } from "@designcombo/events";
import logoDark from "@/assets/logo-dark.png";
import { Icons } from "@/components/shared/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { ChevronDown, Download } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { download } from "@/utils/download";
import { API_ENDPOINTS } from "@/config/api";



import useStore from "@/store/store";
import { IDesign } from "@designcombo/types";
import { generateId } from "@designcombo/timeline";

const size = {
  width: 1080,
  height: 1920
};
export default function Navbar() {
  const handleUndo = () => {
    dispatch(HISTORY_UNDO);
  };

  const handleRedo = () => {
    dispatch(HISTORY_REDO);
  };



  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 320px"
      }}
      className="h-[72px] absolute top-0 left-0 right-0  px-2 z-[205] pointer-events-none flex items-center"
    >
      <div className="flex items-center gap-2 pointer-events-auto h-14">
        <div className="bg-background h-12 w-12 flex items-center justify-center rounded-md">
          <img src={logoDark} alt="logo" className="h-5 w-5" />
        </div>
        <div className="bg-background px-1.5 h-12 flex  items-center">
          <Button
            onClick={handleUndo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.undo width={20} />
          </Button>
          <Button
            onClick={handleRedo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.redo width={20} />
          </Button>
        </div>
      </div>

      <div className="pointer-events-auto  h-14 flex items-center gap-2 justify-center">
        <div className="bg-background px-2.5 rounded-md h-12 gap-4 flex items-center">
          <div className="font-medium text-sm px-1">Untitled video</div>
          <ResizeVideo />
        </div>
      </div>

      <div className="flex items-center gap-2 pointer-events-auto h-14 justify-end">
        <div className="flex items-center gap-2 bg-background px-2.5 rounded-md h-12">
          <DownloadPopover />
        </div>
      </div>
    </div>
  );
}



interface IDownloadState {
  renderId: string;
  progress: number;
  isDownloading: boolean;
}
const DownloadPopover = () => {
  const [open, setOpen] = useState(false);
  const [downloadState, setDownloadState] = useState<IDownloadState>({
    progress: 0,
    isDownloading: false,
    renderId: ""
  });
  const {
    tracks,
    trackItemIds,
    trackItemsMap,
    trackItemDetailsMap,
    transitionsMap,
    fps
  } = useStore();

  const handleExport = async () => {
    const data: IDesign = {
      id: generateId(),
      fps,
      tracks,
      size,
      trackItemDetailsMap,
      trackItemIds,
      transitionsMap,
      trackItemsMap,
      transitionIds: []
    };

    try {
      // Start the render job
      const response = await fetch(API_ENDPOINTS.RENDER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to start render job');
      }

      const result = await response.json();

      if (result.success && result.renderId) {
        setDownloadState({
          ...downloadState,
          renderId: result.renderId,
          isDownloading: true,
          progress: 0
        });
      } else {
        throw new Error(result.message || 'Failed to start render job');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to start video export. Please try again.');
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (downloadState.renderId) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(API_ENDPOINTS.RENDER_STATUS(downloadState.renderId));

          if (!response.ok) {
            throw new Error('Failed to check render status');
          }

          const result = await response.json();

          if (result.render) {
            const { progress, output, status } = result.render;

            if (status === 'completed' && progress === 100 && output) {
              clearInterval(interval);
              setDownloadState({
                ...downloadState,
                renderId: "",
                progress: 0,
                isDownloading: false
              });
              download(output, `video_${downloadState.renderId}`);
              setOpen(false);
            } else if (status === 'failed') {
              clearInterval(interval);
              setDownloadState({
                ...downloadState,
                renderId: "",
                progress: 0,
                isDownloading: false
              });
              alert('Video rendering failed. Please try again.');
              setOpen(false);
            } else {
              setDownloadState({
                ...downloadState,
                progress: progress || 0,
                isDownloading: true
              });
            }
          }
        } catch (error) {
          console.error('Status check error:', error);
          clearInterval(interval);
          setDownloadState({
            ...downloadState,
            renderId: "",
            progress: 0,
            isDownloading: false
          });
          alert('Failed to check render status. Please try again.');
          setOpen(false);
        }
      }, 2000); // Check every 2 seconds instead of 1 second
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [downloadState.renderId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="flex gap-1 h-9 w-9 border border-border"
          size="icon"
          variant="secondary"
        >
          <Download width={18} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 z-[250] flex flex-col gap-4">
        {downloadState.isDownloading ? (
          <>
            <Label>Downloading</Label>
            <div className="flex items-center gap-2">
              <Progress
                className="h-2 rounded-sm"
                value={downloadState.progress}
              />
              <div className="text-zinc-400 text-sm border border-border p-1 rounded-sm">
                {parseInt(downloadState.progress.toString())}%
              </div>
            </div>
            <div>
              <Button className="w-full">Copy link</Button>
            </div>
          </>
        ) : (
          <>
            <Label>Export settings</Label>
            <Button className="w-full justify-between" variant="outline">
              <div>MP4</div>
              <ChevronDown width={16} />
            </Button>
            <div>
              <Button onClick={handleExport} className="w-full">
                Export
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

interface ResizeOptionProps {
  label: string;
  icon: string;
  value: ResizeValue;
}

interface ResizeValue {
  width: number;
  height: number;
  name: string;
}

const RESIZE_OPTIONS: ResizeOptionProps[] = [
  {
    label: "16:9",
    icon: "landscape",
    value: {
      width: 1920,
      height: 1080,
      name: "16:9"
    }
  },
  {
    label: "9:16",
    icon: "portrait",
    value: {
      width: 1080,
      height: 1920,
      name: "9:16"
    }
  },
  {
    label: "1:1",
    icon: "square",
    value: {
      width: 1080,
      height: 1080,
      name: "1:1"
    }
  }
];

const ResizeVideo = () => {
  const handleResize = () => {};
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="border border-border" variant="secondary">
          Resize
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 z-[250]">
        <div className="grid gap-4 text-sm">
          {RESIZE_OPTIONS.map((option, index) => (
            <ResizeOption
              key={index}
              label={option.label}
              icon={option.icon}
              value={option.value}
              handleResize={handleResize}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ResizeOption = ({
  label,
  icon,
  value,
  handleResize
}: ResizeOptionProps & { handleResize: (payload: ResizeValue) => void }) => {
  const Icon = Icons[icon as "text"];
  return (
    <div
      onClick={() => handleResize(value)}
      className="flex items-center gap-4 hover:bg-zinc-50/10 cursor-pointer"
    >
      <div className="text-muted-foreground">
        <Icon />
      </div>
      <div>
        <div>{label}</div>
        <div className="text-muted-foreground">Tiktok, Instagram</div>
      </div>
    </div>
  );
};
