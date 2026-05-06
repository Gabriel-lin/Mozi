import { useAuthStore } from "@mozi/store";
import { agentApi } from "./agent";

/** Payloads from Redis → WebSocket for agent runs. */
export type AgentRunStreamEvent = {
  type: string;
  timestamp?: number;
  text?: string;
  phase?: string;
  tool?: string;
  input?: string;
  output?: string;
  run_id?: string;
  error?: string;
  total_steps?: number;
  system_prompt_preview?: string;
  user_goal?: string;
  model?: string;
  tool_count?: number;
  agent_id?: string;
};

export type AgentRunTerminal = "completed" | "failed" | "stopped";

/** Run stayed `idle` — Celery worker likely not consuming `agent-runs`. */
export class AgentRunWorkerStaleError extends Error {
  constructor() {
    super("AgentRunWorkerStaleError");
    this.name = "AgentRunWorkerStaleError";
  }
}

const WS_TERMINAL = new Set(["run_completed", "run_failed", "run_stopped"]);

/** DB fallback while WS connects. Keep one request in flight to avoid stale responses piling up. */
const POLL_MS = 400;

function terminalFromDbStatus(status: string): AgentRunTerminal | null {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "stopped") return "stopped";
  return null;
}

export function connectAgentRunWs(runId: string): WebSocket {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const token = useAuthStore.getState().session?.accessToken ?? "";
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return new WebSocket(`${proto}//${host}/api/v1/agents/runs/${runId}/ws${q}`);
}

/**
 * Subscribe until a terminal event or abort. Resolves with terminal kind.
 * Falls back to polling `GET /agents/runs/{id}` so the UI still completes if WS
 * stays open but Redis emits nothing (e.g. worker down or wrong broker URL).
 */
export function subscribeAgentRunEvents(
  runId: string,
  onEvent: (e: AgentRunStreamEvent) => void,
  signal: AbortSignal,
): Promise<AgentRunTerminal> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const subscribeStartedAt = Date.now();
    const IDLE_STALE_MS = 20_000;
    const ws = connectAgentRunWs(runId);
    let settled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let pollInFlight = false;

    const cleanup = () => {
      if (pollTimer !== undefined) {
        clearTimeout(pollTimer);
        pollTimer = undefined;
      }
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      signal.removeEventListener("abort", onAbort);
      fn();
    };

    const tryFinishFromDb = async (): Promise<boolean> => {
      if (settled) return true;
      try {
        const run = await agentApi.getRun(runId);
        const kind = terminalFromDbStatus(run.status);
        if (kind) {
          ws.close();
          finish(() => resolve(kind));
          return true;
        }
        if (run.status === "idle" && Date.now() - subscribeStartedAt >= IDLE_STALE_MS) {
          ws.close();
          finish(() => reject(new AgentRunWorkerStaleError()));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    const pollOnce = async (): Promise<void> => {
      if (settled || pollInFlight) return;
      pollInFlight = true;
      try {
        await tryFinishFromDb();
      } finally {
        pollInFlight = false;
      }
    };

    const schedulePoll = (delayMs: number) => {
      cleanup();
      pollTimer = setTimeout(() => {
        void (async () => {
          await pollOnce();
          if (!settled) schedulePoll(POLL_MS);
        })();
      }, delayMs);
    };

    const onAbort = () => {
      ws.close();
      finish(() => reject(new DOMException("Aborted", "AbortError")));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    schedulePoll(0);

    ws.onopen = () => {
      void pollOnce();
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(String(msg.data)) as AgentRunStreamEvent;
        onEvent(data);
        // If the terminal WS frame is dropped, DB often commits first — catch up immediately.
        void pollOnce();
        if (WS_TERMINAL.has(data.type)) {
          ws.close();
          finish(() => {
            if (data.type === "run_completed") resolve("completed");
            else if (data.type === "run_failed") resolve("failed");
            else resolve("stopped");
          });
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onerror = () => {
      /* Browsers typically follow with `onclose`; avoid rejecting while run may still be `executing`. */
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };

    ws.onclose = (ev) => {
      if (settled) return;
      if (signal.aborted) {
        finish(() => reject(new DOMException("Aborted", "AbortError")));
        return;
      }
      void (async () => {
        if (await tryFinishFromDb()) return;
        finish(() => reject(new Error(`WebSocket closed before completion (${ev.code})`)));
      })();
    };
  });
}
