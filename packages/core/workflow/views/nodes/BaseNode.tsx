import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { ViewNodeShape } from "../types";
import type { BaseNodeProps } from "./types";
import { cn } from "../utils/cn";
import { renderNodeHandles } from "./renderNodeHandles";

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

export const BaseNode = memo(function BaseNode({ data, selected }: BaseNodeProps) {
  const shape = data.shape ?? ViewNodeShape.SQUARE;
  const isCircle = shape === ViewNodeShape.CIRCLE;
  const nodeKind = (data as Record<string, unknown>).nodeKind as string | undefined;
  const kind = nodeKind && HEADER_GRADIENT[nodeKind] ? nodeKind : "default";
  const icon = nodeKind ? HEADER_ICON[nodeKind] : undefined;
  const runError = (data as Record<string, unknown>)._runError as string | undefined;

  const [showError, setShowError] = useState(false);
  const toggleError = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowError((v) => !v);
  }, []);
  const closeError = useCallback(() => setShowError(false), []);

  return (
    <div
      className={cn(
        "relative overflow-visible bg-background/80 backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow,transform] duration-200",
        isCircle
          ? "min-w-[140px] min-h-[140px] rounded-full aspect-square flex flex-col justify-center items-center"
          : "inline-flex flex-col w-max min-w-[160px] max-w-[420px] rounded-xl",
        selected
          ? cn("ring-2", ACCENT_BORDER[kind], "border-transparent shadow-[0_10px_28px_rgba(0,0,0,0.12)]")
          : "border border-border/70 shadow-[0_10px_26px_rgba(0,0,0,0.10)]",
        !selected && "hover:shadow-[0_14px_34px_rgba(0,0,0,0.14)] hover:-translate-y-[1px]",
        runError && "!border-red-500 ring-2 ring-red-500/20",
        data.className,
      )}
    >
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
          "flex items-center gap-1.5 select-none bg-gradient-to-br text-white overflow-hidden",
          isCircle ? "px-2.5 py-2 rounded-full" : "px-3.5 py-2 rounded-t-[12px]",
          HEADER_GRADIENT[kind],
          data.headerClassName,
        )}
      >
        {icon && <span className="text-xs leading-none">{icon}</span>}
        <span
          className={cn(
            "text-xs font-semibold tracking-wide flex-1 truncate",
            isCircle && "text-center",
          )}
        >
          {data.label}
        </span>
      </div>

      {/* Body: fixed vertical band; width follows content (clamped by node max-w) */}
      {!isCircle && (
        <div
          className={cn(
            "px-3.5 py-2.5 text-[11px] text-muted-foreground/90 bg-muted/25 min-h-[50px] max-h-[150px] min-w-0 overflow-y-auto overflow-x-hidden break-words shrink-0",
            data.contentClassName,
          )}
        >
          {data.content}
        </div>
      )}

      {/* Footer spacer */}
      {!isCircle && (
        <div className={cn("min-h-1.5", data.footerClassName)} />
      )}

      {renderNodeHandles(data.outputs, "source")}
    </div>
  );
});
