import type { EdgeProps } from "@xyflow/react";
import type { WorkflowViewEdgeData } from "../types";

export type WorkflowEdgeProps = EdgeProps & {
  data?: WorkflowViewEdgeData;
};
