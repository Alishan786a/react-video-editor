"use client";
import React, { useEffect, useRef, useState } from "react";
import { SeekPlayer } from "./timeline-related/SeekPlayer";
import { StoreContext } from "@/store";
import { observer } from "mobx-react";
import { TimeFrameView } from "./timeline-related/TimeFrameView";
import { Button } from "./ui/button";
import { Icons } from "./shared/icons";
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBack,
  IconPlayerSkipForward
} from "@tabler/icons-react";
import { Slider } from "./ui/slider";

// Timeline Header Component
const TimelineHeader = observer(() => {
  const store = React.useContext(StoreContext);
  const playing = store.playing;

  const handlePlay = () => {
    store.setPlaying(true);
  };

  const handlePause = () => {
    store.setPlaying(false);
  };

  const handleDelete = () => {
    if (store.selectedElement) {
      store.removeEditorElement(store.selectedElement.id);
    }
  };

  const handleSplit = () => {
    if (store.selectedElement) {
      const currentTime = store.currentTimeInMs;
      const element = store.selectedElement;

      if (currentTime > element.timeFrame.start && currentTime < element.timeFrame.end) {
        // Create a copy of the element for the second part
        const secondPart = { ...element };
        secondPart.id = `${element.id}_split_${Date.now()}`;
        secondPart.timeFrame = {
          start: currentTime,
          end: element.timeFrame.end
        };

        // Update the first part
        store.updateEditorElementTimeFrame(element, {
          end: currentTime
        });

        // Add the second part
        store.addEditorElement(secondPart);
      }
    }
  };

  const formatTime = (timeInMs: number) => {
    const seconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: "relative",
        height: "50px",
        boxShadow: "inset 0 1px 0 0 #27272a",
        flex: "none"
      }}
      className="bg-background"
    >
      <div
        style={{
          position: "absolute",
          height: 50,
          width: "100%",
          display: "flex",
          alignItems: "center"
        }}
      >
        <div
          style={{
            height: 36,
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 260px 1fr",
            alignItems: "center"
          }}
        >
          <div className="px-2 flex">
            <Button
              onClick={handleDelete}
              variant={"ghost"}
              size={"sm"}
              className="flex items-center gap-1 px-2"
            >
              <Icons.trash size={14} /> Delete
            </Button>

            <Button
              onClick={handleSplit}
              variant={"ghost"}
              size={"sm"}
              className="flex items-center gap-1 px-2"
            >
              <Icons.shapes size={15} /> Split
            </Button>
          </div>

          <div className="flex items-center justify-center">
            <div>
              <Button variant={"ghost"} size={"icon"}>
                <IconPlayerSkipBack size={14} />
              </Button>
              <Button
                onClick={() => {
                  if (playing) {
                    return handlePause();
                  }
                  handlePlay();
                }}
                variant={"ghost"}
                size={"icon"}
              >
                {playing ? (
                  <IconPlayerPauseFilled size={14} />
                ) : (
                  <IconPlayerPlayFilled size={14} />
                )}
              </Button>
              <Button variant={"ghost"} size={"icon"}>
                <IconPlayerSkipForward size={14} />
              </Button>
            </div>
            <div
              className="text-xs font-light"
              style={{
                display: "grid",
                alignItems: "center",
                gridTemplateColumns: "54px 4px 54px",
                paddingTop: "2px",
                justifyContent: "center"
              }}
            >
              <div
                className="text-zinc-200 font-medium"
                style={{
                  display: "flex",
                  justifyContent: "center"
                }}
              >
                {formatTime(store.currentTimeInMs)}
              </div>
              <span>/</span>
              <div
                className="text-muted-foreground"
                style={{
                  display: "flex",
                  justifyContent: "center"
                }}
              >
                {formatTime(store.maxTime)}
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center ">
            <div className="flex border-l border-border pl-4 pr-2">
              <Button
                size={"icon"}
                variant={"ghost"}
                onClick={() => {
                  // Zoom out - increase maxTime to show more timeline
                  store.maxTime = Math.min(store.maxTime * 1.5, 300000); // Max 5 minutes
                }}
              >
                <Icons.zoomOut size={16} />
              </Button>
              <Slider
                className="w-28"
                defaultValue={[50]}
                min={10}
                max={100}
                step={10}
                onValueChange={(value) => {
                  // Adjust timeline zoom based on slider value
                  const zoomFactor = value[0] / 50; // 50 is the default
                  store.maxTime = Math.max(10000, Math.min(300000, 60000 / zoomFactor)); // 10s to 5min
                }}
              />
              <Button
                size={"icon"}
                variant={"ghost"}
                onClick={() => {
                  // Zoom in - decrease maxTime to show less timeline
                  store.maxTime = Math.max(store.maxTime / 1.5, 10000); // Min 10 seconds
                }}
              >
                <Icons.zoomIn size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Timeline Ruler Component
const TimelineRuler = observer(() => {
  const store = React.useContext(StoreContext);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasContext, setCanvasContext] = useState<CanvasRenderingContext2D | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 40 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    setCanvasContext(context);

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = 40;

      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.scale(window.devicePixelRatio, window.devicePixelRatio);
      setCanvasSize({ width, height });
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, []);

  useEffect(() => {
    if (!canvasContext || !canvasSize.width) return;

    const draw = () => {
      const { width, height } = canvasSize;
      canvasContext.clearRect(0, 0, width, height);
      canvasContext.save();
      canvasContext.strokeStyle = "#71717a";
      canvasContext.fillStyle = "#71717a";
      canvasContext.lineWidth = 1;
      canvasContext.font = "11px system-ui";
      canvasContext.textBaseline = "top";

      // Draw time markers
      const maxTime = store.maxTime;
      const stepSize = 1000; // 1 second steps
      const steps = Math.ceil(maxTime / stepSize);

      for (let i = 0; i <= steps; i++) {
        const time = i * stepSize;
        const x = (time / maxTime) * width;

        // Draw line
        canvasContext.beginPath();
        canvasContext.strokeStyle = i % 5 === 0 ? "#d4d4d8" : "#a1a1aa";
        canvasContext.moveTo(x, 32);
        canvasContext.lineTo(x, 32 + (i % 5 === 0 ? 8 : 6));
        canvasContext.stroke();

        // Draw text for major markers
        if (i % 5 === 0) {
          const seconds = Math.floor(time / 1000);
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          const timeText = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;

          canvasContext.fillStyle = "#71717a";
          canvasContext.fillText(timeText, x + 2, 12);
        }
      }

      canvasContext.restore();
    };

    draw();
  }, [canvasContext, canvasSize, store.maxTime]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * store.maxTime;

    store.setCurrentTimeInMs(Math.max(0, Math.min(newTime, store.maxTime)));
  };

  return (
    <div
      className="border-t border-border"
      style={{
        position: "relative",
        width: "100%",
        height: `${canvasSize.height}px`,
        backgroundColor: "transparent"
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          cursor: "pointer"
        }}
      />
    </div>
  );
});

// Timeline Playhead Component
const TimelinePlayhead = observer(() => {
  const store = React.useContext(StoreContext);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);

  const percentOfCurrentTime = (store.currentTimeInMs / store.maxTime) * 100;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartTime(store.currentTimeInMs);
  };

  const handleMouseMove = (e: globalThis.MouseEvent) => {
    if (isDragging && playheadRef.current) {
      const delta = e.clientX - dragStartX;
      const container = playheadRef.current.parentElement;
      if (container) {
        const containerWidth = container.clientWidth;
        const deltaPercentage = (delta / containerWidth) * 100;
        const deltaTime = (deltaPercentage / 100) * store.maxTime;
        const newTime = dragStartTime + deltaTime;

        store.setCurrentTimeInMs(Math.max(0, Math.min(newTime, store.maxTime)));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStartX, dragStartTime]);

  return (
    <div
      ref={playheadRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: `${percentOfCurrentTime}%`,
        top: 40,
        width: 1,
        height: "calc(100% - 40px)",
        background: "#d4d4d8",
        zIndex: 20,
        cursor: "pointer",
        transform: "translateX(-50%)"
      }}
    >
      <div className="relative h-full">
        <div className="absolute top-0 transform -translate-x-1/2 w-3 h-full"></div>
        <div className="absolute top-0 transform -translate-x-1/2 w-0.5 h-full bg-white/50"></div>
        <div
          style={{
            borderRadius: "0 0 20px 20px"
          }}
          className="absolute transform -translate-x-1/2 px-1.5 h-3"
        >
          <svg height="12" viewBox="0 0 12 12" fill="none">
            <path
              fill="currentColor"
              d="M11.6585 7.04881L6.6585 11.4238C6.28148 11.7537 5.71852 11.7537 5.3415 11.4238L0.341495 7.04881C0.12448 6.85892 0 6.58459 0 6.29623V1C0 0.447715 0.447715 0 1 0H11C11.5523 0 12 0.447715 12 1V6.29623C12 6.58459 11.8755 6.85892 11.6585 7.04881Z"
            ></path>
          </svg>
        </div>
      </div>
    </div>
  );
});

// Draggable Timeline Item Component
const DraggableTimelineItem = observer(({ element, index }: { element: any, index: number }) => {
  const store = React.useContext(StoreContext);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dragType: 'move' | 'resize-left' | 'resize-right' | null;
    startX: number;
    startValue: number;
  }>({
    isDragging: false,
    dragType: null,
    startX: 0,
    startValue: 0
  });

  const startPercent = (element.timeFrame.start / store.maxTime) * 100;
  const widthPercent = ((element.timeFrame.end - element.timeFrame.start) / store.maxTime) * 100;
  const isSelected = store.selectedElement?.id === element.id;

  // Calculate max duration for video/audio
  const getMaxDuration = () => {
    if (element.type === 'video' && element.properties?.duration) {
      return element.properties.duration * 1000;
    }
    if (element.type === 'audio' && element.properties?.duration) {
      return element.properties.duration * 1000;
    }
    return null;
  };

  const maxDuration = getMaxDuration();
  const isAtMaxDuration = maxDuration && (element.timeFrame.end - element.timeFrame.start) >= maxDuration;

  let bgColor = 'bg-blue-600';
  let icon = '📄';

  if (element.type === 'video') {
    bgColor = 'bg-red-600';
    icon = '🎥';
  } else if (element.type === 'audio') {
    bgColor = 'bg-green-600';
    icon = '🎵';
  } else if (element.type === 'image') {
    bgColor = 'bg-yellow-600';
    icon = '🖼️';
  } else if (element.type === 'text') {
    bgColor = 'bg-purple-600';
    icon = '📝';
  }

  const handleMouseDown = (e: React.MouseEvent, dragType: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();

    let startValue = element.timeFrame.start;
    if (dragType === 'resize-right') {
      startValue = element.timeFrame.end;
    }

    setDragState({
      isDragging: true,
      dragType,
      startX: e.clientX,
      startValue
    });

    store.setSelectedElement(element);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState.isDragging) return;

    const deltaX = e.clientX - dragState.startX;
    const timelineContainer = document.querySelector('.timeline-container') as HTMLElement;
    if (!timelineContainer) return;

    const containerWidth = timelineContainer.clientWidth;
    const deltaTime = (deltaX / containerWidth) * store.maxTime;
    const newValue = Math.max(0, Math.min(store.maxTime, dragState.startValue + deltaTime));

    // Get media duration for video/audio elements
    const getMaxDuration = () => {
      if (element.type === 'video' && element.properties?.duration) {
        return element.properties.duration * 1000; // Convert to ms
      }
      if (element.type === 'audio' && element.properties?.duration) {
        return element.properties.duration * 1000; // Convert to ms
      }
      // For text and image, use timeline max or current duration
      return store.maxTime;
    };

    const maxDuration = getMaxDuration();

    if (dragState.dragType === 'move') {
      const duration = element.timeFrame.end - element.timeFrame.start;
      const newStart = Math.max(0, Math.min(store.maxTime - duration, newValue));
      store.updateEditorElementTimeFrame(element, {
        start: newStart,
        end: newStart + duration
      });
    } else if (dragState.dragType === 'resize-left') {
      const newStart = Math.max(0, Math.min(element.timeFrame.end - 100, newValue));
      store.updateEditorElementTimeFrame(element, {
        start: newStart
      });
    } else if (dragState.dragType === 'resize-right') {
      // For video/audio, limit the end time to not exceed media duration
      let maxEndTime = store.maxTime;
      if (element.type === 'video' || element.type === 'audio') {
        maxEndTime = Math.min(store.maxTime, element.timeFrame.start + maxDuration);
      }

      const newEnd = Math.max(
        element.timeFrame.start + 100, // Minimum duration
        Math.min(maxEndTime, newValue)
      );

      store.updateEditorElementTimeFrame(element, {
        end: newEnd
      });
    }
  };

  const handleMouseUp = () => {
    setDragState({
      isDragging: false,
      dragType: null,
      startX: 0,
      startValue: 0
    });
  };

  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, dragState.startX, dragState.startValue, dragState.dragType]);

  return (
    <div
      className="absolute"
      style={{
        left: `${startPercent}%`,
        top: `${index * 40 + 10}px`,
        width: `${Math.max(widthPercent, 5)}%`,
        height: '30px',
        minWidth: '50px'
      }}
    >
      {/* Left resize handle - transparent but functional */}
      {isSelected && (
        <div
          className="absolute left-0 top-0 w-2 h-full bg-transparent cursor-ew-resize z-20"
          onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
          style={{ transform: 'translateX(-50%)' }}
        />
      )}

      {/* Main timeline item */}
      <div
        className={`${bgColor} text-white text-xs px-2 py-1 rounded flex items-center gap-1 h-full relative transition-all ${
          isSelected ? 'ring-2 ring-cyan-400' : ''
        } ${
          dragState.isDragging
            ? 'cursor-grabbing opacity-75 scale-105 shadow-lg'
            : 'cursor-move hover:opacity-80'
        } ${
          isAtMaxDuration ? 'ring-1 ring-orange-400' : ''
        }`}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
        onClick={() => store.setSelectedElement(element)}
        title={isAtMaxDuration ? `At maximum duration (${maxDuration! / 1000}s)` : undefined}
      >
        <span>{icon}</span>
        <span className="truncate">{element.name || element.type}</span>
        {isAtMaxDuration && (
          <span className="text-orange-300 text-xs ml-1" title="At maximum duration">⚠</span>
        )}
      </div>

      {/* Right resize handle - transparent but functional */}
      {isSelected && (
        <div
          className="absolute right-0 top-0 w-2 h-full bg-transparent cursor-ew-resize z-20"
          onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
          style={{ transform: 'translateX(50%)' }}
        />
      )}
    </div>
  );
});

// Simple Timeline Items Component (HTML-based for guaranteed visibility)
const SimpleTimelineItems = observer(() => {
  const store = React.useContext(StoreContext);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!store.selectedElement) return;

      // Delete selected element with Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        store.removeEditorElement(store.selectedElement.id);
        e.preventDefault();
      }

      // Move element with arrow keys (fine adjustment)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const direction = e.key === 'ArrowLeft' ? -1 : 1;
        const step = e.shiftKey ? 1000 : 100; // Shift for larger steps
        const duration = store.selectedElement.timeFrame.end - store.selectedElement.timeFrame.start;
        const newStart = Math.max(0, Math.min(store.maxTime - duration,
          store.selectedElement.timeFrame.start + (direction * step)));

        store.updateEditorElementTimeFrame(store.selectedElement, {
          start: newStart,
          end: newStart + duration
        });
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [store.selectedElement]);

  return (
    <div className="timeline-container relative w-full h-48 bg-zinc-900 border border-zinc-700 focus:outline-none" tabIndex={0}>
      {store.editorElements.map((element, index) => (
        <DraggableTimelineItem key={element.id} element={element} index={index} />
      ))}

      {/* Instructions overlay when no items */}
      {store.editorElements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
          <div className="text-center">
            <div>No timeline items</div>
            <div className="text-xs mt-1">Add text, images, videos, or audio from the sidebar</div>
          </div>
        </div>
      )}
    </div>
  );
});

// Timeline Canvas Component
const TimelineCanvas = observer(() => {
  const store = React.useContext(StoreContext);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dragType: 'move' | 'resize-left' | 'resize-right' | null;
    elementId: string | null;
    startX: number;
    startTime: number;
  }>({
    isDragging: false,
    dragType: null,
    elementId: null,
    startX: 0,
    startTime: 0
  });

  const TRACK_HEIGHT = 60;
  const TRACK_PADDING = 10;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      const width = 800; // Fixed width for now
      const height = 200; // Fixed height for now

      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }

      setCanvasSize({ width, height });
    };

    updateCanvasSize();

    // Force initial draw
    setTimeout(() => {
      updateCanvasSize();
      drawTimeline();
    }, 500);

    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [store.editorElements.length]);

  const drawTimeline = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;
    ctx.clearRect(0, 0, width, height);

    // Debug: Draw background to see canvas area
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    console.log('Drawing timeline with', store.editorElements.length, 'elements');
    console.log('Canvas size:', width, 'x', height);
    console.log('Max time:', store.maxTime);

    // Draw tracks
    store.editorElements.forEach((element, index) => {
      console.log(`Drawing element ${index}:`, element.name, element.timeFrame);

      const trackY = index * TRACK_HEIGHT + TRACK_PADDING;
      const startX = (element.timeFrame.start / store.maxTime) * width;
      const elementWidth = Math.max(50, ((element.timeFrame.end - element.timeFrame.start) / store.maxTime) * width);

      console.log(`Element ${index} position: x=${startX}, y=${trackY}, width=${elementWidth}`);

      // Draw track background (lighter color to see it)
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, trackY, width, TRACK_HEIGHT - TRACK_PADDING);

      // Draw timeline item
      const isSelected = selectedItems.includes(element.id);

      // Item background
      let itemColor = '#3b82f6'; // Default blue
      if (element.type === 'video') itemColor = '#dc2626'; // Red
      else if (element.type === 'audio') itemColor = '#16a34a'; // Green
      else if (element.type === 'image') itemColor = '#ca8a04'; // Yellow
      else if (element.type === 'text') itemColor = '#9333ea'; // Purple

      ctx.fillStyle = itemColor;
      ctx.fillRect(startX, trackY + 5, elementWidth, TRACK_HEIGHT - TRACK_PADDING - 10);

      // Selection border
      if (isSelected) {
        ctx.strokeStyle = '#00d8d6';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, trackY + 5, elementWidth, TRACK_HEIGHT - TRACK_PADDING - 10);
      }

      // Item text
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const textY = trackY + (TRACK_HEIGHT - TRACK_PADDING) / 2;
      const textX = startX + 8;

      // Clip text to item bounds
      ctx.save();
      ctx.beginPath();
      ctx.rect(startX, trackY + 5, elementWidth, TRACK_HEIGHT - TRACK_PADDING - 10);
      ctx.clip();

      // Draw icon and text
      const iconSize = 16;
      let icon = '📄';
      if (element.type === 'video') icon = '🎥';
      else if (element.type === 'audio') icon = '🎵';
      else if (element.type === 'image') icon = '🖼️';
      else if (element.type === 'text') icon = '📝';

      ctx.font = `${iconSize}px system-ui`;
      ctx.fillText(icon, textX, textY);

      ctx.font = '12px system-ui';
      ctx.fillText(element.name || element.type, textX + iconSize + 4, textY);

      ctx.restore();

      // Resize handles for selected items
      if (isSelected) {
        const handleSize = 8;
        ctx.fillStyle = '#00d8d6';

        // Left handle
        ctx.fillRect(startX - handleSize/2, trackY + 5, handleSize, TRACK_HEIGHT - TRACK_PADDING - 10);

        // Right handle
        ctx.fillRect(startX + elementWidth - handleSize/2, trackY + 5, handleSize, TRACK_HEIGHT - TRACK_PADDING - 10);
      }
    });
  };

  useEffect(() => {
    drawTimeline();
  }, [canvasSize, store.editorElements, selectedItems, store.maxTime]);

  // Force redraw when elements change
  useEffect(() => {
    const timer = setTimeout(() => {
      drawTimeline();
    }, 100);
    return () => clearTimeout(timer);
  }, [store.editorElements.length]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked element
    let clickedElement: string | null = null;
    let dragType: 'move' | 'resize-left' | 'resize-right' = 'move';

    store.editorElements.forEach((element, index) => {
      const trackY = index * TRACK_HEIGHT + TRACK_PADDING + 20; // Add offset for ruler
      const startX = (element.timeFrame.start / store.maxTime) * canvasSize.width;
      const elementWidth = Math.max(20, ((element.timeFrame.end - element.timeFrame.start) / store.maxTime) * canvasSize.width);

      if (y >= trackY + 5 && y <= trackY + TRACK_HEIGHT - TRACK_PADDING - 5) {
        // Check resize handles first
        if (selectedItems.includes(element.id)) {
          if (x >= startX - 4 && x <= startX + 4) {
            dragType = 'resize-left';
            clickedElement = element.id;
            return;
          } else if (x >= startX + elementWidth - 4 && x <= startX + elementWidth + 4) {
            dragType = 'resize-right';
            clickedElement = element.id;
            return;
          }
        }

        // Check main item area
        if (x >= startX && x <= startX + elementWidth) {
          clickedElement = element.id;
        }
      }
    });

    if (clickedElement) {
      if (event.ctrlKey || event.metaKey) {
        // Multi-select
        setSelectedItems(prev =>
          prev.includes(clickedElement!)
            ? prev.filter(id => id !== clickedElement)
            : [...prev, clickedElement!]
        );
      } else {
        setSelectedItems([clickedElement]);
      }

      // Set up drag state
      const element = store.editorElements.find(el => el.id === clickedElement);
      if (element) {
        setDragState({
          isDragging: true,
          dragType,
          elementId: clickedElement,
          startX: x,
          startTime: dragType === 'resize-right' ? element.timeFrame.end : element.timeFrame.start
        });
      }
    } else {
      setSelectedItems([]);
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging || !dragState.elementId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const deltaX = x - dragState.startX;
    const deltaTime = (deltaX / canvasSize.width) * store.maxTime;

    const element = store.editorElements.find(el => el.id === dragState.elementId);
    if (!element) return;

    const newTime = Math.max(0, Math.min(store.maxTime, dragState.startTime + deltaTime));

    if (dragState.dragType === 'move') {
      const duration = element.timeFrame.end - element.timeFrame.start;
      const newStart = Math.max(0, Math.min(store.maxTime - duration, newTime));
      store.updateEditorElementTimeFrame(element, {
        start: newStart,
        end: newStart + duration
      });
    } else if (dragState.dragType === 'resize-left') {
      const newStart = Math.max(0, Math.min(element.timeFrame.end - 100, newTime));
      store.updateEditorElementTimeFrame(element, {
        start: newStart
      });
    } else if (dragState.dragType === 'resize-right') {
      const newEnd = Math.max(element.timeFrame.start + 100, Math.min(store.maxTime, newTime));
      store.updateEditorElementTimeFrame(element, {
        end: newEnd
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDragState({
      isDragging: false,
      dragType: null,
      elementId: null,
      startX: 0,
      startTime: 0
    });
  };

  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mouseup', handleCanvasMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleCanvasMouseUp);
      };
    }
  }, [dragState.isDragging]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-zinc-900"
      style={{ height: '200px', minHeight: '200px' }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        className="absolute top-0 left-0 cursor-pointer border border-zinc-700"
        style={{
          background: '#18181b',
          cursor: dragState.isDragging ? 'grabbing' : 'default'
        }}
      />
    </div>
  );
});

// Main Timeline Component
export const TimeLine = observer(() => {
  const store = React.useContext(StoreContext);

  return (
    <div className="relative overflow-hidden w-full h-80 bg-background border-t border-border">
      <TimelineHeader />
      <div className="flex flex-1" style={{ height: 'calc(100% - 50px)' }}>
        <div className="relative w-10 flex-none bg-card border-r border-border"></div>
        <div className="flex-1 relative">
          <TimelineRuler />
          <SimpleTimelineItems />
          <TimelinePlayhead />
        </div>
      </div>
    </div>
  );
});
