import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  WebSpeechDictationAdapter,
  useExternalStoreRuntime,
  type AppendMessage,
  type AssistantRuntime,
  type ExportedMessageRepository,
  type FeedbackAdapter,
  type ThreadMessage,
  type ThreadMessageLike,
  type ThreadUserMessagePart,
} from "@assistant-ui/react";
import type { TFunction } from "i18next";
import type { RunAttachmentIn, RunOut } from "@/services/agent";
import { agentApi } from "@/services/agent";
import {
  subscribeAgentRunEvents,
  AgentRunPollFailedError,
  AgentRunSubscribeStallError,
  AgentRunWorkerStaleError,
} from "@/services/agentRunStream";
import { formatAgentRunMarkdown } from "@/pages/agent/utils/formatAgentRun";
import {
  applyStreamToLiveState,
  initialLiveFoldState,
  liveFoldToMarkdown,
  type LiveFoldState,
} from "@/pages/agent/utils/liveAgentRunMarkdown";
import { appendMessageToRunPayload } from "@/pages/agent/utils/appendMessageToRunPayload";
import { AGENT_RUN_DEFAULT_MODEL_ID } from "@/pages/agent/agentRunModelOptions";
import { modelDisplayLabel, type AgentProviderId } from "@/pages/agent/utils";
import { useAgentProviderModels } from "@/pages/agent/hooks/useAgentProviderModels";
import { extractErrorMessage } from "@/lib/utils";
import { ApiError } from "@/services/api";
import { isTauri } from "@tauri-apps/api/core";
import {
  buildConversationPatchBody,
  linearMessagesFromExport,
  parseLoadedConversation,
  preferLatestAssistantOnPath,
  userChainFromHead,
  type AgentRunMessage,
} from "@/pages/agent/utils/agentRunConversation";

export type { AgentRunMessage };

type ThreadStore =
  | { mode: "messages"; items: readonly AgentRunMessage[] }
  | { mode: "repository"; repo: ExportedMessageRepository };

function newId() {
  return crypto.randomUUID();
}

async function persistConversationWithTree(runtime: AssistantRuntime, runId: string) {
  try {
    const exported = runtime.thread.export();
    const body = buildConversationPatchBody(runId, exported);
    await agentApi.patchRunConversation(runId, { conversation: body });
  } catch {
    /* best-effort */
  }
}

/**
 * Debounce + max-wait window for auto-persisting conversation snapshots while
 * the user types, the assistant streams, or the user edits/regenerates a turn.
 *
 * - `DEBOUNCE_MS` collapses bursts of streaming token updates into one save.
 * - `MAX_WAIT_MS` guarantees a save fires during long-running streams so a
 *   tab close mid-generation still leaves the latest snapshot on the server.
 */
const PERSIST_DEBOUNCE_MS = 500;
const PERSIST_MAX_WAIT_MS = 3000;

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const data = e.data as { detail?: unknown } | undefined;
    const d = data?.detail;
    if (typeof d === "string") return d;
    if (
      d &&
      typeof d === "object" &&
      "detail" in d &&
      typeof (d as { detail?: string }).detail === "string"
    ) {
      return (d as { detail: string }).detail;
    }
    return e.message || `HTTP ${e.status}`;
  }
  if (e instanceof Error) return extractErrorMessage(e.message);
  return extractErrorMessage(String(e));
}

const TERMINAL = new Set(["completed", "failed", "stopped"]);

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function readSettledRun(
  agentId: string,
  runId: string,
  signal: AbortSignal,
): Promise<RunOut> {
  const deadline = Date.now() + 5_000;
  let latest = await agentApi.getRun(runId);

  while (!TERMINAL.has(latest.status) && Date.now() < deadline) {
    await sleep(250, signal);
    latest = await agentApi.getRun(runId);
  }

  if (TERMINAL.has(latest.status)) return latest;

  try {
    const list = await agentApi.listRuns(agentId, 1, 40);
    return list.runs.find((r) => r.id === runId) ?? latest;
  } catch {
    return latest;
  }
}

type LiveRef = {
  state: LiveFoldState;
  pendingTool: { tool: string; input: string } | null;
};

type LiveSnapshot = LiveRef;

function userPartsFromAppend(message: AppendMessage): readonly ThreadUserMessagePart[] | undefined {
  if (typeof message.content === "string") {
    return [{ type: "text", text: message.content }];
  }
  const allowed = new Set(["text", "file", "image", "audio", "data"]);
  const parts = message.content.filter((p) => allowed.has(p.type)) as ThreadUserMessagePart[];
  return parts.length ? parts : undefined;
}

function userDisplayText(
  parts: readonly ThreadUserMessagePart[] | undefined,
  fallback: string,
): string {
  if (!parts?.length) return fallback;
  return (
    parts
      .filter((p): p is Extract<ThreadUserMessagePart, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("\n\n")
      .trim() || fallback
  );
}

/** Passed to ExternalStore `setMessages`; runtime may send assistant-ui `ThreadMessage[]` on branch switch. */
type ApplyConversationAction =
  | SetStateAction<readonly AgentRunMessage[]>
  | readonly ThreadMessage[];

type Options = {
  agentId: string | undefined;
  /** From `agent.config.llm_provider` — same provider used in the agent editor model list. */
  agentLlmProvider: AgentProviderId;
  /** From `GET /agents/:id` — initializes composer model when set. */
  agentDefaultModel?: string | null;
  onRunSettled?: () => void;
};

export type AgentRunModelSelectRow = { value: string; label: string };

export function useAgentRunRuntime({
  agentId,
  agentLlmProvider,
  agentDefaultModel,
  onRunSettled,
}: Options) {
  const { t, i18n } = useTranslation();
  const { models, loading: modelsLoading, defaultModelId } =
    useAgentProviderModels(agentLlmProvider);

  /** Agent 配置优先，否则用当前 provider 模型列表默认项（避免写死 gpt-5.4 与非 OpenAI provider 不一致导致 Radix Select 无匹配值、只显示占位）。 */
  const resolvedFallbackModel = useMemo(() => {
    const fromAgent = agentDefaultModel?.trim();
    if (fromAgent) return fromAgent;
    const fromList = defaultModelId?.trim();
    if (fromList) return fromList;
    return AGENT_RUN_DEFAULT_MODEL_ID;
  }, [agentDefaultModel, defaultModelId]);

  const [thread, setThread] = useState<ThreadStore>({ mode: "messages", items: [] });
  const [loadedRunId, setLoadedRunId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [composerModel, setComposerModel] = useState<string>(resolvedFallbackModel);
  const abortRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  /** Run row id for multi-turn `continue_run_id`; cleared on new thread. */
  const sessionRunIdRef = useRef<string | null>(null);
  const loadRunGenerationRef = useRef(0);
  const runtimeRef = useRef<AssistantRuntime | null>(null);
  /** Detect user-message BranchPicker vs assistant-only (same chain → keep chosen assistant). */
  const prevUserChainRef = useRef<string[]>([]);

  /**
   * Auto-persistence timers.
   *
   * Mirrors the assistant-ui ExternalStoreRuntime pattern (see the shadcn docs
   * example): persist `runtime.thread.export()` whenever the conversation
   * changes, instead of relying on a one-shot save at the end of `executeRun`.
   * That way, error paths, mid-stream tab closes, and feedback edits never
   * drop messages.
   */
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistMaxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Suppress one auto-persist tick after `loadRun` so we don't immediately echo the just-loaded snapshot back. */
  const suppressPersistRef = useRef(false);

  const flushPersist = useCallback(() => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    if (persistMaxWaitRef.current) {
      clearTimeout(persistMaxWaitRef.current);
      persistMaxWaitRef.current = null;
    }
    const rid = sessionRunIdRef.current;
    const rt = runtimeRef.current;
    if (!rid || !rt) return;
    void persistConversationWithTree(rt, rid);
  }, []);

  const schedulePersist = useCallback(() => {
    const rid = sessionRunIdRef.current;
    if (!rid) return;
    if (suppressPersistRef.current) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      flushPersist();
    }, PERSIST_DEBOUNCE_MS);
    if (!persistMaxWaitRef.current) {
      persistMaxWaitRef.current = setTimeout(() => {
        flushPersist();
      }, PERSIST_MAX_WAIT_MS);
    }
  }, [flushPersist]);

  const cancelPendingPersist = useCallback(() => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    if (persistMaxWaitRef.current) {
      clearTimeout(persistMaxWaitRef.current);
      persistMaxWaitRef.current = null;
    }
  }, []);

  const finalizeRepositoryBranchSync = useCallback(() => {
    queueMicrotask(() => {
      const rt = runtimeRef.current;
      if (!rt) return;
      try {
        let repo = rt.thread.export() as ExportedMessageRepository;
        const chain = userChainFromHead(repo);
        const chainChanged =
          prevUserChainRef.current.length > 0 &&
          JSON.stringify(chain) !== JSON.stringify(prevUserChainRef.current);
        if (chainChanged) {
          repo = preferLatestAssistantOnPath(repo);
        }
        prevUserChainRef.current = userChainFromHead(repo);
        setThread({ mode: "repository", repo });
      } catch {
        /* ignore */
      }
    });
  }, []);

  /**
   * ExternalStoreThreadRuntimeCore.switchToBranch → updateMessages → setMessages.
   * When `convertMessage` is set with a **messages** array, it passes `messages.flatMap(getExternalStoreMessages)`;
   * repository-imported ThreadMessages have no bound inner store messages → [] and the thread clears.
   * In **messageRepository** mode the runtime imports the repo directly and ignores `convertMessage` at runtime,
   * but `ExternalStoreAdapter<AgentRunMessage>` still requires `convertMessage` in the type (AgentRunMessage ≠ ThreadMessage).
   */
  const applyMessages = useCallback((action: ApplyConversationAction) => {
    if (typeof action === "function") {
      setThread((prev) => {
        const rid = sessionRunIdRef.current ?? "";
        const base: AgentRunMessage[] =
          prev.mode === "messages" ? [...prev.items] : linearMessagesFromExport(prev.repo, rid);
        const next = action(base);
        return { mode: "messages", items: [...next] };
      });
      return;
    }

    if (!Array.isArray(action)) return;

    const arr = action as readonly AgentRunMessage[] | readonly ThreadMessage[];
    const looksLikeThreadMessages =
      arr.length > 0 &&
      arr.every((m) => {
        if (!m || typeof m !== "object") return false;
        const o = m as Record<string, unknown>;
        return (
          typeof o.id === "string" &&
          (o.role === "user" || o.role === "assistant") &&
          Array.isArray(o.content)
        );
      });

    if (looksLikeThreadMessages) {
      finalizeRepositoryBranchSync();
      return;
    }

    if (arr.length === 0) {
      setThread((prev) => {
        if (prev.mode === "repository") {
          finalizeRepositoryBranchSync();
          return prev;
        }
        return { mode: "messages", items: [] };
      });
      return;
    }

    setThread({
      mode: "messages",
      items: [...(arr as readonly AgentRunMessage[])],
    });
  }, [finalizeRepositoryBranchSync]);

  const messages = useMemo((): readonly AgentRunMessage[] => {
    if (thread.mode === "repository") return linearMessagesFromExport(thread.repo, loadedRunId);
    return thread.items;
  }, [thread, loadedRunId]);

  const convertMessage = useCallback((m: AgentRunMessage): ThreadMessageLike => {
    if (m.role === "user") {
      const content: ThreadMessageLike["content"] =
        m.userParts && m.userParts.length > 0 ? [...m.userParts] : [{ type: "text", text: m.text }];
      return { role: "user", id: m.id, content };
    }
    const base: ThreadMessageLike = {
      role: "assistant",
      id: m.id,
      content: [{ type: "text", text: m.text }],
    };
    if (!m.runId && !m.feedback) return base;
    return {
      ...base,
      metadata: {
        custom: { ...(m.runId ? { runId: m.runId } : {}) },
        ...(m.feedback ? { submittedFeedback: { type: m.feedback } } : {}),
      },
    } as ThreadMessageLike;
  }, []);

  const loadRun = useCallback(
    async (runId: string) => {
      abortRef.current?.abort();
      cancelPendingPersist();
      const gen = ++loadRunGenerationRef.current;
      const run = await agentApi.getRun(runId);
      if (gen !== loadRunGenerationRef.current) return;
      const restored = parseLoadedConversation(run.conversation, run.id);
      // Suppress the auto-persist that would otherwise fire for the load-induced
      // `messages` change. Cleared on next macrotask, after React commits.
      suppressPersistRef.current = true;
      sessionRunIdRef.current = run.id;
      setLoadedRunId(run.id);
      if (restored.tree) {
        prevUserChainRef.current = userChainFromHead(restored.tree);
        setThread({ mode: "repository", repo: restored.tree });
      } else if (restored.linear.length > 0) {
        prevUserChainRef.current = [];
        setThread({ mode: "messages", items: restored.linear });
      } else {
        const goal = run.goal?.trim() ?? "";
        const body = formatAgentRunMarkdown(run);
        const fb =
          run.feedback === "positive" || run.feedback === "negative" ? run.feedback : undefined;
        prevUserChainRef.current = [];
        setThread({
          mode: "messages",
          items: [
            { id: `u-${run.id}`, role: "user", text: goal || "—" },
            { id: `a-${run.id}`, role: "assistant", text: body, runId: run.id, feedback: fb },
          ],
        });
      }
      sessionRunIdRef.current = run.id;
      setTimeout(() => {
        suppressPersistRef.current = false;
      }, 0);
    },
    [cancelPendingPersist],
  );

  const clearThread = useCallback(() => {
    abortRef.current?.abort();
    cancelPendingPersist();
    activeRunIdRef.current = null;
    sessionRunIdRef.current = null;
    setLoadedRunId("");
    loadRunGenerationRef.current += 1;
    suppressPersistRef.current = true;
    prevUserChainRef.current = [];
    setThread({ mode: "messages", items: [] });
    setTimeout(() => {
      suppressPersistRef.current = false;
    }, 0);
  }, [cancelPendingPersist]);

  useEffect(() => {
    setComposerModel(resolvedFallbackModel);
  }, [agentId, resolvedFallbackModel]);

  const modelSelectRows: AgentRunModelSelectRow[] = useMemo(() => {
    const rows = models.map((m) => ({
      value: m.id,
      label: modelDisplayLabel(m.name, m.id),
    }));
    if (composerModel && !rows.some((r) => r.value === composerModel)) {
      return [
        { value: composerModel, label: modelDisplayLabel(composerModel, composerModel) },
        ...rows,
      ];
    }
    return rows;
  }, [models, composerModel]);

  const executeRun = useCallback(
    async (
      goal: string,
      attachments: RunAttachmentIn[],
      asstId: string,
      signal: AbortSignal,
      tf: TFunction,
      streamSnapshot?: LiveSnapshot | null,
      replaceRunId?: string | null,
      continueRunId?: string | null,
    ) => {
      if (!agentId) return;
      const liveRef: LiveRef = {
        state: initialLiveFoldState(),
        pendingTool: null,
      };
      const flush = () => {
        if (streamSnapshot) {
          streamSnapshot.state = liveRef.state;
          streamSnapshot.pendingTool = liveRef.pendingTool;
        }
        const md = liveFoldToMarkdown(liveRef.state, tf);
        applyMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, text: md } : m)));
      };

      const useContinue =
        !replaceRunId && continueRunId?.trim() ? continueRunId.trim() : undefined;

      const started = await agentApi.startRun(agentId, {
        goal,
        attachments: attachments.length ? attachments : undefined,
        model: composerModel.trim() || undefined,
        ...(replaceRunId ? { replace_run_id: replaceRunId } : {}),
        ...(useContinue ? { continue_run_id: useContinue } : {}),
      });
      sessionRunIdRef.current = started.id;
      activeRunIdRef.current = started.id;
      liveRef.state = initialLiveFoldState();
      liveRef.pendingTool = null;
      flush();

      await subscribeAgentRunEvents(
        started.id,
        (ev) => {
          const r = applyStreamToLiveState(liveRef.state, ev, liveRef.pendingTool, tf);
          liveRef.state = r.state;
          liveRef.pendingTool = r.pendingTool;
          flush();
        },
        signal,
      );

      const run = await readSettledRun(agentId, started.id, signal);
      const body = formatAgentRunMarkdown(run);
      const fb =
        run.feedback === "positive" || run.feedback === "negative" ? run.feedback : undefined;
      applyMessages((prev) =>
        prev.map((m) => {
          if (m.id !== asstId) return m;
          const updated: AgentRunMessage = {
            ...m,
            text: body,
            runId: started.id,
          };
          if (fb) updated.feedback = fb;
          else delete updated.feedback;
          return updated;
        }),
      );
      onRunSettled?.();
    },
    [agentId, composerModel, onRunSettled, applyMessages],
  );

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const { goal, attachments } = appendMessageToRunPayload(message);
      if ((!goal.trim() && !attachments.length) || !agentId) return;

      const userId = newId();
      const asstId = newId();
      const parts = userPartsFromAppend(message);
      const display = userDisplayText(parts, goal);
      applyMessages((prev) => [
        ...prev,
        {
          id: userId,
          role: "user",
          text: display,
          userParts: parts,
          runAttachments: attachments.length ? attachments : undefined,
        },
        { id: asstId, role: "assistant", text: t("agent.runLiveStarting") },
      ]);
      setIsRunning(true);
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;
      const streamSnap: LiveSnapshot = { state: initialLiveFoldState(), pendingTool: null };

      try {
        const continueRunId = sessionRunIdRef.current;
        await executeRun(
          goal,
          attachments,
          asstId,
          signal,
          t as TFunction,
          streamSnap,
          undefined,
          continueRunId,
        );
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runCancelled") } : m)),
          );
        } else if (e instanceof AgentRunWorkerStaleError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runWorkerStale") } : m)),
          );
        } else if (e instanceof AgentRunSubscribeStallError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runSubscribeStall") } : m)),
          );
        } else if (e instanceof AgentRunPollFailedError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runPollFailed") } : m)),
          );
        } else {
          const rid = activeRunIdRef.current;
          let fallback = `${t("agent.runWsError")}\n\n${liveFoldToMarkdown(streamSnap.state, t as TFunction)}`;
          if (rid) {
            try {
              const run = await agentApi.getRun(rid);
              if (TERMINAL.has(run.status)) {
                fallback = formatAgentRunMarkdown(run);
              }
            } catch {
              /* keep */
            }
          }
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: rid ? fallback : errorText(e) } : m)),
          );
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        activeRunIdRef.current = null;
      }
    },
    [agentId, executeRun, t, applyMessages],
  );

  const onEdit = useCallback(
    async (message: AppendMessage) => {
      const sourceId = message.sourceId;
      if (!sourceId || !agentId) return;
      const { goal, attachments } = appendMessageToRunPayload(message);
      if ((!goal.trim() && !attachments.length) || !agentId) return;

      const idx = messages.findIndex((m) => m.id === sourceId);
      if (idx < 0) return;
      const base = messages.slice(0, idx);
      const parts = userPartsFromAppend(message);
      const display = userDisplayText(parts, goal);
      const userId = newId();
      const asstId = newId();

      const assistantAfter = messages[idx + 1];
      const replaceRunId =
        assistantAfter?.role === "assistant" && assistantAfter.runId ? assistantAfter.runId : null;

      applyMessages([
        ...base,
        {
          id: userId,
          role: "user",
          text: display,
          userParts: parts,
          runAttachments: attachments.length ? attachments : undefined,
        },
        { id: asstId, role: "assistant", text: t("agent.runLiveStarting") },
      ]);
      setIsRunning(true);
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      try {
        await executeRun(goal, attachments, asstId, signal, t as TFunction, null, replaceRunId, undefined);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runCancelled") } : m)),
          );
        } else if (e instanceof AgentRunWorkerStaleError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runWorkerStale") } : m)),
          );
        } else if (e instanceof AgentRunSubscribeStallError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runSubscribeStall") } : m)),
          );
        } else if (e instanceof AgentRunPollFailedError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runPollFailed") } : m)),
          );
        } else {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: errorText(e) } : m)),
          );
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        activeRunIdRef.current = null;
      }
    },
    [agentId, executeRun, messages, t, applyMessages],
  );

  const onReload = useCallback(
    async (parentId: string | null) => {
      if (!parentId || !agentId) return;
      // `startRun` passes the *user* message id as `parentId` (parent of the assistant turn).
      const userIdx = messages.findIndex((m) => m.id === parentId);
      if (userIdx < 0) return;
      const userMsg = messages[userIdx];
      if (userMsg.role !== "user") return;
      const assistantIdx = userIdx + 1;
      if (assistantIdx >= messages.length) return;
      const afterUser = messages[assistantIdx];
      if (afterUser.role !== "assistant") return;

      const attachments = userMsg.runAttachments ?? [];
      const goal = userMsg.text.trim();
      if (!goal && !attachments.length) return;

      const base = messages.slice(0, assistantIdx);
      const asstId = newId();
      const replaceRunId = afterUser.runId ?? null;
      // `base` already ends with the user turn; do not append `userMsg` again (duplicate id → MessageRepository error).
      applyMessages([...base, { id: asstId, role: "assistant", text: t("agent.runLiveStarting") }]);
      setIsRunning(true);
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      try {
        await executeRun(goal, attachments, asstId, signal, t as TFunction, null, replaceRunId, undefined);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runCancelled") } : m)),
          );
        } else if (e instanceof AgentRunWorkerStaleError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runWorkerStale") } : m)),
          );
        } else if (e instanceof AgentRunSubscribeStallError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runSubscribeStall") } : m)),
          );
        } else if (e instanceof AgentRunPollFailedError) {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runPollFailed") } : m)),
          );
        } else {
          applyMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: errorText(e) } : m)),
          );
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        activeRunIdRef.current = null;
      }
    },
    [agentId, executeRun, messages, t, applyMessages],
  );

  const onCancel = useCallback(async () => {
    const rid = activeRunIdRef.current;
    abortRef.current?.abort();
    if (rid) {
      try {
        await agentApi.cancelRun(rid);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const feedbackAdapter: FeedbackAdapter = useMemo(
    () => ({
      submit: ({ message, type }) => {
        const runId = message.metadata?.custom?.runId as string | undefined;
        if (!runId) return;
        void (async () => {
          try {
            const updated = await agentApi.setRunFeedback(runId, type);
            const fb =
              updated.feedback === "positive" || updated.feedback === "negative"
                ? updated.feedback
                : undefined;
            applyMessages((prev) =>
              prev.map((m) => {
                if (m.id !== message.id || m.role !== "assistant") return m;
                const updated: AgentRunMessage = { ...m };
                if (fb) updated.feedback = fb;
                else delete updated.feedback;
                return updated;
              }),
            );
          } catch {
            /* ignore */
          }
        })();
      },
    }),
    [applyMessages],
  );

  const attachmentAdapter = useMemo(
    () =>
      new CompositeAttachmentAdapter([
        new SimpleTextAttachmentAdapter(),
        new SimpleImageAttachmentAdapter(),
      ]),
    [],
  );

  const dictationAdapter = useMemo(() => {
    const allowDictation = WebSpeechDictationAdapter.isSupported() || isTauri();
    if (!allowDictation) return undefined;
    return new WebSpeechDictationAdapter({
      language: i18n.language?.startsWith("zh") ? "zh-CN" : "en-US",
    });
  }, [i18n.language]);

  const adapters = useMemo(
    () => ({
      attachments: attachmentAdapter,
      ...(dictationAdapter ? { dictation: dictationAdapter } : {}),
      feedback: feedbackAdapter,
    }),
    [attachmentAdapter, dictationAdapter, feedbackAdapter],
  );

  const runtime = useExternalStoreRuntime(
    thread.mode === "repository"
      ? {
          messageRepository: thread.repo,
          setMessages: applyMessages,
          isRunning,
          convertMessage,
          onNew,
          onEdit,
          onReload,
          onCancel,
          adapters,
        }
      : {
          messages: thread.items,
          setMessages: applyMessages,
          isRunning,
          convertMessage,
          onNew,
          onEdit,
          onReload,
          onCancel,
          adapters,
        },
  );
  runtimeRef.current = runtime;

  /**
   * Auto-persist on every conversation change (post-startRun). The runtime has
   * already received the new state by the time this effect runs because
   * `useExternalStoreRuntime` consumes `externalStoreAdapter` synchronously.
   *
   * Empty `messages` is treated as "nothing to persist" — covers `clearThread`
   * and the brand-new draft state before `startRun` returns a run id.
   */
  useEffect(() => {
    if (!sessionRunIdRef.current) return;
    if (messages.length === 0) return;
    schedulePersist();
  }, [messages, schedulePersist]);

  /**
   * Flush pending persist on unmount (run switch via `key` remount, navigation,
   * agent change). Without this, a debounce timer pending at unmount would
   * never fire.
   */
  useEffect(() => {
    return () => {
      flushPersist();
    };
  }, [flushPersist]);

  /**
   * Best-effort flush on tab close / navigation. The browser may cancel the
   * fetch but this gives the persist machinery one last chance to run.
   */
  useEffect(() => {
    const onBeforeUnload = () => {
      flushPersist();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushPersist]);

  return {
    runtime,
    messages,
    isRunning,
    loadRun,
    clearThread,
    dictationSupported: WebSpeechDictationAdapter.isSupported() || isTauri(),
    composerModel,
    setComposerModel,
    modelSelectRows,
    modelsLoading,
  };
}
