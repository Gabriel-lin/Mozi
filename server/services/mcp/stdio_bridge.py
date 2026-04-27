"""Run Cursor-style stdio MCP servers (subprocess + MCP SDK client) for gateway proxy calls.

Subprocesses run on the same host as the Mozi API process (``command``/``args`` must exist on
that machine, e.g. ``npx`` on ``PATH`` for local dev). Each list/call spawns a fresh session.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import Any

import structlog
from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.types import Tool
from shared.config import get_settings
from shared.models.mcp_server import McpServer

log = structlog.get_logger()


class McpStdioBridgeError(RuntimeError):
    """Invalid definition or subprocess / MCP protocol failure for stdio MCP."""


def _stdio_params_from_definition(definition: dict[str, Any]) -> StdioServerParameters:
    cmd = definition.get("command")
    if not isinstance(cmd, str) or not cmd.strip():
        raise McpStdioBridgeError("stdio MCP definition missing non-empty string `command`")
    raw_args = definition.get("args")
    args: list[str] = []
    if isinstance(raw_args, list):
        args = [str(a) for a in raw_args]
    env: dict[str, str] | None = None
    raw_env = definition.get("env")
    if isinstance(raw_env, dict):
        env = {str(k): str(v) for k, v in raw_env.items()}
    cwd = definition.get("cwd")
    cwd_val: str | None = str(cwd) if cwd is not None and str(cwd).strip() else None
    return StdioServerParameters(command=cmd.strip(), args=args, env=env, cwd=cwd_val)


def _parse_definition(server: McpServer) -> dict[str, Any]:
    try:
        d = json.loads(server.definition_json or "{}")
    except json.JSONDecodeError as e:
        raise McpStdioBridgeError(f"definition_json is not valid JSON: {e}") from e
    if not isinstance(d, dict):
        raise McpStdioBridgeError("definition_json must be a JSON object")
    return d


def _list_timeout() -> timedelta:
    return timedelta(seconds=float(get_settings().mcp_proxy_http_timeout_seconds))


def _call_timeout() -> timedelta:
    return timedelta(seconds=max(120.0, float(get_settings().mcp_proxy_http_timeout_seconds)))


def _tool_to_dict(tool: Tool) -> dict[str, Any]:
    return tool.model_dump(mode="json", by_alias=True)


async def _with_client_session(
    server: McpServer,
    work: Callable[[ClientSession], Awaitable[Any]],
    *,
    read_timeout: timedelta,
) -> Any:
    definition = _parse_definition(server)
    params = _stdio_params_from_definition(definition)
    log.info(
        "mcp_stdio_spawn",
        server_id=server.id,
        name=server.name,
        command=params.command,
        arg_count=len(params.args),
    )
    try:
        async with stdio_client(params) as (read_stream, write_stream):
            async with ClientSession(
                read_stream,
                write_stream,
                read_timeout_seconds=read_timeout,
            ) as session:
                await session.initialize()
                return await work(session)
    except McpStdioBridgeError:
        raise
    except Exception as e:
        log.exception("mcp_stdio_session_failed", server_id=server.id, name=server.name)
        raise McpStdioBridgeError(str(e)) from e


async def stdio_list_tools(server: McpServer) -> list[dict[str, Any]]:
    if server.transport != "stdio":
        return []

    async def _list(session: ClientSession) -> list[dict[str, Any]]:
        result = await session.list_tools()
        return [_tool_to_dict(t) for t in result.tools]

    return await _with_client_session(server, _list, read_timeout=_list_timeout())


async def stdio_call_tool(
    server: McpServer,
    tool_name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    if server.transport != "stdio":
        raise McpStdioBridgeError("not a stdio server")

    async def _call(session: ClientSession) -> dict[str, Any]:
        result = await session.call_tool(
            tool_name,
            arguments or None,
            read_timeout_seconds=_call_timeout(),
        )
        return result.model_dump(mode="json", by_alias=True)

    return await _with_client_session(server, _call, read_timeout=_call_timeout())
