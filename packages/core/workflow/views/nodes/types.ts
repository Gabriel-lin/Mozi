import type { NodeProps } from "@xyflow/react";
import type { WorkflowViewNodeData, TextNodeData } from "../types";

export type BaseNodeProps = NodeProps & {
  data: WorkflowViewNodeData;
};

export type TextNodeProps = NodeProps & {
  data: TextNodeData;
};
