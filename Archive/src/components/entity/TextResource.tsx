"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react";
import { MdAdd } from "react-icons/md";

type TextResourceProps = {
  fontSize: number;
  fontWeight: number;
  sampleText: string;
};
export const TextResource = observer(
  ({ fontSize, fontWeight, sampleText }: TextResourceProps) => {
    const store = React.useContext(StoreContext);
    return (
      <div className="flex items-center justify-between p-3 hover:bg-accent rounded-lg cursor-pointer group">
        <div
          className="flex-1 text-foreground"
          style={{
            fontSize: `${Math.min(fontSize, 18)}px`,
            fontWeight: `${fontWeight}`,
          }}
        >
          {sampleText}
        </div>
        <button
          className="h-8 w-8 hover:bg-primary hover:text-primary-foreground bg-secondary text-secondary-foreground rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() =>
            store.addText({
              text: sampleText,
              fontSize: fontSize,
              fontWeight: fontWeight,
            })
          }
        >
          <MdAdd size="18" />
        </button>
      </div>
    );
  }
);
