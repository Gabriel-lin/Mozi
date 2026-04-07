import React from "react";
import { MiniMap } from "@xyflow/react";

export interface WorkflowMiniMapProps {
  style?: React.CSSProperties;
  className?: string;
}

export function WorkflowMiniMap({ style, className }: WorkflowMiniMapProps) {
  return (
    <MiniMap
      pannable
      zoomable
      nodeColor={(node) => {
        if (node.type === "workflowText") return "#818cf8";
        return "#60a5fa";
      }}
      maskColor="rgba(0,0,0,0.12)"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        ...style,
      }}
      className={className}
    />
  );
}
