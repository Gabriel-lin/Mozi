import { api } from "./api";

export interface BuiltinMcp {
  id: string;
  name: string;
  version: string;
  transport: string;
  endpoint_path: string;
  description: string;
}

export interface McpGatewayConfig {
  streamable_http_path: string;
  proxy_http_timeout_seconds: number;
  server_name: string;
  server_version: string;
}

export interface ExternalMcpServer {
  id: string;
  name: string;
  url: string | null;
  transport: string;
  auth_type: string | null;
  workspace_id: string;
  is_active: boolean;
  last_health_check: string | null;
  created_at: string | null;
  definition?: Record<string, unknown> | null;
}

export interface ExternalMcpServerListOut {
  servers: ExternalMcpServer[];
}

export interface McpImportConfigResult {
  servers: ExternalMcpServer[];
  errors: string[];
}

export interface McpServerRegisterInput {
  name: string;
  url: string;
  workspace_id: string;
  transport?: string;
  auth_type?: string | null;
  auth_credential?: string | null;
}

export type McpServerUpdateInput = Partial<{
  name: string;
  url: string;
  transport: string;
  auth_type: string | null;
  auth_credential: string | null;
  is_active: boolean;
}>;

export const mcpApi = {
  getBuiltin() {
    return api.get<BuiltinMcp>("/mcp/builtin");
  },

  getGatewayConfig() {
    return api.get<McpGatewayConfig>("/mcp/gateway-config");
  },

  listServers(workspaceId: string, options?: { includeInactive?: boolean }) {
    return api.get<ExternalMcpServerListOut>("/mcp/servers", {
      params: {
        workspace_id: workspaceId,
        include_inactive: options?.includeInactive === true,
      },
    });
  },

  registerServer(body: McpServerRegisterInput) {
    return api.post<ExternalMcpServer>("/mcp/servers", body);
  },

  updateServer(serverId: string, body: McpServerUpdateInput) {
    return api.patch<ExternalMcpServer>(`/mcp/servers/${serverId}`, body);
  },

  removeServer(serverId: string) {
    return api.delete<{ success: boolean }>(`/mcp/servers/${serverId}`);
  },

  /** Sync servers for the workspace from a Cursor-style mcp.json object (e.g. read via loadLocalMoziMcpJson). */
  importConfig(workspaceId: string, config: Record<string, unknown>) {
    return api.post<McpImportConfigResult>("/mcp/import-config", {
      workspace_id: workspaceId,
      config,
    });
  },
};
