import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { ViewNodeShape } from "../types";
import type { BaseNodeProps } from "./types";
import { cn } from "../utils/cn";
import { renderNodeHandles, renderNodeHandlesRow } from "./renderNodeHandles";
import { NodeCollapseToggle, WorkflowNodeResizer } from "./nodeChrome";
import { EditableNodeLabel } from "./EditableNodeLabel";
import { useWorkflowNodeResize, useCollapsedGroupMemberRow } from "../hooks";

/** Error popover shown when the error badge is clicked. */
function ErrorPopover({ message, onClose }: { message: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/80 shadow-lg p-2.5 animate-in fade-in-0 zoom-in-95 duration-100"
    >
      <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300 break-words whitespace-pre-wrap">
        {message}
      </p>
    </div>
  );
}

const HEADER_GRADIENT: Record<string, string> = {
  start: "from-green-500/92 to-green-600/92",
  end: "from-rose-500/92 to-red-600/92",
  llm: "from-blue-500/92 to-indigo-500/92",
  agent: "from-purple-500/92 to-violet-600/92",
  default: "from-slate-500/92 to-slate-600/92",
};

const ACCENT_BORDER: Record<string, string> = {
  start: "border-green-500 ring-green-500/20",
  end: "border-red-500 ring-red-500/20",
  llm: "border-blue-500 ring-blue-500/20",
  agent: "border-purple-500 ring-purple-500/20",
  default: "border-slate-400 ring-slate-400/20",
};

const HEADER_ICON: Record<string, string> = {
  start: "▶",
  end: "■",
  llm: "🧠",
  agent: "🤖",
};

export const BaseNode = memo(function BaseNode({ id, data, selected, parentId }: BaseNodeProps) {
  const shape = data.shape ?? ViewNodeShape.SQUARE;
  const isCircle = shape === ViewNodeShape.CIRCLE;
  const collapsed = Boolean(data.collapsed);
  const { active: inCollapsedGroupRow } = useCollapsedGroupMemberRow(parentId);
  const nodeKind = (data as Record<string, unknown>).nodeKind as string | undefined;
  const kind = nodeKind && HEADER_GRADIENT[nodeKind] ? nodeKind : "default";
  const icon = nodeKind ? HEADER_ICON[nodeKind] : undefined;
  const runError = (data as Record<string, unknown>)._runError as string | undefined;

  const shellRef = useRef<HTMLDivElement>(null);
  const [showError, setShowError] = useState(false);
  const isTerminal = nodeKind === "start" || nodeKind === "end";
  const labelFallback =
    nodeKind === "start" ? "起始节点" : nodeKind === "end" ? "结束节点" : "基础节点";
  const resize = useWorkflowNodeResize(shellRef, {
    disabled: isTerminal || inCollapsedGroupRow,
    terminal: isTerminal,
    selected,
    collapsed: collapsed || inCollapsedGroupRow,
    variant: isCircle ? "circle" : "square",
  });
  const toggleError = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowError((v) => !v);
  }, []);
  const closeError = useCallback(() => setShowError(false), []);

  if (inCollapsedGroupRow) {
    return (
      <div
        ref={shellRef}
        style={resize.shellStyle}
        className="relative box-border min-h-0 h-full w-full min-w-0"
        {...resize.shellPointerHandlers}
      >
        <WorkflowNodeResizer
          disabled={isTerminal || inCollapsedGroupRow}
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
              ? cn("ring-2", ACCENT_BORDER[kind], "border-transparent shadow-md")
              : "border-border/60 shadow-sm",
            runError && "!border-red-500 ring-2 ring-red-500/20",
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
                  {icon && <span className="shrink-0 text-[10px] leading-none opacity-90">{icon}</span>}
                  <EditableNodeLabel
                    nodeId={id}
                    value={String(data.label ?? "")}
                    dataField="label"
                    fallback={labelFallback}
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
          {runError && (
            <div className="absolute -right-1 -top-1 z-10">
              <button
                type="button"
                onClick={toggleError}
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full",
                  "bg-red-500 text-[9px] font-bold text-white shadow hover:bg-red-600",
                )}
                title="查看错误"
              >
                !
              </button>
              {showError && <ErrorPopover message={runError} onClose={closeError} />}
            </div>
          )}
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
        disabled={isTerminal}
        showHandles={resize.showHandles}
        collapsed={collapsed}
        variant={isCircle ? "circle" : "square"}
        onResizeStart={resize.resizerHandlers.onResizeStart}
        onResizeEnd={resize.resizerHandlers.onResizeEnd}
      />
      <div
        className={cn(
          "relative bg-background/80 backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow] duration-200",
          isCircle
            ? "flex aspect-square min-h-0 w-full min-w-0 flex-col items-center justify-center rounded-full"
            : "flex h-full min-h-0 w-full min-w-0 flex-col rounded-xl",
          selected
            ? cn("ring-2", ACCENT_BORDER[kind], "border-transparent shadow-[0_10px_28px_rgba(0,0,0,0.12)]")
            : "border border-border/70 shadow-[0_10px_26px_rgba(0,0,0,0.10)]",
          !selected && "hover:shadow-[0_14px_34px_rgba(0,0,0,0.14)]",
          runError && "!border-red-500 ring-2 ring-red-500/20",
          data.className,
        )}
      >
        <NodeCollapseToggle
          nodeId={id}
          collapsed={collapsed}
          className={isCircle ? "left-2 top-2" : "left-1.5 top-1.5"}
          variant={isCircle ? "circle" : "square"}
          terminal={isTerminal}
          applyBounds={!inCollapsedGroupRow}
        />
        {renderNodeHandles(data.inputs, "target")}

      {/* Error badge */}
      {runError && (
        <div className="absolute -top-2 -right-2 z-10">
          <button
            type="button"
            onClick={toggleError}
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded-full",
              "bg-red-500 text-white text-[10px] font-bold",
              "shadow-md hover:bg-red-600 transition-colors",
              "animate-in zoom-in-50 duration-200",
            )}
            title="查看错误"
          >
            !
          </button>
          {showError && <ErrorPopover message={runError} onClose={closeError} />}
        </div>
      )}

      {/* Header */}
      <div
        className={cn(
          "flex w-full min-w-0 shrink-0 items-center gap-1.5 select-none bg-gradient-to-br text-white overflow-hidden py-2",
          isCircle
            ? "rounded-full px-2.5"
            : cn("px-3.5 pl-9", collapsed ? "rounded-xl" : "rounded-t-[12px]"),
          HEADER_GRADIENT[kind],
          data.headerClassName,
        )}
      >
        {icon && <span className="text-xs leading-none">{icon}</span>}
        <EditableNodeLabel
          nodeId={id}
          value={String(data.label ?? "")}
          dataField="label"
          fallback={labelFallback}
          className={cn(
            "text-xs font-semibold tracking-wide flex-1 truncate",
            isCircle && "text-center",
          )}
        />
      </div>

      {/* Body (card mode only) */}
      {!isCircle && !collapsed && (
        <div
          className={cn(
            "box-border w-full min-w-0 flex-1 min-h-[48px] px-3.5 py-2.5 text-[11px] text-muted-foreground/90 bg-muted/25 overflow-y-auto overflow-x-hidden break-words",
            data.contentClassName,
          )}
        >
          {data.content}
        </div>
      )}

      {/* Footer spacer */}
      {!isCircle && !collapsed && (
        <div className={cn("min-h-1.5 shrink-0", data.footerClassName)} />
      )}

      {renderNodeHandles(data.outputs, "source")}
      </div>
    </div>
  );
});
