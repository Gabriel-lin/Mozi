"""MCP Gateway — aggregates external MCP servers registered in DB, proxies tool calls."""

from __future__ import annotations

import httpx
import structlog
from shared.config import get_settings
from shared.models.mcp_server import McpServer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .stdio_bridge import stdio_call_tool, stdio_list_tools

log = structlog.get_logger()


async def update_external_server(db: AsyncSession, server_id: str, data: dict) -> McpServer | None:
    """Patch fields on an external MCP server row."""
    allowed = {
        "name",
        "url",
        "transport",
        "auth_type",
        "auth_credential",
        "is_active",
        "definition_json",
    }
    result = await db.execute(select(McpServer).where(McpServer.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        return None
    for key, value in data.items():
        if key not in allowed or value is None:
            continue
        setattr(server, key, value)
    await db.commit()
    await db.refresh(server)
    return server


async def list_external_servers(
    db: AsyncSession,
    workspace_id: str,
    *,
    only_active: bool = True,
) -> list[McpServer]:
    q = select(McpServer).where(McpServer.workspace_id == workspace_id)
    if only_active:
        q = q.where(McpServer.is_active.is_(True))
    q = q.order_by(McpServer.name)
    result = await db.execute(q)
    return list(result.scalars().all())


async def proxy_list_tools(server: McpServer) -> list[dict]:
    """Call tools/list on an external MCP server (Streamable HTTP or local stdio subprocess)."""
    if server.transport == "stdio":
        return await stdio_list_tools(server)
    if server.transport != "streamable_http" or not server.url:
        log.warning("mcp_proxy_skip_non_http", server_id=server.id, transport=server.transport)
        return []
    timeout = float(get_settings().mcp_proxy_http_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        headers = _build_headers(server)
        resp = await client.post(
            server.url,
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("result", {}).get("tools", [])


async def proxy_call_tool(server: McpServer, tool_name: str, arguments: dict) -> dict:
    """Proxy a tool call to an external MCP server (HTTP or stdio subprocess)."""
    if server.transport == "stdio":
        return await stdio_call_tool(server, tool_name, arguments)
    if server.transport != "streamable_http" or not server.url:
        raise ValueError("mcp_transport_not_supported")
    timeout = max(120.0, float(get_settings().mcp_proxy_http_timeout_seconds))
    async with httpx.AsyncClient(timeout=timeout) as client:
        headers = _build_headers(server)
        resp = await client.post(
            server.url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments},
            },
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json().get("result", {})


def _build_headers(server: McpServer) -> dict:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if server.auth_type == "bearer" and server.auth_credential:
        headers["Authorization"] = f"Bearer {server.auth_credential}"
    elif server.auth_type == "api_key" and server.auth_credential:
        headers["X-API-Key"] = server.auth_credential
    return headers
