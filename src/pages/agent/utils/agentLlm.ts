import type { ProviderModel } from "@/services/llm";

/** 与 `LLMConfigForm` 中工作流 LLM 节点一致，不含 custom（无统一模型列表）。 */
export const AGENT_PROVIDER_IDS = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "zhipu",
  "moonshot",
  "qwen",
  "ollama",
] as const;

export type AgentProviderId = (typeof AGENT_PROVIDER_IDS)[number];

export const FALLBACK_MODELS: Record<AgentProviderId, ProviderModel[]> = {
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
