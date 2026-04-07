import type { Node, Edge } from "@xyflow/react";

/** Serialize a graph (nodes + edges) to a JSON string. */
export function serializeGraph(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify({ nodes, edges });
}

/** Deserialize a JSON string back into nodes and edges, or `null` on failure. */
export function deserializeGraph(raw: string): { nodes: Node[]; edges: Edge[] } | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return parsed as { nodes: Node[]; edges: Edge[] };
    }
    return null;
  } catch {
    return null;
  }
}
