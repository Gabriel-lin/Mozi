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

  // ── Selection ──
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

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

  // ── Running & data flow ──
  const { runStatus, runError, currentRun, nodeRunStates, run, cancelRun, resetRunStates } =
    useWorkflowRun({ workflowId });

  // ── History ──
  const history = useHistory();

  useEffect(() => {
    historySeededForWorkflow.current = null;
  }, [workflowId]);

  // Baseline snapshot so first edit has index 1 (useHistory undo requires currentIndex > 0).
  useEffect(() => {
    if (!workflowId || loading) return;
    if (historySeededForWorkflow.current === workflowId) return;
    historySeededForWorkflow.current = workflowId;
    history.reset();
    history.push(nodesRef.current, edgesRef.current, {
      operation: { kind: "seed", payload: { workflowId } },
    });
  }, [workflowId, loading, nodes, edges, history]);

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

  const pushHistory = useCallback(
    (meta?: HistoryEntryMeta) => {
      history.push(nodesRef.current, edgesRef.current, meta);
    },
    [history],
  );

  const recordGraphSnapshot = useCallback(
    (nextNodes: Node[], nextEdges: Edge[], meta?: HistoryEntryMeta) => {
      history.push(nextNodes, nextEdges, meta);
    },
    [history],
  );

  // ── ReactFlow handlers ──
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const record = nodeChangesNeedHistory(changes);
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        if (record) {
          queueMicrotask(() =>
            recordGraphSnapshot(next, edgesRef.current, {
              operation: { kind: "reactFlowNodesChange", payload: { changes } },
            }),
          );
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
    setSelectedEdge(null);
    setSelectedNode(node);
    setEdgePreview(null);
    setNodePreview(null);
  }, []);

  const selectEdge = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedNode(null);
    setSelectedEdge(edge);
    setNodePreview(null);
    setEdgePreview(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
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
      setSelectedNode((prev) =>
        prev?.id === np.id
          ? {
              ...prev,
              data: mergeNodeData((prev.data ?? {}) as Record<string, unknown>, np.updates),
            }
          : prev,
      );
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
      setSelectedEdge((prev) => {
        if (prev?.id !== ep.id) return prev;
        const { data: previewData, ...topLevel } = ep.updates as {
          data?: Record<string, unknown>;
          [k: string]: unknown;
        };
        return {
          ...prev,
          ...topLevel,
          ...(previewData ? { data: { ...(prev.data ?? {}), ...previewData } } : {}),
        } as Edge;
      });
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
      setSelectedNode((prev) =>
        prev?.id === nodeId
          ? {
              ...prev,
              data: mergeNodeData((prev.data ?? {}) as Record<string, unknown>, updates),
            }
          : prev,
      );
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
      setSelectedEdge((prev) => (prev?.id === edgeId ? ({ ...prev, ...updates } as Edge) : prev));
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
    setSelectedNode((prev) => {
      if (!prev) return null;
      const n = nextNodes.find((x) => x.id === prev.id);
      return n ?? null;
    });
    setSelectedEdge((prev) => {
      if (!prev) return null;
      const e = nextEdges.find((x) => x.id === prev.id);
      return (e as Edge | undefined) ?? null;
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
      setSelectedNode((prev) => (prev?.id === nodeId ? null : prev));
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
      setSelectedEdge((prev) => (prev?.id === edgeId ? null : prev));
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
    setSelectedNode(null);
    setSelectedEdge(null);
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
      setNodes((nds) => {
        const selected = nds.filter((n) => nodeIds.includes(n.id));
        if (selected.length === 0) return nds;

        const xs = selected.map((n) => n.position.x);
        const ys = selected.map((n) => n.position.y);
        const padding = 40;
        const minX = Math.min(...xs) - padding;
        const minY = Math.min(...ys) - padding;
        const maxX = Math.max(...xs) + 200 + padding;
        const maxY = Math.max(...ys) + 100 + padding;

        const groupId = generateId("grp");
        const groupNode: Node = {
          id: groupId,
          type: "group",
          position: { x: minX, y: minY },
          style: { width: maxX - minX, height: maxY - minY },
          data: { label: "Group" },
        };

        const updated = nds.map((n) => {
          if (!nodeIds.includes(n.id)) return n;
          return {
            ...n,
            position: { x: n.position.x - minX, y: n.position.y - minY },
            parentId: groupId,
            extent: "parent" as const,
          };
        });

        return [groupNode, ...updated];
      });
      requestAnimationFrame(() =>
        pushHistory({ operation: { kind: "mergeToGroup", payload: { nodeIds } } }),
      );
      markDirty();
    },
    [pushHistory, markDirty],
  );

  const addLabelGroup = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;
      setNodes((nds) => {
        const selected = nds.filter((n) => nodeIds.includes(n.id));
        if (selected.length === 0) return nds;

        const xs = selected.map((n) => n.position.x);
        const ys = selected.map((n) => n.position.y);
        const padding = 40;
        const minX = Math.min(...xs) - padding;
        const minY = Math.min(...ys) - padding;
        const maxX = Math.max(...xs) + 200 + padding;
        const maxY = Math.max(...ys) + 100 + padding;

        const groupId = generateId("lbl");
        const groupNode: Node = {
          id: groupId,
          type: "group",
          position: { x: minX, y: minY },
          style: { width: maxX - minX, height: maxY - minY },
          data: { label: "Label" },
        };

        const updated = nds.map((n) => {
          if (!nodeIds.includes(n.id)) return n;
          return {
            ...n,
            position: { x: n.position.x - minX, y: n.position.y - minY },
            parentId: groupId,
            extent: "parent" as const,
          };
        });

        return [groupNode, ...updated];
      });
      requestAnimationFrame(() =>
        pushHistory({ operation: { kind: "addLabelGroup", payload: { nodeIds } } }),
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
    addLabelGroup,
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
