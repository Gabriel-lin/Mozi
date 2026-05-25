from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base
from .user import _nanoid


class McpServer(Base):
    __tablename__ = "mcp_servers"
    __table_args__ = (UniqueConstraint("workspace_id", "name", name="uq_mcp_servers_workspace_name"),)

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    transport: Mapped[str] = mapped_column(String(30), default="streamable_http", nullable=False)
    definition_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    auth_type: Mapped[str | None] = mapped_column(String(20))
    auth_credential: Mapped[str | None] = mapped_column(Text)
    workspace_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_health_check: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
