import { useNodeId, useStore, type ReactFlowState } from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";
import type { WorkflowCollapsedGroupMemberRowState } from "./types";

function selectMemberRow(
  s: ReactFlowState,
  parentId: string | undefined,
  nodeId: string | null,
): WorkflowCollapsedGroupMemberRowState {
  if (!parentId || !nodeId) return { active: false, index: 0, total: 0 };
  const p = s.nodeLookup.get(parentId);
  if (p?.type !== "group" || !p.data?.collapsed) return { active: false, index: 0, total: 0 };
  const siblings = s.nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
  const index = siblings.findIndex((n) => n.id === nodeId);
  return { active: index >= 0, index: Math.max(0, index), total: siblings.length };
}

/**
 * When a node is a child of a collapsed `group` node, members render as compact rows
 * (label + handles). This hook exposes row index for layout and `active` for switching UI.
 */
export function useCollapsedGroupMemberRow(
  parentId: string | undefined,
): WorkflowCollapsedGroupMemberRowState {
  const nodeId = useNodeId();
  return useStore(useShallow((s: ReactFlowState) => selectMemberRow(s, parentId, nodeId)));
}
