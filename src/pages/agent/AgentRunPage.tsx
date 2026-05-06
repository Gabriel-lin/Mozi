import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Bot, Pencil } from "lucide-react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { agentApi, type RunOut } from "@/services/agent";
import { useAgentRunRuntime } from "@/pages/agent/hooks/useAgentRunRuntime";
import { AgentRunGrokThread } from "@/pages/agent/components/AgentRunGrokThread";
import { AgentRunHistorySidebar } from "@/pages/agent/components/AgentRunHistorySidebar";
import { cn } from "@/lib/utils";
import { coerceAgentProviderId, type AgentProviderId } from "@/pages/agent/utils";

export function AgentRunPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>();
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentDefaultModel, setAgentDefaultModel] = useState<string | null>(null);
  const [agentLlmProvider, setAgentLlmProvider] = useState<AgentProviderId>(() =>
    coerceAgentProviderId("openai"),
  );
  const [runs, setRuns] = useState<RunOut[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const fetchRuns = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!agentId) return;
      if (!opts?.silent) setRunsLoading(true);
      try {
        const out = await agentApi.listRuns(agentId, 1, 40);
        setRuns(out.runs);
      } catch {
        setRuns([]);
      } finally {
        if (!opts?.silent) setRunsLoading(false);
      }
    },
    [agentId],
  );

  useEffect(() => {
    if (!agentId) {
      navigate("/agent");
      return;
    }
    let cancelled = false;
    (async () => {
      setRunsLoading(true);
      setAgentDefaultModel(null);
      setAgentLlmProvider(coerceAgentProviderId("openai"));
      try {
        const [a, list] = await Promise.all([
          agentApi.get(agentId),
          agentApi.listRuns(agentId, 1, 40),
        ]);
        if (cancelled) return;
        setAgentName(a.name);
        setAgentDefaultModel(a.model ?? null);
        const cfg = a.config ?? {};
        setAgentLlmProvider(coerceAgentProviderId(String(cfg.llm_provider ?? "openai")));
        setRuns(list.runs);
      } catch {
        if (!cancelled) navigate("/agent");
      } finally {
        if (!cancelled) setRunsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, navigate]);

  const {
    runtime,
    loadRun,
    clearThread,
    dictationSupported,
    composerModel,
    setComposerModel,
    modelSelectRows,
    modelsLoading,
  } = useAgentRunRuntime({
    agentId,
    agentLlmProvider,
    agentDefaultModel,
    onRunSettled: () => {
      void fetchRuns({ silent: true });
    },
  });

  const onNewChat = useCallback(() => {
    clearThread();
    setSelectedRunId(null);
  }, [clearThread]);

  const onSelectRun = useCallback(
    async (runId: string) => {
      setSelectedRunId(runId);
      try {
        await loadRun(runId);
      } catch {
        setSelectedRunId(null);
      }
    },
    [loadRun],
  );

  if (!agentId) return null;

  return (
    <div
      className={cn(
        "flex h-full max-h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gradient-to-b from-background via-background to-muted/25",
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md ring-2 ring-emerald-500/25">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
                {t("agent.runTitle")}
              </h1>
              {agentName ? (
                <p className="truncate text-xs text-muted-foreground">{agentName}</p>
              ) : null}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 border-emerald-500/20 hover:bg-emerald-500/5"
          asChild
        >
          <Link to={`/agent/${agentId}/edit`}>
            <Pencil className="h-3.5 w-3.5" />
            {t("agent.editTitle")}
          </Link>
        </Button>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden p-2 md:flex-row md:gap-3 md:p-4">
        <AgentRunHistorySidebar
          runs={runs}
          loading={runsLoading}
          selectedRunId={selectedRunId}
          onSelectRun={onSelectRun}
          onNewChat={onNewChat}
          onRunsChanged={() => {
            void fetchRuns({ silent: true });
          }}
        />
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm ring-1 ring-border/30 backdrop-blur-sm dark:bg-card/30">
          <AssistantRuntimeProvider runtime={runtime}>
            <AgentRunGrokThread
              agentName={agentName}
              dictationSupported={dictationSupported}
              composerModel={composerModel}
              onComposerModelChange={setComposerModel}
              modelSelectRows={modelSelectRows}
              modelsLoading={modelsLoading}
            />
          </AssistantRuntimeProvider>
        </div>
      </div>
    </div>
  );
}
