import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Bot, Loader2, Save } from "lucide-react";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergeSkillCatalogItems, listLocalAgentSkillsFromTauri } from "@/lib/localAgentSkills";
import { agentApi, type AgentSkillCatalogOut, type AgentSkillSourceItem } from "@/services/agent";
import { AgentSkillConfigBlock } from "./components/AgentSkillConfigBlock";
import { AgentSystemPromptBlock, type PromptTplKey } from "./components/AgentSystemPromptBlock";
import { AGENT_PROVIDER_IDS, coerceAgentProviderId, type AgentProviderId } from "./utils";
import { useAgentProviderModels } from "./hooks/useAgentProviderModels";

function readSkillsConfig(cfg: Record<string, unknown>): string[] {
  const raw = cfg.skills;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export function AgentEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>();

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<AgentProviderId>("openai");
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [configBase, setConfigBase] = useState<Record<string, unknown>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skillItems, setSkillItems] = useState<AgentSkillSourceItem[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  /** `config.skills` last read from the API (or after successful save) — for header “in use (server)”. */
  const [serverSkillIds, setServerSkillIds] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);

  const { models, loading, defaultModelId } = useAgentProviderModels(provider);

  const resolvedModelId = useMemo(() => {
    if (pageLoading) return modelId;
    if (models.length === 0) return "";
    if (modelId && models.some((m) => m.id === modelId)) return modelId;
    return defaultModelId;
  }, [pageLoading, models, modelId, defaultModelId]);

  useEffect(() => {
    if (!agentId) {
      navigate("/agent");
      return;
    }
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setPageLoading(true);
      try {
        const a = await agentApi.get(agentId);
        if (cancelled) return;
        setName(a.name);
        setPrompt(a.system_prompt ?? t("agent.defaultAssistantPrompt"));
        setModelId(a.model ?? "");
        const cfg = { ...(a.config ?? {}) };
        setConfigBase(cfg);
        setProvider(coerceAgentProviderId(String(cfg.llm_provider ?? "openai")));
        setSelectedSkillIds(readSkillsConfig(cfg));
        setSkillsLoading(true);
        try {
          if (cancelled) return;
          const cat = a.skill_catalog;
          const local = await listLocalAgentSkillsFromTauri();
          setSkillItems(mergeSkillCatalogItems(cat.items, local));
          setSelectedSkillIds(cat.selected);
          setServerSkillIds(cat.selected);
        } catch {
          if (!cancelled) {
            setSkillItems([]);
            setServerSkillIds(readSkillsConfig(cfg));
            toast.error(t("agent.skillsLoadError"));
          }
        } finally {
          if (!cancelled) setSkillsLoading(false);
        }
      } catch {
        if (!cancelled) {
          toast.error(t("agent.loadError"));
          navigate("/agent");
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, navigate, t]);

  const applyTemplate = (key: PromptTplKey) => {
    setPrompt(t(`agent.promptTpl.${key}Body`));
  };

  const toggleSkill = useCallback((id: string) => {
    setSelectedSkillIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return Array.from(s);
    });
  }, []);

  const onSkillCatalogFromServer = useCallback((out: AgentSkillCatalogOut) => {
    void (async () => {
      const local = await listLocalAgentSkillsFromTauri();
      setSkillItems(mergeSkillCatalogItems(out.items, local));
      setSelectedSkillIds(out.selected);
      setServerSkillIds(out.selected);
      setConfigBase((c) => ({ ...c, skills: out.selected }));
    })();
  }, []);

  const handleSave = async () => {
    if (!agentId || !name.trim()) return;
    setSaving(true);
    try {
      const nextConfig = { ...configBase, llm_provider: provider, skills: selectedSkillIds };
      const updated = await agentApi.update(agentId, {
        name: name.trim(),
        system_prompt: prompt,
        model: resolvedModelId || null,
        config: nextConfig,
      });
      setConfigBase(updated.config ?? nextConfig);
      setServerSkillIds(
        readSkillsConfig((updated.config ?? nextConfig) as Record<string, unknown>),
      );
      toast.success(t("agent.saveSuccess"));
    } catch {
      toast.error(t("agent.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SubPageLayout
      titleKey="agent.editTitle"
      descriptionKey="agent.editDesc"
      icon={Bot}
      iconGradient="from-emerald-400 to-teal-500"
      className="max-w-7xl 2xl:max-w-[90rem]"
      actions={
        <Button
          size="sm"
          className="gap-1.5"
          disabled={pageLoading || saving || !name.trim()}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("common.save")}
        </Button>
      }
    >
      {pageLoading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t("agent.pageLoading")}</span>
        </div>
      ) : (
        <div className="space-y-8 w-full">
          <div className="space-y-5 min-w-0">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="agent-name">
                {t("agent.nameLabel")}
              </label>
              <Input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("agent.namePlaceholder")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 min-w-0">
                <label className="text-sm font-medium text-foreground">
                  {t("agent.providerLabel")}
                </label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    setProvider(v as AgentProviderId);
                    setModelId("");
                  }}
                >
                  <SelectTrigger className="rounded-lg w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_PROVIDER_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {t(`agent.llmProvider.${id}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 min-w-0">
                <label className="text-sm font-medium text-foreground">
                  {t("agent.modelLabel")}
                </label>
                <Select
                  value={resolvedModelId || undefined}
                  onValueChange={setModelId}
                  disabled={loading || models.length === 0}
                >
                  <SelectTrigger className="rounded-lg w-full">
                    <div className="flex w-full min-w-0 items-center gap-2">
                      {loading && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      )}
                      <SelectValue
                        placeholder={
                          loading ? t("agent.modelLoading") : t("agent.modelPlaceholder")
                        }
                      />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {models.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        {t("agent.modelEmpty")}
                      </div>
                    ) : (
                      models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name || m.id}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <AgentSystemPromptBlock
            prompt={prompt}
            onPromptChange={setPrompt}
            applyTemplate={applyTemplate}
          />

          {agentId ? (
            <AgentSkillConfigBlock
              agentId={agentId}
              skillItems={skillItems}
              skillsLoading={skillsLoading}
              serverEnabledCount={serverSkillIds.length}
              serverSkillIds={serverSkillIds}
              selectedSkillIds={selectedSkillIds}
              onCatalogUpdate={onSkillCatalogFromServer}
              onToggleSkill={toggleSkill}
            />
          ) : null}
        </div>
      )}
    </SubPageLayout>
  );
}
