// ─── Nodes ───────────────────────────────────────────────────────────────────
export { BaseNode, TextNode, GroupNode, applyCollapseToggleToNode } from "./nodes";
export type {
  BaseNodeProps,
  TextNodeProps,
  GroupNodeData,
  GroupNodeProps,
  WorkflowGroupCollapsedChildSnapshot,
  WorkflowGroupCollapsedLayoutBackup,
} from "./nodes";

// ─── Edges ───────────────────────────────────────────────────────────────────
export {
  DirectionalEdge,
  BidirectionalEdge,
  SelfLoopEdge,
  EdgeMarkerDefs,
  EdgeLabelRenderer,
} from "./edges";
export type { WorkflowEdgeProps } from "./edges";

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useHistory, useContextMenu, useWorkflowNodeResize, useCollapsedGroupMemberRow } from "./hooks";
export type {
  UseHistoryOptions,
  UseHistoryReturn,
  UseContextMenuOptions,
  UseContextMenuReturn,
  UseWorkflowNodeResizeOptions,
  UseWorkflowNodeResizeReturn,
  WorkflowCollapsedGroupMemberRowState,
} from "./hooks";
export type { WorkflowNodeMinDimensions, NodeChromeVariant } from "./nodes";
export { TERMINAL_NODE_MIN_W, TERMINAL_NODE_MIN_H, TERMINAL_NODE_EXPANDED_DIMS } from "./nodes";

// ─── Plugins ─────────────────────────────────────────────────────────────────
export { createPluginRegistry, PluginRenderer } from "./plugins";
export type { PluginRegistry, PluginSlotProps } from "./plugins";

// ─── Nav ─────────────────────────────────────────────────────────────────────
export { WorkflowNav, WorkflowMiniMap } from "./nav";
export type { WorkflowNavProps, WorkflowMiniMapProps } from "./nav";

// ─── Utils ───────────────────────────────────────────────────────────────────
export {
  generateId,
  parseCssSize,
  stripWorkflowNodeSizingStyle,
  mergeWorkflowNodeStyleForGroupExpand,
  distance,
  midpoint,
  clamp,
  quadraticControlPoint,
  selfLoopPath,
  computeLayout,
  computeForceLayout,
  serializeGraph,
  deserializeGraph,
} from "./utils";

// re-export arrow path helpers for custom marker construction
export {
  arrowTrianglePath,
  arrowTriangleFilledPath,
  arrowDiamondPath,
  arrowCirclePath,
} from "./utils";

// ─── Types (enums) ───────────────────────────────────────────────────────────
export {
  ViewNodeShape,
  ViewEdgeType,
  EdgePathType,
  ArrowShape,
  LayoutDensity,
} from "./types";

// ─── Types (interfaces / type aliases) ───────────────────────────────────────
export type {
  HandleConfig,
  WorkflowViewNodeData,
  TextNodeData,
  WorkflowViewNode,
  TextViewNode,
  AnyViewNode,
  ArrowConfig,
  EdgeLabelConfig,
  WorkflowViewEdgeData,
  WorkflowViewEdge,
  LayoutOptions,
  HistoryEntry,
  HistoryEntryMeta,
  HistoryOperation,
  HistoryState,
  ViewPlugin,
  ContextMenuItem,
  ContextMenuState,
} from "./types";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────
export {
  viewNodeShapeSchema,
  handleConfigSchema,
  workflowViewNodeDataSchema,
  textNodeDataSchema,
  viewEdgeTypeSchema,
  edgePathTypeSchema,
  arrowShapeSchema,
  arrowConfigSchema,
  edgeLabelConfigSchema,
  workflowViewEdgeDataSchema,
  layoutDensitySchema,
  layoutOptionsSchema,
  historyEntrySchema,
  viewPluginSchema,
} from "./types";

// ─── Node / Edge type maps (for ReactFlow registration) ─────────────────────
import { BaseNode as _BaseNode } from "./nodes";
import { TextNode as _TextNode } from "./nodes";
import { GroupNode as _GroupNode } from "./nodes";
import { DirectionalEdge as _DirectionalEdge } from "./edges";
import { BidirectionalEdge as _BidirectionalEdge } from "./edges";
import { SelfLoopEdge as _SelfLoopEdge } from "./edges";

export const workflowNodeTypes = {
  workflowBase: _BaseNode,
  workflowText: _TextNode,
  group: _GroupNode,
} as const;

export const workflowEdgeTypes = {
  directional: _DirectionalEdge,
  bidirectional: _BidirectionalEdge,
  selfLoop: _SelfLoopEdge,
} as const;
