"""Bridge LangGraph's streaming events to AI SDK ``UIMessageChunk`` SSE.

The Vercel AI SDK frontend (used by assistant-ui's ``useChatRuntime`` via
``DefaultChatTransport``) consumes Server-Sent Events whose ``data:`` payloads
follow the ``UIMessageChunk`` discriminated union. The protocol is documented
in the ``ai`` package source (``UIMessageChunk`` type, ``parseJsonEventStream``
consumer). The terminator is ``data: [DONE]\\n\\n``.

We consume LangGraph's ``astream`` with ``stream_mode=["messages", "updates"]``
and translate every relevant event:

* ``AIMessageChunk.content`` text deltas → ``text-start`` / ``text-delta`` /
  ``text-end``
* ``AIMessageChunk.tool_call_chunks`` → ``tool-input-start`` /
  ``tool-input-delta``
* Finalised tool calls (from the LLM step's update) →
  ``tool-input-available``
* ``ToolMessage`` results (tools-node update) →
  ``tool-output-available``
* Reasoning content (``additional_kwargs.reasoning_content`` /
  Anthropic / OpenAI o-series) → ``reasoning-start`` / ``reasoning-delta`` /
  ``reasoning-end``

LangChain message objects are imported lazily where needed so the file can be
imported by tooling without pulling the full LangChain runtime.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

import structlog
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

log = structlog.get_logger()


# --- inbound message conversion (AI SDK UIMessage → LangChain BaseMessage) ---


def _coerce_part_text(part: dict[str, Any]) -> str:
    if part.get("type") == "text":
        return str(part.get("text") or "")
    return ""


def ui_messages_to_langchain(messages: list[dict[str, Any]]) -> list[BaseMessage]:
    """Convert the AI SDK ``UIMessage[]`` request body into LangChain messages.

    The AI SDK send shape per message is::

        {
          "id": "...",
          "role": "user" | "assistant" | "system",
          "parts": [{"type": "text", "text": "..."}, ...]
        }

    We collapse text parts into a single string. File / image / tool parts are
    ignored here for simplicity — full multimodal forwarding is a future
    extension.
    """
    out: list[BaseMessage] = []
    for m in messages:
        role = m.get("role")
        parts = m.get("parts") or []
        text = "".join(_coerce_part_text(p) for p in parts if isinstance(p, dict))
        if not text and isinstance(m.get("content"), str):
            text = m["content"]
        if role == "user":
            out.append(HumanMessage(content=text))
        elif role == "assistant":
            out.append(AIMessage(content=text))
        elif role == "system":
            out.append(SystemMessage(content=text))
    return out


def latest_user_message(messages: list[dict[str, Any]]) -> BaseMessage | None:
    """Pick the most recent user-role :class:`UIMessage`.

    LangGraph's checkpointer already holds the full thread history, so on each
    turn we only need to append the latest user input. This keeps the request
    payload small and avoids re-sending the entire transcript.
    """
    for m in reversed(messages):
        if m.get("role") == "user":
            parts = m.get("parts") or []
            text = "".join(_coerce_part_text(p) for p in parts if isinstance(p, dict))
            if not text and isinstance(m.get("content"), str):
                text = m["content"]
            if text:
                return HumanMessage(content=text)
    return None


# --- outbound SSE encoding (UIMessageChunk → SSE event) ----------------------


def _sse(event: dict[str, Any]) -> str:
    """Encode a UIMessageChunk as a single SSE event."""
    return f"data: {json.dumps(event, ensure_ascii=False, separators=(',', ':'))}\n\n"


_DONE = "data: [DONE]\n\n"


def _extract_text_from_content(content: Any) -> str:
    """Flatten LangChain message content into a plain string.

    Models may emit ``content`` as ``str`` or as a list of typed blocks
    (Anthropic / GPT-4 multi-modal). We pick out text blocks.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for blk in content:
            if isinstance(blk, str):
                parts.append(blk)
            elif isinstance(blk, dict):
                if blk.get("type") == "text" and "text" in blk:
                    parts.append(str(blk["text"]))
        return "".join(parts)
    return ""


def _extract_reasoning(chunk: AIMessageChunk) -> str:
    """Extract reasoning content from a model chunk if present.

    Different providers expose reasoning in different keys; we probe the most
    common locations.
    """
    extras = getattr(chunk, "additional_kwargs", None) or {}
    val = extras.get("reasoning_content") or extras.get("reasoning")
    if isinstance(val, str):
        return val
    # Anthropic streams thinking deltas as content blocks of type 'thinking'.
    content = getattr(chunk, "content", None)
    if isinstance(content, list):
        out: list[str] = []
        for blk in content:
            if isinstance(blk, dict) and blk.get("type") in {"thinking", "reasoning"}:
                t = blk.get("thinking") or blk.get("text") or blk.get("reasoning")
                if isinstance(t, str):
                    out.append(t)
        if out:
            return "".join(out)
    return ""


# --- core stream loop --------------------------------------------------------


class _StreamState:
    """Track open text / reasoning / tool blocks so we close them correctly."""

    def __init__(self) -> None:
        self.message_id: str = f"msg-{uuid.uuid4().hex}"
        self.text_id: str | None = None
        self.reasoning_id: str | None = None
        self.tool_calls_open: dict[str, str] = {}  # tool_call_id -> tool_name
        # Track which tool calls have been finalised (input-available emitted).
        self.tool_calls_finalised: set[str] = set()


async def stream_chat_events(
    agent: Any,
    *,
    thread_id: str,
    new_messages: list[BaseMessage],
    metadata: dict[str, Any] | None = None,
) -> AsyncIterator[str]:
    """Run the agent and yield AI SDK SSE chunks.

    ``thread_id`` is forwarded to LangGraph's checkpointer so the entire
    conversation is durably persisted. ``new_messages`` should normally just
    be the latest user turn — the checkpointer holds prior context.
    """
    state = _StreamState()

    yield _sse(
        {
            "type": "start",
            "messageId": state.message_id,
            **({"messageMetadata": metadata} if metadata else {}),
        }
    )
    yield _sse({"type": "start-step"})

    config = {"configurable": {"thread_id": thread_id}}

    try:
        async for mode, payload in agent.astream(
            {"messages": new_messages},
            config=config,
            stream_mode=["messages", "updates"],
        ):
            if mode == "messages":
                async for chunk in _emit_message_chunk(state, payload):
                    yield chunk
            elif mode == "updates":
                async for chunk in _emit_update_chunk(state, payload):
                    yield chunk
    except Exception as exc:  # noqa: BLE001  surface to UI
        log.exception("langgraph_stream_error", error=str(exc))
        # Close any open text/reasoning blocks before erroring out.
        async for chunk in _close_open_blocks(state):
            yield chunk
        yield _sse({"type": "error", "errorText": str(exc)})
        yield _sse({"type": "finish-step"})
        yield _sse({"type": "finish", "finishReason": "error"})
        yield _DONE
        return

    async for chunk in _close_open_blocks(state):
        yield chunk

    yield _sse({"type": "finish-step"})
    yield _sse({"type": "finish", "finishReason": "stop"})
    yield _DONE


async def _emit_message_chunk(state: _StreamState, payload: Any) -> AsyncIterator[str]:
    """Handle a ``stream_mode='messages'`` tuple ``(AIMessageChunk, metadata)``."""
    try:
        chunk, _meta = payload
    except (TypeError, ValueError):
        return
    if not isinstance(chunk, AIMessageChunk):
        return

    # Reasoning deltas (o-series, Anthropic extended thinking, etc.)
    reasoning = _extract_reasoning(chunk)
    if reasoning:
        if state.reasoning_id is None:
            state.reasoning_id = f"reasoning-{uuid.uuid4().hex}"
            yield _sse({"type": "reasoning-start", "id": state.reasoning_id})
        yield _sse(
            {
                "type": "reasoning-delta",
                "id": state.reasoning_id,
                "delta": reasoning,
            }
        )

    # Visible text deltas.
    text = _extract_text_from_content(chunk.content)
    if text:
        # Close any open reasoning block before text begins.
        if state.reasoning_id is not None:
            yield _sse({"type": "reasoning-end", "id": state.reasoning_id})
            state.reasoning_id = None
        if state.text_id is None:
            state.text_id = f"text-{uuid.uuid4().hex}"
            yield _sse({"type": "text-start", "id": state.text_id})
        yield _sse(
            {
                "type": "text-delta",
                "id": state.text_id,
                "delta": text,
            }
        )

    # Streaming tool call argument deltas.
    for tc in getattr(chunk, "tool_call_chunks", None) or []:
        tc_id = tc.get("id") or tc.get("index")
        tc_name = tc.get("name")
        tc_args = tc.get("args") or ""
        if tc_id is None:
            continue
        key = str(tc_id)
        if key not in state.tool_calls_open and tc_name:
            state.tool_calls_open[key] = tc_name
            yield _sse(
                {
                    "type": "tool-input-start",
                    "toolCallId": key,
                    "toolName": tc_name,
                }
            )
        if tc_args:
            yield _sse(
                {
                    "type": "tool-input-delta",
                    "toolCallId": key,
                    "inputTextDelta": tc_args,
                }
            )


async def _emit_update_chunk(state: _StreamState, payload: Any) -> AsyncIterator[str]:
    """Handle a ``stream_mode='updates'`` event ``{node_name: {"messages": [...]}}``."""
    if not isinstance(payload, dict):
        return

    for node_name, node_update in payload.items():
        if not isinstance(node_update, dict):
            continue
        msgs = node_update.get("messages") or []
        for msg in msgs:
            if isinstance(msg, AIMessage):
                # The LLM-node update gives us the final tool_calls list with
                # validated argument JSON. Finalise any open tool-input blocks.
                for tc in msg.tool_calls or []:
                    tc_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
                    tc_name = (
                        tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
                    )
                    tc_args = (
                        tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", {})
                    )
                    if not tc_id or tc_id in state.tool_calls_finalised:
                        continue
                    # Make sure we emitted a start (in case the LLM didn't stream chunks).
                    if tc_id not in state.tool_calls_open and tc_name:
                        state.tool_calls_open[tc_id] = tc_name
                        yield _sse(
                            {
                                "type": "tool-input-start",
                                "toolCallId": tc_id,
                                "toolName": tc_name,
                            }
                        )
                    yield _sse(
                        {
                            "type": "tool-input-available",
                            "toolCallId": tc_id,
                            "toolName": tc_name or state.tool_calls_open.get(tc_id, "unknown"),
                            "input": tc_args or {},
                        }
                    )
                    state.tool_calls_finalised.add(tc_id)
            elif isinstance(msg, ToolMessage):
                tc_id = getattr(msg, "tool_call_id", None) or ""
                content = _extract_text_from_content(msg.content)
                # Try to parse JSON for richer rendering on the UI side.
                output: Any = content
                if content:
                    try:
                        output = json.loads(content)
                    except (ValueError, TypeError):
                        output = content
                yield _sse(
                    {
                        "type": "tool-output-available",
                        "toolCallId": tc_id,
                        "output": output,
                    }
                )
        # Hint: log unknown nodes once for debugging.
        if not msgs:
            log.debug("langgraph_stream_empty_update", node=node_name)


async def _close_open_blocks(state: _StreamState) -> AsyncIterator[str]:
    if state.reasoning_id is not None:
        yield _sse({"type": "reasoning-end", "id": state.reasoning_id})
        state.reasoning_id = None
    if state.text_id is not None:
        yield _sse({"type": "text-end", "id": state.text_id})
        state.text_id = None
