import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Network, Play, Square, Terminal, Circle } from "lucide-react";

export function SwarmRunPage() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);

  const nodes = [
    { id: "1", name: "Agent-A", status: "idle" },
    { id: "2", name: "Agent-B", status: "idle" },
    { id: "3", name: "Agent-C", status: "idle" },
  ];

  return (
    <SubPageLayout
      titleKey="swarm.runTitle"
      descriptionKey="swarm.runDesc"
      icon={Network}
      iconGradient="from-teal-400 to-cyan-500"
      actions={
        <Button
          size="sm"
          variant={running ? "destructive" : "default"}
          className="gap-1.5"
          onClick={() => setRunning(!running)}
        >
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? t("swarm.stop", "停止") : t("swarm.run", "运行")}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          {nodes.map(({ id, name, status: _status }) => (
            <div key={id} className="p-4 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{name}</span>
                <Circle
                  className={`h-2.5 w-2.5 ${running ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/30 text-muted-foreground/30"}`}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {running ? t("swarm.nodeRunning", "运行中") : t("swarm.nodeIdle", "空闲")}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 min-h-[200px] font-mono text-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Terminal className="h-4 w-4" />
            <span>{t("swarm.logs", "集群日志")}</span>
          </div>
          <div className="text-muted-foreground/60 text-xs">
            {running
              ? t("swarm.executing", "集群运行中...")
              : t("swarm.readyHint", "点击运行按钮启动集群")}
          </div>
        </div>
      </div>
    </SubPageLayout>
  );
}
