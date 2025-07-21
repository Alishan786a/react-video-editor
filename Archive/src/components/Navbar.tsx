"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import logoDark from "../assets/logo-dark.png";
import { Icons } from "./shared/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "./ui/popover";
import { ChevronDown, Download } from "lucide-react";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";

export default function Navbar() {
  const handleUndo = () => {
    // TODO: Implement undo functionality
    console.log("Undo clicked");
  };

  const handleRedo = () => {
    // TODO: Implement redo functionality
    console.log("Redo clicked");
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 320px"
      }}
      className="h-[72px] absolute top-0 left-0 right-0 px-2 z-[205] pointer-events-none flex items-center"
    >
      <div className="flex items-center gap-2 pointer-events-auto h-14">
        <div className="bg-background h-12 w-12 flex items-center justify-center rounded-md">
          <img src={logoDark} alt="logo" className="h-5 w-5" />
        </div>
        <div className="bg-background px-1.5 h-12 flex items-center">
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

      <div className="pointer-events-auto h-14 flex items-center gap-2 justify-center">
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

const DownloadPopover = () => {
  const [open, setOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setIsDownloading(true);
    setProgress(0);
    
    // Simulate download progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsDownloading(false);
          setOpen(false);
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

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
        {isDownloading ? (
          <>
            <Label>Downloading</Label>
            <div className="flex items-center gap-2">
              <Progress
                className="h-2 rounded-sm"
                value={progress}
              />
              <div className="text-zinc-400 text-sm border border-border p-1 rounded-sm">
                {parseInt(progress.toString())}%
              </div>
            </div>
            <div className="flex gap-1">
              <Button className="flex-1" size="sm">Copy link</Button>
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

interface ResizeValue {
  width: number;
  height: number;
  name: string;
}

const RESIZE_OPTIONS = [
  {
    label: "16:9",
    icon: "landscape",
    value: { width: 1920, height: 1080, name: "16:9" }
  },
  {
    label: "9:16", 
    icon: "portrait",
    value: { width: 1080, height: 1920, name: "9:16" }
  },
  {
    label: "1:1",
    icon: "square", 
    value: { width: 1080, height: 1080, name: "1:1" }
  }
];

const ResizeVideo = () => {
  const [currentSize, setCurrentSize] = useState({ width: 800, height: 500 });

  const handleResize = (resizeValue: ResizeValue) => {
    console.log('Resizing canvas to:', resizeValue);
    setCurrentSize({ width: resizeValue.width, height: resizeValue.height });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="border border-border" variant="secondary">
          Resize
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 z-[250]">
        <div className="grid gap-4 text-sm">
          <div className="pb-2 border-b border-border">
            <div className="text-xs text-muted-foreground">Current size</div>
            <div className="font-medium">{currentSize.width} × {currentSize.height}</div>
          </div>
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
}: {
  label: string;
  icon: string;
  value: ResizeValue;
  handleResize: (payload: ResizeValue) => void;
}) => {
  const Icon = Icons[icon as keyof typeof Icons];
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
