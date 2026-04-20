import React, { memo, useRef } from "react";
import { ViewNodeShape } from "../types";
import type { TextNodeProps } from "./types";
import { cn } from "../utils/cn";
import { renderNodeHandles, renderNodeHandlesRow } from "./renderNodeHandles";
import { NodeCollapseToggle, WorkflowNodeResizer } from "./nodeChrome";
import { EditableNodeLabel } from "./EditableNodeLabel";
import { useWorkflowNodeResize, useCollapsedGroupMemberRow } from "../hooks";

export const TextNode = memo(function TextNode({ id, data, selected, parentId }: TextNodeProps) {
  const shape = data.shape ?? ViewNodeShape.SQUARE;
  const isCircle = shape === ViewNodeShape.CIRCLE;
  const collapsed = Boolean(data.collapsed);
  const { active: inCollapsedGroupRow } = useCollapsedGroupMemberRow(parentId);
  const shellRef = useRef<HTMLDivElement>(null);
  const resize = useWorkflowNodeResize(shellRef, {
    disabled: inCollapsedGroupRow,
    selected,
    collapsed: collapsed || inCollapsedGroupRow,
    variant: isCircle ? "circle" : "square",
  });

  if (inCollapsedGroupRow) {
    return (
      <div
        ref={shellRef}
        style={resize.shellStyle}
        className="relative box-border min-h-0 h-full w-full min-w-0"
        {...resize.shellPointerHandlers}
      >
        <WorkflowNodeResizer
          disabled={inCollapsedGroupRow}
          showHandles={resize.showHandles}
          collapsed
          variant="square"
          onResizeStart={resize.resizerHandlers.onResizeStart}
          onResizeEnd={resize.resizerHandlers.onResizeEnd}
        />
        <div
          className={cn(
            "relative table h-full max-h-full min-h-0 w-full min-w-0 table-fixed border-separate border-spacing-0 overflow-hidden rounded-lg border bg-background/95 backdrop-blur-sm transition-[border-color,box-shadow] duration-200",
            selected
              ? "border-transparent shadow-md ring-2 ring-indigo-400/25"
              : "border-border/60 shadow-sm",
            data.className,
          )}
        >
          <div className="table-row">
            <div className="table-cell align-middle border-r border-border/30 p-0">
              <div className="flex min-h-0 min-w-0 items-center gap-1 px-1.5 py-0.5">
                <div className="relative h-full min-h-[28px] w-5 shrink-0">
                  {renderNodeHandlesRow(data.inputs, "target")}
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 items-center gap-1">
                  <span className="shrink-0 text-[10px] leading-none opacity-90">📝</span>
                  <EditableNodeLabel
                    nodeId={id}
                    value={String(data.text ?? "")}
                    dataField="text"
                    fallback="文本"
                    tone="onCard"
                    className="min-w-0 truncate text-[11px] font-semibold text-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="table-cell w-10 align-middle p-0">
              <div className="relative h-full min-h-[28px] w-full">
                {renderNodeHandlesRow(data.outputs, "source")}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      style={resize.shellStyle}
      className="relative box-border min-h-0 h-full w-full min-w-0"
      {...resize.shellPointerHandlers}
    >
      <WorkflowNodeResizer
        showHandles={resize.showHandles}
        collapsed={collapsed}
        variant={isCircle ? "circle" : "square"}
        onResizeStart={resize.resizerHandlers.onResizeStart}
        onResizeEnd={resize.resizerHandlers.onResizeEnd}
      />
      <div
        className={cn(
          "relative overflow-hidden bg-background/80 backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow] duration-200 select-none",
          isCircle
            ? "flex aspect-square min-h-0 w-full min-w-0 flex-col items-center justify-center rounded-full"
            : "flex min-h-0 w-full min-w-0 flex-col rounded-xl",
          selected
            ? "border-transparent ring-2 ring-indigo-400/25 shadow-[0_10px_28px_rgba(0,0,0,0.12)]"
            : "border border-border/70 shadow-[0_10px_26px_rgba(0,0,0,0.10)]",
          !selected && "hover:shadow-[0_14px_34px_rgba(0,0,0,0.14)]",
          data.className,
        )}
      >
        <NodeCollapseToggle
          nodeId={id}
          collapsed={collapsed}
          className={isCircle ? "left-2 top-2" : "left-1.5 top-1.5"}
          variant={isCircle ? "circle" : "square"}
          applyBounds={!inCollapsedGroupRow}
        />
        {renderNodeHandles(data.inputs, "target")}

        {/* Header */}
        <div
          className={cn(
            "flex w-full min-w-0 shrink-0 items-center gap-1.5 bg-gradient-to-br from-indigo-500/92 to-indigo-600/92 py-2 text-white",
            isCircle ? "rounded-full px-2.5" : cn("px-3.5 pl-9", collapsed ? "rounded-xl" : "rounded-t-[12px]"),
          )}
        >
          <span className="text-[11px] leading-none">📝</span>
          <EditableNodeLabel
            nodeId={id}
            value={String(data.text ?? "")}
            dataField="text"
            fallback="文本"
            tone="onCard"
            className="text-xs font-semibold tracking-wide flex-1 truncate"
          />
        </div>

        {/* Body */}
        {!isCircle && !collapsed && (
          <div className="box-border w-full min-w-0 flex-1 min-h-[48px] px-3.5 py-2.5 text-xs text-muted-foreground/90 leading-relaxed break-words bg-muted/25 overflow-y-auto overflow-x-hidden">
            {data.text}
          </div>
        )}

        {renderNodeHandles(data.outputs, "source")}
      </div>
    </div>
  );
});
