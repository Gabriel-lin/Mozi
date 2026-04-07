import React, { useCallback, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ReactFlow, Background, BackgroundVariant, MiniMap, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { workflowNodeTypes, workflowEdgeTypes, generateId } from "@mozi/core/workflow/views";
import { useWorkflow } from "./hooks";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2, Play, Square } from "lucide-react";

import {
  CanvasToolbar,
  BottomBar,
  ComponentPanel,
  ConfigDrawer,
  EmptyOverlay,
  type CanvasTool,
} from "./components";

export function WorkflowEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const wf = useWorkflow({ workflowId: id });
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [mainArea, setMainArea] = useState<HTMLDivElement | null>(null);

  const nodeTypes = useMemo(() => workflowNodeTypes, []);
  const edgeTypes = useMemo(() => workflowEdgeTypes, []);

  const nodesWithRunState = useMemo(() => {
    if (!wf.nodeRunStates || Object.keys(wf.nodeRunStates).length === 0) return wf.nodes;
    return wf.nodes.map((n) => {
      const rs = wf.nodeRunStates[n.id];
      if (!rs) return n;
      const cls =
        rs.status === "running"
          ? "wf-node-running"
          : rs.status === "completed"
            ? "wf-node-completed"
            : rs.status === "failed"
              ? "wf-node-failed"
              : "";
      if (!cls) return n;
      return { ...n, className: [n.className, cls].filter(Boolean).join(" ") };
    });
  }, [wf.nodes, wf.nodeRunStates]);

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
          model: "",
          apiKey: "",
          apiBase: "",
          protocol: "openai",
          protocolAdapter: "",
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
        position: { x: e.clientX - bounds.left, y: e.clientY - bounds.top },
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
        <div className="flex-1 min-w-0 relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodesWithRunState}
            edges={edgesWithRunState}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={wf.onNodesChange}
            onEdgesChange={wf.onEdgesChange}
            onConnect={wf.onConnect}
            onNodeClick={wf.selectNode}
            onEdgeClick={wf.selectEdge}
            onPaneClick={wf.clearSelection}
            onNodeDragStop={wf.onNodeDragStop}
            panOnDrag={activeTool === "pan"}
            selectionOnDrag={activeTool === "select"}
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
              style={{ left: 16, bottom: 60, width: 180, height: 120, borderRadius: 8 }}
            />
          </ReactFlow>

          {isEmpty && <EmptyOverlay />}

          <div className="absolute top-4 left-4 z-20">
            <CanvasToolbar activeTool={activeTool} onToolChange={setActiveTool} />
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
        selectedNode={wf.selectedNode}
        selectedEdge={wf.selectedEdge}
        nodes={wf.rawNodes}
        onClose={wf.clearSelection}
        onPreviewNode={wf.previewNode}
        onPreviewEdge={wf.previewEdge}
        onCommit={wf.commitPreview}
        onRevert={wf.revertPreview}
        container={mainArea}
      />
    </div>
  );
}
