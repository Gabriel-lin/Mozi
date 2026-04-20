import type { Node, Edge } from "@xyflow/react";
import { AgentConfigForm } from "../AgentConfigForm";
import { EdgeConfigForm } from "../EdgeConfigForm";
import { LLMConfigForm } from "../LLMConfigForm";
import { NodeConfigForm } from "../NodeConfigForm";

export interface ConfigTabPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  nodes: Node[];
  /** Bumps when undo/redo runs so config forms remount from graph state. */
  historyCursor: number;
  onPreviewNode: (id: string, updates: Record<string, unknown>) => void;
  onPreviewEdge: (id: string, updates: Record<string, unknown>) => void;
  onConfirm: () => void;
}

/**
 * Dispatcher for the "配置" tab. Picks the correct form for the current
 * selection (LLM / Agent / base node / edge). All forms are keyed by
 * `${id}-${historyCursor}` so they remount after undo/redo and pull fresh
 * values from the graph.
 */
export function ConfigTabPanel({
  selectedNode,
  selectedEdge,
  nodes,
  historyCursor,
  onPreviewNode,
  onPreviewEdge,
  onConfirm,
}: ConfigTabPanelProps) {
  if (selectedNode) {
    const kind = (selectedNode.data as Record<string, unknown>)?.nodeKind;
    if (kind === "llm") {
      return (
        <LLMConfigForm
          key={`${selectedNode.id}-${historyCursor}`}
          node={selectedNode}
          onPreview={onPreviewNode}
          onConfirm={onConfirm}
        />
      );
    }
    if (kind === "agent") {
      return (
        <AgentConfigForm
          key={`${selectedNode.id}-${historyCursor}`}
          node={selectedNode}
          nodes={nodes}
          onPreview={onPreviewNode}
          onConfirm={onConfirm}
        />
      );
    }
    return (
      <NodeConfigForm
        key={`${selectedNode.id}-${historyCursor}`}
        node={selectedNode}
        onPreview={onPreviewNode}
        onConfirm={onConfirm}
      />
    );
  }

  if (selectedEdge) {
    return (
      <EdgeConfigForm
        key={`${selectedEdge.id}-${historyCursor}`}
        edge={selectedEdge}
        nodes={nodes}
        onPreview={onPreviewEdge}
        onConfirm={onConfirm}
      />
    );
  }

  return null;
}
