from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base
from .user import _nanoid

WORKFLOW_STATUSES = ("draft", "active", "archived")
WORKFLOW_RUN_STATUSES = ("idle", "pending", "running", "completed", "failed", "cancelled", "paused")


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        Enum(*WORKFLOW_STATUSES, name="workflow_status", create_type=False),
        default="draft", nullable=False,
    )
    workspace_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[str] = mapped_column(
        String(21), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    tags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    workflow_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    graph_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    change_log: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[str] = mapped_column(
        String(21), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    workflow_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    version_id: Mapped[str | None] = mapped_column(
        String(21), ForeignKey("workflow_versions.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(
        Enum(*WORKFLOW_RUN_STATUSES, name="workflow_run_status", create_type=False),
        default="idle", nullable=False,
    )
    input_data: Mapped[dict | None] = mapped_column(JSONB)
    output_data: Mapped[dict | None] = mapped_column(JSONB)
    node_results: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    context_data: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    triggered_by: Mapped[str | None] = mapped_column(String(21), ForeignKey("users.id"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
