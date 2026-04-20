import type { CSSProperties } from "react";
import type { NodeProps, XYPosition } from "@xyflow/react";
import type { WorkflowViewNodeData, TextNodeData } from "../types";

export type BaseNodeProps = NodeProps & {
  data: WorkflowViewNodeData;
};

export type TextNodeProps = NodeProps & {
  data: TextNodeData;
};

/** `GroupNode` React Flow payload. */
export interface GroupNodeData {
  label?: string;
  collapsed?: boolean;
  color?: string;
  [key: string]: unknown;
}

export type GroupNodeProps = NodeProps & { data: GroupNodeData };

/** One child snapshot before collapsing a workflow group (position + inline `style`). */
export type WorkflowGroupCollapsedChildSnapshot = {
  position: XYPosition;
  style?: CSSProperties;
};

/** In-memory backup while a workflow group is collapsed; restored on expand. */
export type WorkflowGroupCollapsedLayoutBackup = {
  groupStyle?: CSSProperties;
  children: Map<string, WorkflowGroupCollapsedChildSnapshot>;
};
