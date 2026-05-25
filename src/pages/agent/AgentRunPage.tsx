import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Bot, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agentApi, type RunOut } from "@/services/agent";
// import { AgentRunPageShadcnBody } from "@/pages/agent/components/AgentRunPageShadcnBody";
// import { AgentRunSession } from "@/pages/agent/AgentRunSession";
import { Shadcn } from "@/pages/agent/components/AssistantUiShadcnExample";
import { LangGraphRuntimeProvider } from "@/pages/agent/components/LangGraphRuntimeProvider";
import { cn } from "@/lib/utils";
import { AgentProviderId, coerceAgentProviderId, modelDisplayLabel } from "./utils";
import { useAgentProviderModels } from "./hooks/useAgentProviderModels";
import type { ModelOption } from "@/components/assistant-ui/model-selector";

export function AgentRunPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>();
  const [_agentName, setAgentName] = useState<string | null>(null);
  const [agentDefaultModel, setAgentDefaultModel] = useState<string | null>(null);
  const [agentLlmProvider, setAgentLlmProvider] = useState<AgentProviderId>(() =>
    coerceAgentProviderId("openai"),
  );
  const [_runs, setRuns] = useState<RunOut[]>([]);
  const [_runsLoading, setRunsLoading] = useState(true);
  const [_selectedRunId, setSelectedRunId] = useState<string | null>(null);
  /** Bumps when starting a blank thread so `AgentRunSession` remounts with a clean runtime. */
  const [_draftEpoch, setDraftEpoch] = useState(0);

  const _fetchRuns = useCallback(
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
        setSelectedRunId(null);
        setDraftEpoch(0);
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

  const _onNewChat = useCallback(() => {
    setSelectedRunId(null);
    setDraftEpoch((n) => n + 1);
  }, []);

  const _onSelectRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
  }, []);

  // Mirror the edit page's provider-aware model catalog so the run-page
  // selector matches what the user just configured (live API, OpenRouter
  // fallback, or static fallback — handled inside the hook).
  const {
    models: providerModels,
    loading: providerModelsLoading,
    defaultModelId,
  } = useAgentProviderModels(agentLlmProvider);

  const modelOptions = useMemo<ModelOption[]>(
    () =>
      providerModels.map((m) => ({
        id: m.id,
        name: modelDisplayLabel(m.name, m.id),
      })),
    [providerModels],
  );

  // Initial picker value = saved agent model when valid, otherwise the
  // provider's default. Switching models in the picker is per-session and
  // never writes back to ``agentApi.update``.
  const initialModel = useMemo(() => {
    if (agentDefaultModel && providerModels.some((m) => m.id === agentDefaultModel)) {
      return agentDefaultModel;
    }
    return defaultModelId || agentDefaultModel || "";
  }, [agentDefaultModel, providerModels, defaultModelId]);

  if (!agentId) return null;

  const _sessionMountKey = `${agentId}-${_selectedRunId ?? `draft-${_draftEpoch}`}`;

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
              <p className="truncate text-xs text-muted-foreground">{agentId}</p>
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

      {/* <AgentRunPageShadcnBody
        runs={runs}
        loading={runsLoading}
        selectedRunId={selectedRunId}
        onSelectRun={onSelectRun}
        onNewChat={onNewChat}
        onRunsChanged={() => {
          void fetchRuns({ silent: true });
        }}
        agentName={agentName}
      >
        <AgentRunSession
          key={sessionMountKey}
          agentId={agentId}
          selectedRunId={selectedRunId}
          agentLlmProvider={agentLlmProvider}
          agentDefaultModel={agentDefaultModel}
          agentName={agentName}
          onRunSettled={() => {
            void fetchRuns({ silent: true });
          }}
        />
      </AgentRunPageShadcnBody> */}

      <div className="min-h-0 flex-1 overflow-hidden">
        <LangGraphRuntimeProvider
          agentId={agentId}
          initialModel={initialModel}
          models={modelOptions}
          modelsLoading={providerModelsLoading}
        >
          <Shadcn />
        </LangGraphRuntimeProvider>
      </div>
    </div>
  );
}
