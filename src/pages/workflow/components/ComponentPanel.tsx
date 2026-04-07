import React from "react";
import { useTranslation } from "react-i18next";
import {
  Square,
  CircleDot,
  StopCircle,
  Type,
  ArrowRight,
  GitBranch,
  Repeat,
  BrainCircuit,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DragItem {
  type: string;
  nodeType?: string;
  nodeKind?: string;
  label: string;
  icon: React.ElementType;
  gradient: string;
}

const nodeItems: DragItem[] = [
  {
    type: "node",
    nodeType: "workflowBase",
    label: "基础节点",
    icon: Square,
    gradient: "from-sky-400 to-blue-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    label: "条件节点",
    icon: GitBranch,
    gradient: "from-amber-400 to-orange-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    label: "循环节点",
    icon: Repeat,
    gradient: "from-violet-400 to-purple-500",
  },
  {
    type: "node",
    nodeType: "workflowText",
    label: "文本节点",
    icon: Type,
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    nodeKind: "start",
    label: "起始节点",
    icon: CircleDot,
    gradient: "from-green-400 to-emerald-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    nodeKind: "end",
    label: "结束节点",
    icon: StopCircle,
    gradient: "from-rose-400 to-red-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    nodeKind: "llm",
    label: "LLM",
    icon: BrainCircuit,
    gradient: "from-cyan-400 to-blue-600",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    nodeKind: "agent",
    label: "Agent",
    icon: Bot,
    gradient: "from-fuchsia-400 to-purple-600",
  },
];

const edgeItems: DragItem[] = [
  { type: "edge", label: "有向边", icon: ArrowRight, gradient: "from-blue-400 to-indigo-500" },
];

function DragCard({ item }: { item: DragItem }) {
  const Icon = item.icon;

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/workflow-item",
      JSON.stringify({
        type: item.type,
        nodeType: item.nodeType,
        nodeKind: item.nodeKind,
        label: item.label,
      }),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 cursor-grab active:cursor-grabbing hover:bg-accent/40 transition-colors duration-150"
    >
      <div className={cn("p-1.5 rounded-md bg-gradient-to-br text-white shadow-sm", item.gradient)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-xs font-medium text-foreground">{item.label}</span>
    </div>
  );
}

export function ComponentPanel() {
  const { t } = useTranslation();

  return (
    <div className="w-52 flex flex-col glass border-l border-border/50 shadow-lg overflow-y-auto">
      <div className="p-3 border-b border-border/30">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {t("workflow.components", "组件")}
        </h3>
      </div>

      <div className="p-3 space-y-4">
        {/* Nodes */}
        <div className="space-y-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("workflow.nodes", "节点")}
          </span>
          <div className="space-y-1.5">
            {nodeItems.map((item) => (
              <DragCard key={item.label} item={item} />
            ))}
          </div>
        </div>

        {/* Edges */}
        <div className="space-y-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("workflow.edges", "连线")}
          </span>
          <div className="space-y-1.5">
            {edgeItems.map((item) => (
              <DragCard key={item.label} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
