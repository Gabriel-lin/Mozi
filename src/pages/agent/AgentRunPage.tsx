import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Play, Square, Terminal } from "lucide-react";
import { agentApi } from "@/services/agent";

export function AgentRunPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>();
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState("");
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) {
      navigate("/agent");
      return;
    }
    let cancelled = false;
    agentApi
      .get(agentId)
      .then((a) => {
        if (!cancelled) setAgentName(a.name);
      })
      .catch(() => {
        if (!cancelled) navigate("/agent");
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, navigate]);

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
          {running ? t("agent.stop") : t("agent.run")}
        </Button>
      }
    >
      <div className="space-y-4">
        {agentName && (
          <p className="text-sm text-muted-foreground">
            {t("agent.runAgentLabel")}:{" "}
            <span className="font-medium text-foreground">{agentName}</span>
          </p>
        )}

        <div className="rounded-xl border border-border bg-muted/30 p-4 min-h-[300px] font-mono text-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Terminal className="h-4 w-4" />
            <span>{t("agent.console")}</span>
          </div>
          <div className="text-muted-foreground/60 text-xs">
            {running ? t("agent.waiting") : t("agent.readyHint")}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("agent.inputPlaceholder")}
            disabled={!running}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) setInput("");
            }}
          />
          <Button disabled={!running || !input.trim()} className="shrink-0">
            {t("agent.send")}
          </Button>
        </div>
      </div>
    </SubPageLayout>
  );
}
