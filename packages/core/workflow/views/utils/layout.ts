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

/**
 * Force-directed layout (Fruchterman–Reingold style).
 * - **Repulsion** between every pair ∝ k² / d so nodes keep a natural spacing.
 * - **Attraction** along edges ∝ d² / k so linked nodes stay near ideal distance ~k.
 * Uses a cooling **temperature** to cap per-step motion for stable convergence.
 */
export function computeForceLayout(
  nodes: Node[],
  edges: Edge[],
  iterations = 160,
): Node[] {
  if (nodes.length === 0) return [];

  const n = nodes.length;
  /** Ideal edge length scale (also repulsion/attraction balance). */
  const area = 640_000;
  const k = 0.9 * Math.sqrt(area / Math.max(n, 1));
  const EPS = 1e-4;

  const pos: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    pos[node.id] = { ...node.position };
  }

  /** Initial temperature ~ typical canvas span; cools each iteration. */
  let temperature = 0.35 * k * Math.sqrt(n);

  const disp: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    disp[node.id] = { x: 0, y: 0 };
  }

  const edgePairs: { u: string; v: string }[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (!pos[e.source] || !pos[e.target]) continue;
    const a = e.source < e.target ? e.source : e.target;
    const b = e.source < e.target ? e.target : e.source;
    const key = `${a}\0${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edgePairs.push({ u: e.source, v: e.target });
  }

  for (let iter = 0; iter < iterations; iter++) {
    for (const node of nodes) {
      disp[node.id].x = 0;
      disp[node.id].y = 0;
    }

    // Repulsion: all unordered pairs (push apart, weaker when far)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const idA = nodes[i].id;
        const idB = nodes[j].id;
        let dx = pos[idA].x - pos[idB].x;
        let dy = pos[idA].y - pos[idB].y;
        let dist = Math.hypot(dx, dy);
        if (dist < EPS) {
          const jitter = (iter % 7) * 0.37;
          dx = Math.cos(jitter) * EPS;
          dy = Math.sin(jitter) * EPS;
          dist = EPS;
        }
        const rep = (k * k) / dist;
        const ux = dx / dist;
        const uy = dy / dist;
        disp[idA].x += ux * rep;
        disp[idA].y += uy * rep;
        disp[idB].x -= ux * rep;
        disp[idB].y -= uy * rep;
      }
    }

    // Attraction: edges pull toward ideal separation ~k (not collapse to one point)
    for (const { u, v } of edgePairs) {
      let dx = pos[v].x - pos[u].x;
      let dy = pos[v].y - pos[u].y;
      let dist = Math.hypot(dx, dy);
      if (dist < EPS) {
        dx = EPS;
        dy = 0;
        dist = EPS;
      }
      const att = (dist * dist) / k;
      const ux = dx / dist;
      const uy = dy / dist;
      disp[u].x += ux * att;
      disp[u].y += uy * att;
      disp[v].x -= ux * att;
      disp[v].y -= uy * att;
    }

    // Apply displacement with temperature cap (FR cooling)
    for (const node of nodes) {
      const d = disp[node.id];
      const len = Math.hypot(d.x, d.y) || EPS;
      const move = Math.min(len, temperature);
      pos[node.id].x += (d.x / len) * move;
      pos[node.id].y += (d.y / len) * move;
    }

    temperature *= 0.92;
  }

  return nodes.map((node) => ({
    ...node,
    position: pos[node.id] ?? node.position,
  }));
}
