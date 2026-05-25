import { api } from "./api";

export type ToolkitSource = "builtin" | "mcp" | "custom";

export interface Toolkit {
  id: string;
  name: string;
  description: string | null;
  version: string;
  installed: boolean;
  category: string | null;
  icon: string | null;
  source: ToolkitSource;
  executor_key: string | null;
  mcp_server_id: string | null;
}

export interface ToolkitListOut {
  toolkits: Toolkit[];
  total: number;
}

export interface ToolkitRegisterInput {
  name: string;
  description?: string;
  version?: string;
  category?: string;
  icon?: string;
  source: "mcp" | "custom";
  mcp_server_id?: string;
  /** Required with source=mcp; server must belong to this workspace. */
  workspace_id?: string;
  executor_key?: string;
  config_json?: string;
}

export const toolkitApi = {
  list(workspaceId: string) {
    return api.get<ToolkitListOut>(`/workspaces/${workspaceId}/toolkits/`);
  },

  install(workspaceId: string, toolkitId: string) {
    return api.post<{ success: boolean }>(
      `/workspaces/${workspaceId}/toolkits/${toolkitId}/install`,
    );
  },

  uninstall(workspaceId: string, toolkitId: string) {
    return api.delete<{ success: boolean }>(
      `/workspaces/${workspaceId}/toolkits/${toolkitId}/uninstall`,
    );
  },

  register(body: ToolkitRegisterInput) {
    return api.post<Toolkit>("/toolkits/register", body);
  },

  update(
    toolkitId: string,
    body: Partial<Pick<Toolkit, "name" | "description" | "version" | "category" | "icon">>,
  ) {
    return api.patch<Toolkit>(`/toolkits/${toolkitId}`, body);
  },

  delete(toolkitId: string) {
    return api.delete<{ success: boolean }>(`/toolkits/${toolkitId}`);
  },
};
