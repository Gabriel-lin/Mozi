import { api } from "./api";

// ── Types ──

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  workspace_id: string;
  created_by: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowListOut {
  workflows: Workflow[];
  total: number;
  page: number;
  page_size: number;
}

export interface WorkflowCreateInput {
  name: string;
  description?: string;
  workspace_id: string;
  tags?: string[];
}

export interface WorkflowUpdateInput {
  name?: string;
  description?: string;
  status?: "draft" | "active" | "archived";
  tags?: string[];
}

export interface RunOut {
  id: string;
  workflow_id: string;
  version_id: string | null;
  status: string;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  node_results: unknown[];
  error: string | null;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RunCreateInput {
  input_data?: Record<string, unknown>;
  version_id?: string;
}

export interface RunEvent {
  type:
    | "run_started"
    | "node_started"
    | "node_completed"
    | "node_error"
    | "run_completed"
    | "run_failed"
    | "run_cancelled";
  node_id?: string;
  output?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
  node_results?: unknown[];
  timestamp?: number;
}

export interface WorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  graph_data: GraphData;
  change_log: string | null;
  created_by: string;
  created_at: string;
}

export interface GraphData {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
}

export interface VersionCreateInput {
  graph_data: GraphData;
  change_log?: string;
}

export interface VersionListOut {
  versions: WorkflowVersion[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProviderModel {
  id: string;
  name: string;
  default?: boolean;
}

export interface ProviderModelsOut {
  provider: string;
  models: ProviderModel[];
  source?: "live" | "openrouter" | "none";
}

// ── API ──

const PREFIX = "/workflows";

export const workflowApi = {
  list(workspaceId: string, page = 1, pageSize = 20) {
    return api.get<WorkflowListOut>(`${PREFIX}/`, {
      params: { workspace_id: workspaceId, page, page_size: pageSize },
    });
  },

  get(workflowId: string) {
    return api.get<Workflow>(`${PREFIX}/${workflowId}`);
  },

  create(body: WorkflowCreateInput) {
    return api.post<Workflow>(`${PREFIX}/`, body);
  },

  update(workflowId: string, body: WorkflowUpdateInput) {
    return api.patch<Workflow>(`${PREFIX}/${workflowId}`, body);
  },

  delete(workflowId: string) {
    return api.delete<{ success: boolean }>(`${PREFIX}/${workflowId}`);
  },

  run(workflowId: string, body: RunCreateInput = {}) {
    return api.post<RunOut>(`${PREFIX}/${workflowId}/run`, body);
  },

  listVersions(workflowId: string, page = 1, pageSize = 20) {
    return api.get<VersionListOut>(`${PREFIX}/${workflowId}/versions`, {
      params: { page, page_size: pageSize },
    });
  },

  createVersion(workflowId: string, body: VersionCreateInput) {
    return api.post<WorkflowVersion>(`${PREFIX}/${workflowId}/versions`, body);
  },

  getVersion(versionId: string) {
    return api.get<WorkflowVersion>(`${PREFIX}/versions/${versionId}`);
  },

  getRun(runId: string) {
    return api.get<RunOut>(`${PREFIX}/runs/${runId}`);
  },

  cancelRun(runId: string) {
    return api.post<{ success: boolean; status: string }>(`${PREFIX}/runs/${runId}/cancel`);
  },

  connectRunWs(runId: string): WebSocket {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return new WebSocket(`${proto}//${host}/api/v1${PREFIX}/runs/${runId}/ws`);
  },

  getProviderModels(provider: string, apiKey?: string, apiBase?: string) {
    const params: Record<string, string> = { provider };
    if (apiKey) params.api_key = apiKey;
    if (apiBase) params.api_base = apiBase;
    return api.get<ProviderModelsOut>(`${PREFIX}/llm/providers/models`, { params });
  },
};
