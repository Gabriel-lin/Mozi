import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  workflowNodeTypes,
  workflowEdgeTypes,
  generateId,
  useContextMenu,
  type ContextMenuItem,
} from "@mozi/core/workflow/views";
import { useWorkflow } from "./hooks";
import { getDefaultBaseUrl } from "@/pages/workflow/llmProviderDefaults";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Save,
  Loader2,
  Play,
  Square,
  Trash2,
  RotateCcw,
  Scissors,
  LayoutGrid,
  LayoutTemplate,
  ArrowLeftRight,
  Network,
  Eraser,
  CheckSquare,
  Group,
} from "lucide-react";

import {
  CanvasToolbar,
  BottomBar,
  ComponentPanel,
  ConfigDrawer,
  EmptyOverlay,
  ContextMenuOverlay,
  type CanvasTool,
} from "./components";

export function WorkflowEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const wf = useWorkflow({ workflowId: id });
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [mainArea, setMainArea] = useState<HTMLDivElement | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);

  const nodeTypes = useMemo(() => workflowNodeTypes, []);
  const edgeTypes = useMemo(() => workflowEdgeTypes, []);

  // ── Context menu factories ──

  const selectionMenuItems = useCallback(
    (nodeIds: string[]): ContextMenuItem[] => {
      const ids = nodeIds.filter((id) => {
        const n = wf.rawNodes.find((x) => x.id === id);
        return n && n.type !== "group";
      });
      const items: ContextMenuItem[] = [];
      if (ids.length >= 2) {
        items.push({
          id: "merge-group",
          label: t("workflow.ctx.mergeGroup", "合并组"),
          icon: <Group className="h-3.5 w-3.5" />,
          onClick: () => wf.mergeToGroup(ids),
        });
      }
      return items;
    },
    [wf, t],
  );

  const nodeMenuItems = useCallback(
    (nodeId: string): ContextMenuItem[] => {
      const node = wf.rawNodes.find((n) => n.id === nodeId);
      const isGroup = node?.type === "group";
      const selectedIds = wf.rawNodes.filter((n) => n.selected).map((n) => n.id);
      const nonGroupSelected = selectedIds.filter((id) => {
        const n = wf.rawNodes.find((x) => x.id === id);
        return n && n.type !== "group";
      });

      const items: ContextMenuItem[] = [];
      /** 多选时右键点在某一节点上会走节点菜单，不会走选区矩形上的 onSelectionContextMenu */
      if (!isGroup && selectedIds.includes(nodeId) && nonGroupSelected.length >= 2) {
        const selItems = selectionMenuItems(nonGroupSelected);
        if (selItems.length > 0) {
          items.push(...selItems);
          items.push({ id: "sep-multi", label: "" });
        }
      }

      items.push(
        {
          id: "reset-config",
          label: t("workflow.ctx.resetConfig", "重置配置"),
          icon: <RotateCcw className="h-3.5 w-3.5" />,
          onClick: () => wf.resetNodeConfig(nodeId),
          disabled: isGroup,
        },
        {
          id: "delete-node",
          label: t("workflow.ctx.deleteNode", "删除节点"),
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onClick: () => wf.deleteNode(nodeId),
        },
      );
      if (isGroup) {
        items.splice(items.length - 1, 0, {
          id: "split-group",
          label: t("workflow.ctx.splitGroup", "拆分分组"),
          icon: <Scissors className="h-3.5 w-3.5" />,
          onClick: () => wf.deleteGroup(nodeId),
        });
      }
      return items;
    },
    [wf, t, selectionMenuItems],
  );

  const edgeMenuItems = useCallback(
    (edgeId: string): ContextMenuItem[] => [
      {
        id: "delete-edge",
        label: t("workflow.ctx.deleteEdge", "删除连线"),
        icon: <Trash2 className="h-3.5 w-3.5" />,
        danger: true,
        onClick: () => wf.deleteEdge(edgeId),
      },
    ],
    [wf, t],
  );

  const fitAfterLayout = useCallback(() => {
    reactFlowRef.current?.fitView({ padding: 0.2, duration: 280 });
  }, []);

  const canvasMenuItems = useCallback(
    (): ContextMenuItem[] => [
      {
        id: "select-all",
        label: t("workflow.ctx.selectAll"),
        icon: <CheckSquare className="h-3.5 w-3.5" />,
        shortcut: "⌘A",
        onClick: () => wf.selectAll(),
      },
      {
        id: "layout",
        label: t("workflow.ctx.layout"),
        icon: <LayoutGrid className="h-3.5 w-3.5" />,
        children: [
          {
            id: "layout-compact",
            label: t("workflow.ctx.layoutCompact"),
            icon: <LayoutGrid className="h-3.5 w-3.5" />,
            onClick: () => wf.applyLayout("compact", { onApplied: fitAfterLayout }),
          },
          {
            id: "layout-sparse",
            label: t("workflow.ctx.layoutSparse"),
            icon: <LayoutTemplate className="h-3.5 w-3.5" />,
            onClick: () => wf.applyLayout("sparse", { onApplied: fitAfterLayout }),
          },
          {
            id: "layout-compact-lr",
            label: t("workflow.ctx.layoutCompactLr"),
            icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
            onClick: () => wf.applyLayout("compact_lr", { onApplied: fitAfterLayout }),
          },
          {
            id: "layout-force",
            label: t("workflow.ctx.layoutForce"),
            icon: <Network className="h-3.5 w-3.5" />,
            onClick: () => wf.applyLayout("force", { onApplied: fitAfterLayout }),
          },
        ],
      },
      { id: "separator", label: "" },
      {
        id: "clear-canvas",
        label: t("workflow.ctx.clearCanvas"),
        icon: <Eraser className="h-3.5 w-3.5" />,
        danger: true,
        onClick: () => wf.clearCanvas(),
      },
    ],
    [wf, t, fitAfterLayout],
  );

  const ctxMenu = useContextMenu({
    nodeItems: nodeMenuItems,
    edgeItems: edgeMenuItems,
    canvasItems: canvasMenuItems,
    selectionItems: selectionMenuItems,
  });

  // ── Selection change: exclude start/end from box select ──
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selNodes }) => {
      const startEndIds = selNodes
        .filter((n) => {
          const kind = (n.data as Record<string, unknown>)?.nodeKind;
          return kind === "start" || kind === "end";
        })
        .map((n) => n.id);
      if (startEndIds.length > 0) {
        wf.setNodes((nds) =>
          nds.map((n) => (startEndIds.includes(n.id) ? { ...n, selected: false } : n)),
        );
      }
    },
    [wf],
  );

  const handleSelectionContextMenu = useCallback(
    (event: React.MouseEvent, nodes: Node[]) => {
      const ids = nodes
        .map((n) => n.id)
        .filter((id) => {
          const n = wf.rawNodes.find((x) => x.id === id);
          return n && n.type !== "group";
        });
      if (ids.length >= 2) {
        ctxMenu.onSelectionContextMenu(event, ids);
      }
    },
    [wf.rawNodes, ctxMenu],
  );

  const onFlowInit = useCallback((instance: ReactFlowInstance<Node, Edge>) => {
    reactFlowRef.current = instance;
  }, []);

  const handleCanvasZoomIn = useCallback(() => {
    reactFlowRef.current?.zoomIn({ duration: 200 });
  }, []);

  const handleCanvasZoomOut = useCallback(() => {
    reactFlowRef.current?.zoomOut({ duration: 200 });
  }, []);

  const handlePaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === "addText" && reactFlowRef.current) {
        const pos = reactFlowRef.current.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        const newNode: Node = {
          id: generateId(),
          type: "workflowText",
          position: pos,
          data: {
            text: "文本",
            inputs: [{ id: "in-1", label: "输入" }],
            outputs: [{ id: "out-1", label: "输出" }],
          },
        };
        wf.addNode(newNode);
        setActiveTool("select");
        ctxMenu.close();
        return;
      }
      wf.clearSelection();
      ctxMenu.close();
    },
    [activeTool, wf, ctxMenu],
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (activeTool === "addText") {
        setActiveTool("select");
      }
      if (event.shiftKey) {
        wf.blurDrawerSelection();
      } else {
        wf.selectNode(event, node);
      }
    },
    [activeTool, wf],
  );

  // ── Toast on run failure ──
  useEffect(() => {
    if (wf.runStatus === "failed" && wf.runError) {
      toast.error(wf.runError, { duration: 3000 });
    }
  }, [wf.runStatus, wf.runError]);

  const nodesWithRunState = useMemo(() => {
    const hasStates = wf.nodeRunStates && Object.keys(wf.nodeRunStates).length > 0;
    const runFailed = wf.runStatus === "failed";
    if (!hasStates && !runFailed) return wf.nodes;

    return wf.nodes.map((n) => {
      const rs = hasStates ? wf.nodeRunStates[n.id] : undefined;

      // Per-node run state styling
      const cls = rs
        ? rs.status === "running"
          ? "wf-node-running"
          : rs.status === "completed"
            ? "wf-node-completed"
            : rs.status === "failed"
              ? "wf-node-failed"
              : ""
        : "";

      // Inject error info: per-node failure or run-level failure on non-completed nodes
      let extra: Record<string, unknown> = {};
      if (rs?.status === "failed" && rs.error) {
        extra = { _runError: rs.error };
      } else if (runFailed && wf.runError && rs?.status !== "completed") {
        const nk = (n.data as Record<string, unknown>).nodeKind as string | undefined;
        const isTerminal = nk === "start" || nk === "end";
        if (!isTerminal) {
          extra = { _runError: wf.runError };
        }
      }

      const data = Object.keys(extra).length > 0 ? { ...n.data, ...extra } : n.data;
      if (!cls && data === n.data) return n;
      return {
        ...n,
        data,
        className: cls ? [n.className, cls].filter(Boolean).join(" ") : n.className,
      };
    });
  }, [wf.nodes, wf.nodeRunStates, wf.runStatus, wf.runError]);

  const edgesWithRunState = useMemo(() => {
    const rs = wf.nodeRunStates;
    if (!rs || Object.keys(rs).length === 0) return wf.edges;
    return wf.edges.map((e) => {
      const srcStatus = rs[e.source]?.status;
      const tgtStatus = rs[e.target]?.status;
      if (srcStatus === "completed" && tgtStatus === "running") {
        return { ...e, className: [e.className, "wf-edge-flowing"].filter(Boolean).join(" ") };
      }
      if (srcStatus === "completed" && tgtStatus === "completed") {
        return { ...e, className: [e.className, "wf-edge-done"].filter(Boolean).join(" ") };
      }
      return e;
    });
  }, [wf.edges, wf.nodeRunStates]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/workflow-item");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.type !== "node") return;

      const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const position = reactFlowRef.current?.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      }) ?? {
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      };

      const nodeType = data.nodeType || "workflowBase";
      const nodeKind = data.nodeKind as string | undefined;
      let nodeData: Record<string, unknown>;

      if (nodeType === "workflowText") {
        nodeData = {
          text: data.label,
          inputs: [{ id: "in-1", label: "输入" }],
          outputs: [{ id: "out-1", label: "输出" }],
        };
      } else if (nodeKind === "llm") {
        nodeData = {
          label: data.label,
          nodeKind: "llm",
          provider: "openai",
          model: "gpt-4o",
          apiKey: "",
          base_url: getDefaultBaseUrl("openai"),
          useCustomBaseUrl: false,
          protocol: "openai",
          protocolAdapter: "openai",
          temperature: 0.7,
          inputs: [{ id: "in-1", label: "输入" }],
          outputs: [{ id: "out-1", label: "输出" }],
        };
      } else if (nodeKind === "agent") {
        nodeData = {
          label: data.label,
          nodeKind: "agent",
          llmNodeId: "",
          systemPrompt: "",
          userPrompt: "",
          rules: [],
          hooks: [],
          plugins: [],
          skills: [],
          inputs: [{ id: "in-1", label: "输入" }],
          outputs: [{ id: "out-1", label: "输出" }],
        };
      } else if (nodeKind === "start" || nodeKind === "end") {
        nodeData = {
          label: data.label,
          nodeKind,
          inputs: [{ id: "in-1", label: "输入" }],
          outputs: [{ id: "out-1", label: "输出" }],
        };
      } else {
        nodeData = {
          label: data.label,
          inputs: [{ id: "in-1", label: "输入" }],
          outputs: [{ id: "out-1", label: "输出" }],
        };
      }
      const newNode: Node = {
        id: generateId(),
        type: nodeType,
        position,
        data: nodeData,
      };
      wf.addNode(newNode);
    },
    [wf],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  if (wf.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEmpty = wf.nodes.length === 0 && wf.edges.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border/50 glass z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/workflow")}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
              {wf.workflow?.name ?? t("workflow.editTitle", "编辑工作流")}
            </span>
            {wf.workflow?.status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-500 font-medium">
                {wf.workflow.status}
              </span>
            )}
            {wf.dirty && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-500 font-medium">
                {t("common.unsaved", "未保存")}
              </span>
            )}
            {wf.runStatus === "running" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-500 font-medium flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {t("workflow.running", "运行中")}
              </span>
            )}
            {wf.runStatus === "completed" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-400/10 text-green-500 font-medium">
                {t("workflow.completed", "运行完成")}
              </span>
            )}
            {wf.runStatus === "failed" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-400/10 text-red-500 font-medium">
                {t("workflow.failed", "运行失败")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wf.runStatus === "running" ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 rounded-lg border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => wf.cancelRun()}
            >
              <Square className="h-3 w-3 fill-current" />
              {t("workflow.cancel", "停止")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 rounded-lg"
              onClick={() => wf.run()}
            >
              <Play className="h-3.5 w-3.5" />
              {t("workflow.run", "运行")}
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5 h-8 rounded-lg shadow-sm"
            disabled={wf.saving || !wf.dirty}
            onClick={() => wf.save()}
          >
            {wf.saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {t("common.save", "保存")}
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div ref={setMainArea} className="flex min-h-0 flex-1 relative">
        {/* Canvas */}
        <div
          className={cn("flex-1 min-w-0 relative", activeTool === "addText" && "cursor-crosshair")}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodesWithRunState}
            edges={edgesWithRunState}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={onFlowInit}
            onNodesChange={wf.onNodesChange}
            onEdgesChange={wf.onEdgesChange}
            onConnect={wf.onConnect}
            onNodeClick={handleNodeClick}
            onEdgeClick={wf.selectEdge}
            onPaneClick={handlePaneClick}
            onNodeDragStop={wf.onNodeDragStop}
            onNodeContextMenu={(e, node) => ctxMenu.onNodeContextMenu(e, node.id)}
            onEdgeContextMenu={(e, edge) => ctxMenu.onEdgeContextMenu(e, edge.id)}
            onPaneContextMenu={(e) => ctxMenu.onPaneContextMenu(e as React.MouseEvent)}
            onSelectionContextMenu={(e, nodes) =>
              handleSelectionContextMenu(e as React.MouseEvent, nodes)
            }
            onSelectionChange={onSelectionChange}
            panOnDrag={activeTool === "pan"}
            selectionOnDrag={activeTool === "select"}
            multiSelectionKeyCode="Shift"
            elementsSelectable={activeTool === "select"}
            nodesDraggable={activeTool === "select"}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => (node.type === "workflowText" ? "#818cf8" : "#60a5fa")}
              bgColor="hsl(var(--muted))"
              maskColor="hsl(var(--muted-foreground) / 0.15)"
              className="!left-4 !bottom-[60px] !w-[180px] !h-[120px] !rounded-lg"
            />
          </ReactFlow>

          {isEmpty && <EmptyOverlay />}

          <div className="absolute top-4 left-4 z-20">
            <CanvasToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onZoomIn={handleCanvasZoomIn}
              onZoomOut={handleCanvasZoomOut}
            />
          </div>

          <div className="absolute bottom-4 left-4 z-20">
            <BottomBar
              canUndo={wf.canUndo}
              canRedo={wf.canRedo}
              onUndo={wf.undo}
              onRedo={wf.redo}
            />
          </div>
        </div>

        <ComponentPanel />
      </div>

      <ConfigDrawer
        historyCursor={wf.historyCursor}
        selectedNode={wf.selectedNode}
        selectedEdge={wf.selectedEdge}
        nodes={wf.rawNodes}
        nodeRunStates={wf.nodeRunStates}
        onClose={wf.clearSelection}
        onPreviewNode={wf.previewNode}
        onPreviewEdge={wf.previewEdge}
        onCommit={wf.commitPreview}
        onRevert={wf.revertPreview}
        container={mainArea}
      />

      <ContextMenuOverlay state={ctxMenu.state} onClose={ctxMenu.close} />
    </div>
  );
}
