"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react";
import { ExportVideoPanel } from "./panels/ExportVideoPanel";
import { AnimationsPanel } from "./panels/AnimationsPanel";
import { AudioResourcesPanel } from "./panels/AudioResourcesPanel";
import { FillPanel } from "./panels/FillPanel";
import { ImageResourcesPanel } from "./panels/ImageResourcesPanel";
import { TextResourcesPanel } from "./panels/TextResourcesPanel";
import { VideoResourcesPanel } from "./panels/VideoResourcesPanel";
import { EffectsPanel } from "./panels/EffectsPanel";

export const Resources = observer(() => {
  const store = React.useContext(StoreContext);
  const selectedMenuOption = store.selectedMenuOption;
  return (
    <div className="h-full bg-background p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{selectedMenuOption}</h2>
        <p className="text-sm text-muted-foreground">
          {getMenuDescription(selectedMenuOption)}
        </p>
      </div>
      <div className="h-full overflow-y-auto">
        {selectedMenuOption === "Video" ? <VideoResourcesPanel /> : null}
        {selectedMenuOption === "Audio" ? <AudioResourcesPanel /> : null}
        {selectedMenuOption === "Image" ? <ImageResourcesPanel /> : null}
        {selectedMenuOption === "Text" ? <TextResourcesPanel /> : null}
        {selectedMenuOption === "Animation" ? <AnimationsPanel /> : null}
        {selectedMenuOption === "Effect" ? <EffectsPanel /> : null}
        {selectedMenuOption === "Export" ? <ExportVideoPanel /> : null}
        {selectedMenuOption === "Fill" ? <FillPanel /> : null}
      </div>
    </div>
  );
});

const getMenuDescription = (menuOption: string) => {
  const descriptions: Record<string, string> = {
    Video: "Add video clips to your timeline",
    Audio: "Add audio tracks and sound effects",
    Image: "Add images and graphics",
    Text: "Add text elements and titles",
    Animation: "Apply animations and transitions",
    Effect: "Add visual effects and filters",
    Export: "Export your video project",
    Fill: "Customize colors and backgrounds"
  };
  return descriptions[menuOption] || "Select an option from the menu";
};
