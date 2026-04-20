import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { NodeRunState } from "../../hooks/useWorkflowRun";
import { formatDuration, formatTime, formatValue } from "../../utils";

export interface RunDetailPanelProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  runState: NodeRunState | undefined;
}

/**
 * "运行详情" tab — reflects the live per-node run state streamed via the
 * workflow WebSocket. Shows an empty placeholder until the selected node
 * has been touched by a run.
 */
export function RunDetailPanel({ selectedNode, selectedEdge, runState }: RunDetailPanelProps) {
  const { t } = useTranslation();

  if (selectedEdge && !selectedNode) {
    return <RunEmptyState text={t("workflow.runNoEdgeDetail")} />;
  }

  if (!runState || runState.status === "idle") {
    return <RunEmptyState text={t("workflow.runNoData")} />;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 text-xs">
      <StatusRow status={runState.status} />
      <TimingRow startedAt={runState.startedAt} completedAt={runState.completedAt} />
      {runState.error ? (
        <DetailSection label={t("workflow.runError")}>
          <pre className="whitespace-pre-wrap break-words rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
            {runState.error}
          </pre>
        </DetailSection>
      ) : null}
      {runState.output !== undefined && runState.output !== null ? (
        <DetailSection label={t("workflow.runOutput")}>
          <pre className="whitespace-pre-wrap break-words rounded-md border border-border/50 bg-muted/30 p-2 font-mono text-[11px] text-foreground">
            {formatValue(runState.output)}
          </pre>
        </DetailSection>
      ) : null}
      {runState.input !== undefined && runState.input !== null ? (
        <DetailSection label={t("workflow.runInput")}>
          <pre className="whitespace-pre-wrap break-words rounded-md border border-border/50 bg-muted/30 p-2 font-mono text-[11px] text-foreground">
            {formatValue(runState.input)}
          </pre>
        </DetailSection>
      ) : null}
    </div>
  );
}

// ── Internal subcomponents ──

function RunEmptyState({ text }: { text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
      <CircleDashed className="h-8 w-8 opacity-60" />
      <p className="text-xs">{text}</p>
    </div>
  );
}

function StatusRow({ status }: { status: NodeRunState["status"] }) {
  const { t } = useTranslation();
  const { Icon, label, className } = useMemo(() => {
    switch (status) {
      case "running":
        return {
          Icon: Loader2,
          label: t("workflow.statusRunning"),
          className: "text-amber-500",
        };
      case "completed":
        return {
          Icon: CheckCircle2,
          label: t("workflow.statusCompleted"),
          className: "text-emerald-500",
        };
      case "failed":
        return {
          Icon: AlertCircle,
          label: t("workflow.statusFailed"),
          className: "text-destructive",
        };
      case "skipped":
        return {
          Icon: CircleDashed,
          label: t("workflow.statusSkipped"),
          className: "text-muted-foreground",
        };
      default:
        return {
          Icon: CircleDashed,
          label: t("workflow.statusIdle"),
          className: "text-muted-foreground",
        };
    }
  }, [status, t]);

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4", className, status === "running" && "animate-spin")} />
      <span className={cn("text-xs font-medium", className)}>{label}</span>
    </div>
  );
}

function TimingRow({ startedAt, completedAt }: { startedAt?: number; completedAt?: number }) {
  const { t } = useTranslation();
  if (!startedAt && !completedAt) return null;
  const duration = startedAt && completedAt ? Math.max(0, completedAt - startedAt) : null;

  return (
    <div className="grid grid-cols-3 gap-2 text-[11px]">
      <LabeledCell
        label={t("workflow.runStartedAt")}
        value={startedAt ? formatTime(startedAt) : "—"}
      />
      <LabeledCell
        label={t("workflow.runCompletedAt")}
        value={completedAt ? formatTime(completedAt) : "—"}
      />
      <LabeledCell
        label={t("workflow.runDuration")}
        value={duration !== null ? formatDuration(duration) : "—"}
      />
    </div>
  );
}

function LabeledCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[11px] text-foreground">{value}</span>
    </div>
  );
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
