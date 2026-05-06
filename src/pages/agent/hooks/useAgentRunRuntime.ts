import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  WebSpeechDictationAdapter,
  useExternalStoreRuntime,
  type AppendMessage,
  type FeedbackAdapter,
  type ThreadMessageLike,
  type ThreadUserMessagePart,
} from "@assistant-ui/react";
import type { TFunction } from "i18next";
import type { RunAttachmentIn, RunOut } from "@/services/agent";
import { agentApi } from "@/services/agent";
import { subscribeAgentRunEvents, AgentRunWorkerStaleError } from "@/services/agentRunStream";
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

export type AgentRunMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  runId?: string;
  feedback?: "positive" | "negative";
  /** Parts shown in thread (text / image / file); omit for text-only. */
  userParts?: readonly ThreadUserMessagePart[];
  /** Echo for regenerate after reload. */
  runAttachments?: RunAttachmentIn[];
};

function newId() {
  return crypto.randomUUID();
}

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
  const { models, loading: modelsLoading } = useAgentProviderModels(agentLlmProvider);
  const [messages, setMessages] = useState<readonly AgentRunMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [composerModel, setComposerModel] = useState<string>(AGENT_RUN_DEFAULT_MODEL_ID);
  const abortRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

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

  const loadRun = useCallback(async (runId: string) => {
    abortRef.current?.abort();
    const run = await agentApi.getRun(runId);
    const goal = run.goal?.trim() ?? "";
    const body = formatAgentRunMarkdown(run);
    const fb =
      run.feedback === "positive" || run.feedback === "negative" ? run.feedback : undefined;
    setMessages([
      { id: `u-${run.id}`, role: "user", text: goal || "—" },
      { id: `a-${run.id}`, role: "assistant", text: body, runId: run.id, feedback: fb },
    ]);
  }, []);

  const clearThread = useCallback(() => {
    abortRef.current?.abort();
    activeRunIdRef.current = null;
    setMessages([]);
  }, []);

  useEffect(() => {
    setComposerModel(AGENT_RUN_DEFAULT_MODEL_ID);
  }, [agentId]);

  useEffect(() => {
    const m = agentDefaultModel?.trim();
    if (m) setComposerModel(m);
  }, [agentDefaultModel]);

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
        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, text: md } : m)));
      };

      const started = await agentApi.startRun(agentId, {
        goal,
        attachments: attachments.length ? attachments : undefined,
        model: composerModel.trim() || undefined,
      });
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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId ? { ...m, text: body, runId: started.id, feedback: fb } : m,
        ),
      );
      onRunSettled?.();
    },
    [agentId, composerModel, onRunSettled],
  );

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const { goal, attachments } = appendMessageToRunPayload(message);
      if ((!goal.trim() && !attachments.length) || !agentId) return;

      const userId = newId();
      const asstId = newId();
      const parts = userPartsFromAppend(message);
      const display = userDisplayText(parts, goal);
      setMessages((prev) => [
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
        await executeRun(goal, attachments, asstId, signal, t as TFunction, streamSnap);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runCancelled") } : m)),
          );
        } else if (e instanceof AgentRunWorkerStaleError) {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runWorkerStale") } : m)),
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
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: rid ? fallback : errorText(e) } : m)),
          );
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        activeRunIdRef.current = null;
      }
    },
    [agentId, executeRun, t],
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

      setMessages([
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
        await executeRun(goal, attachments, asstId, signal, t as TFunction, null);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runCancelled") } : m)),
          );
        } else if (e instanceof AgentRunWorkerStaleError) {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runWorkerStale") } : m)),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: errorText(e) } : m)),
          );
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        activeRunIdRef.current = null;
      }
    },
    [agentId, executeRun, messages, t],
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
      // `base` already ends with the user turn; do not append `userMsg` again (duplicate id → MessageRepository error).
      setMessages([...base, { id: asstId, role: "assistant", text: t("agent.runLiveStarting") }]);
      setIsRunning(true);
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      try {
        await executeRun(goal, attachments, asstId, signal, t as TFunction, null);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runCancelled") } : m)),
          );
        } else if (e instanceof AgentRunWorkerStaleError) {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: t("agent.runWorkerStale") } : m)),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstId ? { ...m, text: errorText(e) } : m)),
          );
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        activeRunIdRef.current = null;
      }
    },
    [agentId, executeRun, messages, t],
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
            setMessages((prev) =>
              prev.map((m) =>
                m.id === message.id && m.role === "assistant" ? { ...m, feedback: fb } : m,
              ),
            );
          } catch {
            /* ignore */
          }
        })();
      },
    }),
    [],
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

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew,
    onEdit,
    onReload,
    onCancel,
    adapters: {
      attachments: attachmentAdapter,
      ...(dictationAdapter ? { dictation: dictationAdapter } : {}),
      feedback: feedbackAdapter,
    },
  });

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
