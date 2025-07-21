"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react";
import { Button } from "./ui/button";
import { Icons } from "./shared/icons";
import { cn } from "../lib/utils";
import { Store } from "@/store/Store";

export const Menu = observer(() => {
  const store = React.useContext(StoreContext);

  return (
    <div className="flex flex-col h-full p-2 gap-1">
      {MENU_OPTIONS.map((option) => {
        const isSelected = store.selectedMenuOption === option.name;
        const IconComponent = Icons[option.iconName as keyof typeof Icons];
        return (
          <Button
            key={option.name}
            onClick={() => option.action(store)}
            className={cn(
              isSelected
                ? "bg-secondary"
                : "text-muted-foreground"
            )}
            variant="ghost"
            size="icon"
            title={option.name}
          >
            {IconComponent ? <IconComponent width={20} /> : <option.icon size="20" />}
          </Button>
        );
      })}
    </div>
  );
});

const MENU_OPTIONS = [
  {
    name: "Video",
    iconName: "video",
    icon: () => <Icons.video width={20} />,
    action: (store: Store) => {
      store.setSelectedMenuOption("Video");
    },
  },
  {
    name: "Audio",
    iconName: "audio",
    icon: () => <Icons.audio width={20} />,
    action: (store: Store) => {
      store.setSelectedMenuOption("Audio");
    },
  },
  {
    name: "Image",
    iconName: "image",
    icon: () => <Icons.image width={20} />,
    action: (store: Store) => {
      store.setSelectedMenuOption("Image");
    },
  },
  {
    name: "Text",
    iconName: "type",
    icon: () => <Icons.type width={20} />,
    action: (store: Store) => {
      store.setSelectedMenuOption("Text");
    },
  },
  {
    name: "Animation",
    iconName: "animation",
    icon: () => <Icons.animation width={20} />,
    action: (store: Store) => {
      store.setSelectedMenuOption("Animation");
    },
  },
  {
    name: "Effect",
    iconName: "shapes",
    icon: () => <Icons.shapes width={20} />,
    action: (store: Store) => {
      store.setSelectedMenuOption("Effect");
    },
  },
  {
    name: "Fill",
    iconName: "palette",
    icon: () => <Icons.palette width={20} />,
    action: (store: Store) => {
      store.setSelectedMenuOption("Fill");
    },
  },
  {
    name: "Export",
    iconName: "download",
    icon: () => <Icons.download width={20} />,
    action: (store: Store) => {
      store.setSelectedMenuOption("Export");
    },
  },
];
