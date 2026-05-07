"""Bridge MCP-backed toolkits into LangChain-compatible tools.

For each installed toolkit with source="mcp", we create a LangChain
StructuredTool that proxies calls through the MCP gateway.
"""

from __future__ import annotations

import json

import httpx
import structlog
from langchain_core.tools import StructuredTool

log = structlog.get_logger()


def _make_mcp_tool(tk: dict) -> StructuredTool | None:
    """Create a LangChain tool that proxies to an MCP server."""
    url = tk.get("mcp_server_url")
    if not url:
        log.warning("mcp_tool_no_url", toolkit_id=tk["id"], name=tk["name"])
        return None

    config = json.loads(tk.get("config_json", "{}"))
    tool_name = config.get("mcp_tool_name", tk["name"].lower().replace(" ", "_"))

    async def _run(**kwargs: object) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                url,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {"name": tool_name, "arguments": kwargs},
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            result = resp.json().get("result", {})
            return json.dumps(result, ensure_ascii=False)

    return StructuredTool.from_function(
        coroutine=_run,
        name=tool_name,
        description=tk.get("name", tool_name),
    )


def resolve_mcp_tools(installed: list[dict]) -> list[StructuredTool]:
    """Given resolved installed toolkit dicts, return LangChain tools for MCP ones."""
    tools: list[StructuredTool] = []
    for tk in installed:
        if tk["source"] != "mcp":
            continue
        tool = _make_mcp_tool(tk)
        if tool:
            tools.append(tool)
    return tools
