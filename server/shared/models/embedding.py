from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from shared.database import Base
from .user import _nanoid


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[str] = mapped_column(String(21), primary_key=True, default=_nanoid)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(1536))
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    source: Mapped[str | None] = mapped_column(String(100))
    source_id: Mapped[str | None] = mapped_column(String(100))
    workspace_id: Mapped[str] = mapped_column(
        String(21), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
