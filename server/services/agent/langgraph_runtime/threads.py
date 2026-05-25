"""Thread metadata helpers backed by LangGraph checkpoint history.

LangGraph's checkpointer stores state per ``thread_id`` but doesn't, by itself,
expose a "thread list" UI affordance. We layer a small registry on top:

* ``thread_registry`` table tracks (thread_id, agent_id, title, timestamps)
* the LangGraph checkpointer remains the source of truth for message state

Listing threads queries the registry; loading a thread's messages reads the
checkpoint and rebuilds the ``UIMessage[]`` shape the assistant-ui frontend
expects.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from shared.database import Base
from sqlalchemy import (
    DateTime,
    String,
    Text,
    delete,
    desc,
    func,
    select,
    text,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from .checkpointer import get_checkpointer

log = structlog.get_logger()


class AgentThread(Base):
    """Lightweight thread metadata. Real messages live in LangGraph checkpoints."""

    __tablename__ = "agent_threads"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    agent_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    created_by: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# --- CRUD helpers ------------------------------------------------------------


async def ensure_thread(
    db: AsyncSession,
    *,
    thread_id: str | None,
    agent_id: str,
    user_id: str,
    title: str | None = None,
) -> AgentThread:
    """Return the existing thread row or create a new one.

    A blank / missing ``thread_id`` yields a freshly generated id so the caller
    can use the same id with the LangGraph checkpointer.
    """
    if thread_id:
        existing = await db.get(AgentThread, thread_id)
        if existing:
            existing.updated_at = datetime.now(UTC)
            await db.commit()
            await db.refresh(existing)
            return existing
    new_id = (thread_id or f"th-{uuid.uuid4().hex}").strip() or f"th-{uuid.uuid4().hex}"
    row = AgentThread(
        id=new_id,
        agent_id=agent_id,
        created_by=user_id,
        title=title,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_threads(
    db: AsyncSession, *, agent_id: str, page: int = 1, page_size: int = 50
) -> tuple[list[AgentThread], int]:
    offset = max(page - 1, 0) * page_size
    q = (
        select(AgentThread)
        .where(AgentThread.agent_id == agent_id, AgentThread.archived_at.is_(None))
        .order_by(desc(AgentThread.updated_at))
        .offset(offset)
        .limit(page_size)
    )
    rows = (await db.execute(q)).scalars().all()
    total = (
        await db.execute(
            select(func.count(AgentThread.id)).where(
                AgentThread.agent_id == agent_id, AgentThread.archived_at.is_(None)
            )
        )
    ).scalar_one()
    return list(rows), int(total or 0)


async def rename_thread(db: AsyncSession, *, thread_id: str, title: str) -> AgentThread | None:
    await db.execute(
        update(AgentThread)
        .where(AgentThread.id == thread_id)
        .values(title=title, updated_at=datetime.now(UTC))
    )
    await db.commit()
    return await db.get(AgentThread, thread_id)


async def archive_thread(db: AsyncSession, *, thread_id: str, archived: bool) -> AgentThread | None:
    await db.execute(
        update(AgentThread)
        .where(AgentThread.id == thread_id)
        .values(
            archived_at=datetime.now(UTC) if archived else None,
            updated_at=datetime.now(UTC),
        )
    )
    await db.commit()
    return await db.get(AgentThread, thread_id)


async def delete_thread(db: AsyncSession, *, thread_id: str) -> bool:
    """Delete metadata + every checkpoint row LangGraph owns for the thread.

    ``AsyncPostgresSaver.adelete_thread`` removes the underlying state rows;
    the metadata row is then removed from our registry table.
    """
    saver = await get_checkpointer()
    try:
        await saver.adelete_thread(thread_id)
    except Exception as exc:  # noqa: BLE001
        log.warning("langgraph_delete_thread_failed", thread_id=thread_id, error=str(exc))
    result = await db.execute(delete(AgentThread).where(AgentThread.id == thread_id))
    await db.commit()
    return (result.rowcount or 0) > 0


async def touch_thread(db: AsyncSession, *, thread_id: str, title: str | None = None) -> None:
    values: dict[str, Any] = {"updated_at": datetime.now(UTC)}
    if title:
        values["title"] = title[:255]
    await db.execute(update(AgentThread).where(AgentThread.id == thread_id).values(**values))
    await db.commit()


# --- history reconstruction --------------------------------------------------


def _message_to_ui(msg: BaseMessage) -> dict[str, Any] | None:
    """Convert a stored LangChain message into an AI SDK ``UIMessage`` dict."""
    if isinstance(msg, HumanMessage):
        text_val = msg.content if isinstance(msg.content, str) else _flatten_content(msg.content)
        return {
            "id": getattr(msg, "id", None) or f"u-{uuid.uuid4().hex}",
            "role": "user",
            "parts": [{"type": "text", "text": text_val}],
        }
    if isinstance(msg, AIMessage):
        text_val = msg.content if isinstance(msg.content, str) else _flatten_content(msg.content)
        parts: list[dict[str, Any]] = []
        if text_val:
            parts.append({"type": "text", "text": text_val})
        for tc in msg.tool_calls or []:
            tc_id = tc.get("id") if isinstance(tc, dict) else getattr(tc, "id", None)
            tc_name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            tc_args = tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", {})
            parts.append(
                {
                    "type": f"tool-{tc_name or 'unknown'}",
                    "toolCallId": tc_id,
                    "state": "input-available",
                    "input": tc_args or {},
                }
            )
        return {
            "id": getattr(msg, "id", None) or f"a-{uuid.uuid4().hex}",
            "role": "assistant",
            "parts": parts or [{"type": "text", "text": ""}],
        }
    if isinstance(msg, ToolMessage):
        # Merge into the previous assistant message at the caller level.
        return {
            "id": getattr(msg, "id", None) or f"t-{uuid.uuid4().hex}",
            "role": "_tool_result",
            "toolCallId": msg.tool_call_id,
            "output": _flatten_content(msg.content),
        }
    return None


def _flatten_content(content: Any) -> str:
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
    try:
        return json.dumps(content, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(content)


async def get_thread_history(thread_id: str) -> list[dict[str, Any]]:
    """Reconstruct the assistant-ui ``UIMessage[]`` array for a thread."""
    saver = await get_checkpointer()
    snapshot = await saver.aget_tuple({"configurable": {"thread_id": thread_id}})
    if not snapshot:
        return []
    values = snapshot.checkpoint.get("channel_values") or {}
    raw_messages = values.get("messages") or []

    merged: list[dict[str, Any]] = []
    for raw in raw_messages:
        if not isinstance(raw, BaseMessage):
            continue
        item = _message_to_ui(raw)
        if not item:
            continue
        if item.get("role") == "_tool_result":
            # Attach to the previous assistant message's matching tool part.
            for prev in reversed(merged):
                if prev.get("role") != "assistant":
                    continue
                for part in prev["parts"]:
                    if (
                        isinstance(part, dict)
                        and part.get("toolCallId") == item.get("toolCallId")
                        and isinstance(part.get("type"), str)
                        and part["type"].startswith("tool-")
                    ):
                        part["state"] = "output-available"
                        part["output"] = item.get("output")
                        break
                break
            continue
        merged.append(item)
    return merged


# --- title generation --------------------------------------------------------


def derive_title_from_text(text_in: str, *, max_len: int = 80) -> str:
    s = (text_in or "").strip().replace("\n", " ")
    if not s:
        return "New chat"
    if len(s) <= max_len:
        return s
    return s[: max_len - 1].rstrip() + "…"


# --- raw schema bootstrap (skip alembic for this single table) ---------------


# asyncpg refuses multi-statement prepared queries, so split DDL into one
# statement per ``execute`` call.
_DDL_STATEMENTS: tuple[Any, ...] = (
    text(
        """
        CREATE TABLE IF NOT EXISTS agent_threads (
            id          VARCHAR(64) PRIMARY KEY,
            agent_id    VARCHAR(64) NOT NULL,
            created_by  VARCHAR(64) NOT NULL,
            title       VARCHAR(255),
            summary     TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            archived_at TIMESTAMPTZ
        )
        """
    ),
    text("CREATE INDEX IF NOT EXISTS ix_agent_threads_agent_id ON agent_threads(agent_id)"),
    text("CREATE INDEX IF NOT EXISTS ix_agent_threads_created_by ON agent_threads(created_by)"),
)


async def ensure_thread_schema(db: AsyncSession) -> None:
    """Create ``agent_threads`` table on first boot if absent.

    Idempotent. Kept inline so deployments don't need a second alembic
    revision before the feature is usable.
    """
    for stmt in _DDL_STATEMENTS:
        await db.execute(stmt)
    await db.commit()
