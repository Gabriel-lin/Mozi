"""LangGraph-powered agent runtime.

Production-grade agent implementation following LangChain's official
``create_agent`` + ``AsyncPostgresSaver`` pattern. Exposes a streaming chat
endpoint that emits AI SDK Data Stream Protocol (``UIMessageChunk``) events so
the assistant-ui frontend can render messages, reasoning, and tool calls.

Module layout:

* :mod:`checkpointer` — async Postgres checkpointer lifecycle
* :mod:`tools` — production tool registry (weather demo, web search, RAG, skills)
* :mod:`graph` — agent factory and per-agent caching
* :mod:`streaming` — LangGraph stream events → AI SDK ``UIMessageChunk`` mapper
* :mod:`threads` — thread metadata helpers backed by checkpoint history
"""

from .checkpointer import (
    get_checkpointer,
    init_checkpointer,
    shutdown_checkpointer,
)
from .graph import build_agent, clear_agent_cache
from .streaming import stream_chat_events

__all__ = [
    "build_agent",
    "clear_agent_cache",
    "get_checkpointer",
    "init_checkpointer",
    "shutdown_checkpointer",
    "stream_chat_events",
]
