import { useMemo, type ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  WebSpeechSynthesisAdapter,
  WebSpeechDictationAdapter,
  CloudFileAttachmentAdapter,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  AssistantCloud,
  useAui,
  Tools,
  Suggestions,
  type FeedbackAdapter,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import {
  DirectChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { docsToolkit } from "@/lib/docs-toolkit";
import { createDirectLlmAgent } from "@/pages/agent/lib/createDirectLlmAgent";

/**
 * Vite 侧等价于 assistant-ui 文档里的 `NEXT_PUBLIC_ASSISTANT_BASE_URL`。
 * 仅用于 **Assistant Cloud**（`*.assistant-api.com`），勿填模型服务商域名。
 */
function assistantCloudBaseUrl(): string {
  const raw = import.meta.env.VITE_PUBLIC_ASSISTANT_BASE_URL;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(
      "未配置直连密钥时，需要 Assistant Cloud：请在 .env 中设置 VITE_PUBLIC_ASSISTANT_BASE_URL（Frontend API），或设置 VITE_LLM_API_KEY 启用浏览器直连模型。见 .env.example。",
    );
  }
  const urlString = raw.trim().replace(/\/$/, "");
  let host: string;
  try {
    host = new URL(urlString).hostname.toLowerCase();
  } catch {
    throw new Error(
      `VITE_PUBLIC_ASSISTANT_BASE_URL 不是合法 URL：${raw.trim()}`,
    );
  }

  const mistakenLlmHosts = new Set([
    "api.deepseek.com",
    "api.openai.com",
    "api.groq.com",
    "openrouter.ai",
    "api.anthropic.com",
  ]);
  if (mistakenLlmHosts.has(host)) {
    throw new Error(
      `VITE_PUBLIC_ASSISTANT_BASE_URL 指向大模型 API（${host}），会导致 AssistantCloud 请求 /v1/auth/tokens/anonymous 返回 401。请改为 cloud.assistant-ui.com 项目的 Frontend API，或改用直连：设置 VITE_LLM_API_KEY + VITE_LLM_BASE_URL。文档：https://www.assistant-ui.com/docs/cloud/ai-sdk-assistant-ui`,
    );
  }

  return urlString;
}

type DirectConfig = { baseURL: string; apiKey: string; model: string };

function resolveRuntimeMode():
  | { kind: "direct"; config: DirectConfig }
  | { kind: "cloud" } {
  const apiKey =
    typeof import.meta.env.VITE_LLM_API_KEY === "string"
      ? import.meta.env.VITE_LLM_API_KEY.trim()
      : "";
  if (apiKey) {
    const baseRaw =
      (typeof import.meta.env.VITE_LLM_BASE_URL === "string" &&
        import.meta.env.VITE_LLM_BASE_URL.trim()) ||
      (typeof import.meta.env.VITE_PUBLIC_ASSISTANT_BASE_URL === "string" &&
        import.meta.env.VITE_PUBLIC_ASSISTANT_BASE_URL.trim()) ||
      "";
    if (!baseRaw) {
      throw new Error(
        "已设置 VITE_LLM_API_KEY（直连模式），请同时设置 VITE_LLM_BASE_URL（OpenAI 兼容 API 根地址，通常含 /v1，例如 https://api.deepseek.com/v1）。",
      );
    }
    const model =
      (typeof import.meta.env.VITE_LLM_MODEL === "string" &&
        import.meta.env.VITE_LLM_MODEL.trim()) ||
      "deepseek-chat";
    return {
      kind: "direct",
      config: {
        baseURL: baseRaw.replace(/\/$/, ""),
        apiKey,
        model,
      },
    };
  }
  return { kind: "cloud" };
}

const feedbackAdapter: FeedbackAdapter = {
  submit: () => {
    // Feedback is tracked via analytics in AssistantActionBar
  },
};

const docsSuggestions = Suggestions([
  {
    title: "What's the weather",
    label: "in San Francisco?",
    prompt: "What's the weather in San Francisco?",
  },
  {
    title: "Explain React hooks",
    label: "like useState and useEffect",
    prompt: "Explain React hooks like useState and useEffect",
  },
]);

function CloudAssistantRuntimeProvider({ children }: { children: ReactNode }) {
  const assistantCloud = useMemo(
    () =>
      new AssistantCloud({
        baseUrl: assistantCloudBaseUrl(),
        anonymous: true,
      }),
    [],
  );

  const adapters = useMemo(
    () => ({
      speech: new WebSpeechSynthesisAdapter(),
      dictation: new WebSpeechDictationAdapter(),
      feedback: feedbackAdapter,
      attachments: new CloudFileAttachmentAdapter(assistantCloud),
    }),
    [assistantCloud],
  );

  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    adapters,
    cloud: assistantCloud,
  });

  const aui = useAui({
    tools: Tools({ toolkit: docsToolkit }),
    suggestions: docsSuggestions,
  } as Parameters<typeof useAui>[0]);

  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      {children}
      <DevToolsModal />
    </AssistantRuntimeProvider>
  );
}

function DirectAssistantRuntimeProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: DirectConfig;
}) {
  const agent = useMemo(
    () => createDirectLlmAgent(config),
    [config.baseURL, config.apiKey, config.model],
  );

  const transport = useMemo(
    () => new DirectChatTransport({ agent }),
    [agent],
  );

  const adapters = useMemo(
    () => ({
      speech: new WebSpeechSynthesisAdapter(),
      dictation: new WebSpeechDictationAdapter(),
      feedback: feedbackAdapter,
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    }),
    [],
  );

  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    adapters,
    transport,
  });

  const aui = useAui({
    tools: Tools({ toolkit: docsToolkit }),
    suggestions: docsSuggestions,
  } as Parameters<typeof useAui>[0]);

  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      {children}
      <DevToolsModal />
    </AssistantRuntimeProvider>
  );
}

/** 文档站同款 runtime；若设置 VITE_LLM_API_KEY 则浏览器内直连 OpenAI 兼容 API（如 DeepSeek），否则走 Assistant Cloud。 */
export function AssistantUiDocsRuntimeProvider({ children }: { children: ReactNode }) {
  const mode = resolveRuntimeMode();
  if (mode.kind === "direct") {
    return (
      <DirectAssistantRuntimeProvider config={mode.config}>
        {children}
      </DirectAssistantRuntimeProvider>
    );
  }
  return (
    <CloudAssistantRuntimeProvider>{children}</CloudAssistantRuntimeProvider>
  );
}
