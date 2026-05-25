"""REST API for MCP Gateway management + MCP Server Streamable HTTP endpoint."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import get_settings
from shared.database import get_db
from shared.dependencies import get_current_user
from shared.models.mcp_server import McpServer
from shared.models.user import User
from shared.schemas.mcp_registry import (
    BuiltinMcpOut,
    McpExternalServerCreate,
    McpExternalServerListOut,
    McpExternalServerOut,
    McpExternalServerUpdate,
    McpGatewayConfigOut,
    McpImportConfigBody,
    McpImportConfigOut,
)
from . import gateway
from .access import require_workspace_member
from .import_cursor_config import import_cursor_mcp_config
from .server import mcp_server
from .stdio_bridge import McpStdioBridgeError

router = APIRouter(tags=["mcp"])


def _parse_definition(s: McpServer) -> dict | None:
    try:
        d = json.loads(s.definition_json or "{}")
        return d if isinstance(d, dict) else None
    except json.JSONDecodeError:
        return None


def _serialize_server(s: McpServer) -> McpExternalServerOut:
    return McpExternalServerOut(
        id=s.id,
        name=s.name,
        url=s.url,
        transport=s.transport,
        auth_type=s.auth_type,
        workspace_id=s.workspace_id,
        is_active=s.is_active,
        last_health_check=s.last_health_check.isoformat() if s.last_health_check else None,
        created_at=s.created_at.isoformat() if s.created_at else None,
        definition=_parse_definition(s),
    )


# ─── MCP Streamable HTTP endpoint ────────────────────────────────

@router.post("/mcp")
async def mcp_streamable_http(request: Request):
    """Streamable HTTP transport endpoint for the MCP server.

    External AI tools POST JSON-RPC here to interact with Mozi's MCP capabilities.
    """
    from mcp.server.streamable_http import StreamableHTTPServerTransport

    transport = StreamableHTTPServerTransport("/api/v1/mcp")
    body = await request.body()
    response_body = await transport.handle_request(
        mcp_server, body, request.headers.get("content-type", "application/json"),
    )
    return Response(content=response_body, media_type="application/json")


# ─── Catalog & gateway (admin UI) ───────────────────────────────

@router.get("/mcp/builtin", response_model=BuiltinMcpOut)
async def get_builtin_mcp(_user: User = Depends(get_current_user)):
    s = get_settings()
    return BuiltinMcpOut(
        id="mozi-builtin",
        name=s.mcp_server_name,
        version=s.mcp_server_version,
        transport="streamable_http",
        endpoint_path=s.mcp_streamable_path,
        description=(
            "Mozi built-in MCP over Streamable HTTP. Configure external clients to POST "
            "JSON-RPC to your API base URL with this path."
        ),
    )


@router.get("/mcp/gateway-config", response_model=McpGatewayConfigOut)
async def get_gateway_config(_user: User = Depends(get_current_user)):
    s = get_settings()
    return McpGatewayConfigOut(
        streamable_http_path=s.mcp_streamable_path,
        proxy_http_timeout_seconds=s.mcp_proxy_http_timeout_seconds,
        server_name=s.mcp_server_name,
        server_version=s.mcp_server_version,
    )


# ─── Import from Cursor-style ~/.Mozi/mcp.json (client uploads `config`) ──

@router.post("/mcp/import-config", response_model=McpImportConfigOut)
async def import_mcp_config(
    body: McpImportConfigBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(db, body.workspace_id, user.id)
    servers, errors = await import_cursor_mcp_config(db, body.workspace_id, body.config)
    return McpImportConfigOut(servers=[_serialize_server(s) for s in servers], errors=errors)


# ─── Gateway CRUD — manage external MCP servers ──────────────────

@router.get("/mcp/servers", response_model=McpExternalServerListOut)
async def list_servers(
    workspace_id: str = Query(..., description="Workspace to list servers for"),
    include_inactive: bool = Query(False, description="When true, list disabled servers too (admin UI)"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(db, workspace_id, user.id)
    servers = await gateway.list_external_servers(db, workspace_id, only_active=not include_inactive)
    return McpExternalServerListOut(servers=[_serialize_server(s) for s in servers])


@router.post("/mcp/servers", response_model=McpExternalServerOut, status_code=201)
async def register_server(
    body: McpExternalServerCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_workspace_member(db, body.workspace_id, user.id)
    server = McpServer(
        name=body.name,
        url=body.url,
        transport=body.transport,
        auth_type=body.auth_type,
        auth_credential=body.auth_credential,
        workspace_id=body.workspace_id,
        definition_json="{}",
    )
    db.add(server)
    await db.commit()
    await db.refresh(server)
    return _serialize_server(server)


@router.patch("/mcp/servers/{server_id}", response_model=McpExternalServerOut)
async def update_server(
    server_id: str,
    body: McpExternalServerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(McpServer).where(McpServer.id == server_id))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(404, "Not found")
    await require_workspace_member(db, existing.workspace_id, user.id)
    patch = body.model_dump(exclude_unset=True)
    updated = await gateway.update_external_server(db, server_id, patch)
    if not updated:
        raise HTTPException(404, "Not found")
    return _serialize_server(updated)


@router.delete("/mcp/servers/{server_id}")
async def remove_server(
    server_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(McpServer).where(McpServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(404, "Not found")
    await require_workspace_member(db, server.workspace_id, user.id)
    await db.delete(server)
    await db.commit()
    return {"success": True}


@router.get("/mcp/servers/{server_id}/tools")
async def list_remote_tools(
    server_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(McpServer).where(McpServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(404, "Not found")
    await require_workspace_member(db, server.workspace_id, user.id)
    try:
        tools = await gateway.proxy_list_tools(server)
    except McpStdioBridgeError as e:
        raise HTTPException(502, detail=f"stdio_mcp: {e}") from e
    return {"tools": tools}


@router.post("/mcp/servers/{server_id}/call")
async def call_remote_tool(
    server_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(McpServer).where(McpServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(404, "Not found")
    await require_workspace_member(db, server.workspace_id, user.id)
    try:
        return await gateway.proxy_call_tool(server, body["tool_name"], body.get("arguments", {}))
    except McpStdioBridgeError as e:
        raise HTTPException(502, detail=f"stdio_mcp: {e}") from e
    except ValueError as e:
        if str(e) == "mcp_transport_not_supported":
            raise HTTPException(400, "mcp_transport_not_supported") from e
        raise
