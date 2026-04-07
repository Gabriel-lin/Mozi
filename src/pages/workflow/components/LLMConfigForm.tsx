import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Settings } from "lucide-react";
import type { Node } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { ConfigField } from "./ConfigField";
import { ImeInput } from "./ImeInput";
import { cn } from "@/lib/utils";

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

const PROTOCOLS = [
  { value: "openai", label: "OpenAI 兼容" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
] as const;

type Provider = (typeof PROVIDERS)[number]["value"];
type Protocol = (typeof PROTOCOLS)[number]["value"];

interface LLMConfigFormProps {
  node: Node;
  onPreview: (id: string, updates: Record<string, unknown>) => void;
  onConfirm: () => void;
}

function getData(node: Node) {
  return (node.data ?? {}) as Record<string, unknown>;
}

export function LLMConfigForm({ node, onPreview, onConfirm }: LLMConfigFormProps) {
  const { t } = useTranslation();
  const d = getData(node);

  const [label, setLabel] = useState(String(d.label ?? "LLM"));
  const [provider, setProvider] = useState<Provider>((d.provider as Provider) ?? "openai");
  const [model, setModel] = useState(String(d.model ?? ""));
  const [apiKey, setApiKey] = useState(String(d.apiKey ?? ""));
  const [apiBase, setApiBase] = useState(String(d.apiBase ?? ""));
  const [protocol, setProtocol] = useState<Protocol>((d.protocol as Protocol) ?? "openai");
  const [protocolAdapter, setProtocolAdapter] = useState(String(d.protocolAdapter ?? ""));
  const [temperature, setTemperature] = useState(Number(d.temperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState(String(d.maxTokens ?? ""));
  const [topP, setTopP] = useState(String(d.topP ?? ""));

  const updates = useMemo(
    () => ({
      label,
      provider,
      model,
      apiKey,
      apiBase,
      protocol,
      protocolAdapter,
      temperature,
      maxTokens: maxTokens ? Number(maxTokens) : undefined,
      topP: topP ? Number(topP) : undefined,
    }),
    [
      label,
      provider,
      model,
      apiKey,
      apiBase,
      protocol,
      protocolAdapter,
      temperature,
      maxTokens,
      topP,
    ],
  );

  useEffect(() => {
    onPreview(node.id, updates);
  }, [node.id, updates, onPreview]);

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
                onClick={() => setProvider(p.value)}
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

        <ConfigField label="模型">
          <ImeInput
            value={model}
            onValueChange={setModel}
            className="h-8 text-xs"
            placeholder="gpt-4o / claude-3.5-sonnet"
          />
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

        <ConfigField label="API Base">
          <ImeInput
            value={apiBase}
            onValueChange={setApiBase}
            className="h-8 text-xs font-mono"
            placeholder="https://api.openai.com/v1"
          />
        </ConfigField>

        {/* Protocol */}
        <ConfigField label="协议">
          <div className="flex gap-1">
            {PROTOCOLS.map((p) => (
              <button
                key={p.value}
                onClick={() => setProtocol(p.value)}
                className={cn(
                  "flex-1 h-7 text-[10px] rounded-md border transition-colors",
                  protocol === p.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border/50 text-muted-foreground hover:bg-accent/40",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </ConfigField>

        <ConfigField label="协议适配器">
          <ImeInput
            value={protocolAdapter}
            onValueChange={setProtocolAdapter}
            className="h-8 text-xs"
            placeholder="可选，留空使用默认"
          />
        </ConfigField>

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
        <Button
          size="sm"
          className="ml-auto gap-1.5 h-8"
          onClick={useCallback(() => onConfirm(), [onConfirm])}
        >
          <Check className="h-3.5 w-3.5" />
          {t("common.confirm", "确认")}
        </Button>
      </SheetFooter>
    </>
  );
}
