"use client";

import { fabric } from "fabric";
import React, { useEffect, useState } from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react";
import { Resources } from "./Resources";
import { ElementsPanel } from "./panels/ElementsPanel";
import { Menu } from "./Menu";
import { TimeLine } from "./TimeLine";
import { Store } from "@/store/Store";
import Navbar from "./Navbar";
import "@/utils/fabric-utils";

export const EditorWithStore = () => {
  const [store] = useState(new Store());
  return (
    <StoreContext.Provider value={store}>
      <Editor></Editor>
    </StoreContext.Provider>
  );
}

export const Editor = observer(() => {
  const store = React.useContext(StoreContext);

  useEffect(() => {
    const canvas = new fabric.Canvas("canvas", {
      height: 500,
      width: 800,
      backgroundColor: "#1a1a1a",
    });
    fabric.Object.prototype.transparentCorners = false;
    fabric.Object.prototype.cornerColor = "hsl(var(--primary))";
    fabric.Object.prototype.cornerStyle = "circle";
    fabric.Object.prototype.cornerStrokeColor = "hsl(var(--primary))";
    fabric.Object.prototype.cornerSize = 10;
    // canvas mouse down without target should deselect active object
    canvas.on("mouse:down", function (e) {
      if (!e.target) {
        store.setSelectedElement(null);
      }
    });

    store.setCanvas(canvas);
    fabric.util.requestAnimFrame(function render() {
      canvas.renderAll();
      fabric.util.requestAnimFrame(render);
    });

    // Add some sample timeline items for testing
    setTimeout(() => {
      if (store.editorElements.length === 0) {
        // Add sample text items
        store.addText({
          text: "Sample Title",
          fontSize: 28,
          fontWeight: 600,
        });

        store.addText({
          text: "Sample Subtitle",
          fontSize: 16,
          fontWeight: 400,
        });

        // Manually add some other sample items to test different types
        const sampleVideoElement = {
          id: "sample-video-1",
          name: "Sample Video (5s)",
          type: "video" as const,
          placement: {
            x: 100,
            y: 100,
            width: 200,
            height: 150,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          timeFrame: {
            start: 5000, // 5 seconds
            end: 10000,  // 10 seconds (5s duration)
          },
          properties: {
            elementId: "sample-video-element",
            src: "",
            duration: 5, // 5 seconds max duration
            effect: {
              type: "none" as const,
            },
          },
        };

        const sampleAudioElement = {
          id: "sample-audio-1",
          name: "Sample Audio (8s)",
          type: "audio" as const,
          placement: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          timeFrame: {
            start: 0,
            end: 8000, // 8 seconds (full duration)
          },
          properties: {
            elementId: "sample-audio-element",
            src: "",
            duration: 8, // 8 seconds max duration
          },
        };

        const sampleImageElement = {
          id: "sample-image-1",
          name: "Sample Image",
          type: "image" as const,
          placement: {
            x: 300,
            y: 200,
            width: 150,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          timeFrame: {
            start: 10000, // 10 seconds
            end: 25000,   // 25 seconds
          },
          properties: {
            elementId: "sample-image-element",
            src: "",
            effect: {
              type: "none" as const,
            },
          },
        };

        // Add the sample elements
        store.addEditorElement(sampleVideoElement);
        store.addEditorElement(sampleAudioElement);
        store.addEditorElement(sampleImageElement);
      }
    }, 1000);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col relative bg-background">
      <Navbar />
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          flex: 1,
          overflow: "hidden"
        }}
      >
        <div className="grid grid-rows-[1fr] grid-cols-[72px_300px_1fr_250px] h-full">
          <div className="flex flex-col bg-card border-r border-border">
            <Menu />
          </div>
          <div className="flex flex-col overflow-scroll bg-card border-r border-border">
            <Resources />
          </div>
          <div id="grid-canvas-container" className="bg-muted flex justify-center items-center">
            <div className="player-container">
              <canvas id="canvas" className="h-[500px] w-[800px] rounded-lg shadow-lg" />
            </div>
          </div>
          <div className="bg-card border-l border-border">
            <ElementsPanel />
          </div>
        </div>
      </div>
      <div className="h-80 w-full border-t border-border bg-card">
        <TimeLine />
      </div>
    </div>
  );
});
