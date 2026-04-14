import React, { memo } from "react";
import { ViewNodeShape } from "../types";
import type { TextNodeProps } from "./types";
import { cn } from "../utils/cn";
import { renderNodeHandles } from "./renderNodeHandles";

export const TextNode = memo(function TextNode({ data, selected }: TextNodeProps) {
  const shape = data.shape ?? ViewNodeShape.SQUARE;
  const isCircle = shape === ViewNodeShape.CIRCLE;
  const label = data.text || "文本";

  return (
    <div
      className={cn(
        "overflow-hidden bg-background/80 backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow,transform] duration-200 select-none",
        isCircle
          ? "flex flex-col min-w-[100px] min-h-[100px] rounded-full aspect-square items-center justify-center"
          : "inline-flex flex-col w-max min-w-[160px] max-w-[420px] rounded-xl",
        selected
          ? "border-transparent ring-2 ring-indigo-400/25 shadow-[0_10px_28px_rgba(0,0,0,0.12)]"
          : "border border-border/70 shadow-[0_10px_26px_rgba(0,0,0,0.10)]",
        !selected && "hover:shadow-[0_14px_34px_rgba(0,0,0,0.14)] hover:-translate-y-[1px]",
        data.className,
      )}
    >
      {renderNodeHandles(data.inputs, "target")}

      {/* Header */}
      <div className="flex items-center gap-1.5 bg-gradient-to-br from-indigo-500/92 to-indigo-600/92 px-3.5 py-2 text-white rounded-t-[12px]">
        <span className="text-[11px] leading-none">📝</span>
        <span className="text-xs font-semibold tracking-wide flex-1 truncate">
          {label}
        </span>
      </div>

      {/* Body */}
      {!isCircle && (
        <div className="px-3.5 py-2.5 text-xs text-muted-foreground/90 leading-relaxed break-words bg-muted/25 min-h-[50px] max-h-[150px] min-w-0 overflow-y-auto overflow-x-hidden shrink-0">
          {data.text}
        </div>
      )}

      {renderNodeHandles(data.outputs, "source")}
    </div>
  );
});
