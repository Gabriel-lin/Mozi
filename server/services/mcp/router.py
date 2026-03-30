"""REST API for MCP Gateway management + MCP Server Streamable HTTP endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.dependencies import get_current_user
from shared.models.mcp_server import McpServer
from shared.models.user import User
from . import gateway
from .server import mcp_server

router = APIRouter(tags=["mcp"])


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
        mcp_server, body, request.headers.get("content-type", "application/json")
    )
    return Response(content=response_body, media_type="application/json")


# ─── Gateway CRUD — manage external MCP servers ──────────────────

@router.get("/mcp/servers")
async def list_servers(
    workspace_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    servers = await gateway.list_external_servers(db, workspace_id)
    return {"servers": [_serialize(s) for s in servers]}


@router.post("/mcp/servers", status_code=201)
async def register_server(
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    server = McpServer(
        name=body["name"],
        url=body["url"],
        transport=body.get("transport", "streamable_http"),
        auth_type=body.get("auth_type"),
        auth_credential=body.get("auth_credential"),
        workspace_id=body["workspace_id"],
    )
    db.add(server)
    await db.commit()
    await db.refresh(server)
    return _serialize(server)


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
    tools = await gateway.proxy_list_tools(server)
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
    response = await gateway.proxy_call_tool(server, body["tool_name"], body.get("arguments", {}))
    return response


def _serialize(s: McpServer) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "url": s.url,
        "transport": s.transport,
        "auth_type": s.auth_type,
        "workspace_id": s.workspace_id,
        "is_active": s.is_active,
        "last_health_check": s.last_health_check.isoformat() if s.last_health_check else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
