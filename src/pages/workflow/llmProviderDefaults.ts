/** 与后端 `services/workflow/router.py` 中拉取模型列表的默认地址一致。 */

export const PROVIDER_DEFAULT_BASE_URL = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com/v1",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  moonshot: "https://api.moonshot.cn/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  ollama: "http://localhost:11434",
} as const;

export type KnownLlmProvider = keyof typeof PROVIDER_DEFAULT_BASE_URL;

export function getDefaultBaseUrl(provider: string): string {
  if (provider === "custom") return "";
  return (
    PROVIDER_DEFAULT_BASE_URL[provider as KnownLlmProvider] ?? PROVIDER_DEFAULT_BASE_URL.openai
  );
}

/** 是否使用「自定义 Base URL」编辑态（不含仅展示默认 URL 的情况）。 */
export function inferUseCustomBaseUrl(data: Record<string, unknown>): boolean {
  const p = String(data.provider ?? "openai");
  if (p === "custom") return true;
  if (data.useCustomBaseUrl === false) return false;
  if (data.useCustomBaseUrl === true) return true;
  const legacy = String(data.base_url ?? data.apiBase ?? "").trim();
  if (!legacy) return false;
  const def = getDefaultBaseUrl(p);
  return legacy !== def;
}

/** 自定义模式下输入框的初始值。 */
export function initialApiBaseField(data: Record<string, unknown>): string {
  if (!inferUseCustomBaseUrl(data)) return "";
  return String(data.base_url ?? data.apiBase ?? "").trim();
}
