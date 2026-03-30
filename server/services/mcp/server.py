"""MCP Server — exposes Mozi capabilities to external AI tools via Streamable HTTP."""

from __future__ import annotations

from mcp.server import Server
from mcp.types import Tool, TextContent

from shared.config import get_settings

settings = get_settings()

mcp_server = Server(settings.mcp_server_name)


@mcp_server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="run_agent",
            description="Run a Mozi agent with a given goal",
            inputSchema={
                "type": "object",
                "properties": {
                    "agent_id": {"type": "string", "description": "Agent ID to run"},
                    "goal": {"type": "string", "description": "Goal / prompt for the agent"},
                },
                "required": ["agent_id", "goal"],
            },
        ),
        Tool(
            name="list_agents",
            description="List all agents in a workspace",
            inputSchema={
                "type": "object",
                "properties": {
                    "workspace_id": {"type": "string", "description": "Workspace ID"},
                },
                "required": ["workspace_id"],
            },
        ),
        Tool(
            name="get_run_status",
            description="Get the status and result of an agent run",
            inputSchema={
                "type": "object",
                "properties": {
                    "run_id": {"type": "string", "description": "Run ID to check"},
                },
                "required": ["run_id"],
            },
        ),
    ]


@mcp_server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    import json
    from shared.database import async_session_factory
    from services.agent import service as agent_svc

    async with async_session_factory() as db:
        if name == "run_agent":
            agent = await agent_svc.get_agent(db, arguments["agent_id"])
            if not agent:
                return [TextContent(type="text", text="Agent not found")]
            run = await agent_svc.start_run(
                db, arguments["agent_id"], arguments["goal"], triggered_by="mcp"
            )
            return [TextContent(type="text", text=json.dumps({"run_id": run.id, "status": run.status}))]

        elif name == "list_agents":
            agents, total, _, _ = await agent_svc.list_agents(db, arguments["workspace_id"])
            items = [{"id": a.id, "name": a.name, "description": a.description} for a in agents]
            return [TextContent(type="text", text=json.dumps({"agents": items, "total": total}))]

        elif name == "get_run_status":
            run = await agent_svc.get_run(db, arguments["run_id"])
            if not run:
                return [TextContent(type="text", text="Run not found")]
            return [TextContent(type="text", text=json.dumps({
                "run_id": run.id, "status": run.status, "output": run.output, "error": run.error,
            }))]

        return [TextContent(type="text", text=f"Unknown tool: {name}")]
