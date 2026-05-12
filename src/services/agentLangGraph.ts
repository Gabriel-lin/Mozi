import { api } from "./api";

const PREFIX = "/agents";

export interface LangGraphThread {
  id: string;
  agent_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface LangGraphThreadListOut {
  threads: LangGraphThread[];
  total: number;
  page: number;
  page_size: number;
}

export interface LangGraphThreadMessagesOut {
  thread_id: string;
  messages: Record<string, unknown>[];
}

export const agentLangGraphApi = {
  listThreads(agentId: string, page = 1, pageSize = 50) {
    return api.get<LangGraphThreadListOut>(`${PREFIX}/${agentId}/threads`, {
      params: { page, page_size: pageSize, _: Date.now() },
      cache: "no-store",
    });
  },

  createThread(agentId: string, title?: string | null) {
    return api.post<LangGraphThread>(`${PREFIX}/${agentId}/threads`, {
      title: title ?? null,
    });
  },

  getThreadMessages(agentId: string, threadId: string) {
    return api.get<LangGraphThreadMessagesOut>(
      `${PREFIX}/${agentId}/threads/${threadId}/messages`,
      { params: { _: Date.now() }, cache: "no-store" },
    );
  },

  patchThread(
    agentId: string,
    threadId: string,
    body: { title?: string | null; archived?: boolean | null },
  ) {
    return api.patch<LangGraphThread>(`${PREFIX}/${agentId}/threads/${threadId}`, body);
  },

  deleteThread(agentId: string, threadId: string) {
    return api.delete<void>(`${PREFIX}/${agentId}/threads/${threadId}`);
  },

  /** Absolute URL for the streaming chat endpoint; consumed by AI SDK transport. */
  chatUrl(agentId: string): string {
    const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api/v1";
    return `${base}${PREFIX}/${agentId}/chat`;
  },
};
