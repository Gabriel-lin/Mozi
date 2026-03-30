import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { GitBranch, Play, Square, Terminal, CheckCircle, Clock } from "lucide-react";

export function WorkflowRunPage() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);

  return (
    <SubPageLayout
      titleKey="workflow.runTitle"
      descriptionKey="workflow.runDesc"
      icon={GitBranch}
      iconGradient="from-sky-400 to-indigo-500"
      actions={
        <Button
          size="sm"
          variant={running ? "destructive" : "default"}
          className="gap-1.5"
          onClick={() => setRunning(!running)}
        >
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? t("workflow.stop", "停止") : t("workflow.run", "运行")}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {["Input", "Transform", "Output"].map((step, i) => (
            <div key={step} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-muted text-xs font-medium text-muted-foreground">
                {i + 1}
              </div>
              <span className="text-sm font-medium text-foreground flex-1">{step}</span>
              {running && i === 0 ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 min-h-[200px] font-mono text-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Terminal className="h-4 w-4" />
            <span>{t("workflow.logs", "执行日志")}</span>
          </div>
          <div className="text-muted-foreground/60 text-xs">
            {running
              ? t("workflow.executing", "工作流执行中...")
              : t("workflow.readyHint", "点击运行按钮启动工作流")}
          </div>
        </div>
      </div>
    </SubPageLayout>
  );
}
