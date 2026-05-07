/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_CLIENT_ID: string;
  /**
   * Assistant Cloud 的 Frontend API 根地址（形如 `https://proj-xxxx.assistant-api.com`），
   * 不是 DeepSeek / OpenAI 等大模型 `baseURL`。见 `.env.example` 说明。
   */
  readonly VITE_PUBLIC_ASSISTANT_BASE_URL?: string;
  /**
   * 浏览器直连 OpenAI 兼容 API 时使用（与 `VITE_LLM_BASE_URL` 搭配）。
   * 注意：`VITE_*` 会打进前端包，密钥会暴露给所有访问者；生产环境请改用后端代理。
   */
  readonly VITE_LLM_API_KEY?: string;
  /** OpenAI 兼容 API 根地址，通常含 `/v1`，例如 `https://api.deepseek.com/v1`。 */
  readonly VITE_LLM_BASE_URL?: string;
  /** 模型 id，例如 `deepseek-chat`；未设置时直连模式默认 `deepseek-chat`。 */
  readonly VITE_LLM_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
