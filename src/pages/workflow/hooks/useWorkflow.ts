import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";

import { useHistory } from "@mozi/core/workflow/views";
import {
  workflowApi,
  type Workflow,
  type RunOut,
  type RunEvent,
  type GraphData,
} from "@/services/workflow";

// ── Node runtime status ──

export type NodeRunStatus = "idle" | "running" | "completed" | "failed" | "skipped";

export interface NodeRunState {
  status: NodeRunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface UseWorkflowOptions {
  workflowId?: string;
}

export function useWorkflow({ workflowId }: UseWorkflowOptions = {}) {
  // ── Core state ──
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(!!workflowId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

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
      n.id === nodePreview.id ? { ...n, data: { ...n.data, ...nodePreview.updates } } : n,
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
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [currentRun, setCurrentRun] = useState<RunOut | null>(null);
  const [nodeRunStates, setNodeRunStates] = useState<Record<string, NodeRunState>>({});

  // ── History ──
  const history = useHistory();

  // ── Load workflow + latest version ──
  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;

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

  const pushHistory = useCallback(() => {
    history.push(nodes, edges);
  }, [history, nodes, edges]);

  // ── ReactFlow handlers ──
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      markDirty();
    },
    [markDirty],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      markDirty();
    },
    [markDirty],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      pushHistory();
      setEdges((eds) => addEdge({ ...params, type: "directional" }, eds));
      markDirty();
    },
    [pushHistory, markDirty],
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
    setNodePreview((prev) =>
      prev?.id === nodeId
        ? { id: nodeId, updates: { ...prev.updates, ...updates } }
        : { id: nodeId, updates },
    );
  }, []);

  const previewEdge = useCallback((edgeId: string, updates: Record<string, unknown>) => {
    setEdgePreview((prev) =>
      prev?.id === edgeId
        ? { id: edgeId, updates: deepMergeEdgeUpdates(prev.updates, updates) }
        : { id: edgeId, updates },
    );
  }, []);

  const commitPreview = useCallback(() => {
    if (nodePreview) {
      pushHistory();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodePreview.id ? { ...n, data: { ...n.data, ...nodePreview.updates } } : n,
        ),
      );
      setSelectedNode((prev) =>
        prev?.id === nodePreview.id
          ? { ...prev, data: { ...prev.data, ...nodePreview.updates } }
          : prev,
      );
      setNodePreview(null);
      markDirty();
    }
    if (edgePreview) {
      pushHistory();
      setEdges((eds) =>
        eds.map((e) => {
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
        }),
      );
      setSelectedEdge((prev) => {
        if (prev?.id !== edgePreview.id) return prev;
        const { data: previewData, ...topLevel } = edgePreview.updates as {
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
      markDirty();
    }
  }, [nodePreview, edgePreview, pushHistory, markDirty]);

  const revertPreview = useCallback(() => {
    setNodePreview(null);
    setEdgePreview(null);
  }, []);

  // ── Node / Edge direct updates (used outside config drawer) ──
  const updateNode = useCallback(
    (nodeId: string, updates: Record<string, unknown>) => {
      pushHistory();
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n)),
      );
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...updates } } : prev,
      );
      markDirty();
    },
    [pushHistory, markDirty],
  );

  const updateEdge = useCallback(
    (edgeId: string, updates: Record<string, unknown>) => {
      pushHistory();
      setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, ...updates } : e)));
      setSelectedEdge((prev) => (prev?.id === edgeId ? ({ ...prev, ...updates } as Edge) : prev));
      markDirty();
    },
    [pushHistory, markDirty],
  );

  const addNode = useCallback(
    (node: Node) => {
      pushHistory();
      setNodes((nds) => [...nds, node]);
      markDirty();
    },
    [pushHistory, markDirty],
  );

  // ── Undo / Redo ──
  const undo = useCallback(() => {
    const entry = history.undo();
    if (entry) {
      setNodes(entry.nodes as Node[]);
      setEdges(entry.edges as Edge[]);
      markDirty();
    }
  }, [history, markDirty]);

  const redo = useCallback(() => {
    const entry = history.redo();
    if (entry) {
      setNodes(entry.nodes as Node[]);
      setEdges(entry.edges as Edge[]);
      markDirty();
    }
  }, [history, markDirty]);

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

  // ── WebSocket ref for run progress ──
  const wsRef = useRef<WebSocket | null>(null);
  const runningRef = useRef(false);

  const closeWs = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      wsRef.current = null;
    }
  }, []);

  // Clean up WS on unmount
  useEffect(() => closeWs, [closeWs]);

  // ── Run workflow ──
  const run = useCallback(async () => {
    if (!workflowId || runningRef.current) return;
    runningRef.current = true;
    setRunStatus("running");
    setNodeRunStates({});
    setCurrentRun(null);
    closeWs();

    try {
      const result = await workflowApi.run(workflowId);
      setCurrentRun(result);

      const ws = workflowApi.connectRunWs(result.id);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const evt: RunEvent = JSON.parse(e.data);

          switch (evt.type) {
            case "node_started":
              if (evt.node_id) {
                setNodeRunStates((prev) => ({
                  ...prev,
                  [evt.node_id!]: {
                    status: "running",
                    startedAt: evt.timestamp,
                  },
                }));
              }
              break;

            case "node_completed":
              if (evt.node_id) {
                setNodeRunStates((prev) => ({
                  ...prev,
                  [evt.node_id!]: {
                    status: "completed",
                    output: evt.output ?? undefined,
                    completedAt: evt.timestamp,
                  },
                }));
              }
              break;

            case "node_error":
              if (evt.node_id) {
                setNodeRunStates((prev) => ({
                  ...prev,
                  [evt.node_id!]: {
                    status: "failed",
                    error: evt.error ?? undefined,
                    completedAt: evt.timestamp,
                  },
                }));
              }
              break;

            case "run_completed":
              runningRef.current = false;
              setRunStatus("completed");
              closeWs();
              break;

            case "run_failed":
              runningRef.current = false;
              setRunStatus("failed");
              closeWs();
              break;

            case "run_cancelled":
              runningRef.current = false;
              setRunStatus("idle");
              closeWs();
              break;
          }
        } catch {
          /* ignore malformed messages */
        }
      };

      ws.onerror = () => {
        runningRef.current = false;
        setRunStatus("failed");
        closeWs();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (runningRef.current) {
          runningRef.current = false;
          setRunStatus("failed");
        }
      };

      // Fallback: poll run status if WebSocket receives no terminal event
      const pollTimer = setInterval(async () => {
        if (!runningRef.current) {
          clearInterval(pollTimer);
          return;
        }
        try {
          const r = await workflowApi.getRun(result.id);
          if (["completed", "failed", "cancelled"].includes(r.status)) {
            clearInterval(pollTimer);
            runningRef.current = false;
            setRunStatus(r.status === "cancelled" ? "idle" : (r.status as "completed" | "failed"));
            closeWs();
          }
        } catch {
          /* ignore poll errors */
        }
      }, 5000);

      ws.addEventListener("close", () => clearInterval(pollTimer), { once: true });
    } catch {
      runningRef.current = false;
      setRunStatus("failed");
    }
  }, [workflowId, closeWs]);

  const cancelRun = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "cancel" }));
    } else if (runningRef.current) {
      runningRef.current = false;
      setRunStatus("idle");
      setNodeRunStates({});
      closeWs();
    }
  }, [closeWs]);

  const resetNodeRunStates = useCallback(() => {
    runningRef.current = false;
    setNodeRunStates({});
    setRunStatus("idle");
    setCurrentRun(null);
    closeWs();
  }, [closeWs]);

  const onNodeDragStop = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

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
    undo,
    redo,

    save,

    runStatus,
    currentRun,
    nodeRunStates,
    run,
    cancelRun,
    resetNodeRunStates,

    rawNodes: nodes,
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
