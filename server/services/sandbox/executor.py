"""LangChain agent executor — runs inside Celery worker."""

from __future__ import annotations

import structlog
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from shared.config import get_settings

from .agent_run_pub import AgentRunCancelError
from .llm_routing import build_chat_model, resolve_effective_model_id

log = structlog.get_logger()
settings = get_settings()


def build_agent_executor(
    system_prompt: str,
    tools: list | None = None,
    model: str | None = None,
    max_steps: int = 10,
) -> AgentExecutor:
    llm = build_chat_model(model)
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder("chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ])
    agent = create_tool_calling_agent(llm, tools or [], prompt)
    return AgentExecutor(
        agent=agent,
        tools=tools or [],
        max_iterations=max_steps,
        verbose=settings.debug,
        return_intermediate_steps=True,
    )


async def resolve_workspace_tools(workspace_id: str) -> list:
    """Query installed toolkits for a workspace and return LangChain tools."""
    from shared.database import async_session_factory

    from services.workspace.service import resolve_installed_toolkits

    from .builtin_tools import resolve_builtin_tools
    from .mcp_tools import resolve_mcp_tools

    async with async_session_factory() as db:
        installed = await resolve_installed_toolkits(db, workspace_id)

    tools = resolve_builtin_tools(installed)
    tools.extend(resolve_mcp_tools(installed))
    log.info(
        "resolved_workspace_tools",
        workspace_id=workspace_id,
        count=len(tools),
        names=[t.name for t in tools],
    )
    return tools


def _chunk_text_from_stream_chunk(chunk) -> str:
    if chunk is None:
        return ""
    if hasattr(chunk, "content"):
        c = chunk.content
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            parts: list[str] = []
            for p in c:
                if isinstance(p, dict) and p.get("type") == "text":
                    parts.append(str(p.get("text", "")))
                elif isinstance(p, str):
                    parts.append(p)
            return "".join(parts)
    return ""


async def run_agent_streaming(
    *,
    system_prompt: str,
    goal: str,
    tools: list | None = None,
    model: str | None = None,
    max_steps: int = 10,
    workspace_id: str | None = None,
    publish,
    cancelled,
) -> dict:
    """Run agent while emitting progress events via ``publish`` (async dict -> None).

    ``cancelled`` is an async callable returning True when the run should stop.
    """
    if workspace_id and not tools:
        tools = await resolve_workspace_tools(workspace_id)

    executor = build_agent_executor(system_prompt, tools, model, max_steps)

    preview = system_prompt if len(system_prompt) <= 800 else system_prompt[:800] + "…"
    await publish({
        "type": "meta",
        "system_prompt_preview": preview,
        "user_goal": goal,
        "model": resolve_effective_model_id(model),
    })
    await publish({"type": "phase", "phase": "tools_loaded", "tool_count": len(tools or [])})

    steps: list[dict] = []
    final_output = ""

    async for ev in executor.astream_events({"input": goal}, version="v2"):
        if await cancelled():
            raise AgentRunCancelError()
        et = ev.get("event")
        data = ev.get("data") or {}
        if et == "on_chat_model_stream":
            text = _chunk_text_from_stream_chunk(data.get("chunk"))
            if text:
                await publish({"type": "llm_delta", "text": text})
        elif et == "on_tool_start":
            name = ev.get("name") or data.get("name") or ""
            inp = data.get("input")
            await publish({
                "type": "tool_start",
                "tool": str(name),
                "input": str(inp)[:8000] if inp is not None else "",
            })
        elif et == "on_tool_end":
            name = ev.get("name") or data.get("name") or ""
            out = data.get("output")
            out_s = str(out)[:12000] if out is not None else ""
            await publish({"type": "tool_end", "tool": str(name), "output": out_s})
            tin = str(data.get("input", ""))[:4000]
            steps.append({"tool": str(name), "input": tin, "output": out_s})
        elif et == "on_chain_end":
            out = data.get("output")
            if isinstance(out, dict) and "output" in out:
                final_output = str(out.get("output") or "")

    if not final_output:
        # Fallback: single-shot invoke if stream did not surface final text
        result = await executor.ainvoke({"input": goal})
        final_output = str(result.get("output", ""))
        steps = []
        for action, observation in result.get("intermediate_steps", []):
            steps.append({
                "tool": action.tool,
                "input": str(action.tool_input),
                "output": str(observation),
            })

    return {"output": final_output, "steps": steps, "total_steps": len(steps)}


async def run_agent(
    system_prompt: str,
    goal: str,
    tools: list | None = None,
    model: str | None = None,
    max_steps: int = 10,
    workspace_id: str | None = None,
) -> dict:
    """Batch run (no streaming hooks) — kept for tests / tooling."""
    if workspace_id and not tools:
        tools = await resolve_workspace_tools(workspace_id)

    executor = build_agent_executor(system_prompt, tools, model, max_steps)
    result = await executor.ainvoke({"input": goal})
    steps = []
    for action, observation in result.get("intermediate_steps", []):
        steps.append({
            "tool": action.tool,
            "input": str(action.tool_input),
            "output": str(observation),
        })
    return {
        "output": result.get("output", ""),
        "steps": steps,
        "total_steps": len(steps),
    }
