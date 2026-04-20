import React from "react";
import { MousePointer2, Hand, Type, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

export type CanvasTool = "select" | "pan" | "addText";

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

const tools: { id: CanvasTool; icon: React.ElementType; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "选择" },
  { id: "pan", icon: Hand, label: "平移" },
  { id: "addText", icon: Type, label: "添加文本" },
];

export function CanvasToolbar({
  activeTool,
  onToolChange,
  onZoomIn,
  onZoomOut,
}: CanvasToolbarProps) {
  return (
    <div className="flex flex-col gap-1 p-1.5 rounded-xl glass border border-border/50 shadow-lg">
      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          title={label}
          onClick={() => onToolChange(id)}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150",
            id === activeTool
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      {(onZoomIn || onZoomOut) && (
        <div
          className="my-0.5 border-t border-border/50 pt-1 flex flex-col gap-1"
          role="group"
          aria-label="画布缩放"
        >
          {onZoomIn && (
            <button
              type="button"
              title="放大"
              onClick={onZoomIn}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-accent/60"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          )}
          {onZoomOut && (
            <button
              type="button"
              title="缩小"
              onClick={onZoomOut}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150 text-muted-foreground hover:text-foreground hover:bg-accent/60"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
