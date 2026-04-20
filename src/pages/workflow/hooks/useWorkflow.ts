import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";

import {
  useHistory,
  generateId,
  computeLayout,
  computeForceLayout,
  LayoutDensity,
  type HistoryEntryMeta,
} from "@mozi/core/workflow/views";
import { workflowApi, type Workflow, type GraphData } from "@/services/workflow";
import { getDefaultBaseUrl } from "@/pages/workflow/llmProviderDefaults";
import { useWorkflowRun } from "./useWorkflowRun";

function mergeNodeData(
  prev: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...prev, ...updates };
  if ("base_url" in updates) {
    delete next.apiBase;
  }
  return next;
}

function stripApiBaseFromPreviewUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  if (!("base_url" in updates)) return updates;
  const { apiBase: _, ...rest } = updates;
  return rest;
}

function buildNodeById(nodes: Node[]): Map<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/** Sum parent chain so child `position` becomes absolute flow coordinates. */
function getAbsoluteFlowPosition(node: Node, byId: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let pid = node.parentId;
  while (pid) {
    const p = byId.get(pid);
    if (!p) break;
    x += p.position.x;
    y += p.position.y;
    pid = p.parentId;
  }
  return { x, y };
}

function parseStylePx(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function estimateNodeOuterSize(n: Node): { w: number; h: number } {
  const style = (n.style ?? {}) as Record<string, unknown>;
  const w =
    (typeof n.width === "number" ? n.width : undefined) ??
    n.measured?.width ??
    parseStylePx(style.width) ??
    (n.type === "group" ? 260 : n.type === "workflowText" ? 200 : 220);
  const h =
    (typeof n.height === "number" ? n.height : undefined) ??
    n.measured?.height ??
    parseStylePx(style.height) ??
    (n.type === "group" ? 160 : 100);
  return { w, h };
}

/** Structural / destructive RF updates that must get their own history entry. */
function nodeChangesNeedHistory(changes: NodeChange[]): boolean {
  return changes.some((c) => {
    if (c.type === "remove" || c.type === "add" || c.type === "replace") return true;
    if (c.type === "dimensions") {
      return c.resizing === false;
    }
    return false;
  });
}

function edgeChangesNeedHistory(changes: EdgeChange[]): boolean {
  return changes.some((c) => c.type === "remove" || c.type === "add" || c.type === "replace");
}

/** Controlled RF emits `replace` when store diff sees a new node object (e.g. `updateNodeData`). */
function collectReplaceNodeIdsFromNodeChanges(changes: NodeChange[]): Set<string> {
  const ids = new Set<string>();
  for (const ch of changes) {
    if (ch.type === "replace" && "id" in ch && typeof (ch as { id?: unknown }).id === "string") {
      ids.add((ch as { id: string }).id);
    }
  }
  return ids;
}

/** Stable snapshot for deduping back-to-back identical graphs (e.g. RF `replace` + ResizeObserver no-op). */
function workflowGraphSignature(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify({ nodes, edges });
}

export interface UseWorkflowOptions {
  workflowId?: string;
}

/** Canvas auto-layout modes (context menu / toolbar). */
export type WorkflowCanvasLayoutId = "compact" | "sparse" | "compact_lr" | "force";

function partitionTopLevelGraph(nodes: Node[], edges: Edge[]) {
  const topIds = new Set(nodes.filter((n) => !n.parentId).map((n) => n.id));
  const topNodes = nodes.filter((n) => topIds.has(n.id));
  const topEdges = edges.filter((e) => topIds.has(e.source) && topIds.has(e.target));
  return { topNodes, topEdges };
}

function mergeLaidOutPositions(fullNodes: Node[], laidTop: Node[]): Node[] {
  const pos = new Map(laidTop.map((n) => [n.id, n.position] as const));
  return fullNodes.map((n) => (pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n));
}

export function useWorkflow({ workflowId }: UseWorkflowOptions = {}) {
  // ── Core state ──
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(!!workflowId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const historySeededForWorkflow = useRef<string | null>(null);
  const lastRecordedHistorySigRef = useRef<string | null>(null);

  // ── Selection ──
  // We only track the selected *id*; the live node object is derived from
  // `displayNodes` below so it always reflects the latest graph + preview
  // state (including inline canvas edits via `updateNodeData`) without any
  // extra sync effects.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // ── Preview layer (not persisted until commit) ──
  const [nodePreview, setNodePreview] = useState<{
    id: string;
    updates: Record<string, unknown>;
  } | null>(null);
  const [edgePreview, setEdgePreview] = useState<{
    id: string;
    updates: Record<string, unknown>;
  } | null>(null);

  const displayNodes = useMemo(() => {
    if (!nodePreview) return nodes;
    return nodes.map((n) =>
      n.id === nodePreview.id
        ? {
            ...n,
            data: mergeNodeData((n.data ?? {}) as Record<string, unknown>, nodePreview.updates),
          }
        : n,
    );
  }, [nodes, nodePreview]);

  const displayEdges = useMemo(() => {
    if (!edgePreview) return edges;
    return edges.map((e) => {
      if (e.id !== edgePreview.id) return e;
      const { data: previewData, ...topLevel } = edgePreview.updates as {
        data?: Record<string, unknown>;
        [k: string]: unknown;
      };
      return {
        ...e,
        ...topLevel,
        ...(previewData ? { data: { ...(e.data ?? {}), ...previewData } } : {}),
      };
    });
  }, [edges, edgePreview]);

  // Live selection objects derived from the currently rendered graph so any
  // update (inline canvas label edit, drawer preview, history jump, …)
  // immediately shows up wherever `selectedNode` / `selectedEdge` is read.
  const selectedNode = useMemo<Node | null>(() => {
    if (!selectedNodeId) return null;
    return displayNodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [displayNodes, selectedNodeId]);

  const selectedEdge = useMemo<Edge | null>(() => {
    if (!selectedEdgeId) return null;
    return displayEdges.find((e) => e.id === selectedEdgeId) ?? null;
  }, [displayEdges, selectedEdgeId]);

  // ── Running & data flow ──
  const { runStatus, runError, currentRun, nodeRunStates, run, cancelRun, resetRunStates } =
    useWorkflowRun({ workflowId });

  // ── History ──
  const history = useHistory();

  const recordGraphSnapshot = useCallback(
    (nextNodes: Node[], nextEdges: Edge[], meta?: HistoryEntryMeta) => {
      const sig = workflowGraphSignature(nextNodes, nextEdges);
      if (lastRecordedHistorySigRef.current !== null && sig === lastRecordedHistorySigRef.current) {
        return;
      }
      lastRecordedHistorySigRef.current = sig;
      history.push(nextNodes, nextEdges, meta);
    },
    [history],
  );

  const pushHistory = useCallback(
    (meta?: HistoryEntryMeta) => {
      recordGraphSnapshot(nodesRef.current, edgesRef.current, meta);
    },
    [recordGraphSnapshot],
  );

  useEffect(() => {
    historySeededForWorkflow.current = null;
    lastRecordedHistorySigRef.current = null;
  }, [workflowId]);

  // Baseline snapshot so first edit has index 1 (useHistory undo requires currentIndex > 0).
  useEffect(() => {
    if (!workflowId || loading) return;
    if (historySeededForWorkflow.current === workflowId) return;
    historySeededForWorkflow.current = workflowId;
    history.reset();
    lastRecordedHistorySigRef.current = null;
    recordGraphSnapshot(nodesRef.current, edgesRef.current, {
      operation: { kind: "seed", payload: { workflowId } },
    });
  }, [workflowId, loading, nodes, edges, history, recordGraphSnapshot]);

  // ── Load workflow + latest version ──
  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const wf = await workflowApi.get(workflowId);
        if (cancelled) return;
        setWorkflow(wf);

        const res = await workflowApi.listVersions(workflowId, 1, 1);
        if (cancelled || !res?.versions?.length) return;
        const latest = res.versions[0];
        if (latest.graph_data?.nodes) setNodes(latest.graph_data.nodes as Node[]);
        if (latest.graph_data?.edges) setEdges(latest.graph_data.edges as Edge[]);
      } catch {
        /* handled by caller */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  // ── Mark dirty on any node/edge change ──
  const markDirty = useCallback(() => setDirty(true), []);

  // ── ReactFlow handlers ──
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const record = nodeChangesNeedHistory(changes);
      const replaceIds = collectReplaceNodeIdsFromNodeChanges(changes);
      const removedIds = new Set(
        changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id),
      );

      // A `replace` means the underlying node object was swapped
      // (e.g. `updateNodeData` from an inline canvas label edit). The fresh
      // value now lives in `nodes`, so drop any stale preview for it in the
      // SAME render as `setNodes` — otherwise there is a window where
      // `displayNodes` still merges the outdated preview on top of the new
      // base data, making the drawer appear to ignore the canvas edit.
      if (replaceIds.size > 0 || removedIds.size > 0) {
        setNodePreview((pv) => {
          if (!pv) return pv;
          if (replaceIds.has(pv.id)) return null;
          if (removedIds.has(pv.id)) return null;
          return pv;
        });
      }

      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        if (record) {
          queueMicrotask(() => {
            recordGraphSnapshot(next, edgesRef.current, {
              operation: { kind: "reactFlowNodesChange", payload: { changes } },
            });
          });
        }
        return next;
      });
      markDirty();
    },
    [markDirty, recordGraphSnapshot],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const record = edgeChangesNeedHistory(changes);
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        if (record) {
          queueMicrotask(() =>
            recordGraphSnapshot(nodesRef.current, next, {
              operation: { kind: "reactFlowEdgesChange", payload: { changes } },
            }),
          );
        }
        return next;
      });
      markDirty();
    },
    [markDirty, recordGraphSnapshot],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      const nextEdges = addEdge({ ...params, type: "directional" }, edgesRef.current);
      setEdges(nextEdges);
      recordGraphSnapshot(nodesRef.current, nextEdges, {
        operation: { kind: "connect", payload: { ...params } },
      });
      markDirty();
    },
    [recordGraphSnapshot, markDirty],
  );

  // ── Selection ──
  const selectNode = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedEdgeId(null);
    setSelectedNodeId(node.id);
    setEdgePreview(null);
    setNodePreview(null);
  }, []);

  const selectEdge = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(edge.id);
    setNodePreview(null);
    setEdgePreview(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  /** Clear config drawer target while keeping React Flow node selection (e.g. Shift multi-select). */
  const blurDrawerSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setNodePreview(null);
    setEdgePreview(null);
  }, []);

  // ── Preview / Commit / Revert ──

  const previewNode = useCallback((nodeId: string, updates: Record<string, unknown>) => {
    setNodePreview((prev) => {
      const merged = prev?.id === nodeId ? { ...prev.updates, ...updates } : { ...updates };
      return { id: nodeId, updates: stripApiBaseFromPreviewUpdates(merged) };
    });
  }, []);

  const previewEdge = useCallback((edgeId: string, updates: Record<string, unknown>) => {
    setEdgePreview((prev) =>
      prev?.id === edgeId
        ? { id: edgeId, updates: deepMergeEdgeUpdates(prev.updates, updates) }
        : { id: edgeId, updates },
    );
  }, []);

  const commitPreview = useCallback(() => {
    const np = nodePreview;
    const ep = edgePreview;

    let nextNodes = nodesRef.current;
    let nextEdges = edgesRef.current;

    if (np) {
      nextNodes = nextNodes.map((n) =>
        n.id === np.id
          ? {
              ...n,
              data: mergeNodeData((n.data ?? {}) as Record<string, unknown>, np.updates),
            }
          : n,
      );
      setNodes(nextNodes);
      setNodePreview(null);
    }

    if (ep) {
      nextEdges = nextEdges.map((e) => {
        if (e.id !== ep.id) return e;
        const { data: previewData, ...topLevel } = ep.updates as {
          data?: Record<string, unknown>;
          [k: string]: unknown;
        };
        return {
          ...e,
          ...topLevel,
          ...(previewData ? { data: { ...(e.data ?? {}), ...previewData } } : {}),
        };
      });
      setEdges(nextEdges);
      setEdgePreview(null);
    }

    if (np || ep) {
      recordGraphSnapshot(nextNodes, nextEdges, {
        operation: {
          kind: "commitPreview",
          payload: {
            nodeId: np?.id,
            edgeId: ep?.id,
            nodePatch: np?.updates,
            edgePatch: ep?.updates,
          },
        },
      });
      markDirty();
    }

    if (runStatus !== "idle") {
      resetRunStates();
    }
  }, [nodePreview, edgePreview, recordGraphSnapshot, markDirty, runStatus, resetRunStates]);

  const revertPreview = useCallback(() => {
    setNodePreview(null);
    setEdgePreview(null);
  }, []);

  // ── Node / Edge direct updates (used outside config drawer) ──
  const updateNode = useCallback(
    (nodeId: string, updates: Record<string, unknown>) => {
      const nextNodes = nodesRef.current.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: mergeNodeData((n.data ?? {}) as Record<string, unknown>, updates),
            }
          : n,
      );
      setNodes(nextNodes);
      recordGraphSnapshot(nextNodes, edgesRef.current, {
        operation: { kind: "updateNode", payload: { nodeId, updates } },
      });
      markDirty();
    },
    [recordGraphSnapshot, markDirty],
  );

  const updateEdge = useCallback(
    (edgeId: string, updates: Record<string, unknown>) => {
      const nextEdges = edgesRef.current.map((e) =>
        e.id === edgeId ? ({ ...e, ...updates } as Edge) : e,
      );
      setEdges(nextEdges);
      recordGraphSnapshot(nodesRef.current, nextEdges, {
        operation: { kind: "updateEdge", payload: { edgeId, updates } },
      });
      markDirty();
    },
    [recordGraphSnapshot, markDirty],
  );

  const addNode = useCallback(
    (node: Node) => {
      const nextNodes = [...nodesRef.current, node];
      const nextEdges = edgesRef.current;
      setNodes(nextNodes);
      recordGraphSnapshot(nextNodes, nextEdges, {
        operation: { kind: "addNode", payload: { nodeId: node.id } },
      });
      markDirty();
    },
    [recordGraphSnapshot, markDirty],
  );

  const syncSelectionAfterHistoryJump = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    setSelectedNodeId((prev) => {
      if (!prev) return null;
      return nextNodes.some((x) => x.id === prev) ? prev : null;
    });
    setSelectedEdgeId((prev) => {
      if (!prev) return null;
      return nextEdges.some((x) => x.id === prev) ? prev : null;
    });
  }, []);

  // ── Undo / Redo ──
  const undo = useCallback(() => {
    const entry = history.undo();
    if (entry) {
      setNodePreview(null);
      setEdgePreview(null);
      setNodes(entry.nodes as Node[]);
      setEdges(entry.edges as Edge[]);
      lastRecordedHistorySigRef.current = workflowGraphSignature(
        entry.nodes as Node[],
        entry.edges as Edge[],
      );
      syncSelectionAfterHistoryJump(entry.nodes as Node[], entry.edges as Edge[]);
      markDirty();
    }
  }, [history, markDirty, syncSelectionAfterHistoryJump]);

  const redo = useCallback(() => {
    const entry = history.redo();
    if (entry) {
      setNodePreview(null);
      setEdgePreview(null);
      setNodes(entry.nodes as Node[]);
      setEdges(entry.edges as Edge[]);
      lastRecordedHistorySigRef.current = workflowGraphSignature(
        entry.nodes as Node[],
        entry.edges as Edge[],
      );
      syncSelectionAfterHistoryJump(entry.nodes as Node[], entry.edges as Edge[]);
      markDirty();
    }
  }, [history, markDirty, syncSelectionAfterHistoryJump]);

  // ── Save (create version) ──
  const save = useCallback(async () => {
    if (!workflowId || saving) return;
    setSaving(true);
    try {
      const graphData: GraphData = {
        nodes: nodes as unknown as Record<string, unknown>[],
        edges: edges as unknown as Record<string, unknown>[],
      };
      await workflowApi.createVersion(workflowId, { graph_data: graphData });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [workflowId, saving, nodes, edges]);

  const onNodeDragStop = useCallback(() => {
    requestAnimationFrame(() => {
      pushHistory({ operation: { kind: "nodeDragStop" } });
    });
  }, [pushHistory]);

  // ── Context menu helper actions ──

  const deleteNode = useCallback(
    (nodeId: string) => {
      const nextNodes = nodesRef.current.filter((n) => n.id !== nodeId);
      const nextEdges = edgesRef.current.filter((e) => e.source !== nodeId && e.target !== nodeId);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
      recordGraphSnapshot(nextNodes, nextEdges, {
        operation: { kind: "deleteNode", payload: { nodeId } },
      });
      markDirty();
    },
    [recordGraphSnapshot, markDirty],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      const nextEdges = edgesRef.current.filter((e) => e.id !== edgeId);
      setEdges(nextEdges);
      setSelectedEdgeId((prev) => (prev === edgeId ? null : prev));
      recordGraphSnapshot(nodesRef.current, nextEdges, {
        operation: { kind: "deleteEdge", payload: { edgeId } },
      });
      markDirty();
    },
    [recordGraphSnapshot, markDirty],
  );

  const resetNodeConfig = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const kind = (n.data as Record<string, unknown>).nodeKind as string | undefined;
          const label = ((n.data as Record<string, unknown>).label as string) ?? "";
          const base = {
            inputs: [{ id: "in-1", label: "输入" }],
            outputs: [{ id: "out-1", label: "输出" }],
          };
          if (kind === "llm") {
            return {
              ...n,
              data: {
                label,
                nodeKind: "llm",
                provider: "openai",
                model: "gpt-4o",
                apiKey: "",
                base_url: getDefaultBaseUrl("openai"),
                useCustomBaseUrl: false,
                protocol: "openai",
                protocolAdapter: "openai",
                temperature: 0.7,
                ...base,
              },
            };
          }
          if (kind === "agent") {
            return {
              ...n,
              data: {
                label,
                nodeKind: "agent",
                llmNodeId: "",
                systemPrompt: "",
                userPrompt: "",
                rules: [],
                hooks: [],
                plugins: [],
                skills: [],
                ...base,
              },
            };
          }
          return { ...n, data: { label, ...(kind ? { nodeKind: kind } : {}), ...base } };
        }),
      );
      requestAnimationFrame(() =>
        pushHistory({ operation: { kind: "resetNodeConfig", payload: { nodeId } } }),
      );
      markDirty();
    },
    [pushHistory, markDirty],
  );

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    recordGraphSnapshot([], [], { operation: { kind: "clearCanvas" } });
    markDirty();
  }, [recordGraphSnapshot, markDirty]);

  const selectAll = useCallback(() => {
    const nextNodes = nodesRef.current.map((n) => ({ ...n, selected: true }));
    const nextEdges = edgesRef.current.map((e) => ({ ...e, selected: true }));
    setNodes(nextNodes);
    setEdges(nextEdges);
    recordGraphSnapshot(nextNodes, nextEdges, {
      operation: { kind: "selectAll" },
    });
    markDirty();
  }, [recordGraphSnapshot, markDirty]);

  const applyLayout = useCallback(
    (
      type: WorkflowCanvasLayoutId,
      options?: {
        /** Run after nodes state is committed (e.g. fitView). */
        onApplied?: () => void;
      },
    ) => {
      const nds = nodesRef.current;
      const eds = edgesRef.current;
      const { topNodes, topEdges } = partitionTopLevelGraph(nds, eds);
      if (topNodes.length === 0) {
        queueMicrotask(() => options?.onApplied?.());
        return;
      }

      let laidTop: Node[];
      switch (type) {
        case "compact":
          laidTop = computeLayout(topNodes, topEdges, {
            density: LayoutDensity.COMPACT,
            direction: "TB",
          });
          break;
        case "sparse":
          laidTop = computeLayout(topNodes, topEdges, {
            density: LayoutDensity.SPARSE,
            direction: "TB",
          });
          break;
        case "compact_lr":
          laidTop = computeLayout(topNodes, topEdges, {
            density: LayoutDensity.COMPACT,
            direction: "LR",
          });
          break;
        case "force":
          laidTop = computeForceLayout(topNodes, topEdges);
          break;
        default:
          laidTop = topNodes;
      }

      const next = mergeLaidOutPositions(nds, laidTop);
      setNodes(next);
      recordGraphSnapshot(next, eds, {
        operation: { kind: "layout", payload: { type } },
      });
      markDirty();
      queueMicrotask(() => options?.onApplied?.());
    },
    [recordGraphSnapshot, markDirty],
  );

  const mergeToGroup = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length < 2) return;
      const nds = nodesRef.current;
      const byId = buildNodeById(nds);
      const selected = nds.filter((n) => nodeIds.includes(n.id) && n.type !== "group");
      if (selected.length < 2) return;

      const padding = 40;
      let minAX = Infinity;
      let minAY = Infinity;
      let maxAX = -Infinity;
      let maxAY = -Infinity;
      for (const n of selected) {
        const abs = getAbsoluteFlowPosition(n, byId);
        const { w, h } = estimateNodeOuterSize(n);
        minAX = Math.min(minAX, abs.x);
        minAY = Math.min(minAY, abs.y);
        maxAX = Math.max(maxAX, abs.x + w);
        maxAY = Math.max(maxAY, abs.y + h);
      }
      const groupX = minAX - padding;
      const groupY = minAY - padding;
      const groupW = maxAX - minAX + padding * 2;
      const groupH = maxAY - minAY + padding * 2;

      const groupId = generateId("grp");
      const groupNode: Node = {
        id: groupId,
        type: "group",
        position: { x: groupX, y: groupY },
        style: { width: groupW, height: groupH },
        data: { label: "Group" },
      };

      const selectedIds = new Set(selected.map((n) => n.id));
      const mergedIds = selected.map((n) => n.id);
      const updated = nds.map((n) => {
        if (!selectedIds.has(n.id)) return n;
        const abs = getAbsoluteFlowPosition(n, byId);
        return {
          ...n,
          position: { x: abs.x - groupX, y: abs.y - groupY },
          parentId: groupId,
          extent: "parent" as const,
        };
      });

      const next = [groupNode, ...updated];
      setNodes(next);
      requestAnimationFrame(() =>
        pushHistory({ operation: { kind: "mergeToGroup", payload: { nodeIds: mergedIds } } }),
      );
      markDirty();
    },
    [pushHistory, markDirty],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      setNodes((nds) => {
        const group = nds.find((n) => n.id === groupId);
        if (!group) return nds;
        const gx = group.position.x;
        const gy = group.position.y;
        return nds
          .filter((n) => n.id !== groupId)
          .map((n) => {
            if (n.parentId !== groupId) return n;
            const restored = { ...n, position: { x: n.position.x + gx, y: n.position.y + gy } };
            delete (restored as Record<string, unknown>).parentId;
            delete (restored as Record<string, unknown>).extent;
            return restored as Node;
          });
      });
      requestAnimationFrame(() =>
        pushHistory({ operation: { kind: "deleteGroup", payload: { groupId } } }),
      );
      markDirty();
    },
    [pushHistory, markDirty],
  );

  return {
    workflow,
    loading,
    saving,
    dirty,
    nodes: displayNodes,
    edges: displayEdges,
    setNodes,
    setEdges,

    selectedNode,
    selectedEdge,
    selectNode,
    selectEdge,
    clearSelection,
    blurDrawerSelection,

    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNode,
    updateEdge,
    addNode,
    onNodeDragStop,
    pushHistory,

    previewNode,
    previewEdge,
    commitPreview,
    revertPreview,

    canUndo: history.canUndo,
    canRedo: history.canRedo,
    historyCursor: history.currentIndex,
    undo,
    redo,

    save,

    runStatus,
    runError,
    currentRun,
    nodeRunStates,
    run,
    cancelRun,
    resetRunStates,

    rawNodes: nodes,
    rawEdges: edges,

    deleteNode,
    deleteEdge,
    resetNodeConfig,
    clearCanvas,
    selectAll,
    applyLayout,
    mergeToGroup,
    deleteGroup,
  };
}

function deepMergeEdgeUpdates(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...prev, ...next };
  if (prev.data && next.data) {
    merged.data = {
      ...(prev.data as Record<string, unknown>),
      ...(next.data as Record<string, unknown>),
    };
  }
  return merged;
}
