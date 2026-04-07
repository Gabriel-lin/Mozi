import { api } from "./api";

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
}

interface WorkspaceListOut {
  workspaces: WorkspaceInfo[];
}

export const workspaceApi = {
  list() {
    return api.get<WorkspaceListOut>("/workspaces/");
  },
};
