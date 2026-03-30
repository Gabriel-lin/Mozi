"""MCP Gateway — aggregates external MCP servers registered in DB, proxies tool calls."""

from __future__ import annotations

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.mcp_server import McpServer

log = structlog.get_logger()


async def list_external_servers(db: AsyncSession, workspace_id: str) -> list[McpServer]:
    result = await db.execute(
        select(McpServer).where(McpServer.workspace_id == workspace_id, McpServer.is_active.is_(True))
    )
    return list(result.scalars().all())


async def proxy_list_tools(server: McpServer) -> list[dict]:
    """Call list_tools on a remote MCP server via Streamable HTTP."""
    async with httpx.AsyncClient(timeout=30) as client:
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
    """Proxy a tool call to a remote MCP server."""
    async with httpx.AsyncClient(timeout=120) as client:
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
