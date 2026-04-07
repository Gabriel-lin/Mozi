import React, { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { LayoutDensity, type LayoutOptions } from "../types";
import { computeLayout } from "../utils";

// ─── SVG Icons (inline, no external deps) ───────────────────────────────────

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

// ─── Styles ──────────────────────────────────────────────────────────────────

const navStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  padding: "4px 6px",
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  border: "1px solid #e2e8f0",
  userSelect: "none",
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: "#475569",
  cursor: "pointer",
  transition: "background 0.12s, color 0.12s",
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 20,
  background: "#e2e8f0",
  margin: "0 4px",
};

// ─── Component ───────────────────────────────────────────────────────────────

export interface WorkflowNavProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  layoutDirection?: "TB" | "LR" | "BT" | "RL";
  style?: React.CSSProperties;
  className?: string;
}

export function WorkflowNav({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  layoutDirection = "TB",
  style: outerStyle,
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

  function btn(
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled = false,
  ) {
    return (
      <button
        title={label}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        style={{
          ...btnBase,
          opacity: disabled ? 0.35 : 1,
          cursor: disabled ? "default" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!disabled) (e.currentTarget.style.background = "#f1f5f9");
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {icon}
      </button>
    );
  }

  return (
    <div style={{ ...navStyle, ...outerStyle }} className={className}>
      {btn("撤销", <IconUndo />, () => onUndo?.(), !canUndo)}
      {btn("恢复", <IconRedo />, () => onRedo?.(), !canRedo)}

      <div style={dividerStyle} />

      {btn("放大", <IconZoomIn />, () => zoomIn({ duration: 200 }))}
      {btn("缩小", <IconZoomOut />, () => zoomOut({ duration: 200 }))}
      {btn("适应画布", <IconFitView />, () => fitView({ padding: 0.2, duration: 300 }))}

      <div style={dividerStyle} />

      {btn("紧凑布局", <IconCompact />, () => handleLayout(LayoutDensity.COMPACT))}
      {btn("稀疏布局", <IconSparse />, () => handleLayout(LayoutDensity.SPARSE))}
    </div>
  );
}
