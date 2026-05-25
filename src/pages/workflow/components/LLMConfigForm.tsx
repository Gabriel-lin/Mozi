import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Settings, ChevronDown, Loader2 } from "lucide-react";
import type { Node } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { ConfigField } from "./ConfigField";
import { ImeInput } from "./ImeInput";
import { cn } from "@/lib/utils";
import { llmApi, type ProviderModel } from "@/services/llm";
import {
  getDefaultBaseUrl,
  inferUseCustomBaseUrl,
  initialApiBaseField,
} from "@/pages/workflow/llmProviderDefaults";

const PROVIDER_ICON_MAP: Record<string, string> = {
  openai: "/icons/providers/openai.png",
  anthropic: "/icons/providers/anthropic.png",
  google: "/icons/providers/google.png",
  deepseek: "/icons/providers/deepseek.png",
  zhipu: "/icons/providers/zhipu.png",
  moonshot: "/icons/providers/moonshot.png",
  qwen: "/icons/providers/qwen.png",
  ollama: "/icons/providers/ollama.png",
};

function ProviderIcon({ id, className }: { id: string; className?: string }) {
  const c = className ?? "h-3.5 w-3.5";
  const src = PROVIDER_ICON_MAP[id];
  if (src) {
    return <img src={src} alt={id} className={cn(c, "object-contain")} />;
  }
  return <Settings className={c} />;
}

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "zhipu", label: "智谱 AI" },
  { value: "moonshot", label: "Moonshot" },
  { value: "qwen", label: "通义千问" },
  { value: "ollama", label: "Ollama" },
  { value: "custom", label: "自定义" },
] as const;

const PROTOCOL_ADAPTERS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
] as const;

type ProtocolAdapter = (typeof PROTOCOL_ADAPTERS)[number]["value"];

type Provider = (typeof PROVIDERS)[number]["value"];

const FALLBACK_MODELS: Record<string, ProviderModel[]> = {
  openai: [
    { id: "gpt-4o", name: "GPT-4o", default: true },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-4", name: "GPT-4" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    { id: "o1", name: "o1" },
    { id: "o1-mini", name: "o1-mini" },
    { id: "o3-mini", name: "o3-mini" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", default: true },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
  ],
  google: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", default: true },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek Chat (V3)", default: true },
    { id: "deepseek-reasoner", name: "DeepSeek Reasoner (R1)" },
  ],
  zhipu: [
    { id: "glm-4-plus", name: "GLM-4-Plus", default: true },
    { id: "glm-4-air", name: "GLM-4-Air" },
    { id: "glm-4-flash", name: "GLM-4-Flash" },
    { id: "glm-4-long", name: "GLM-4-Long" },
  ],
  moonshot: [
    { id: "moonshot-v1-128k", name: "Moonshot v1 128K", default: true },
    { id: "moonshot-v1-32k", name: "Moonshot v1 32K" },
    { id: "moonshot-v1-8k", name: "Moonshot v1 8K" },
  ],
  qwen: [
    { id: "qwen-max", name: "Qwen Max", default: true },
    { id: "qwen-plus", name: "Qwen Plus" },
    { id: "qwen-turbo", name: "Qwen Turbo" },
    { id: "qwen-long", name: "Qwen Long" },
  ],
  ollama: [
    { id: "llama3", name: "Llama 3", default: true },
    { id: "mistral", name: "Mistral" },
    { id: "codellama", name: "Code Llama" },
    { id: "gemma", name: "Gemma" },
    { id: "qwen2", name: "Qwen2" },
  ],
};

interface LLMConfigFormProps {
  node: Node;
  onPreview: (id: string, updates: Record<string, unknown>) => void;
  onConfirm: () => void;
}

function getData(node: Node) {
  return (node.data ?? {}) as Record<string, unknown>;
}

type ModelsSource = "live" | "openrouter" | "fallback" | "none";

function useProviderModels(provider: Provider, apiKey?: string, apiBase?: string) {
  const fallback = useMemo(() => FALLBACK_MODELS[provider] ?? [], [provider]);
  const isCustom = provider === "custom";

  const [fetchResult, setFetchResult] = useState<{
    provider: string;
    models: ProviderModel[];
    source: "live" | "openrouter" | "none";
  } | null>(null);

  useEffect(() => {
    if (isCustom) return;
    let cancelled = false;

    llmApi
      .getProviderModels(provider, apiKey, apiBase)
      .then((res) => {
        if (cancelled) return;
        const models = res.models ?? [];
        const src = res.source ?? "none";
        setFetchResult({
          provider,
          models,
          source: models.length > 0 ? (src as "live" | "openrouter") : "none",
        });
      })
      .catch(() => {
        if (!cancelled) setFetchResult({ provider, models: [], source: "none" });
      });

    return () => {
      cancelled = true;
    };
  }, [provider, apiKey, apiBase, isCustom]);

  const currentResult = fetchResult?.provider === provider ? fetchResult : null;
  const loading = !isCustom && !currentResult;

  const hasRemoteModels =
    currentResult != null && currentResult.source !== "none" && currentResult.models.length > 0;

  const models = useMemo(() => {
    if (isCustom) return [];
    if (hasRemoteModels) return currentResult!.models;
    return fallback;
  }, [isCustom, hasRemoteModels, currentResult, fallback]);

  const source: ModelsSource = isCustom
    ? "none"
    : hasRemoteModels
      ? (currentResult!.source as ModelsSource)
      : "fallback";

  const defaultModel = useMemo(
    () => models.find((m) => m.default)?.id ?? models[0]?.id ?? "",
    [models],
  );

  return { models, loading, defaultModel, source };
}

export function LLMConfigForm({ node, onPreview, onConfirm }: LLMConfigFormProps) {
  const { t } = useTranslation();
  const d = getData(node);
  const graphLabel = String(d.label ?? "LLM");

  const [label, setLabel] = useState(graphLabel);
  // 画布 inline 编辑后，`graphLabel` 会变化，需要同步到本地表单状态。
  // 使用 "adjust state while rendering" 模式代替 useEffect + setState。
  const [trackedGraphLabel, setTrackedGraphLabel] = useState(graphLabel);
  if (graphLabel !== trackedGraphLabel) {
    setTrackedGraphLabel(graphLabel);
    setLabel(graphLabel);
  }
  const [provider, setProvider] = useState<Provider>((d.provider as Provider) ?? "openai");
  const [model, setModel] = useState(String(d.model ?? ""));
  const [apiKey, setApiKey] = useState(String(d.apiKey ?? ""));
  const [apiBase, setApiBase] = useState(() => initialApiBaseField(d));
  const isCustomProvider = provider === "custom";
  const [useCustomBaseUrl, setUseCustomBaseUrl] = useState(() => inferUseCustomBaseUrl(d));
  const effectiveCustomBase = isCustomProvider || useCustomBaseUrl;
  const [protocolAdapter, setProtocolAdapter] = useState<ProtocolAdapter>(
    (d.protocolAdapter as ProtocolAdapter) || "openai",
  );
  const [temperature, setTemperature] = useState(Number(d.temperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState(String(d.maxTokens ?? ""));
  const [topP, setTopP] = useState(String(d.topP ?? ""));
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [modelDropdownOpen]);

  const modelsFetchBase = useMemo(() => {
    if (isCustomProvider) return apiBase.trim() || undefined;
    const def = getDefaultBaseUrl(provider);
    if (effectiveCustomBase) return apiBase.trim() || def || undefined;
    return def || undefined;
  }, [isCustomProvider, effectiveCustomBase, apiBase, provider]);

  const {
    models,
    loading: modelsLoading,
    source: modelsSource,
  } = useProviderModels(provider, apiKey || undefined, modelsFetchBase);

  const handleProviderChange = useCallback((p: Provider) => {
    setProvider(p);
    const fb = FALLBACK_MODELS[p];
    const def = fb?.find((m) => m.default)?.id ?? fb?.[0]?.id ?? "";
    if (def) setModel(def);
  }, []);

  const resolvedBaseUrl = useMemo(() => {
    if (isCustomProvider) return apiBase.trim();
    if (effectiveCustomBase) return apiBase.trim() || getDefaultBaseUrl(provider);
    return getDefaultBaseUrl(provider);
  }, [isCustomProvider, effectiveCustomBase, apiBase, provider]);

  /** 未开启自定义 Base URL 时固定 OpenAI 兼容；开启后可切换适配器。 */
  const resolvedProtocolAdapter = useMemo(
    () => (effectiveCustomBase ? protocolAdapter : "openai"),
    [effectiveCustomBase, protocolAdapter],
  );

  const updates = useMemo(
    () => ({
      label,
      provider,
      model,
      apiKey,
      base_url: resolvedBaseUrl,
      useCustomBaseUrl: isCustomProvider ? true : useCustomBaseUrl,
      protocol: resolvedProtocolAdapter,
      protocolAdapter: resolvedProtocolAdapter,
      temperature,
      maxTokens: maxTokens ? Number(maxTokens) : undefined,
      topP: topP ? Number(topP) : undefined,
    }),
    [
      label,
      provider,
      model,
      apiKey,
      resolvedBaseUrl,
      isCustomProvider,
      useCustomBaseUrl,
      resolvedProtocolAdapter,
      temperature,
      maxTokens,
      topP,
    ],
  );

  useEffect(() => {
    onPreview(node.id, updates);
  }, [node.id, updates, onPreview]);

  const selectedModelLabel = models.find((m) => m.id === model)?.name ?? model;

  const defaultBaseHint = !isCustomProvider ? getDefaultBaseUrl(provider) : "";

  const handleConfirmClick = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <ConfigField label={t("workflow.nodeLabel", "标签")}>
          <ImeInput value={label} onValueChange={setLabel} className="h-8 text-xs" />
        </ConfigField>

        {/* Provider */}
        <ConfigField label="供应商">
          <div className="grid grid-cols-3 gap-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => handleProviderChange(p.value)}
                className={cn(
                  "flex items-center justify-center gap-1 h-8 text-[10px] rounded-md border transition-colors truncate px-1.5",
                  provider === p.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border/50 text-muted-foreground hover:bg-accent/40",
                )}
              >
                <ProviderIcon id={p.value} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </ConfigField>

        {/* Model select */}
        <ConfigField
          label={
            <span className="flex items-center gap-1.5">
              模型
              {!modelsLoading && modelsSource === "live" && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                  实时
                </span>
              )}
              {!modelsLoading && modelsSource === "openrouter" && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">
                  OpenRouter
                </span>
              )}
              {!modelsLoading && modelsSource === "fallback" && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                  默认
                </span>
              )}
            </span>
          }
        >
          {provider === "custom" ? (
            <ImeInput
              value={model}
              onValueChange={setModel}
              className="h-8 text-xs"
              placeholder="输入模型名称"
            />
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setModelDropdownOpen((v) => !v)}
                className={cn(
                  "flex w-full items-center justify-between h-8 px-2.5 text-xs rounded-md border border-input bg-background transition-colors",
                  "hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-ring",
                )}
              >
                <span className={cn("truncate", !model && "text-muted-foreground")}>
                  {modelsLoading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      加载中...
                    </span>
                  ) : (
                    selectedModelLabel || "选择模型"
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                    modelDropdownOpen && "rotate-180",
                  )}
                />
              </button>
              {modelDropdownOpen && !modelsLoading && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover/95 backdrop-blur-xl shadow-lg p-1 max-h-48 overflow-y-auto animate-in fade-in-0 zoom-in-[0.98] duration-100">
                  {models.length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                      暂无可用模型
                    </div>
                  ) : (
                    models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setModel(m.id);
                          setModelDropdownOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                          "hover:bg-accent/80",
                          m.id === model
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground/85",
                        )}
                      >
                        <span className="flex-1 text-left truncate">{m.name}</span>
                        {m.default && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                            默认
                          </span>
                        )}
                        {m.id === model && <Check className="h-3 w-3 text-primary shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </ConfigField>

        <ConfigField label="API Key">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="sk-..."
          />
        </ConfigField>

        <ConfigField
          label={
            <span className="flex w-full min-w-0 items-center justify-between gap-2">
              <span>Base URL</span>
              {!isCustomProvider && (
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[9px] font-normal text-muted-foreground">自定义</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useCustomBaseUrl}
                    onClick={() => setUseCustomBaseUrl((v) => !v)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                      useCustomBaseUrl ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform",
                        useCustomBaseUrl ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </span>
              )}
            </span>
          }
        >
          {effectiveCustomBase ? (
            <ImeInput
              value={apiBase}
              onValueChange={setApiBase}
              className="h-8 w-full min-w-0 text-xs font-mono"
              placeholder={
                isCustomProvider ? "https://api.example.com/v1" : defaultBaseHint || "https://..."
              }
            />
          ) : (
            <Input
              readOnly
              tabIndex={-1}
              value={defaultBaseHint || ""}
              placeholder="—"
              aria-readonly
              className={cn(
                "h-8 w-full min-w-0 cursor-default font-mono text-xs text-muted-foreground",
                "pointer-events-none focus-visible:ring-1 focus-visible:ring-offset-0",
              )}
            />
          )}
        </ConfigField>

        {effectiveCustomBase && (
          <ConfigField label="协议适配器">
            <div className="flex gap-1">
              {PROTOCOL_ADAPTERS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setProtocolAdapter(a.value)}
                  className={cn(
                    "flex-1 h-7 text-[10px] rounded-md border transition-colors",
                    protocolAdapter === a.value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border/50 text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </ConfigField>
        )}

        {/* Temperature slider */}
        <ConfigField label={`温度 (${temperature.toFixed(2)})`}>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full h-1.5 accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/60 -mt-0.5">
            <span>精确</span>
            <span>创意</span>
          </div>
        </ConfigField>

        <div className="flex gap-2">
          <div className="flex-1">
            <ConfigField label="Max Tokens">
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="4096"
              />
            </ConfigField>
          </div>
          <div className="flex-1">
            <ConfigField label="Top P">
              <Input
                type="number"
                value={topP}
                onChange={(e) => setTopP(e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="1.0"
                step="0.1"
                min="0"
                max="1"
              />
            </ConfigField>
          </div>
        </div>
      </div>

      <SheetFooter className="p-3 border-t border-border/30">
        <Button size="sm" className="ml-auto gap-1.5 h-8" onClick={handleConfirmClick}>
          <Check className="h-3.5 w-3.5" />
          {t("common.confirm", "确认")}
        </Button>
      </SheetFooter>
    </>
  );
}
