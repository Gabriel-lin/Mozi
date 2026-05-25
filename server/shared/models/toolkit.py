from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base
from .user import _nanoid


class Toolkit(Base):
    """Global toolkit registry.

    source="builtin"  — shipped with Mozi, executor_key maps to a Python function.
    source="mcp"      — backed by an MCP server, mcp_server_id points to the relay.
    source="custom"   — user-uploaded / dynamic-loaded via a registry endpoint.
    """

    __tablename__ = "toolkits"

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    version: Mapped[str] = mapped_column(String(30), nullable=False, default="0.1.0")
    category: Mapped[str | None] = mapped_column(String(50))
    icon: Mapped[str | None] = mapped_column(String(100))

    source: Mapped[str] = mapped_column(
        Enum("builtin", "mcp", "custom", name="toolkit_source"),
        default="builtin", nullable=False,
    )
    executor_key: Mapped[str | None] = mapped_column(String(100))
    mcp_server_id: Mapped[str | None] = mapped_column(
        String(21), ForeignKey("mcp_servers.id", ondelete="SET NULL"),
    )
    config_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)

    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )


class WorkspaceToolkit(Base):
    """Many-to-many: which toolkits are installed in which workspace."""

    __tablename__ = "workspace_toolkits"

    workspace_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    toolkit_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("toolkits.id", ondelete="CASCADE"), primary_key=True
    )
    config_override: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    installed_by: Mapped[str | None] = mapped_column(
        String(21), ForeignKey("users.id", ondelete="SET NULL")
    )
    installed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
