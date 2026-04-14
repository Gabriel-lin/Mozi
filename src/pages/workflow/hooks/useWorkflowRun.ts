import { useCallback, useEffect, useRef, useState } from "react";
import { workflowApi, type RunOut, type RunEvent } from "@/services/workflow";
import { extractErrorMessage } from "@/lib/utils";

// ── Types ──

export type NodeRunStatus = "idle" | "running" | "completed" | "failed" | "skipped";

export interface NodeRunState {
  status: NodeRunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface UseWorkflowRunOptions {
  workflowId?: string;
}

export type RunStatus = "idle" | "running" | "completed" | "failed";

export interface UseWorkflowRunReturn {
  runStatus: RunStatus;
  runError: string | null;
  currentRun: RunOut | null;
  nodeRunStates: Record<string, NodeRunState>;
  run: () => Promise<void>;
  cancelRun: () => Promise<void>;
  resetRunStates: () => void;
}

export function useWorkflowRun({ workflowId }: UseWorkflowRunOptions = {}): UseWorkflowRunReturn {
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<RunOut | null>(null);
  const [nodeRunStates, setNodeRunStates] = useState<Record<string, NodeRunState>>({});

  // ── WebSocket management ──
  const wsRef = useRef<WebSocket | null>(null);
  const runningRef = useRef(false);

  const closeWs = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      wsRef.current = null;
    }
  }, []);

  // ── Polling fallback ──
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      closeWs();
      stopPoll();
    },
    [closeWs, stopPoll],
  );

  const startPoll = useCallback(
    (runId: string) => {
      stopPoll();
      pollRef.current = setInterval(async () => {
        if (!runningRef.current) {
          stopPoll();
          return;
        }
        try {
          const r = await workflowApi.getRun(runId);
          if (["completed", "failed", "cancelled"].includes(r.status)) {
            stopPoll();
            runningRef.current = false;
            if (r.status === "failed") {
              setRunStatus("failed");
              setRunError(extractErrorMessage(r.error ?? "未知错误"));
            } else {
              setRunStatus(r.status === "cancelled" ? "idle" : (r.status as RunStatus));
            }
            closeWs();
          }
        } catch {
          /* ignore poll errors */
        }
      }, 3000);
    },
    [closeWs, stopPoll],
  );

  // ── Run workflow ──
  const run = useCallback(async () => {
    if (!workflowId || runningRef.current) return;
    runningRef.current = true;
    setRunStatus("running");
    setRunError(null);
    setNodeRunStates({});
    setCurrentRun(null);
    closeWs();
    stopPoll();

    try {
      const result = await workflowApi.run(workflowId);
      setCurrentRun(result);

      // Start polling immediately as a safety net
      startPoll(result.id);

      const ws = workflowApi.connectRunWs(result.id);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const evt: RunEvent = JSON.parse(e.data);

          switch (evt.type) {
            case "node_started":
              if (evt.node_id) {
                setNodeRunStates((prev) => ({
                  ...prev,
                  [evt.node_id!]: {
                    status: "running",
                    startedAt: evt.timestamp,
                  },
                }));
              }
              break;

            case "node_completed":
              if (evt.node_id) {
                setNodeRunStates((prev) => ({
                  ...prev,
                  [evt.node_id!]: {
                    status: "completed",
                    output: evt.output ?? undefined,
                    completedAt: evt.timestamp,
                  },
                }));
              }
              break;

            case "node_error":
              if (evt.node_id) {
                setNodeRunStates((prev) => ({
                  ...prev,
                  [evt.node_id!]: {
                    status: "failed",
                    error: evt.error ?? undefined,
                    completedAt: evt.timestamp,
                  },
                }));
              }
              break;

            case "run_completed":
              runningRef.current = false;
              setRunStatus("completed");
              stopPoll();
              closeWs();
              break;

            case "run_failed":
              runningRef.current = false;
              setRunStatus("failed");
              setRunError(extractErrorMessage(evt.error ?? "未知错误"));
              stopPoll();
              closeWs();
              break;

            case "run_cancelled":
              runningRef.current = false;
              setRunStatus("idle");
              stopPoll();
              closeWs();
              break;
          }
        } catch {
          /* ignore malformed messages */
        }
      };

      // WS errors: close WS silently and let polling take over
      ws.onerror = () => {
        closeWs();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };
    } catch {
      runningRef.current = false;
      stopPoll();
      setRunStatus("failed");
    }
  }, [workflowId, closeWs, stopPoll, startPoll]);

  // ── Cancel run ──
  const cancelRun = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "cancel" }));
    }

    const runId = currentRun?.id;
    if (runId) {
      try {
        await workflowApi.cancelRun(runId);
      } catch {
        /* best-effort */
      }
    }

    runningRef.current = false;
    setRunStatus("idle");
    setNodeRunStates({});
    stopPoll();
    closeWs();
  }, [closeWs, stopPoll, currentRun]);

  // ── Reset all run states ──
  const resetRunStates = useCallback(() => {
    runningRef.current = false;
    setNodeRunStates({});
    setRunStatus("idle");
    setRunError(null);
    setCurrentRun(null);
    stopPoll();
    closeWs();
  }, [closeWs, stopPoll]);

  return {
    runStatus,
    runError,
    currentRun,
    nodeRunStates,
    run,
    cancelRun,
    resetRunStates,
  };
}
