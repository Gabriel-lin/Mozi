import React from "react";
import { MousePointer2, Hand, Square, Type, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type CanvasTool = "select" | "pan" | "addNode" | "addText" | "addEdge";

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
}

const tools: { id: CanvasTool; icon: React.ElementType; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "选择" },
  { id: "pan", icon: Hand, label: "平移" },
  { id: "addNode", icon: Square, label: "添加节点" },
  { id: "addText", icon: Type, label: "添加文本" },
  { id: "addEdge", icon: Minus, label: "添加连线" },
];

export function CanvasToolbar({ activeTool, onToolChange }: CanvasToolbarProps) {
  return (
    <div className="flex flex-col gap-1 p-1.5 rounded-xl glass border border-border/50 shadow-lg">
      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
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
    </div>
  );
}
