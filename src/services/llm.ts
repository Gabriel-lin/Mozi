import { api } from "./api";

/** 后端路由挂在 workflows 下；客户端集中在此便于智能体、工作流等多处复用。 */
const PROVIDER_MODELS_PATH = "/workflows/llm/providers/models";

export interface ProviderModel {
  id: string;
  name: string;
  default?: boolean;
}

export interface ProviderModelsOut {
  provider: string;
  models: ProviderModel[];
  source?: "live" | "openrouter" | "none";
}

export const llmApi = {
  getProviderModels(provider: string, apiKey?: string, apiBase?: string) {
    const params: Record<string, string> = { provider };
    if (apiKey) params.api_key = apiKey;
    if (apiBase) params.api_base = apiBase;
    return api.get<ProviderModelsOut>(PROVIDER_MODELS_PATH, { params });
  },
};
