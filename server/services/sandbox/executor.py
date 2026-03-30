"""LangChain agent executor — runs inside Celery worker."""

from __future__ import annotations

import structlog
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from shared.config import get_settings

log = structlog.get_logger()
settings = get_settings()


def build_llm(model: str | None = None, temperature: float = 0.2) -> ChatOpenAI:
    return ChatOpenAI(
        base_url=settings.vllm_base_url,
        api_key="EMPTY",
        model=model or settings.vllm_model,
        temperature=temperature,
    )


def build_agent_executor(
    system_prompt: str,
    tools: list | None = None,
    model: str | None = None,
    max_steps: int = 10,
) -> AgentExecutor:
    llm = build_llm(model)
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder("chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ])
    agent = create_openai_tools_agent(llm, tools or [], prompt)
    return AgentExecutor(
        agent=agent,
        tools=tools or [],
        max_iterations=max_steps,
        verbose=settings.debug,
        return_intermediate_steps=True,
    )


async def run_agent(
    system_prompt: str,
    goal: str,
    tools: list | None = None,
    model: str | None = None,
    max_steps: int = 10,
) -> dict:
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
