import { api } from "./api";

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "local" | "remote" | "cloud";
  path: string | null;
  owner_id: string;
}

export interface WorkspaceListOut {
  workspaces: WorkspaceInfo[];
  active_workspace_id: string | null;
}

export interface WorkspaceMcpServer {
  id: string;
  name: string;
  url: string | null;
  transport: string;
  workspace_id: string;
}

export interface WorkspaceMcpServerListOut {
  servers: WorkspaceMcpServer[];
}

export const workspaceApi = {
  list() {
    return api.get<WorkspaceListOut>("/workspaces/");
  },

  get(wsId: string) {
    return api.get<WorkspaceInfo>(`/workspaces/${wsId}`);
  },

  listMcpServers(workspaceId: string) {
    return api.get<WorkspaceMcpServerListOut>(`/workspaces/${workspaceId}/mcp-servers`);
  },
};
