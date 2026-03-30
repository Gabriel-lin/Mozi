from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base
from .user import _nanoid


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    user_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, unique=True)
    provider: Mapped[str] = mapped_column(String(20), default="github", nullable=False)
    provider_access_token: Mapped[str | None] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip: Mapped[str | None] = mapped_column(String(45))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
