import React, { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { LayoutDensity, type LayoutOptions } from "../types";
import { computeLayout } from "../utils";
import { cn } from "../utils/cn";

const IconUndo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const IconRedo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconZoomIn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const IconZoomOut = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const IconFitView = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

const IconCompact = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IconSparse = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="9" height="9" />
    <rect x="14" y="1" width="9" height="9" />
    <rect x="1" y="14" width="9" height="9" />
    <rect x="14" y="14" width="9" height="9" />
  </svg>
);

export interface WorkflowNavProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  layoutDirection?: "TB" | "LR" | "BT" | "RL";
  className?: string;
}

export function WorkflowNav({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  layoutDirection = "TB",
  className,
}: WorkflowNavProps) {
  const { zoomIn, zoomOut, fitView, getNodes, getEdges, setNodes } = useReactFlow();

  const handleLayout = useCallback(
    (density: LayoutDensity) => {
      const nodes = getNodes();
      const edges = getEdges();
      const opts: LayoutOptions = { density, direction: layoutDirection };
      const laid = computeLayout(nodes, edges, opts);
      setNodes(laid);
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
    },
    [getNodes, getEdges, setNodes, fitView, layoutDirection],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 px-1.5 py-1 bg-background rounded-lg shadow-sm border border-border select-none",
        className,
      )}
    >
      <NavButton label="撤销" icon={<IconUndo />} onClick={() => onUndo?.()} disabled={!canUndo} />
      <NavButton label="恢复" icon={<IconRedo />} onClick={() => onRedo?.()} disabled={!canRedo} />

      <div className="w-px h-5 bg-border mx-1" />

      <NavButton label="放大" icon={<IconZoomIn />} onClick={() => zoomIn({ duration: 200 })} />
      <NavButton label="缩小" icon={<IconZoomOut />} onClick={() => zoomOut({ duration: 200 })} />
      <NavButton label="适应画布" icon={<IconFitView />} onClick={() => fitView({ padding: 0.2, duration: 300 })} />

      <div className="w-px h-5 bg-border mx-1" />

      <NavButton label="紧凑布局" icon={<IconCompact />} onClick={() => handleLayout(LayoutDensity.COMPACT)} />
      <NavButton label="稀疏布局" icon={<IconSparse />} onClick={() => handleLayout(LayoutDensity.SPARSE)} />
    </div>
  );
}

function NavButton({
  label,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center w-[30px] h-[30px] rounded-md bg-transparent text-slate-600 transition-colors duration-100",
        disabled
          ? "opacity-35 cursor-default"
          : "cursor-pointer hover:bg-slate-100",
      )}
    >
      {icon}
    </button>
  );
}
