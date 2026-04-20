import React, { memo, useCallback } from "react";
import { NodeResizer, useReactFlow, useUpdateNodeInternals, type Node } from "@xyflow/react";
import { cn } from "../utils/cn";
import { patchWorkflowRfNodePixelBounds, readWorkflowRfNodePixelBounds } from "../utils/nodeStyle";

export type WorkflowNodeMinDimensions = { minWidth: number; minHeight: number };

/** Start/end nodes: not resizable, but shell keeps a stable minimum size. */
export const TERMINAL_NODE_MIN_W = 288;
export const TERMINAL_NODE_MIN_H = 92;

/** Expanded start/end RF mins (same as resize end / default shell). */
export const TERMINAL_NODE_EXPANDED_DIMS: WorkflowNodeMinDimensions = {
  minWidth: TERMINAL_NODE_MIN_W,
  minHeight: TERMINAL_NODE_MIN_H,
};

/** Min size when the node body is visible (card mode). */
export const WORKFLOW_NODE_EXPANDED_MIN_W = 220;
export const WORKFLOW_NODE_EXPANDED_MIN_H = 96;

/** Min size in collapsed (header-only) thumbnail mode. */
export const WORKFLOW_NODE_COLLAPSED_MIN_W = 168;
export const WORKFLOW_NODE_COLLAPSED_MIN_H = 44;

export const GROUP_EXPANDED_MIN_W = 260;
export const GROUP_EXPANDED_MIN_H = 160;
export const GROUP_COLLAPSED_MIN_W = 188;
export const GROUP_COLLAPSED_MIN_H = 48;

/** Header gradient class for `GroupNode` (aligned with default `BaseNode` non-kind header). */
export const WORKFLOW_GROUP_HEADER_GRADIENT = "from-slate-500/92 to-slate-600/92";

/** Member row stack inside a collapsed workflow group (`GroupNode` + child layout). */
export const WORKFLOW_GROUP_COLLAPSED_HEADER_H = 40;
export const WORKFLOW_GROUP_COLLAPSED_ROW_H = 36;
export const WORKFLOW_GROUP_COLLAPSED_ROW_GAP = 2;
export const WORKFLOW_GROUP_COLLAPSED_H_PAD = 8;
export const WORKFLOW_GROUP_COLLAPSED_V_PAD = 6;
/** Column header strip under the group title when collapsed (table UI). */
export const WORKFLOW_GROUP_COLLAPSED_TABLE_HEAD_H = 24;

const CIRCLE_EXPANDED_MIN = 180;
const CIRCLE_COLLAPSED_MIN = 112;

export type NodeChromeVariant = "square" | "circle" | "group";

/** Same limits as `<NodeResizer minWidth/minHeight />` for CSS / clamping. */
export function getWorkflowNodeMinDimensions(
  collapsed: boolean,
  variant: NodeChromeVariant,
): WorkflowNodeMinDimensions {
  if (variant === "group") {
    return collapsed
      ? { minWidth: GROUP_COLLAPSED_MIN_W, minHeight: GROUP_COLLAPSED_MIN_H }
      : { minWidth: GROUP_EXPANDED_MIN_W, minHeight: GROUP_EXPANDED_MIN_H };
  }
  if (variant === "circle") {
    const m = collapsed ? CIRCLE_COLLAPSED_MIN : CIRCLE_EXPANDED_MIN;
    return { minWidth: m, minHeight: m };
  }
  return collapsed
    ? { minWidth: WORKFLOW_NODE_COLLAPSED_MIN_W, minHeight: WORKFLOW_NODE_COLLAPSED_MIN_H }
    : { minWidth: WORKFLOW_NODE_EXPANDED_MIN_W, minHeight: WORKFLOW_NODE_EXPANDED_MIN_H };
}

/** Restores RF size on expand after a collapse that used `applyCollapseToggleToNode`. */
const workflowCollapseExpandedBounds = new Map<string, { w: number; h: number }>();

/**
 * Toggle `data.collapsed` and RF bounds in one `updateNode` so controlled flows record a single history entry.
 * Group nodes only touch `data` (layout is handled in `GroupNode`).
 */
export function applyCollapseToggleToNode(
  node: Node,
  nextCollapsed: boolean,
  opts: { variant: NodeChromeVariant; terminal: boolean; applyBounds: boolean },
): Node {
  const data = {
    ...((node.data ?? {}) as Record<string, unknown>),
    collapsed: nextCollapsed,
  } as Node["data"];

  if (!opts.applyBounds || opts.variant === "group") {
    return { ...node, data };
  }

  const dimsExpanded = opts.terminal
    ? TERMINAL_NODE_EXPANDED_DIMS
    : getWorkflowNodeMinDimensions(false, opts.variant);
  const dimsCollapsed = getWorkflowNodeMinDimensions(true, opts.variant);
  const bounds = readWorkflowRfNodePixelBounds(node, dimsExpanded.minWidth, dimsExpanded.minHeight);

  if (nextCollapsed) {
    workflowCollapseExpandedBounds.set(node.id, { w: bounds.w, h: bounds.h });
    const w = Math.max(dimsCollapsed.minWidth, bounds.w);
    const h = dimsCollapsed.minHeight;
    return { ...node, data, ...patchWorkflowRfNodePixelBounds(node, w, h) };
  }

  const backup = workflowCollapseExpandedBounds.get(node.id);
  workflowCollapseExpandedBounds.delete(node.id);
  const w = Math.max(dimsExpanded.minWidth, backup?.w ?? bounds.w);
  const h = Math.max(dimsExpanded.minHeight, backup?.h ?? bounds.h);
  return { ...node, data, ...patchWorkflowRfNodePixelBounds(node, w, h) };
}

export const WorkflowNodeResizer = memo(function WorkflowNodeResizer({
  disabled,
  showHandles,
  collapsed,
  variant = "square",
  onResizeStart,
  onResizeEnd,
}: {
  /** When true, no resize UI (e.g. start/end nodes). */
  disabled?: boolean;
  /** Show edge handles when the node is selected or pointer is over the node shell. */
  showHandles: boolean;
  collapsed: boolean;
  variant?: NodeChromeVariant;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}) {
  if (disabled) return null;
  const { minWidth: w, minHeight: h } = getWorkflowNodeMinDimensions(collapsed, variant);
  return (
    <NodeResizer
      isVisible={showHandles}
      minWidth={w}
      minHeight={h}
      onResizeStart={onResizeStart}
      onResizeEnd={onResizeEnd}
      lineClassName="!border-indigo-400/80 !border-[1.5px]"
      handleClassName="!h-3 !w-3 !min-h-[12px] !min-w-[12px] !bg-indigo-400 !rounded-sm"
    />
  );
});

export const NodeCollapseToggle = memo(function NodeCollapseToggle({
  nodeId,
  collapsed,
  className,
  variant = "square",
  terminal = false,
  applyBounds = true,
}: {
  nodeId: string;
  collapsed: boolean;
  className?: string;
  variant?: NodeChromeVariant;
  terminal?: boolean;
  /** When false, only `data.collapsed` updates (e.g. child row inside a collapsed group). */
  applyBounds?: boolean;
}) {
  const { updateNode } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = !collapsed;
      updateNode(nodeId, (node) =>
        applyCollapseToggleToNode(node, next, { variant, terminal, applyBounds }),
      );
      queueMicrotask(() => updateNodeInternals(nodeId));
    },
    [nodeId, collapsed, updateNode, updateNodeInternals, variant, terminal, applyBounds],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? "展开" : "折叠"}
      aria-expanded={!collapsed}
      className={cn(
        "nodrag nopan absolute z-20 flex h-6 w-6 items-center justify-center rounded-md",
        "border border-white/25 bg-black/20 text-white shadow-sm backdrop-blur-sm",
        "hover:bg-black/35 active:scale-95 transition-colors",
        className,
      )}
    >
      {collapsed ? (
        <svg className="h-3 w-3" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 2l4 4-4 4" />
        </svg>
      ) : (
        <svg className="h-3 w-3" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 4l4 4 4-4" />
        </svg>
      )}
    </button>
  );
});
