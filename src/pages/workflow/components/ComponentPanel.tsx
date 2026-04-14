import React from "react";
import { useTranslation } from "react-i18next";
import {
  Square,
  CircleDot,
  StopCircle,
  Type,
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
  /** i18n key under workflow.palette.* */
  labelKey: string;
  icon: React.ElementType;
  gradient: string;
}

const flowNodeItems: DragItem[] = [
  {
    type: "node",
    nodeType: "workflowBase",
    labelKey: "basicNode",
    icon: Square,
    gradient: "from-sky-400 to-blue-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    labelKey: "conditionNode",
    icon: GitBranch,
    gradient: "from-amber-400 to-orange-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    labelKey: "loopNode",
    icon: Repeat,
    gradient: "from-violet-400 to-purple-500",
  },
  {
    type: "node",
    nodeType: "workflowText",
    labelKey: "textNode",
    icon: Type,
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    nodeKind: "start",
    labelKey: "startNode",
    icon: CircleDot,
    gradient: "from-green-400 to-emerald-500",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    nodeKind: "end",
    labelKey: "endNode",
    icon: StopCircle,
    gradient: "from-rose-400 to-red-500",
  },
];

const functionNodeItems: DragItem[] = [
  {
    type: "node",
    nodeType: "workflowBase",
    nodeKind: "llm",
    labelKey: "llm",
    icon: BrainCircuit,
    gradient: "from-cyan-400 to-blue-600",
  },
  {
    type: "node",
    nodeType: "workflowBase",
    nodeKind: "agent",
    labelKey: "agent",
    icon: Bot,
    gradient: "from-fuchsia-400 to-purple-600",
  },
];

function DragCard({ item }: { item: DragItem }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(`workflow.palette.${item.labelKey}`);

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/workflow-item",
      JSON.stringify({
        type: item.type,
        nodeType: item.nodeType,
        nodeKind: item.nodeKind,
        label,
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
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  );
}

function NodeSection({ title, items }: { title: string; items: DragItem[] }) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
      <div className="space-y-1.5">
        {items.map((item) => (
          <DragCard
            key={`${item.labelKey}-${item.nodeKind ?? item.nodeType ?? "base"}`}
            item={item}
          />
        ))}
      </div>
    </div>
  );
}

export function ComponentPanel() {
  const { t } = useTranslation();

  return (
    <div className="w-52 flex flex-col glass border-l border-border/50 shadow-lg overflow-y-auto">
      <div className="p-3 border-b border-border/30">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {t("workflow.components")}
        </h3>
      </div>

      <div className="p-3 space-y-4">
        <div className="space-y-3">
          <NodeSection title={t("workflow.flowNodes")} items={flowNodeItems} />
          <NodeSection title={t("workflow.functionNodes")} items={functionNodeItems} />
        </div>
      </div>
    </div>
  );
}
