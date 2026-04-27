import { useEffect, useMemo, useState } from "react";
import { getDefaultBaseUrl } from "@/pages/workflow/llmProviderDefaults";
import { llmApi, type ProviderModel } from "@/services/llm";
import { FALLBACK_MODELS, type AgentProviderId } from "../utils";

export function useAgentProviderModels(provider: AgentProviderId) {
  const fallback = useMemo(() => FALLBACK_MODELS[provider] ?? [], [provider]);
  const apiBase = useMemo(() => getDefaultBaseUrl(provider), [provider]);

  const [fetchResult, setFetchResult] = useState<{
    models: ProviderModel[];
    source: "live" | "openrouter" | "none";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    llmApi
      .getProviderModels(provider, undefined, apiBase || undefined)
      .then((res) => {
        if (cancelled) return;
        const models = res.models ?? [];
        const src = res.source ?? "none";
        setFetchResult({
          models,
          source: models.length > 0 ? (src as "live" | "openrouter") : "none",
        });
      })
      .catch(() => {
        if (!cancelled) setFetchResult({ models: [], source: "none" });
      });

    return () => {
      cancelled = true;
    };
  }, [provider, apiBase]);

  const loading = fetchResult === null;

  const hasRemote =
    fetchResult != null && fetchResult.source !== "none" && fetchResult.models.length > 0;

  const models = useMemo(() => {
    if (hasRemote) return fetchResult!.models;
    return fallback;
  }, [hasRemote, fetchResult, fallback]);

  const defaultModelId = useMemo(
    () => models.find((m) => m.default)?.id ?? models[0]?.id ?? "",
    [models],
  );

  return { models, loading, defaultModelId };
}
