import { useEffect, type FC } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AgentRunGrokThread } from "@/pages/agent/components/AgentRunGrokThread";
import { useAgentRunRuntime } from "@/pages/agent/hooks/useAgentRunRuntime";
import type { AgentProviderId } from "@/pages/agent/utils";

export type AgentRunSessionProps = {
  agentId: string;
  selectedRunId: string | null;
  agentLlmProvider: AgentProviderId;
  agentDefaultModel: string | null;
  agentName: string | null;
  onRunSettled: () => void;
};

/**
 * Isolated `useAgentRunRuntime` + assistant-ui provider so we can remount on
 * `key` when switching history / new chat. That resets ExternalStore
 * `MessageRepository` state (assistant-ui does not clear it when only
 * `messages[]` changes), which otherwise breaks BranchPicker and can make
 * the thread look like duplicated runs.
 */
export const AgentRunSession: FC<AgentRunSessionProps> = ({
  agentId,
  selectedRunId,
  agentLlmProvider,
  agentDefaultModel,
  agentName,
  onRunSettled,
}) => {
  const {
    runtime,
    loadRun,
    clearThread,
    dictationSupported,
    composerModel,
    setComposerModel,
    modelSelectRows,
    modelsLoading,
  } = useAgentRunRuntime({
    agentId,
    agentLlmProvider,
    agentDefaultModel,
    onRunSettled,
  });

  useEffect(() => {
    let cancelled = false;
    if (!selectedRunId) {
      clearThread();
      return;
    }
    void (async () => {
      try {
        await loadRun(selectedRunId);
      } catch {
        if (!cancelled) clearThread();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, loadRun, clearThread]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgentRunGrokThread
        agentName={agentName}
        dictationSupported={dictationSupported}
        composerModel={composerModel}
        onComposerModelChange={setComposerModel}
        modelSelectRows={modelSelectRows}
        modelsLoading={modelsLoading}
      />
    </AssistantRuntimeProvider>
  );
};
