import React from "react";
import { MiniMap } from "@xyflow/react";
import { cn } from "../utils/cn";

export interface WorkflowMiniMapProps {
  className?: string;
}

export function WorkflowMiniMap({ className }: WorkflowMiniMapProps) {
  return (
    <MiniMap
      pannable
      zoomable
      nodeColor={(node) => {
        if (node.type === "workflowText") return "#818cf8";
        return "#60a5fa";
      }}
      maskColor="rgba(0,0,0,0.12)"
      className={cn(
        "!relative !w-full !h-full !border-none !rounded-lg !bg-white/[0.03]",
        className,
      )}
    />
  );
}
