"""Agent factory built on :func:`langchain.agents.create_agent`.

Each ``(provider, model)`` combination produces a compiled LangGraph
:class:`Runnable` reusable across requests; we cache them in-process so the
graph compile cost is paid once. The shared
:class:`~langgraph.checkpoint.postgres.aio.AsyncPostgresSaver` powers
short-term memory keyed by ``thread_id``.
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog
from langchain.agents import create_agent
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from shared.config import get_settings

from .checkpointer import get_checkpointer
from .tools import build_tools_for_agent

log = structlog.get_logger()
settings = get_settings()


DEFAULT_SYSTEM_PROMPT = (
    "You are Mozi, a helpful, accurate, and concise AI assistant.\n"
    "- When the user asks about weather, call `geocode_location` first to "
    "resolve the place to coordinates, then `weather_forecast`.\n"
    "- For questions that benefit from up-to-date facts or external "
    "documentation, prefer `web_search` followed by `fetch_url`.\n"
    "- Use `list_skills` / `read_skill` to consult installed Mozi skills when "
    "the user's request matches one of them.\n"
    "- Cite the URL when you ground an answer on a fetched page.\n"
    "- Answer in the same language as the user's most recent message."
)


def _resolve_provider(provider: str | None, model: str | None) -> str:
    p = (provider or "").strip().lower()
    if p:
        return p
    m = (model or "").lower()
    if m.startswith(("gpt-", "o1", "o3", "o4", "chatgpt")):
        return "openai"
    if m.startswith("claude"):
        return "anthropic"
    if m.startswith(("gemini", "models/gemini")):
        return "google"
    if m.startswith("deepseek"):
        return "deepseek"
    if m.startswith(("mozi", "vllm-")):
        return "vllm"
    if settings.openai_api_key:
        return "openai"
    if settings.deepseek_api_key:
        return "deepseek"
    if settings.anthropic_api_key:
        return "anthropic"
    if settings.google_api_key:
        return "google"
    return "vllm"


def _build_chat_model(provider: str, model: str | None) -> BaseChatModel:
    """Instantiate a :class:`BaseChatModel` for the resolved provider."""
    timeout = settings.llm_request_timeout_seconds
    retries = settings.llm_max_retries
    chosen = (model or "").strip()

    if provider == "openai":
        return ChatOpenAI(
            model=chosen or settings.default_llm_model,
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            timeout=timeout,
            max_retries=retries,
            streaming=True,
        )

    if provider == "deepseek":
        # DeepSeek exposes an OpenAI-compatible Chat Completions API.
        return ChatOpenAI(
            model=chosen or settings.deepseek_default_model,
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout=timeout,
            max_retries=retries,
            streaming=True,
        )

    if provider == "vllm":
        return ChatOpenAI(
            model=chosen or settings.vllm_model,
            api_key=settings.vllm_api_key or "EMPTY",
            base_url=settings.vllm_base_url,
            timeout=timeout,
            max_retries=retries,
            streaming=True,
        )

    if provider == "anthropic":
        return ChatAnthropic(
            model_name=chosen or settings.anthropic_default_model,
            api_key=settings.anthropic_api_key,
            base_url=settings.anthropic_base_url,
            timeout=timeout,
            max_retries=retries,
            streaming=True,
        )

    if provider == "google":
        return ChatGoogleGenerativeAI(
            model=chosen or settings.google_default_model,
            google_api_key=settings.google_api_key,
            timeout=timeout,
            max_retries=retries,
        )

    raise ValueError(f"Unsupported LLM provider: {provider!r}")


_cache: dict[tuple[str, str, str, str], Any] = {}
_cache_lock = asyncio.Lock()


def _agent_cache_key(
    provider: str, model: str, system_prompt: str, tool_names: list[str]
) -> tuple[str, str, str, str]:
    # Sort tool names so ``["a","b"]`` and ``["b","a"]`` hit the same cache slot.
    return (provider, model, system_prompt, ",".join(sorted(tool_names)))


async def build_agent(
    *,
    provider: str | None,
    model: str | None,
    system_prompt: str | None,
    config: dict[str, Any] | None,
) -> Any:
    """Build (or fetch from cache) a compiled LangGraph agent.

    Returns the compiled graph; call ``await graph.astream(..., stream_mode=...)``
    to consume incremental updates.
    """
    resolved_provider = _resolve_provider(provider, model)
    chat_model = _build_chat_model(resolved_provider, model)
    tools: list[BaseTool] = build_tools_for_agent(config)
    prompt = (system_prompt or "").strip() or DEFAULT_SYSTEM_PROMPT

    tool_names = [t.name for t in tools]
    key = _agent_cache_key(resolved_provider, (model or "").strip(), prompt, tool_names)

    async with _cache_lock:
        cached = _cache.get(key)
        if cached is not None:
            return cached

        checkpointer = await get_checkpointer()
        agent = create_agent(
            model=chat_model,
            tools=tools,
            system_prompt=prompt,
            checkpointer=checkpointer,
        )
        _cache[key] = agent
        log.info(
            "langgraph_agent_built",
            provider=resolved_provider,
            model=model or "<default>",
            tools=[t.name for t in tools],
        )
        return agent


def clear_agent_cache() -> None:
    """Drop every cached compiled graph. Used by hot-reload helpers."""
    _cache.clear()
