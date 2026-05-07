"""MCP gateway REST schemas (builtin catalog, external servers, config)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class BuiltinMcpOut(BaseModel):
    """Mozi built-in MCP over Streamable HTTP (same process / gateway URL)."""
    id: str = Field(description="Logical id for UI")
    name: str
    version: str
    transport: str = "streamable_http"
    endpoint_path: str = Field(description="POST path on API host, e.g. /api/v1/mcp")
    description: str


class McpGatewayConfigOut(BaseModel):
    """Read-only gateway tuning exposed to the admin UI."""
    streamable_http_path: str
    proxy_http_timeout_seconds: int
    server_name: str
    server_version: str


class McpExternalServerOut(BaseModel):
    id: str
    name: str
    url: str | None = None
    transport: str
    auth_type: str | None = None
    workspace_id: str
    is_active: bool
    last_health_check: str | None = None
    created_at: str | None = None
    definition: dict | None = Field(default=None, description="Cursor-style entry: command/args/env or url")

    model_config = {"from_attributes": False}


class McpExternalServerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=500)
    workspace_id: str = Field(min_length=1, max_length=21)
    transport: str = Field(default="streamable_http", max_length=30)
    auth_type: str | None = Field(default=None, max_length=20)
    auth_credential: str | None = None


class McpExternalServerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    url: str | None = Field(default=None, max_length=500)
    transport: str | None = Field(default=None, max_length=30)
    auth_type: str | None = Field(default=None, max_length=20)
    auth_credential: str | None = None
    is_active: bool | None = None


class McpExternalServerListOut(BaseModel):
    servers: list[McpExternalServerOut]


class McpImportConfigBody(BaseModel):
    """Full JSON object as in ~/.Mozi/mcp.json (must include `mcpServers`)."""
    workspace_id: str = Field(min_length=1, max_length=21)
    config: dict


class McpImportConfigOut(BaseModel):
    servers: list[McpExternalServerOut]
    errors: list[str]
