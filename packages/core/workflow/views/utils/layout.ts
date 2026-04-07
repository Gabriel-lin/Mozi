import type { Node, Edge, XYPosition } from "@xyflow/react";
import { LayoutDensity, type LayoutOptions } from "../types/layout";

const COMPACT_SPACING = { x: 180, y: 100 };
const SPARSE_SPACING = { x: 300, y: 180 };

interface AdjList {
  [nodeId: string]: string[];
}

function buildAdjacencyList(nodes: Node[], edges: Edge[]): AdjList {
  const adj: AdjList = {};
  for (const n of nodes) adj[n.id] = [];
  for (const e of edges) {
    if (adj[e.source]) adj[e.source].push(e.target);
  }
  return adj;
}

function topoSort(nodeIds: string[], adj: AdjList): string[] {
  const inDeg: Record<string, number> = {};
  for (const id of nodeIds) inDeg[id] = 0;
  for (const id of nodeIds) {
    for (const t of adj[id] ?? []) {
      inDeg[t] = (inDeg[t] ?? 0) + 1;
    }
  }
  const queue = nodeIds.filter((id) => inDeg[id] === 0);
  const sorted: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    sorted.push(cur);
    for (const t of adj[cur] ?? []) {
      inDeg[t]--;
      if (inDeg[t] === 0) queue.push(t);
    }
  }
  if (sorted.length < nodeIds.length) {
    const remaining = nodeIds.filter((id) => !sorted.includes(id));
    sorted.push(...remaining);
  }
  return sorted;
}

/**
 * Assign layered positions to nodes using a simplified Sugiyama-style
 * algorithm: topological ordering → layer assignment → horizontal spacing.
 */
export function computeLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions,
): Node[] {
  if (nodes.length === 0) return [];

  const spacing =
    options.density === LayoutDensity.COMPACT ? COMPACT_SPACING : SPARSE_SPACING;
  const sx = options.nodeSpacingX ?? spacing.x;
  const sy = options.nodeSpacingY ?? spacing.y;
  const direction = options.direction ?? "TB";
  const isHorizontal = direction === "LR" || direction === "RL";

  const adj = buildAdjacencyList(nodes, edges);
  const sorted = topoSort(
    nodes.map((n) => n.id),
    adj,
  );

  const layer: Record<string, number> = {};
  for (const id of sorted) {
    const parents = edges.filter((e) => e.target === id).map((e) => e.source);
    layer[id] = parents.length === 0 ? 0 : Math.max(...parents.map((p) => (layer[p] ?? 0) + 1));
  }

  const layerGroups: Record<number, string[]> = {};
  for (const [id, l] of Object.entries(layer)) {
    (layerGroups[l] ??= []).push(id);
  }

  const positions: Record<string, XYPosition> = {};
  for (const [layerIdx, ids] of Object.entries(layerGroups)) {
    const li = Number(layerIdx);
    ids.forEach((id, idx) => {
      const offset = idx - (ids.length - 1) / 2;
      if (isHorizontal) {
        positions[id] = {
          x: (direction === "RL" ? -li : li) * sx,
          y: offset * sy,
        };
      } else {
        positions[id] = {
          x: offset * sx,
          y: (direction === "BT" ? -li : li) * sy,
        };
      }
    });
  }

  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
  }));
}
