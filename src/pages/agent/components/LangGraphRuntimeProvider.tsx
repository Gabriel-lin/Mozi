/**
 * Bridge between Vercel AI SDK + assistant-ui and our LangGraph FastAPI backend.
 *
 * Architecture:
 *
 *   ┌────────────────────────┐   POST /agents/:id/chat (SSE)
 *   │ DefaultChatTransport   │ ─────────────────────────────┐
 *   │  · injects Bearer JWT  │                              ▼
 *   │  · sends thread_id     │             LangGraph create_agent
 *   │  · last user message   │           + AsyncPostgresSaver(durable)
 *   └────────────────────────┘                              │
 *             ▲                                             │
 *             │ UIMessageChunk SSE                          ▼
 *             └────── parseJsonEventStream ─── text-delta / tool-input-* / tool-output-*
 *
 * Thread list & history hydration are layered on top via a custom
 * RemoteThreadListAdapter + ThreadHistoryAdapter that talk to the same backend.
 */

import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  Suggestions,
  Tools,
  WebSpeechDictationAdapter,
  WebSpeechSynthesisAdapter,
  useAui,
  useAuiState,
  useRemoteThreadListRuntime,
  type FeedbackAdapter,
  type GenericThreadHistoryAdapter,
  type MessageFormatAdapter,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
} from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuthStore } from "@mozi/store";
import { docsToolkit } from "@/lib/docs-toolkit";
import { agentLangGraphApi } from "@/services/agentLangGraph";
import type { ModelOption } from "@/components/assistant-ui/model-selector";

// --- shared adapters ---------------------------------------------------------

const feedbackAdapter: FeedbackAdapter = {
  submit: () => {
    // Plug into analytics in production; default to no-op.
  },
};

const suggestions = Suggestions([
  {
    title: "What's the weather",
    label: "in San Francisco?",
    prompt: "What's the weather in San Francisco?",
  },
  {
    title: "Search the web",
    label: "for the latest LangChain release notes",
    prompt: "What are the highlights of the latest LangChain release?",
  },
  {
    title: "List installed skills",
    label: "and pick the most relevant one",
    prompt: "Show me which Mozi skills are installed locally on this machine.",
  },
]);

const attachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- transport ---------------------------------------------------------------

/**
 * Slice the AI SDK message list down to the latest user turn.
 *
 * LangGraph's checkpointer already holds prior context server-side keyed by
 * ``thread_id`` — re-sending the full transcript would bloat each request and
 * risk diverging client/server state.
 */
function buildTransport(agentId: string, modelRef: { current: string | null }) {
  return new DefaultChatTransport<UIMessage>({
    api: agentLangGraphApi.chatUrl(agentId),
    credentials: "same-origin",
    headers: () => authHeaders(),
    prepareSendMessagesRequest: ({ api, id, messages, body }) => {
      let lastUser: UIMessage | undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]!.role === "user") {
          lastUser = messages[i];
          break;
        }
      }
      const trimmed = lastUser ? [lastUser] : [];
      const model = modelRef.current?.trim() || undefined;
      return {
        api,
        body: {
          ...(body ?? {}),
          ...(model ? { model } : null),
          id,
          messages: trimmed,
        },
      };
    },
  });
}

// --- thread list adapter -----------------------------------------------------

function useLangGraphThreadListAdapter(agentId: string): RemoteThreadListAdapter {
  const ref = useRef(agentId);
  useEffect(() => {
    ref.current = agentId;
  }, [agentId]);

  return useMemo<RemoteThreadListAdapter>(
    () => ({
      list: async () => {
        const out = await agentLangGraphApi.listThreads(ref.current);
        return {
          threads: out.threads.map((t) => ({
            status: t.archived_at ? ("archived" as const) : ("regular" as const),
            remoteId: t.id,
            title: t.title ?? undefined,
          })),
        };
      },
      initialize: async (threadId) => {
        const created = await agentLangGraphApi.createThread(ref.current, null);
        return { remoteId: created.id || threadId, externalId: undefined };
      },
      rename: async (remoteId, title) => {
        await agentLangGraphApi.patchThread(ref.current, remoteId, { title });
      },
      archive: async (remoteId) => {
        await agentLangGraphApi.patchThread(ref.current, remoteId, { archived: true });
      },
      unarchive: async (remoteId) => {
        await agentLangGraphApi.patchThread(ref.current, remoteId, { archived: false });
      },
      delete: async (remoteId) => {
        await agentLangGraphApi.deleteThread(ref.current, remoteId);
      },
      fetch: async (threadId) => {
        const out = await agentLangGraphApi.listThreads(ref.current, 1, 200);
        const t = out.threads.find((x) => x.id === threadId);
        if (!t) throw new Error("Thread not found");
        return {
          status: t.archived_at ? ("archived" as const) : ("regular" as const),
          remoteId: t.id,
          title: t.title ?? undefined,
        };
      },
      generateTitle: async () => {
        // Server derives a sane default title from the first user message;
        // returning an empty stream keeps that derived title intact.
        return new ReadableStream({
          start(controller) {
            controller.close();
          },
        }) as unknown as ReturnType<RemoteThreadListAdapter["generateTitle"]>;
      },
    }),
    [],
  );
}

// --- history adapter ---------------------------------------------------------

/** Build a {@link ThreadHistoryAdapter} that loads UIMessage history for a thread. */
function makeHistoryAdapter(agentId: string, threadId: string | undefined): ThreadHistoryAdapter {
  return {
    async load() {
      return { headId: undefined, messages: [] };
    },
    async append() {
      // Server-side LangGraph checkpointer is the source of truth.
    },
    withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
      _formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
    ): GenericThreadHistoryAdapter<TMessage> {
      return {
        async load() {
          if (!threadId) return { headId: undefined, messages: [] };
          try {
            const out = await agentLangGraphApi.getThreadMessages(agentId, threadId);
            const records = (out.messages ?? []) as Array<
              { id?: string } & Record<string, unknown>
            >;
            const items = records.map((m, idx) => ({
              parentId: idx > 0 ? (records[idx - 1]!.id ?? null) : null,
              message: m as unknown as TMessage,
            }));
            const last = records[records.length - 1];
            return {
              headId: last?.id ?? undefined,
              messages: items,
            };
          } catch (err) {
            // Best-effort: if history fetch fails we still let the user chat.
            console.warn("[LangGraph] failed to load thread history", err);
            return { headId: undefined, messages: [] };
          }
        },
        async append() {
          // No-op: backend persists during streaming.
        },
      };
    },
  };
}

// --- per-thread runtime hook -------------------------------------------------

/** Reads the active thread id from aui state. */
function useActiveThreadId(): string | undefined {
  return useAuiState((s) => {
    const ts = s as { threadListItem?: { id?: string } };
    return ts.threadListItem?.id;
  });
}

function makeRuntimeHook(agentId: string, modelRef: { current: string | null }) {
  return function ChatThreadRuntime() {
    const transport = useMemo(() => buildTransport(agentId, modelRef), []);
    const threadId = useActiveThreadId();

    const chat = useChat<UIMessage>({ id: threadId, transport });

    const historyAdapter = useMemo(() => makeHistoryAdapter(agentId, threadId), [threadId]);

    const runtime = useAISDKRuntime(chat, {
      adapters: {
        speech: new WebSpeechSynthesisAdapter(),
        dictation: new WebSpeechDictationAdapter(),
        feedback: feedbackAdapter,
        attachments: attachmentAdapter,
        history: historyAdapter,
      },
    });

    // Register aui-level tool callbacks + welcome suggestions for this thread.
    useAui({
      tools: Tools({ toolkit: docsToolkit }),
      suggestions,
    } as Parameters<typeof useAui>[0]);

    return runtime;
  };
}

// --- runtime model context ---------------------------------------------------

/**
 * Exposes the runtime model picker state to descendants inside the provider.
 *
 * The selected model is **session-scoped** — switching it only affects the
 * next ``POST /chat`` payload (via ``body.model``), never the persisted agent
 * config. Editing the agent's saved default is handled on the edit page.
 */
export type RuntimeModelContextValue = {
  models: ModelOption[];
  modelsLoading: boolean;
  selectedModel: string;
  onSelectedModelChange: (model: string) => void;
};

const RuntimeModelContext = createContext<RuntimeModelContextValue | null>(null);

export function useRuntimeModelContext(): RuntimeModelContextValue | null {
  return useContext(RuntimeModelContext);
}

// --- public provider ---------------------------------------------------------

export function LangGraphRuntimeProvider({
  agentId,
  initialModel,
  models,
  modelsLoading,
  children,
}: {
  agentId: string;
  /** Agent's persisted default model id — used as the picker's initial value. */
  initialModel?: string | null;
  /** Provider models fetched the same way the edit page does. */
  models?: ModelOption[];
  modelsLoading?: boolean;
  children: ReactNode;
}) {
  const adapter = useLangGraphThreadListAdapter(agentId);

  const [selectedModel, setSelectedModel] = useState<string>(initialModel ?? "");
  // React's "adjust state when prop changes" pattern (no effect needed):
  // when ``initialModel`` shifts (e.g. agent record finishes loading) reset
  // the picker to that value. Picker changes after that keep the user's pick
  // until the prop changes again.
  const [seenInitial, setSeenInitial] = useState<string>(initialModel ?? "");
  if ((initialModel ?? "") !== seenInitial) {
    setSeenInitial(initialModel ?? "");
    setSelectedModel(initialModel ?? "");
  }

  // Latest selected model is read inside the transport's per-request body
  // builder; a ref avoids rebuilding the transport on every selection change.
  const modelRef = useRef<string | null>(selectedModel || null);
  useEffect(() => {
    modelRef.current = selectedModel || null;
  }, [selectedModel]);

  // ``modelRef`` is consumed by ``prepareSendMessagesRequest`` at network time
  // (not during render), which the static rule can't tell apart from a true
  // render-time ref read.
  // eslint-disable-next-line react-hooks/refs
  const runtimeHook = useMemo(() => makeRuntimeHook(agentId, modelRef), [agentId]);

  const runtime = useRemoteThreadListRuntime({
    adapter,
    allowNesting: true,
    runtimeHook,
  });

  const modelCtx = useMemo<RuntimeModelContextValue>(
    () => ({
      models: models ?? [],
      modelsLoading: !!modelsLoading,
      selectedModel,
      onSelectedModelChange: setSelectedModel,
    }),
    [models, modelsLoading, selectedModel],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <RuntimeModelContext.Provider value={modelCtx}>
        {children}
        <DevToolsModal />
      </RuntimeModelContext.Provider>
    </AssistantRuntimeProvider>
  );
}
