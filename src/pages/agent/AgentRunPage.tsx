import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Play, Square, Terminal } from "lucide-react";

export function AgentRunPage() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState("");

  return (
    <SubPageLayout
      titleKey="agent.runTitle"
      descriptionKey="agent.runDesc"
      icon={Bot}
      iconGradient="from-emerald-400 to-teal-500"
      actions={
        <Button
          size="sm"
          variant={running ? "destructive" : "default"}
          className="gap-1.5"
          onClick={() => setRunning(!running)}
        >
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? t("agent.stop", "停止") : t("agent.run", "运行")}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 p-4 min-h-[300px] font-mono text-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Terminal className="h-4 w-4" />
            <span>{t("agent.console", "控制台输出")}</span>
          </div>
          <div className="text-muted-foreground/60 text-xs">
            {running
              ? t("agent.waiting", "等待智能体响应...")
              : t("agent.readyHint", "点击运行按钮启动智能体")}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("agent.inputPlaceholder", "输入消息...")}
            disabled={!running}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) setInput("");
            }}
          />
          <Button disabled={!running || !input.trim()} className="shrink-0">
            {t("agent.send", "发送")}
          </Button>
        </div>
      </div>
    </SubPageLayout>
  );
}
