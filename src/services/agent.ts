import { api } from "./api";

const PREFIX = "/agents";

export interface AgentOut {
  id: string;
  name: string;
  description: string | null;
  version: string;
  config: Record<string, unknown>;
  system_prompt: string | null;
  model: string | null;
  max_steps: number;
  tags: unknown[];
  workspace_id: string;
  created_by: string;
  created_at: string;
}

export interface AgentListOut {
  agents: AgentOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface AgentCreateInput {
  name: string;
  description?: string | null;
  workspace_id: string;
  config?: Record<string, unknown> | null;
  system_prompt?: string | null;
  model?: string | null;
  max_steps?: number;
  tags?: string[] | null;
}

export interface AgentUpdateInput {
  name?: string;
  description?: string | null;
  config?: Record<string, unknown> | null;
  system_prompt?: string | null;
  model?: string | null;
  max_steps?: number;
  tags?: string[] | null;
}

export interface AgentSkillSourceItem {
  id: string;
  label: string;
  sources: ("mozi" | "agents" | "config")[];
}

export interface AgentSkillCatalogOut {
  items: AgentSkillSourceItem[];
  selected: string[];
}

/** `GET /agents/:id` — includes skill list for the editor. */
export interface AgentDetailOut extends AgentOut {
  skill_catalog: AgentSkillCatalogOut;
}

export interface CreateLocalSkillInput {
  name: string;
  title?: string | null;
  description?: string | null;
}

/** Step persisted on `AgentRun` after execution (LangChain tool loop). */
export interface AgentRunStep {
  tool: string;
  input: string;
  output: string;
}

export interface RunOut {
  id: string;
  agent_id: string;
  status: string;
  goal: string | null;
  steps: AgentRunStep[];
  output: Record<string, unknown> | null;
  error: string | null;
  total_steps: number;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  pinned_at?: string | null;
  feedback?: string | null;
}

export interface RunListOut {
  runs: RunOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface RunAttachmentIn {
  name: string;
  mime_type?: string | null;
  text?: string | null;
}

export interface RunCreateInput {
  goal: string;
  attachments?: RunAttachmentIn[];
  /** Overrides agent default model for this run (OpenAI id or vLLM served name). */
  model?: string | null;
}

export const agentApi = {
  list(workspaceId: string, page = 1, pageSize = 20) {
    return api.get<AgentListOut>(`${PREFIX}/`, {
      params: { workspace_id: workspaceId, page, page_size: pageSize },
    });
  },

  get(agentId: string) {
    return api.get<AgentDetailOut>(`${PREFIX}/${agentId}`);
  },

  createLocalSkill(agentId: string, body: CreateLocalSkillInput) {
    return api.post<AgentSkillCatalogOut>(`${PREFIX}/${agentId}/skills/create-local`, body);
  },

  importSkillFolder(agentId: string, formData: FormData) {
    return api.postFormData<AgentSkillCatalogOut>(`${PREFIX}/${agentId}/skills/import`, formData);
  },

  importSkillZip(agentId: string, formData: FormData) {
    return api.postFormData<AgentSkillCatalogOut>(
      `${PREFIX}/${agentId}/skills/import-zip`,
      formData,
    );
  },

  create(body: AgentCreateInput) {
    return api.post<AgentOut>(`${PREFIX}/`, body);
  },

  update(agentId: string, body: AgentUpdateInput) {
    return api.patch<AgentOut>(`${PREFIX}/${agentId}`, body);
  },

  startRun(agentId: string, body: RunCreateInput) {
    return api.post<RunOut>(`${PREFIX}/${agentId}/run`, body);
  },

  listRuns(agentId: string, page = 1, pageSize = 30) {
    return api.get<RunListOut>(`${PREFIX}/${agentId}/runs`, {
      params: { page, page_size: pageSize, _: Date.now() },
      cache: "no-store",
    });
  },

  getRun(runId: string) {
    return api.get<RunOut>(`${PREFIX}/runs/${runId}`, {
      params: { _: Date.now() },
      cache: "no-store",
    });
  },

  cancelRun(runId: string) {
    return api.post<void>(`${PREFIX}/runs/${runId}/cancel`, {});
  },

  deleteRun(runId: string) {
    return api.delete<void>(`${PREFIX}/runs/${runId}`);
  },

  pinRun(runId: string, pinned: boolean) {
    return api.post<RunOut>(`${PREFIX}/runs/${runId}/pin`, { pinned });
  },

  setRunFeedback(runId: string, feedback: "positive" | "negative") {
    return api.post<RunOut>(`${PREFIX}/runs/${runId}/feedback`, { feedback });
  },
};
