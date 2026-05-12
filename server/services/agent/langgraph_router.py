"""FastAPI router for the LangGraph-powered chat endpoint.

Exposes a minimal surface compatible with Vercel AI SDK's
``DefaultChatTransport``:

* ``POST /agents/{agent_id}/chat`` — streams ``UIMessageChunk`` SSE
* ``GET  /agents/{agent_id}/threads`` — list saved threads
* ``GET  /agents/{agent_id}/threads/{thread_id}/messages`` — load history
* ``PATCH /agents/{agent_id}/threads/{thread_id}`` — rename / archive
* ``DELETE /agents/{agent_id}/threads/{thread_id}`` — delete (also clears
  LangGraph checkpoints)

The thread metadata table is bootstrapped on first POST so the integration is
ready without an alembic migration step.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from shared.database import get_db
from shared.dependencies import get_current_user
from shared.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession

from services.workspace.service import is_workspace_member

from . import service
from .langgraph_runtime import build_agent, stream_chat_events
from .langgraph_runtime.streaming import latest_user_message
from .langgraph_runtime.threads import (
    archive_thread,
    delete_thread,
    derive_title_from_text,
    ensure_thread,
    ensure_thread_schema,
    get_thread_history,
    list_threads,
    rename_thread,
    touch_thread,
)

log = structlog.get_logger()

router = APIRouter(prefix="/agents", tags=["agents-langgraph"])


# --- schemas -----------------------------------------------------------------


class _UIPart(BaseModel):
    type: str
    text: str | None = None


class _UIMessage(BaseModel):
    id: str | None = None
    role: str
    parts: list[_UIPart] | None = None
    content: str | None = None  # backwards-compat with bare-text bodies


class ChatRequest(BaseModel):
    """AI SDK ``DefaultChatTransport`` request body. ``messageId`` follows AI SDK's
    camelCase wire format — silenced with ``model_config`` rather than renamed.
    """

    model_config = {"populate_by_name": True}

    id: str | None = Field(default=None, description="Thread/chat id (AI SDK chatId)")
    messages: list[_UIMessage] = Field(default_factory=list)
    trigger: str | None = None
    messageId: str | None = Field(default=None, alias="messageId")  # noqa: N815  AI SDK wire
    # Optional client overrides
    model: str | None = None
    title: str | None = None


class ThreadOut(BaseModel):
    id: str
    agent_id: str
    title: str | None
    created_at: str
    updated_at: str
    archived_at: str | None


class ThreadListOut(BaseModel):
    threads: list[ThreadOut]
    total: int
    page: int
    page_size: int


class ThreadPatch(BaseModel):
    title: str | None = None
    archived: bool | None = None


class ThreadMessagesOut(BaseModel):
    thread_id: str
    messages: list[dict[str, Any]]


# --- helpers -----------------------------------------------------------------


def _to_thread_out(row: Any) -> ThreadOut:
    return ThreadOut(
        id=row.id,
        agent_id=row.agent_id,
        title=row.title,
        created_at=row.created_at.isoformat() if row.created_at else "",
        updated_at=row.updated_at.isoformat() if row.updated_at else "",
        archived_at=row.archived_at.isoformat() if row.archived_at else None,
    )


async def _ensure_agent_access(db: AsyncSession, agent_id: str, user: User):
    agent = await service.get_agent(db, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    if not await is_workspace_member(db, agent.workspace_id, user.id):
        raise HTTPException(403, "Forbidden")
    return agent


# --- endpoints ---------------------------------------------------------------


@router.post("/{agent_id}/chat")
async def chat(
    agent_id: str,
    body: ChatRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a response from the LangGraph agent as AI SDK SSE chunks."""
    agent = await _ensure_agent_access(db, agent_id, user)
    await ensure_thread_schema(db)

    # Derive thread id (frontend sends it as ``id`` from useChatRuntime).
    incoming_id = (body.id or "").strip() or None
    user_msg = latest_user_message([m.model_dump() for m in body.messages])
    if user_msg is None:
        raise HTTPException(400, "No user message in payload")

    title_hint = body.title or derive_title_from_text(
        user_msg.content if isinstance(user_msg.content, str) else ""
    )
    thread = await ensure_thread(
        db,
        thread_id=incoming_id,
        agent_id=agent_id,
        user_id=user.id,
        title=title_hint,
    )

    provider = None
    config = agent.config if isinstance(agent.config, dict) else {}
    if isinstance(config, dict):
        provider = config.get("llm_provider")
    model = (body.model or agent.model or "").strip() or None

    try:
        compiled = await build_agent(
            provider=str(provider) if provider else None,
            model=model,
            system_prompt=agent.system_prompt,
            config=config if isinstance(config, dict) else None,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    # Refresh thread metadata once at the start so the sidebar reorders fast.
    await touch_thread(db, thread_id=thread.id, title=title_hint)

    async def _stream() -> AsyncIterator[str]:
        try:
            async for chunk in stream_chat_events(
                compiled,
                thread_id=thread.id,
                new_messages=[user_msg],
                metadata={"agent_id": agent_id, "thread_id": thread.id},
            ):
                # Cooperative cancellation when the client disconnects.
                if await request.is_disconnected():
                    log.info("langgraph_chat_disconnected", thread_id=thread.id)
                    return
                yield chunk
        except Exception as exc:  # noqa: BLE001
            log.exception("langgraph_chat_failed", thread_id=thread.id, error=str(exc))
            yield (
                "data: "
                + json.dumps({"type": "error", "errorText": str(exc)}, ensure_ascii=False)
                + "\n\n"
            )
            yield "data: [DONE]\n\n"

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",  # disable nginx buffering when reverse-proxied
        "Connection": "keep-alive",
        # Required for assistant-ui / AI SDK to identify the v2 stream protocol.
        "x-vercel-ai-ui-message-stream": "v1",
    }
    return StreamingResponse(_stream(), media_type="text/event-stream", headers=headers)


@router.get("/{agent_id}/threads", response_model=ThreadListOut)
async def list_agent_threads(
    agent_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_agent_access(db, agent_id, user)
    await ensure_thread_schema(db)
    rows, total = await list_threads(db, agent_id=agent_id, page=page, page_size=page_size)
    return ThreadListOut(
        threads=[_to_thread_out(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/{agent_id}/threads", response_model=ThreadOut, status_code=201)
async def create_agent_thread(
    agent_id: str,
    body: ThreadPatch | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_agent_access(db, agent_id, user)
    await ensure_thread_schema(db)
    thread = await ensure_thread(
        db,
        thread_id=f"th-{uuid.uuid4().hex}",
        agent_id=agent_id,
        user_id=user.id,
        title=(body.title if body else None),
    )
    return _to_thread_out(thread)


@router.get("/{agent_id}/threads/{thread_id}/messages", response_model=ThreadMessagesOut)
async def get_agent_thread_messages(
    agent_id: str,
    thread_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_agent_access(db, agent_id, user)
    await ensure_thread_schema(db)
    messages = await get_thread_history(thread_id)
    return ThreadMessagesOut(thread_id=thread_id, messages=messages)


@router.patch("/{agent_id}/threads/{thread_id}", response_model=ThreadOut)
async def patch_agent_thread(
    agent_id: str,
    thread_id: str,
    body: ThreadPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_agent_access(db, agent_id, user)
    await ensure_thread_schema(db)
    updated = None
    if body.title is not None:
        updated = await rename_thread(db, thread_id=thread_id, title=body.title)
    if body.archived is not None:
        updated = await archive_thread(db, thread_id=thread_id, archived=body.archived)
    if not updated:
        raise HTTPException(404, "Thread not found")
    return _to_thread_out(updated)


@router.delete("/{agent_id}/threads/{thread_id}", status_code=204)
async def delete_agent_thread(
    agent_id: str,
    thread_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _ensure_agent_access(db, agent_id, user)
    await ensure_thread_schema(db)
    ok = await delete_thread(db, thread_id=thread_id)
    if not ok:
        raise HTTPException(404, "Thread not found")
