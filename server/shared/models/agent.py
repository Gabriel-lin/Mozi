from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base

from .user import _nanoid

AGENT_STATUSES = ("idle", "planning", "executing", "waiting", "completed", "failed", "stopped")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    version: Mapped[str] = mapped_column(String(20), default="0.1.0", nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    system_prompt: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(100))
    max_steps: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    tags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    workspace_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[str] = mapped_column(
        String(21), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    agent_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        Enum(*AGENT_STATUSES, name="agent_status"), default="idle", nullable=False
    )
    goal: Mapped[str | None] = mapped_column(Text)
    steps: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    output: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    total_steps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    triggered_by: Mapped[str | None] = mapped_column(String(21), ForeignKey("users.id"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    pinned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    feedback: Mapped[str | None] = mapped_column(String(16), nullable=True)
